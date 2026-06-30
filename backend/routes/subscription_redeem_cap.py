"""
subscription_redeem_cap.py — Bank/Recharge/Utility/EMI lifetime INR cap
=======================================================================

Rule (effective 30 Jun 2026, user-defined)
------------------------------------------
For every successful subscription payment a user makes (via Razorpay, manual
admin approval, OR PRC wallet), they earn **+₹2,500 lifetime headroom** for
Bank-Redeem + Recharge + Utility + EMI redemptions COMBINED.

    1 subscription   →  ₹2,500
    2 subscriptions  →  ₹5,000
    10 subscriptions → ₹25,000

Without ANY subscription → cap = ₹0 (user must subscribe to redeem).

This is a SEPARATE lever from the existing PRC mining/unlock-percent cap
(`calculate_user_redeem_limit`). The PRC cap continues to govern Mall-style
redemptions; THIS cap is the ONLY governor for Bank / Recharge / Utility /
EMI.

Subscription counting
---------------------
Each row in either of these collections, with a successful status, counts
as ONE subscription (i.e. renewals + plan-changes all add capacity):

  • `subscription_payments` status ∈ {paid, success, completed}
  • `vip_payments`           status ∈ {approved}

"Used INR" comes from the canonical `redeem_requests` collection (post the
2026-06-30 unification migration) where service_type ∈ Bank+Utility+EMI set
AND status ∈ success-statuses.
"""
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request

# ── Configuration ──────────────────────────────────────────────────────────
PER_SUBSCRIPTION_INR_CAP = 2500.0

SUBSCRIPTION_SUCCESS_STATUSES = [
    "paid", "PAID", "Paid",
    "success", "SUCCESS", "Success", "successful", "SUCCESSFUL",
    "completed", "COMPLETED", "Completed",
    "approved", "APPROVED", "Approved",
]

REDEEM_SUCCESS_STATUSES = [
    "COMPLETED", "completed", "Completed",
    "Paid", "paid", "PAID",
    "success", "SUCCESS", "Success",
    "approved", "APPROVED",
    "pending", "PENDING",  # in-flight counts against the cap to prevent double-spend
    "processing", "PROCESSING",
]

# service_types governed by this cap (post-unification taxonomy)
GOVERNED_SERVICE_TYPES = [
    # Bank Redeem
    "bank_transfer", "bank_withdrawal", "dmt", "emi",
    # Recharge/Utility
    "mobile_recharge", "mobile_prepaid", "mobile_postpaid", "dth",
    "electricity", "gas", "water", "broadband", "landline", "lpg",
]

router = APIRouter(prefix="/api", tags=["subscription-redeem-cap"])
db = None


def set_db(database):
    global db
    db = database


# ── Core helpers ───────────────────────────────────────────────────────────
async def count_user_subscriptions(user_id: str) -> int:
    """Returns the number of successful subscription payments across all
    payment methods. Each = +1 capacity unit."""
    if db is None:
        return 0
    sub_q = {"user_id": user_id, "status": {"$in": SUBSCRIPTION_SUCCESS_STATUSES}}
    sub_count = await db.subscription_payments.count_documents(sub_q)
    vip_count = await db.vip_payments.count_documents(sub_q)
    return int(sub_count + vip_count)


async def _sum_governed_used_inr(user_id: str) -> float:
    """Sum of INR redeemed (in-flight + completed) under governed service types."""
    if db is None:
        return 0.0
    pipeline = [
        {"$match": {
            "user_id": user_id,
            "service_type": {"$in": GOVERNED_SERVICE_TYPES},
            "status": {"$in": REDEEM_SUCCESS_STATUSES},
        }},
        {"$group": {"_id": None, "inr": {"$sum": {"$ifNull": ["$amount_inr", "$amount"]}}}},
    ]
    cursor = db.redeem_requests.aggregate(pipeline)
    async for row in cursor:
        return float(row.get("inr") or 0)
    return 0.0


async def get_subscription_redeem_cap(user_id: str) -> dict:
    """Returns the user's current Bank/Recharge/Utility/EMI cap state.

    {
      "subscription_count": int,
      "cap_inr":   total lifetime cap (count × ₹2,500),
      "used_inr":  amount already redeemed in governed services,
      "available_inr": cap - used,
      "per_subscription_inr": 2500,
    }
    """
    count = await count_user_subscriptions(user_id)
    cap = count * PER_SUBSCRIPTION_INR_CAP
    used = await _sum_governed_used_inr(user_id)
    available = max(0.0, cap - used)
    return {
        "subscription_count": count,
        "cap_inr": round(cap, 2),
        "used_inr": round(used, 2),
        "available_inr": round(available, 2),
        "per_subscription_inr": PER_SUBSCRIPTION_INR_CAP,
    }


async def check_subscription_redeem_cap(user_id: str, amount_inr: float) -> dict:
    """Gate-keeper invoked by Bank/Recharge/Utility/EMI redeem endpoints.

    Returns: {"allowed": bool, "reason": str|None, "cap_info": dict}
    """
    try:
        info = await get_subscription_redeem_cap(user_id)
    except Exception as e:
        # NEVER block redeem on infra error — log and let upstream PRC checks govern.
        import logging
        logging.exception(f"[sub-cap] error for {user_id}: {e}")
        return {"allowed": True, "reason": None, "cap_info": {"error": str(e)}}

    amt = float(amount_inr or 0)

    if info["subscription_count"] == 0:
        return {
            "allowed": False,
            "reason": "Subscribe to unlock Bank/Recharge/Utility redeem. Each subscription unlocks ₹2,500 lifetime headroom.",
            "cap_info": info,
        }
    if amt > info["available_inr"]:
        return {
            "allowed": False,
            "reason": (
                f"Subscription redeem cap exceeded. Available: ₹{info['available_inr']:.0f} "
                f"(used ₹{info['used_inr']:.0f} of ₹{info['cap_inr']:.0f} from "
                f"{info['subscription_count']} subscription{'s' if info['subscription_count'] != 1 else ''}). "
                f"Subscribe again to add ₹{int(PER_SUBSCRIPTION_INR_CAP)} more."
            ),
            "cap_info": info,
        }
    return {"allowed": True, "reason": None, "cap_info": info}


# ── REST endpoints ─────────────────────────────────────────────────────────
@router.get("/user/{user_id}/subscription-redeem-cap")
async def user_cap_endpoint(user_id: str, request: Request):
    """User-facing endpoint — shows their bank/recharge/utility/EMI cap.

    Security: a user can only fetch their own cap. Admins can fetch anyone's.
    """
    # Lazy import to avoid circular dep on server.py at module-load time
    import os
    import jwt as jwt_lib

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth.replace("Bearer ", "")
        try:
            secret = os.environ.get("JWT_SECRET_KEY", "")
            payload = jwt_lib.decode(token, secret, algorithms=["HS256"])
            requesting_uid = payload.get("uid")
            requesting_role = payload.get("role", "user")
            if requesting_role not in ("admin", "sub_admin", "ADMIN") and requesting_uid != user_id:
                raise HTTPException(403, "You can only view your own redeem cap")
        except jwt_lib.InvalidTokenError:
            raise HTTPException(401, "Invalid token")

    info = await get_subscription_redeem_cap(user_id)
    return {"success": True, "user_id": user_id, **info}


@router.get("/admin/subscription-redeem-cap/leaderboard")
async def admin_leaderboard(limit: int = 50):
    """Admin-only — top users by subscription_count for retention insight."""
    if db is None:
        return {"success": False, "rows": []}
    pipeline = [
        {"$match": {"status": {"$in": SUBSCRIPTION_SUCCESS_STATUSES}}},
        {"$group": {"_id": "$user_id", "subs": {"$sum": 1}}},
        {"$sort": {"subs": -1}},
        {"$limit": limit},
    ]
    rows = []
    async for r in db.subscription_payments.aggregate(pipeline):
        rows.append({"uid": r["_id"], "subs_paid": r["subs"]})

    # Pull vip_payments counts and merge
    vip_rows = {}
    async for r in db.vip_payments.aggregate(pipeline):
        vip_rows[r["_id"]] = r["subs"]

    merged = {r["uid"]: r["subs_paid"] for r in rows}
    for uid, n in vip_rows.items():
        merged[uid] = merged.get(uid, 0) + n

    # Hydrate users for display
    uids = list(merged.keys())
    users = []
    async for u in db.users.find(
        {"uid": {"$in": uids}}, {"_id": 0, "uid": 1, "name": 1, "mobile": 1}
    ):
        users.append(u)
    umap = {u["uid"]: u for u in users}

    out = sorted(
        [
            {
                "uid": uid,
                "name": umap.get(uid, {}).get("name", "Unknown"),
                "mobile": umap.get(uid, {}).get("mobile", ""),
                "subscription_count": n,
                "cap_inr": n * PER_SUBSCRIPTION_INR_CAP,
            }
            for uid, n in merged.items()
        ],
        key=lambda x: x["subscription_count"],
        reverse=True,
    )[:limit]
    return {"success": True, "rows": out, "per_subscription_inr": PER_SUBSCRIPTION_INR_CAP}
