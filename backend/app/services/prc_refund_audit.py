"""PRC refund audit + idempotent refund for failed redemptions (Oct 2026).

Truth per request: ledger (debits vs refund credits by `reference`) when present,
else flags (`prc_refunded`, `refund_amount`) + deducted amount fields.
Double-refund guard: unique `refund_events._id` + atomic `prc_refunded` claim.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta

from pymongo.errors import DuplicateKeyError

COLLS = ["redeem_requests", "recharge_transactions", "bill_payment_requests"]
FAILED_STATUSES = ["failed", "FAILED", "Failed", "retry_failed", "RETRY_FAILED", "eko_failed",
                   "rejected", "REJECTED", "cancelled"]
STUCK_STATUSES = ["pending", "PENDING", "processing", "PROCESSING", "retrying"]
REFUND_PENDING_STATUSES = ["refund_pending", "REFUND_PENDING"]
AUTO_MAX_PRC = 50000.0
STUCK_AFTER_HOURS = 24
BATCH = 500

_indexes_ready = False


def _now():
    return datetime.now(timezone.utc).isoformat()


async def ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    for coll, field in (("ledger", "reference"), ("transactions", "reference"),
                        ("transactions", "metadata.request_id")):
        try:
            await db[coll].create_index(field, background=True)
        except Exception as e:
            logging.warning(f"[REFUND-AUDIT] index {coll}.{field}: {e}")
    try:
        await db.refund_audit_items.create_index([("run_id", 1), ("category", 1)])
    except Exception:
        pass
    _indexes_ready = True


def _deducted(doc) -> float:
    for k in ("total_prc_deducted", "prc_deducted", "total_prc", "prc_amount"):
        try:
            v = float(doc.get(k) or 0)
        except (TypeError, ValueError):
            v = 0
        if v > 0:
            return round(v, 2)
    return 0.0


def _is_flagged(doc) -> bool:
    return bool(doc.get("prc_refunded")) or str(doc.get("status", "")).lower() == "refunded"


async def _evidence(db, rids):
    await ensure_indexes(db)
    ev = {r: {"debits": 0.0, "credits": 0.0, "debit_count": 0, "other_credit": 0.0} for r in rids}
    async for e in db.ledger.find({"reference": {"$in": rids}},
                                  {"_id": 0, "reference": 1, "entry_type": 1, "amount": 1}):
        x = ev.get(e.get("reference"))
        if x is None:
            continue
        amt = abs(float(e.get("amount") or 0))
        if e.get("entry_type") == "debit":
            x["debits"] += amt
            x["debit_count"] += 1
        elif e.get("entry_type") == "credit":
            x["credits"] += amt
    async for e in db.transactions.find(
            {"$or": [{"metadata.request_id": {"$in": rids}}, {"reference": {"$in": rids}}]},
            {"_id": 0, "reference": 1, "metadata.request_id": 1, "type": 1, "transaction_type": 1, "amount": 1}):
        t = str(e.get("type") or e.get("transaction_type") or "").lower()
        if "refund" not in t:
            continue
        rid = e.get("reference") if e.get("reference") in ev else (e.get("metadata") or {}).get("request_id")
        if rid in ev:
            ev[rid]["other_credit"] += abs(float(e.get("amount") or 0))
    return ev


def classify(doc, ev):
    """Return (category, prc_amount). category: refunded | missing | review | not_deducted."""
    flagged = _is_flagged(doc)
    if ev["debits"] > 0:
        missing = round(ev["debits"] - ev["credits"] - ev["other_credit"], 2)
        if missing <= 0.5:
            return "refunded", round(ev["credits"] + ev["other_credit"], 2)
        return ("review" if flagged else "missing"), missing
    if flagged:
        return "refunded", float(doc.get("prc_refund_amount") or doc.get("refund_amount") or _deducted(doc))
    d = _deducted(doc)
    if d <= 0:
        return "not_deducted", 0.0
    if ev["other_credit"] > 0:
        return "review", d
    return "missing", d


def refund_state(doc, ev):
    """classify() for admin display; Eko refund-pending rows are not refundable from here."""
    cat, amt = classify(doc, ev)
    if cat == "missing" and doc.get("status") in REFUND_PENDING_STATUSES:
        return "eko_refund_pending", amt
    return cat, amt


async def refund_request(db, coll, doc, amount, reason, source, debit_count=0):
    """Idempotent PRC refund with ledger entry. Returns {"ok", "status", ...}."""
    from app.services.wallet_service_v2 import WalletServiceV2
    rid, uid = doc["request_id"], doc.get("user_id")
    amount = round(float(amount or 0), 2)
    if not uid or amount <= 0:
        return {"ok": False, "status": "invalid"}
    key = f"{coll}:{rid}:{debit_count}"
    try:
        await db.refund_events.insert_one({"_id": key, "request_id": rid, "collection": coll, "user_id": uid,
                                           "amount": amount, "source": source, "status": "claimed", "ts": _now()})
    except DuplicateKeyError:
        return {"ok": False, "status": "already_refunded"}
    claim = await db[coll].update_one(
        {"request_id": rid, "prc_refunded": {"$ne": True}},
        {"$set": {"prc_refunded": True, "prc_refund_amount": amount, "refund_at": _now(),
                  "refund_source": source, "refund_reason": reason}},
    )
    if claim.modified_count == 0:
        await db.refund_events.update_one({"_id": key}, {"$set": {"status": "skipped_flagged"}})
        return {"ok": False, "status": "already_refunded"}
    label = doc.get("service_name") or ("Mobile Recharge" if doc.get("recharge_type") == "mobile"
                                        else "DTH Recharge" if doc.get("recharge_type") == "dth"
                                        else doc.get("service_type") or doc.get("request_type") or "Redeem")
    res = await asyncio.to_thread(
        WalletServiceV2.credit, uid, amount, "refund",
        f"Refund: {label} failed" + (f" - ₹{doc.get('amount_inr') or doc.get('amount')}" if (doc.get('amount_inr') or doc.get('amount')) else ""),
        rid, doc.get("service_type") or doc.get("recharge_type"), {"refund_source": source, "collection": coll},
    )
    if not res.get("success"):
        await db[coll].update_one({"request_id": rid}, {"$set": {"prc_refunded": False},
                                                         "$unset": {"prc_refund_amount": "", "refund_source": ""}})
        await db.refund_events.delete_one({"_id": key})
        return {"ok": False, "status": "credit_failed", "error": res.get("error")}
    if coll == "recharge_transactions":
        await db.bill_payment_requests.update_one(
            {"request_id": rid}, {"$set": {"prc_refunded": True, "prc_refund_amount": amount, "refund_at": _now()}})
    try:
        from app.services.redemption_limit_service import release
        await release(db, uid, f"recharge:{rid}", f"bank_transfer:{rid}", f"redeem:{rid}")
    except Exception as e:
        logging.warning(f"[REFUND-AUDIT] limit release failed {rid}: {e}")
    await db.refund_events.update_one({"_id": key}, {"$set": {"status": "done", "txn_id": res.get("txn_id")}})
    logging.info(f"[REFUND-AUDIT] refunded {amount} PRC → {uid} for {coll}:{rid} ({source})")
    return {"ok": True, "status": "refunded", "txn_id": res.get("txn_id"), "amount": amount}


async def _eko_lookup(doc):
    """Return Eko tx_status int or None."""
    import httpx
    import time
    from routes import eko_recharge as er
    if not er._eko_configured():
        return None
    tid = doc.get("eko_tid") or doc.get("tid")
    ref = doc.get("client_ref_id") or doc.get("eko_client_ref_id")
    lookup = tid if tid and str(tid) not in ("N/A", "null", "None") else (f"client_ref_id:{ref}" if ref else None)
    if not lookup:
        return None
    try:
        headers = er._generate_headers(str(round(time.time() * 1000)))
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(f"{er.BASE_URL}/v1/transactions/{lookup}", headers=headers,
                            params={"initiator_id": er.INITIATOR_ID, "user_code": er.USER_CODE})
        return er._parse_tx_status((r.json().get("data") or {}).get("tx_status"))
    except Exception as e:
        logging.warning(f"[REFUND-AUDIT] Eko lookup failed for {doc.get('request_id')}: {e}")
        return None


async def _resolve_stuck(db, coll, doc):
    """Ask Eko; mark failed (so it becomes refundable) only when Eko says failed/refunded."""
    tx = await _eko_lookup(doc)
    if tx in (1, 4):
        await db[coll].update_one({"request_id": doc["request_id"], "status": doc.get("status")},
                                  {"$set": {"status": "failed", "eko_enquiry_at": _now(),
                                            "failure_reason": "Eko reported failed (refund audit)"}})
        return "eko_failed"
    if tx == 0:
        return "eko_success"
    if tx == 3:
        return "eko_refund_pending"
    return "eko_unknown"


async def run_audit(db, run_id, apply=False, auto=False, check_stuck=True, stuck_limit=100):
    """Scan, classify and (optionally) refund. Progress stored in refund_audit_runs."""
    await ensure_indexes(db)
    runs = db.refund_audit_runs
    summary = {c: 0 for c in ("missing", "review", "refunded_now", "not_deducted", "stuck_checked",
                              "stuck_failed", "stuck_success", "stuck_unknown", "refund_pending", "skipped_large")}
    summary["missing_prc"] = 0.0
    summary["refunded_now_prc"] = 0.0
    summary["already_refunded"] = 0
    try:
        stuck_cut = (datetime.now(timezone.utc) - timedelta(hours=STUCK_AFTER_HOURS)).isoformat()
        stuck_done = 0
        for coll in COLLS:
            summary["already_refunded"] += await db[coll].count_documents(
                {"status": {"$in": FAILED_STATUSES + ["refunded"]}, "prc_refunded": True})
            summary["refund_pending"] += await db[coll].count_documents({"status": {"$in": REFUND_PENDING_STATUSES}})
            if check_stuck and coll != "bill_payment_requests":
                stuck_q = {"status": {"$in": STUCK_STATUSES},
                           "$or": [{"created_at": {"$lt": stuck_cut}},
                                   {"created_at": {"$lt": datetime.fromisoformat(stuck_cut)}}]}
                async for d in db[coll].find(stuck_q,
                                             {"_id": 0}).sort("created_at", 1).limit(max(0, stuck_limit - stuck_done)):
                    stuck_done += 1
                    summary["stuck_checked"] += 1
                    r = await _resolve_stuck(db, coll, d)
                    summary[{"eko_failed": "stuck_failed", "eko_success": "stuck_success"}.get(r, "stuck_unknown")] += 1
                    await asyncio.sleep(0.3)
            q = {"status": {"$in": FAILED_STATUSES}, "prc_refunded": {"$ne": True}}
            cursor = db[coll].find(q, {"_id": 0, "eko_response": 0, "status_history": 0}).sort("created_at", -1)
            batch = []
            async for d in cursor:
                if d.get("request_id"):
                    batch.append(d)
                if len(batch) >= BATCH:
                    await _process_batch(db, run_id, coll, batch, apply, auto, summary)
                    batch = []
                    await runs.update_one({"_id": run_id}, {"$set": {"summary": summary, "updated_at": _now()}})
            if batch:
                await _process_batch(db, run_id, coll, batch, apply, auto, summary)
        claim_cut = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
        async for ev in db.refund_events.find({"status": "claimed", "ts": {"$lt": claim_cut}}):
            summary["review"] += 1
            await db.refund_audit_items.insert_one({
                "run_id": run_id, "collection": ev.get("collection"), "request_id": ev.get("request_id"),
                "user_id": ev.get("user_id"), "category": "review", "prc_amount": ev.get("amount"),
                "note": "Refund was claimed but the wallet credit was not confirmed"})
        await runs.update_one({"_id": run_id}, {"$set": {"status": "done", "summary": summary, "finished_at": _now()}})
    except Exception as e:
        logging.exception("[REFUND-AUDIT] run failed")
        await runs.update_one({"_id": run_id}, {"$set": {"status": "error", "error": str(e)[:300], "summary": summary}})
    return summary


async def _process_batch(db, run_id, coll, docs, apply, auto, summary):
    rids = [d["request_id"] for d in docs]
    mirror = set()
    if coll == "bill_payment_requests":
        async for m in db.recharge_transactions.find({"request_id": {"$in": rids}}, {"_id": 0, "request_id": 1}):
            mirror.add(m["request_id"])
    ev = await _evidence(db, rids)
    items = []
    for d in docs:
        rid = d["request_id"]
        if rid in mirror:
            continue
        cat, amt = classify(d, ev[rid])
        if cat == "not_deducted":
            summary["not_deducted"] += 1
            continue
        if cat == "refunded":
            summary["already_refunded"] += 1
            continue
        item = {"run_id": run_id, "collection": coll, "request_id": rid, "user_id": d.get("user_id"),
                "user_name": d.get("user_name"), "user_mobile": d.get("user_mobile"),
                "service": d.get("service_name") or d.get("service_type") or d.get("recharge_type") or d.get("request_type"),
                "amount_inr": d.get("amount_inr") or d.get("amount"), "status": d.get("status"),
                "created_at": d.get("created_at"), "category": cat, "prc_amount": amt,
                "ledger_debits": ev[rid]["debits"], "ledger_credits": ev[rid]["credits"]}
        if cat == "missing":
            summary["missing"] += 1
            summary["missing_prc"] = round(summary["missing_prc"] + amt, 2)
            if apply and (not auto or amt <= AUTO_MAX_PRC):
                res = await refund_request(db, coll, d, amt, "Refund audit: failed transaction",
                                           "auto_refund_audit" if auto else "admin_refund_audit",
                                           ev[rid]["debit_count"])
                item["action"] = res.get("status")
                if res.get("ok"):
                    summary["refunded_now"] += 1
                    summary["refunded_now_prc"] = round(summary["refunded_now_prc"] + amt, 2)
            elif apply:
                summary["skipped_large"] += 1
                item["action"] = "skipped_large_needs_admin"
        else:
            summary["review"] += 1
        items.append(item)
    if items:
        await db.refund_audit_items.insert_many(items)


async def start_run(db, apply, auto, triggered_by):
    run_id = f"RFA-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
    stale = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    try:
        lock = await db.refund_audit_lock.find_one_and_update(
            {"_id": "run", "$or": [{"run_id": None}, {"started_at": {"$lt": stale}}]},
            {"$set": {"run_id": run_id, "started_at": _now()}}, upsert=True)
    except DuplicateKeyError:
        return None
    if lock and lock.get("run_id"):
        await db.refund_audit_runs.update_one({"_id": lock["run_id"], "status": "running"}, {"$set": {"status": "abandoned"}})
    await db.refund_audit_runs.insert_one({"_id": run_id, "status": "running", "apply": apply, "auto": auto,
                                           "triggered_by": triggered_by, "started_at": _now()})
    asyncio.create_task(_run_and_unlock(db, run_id, apply, auto))
    return run_id


async def _run_and_unlock(db, run_id, apply, auto):
    try:
        await run_audit(db, run_id, apply=apply, auto=auto)
    finally:
        await db.refund_audit_lock.update_one({"_id": "run", "run_id": run_id}, {"$set": {"run_id": None}})
