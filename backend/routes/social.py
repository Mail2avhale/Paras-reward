"""
PARAS REWARD - Social Routes
=============================
Follow, Unfollow, Messages, Social features
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

router = APIRouter(tags=["Social"])

# Database reference
db = None

def set_db(database):
    global db
    db = database


# ==================== FOLLOW ROUTES ====================

@router.post("/users/{uid}/follow")
async def follow_user(uid: str, request: Request):
    """Follow a user"""
    data = await request.json()
    follower_uid = data.get("follower_uid")
    
    if not follower_uid:
        raise HTTPException(status_code=400, detail="follower_uid required")
    
    if follower_uid == uid:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    target_user = await db.users.find_one({"uid": uid})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.follows.find_one({
        "follower_uid": follower_uid,
        "following_uid": uid
    })
    
    if existing:
        return {"success": True, "message": "Already following", "is_following": True}
    
    follow_doc = {
        "follow_id": str(uuid.uuid4()),
        "follower_uid": follower_uid,
        "following_uid": uid,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.follows.insert_one(follow_doc)
    
    return {"success": True, "message": "Now following", "is_following": True}


@router.delete("/users/{uid}/unfollow")
async def unfollow_user(uid: str, request: Request):
    """Unfollow a user"""
    data = await request.json()
    follower_uid = data.get("follower_uid")
    
    if not follower_uid:
        raise HTTPException(status_code=400, detail="follower_uid required")
    
    result = await db.follows.delete_one({
        "follower_uid": follower_uid,
        "following_uid": uid
    })
    
    if result.deleted_count == 0:
        return {"success": True, "message": "Was not following", "is_following": False}
    
    return {"success": True, "message": "Unfollowed", "is_following": False}


@router.get("/users/{uid}/check-follow/{target_uid}")
async def check_follow_status(uid: str, target_uid: str):
    """Check if user is following another user"""
    existing = await db.follows.find_one({
        "follower_uid": uid,
        "following_uid": target_uid
    })
    return {"is_following": existing is not None}


@router.get("/users/{uid}/followers")
async def get_followers(uid: str, page: int = 1, limit: int = 20):
    """Get user's followers list"""
    skip = (page - 1) * limit
    
    follows = await db.follows.find(
        {"following_uid": uid},
        {"_id": 0, "follower_uid": 1, "created_at": 1}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.follows.count_documents({"following_uid": uid})
    
    followers = []
    for follow in follows:
        user = await db.users.find_one(
            {"uid": follow["follower_uid"]},
            {"_id": 0, "uid": 1, "name": 1, "profile_picture": 1}
        )
        if user:
            user["followed_at"] = follow["created_at"]
            followers.append(user)
    
    return {
        "followers": followers,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get("/users/{uid}/following")
async def get_following(uid: str, page: int = 1, limit: int = 20):
    """Get list of users this user is following"""
    skip = (page - 1) * limit
    
    follows = await db.follows.find(
        {"follower_uid": uid},
        {"_id": 0, "following_uid": 1, "created_at": 1}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.follows.count_documents({"follower_uid": uid})
    
    following = []
    for follow in follows:
        user = await db.users.find_one(
            {"uid": follow["following_uid"]},
            {"_id": 0, "uid": 1, "name": 1, "profile_picture": 1}
        )
        if user:
            user["followed_at"] = follow["created_at"]
            following.append(user)
    
    return {
        "following": following,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get("/users/{uid}/follow-stats")
async def get_follow_stats(uid: str):
    """Get followers and following count"""
    followers_count = await db.follows.count_documents({"following_uid": uid})
    following_count = await db.follows.count_documents({"follower_uid": uid})
    
    return {
        "followers": followers_count,
        "following": following_count
    }


# ==================== MESSAGE ROUTES ====================

@router.get("/messages/conversations/{uid}")
async def get_conversations(uid: str, page: int = 1, limit: int = 20):
    """Get user's conversations"""
    skip = (page - 1) * limit
    
    conversations = await db.conversations.find(
        {"participants": uid},
        {"_id": 0}
    ).sort("last_message_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for conv in conversations:
        other_uid = [p for p in conv["participants"] if p != uid][0]
        other_user = await db.users.find_one(
            {"uid": other_uid},
            {"_id": 0, "uid": 1, "name": 1, "profile_picture": 1}
        )
        
        unread = await db.messages.count_documents({
            "conversation_id": conv["conversation_id"],
            "recipient_id": uid,
            "read": False
        })
        
        result.append({
            "conversation_id": conv["conversation_id"],
            "other_user": other_user,
            "last_message": conv.get("last_message"),
            "last_message_at": conv.get("last_message_at"),
            "unread_count": unread
        })
    
    total = await db.conversations.count_documents({"participants": uid})
    
    return {
        "conversations": result,
        "total": total,
        "page": page
    }


@router.get("/messages/conversation/{conversation_id}")
async def get_conversation_messages(conversation_id: str, page: int = 1, limit: int = 50):
    """Get messages in a conversation"""
    skip = (page - 1) * limit
    
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.messages.count_documents({"conversation_id": conversation_id})
    
    return {
        "messages": list(reversed(messages)),
        "total": total,
        "page": page
    }


@router.post("/messages/send")
async def send_message(request: Request):
    """Send a message to another user"""
    data = await request.json()
    sender_id = data.get("sender_id")
    recipient_id = data.get("recipient_id")
    content = data.get("content")
    
    if not all([sender_id, recipient_id, content]):
        raise HTTPException(status_code=400, detail="sender_id, recipient_id, and content required")
    
    if sender_id == recipient_id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    
    # Get or create conversation
    participants = sorted([sender_id, recipient_id])
    conversation = await db.conversations.find_one({"participants": {"$all": participants}})
    
    if not conversation:
        conversation = {
            "conversation_id": str(uuid.uuid4()),
            "participants": participants,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.conversations.insert_one(conversation)
    
    # Create message
    message = {
        "message_id": str(uuid.uuid4()),
        "conversation_id": conversation["conversation_id"],
        "sender_id": sender_id,
        "recipient_id": recipient_id,
        "content": content,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message)
    
    # Update conversation
    await db.conversations.update_one(
        {"conversation_id": conversation["conversation_id"]},
        {"$set": {
            "last_message": content[:100],
            "last_message_at": message["created_at"]
        }}
    )
    
    message.pop("_id", None)
    return {"success": True, "message": message}


@router.get("/messages/unread-count/{uid}")
async def get_unread_count(uid: str):
    """Get total unread message count"""
    count = await db.messages.count_documents({
        "recipient_id": uid,
        "read": False
    })
    return {"unread_count": count}


@router.put("/messages/{message_id}/read")
async def mark_message_read(message_id: str):
    """Mark a message as read"""
    result = await db.messages.update_one(
        {"message_id": message_id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {"success": True}


@router.put("/messages/conversation/{conversation_id}/read-all")
async def mark_conversation_read(conversation_id: str, uid: str):
    """Mark all messages in conversation as read"""
    result = await db.messages.update_many(
        {"conversation_id": conversation_id, "recipient_id": uid, "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "marked_count": result.modified_count}


# ==================== SOCIAL SEARCH ====================

@router.get("/social/search-users")
async def search_users(q: str, page: int = 1, limit: int = 20):
    """Search users by name or email"""
    skip = (page - 1) * limit
    
    query = {
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}}
        ]
    }
    
    users = await db.users.find(
        query,
        {"_id": 0, "uid": 1, "name": 1, "email": 1, "profile_picture": 1, "subscription_plan": 1}
    ).skip(skip).limit(limit).to_list(limit)
    
    total = await db.users.count_documents(query)
    
    return {
        "users": users,
        "total": total,
        "page": page,
        "query": q
    }


@router.get("/social/suggested-users/{uid}")
async def get_suggested_users(uid: str, limit: int = 10):
    """Get suggested users to follow"""
    # Get users the current user follows
    following = await db.follows.find(
        {"follower_uid": uid},
        {"following_uid": 1}
    ).to_list(None)
    
    following_uids = [f["following_uid"] for f in following]
    following_uids.append(uid)  # Exclude self
    
    # Get top users not already followed
    suggestions = await db.users.find(
        {"uid": {"$nin": following_uids}},
        {"_id": 0, "uid": 1, "name": 1, "profile_picture": 1, "prc_balance": 1}
    ).sort("prc_balance", -1).limit(limit).to_list(limit)
    
    return {"suggestions": suggestions}
