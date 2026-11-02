"""Admin PRC Refund Audit + cron auto-refund (Oct 2026)."""
import hmac
import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services import prc_refund_audit as pra

router = APIRouter(tags=["Refund Audit"])
db = None


def set_db(database):
    global db
    db = database


class RunRequest(BaseModel):
    apply: bool = False


class RefundOneRequest(BaseModel):
    collection: str
    request_id: str


def _admin_uid(request: Request):
    return (getattr(request.state, "admin_user", None) or {}).get("uid", "admin")


@router.post("/admin/refund-audit/run")
async def admin_run(data: RunRequest, request: Request):
    run_id = await pra.start_run(db, apply=data.apply, auto=False, triggered_by=_admin_uid(request))
    if not run_id:
        raise HTTPException(status_code=409, detail="An audit is already running. Please wait.")
    return {"success": True, "run_id": run_id}


@router.get("/admin/refund-audit/latest")
async def admin_latest():
    run = await db.refund_audit_runs.find_one({}, sort=[("started_at", -1)])
    if run:
        run["run_id"] = run.pop("_id")
    return {"run": run}


@router.get("/admin/refund-audit/items")
async def admin_items(run_id: str, category: str = "missing", page: int = 1, limit: int = 50):
    q = {"run_id": run_id, "category": category}
    total = await db.refund_audit_items.count_documents(q)
    rows = await db.refund_audit_items.find(q, {"_id": 0}).sort("prc_amount", -1) \
        .skip((max(page, 1) - 1) * limit).limit(min(limit, 200)).to_list(200)
    return {"items": rows, "total": total, "page": page}


@router.post("/admin/refund-audit/refund-one")
async def admin_refund_one(data: RefundOneRequest, request: Request):
    if data.collection not in pra.COLLS:
        raise HTTPException(status_code=400, detail="Invalid collection")
    doc = await db[data.collection].find_one({"request_id": data.request_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")
    if doc.get("status") not in pra.FAILED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Only failed transactions can be refunded (status: {doc.get('status')})")
    ev = (await pra._evidence(db, [data.request_id]))[data.request_id]
    cat, amt = pra.classify(doc, ev)
    if cat != "missing":
        raise HTTPException(status_code=400, detail=f"Not refundable: {cat.replace('_', ' ')}")
    res = await pra.refund_request(db, data.collection, doc, amt, "Admin refund audit",
                                   f"admin:{_admin_uid(request)}", ev["debit_count"])
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("status"))
    await db.refund_audit_items.update_many({"request_id": data.request_id}, {"$set": {"action": "refunded"}})
    return {"success": True, "amount": res["amount"], "txn_id": res.get("txn_id")}


@router.post("/cron/refund-audit")
async def cron_refund_audit(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not secret or not token or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid body")
    run_key = request.headers.get("X-Webhook-Id") or (body or {}).get("run_id")
    if run_key:
        try:
            await db.cron_runs.insert_one({"_id": f"refund-audit:{run_key}", "ts": pra._now()})
        except Exception:
            return {"accepted": True, "duplicate": True}
    run_id = await pra.start_run(db, apply=True, auto=True, triggered_by="cron")
    return {"accepted": True, "run_id": run_id}
