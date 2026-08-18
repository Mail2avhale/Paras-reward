#!/usr/bin/env python3
"""Seed deterministic pending service charges for Razorpay loader bug verification."""

import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pymongo import MongoClient


UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
ENV_PATH = Path("/app/backend/.env")


def env_value(key: str, default: str = "") -> str:
    if key in os.environ:
        return os.environ[key].strip().strip('"')
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip().strip('"')
    return default


def make_charge(seq: int, amount: float) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    suffix = str(uuid.uuid4())[:8].upper()
    charge_id = f"SVC-QA-RZP-{seq}-{suffix}"
    return {
        "charge_id": charge_id,
        "user_id": UID,
        "redemption_id": f"qa-razorpay-loader-{seq}-{suffix}",
        "redemption_type": "qa_razorpay_loader",
        "prc_amount": amount * 50,
        "prc_rate": 10,
        "redemption_value_inr": amount * 5,
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
        "qa_marker": "razorpay_loader_bug_v142",
    }


def seed(count: int, amount: float = 300.0):
    mongo_url = env_value("MONGO_URL", "mongodb://localhost:27017")
    db_name = env_value("DB_NAME", "paras_reward_db")
    client = MongoClient(mongo_url)
    db = client[db_name]

    user = db.users.find_one({"uid": UID}, {"_id": 0, "uid": 1, "mobile": 1, "role": 1})
    if not user:
        raise SystemExit(f"Test user {UID} not found")

    # Remove pending rows for this dedicated preview test user so banner totals are deterministic.
    deleted_pending = db.redemption_service_charges.delete_many({"user_id": UID, "status": "PENDING"}).deleted_count
    deleted_old_qa = db.redemption_service_charges.delete_many({"user_id": UID, "qa_marker": "razorpay_loader_bug_v142"}).deleted_count
    docs = [make_charge(i + 1, amount) for i in range(count)]
    if docs:
        db.redemption_service_charges.insert_many(docs)
    print({
        "uid": UID,
        "count": count,
        "amount_each": amount,
        "deleted_pending": deleted_pending,
        "deleted_old_qa": deleted_old_qa,
        "charge_ids": [d["charge_id"] for d in docs],
    })


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    seed(n)