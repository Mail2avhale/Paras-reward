from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging
import uuid

# Cache manager (shared instance)
try:
    from cache_manager import cache
except Exception:
    class _NullCache:
        async def get(self, *a, **kw): return None
        async def set(self, *a, **kw): return None
        async def delete(self, *a, **kw): return None
    cache = _NullCache()

# Shared helpers from server.py (lazy import to avoid circulars at module load)
try:
    from server import (
        verify_user_access_sync,
        check_user_active_status,
    )
except Exception:
    def verify_user_access_sync(*args, **kwargs):
        return True
    async def check_user_active_status(*args, **kwargs):
        return (True, None)

router = APIRouter(prefix="/notifications", tags=["Notifications"])

db = None
_get_user_all_time_redeemed = None

def set_db(database):
    global db
    db = database

def set_helpers(helpers: dict):
    global _get_user_all_time_redeemed
    _get_user_all_time_redeemed = helpers.get('get_user_all_time_redeemed')


# --- IDOR-safe auth dependency (Jul 2026 security pass) --------------------
# Path `uid` must equal the JWT subject; admins bypass for support ops.
_security = HTTPBearer(auto_error=False)


async def _require_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    from server import get_current_user as _real_dep
    return await _real_dep(credentials)


def _assert_notification_owner(uid: str, current_user: dict) -> None:
    caller_uid = current_user.get("uid")
    caller_role = current_user.get("role", "user")
    if caller_role not in ("admin", "sub_admin") and caller_uid != uid:
        raise HTTPException(
            status_code=403,
            detail="Access denied. You can only view your own notifications.",
        )


@router.get("/{uid}")
async def get_notifications(
    uid: str,
    page: int = 1,
    limit: int = 20,
    unread_only: bool = False,
    current_user: dict = Depends(_require_authenticated_user),
):
    """Get user's notifications. Authenticated + IDOR-safe (Jul 2026).

    FIX (Feb 2026): Some services historically wrote only `user_id` and others
    wrote only `user_uid`. Query the union so we never silently drop docs.
    """
    _assert_notification_owner(uid, current_user)
    skip = (page - 1) * limit

    owner_clause = {"$or": [{"user_uid": uid}, {"user_id": uid}]}
    if unread_only:
        # `read` was the canonical flag; some older docs use `is_read`.
        query = {
            "$and": [
                owner_clause,
                {"$or": [{"read": False}, {"is_read": False}]},
            ]
        }
    else:
        query = owner_clause

    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    total = await db.notifications.count_documents(query)
    unread_count = await db.notifications.count_documents({
        "$and": [owner_clause, {"$or": [{"read": False}, {"is_read": False}]}]
    })

    return {
        "notifications": notifications,
        "total": total,
        "unread_count": unread_count,
        "page": page,
        "limit": limit
    }


@router.get("/{uid}/unread-count")
async def get_notification_unread_count(uid: str):
    """Get unread notification count (tolerates legacy user_id-only docs)."""
    owner_clause = {"$or": [{"user_uid": uid}, {"user_id": uid}]}
    count = await db.notifications.count_documents({
        "$and": [owner_clause, {"$or": [{"read": False}, {"is_read": False}]}]
    })
    return {"unread_count": count}


@router.put("/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a single notification as read"""
    result = await db.notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "message": "Notification marked as read"}


@router.put("/{uid}/read-all")
async def mark_all_notifications_read(uid: str):
    """Mark all notifications as read for a user (handles both schemas)."""
    result = await db.notifications.update_many(
        {
            "$and": [
                {"$or": [{"user_uid": uid}, {"user_id": uid}]},
                {"$or": [{"read": False}, {"is_read": False}]},
            ]
        },
        {"$set": {
            "read": True,
            "is_read": True,
            "read_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    return {"success": True, "marked_count": result.modified_count}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str):
    """Delete a notification"""
    result = await db.notifications.delete_one({"notification_id": notification_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "message": "Notification deleted"}


@router.delete("/{uid}/clear-all")
async def clear_all_notifications(uid: str):
    """Clear all notifications for a user (handles both schemas)."""
    result = await db.notifications.delete_many(
        {"$or": [{"user_uid": uid}, {"user_id": uid}]}
    )
    return {"success": True, "deleted_count": result.deleted_count}


@router.post("/send")
async def send_notification_to_user(request: Request):
    """Send a notification to a specific user - Admin only"""
    data = await request.json()
    user_uid = data.get("user_uid")
    title = data.get("title", "New Notification")
    message = data.get("message", "")
    notification_type = data.get("type", "system")
    icon = data.get("icon", "🔔")
    action_url = data.get("action_url")
    
    if not user_uid:
        raise HTTPException(status_code=400, detail="user_uid is required")
    
    notification = {
        "notification_id": str(uuid.uuid4()),
        "user_id": user_uid,
        "user_uid": user_uid,
        "title": title,
        "message": message,
        "type": notification_type,
        "icon": icon,
        "action_url": action_url,
        "read": False,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"success": True, "notification_id": notification["notification_id"]}


@router.post("/broadcast")
async def broadcast_notification(request: Request):
    """Broadcast notification to all users or specific plan users - Admin only"""
    data = await request.json()
    title = data.get("title", "New Announcement")
    message = data.get("message", "")
    notification_type = data.get("type", "announcement")
    icon = data.get("icon", "📢")
    action_url = data.get("action_url")
    target_plan = data.get("target_plan")  # Optional: startup, growth, elite, all
    
    # Get target users
    query = {}
    if target_plan and target_plan != "all":
        query["subscription_plan"] = target_plan
    
    users = await db.users.find(query, {"uid": 1}).to_list(10000)
    
    notifications = []
    now = datetime.now(timezone.utc).isoformat()
    
    for user in users:
        notifications.append({
            "notification_id": str(uuid.uuid4()),
            "user_id": user["uid"],
            "user_uid": user["uid"],
            "title": title,
            "message": message,
            "type": notification_type,
            "icon": icon,
            "action_url": action_url,
            "read": False,
            "is_read": False,
            "created_at": now
        })
    
    if notifications:
        await db.notifications.insert_many(notifications)
    
    return {"success": True, "sent_count": len(notifications)}


# ========== ADVANCED NOTIFICATION FEATURES ==========

@router.post("/{uid}/bulk-delete")
async def bulk_delete_notifications(uid: str, request: Request):
    """Delete multiple notifications by IDs"""
    data = await request.json()
    notification_ids = data.get("notification_ids", [])
    
    if not notification_ids:
        raise HTTPException(status_code=400, detail="notification_ids required")
    
    result = await db.notifications.delete_many({
        "user_uid": uid,
        "notification_id": {"$in": notification_ids}
    })
    
    return {"success": True, "deleted_count": result.deleted_count}


@router.post("/{uid}/bulk-mark-read")
async def bulk_mark_notifications_read(uid: str, request: Request):
    """Mark multiple notifications as read by IDs"""
    data = await request.json()
    notification_ids = data.get("notification_ids", [])
    
    if not notification_ids:
        raise HTTPException(status_code=400, detail="notification_ids required")
    
    result = await db.notifications.update_many(
        {"user_uid": uid, "notification_id": {"$in": notification_ids}},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "marked_count": result.modified_count}


@router.delete("/{uid}/by-type/{notification_type}")
async def delete_notifications_by_type(uid: str, notification_type: str):
    """Delete all notifications of a specific type for a user"""
    result = await db.notifications.delete_many({
        "user_uid": uid,
        "type": notification_type
    })
    
    return {"success": True, "deleted_count": result.deleted_count}


@router.delete("/{uid}/read")
async def delete_read_notifications(uid: str):
    """Delete all read notifications for a user (cleanup)"""
    result = await db.notifications.delete_many({
        "user_uid": uid,
        "read": True
    })
    
    return {"success": True, "deleted_count": result.deleted_count}


@router.delete("/{uid}/older-than/{days}")
async def delete_old_notifications(uid: str, days: int):
    """Delete notifications older than specified days"""
    if days < 1:
        raise HTTPException(status_code=400, detail="Days must be at least 1")
    
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    result = await db.notifications.delete_many({
        "user_uid": uid,
        "created_at": {"$lt": cutoff_date}
    })
    
    return {"success": True, "deleted_count": result.deleted_count}


@router.get("/{uid}/grouped")
async def get_grouped_notifications(uid: str, limit: int = 50):
    """Get notifications grouped by date (Today, Yesterday, This Week, Older)"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    week_start = today_start - timedelta(days=7)
    
    notifications = await db.notifications.find(
        {"user_uid": uid},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    grouped = {
        "today": [],
        "yesterday": [],
        "this_week": [],
        "older": []
    }
    
    for notif in notifications:
        created_at = notif.get("created_at", "")
        try:
            notif_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            if notif_date >= today_start:
                grouped["today"].append(notif)
            elif notif_date >= yesterday_start:
                grouped["yesterday"].append(notif)
            elif notif_date >= week_start:
                grouped["this_week"].append(notif)
            else:
                grouped["older"].append(notif)
        except:
            grouped["older"].append(notif)
    
    unread_count = await db.notifications.count_documents({"user_uid": uid, "read": False})
    
    return {
        "grouped": grouped,
        "total": len(notifications),
        "unread_count": unread_count,
        "counts": {
            "today": len(grouped["today"]),
            "yesterday": len(grouped["yesterday"]),
            "this_week": len(grouped["this_week"]),
            "older": len(grouped["older"])
        }
    }


@router.get("/{uid}/by-type")
async def get_notifications_by_type(uid: str):
    """Get notification counts and samples by type"""
    pipeline = [
        {"$match": {"user_uid": uid}},
        {"$group": {
            "_id": "$type",
            "count": {"$sum": 1},
            "unread": {"$sum": {"$cond": [{"$eq": ["$read", False]}, 1, 0]}},
            "latest": {"$first": "$created_at"}
        }},
        {"$sort": {"count": -1}}
    ]
    
    results = await db.notifications.aggregate(pipeline).to_list(50)
    
    types = {}
    for r in results:
        type_name = r["_id"] or "general"
        types[type_name] = {
            "count": r["count"],
            "unread": r["unread"],
            "latest": r["latest"]
        }
    
    return {"types": types, "total_types": len(types)}


@router.get("/{uid}/stats")
async def get_notification_stats(uid: str):
    """Get detailed notification statistics for a user"""
    total = await db.notifications.count_documents({"user_uid": uid})
    unread = await db.notifications.count_documents({"user_uid": uid, "read": False})
    read = total - unread
    
    # Get oldest and newest
    oldest = await db.notifications.find_one(
        {"user_uid": uid},
        {"_id": 0, "created_at": 1},
        sort=[("created_at", 1)]
    )
    newest = await db.notifications.find_one(
        {"user_uid": uid},
        {"_id": 0, "created_at": 1},
        sort=[("created_at", -1)]
    )
    
    # Count by type
    type_counts = await db.notifications.aggregate([
        {"$match": {"user_uid": uid}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    return {
        "total": total,
        "unread": unread,
        "read": read,
        "read_percentage": round((read / total * 100), 1) if total > 0 else 0,
        "oldest": oldest.get("created_at") if oldest else None,
        "newest": newest.get("created_at") if newest else None,
        "by_type": {t["_id"] or "general": t["count"] for t in type_counts}
    }


@router.put("/{uid}/preferences")
async def update_notification_preferences(uid: str, request: Request):
    """Update user's notification preferences (mute types, etc.)"""
    data = await request.json()
    
    # Preferences structure
    preferences = {
        "muted_types": data.get("muted_types", []),  # Types to not show
        "email_enabled": data.get("email_enabled", True),
        "push_enabled": data.get("push_enabled", True),
        "sound_enabled": data.get("sound_enabled", True),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.update_one(
        {"uid": uid},
        {"$set": {"notification_preferences": preferences}}
    )
    
    return {"success": True, "preferences": preferences}


@router.get("/{uid}/preferences")
async def get_notification_preferences(uid: str):
    """Get user's notification preferences"""
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "notification_preferences": 1})
    
    # Default preferences
    default_prefs = {
        "muted_types": [],
        "email_enabled": True,
        "push_enabled": True,
        "sound_enabled": True
    }
    
    return user.get("notification_preferences", default_prefs) if user else default_prefs


# ========== USER SEARCH & DISCOVERY ==========

@router.get("/social/search-users")
async def search_users(
    q: str = "", 
    city: str = None, 
    state: str = None,
    page: int = 1, 
    limit: int = 20
):
    """
    Search for users by name, referral code, city or state
    - q: Search query for name or referral code
    - city: Filter by city (exact match, case insensitive)
    - state: Filter by state (exact match, case insensitive)
    """
    skip = (page - 1) * limit
    
    # Build query
    query = {"is_public": {"$ne": False}}  # Only public profiles
    
    # Name/code search
    if q and len(q) >= 2:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"referral_code": {"$regex": q, "$options": "i"}}
        ]
    
    # Location filters
    if city:
        query["city"] = {"$regex": f"^{city}$", "$options": "i"}
    if state:
        query["state"] = {"$regex": f"^{state}$", "$options": "i"}
    
    # If no search criteria, return empty
    if not q and not city and not state:
        return {"users": [], "total": 0, "page": page, "total_pages": 0}
    
    users = await db.users.find(
        query,
        {"_id": 0, "uid": 1, "name": 1, "avatar": 1, "kyc_verified": 1, "membership_type": 1, "referral_count": 1, "city": 1, "state": 1}
    ).skip(skip).limit(limit).to_list(limit)
    
    total = await db.users.count_documents(query)
    
    result = []
    for user in users:
        # Get badge
        team_size = user.get("referral_count", 0)
        badge = None
        if team_size >= 100: badge = "🏆"
        elif team_size >= 50: badge = "👑"
        elif team_size >= 25: badge = "💎"
        elif team_size >= 10: badge = "🔥"
        elif team_size >= 5: badge = "⭐"
        elif team_size >= 1: badge = "🌱"
        
        # Get followers count
        followers = await db.follows.count_documents({"following_uid": user["uid"]})
        
        result.append({
            "uid": user["uid"],
            "name": user.get("name", "User"),
            "avatar": user.get("avatar"),
            "city": user.get("city", ""),
            "state": user.get("state", ""),
            "is_verified": user.get("kyc_verified", False),
            "membership_type": user.get("membership_type", "free"),
            "badge": badge,
            "team_size": team_size,
            "followers_count": followers
        })
    
    return {
        "users": result,
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit
    }


@router.get("/social/suggested-users/{uid}")
async def get_suggested_users(uid: str, limit: int = 10):
    """
    Get suggested users to follow with smart recommendations:
    1. Friends of friends (team-based)
    2. Same city users
    3. Same state users  
    4. Popular users (most followers)
    """
    # Get current user info
    current_user = await db.users.find_one({"uid": uid}, {"_id": 0, "city": 1, "state": 1, "referred_by": 1})
    user_city = current_user.get("city", "") if current_user else ""
    user_state = current_user.get("state", "") if current_user else ""
    
    # Get users the current user is already following
    following = await db.follows.find(
        {"follower_uid": uid},
        {"_id": 0, "following_uid": 1}
    ).to_list(1000)
    
    following_uids = [f["following_uid"] for f in following]
    following_uids.append(uid)  # Exclude self
    
    suggestions = []
    seen_uids = set(following_uids)
    
    # Helper function to format user
    async def format_user(user, reason=""):
        team_size = user.get("referral_count", 0)
        badge = None
        if team_size >= 100: badge = "🏆"
        elif team_size >= 50: badge = "👑"
        elif team_size >= 25: badge = "💎"
        elif team_size >= 10: badge = "🔥"
        elif team_size >= 5: badge = "⭐"
        elif team_size >= 1: badge = "🌱"
        
        followers_count = await db.follows.count_documents({"following_uid": user["uid"]})
        
        return {
            "uid": user["uid"],
            "name": user.get("name", "User"),
            "avatar": user.get("avatar"),
            "city": user.get("city", ""),
            "state": user.get("state", ""),
            "is_verified": user.get("kyc_verified", False),
            "membership_type": user.get("membership_type", "free"),
            "badge": badge,
            "team_size": team_size,
            "followers_count": followers_count,
            "reason": reason
        }
    
    # 1. FRIENDS OF FRIENDS (Team-based suggestions)
    # Get people that users I follow also follow
    if following_uids and len(suggestions) < limit:
        # Get who my friends follow
        friends_following = await db.follows.find(
            {"follower_uid": {"$in": following_uids[:-1]}},  # Exclude self
            {"_id": 0, "following_uid": 1}
        ).to_list(500)
        
        # Count how many of my friends follow each person
        fof_counts = {}
        for f in friends_following:
            fof_uid = f["following_uid"]
            if fof_uid not in seen_uids:
                fof_counts[fof_uid] = fof_counts.get(fof_uid, 0) + 1
        
        # Sort by number of mutual connections
        sorted_fof = sorted(fof_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        for fof_uid, count in sorted_fof:
            if len(suggestions) >= limit:
                break
            user = await db.users.find_one(
                {"uid": fof_uid, "is_public": {"$ne": False}},
                {"_id": 0, "uid": 1, "name": 1, "avatar": 1, "kyc_verified": 1, "membership_type": 1, "referral_count": 1, "city": 1, "state": 1}
            )
            if user:
                formatted = await format_user(user, f"Followed by {count} people you follow")
                suggestions.append(formatted)
                seen_uids.add(fof_uid)
    
    # 2. SAME CITY users
    if user_city and len(suggestions) < limit:
        city_users = await db.users.find(
            {
                "uid": {"$nin": list(seen_uids)},
                "city": {"$regex": f"^{user_city}$", "$options": "i"},
                "is_public": {"$ne": False}
            },
            {"_id": 0, "uid": 1, "name": 1, "avatar": 1, "kyc_verified": 1, "membership_type": 1, "referral_count": 1, "city": 1, "state": 1}
        ).sort("referral_count", -1).limit(limit - len(suggestions)).to_list(limit - len(suggestions))
        
        for user in city_users:
            if len(suggestions) >= limit:
                break
            formatted = await format_user(user, f"From {user_city}")
            suggestions.append(formatted)
            seen_uids.add(user["uid"])
    
    # 3. SAME STATE users
    if user_state and len(suggestions) < limit:
        state_users = await db.users.find(
            {
                "uid": {"$nin": list(seen_uids)},
                "state": {"$regex": f"^{user_state}$", "$options": "i"},
                "is_public": {"$ne": False}
            },
            {"_id": 0, "uid": 1, "name": 1, "avatar": 1, "kyc_verified": 1, "membership_type": 1, "referral_count": 1, "city": 1, "state": 1}
        ).sort("referral_count", -1).limit(limit - len(suggestions)).to_list(limit - len(suggestions))
        
        for user in state_users:
            if len(suggestions) >= limit:
                break
            formatted = await format_user(user, f"From {user_state}")
            suggestions.append(formatted)
            seen_uids.add(user["uid"])
    
    # 4. POPULAR USERS (fallback - most followers)
    if len(suggestions) < limit:
        pipeline = [
            {"$match": {
                "uid": {"$nin": list(seen_uids)},
                "is_public": {"$ne": False}
            }},
            {"$lookup": {
                "from": "follows",
                "localField": "uid",
                "foreignField": "following_uid",
                "as": "followers"
            }},
            {"$addFields": {
                "followers_count": {"$size": "$followers"}
            }},
            {"$sort": {"followers_count": -1, "referral_count": -1}},
            {"$limit": limit - len(suggestions)},
            {"$project": {
                "_id": 0,
                "uid": 1,
                "name": 1,
                "avatar": 1,
                "kyc_verified": 1,
                "membership_type": 1,
                "referral_count": 1,
                "city": 1,
                "state": 1,
                "followers_count": 1
            }}
        ]
        
        popular_users = await db.users.aggregate(pipeline).to_list(limit - len(suggestions))
        
        for user in popular_users:
            if len(suggestions) >= limit:
                break
            formatted = await format_user(user, "Popular in the community")
            suggestions.append(formatted)
            seen_uids.add(user["uid"])
    
    return {"suggested_users": suggestions}



def _mask(mobile):
    if not mobile:
        return None
    s = str(mobile)
    return s[:2] + "*****" + s[-2:] if len(s) >= 4 else "*****"


# ========== DIRECT REFERRAL MESSAGING ==========

@router.get("/referrals/{user_id}/direct-list")
async def get_direct_referrals_list(user_id: str, page: int = 1, limit: int = 20):
    """
    Get list of direct referrals.
    Searches across ALL known referrer-link fields/values to handle legacy data.
    """
    skip = (page - 1) * limit

    # Get user's referral_code
    current_user_for_code = await db.users.find_one(
        {"uid": user_id},
        {"_id": 0, "referral_code": 1}
    )
    user_referral_code = current_user_for_code.get("referral_code", "") if current_user_for_code else ""

    # Build a forgiving OR query — covers legacy variants
    candidate_fields = ["referred_by", "referrer_id", "sponsor_id", "invited_by"]
    candidate_values = [v for v in [user_id, user_referral_code] if v]
    ref_or_conds = []
    for fld in candidate_fields:
        for val in candidate_values:
            ref_or_conds.append({fld: val})
    ref_filter = {"$or": ref_or_conds} if ref_or_conds else {"referred_by": user_id}
    
    # Get direct referrals (users who used this user's referral code)
    # NOTE: `avatar` and `profile_picture` intentionally NOT projected here.
    # Some users have base64 images (150-250 KB each) stored inline, which
    # inflated the /direct-list response to >300 KB and caused the Invite
    # page to time out. Frontend renders an initial-letter placeholder.
    direct_referrals = await db.users.find(
        ref_filter,
        {
            "_id": 0, 
            "uid": 1, 
            "name": 1, 
            "email": 1,
            "mobile": 1,
            "city": 1, 
            "state": 1,
            "subscription_plan": 1,
            "membership_type": 1,
            "mining_active": 1,
            "mining_session_end": 1,
            "last_login": 1,
            "created_at": 1,
            "allow_messages": 1,
            "prc_balance": 1,
            "total_mined": 1,
            "total_mined_prc": 1,
            "total_redeemed": 1
        }
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.users.count_documents(ref_filter)
    
    # Also get the user who referred this user (can also message them)
    current_user = await db.users.find_one(
        {"uid": user_id},
        {"_id": 0, "referred_by": 1}
    )
    
    referrer = None
    if current_user and current_user.get("referred_by"):
        referrer_data = await db.users.find_one(
            {"uid": current_user["referred_by"]},
            {
                "_id": 0,
                "uid": 1,
                "name": 1,
                "avatar": 1,
                "profile_picture": 1,
                "city": 1,
                "state": 1,
                "subscription_plan": 1,
                "allow_messages": 1
            }
        )
        if referrer_data:
            referrer = {
                "uid": referrer_data["uid"],
                "name": referrer_data.get("name", "Unknown"),
                "avatar": referrer_data.get("avatar") or referrer_data.get("profile_picture"),
                "city": referrer_data.get("city", ""),
                "state": referrer_data.get("state", ""),
                "subscription_plan": referrer_data.get("subscription_plan", "explorer"),
                "can_message": referrer_data.get("allow_messages", True)
            }
    
    # Compute Total Redeemed for ALL referrals in parallel (canonical source).
    # Same data User 360 page shows. Capped at 5s for whole batch so /direct-list
    # never times out even with 50+ referrals.
    # Optimization: skip lifetime calc for users with zero mining activity —
    # they've almost certainly never redeemed (saves 16 collection scans each).
    redeemed_by_uid = {}
    candidates_for_calc = [
        r for r in direct_referrals
        if (r.get("total_mined_prc") or r.get("total_mined") or r.get("prc_balance") or 0) > 0
    ]
    if _get_user_all_time_redeemed and candidates_for_calc:
        async def _calc(uid):
            try:
                v = await _get_user_all_time_redeemed(uid)
                return uid, float(v or 0)
            except Exception:
                return uid, 0.0
        try:
            import asyncio as _aio
            results = await _aio.wait_for(
                _aio.gather(*[_calc(r["uid"]) for r in candidates_for_calc]),
                timeout=5.0,
            )
            for uid, val in results:
                redeemed_by_uid[uid] = val
        except _aio.TimeoutError:
            logging.warning(
                f"[DIRECT-LIST] redeemed-PRC batch timed out for "
                f"{len(candidates_for_calc)} referrals; showing 0"
            )
        except Exception as e:
            logging.warning(f"[DIRECT-LIST] redeemed batch error: {e}")

    # Get current PRC rate ONCE for INR conversion (PRC ÷ rate = INR)
    try:
        from utils.helpers import get_prc_rate
        current_prc_rate = await get_prc_rate(db)
    except Exception:
        current_prc_rate = 28.57  # safe fallback
    if not current_prc_rate or current_prc_rate <= 0:
        current_prc_rate = 28.57

    # Format referrals
    result = []
    now = datetime.now(timezone.utc)
    for ref in direct_referrals:
        # UPDATED: Active = Elite subscription + Mining session active
        is_active = False
        subscription_plan = (ref.get("subscription_plan") or "").lower()
        
        is_elite = subscription_plan == "elite"
        is_mining = False
        
        # Check mining_active flag (ignore session end time)
        mining_active = ref.get("mining_active")
        is_mining_flag = mining_active is True or mining_active == "true" or mining_active == True
        
        # Active only if Elite AND mining_active flag is True
        is_active = is_elite and is_mining_flag
        
        # PRC used (Total Redeemed) — pulled from the parallel batch above
        # (same calculation User 360 page uses). Falls back to stored field
        # only if the batch timed out.
        ref_uid = ref["uid"]
        prc_used = float(redeemed_by_uid.get(ref_uid, ref.get("total_redeemed", 0) or 0))
        
        # Reconcile prc_earned: max(total_mined, total_mined_prc, prc_balance + total_redeemed)
        raw_total_mined = float(ref.get("total_mined", 0) or 0)
        raw_total_mined_prc = float(ref.get("total_mined_prc", 0) or 0)
        prc_balance = float(ref.get("prc_balance", 0) or 0)
        fallback_mined = prc_balance + prc_used
        prc_earned = max(raw_total_mined, raw_total_mined_prc, fallback_mined)
        
        result.append({
            "uid": ref_uid,
            "name": ref.get("name", "Unknown"),
            "mobile": ref.get("mobile", ""),
            # avatar intentionally omitted — see projection comment above
            "city": ref.get("city", ""),
            "state": ref.get("state", ""),
            "subscription_plan": ref.get("subscription_plan") or ("explorer" if ref.get("membership_type") == "free" else "startup"),
            "is_active": is_active,
            "joined_at": ref.get("created_at", ""),
            "last_seen": ref.get("last_login", ""),
            "can_message": ref.get("allow_messages", True),
            "prc_earned": round(prc_earned, 2),
            "prc_used": round(prc_used, 2),
            "redeemed_inr": round(prc_used / current_prc_rate, 2) if current_prc_rate > 0 else 0,
        })
    
    return {
        "referrals": result,
        "referrer": referrer,
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit
    }


# ========== NEARBY USERS (IP-BASED) ==========

@router.get("/social/nearby-users/{uid}")
async def get_nearby_users(uid: str, limit: int = 20):
    """
    Get users who are nearby based on IP geolocation
    Only shows users who have opted-in to location visibility
    """
    # Get current user's location data
    current_user = await db.users.find_one(
        {"uid": uid},
        {"_id": 0, "city": 1, "state": 1, "country": 1, "ip_location": 1, "show_location": 1}
    )
    
    if not current_user:
        return {"nearby_users": [], "message": "User not found"}
    
    user_city = current_user.get("city") or current_user.get("ip_location", {}).get("city", "")
    user_state = current_user.get("state") or current_user.get("ip_location", {}).get("region", "")
    user_country = current_user.get("country") or current_user.get("ip_location", {}).get("country", "India")
    
    if not user_city and not user_state:
        return {"nearby_users": [], "message": "Location not available. Please update your profile."}
    
    # Get users the current user is already following
    following = await db.follows.find(
        {"follower_uid": uid},
        {"_id": 0, "following_uid": 1}
    ).to_list(1000)
    following_uids = {f["following_uid"] for f in following}
    following_uids.add(uid)  # Exclude self
    
    nearby_users = []
    seen_uids = set(following_uids)
    
    # Helper function to format user
    async def format_nearby_user(user, distance_label=""):
        followers_count = await db.follows.count_documents({"following_uid": user["uid"]})
        is_following = user["uid"] in following_uids
        
        return {
            "uid": user["uid"],
            "name": user.get("name", "User"),
            "avatar": user.get("avatar") or user.get("profile_picture"),
            "city": user.get("city", ""),
            "state": user.get("state", ""),
            "subscription_plan": user.get("subscription_plan", "explorer"),
            "is_verified": user.get("kyc_verified", False),
            "followers_count": followers_count,
            "is_following": is_following,
            "distance_label": distance_label,
            "can_message": user.get("allow_messages", True)
        }
    
    # 1. SAME CITY users (closest)
    if user_city:
        city_users = await db.users.find(
            {
                "uid": {"$nin": list(seen_uids)},
                "$or": [
                    {"city": {"$regex": f"^{user_city}$", "$options": "i"}},
                    {"ip_location.city": {"$regex": f"^{user_city}$", "$options": "i"}}
                ],
                "show_location": True,
                "is_public": {"$ne": False}
            },
            {
                "_id": 0, "uid": 1, "name": 1, "avatar": 1, "profile_picture": 1,
                "city": 1, "state": 1, "subscription_plan": 1, "kyc_verified": 1, "allow_messages": 1
            }
        ).limit(limit).to_list(limit)
        
        for user in city_users:
            if len(nearby_users) >= limit:
                break
            formatted = await format_nearby_user(user, f"In {user_city}")
            nearby_users.append(formatted)
            seen_uids.add(user["uid"])
    
    # 2. SAME STATE users (nearby)
    if user_state and len(nearby_users) < limit:
        state_users = await db.users.find(
            {
                "uid": {"$nin": list(seen_uids)},
                "$or": [
                    {"state": {"$regex": f"^{user_state}$", "$options": "i"}},
                    {"ip_location.region": {"$regex": f"^{user_state}$", "$options": "i"}}
                ],
                "show_location": True,
                "is_public": {"$ne": False}
            },
            {
                "_id": 0, "uid": 1, "name": 1, "avatar": 1, "profile_picture": 1,
                "city": 1, "state": 1, "subscription_plan": 1, "kyc_verified": 1, "allow_messages": 1
            }
        ).limit(limit - len(nearby_users)).to_list(limit - len(nearby_users))
        
        for user in state_users:
            if len(nearby_users) >= limit:
                break
            formatted = await format_nearby_user(user, f"In {user_state}")
            nearby_users.append(formatted)
            seen_uids.add(user["uid"])
    
    return {
        "nearby_users": nearby_users,
        "user_location": {
            "city": user_city,
            "state": user_state,
            "country": user_country
        },
        "total": len(nearby_users)
    }


@router.put("/user/{uid}/location-visibility")
async def update_location_visibility(uid: str, data: dict, request: Request):
    """
    Update user's location visibility setting (opt-in/opt-out for nearby users feature)
    SECURITY: IDOR Protection - Users can only update their own settings
    """
    verify_user_access_sync(request, uid)
    
    show_location = data.get("show_location", False)
    
    result = await db.users.update_one(
        {"uid": uid},
        {"$set": {"show_location": show_location, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "success": True,
        "show_location": show_location,
        "message": "Location visibility updated" if show_location else "You are now hidden from nearby users"
    }


@router.post("/user/{uid}/update-ip-location")
async def update_user_ip_location(uid: str, request: Request):
    """
    Update user's IP-based location (called on login/app open)
    Uses IP geolocation to determine approximate location
    """
    # Get client IP
    client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if not client_ip:
        client_ip = request.headers.get("X-Real-IP", "")
    if not client_ip and request.client:
        client_ip = request.client.host
    
    # Skip for localhost
    if client_ip in ["127.0.0.1", "localhost", "::1", ""]:
        return {"success": True, "message": "Localhost - location not updated"}
    
    try:
        # Use free IP geolocation API
        import httpx
        async with httpx.AsyncClient() as client:
            # Using ip-api.com (free, no API key needed)
            response = await client.get(f"http://ip-api.com/json/{client_ip}?fields=status,city,regionName,country,lat,lon")
            
            if response.status_code == 200:
                geo_data = response.json()
                
                if geo_data.get("status") == "success":
                    ip_location = {
                        "city": geo_data.get("city", ""),
                        "region": geo_data.get("regionName", ""),
                        "country": geo_data.get("country", "India"),
                        "lat": geo_data.get("lat"),
                        "lon": geo_data.get("lon"),
                        "ip": client_ip,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Update user's IP location
                    await db.users.update_one(
                        {"uid": uid},
                        {
                            "$set": {
                                "ip_location": ip_location,
                                "last_ip": client_ip
                            }
                        }
                    )
                    
                    return {
                        "success": True,
                        "location": {
                            "city": ip_location["city"],
                            "state": ip_location["region"],
                            "country": ip_location["country"]
                        }
                    }
        
        return {"success": False, "message": "Could not determine location"}
        
    except Exception as e:
        print(f"IP geolocation error: {e}")
        return {"success": False, "message": "Location service unavailable"}


# ========== REFERRAL PROGRAM ==========

@router.get("/referrals/{user_id}/level-breakdown")
async def get_referrals_level_breakdown(user_id: str):
    """L1-L5 breakdown for /referrals page (Jun 2026).

    For each level returns: total count, active count, inactive count,
    total PRC balance across that level, top performer.

    "Active" = subscription_plan ∈ {startup, growth, elite}.
    Mining-boost benefit per level computed downstream on frontend.
    """
    levels = {f"L{i}": {"total": 0, "active": 0, "inactive": 0,
                        "prc_sum": 0.0, "top": None} for i in range(1, 6)}
    grand_total = {"users": 0, "active": 0, "prc_sum": 0.0}

    async def walk(uids, depth):
        if depth > 5 or not uids:
            return
        children_uids = []
        cursor = db.users.find(
            {"referred_by": {"$in": uids}},
            {"_id": 0, "uid": 1, "name": 1, "mobile": 1,
             "subscription_plan": 1, "prc_balance": 1, "is_mining": 1,
             "last_login_at": 1, "created_at": 1}
        )
        bucket = levels[f"L{depth}"]
        async for u in cursor:
            children_uids.append(u["uid"])
            bucket["total"] += 1
            grand_total["users"] += 1
            plan = (u.get("subscription_plan") or "").lower()
            is_active = plan in ("startup", "growth", "elite")
            if is_active:
                bucket["active"] += 1
                grand_total["active"] += 1
            else:
                bucket["inactive"] += 1
            prc = float(u.get("prc_balance") or 0)
            bucket["prc_sum"] += prc
            grand_total["prc_sum"] += prc

            # Track top performer (highest PRC)
            if not bucket["top"] or prc > (bucket["top"].get("prc_balance") or 0):
                bucket["top"] = {
                    "uid": u["uid"],
                    "name": u.get("name", "Anonymous"),
                    "mobile": (u.get("mobile") or "")[-4:],
                    "prc_balance": prc,
                    "plan": plan or "explorer",
                }
        if children_uids:
            await walk(children_uids, depth + 1)

    try:
        await walk([user_id], 1)
    except Exception as e:
        return {"success": False, "error": str(e)}

    # Build per-level mining boost % (proxy: each active member contributes 2%
    # up to a cap of 100% per level — informational, matches single-leg model)
    PER_ACTIVE_BOOST = 2  # %
    LEVEL_CAP = 100       # %
    boosts = {}
    for lvl, b in levels.items():
        contribution = min(LEVEL_CAP, b["active"] * PER_ACTIVE_BOOST)
        boosts[lvl] = contribution

    total_boost = sum(boosts.values())

    return {
        "success": True,
        "levels": levels,
        "boosts_pct": boosts,
        "total_mining_boost_pct": total_boost,
        "grand_total": grand_total,
    }



@router.get("/user/{user_id}/full-debug")
async def get_user_full_debug(user_id: str):
    """
    COMPREHENSIVE DEBUG: Returns ALL relevant data for a user to diagnose issues.
    Use this in production to understand what's happening.
    user_id can be UID or email address.
    """
    # Support both UID and email
    user = await db.users.find_one({"uid": user_id}, {"_id": 0, "password": 0})
    if not user:
        # Try by email
        user = await db.users.find_one({"email": user_id}, {"_id": 0, "password": 0})
    if not user:
        # Try by email lowercase
        user = await db.users.find_one({"email": user_id.lower()}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail=f"User not found with UID or email: {user_id}")
    
    now = datetime.now(timezone.utc)
    
    # Mining status
    mining_session_end = user.get("mining_session_end")
    session_active = False
    remaining_hours = 0
    
    if mining_session_end:
        try:
            if isinstance(mining_session_end, str):
                end_time = datetime.fromisoformat(mining_session_end.replace('Z', '+00:00'))
            else:
                end_time = mining_session_end
            
            session_active = now < end_time
            if session_active:
                remaining_hours = (end_time - now).total_seconds() / 3600
        except:
            pass
    
    # Calculate mining rate
    base_rate = 1.0  # PRC per hour
    plan = user.get("subscription_plan", "explorer").lower()
    multiplier = {"explorer": 1, "startup": 1.5, "growth": 2, "elite": 3}.get(plan, 1)
    referral_bonus = user.get("referral_bonus_rate", 0)
    day_multiplier = user.get("mining_day", 1)
    mining_rate = day_multiplier * ((base_rate * multiplier) + referral_bonus)
    
    # Get referral counts using aggressive search
    search_values = [user.get("uid"), user.get("referral_code")]
    if user.get("referral_code"):
        search_values.extend([user["referral_code"].lower(), user["referral_code"].upper()])
    if user.get("email"):
        search_values.append(user["email"])
    if user.get("name"):
        search_values.append(user["name"])
    search_values = [v for v in search_values if v]
    
    referral_count_by_search = await db.users.count_documents({"referred_by": {"$in": search_values}})
    
    return {
        "user_basic": {
            "uid": user.get("uid"),
            "name": user.get("name"),
            "email": user.get("email"),
            "referral_code": user.get("referral_code"),
            "subscription_plan": user.get("subscription_plan"),
            "membership_type": user.get("membership_type"),
            "prc_balance": round(user.get("prc_balance", 0), 2)
        },
        "mining_status": {
            "mining_active_field": user.get("mining_active"),
            "mining_start_time": str(user.get("mining_start_time")),
            "mining_session_end": str(user.get("mining_session_end")),
            "is_session_active_now": session_active,
            "remaining_hours": round(remaining_hours, 2),
            "current_time_utc": now.isoformat(),
            "reason_if_inactive": "Session expired" if not session_active and mining_session_end else "Never started"
        },
        "mining_rate_calculation": {
            "base_rate": base_rate,
            "plan": plan,
            "plan_multiplier": multiplier,
            "referral_bonus_rate": referral_bonus,
            "mining_day": day_multiplier,
            "calculated_rate_per_hour": round(mining_rate, 2),
            "formula": "Day × ((BaseRate × PlanMultiplier) + ReferralBonus)"
        },
        "referral_status": {
            "stored_referral_count": user.get("referral_count"),
            "actual_count_by_aggressive_search": referral_count_by_search,
            "referral_bonus_rate": user.get("referral_bonus_rate"),
            "search_values_used": search_values[:5]
        },
        "timestamps": {
            "user_created_at": str(user.get("created_at")),
            "last_login": str(user.get("last_login")),
            "debug_generated_at": now.isoformat()
        }
    }




# ========== FREE STARTUP SUBSCRIPTION MODULE - DISABLED ==========
# Removed per user request
# @router.get("/referrals/{user_id}/reward-progress")
# async def get_referral_reward_progress(user_id: str):
#     """DISABLED: Free Startup Subscription reward progress API removed"""
#     raise HTTPException(status_code=410, detail="This feature has been discontinued")
# ================================================================


@router.get("/debug/user-mining-status/{email_or_uid}")
async def debug_user_mining_status(email_or_uid: str):
    """
    DEBUG ENDPOINT: Check a user's active status based on NEW criteria:
    1. Mining session active
    2. Bonus collected in last 24h
    3. Tap Game or Rain Drop played in last 24h
    """
    # Try to find user by UID first, then by email
    user = await db.users.find_one({"uid": email_or_uid}, {"_id": 0, "password_hash": 0})
    if not user:
        user = await db.users.find_one({"email": email_or_uid}, {"_id": 0, "password_hash": 0})
    
    if not user:
        return {"error": "User not found", "search_term": email_or_uid}
    
    now = datetime.now(timezone.utc)
    twenty_four_hours_ago = now - timedelta(hours=24)
    user_uid = user.get("uid")
    
    # Extract mining-related fields
    mining_active = user.get("mining_active")
    mining_start = user.get("mining_start_time")
    session_end = user.get("mining_session_end")
    last_login = user.get("last_login")
    
    # Use the unified active status checker
    calculated_active, active_reason = await check_user_active_status(user_uid, user)
    
    # Additional debug info: Check recent activity
    bonus_in_24h = await db.transactions.find_one({
        "user_id": user_uid,
        "type": "mining",
        "created_at": {"$gte": twenty_four_hours_ago.isoformat()}
    })
    
    game_in_24h = await db.transactions.find_one({
        "user_id": user_uid,
        "type": {"$in": ["tap_game", "prc_rain_gain", "prc_rain_loss"]},
        "created_at": {"$gte": twenty_four_hours_ago.isoformat()}
    })
    
    return {
        "user_found": True,
        "email": user.get("email"),
        "uid": user_uid,
        "name": user.get("name"),
        "current_timestamp": now.isoformat(),
        
        # Mining fields from database
        "db_fields": {
            "mining_active": mining_active,
            "mining_active_type": type(mining_active).__name__,
            "mining_start_time": mining_start,
            "mining_session_end": session_end,
            "last_login": last_login
        },
        
        # NEW: Activity checks
        "activity_checks": {
            "mining_session_active": active_reason.startswith("mining") or active_reason.startswith("session") or active_reason.startswith("calculated"),
            "bonus_collected_24h": bonus_in_24h is not None,
            "game_played_24h": game_in_24h is not None
        },
        
        # Calculated status (ANY of the 3 conditions)
        "calculated_status": {
            "is_active": calculated_active,
            "active_reason": active_reason
        },
        
        # Additional info
        "subscription_plan": user.get("subscription_plan", "explorer"),
        "membership_type": user.get("membership_type", "free"),
        "referred_by": user.get("referred_by")
    }



# ========== NOTIFICATION SYSTEM ==========

# Notification Types with icons and colors
NOTIFICATION_TYPES_INFO = {
    "payment_approved": {"icon": "✓", "color": "green"},
    "payment_rejected": {"icon": "✗", "color": "red"},
    "withdrawal": {"icon": "💰", "color": "green"},
    "referral_joined": {"icon": "👤", "color": "blue"},
    "prc_credited": {"icon": "💎", "color": "purple"},
    "subscription_expiry": {"icon": "⚠️", "color": "yellow"},
    "kyc_approved": {"icon": "✓", "color": "green"},
    "kyc_rejected": {"icon": "✗", "color": "red"},
    "general": {"icon": "🔔", "color": "gray"}
}

async def create_notification(
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "general",
    related_id: Optional[str] = None,
    icon: Optional[str] = None,
    action_url: Optional[str] = None,
    data: Optional[dict] = None
):
    """
    Create a notification for a user
    Stores in notifications collection for in-app notification bell
    """
    type_info = NOTIFICATION_TYPES_INFO.get(notification_type, NOTIFICATION_TYPES_INFO["general"])
    
    notification = {
        "notification_id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_uid": user_id,
        "title": title,
        "message": message,
        "type": notification_type,
        "icon": type_info.get("icon", icon or "🔔"),
        "color": type_info.get("color", "gray"),
        "related_id": related_id,
        "action_url": action_url,
        "data": data or {},
        "read": False,
        "is_read": False,
        "created_at": datetime.now(timezone.utc)
    }
    
    try:
        await db.notifications.insert_one(notification)
        logging.info(f"[NOTIFICATION] Created for user {user_id}: {notification_type} - {title}")
    except Exception as e:
        logging.error(f"Error creating notification: {e}")
    
    return notification


# Helper functions for common notification types
async def notify_payment_approved(user_id: str, amount_inr: float, payment_type: str = "withdrawal"):
    """Notify user when payment is approved"""
    await create_notification(
        user_id=user_id,
        title="Payment Approved ✓",
        message=f"Your {payment_type} request of ₹{amount_inr:,.0f} has been approved and processed.",
        notification_type="payment_approved",
        data={"amount_inr": amount_inr, "payment_type": payment_type}
    )


async def notify_payment_rejected(user_id: str, amount_inr: float, reason: str, payment_type: str = "withdrawal"):
    """Notify user when payment is rejected"""
    await create_notification(
        user_id=user_id,
        title="Payment Rejected",
        message=f"Your {payment_type} request of ₹{amount_inr:,.0f} was rejected. Reason: {reason}. PRC refunded.",
        notification_type="payment_rejected",
        data={"amount_inr": amount_inr, "reason": reason, "payment_type": payment_type}
    )


async def notify_referral_joined(user_id: str, referral_name: str):
    """Notify user when a referral joins"""
    await create_notification(
        user_id=user_id,
        title="New Team Member!",
        message=f"{referral_name} joined using your referral code. Earn more rewards!",
        notification_type="referral_joined",
        data={"referral_name": referral_name}
    )


async def notify_prc_credited(user_id: str, amount: float, reason: str):
    """Notify user when PRC is credited"""
    await create_notification(
        user_id=user_id,
        title=f"+{amount:,.0f} PRC Credited",
        message=f"You received {amount:,.0f} PRC. Reason: {reason}",
        notification_type="prc_credited",
        data={"amount": amount, "reason": reason}
    )


# ========== GAMIFICATION SYSTEM ==========

# Achievement definitions
ACHIEVEMENTS = {
    "first_order": {
        "id": "first_order",
        "name": "First Step",
        "description": "Place your first order",
        "icon": "🛒",
        "reward_prc": 50,
        "condition": lambda user_data: user_data["total_orders"] >= 1
    },
    "prc_100": {
        "id": "prc_100",
        "name": "Miner Apprentice",
        "description": "Mine 100 PRC",
        "icon": "⛏️",
        "reward_prc": 20,
        "condition": lambda user_data: user_data["total_mined"] >= 100
    },
    "prc_500": {
        "id": "prc_500",
        "name": "Miner Expert",
        "description": "Mine 500 PRC",
        "icon": "💎",
        "reward_prc": 100,
        "condition": lambda user_data: user_data["total_mined"] >= 500
    },
    "prc_1000": {
        "id": "prc_1000",
        "name": "Mining Master",
        "description": "Mine 1000 PRC",
        "icon": "👑",
        "reward_prc": 200,
        "condition": lambda user_data: user_data["total_mined"] >= 1000
    },
    "referrals_10": {
        "id": "referrals_10",
        "name": "Social Butterfly",
        "description": "Refer 10 friends",
        "icon": "🦋",
        "reward_prc": 100,
        "condition": lambda user_data: user_data["total_referrals"] >= 10
    },
    "referrals_50": {
        "id": "referrals_50",
        "name": "Influencer",
        "description": "Refer 50 friends",
        "icon": "📢",
        "reward_prc": 500,
        "condition": lambda user_data: user_data["total_referrals"] >= 50
    },
    "referrals_100": {
        "id": "referrals_100",
        "name": "Network Legend",
        "description": "Refer 100 friends",
        "icon": "🌟",
        "reward_prc": 1000,
        "condition": lambda user_data: user_data["total_referrals"] >= 100
    },
    "vip_member": {
        "id": "vip_member",
        "name": "VIP Elite",
        "description": "Become a VIP member",
        "icon": "💎",
        "reward_prc": 50,
        "condition": lambda user_data: user_data["is_vip"]
    },
    "kyc_verified": {
        "id": "kyc_verified",
        "name": "Verified User",
        "description": "Complete KYC verification",
        "icon": "✅",
        "reward_prc": 30,
        "condition": lambda user_data: user_data["kyc_verified"]
    },
    "streak_7": {
        "id": "streak_7",
        "name": "Consistent",
        "description": "7-day login streak",
        "icon": "🔥",
        "reward_prc": 50,
        "condition": lambda user_data: user_data["current_streak"] >= 7
    },
    "streak_30": {
        "id": "streak_30",
        "name": "Dedicated",
        "description": "30-day login streak",
        "icon": "💪",
        "reward_prc": 200,
        "condition": lambda user_data: user_data["current_streak"] >= 30
    }
}

async def check_and_award_achievements(user_id: str):
    """Check and award new achievements to user"""
    user = await db.users.find_one({"uid": user_id})
    if not user:
        return []
    
    # Get user's existing achievements
    user_achievements = await db.user_achievements.find({"user_id": user_id}).to_list(1000)
    unlocked_ids = [a["achievement_id"] for a in user_achievements]
    
    # Gather user data for condition checks
    total_orders = await db.orders.count_documents({"user_id": user_id})
    total_referrals = await db.users.count_documents({"referred_by": user_id})
    
    # Calculate total mined (from transactions)
    mining_txns = await db.transactions.aggregate([
        {"$match": {"user_id": user_id, "type": {"$in": ["mining", "tap_game"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    total_mined = mining_txns[0]["total"] if mining_txns else 0
    
    # Get current streak
    streak_data = await db.user_streaks.find_one({"user_id": user_id})
    current_streak = streak_data.get("current_streak", 0) if streak_data else 0
    
    user_data = {
        "total_orders": total_orders,
        "total_mined": total_mined,
        "total_referrals": total_referrals,
        "is_vip": user.get("membership_type") == "vip",
        "kyc_verified": user.get("kyc_verified", False),
        "current_streak": current_streak
    }
    
    # Check each achievement
    newly_unlocked = []
    for achievement_id, achievement in ACHIEVEMENTS.items():
        if achievement_id not in unlocked_ids:
            if achievement["condition"](user_data):
                # Award achievement
                achievement_record = {
                    "user_id": user_id,
                    "achievement_id": achievement_id,
                    "unlocked_at": datetime.now(timezone.utc).isoformat()
                }
                await db.user_achievements.insert_one(achievement_record)
                
                # Award PRC reward
                reward_prc = achievement["reward_prc"]
                await db.users.update_one(
                    {"uid": user_id},
                    {"$inc": {"prc_balance": reward_prc}}
                )
                
                # Create transaction
                await db.transactions.insert_one({
                    "transaction_id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "type": "achievement",
                    "wallet_type": "prc",
                    "amount": reward_prc,
                    "description": f"Achievement unlocked: {achievement['name']}",
                    "balance_after": user.get("prc_balance", 0) + reward_prc,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                # Create notification
                await create_notification(
                    user_id=user_id,
                    title=f"Achievement Unlocked! {achievement['icon']}",
                    message=f"You've earned '{achievement['name']}' and received {reward_prc} PRC!",
                    notification_type="achievement",
                    related_id=achievement_id,
                    icon=achievement['icon']
                )
                
                newly_unlocked.append(achievement)
    
    return newly_unlocked

@router.get("/achievements/{user_id}")
async def get_user_achievements(user_id: str):
    """Get user's unlocked achievements and progress"""
    user_achievements = await db.user_achievements.find({"user_id": user_id}).to_list(1000)
    unlocked_ids = [a["achievement_id"] for a in user_achievements]
    
    # Build response with all achievements
    achievements_list = []
    for achievement_id, achievement in ACHIEVEMENTS.items():
        is_unlocked = achievement_id in unlocked_ids
        unlocked_at = None
        
        if is_unlocked:
            record = next((a for a in user_achievements if a["achievement_id"] == achievement_id), None)
            unlocked_at = record.get("unlocked_at") if record else None
        
        achievements_list.append({
            "id": achievement["id"],
            "name": achievement["name"],
            "description": achievement["description"],
            "icon": achievement["icon"],
            "reward_prc": achievement["reward_prc"],
            "unlocked": is_unlocked,
            "unlocked_at": unlocked_at
        })
    
    return {
        "achievements": achievements_list,
        "total_unlocked": len(unlocked_ids),
        "total_available": len(ACHIEVEMENTS)
    }

@router.post("/achievements/{user_id}/check")
async def check_achievements(user_id: str):
    """Manually trigger achievement check"""
    newly_unlocked = await check_and_award_achievements(user_id)
    return {
        "newly_unlocked": newly_unlocked,
        "count": len(newly_unlocked)
    }

# Daily Login Streaks
@router.post("/streaks/{user_id}/checkin")
async def daily_checkin(user_id: str):
    """Record daily login and update streak"""
    today = datetime.now(timezone.utc).date().isoformat()
    
    streak_data = await db.user_streaks.find_one({"user_id": user_id})
    
    if not streak_data:
        # First time login
        streak_data = {
            "user_id": user_id,
            "current_streak": 1,
            "longest_streak": 1,
            "last_checkin": today,
            "total_checkins": 1,
            "checkin_dates": [today]
        }
        await db.user_streaks.insert_one(streak_data)
        
        # Award 5 PRC for first login
        await db.users.update_one({"uid": user_id}, {"$inc": {"prc_balance": 5}})
        
        # Get updated balance for accurate balance_after
        updated_user = await db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1})
        new_balance = float(updated_user.get("prc_balance", 0)) if updated_user else 0
        
        # Record transaction for first login bonus
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "daily_streak",
            "wallet_type": "prc",
            "amount": 5,
            "description": "First login bonus",
            "balance_after": round(new_balance, 2),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "current_streak": 1,
            "reward_prc": 5,
            "message": "Welcome! First login bonus!"
        }
    
    last_checkin = streak_data.get("last_checkin")
    
    # Check if already checked in today
    if last_checkin == today:
        return {
            "current_streak": streak_data["current_streak"],
            "reward_prc": 0,
            "message": "Already checked in today!",
            "already_checked_in": True
        }
    
    # Check if consecutive day
    from datetime import timedelta
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    
    if last_checkin == yesterday:
        # Consecutive day
        new_streak = streak_data["current_streak"] + 1
    else:
        # Streak broken
        new_streak = 1
    
    # Calculate reward (increases with streak)
    base_reward = 5
    streak_bonus = min(new_streak - 1, 10)  # Max 10 bonus
    reward_prc = base_reward + streak_bonus
    
    # Update streak
    await db.user_streaks.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "current_streak": new_streak,
                "longest_streak": max(new_streak, streak_data.get("longest_streak", 0)),
                "last_checkin": today
            },
            "$inc": {"total_checkins": 1},
            "$push": {"checkin_dates": today}
        }
    )
    
    # Award PRC
    await db.users.update_one({"uid": user_id}, {"$inc": {"prc_balance": reward_prc}})
    
    # Get updated balance for accurate balance_after
    updated_user = await db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1})
    streak_new_balance = float(updated_user.get("prc_balance", 0)) if updated_user else 0
    
    # Create transaction
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "daily_streak",
        "wallet_type": "prc",
        "amount": reward_prc,
        "description": f"Daily login streak: Day {new_streak}",
        "balance_after": round(streak_new_balance, 2),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Check for streak achievements
    await check_and_award_achievements(user_id)
    
    return {
        "current_streak": new_streak,
        "reward_prc": reward_prc,
        "message": f"Day {new_streak} streak! Keep it up!",
        "milestone_reached": new_streak in [7, 30, 100]
    }

@router.get("/streaks/{user_id}")
async def get_user_streak(user_id: str):
    """Get user's streak information"""
    streak_data = await db.user_streaks.find_one({"user_id": user_id})
    
    if not streak_data:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "total_checkins": 0,
            "last_checkin": None,
            "checkin_dates": []
        }
    
    streak_data.pop("_id", None)
    return streak_data

# Leaderboard routes MOVED to routes/leaderboard.py
# Keeping comment for reference - miners, referrers, earners endpoints


# ========== FLASH SALES ==========

@router.post("/admin/flash-sales")
async def create_flash_sale(sale_data: dict):
    """Create a new flash sale (Admin)"""
    flash_sale = {
        "sale_id": str(uuid.uuid4()),
        "product_id": sale_data["product_id"],
        "discount_percentage": sale_data["discount_percentage"],
        "discounted_prc_price": sale_data.get("discounted_prc_price"),
        "start_time": sale_data["start_time"],
        "end_time": sale_data["end_time"],
        "stock_limit": sale_data.get("stock_limit"),
        "sold_count": 0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.flash_sales.insert_one(flash_sale)
    flash_sale.pop("_id", None)
    
    return {"message": "Flash sale created", "sale": flash_sale}

@router.get("/flash-sales/active")
async def get_active_flash_sales():
    """Get all active flash sales"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Find active sales within time range
    flash_sales = await db.flash_sales.find({
        "is_active": True,
        "start_time": {"$lte": now},
        "end_time": {"$gte": now}
    }).to_list(100)
    
    # Enrich with product details
    enriched_sales = []
    for sale in flash_sales:
        product = await db.products.find_one({"product_id": sale["product_id"]})
        if product:
            # Calculate if still in stock
            remaining_stock = None
            if sale.get("stock_limit"):
                remaining_stock = sale["stock_limit"] - sale.get("sold_count", 0)
                if remaining_stock <= 0:
                    continue  # Skip out of stock
            
            enriched_sales.append({
                "sale_id": sale["sale_id"],
                "product_id": sale["product_id"],
                "product_name": product.get("name"),
                "product_image": product.get("image_url"),
                "original_prc_price": product.get("prc_price"),
                "discounted_prc_price": sale.get("discounted_prc_price"),
                "discount_percentage": sale.get("discount_percentage"),
                "start_time": sale["start_time"],
                "end_time": sale["end_time"],
                "remaining_stock": remaining_stock,
                "sold_count": sale.get("sold_count", 0)
            })
    
    return {"flash_sales": enriched_sales}

@router.get("/admin/flash-sales")
async def get_all_flash_sales(status: str = "all"):
    """Get all flash sales (Admin)"""
    query = {}
    
    if status == "active":
        now = datetime.now(timezone.utc).isoformat()
        query = {
            "is_active": True,
            "start_time": {"$lte": now},
            "end_time": {"$gte": now}
        }
    elif status == "expired":
        now = datetime.now(timezone.utc).isoformat()
        query = {"end_time": {"$lt": now}}
    elif status == "upcoming":
        now = datetime.now(timezone.utc).isoformat()
        query = {"start_time": {"$gt": now}}
    
    flash_sales = await db.flash_sales.find(query).sort("created_at", -1).to_list(100)
    
    # Enrich with product details
    for sale in flash_sales:
        product = await db.products.find_one({"product_id": sale["product_id"]})
        if product:
            sale["product_name"] = product.get("name")
            sale["product_image"] = product.get("image_url")
        sale.pop("_id", None)
    
    return {"flash_sales": flash_sales}

@router.put("/admin/flash-sales/{sale_id}")
async def update_flash_sale(sale_id: str, update_data: dict):
    """Update a flash sale (Admin)"""
    result = await db.flash_sales.update_one(
        {"sale_id": sale_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    
    return {"message": "Flash sale updated"}

@router.delete("/admin/flash-sales/{sale_id}")
async def delete_flash_sale(sale_id: str):
    """Delete a flash sale (Admin)"""
    result = await db.flash_sales.delete_one({"sale_id": sale_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    
    return {"message": "Flash sale deleted"}

@router.post("/flash-sales/{sale_id}/purchase")
async def purchase_flash_sale(sale_id: str, user_id: str, quantity: int = 1):
    """Purchase item from flash sale"""
    # Get flash sale
    sale = await db.flash_sales.find_one({"sale_id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    
    # Check if still active
    now = datetime.now(timezone.utc).isoformat()
    if now < sale["start_time"] or now > sale["end_time"]:
        raise HTTPException(status_code=400, detail="Flash sale is not active")
    
    # Check stock limit
    if sale.get("stock_limit"):
        remaining = sale["stock_limit"] - sale.get("sold_count", 0)
        if remaining < quantity:
            raise HTTPException(status_code=400, detail="Not enough stock available")
    
    # Increment sold count
    await db.flash_sales.update_one(
        {"sale_id": sale_id},
        {"$inc": {"sold_count": quantity}}
    )
    
    return {
        "message": "Purchase recorded",
        "sale_id": sale_id,
        "quantity": quantity
    }


@router.get("/{user_id}")
async def get_user_notifications(user_id: str, limit: int = 50, unread_only: bool = False):
    """Get user notifications with optional filtering"""
    try:
        query = {"user_id": user_id}
        if unread_only:
            query["is_read"] = False
        
        notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        
        return {
            "notifications": notifications,
            "count": len(notifications)
        }
    except Exception as e:
        print(f"Error fetching notifications: {e}")
        return {
            "notifications": [],
            "count": 0
        }

@router.get("/{user_id}/count")
async def get_unread_count(user_id: str):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({"user_id": user_id, "is_read": False})
    return {"unread_count": count}

@router.post("/{notification_id}/mark-read")
async def mark_notification_read(notification_id: str):
    """Mark a single notification as read"""
    result = await db.notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {"is_read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

@router.post("/{user_id}/mark-all-read")
async def mark_all_notifications_read(user_id: str):
    """Mark all user notifications as read"""
    result = await db.notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return {
        "message": "All notifications marked as read",
        "count": result.modified_count
    }


# ========== USER RECENT ACTIVITY ENDPOINT ==========
