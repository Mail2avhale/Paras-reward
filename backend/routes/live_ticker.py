"""
Live Transaction Ticker - Public feed for bottom strip
Shows latest 50 SUCCESSFUL transactions across 4 categories:
  1. Mobile Recharge / Postpaid
  2. DTH Recharge
  3. Bank Redeem (Withdrawal)
  4. Subscription Activation
Privacy: mobile masked as "98******20", no names/emails returned.
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


def _mask_mobile(m: str) -> str:
    if not m or not isinstance(m, str):
        return "XX******XX"
    digits = "".join(c for c in m if c.isdigit())
    if len(digits) < 4:
        return "XX******XX"
    return digits[:2] + "******" + digits[-2:]


def _pick_created_at(doc: dict) -> str:
    for k in ("created_at", "timestamp", "approved_at", "updated_at"):
        v = doc.get(k)
        if v:
            return v if isinstance(v, str) else v.isoformat()
    return ""


async def _get_user_city(uid: str) -> str:
    if not uid:
        return ""
    try:
        u = await db.users.find_one({"uid": uid}, {"_id": 0, "city": 1, "address": 1, "mobile": 1})
        if not u:
            return ""
        city = u.get("city")
        if city and isinstance(city, str) and city.strip():
            return city.strip().title()
        # Fallback: attempt to parse from address field
        addr = u.get("address") or ""
        if isinstance(addr, str) and addr:
            # Naive last-token grab
            parts = [p.strip() for p in addr.replace(",", " ").split() if p.strip()]
            if parts:
                return parts[-1].title()[:20]
    except Exception:
        pass
    return ""


@router.get("/public/live-transactions")
async def get_live_transactions():
    """Public endpoint: latest 50 successful transactions for live ticker strip."""
    cache_key = "live_ticker:latest_50"
    if cache:
        try:
            cached = await cache.get(cache_key)
            if cached:
                return cached
        except Exception:
            pass

    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=60)).isoformat()

    items = []

    # 1. Mobile Recharge / Postpaid / DTH (from redeem_requests)
    try:
        rr_docs = await db.redeem_requests.find(
            {
                "status": {"$in": ["completed", "approved", "success"]},
                "created_at": {"$gte": since},
            },
            {"_id": 0, "user_id": 1, "service_type": 1, "account_number": 1,
             "amount": 1, "amount_inr": 1, "created_at": 1, "details": 1},
        ).sort("created_at", -1).limit(30).to_list(30)
        for d in rr_docs:
            stype = (d.get("service_type") or "").lower()
            if "dth" in stype:
                service = "DTH Recharge"
                icon = "dth"
            elif "postpaid" in stype:
                service = "Mobile Postpaid"
                icon = "mobile"
            elif "prepaid" in stype or "mobile" in stype:
                service = "Mobile Recharge"
                icon = "mobile"
            else:
                service = (stype.replace("_", " ").title() or "Recharge")
                icon = "mobile"
            mobile_raw = d.get("account_number") or (d.get("details", {}) or {}).get("mobile_number", "")
            amt = d.get("amount") or d.get("amount_inr") or 0
            items.append({
                "uid": d.get("user_id"),
                "mobile": _mask_mobile(mobile_raw),
                "service": service,
                "icon": icon,
                "amount": round(float(amt or 0), 2),
                "created_at": _pick_created_at(d),
            })
    except Exception as e:
        logging.warning(f"[LIVE-TICKER] redeem_requests error: {e}")

    # 2. DTH from bill_payment_requests (if any)
    try:
        bp_docs = await db.bill_payment_requests.find(
            {
                "status": {"$in": ["completed", "approved", "success"]},
                "bill_type": {"$in": ["dth", "DTH", "Dth"]},
                "created_at": {"$gte": since},
            },
            {"_id": 0, "user_id": 1, "consumer_number": 1, "amount_inr": 1,
             "created_at": 1, "operator_name": 1, "bill_type": 1},
        ).sort("created_at", -1).limit(10).to_list(10)
        for d in bp_docs:
            items.append({
                "uid": d.get("user_id"),
                "mobile": _mask_mobile(d.get("consumer_number", "")),
                "service": "DTH Recharge",
                "icon": "dth",
                "amount": round(float(d.get("amount_inr", 0) or 0), 2),
                "created_at": _pick_created_at(d),
            })
    except Exception as e:
        logging.warning(f"[LIVE-TICKER] bill_payment_requests DTH error: {e}")

    # 3. Bank Redeem (Withdrawal)
    try:
        bw_docs = await db.bank_withdrawal_requests.find(
            {
                "status": {"$in": ["completed", "approved", "success", "paid"]},
                "created_at": {"$gte": since},
            },
            {"_id": 0, "user_id": 1, "user_mobile": 1, "amount_inr": 1, "created_at": 1},
        ).sort("created_at", -1).limit(20).to_list(20)
        for d in bw_docs:
            items.append({
                "uid": d.get("user_id"),
                "mobile": _mask_mobile(d.get("user_mobile", "")),
                "service": "Bank Redeem",
                "icon": "bank",
                "amount": round(float(d.get("amount_inr", 0) or 0), 2),
                "created_at": _pick_created_at(d),
            })
    except Exception as e:
        logging.warning(f"[LIVE-TICKER] bank_withdrawal error: {e}")

    # 3b. Chatbot withdrawal requests (legacy)
    try:
        cw_docs = await db.chatbot_withdrawal_requests.find(
            {
                "status": {"$in": ["completed", "approved", "success", "paid"]},
                "created_at": {"$gte": since},
            },
            {"_id": 0, "uid": 1, "mobile": 1, "inr_amount": 1, "created_at": 1},
        ).sort("created_at", -1).limit(10).to_list(10)
        for d in cw_docs:
            items.append({
                "uid": d.get("uid"),
                "mobile": _mask_mobile(d.get("mobile", "")),
                "service": "Bank Redeem",
                "icon": "bank",
                "amount": round(float(d.get("inr_amount", 0) or 0), 2),
                "created_at": _pick_created_at(d),
            })
    except Exception as e:
        logging.warning(f"[LIVE-TICKER] chatbot_withdrawal error: {e}")

    # 4. Subscription (paid)
    try:
        sub_docs = await db.subscription_payments.find(
            {"status": "paid", "created_at": {"$gte": since}},
            {"_id": 0, "user_id": 1, "plan_name": 1, "plan_type": 1,
             "inr_equivalent": 1, "prc_amount": 1, "created_at": 1},
        ).sort("created_at", -1).limit(20).to_list(20)
        for d in sub_docs:
            plan = (d.get("plan_name") or d.get("plan_type") or "plan").title()
            amt = d.get("inr_equivalent") or d.get("prc_amount") or 0
            items.append({
                "uid": d.get("user_id"),
                "mobile": "",  # Filled below after user lookup
                "service": f"{plan} Subscription",
                "icon": "crown",
                "amount": round(float(amt or 0), 2),
                "created_at": _pick_created_at(d),
                "_needs_mobile": True,
            })
    except Exception as e:
        logging.warning(f"[LIVE-TICKER] subscription error: {e}")

    # Sort by created_at desc
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items = items[:50]

    # Enrich: fill masked mobile for subscriptions + city for all
    uids = list({i["uid"] for i in items if i.get("uid")})
    user_map = {}
    if uids:
        try:
            users_list = await db.users.find(
                {"uid": {"$in": uids}},
                {"_id": 0, "uid": 1, "mobile": 1, "city": 1, "address": 1}
            ).to_list(len(uids))
            user_map = {u["uid"]: u for u in users_list}
        except Exception:
            user_map = {}

    for it in items:
        u = user_map.get(it.get("uid") or "", {})
        if it.pop("_needs_mobile", False):
            it["mobile"] = _mask_mobile(u.get("mobile", ""))
        # City (best-effort, never blocking)
        city = u.get("city")
        if not city and isinstance(u.get("address"), str):
            # naive last-token grab
            parts = [p.strip() for p in u["address"].replace(",", " ").split() if p.strip()]
            if parts:
                city = parts[-1][:20]
        it["city"] = (city or "").strip().title()[:20] if city else ""
        # Drop uid before returning (no PII leak)
        it.pop("uid", None)

    payload = {"success": True, "count": len(items), "items": items}

    if cache:
        try:
            await cache.set(cache_key, payload, ttl=30)
        except Exception:
            pass

    return payload
