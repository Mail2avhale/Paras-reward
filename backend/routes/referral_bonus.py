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


@router.post("/admin/referral-bonus/mark-paid")
async def mark_paid(data: MarkPaidRequest):
    if not data.bonus_ids:
        raise HTTPException(status_code=400, detail="bonus_ids empty")
    now = datetime.now(timezone.utc).isoformat()
    r = await db.referral_bonuses.update_many(
        {"bonus_id": {"$in": data.bonus_ids}, "status": "pending"},
        {"$set": {
            "status": "paid",
            "paid_at": now,
            "paid_by": data.admin_id,
            "payout_reference": data.payout_reference,
        }},
    )
    return {"success": True, "marked_paid": r.modified_count, "requested": len(data.bonus_ids)}


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
