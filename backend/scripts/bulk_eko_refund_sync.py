"""
Bulk Eko refund-pending reconciliation — money returns to merchant Eko wallet.

CONTEXT:
  Eko Excel मध्ये "Refund pending" status वाले BBPS recharge transactions असतात.
  या transactions साठी Eko stock API आहे: /v2/transactions/{tid} (transaction inquiry).
  Eko response मध्ये tx_status:
    0 = Success
    1 = Failed
    2 = Pending/Initiated
    3 = Refund Pending (Eko processing — money will return to merchant wallet within 24-72h)
    4 = Refunded (money ALREADY in merchant Eko wallet)
    5 = On Hold

  This script queries each TID and:
    - tx_status=4 → mark our DB as refunded + credit user PRC back
    - tx_status=3 → log "Eko auto-refund in progress, will retry"
    - tx_status=1 → flag for manual review (escalate to Eko support)
    - tx_status=0 → mark as completed (false-failure on our side)

  ⚠️ NO OTPs are sent to customers. This is a SAFE bulk reconciliation.
  Customer-side OTP flow (refund/process endpoint) is for DMT cases where money
  goes back to customer's bank account.

USAGE:
  Dry-run (NO writes):
    python -m scripts.bulk_eko_refund_sync /path/to/eko.xlsx --dry-run

  Live:
    python -m scripts.bulk_eko_refund_sync /path/to/eko.xlsx --live

  Filter by mobile:
    python -m scripts.bulk_eko_refund_sync eko.xlsx --live --mobiles 9421331342,9970100782

  Filter by limit (test on 5 first):
    python -m scripts.bulk_eko_refund_sync eko.xlsx --live --limit 5

REF: https://developers.eko.in/reference/transaction-inquiry
"""
import asyncio
import argparse
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("bulk_eko_refund_sync")


def parse_excel(path: str):
    try:
        import openpyxl
    except ImportError:
        log.error("Run: pip install openpyxl")
        sys.exit(1)

    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    headers = [str(c or "").strip().lower() for c in rows[0]]
    col_map = {}
    for idx, h in enumerate(headers):
        if "transaction date" in h or h == "date":
            col_map["date"] = idx
        elif "eko transaction id" in h or "eko tid" in h:
            col_map["eko_tid"] = idx
        elif "client reference" in h:
            col_map["client_ref_id"] = idx
        elif "cellnumber" in h or "cell number" in h:
            col_map["mobile"] = idx
        elif h.startswith("amount"):
            col_map["amount"] = idx
        elif h == "status":
            col_map["status"] = idx

    log.info(f"Excel headers: {headers}")
    log.info(f"Column mapping: {col_map}")

    if not all(k in col_map for k in ("eko_tid", "client_ref_id", "mobile", "status")):
        log.error("Excel missing required columns")
        sys.exit(1)

    entries = []
    for row in rows[1:]:
        if not row or all(c is None for c in row):
            continue
        try:
            entry = {
                "eko_tid": str(row[col_map["eko_tid"]] or "").strip(),
                "client_ref_id": str(row[col_map["client_ref_id"]] or "").strip(),
                "mobile": str(row[col_map["mobile"]] or "").strip(),
                "amount": float(str(row[col_map["amount"]] or "0").replace(",", "") or 0) if "amount" in col_map else 0,
                "status": str(row[col_map["status"]] or "").strip().lower(),
                "date": str(row[col_map["date"]] or "") if "date" in col_map else "",
            }
            if entry["eko_tid"]:
                entries.append(entry)
        except (ValueError, IndexError):
            continue

    log.info(f"Parsed {len(entries)} entries from Excel")
    return entries


def build_eko_headers():
    """HMAC-SHA256 auth headers for Eko V2 transaction inquiry."""
    import base64
    import hmac
    import hashlib

    auth_key = os.environ["EKO_AUTH_KEY"]
    developer_key = os.environ["EKO_DEVELOPER_KEY"]

    timestamp = str(round(time.time() * 1000))
    encoded_key = base64.b64encode(auth_key.encode())
    secret_key = base64.b64encode(
        hmac.new(encoded_key, timestamp.encode(), hashlib.sha256).digest()
    ).decode()

    return {
        "developer_key": developer_key,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/json",
    }


async def query_eko_tx_status(client: httpx.AsyncClient, tid: str, initiator_id: str) -> dict:
    """Query Eko V2 transaction inquiry for a single TID. Returns parsed dict."""
    base_url = os.environ["EKO_BASE_URL"]
    url = f"{base_url}/v2/transactions/{tid}?initiator_id={initiator_id}"
    headers = build_eko_headers()

    try:
        r = await client.get(url, headers=headers, timeout=20)
        if r.status_code != 200:
            return {"ok": False, "error": f"HTTP {r.status_code}", "tid": tid}
        try:
            result = r.json()
        except Exception:
            return {"ok": False, "error": "Non-JSON response", "tid": tid}

        # Eko top-level status code 0 = inquiry succeeded
        if result.get("status") != 0:
            return {"ok": False, "error": result.get("message", "Eko rejected"), "tid": tid, "raw": result}

        eko_data = result.get("data") or {}
        tx_status = eko_data.get("tx_status")
        try:
            tx_status = int(tx_status) if tx_status is not None else None
        except (ValueError, TypeError):
            pass

        return {
            "ok": True,
            "tid": tid,
            "tx_status": tx_status,
            "tx_status_desc": eko_data.get("txstatus_desc", ""),
            "amount": eko_data.get("amount"),
            "client_ref_id": eko_data.get("client_ref_id"),
            "raw": eko_data,
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "tid": tid}


async def find_db_row(db, eko_tid: str, client_ref_id: str):
    """Search across all 4 collections for a row matching this TID/ClientRef."""
    collections = ["recharge_transactions", "bill_payment_requests", "dmt_transactions", "bank_transfer_requests"]
    for coll_name in collections:
        doc = await db[coll_name].find_one(
            {"$or": [
                {"eko_tid": eko_tid},
                {"client_ref_id": client_ref_id},
                {"eko_client_ref_id": client_ref_id},
            ]},
            {"_id": 0}
        )
        if doc:
            return doc, coll_name
    return None, None


async def process_entry(db, entry: dict, eko_status: dict, dry_run: bool, stats: dict):
    """Apply DB updates based on Eko's authoritative tx_status."""
    eko_tid = entry["eko_tid"]
    client_ref_id = entry["client_ref_id"]
    tx_status = eko_status.get("tx_status")
    now_iso = datetime.now(timezone.utc).isoformat()

    db_row, coll_name = await find_db_row(db, eko_tid, client_ref_id)
    user_id = (db_row or {}).get("user_id")
    prc_amount = (
        (db_row or {}).get("total_prc_deducted")
        or (db_row or {}).get("prc_deducted")
        or (db_row or {}).get("prc_amount")
        or 0
    )
    prc_already_refunded = (db_row or {}).get("prc_refunded", False)

    # Decision tree
    if tx_status == 4:
        # REFUNDED on Eko side — sync our DB
        if not db_row:
            log.warning(f"  ⚠ tx_status=4 but no DB row for TID {eko_tid} (ClientRef {client_ref_id}) — SKIP")
            stats["skipped_no_db_row"] += 1
            return

        if db_row.get("status") == "refunded" and prc_already_refunded:
            log.info(f"  • TID {eko_tid}: already synced as refunded → SKIP")
            stats["already_synced"] += 1
            return

        log.info(f"  ✓ TID {eko_tid} ({coll_name}): MARK refunded + credit {prc_amount} PRC to user {(user_id or '?')[:8]}")
        if not dry_run:
            await db[coll_name].update_many(
                {"$or": [{"eko_tid": eko_tid}, {"client_ref_id": client_ref_id}]},
                {"$set": {
                    "status": "refunded",
                    "eko_refunded_at": now_iso,
                    "refund_method": "bulk_sync_v2_inquiry",
                    "updated_at": now_iso,
                }}
            )
            # Credit PRC if not already refunded
            if user_id and prc_amount > 0 and not prc_already_refunded:
                await db.users.update_one(
                    {"uid": user_id},
                    {"$inc": {"prc_balance": prc_amount}}
                )
                await db[coll_name].update_one(
                    {"$or": [{"eko_tid": eko_tid}, {"client_ref_id": client_ref_id}]},
                    {"$set": {"prc_refunded": True, "refund_at": now_iso}}
                )
                stats["prc_credited_total"] += prc_amount
                # Audit transaction record
                await db.transactions.insert_one({
                    "user_id": user_id,
                    "type": "eko_refund",
                    "amount": prc_amount,
                    "description": f"Eko auto-refund confirmed (TID {eko_tid})",
                    "reference": eko_tid,
                    "created_at": now_iso,
                })
            # Audit log
            await db.eko_refund_logs.insert_one({
                "tid": eko_tid,
                "client_ref_id": client_ref_id,
                "user_id": user_id,
                "action": "bulk_sync_refunded",
                "result": "success",
                "tx_status_eko": 4,
                "prc_credited": prc_amount if not prc_already_refunded else 0,
                "ts": now_iso,
            })
        stats["marked_refunded"] += 1

    elif tx_status == 3:
        # Refund pending on Eko — money will auto-return; just track
        log.info(f"  ↺ TID {eko_tid}: Eko Refund Pending (auto-refund in progress)")
        if not dry_run:
            await db.eko_refund_logs.insert_one({
                "tid": eko_tid,
                "client_ref_id": client_ref_id,
                "action": "bulk_sync_pending",
                "tx_status_eko": 3,
                "ts": now_iso,
            })
        stats["eko_still_pending"] += 1

    elif tx_status == 1:
        # Eko says FAILED — money should be back in wallet but Eko didn't auto-refund
        log.warning(f"  ✗ TID {eko_tid}: Eko FAILED (manual escalation needed)")
        stats["eko_failed_needs_escalation"] += 1

    elif tx_status == 0:
        # SUCCESS — false failure on our side, transaction actually went through
        log.warning(f"  ✓ TID {eko_tid}: Eko SUCCESS — was incorrectly marked failed in DB")
        stats["was_actually_success"] += 1
        if db_row and db_row.get("status") in ("failed", "refund_pending") and not dry_run:
            await db[coll_name].update_one(
                {"$or": [{"eko_tid": eko_tid}, {"client_ref_id": client_ref_id}]},
                {"$set": {
                    "status": "completed",
                    "reconciled": True,
                    "reconciled_at": now_iso,
                    "reconcile_note": "Eko reports SUCCESS, DB had failed/refund_pending",
                    "updated_at": now_iso,
                }}
            )

    else:
        log.warning(f"  ? TID {eko_tid}: unknown tx_status={tx_status}")
        stats["unknown_status"] += 1


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("excel_path")
    parser.add_argument("--live", action="store_true", help="Apply DB writes (default: dry-run)")
    parser.add_argument("--mobiles", help="Comma-separated mobile filter")
    parser.add_argument("--limit", type=int, help="Process only first N entries")
    parser.add_argument("--concurrency", type=int, default=5, help="Parallel Eko queries (default 5)")
    args = parser.parse_args()

    if not Path(args.excel_path).exists():
        log.error(f"File not found: {args.excel_path}")
        sys.exit(1)

    dry_run = not args.live
    log.info("=" * 70)
    log.info("BULK EKO REFUND SYNC — money returns to merchant wallet (NO customer OTPs)")
    log.info(f"Mode: {'DRY-RUN' if dry_run else 'LIVE'}")
    log.info("=" * 70)

    load_dotenv(ROOT / ".env")

    if not all(os.environ.get(k) for k in ("EKO_BASE_URL", "EKO_DEVELOPER_KEY", "EKO_INITIATOR_ID", "EKO_AUTH_KEY", "MONGO_URL", "DB_NAME")):
        log.error("Missing required env vars (EKO_* or MONGO_URL)")
        sys.exit(1)

    initiator_id = os.environ["EKO_INITIATOR_ID"]
    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = cli[os.environ["DB_NAME"]]

    entries = parse_excel(args.excel_path)

    # Filter to "Refund pending" only (or unmatched)
    pending_only = [e for e in entries if "refund pending" in e["status"] or "refund_pending" in e["status"]]
    log.info(f"Found {len(pending_only)} 'Refund pending' entries in Excel")

    if args.mobiles:
        mobile_filter = {m.strip() for m in args.mobiles.split(",") if m.strip()}
        pending_only = [e for e in pending_only if e["mobile"] in mobile_filter]
        log.info(f"After mobile filter: {len(pending_only)} entries")

    if args.limit:
        pending_only = pending_only[:args.limit]
        log.info(f"Limited to first {args.limit} entries")

    if not pending_only:
        log.warning("No entries to process. Exiting.")
        cli.close()
        return

    stats = {
        "total_processed": 0,
        "marked_refunded": 0,
        "eko_still_pending": 0,
        "eko_failed_needs_escalation": 0,
        "was_actually_success": 0,
        "unknown_status": 0,
        "skipped_no_db_row": 0,
        "already_synced": 0,
        "eko_query_failed": 0,
        "prc_credited_total": 0.0,
    }

    # Process in batches of `concurrency`
    sem = asyncio.Semaphore(args.concurrency)

    async with httpx.AsyncClient() as client:
        async def _process(entry):
            async with sem:
                eko_status = await query_eko_tx_status(client, entry["eko_tid"], initiator_id)
                if not eko_status.get("ok"):
                    log.warning(f"  ⚠ TID {entry['eko_tid']}: Eko query failed → {eko_status.get('error')}")
                    stats["eko_query_failed"] += 1
                    return
                await process_entry(db, entry, eko_status, dry_run, stats)
                stats["total_processed"] += 1

        await asyncio.gather(*[_process(e) for e in pending_only])

    log.info("=" * 70)
    log.info("SUMMARY")
    log.info("=" * 70)
    log.info(f"  Excel rows processed:           {stats['total_processed']}")
    log.info(f"  Marked refunded (tx_status=4):  {stats['marked_refunded']}")
    log.info(f"  Eko still pending (tx_status=3): {stats['eko_still_pending']}")
    log.info(f"  Eko failed (needs escalation):  {stats['eko_failed_needs_escalation']}")
    log.info(f"  Was actually success (false neg): {stats['was_actually_success']}")
    log.info(f"  Already synced:                 {stats['already_synced']}")
    log.info(f"  Skipped (no DB row):            {stats['skipped_no_db_row']}")
    log.info(f"  Eko query failures:             {stats['eko_query_failed']}")
    log.info(f"  Total PRC credited to users:    {stats['prc_credited_total']:.2f}")
    log.info("=" * 70)
    if dry_run:
        log.info("DRY RUN. Re-run with --live to apply changes.")
    else:
        log.info("Sync complete. Pending entries will be re-checked on next run.")
        log.info("Re-run this script daily until all entries hit tx_status=4 (Refunded).")

    cli.close()


if __name__ == "__main__":
    asyncio.run(main())
