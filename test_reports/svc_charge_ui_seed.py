#!/usr/bin/env python3
"""Seed two QA-only pending service charges for the browser UI regression test."""
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from pymongo import MongoClient

ENV = Path("/app/backend/.env")
OUT = Path("/app/test_reports/svc_charge_ui_seed_result.json")
USER_ID = "76b75808-47fa-48dd-ad7c-8074678e3607"  # mobile 9970100782 in preview credentials
PREFIX = "SVC-QA-UIRENDER"


def parse_env(text):
    vals = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals


def make_doc(charge_id, amount=1.0):
    now = datetime.now(timezone.utc).isoformat()
    return {
        "charge_id": charge_id,
        "user_id": USER_ID,
        "redemption_id": f"QA-UI-REDEMPTION-{charge_id}",
        "redemption_type": "qa_ui_regression",
        "prc_amount": 50,
        "prc_rate": 10,
        "redemption_value_inr": 5.0,
        "service_charge_percentage": 20,
        "service_charge_amount": amount,
        "tax_amount": 0.0,
        "total_payable": amount,
        "currency": "INR",
        "status": "PENDING",
        "payment_order_id": None,
        "payment_id": None,
        "payment_gateway": "razorpay",
        "payment_attempts": 0,
        "created_at": now,
        "applicable_at": now,
        "paid_at": None,
        "updated_at": now,
        "qa_marker": PREFIX,
    }


def main():
    vals = parse_env(ENV.read_text())
    db = MongoClient(vals["MONGO_URL"])[vals["DB_NAME"]]
    db.redemption_service_charges.delete_many({
        "$or": [
            {"qa_marker": PREFIX},
            {"charge_id": {"$regex": f"^{PREFIX}"}},
            {"redemption_id": {"$regex": "^QA-UI-REDEMPTION-"}},
        ]
    })
    stamp = int(time.time() * 1000)
    charge_ids = [f"{PREFIX}-{i}-{stamp}" for i in range(2)]
    db.redemption_service_charges.insert_many([make_doc(cid) for cid in charge_ids])
    result = {"user_id": USER_ID, "charge_ids": charge_ids, "count": 2, "total_payable": 2.0}
    OUT.write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


if __name__ == "__main__":
    main()