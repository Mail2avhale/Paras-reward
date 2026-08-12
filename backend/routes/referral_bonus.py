"""
Referral Bonus Campaign — limited-time offer
============================================
Rules (from user):
- ₹200 bonus to the DIRECT referrer (L1) for every NEW paid subscription
- Payment must be via Razorpay OR manual (cash) — NOT via PRC redemption
- First-time subscription only, NO renewals
- Referrer's bank details are required for payout (collected on first bonus if missing)
- Multi-level cascade DISABLED (L1 only)
- Payout: admin does NEFT manually, updates status via daily report

Endpoints
---------
Admin:
  GET  /api/admin/referral-bonus/campaign              → current config
  PUT  /api/admin/referral-bonus/campaign              → enable/disable, set dates, amount
  GET  /api/admin/referral-bonus/report                → list with filters (from/to/status)
  GET  /api/admin/referral-bonus/report/csv            → CSV download
  GET  /api/admin/referral-bonus/summary               → totals for dashboard
  POST /api/admin/referral-bonus/mark-paid             → bulk mark paid
  POST /api/admin/referral-bonus/reverse/{bonus_id}    → reverse a bonus

User:
  GET  /api/referral-bonus/my/{uid}                    → own bonuses
  POST /api/referral-bonus/bank-details/{uid}          → save bank details
  GET  /api/referral-bonus/bank-details/{uid}          → fetch own bank

Helper
------
credit_referral_bonus(db, new_user_uid, payment_method, payment_amount, subscription_plan)
    Called from razorpay_payments.py after successful activation (both razorpay + manual paths).
    Idempotent, safe to call multiple times.
"""
import os
import csv
import uuid
import logging
from datetime import datetime, timezone, date
from io import StringIO
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="", tags=["Referral Bonus"])
db = None


def set_db(database):
    global db
    db = database


DEFAULT_BONUS_AMOUNT = 200.0
DEFAULT_CAMPAIGN_ID = "default"

# ============================================================================
# CORE HELPER — invoked from subscription activation flow
# ============================================================================

async def credit_referral_bonus(
    database,
    new_user_uid: str,
    payment_method: str,
    payment_amount: float = 0.0,
    subscription_plan: str = "",
) -> Optional[dict]:
    """
    Idempotently credit a ₹200 bonus to the direct referrer of `new_user_uid`
    IF ALL of these are true:
      1. Active campaign exists AND today is within [start_date, end_date]
      2. New user has a `referred_by` UID
      3. payment_method is in {razorpay, manual_activation} (NOT prc)
      4. New user has never had a paid subscription activation before (this is their FIRST)
      5. No prior bonus exists for (referrer, new_user) pair (idempotency guard)
      6. Referrer must be an active subscribed user (fake-referrer safety)
      7. No self-referral

    Returns the created bonus doc dict OR None if skipped (silently).
    """
    if database is None:
        return None
    d = database

    try:
        # 1. Campaign active?
        cam = await d.referral_bonus_campaigns.find_one({"_id": DEFAULT_CAMPAIGN_ID})
        if not cam or not cam.get("enabled"):
            return None
        today_iso = datetime.now(timezone.utc).date().isoformat()
        if cam.get("start_date") and today_iso < cam["start_date"]:
            return None
        if cam.get("end_date") and today_iso > cam["end_date"]:
            return None

        # 3. Payment method OK?
        if payment_method not in ("razorpay", "manual_activation"):
            return None

        # 2. New user + referrer
        new_user = await d.users.find_one(
            {"uid": new_user_uid},
            {"_id": 0, "uid": 1, "name": 1, "referred_by": 1},
        )
        if not new_user:
            return None
        referrer_uid = new_user.get("referred_by")
        if not referrer_uid:
            return None

        # 7. No self-referral
        if referrer_uid == new_user_uid:
            return None

        # 4. Is this new user's FIRST paid subscription?
        prior_paid = await d.vip_payments.count_documents({
            "user_id": new_user_uid,
            "status": "approved",
            "payment_method": {"$in": ["razorpay", "manual_activation"]},
        })
        # count includes the one that JUST got inserted → 1 is fine, >1 means renewal
        if prior_paid > 1:
            return None

        # 5. Idempotency: bonus already exists for this pair?
        exists = await d.referral_bonuses.find_one({
            "referrer_uid": referrer_uid,
            "new_user_uid": new_user_uid,
            "status": {"$ne": "reversed"},
        })
        if exists:
            return None

        # 6. Referrer must be a paid subscriber (not free/explorer)
        referrer = await d.users.find_one(
            {"uid": referrer_uid},
            {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1, "phone": 1,
             "subscription_plan": 1, "subscription_status": 1,
             "bank_account": 1, "bank_ifsc": 1, "bank_name": 1, "bank_holder_name": 1},
        )
        if not referrer:
            return None
        plan = (referrer.get("subscription_plan") or "explorer").lower()
        if plan in ("", "explorer", "free"):
            # Referrer is not a paid subscriber themselves — skip
            logging.info(f"[REF-BONUS] Skipped: referrer {referrer_uid} is not a paid subscriber (plan={plan})")
            return None

        # OK, create bonus
        bonus_amount = float(cam.get("bonus_amount") or DEFAULT_BONUS_AMOUNT)
        now = datetime.now(timezone.utc).isoformat()
        bonus_id = f"REFB-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

        doc = {
            "bonus_id": bonus_id,
            "campaign_id": DEFAULT_CAMPAIGN_ID,
            "campaign_snapshot": {
                "start_date": cam.get("start_date"),
                "end_date": cam.get("end_date"),
                "bonus_amount": bonus_amount,
            },
            "referrer_uid": referrer_uid,
            "referrer_name": referrer.get("name") or "",
            "referrer_mobile": referrer.get("mobile") or referrer.get("phone") or "",
            "referrer_email": referrer.get("email") or "",
            "referrer_bank_account": referrer.get("bank_account") or "",
            "referrer_bank_ifsc": referrer.get("bank_ifsc") or "",
            "referrer_bank_name": referrer.get("bank_name") or "",
            "referrer_bank_holder": referrer.get("bank_holder_name") or referrer.get("name") or "",
            "new_user_uid": new_user_uid,
            "new_user_name": new_user.get("name") or "",
            "subscription_plan": subscription_plan or "",
            "payment_method": payment_method,
            "payment_amount": float(payment_amount or 0),
            "bonus_amount": bonus_amount,
            "status": "pending",   # pending → paid → (reversed)
            "earned_at": now,
            "paid_at": None,
            "paid_by": None,
            "payout_reference": None,
            "reversal_reason": None,
        }
        await d.referral_bonuses.insert_one(doc)
        doc.pop("_id", None)
        logging.info(f"[REF-BONUS] Credited ₹{bonus_amount} to {referrer_uid} for new user {new_user_uid} ({bonus_id})")
        return doc
    except Exception as e:
        logging.warning(f"[REF-BONUS] credit_referral_bonus error (non-fatal): {e}")
        return None


# ============================================================================
# ADMIN — Campaign config
# ============================================================================

class CampaignUpdate(BaseModel):
    enabled: Optional[bool] = None
    bonus_amount: Optional[float] = Field(default=None, gt=0)
    start_date: Optional[str] = None    # YYYY-MM-DD
    end_date: Optional[str] = None      # YYYY-MM-DD
    notes: Optional[str] = None
    admin_id: str = "admin"


@router.get("/admin/referral-bonus/campaign")
async def get_campaign():
    cam = await db.referral_bonus_campaigns.find_one({"_id": DEFAULT_CAMPAIGN_ID})
    if not cam:
        now_iso = datetime.now(timezone.utc).isoformat()
        cam = {
            "_id": DEFAULT_CAMPAIGN_ID,
            "enabled": False,
            "bonus_amount": DEFAULT_BONUS_AMOUNT,
            "start_date": None,
            "end_date": None,
            "notes": "",
            "updated_at": now_iso,
            "updated_by": "system",
        }
        await db.referral_bonus_campaigns.insert_one(cam)
    cam.pop("_id", None)
    return {"campaign": cam}


@router.put("/admin/referral-bonus/campaign")
async def update_campaign(data: CampaignUpdate):
    body = {k: v for k, v in data.dict().items() if v is not None and k != "admin_id"}
    if not body:
        raise HTTPException(status_code=400, detail="No fields to update")
    # Validate dates
    for k in ("start_date", "end_date"):
        if k in body and body[k]:
            try:
                datetime.fromisoformat(body[k])
            except Exception:
                raise HTTPException(status_code=400, detail=f"{k} must be YYYY-MM-DD")
    if body.get("start_date") and body.get("end_date") and body["start_date"] > body["end_date"]:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date")
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    body["updated_by"] = data.admin_id
    await db.referral_bonus_campaigns.update_one({"_id": DEFAULT_CAMPAIGN_ID}, {"$set": body}, upsert=True)
    cam = await db.referral_bonus_campaigns.find_one({"_id": DEFAULT_CAMPAIGN_ID})
    cam.pop("_id", None)
    return {"success": True, "campaign": cam}


# ============================================================================
# ADMIN — Report
# ============================================================================

def _build_report_query(from_date: Optional[str], to_date: Optional[str],
                        status: Optional[str], referrer_uid: Optional[str]) -> dict:
    q: dict = {}
    date_q = {}
    if from_date:
        date_q["$gte"] = from_date
    if to_date:
        date_q["$lte"] = to_date + "T23:59:59"
    if date_q:
        q["earned_at"] = date_q
    if status and status != "all":
        q["status"] = status
    if referrer_uid:
        q["referrer_uid"] = referrer_uid
    return q


@router.get("/admin/referral-bonus/report")
async def report(from_date: Optional[str] = None, to_date: Optional[str] = None,
                 status: Optional[str] = None, referrer_uid: Optional[str] = None,
                 limit: int = 5000):
    q = _build_report_query(from_date, to_date, status, referrer_uid)
    rows = await db.referral_bonuses.find(q, {"_id": 0}).sort("earned_at", -1).to_list(limit)
    total_pending = sum(r["bonus_amount"] for r in rows if r["status"] == "pending")
    total_paid = sum(r["bonus_amount"] for r in rows if r["status"] == "paid")
    total_reversed = sum(r["bonus_amount"] for r in rows if r["status"] == "reversed")
    return {
        "rows": rows,
        "total_count": len(rows),
        "totals": {
            "pending": round(total_pending, 2),
            "paid": round(total_paid, 2),
            "reversed": round(total_reversed, 2),
            "grand_total": round(total_pending + total_paid, 2),
        },
    }


@router.get("/admin/referral-bonus/report/csv")
async def report_csv(from_date: Optional[str] = None, to_date: Optional[str] = None,
                     status: Optional[str] = None, referrer_uid: Optional[str] = None):
    q = _build_report_query(from_date, to_date, status, referrer_uid)
    rows = await db.referral_bonuses.find(q, {"_id": 0}).sort("earned_at", -1).to_list(20000)

    headers = [
        "Date", "Bonus ID", "Referrer Name", "Mobile", "Email",
        "New User Activated", "New User UID",
        "Subscription Plan", "Payment Method", "Payment Amount",
        "Bonus Amount", "Status",
        "Bank Account", "IFSC", "Bank Name", "Account Holder",
        "Payout Reference", "Paid At", "Paid By",
    ]
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    for r in rows:
        w.writerow([
            (r.get("earned_at") or "")[:10],
            r.get("bonus_id", ""),
            r.get("referrer_name", ""),
            r.get("referrer_mobile", ""),
            r.get("referrer_email", ""),
            r.get("new_user_name", ""),
            r.get("new_user_uid", ""),
            r.get("subscription_plan", ""),
            r.get("payment_method", ""),
            r.get("payment_amount", 0),
            r.get("bonus_amount", 0),
            r.get("status", ""),
            r.get("referrer_bank_account", ""),
            r.get("referrer_bank_ifsc", ""),
            r.get("referrer_bank_name", ""),
            r.get("referrer_bank_holder", ""),
            r.get("payout_reference") or "",
            (r.get("paid_at") or "")[:19],
            r.get("paid_by") or "",
        ])
    buf.seek(0)
    fname = f"referral_bonus_{from_date or 'all'}_{to_date or 'all'}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get("/admin/referral-bonus/summary")
async def summary():
    """Overall totals + top referrers for dashboard."""
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "amount": {"$sum": "$bonus_amount"},
        }},
    ]
    agg = await db.referral_bonuses.aggregate(pipeline).to_list(10)
    by_status = {}
    total_all = 0.0
    for a in agg:
        by_status[a["_id"]] = {"count": a["count"], "amount": round(a["amount"], 2)}
        total_all += a["amount"]

    # Top 10 referrers
    top_pipe = [
        {"$match": {"status": {"$in": ["pending", "paid"]}}},
        {"$group": {
            "_id": "$referrer_uid",
            "referrer_name": {"$first": "$referrer_name"},
            "referrer_email": {"$first": "$referrer_email"},
            "total_bonus": {"$sum": "$bonus_amount"},
            "activations": {"$sum": 1},
        }},
        {"$sort": {"total_bonus": -1}},
        {"$limit": 10},
    ]
    top = await db.referral_bonuses.aggregate(top_pipe).to_list(10)
    for t in top:
        t["referrer_uid"] = t.pop("_id")
    return {
        "by_status": by_status,
        "total_all": round(total_all, 2),
        "top_referrers": top,
    }


class MarkPaidRequest(BaseModel):
    bonus_ids: List[str]
    payout_reference: str = ""
    admin_id: str = "admin"


async def _fire_paid_side_effects(bonus: dict, payout_reference: str, admin_id: str):
    """After a bonus is marked paid, create user-facing artefacts:
    1. Bank Redeem ledger entry (bank_transfer_requests) — shows in user's Bank Redeem
       history AND rolls up into Total Rewards Redeemed.
    2. Transactions statement row.
    3. In-app notification greeting.
    4. Community forum success story post (via community helper).
    Fire-and-forget: errors logged, never raised."""
    d = db
    now_iso = datetime.now(timezone.utc).isoformat()
    referrer_uid = bonus["referrer_uid"]
    amount_inr = float(bonus["bonus_amount"])
    request_id = f"REFB-PAY-{bonus['bonus_id']}"

    # 1) Bank redeem ledger entry
    try:
        bank_doc = {
            "request_id": request_id,
            "user_id": referrer_uid,
            "user_name": bonus.get("referrer_name") or "",
            "user_mobile": bonus.get("referrer_mobile") or "",
            "amount_inr": amount_inr,
            "total_inr": amount_inr,
            "withdrawal_amount": amount_inr,
            "total_prc_deducted": 0,
            "admin_fee_inr": 0,
            "transaction_fee_inr": 0,
            "bank_details": {
                "account_number": bonus.get("referrer_bank_account") or "",
                "ifsc_code": bonus.get("referrer_bank_ifsc") or "",
                "bank_name": bonus.get("referrer_bank_name") or "",
                "account_holder_name": bonus.get("referrer_bank_holder") or "",
            },
            "status": "paid",
            "utr_number": payout_reference,
            "admin_remark": f"₹{int(amount_inr)} Referral Bonus payout ({bonus['bonus_id']})",
            "processed_by": admin_id,
            "processed_at": now_iso,
            "created_at": now_iso,
            "updated_at": now_iso,
            "channel": "referral_bonus_payout",
            "is_referral_bonus": True,
            "ref_bonus_id": bonus["bonus_id"],
        }
        # Idempotent: skip if already inserted for this bonus
        exists = await d.bank_transfer_requests.find_one({"request_id": request_id})
        if not exists:
            await d.bank_transfer_requests.insert_one(bank_doc)
    except Exception as e:
        logging.warning(f"[REF-BONUS-PAID] bank_transfer_requests insert failed: {e}")

    # 2) Transactions statement row
    try:
        await d.transactions.insert_one({
            "user_id": referrer_uid,
            "type": "referral_bonus_payout",
            "amount_prc": 0,
            "amount_inr": amount_inr,   # POSITIVE — this is a payout INTO their bank
            "description": f"₹{int(amount_inr)} Referral Bonus — {bonus.get('new_user_name') or 'new user'}",
            "ref_id": request_id,
            "created_at": now_iso,
            "metadata": {
                "bonus_id": bonus["bonus_id"],
                "payout_reference": payout_reference,
                "admin_id": admin_id,
                "new_user_uid": bonus.get("new_user_uid"),
            },
        })
    except Exception as e:
        logging.warning(f"[REF-BONUS-PAID] transactions insert failed: {e}")

    # 3) Greeting notification
    try:
        from routes.notifications import create_notification
        title = "🎉 ₹{:g} Referral Bonus Received!".format(amount_inr)
        message = (
            f"Congratulations! Your ₹{int(amount_inr)} referral bonus for bringing "
            f"{bonus.get('new_user_name') or 'a new subscriber'} on board has been "
            f"transferred to your bank account."
            + (f"\nUTR: {payout_reference}" if payout_reference else "")
        )
        await create_notification(
            user_id=referrer_uid,
            notification_type="mining_referral_reward",
            title=title,
            message=message,
            data={
                "bonus_id": bonus["bonus_id"],
                "amount_inr": amount_inr,
                "payout_reference": payout_reference,
                "action_link": "/my-referral-bonus",
            },
        )
    except Exception as e:
        logging.warning(f"[REF-BONUS-PAID] notification create failed: {e}")

    # 4) Community success story post
    try:
        # Late import — helper reads db from server.py's globals
        from routes.community import create_success_story_post
        await create_success_story_post(
            user_id=referrer_uid,
            service_type="bank_redeem",
            amount_inr=amount_inr,
            extra_title="Referral Bonus",
            ref_id=f"referral_bonus:{bonus['bonus_id']}",
        )
    except Exception as e:
        logging.warning(f"[REF-BONUS-PAID] community post hook failed: {e}")


@router.post("/admin/referral-bonus/mark-paid")
async def mark_paid(data: MarkPaidRequest):
    if not data.bonus_ids:
        raise HTTPException(status_code=400, detail="bonus_ids empty")
    now = datetime.now(timezone.utc).isoformat()

    # Fetch the pending bonuses BEFORE update (need bank details for side-effects)
    pending_rows = await db.referral_bonuses.find(
        {"bonus_id": {"$in": data.bonus_ids}, "status": "pending"},
        {"_id": 0},
    ).to_list(len(data.bonus_ids))

    r = await db.referral_bonuses.update_many(
        {"bonus_id": {"$in": data.bonus_ids}, "status": "pending"},
        {"$set": {
            "status": "paid",
            "paid_at": now,
            "paid_by": data.admin_id,
            "payout_reference": data.payout_reference,
        }},
    )

    # Fire user-facing side effects for each newly-paid bonus (fire-and-forget)
    for bonus in pending_rows:
        await _fire_paid_side_effects(bonus, data.payout_reference, data.admin_id)

    return {"success": True, "marked_paid": r.modified_count, "requested": len(data.bonus_ids)}


# ============================================================================
# ADMIN — BACKFILL for retroactively crediting bonuses on already-activated users
# ============================================================================

class BackfillRequest(BaseModel):
    from_date: Optional[str] = None    # YYYY-MM-DD — inclusive
    to_date: Optional[str] = None      # YYYY-MM-DD — inclusive
    dry_run: bool = True
    admin_id: str = "admin"


@router.post("/admin/referral-bonus/backfill")
async def backfill_missing_bonuses(data: BackfillRequest):
    """Scan all approved vip_payments in [from_date, to_date] and retroactively
    credit referral bonuses for any that qualify but were missed.

    Useful when:
      - The referral_bonus hook was added AFTER some payments already happened
      - Payments were activated via a code path that didn't have the hook
      - Manual sync from Razorpay bulk-activated users

    All the safety guards from credit_referral_bonus still apply — first paid
    subscription only, referrer must exist + be paid + not self, campaign active
    at the earned_at time, idempotency guaranteed.

    Set dry_run=True to preview what WOULD be credited without mutating.
    """
    q = {"status": "approved", "payment_method": {"$in": ["razorpay", "manual_activation"]}}
    if data.from_date:
        q["$or"] = [
            {"created_at": {"$gte": data.from_date}},
            {"approved_at": {"$gte": data.from_date}},
        ]
    if data.to_date:
        to_ceiling = data.to_date + "T23:59:59"
        for or_clause in q.get("$or", []):
            for k, v in or_clause.items():
                if isinstance(v, dict):
                    v["$lte"] = to_ceiling

    payments = await db.vip_payments.find(q, {"_id": 0}).sort("created_at", 1).to_list(50000)

    credited = []
    skipped = []
    for p in payments:
        uid = p.get("user_id")
        if not uid:
            continue
        # First paid subscription check — before this payment, how many approved paid ones existed?
        earlier_count = await db.vip_payments.count_documents({
            "user_id": uid,
            "status": "approved",
            "payment_method": {"$in": ["razorpay", "manual_activation"]},
            "created_at": {"$lt": p.get("created_at") or p.get("approved_at") or ""},
        })
        if earlier_count > 0:
            skipped.append({"user_id": uid, "reason": "not first paid subscription (renewal)", "order_id": p.get("order_id")})
            continue

        # Duplicate bonus check
        existing_bonus = await db.referral_bonuses.find_one({
            "new_user_uid": uid, "status": {"$ne": "reversed"},
        })
        if existing_bonus:
            skipped.append({"user_id": uid, "reason": "bonus already exists", "bonus_id": existing_bonus["bonus_id"]})
            continue

        if data.dry_run:
            # Simulate — check whether it WOULD credit
            user = await db.users.find_one({"uid": uid}, {"_id": 0, "referred_by": 1, "name": 1})
            if not user:
                skipped.append({"user_id": uid, "reason": "user not found"})
                continue
            ref_uid = user.get("referred_by")
            if not ref_uid:
                skipped.append({"user_id": uid, "name": user.get("name"), "reason": "no referrer (referred_by missing)"})
                continue
            if ref_uid == uid:
                skipped.append({"user_id": uid, "reason": "self-referral"})
                continue
            ref = await db.users.find_one({"uid": ref_uid}, {"_id": 0, "name": 1, "subscription_plan": 1})
            if not ref:
                skipped.append({"user_id": uid, "reason": "referrer not found"})
                continue
            ref_plan = (ref.get("subscription_plan") or "explorer").lower()
            if ref_plan in ("", "explorer", "free"):
                skipped.append({"user_id": uid, "reason": f"referrer is on free plan ({ref_plan})", "referrer_name": ref.get("name")})
                continue
            credited.append({
                "user_id": uid, "name": user.get("name"),
                "referrer_uid": ref_uid, "referrer_name": ref.get("name"),
                "order_id": p.get("order_id"),
            })
        else:
            # Real credit — use the helper (which re-runs all guards)
            result = await credit_referral_bonus(
                database=db,
                new_user_uid=uid,
                payment_method=p.get("payment_method") or "razorpay",
                payment_amount=float(p.get("amount") or 0),
                subscription_plan=p.get("subscription_plan") or "",
            )
            if result:
                credited.append({
                    "user_id": uid, "bonus_id": result["bonus_id"],
                    "referrer_name": result["referrer_name"],
                    "amount": result["bonus_amount"],
                })
            else:
                skipped.append({"user_id": uid, "reason": "helper returned None (see logs)", "order_id": p.get("order_id")})

    return {
        "success": True,
        "dry_run": data.dry_run,
        "scanned": len(payments),
        "would_credit" if data.dry_run else "credited": len(credited),
        "skipped": len(skipped),
        "credited_list": credited[:200],
        "skipped_list": skipped[:200],
    }


# ============================================================================
# ADMIN — Diagnose why a user did NOT get their referral bonus
# ============================================================================

@router.get("/admin/referral-bonus/diagnose/{new_user_id_or_email}")
async def diagnose(new_user_id_or_email: str):
    """Explain why a specific user did / did not get a referral bonus.
    Accepts either a UID or an email address."""
    key = new_user_id_or_email.strip()
    user = None
    if "@" in key:
        user = await db.users.find_one({"email": key}, {"_id": 0, "password_hash": 0})
    else:
        user = await db.users.find_one({"uid": key}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail=f"User not found for '{key}'")

    uid = user["uid"]
    reasons = []
    would_credit = True
    referrer = None

    # 1. Campaign active?
    cam = await db.referral_bonus_campaigns.find_one({"_id": DEFAULT_CAMPAIGN_ID})
    if not cam or not cam.get("enabled"):
        reasons.append("Campaign is DISABLED")
        would_credit = False

    # 2. Referrer set?
    ref_uid = user.get("referred_by")
    if not ref_uid:
        reasons.append("User has NO `referred_by` field — didn't use a referral code at signup")
        would_credit = False
    elif ref_uid == uid:
        reasons.append("SELF-REFERRAL (referred_by == uid)")
        would_credit = False
    else:
        referrer = await db.users.find_one({"uid": ref_uid}, {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1, "subscription_plan": 1, "bank_account": 1, "bank_ifsc": 1})
        if not referrer:
            reasons.append(f"Referrer UID `{ref_uid}` NOT FOUND in users collection")
            would_credit = False
        else:
            plan = (referrer.get("subscription_plan") or "explorer").lower()
            if plan in ("", "explorer", "free"):
                reasons.append(f"Referrer '{referrer.get('name')}' is on FREE plan ({plan}) — needs to be a paid subscriber")
                would_credit = False
            if not referrer.get("bank_account") or not referrer.get("bank_ifsc"):
                reasons.append(f"⚠️ Referrer has NO bank details on file (payout will need manual collection)")

    # 3. Paid subscription history
    payments = await db.vip_payments.find(
        {"user_id": uid, "status": "approved", "payment_method": {"$in": ["razorpay", "manual_activation"]}},
        {"_id": 0, "order_id": 1, "created_at": 1, "activation_source": 1, "payment_method": 1, "amount": 1, "subscription_plan": 1},
    ).sort("created_at", 1).to_list(50)
    paid_count = len(payments)
    if paid_count == 0:
        reasons.append("User has NO approved paid subscription (only PRC or none)")
        would_credit = False
    elif paid_count > 1:
        reasons.append(f"User has {paid_count} paid subscriptions — the referral bonus only applies to the FIRST one. Subsequent ones are RENEWALS")
    # 4. Existing bonus?
    existing_bonus = await db.referral_bonuses.find_one({"new_user_uid": uid}, {"_id": 0})

    return {
        "user": {
            "uid": uid, "name": user.get("name"), "email": user.get("email"),
            "mobile": user.get("mobile") or user.get("phone"),
            "referred_by": ref_uid,
            "subscription_plan": user.get("subscription_plan"),
        },
        "referrer": referrer,
        "paid_subscriptions": payments,
        "existing_bonus": existing_bonus,
        "campaign": {"enabled": cam.get("enabled") if cam else False, "range": [cam.get("start_date"), cam.get("end_date")] if cam else None},
        "would_credit_now": would_credit and not existing_bonus,
        "reasons": reasons if reasons else ["All conditions met — bonus SHOULD have been credited"],
    }


class ReverseRequest(BaseModel):
    reason: str
    admin_id: str = "admin"


@router.post("/admin/referral-bonus/reverse/{bonus_id}")
async def reverse_bonus(bonus_id: str, data: ReverseRequest):
    row = await db.referral_bonuses.find_one({"bonus_id": bonus_id})
    if not row:
        raise HTTPException(status_code=404, detail="Bonus not found")
    if row["status"] == "reversed":
        raise HTTPException(status_code=400, detail="Already reversed")
    now = datetime.now(timezone.utc).isoformat()
    await db.referral_bonuses.update_one(
        {"bonus_id": bonus_id},
        {"$set": {"status": "reversed", "reversal_reason": data.reason,
                  "reversed_at": now, "reversed_by": data.admin_id}},
    )
    return {"success": True}


# ============================================================================
# USER — my bonuses + bank details
# ============================================================================

@router.get("/referral-bonus/my/{uid}")
async def my_bonuses(uid: str):
    rows = await db.referral_bonuses.find(
        {"referrer_uid": uid},
        {"_id": 0, "referrer_bank_account": 0, "referrer_bank_ifsc": 0,
         "referrer_bank_name": 0, "referrer_bank_holder": 0,
         "campaign_snapshot": 0},
    ).sort("earned_at", -1).to_list(500)
    totals = {"pending": 0.0, "paid": 0.0, "reversed": 0.0}
    for r in rows:
        totals[r["status"]] = totals.get(r["status"], 0) + r["bonus_amount"]

    # Check if user has bank details for claim popup
    user = await db.users.find_one(
        {"uid": uid},
        {"_id": 0, "bank_account": 1, "bank_ifsc": 1, "bank_name": 1, "bank_holder_name": 1},
    ) or {}
    has_bank = bool(user.get("bank_account") and user.get("bank_ifsc"))

    return {
        "bonuses": rows,
        "totals": {k: round(v, 2) for k, v in totals.items()},
        "has_bank_details": has_bank,
        "needs_bank_details": (not has_bank) and (totals["pending"] > 0 or totals["paid"] > 0),
    }


class BankDetails(BaseModel):
    account_number: str = Field(min_length=6, max_length=20)
    ifsc: str = Field(min_length=8, max_length=15)
    bank_name: str = Field(min_length=2, max_length=80)
    account_holder_name: str = Field(min_length=2, max_length=80)


@router.post("/referral-bonus/bank-details/{uid}")
async def save_bank_details(uid: str, data: BankDetails):
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "uid": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"uid": uid},
        {"$set": {
            "bank_account": data.account_number.strip(),
            "bank_ifsc": data.ifsc.strip().upper(),
            "bank_name": data.bank_name.strip(),
            "bank_holder_name": data.account_holder_name.strip(),
            "bank_updated_at": now,
        }},
    )
    # Also backfill any pending bonuses for this referrer with the new bank snapshot
    await db.referral_bonuses.update_many(
        {"referrer_uid": uid, "status": "pending"},
        {"$set": {
            "referrer_bank_account": data.account_number.strip(),
            "referrer_bank_ifsc": data.ifsc.strip().upper(),
            "referrer_bank_name": data.bank_name.strip(),
            "referrer_bank_holder": data.account_holder_name.strip(),
        }},
    )
    return {"success": True, "message": "Bank details saved"}


@router.get("/referral-bonus/bank-details/{uid}")
async def get_bank_details(uid: str):
    user = await db.users.find_one(
        {"uid": uid},
        {"_id": 0, "bank_account": 1, "bank_ifsc": 1, "bank_name": 1, "bank_holder_name": 1},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "account_number": user.get("bank_account") or "",
        "ifsc": user.get("bank_ifsc") or "",
        "bank_name": user.get("bank_name") or "",
        "account_holder_name": user.get("bank_holder_name") or "",
        "has_details": bool(user.get("bank_account") and user.get("bank_ifsc")),
    }
