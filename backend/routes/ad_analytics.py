"""
Ad Events Analytics — funnel tracking for AdMob impressions
============================================================
Frontend (useAdMob.js + ForcedAdInterstitial.js) posts lifecycle events:
  - requested   — prepareRewardVideoAd() called
  - loaded      — ad ready in cache
  - show_attempt — showRewardVideoAd() called
  - completed   — user watched to end (impression logged by AdMob)
  - failed      — load/show failure
  - dismissed   — user closed early

Admin uses /api/admin/ad-analytics/funnel to see our own request→impression
ratio and diagnose the gap vs Google's AdMob dashboard.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="", tags=["Ad Analytics"])
db = None

ALLOWED_EVENTS = {"requested", "loaded", "show_attempt", "completed", "failed", "dismissed"}


def set_db(database):
    global db
    db = database


class AdEvent(BaseModel):
    event_type: str
    ad_unit: str
    placement: str = ""
    native: Optional[bool] = None
    error: Optional[str] = None
    reason: Optional[str] = None
    reward_type: Optional[str] = None
    reward_amount: Optional[float] = None


@router.post("/ad-events")
async def log_ad_event(data: AdEvent, request: Request):
    """Frontend fire-and-forget event logger. Never returns an error to the client."""
    if data.event_type not in ALLOWED_EVENTS:
        return {"success": False, "reason": "unknown_event"}
    now = datetime.now(timezone.utc).isoformat()
    # Best-effort: extract uid from Authorization header if present, else anonymous
    uid = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            import jwt, os
            token = auth[7:]
            payload = jwt.decode(token, os.environ["JWT_SECRET_KEY"], algorithms=["HS256"])
            uid = payload.get("sub") or payload.get("uid")
        except Exception:
            pass
    try:
        await db.ad_events.insert_one({
            "ts": now,
            "date": now[:10],
            "user_id": uid,
            "event_type": data.event_type,
            "ad_unit": data.ad_unit,
            "placement": data.placement,
            "native": data.native,
            "error": data.error,
            "reason": data.reason,
            "reward_type": data.reward_type,
            "reward_amount": data.reward_amount,
            "ip": request.client.host if request.client else "",
            "user_agent": request.headers.get("User-Agent", "")[:200],
        })
    except Exception:
        pass
    return {"success": True}


@router.get("/admin/ad-analytics/funnel")
async def funnel(from_date: Optional[str] = None, to_date: Optional[str] = None,
                 placement: Optional[str] = None):
    """Aggregate funnel counts per day. Buckets: requested, loaded, show_attempt, completed, failed, dismissed."""
    q: dict = {}
    if from_date:
        q["date"] = {"$gte": from_date}
    if to_date:
        q.setdefault("date", {})["$lte"] = to_date
    if placement:
        q["placement"] = placement

    pipeline = [
        {"$match": q},
        {"$group": {
            "_id": {"date": "$date", "event_type": "$event_type"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id.date": -1}},
    ]
    rows = await db.ad_events.aggregate(pipeline).to_list(5000)
    by_date: dict = {}
    for r in rows:
        d = r["_id"]["date"]
        e = r["_id"]["event_type"]
        by_date.setdefault(d, {ev: 0 for ev in ALLOWED_EVENTS})[e] = r["count"]

    output = []
    for d, ev in sorted(by_date.items(), reverse=True):
        req = ev.get("requested", 0)
        comp = ev.get("completed", 0)
        output.append({
            "date": d,
            **ev,
            "impression_rate": round(comp / req * 100, 1) if req else 0.0,
            "our_gap": req - comp,
        })
    return {"days": output, "total_days": len(output)}


@router.get("/admin/ad-analytics/summary")
async def summary(days: int = 7, placement: Optional[str] = None):
    """One-glance card: last N days totals."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    q: dict = {"date": {"$gte": since}}
    if placement:
        q["placement"] = placement
    pipeline = [
        {"$match": q},
        {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
    ]
    rows = await db.ad_events.aggregate(pipeline).to_list(20)
    totals = {ev: 0 for ev in ALLOWED_EVENTS}
    for r in rows:
        totals[r["_id"]] = r["count"]

    req = totals["requested"]
    comp = totals["completed"]
    return {
        "since": since,
        "days": days,
        "placement": placement,
        "totals": totals,
        "impression_rate": round(comp / req * 100, 1) if req else 0.0,
        "our_gap_absolute": req - comp,
    }


@router.get("/admin/ad-analytics/placements")
async def placements(days: int = 7):
    """Break down by placement — which button/screen is dragging impression rate down?"""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    pipeline = [
        {"$match": {"date": {"$gte": since}}},
        {"$group": {"_id": {"placement": "$placement", "event_type": "$event_type"}, "count": {"$sum": 1}}},
    ]
    rows = await db.ad_events.aggregate(pipeline).to_list(5000)
    by_placement: dict = {}
    for r in rows:
        p = r["_id"]["placement"] or "(unknown)"
        e = r["_id"]["event_type"]
        by_placement.setdefault(p, {ev: 0 for ev in ALLOWED_EVENTS})[e] = r["count"]
    output = []
    for p, ev in by_placement.items():
        req = ev.get("requested", 0)
        comp = ev.get("completed", 0)
        output.append({
            "placement": p, **ev,
            "impression_rate": round(comp / req * 100, 1) if req else 0.0,
        })
    output.sort(key=lambda x: x["requested"], reverse=True)
    return {"placements": output, "days": days}
