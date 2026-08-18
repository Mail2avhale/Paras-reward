#!/usr/bin/env python3
"""Remove QA-only service charge rows created by focused regression tests."""
import json
from pathlib import Path

from pymongo import MongoClient

ENV = Path("/app/backend/.env")
OUT = Path("/app/test_reports/svc_charge_cleanup_result.json")
PREFIXES = ["SVC-QA-ORDERCREATE", "SVC-QA-UIRENDER"]


def parse_env(text):
    vals = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals


def main():
    vals = parse_env(ENV.read_text())
    db = MongoClient(vals["MONGO_URL"])[vals["DB_NAME"]]
    total_deleted = 0
    details = []
    for prefix in PREFIXES:
        query = {
            "$or": [
                {"qa_marker": prefix},
                {"charge_id": {"$regex": f"^{prefix}"}},
                {"redemption_id": {"$regex": prefix}},
                {"redemption_id": {"$regex": "^QA-UI-REDEMPTION-" if prefix.endswith("UIRENDER") else f"^QA-REDEMPTION-{prefix}"}},
            ]
        }
        res = db.redemption_service_charges.delete_many(query)
        total_deleted += res.deleted_count
        details.append({"prefix": prefix, "deleted": res.deleted_count})
    result = {"deleted": total_deleted, "details": details}
    OUT.write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


if __name__ == "__main__":
    main()