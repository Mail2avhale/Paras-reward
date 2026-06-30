"""unarchive.py — Restore legacy collection names so existing code keeps working.

Why: archive renamed `bank_transfer_requests` → `_archive_2026_06_30_bank_transfer_requests`.
That broke existing read+write paths for those collections (admin_dashboard,
manual_bank_transfer, bbps_services, eko_recharge, etc. all reference the old names).

The migration ALREADY copied historical data into `redeem_requests` (verified
51 rows in canonical). So we can safely restore the legacy names — future
admin reads come from `redeem_requests` (via `/api/admin/unified-spend/*`),
legacy collections continue to exist for the old code paths, and we re-run
`migrate.py` on a cron to keep `redeem_requests` in sync going forward.

Run:  python unarchive.py --apply
"""
import os
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from pymongo import MongoClient  # noqa: E402

ARCHIVE_PREFIX = "_archive_2026_06_30_"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true")
    args = p.parse_args()

    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = MongoClient(mongo_url)
    db = client[db_name]

    existing = set(db.list_collection_names())
    archived = [n for n in existing if n.startswith(ARCHIVE_PREFIX)]

    for src in archived:
        dst = src[len(ARCHIVE_PREFIX):]
        if dst in existing:
            print(f"   ⚠ {dst} already restored (or never archived) — skipping {src}")
            continue
        n = db[src].count_documents({})
        if args.apply:
            db[src].rename(dst)
            print(f"   ✓ Restored {src} → {dst}  ({n} docs)")
        else:
            print(f"   🔎 Would restore {src} → {dst}  ({n} docs)")

    if args.apply:
        print("\n✅ Legacy collections restored. Re-run migrate.py periodically to keep redeem_requests in sync.")
    else:
        print("\n🔎 Dry run. Re-run with --apply to commit.")


if __name__ == "__main__":
    main()
