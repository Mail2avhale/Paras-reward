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
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
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
    "Support",
    "Success Story",  # Auto-generated system posts for completed transactions
    "Product Delivery",  # Auto-generated when admin marks a Mall booking as delivered
]

# Emoji reactions allowed on posts
ALLOWED_REACTIONS = {"celebrate", "love", "fire"}  # 🎉 ❤️ 🔥

# Rolling window for Success Story posts — keep only latest N; older ones auto-pruned
MAX_SUCCESS_STORIES = 1000


async def _prune_old_success_stories():
    """Keep only the latest MAX_SUCCESS_STORIES Success Story posts.
    Hard-deletes oldest ones beyond the cap + cascades reactions/likes/bookmarks.
    Fire-and-forget: errors logged, never raised."""
    try:
        if db is None:
            return
        total = await db.community_posts.count_documents({"is_success_story": True})
        excess = total - MAX_SUCCESS_STORIES
        if excess <= 0:
            return
        oldest = await db.community_posts.find(
            {"is_success_story": True},
            {"_id": 0, "post_id": 1}
        ).sort("created_at", 1).limit(excess).to_list(excess)
        if not oldest:
            return
        ids = [p["post_id"] for p in oldest]
        await db.community_posts.delete_many({"post_id": {"$in": ids}})
        # Cascade related data
        await db.community_reactions.delete_many({"post_id": {"$in": ids}})
        await db.community_likes.delete_many({"post_id": {"$in": ids}})
        await db.community_bookmarks.delete_many({"post_id": {"$in": ids}})
        logging.info(f"[SUCCESS STORY PRUNE] removed {len(ids)} old posts (cap={MAX_SUCCESS_STORIES})")
    except Exception as e:
        logging.warning(f"[SUCCESS STORY PRUNE] failed: {e}")


async def create_success_story_post(
    user_id: str,
    service_type: str,  # "mobile_recharge" | "dth_recharge" | "bank_redeem" | "subscription"
    amount_inr: float,
    extra_title: str = "",
    ref_id: str = "",
    created_at_override: Optional[str] = None,
    plan_name: Optional[str] = None,  # for service_type="subscription" — e.g. "Elite", "Growth", "Startup"
):
    """Create a system-authored (admin) Success Story post in the community forum.
    Privacy-safe: only first name + city/state + amount revealed. No phone/account shown.
    Idempotent via ref_id. Safe to call fire-and-forget (errors logged, never raised).
    If `created_at_override` is provided (ISO string), it is used as the post's timestamp
    instead of the current time — used during backfill so posts reflect the actual
    transaction date and latest wins bubble to the top."""
    try:
        if db is None:
            return
        # Guard #1: skip test / internal admin users — they should never appear in the
        # public Live Wins feed even if their tests successfully activate a plan.
        if not user_id or user_id.startswith("admin-test") or user_id.startswith("test-") or user_id.startswith("__TEST") or user_id.startswith("__test") or user_id.startswith("burn-test") or user_id == "system":
            return
        # Idempotency: if ref_id already posted, skip
        if ref_id:
            existing = await db.community_posts.find_one(
                {"metadata.ref_id": ref_id, "is_success_story": True},
                {"_id": 1}
            )
            if existing:
                return
        # Guard #2: per-user per-service 24h dedup. Prevents 10 force-activate calls
        # from the same admin creating 10 posts for the same user in seconds.
        # Subscriptions have a 7-day cooldown anyway, so 1 Success Story per user per
        # service per day is a safe UX cap.
        try:
            from datetime import timedelta as _td
            twenty_four_h_ago = (datetime.now(timezone.utc) - _td(hours=24)).isoformat()
            recent_for_user = await db.community_posts.find_one(
                {
                    "metadata.beneficiary_user_id": user_id,
                    "metadata.service_type": service_type,
                    "is_success_story": True,
                    "created_at": {"$gte": twenty_four_h_ago},
                },
                {"_id": 1},
            )
            if recent_for_user:
                logging.info(
                    f"[SUCCESS STORY] 24h per-user dedup skip: {user_id} / {service_type}"
                )
                return
        except Exception as _e:
            # Non-fatal — fail open (better to over-post than lose a legit post)
            logging.debug(f"[SUCCESS STORY] 24h dedup check failed (non-fatal): {_e}")

        user = await db.users.find_one(
            {"uid": user_id},
            {"_id": 0, "name": 1, "first_name": 1, "address": 1, "city": 1, "state": 1}
        )
        if not user:
            return

        full_name = (user.get("first_name") or user.get("name") or "").strip()
        first_name = full_name.split()[0] if full_name else "A user"
        # Prefer direct city/state; fall back to nested address
        city = (user.get("city") or (user.get("address") or {}).get("city") or "").strip() if isinstance(user.get("address"), dict) else (user.get("city") or "").strip()
        state = (user.get("state") or (user.get("address") or {}).get("state") or "").strip() if isinstance(user.get("address"), dict) else (user.get("state") or "").strip()
        location = ", ".join([p for p in [city, state] if p]) or "India"

        service_labels = {
            "mobile_recharge": ("Mobile Recharge", "📱"),
            "dth_recharge": ("DTH Recharge", "📺"),
            "bank_redeem": ("Bank Redeem", "💰"),
            "subscription": ("Subscription", "👑"),
            "paras_mall": ("Paras Mall", "🛍️"),
            "service_charge": ("Service Charge", "💎"),
        }
        label, icon = service_labels.get(service_type, ("Transaction", "✅"))

        # Snapshot of user's lifetime redeemed INR (mobile+DTH+bank+gift+subscription PRC spend).
        # Source of truth: same `get_user_all_time_redeemed` helper that powers
        # the admin Bank Redeem panel's "Lifetime: ₹X" display, so user-facing
        # community posts and admin views are always consistent. Falls back to
        # the older narrow aggregation only if the helpers weren't injected.
        try:
            if service_type == "subscription":
                db_total = 0.0
            elif all_time_redeemed_func and prc_rate_getter:
                # Authoritative path — total PRC redeemed, converted with current rate.
                total_prc = float(await all_time_redeemed_func(user_id) or 0)
                rate = float(await prc_rate_getter() or 0) or 1.0
                db_total = round(total_prc / rate, 2) if rate > 0 else 0.0
            else:
                # Legacy fallback — narrow per-collection sum (kept for safety; will
                # be removed once helpers are guaranteed wired on every deploy).
                success_statuses = ["success", "SUCCESS", "Success", "completed", "COMPLETED"]
                bank_paid_statuses = ["paid", "Paid", "PAID"]
                rech_agg = await db.recharge_transactions.aggregate([
                    {"$match": {"user_id": user_id, "status": {"$in": success_statuses}}},
                    {"$group": {"_id": None, "total": {
                        "$sum": {"$ifNull": ["$amount_inr", {"$ifNull": ["$amount", 0]}]}
                    }}}
                ]).to_list(1)
                bank_agg = await db.bank_transfer_requests.aggregate([
                    {"$match": {"user_id": user_id, "status": {"$in": bank_paid_statuses}}},
                    {"$group": {"_id": None, "total": {
                        "$sum": {"$ifNull": [
                            "$withdrawal_amount",
                            {"$ifNull": [
                                "$amount_inr",
                                {"$ifNull": [
                                    "$total_inr",
                                    {"$ifNull": ["$inr_amount", {"$ifNull": ["$amount", 0]}]}
                                ]}
                            ]}
                        ]}
                    }}}
                ]).to_list(1)
                db_total = float((rech_agg[0]["total"] if rech_agg else 0) or 0) + float((bank_agg[0]["total"] if bank_agg else 0) or 0)
        except Exception as _calc_err:
            logging.warning(f"[SUCCESS STORY] lifetime calc failed: {_calc_err}")
            db_total = 0.0
        lifetime_redeemed = max(db_total, float(amount_inr) if service_type != "subscription" else 0.0)

        # Build title + content (celebratory for subscriptions / mall)
        if service_type == "subscription":
            plan_label = (plan_name or "Premium").strip().title()
            title = f"{icon} {first_name} from {location} upgraded to {plan_label}!"
            body_lines = [
                f"🎊 Congratulations **{first_name}** from **{location}**!",
                "",
                f"Successfully activated **{plan_label} Subscription** plan",
                "",
                f"🚀 Welcome to the {plan_label} club!",
                "✅ Now earning premium rewards via Paras Reward",
            ]
        elif service_type == "paras_mall":
            product_label = (extra_title or "a smart product").strip()
            title = f"{icon} {first_name} from {location} booked {product_label} via Paras Mall!"
            body_lines = [
                f"🛍️ Congratulations **{first_name}** from **{location}**!",
                "",
                f"Booked **{product_label}** (worth ₹{int(amount_inr):,}) via **Paras Mall**",
                "",
                "💎 Mining started — daily PRC rewards now active",
                "✅ Smart reward shopping at Paras Reward",
            ]
        elif service_type == "service_charge":
            # `amount_inr` = 20 % service charge the user just paid.
            # User-provided post format (Feb 27 2026) — verbatim reproduction
            # with variable substitution so every payment reads identically.
            fee_int = int(round(amount_inr))
            title = f"🎉 Redemption Success Story — {first_name} from {location}"
            body_lines = [
                "🎉 REDEMPTION SUCCESS STORY 🎉",
                f"🇮🇳 Congratulations, **{first_name}**!",
                "",
                f"We are happy to share that **{first_name}** from **{location}** has successfully completed their redemption on Paras Reward. ✅",
                "",
                f"💳 20% Redemption Service Charge: **₹{fee_int}**",
                "✅ Service Charge Successfully Paid",
                "✅ Redemption Successfully Completed",
                "",
                "This is an important milestone for our growing Paras Reward community. 💎",
                "**Trust • Transparency • Process**",
                "",
                f"🙏 Thank you, **{first_name}**, for your patience and cooperation.",
                "🚀 More users. More progress. A stronger Paras Reward ecosystem.",
                "",
                "💎 **PARAS REWARD**",
                "*Together We Grow.*",
            ]
        else:
            title = f"{icon} {first_name} from {location} completed {label}!"
            body_lines = [
                f"🎉 Congratulations **{first_name}** from **{location}**!",
                "",
                f"Successfully completed **{label}** of **₹{int(amount_inr):,}**",
                "",
                "✅ Transaction completed successfully via Paras Reward",
            ]
        content = "\n".join(body_lines)

        post_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        # Post timestamp: use original transaction date during backfill, else now
        post_ts = created_at_override or now_iso

        post_doc = {
            "post_id": post_id,
            # Fields aligned with regular posts so they appear in the unified feed
            "user_id": "system",
            "user_name": "Paras Reward",
            "user_plan": "admin",
            "status": "active",
            "is_helpful": False,
            "report_count": 0,
            # Success-story specific flags
            "author_uid": "system",
            "author_name": "Paras Reward",
            "author_role": "admin",
            "is_admin_post": True,
            "is_success_story": True,
            "category": "Success Story",
            "title": title,
            "content": content,
            "image_url": None,
            "images": [],
            "tags": [service_type, "success"] + (["subscription", (plan_name or "premium").lower()] if service_type == "subscription" else []),
            "metadata": {
                "service_type": service_type,
                "service_label": label,
                "service_icon": icon,
                "amount_inr": float(amount_inr),
                "first_name": first_name,
                "location": location,
                "city": city,
                "state": state,
                "ref_id": ref_id,
                "beneficiary_user_id": user_id,
                "user_total_redeemed_inr": float(lifetime_redeemed),
                "plan_name": (plan_name or "").strip().title() if service_type == "subscription" else None,
                "product_name": extra_title if service_type == "paras_mall" else None,
            },
            "like_count": 0,
            "reactions_count": {"celebrate": 0, "love": 0, "fire": 0},
            "comment_count": 0,
            "view_count": 0,
            "bookmark_count": 0,
            "helpful_count": 0,
            "is_pinned": False,
            "is_deleted": False,
            "is_reported": False,
            "created_at": post_ts,
            "updated_at": post_ts,
        }
        await db.community_posts.insert_one(post_doc)
        logging.info(f"[SUCCESS STORY] Posted: {service_type} ₹{amount_inr} by {first_name} ({location})")
        # Enforce rolling window — prune oldest if over cap
        await _prune_old_success_stories()
    except Exception as e:
        logging.warning(f"[SUCCESS STORY] create failed (non-fatal): {e}")


async def _repair_zero_amount_success_stories():
    """One-time repair: Success Story posts that got created with metadata.amount_inr=0
    because of a field-name mismatch (e.g., bank_transfer_requests uses `withdrawal_amount`).
    Looks up the original transaction via ref_id and patches the metadata in-place.
    Fire-and-forget; errors logged, never raised."""
    try:
        if db is None:
            return
        bad = db.community_posts.find(
            {"is_success_story": True, "metadata.amount_inr": {"$lte": 0}},
            {"_id": 0, "post_id": 1, "metadata": 1}
        )
        repaired = 0
        async for post in bad:
            meta = post.get("metadata") or {}
            ref_id = meta.get("ref_id") or ""
            if not ref_id:
                continue
            amount = 0.0
            if ref_id.startswith("bank_redeem:"):
                req_id = ref_id.split(":", 1)[1]
                req = await db.bank_transfer_requests.find_one(
                    {"request_id": req_id},
                    {"_id": 0, "amount_inr": 1, "amount": 1, "inr_amount": 1,
                     "withdrawal_amount": 1, "total_inr": 1, "user_id": 1}
                )
                if req:
                    amount = float(
                        req.get("withdrawal_amount")
                        or req.get("amount_inr")
                        or req.get("total_inr")
                        or req.get("amount")
                        or req.get("inr_amount")
                        or 0
                    )
            elif ref_id.startswith("recharge:"):
                tid = ref_id.split(":", 1)[1]
                txn = await db.recharge_transactions.find_one(
                    {"$or": [{"eko_tid": tid}, {"request_id": tid}, {"client_ref_id": tid}]},
                    {"_id": 0, "amount_inr": 1, "amount": 1, "user_id": 1}
                )
                if txn:
                    amount = float(txn.get("amount_inr") or txn.get("amount") or 0)
            if amount <= 0:
                continue

            # Recompute lifetime redeemed for this user
            uid = meta.get("beneficiary_user_id")
            lifetime = amount
            if uid:
                try:
                    s_statuses = ["success", "SUCCESS", "Success", "completed", "COMPLETED"]
                    p_statuses = ["paid", "Paid", "PAID"]
                    r_agg = await db.recharge_transactions.aggregate([
                        {"$match": {"user_id": uid, "status": {"$in": s_statuses}}},
                        {"$group": {"_id": None, "t": {"$sum": {"$ifNull": ["$amount_inr", {"$ifNull": ["$amount", 0]}]}}}}
                    ]).to_list(1)
                    b_agg = await db.bank_transfer_requests.aggregate([
                        {"$match": {"user_id": uid, "status": {"$in": p_statuses}}},
                        {"$group": {"_id": None, "t": {"$sum": {"$ifNull": [
                            "$withdrawal_amount",
                            {"$ifNull": ["$amount_inr", {"$ifNull": ["$total_inr", {"$ifNull": ["$inr_amount", {"$ifNull": ["$amount", 0]}]}]}]}
                        ]}}}}
                    ]).to_list(1)
                    lifetime = max(
                        amount,
                        float((r_agg[0]["t"] if r_agg else 0) or 0) + float((b_agg[0]["t"] if b_agg else 0) or 0)
                    )
                except Exception:
                    pass

            # Update title/content/metadata in place
            label = meta.get("service_label") or "Transaction"
            icon = meta.get("service_icon") or "✅"
            first_name = meta.get("first_name") or "A user"
            location = meta.get("location") or "India"
            new_title = f"{icon} {first_name} from {location} completed {label}!"
            new_content = "\n".join([
                f"🎉 Congratulations **{first_name}** from **{location}**!",
                "",
                f"Successfully completed **{label}** of **₹{int(amount):,}**",
                "",
                "✅ Transaction completed successfully via Paras Reward",
            ])
            await db.community_posts.update_one(
                {"post_id": post["post_id"]},
                {"$set": {
                    "title": new_title,
                    "content": new_content,
                    "metadata.amount_inr": float(amount),
                    "metadata.user_total_redeemed_inr": float(lifetime),
                }}
            )
            repaired += 1
        if repaired:
            logging.info(f"[SUCCESS STORY REPAIR] patched {repaired} zero-amount posts")
    except Exception as e:
        logging.error(f"[SUCCESS STORY REPAIR] failed: {e}")


async def auto_backfill_success_stories(limit: int = 1000):
    """Run once at server startup to create Success Story posts for historical
    successful transactions that were completed BEFORE this feature shipped.
    Idempotent via ref_id dedup — safe to run multiple times.
    Fire-and-forget: errors are logged but never raised."""
    if db is None:
        return
    try:
        # Quick skip if we already have a healthy volume of success stories
        existing = await db.community_posts.count_documents(
            {"category": "Success Story", "is_success_story": True}
        )
        # Count how many historical success transactions exist
        success_statuses = ["success", "SUCCESS", "Success", "completed", "COMPLETED"]
        bank_paid_statuses = ["paid", "Paid", "PAID"]
        total_txns = (
            await db.recharge_transactions.count_documents({"status": {"$in": success_statuses}})
            + await db.bank_transfer_requests.count_documents({"status": {"$in": bank_paid_statuses}})
        )
        if existing >= total_txns:
            logging.info(f"[SUCCESS STORY AUTO-BACKFILL] up-to-date ({existing}/{total_txns}) — skip create, run repair only")
            await _repair_zero_amount_success_stories()
            return

        created = 0
        # 1. Recharges (mobile + DTH)
        cursor = db.recharge_transactions.find(
            {"status": {"$in": success_statuses}},
            {"_id": 0, "user_id": 1, "amount_inr": 1, "amount": 1,
             "recharge_type": 1, "eko_tid": 1, "request_id": 1, "client_ref_id": 1,
             "operator_name": 1, "operator": 1, "created_at": 1, "updated_at": 1}
        ).sort("created_at", -1).limit(limit)
        async for txn in cursor:
            ref_id = f"recharge:{txn.get('eko_tid') or txn.get('request_id') or txn.get('client_ref_id')}"
            if await db.community_posts.find_one(
                {"metadata.ref_id": ref_id, "is_success_story": True}, {"_id": 1}
            ):
                continue
            if not txn.get("user_id"):
                continue
            amount = float(txn.get("amount_inr") or txn.get("amount") or 0)
            if amount <= 0:
                continue
            rtype = (txn.get("recharge_type") or "").lower()
            if not rtype:
                op = (txn.get("operator_name") or txn.get("operator") or "").lower()
                rtype = "dth" if any(k in op for k in ["dth", "tata sky", "airtel dth", "dish tv", "videocon", "d2h", "sun direct"]) else "mobile"
            service_key = "dth_recharge" if rtype == "dth" else "mobile_recharge"
            # Preserve original transaction timestamp
            txn_ts = txn.get("updated_at") or txn.get("created_at")
            if hasattr(txn_ts, "isoformat"):
                txn_ts = txn_ts.isoformat()
            await create_success_story_post(
                user_id=txn["user_id"],
                service_type=service_key,
                amount_inr=amount,
                ref_id=ref_id,
                created_at_override=txn_ts,
            )
            created += 1

        # 2. Bank transfer paid requests
        cursor2 = db.bank_transfer_requests.find(
            {"status": {"$in": bank_paid_statuses}},
            {"_id": 0, "user_id": 1, "amount_inr": 1, "amount": 1,
             "inr_amount": 1, "withdrawal_amount": 1, "total_inr": 1,
             "request_id": 1, "processed_at": 1, "created_at": 1}
        ).sort("processed_at", -1).limit(limit)
        async for req in cursor2:
            ref_id = f"bank_redeem:{req.get('request_id')}"
            if await db.community_posts.find_one(
                {"metadata.ref_id": ref_id, "is_success_story": True}, {"_id": 1}
            ):
                continue
            if not req.get("user_id"):
                continue
            amount = float(
                req.get("withdrawal_amount")
                or req.get("amount_inr")
                or req.get("total_inr")
                or req.get("amount")
                or req.get("inr_amount")
                or 0
            )
            if amount <= 0:
                continue
            req_ts = req.get("processed_at") or req.get("created_at")
            if hasattr(req_ts, "isoformat"):
                req_ts = req_ts.isoformat()
            await create_success_story_post(
                user_id=req["user_id"],
                service_type="bank_redeem",
                amount_inr=amount,
                ref_id=ref_id,
                created_at_override=req_ts,
            )
            created += 1

        logging.info(f"[SUCCESS STORY AUTO-BACKFILL] created {created} posts (existing before: {existing})")
        # Patch any zero-amount posts from earlier broken runs
        await _repair_zero_amount_success_stories()
        # Final prune to enforce rolling 1000 cap
        await _prune_old_success_stories()
    except Exception as e:
        logging.error(f"[SUCCESS STORY AUTO-BACKFILL] failed: {e}")


def set_db(database):
    global db
    db = database


def set_cache(cache_instance):
    global cache
    cache = cache_instance


# ────────────────────────────────────────────────────────────────────────────
# Wired-in helpers from server.py — let community Success Story posts surface
# the SAME "Lifetime Redeemed (INR)" number that the admin Bank-Redeem panel
# shows. Without this wiring the community page was running its own narrow
# INR aggregation (only `recharge_transactions` + `bank_transfer_requests`),
# which under-reported the lifetime spend versus admin's PRC-rate-based total.
#
# These two callables are injected from server.py at startup:
#   - all_time_redeemed_func(user_id) -> total PRC ever spent (lifetime)
#   - prc_rate_getter()              -> current PRC-to-INR rate
# ────────────────────────────────────────────────────────────────────────────
all_time_redeemed_func = None
prc_rate_getter = None


def set_all_time_redeemed(func):
    global all_time_redeemed_func
    all_time_redeemed_func = func


def set_prc_rate_getter(func):
    global prc_rate_getter
    prc_rate_getter = func


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


async def assert_can_interact(user_id: str) -> None:
    """Gate ALL community interactions (post, like, react, comment, bookmark)
    behind a paid plan. Raises 403 if the user is on the free Explorer plan
    or doesn't exist. Admins / moderators are always allowed.
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required")
    if await is_user_blocked(user_id):
        raise HTTPException(status_code=403, detail="You are blocked from the community")
    user = await db.users.find_one(
        {"uid": user_id},
        {"_id": 0, "subscription_plan": 1, "is_admin": 1, "role": 1},
    )
    if not user:
        raise HTTPException(status_code=403, detail="User not found")
    if user.get("is_admin") or user.get("role") == "admin":
        return
    if await is_moderator_or_admin(user_id):
        return
    plan = (user.get("subscription_plan") or "explorer").lower()
    if plan in ("explorer", "free", "", None):
        raise HTTPException(
            status_code=403,
            detail="Upgrade to Elite to interact with the community.",
        )


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
        await assert_can_interact(data.user_id)

        if data.category not in CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category. Use: {CATEGORIES}")

        # Users cannot create Success Story posts (system-generated only)
        if data.category == "Success Story":
            raise HTTPException(status_code=403, detail="Success Story posts are system-generated only")

        # Only admins/mods can post Announcements
        if data.category == "Announcement":
            if not await is_moderator_or_admin(data.user_id):
                raise HTTPException(status_code=403, detail="Only admins and moderators can post announcements")

        # Get user — needed for denormalised plan label + admin moderation bypass.
        user = await db.users.find_one(
            {"uid": data.user_id},
            {"_id": 0, "subscription_plan": 1, "is_admin": 1, "role": 1},
        )
        plan = (user.get("subscription_plan") or "explorer").lower() if user else "explorer"
        is_priv = bool(user and (user.get("is_admin") or user.get("role") == "admin")) \
            or await is_moderator_or_admin(data.user_id)

        # ── Content moderation (admins/mods bypass) ─────────────────────
        # Two-tier (keyword → Gemini). Negative/spam → reject & never insert
        # (effective hard delete of the would-be post).
        if not is_priv:
            from routes.community_moderation import classify_post
            verdict = await classify_post(data.title, data.content)
            if verdict.get("auto_reject"):
                logging.info(
                    f"[COMMUNITY] Post auto-rejected — user={data.user_id}, "
                    f"tier={verdict.get('tier')}, category={verdict.get('category')}"
                )
                cat = verdict.get("category")
                if cat == "negative":
                    msg = "Your post contains inappropriate content and was not published. Please rephrase and try again."
                elif cat == "spam":
                    msg = "Your post looks like spam and was not published. Please share something useful to the community."
                else:
                    msg = "Your post could not be published. Please rephrase and try again."
                raise HTTPException(status_code=400, detail=msg)

        now = datetime.now(timezone.utc).isoformat()
        post_id = f"POST-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6]}"

        # Snapshot the author's lifetime-redeemed INR so every post card can show
        # the same number the admin Bank Redeem panel shows (social proof +
        # scammer detection). Uses the SAME helpers wired up for Success Story
        # posts so the two surfaces stay consistent. Fails open to 0 on any
        # error — a broken lifetime calc must never block a normal post.
        try:
            if all_time_redeemed_func and prc_rate_getter:
                total_prc = float(await all_time_redeemed_func(data.user_id) or 0)
                rate = float(await prc_rate_getter() or 0) or 1.0
                user_lifetime_inr = round(total_prc / rate, 2) if rate > 0 else 0.0
            else:
                user_lifetime_inr = 0.0
        except Exception as _life_err:
            logging.warning(f"[COMMUNITY] lifetime calc failed for {data.user_id}: {_life_err}")
            user_lifetime_inr = 0.0

        post = {
            "post_id": post_id,
            "user_id": data.user_id,
            "user_name": data.user_name,
            "user_plan": plan,
            # Snapshot at post-time — shown inline next to user_name on post cards
            # across the whole community feed (General, Questions, Success, etc.).
            "user_total_redeemed_inr": user_lifetime_inr,
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

        # Success Story feed: show logged-in user's OWN wins at top (page 1 only),
        # followed by everyone else's latest wins.
        own_posts = []
        is_success_feed = category == "Success Story" and user_id and page == 1
        if is_success_feed:
            own_posts = await db.community_posts.find(
                {**non_pinned_query, "metadata.beneficiary_user_id": user_id},
                {"_id": 0}
            ).sort(sort_field, sort_order).limit(20).to_list(20)
            own_ids = [p["post_id"] for p in own_posts]
            if own_ids:
                non_pinned_query["post_id"] = {"$nin": own_ids}

        posts = await db.community_posts.find(
            non_pinned_query, {"_id": 0}
        ).sort(sort_field, sort_order).skip(skip).limit(limit).to_list(limit)

        if page == 1:
            all_posts = pinned + own_posts + posts
        else:
            all_posts = posts

        # =====================================================================
        # LIFETIME REDEEMED — refresh badge at fetch time so the green
        # "₹X,XXX" badge next to each user_name matches what the leaderboard /
        # admin panel shows. The on-post snapshot is updated only at creation
        # time and goes stale once a user does more redeems/recharges, which
        # caused mismatches between Community Feed and Top 10 Leaderboard
        # (reported May 11, 2026).
        #
        # Performance: `get_user_all_time_redeemed` has a 60s in-memory cache,
        # so unique-user lookups stay O(1) within the cache window. We dedup
        # by user_id and run lookups in parallel.
        # =====================================================================
        if all_time_redeemed_func and prc_rate_getter and all_posts:
            try:
                unique_uids = list({p.get("user_id") for p in all_posts if p.get("user_id")})
                rate = float(await prc_rate_getter() or 0) or 1.0
                # Concurrent lookups bounded by 25 (DB pool friendly)
                import asyncio as _asyncio
                sem = _asyncio.Semaphore(25)

                async def _lookup(uid):
                    async with sem:
                        try:
                            prc = float(await all_time_redeemed_func(uid) or 0)
                            return uid, round(prc / rate, 2) if rate > 0 else 0.0
                        except Exception:
                            return uid, None

                results = await _asyncio.gather(*[_lookup(u) for u in unique_uids])
                fresh_map = {uid: val for uid, val in results if val is not None}

                # Patch posts with fresh lifetime value when available;
                # fall back to stored snapshot otherwise.
                for p in all_posts:
                    fresh = fresh_map.get(p.get("user_id"))
                    if fresh is not None:
                        p["user_total_redeemed_inr"] = fresh
            except Exception as _enrich_err:
                logging.warning(f"[COMMUNITY] lifetime enrich failed: {_enrich_err}")

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

        await assert_can_interact(user_id)

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


@router.post("/posts/{post_id}/react")
async def toggle_reaction(post_id: str, request: Request):
    """Toggle an emoji reaction (celebrate 🎉 | love ❤️ | fire 🔥) on a post.
    One reaction per user per post — switching to a new emoji replaces the old one."""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        emoji = (data.get("emoji") or "").strip().lower()

        if emoji not in ALLOWED_REACTIONS:
            raise HTTPException(status_code=400, detail="Invalid reaction emoji")
        await assert_can_interact(user_id)

        now_iso = datetime.now(timezone.utc).isoformat()
        existing = await db.community_reactions.find_one(
            {"post_id": post_id, "user_id": user_id}, {"_id": 0, "emoji": 1}
        )

        # Same emoji pressed → remove reaction
        if existing and existing.get("emoji") == emoji:
            await db.community_reactions.delete_one({"post_id": post_id, "user_id": user_id})
            await db.community_posts.update_one(
                {"post_id": post_id},
                {"$inc": {f"reactions_count.{emoji}": -1}}
            )
            return {"success": True, "removed": True, "emoji": emoji}

        # Different emoji pressed → swap
        if existing:
            old_emoji = existing.get("emoji")
            await db.community_reactions.update_one(
                {"post_id": post_id, "user_id": user_id},
                {"$set": {"emoji": emoji, "updated_at": now_iso}}
            )
            inc_patch = {
                f"reactions_count.{emoji}": 1,
                f"reactions_count.{old_emoji}": -1,
            }
            await db.community_posts.update_one({"post_id": post_id}, {"$inc": inc_patch})
            return {"success": True, "swapped": True, "emoji": emoji}

        # Fresh reaction
        await db.community_reactions.insert_one({
            "post_id": post_id, "user_id": user_id,
            "emoji": emoji, "created_at": now_iso,
        })
        await db.community_posts.update_one(
            {"post_id": post_id},
            {"$inc": {f"reactions_count.{emoji}": 1}}
        )
        return {"success": True, "added": True, "emoji": emoji}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/posts/{post_id}/my-reaction")
async def get_my_reaction(post_id: str, user_id: str):
    """Return the current user's reaction emoji (if any) for a post."""
    if not user_id:
        return {"emoji": None}
    r = await db.community_reactions.find_one(
        {"post_id": post_id, "user_id": user_id},
        {"_id": 0, "emoji": 1}
    )
    return {"emoji": (r or {}).get("emoji")}



# ==================== BOOKMARKS ====================

@router.post("/posts/{post_id}/bookmark")
async def toggle_bookmark(post_id: str, request: Request):
    try:
        data = await request.json()
        user_id = data.get("user_id")

        await assert_can_interact(user_id)

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
        await assert_can_interact(data.user_id)

        post = await db.community_posts.find_one({"post_id": post_id, "status": "active"})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        # Moderate comment text (admins/mods bypass)
        is_priv = await is_moderator_or_admin(data.user_id)
        if not is_priv:
            from routes.community_moderation import classify_post
            verdict = await classify_post("", data.content)
            if verdict.get("auto_reject"):
                cat = verdict.get("category")
                if cat == "negative":
                    msg = "Your comment contains inappropriate content and was not posted."
                elif cat == "spam":
                    msg = "Your comment looks like spam and was not posted."
                else:
                    msg = "Your comment could not be posted. Please rephrase."
                raise HTTPException(status_code=400, detail=msg)

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

        await assert_can_interact(user_id)

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


# ==================== SUCCESS STORIES PUBLIC STATS ====================

@router.get("/success-stats")
async def get_success_stats():
    """Public stats for the "Live Wins" banner in Community Forum.
    Returns total lifetime successful transactions (Recharge + DTH + Bank Redeem)
    and recent activity (last 24h / 7d). Cached lightly via count_documents."""
    try:
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        day_ago = (now - timedelta(days=1)).isoformat()
        week_ago = (now - timedelta(days=7)).isoformat()

        success_statuses = ["success", "SUCCESS", "Success", "completed", "COMPLETED"]
        bank_paid_statuses = ["paid", "Paid", "PAID"]

        # Lifetime counts
        recharge_total = await db.recharge_transactions.count_documents(
            {"status": {"$in": success_statuses}}
        )
        bank_total = await db.bank_transfer_requests.count_documents({"status": {"$in": bank_paid_statuses}})

        # Last 7 days
        recharge_7d = await db.recharge_transactions.count_documents(
            {"status": {"$in": success_statuses}, "created_at": {"$gte": week_ago}}
        )
        bank_7d = await db.bank_transfer_requests.count_documents(
            {"status": {"$in": bank_paid_statuses}, "processed_at": {"$gte": week_ago}}
        )

        # Last 24h
        recharge_24h = await db.recharge_transactions.count_documents(
            {"status": {"$in": success_statuses}, "created_at": {"$gte": day_ago}}
        )
        bank_24h = await db.bank_transfer_requests.count_documents(
            {"status": {"$in": bank_paid_statuses}, "processed_at": {"$gte": day_ago}}
        )

        # Sum of total disbursed/recharged amount (lifetime) — best effort
        recharge_amount_agg = await db.recharge_transactions.aggregate([
            {"$match": {"status": {"$in": success_statuses}}},
            {"$group": {"_id": None, "total": {
                "$sum": {"$ifNull": ["$amount_inr", {"$ifNull": ["$amount", 0]}]}
            }}}
        ]).to_list(1)
        bank_amount_agg = await db.bank_transfer_requests.aggregate([
            {"$match": {"status": {"$in": bank_paid_statuses}}},
            {"$group": {"_id": None, "total": {
                "$sum": {"$ifNull": ["$amount_inr", {"$ifNull": ["$inr_amount", {"$ifNull": ["$amount", 0]}]}]}
            }}}
        ]).to_list(1)
        recharge_amount = float(recharge_amount_agg[0]["total"]) if recharge_amount_agg else 0
        bank_amount = float(bank_amount_agg[0]["total"]) if bank_amount_agg else 0

        total_lifetime = recharge_total + bank_total
        total_7d = recharge_7d + bank_7d
        total_24h = recharge_24h + bank_24h
        total_amount = recharge_amount + bank_amount

        return {
            "total_lifetime": total_lifetime,
            "total_7d": total_7d,
            "total_24h": total_24h,
            "total_amount_inr": total_amount,
            "breakdown": {
                "recharge": recharge_total,
                "bank_redeem": bank_total,
            },
        }
    except Exception as e:
        logging.error(f"success-stats failed: {e}")
        # Never fail the feed — return zeros
        return {
            "total_lifetime": 0, "total_7d": 0, "total_24h": 0,
            "total_amount_inr": 0, "breakdown": {"recharge": 0, "bank_redeem": 0},
        }


# ==================== SUCCESS STORY BACKFILL (Admin) ====================

@router.post("/admin/repair-success-stories")
async def admin_repair_success_stories(request: Request):
    """Admin-only: Manually trigger the zero-amount repair scan right now.
    Useful when a specific user's recent paid request shows ₹0 on their card."""
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        admin = await db.users.find_one({"uid": admin_id}, {"_id": 0, "role": 1})
        if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
            raise HTTPException(status_code=403, detail="Admin only")
        await _repair_zero_amount_success_stories()
        return {"success": True, "message": "Repair scan completed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/backfill-success-stories")
async def backfill_success_stories(request: Request):
    """Admin-only: Scan historical successful transactions and create Success Story
    posts for each one that doesn't already have a post.
    Sources:
      - recharge_transactions (mobile + DTH) where status IN ['success', 'SUCCESS', 'completed']
      - bank_transfer_requests where status='paid'
    Idempotent: uses ref_id dedup via create_success_story_post()."""
    try:
        data = await request.json()
        admin_id = data.get("admin_id")
        limit = int(data.get("limit", 500))
        dry_run = bool(data.get("dry_run", False))

        admin = await db.users.find_one({"uid": admin_id}, {"_id": 0, "role": 1, "name": 1})
        if not admin or admin.get("role") not in ("admin", "sub_admin", "super_admin", "manager"):
            raise HTTPException(status_code=403, detail="Admin only")

        created = {"mobile_recharge": 0, "dth_recharge": 0, "bank_redeem": 0}
        skipped_existing = 0
        skipped_no_user = 0

        success_statuses = ["success", "SUCCESS", "Success", "completed", "COMPLETED"]

        # 1. Recharge transactions (mobile + DTH)
        cursor = db.recharge_transactions.find(
            {"status": {"$in": success_statuses}},
            {"_id": 0, "user_id": 1, "amount_inr": 1, "amount": 1,
             "recharge_type": 1, "eko_tid": 1, "request_id": 1, "client_ref_id": 1,
             "operator_name": 1, "operator": 1}
        ).sort("created_at", -1).limit(limit)
        async for txn in cursor:
            ref_id = f"recharge:{txn.get('eko_tid') or txn.get('request_id') or txn.get('client_ref_id')}"
            # Dedupe check
            if await db.community_posts.find_one({"metadata.ref_id": ref_id, "is_success_story": True}, {"_id": 1}):
                skipped_existing += 1
                continue
            if not txn.get("user_id"):
                skipped_no_user += 1
                continue
            amount = float(txn.get("amount_inr") or txn.get("amount") or 0)
            if amount <= 0:
                continue
            rtype = (txn.get("recharge_type") or "").lower()
            # Heuristic: infer DTH from operator name if missing
            if not rtype:
                op = (txn.get("operator_name") or txn.get("operator") or "").lower()
                rtype = "dth" if any(k in op for k in ["dth", "tata sky", "airtel dth", "dish tv", "videocon", "d2h", "sun direct"]) else "mobile"
            service_key = "dth_recharge" if rtype == "dth" else "mobile_recharge"
            if not dry_run:
                await create_success_story_post(
                    user_id=txn["user_id"],
                    service_type=service_key,
                    amount_inr=amount,
                    ref_id=ref_id,
                )
            created[service_key] += 1

        # 2. Bank transfer paid requests
        cursor2 = db.bank_transfer_requests.find(
            {"status": {"$in": ["paid", "Paid", "PAID"]}},
            {"_id": 0, "user_id": 1, "amount_inr": 1, "amount": 1,
             "inr_amount": 1, "request_id": 1}
        ).sort("processed_at", -1).limit(limit)
        async for req in cursor2:
            ref_id = f"bank_redeem:{req.get('request_id')}"
            if await db.community_posts.find_one({"metadata.ref_id": ref_id, "is_success_story": True}, {"_id": 1}):
                skipped_existing += 1
                continue
            if not req.get("user_id"):
                skipped_no_user += 1
                continue
            amount = float(req.get("amount_inr") or req.get("amount") or req.get("inr_amount") or 0)
            if amount <= 0:
                continue
            if not dry_run:
                await create_success_story_post(
                    user_id=req["user_id"],
                    service_type="bank_redeem",
                    amount_inr=amount,
                    ref_id=ref_id,
                )
            created["bank_redeem"] += 1

        total_created = sum(created.values())
        return {
            "success": True,
            "dry_run": dry_run,
            "total_created": total_created,
            "by_type": created,
            "skipped_existing": skipped_existing,
            "skipped_no_user": skipped_no_user,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Backfill success stories failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

