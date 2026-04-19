"""
Social Profile Routes - Public profile, privacy settings, follow system
Extracted from server.py (Phase 1 refactor - April 2026)

Endpoints:
- GET  /users/{uid}/public-profile
- PUT  /users/{uid}/privacy-settings
- POST /users/{uid}/follow
- DELETE /users/{uid}/unfollow
- GET  /users/{uid}/check-follow/{target_uid}
- GET  /users/{uid}/followers
- GET  /users/{uid}/following
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request

router = APIRouter(tags=["Social Profile"])

db = None


def set_db(database):
    global db
    db = database


BADGE_MILESTONES = [
    {"count": 1, "badge": "🌱", "title": "First Steps"},
    {"count": 5, "badge": "⭐", "title": "Rising Star"},
    {"count": 10, "badge": "🔥", "title": "On Fire"},
    {"count": 25, "badge": "💎", "title": "Diamond"},
    {"count": 50, "badge": "👑", "title": "Legend"},
    {"count": 100, "badge": "🏆", "title": "Champion"},
]


def _pick_badge(team_size: int):
    if team_size >= 100:
        return "🏆"
    if team_size >= 50:
        return "👑"
    if team_size >= 25:
        return "💎"
    if team_size >= 10:
        return "🔥"
    if team_size >= 5:
        return "⭐"
    if team_size >= 1:
        return "🌱"
    return None


async def _create_social_notification(user_uid, notification_type, title, message,
                                      from_uid=None, from_name=None, icon="🔔", action_url=None):
    """Helper to write a notification for social events."""
    doc = {
        "notification_id": str(uuid.uuid4()),
        "user_uid": user_uid,
        "type": notification_type,
        "title": title,
        "message": message,
        "from_uid": from_uid,
        "from_name": from_name,
        "icon": icon,
        "action_url": action_url,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(doc)
    return doc


# ========== PUBLIC PROFILE ==========

@router.get("/users/{uid}/public-profile")
async def get_public_profile(uid: str):
    """Get user's public profile (Google Play compliant - no earnings shown)."""
    user = await db.users.find_one({"uid": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_public = user.get("is_public", True)

    followers_count = await db.follows.count_documents({"following_uid": uid})
    following_count = await db.follows.count_documents({"follower_uid": uid})

    team_size = user.get("referral_count", 0)

    earned_badges = [m for m in BADGE_MILESTONES if team_size >= m["count"]]
    current_badge = earned_badges[-1] if earned_badges else None

    total_taps = user.get("total_taps", 0)
    mining_sessions = user.get("total_mining_sessions", 0)
    level = 1 + (team_size // 5) + (total_taps // 1000) + (mining_sessions // 10)
    level = min(level, 100)

    profile = {
        "uid": uid,
        "name": user.get("name", "User"),
        "avatar": user.get("avatar"),
        "is_public": is_public,
        "is_verified": user.get("kyc_verified", False),
        "membership_type": user.get("membership_type", "free"),
        "joined_date": user.get("created_at", ""),
        "city": user.get("city", ""),
        "level": level,
        "team_size": team_size,
        "followers_count": followers_count,
        "following_count": following_count,
        "current_badge": current_badge,
        "earned_badges": earned_badges,
        "total_badges": len(earned_badges),
        "referral_code": user.get("referral_code") if is_public else None,
    }

    if not is_public:
        profile = {
            "uid": uid,
            "name": user.get("name", "User"),
            "avatar": user.get("avatar"),
            "is_public": False,
            "is_verified": user.get("kyc_verified", False),
            "membership_type": user.get("membership_type", "free"),
            "followers_count": followers_count,
            "following_count": following_count,
            "message": "This profile is private",
        }

    return profile


@router.put("/users/{uid}/privacy-settings")
async def update_privacy_settings(uid: str, request: Request):
    """Update user privacy settings."""
    data = await request.json()

    update_data = {}
    if "is_public" in data:
        update_data["is_public"] = data["is_public"]
    if "show_team_size" in data:
        update_data["show_team_size"] = data["show_team_size"]
    if "allow_messages" in data:
        update_data["allow_messages"] = data["allow_messages"]

    if update_data:
        await db.users.update_one({"uid": uid}, {"$set": update_data})

    return {"success": True, "message": "Privacy settings updated"}


# ========== FOLLOW SYSTEM ==========

@router.post("/users/{uid}/follow")
async def follow_user(uid: str, request: Request):
    """Follow a user."""
    data = await request.json()
    follower_uid = data.get("follower_uid")

    if not follower_uid:
        raise HTTPException(status_code=400, detail="follower_uid required")
    if follower_uid == uid:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target_user = await db.users.find_one({"uid": uid})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.follows.find_one({"follower_uid": follower_uid, "following_uid": uid})
    if existing:
        return {"success": True, "message": "Already following", "is_following": True}

    follow_doc = {
        "follow_id": str(uuid.uuid4()),
        "follower_uid": follower_uid,
        "following_uid": uid,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.follows.insert_one(follow_doc)

    follower = await db.users.find_one({"uid": follower_uid}, {"_id": 0, "name": 1})
    follower_name = follower.get("name", "Someone") if follower else "Someone"

    activity = {
        "activity_id": str(uuid.uuid4()),
        "user_uid": follower_uid,
        "type": "follow",
        "target_uid": uid,
        "target_name": target_user.get("name", "User"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.social_activities.insert_one(activity)

    await _create_social_notification(
        user_uid=uid,
        notification_type="new_follower",
        title="New Follower!",
        message=f"{follower_name} started following you",
        from_uid=follower_uid,
        from_name=follower_name,
        icon="👤",
        action_url=f"/profile/{follower_uid}",
    )

    return {"success": True, "message": "Now following", "is_following": True}


@router.delete("/users/{uid}/unfollow")
async def unfollow_user(uid: str, request: Request):
    """Unfollow a user."""
    data = await request.json()
    follower_uid = data.get("follower_uid")

    if not follower_uid:
        raise HTTPException(status_code=400, detail="follower_uid required")

    result = await db.follows.delete_one({"follower_uid": follower_uid, "following_uid": uid})

    if result.deleted_count == 0:
        return {"success": True, "message": "Was not following", "is_following": False}

    return {"success": True, "message": "Unfollowed", "is_following": False}


@router.get("/users/{uid}/check-follow/{target_uid}")
async def check_follow_status(uid: str, target_uid: str):
    """Check if user is following another user."""
    existing = await db.follows.find_one({"follower_uid": uid, "following_uid": target_uid})
    return {"is_following": existing is not None}


async def _list_relations(query_field: str, value: str, page: int, limit: int, result_key: str):
    """Shared helper for followers/following lists with identical shape."""
    skip = (page - 1) * limit
    other_field = "follower_uid" if query_field == "following_uid" else "following_uid"

    follows = await db.follows.find(
        {query_field: value},
        {"_id": 0, other_field: 1, "created_at": 1},
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    total = await db.follows.count_documents({query_field: value})

    items = []
    for f in follows:
        user = await db.users.find_one(
            {"uid": f[other_field]},
            {"_id": 0, "uid": 1, "name": 1, "avatar": 1, "kyc_verified": 1,
             "membership_type": 1, "referral_count": 1},
        )
        if user:
            items.append({
                "uid": user["uid"],
                "name": user.get("name", "User"),
                "avatar": user.get("avatar"),
                "is_verified": user.get("kyc_verified", False),
                "membership_type": user.get("membership_type", "free"),
                "badge": _pick_badge(user.get("referral_count", 0)),
                "followed_at": f.get("created_at"),
            })

    return {
        result_key: items,
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit,
    }


@router.get("/users/{uid}/followers")
async def get_followers(uid: str, page: int = 1, limit: int = 20):
    """Get user's followers list."""
    return await _list_relations("following_uid", uid, page, limit, "followers")


@router.get("/users/{uid}/following")
async def get_following(uid: str, page: int = 1, limit: int = 20):
    """Get list of users this user is following."""
    return await _list_relations("follower_uid", uid, page, limit, "following")


# ========== SOCIAL ACTIVITY FEED ==========

@router.get("/feed/global")
async def get_global_feed(page: int = 1, limit: int = 20):
    """Get global activity feed (public achievements only - Google Play compliant)."""
    skip = (page - 1) * limit

    activities = []

    milestones = await db.milestone_achievements.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    for m in milestones:
        activities.append({
            "id": m.get("achievement_id"),
            "type": "milestone",
            "user_uid": m.get("uid"),
            "user_name": m.get("display_name", "User"),
            "badge": m.get("milestone_badge"),
            "title": m.get("milestone_title"),
            "text": f"unlocked {m.get('milestone_title')} badge {m.get('milestone_badge')}",
            "created_at": m.get("created_at"),
        })

    recent_follows = await db.social_activities.find(
        {"type": "follow"}, {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)

    for f in recent_follows:
        user = await db.users.find_one({"uid": f.get("user_uid")}, {"_id": 0, "name": 1})
        user_name = user.get("name", "User") if user else "User"
        display_name = user_name.split()[0][:3] + "***" if user_name else "User"

        activities.append({
            "id": f.get("activity_id"),
            "type": "follow",
            "user_uid": f.get("user_uid"),
            "user_name": display_name,
            "target_name": f.get("target_name", "someone"),
            "text": f"started following {f.get('target_name', 'someone')}",
            "created_at": f.get("created_at"),
        })

    recent_referrals = await db.users.find(
        {"referred_by": {"$ne": None}},
        {"_id": 0, "referred_by": 1, "created_at": 1}
    ).sort("created_at", -1).limit(10).to_list(10)

    referrer_ids = list({ref.get("referred_by") for ref in recent_referrals if ref.get("referred_by")})
    referrers_map = {}
    if referrer_ids:
        referrers_list = await db.users.find(
            {"uid": {"$in": referrer_ids}},
            {"_id": 0, "uid": 1, "name": 1, "referral_count": 1}
        ).to_list(len(referrer_ids))
        referrers_map = {r["uid"]: r for r in referrers_list}

    for ref in recent_referrals:
        referrer = referrers_map.get(ref.get("referred_by"), {})
        if referrer:
            referrer_name = referrer.get("name", "User")
            display_name = referrer_name.split()[0][:3] + "***" if referrer_name else "User"
            team_size = referrer.get("referral_count", 0)

            activities.append({
                "id": str(uuid.uuid4()),
                "type": "team_growth",
                "user_uid": ref.get("referred_by"),
                "user_name": display_name,
                "team_size": team_size,
                "text": f"grew their team to {team_size} members",
                "created_at": ref.get("created_at"),
            })

    activities.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return {"activities": activities[:limit], "total": len(activities), "page": page}


@router.get("/feed/network/{uid}")
async def get_network_feed(uid: str, page: int = 1, limit: int = 20):
    """Get activity feed from users you follow."""
    following = await db.follows.find(
        {"follower_uid": uid}, {"_id": 0, "following_uid": 1}
    ).to_list(1000)

    following_uids = [f["following_uid"] for f in following]

    if not following_uids:
        return {"activities": [], "total": 0, "page": page, "message": "Follow users to see their activity"}

    activities = []

    milestones = await db.milestone_achievements.find(
        {"uid": {"$in": following_uids}}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    for m in milestones:
        user = await db.users.find_one({"uid": m.get("uid")}, {"_id": 0, "name": 1, "avatar": 1})
        activities.append({
            "id": m.get("achievement_id"),
            "type": "milestone",
            "user_uid": m.get("uid"),
            "user_name": user.get("name", "User") if user else "User",
            "user_avatar": user.get("avatar") if user else None,
            "badge": m.get("milestone_badge"),
            "title": m.get("milestone_title"),
            "text": f"unlocked {m.get('milestone_title')} badge {m.get('milestone_badge')}",
            "created_at": m.get("created_at"),
        })

    social = await db.social_activities.find(
        {"user_uid": {"$in": following_uids}}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    for s in social:
        user = await db.users.find_one({"uid": s.get("user_uid")}, {"_id": 0, "name": 1, "avatar": 1})
        activities.append({
            "id": s.get("activity_id"),
            "type": s.get("type"),
            "user_uid": s.get("user_uid"),
            "user_name": user.get("name", "User") if user else "User",
            "user_avatar": user.get("avatar") if user else None,
            "text": s.get("text", "did something"),
            "created_at": s.get("created_at"),
        })

    activities.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return {"activities": activities[:limit], "total": len(activities), "page": page}
