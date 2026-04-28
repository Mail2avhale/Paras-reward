"""
Sync Eko "Refund pending" entries from Excel → DB rows for user OTP refund flow.

PURPOSE:
  Eko Connect / Excel मध्ये काही transactions "Refund pending" status वर अडकले आहेत.
  त्यांना customer कडून OTP घेऊनच refund होऊ शकतो (Eko V1 API).
  आपल्या DB मध्ये या rows status="refund_pending" + eko_tid + client_ref_id + user_id
  सोबत असायला पाहिजेत — मगच user dashboard वर modal दिसेल आणि user OTP flow करू शकेल.

FLOW (idempotent, safe to re-run):
  1. Read Eko Excel file (path passed as arg)
  2. Filter rows where Status = "Refund pending" / "REFUND_PENDING"
  3. For each row:
     a. Lookup user by CellNumber (mobile) → get uid
     b. Search recharge_transactions for existing row by eko_tid OR client_ref_id
     c. If exists: update status=refund_pending + ensure eko_tid/client_ref_id present
     d. If not exists: create new row with all Eko fields + user_id
  4. Print summary

USAGE:
  Dry run (NO DB changes):
    python -m scripts.sync_eko_refund_pending /path/to/eko_excel.xlsx --dry-run

  Live run (writes to DB):
    python -m scripts.sync_eko_refund_pending /path/to/eko_excel.xlsx --live

  Filter by mobiles (only sync these):
    python -m scripts.sync_eko_refund_pending eko.xlsx --live --mobiles 9421331342,9970100782

POST-RUN:
  Once rows are in DB with status=refund_pending, the user can:
  1. Open dashboard → modal shows pending refunds
  2. Click "Send Refund OTP to my mobile" → Eko V1 sends SMS
  3. Enter OTP → refund complete + PRC credited back

REF: https://developers.eko.in/v1/reference/refund
"""
import asyncio
import argparse
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure we can import from /app/backend
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("sync_eko_refund_pending")

REFUND_PENDING_STATUSES = {"refund pending", "refund_pending", "refundpending", "REFUND_PENDING".lower()}


def normalize_status(raw: str) -> str:
    return str(raw or "").strip().lower().replace("-", " ")


def parse_excel(path: str):
    """Parse Eko Excel (xlsx) and return list of dicts."""
    try:
        import openpyxl
    except ImportError:
        log.error("openpyxl not installed. Run: pip install openpyxl")
        sys.exit(1)

    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        log.error("Excel is empty")
        return []

    # Find header row — case-insensitive lookup
    headers = [str(c or "").strip().lower() for c in rows[0]]
    col_map = {}
    for idx, h in enumerate(headers):
        if "transaction date" in h or h == "date":
            col_map["date"] = idx
        elif "eko transaction id" in h or h == "eko tid" or h == "tid":
            col_map["eko_tid"] = idx
        elif "client reference" in h or "client ref" in h:
            col_map["client_ref_id"] = idx
        elif "cellnumber" in h or "cell number" in h or "mobile" in h or "phone" in h:
            col_map["mobile"] = idx
        elif h.startswith("amount"):
            col_map["amount"] = idx
        elif h == "status":
            col_map["status"] = idx
        elif "operator" in h:
            col_map["operator"] = idx

    log.info(f"Excel headers: {headers}")
    log.info(f"Column mapping: {col_map}")

    required = {"eko_tid", "client_ref_id", "mobile", "amount", "status"}
    missing = required - set(col_map.keys())
    if missing:
        log.error(f"Excel missing required columns: {missing}")
        sys.exit(1)

    entries = []
    for row in rows[1:]:
        if not row or all(c is None for c in row):
            continue
        try:
            entry = {
                "date": str(row[col_map["date"]] or "") if "date" in col_map else "",
                "eko_tid": str(row[col_map["eko_tid"]] or "").strip(),
                "client_ref_id": str(row[col_map["client_ref_id"]] or "").strip(),
                "mobile": str(row[col_map["mobile"]] or "").strip(),
                "amount": float(str(row[col_map["amount"]] or "0").replace(",", "") or 0),
                "status": str(row[col_map["status"]] or "").strip(),
                "operator": str(row[col_map["operator"]] or "") if "operator" in col_map else "",
            }
            if entry["eko_tid"] and entry["client_ref_id"]:
                entries.append(entry)
        except (ValueError, IndexError) as e:
            log.warning(f"Skipping row {row}: {e}")
            continue

    log.info(f"Parsed {len(entries)} valid rows from Excel")
    return entries


async def sync_to_db(entries, db, dry_run=True, mobile_filter=None):
    """Sync refund_pending entries to recharge_transactions collection."""
    refund_pending_entries = [
        e for e in entries if normalize_status(e["status"]) in REFUND_PENDING_STATUSES
    ]
    log.info(f"Found {len(refund_pending_entries)} 'Refund pending' entries in Excel")

    if mobile_filter:
        refund_pending_entries = [e for e in refund_pending_entries if e["mobile"] in mobile_filter]
        log.info(f"After mobile filter ({len(mobile_filter)} mobiles): {len(refund_pending_entries)} entries")

    if not refund_pending_entries:
        log.warning("No matching refund_pending entries to process")
        return

    stats = {
        "matched_updated": 0,
        "created_new": 0,
        "skipped_no_user": 0,
        "already_synced": 0,
        "errors": 0,
    }

    # Pre-fetch all users by mobile for fast lookup
    mobiles = list({e["mobile"] for e in refund_pending_entries if e["mobile"]})
    log.info(f"Looking up {len(mobiles)} unique mobiles in users collection...")
    users_cursor = db.users.find(
        {"mobile": {"$in": mobiles}},
        {"_id": 0, "uid": 1, "mobile": 1, "name": 1}
    )
    user_by_mobile = {u["mobile"]: u for u in await users_cursor.to_list(None)}
    log.info(f"Matched {len(user_by_mobile)} users in DB")

    now_iso = datetime.now(timezone.utc).isoformat()

    for entry in refund_pending_entries:
        mobile = entry["mobile"]
        eko_tid = entry["eko_tid"]
        client_ref_id = entry["client_ref_id"]

        user = user_by_mobile.get(mobile)
        if not user:
            log.warning(f"  ⚠ No user found for mobile {mobile} (TID {eko_tid}) — SKIP")
            stats["skipped_no_user"] += 1
            continue

        uid = user["uid"]

        # Check if row already exists in recharge_transactions
        existing = await db.recharge_transactions.find_one(
            {"$or": [
                {"eko_tid": eko_tid},
                {"client_ref_id": client_ref_id},
            ]},
            {"_id": 0, "request_id": 1, "status": 1, "user_id": 1}
        )

        if existing and existing.get("status") == "refund_pending":
            log.info(f"  • Already synced: TID={eko_tid} (user={uid[:8]}, status=refund_pending)")
            stats["already_synced"] += 1
            continue

        if existing:
            # Update existing row → mark as refund_pending
            patch = {
                "status": "refund_pending",
                "eko_tid": eko_tid,
                "client_ref_id": client_ref_id,
                "updated_at": now_iso,
                "refund_pending_synced_at": now_iso,
                "refund_pending_source": "eko_excel_sync",
            }
            log.info(f"  → UPDATE: req={existing.get('request_id')} TID={eko_tid} (was status={existing.get('status')}) → refund_pending")
            if not dry_run:
                await db.recharge_transactions.update_one(
                    {"$or": [{"eko_tid": eko_tid}, {"client_ref_id": client_ref_id}]},
                    {"$set": patch}
                )
            stats["matched_updated"] += 1
        else:
            # Create new row
            new_doc = {
                "request_id": f"RECON-{eko_tid}",
                "user_id": uid,
                "user_name": user.get("name", ""),
                "service_type": "mobile_recharge",  # Best guess for BBPS Excel
                "operator": entry.get("operator", "") or "UNKNOWN",
                "amount": entry["amount"],
                "amount_inr": entry["amount"],
                "phone": mobile,
                "customer_mobile": mobile,
                "eko_tid": eko_tid,
                "client_ref_id": client_ref_id,
                "status": "refund_pending",
                "prc_refunded": False,
                "total_prc_deducted": 0,  # Unknown from Excel — admin can backfill if needed
                "created_at": entry.get("date") or now_iso,
                "updated_at": now_iso,
                "refund_pending_synced_at": now_iso,
                "refund_pending_source": "eko_excel_sync",
                "reconcile_note": "Created from Eko Excel sync — refund_pending awaiting user OTP",
            }
            log.info(f"  + CREATE: TID={eko_tid} user={uid[:8]} mobile={mobile} amount=₹{entry['amount']}")
            if not dry_run:
                await db.recharge_transactions.insert_one(new_doc)
            stats["created_new"] += 1

    return stats


async def main():
    parser = argparse.ArgumentParser(description="Sync Eko Excel 'Refund pending' entries to DB")
    parser.add_argument("excel_path", help="Path to Eko Excel (.xlsx) file")
    parser.add_argument("--live", action="store_true", help="Actually write to DB (default is dry-run)")
    parser.add_argument("--mobiles", help="Comma-separated mobile numbers to filter (e.g. 9421331342,9970100782)")
    args = parser.parse_args()

    if not Path(args.excel_path).exists():
        log.error(f"File not found: {args.excel_path}")
        sys.exit(1)

    dry_run = not args.live
    if dry_run:
        log.info("=" * 60)
        log.info("DRY RUN MODE — no DB writes will happen")
        log.info("=" * 60)
    else:
        log.info("=" * 60)
        log.info("LIVE MODE — DB writes ENABLED")
        log.info("=" * 60)

    mobile_filter = None
    if args.mobiles:
        mobile_filter = {m.strip() for m in args.mobiles.split(",") if m.strip()}
        log.info(f"Mobile filter: {mobile_filter}")

    # DB setup
    load_dotenv(ROOT / ".env")
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        log.error("MONGO_URL or DB_NAME missing from .env")
        sys.exit(1)

    cli = AsyncIOMotorClient(mongo_url)
    db = cli[db_name]

    entries = parse_excel(args.excel_path)
    if not entries:
        sys.exit(0)

    stats = await sync_to_db(entries, db, dry_run=dry_run, mobile_filter=mobile_filter)

    log.info("=" * 60)
    log.info("SUMMARY")
    log.info("=" * 60)
    log.info(f"  Matched & updated:     {stats['matched_updated']}")
    log.info(f"  Created new rows:      {stats['created_new']}")
    log.info(f"  Already synced:        {stats['already_synced']}")
    log.info(f"  Skipped (no user):     {stats['skipped_no_user']}")
    log.info(f"  Errors:                {stats['errors']}")
    log.info("=" * 60)
    if dry_run:
        log.info("This was a DRY RUN. Re-run with --live to apply changes.")
    else:
        log.info("Sync complete. Users will see refund modal on next dashboard load.")
        log.info("Don't forget to enable kill switch: refund_blocker_modal_enabled=true in system_config.")

    cli.close()


if __name__ == "__main__":
    asyncio.run(main())
