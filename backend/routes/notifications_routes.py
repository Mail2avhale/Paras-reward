from fastapi import APIRouter, HTTPException, Query, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging
import re
import uuid

router = APIRouter(prefix="/notifications", tags=["Notifications"])

db = None
_get_user_all_time_redeemed = None

def set_db(database):
    global db
    db = database

def set_helpers(helpers: dict):
    global _get_user_all_time_redeemed
    _get_user_all_time_redeemed = helpers.get('get_user_all_time_redeemed')

@router.get("/{uid}")
async def get_notifications(uid: str, page: int = 1, limit: int = 20, unread_only: bool = False):
    """Get user's notifications"""
    skip = (page - 1) * limit
    
    query = {"user_uid": uid}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.notifications.count_documents(query)
    unread_count = await db.notifications.count_documents({"user_uid": uid, "read": False})
    
    return {
        "notifications": notifications,
        "total": total,
        "unread_count": unread_count,
        "page": page,
        "limit": limit
    }


@router.get("/{uid}/unread-count")
async def get_notification_unread_count(uid: str):
    """Get unread notification count"""
    count = await db.notifications.count_documents({"user_uid": uid, "read": False})
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
    """Mark all notifications as read for a user"""
    result = await db.notifications.update_many(
        {"user_uid": uid, "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
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
    """Clear all notifications for a user"""
    result = await db.notifications.delete_many({"user_uid": uid})
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


# ========== DIRECT REFERRAL MESSAGING ==========

@router.get("/referrals/{user_id}/direct-list")
async def get_direct_referrals_list(user_id: str, page: int = 1, limit: int = 20):
    """
    Get list of direct referrals with messaging capability
    Returns referrals that the user can message
    """
    skip = (page - 1) * limit
    
    # Get user's referral_code to handle mixed referred_by values
    current_user_for_code = await db.users.find_one(
        {"uid": user_id},
        {"_id": 0, "referral_code": 1}
    )
    user_referral_code = current_user_for_code.get("referral_code", "") if current_user_for_code else ""
    
    ref_or_conds = [{"referred_by": user_id}]
    if user_referral_code:
        ref_or_conds.append({"referred_by": user_referral_code})
    ref_filter = {"$or": ref_or_conds}
    
    # Get direct referrals (users who used this user's referral code)
    direct_referrals = await db.users.find(
        ref_filter,
        {
            "_id": 0, 
            "uid": 1, 
            "name": 1, 
            "email": 1,
            "mobile": 1,
            "avatar": 1, 
            "profile_picture": 1,
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
        
        # Calculate actual PRC used (redeemed) from all collections
        ref_uid = ref["uid"]
        prc_used = 0
        if _get_user_all_time_redeemed:
            try:
                prc_used = await _get_user_all_time_redeemed(ref_uid)
            except Exception as e:
                logging.warning(f"Error calculating prc_used for {ref_uid}: {e}")
        
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
            "avatar": ref.get("avatar") or ref.get("profile_picture"),
            "city": ref.get("city", ""),
            "state": ref.get("state", ""),
            "subscription_plan": ref.get("subscription_plan") or ("explorer" if ref.get("membership_type") == "free" else "startup"),
            "is_active": is_active,
            "joined_at": ref.get("created_at", ""),
            "last_seen": ref.get("last_login", ""),
            "can_message": ref.get("allow_messages", True),
            "prc_earned": round(prc_earned, 2),
            "prc_used": round(prc_used, 2)
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

@router.get("/referrals/{user_id}/tree")
async def get_referral_tree(user_id: str):
    """Get referral tree structure for visualization"""
    
    async def build_tree(uid, level=1, max_level=5):
        if level > max_level:
            return None
        
        # Get user info
        user = await db.users.find_one({"uid": uid})
        if not user:
            return None
        
        # Get direct referrals
        referrals = await db.users.find({"referred_by": uid}).to_list(length=1000)
        
        node = {
            "id": uid,
            "name": user.get("name", "Unknown"),
            "email": user.get("email", ""),
            "level": level,
            "total_referrals": len(referrals),
            "prc_balance": user.get("prc_balance", 0),
            "membership_type": user.get("membership_type", "free"),
            "children": []
        }
        
        # Recursively build children (limit depth to avoid huge trees)
        for referral in referrals[:10]:  # Limit to 10 per level for performance
            child_tree = await build_tree(referral["uid"], level + 1, max_level)
            if child_tree:
                node["children"].append(child_tree)
        
        return node
    
    tree = await build_tree(user_id)
    return {"tree": tree}

@router.get("/referrals/network-tree/{user_id}")
async def get_network_tree_advanced(user_id: str):
    """
    Get advanced network tree structure for NetworkTreeAdvanced page.
    Returns complete tree with subscription info, activity status, and referral counts.
    """
    
    async def build_advanced_tree(uid, level=1, max_level=5):
        if level > max_level:
            return None
        
        # Get user info
        user = await db.users.find_one({"uid": uid})
        if not user:
            return None
        
        # Get direct referrals
        referrals = await db.users.find({"referred_by": uid}).to_list(length=1000)
        
        # Check if user is active (has paid subscription)
        subscription_plan = user.get("subscription_plan", "explorer")
        is_active = subscription_plan in ["startup", "growth", "elite"]
        
        # Calculate referral count for this user
        referral_count = len(referrals)
        
        node = {
            "id": uid,
            "name": user.get("name", "Unknown"),
            "email": user.get("email", ""),
            "mobile": user.get("mobile", ""),
            "level": level,
            "subscription_plan": subscription_plan,
            "is_active": is_active,
            "referral_count": referral_count,
            "prc_balance": user.get("prc_balance", 0),
            "joined_at": user.get("created_at", ""),
            "last_active": user.get("last_login", user.get("last_active", "")),
            "earnings_generated": user.get("total_referral_earnings", 0),
            "children": []
        }
        
        # Recursively build children (no limit for advanced view)
        for referral in referrals:
            child_tree = await build_advanced_tree(referral["uid"], level + 1, max_level)
            if child_tree:
                node["children"].append(child_tree)
        
        return node
    
    tree = await build_advanced_tree(user_id)
    return tree or {"id": user_id, "name": "User", "children": []}


@router.get("/referrals/{user_id}/stats")
async def get_referral_stats(user_id: str):
    """
    Get comprehensive referral statistics
    Active = ANY of:
      1. Active mining session
      2. Bonus collected in last 24h
      3. Tap Game or Rain Drop played in last 24h
    """
    
    # Get direct referrals
    direct_referrals = await db.users.find({"referred_by": user_id}, {"_id": 0}).to_list(length=1000)
    
    # Count active referrals using unified logic
    active_count = 0
    total_orders_from_referrals = 0
    
    for referral in direct_referrals:
        user_uid = referral.get("uid")
        is_active, _ = await check_user_active_status(user_uid, referral)
        
        if is_active:
            active_count += 1
        
        # Also count orders for additional context
        orders = await db.orders.count_documents({"user_id": user_uid})
        total_orders_from_referrals += orders
    
    # Get referral earnings from transactions - check all referral-related types
    referral_types = ["referral", "referral_bonus", "referral_reward"]
    referral_earnings = await db.transactions.aggregate([
        {"$match": {"user_id": user_id, "type": {"$in": referral_types}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    total_earned = referral_earnings[0]["total"] if referral_earnings else 0
    
    # Also check users collection for total_referral_earnings field if transactions don't have data
    if total_earned == 0:
        user = await db.users.find_one({"uid": user_id}, {"_id": 0, "total_referral_earnings": 1})
        if user:
            total_earned = user.get("total_referral_earnings", 0)
    
    # Calculate conversion rate (active rate)
    conversion_rate = (active_count / len(direct_referrals) * 100) if direct_referrals else 0
    
    # Get recent referrals (last 10)
    recent_referrals = sorted(direct_referrals, key=lambda x: x.get("created_at", ""), reverse=True)[:10]
    
    return {
        "total_referrals": len(direct_referrals),
        "active_referrals": active_count,
        "conversion_rate": round(conversion_rate, 2),
        "total_earned": round(total_earned, 2),
        "total_orders_from_referrals": total_orders_from_referrals,
        "recent_referrals": [
            {
                "uid": r["uid"],
                "name": r.get("name", "Unknown"),
                "email": r.get("email", ""),
                "joined_at": r.get("created_at", ""),
                "membership_type": r.get("membership_type", "free"),
                "subscription_plan": r.get("subscription_plan", "explorer"),
                "mining_active": r.get("mining_active"),
                "session_end": r.get("mining_session_end")
            }
            for r in recent_referrals
        ]
    }

@router.get("/referrals/{user_id}/earnings")
async def get_referral_earnings(user_id: str):
    """Get detailed referral earnings breakdown"""
    
    # Get all referral transactions - include all referral-related types
    referral_types = ["referral", "referral_bonus", "referral_reward"]
    transactions = await db.transactions.find({
        "user_id": user_id,
        "type": {"$in": referral_types}
    }).sort("created_at", -1).to_list(length=100)
    
    # Calculate by month
    from collections import defaultdict
    monthly_earnings = defaultdict(float)
    
    for txn in transactions:
        if txn.get("created_at"):
            try:
                month = txn["created_at"][:7]  # YYYY-MM
                monthly_earnings[month] += txn.get("amount", 0)
            except:
                pass
    
    # Total earnings
    total = sum(txn.get("amount", 0) for txn in transactions)
    
    # Pending earnings (from users who haven't made orders yet)
    direct_referrals = await db.users.find({"referred_by": user_id}).to_list(length=1000)
    potential_earnings = len([r for r in direct_referrals if await db.orders.count_documents({"user_id": r["uid"]}) == 0]) * 10  # Assume 10 PRC potential per referral
    
    return {
        "total_earned": round(total, 2),
        "transaction_count": len(transactions),
        "monthly_breakdown": dict(sorted(monthly_earnings.items())),
        "potential_earnings": potential_earnings,
        "recent_transactions": [
            {
                "amount": t.get("amount", 0),
                "description": t.get("description", ""),
                "created_at": t.get("created_at", "")
            }
            for t in transactions[:20]
        ]
    }


@router.get("/referral-earnings/{user_id}")
async def get_referral_earnings_history(user_id: str, period: str = "all"):
    """Get detailed referral earnings history with breakdown by level"""
    
    # Calculate time filter
    now = datetime.now(timezone.utc)
    filter_date = None
    
    if period == "today":
        filter_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        filter_date = now - timedelta(days=7)
    elif period == "month":
        filter_date = now - timedelta(days=30)
    
    # Build query - include both referral_bonus and session_bonus types
    query = {
        "user_id": user_id, 
        "type": {"$in": ["referral_bonus", "session_bonus"]}
    }
    if filter_date:
        query["$or"] = [
            {"created_at": {"$gte": filter_date.isoformat()}},
            {"timestamp": {"$gte": filter_date.isoformat()}}
        ]
    
    # Get transactions
    transactions = await db.transactions.find(query).sort("created_at", -1).to_list(length=500)
    
    # Transform to earnings format
    earnings = []
    for txn in transactions:
        timestamp = txn.get("timestamp") or txn.get("created_at") or now.isoformat()
        
        # Handle old transactions with referral_breakdown (combined transactions)
        if txn.get("referral_breakdown") and not txn.get("level"):
            # Split old combined transaction into level-wise entries
            breakdown = txn.get("referral_breakdown", {})
            for level_key, level_data in breakdown.items():
                level_num = int(level_key.replace("level_", ""))
                level_bonus = level_data.get("bonus", 0)
                if level_bonus > 0:
                    earnings.append({
                        "id": f"{txn.get('transaction_id', '')}_{level_num}",
                        "date": timestamp,
                        "timestamp": timestamp,
                        "created_at": timestamp,
                        "level": level_num,
                        "description": f"Level {level_num} Bonus",
                        "prc_earned": level_bonus,
                        "active_referrals": level_data.get("active_count", 0),
                        "type": txn.get("type", "referral_bonus")
                    })
        else:
            # New format or simple transaction
            level = txn.get("level", 1)
            earnings.append({
                "id": txn.get("transaction_id", str(uuid.uuid4())),
                "date": timestamp,
                "timestamp": timestamp,
                "created_at": timestamp,
                "level": level,
                "description": txn.get("description", f"Level {level} Bonus"),
                "prc_earned": txn.get("prc_earned") or txn.get("amount", 0),
                "active_referrals": txn.get("active_referrals") or txn.get("active_count", 1),
                "type": txn.get("type", "referral_bonus")
            })
    
    # Calculate summaries
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - timedelta(days=7)).isoformat()
    month_start = (now - timedelta(days=30)).isoformat()
    
    total_earned = sum(e["prc_earned"] for e in earnings) if earnings else 0
    today_earned = sum(e["prc_earned"] for e in earnings if (e.get("timestamp") or e.get("date", "")) >= today_start)
    week_earned = sum(e["prc_earned"] for e in earnings if (e.get("timestamp") or e.get("date", "")) >= week_start)
    month_earned = sum(e["prc_earned"] for e in earnings if (e.get("timestamp") or e.get("date", "")) >= month_start)
    
    # If no transaction history, generate from mining data
    if not earnings:
        # get_mining_status is deprecated - return empty fallback
        try:
            mining_status = {}
            breakdown = mining_status.get("referral_breakdown", {})
            
            # Generate sample data based on current rates
            for level in range(1, 6):
                level_key = f"level_{level}"
                level_data = breakdown.get(level_key, {"bonus": 0, "count": 0})
                
                if level_data.get("bonus", 0) > 0:
                    # Assume 8 hours mining per day for last 30 days
                    for day in range(30):
                        date = (now - timedelta(days=day)).isoformat()
                        daily_earning = level_data["bonus"] * 8 * (0.7 + 0.6 * (hash(date + str(level)) % 100) / 100)
                        
                        if daily_earning > 0.01:
                            earnings.append({
                                "id": f"{date}-L{level}",
                                "date": date,
                                "level": level,
                                "referral_name": f"Level {level} Network",
                                "prc_earned": round(daily_earning, 2),
                                "active_referrals": level_data.get("count", 0),
                                "type": "session_bonus"
                            })
                            total_earned += daily_earning
            
            earnings.sort(key=lambda x: x["date"], reverse=True)
            
            # Recalculate summaries
            today_earned = sum(e["prc_earned"] for e in earnings if e["date"] >= today_start)
            week_earned = sum(e["prc_earned"] for e in earnings if e["date"] >= week_start)
            month_earned = sum(e["prc_earned"] for e in earnings if e["date"] >= month_start)
        except Exception as e:
            logging.error(f"Error generating estimated earnings: {e}")
    
    # Calculate level breakdown
    level_breakdown = {}
    for level in range(1, 6):
        level_earnings = [e for e in earnings if e.get("level") == level]
        level_breakdown[f"level_{level}"] = {
            "count": len(level_earnings),
            "total": round(sum(e.get("prc_earned", 0) for e in level_earnings), 2)
        }
    
    # Get top performing referrals
    top_performers = []
    try:
        # Get direct referrals of this user with their mining stats
        direct_referrals = await db.users.find(
            {"referred_by": user_id},
            {"_id": 0, "uid": 1, "name": 1, "email": 1, "subscription_plan": 1, "total_mined": 1, "prc_balance": 1}
        ).to_list(length=100)
        
        # Level 1 total earnings (direct referrals)
        level_1_total = level_breakdown.get("level_1", {}).get("total", 0)
        referral_count = len(direct_referrals) if direct_referrals else 1
        avg_earning_per_referral = level_1_total / max(referral_count, 1)
        
        for ref in direct_referrals:
            # Estimate earnings from this referral based on their activity
            # If we have detailed tracking, use it; otherwise estimate
            ref_total_mined = ref.get("total_mined", 0)
            ref_plan = ref.get("subscription_plan", "explorer")
            
            # Active paid referrals generate more bonus
            is_paid = ref_plan in ["startup", "growth", "elite"]
            estimated_earnings = avg_earning_per_referral * (1.5 if is_paid else 0.5) if referral_count > 0 else 0
            
            top_performers.append({
                "uid": ref.get("uid"),
                "name": ref.get("name", "User")[:18] if len(ref.get("name", "")) <= 18 else ref.get("name", "User")[:15] + "...",
                "level": 1,
                "plan": ref_plan,
                "earnings": round(estimated_earnings, 2)
            })
        
        # Sort by estimated earnings
        top_performers.sort(key=lambda x: x.get("earnings", 0), reverse=True)
        top_performers = top_performers[:5]
    except Exception as e:
        logging.error(f"Error getting top performers: {e}")
    
    return {
        "earnings": earnings,
        "summary": {
            "total_earned": round(total_earned, 2),
            "this_month": round(month_earned, 2),
            "this_week": round(week_earned, 2),
            "today": round(today_earned, 2)
        },
        "level_breakdown": level_breakdown,
        "top_performers": top_performers
    }


@router.get("/referrals/{user_id}/levels")
async def get_referral_levels(user_id: str, force_refresh: bool = False):
    """
    Get referral count by level (5 levels deep) with user details.
    Uses SUPER AGGRESSIVE search - checks ALL possible referred_by formats including regex.
    user_id can be UID or email.
    
    Add ?force_refresh=true to bypass cache
    """
    # Check cache first for faster response
    # BUT: Don't use cache if it has 0 total (likely stale/error data)
    cache_key = f"referral_levels_{user_id}"
    
    if not force_refresh:
        cached = await cache.get(cache_key)
        if cached and cached.get("total", 0) > 0:
            # Only use cache if it has actual data
            return cached
    
    now = datetime.now(timezone.utc)
    
    # Get user info - support both UID and email
    user = await db.users.find_one({"uid": user_id}, {"_id": 0})
    if not user:
        user = await db.users.find_one({"email": user_id}, {"_id": 0})
    if not user:
        user = await db.users.find_one({"email": user_id.lower()}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
    
    # Build ALL possible search values for this user
    search_values = []
    
    # Add UID
    uid = user.get("uid")
    if uid:
        search_values.append(uid)
        # Also add short version (first 8 chars)
        search_values.append(uid[:8])
    
    # Add referral code with all variations
    ref_code = user.get("referral_code")
    if ref_code:
        search_values.append(ref_code)
        search_values.append(ref_code.lower())
        search_values.append(ref_code.upper())
        # Remove prefix if exists (like "USER" or "ADMIN")
        for prefix in ["USER", "ADMIN", "REF"]:
            if ref_code.upper().startswith(prefix):
                search_values.append(ref_code[len(prefix):])
                search_values.append(ref_code[len(prefix):].lower())
    
    # Add email
    email = user.get("email")
    if email:
        search_values.append(email)
        search_values.append(email.lower())
        search_values.append(email.upper())
        # Add email username part
        if "@" in email:
            search_values.append(email.split("@")[0])
    
    # Add name
    name = user.get("name")
    if name:
        search_values.append(name)
        search_values.append(name.lower())
        search_values.append(name.upper())
    
    # Add phone if exists
    phone = user.get("phone")
    if phone:
        search_values.append(phone)
        # Remove +91 or other prefixes
        search_values.append(phone.replace("+91", "").replace(" ", ""))
    
    # Remove duplicates and None/empty values
    search_values = list(set([v for v in search_values if v and len(str(v)) > 2]))
    
    # SUPER AGGRESSIVE SEARCH: Find ALL users who might be referred by this user
    all_direct_referrals = []
    try:
        # First try exact match - FIX: Use to_list() to prevent cursor leak
        all_direct_referrals = await db.users.find(
            {"referred_by": {"$in": search_values}},
            {"_id": 0}
        ).to_list(length=500)
        
        # If no results, try case-insensitive regex search
        if not all_direct_referrals and ref_code:
            regex_pattern = f"^{ref_code}$"
            regex_results = await db.users.find(
                {"referred_by": {"$regex": regex_pattern, "$options": "i"}},
                {"_id": 0}
            ).to_list(length=100)
            
            for referred_user in regex_results:
                if referred_user not in all_direct_referrals:
                    all_direct_referrals.append(referred_user)
                    
    except Exception as e:
        print(f"Error searching referrals: {e}")
    
    # Build levels dictionary
    referrals_by_level = {"level_1": all_direct_referrals}
    
    # Get Level 2-5 referrals
    current_level_users = all_direct_referrals
    for level in range(2, 6):
        if not current_level_users:
            break
            
        # Build search values for this level
        level_search_values = []
        for u in current_level_users:
            if u.get("uid"):
                level_search_values.append(u["uid"])
            if u.get("referral_code"):
                level_search_values.append(u["referral_code"])
                level_search_values.append(u["referral_code"].lower())
                level_search_values.append(u["referral_code"].upper())
            if u.get("email"):
                level_search_values.append(u["email"])
            if u.get("name"):
                level_search_values.append(u["name"])
        
        level_search_values = list(set([v for v in level_search_values if v]))
        
        if not level_search_values:
            break
        
        # Find next level users - FIX: Use to_list() instead of async for
        next_level_users = []
        try:
            next_level_users = await db.users.find(
                {"referred_by": {"$in": level_search_values}},
                {"_id": 0}
            ).to_list(length=5000)
        except Exception as e:
            print(f"Error searching level {level}: {e}")
        
        if next_level_users:
            referrals_by_level[f"level_{level}"] = next_level_users
        
        current_level_users = next_level_users
    
    # Build response with user details and activity status
    # OPTIMIZED: Use only user data fields, NO additional DB queries
    levels = []
    for level_num in range(1, 6):
        level_key = f"level_{level_num}"
        users = referrals_by_level.get(level_key, [])
        
        user_details = []
        active_count = 0
        
        for u in users:
            user_uid = u.get("uid")
            # UPDATED: Active = Elite subscription + Mining session active
            is_active = False
            active_reason = "inactive"
            
            subscription_plan = (u.get("subscription_plan") or "").lower()
            mining_active = u.get("mining_active")
            session_end = u.get("mining_session_end")
            
            # Check: Elite subscription + Mining session active
            is_elite = subscription_plan == "elite"
            is_mining = False
            
            if mining_active is True or mining_active == "true":
                if session_end:
                    try:
                        if isinstance(session_end, str):
                            session_end_dt = datetime.fromisoformat(session_end.replace('Z', '+00:00'))
                        elif isinstance(session_end, datetime):
                            session_end_dt = session_end
                        else:
                            session_end_dt = None
                        
                        if session_end_dt:
                            if session_end_dt.tzinfo is None:
                                session_end_dt = session_end_dt.replace(tzinfo=timezone.utc)
                            if session_end_dt > now:
                                is_mining = True
                    except:
                        is_mining = True
                else:
                    is_mining = True
            
            # Active only if Elite AND mining_active flag is True
            # (Session end time ignored - just check the flag)
            if is_elite and (mining_active is True or mining_active == "true"):
                is_active = True
                active_reason = "elite_and_mining_flag_true"
            elif is_elite:
                active_reason = "elite_but_mining_flag_false"
            elif mining_active:
                active_reason = "mining_but_not_elite"
            
            if is_active:
                active_count += 1
            
            user_details.append({
                "uid": user_uid,
                "name": u.get("name") or u.get("email", "").split("@")[0] or "User",
                "email": u.get("email"),
                "is_active": is_active,
                "mining_active": u.get("mining_active", False),
                "membership_type": u.get("membership_type", "free"),
                "subscription_plan": u.get("subscription_plan", "explorer"),
                "joined_at": u.get("created_at"),
                "session_end": u.get("mining_session_end"),
                "active_reason": active_reason,
                "referred_by_value": u.get("referred_by")  # DEBUG: Show what value matched
            })
        
        levels.append({
            "level": level_num,
            "count": len(users),
            "active_count": active_count,
            "users": user_details,
            "bonus_percent": {1: 10, 2: 5, 3: 3, 4: 2, 5: 1}.get(level_num, 0)
        })
    
    total_count = sum(l["count"] for l in levels)
    total_active = sum(l["active_count"] for l in levels)
    
    response = {
        "levels": levels,
        "total": total_count,
        "total_active": total_active,
        "debug_timestamp": now.isoformat(),
        "debug_search_info": {
            "user_uid": user_id,
            "user_referral_code": user.get("referral_code"),
            "search_values_used": search_values[:5],  # Show first 5
            "stored_referral_count": user.get("referral_count", 0)
        }
    }
    
    # Cache for 120 seconds - BUT only if we have actual data
    # This prevents caching empty results due to DB timeouts
    if total_count > 0:
        await cache.set(cache_key, response, ttl=120)
    else:
        # Short cache (10 sec) for empty results to allow quick retry
        await cache.set(cache_key, response, ttl=10)
    
    return response


@router.get("/referrals/{user_id}/debug-referred-by")
async def debug_referred_by(user_id: str):
    """
    DEBUG ENDPOINT: Check how users are stored in referred_by field.
    This helps diagnose why referrals might not be counting correctly.
    user_id can be UID or email address.
    """
    # Support both UID and email
    user = await db.users.find_one({"uid": user_id}, {"_id": 0, "uid": 1, "referral_code": 1, "referral_count": 1, "name": 1, "email": 1})
    if not user:
        user = await db.users.find_one({"email": user_id}, {"_id": 0, "uid": 1, "referral_code": 1, "referral_count": 1, "name": 1, "email": 1})
    if not user:
        user = await db.users.find_one({"email": user_id.lower()}, {"_id": 0, "uid": 1, "referral_code": 1, "referral_count": 1, "name": 1, "email": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Use your UID or email. Example: /api/referrals/your@email.com/debug-referred-by")
    
    uid = user.get("uid")
    ref_code = user.get("referral_code")
    email = user.get("email")
    name = user.get("name")
    
    # Build all possible search values
    search_values = [uid, ref_code]
    if ref_code:
        search_values.extend([ref_code.lower(), ref_code.upper()])
    if email:
        search_values.extend([email, email.lower()])
    if name:
        search_values.append(name)
    search_values = [v for v in search_values if v]
    
    # Count by UID only
    count_by_uid = await db.users.count_documents({"referred_by": uid})
    
    # Count by referral code only
    count_by_code = await db.users.count_documents({"referred_by": ref_code}) if ref_code else 0
    
    # Count by ALL possible formats (aggressive search)
    count_by_all = await db.users.count_documents({"referred_by": {"$in": search_values}})
    
    # Get sample referred_by values that match - FIX: Use to_list()
    sample_referrals_raw = await db.users.find(
        {"referred_by": {"$in": search_values}},
        {"_id": 0, "name": 1, "email": 1, "referred_by": 1, "created_at": 1}
    ).limit(15).to_list(length=15)
    
    sample_referrals = []
    for u in sample_referrals_raw:
        sample_referrals.append({
            "name": u.get("name"),
            "email": u.get("email", "")[:30] if u.get("email") else None,
            "referred_by": u.get("referred_by"),
            "referred_by_type": "UID" if u.get("referred_by") == uid else (
                "CODE" if u.get("referred_by") == ref_code else (
                    "EMAIL" if u.get("referred_by") in [email, email.lower() if email else ""] else (
                        "NAME" if u.get("referred_by") == name else "OTHER"
                    )
                )
            ),
            "created_at": str(u.get("created_at"))[:19] if u.get("created_at") else None
        })
    
    # Get ALL unique referred_by values in the database
    pipeline = [
        {"$match": {"referred_by": {"$exists": True, "$ne": None, "$ne": ""}}},
        {"$group": {"_id": "$referred_by", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 30}
    ]
    all_referred_by_formats = await db.users.aggregate(pipeline).to_list(30)
    
    return {
        "user_info": {
            "uid": uid,
            "referral_code": ref_code,
            "email": email,
            "name": name,
            "stored_referral_count": user.get("referral_count")
        },
        "search_values_used": search_values,
        "referral_counts": {
            "by_uid_only": count_by_uid,
            "by_referral_code_only": count_by_code,
            "by_all_formats_combined": count_by_all,
            "explanation": "by_all_formats_combined should match your Network Analytics total"
        },
        "sample_referrals_found": sample_referrals,
        "all_referred_by_formats_in_entire_db": [
            {"referred_by_value": r["_id"], "user_count": r["count"]} 
            for r in all_referred_by_formats
        ],
        "diagnosis": {
            "if_by_uid_only_is_0_and_stored_count_is_high": "Users are NOT using UID in referred_by field",
            "check_all_referred_by_formats_in_entire_db": "Look for your referral_code or any other format",
            "fix_needed_if": "If you see your referral_code in all_referred_by_formats but by_referral_code_only is 0, there might be a case sensitivity issue"
        }
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



# ========== AI REFERRAL FRAUD DETECTION & BONUS SYSTEM ==========

# Level-wise bonus configuration
REFERRAL_LEVEL_BONUS = {
    1: {"active": 100, "inactive": 20},  # Level 1: 100 PRC for active, 20 PRC for inactive
    2: {"active": 50, "inactive": 10},   # Level 2: 50 PRC for active, 10 PRC for inactive
    3: {"active": 25, "inactive": 5},    # Level 3: 25 PRC for active, 5 PRC for inactive
    4: {"active": 10, "inactive": 2},    # Level 4: 10 PRC for active, 2 PRC for inactive
    5: {"active": 5, "inactive": 1},     # Level 5: 5 PRC for active, 1 PRC for inactive
}

async def check_referral_fraud(user_id: str, referred_by: str) -> dict:
    """
    AI-powered fraud detection for referral system
    Returns: {"is_fraud": bool, "reason": str, "confidence": float}
    """
    fraud_signals = []
    confidence = 0.0
    
    user = await db.users.find_one({"uid": user_id}, {"_id": 0})
    referrer = await db.users.find_one({"uid": referred_by}, {"_id": 0})
    
    if not user or not referrer:
        return {"is_fraud": False, "reason": "User not found", "confidence": 0.0}
    
    # Check 1: Same device fingerprint
    if user.get("device_fingerprint") and user.get("device_fingerprint") == referrer.get("device_fingerprint"):
        fraud_signals.append("Same device fingerprint")
        confidence += 0.4
    
    # Check 2: Same IP address registration
    if user.get("registration_ip") and user.get("registration_ip") == referrer.get("registration_ip"):
        fraud_signals.append("Same IP address at registration")
        confidence += 0.3
    
    # Check 3: Similar email patterns (e.g., user1@gmail.com, user2@gmail.com)
    user_email = user.get("email", "")
    referrer_email = referrer.get("email", "")
    if user_email and referrer_email:
        # Check if emails have similar base (ignoring numbers)
        import re
        user_base = re.sub(r'\d+', '', user_email.split('@')[0].lower())
        referrer_base = re.sub(r'\d+', '', referrer_email.split('@')[0].lower())
        if user_base and referrer_base and user_base == referrer_base:
            fraud_signals.append("Similar email pattern")
            confidence += 0.2
    
    # Check 4: Rapid referral pattern (multiple referrals in short time)
    from datetime import datetime, timedelta, timezone
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    recent_referrals = await db.users.count_documents({
        "referred_by": referred_by,
        "created_at": {"$gte": one_hour_ago}
    })
    if recent_referrals > 5:
        fraud_signals.append(f"Rapid referral pattern: {recent_referrals} in 1 hour")
        confidence += 0.3
    
    # Check 5: No activity after registration (bot behavior)
    user_created = user.get("created_at", "")
    if user_created:
        try:
            created_time = datetime.fromisoformat(user_created.replace('Z', '+00:00'))
            if datetime.now(timezone.utc) - created_time > timedelta(days=7):
                # Check if user has any activity
                activity_count = await db.transactions.count_documents({"user_id": user_id})
                mining_sessions = user.get("total_mining_sessions", 0)
                if activity_count == 0 and mining_sessions == 0:
                    fraud_signals.append("No activity after 7 days")
                    confidence += 0.25
        except:
            pass
    
    is_fraud = confidence >= 0.5
    reason = "; ".join(fraud_signals) if fraud_signals else "No fraud signals detected"
    
    return {
        "is_fraud": is_fraud,
        "reason": reason,
        "confidence": round(confidence, 2),
        "signals": fraud_signals
    }

async def calculate_referral_bonus(referrer_id: str, referred_id: str, level: int = 1) -> dict:
    """
    Calculate referral bonus based on activity status and level
    Active referrals get full bonus, inactive get reduced bonus
    """
    referred_user = await db.users.find_one({"uid": referred_id}, {"_id": 0})
    if not referred_user:
        return {"bonus": 0, "status": "user_not_found"}
    
    # Check if referred user is active (mined or transacted in last 30 days)
    from datetime import datetime, timedelta, timezone
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    recent_activity = await db.transactions.count_documents({
        "user_id": referred_id,
        "created_at": {"$gte": thirty_days_ago}
    })
    
    # FIXED: Paid subscribers are ALWAYS active
    subscription_plan = (referred_user.get("subscription_plan") or "").lower()
    is_paid_subscriber = subscription_plan in ["elite", "vip", "pro", "growth", "startup"]
    is_active = is_paid_subscriber or recent_activity > 0 or referred_user.get("mining_active", False)
    
    # Get bonus based on level and activity
    level_config = REFERRAL_LEVEL_BONUS.get(level, {"active": 5, "inactive": 1})
    bonus = level_config["active"] if is_active else level_config["inactive"]
    
    # Check for fraud
    fraud_check = await check_referral_fraud(referred_id, referrer_id)
    if fraud_check["is_fraud"]:
        bonus = 0  # No bonus for fraudulent referrals
    
    return {
        "bonus": bonus,
        "status": "active" if is_active else "inactive",
        "level": level,
        "fraud_detected": fraud_check["is_fraud"],
        "fraud_reason": fraud_check.get("reason", "")
    }

@router.get("/referrals/{user_id}/fraud-check")
async def check_user_referral_fraud(user_id: str):
    """Check all referrals for potential fraud"""
    
    # Get all direct referrals
    direct_referrals = await db.users.find({"referred_by": user_id}, {"_id": 0}).to_list(length=100)
    
    fraud_results = []
    total_fraud = 0
    total_suspicious = 0
    
    for referral in direct_referrals:
        fraud_check = await check_referral_fraud(referral.get("uid"), user_id)
        
        result = {
            "user_id": referral.get("uid"),
            "email": referral.get("email", "")[:3] + "***",  # Partially hide email
            "name": referral.get("name", "Unknown"),
            "is_fraud": fraud_check["is_fraud"],
            "confidence": fraud_check["confidence"],
            "reason": fraud_check["reason"]
        }
        fraud_results.append(result)
        
        if fraud_check["is_fraud"]:
            total_fraud += 1
        elif fraud_check["confidence"] > 0.3:
            total_suspicious += 1
    
    return {
        "total_referrals": len(direct_referrals),
        "total_fraud": total_fraud,
        "total_suspicious": total_suspicious,
        "fraud_rate": round((total_fraud / len(direct_referrals) * 100) if direct_referrals else 0, 2),
        "results": fraud_results
    }

@router.get("/referrals/{user_id}/bonus-breakdown")
async def get_referral_bonus_breakdown(user_id: str):
    """Get detailed bonus breakdown by level and activity status"""
    
    referrals_by_level = await get_multi_level_referrals(user_id, max_levels=5)
    
    breakdown = {
        "levels": [],
        "total_active_bonus": 0,
        "total_inactive_bonus": 0,
        "total_potential_bonus": 0,
        "active_referrals": 0,
        "inactive_referrals": 0
    }
    
    for level in range(1, 6):
        level_key = f"level_{level}"
        users = referrals_by_level.get(level_key, [])
        
        level_data = {
            "level": level,
            "total_members": len(users),
            "active_members": 0,
            "inactive_members": 0,
            "active_bonus_per_member": REFERRAL_LEVEL_BONUS[level]["active"],
            "inactive_bonus_per_member": REFERRAL_LEVEL_BONUS[level]["inactive"],
            "total_earned": 0,
            "potential_if_all_active": len(users) * REFERRAL_LEVEL_BONUS[level]["active"]
        }
        
        for user in users:
            bonus_info = await calculate_referral_bonus(user_id, user.get("uid"), level)
            
            if bonus_info["status"] == "active":
                level_data["active_members"] += 1
                level_data["total_earned"] += bonus_info["bonus"]
                breakdown["active_referrals"] += 1
                breakdown["total_active_bonus"] += bonus_info["bonus"]
            else:
                level_data["inactive_members"] += 1
                level_data["total_earned"] += bonus_info["bonus"]
                breakdown["inactive_referrals"] += 1
                breakdown["total_inactive_bonus"] += bonus_info["bonus"]
        
        breakdown["levels"].append(level_data)
        breakdown["total_potential_bonus"] += level_data["potential_if_all_active"]
    
    return breakdown

@router.get("/referrals/{user_id}/network-analytics")
async def get_network_analytics(user_id: str):
    """
    Get comprehensive network analytics for improved downline visualization.
    Includes:
    - Network health score (0-100)
    - Growth trends
    - Engagement metrics
    - Top performers
    - Re-engagement opportunities
    """
    user = await db.users.find_one({"uid": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    
    # Get all referrals by level
    referrals_by_level = await get_multi_level_referrals(user_id, max_levels=5)
    
    # Flatten all referrals
    all_referrals = []
    for level_key, users in referrals_by_level.items():
        level_num = int(level_key.split("_")[1])
        for u in users:
            u["level"] = level_num
            all_referrals.append(u)
    
    total_network = len(all_referrals)
    
    # Calculate active users
    active_users = []
    inactive_users = []
    
    for ref in all_referrals:
        is_active, reason = await check_user_active_status(ref.get("uid"), ref)
        ref["is_active"] = is_active
        ref["active_reason"] = reason
        if is_active:
            active_users.append(ref)
        else:
            inactive_users.append(ref)
    
    active_count = len(active_users)
    
    # Calculate network health score (0-100)
    health_score = 0
    if total_network > 0:
        # Base: activity rate (40% weight)
        activity_rate = (active_count / total_network) * 100
        health_score += activity_rate * 0.4
        
        # Subscription quality (30% weight)
        paid_count = len([r for r in all_referrals if r.get("subscription_plan", "explorer") in ["startup", "growth", "elite"]])
        subscription_rate = (paid_count / total_network) * 100
        health_score += subscription_rate * 0.3
        
        # Level depth (15% weight) - more levels = healthier network
        levels_with_users = len([k for k, v in referrals_by_level.items() if len(v) > 0])
        depth_score = (levels_with_users / 5) * 100
        health_score += depth_score * 0.15
        
        # Recent growth (15% weight)
        recent_joins = len([r for r in all_referrals if r.get("created_at") and r.get("created_at") > (now - timedelta(days=30)).isoformat()])
        growth_score = min(100, recent_joins * 10)  # 10 new users in month = 100%
        health_score += growth_score * 0.15
    
    # Get top performers (highest PRC balance in network)
    top_performers = sorted(
        [r for r in all_referrals if r.get("prc_balance", 0) > 0],
        key=lambda x: x.get("prc_balance", 0),
        reverse=True
    )[:5]
    
    # Get re-engagement opportunities (inactive users who were once active)
    reengagement_opportunities = sorted(
        inactive_users,
        key=lambda x: x.get("created_at", ""),
        reverse=True
    )[:10]
    
    # Calculate subscription distribution
    subscription_dist = {
        "explorer": len([r for r in all_referrals if r.get("subscription_plan", "explorer") == "explorer"]),
        "startup": len([r for r in all_referrals if r.get("subscription_plan") == "startup"]),
        "growth": len([r for r in all_referrals if r.get("subscription_plan") == "growth"]),
        "elite": len([r for r in all_referrals if r.get("subscription_plan") == "elite"])
    }
    
    # Calculate level distribution
    level_distribution = []
    for level_num in range(1, 6):
        level_key = f"level_{level_num}"
        level_users = referrals_by_level.get(level_key, [])
        level_active = len([u for u in level_users if any(r.get("uid") == u.get("uid") and r.get("is_active") for r in all_referrals)])
        level_distribution.append({
            "level": level_num,
            "total": len(level_users),
            "active": level_active,
            "bonus_percent": {1: 10, 2: 5, 3: 2.5, 4: 1.5, 5: 1}.get(level_num, 0)
        })
    
    # Calculate potential earnings if all were active
    total_potential_bonus = sum([
        ld["total"] * ld["bonus_percent"]
        for ld in level_distribution
    ])
    
    current_bonus = sum([
        ld["active"] * ld["bonus_percent"]
        for ld in level_distribution
    ])
    
    # Get referral earnings - check all referral-related transaction types
    referral_types = ["referral", "referral_bonus", "referral_reward"]
    referral_earnings = await db.transactions.aggregate([
        {"$match": {"user_id": user_id, "type": {"$in": referral_types}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    total_earned = referral_earnings[0]["total"] if referral_earnings else 0
    
    # Also check users collection for total_referral_earnings field if transactions don't have data
    if total_earned == 0:
        total_earned = user.get("total_referral_earnings", 0)
    
    # If still no data, estimate from total_mined and network structure
    # This gives historical users an estimated referral earnings value
    if total_earned == 0 and total_network > 0 and user.get("total_mined", 0) > 0:
        # Calculate estimated referral bonus percentage of total mining
        total_bonus_percent = sum([
            ld["active"] * ld["bonus_percent"] / 100
            for ld in level_distribution
        ])
        # Estimate that referral bonus was ~X% of their total mining
        # (This is an approximation since we don't have historical data)
        estimated_referral_portion = user.get("total_mined", 0) * total_bonus_percent
        total_earned = estimated_referral_portion
    
    return {
        "network_health_score": round(health_score, 1),
        "total_network_size": total_network,
        "active_users": active_count,
        "inactive_users": len(inactive_users),
        "activity_rate": round((active_count / total_network * 100) if total_network > 0 else 0, 1),
        "subscription_distribution": subscription_dist,
        "level_distribution": level_distribution,
        "current_bonus_percent": round(current_bonus, 1),
        "potential_bonus_percent": round(total_potential_bonus, 1),
        "bonus_opportunity": round(total_potential_bonus - current_bonus, 1),
        "total_earned_prc": round(total_earned, 2),
        "top_performers": [
            {
                "uid": p.get("uid"),
                "name": p.get("name", "User"),
                "level": p.get("level"),
                "subscription_plan": p.get("subscription_plan", "explorer"),
                "prc_balance": round(p.get("prc_balance", 0), 2),
                "is_active": p.get("is_active", False)
            }
            for p in top_performers
        ],
        "reengagement_opportunities": [
            {
                "uid": r.get("uid"),
                "name": r.get("name", "User"),
                "email": r.get("email", "")[:3] + "***@***",  # Partially hide
                "level": r.get("level"),
                "subscription_plan": r.get("subscription_plan", "explorer"),
                "joined_at": r.get("created_at"),
                "last_activity": r.get("mining_start_time") or r.get("last_login")
            }
            for r in reengagement_opportunities
        ]
    }

@router.post("/ai/referral-suggestions")
async def get_ai_referral_suggestions(uid: str):
    """AI-powered suggestions to improve referral network"""
    
    user = await db.users.find_one({"uid": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get network stats
    level_counts = await count_active_referrals_by_level(uid)
    bonus_breakdown = await get_referral_bonus_breakdown(uid)
    
    suggestions = []
    
    # Suggestion 1: Activate inactive referrals
    inactive_count = bonus_breakdown.get("inactive_referrals", 0)
    if inactive_count > 0:
        potential_gain = sum([
            l["inactive_members"] * (REFERRAL_LEVEL_BONUS[l["level"]]["active"] - REFERRAL_LEVEL_BONUS[l["level"]]["inactive"])
            for l in bonus_breakdown.get("levels", [])
        ])
        suggestions.append({
            "type": "activate_inactive",
            "priority": "high",
            "title": f"Activate {inactive_count} Inactive Referrals",
            "description": f"तुमचे {inactive_count} referrals inactive आहेत. त्यांना active केल्यास {potential_gain} PRC extra मिळेल!",
            "action": "Send reminder to inactive members",
            "potential_gain": potential_gain
        })
    
    # Suggestion 2: Grow Level 1 referrals
    level1_count = level_counts.get("level_1", 0)
    if level1_count < 10:
        suggestions.append({
            "type": "grow_network",
            "priority": "high",
            "title": "Grow Your Direct Network",
            "description": f"तुमचे {level1_count} direct referrals आहेत. 10 पर्यंत वाढवा आणि bonus unlock करा!",
            "action": "Share referral link on WhatsApp",
            "target": 10 - level1_count
        })
    
    # Suggestion 3: Focus on deeper levels
    level2_count = level_counts.get("level_2", 0)
    if level1_count > 5 and level2_count < level1_count:
        suggestions.append({
            "type": "deepen_network",
            "priority": "medium",
            "title": "Help Your Referrals Grow",
            "description": "तुमच्या Level 1 members ना त्यांचे referrals वाढवायला मदत करा. Level 2 bonus मिळेल!",
            "action": "Share tips with your team",
            "target": level1_count - level2_count
        })
    
    # Suggestion 4: VIP upgrade
    if user.get("membership_type") != "vip" and level1_count >= 5:
        suggestions.append({
            "type": "upgrade_vip",
            "priority": "medium",
            "title": "Upgrade to VIP",
            "description": "VIP members ला 2x referral bonus मिळतो. तुमच्या network साठी VIP योग्य आहे!",
            "action": "View VIP plans",
            "benefit": "2x referral earnings"
        })
    
    # Suggestion 5: Fraud alert
    fraud_check = await check_user_referral_fraud(uid)
    if fraud_check.get("total_fraud", 0) > 0:
        suggestions.append({
            "type": "fraud_alert",
            "priority": "critical",
            "title": "⚠️ Suspicious Activity Detected",
            "description": f"{fraud_check['total_fraud']} referrals मध्ये suspicious activity आढळली. Genuine referrals आणा!",
            "action": "Review referral quality",
            "fraud_count": fraud_check["total_fraud"]
        })
    
    return {
        "suggestions": suggestions,
        "network_health": {
            "total_referrals": sum(level_counts.values()),
            "active_percentage": round(
                (bonus_breakdown["active_referrals"] / max(1, bonus_breakdown["active_referrals"] + bonus_breakdown["inactive_referrals"])) * 100, 
                1
            ),
            "fraud_rate": fraud_check.get("fraud_rate", 0)
        }
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
