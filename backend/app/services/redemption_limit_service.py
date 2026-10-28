"""
Redemption Daily Limit Service (Sep 1 2026; Oct 2026: grows only on active-subscription days)
────────────────────────────────────────────────────────────────────────
Adds a cumulative PRC "redemption ceiling" that grows daily using
the formula:

     day_cap(N)      =  10 × N           # PRC added on day N
     cumulative(N)   =  5 × N × (N+1)    # total PRC unlocked by day N
     cycle length    =  365 days         # resets on day 366

Verified fixed points from product spec (Sep 1 2026):
  day 1  →       10 PRC
  day 4  →      100 PRC
  day 5  →      150 PRC
  day 31 (Jan-end) →   4,960 PRC
  day 59 (Feb-end) →  17,700 PRC
  day 365          → 667,950 PRC   (= ₹66,795 @ 10 PRC / ₹)

User fields (persisted on the users collection):
  • redemption_limit_start_date   ISO 8601 date the current 365-day
                                  cycle began.
  • redemption_limit_used_prc     PRC spent from this cycle's ceiling
                                  (recharge + utility + bank redeem).

Anchor rules (Q1):
  • Existing users:   start_date defaults to Sep 2 2026 (tomorrow).
  • New users:        start_date defaults to their first subscription
                      activation date.
  • Anchors are set lazily on first `get_status` call — no migration
    script needed.

Deduction rules (Q2/Q4):
  • On every successful recharge / bill / bank-redeem, we increment
    used_prc by the PRC-equivalent amount (INR × prc_rate).
  • Main PRC balance check is UNCHANGED — this is a second, parallel
    ceiling that runs alongside the existing balance / fee checks.

Reset rules (Q3):
  • On day 366 `get_status` transparently rolls forward — used_prc = 0
    and start_date = today. Callers see a fresh "day 1" without any
    manual admin action.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple


DAILY_INCREMENT_PRC = 10       # +10 PRC per day
CYCLE_LENGTH_DAYS = 365
PRC_TO_INR_RATE = 10            # 10 PRC = ₹1 (mirrors DEFAULT_CONFIG)
DEFAULT_EXISTING_USER_START = "2026-09-10T00:00:00+00:00"


def _cumulative_cap(day_number: int) -> float:
    """5 × N × (N + 1) — verified against every fixed point in the spec."""
    if day_number <= 0:
        return 0.0
    n = min(day_number, CYCLE_LENGTH_DAYS)
    return float(5 * n * (n + 1))


def _days_since(start_iso: str, now: Optional[datetime] = None) -> int:
    """Whole 24-h days elapsed since start (inclusive: same-day = day 1)."""
    now = now or datetime.now(timezone.utc)
    try:
        start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    except Exception:
        start_dt = now
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    delta = (now - start_dt).days
    return max(0, delta) + 1  # same-day counts as day 1


async def _resolve_start_date(user: dict) -> Tuple[str, bool]:
    """Return (start_date_iso, is_new_anchor).

    Preference order:
      1. existing user.redemption_limit_start_date
      2. subscription_start_date if available (new users flow)
      3. DEFAULT_EXISTING_USER_START (Sep 2 2026 for legacy accounts)
    """
    existing = user.get("redemption_limit_start_date")
    if existing:
        return existing, False
    sub_start = (user.get("subscription_start")
                 or user.get("subscription_started_at")
                 or user.get("subscription_activated_at"))
    if sub_start:
        return str(sub_start), True
    return DEFAULT_EXISTING_USER_START, True


PAID_PLANS = {"elite", "startup", "growth", "vip", "pro"}


def _parse(ts) -> Optional[datetime]:
    if not ts:
        return None
    if isinstance(ts, datetime):
        dt = ts
    else:
        try:
            dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        except Exception:
            return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _is_active_now(user: dict, now: datetime) -> bool:
    plan = (user.get("subscription_plan") or "").lower()
    if plan not in PAID_PLANS and user.get("membership_type") != "vip":
        return False
    exp = _parse(user.get("subscription_expiry"))
    return bool(exp and exp > now)


async def _active_intervals(db, user: dict, now: datetime) -> list:
    """Merged [(start, end)] periods when the user held a paid subscription."""
    uid = user["uid"]
    raw = []
    async for d in db.vip_payments.find({"user_id": uid, "status": "approved"},
                                        {"_id": 0, "approved_at": 1, "new_expiry": 1}):
        raw.append((_parse(d.get("approved_at")), _parse(d.get("new_expiry"))))
    async for d in db.subscription_payments.find(
            {"user_id": uid, "status": {"$in": ["paid", "active"]}},
            {"_id": 0, "subscription_start": 1, "activated_at": 1, "created_at": 1,
             "subscription_expiry": 1, "scheduled_end": 1}):
        raw.append((_parse(d.get("subscription_start") or d.get("activated_at") or d.get("created_at")),
                    _parse(d.get("subscription_expiry") or d.get("scheduled_end"))))
    async for d in db.subscriptions.find({"user_id": uid, "status": "active"},
                                         {"_id": 0, "start_date": 1, "end_date": 1, "expiry": 1}):
        raw.append((_parse(d.get("start_date")), _parse(d.get("end_date") or d.get("expiry"))))
    if _is_active_now(user, now):
        exp = _parse(user.get("subscription_expiry"))
        st = _parse(user.get("subscription_start") or user.get("subscription_start_date")
                    or user.get("subscription_activated_at")) or (exp - timedelta(days=30))
        raw.append((st, exp))

    spans = sorted((s, min(e, now)) for s, e in raw if s and e and min(e, now) > s)
    merged = []
    for s, e in spans:
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    return merged


def _active_seconds(intervals: list, since: datetime) -> float:
    return sum((e - max(s, since)).total_seconds() for s, e in intervals if e > since)


def _cycle_rollover_point(intervals: list, since: datetime) -> Optional[datetime]:
    """Moment when CYCLE_LENGTH_DAYS of active time completes after `since`."""
    left = CYCLE_LENGTH_DAYS * 86400.0
    for s, e in intervals:
        if e <= since:
            continue
        seg = (e - max(s, since)).total_seconds()
        if seg >= left:
            return max(s, since) + timedelta(seconds=left)
        left -= seg
    return None


async def get_status(db, user_id: str) -> dict:
    """Full redemption-limit snapshot for a user.

    The limit grows ONLY on days the user holds an active paid subscription:
    day_number = active subscription days since cycle start (paused while inactive).
    """
    user = await db.users.find_one({"uid": user_id})
    if not user:
        return {
            "user_id": user_id,
            "day_number": 0, "daily_increment": 0,
            "cumulative_cap": 0.0, "used_prc": 0.0, "available_prc": 0.0,
            "cycle_start_iso": None, "cycle_end_iso": None,
            "days_remaining": 0, "inr_available": 0.0,
            "prc_rate": PRC_TO_INR_RATE,
            "subscription_active": False, "is_paused": True, "ever_subscribed": False,
        }

    start_iso, is_new = await _resolve_start_date(user)
    now = datetime.now(timezone.utc)
    intervals = await _active_intervals(db, user, now)
    used = float(user.get("redemption_limit_used_prc") or 0.0)

    start_dt = _parse(start_iso) or now
    rolled = False
    while True:
        point = _cycle_rollover_point(intervals, start_dt)
        if not point or point > now:
            break
        start_dt, rolled = point, True
    if rolled:
        start_iso, used, is_new = start_dt.isoformat(), 0.0, False
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {"redemption_limit_start_date": start_iso, "redemption_limit_used_prc": 0.0}},
        )

    if is_new:
        await db.users.update_one(
            {"uid": user_id, "redemption_limit_start_date": {"$exists": False}},
            {"$set": {
                "redemption_limit_start_date": start_iso,
                "redemption_limit_used_prc": 0.0,
            }},
        )

    secs = _active_seconds(intervals, start_dt)
    day = min(CYCLE_LENGTH_DAYS, int(secs // 86400) + 1) if secs > 0 else 0
    active_now = _is_active_now(user, now)
    cap = _cumulative_cap(day)
    available = max(0.0, cap - used)
    days_remaining = max(0, CYCLE_LENGTH_DAYS - day)

    return {
        "user_id": user_id,
        "day_number": day,
        "daily_increment": DAILY_INCREMENT_PRC * day,
        "cumulative_cap": cap,
        "used_prc": round(used, 2),
        "available_prc": round(available, 2),
        "cycle_start_iso": start_iso,
        "cycle_end_iso": (now + timedelta(days=days_remaining)).isoformat() if active_now else None,
        "days_remaining": days_remaining,
        "inr_available": round(available / PRC_TO_INR_RATE, 2),
        "prc_rate": PRC_TO_INR_RATE,
        "subscription_active": active_now,
        "is_paused": not active_now,
        "ever_subscribed": bool(intervals),
    }


async def ensure_can_spend(db, user_id: str, prc_amount: float) -> Tuple[bool, dict, str]:
    """Read-only precheck. Returns (ok, snapshot, reason).

    Callers should raise HTTP 400 with `reason` if `ok` is False. Does
    NOT deduct — deduction is a separate atomic call from the success
    path of each spend flow (recharge / bill / bank redeem).
    """
    snap = await get_status(db, user_id)
    if prc_amount <= 0:
        return False, snap, "Invalid amount"
    if prc_amount > snap["available_prc"] + 1e-6:
        return False, snap, _limit_reason(snap)
    return True, snap, ""


def _limit_reason(snap: dict) -> str:
    avail = snap["available_prc"]
    avail = int(avail) if avail == int(avail) else round(avail, 2)
    return f"Available PRC LIMIT = {avail} PRC"


async def reserve(db, user_id: str, prc_amount: float, note: str) -> Tuple[bool, dict, str]:
    """Atomically consume `prc_amount` from the limit only if it still fits under today's cap.

    Concurrent requests cannot jointly overshoot the cap. Call `release(note)` if the spend later fails.
    """
    snap = await get_status(db, user_id)
    if prc_amount <= 0:
        return False, snap, "Invalid amount"
    res = await db.users.update_one(
        {"uid": user_id, "$expr": {"$lte": [
            {"$add": [{"$ifNull": ["$redemption_limit_used_prc", 0]}, float(prc_amount)]},
            snap["cumulative_cap"] + 1e-6,
        ]}},
        {"$inc": {"redemption_limit_used_prc": float(prc_amount)}},
    )
    if res.modified_count == 0:
        fresh = await get_status(db, user_id)
        return False, fresh, _limit_reason(fresh)
    await db.redemption_limit_audit.insert_one({
        "user_id": user_id,
        "prc_amount": float(prc_amount),
        "note": note,
        "released": False,
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return True, await get_status(db, user_id), ""


async def release(db, user_id: str, *notes: str) -> float:
    """Give back the limit consumed under `note` (failed / rejected / refunded spend). Idempotent."""
    user = await db.users.find_one({"uid": user_id}, {"_id": 0, "redemption_limit_start_date": 1})
    cycle_start = (user or {}).get("redemption_limit_start_date") or ""
    audit = await db.redemption_limit_audit.find_one_and_update(
        {"user_id": user_id, "note": {"$in": [n for n in notes if n]},
         "prc_amount": {"$gt": 0}, "released": {"$ne": True}, "ts": {"$gte": cycle_start}},
        {"$set": {"released": True, "released_at": datetime.now(timezone.utc).isoformat()}},
    )
    if not audit:
        return 0.0
    amt = float(audit["prc_amount"])
    await db.users.update_one(
        {"uid": user_id},
        [{"$set": {"redemption_limit_used_prc": {"$max": [
            0, {"$subtract": [{"$ifNull": ["$redemption_limit_used_prc", 0]}, amt]},
        ]}}}],
    )
    await db.redemption_limit_audit.insert_one({
        "user_id": user_id,
        "prc_amount": -amt,
        "note": f"release:{audit['note']}",
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return amt
