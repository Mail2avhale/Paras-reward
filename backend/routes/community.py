"""
COMMUNITY HELP PAGE
====================
A community forum where users help each other, share knowledge, and post images.
Features:
- Posts with text + 1 image
- Categories: Help Request, Knowledge Share, Tips & Tricks, General Discussion, Announcement, Support
- Like/React, Comment (nested), Bookmark
- Mark as Helpful
- Admin/Moderator: Delete posts, block users, pin posts, manage moderators
- Report post feature
- Search & Filter
- User reputation (post count, helpful count)
"""

import logging
import uuid
import os
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel, Field

router = APIRouter(prefix="/community", tags=["Community"])

db = None
cache = None

CATEGORIES = [
    "Help Request",
    "Knowledge Share",
    "Tips & Tricks",
    "General Discussion",
    "Announcement",
    "Support"
]


def set_db(database):
    global db
    db = database


def set_cache(cache_instance):
    global cache
    cache = cache_instance


# ==================== MODELS ====================

class CreatePostRequest(BaseModel):
    user_id: str
    user_name: str
    category: str
    title: str = Field(..., min_length=3, max_length=200)
    content: str = Field(..., min_length=1, max_length=5000)

class CommentRequest(BaseModel):
    user_id: str
    user_name: str
    content: str = Field(..., min_length=1, max_length=2000)
    parent_comment_id: Optional[str] = None


# ==================== HELPER ====================

async def is_moderator_or_admin(user_id: str) -> bool:
    """Check if user is admin or moderator."""
    user = await db.users.find_one({"uid": user_id}, {"_id": 0, "is_admin": 1, "role": 1})
    if user and (user.get("is_admin") or user.get("role") == "admin"):
        return True
    mod = await db.community_moderators.find_one({"user_id": user_id, "status": "active"})
    return bool(mod)


async def is_user_blocked(user_id: str) -> bool:
    """Check if user is blocked from community."""
    blocked = await db.community_blocked_users.find_one({"user_id": user_id, "status": "blocked"})
    return bool(blocked)


async def get_user_reputation(user_id: str) -> dict:
    """Get user's community reputation."""
    post_count = await db.community_posts.count_documents({"user_id": user_id, "status": "active"})
    helpful_count = await db.community_posts.count_documents({"user_id": user_id, "status": "active", "is_helpful": True})
    comment_count = await db.community_comments.count_documents({"user_id": user_id})
    total_likes = 0
    async for post in db.community_posts.find({"user_id": user_id, "status": "active"}, {"like_count": 1}):
        total_likes += post.get("like_count", 0)
    return {
        "post_count": post_count,
        "helpful_count": helpful_count,
        "comment_count": comment_count,
        "total_likes_received": total_likes
    }


# ==================== POSTS ====================

@router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}


@router.post("/posts/create")
async def create_post(data: CreatePostRequest):
    try:
        if await is_user_blocked(data.user_id):
            raise HTTPException(status_code=403, detail="You are blocked from the community")

        if data.category not in CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category. Use: {CATEGORIES}")

        # Only admins/mods can post Announcements
        if data.category == "Announcement":
            if not await is_moderator_or_admin(data.user_id):
                raise HTTPException(status_code=403, detail="Only admins and moderators can post announcements")

        now = datetime.now(timezone.utc).isoformat()
        post_id = f"POST-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6]}"

        # Get user subscription info
        user = await db.users.find_one({"uid": data.user_id}, {"_id": 0, "subscription_plan": 1})

        post = {
            "post_id": post_id,
            "user_id": data.user_id,
            "user_name": data.user_name,
            "user_plan": user.get("subscription_plan", "explorer") if user else "explorer",
            "category": data.category,
            "title": data.title,
            "content": data.content,
            "image_url": None,
            "status": "active",
            "is_pinned": False,
            "is_helpful": False,
            "like_count": 0,
            "comment_count": 0,
            "bookmark_count": 0,
            "report_count": 0,
            "view_count": 0,
            "created_at": now,
            "updated_at": now
        }

        await db.community_posts.insert_one(post)
        post.pop("_id", None)

        return {"success": True, "message": "Post created", "post": post}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[COMMUNITY] Create post error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/posts/{post_id}/upload-image")
async def upload_post_image(post_id: str, file: UploadFile = File(...)):
    """Upload image for a post (max 1 image, 3MB)."""
    try:
        post = await db.community_posts.find_one({"post_id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        contents = await file.read()
        if len(contents) > 3 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image must be under 3MB")

        upload_dir = "/app/backend/uploads/community"
        os.makedirs(upload_dir, exist_ok=True)
        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{post_id}.{ext}"
        filepath = os.path.join(upload_dir, filename)

        with open(filepath, "wb") as f:
            f.write(contents)

        image_url = f"/api/community/image/{post_id}"
        await db.community_posts.update_one(
            {"post_id": post_id},
            {"$set": {"image_url": image_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        return {"success": True, "image_url": image_url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/image/{post_id}")
async def get_post_image(post_id: str):
    from fastapi.responses import FileResponse
    upload_dir = "/app/backend/uploads/community"
    for ext in ["jpg", "jpeg", "png", "webp", "gif"]:
        filepath = os.path.join(upload_dir, f"{post_id}.{ext}")
        if os.path.exists(filepath):
            return FileResponse(filepath)
    raise HTTPException(status_code=404, detail="Image not found")


@router.get("/posts")
async def get_posts(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = "latest",
    page: int = 1,
    limit: int = 20,
    user_id: Optional[str] = None,
    time_filter: Optional[str] = None,
    author_id: Optional[str] = None
):
    """Get community posts with filters."""
    try:
        query = {"status": "active"}
        if category and category != "All":
            query["category"] = category
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"content": {"$regex": search, "$options": "i"}}
            ]
        if author_id:
            query["user_id"] = author_id

        # Time filter
        if time_filter:
            from datetime import timedelta
            now = datetime.now(timezone.utc)
            if time_filter == "today":
                cutoff = (now - timedelta(days=1)).isoformat()
            elif time_filter == "week":
                cutoff = (now - timedelta(weeks=1)).isoformat()
            elif time_filter == "month":
                cutoff = (now - timedelta(days=30)).isoformat()
            else:
                cutoff = None
            if cutoff:
                query["created_at"] = {"$gte": cutoff}

        sort_field = "created_at"
        sort_order = -1
        if sort == "popular":
            sort_field = "like_count"
        elif sort == "most_commented":
            sort_field = "comment_count"
        elif sort == "most_viewed":
            sort_field = "view_count"
        elif sort == "helpful":
            query["is_helpful"] = True
        elif sort == "oldest":
            sort_order = 1

        # Pinned posts first
        total = await db.community_posts.count_documents(query)
        skip = (page - 1) * limit

        pinned = await db.community_posts.find(
            {**query, "is_pinned": True}, {"_id": 0}
        ).sort("created_at", -1).to_list(10)

        non_pinned_query = {**query, "is_pinned": {"$ne": True}}
        posts = await db.community_posts.find(
            non_pinned_query, {"_id": 0}
        ).sort(sort_field, sort_order).skip(skip).limit(limit).to_list(limit)

        all_posts = pinned + posts if page == 1 else posts

        # Enrich with user's like/bookmark status
        if user_id:
            for post in all_posts:
                liked = await db.community_likes.find_one({"post_id": post["post_id"], "user_id": user_id})
                post["user_liked"] = bool(liked)
                bookmarked = await db.community_bookmarks.find_one({"post_id": post["post_id"], "user_id": user_id})
                post["user_bookmarked"] = bool(bookmarked)

        return {
            "posts": all_posts,
            "total": total,
            "page": page,
            "pages": max(1, (total + limit - 1) // limit)
        }
    except Exception as e:
        logging.error(f"[COMMUNITY] Get posts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/posts/{post_id}")
async def get_post_detail(post_id: str, user_id: Optional[str] = None):
    try:
        post = await db.community_posts.find_one({"post_id": post_id, "status": "active"}, {"_id": 0})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        # Get comments
        comments = await db.community_comments.find(
            {"post_id": post_id, "status": "active"},
            {"_id": 0}
        ).sort("created_at", 1).to_list(200)

        # User status
        if user_id:
            liked = await db.community_likes.find_one({"post_id": post_id, "user_id": user_id})
            post["user_liked"] = bool(liked)
            bookmarked = await db.community_bookmarks.find_one({"post_id": post_id, "user_id": user_id})
            post["user_bookmarked"] = bool(bookmarked)

        # Author reputation
        reputation = await get_user_reputation(post["user_id"])

        return {"post": post, "comments": comments, "author_reputation": reputation}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str, request: Request):
    """Delete post (author, mod, or admin)."""
    try:
        data = await request.json()
        user_id = data.get("user_id")

        post = await db.community_posts.find_one({"post_id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        is_author = post.get("user_id") == user_id
        is_mod = await is_moderator_or_admin(user_id)

        if not is_author and not is_mod:
            raise HTTPException(status_code=403, detail="Not authorized")

        await db.community_posts.update_one(
            {"post_id": post_id},
            {"$set": {"status": "deleted", "deleted_by": user_id, "deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True, "message": "Post deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== EDIT POST ====================

@router.put("/posts/{post_id}")
async def edit_post(post_id: str, request: Request):
    """Edit post (author only)."""
    try:
        data = await request.json()
        user_id = data.get("user_id")

        post = await db.community_posts.find_one({"post_id": post_id, "status": "active"})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        if post.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Only the author can edit this post")

        update = {"updated_at": datetime.now(timezone.utc).isoformat(), "is_edited": True}
        if "title" in data:
            update["title"] = data["title"]
        if "content" in data:
            update["content"] = data["content"]
        if "category" in data and data["category"] in CATEGORIES:
            update["category"] = data["category"]

        await db.community_posts.update_one({"post_id": post_id}, {"$set": update})
        return {"success": True, "message": "Post updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ==================== LIKES ====================

@router.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, request: Request):
    try:
        data = await request.json()
        user_id = data.get("user_id")

        if await is_user_blocked(user_id):
            raise HTTPException(status_code=403, detail="Blocked")

        existing = await db.community_likes.find_one({"post_id": post_id, "user_id": user_id})
        if existing:
            await db.community_likes.delete_one({"post_id": post_id, "user_id": user_id})
            await db.community_posts.update_one({"post_id": post_id}, {"$inc": {"like_count": -1}})
            return {"success": True, "liked": False}
        else:
            await db.community_likes.insert_one({
                "post_id": post_id, "user_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            await db.community_posts.update_one({"post_id": post_id}, {"$inc": {"like_count": 1}})
            return {"success": True, "liked": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== BOOKMARKS ====================

@router.post("/posts/{post_id}/bookmark")
async def toggle_bookmark(post_id: str, request: Request):
    try:
        data = await request.json()
        user_id = data.get("user_id")

        existing = await db.community_bookmarks.find_one({"post_id": post_id, "user_id": user_id})
        if existing:
            await db.community_bookmarks.delete_one({"post_id": post_id, "user_id": user_id})
            await db.community_posts.update_one({"post_id": post_id}, {"$inc": {"bookmark_count": -1}})
            return {"success": True, "bookmarked": False}
        else:
            await db.community_bookmarks.insert_one({
                "post_id": post_id, "user_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            await db.community_posts.update_one({"post_id": post_id}, {"$inc": {"bookmark_count": 1}})
            return {"success": True, "bookmarked": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bookmarks/{user_id}")
async def get_user_bookmarks(user_id: str, page: int = 1, limit: int = 20):
    try:
        skip = (page - 1) * limit
        bookmarks = await db.community_bookmarks.find(
            {"user_id": user_id}, {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

        post_ids = [b["post_id"] for b in bookmarks]
        posts = await db.community_posts.find(
            {"post_id": {"$in": post_ids}, "status": "active"}, {"_id": 0}
        ).to_list(limit)

        return {"posts": posts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== COMMENTS ====================

@router.post("/posts/{post_id}/comment")
async def add_comment(post_id: str, data: CommentRequest):
    try:
        if await is_user_blocked(data.user_id):
            raise HTTPException(status_code=403, detail="Blocked")

        post = await db.community_posts.find_one({"post_id": post_id, "status": "active"})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        now = datetime.now(timezone.utc).isoformat()
        comment_id = f"CMT-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6]}"

        comment = {
            "comment_id": comment_id,
            "post_id": post_id,
            "user_id": data.user_id,
            "user_name": data.user_name,
            "content": data.content,
            "parent_comment_id": data.parent_comment_id,
            "status": "active",
            "like_count": 0,
            "created_at": now
        }

        await db.community_comments.insert_one(comment)
        await db.community_posts.update_one({"post_id": post_id}, {"$inc": {"comment_count": 1}})

        comment.pop("_id", None)
        return {"success": True, "comment": comment}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, request: Request):
    try:
        data = await request.json()
        user_id = data.get("user_id")

        comment = await db.community_comments.find_one({"comment_id": comment_id})
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")

        is_author = comment.get("user_id") == user_id
        is_mod = await is_moderator_or_admin(user_id)

        if not is_author and not is_mod:
            raise HTTPException(status_code=403, detail="Not authorized")

        await db.community_comments.update_one(
            {"comment_id": comment_id},
            {"$set": {"status": "deleted", "deleted_by": user_id}}
        )
        await db.community_posts.update_one(
            {"post_id": comment["post_id"]},
            {"$inc": {"comment_count": -1}}
        )
        return {"success": True, "message": "Comment deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ==================== COMMENT LIKE ====================

@router.post("/comments/{comment_id}/like")
async def toggle_comment_like(comment_id: str, request: Request):
    try:
        data = await request.json()
        user_id = data.get("user_id")

        existing = await db.community_comment_likes.find_one({"comment_id": comment_id, "user_id": user_id})
        if existing:
            await db.community_comment_likes.delete_one({"comment_id": comment_id, "user_id": user_id})
            await db.community_comments.update_one({"comment_id": comment_id}, {"$inc": {"like_count": -1}})
            return {"success": True, "liked": False}
        else:
            await db.community_comment_likes.insert_one({
                "comment_id": comment_id, "user_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            await db.community_comments.update_one({"comment_id": comment_id}, {"$inc": {"like_count": 1}})
            return {"success": True, "liked": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== MARK HELPFUL ====================

@router.post("/posts/{post_id}/helpful")
async def mark_helpful(post_id: str, request: Request):
    """Mark post as helpful (post author or mod/admin)."""
    try:
        data = await request.json()
        user_id = data.get("user_id")

        post = await db.community_posts.find_one({"post_id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        is_mod = await is_moderator_or_admin(user_id)
        if not is_mod:
            raise HTTPException(status_code=403, detail="Only moderators/admins can mark as helpful")

        new_state = not post.get("is_helpful", False)
        await db.community_posts.update_one(
            {"post_id": post_id},
            {"$set": {"is_helpful": new_state}}
        )
        return {"success": True, "is_helpful": new_state}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== REPORT ====================

@router.post("/posts/{post_id}/report")
async def report_post(post_id: str, request: Request):
    try:
        data = await request.json()
        user_id = data.get("user_id")
        reason = data.get("reason", "Inappropriate content")

        existing = await db.community_reports.find_one({"post_id": post_id, "user_id": user_id})
        if existing:
            raise HTTPException(status_code=400, detail="Already reported")

        await db.community_reports.insert_one({
            "post_id": post_id,
            "user_id": user_id,
            "reason": reason,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.community_posts.update_one({"post_id": post_id}, {"$inc": {"report_count": 1}})

        return {"success": True, "message": "Post reported"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PIN POST (MOD/ADMIN) ====================

@router.post("/posts/{post_id}/pin")
async def toggle_pin(post_id: str, request: Request):
    try:
        data = await request.json()
        user_id = data.get("user_id")

        if not await is_moderator_or_admin(user_id):
            raise HTTPException(status_code=403, detail="Only moderators/admins can pin posts")

        post = await db.community_posts.find_one({"post_id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        new_state = not post.get("is_pinned", False)
        await db.community_posts.update_one({"post_id": post_id}, {"$set": {"is_pinned": new_state}})
        return {"success": True, "is_pinned": new_state}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== MODERATION ====================

@router.post("/mod/add")
async def add_moderator(request: Request):
    """Admin adds a moderator."""
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        user_id = data.get("user_id")

        if not await is_moderator_or_admin(admin_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        user = await db.users.find_one({"uid": user_id}, {"_id": 0, "uid": 1, "name": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        existing = await db.community_moderators.find_one({"user_id": user_id, "status": "active"})
        if existing:
            raise HTTPException(status_code=400, detail="Already a moderator")

        await db.community_moderators.insert_one({
            "user_id": user_id,
            "name": user.get("name", ""),
            "status": "active",
            "added_by": admin_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"success": True, "message": f"{user.get('name')} added as moderator"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mod/remove")
async def remove_moderator(request: Request):
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        user_id = data.get("user_id")

        if not await is_moderator_or_admin(admin_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        await db.community_moderators.update_one(
            {"user_id": user_id, "status": "active"},
            {"$set": {"status": "removed", "removed_by": admin_id, "removed_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True, "message": "Moderator removed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mod/list")
async def list_moderators():
    try:
        mods = await db.community_moderators.find({"status": "active"}, {"_id": 0}).to_list(100)
        return {"moderators": mods}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mod/block-user")
async def block_user(request: Request):
    """Block user from community."""
    try:
        data = await request.json()
        mod_id = data.get("mod_id")
        user_id = data.get("user_id")
        reason = data.get("reason", "Community guidelines violation")

        if not await is_moderator_or_admin(mod_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        await db.community_blocked_users.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "status": "blocked",
                "reason": reason,
                "blocked_by": mod_id,
                "blocked_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        return {"success": True, "message": "User blocked from community"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mod/unblock-user")
async def unblock_user(request: Request):
    try:
        data = await request.json()
        mod_id = data.get("mod_id")
        user_id = data.get("user_id")

        if not await is_moderator_or_admin(mod_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        await db.community_blocked_users.update_one(
            {"user_id": user_id},
            {"$set": {"status": "unblocked", "unblocked_by": mod_id, "unblocked_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True, "message": "User unblocked"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mod/blocked-users")
async def list_blocked_users():
    try:
        users = await db.community_blocked_users.find({"status": "blocked"}, {"_id": 0}).to_list(500)
        return {"blocked_users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mod/reports")
async def list_reports(status: str = "pending"):
    """Get reported posts for moderation."""
    try:
        reports = await db.community_reports.find(
            {"status": status}, {"_id": 0}
        ).sort("created_at", -1).to_list(100)

        # Enrich with post data
        for r in reports:
            post = await db.community_posts.find_one({"post_id": r.get("post_id")}, {"_id": 0, "title": 1, "user_name": 1, "content": 1})
            if post:
                r["post_title"] = post.get("title", "")
                r["post_author"] = post.get("user_name", "")
                r["post_content"] = post.get("content", "")[:200]

        return {"reports": reports}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mod/resolve-report")
async def resolve_report(request: Request):
    try:
        data = await request.json()
        post_id = data.get("post_id")
        action = data.get("action")  # dismiss, delete_post, block_user
        mod_id = data.get("mod_id")

        if not await is_moderator_or_admin(mod_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        # Update all reports for this post
        await db.community_reports.update_many(
            {"post_id": post_id, "status": "pending"},
            {"$set": {"status": "resolved", "action": action, "resolved_by": mod_id, "resolved_at": datetime.now(timezone.utc).isoformat()}}
        )

        if action == "delete_post":
            await db.community_posts.update_one(
                {"post_id": post_id},
                {"$set": {"status": "deleted", "deleted_by": mod_id}}
            )
        elif action == "block_user":
            post = await db.community_posts.find_one({"post_id": post_id})
            if post:
                await db.community_blocked_users.update_one(
                    {"user_id": post["user_id"]},
                    {"$set": {"user_id": post["user_id"], "status": "blocked", "reason": "Reported content", "blocked_by": mod_id, "blocked_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=True
                )
                await db.community_posts.update_one({"post_id": post_id}, {"$set": {"status": "deleted"}})

        return {"success": True, "message": f"Report resolved: {action}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== USER STATS ====================

@router.get("/user/{user_id}/stats")
async def get_user_stats(user_id: str):
    try:
        reputation = await get_user_reputation(user_id)
        is_mod = await is_moderator_or_admin(user_id)
        is_blocked = await is_user_blocked(user_id)
        return {
            "user_id": user_id,
            "reputation": reputation,
            "is_moderator": is_mod,
            "is_blocked": is_blocked
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ==================== VIEW COUNT ====================

@router.post("/posts/{post_id}/view")
async def track_view(post_id: str, request: Request):
    """Track post view (increment view count)."""
    try:
        await db.community_posts.update_one(
            {"post_id": post_id, "status": "active"},
            {"$inc": {"view_count": 1}}
        )
        return {"success": True}
    except Exception:
        return {"success": True}  # Silent fail


# ==================== TRENDING ====================

@router.get("/trending")
async def get_trending_posts(limit: int = 10):
    """Get trending posts based on recent engagement (likes + comments in last 7 days)."""
    try:
        from datetime import timedelta
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

        # Posts with most engagement in last 7 days
        trending = await db.community_posts.find(
            {"status": "active", "created_at": {"$gte": week_ago}},
            {"_id": 0}
        ).sort([("like_count", -1), ("comment_count", -1), ("view_count", -1)]).limit(limit).to_list(limit)

        # If not enough recent posts, fill with all-time popular
        if len(trending) < limit:
            all_time = await db.community_posts.find(
                {"status": "active", "post_id": {"$nin": [p["post_id"] for p in trending]}},
                {"_id": 0}
            ).sort([("like_count", -1), ("comment_count", -1)]).limit(limit - len(trending)).to_list(limit)
            trending.extend(all_time)

        return {"trending": trending}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== USER COMMUNITY PROFILE ====================

@router.get("/profile/{user_id}")
async def get_community_profile(user_id: str):
    """Get user's community profile with posts, reputation, and activity."""
    try:
        user = await db.users.find_one(
            {"uid": user_id},
            {"_id": 0, "uid": 1, "name": 1, "subscription_plan": 1, "email": 1}
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        reputation = await get_user_reputation(user_id)
        is_mod = await is_moderator_or_admin(user_id)

        # Recent posts
        recent_posts = await db.community_posts.find(
            {"user_id": user_id, "status": "active"},
            {"_id": 0}
        ).sort("created_at", -1).limit(20).to_list(20)

        # Join date (first post date)
        first_post = await db.community_posts.find_one(
            {"user_id": user_id, "status": "active"},
            {"_id": 0, "created_at": 1}
        )

        return {
            "profile": {
                "user_id": user_id,
                "name": user.get("name", ""),
                "plan": user.get("subscription_plan", "explorer"),
                "is_moderator": is_mod,
                "member_since": first_post.get("created_at") if first_post else None,
                **reputation
            },
            "posts": recent_posts
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== COMMUNITY STATS ====================

@router.get("/stats")
async def get_community_stats():
    try:
        total_posts = await db.community_posts.count_documents({"status": "active"})
        total_comments = await db.community_comments.count_documents({"status": "active"})
        total_users = len(await db.community_posts.distinct("user_id", {"status": "active"}))
        helpful_posts = await db.community_posts.count_documents({"status": "active", "is_helpful": True})
        pending_reports = await db.community_reports.count_documents({"status": "pending"})

        # Category distribution
        categories = {}
        for cat in CATEGORIES:
            categories[cat] = await db.community_posts.count_documents({"status": "active", "category": cat})

        return {
            "total_posts": total_posts,
            "total_comments": total_comments,
            "active_users": total_users,
            "helpful_posts": helpful_posts,
            "pending_reports": pending_reports,
            "categories": categories
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
