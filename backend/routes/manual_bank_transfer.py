"""
PARAS REWARD - Manual Bank Transfer Redeem System
=================================================
Complete fintech-style redeem system where users convert PRC to INR bank transfer.
Admin manually processes transfers and marks requests as PAID/FAILED.

PRC Conversion: 1 INR = 10 PRC
Fee Structure:
  - Transaction Fee: ₹10 flat
  - Admin Fee: 20% of withdrawal amount
  
Limits:
  - Minimum: ₹1,000
  - Maximum: ₹10,000
"""

import logging
import re
import uuid
import httpx
import asyncio
import time as _time
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, validator
import os
# Canonical helper — read user expiry through this only.
from utils.subscription_expiry import get_user_expiry

# 30 s in-process cache for /admin/requests — list endpoint expensive due to
# per-user redeem-limit enrichment.
_BANK_REQUESTS_CACHE: dict = {}
_BANK_REQUESTS_TTL = 30.0
_BANK_REQUESTS_MAX = 50  # bounded; admin uses ~handful of filter combos


def _bank_requests_cache_get(key):
    e = _BANK_REQUESTS_CACHE.get(key)
    if e and (_time.monotonic() - e["ts"]) < _BANK_REQUESTS_TTL:
        return e["data"]
    if e:
        _BANK_REQUESTS_CACHE.pop(key, None)
    return None


def _bank_requests_cache_set(key, data):
    if len(_BANK_REQUESTS_CACHE) >= _BANK_REQUESTS_MAX:
        items = sorted(_BANK_REQUESTS_CACHE.items(), key=lambda kv: kv[1]["ts"])
        for k, _ in items[: _BANK_REQUESTS_MAX // 4]:
            _BANK_REQUESTS_CACHE.pop(k, None)
    _BANK_REQUESTS_CACHE[key] = {"data": data, "ts": _time.monotonic()}

from routes.idempotency import (
    check_and_claim_idempotency_key,
    store_idempotency_response,
    release_idempotency_key,
)

router = APIRouter(prefix="/bank-transfer", tags=["Bank Transfer"])

# Database reference (set by server.py)
db = None

# Global redeem limit check function (set by server.py)
check_redeem_limit_func = None

# Subscription-stake INR cap check (set by server.py) — NEW Jun 2026
# Sole gate for Bank/Recharge/Utility/EMI (replaces old PRC cap per user spec 2b)
check_subscription_cap_func = None

# Weekly one service limit check function (set by server.py)
check_weekly_one_service_func = None

# Full redeem limit calculator (set by server.py)
calculate_redeem_limit_func = None

# All-time total redeemed PRC (across ALL services) func (set by server.py)
get_all_time_redeemed_func = None

# Dynamic PRC rate getter async (set by server.py) — returns current PRC per INR (e.g. 10)
get_prc_rate_func = None

def set_db(database):
    global db
    db = database

def set_redeem_limit_check(func):
    global check_redeem_limit_func
    check_redeem_limit_func = func


def set_subscription_cap_check(func):
    """Subscription-stake-based INR cap (new Jun 2026)."""
    global check_subscription_cap_func
    check_subscription_cap_func = func

def set_weekly_one_service_check(func):
    global check_weekly_one_service_func
    check_weekly_one_service_func = func

def set_calculate_redeem_limit(func):
    global calculate_redeem_limit_func
    calculate_redeem_limit_func = func

def set_all_time_redeemed(func):
    global get_all_time_redeemed_func
    get_all_time_redeemed_func = func

def set_prc_rate_getter(func):
    global get_prc_rate_func
    get_prc_rate_func = func

# ==================== CONSTANTS ====================

TRANSACTION_FEE = 10  # ₹10 flat fee
ADMIN_FEE_PERCENT = 20  # 20% admin fee
MIN_WITHDRAWAL_BASE = 100  # ₹100 base minimum (May 2026 — was ₹1,000 flat)
MIN_WITHDRAWAL = MIN_WITHDRAWAL_BASE  # legacy alias used elsewhere in code
MAX_WITHDRAWAL = 10000  # ₹10,000 maximum (per-request hard cap)
PROGRESSIVE_MULTIPLIER = 1.5  # Each approved redeem raises next min by 1.5×

# ── Bank Redeem Lifetime Cap (Feb 2026) ───────────────────────────────────
# Users may only redeem amounts from a fixed allow-list, and their LIFETIME
# total (sum of approved/paid amounts, excluding fees) is hard-capped at
# ₹2,500. Once a user crosses the cap their bank-redeem option is
# permanently disabled (admin can override via /admin/bank-redeem/unblock).
ALLOWED_REDEEM_AMOUNTS = [100, 200, 400, 800, 1000]
LIFETIME_BANK_REDEEM_CAP_INR = 2500
# Statuses that count towards the lifetime quota. Pending / failed /
# rejected do NOT count — the user only "spends" quota when money actually
# leaves the company account.
QUOTA_COUNTING_STATUSES = ["approved", "paid", "completed"]


async def compute_progressive_min_withdrawal(user_id: str) -> dict:
    """Compute the user's CURRENT minimum withdrawal floor.

    Rules (May 2026):
      • Brand-new user (0 approved redeems): minimum = ₹100 (BASE).
      • Going forward: each approved redeem of amount X raises the next
        min to ceil(X × 1.5). Stored on user as `next_min_withdrawal_inr`.
      • Legacy/old users (no stored field, but have prior approved
        redeems): min = max(BASE, ceil(lifetime_total_approved × 1.5)).
      • Cap: none (compounds indefinitely).

    Returns: {
        "minimum": int,                  # current floor in INR
        "next_minimum_preview": int|None,# what min becomes if they submit `minimum`
        "basis": "base" | "stored" | "legacy_total",
        "total_approved_count": int,
        "total_approved_amount": int,
        "last_approved_amount": int|None,
    }
    """
    import math

    user = await db.users.find_one(
        {"uid": user_id},
        {"_id": 0, "next_min_withdrawal_inr": 1}
    ) or {}
    stored = user.get("next_min_withdrawal_inr")

    # Aggregate prior approved redeems (only "approved" / "paid" statuses count)
    APPROVED_STATUSES = ["approved", "paid", "completed"]
    cursor = db.bank_transfer_requests.find(
        {"user_id": user_id, "status": {"$in": APPROVED_STATUSES}},
        {"_id": 0, "withdrawal_amount": 1, "approved_at": 1, "paid_at": 1, "created_at": 1}
    )
    docs = await cursor.to_list(20000)
    total_amount = 0
    last_amount = None
    last_when = None
    for d in docs:
        amt = int(d.get("withdrawal_amount") or 0)
        total_amount += amt
        when = d.get("paid_at") or d.get("approved_at") or d.get("created_at")
        if when and (last_when is None or str(when) > str(last_when)):
            last_when = when
            last_amount = amt

    count = len(docs)
    if stored is not None:
        minimum = max(MIN_WITHDRAWAL_BASE, int(stored))
        basis = "stored"
    elif count == 0:
        minimum = MIN_WITHDRAWAL_BASE
        basis = "base"
    else:
        # Legacy / pre-feature user — bootstrap from lifetime total
        minimum = max(MIN_WITHDRAWAL_BASE, int(math.ceil(total_amount * PROGRESSIVE_MULTIPLIER)))
        basis = "legacy_total"

    next_preview = max(MIN_WITHDRAWAL_BASE, int(math.ceil(minimum * PROGRESSIVE_MULTIPLIER)))

    # Effective per-user MAX must always be >= minimum (with 2× headroom)
    # else the UI shows the nonsensical "Min ₹30,000 – Max ₹10,000" state.
    effective_max = max(MAX_WITHDRAWAL, int(minimum * 2))

    return {
        "minimum": minimum,
        "maximum": effective_max,
        "next_minimum_preview": next_preview,
        "basis": basis,
        "total_approved_count": count,
        "total_approved_amount": total_amount,
        "last_approved_amount": last_amount,
    }


async def compute_lifetime_redeem_quota(user_id: str) -> dict:
    """Compute a user's bank-redeem lifetime quota status.

    Feb 2026 update: the ₹2,500 lifetime cap now covers ALL PRC-funded
    user benefits, not just bank-redeem requests. The total spent across
    the following categories counts towards the cap:

      • Recharges (mobile / DTH)        → bill_payment_requests
      • Utility bills (BBPS)            → bill_payment_requests
      • Bank withdrawals (legacy)       → bank_withdrawal_requests
      • Bank redeems (new flow)         → bank_transfer_requests

    EXPLICITLY EXCLUDED:
      • Subscription payments — these are platform service fees, not
        user-receivable benefits.

    Returns 8 fields the frontend renders directly.
    """
    user = await db.users.find_one(
        {"uid": user_id},
        {"_id": 0, "bank_redeem_blocked": 1, "bank_redeem_blocked_reason": 1}
    ) or {}

    admin_blocked = bool(user.get("bank_redeem_blocked"))

    # Status values that indicate the money actually left the company
    # (or PRC was actually consumed). Pending / failed / rejected do NOT
    # count — user gets a chance to retry without burning quota.
    BENEFIT_OK_STATUSES = [
        "approved", "paid", "completed", "success",
        "delivered", "SUCCESS", "COMPLETED", "PAID",
    ]

    # ── 1. Bank Transfer Requests (new flow) ────────────────────────────
    bank_transfer_amount = 0
    cursor = db.bank_transfer_requests.find(
        {"user_id": user_id, "status": {"$in": BENEFIT_OK_STATUSES}},
        {"_id": 0, "withdrawal_amount": 1, "amount_inr": 1, "amount": 1}
    )
    for d in await cursor.to_list(20000):
        bank_transfer_amount += int(
            d.get("withdrawal_amount") or d.get("amount_inr") or d.get("amount") or 0
        )

    # ── 2. Bank Withdrawal Requests (legacy bank_redeem flow) ──────────
    bank_withdrawal_amount = 0
    cursor = db.bank_withdrawal_requests.find(
        {"user_id": user_id, "status": {"$in": BENEFIT_OK_STATUSES}},
        {"_id": 0, "amount_inr": 1, "amount": 1, "withdrawal_amount": 1,
         "amount_requested": 1, "inr_amount": 1}
    )
    for d in await cursor.to_list(20000):
        bank_withdrawal_amount += int(
            d.get("amount_inr") or d.get("amount") or d.get("withdrawal_amount")
            or d.get("amount_requested") or d.get("inr_amount") or 0
        )

    # ── 3. Bill Payments (recharges + utility BBPS) ────────────────────
    # Excludes subscription — subscription_payments live in a separate
    # collection and never reach bill_payment_requests.
    bill_payment_amount = 0
    cursor = db.bill_payment_requests.find(
        {
            "user_id": user_id,
            "status": {"$in": BENEFIT_OK_STATUSES},
            "category": {"$ne": "subscription"},  # belt-and-braces; usually unset
        },
        {"_id": 0, "amount": 1, "amount_inr": 1, "inr_amount": 1, "recharge_amount": 1}
    )
    for d in await cursor.to_list(20000):
        bill_payment_amount += int(
            d.get("amount") or d.get("amount_inr") or d.get("inr_amount")
            or d.get("recharge_amount") or 0
        )

    total_benefits_inr = bank_transfer_amount + bank_withdrawal_amount + bill_payment_amount
    remaining = max(0, LIFETIME_BANK_REDEEM_CAP_INR - total_benefits_inr)

    cap_reached = total_benefits_inr >= LIFETIME_BANK_REDEEM_CAP_INR
    is_blocked = admin_blocked or cap_reached

    if admin_blocked:
        block_reason = user.get("bank_redeem_blocked_reason") or "Bank redeem option disabled by admin."
    elif cap_reached:
        block_reason = (
            f"Lifetime benefits cap of ₹{LIFETIME_BANK_REDEEM_CAP_INR:,} reached "
            f"(₹{total_benefits_inr:,} used across recharges, bills and bank redeems). "
            "Contact support if you have queries."
        )
    else:
        block_reason = None

    enabled_amounts = (
        [] if is_blocked
        else [a for a in ALLOWED_REDEEM_AMOUNTS if a <= remaining]
    )

    return {
        # Legacy key kept so existing frontend continues to render
        "lifetime_redeemed_inr": total_benefits_inr,
        "lifetime_cap_inr": LIFETIME_BANK_REDEEM_CAP_INR,
        "remaining_quota_inr": remaining,
        "is_blocked": is_blocked,
        "allowed_amounts": ALLOWED_REDEEM_AMOUNTS,
        "enabled_amounts": enabled_amounts,
        "block_reason": block_reason,
        # Per-category breakdown for transparency / support escalations
        "breakdown": {
            "bank_redeems_inr": bank_transfer_amount + bank_withdrawal_amount,
            "recharges_and_bills_inr": bill_payment_amount,
            "subscription_inr_excluded": True,
        },
    }


# Eko API for IFSC verification
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "")

# Dynamic PRC Rate helper
async def get_dynamic_prc_rate():
    """Get PRC rate - delegates to single source of truth."""
    from utils.helpers import get_prc_rate
    return await get_prc_rate(db)

# ==================== MODELS ====================

class BankDetails(BaseModel):
    account_holder_name: str = Field(..., min_length=3, max_length=100)
    account_number: str = Field(..., min_length=9, max_length=18)
    ifsc_code: str = Field(..., min_length=11, max_length=11)
    
    @validator('ifsc_code')
    def validate_ifsc(cls, v):
        v = v.upper().strip()
        if not re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', v):
            raise ValueError('Invalid IFSC format. Must be: 4 letters + 0 + 6 alphanumeric (e.g., HDFC0001234)')
        return v
    
    @validator('account_number')
    def validate_account(cls, v):
        v = v.strip()
        if not v.isdigit():
            raise ValueError('Account number must contain only digits')
        return v

class RedeemRequest(BaseModel):
    user_id: str
    # ge=MIN_WITHDRAWAL_BASE (100). The PROGRESSIVE minimum per user is
    # enforced inside the route handler via compute_progressive_min_withdrawal().
    amount: int = Field(..., ge=MIN_WITHDRAWAL_BASE, le=MAX_WITHDRAWAL)
    bank_details: BankDetails
    client_request_id: Optional[str] = None  # Idempotency key (optional for backward compat)

class AdminActionRequest(BaseModel):
    request_id: str
    admin_id: str
    remark: Optional[str] = None
    utr_number: Optional[str] = None  # For paid requests

class EditAmountRequest(BaseModel):
    request_id: str
    admin_id: str
    new_amount: int = Field(..., ge=1)

# ==================== HELPER FUNCTIONS ====================

async def calculate_fees(amount: int) -> dict:
    """Calculate all fees for a withdrawal amount with dynamic PRC rate."""
    prc_rate = await get_dynamic_prc_rate()
    admin_fee = int(amount * ADMIN_FEE_PERCENT / 100)
    total_inr = amount + admin_fee + TRANSACTION_FEE
    total_prc = total_inr * prc_rate
    
    return {
        "withdrawal_amount": amount,
        "admin_fee": admin_fee,
        "admin_fee_percent": ADMIN_FEE_PERCENT,
        "transaction_fee": TRANSACTION_FEE,
        "total_inr": total_inr,
        "total_prc": total_prc,
        "prc_rate": prc_rate,
        "user_receives": amount  # What user actually gets in bank
    }

async def verify_ifsc_eko(ifsc: str) -> dict:
    """Verify IFSC code using Eko API and get bank details."""
    try:
        # First try Eko API
        if EKO_DEVELOPER_KEY and EKO_INITIATOR_ID:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {
                    "developer_key": EKO_DEVELOPER_KEY,
                    "Content-Type": "application/json"
                }
                
                response = await client.get(
                    f"{EKO_BASE_URL}/v1/banks/ifsc/{ifsc}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == 0 or data.get("response_status_id") == 0:
                        bank_data = data.get("data", {})
                        return {
                            "valid": True,
                            "bank_name": bank_data.get("bank", bank_data.get("bank_name", "")),
                            "branch": bank_data.get("branch", ""),
                            "city": bank_data.get("city", ""),
                            "state": bank_data.get("state", ""),
                            "source": "eko"
                        }
        
        # Fallback: Extract bank name from IFSC prefix
        bank_codes = {
            "HDFC": "HDFC Bank",
            "ICIC": "ICICI Bank",
            "SBIN": "State Bank of India",
            "UTIB": "Axis Bank",
            "KKBK": "Kotak Mahindra Bank",
            "PUNB": "Punjab National Bank",
            "CNRB": "Canara Bank",
            "UBIN": "Union Bank of India",
            "IOBA": "Indian Overseas Bank",
            "BARB": "Bank of Baroda",
            "BKID": "Bank of India",
            "IDIB": "Indian Bank",
            "MAHB": "Bank of Maharashtra",
            "CBIN": "Central Bank of India",
            "YESB": "Yes Bank",
            "FDRL": "Federal Bank",
            "INDB": "IndusInd Bank",
            "RATN": "RBL Bank",
            "KARB": "Karnataka Bank",
            "SRCB": "Saraswat Bank",
            "AUBL": "AU Small Finance Bank",
            "ESFB": "Equitas Small Finance Bank",
            "USFB": "Ujjivan Small Finance Bank",
            "PAYTM": "Paytm Payments Bank",
            "AIRP": "Airtel Payments Bank",
            "JAKA": "Jammu & Kashmir Bank",
            "SIBL": "South Indian Bank",
            "KVBL": "Karur Vysya Bank",
            "TMBL": "Tamilnad Mercantile Bank",
            "DLXB": "Dhanlaxmi Bank",
            "LAVB": "Lakshmi Vilas Bank",
            "CIUB": "City Union Bank",
            "CSBK": "Catholic Syrian Bank",
            "DCBL": "DCB Bank",
            "IDFB": "IDFC First Bank",
            "BDBL": "Bandhan Bank",
        }
        
        prefix = ifsc[:4].upper()
        bank_name = bank_codes.get(prefix, f"Bank ({prefix})")
        
        return {
            "valid": True,
            "bank_name": bank_name,
            "branch": "",
            "city": "",
            "state": "",
            "source": "ifsc_prefix"
        }
        
    except Exception as e:
        logging.error(f"IFSC verification error: {e}")
        # Return basic info on error
        return {
            "valid": True,
            "bank_name": f"Bank ({ifsc[:4]})",
            "branch": "",
            "source": "fallback"
        }

# ==================== USER APIs ====================

@router.get("/config")
async def get_config(user_id: Optional[str] = Query(None)):
    """Get redeem configuration for frontend with dynamic PRC rate.

    If `user_id` is provided, the response also includes that user's
    PROGRESSIVE minimum withdrawal floor (May 2026 feature) under the
    `progressive` key.
    """
    from utils.helpers import get_prc_rate
    prc_rate = await get_prc_rate(db)

    payload = {
        "prc_rate": prc_rate,
        "transaction_fee": TRANSACTION_FEE,
        "admin_fee_percent": ADMIN_FEE_PERCENT,
        "min_withdrawal_base": MIN_WITHDRAWAL_BASE,
        "min_withdrawal": MIN_WITHDRAWAL_BASE,  # legacy field (UI fallback)
        "max_withdrawal": MAX_WITHDRAWAL,
        "progressive_multiplier": PROGRESSIVE_MULTIPLIER,
        "cooldown_hours": 24,
        "note": f"1 INR = {prc_rate} PRC | 1 redeem per 24 hours",
    }
    if user_id:
        prog = await compute_progressive_min_withdrawal(user_id)
        payload["progressive"] = prog
        # Override min/max so legacy UI fields display the user-specific floor/ceiling.
        payload["min_withdrawal"] = prog["minimum"]
        payload["max_withdrawal"] = prog["maximum"]

        # Lifetime quota (Feb 2026 — supersedes progressive system for the
        # public bank-redeem flow; progressive kept for admin direct-redeem).
        quota = await compute_lifetime_redeem_quota(user_id)
        payload["lifetime_quota"] = quota
        payload["allowed_amounts"] = quota["allowed_amounts"]
    else:
        payload["allowed_amounts"] = ALLOWED_REDEEM_AMOUNTS
    return payload


@router.get("/lifetime-quota/{user_id}")
async def get_lifetime_quota(user_id: str):
    """Return the user's bank-redeem lifetime quota state.

    Frontend uses this to enable/disable the 5 amount chips and to render
    the "Limit reached" page when the cap is hit or admin has blocked.
    """
    return await compute_lifetime_redeem_quota(user_id)

@router.get("/calculate-fees")
async def calculate_fees_api(amount: int = Query(..., ge=MIN_WITHDRAWAL_BASE, le=MAX_WITHDRAWAL)):
    """Calculate fees for a given withdrawal amount."""
    return {
        "success": True,
        "fees": await calculate_fees(amount)
    }

@router.post("/verify-ifsc")
async def verify_ifsc(ifsc: str):
    """Verify IFSC code and get bank details."""
    ifsc = ifsc.upper().strip()
    
    # Validate format
    if not re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', ifsc):
        raise HTTPException(status_code=400, detail="Invalid IFSC format")
    
    result = await verify_ifsc_eko(ifsc)
    return {
        "success": True,
        "ifsc": ifsc,
        "bank_details": result
    }

@router.post("/request")
async def create_redeem_request(request: RedeemRequest):
    """
    Create a new bank transfer redeem request.
    
    Process:
    1. Validate bank details (IFSC)
    2. Check 24-hour cooldown
    3. Check global redeem limit
    4. Check PRC balance
    5. Calculate fees
    6. Deduct PRC
    7. Create pending request
    """
    from app.services.wallet_service_v2 import WalletServiceV2
    
    user_id = request.user_id
    client_request_id = request.client_request_id
    idem_scope = f"bank_transfer:{user_id}"

    # ==================== IDEMPOTENCY GUARD (Layer 1) ====================
    # Peek-only replay for already-completed requests. Claim happens after
    # validations to avoid locking the key on user-facing errors (KYC,
    # cooldown, balance).
    if client_request_id:
        existing = await db.idempotency_keys.find_one(
            {"scope": idem_scope, "key": client_request_id},
            {"_id": 0},
        )
        if existing and existing.get("status") == "completed":
            logging.info(f"[BANK-TRANSFER] idempotency replay {user_id} / {client_request_id[:8]}")
            cached_response = existing.get("response")
            if isinstance(cached_response, dict):
                return {**cached_response, "_idempotency_replay": True}
        elif existing and existing.get("status") == "claimed":
            raise HTTPException(
                status_code=409,
                detail="A previous identical request is still processing. Please wait.",
            )

    try:
        amount = request.amount
        bank = request.bank_details

        # 1. NEW (Feb 2026) — Validate amount against the fixed allow-list
        # and the per-user lifetime cap. This supersedes the progressive
        # minimum check for the public bank-redeem flow.
        if amount not in ALLOWED_REDEEM_AMOUNTS:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid amount. Choose one of ₹"
                    + ", ₹".join(f"{a:,}" for a in ALLOWED_REDEEM_AMOUNTS) + "."
                ),
            )

        quota = await compute_lifetime_redeem_quota(user_id)
        if quota["is_blocked"]:
            raise HTTPException(
                status_code=403,
                detail=quota["block_reason"] or "Bank redeem option is disabled for your account.",
            )
        if amount > quota["remaining_quota_inr"]:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"This amount would exceed your lifetime cap of "
                    f"₹{LIFETIME_BANK_REDEEM_CAP_INR:,}. You have "
                    f"₹{quota['remaining_quota_inr']:,} remaining — please pick a smaller amount."
                ),
            )

        # 1b. Legacy progressive ceiling — RETIRED Feb 5 2026 in favour of
        # admin-configurable limits (1c below). Kept only for the API response
        # in `progressive` for backward-compat with older clients that read it.
        # The actual max-cap enforcement is now done via admin_bank_redeem_config.
        progressive = await compute_progressive_min_withdrawal(user_id)  # noqa: F841

        # 1c. NEW (Feb 5 2026): Admin-configurable per-tx + monthly-cap limits.
        # Reads /admin_settings/_id=bank_redeem_limits. Falls back to hardcoded
        # defaults if the config doc is missing. Enforced BEFORE fee calc.
        try:
            from routes.admin_bank_redeem_config import (
                get_bank_redeem_config,
                get_user_monthly_bank_redeem_total,
            )
            cfg = await get_bank_redeem_config()
            cfg_min = int(cfg["min_withdrawal_inr"])
            cfg_max = int(cfg["max_withdrawal_inr"])
            monthly_cap = int(cfg["monthly_user_cap_inr"])
            if amount < cfg_min:
                raise HTTPException(
                    status_code=400,
                    detail=f"Minimum bank redeem is ₹{cfg_min:,} (admin configured).",
                )
            if amount > cfg_max:
                raise HTTPException(
                    status_code=400,
                    detail=f"Maximum bank redeem is ₹{cfg_max:,} (admin configured).",
                )
            if monthly_cap > 0:
                month_total = await get_user_monthly_bank_redeem_total(user_id)
                if month_total + amount > monthly_cap:
                    remaining = max(0, monthly_cap - month_total)
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Monthly cap ₹{monthly_cap:,} would be exceeded. "
                            f"You've redeemed ₹{month_total:,} this month — only ₹{remaining:,} remains. "
                            "Try again next month or pick a smaller amount."
                        ),
                    )
        except HTTPException:
            raise
        except ImportError as _cfg_err:
            # Config module missing — log & fall through to hardcoded defaults.
            logging.warning(f"[BANK-REDEEM] admin_bank_redeem_config unavailable: {_cfg_err}")
        except Exception as _cfg_err:
            # DB / infra error — log loudly but do NOT fail-open. Enforce the
            # hardcoded defaults (100 min, 10000 max) so a Mongo outage cannot
            # be used to bypass admin-configured limits by attackers.
            logging.error(f"[BANK-REDEEM] Admin config read failed: {_cfg_err}")
            if amount < 100:
                raise HTTPException(status_code=400, detail="Minimum bank redeem is ₹100.")
            if amount > 10000:
                raise HTTPException(status_code=400, detail="Maximum bank redeem is ₹10,000.")
        
        # 2. Get user
        user = await db.users.find_one({"uid": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # ═══════════════════════════════════════════════════════════════════════
        # 2.5. CHECK SUBSCRIPTION ACTIVE + 24-HOUR COOLDOWN
        # Rule: 1 redeem per 24 hours from last request time
        # ═══════════════════════════════════════════════════════════════════════
        now = datetime.now(timezone.utc)
        
        # CHECK A: Subscription must be active (not explorer/free)
        subscription_plan = (user.get("subscription_plan") or "explorer").lower()
        if subscription_plan in ["explorer", "free", ""]:
            raise HTTPException(
                status_code=403,
                detail="Active subscription required for bank withdrawal. Please upgrade your plan."
            )
        
        # CHECK B: Subscription must not be expired
        expiry_dt = get_user_expiry(user)
        if expiry_dt:
            try:
                if expiry_dt < now:
                    days_expired = (now - expiry_dt).days
                    raise HTTPException(
                        status_code=403,
                        detail=f"Your subscription expired {days_expired} days ago. Please renew to use bank withdrawal."
                    )
            except HTTPException:
                raise
            except Exception as e:
                logging.warning(f"[BANK-TRANSFER] Expiry parse error for {user_id}: {e}")
        
        # CHECK C: 24-hour cooldown from last request time
        COOLDOWN_HOURS_BANK = 24
        cooldown_cutoff = (now - timedelta(hours=COOLDOWN_HOURS_BANK)).isoformat()
        
        failed_statuses = [
            "rejected", "failed", "cancelled", 
            "Failed", "FAILED", "Rejected", "REJECTED", 
            "Cancelled", "CANCELLED"
        ]
        
        last_request_date = None
        
        # Check bank_transfer_requests
        bt_recent = await db.bank_transfer_requests.find_one({
            "user_id": user_id,
            "created_at": {"$gte": cooldown_cutoff},
            "status": {"$nin": failed_statuses}
        }, sort=[("created_at", -1)])
        if bt_recent:
            last_request_date = bt_recent.get("created_at")
        
        # Check bank_withdrawal_requests (legacy)
        if not last_request_date:
            bw_recent = await db.bank_withdrawal_requests.find_one({
                "user_id": user_id,
                "created_at": {"$gte": cooldown_cutoff},
                "status": {"$nin": failed_statuses}
            }, sort=[("created_at", -1)])
            if bw_recent:
                last_request_date = bw_recent.get("created_at")
        
        # Check redeem_requests (unified)
        if not last_request_date:
            rr_recent = await db.redeem_requests.find_one({
                "user_id": user_id,
                "service_type": {"$in": ["bank_transfer", "bank_withdrawal", "bank_redeem", "bank", "prc_to_bank"]},
                "created_at": {"$gte": cooldown_cutoff},
                "status": {"$nin": failed_statuses}
            }, sort=[("created_at", -1)])
            if rr_recent:
                last_request_date = rr_recent.get("created_at")
        
        if last_request_date:
            try:
                if isinstance(last_request_date, str):
                    last_dt = datetime.fromisoformat(last_request_date.replace('Z', '+00:00'))
                else:
                    last_dt = last_request_date
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                cooldown_end = last_dt + timedelta(hours=COOLDOWN_HOURS_BANK)
                remaining_seconds = (cooldown_end - now).total_seconds()
                remaining_hours = int(remaining_seconds // 3600)
                remaining_mins = int((remaining_seconds % 3600) // 60)
                raise HTTPException(
                    status_code=429,
                    detail=f"You can redeem once per 24 hours. Next redeem available after {remaining_hours}h {remaining_mins}m."
                )
            except HTTPException:
                raise
            except Exception as e:
                logging.warning(f"[BANK-TRANSFER] Cooldown parse error for {user_id}: {e}")
        
        # 3. Check KYC
        if user.get("kyc_status") != "verified":
            raise HTTPException(status_code=403, detail="KYC verification required for bank transfers")
        
        # 3.5. Check Weekly ONE SERVICE Limit
        if check_weekly_one_service_func:
            weekly_check = await check_weekly_one_service_func(user_id, "bank_transfer")
            if not weekly_check.get("allowed"):
                raise HTTPException(
                    status_code=403,
                    detail=weekly_check.get("reason_en", weekly_check.get("reason", "Weekly service limit reached"))
                )
        
        # 4. Calculate fees with dynamic PRC rate
        fees = await calculate_fees(amount)
        total_prc = fees["total_prc"]
        
        # 5. Check Subscription-Stake INR Redeem Cap (Jun 2026 — sole gate)
        # Each successful subscription unlocks ₹2,500 lifetime headroom for
        # Bank+Recharge+Utility+EMI. The old PRC cap is bypassed here per the
        # user-defined rule (Bank/Recharge/Utility use ONLY the INR cap).
        if check_subscription_cap_func:
            cap_check = await check_subscription_cap_func(user_id, float(amount))
            if not cap_check.get("allowed"):
                raise HTTPException(status_code=403, detail=cap_check.get("reason"))
        
        # 6. Verify IFSC and get bank name
        ifsc_result = await verify_ifsc_eko(bank.ifsc_code)
        bank_name = ifsc_result.get("bank_name", "Unknown Bank")
        
        # 7. Check PRC balance (excluding any locked PRC — Jun 9, 2026)
        raw_balance = float(user.get("prc_balance", 0))
        prc_locked = float(user.get("prc_locked", 0) or 0)
        current_balance = max(0.0, raw_balance - prc_locked)
        if current_balance < total_prc:
            locked_note = (
                f" (₹{prc_locked:,.0f} PRC locked, unlocks "
                f"{(user.get('prc_unlock_at') or '')[:10]})" if prc_locked > 0 else ""
            )
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Insufficient available PRC. Required: {total_prc:,.0f}, "
                    f"Available: {current_balance:,.2f}{locked_note}"
                )
            )
        
        # 8. Check for duplicate pending request
        existing_pending = await db.bank_transfer_requests.find_one({
            "user_id": user_id,
            "status": "pending"
        })
        if existing_pending:
            raise HTTPException(
                status_code=400,
                detail="You already have a pending request. Please wait for it to be processed."
            )
        
        # 8. Generate request ID
        request_id = f"BTR-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8].upper()}"
        
        # Claim idempotency sentinel NOW (after all validations). If another
        # concurrent request is also past validations, only one wins the claim;
        # the other sees in-flight → 409 (Layer 1 race guard). Combined with
        # WalletServiceV2.debit's atomic $inc (Layer 2), this prevents both
        # double-submit (same key) and concurrent-double-charge (different keys).
        if client_request_id:
            claim = await check_and_claim_idempotency_key(
                client_request_id, idem_scope, ttl_seconds=300
            )
            if claim is not None:
                if claim.get("_inflight"):
                    raise HTTPException(
                        status_code=409,
                        detail="Duplicate request still processing. Please wait.",
                    )
                return claim

        # 9. Deduct PRC using WalletServiceV2
        debit_result = WalletServiceV2.debit(
            user_id=user_id,
            amount=total_prc,
            txn_type="bank_transfer",
            description=f"Bank Transfer: ₹{amount} to A/C {bank.account_number[-4:]}",
            reference=request_id,
            service_type="bank_transfer"
        )
        
        if not debit_result.get("success"):
            if client_request_id:
                await release_idempotency_key(client_request_id, idem_scope)
            raise HTTPException(status_code=400, detail=debit_result.get("error", "Failed to deduct PRC"))
        
        # 10. Create request record
        request_data = {
            "request_id": request_id,
            "user_id": user_id,
            "user_name": user.get("name", ""),
            "user_phone": user.get("mobile", ""),
            "user_email": user.get("email", ""),
            
            # Amount details
            "withdrawal_amount": amount,
            "admin_fee": fees["admin_fee"],
            "transaction_fee": fees["transaction_fee"],
            "total_inr": fees["total_inr"],
            "prc_deducted": total_prc,
            
            # Bank details
            "account_holder_name": bank.account_holder_name,
            "account_number": bank.account_number,
            "ifsc_code": bank.ifsc_code,
            "bank_name": bank_name,
            "branch": ifsc_result.get("branch", ""),
            
            # Status
            "status": "pending",
            "admin_remark": None,
            "utr_number": None,
            "processed_by": None,
            "processed_at": None,
            
            # Timestamps
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            
            # PRC transaction reference
            "prc_txn_id": debit_result.get("txn_id"),
            "prc_refunded": False
        }
        
        await db.bank_transfer_requests.insert_one(request_data)
        
        logging.info(f"[BANK TRANSFER] New request: {request_id} | User: {user_id} | Amount: ₹{amount} | PRC: {total_prc}")
        
        response = {
            "success": True,
            "message": "Bank transfer request submitted successfully",
            "request": {
                "request_id": request_id,
                "amount": amount,
                "total_prc_deducted": total_prc,
                "bank_name": bank_name,
                "account_number": f"XXXX{bank.account_number[-4:]}",
                "status": "pending",
                "estimated_processing": "24-48 hours"
            },
            "new_balance": debit_result.get("balance_after", 0)
        }
        # Cache for idempotent replay
        if client_request_id:
            await store_idempotency_response(
                client_request_id, idem_scope, response, ttl_seconds=300
            )
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[BANK TRANSFER] Request error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Server error. Please try again.")

@router.get("/my-requests/{user_id}")
async def get_user_requests(
    user_id: str,
    status: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    skip: int = 0
):
    """Get user's bank transfer request history."""
    try:
        query = {"user_id": user_id}
        if status:
            query["status"] = status
        
        requests = await db.bank_transfer_requests.find(
            query,
            {"_id": 0}
        ).sort("created_at", 1).skip(skip).limit(limit).to_list(limit)  # 1 = oldest first
        
        total = await db.bank_transfer_requests.count_documents(query)
        
        # Mask account numbers for security
        for req in requests:
            if req.get("account_number"):
                req["account_number_masked"] = f"XXXX{req['account_number'][-4:]}"
        
        return {
            "success": True,
            "requests": requests,
            "total": total,
            "limit": limit,
            "skip": skip
        }
        
    except Exception as e:
        logging.error(f"Error fetching user requests: {e}")
        raise HTTPException(status_code=500, detail="Server error")

# ==================== ADMIN APIs ====================

@router.get("/admin/requests")
async def get_all_requests(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    skip: int = 0,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: Optional[str] = Query(default="created_at", description="Sort by: created_at, amount, user_name, total_redeemed"),
    sort_order: Optional[str] = Query(default="asc", description="Sort order: asc or desc"),
    redeem_min: Optional[float] = Query(default=None, description="Min lifetime redeemed filter"),
    redeem_max: Optional[float] = Query(default=None, description="Max lifetime redeemed filter"),
    never_redeemed: Optional[bool] = Query(default=None, description="Show only first-time redeemers"),
    subscription_status: Optional[str] = Query(default=None, description="Filter by subscription: active | inactive"),
    over_limit_only: Optional[bool] = Query(default=None, description="Show only over-limit pending requests"),
):
    """Get all bank transfer requests for admin with advanced filtering and sorting.

    PERF: 30 s in-process cache keyed by full filter set. Bypasses Atlas
    cold-load latency (the per-user redeem-limit enrichment can take 5-25 s
    on first call) for repeated admin tab navigation. Each unique filter
    combo is cached separately. Manual 'Refresh' button bypasses cache via
    the standard React state cycle (still hits this same endpoint).
    """
    # ---- 30 s cache fast-path ----
    cache_key = (
        status or "_", limit, skip, search or "_",
        date_from or "_", date_to or "_", sort_by, sort_order,
        redeem_min, redeem_max, never_redeemed, subscription_status, over_limit_only,
    )
    cached = _bank_requests_cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        query = {}
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"request_id": {"$regex": search, "$options": "i"}},
                {"user_name": {"$regex": search, "$options": "i"}},
                {"user_phone": {"$regex": search, "$options": "i"}},
                {"account_number": {"$regex": search, "$options": "i"}}
            ]
        
        # Date filter (server-side)
        if date_from or date_to:
            date_query = {}
            if date_from:
                try:
                    from_date = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
                    date_query["$gte"] = from_date.isoformat()
                except:
                    date_query["$gte"] = date_from
            if date_to:
                try:
                    to_date = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
                    # Include full day
                    to_date = to_date.replace(hour=23, minute=59, second=59)
                    date_query["$lte"] = to_date.isoformat()
                except:
                    date_query["$lte"] = date_to + "T23:59:59"
            if date_query:
                query["created_at"] = date_query
        
        # Sort configuration
        sort_field_map = {
            "created_at": "created_at",
            "date": "created_at",
            "amount": "withdrawal_amount",
            "name": "user_name",
            "user_name": "user_name",
        }
        # `user_joining_date` is special — it's NOT a field on bank_transfer_requests
        # itself. We resolve it via post-enrichment after fetching user docs.
        is_user_joining_sort = sort_by == "user_joining_date"
        sort_field = sort_field_map.get(sort_by, "created_at")
        sort_direction = 1 if sort_order == "asc" else -1  # 1 = ascending, -1 = descending
        
        requests = await db.bank_transfer_requests.find(
            query,
            {"_id": 0}
        ).sort(sort_field, sort_direction).skip(skip).limit(limit).to_list(limit)
        
        # Enrich each request with subscription_active status (parallel)
        async def _enrich_subscription(req):
            req_user_id = req.get("user_id")
            if not req_user_id:
                return
            req_user = await db.users.find_one(
                {"uid": req_user_id},
                {"_id": 0, "subscription_plan": 1, "subscription_expiry": 1, "created_at": 1}
            )
            if not req_user:
                req["subscription_active"] = False
                req["subscription_plan"] = "unknown"
                req["user_joining_date"] = None
                return
            # User join date (for sorting by latest-joined users)
            joined = req_user.get("created_at")
            if isinstance(joined, datetime):
                req["user_joining_date"] = joined.isoformat()
            else:
                req["user_joining_date"] = str(joined) if joined else None
            plan = (req_user.get("subscription_plan") or "explorer").lower()
            is_active = plan not in ["explorer", "free", ""]
            if is_active:
                exp_dt = get_user_expiry(req_user)
                if exp_dt and exp_dt < datetime.now(timezone.utc):
                    is_active = False
            req["subscription_active"] = is_active
            req["subscription_plan"] = plan

        try:
            await asyncio.wait_for(
                asyncio.gather(*[_enrich_subscription(r) for r in requests]),
                timeout=5.0,
            )
        except asyncio.TimeoutError:
            logging.warning("[BANK REQUESTS] subscription enrichment timeout (>5s)")
        
        # Enrich: user's lifetime PRC SPENT across ALL services (recharge, bill pay,
        # bank redeem, gift cards, subscription, etc.) — converted to INR via rate.
        user_ids = list(set(r.get("user_id") for r in requests if r.get("user_id")))

        # Bank-transfer-specific count (how many redeems this user has done to bank)
        bank_counts: dict = {}
        if user_ids:
            count_pipeline = [
                {"$match": {"user_id": {"$in": user_ids}, "status": "paid"}},
                {"$group": {"_id": "$user_id", "redeem_count": {"$sum": 1}}}
            ]
            async for row in db.bank_transfer_requests.aggregate(count_pipeline):
                bank_counts[row["_id"]] = row.get("redeem_count", 0)

        # Current PRC rate for PRC→INR conversion (default 10 PRC = 1 INR)
        prc_rate = 10.0
        if get_prc_rate_func:
            try:
                prc_rate = float(await get_prc_rate_func(db)) or 10.0
            except Exception:
                prc_rate = 10.0

        # Single combined enrichment: use `calculate_redeem_limit_func` which
        # already computes `total_redeemed` (via get_user_all_time_redeemed internally)
        # AND the redeem-limit fields. This halves the runtime vs two sequential
        # passes and keeps us well under the 30s proxy timeout.
        # SKIP enrichment entirely if the page isn't "pending" — the redeem-limit
        # column only shows on pending rows; paid/failed rows ignore it. This
        # eliminates 5-25 s of unnecessary work for the common admin tab navigation.
        SKIP_REDEEM_LIMIT_ENRICHMENT = bool(status) and status.lower() != "pending"
        limit_cache = {}
        try:
            if calculate_redeem_limit_func and not SKIP_REDEEM_LIMIT_ENRICHMENT and user_ids:
                async def _limit_for(uid: str):
                    try:
                        # Per-user 6 s hard cap (down from 18 s) — single heavy
                        # user can't block whole page beyond this.
                        info = await asyncio.wait_for(
                            calculate_redeem_limit_func(uid), timeout=6.0
                        )
                        return uid, info
                    except asyncio.TimeoutError:
                        logging.warning(f"[BANK REQUESTS] limit calc timed out (>6s) for {uid}")
                        return uid, None
                    except Exception as e:
                        logging.warning(f"[BANK REQUESTS] limit calc failed for {uid}: {e}")
                        return uid, None

                # Reduced from 100 → 20 to prevent heavy DB load storms when
                # indexes haven't kicked in (safe: page shows max ~20 rows).
                bounded = user_ids[:20]
                try:
                    results = await asyncio.wait_for(
                        asyncio.gather(*[_limit_for(u) for u in bounded]),
                        timeout=10.0,
                    )
                    for uid, info in results:
                        limit_cache[uid] = info
                except asyncio.TimeoutError:
                    logging.warning(
                        f"[BANK REQUESTS] combined enrichment timed out "
                        f"(>10s) for {len(bounded)} users; page still loads."
                    )
                except Exception as e:
                    logging.warning(f"[BANK REQUESTS] enrichment gather error: {e}")
        except Exception as enrich_err:
            logging.error(
                f"[BANK REQUESTS] enrichment hard-failed: {enrich_err}"
            )

        # Populate per-row lifetime totals from limit_cache
        for req in requests:
            uid = req.get("user_id")
            info = limit_cache.get(uid)
            prc = float(info.get("total_redeemed", 0)) if info else 0.0
            inr = prc / prc_rate if prc_rate else 0.0
            req["user_total_redeemed_prc"] = round(prc, 2)
            req["user_total_redeemed_inr"] = round(inr, 2)
            req["user_redeem_count"] = bank_counts.get(uid, 0)
            req["is_first_redeem"] = req["user_redeem_count"] <= 1

            # Only attach limit data to pending rows so historical
            # (paid/failed) rows don't show a misleading red "OVER LIMIT".
            if (req.get("status") or "").lower() != "pending":
                req["redeem_limit_available"] = None
                continue
            if info:
                try:
                    raw_total = info.get("total_limit", 0)
                    raw_used = info.get("total_redeemed", 0)
                    req["redeem_limit_available"] = info.get("available", 0)
                    req["redeem_limit_effective"] = info.get("effective_available", 0)
                    req["redeem_limit_total"] = raw_total
                    req["redeem_limit_used"] = raw_used
                    req["redeem_limit_percent"] = info.get("unlock_percent", 0)
                    req["redeem_limit_raw"] = round(raw_total - raw_used, 2)
                except Exception as e:
                    logging.warning(f"Failed to set redeem limit for {uid}: {e}")
                    req["redeem_limit_available"] = None
            else:
                req["redeem_limit_available"] = None
        
        # Post-filter by redeem range
        if redeem_min is not None:
            requests = [r for r in requests if r.get("user_total_redeemed_prc", 0) >= redeem_min]
        if redeem_max is not None:
            requests = [r for r in requests if r.get("user_total_redeemed_prc", 0) <= redeem_max]
        if never_redeemed:
            requests = [r for r in requests if r.get("is_first_redeem", False)]

        # Post-filter by subscription_status
        if subscription_status:
            want_active = subscription_status.lower() == "active"
            requests = [r for r in requests if bool(r.get("subscription_active", False)) == want_active]

        # Post-filter: over-limit only (pending rows where raw_limit < 0)
        # Note: if enrichment failed/timed out, redeem_limit_raw will be None
        # for all rows — filter then returns empty (admin can retry/refresh).
        if over_limit_only:
            requests = [
                r for r in requests
                if (r.get("status") or "").lower() == "pending"
                and r.get("redeem_limit_raw") is not None
                and r.get("redeem_limit_raw") < 0
            ]
        
        # Sort by total_redeemed if requested
        if sort_by == "total_redeemed":
            reverse = sort_order == "desc"
            requests.sort(key=lambda x: x.get("user_total_redeemed_prc", 0), reverse=reverse)

        # Sort by user_joining_date (latest joined users first by default = desc)
        if is_user_joining_sort:
            reverse = sort_order == "desc"
            requests.sort(
                key=lambda x: (x.get("user_joining_date") or ""),
                reverse=reverse,
            )

        # Run all 5 stat queries in parallel — was 4 sequential count_documents
        # plus 1 aggregation = 5× wall-clock. Now max-of-each.
        pipeline = [
            {"$group": {
                "_id": "$status",
                "total_amount": {"$sum": "$withdrawal_amount"},
                "total_prc": {"$sum": "$prc_deducted"}
            }}
        ]
        _stat_results = await asyncio.gather(
            db.bank_transfer_requests.count_documents(query),
            db.bank_transfer_requests.count_documents({"status": "pending"}),
            db.bank_transfer_requests.count_documents({"status": "paid"}),
            db.bank_transfer_requests.count_documents({"status": "failed"}),
            db.bank_transfer_requests.aggregate(pipeline).to_list(10),
            return_exceptions=True,
        )
        total          = _stat_results[0] if not isinstance(_stat_results[0], Exception) else 0
        pending_count  = _stat_results[1] if not isinstance(_stat_results[1], Exception) else 0
        paid_count     = _stat_results[2] if not isinstance(_stat_results[2], Exception) else 0
        failed_count   = _stat_results[3] if not isinstance(_stat_results[3], Exception) else 0
        totals         = _stat_results[4] if not isinstance(_stat_results[4], Exception) else []
        totals_dict = {t["_id"]: t for t in totals}
        
        payload = {
            "success": True,
            "requests": requests,
            "pagination": {
                "total": total,
                "limit": limit,
                "skip": skip,
                "pages": (total + limit - 1) // limit
            },
            "stats": {
                "pending": {
                    "count": pending_count,
                    "amount": totals_dict.get("pending", {}).get("total_amount", 0),
                    "prc": totals_dict.get("pending", {}).get("total_prc", 0)
                },
                "paid": {
                    "count": paid_count,
                    "amount": totals_dict.get("paid", {}).get("total_amount", 0),
                    "prc": totals_dict.get("paid", {}).get("total_prc", 0)
                },
                "failed": {
                    "count": failed_count,
                    "amount": totals_dict.get("failed", {}).get("total_amount", 0),
                    "prc": totals_dict.get("failed", {}).get("total_prc", 0)
                }
            },
            "filters_applied": {
                "date_from": date_from,
                "date_to": date_to,
                "sort_by": sort_by,
                "sort_order": sort_order
            }
        }
        try:
            _bank_requests_cache_set(cache_key, payload)
        except Exception:
            pass
        return payload

    except Exception as e:
        logging.error(f"Error fetching admin requests: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.get("/admin/request/{request_id}")
async def get_request_details(request_id: str):
    """Get detailed view of a specific request."""
    try:
        request = await db.bank_transfer_requests.find_one(
            {"request_id": request_id},
            {"_id": 0}
        )
        
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Get user details
        user = await db.users.find_one(
            {"uid": request.get("user_id")},
            {"_id": 0, "password": 0, "pin_hash": 0, "password_hash": 0}
        )
        
        return {
            "success": True,
            "request": request,
            "user": {
                "name": user.get("name") if user else "Unknown",
                "phone": user.get("mobile") if user else "",
                "email": user.get("email") if user else "",
                "prc_balance": user.get("prc_balance") if user else 0,
                "kyc_status": user.get("kyc_status") if user else "unknown"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching request details: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post("/admin/mark-paid")
async def mark_request_paid(action: AdminActionRequest):
    """Mark a request as paid after manual bank transfer."""
    try:
        request = await db.bank_transfer_requests.find_one({"request_id": action.request_id})
        
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if request.get("status") != "pending":
            raise HTTPException(status_code=400, detail=f"Request is already {request.get('status')}")
        
        # Update request
        await db.bank_transfer_requests.update_one(
            {"request_id": action.request_id},
            {
                "$set": {
                    "status": "paid",
                    "utr_number": action.utr_number,
                    "admin_remark": action.remark or "Payment completed",
                    "processed_by": action.admin_id,
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logging.info(f"[BANK TRANSFER] Marked PAID: {action.request_id} | Admin: {action.admin_id} | UTR: {action.utr_number}")

        # PROGRESSIVE MIN-WITHDRAWAL (May 2026): every approved/paid redeem
        # raises the user's next minimum floor to amount × 1.5. Updated atomically
        # via $max so concurrent admin actions never lower the floor.
        try:
            import math as _math
            paid_amt = int(request.get("withdrawal_amount") or 0)
            new_floor = max(MIN_WITHDRAWAL_BASE, int(_math.ceil(paid_amt * PROGRESSIVE_MULTIPLIER)))
            if paid_amt > 0:
                await db.users.update_one(
                    {"uid": request.get("user_id")},
                    {"$max": {"next_min_withdrawal_inr": new_floor},
                     "$set": {"last_redeem_amount_inr": paid_amt,
                              "last_redeem_at": datetime.now(timezone.utc).isoformat()}}
                )
                logging.info(
                    f"[PROGRESSIVE-MIN] user={request.get('user_id')} "
                    f"paid={paid_amt} → next_min raised to ₹{new_floor}"
                )
        except Exception as _e:
            logging.warning(f"[PROGRESSIVE-MIN] update failed (non-fatal): {_e}")
        
        # Create community Success Story post (fire-and-forget)
        try:
            from routes.community import create_success_story_post
            amount_paid = (
                request.get("withdrawal_amount")
                or request.get("amount_inr")
                or request.get("total_inr")
                or request.get("amount")
                or request.get("inr_amount")
                or 0
            )
            if float(amount_paid) <= 0:
                logging.warning(
                    f"[SUCCESS STORY] bank_redeem amount=0 for request={action.request_id} "
                    f"user={request.get('user_id')} — fields found: "
                    f"withdrawal_amount={request.get('withdrawal_amount')} "
                    f"amount_inr={request.get('amount_inr')} total_inr={request.get('total_inr')} "
                    f"amount={request.get('amount')} inr_amount={request.get('inr_amount')}"
                )
            await create_success_story_post(
                user_id=request.get("user_id"),
                service_type="bank_redeem",
                amount_inr=float(amount_paid),
                ref_id=f"bank_redeem:{action.request_id}",
            )
            logging.info(
                f"[SUCCESS STORY] bank_redeem post created: request={action.request_id} "
                f"user={request.get('user_id')} amount=₹{amount_paid}"
            )
        except Exception as e:
            logging.warning(f"[SUCCESS STORY] bank redeem trigger failed (non-fatal): {e}")

        # Sustainability auto-burn (1% of post-deduction balance, threshold 30k)
        try:
            from routes.sustainability_burn import apply_sustainability_burn
            await apply_sustainability_burn(
                user_id=request.get("user_id"),
                service_type="bank_redeem",
                service_ref_id=action.request_id,
                amount_inr=float(amount_paid) if amount_paid else None,
            )
        except Exception as e:
            logging.warning(f"[SUSTAIN-BURN] bank redeem hook failed (non-fatal): {e}")

        # TODO: Send notification to user
        
        return {
            "success": True,
            "message": f"Request {action.request_id} marked as PAID",
            "utr_number": action.utr_number
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error marking paid: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post("/admin/mark-failed")
async def mark_request_failed(action: AdminActionRequest):
    """Mark a request as failed and refund PRC."""
    from app.services.wallet_service_v2 import WalletServiceV2
    
    try:
        request = await db.bank_transfer_requests.find_one({"request_id": action.request_id})
        
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if request.get("status") != "pending":
            raise HTTPException(status_code=400, detail=f"Request is already {request.get('status')}")
        
        if request.get("prc_refunded"):
            raise HTTPException(status_code=400, detail="PRC already refunded")
        
        # Refund PRC
        prc_to_refund = request.get("prc_deducted", 0)
        user_id = request.get("user_id")
        
        if prc_to_refund > 0:
            credit_result = WalletServiceV2.credit(
                user_id=user_id,
                amount=prc_to_refund,
                txn_type="refund",
                description=f"Bank Transfer Failed: {action.remark or 'Request rejected'}",
                reference=action.request_id,
                service_type="bank_transfer_refund"
            )
            
            if not credit_result.get("success"):
                logging.error(f"Failed to refund PRC for {action.request_id}: {credit_result}")
                raise HTTPException(status_code=500, detail="Failed to refund PRC")
        
        # Update request
        await db.bank_transfer_requests.update_one(
            {"request_id": action.request_id},
            {
                "$set": {
                    "status": "failed",
                    "admin_remark": action.remark or "Request rejected",
                    "processed_by": action.admin_id,
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "prc_refunded": True,
                    "refund_txn_id": credit_result.get("txn_id") if prc_to_refund > 0 else None
                }
            }
        )
        
        logging.info(f"[BANK TRANSFER] Marked FAILED: {action.request_id} | Admin: {action.admin_id} | Refund: {prc_to_refund} PRC")
        
        # Send in-app notification (non-fatal)
        try:
            from routes.notifications import create_notification
            reason = action.remark or "Request rejected"
            amount_inr = request.get("withdrawal_amount") or request.get("amount") or 0
            account_tail = (request.get("account_number") or "")[-4:] if request.get("account_number") else None
            msg_parts = [
                f"Your bank redeem of \u20b9{int(amount_inr):,} has been rejected.",
                f"Reason: {reason}.",
            ]
            if prc_to_refund:
                msg_parts.append(f"{int(prc_to_refund):,} PRC has been refunded to your wallet.")
            if account_tail:
                msg_parts.append(f"Account: XXXX{account_tail}.")
            await create_notification(
                user_id=user_id,
                notification_type="payment_rejected",
                title="Bank Redeem Failed",
                message=" ".join(msg_parts),
                data={
                    "request_id": action.request_id,
                    "amount_inr": amount_inr,
                    "prc_refunded": prc_to_refund,
                    "reason": reason,
                    "service": "bank_redeem",
                    "status": "failed",
                },
            )
        except Exception as ne:
            logging.warning(f"[BANK TRANSFER] notify on fail err (non-fatal): {ne}")
        
        return {
            "success": True,
            "message": f"Request {action.request_id} marked as FAILED. {prc_to_refund:,} PRC refunded.",
            "prc_refunded": prc_to_refund
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error marking failed: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Server error")


@router.post("/admin/edit-amount")
async def edit_withdrawal_amount(data: EditAmountRequest):
    """Admin can edit the withdrawal amount of a pending request."""
    try:
        request_doc = await db.bank_transfer_requests.find_one({"request_id": data.request_id})
        if not request_doc:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if request_doc.get("status") != "pending":
            raise HTTPException(status_code=400, detail=f"Cannot edit - request is already {request_doc.get('status')}")
        
        old_amount = request_doc.get("withdrawal_amount", 0)
        new_amount = data.new_amount
        
        if new_amount == old_amount:
            raise HTTPException(status_code=400, detail="New amount is same as current amount")
        
        if new_amount > old_amount:
            raise HTTPException(status_code=400, detail="New amount cannot be more than original amount")
        
        await db.bank_transfer_requests.update_one(
            {"request_id": data.request_id},
            {
                "$set": {
                    "withdrawal_amount": new_amount,
                    "original_amount": old_amount,
                    "amount_edited_by": data.admin_id,
                    "amount_edited_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logging.info(f"[BANK TRANSFER] Amount edited: {data.request_id} | ₹{old_amount} → ₹{new_amount} | Admin: {data.admin_id}")
        
        return {
            "success": True,
            "message": f"Amount updated: ₹{old_amount:,} → ₹{new_amount:,}",
            "old_amount": old_amount,
            "new_amount": new_amount
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error editing amount: {e}")
        raise HTTPException(status_code=500, detail="Server error")


class BulkActionRequest(BaseModel):
    """Request model for bulk actions"""
    request_ids: list = Field(default=[], description="List of request IDs to process")
    admin_id: str = Field(..., description="Admin user ID")
    remark: str = Field(default="Bulk action", description="Reason for bulk action")
    mark_all_pending: bool = Field(default=False, description="If true, mark ALL pending requests")
    min_amount_inr: Optional[float] = Field(
        default=None,
        description="When mark_all_pending=True, only target pending requests with amount > this INR value"
    )


@router.post("/admin/bulk-mark-failed")
async def bulk_mark_failed(action: BulkActionRequest):
    """
    Bulk mark requests as failed. Can either:
    1. Mark specific request_ids as failed
    2. Mark ALL pending requests as failed (if mark_all_pending=True)
    
    PRC will be refunded for each failed request.
    """
    try:
        failed_count = 0
        error_count = 0
        total_refunded = 0
        
        # Get requests to process
        if action.mark_all_pending:
            # Get ALL pending requests, optionally filtered by min_amount_inr
            query = {"status": "pending"}
            if action.min_amount_inr is not None and action.min_amount_inr > 0:
                # bank_transfer_requests stores INR under 'amount_inr' (and sometimes 'amount')
                # Use $or to cover both shapes.
                query = {
                    "$and": [
                        {"status": "pending"},
                        {"$or": [
                            {"amount_inr": {"$gt": float(action.min_amount_inr)}},
                            {"amount": {"$gt": float(action.min_amount_inr)}},
                        ]},
                    ]
                }
            requests_to_fail = await db.bank_transfer_requests.find(query).to_list(2000)
        else:
            # Get specific requests
            requests_to_fail = await db.bank_transfer_requests.find(
                {"request_id": {"$in": action.request_ids}, "status": "pending"}
            ).to_list(len(action.request_ids))
        
        if not requests_to_fail:
            return {
                "success": True,
                "message": "No pending requests found to process",
                "failed_count": 0,
                "total_refunded": 0
            }
        
        # Process each request
        for request in requests_to_fail:
            try:
                request_id = request.get("request_id")
                prc_to_refund = request.get("prc_deducted", 0)
                user_id = request.get("user_id")
                
                # Refund PRC directly to user's balance
                if prc_to_refund > 0 and user_id:
                    await db.users.update_one(
                        {"uid": user_id},
                        {"$inc": {"prc_balance": prc_to_refund}}
                    )
                    total_refunded += prc_to_refund
                
                # Update request status
                await db.bank_transfer_requests.update_one(
                    {"request_id": request_id},
                    {
                        "$set": {
                            "status": "failed",
                            "admin_remark": action.remark or "Bulk failed by admin",
                            "processed_by": action.admin_id,
                            "processed_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                            "prc_refunded": True
                        }
                    }
                )
                
                failed_count += 1
                
                # Send in-app notification (non-fatal)
                try:
                    from routes.notifications import create_notification
                    reason = action.remark or "Request rejected"
                    amount_inr = request.get("withdrawal_amount") or request.get("amount") or 0
                    account_tail = (request.get("account_number") or "")[-4:] if request.get("account_number") else None
                    msg_parts = [
                        f"Your bank redeem of \u20b9{int(amount_inr):,} has been rejected.",
                        f"Reason: {reason}.",
                    ]
                    if prc_to_refund:
                        msg_parts.append(f"{int(prc_to_refund):,} PRC has been refunded to your wallet.")
                    if account_tail:
                        msg_parts.append(f"Account: XXXX{account_tail}.")
                    await create_notification(
                        user_id=user_id,
                        notification_type="payment_rejected",
                        title="Bank Redeem Failed",
                        message=" ".join(msg_parts),
                        data={
                            "request_id": request_id,
                            "amount_inr": amount_inr,
                            "prc_refunded": prc_to_refund,
                            "reason": reason,
                            "service": "bank_redeem",
                            "status": "failed",
                        },
                    )
                except Exception as ne:
                    logging.warning(f"[BULK FAIL] notify err (non-fatal): {ne}")
                
            except Exception as req_err:
                logging.error(f"Error processing request {request.get('request_id')}: {req_err}")
                error_count += 1
        
        logging.info(f"[BANK TRANSFER] Bulk FAILED: {failed_count} requests | Admin: {action.admin_id} | Refund: {total_refunded} PRC")
        
        return {
            "success": True,
            "message": f"Marked {failed_count} requests as failed. {total_refunded:,} PRC refunded.",
            "failed_count": failed_count,
            "error_count": error_count,
            "total_refunded": total_refunded
        }
        
    except Exception as e:
        logging.error(f"Bulk fail error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Server error")


@router.post("/admin/bulk-mark-paid")
async def bulk_mark_paid(action: BulkActionRequest):
    """
    Bulk mark selected requests as paid.
    Note: UTR number will be set as "BULK-{timestamp}" for bulk operations.
    """
    try:
        if not action.request_ids or len(action.request_ids) == 0:
            raise HTTPException(status_code=400, detail="No request IDs provided")
        
        paid_count = 0
        error_count = 0
        bulk_utr = f"BULK-{int(datetime.now().timestamp())}"
        
        for request_id in action.request_ids:
            try:
                request = await db.bank_transfer_requests.find_one({
                    "request_id": request_id,
                    "status": "pending"
                })
                
                if not request:
                    error_count += 1
                    continue
                
                await db.bank_transfer_requests.update_one(
                    {"request_id": request_id},
                    {
                        "$set": {
                            "status": "paid",
                            "utr_number": bulk_utr,
                            "admin_remark": action.remark or "Bulk paid by admin",
                            "processed_by": action.admin_id,
                            "processed_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                paid_count += 1

                # PROGRESSIVE MIN-WITHDRAWAL (May 2026): raise floor 1.5×
                try:
                    import math as _math
                    paid_amt_p = int(request.get("withdrawal_amount") or 0)
                    if paid_amt_p > 0:
                        new_floor_p = max(
                            MIN_WITHDRAWAL_BASE,
                            int(_math.ceil(paid_amt_p * PROGRESSIVE_MULTIPLIER)),
                        )
                        await db.users.update_one(
                            {"uid": request.get("user_id")},
                            {"$max": {"next_min_withdrawal_inr": new_floor_p},
                             "$set": {"last_redeem_amount_inr": paid_amt_p,
                                      "last_redeem_at": datetime.now(timezone.utc).isoformat()}}
                        )
                except Exception as _floor_err:
                    logging.warning(f"[PROGRESSIVE-MIN] bulk update failed (non-fatal): {_floor_err}")

                # Sustainability auto-burn (1% of post-deduction balance, threshold 30k)
                try:
                    from routes.sustainability_burn import apply_sustainability_burn
                    amount_paid_b = (
                        request.get("withdrawal_amount") or request.get("amount_inr")
                        or request.get("total_inr") or request.get("amount") or 0
                    )
                    await apply_sustainability_burn(
                        user_id=request.get("user_id"),
                        service_type="bank_redeem",
                        service_ref_id=request_id,
                        amount_inr=float(amount_paid_b) if amount_paid_b else None,
                    )
                except Exception as burn_err:
                    logging.warning(f"[SUSTAIN-BURN] bulk bank redeem hook failed (non-fatal): {burn_err}")
            except Exception as req_err:
                logging.error(f"Error processing request {request_id}: {req_err}")
                error_count += 1
        
        logging.info(f"[BANK TRANSFER] Bulk PAID: {paid_count} requests | Admin: {action.admin_id} | UTR: {bulk_utr}")
        
        return {
            "success": True,
            "message": f"Marked {paid_count} requests as paid.",
            "paid_count": paid_count,
            "error_count": error_count,
            "bulk_utr": bulk_utr
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Bulk paid error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Server error")


class NotifyFailedRequest(BaseModel):
    """Send in-app notification to users whose bank redeems were failed."""
    request_ids: list = Field(default=[], description="List of failed request IDs")
    only_status: str = Field(default="failed", description="Only consider rows with this status")
    title: str = Field(default="Bank Redeem Failed", description="Notification title")
    use_admin_remark_as_reason: bool = Field(default=True, description="If true, use stored admin_remark as the reason")
    custom_reason: Optional[str] = Field(default=None, description="Override reason text if not using remark")


@router.post("/admin/notify-failed-users")
async def notify_failed_users(payload: NotifyFailedRequest):
    """Create an in-app notification for each user whose bank redeem request
    was failed (one notification per request_id). Idempotent — skips if a
    notification with the same `data.request_id` already exists for the user.
    """
    try:
        from routes.notifications import create_notification

        if not payload.request_ids:
            raise HTTPException(status_code=400, detail="request_ids is required")

        rows = await db.bank_transfer_requests.find(
            {"request_id": {"$in": payload.request_ids}}, {"_id": 0}
        ).to_list(len(payload.request_ids))

        sent = 0
        skipped = 0
        not_failed = 0
        already_notified = 0

        for r in rows:
            rid = r.get("request_id")
            uid = r.get("user_id")
            if not uid or not rid:
                skipped += 1
                continue
            if (r.get("status") or "").lower() != payload.only_status:
                not_failed += 1
                continue

            # Idempotency: skip if a notification already exists for this rid
            existing = await db.notifications.find_one({
                "user_id": uid,
                "data.request_id": rid,
                "type": "payment_rejected",
            })
            if existing:
                already_notified += 1
                continue

            reason = payload.custom_reason or (
                r.get("admin_remark") if payload.use_admin_remark_as_reason else None
            ) or "Request rejected"

            amount_inr = r.get("withdrawal_amount") or r.get("amount") or 0
            prc_refunded = r.get("prc_deducted") or r.get("total_prc_deducted") or 0
            account_tail = (r.get("account_number") or "")[-4:] if r.get("account_number") else None

            msg_parts = [
                f"Your bank redeem of \u20b9{int(amount_inr):,} has been rejected.",
                f"Reason: {reason}.",
            ]
            if prc_refunded:
                msg_parts.append(f"{int(prc_refunded):,} PRC has been refunded to your wallet.")
            if account_tail:
                msg_parts.append(f"Account: XXXX{account_tail}.")
            message = " ".join(msg_parts)

            await create_notification(
                user_id=uid,
                notification_type="payment_rejected",
                title=payload.title,
                message=message,
                data={
                    "request_id": rid,
                    "amount_inr": amount_inr,
                    "prc_refunded": prc_refunded,
                    "reason": reason,
                    "service": "bank_redeem",
                    "status": "failed",
                },
            )
            sent += 1

        logging.info(
            f"[BANK TRANSFER NOTIFY] sent={sent} already={already_notified} "
            f"not_failed={not_failed} skipped={skipped} of {len(payload.request_ids)}"
        )
        return {
            "success": True,
            "sent": sent,
            "already_notified": already_notified,
            "not_failed": not_failed,
            "skipped": skipped,
            "total_input": len(payload.request_ids),
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"notify_failed_users error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Server error")


@router.get("/admin/stats")
async def get_admin_stats():
    """Get dashboard statistics for admin. Parallelised for snappy response."""
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        coll = db.bank_transfer_requests

        async def _sums():
            pipeline = [
                {"$group": {
                    "_id": "$status",
                    "total_prc": {"$sum": "$prc_deducted"},
                    "total_inr": {"$sum": "$withdrawal_amount"},
                }}
            ]
            return await coll.aggregate(pipeline).to_list(10)

        # Run all 5 queries in parallel
        pending, paid, failed, sums, today_pending, today_paid = await asyncio.gather(
            coll.count_documents({"status": "pending"}),
            coll.count_documents({"status": "paid"}),
            coll.count_documents({"status": "failed"}),
            _sums(),
            coll.count_documents({
                "status": "pending",
                "created_at": {"$regex": f"^{today}"},
            }),
            coll.count_documents({
                "status": "paid",
                "processed_at": {"$regex": f"^{today}"},
            }),
        )

        sums_dict = {s["_id"]: s for s in sums}
        total_prc_burned = sums_dict.get("paid", {}).get("total_prc", 0)

        return {
            "success": True,
            "stats": {
                "total_pending": pending,
                "total_paid": paid,
                "total_failed": failed,
                "total_prc_burned": total_prc_burned,
                "pending_amount": sums_dict.get("pending", {}).get("total_inr", 0),
                "paid_amount": sums_dict.get("paid", {}).get("total_inr", 0),
                "today": {
                    "new_requests": today_pending,
                    "processed": today_paid,
                },
            },
        }

    except Exception as e:
        logging.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail="Server error")



# ==================== ADMIN: Bank-Redeem Quota Override (Feb 2026) ============

class AdminUnblockRequest(BaseModel):
    user_id: str
    admin_id: str
    reason: Optional[str] = None  # audit trail


@router.post("/admin/bank-redeem/unblock")
async def admin_unblock_bank_redeem(body: AdminUnblockRequest):
    """Admin override — re-enable bank-redeem for a user previously
    blocked (either by lifetime-cap auto-block or by an earlier admin
    action). Does NOT reset lifetime_redeemed_inr — only the user-level
    `bank_redeem_blocked` flag is flipped. If the user is already at the
    cap, they will be re-blocked on next attempt by the runtime check.
    """
    user = await db.users.find_one({"uid": body.user_id}, {"_id": 0, "uid": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"uid": body.user_id},
        {"$set": {
            "bank_redeem_blocked": False,
            "bank_redeem_unblocked_at": datetime.now(timezone.utc).isoformat(),
            "bank_redeem_unblocked_by": body.admin_id,
        }, "$unset": {"bank_redeem_blocked_reason": ""}},
    )

    await db.audit_log.insert_one({
        "type": "bank_redeem_unblock",
        "user_id": body.user_id,
        "admin_id": body.admin_id,
        "reason": body.reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    quota = await compute_lifetime_redeem_quota(body.user_id)
    return {"success": True, "quota": quota}


@router.post("/admin/bank-redeem/block")
async def admin_block_bank_redeem(body: AdminUnblockRequest):
    """Admin override — force-block bank-redeem for a user (e.g., fraud)."""
    user = await db.users.find_one({"uid": body.user_id}, {"_id": 0, "uid": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"uid": body.user_id},
        {"$set": {
            "bank_redeem_blocked": True,
            "bank_redeem_blocked_at": datetime.now(timezone.utc).isoformat(),
            "bank_redeem_blocked_by": body.admin_id,
            "bank_redeem_blocked_reason": body.reason or "Disabled by admin.",
        }},
    )

    await db.audit_log.insert_one({
        "type": "bank_redeem_block",
        "user_id": body.user_id,
        "admin_id": body.admin_id,
        "reason": body.reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    quota = await compute_lifetime_redeem_quota(body.user_id)
    return {"success": True, "quota": quota}



# ==================== ADMIN: Benefit-Cap Bulk Cleanup (Feb 2026) ==============

class BenefitCapCleanupRequest(BaseModel):
    admin_id: str
    dry_run: bool = True  # safety: default to preview-only


async def _find_over_cap_users() -> list:
    """Return a list of users whose lifetime benefits exceed the cap.

    PERFORMANCE: Earlier version iterated every doc + called
    compute_lifetime_redeem_quota per user → O(users × 9 collection scans)
    which timed out on production-scale data (1000s of users). This
    rewrite uses ONE MongoDB aggregation pipeline per collection to sum
    amounts server-side, then merges three result dicts in Python.
    Final cost: 3 aggregations + N user lookups (N ≤ over-cap users).
    """
    BENEFIT_OK_STATUSES = [
        "approved", "paid", "completed", "success",
        "delivered", "SUCCESS", "COMPLETED", "PAID",
    ]

    async def _sum_amounts(coll, fields):
        """Aggregate sum(first-non-null amount field) per user_id."""
        # Build nested $ifNull cascade: ifNull(f1, ifNull(f2, ifNull(f3, ifNull(f4, 0))))
        expr = 0
        for fname in reversed(fields):
            expr = {"$ifNull": [f"${fname}", expr]}
        amount_expr = {"$toDouble": expr}
        pipeline = [
            {"$match": {"status": {"$in": BENEFIT_OK_STATUSES}}},
            {"$group": {
                "_id": "$user_id",
                "total": {"$sum": amount_expr},
            }},
            {"$match": {"total": {"$gt": 0}}},
        ]
        out = {}
        async for d in coll.aggregate(pipeline, allowDiskUse=True):
            uid = d.get("_id")
            if uid:
                out[uid] = float(d.get("total", 0) or 0)
        return out

    bt_sums = await _sum_amounts(
        db.bank_transfer_requests,
        ["withdrawal_amount", "amount_inr", "amount", "inr_amount"],
    )
    bw_sums = await _sum_amounts(
        db.bank_withdrawal_requests,
        ["amount_inr", "amount", "withdrawal_amount", "amount_requested"],
    )
    bp_sums = await _sum_amounts(
        db.bill_payment_requests,
        ["amount", "amount_inr", "inr_amount", "recharge_amount"],
    )

    combined = {}
    for src, key in ((bt_sums, "bt"), (bw_sums, "bw"), (bp_sums, "bp")):
        for uid, amt in src.items():
            c = combined.setdefault(uid, {"bt": 0, "bw": 0, "bp": 0})
            c[key] = amt

    over_cap_uids = [
        uid for uid, parts in combined.items()
        if (parts["bt"] + parts["bw"] + parts["bp"]) >= LIFETIME_BANK_REDEEM_CAP_INR
    ]

    if not over_cap_uids:
        return []

    # Fetch user docs in one batch query — skip already-blocked users
    users_cursor = db.users.find(
        {"uid": {"$in": over_cap_uids}},
        {"_id": 0, "uid": 1, "name": 1, "mobile": 1, "bank_redeem_blocked": 1},
    )
    user_map = {u["uid"]: u async for u in users_cursor}

    affected = []
    for uid in over_cap_uids:
        u = user_map.get(uid)
        if not u or u.get("bank_redeem_blocked"):
            continue
        parts = combined[uid]
        bank_total = int(parts["bt"] + parts["bw"])
        bills_total = int(parts["bp"])

        pending = await db.bank_transfer_requests.find(
            {"user_id": uid, "status": "pending"},
            {"_id": 0, "request_id": 1, "total_prc": 1},
        ).to_list(500)
        pending_prc = sum(float(p.get("total_prc", 0) or 0) for p in pending)

        affected.append({
            "user_id": uid,
            "name": u.get("name") or "—",
            "mobile": u.get("mobile") or "—",
            "lifetime_redeemed_inr": bank_total + bills_total,
            "breakdown": {
                "bank_redeems_inr": bank_total,
                "recharges_and_bills_inr": bills_total,
                "subscription_inr_excluded": True,
            },
            "pending_count": len(pending),
            "pending_prc_to_refund": round(pending_prc, 2),
            "pending_request_ids": [p["request_id"] for p in pending],
        })

    affected.sort(key=lambda x: -x["lifetime_redeemed_inr"])
    return affected



@router.get("/admin/benefit-cap-cleanup/preview")
async def admin_benefit_cap_cleanup_preview():
    """Dry-run — find every user who has crossed the ₹2,500 benefits cap
    and is not yet marked as blocked, plus their pending requests / PRC
    that would be refunded. No writes happen here.
    """
    affected = await _find_over_cap_users()
    return {
        "success": True,
        "dry_run": True,
        "cap_inr": LIFETIME_BANK_REDEEM_CAP_INR,
        "users_to_block": len(affected),
        "total_pending_to_cancel": sum(u["pending_count"] for u in affected),
        "total_prc_to_refund": round(sum(u["pending_prc_to_refund"] for u in affected), 2),
        "affected_users": affected[:200],  # cap response to keep payload sane
        "truncated": len(affected) > 200,
    }


@router.post("/admin/benefit-cap-cleanup/execute")
async def admin_benefit_cap_cleanup_execute(body: BenefitCapCleanupRequest):
    """Actually run the cleanup. Steps per user:
      1. Cancel all PENDING bank_transfer_requests → status=cancelled
      2. Refund locked PRC back to user.prc_balance + ledger entry
      3. Set users.bank_redeem_blocked = True + reason
      4. Append audit_log row

    Idempotent — re-running is a no-op for users already processed.
    """
    if body.dry_run:
        # Fall back to preview if dry_run flag is set on the execute endpoint
        return await admin_benefit_cap_cleanup_preview()

    if not body.admin_id:
        raise HTTPException(status_code=400, detail="admin_id required for audit trail")

    affected = await _find_over_cap_users()
    now_iso = datetime.now(timezone.utc).isoformat()

    users_blocked = 0
    pending_cancelled = 0
    prc_refunded = 0.0

    for u in affected:
        uid = u["user_id"]
        for req_id in u["pending_request_ids"]:
            req = await db.bank_transfer_requests.find_one(
                {"request_id": req_id, "status": "pending"},
                {"_id": 0, "request_id": 1, "total_prc": 1},
            )
            if not req:
                continue
            prc_amt = float(req.get("total_prc", 0) or 0)
            await db.bank_transfer_requests.update_one(
                {"request_id": req_id},
                {"$set": {
                    "status": "cancelled",
                    "cancelled_at": now_iso,
                    "cancel_reason": "Lifetime ₹2,500 benefits cap reached — auto-cancelled by admin cleanup.",
                }},
            )
            if prc_amt > 0:
                await db.users.update_one(
                    {"uid": uid},
                    {"$inc": {"prc_balance": prc_amt}},
                )
                await db.prc_ledger.insert_one({
                    "uid": uid,
                    "type": "bank_redeem_refund_cleanup",
                    "amount": prc_amt,
                    "category": "benefit_cap_cleanup",
                    "description": f"Refund of pending bank-redeem #{req_id[:8]} (₹2,500 benefits cap reached)",
                    "created_at": now_iso,
                    "metadata": {"request_id": req_id, "trigger": "admin_benefit_cap_cleanup", "admin_id": body.admin_id},
                })
                prc_refunded += prc_amt
            pending_cancelled += 1

        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "bank_redeem_blocked": True,
                "bank_redeem_blocked_at": now_iso,
                "bank_redeem_blocked_by": body.admin_id,
                "bank_redeem_blocked_reason": (
                    f"Lifetime ₹{LIFETIME_BANK_REDEEM_CAP_INR:,} benefits cap reached "
                    f"(₹{u['lifetime_redeemed_inr']:,} used across recharges, bills and bank redeems)."
                ),
            }},
        )
        await db.audit_log.insert_one({
            "type": "bank_redeem_block_cleanup",
            "user_id": uid,
            "admin_id": body.admin_id,
            "lifetime_redeemed_inr": u["lifetime_redeemed_inr"],
            "pending_cancelled": u["pending_count"],
            "prc_refunded": u["pending_prc_to_refund"],
            "created_at": now_iso,
        })
        users_blocked += 1

    return {
        "success": True,
        "dry_run": False,
        "users_blocked": users_blocked,
        "pending_cancelled": pending_cancelled,
        "prc_refunded": round(prc_refunded, 2),
    }
