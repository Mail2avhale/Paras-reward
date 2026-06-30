"""snapshot.py — Dump every active legacy collection to JSON before migrating.

Output: /app/backend/migrations/2026_06_30_unify_redeem_collections/snapshots/
"""
import os
import sys
import json
from datetime import datetime, timezone
from pathlib import Path

# Make `backend/` importable as the project root
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from pymongo import MongoClient  # noqa: E402

LEGACY = [
    "bank_transfer_requests",
    "bank_withdrawal_requests",
    "chatbot_withdrawal_requests",
    "recharge_transactions",
    "bill_payment_requests",
]


def json_default(o):
    """Make BSON types JSON-serializable."""
    from bson import ObjectId
    if isinstance(o, ObjectId):
        return str(o)
    if isinstance(o, datetime):
        return o.isoformat()
    return str(o)


def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = MongoClient(mongo_url)
    db = client[db_name]

    out_dir = Path(__file__).resolve().parent / "snapshots"
    out_dir.mkdir(parents=True, exist_ok=True)

    summary = {"taken_at": datetime.now(timezone.utc).isoformat(), "collections": {}}
    for name in LEGACY:
        docs = list(db[name].find({}))
        file = out_dir / f"{name}.json"
        with file.open("w") as f:
            json.dump(docs, f, indent=2, default=json_default)
        summary["collections"][name] = {"count": len(docs), "file": file.name}
        print(f"  snapshot {name}: {len(docs)} docs → {file.name}")

    (out_dir / "_summary.json").write_text(json.dumps(summary, indent=2, default=json_default))
    print(f"\n✅ Snapshots saved to {out_dir}")


if __name__ == "__main__":
    main()
