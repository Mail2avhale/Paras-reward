"""
Live Transaction Ticker - Public feed for bottom strip
Shows latest 50 SUCCESSFUL transactions across ALL categories:
  • Mobile Recharge / Postpaid
  • DTH Recharge
  • Bank Redeem (Withdrawal)
  • Electricity Bill / Gas / Water / Broadband / Loan / Insurance (BBPS)
  • Subscription Activation
Privacy: mobile/consumer masked, no names/emails returned.
"""
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter

router = APIRouter(tags=["Live Ticker"])

db = None
cache = None


def set_db(database):
    global db
    db = database


def set_cache(cache_instance):
    global cache
    cache = cache_instance


# Maps service_type / bill_type → (display label, icon)
SERVICE_LABELS = {
    # Mobile
    "mobile_recharge": ("Mobile Recharge", "mobile"),
    "mobile_prepaid": ("Mobile Recharge", "mobile"),
    "prepaid": ("Mobile Recharge", "mobile"),
    "mobile_postpaid": ("Mobile Postpaid", "mobile"),
    "postpaid": ("Mobile Postpaid", "mobile"),
    # DTH
    "dth": ("DTH Recharge", "dth"),
    "dth_recharge": ("DTH Recharge", "dth"),
    # Bank Redeem
    "bank_transfer": ("Bank Redeem", "bank"),
    "bank_withdrawal": ("Bank Redeem", "bank"),
    # BBPS
    "electricity": ("Electricity Bill", "bolt"),
    "gas": ("Gas Bill", "fire"),
    "piped_gas": ("Gas Bill", "fire"),
    "lpg_gas": ("LPG Booking", "fire"),
    "water": ("Water Bill", "droplet"),
    "broadband": ("Broadband Bill", "wifi"),
    "landline": ("Landline Bill", "wifi"),
    "loan": ("Loan EMI", "receipt"),
    "loan_repayment": ("Loan EMI", "receipt"),
    "insurance": ("Insurance Premium", "shield"),
    "fastag": ("FASTag Recharge", "receipt"),
    "cable": ("Cable TV Bill", "dth"),
    "housing_society": ("Society Bill", "receipt"),
    "municipal": ("Municipal Tax", "receipt"),
    "education": ("Education Fee", "receipt"),
}

SUCCESS_STATUSES = [
    # lowercase
    "completed", "approved", "success", "paid",
    # PascalCase
    "Paid", "Completed", "Approved", "Success",
    # UPPERCASE (unified_redeem_v2 uses these)
    "PAID", "COMPLETED", "SUCCESS", "APPROVED",
]


def _mask_account(v: str) -> str:
    """Mask mobile/consumer/account number as XX******XX (first 2 + 6 stars + last 2)."""
    if not v or not isinstance(v, str):
        return "XX******XX"
    digits = "".join(c for c in v if c.isdigit())
    if len(digits) < 4:
        return "XX******XX"
    return digits[:2] + "******" + digits[-2:]


def _pick_created_at(doc: dict) -> str:
    for k in ("created_at", "approved_at", "timestamp", "updated_at", "eko_callback_at"):
        v = doc.get(k)
        if v:
            return v if isinstance(v, str) else v.isoformat()
    return ""


def _resolve_service(stype: str) -> tuple:
    """Resolve service_type/bill_type to (label, icon). Fallback: Title Case."""
    if not stype:
        return ("Transaction", "receipt")
    key = stype.lower().strip().replace(" ", "_")
    if key in SERVICE_LABELS:
        return SERVICE_LABELS[key]
    # Fallback: title-case the raw string
    return (key.replace("_", " ").title(), "receipt")


@router.get("/public/live-transactions")
async def get_live_transactions():
    """Public endpoint: latest 100 SUCCESSFUL transactions (time-desc) across ALL services."""
    cache_key = "live_ticker:latest_100:v5_timedesc"
    if cache:
        try:
            cached = await cache.get(cache_key)
            if cached:
                return cached
        except Exception:
            pass

    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=90)).isoformat()
    items = []

    # 1. redeem_requests — covers mobile/DTH/postpaid/bank_transfer/electricity (user app router)
    try:
        rr_docs = await db.redeem_requests.find(
            {"status": {"$in": SUCCESS_STATUSES}, "created_at": {"$gte": since}},
            {"_id": 0, "user_id": 1, "service_type": 1, "account_number": 1,
             "amount": 1, "amount_inr": 1, "created_at": 1, "approved_at": 1, "details": 1},
        ).sort("created_at", -1).limit(120).to_list(120)
        for d in rr_docs:
            label, icon = _resolve_service(d.get("service_type"))
            acct = d.get("account_number") or (d.get("details", {}) or {}).get("mobile_number", "") or ""
            amt = d.get("amount_inr") or d.get("amount") or 0
            items.append({
                "uid": d.get("user_id"),
                "mobile": _mask_account(acct),
                "service": label, "icon": icon,
                "amount": round(float(amt or 0), 2),
                "created_at": _pick_created_at(d),
            })
    except Exception as e:
        logging.warning(f"[LIVE-TICKER] redeem_requests error: {e}")

    # 2. bill_payment_requests — all BBPS bill_types (electricity/gas/water/etc.)
    try:
        bp_docs = await db.bill_payment_requests.find(
            {"status": {"$in": SUCCESS_STATUSES}, "created_at": {"$gte": since}},
            {"_id": 0, "user_id": 1, "consumer_number": 1, "amount_inr": 1,
             "created_at": 1, "approved_at": 1, "operator_name": 1, "bill_type": 1},
        ).sort("created_at", -1).limit(120).to_list(120)
        for d in bp_docs:
            label, icon = _resolve_service(d.get("bill_type"))
            items.append({
                "uid": d.get("user_id"),
                "mobile": _mask_account(d.get("consumer_number", "")),
                "service": label, "icon": icon,
                "amount": round(float(d.get("amount_inr", 0) or 0), 2),
                "created_at": _pick_created_at(d),
            })
    except Exception as e:
        logging.warning(f"[LIVE-TICKER] bill_payment_requests error: {e}")

    # 3. bank_withdrawal_requests — modern bank redeems
    try:
        bw_docs = await db.bank_withdrawal_requests.find(
            {"status": {"$in": SUCCESS_STATUSES}, "created_at": {"$gte": since}},
            {"_id": 0, "user_id": 1, "user_mobile": 1, "amount_inr": 1, "created_at": 1, "approved_at": 1, "completed_at": 1},
        ).sort("created_at", -1).limit(80).to_list(80)
        for d in bw_docs:
            items.append({
                "uid": d.get("user_id"),
                "mobile": _mask_account(d.get("user_mobile", "")),
                "service": "Bank Redeem", "icon": "bank",
                "amount": round(float(d.get("amount_inr", 0) or 0), 2),
                "created_at": _pick_created_at(d),
                "_needs_mobile": True,  # enrich from users.mobile if user_mobile is empty
            })
    except Exception as e:
        logging.warning(f"[LIVE-TICKER] bank_withdrawal error: {e}")

    # 3b. bank_transfer_requests — admin-completed manual bank redeems (AdminBankTransfers page source)
    try:
        bt_docs = await db.bank_transfer_requests.find(
            {"status": {"$in": SUCCESS_STATUSES}, "created_at": {"$gte": since}},
            {"_id": 0, "user_id": 1, "user_mobile": 1, "amount": 1, "amount_inr": 1,
             "created_at": 1, "approved_at": 1, "completed_at": 1, "paid_at": 1},
        ).sort("created_at", -1).limit(80).to_list(80)
        for d in bt_docs:
            amt = d.get("amount_inr") or d.get("amount") or 0
            items.append({
                "uid": d.get("user_id"),
                "mobile": _mask_account(d.get("user_mobile", "")),
                "service": "Bank Redeem", "icon": "bank",
                "amount": round(float(amt or 0), 2),
                "created_at": _pick_created_at(d),
                "_needs_mobile": True,
            })
    except Exception as e:
        logging.warning(f"[LIVE-TICKER] bank_transfer error: {e}")

    # 4. chatbot_withdrawal_requests — legacy bank redeems
    try:
        cw_docs = await db.chatbot_withdrawal_requests.find(
            {"status": {"$in": SUCCESS_STATUSES}, "created_at": {"$gte": since}},
            {"_id": 0, "uid": 1, "mobile": 1, "inr_amount": 1, "created_at": 1, "approved_at": 1},
        ).sort("created_at", -1).limit(50).to_list(50)
        for d in cw_docs:
            items.append({
                "uid": d.get("uid"),
                "mobile": _mask_account(d.get("mobile", "")),
                "service": "Bank Redeem", "icon": "bank",
                "amount": round(float(d.get("inr_amount", 0) or 0), 2),
                "created_at": _pick_created_at(d),
            })
    except Exception as e:
        logging.warning(f"[LIVE-TICKER] chatbot_withdrawal error: {e}")

    # 5. subscription_payments (paid)
    try:
        sub_docs = await db.subscription_payments.find(
            {"status": "paid", "created_at": {"$gte": since}},
            {"_id": 0, "user_id": 1, "plan_name": 1, "plan_type": 1,
             "inr_equivalent": 1, "prc_amount": 1, "created_at": 1},
        ).sort("created_at", -1).limit(80).to_list(80)
        for d in sub_docs:
            plan = (d.get("plan_name") or d.get("plan_type") or "plan").title()
            amt = d.get("inr_equivalent") or d.get("prc_amount") or 0
            items.append({
                "uid": d.get("user_id"),
                "mobile": "",
                "service": f"{plan} Subscription", "icon": "crown",
                "amount": round(float(amt or 0), 2),
                "created_at": _pick_created_at(d),
                "_needs_mobile": True,
            })
    except Exception as e:
        logging.warning(f"[LIVE-TICKER] subscription error: {e}")

    # ----- LATEST-FIRST (time-desc), top 100 across ALL services -----
    # Drop items with missing service label or zero amount (incomplete legacy data)
    items = [i for i in items if i.get("service") and i["service"] != "Transaction" and (i.get("amount") or 0) > 0]
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items = items[:100]

    # Enrich: mobile fallback for subscriptions + city from user profile
    uids = list({i["uid"] for i in items if i.get("uid")})
    user_map = {}
    if uids:
        try:
            users_list = await db.users.find(
                {"uid": {"$in": uids}},
                {"_id": 0, "uid": 1, "mobile": 1, "city": 1, "address": 1},
            ).to_list(len(uids))
            user_map = {u["uid"]: u for u in users_list}
        except Exception:
            user_map = {}

    for it in items:
        u = user_map.get(it.get("uid") or "", {})
        # Enrich mobile from user profile if flagged OR current mask is the all-X fallback (empty source)
        if it.pop("_needs_mobile", False) or it.get("mobile") == "XX******XX":
            enriched = _mask_account(u.get("mobile", ""))
            if enriched != "XX******XX":
                it["mobile"] = enriched
        city = u.get("city")
        if not city and isinstance(u.get("address"), str):
            parts = [p.strip() for p in u["address"].replace(",", " ").split() if p.strip()]
            if parts:
                city = parts[-1][:20]
        it["city"] = (city or "").strip().title()[:20] if city else ""
        it.pop("uid", None)

    payload = {"success": True, "count": len(items), "items": items}
    if cache:
        try:
            await cache.set(cache_key, payload, ttl=30)
        except Exception:
            pass
    return payload
