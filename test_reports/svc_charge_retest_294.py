#!/usr/bin/env python3
"""Focused backend verification for PRC service-charge Razorpay order creation.

This script seeds disposable redemption_service_charges rows, exercises the
single-pay, reused-order, and bulk-pay APIs with valid Razorpay env vars, then
temporarily blanks Razorpay env vars and restarts the supervisor-managed backend
to verify the fixed reused-order edge case returns HTTP 503. It restores the
original env file and restarts backend in a finally block.
"""
import json
import os
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import dotenv_values
from pymongo import MongoClient


BACKEND_ENV = Path("/app/backend/.env")
RESULT_PATH = Path("/app/test_reports/svc_charge_retest_294_result.json")
API = "http://localhost:8001/api"
TEST_USER = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"
SEED_MARKER = "bug_294_service_charge_paynow"


def load_env():
    return dotenv_values(BACKEND_ENV)


def set_env_values(updates):
    lines = BACKEND_ENV.read_text().splitlines()
    seen = set()
    new_lines = []
    for line in lines:
        if not line or line.lstrip().startswith("#") or "=" not in line:
            new_lines.append(line)
            continue
        key = line.split("=", 1)[0]
        if key in updates:
            new_lines.append(f"{key}={updates[key]}")
            seen.add(key)
        else:
            new_lines.append(line)
    for key, value in updates.items():
        if key not in seen:
            new_lines.append(f"{key}={value}")
    BACKEND_ENV.write_text("\n".join(new_lines) + "\n")


def restart_backend():
    proc = subprocess.run(
        ["sudo", "supervisorctl", "restart", "backend"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=60,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"backend restart failed: {proc.stdout} {proc.stderr}")
    wait_until_ready()


def wait_until_ready(timeout=45):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            r = requests.get(f"{API}/health", timeout=5)
            if r.status_code in (200, 404):
                return True
            last = f"HTTP {r.status_code}: {r.text[:100]}"
        except Exception as exc:
            last = repr(exc)
        time.sleep(1)
    raise TimeoutError(f"backend not ready: {last}")


def mongo_db():
    env = load_env()
    client = MongoClient(env["MONGO_URL"])
    return client, client[env.get("DB_NAME", "test_database")]


def cleanup(db):
    db.redemption_service_charges.delete_many({"_test_seed": SEED_MARKER})
    db.service_charge_audit.delete_many({"meta.test_marker": SEED_MARKER})


def seed_charge(db, *, total_payable, order_id=None, user_id=TEST_USER):
    now = datetime.now(timezone.utc).isoformat()
    charge_id = f"SVC-294-{uuid.uuid4().hex[:10].upper()}"
    db.redemption_service_charges.insert_one({
        "charge_id": charge_id,
        "user_id": user_id,
        "redemption_id": f"RED-294-{uuid.uuid4().hex[:10]}",
        "redemption_type": "test",
        "prc_amount": float(total_payable) * 50.0,
        "prc_rate": 10,
        "redemption_value_inr": float(total_payable) * 5.0,
        "service_charge_percentage": 20,
        "service_charge_amount": float(total_payable),
        "tax_amount": 0.0,
        "total_payable": float(total_payable),
        "currency": "INR",
        "status": "PENDING",
        "payment_order_id": order_id,
        "payment_id": None,
        "payment_gateway": "razorpay",
        "payment_attempts": 0,
        "created_at": now,
        "applicable_at": now,
        "paid_at": None,
        "updated_at": now,
        "_test_seed": SEED_MARKER,
    })
    return charge_id


def post_json(path, payload):
    return requests.post(f"{API}{path}", json=payload, timeout=45)


def expect(condition, message):
    if not condition:
        raise AssertionError(message)


def safe_json(resp):
    try:
        return resp.json()
    except Exception:
        return {"raw": resp.text[:500]}


def main():
    original_env_text = BACKEND_ENV.read_text()
    env = load_env()
    original_key = env.get("RAZORPAY_KEY_ID", "")
    original_secret = env.get("RAZORPAY_KEY_SECRET", "")
    results = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "api": API,
        "checks": [],
        "final_restore_attempted": False,
    }

    client, db = mongo_db()
    try:
        cleanup(db)
        wait_until_ready()
        expect(original_key and original_secret, "Razorpay keys missing before valid-key tests")
        expect(original_key.startswith("rzp_"), "Razorpay key id does not start with rzp_")

        # 1) Happy path: valid keys + fresh pending ₹300 charge -> real Razorpay order.
        happy_charge = seed_charge(db, total_payable=300)
        r = post_json("/redemption-service-charge/create-payment", {"charge_id": happy_charge})
        body = safe_json(r)
        results["checks"].append({"name": "single_pay_valid_keys", "status_code": r.status_code, "body": body})
        expect(r.status_code == 200, f"single pay expected 200, got {r.status_code}: {body}")
        expect(str(body.get("order_id", "")).startswith("order_"), f"bad order_id: {body}")
        expect(body.get("amount") == 30000, f"bad amount: {body}")
        expect(body.get("currency") == "INR", f"bad currency: {body}")
        expect(str(body.get("razorpay_key", "")).startswith("rzp_"), f"missing razorpay_key: {body}")

        # 2) Reused-order path: valid keys + preexisting fake order -> 200 reused true and key present.
        reused_charge = seed_charge(db, total_payable=300, order_id="order_reused_test")
        r = post_json("/redemption-service-charge/create-payment", {"charge_id": reused_charge})
        body = safe_json(r)
        results["checks"].append({"name": "single_pay_reused_valid_keys", "status_code": r.status_code, "body": body})
        expect(r.status_code == 200, f"reused order expected 200, got {r.status_code}: {body}")
        expect(body.get("order_id") == "order_reused_test", f"reused order id mismatch: {body}")
        expect(body.get("reused") is True, f"reused flag missing: {body}")
        expect(body.get("razorpay_key"), f"reused path returned empty razorpay_key: {body}")

        # 3) Bulk valid keys: real Razorpay order for two seeded charges.
        bulk_user = f"bulk-294-{uuid.uuid4().hex[:8]}"
        bulk_c1 = seed_charge(db, total_payable=2, user_id=bulk_user)
        bulk_c2 = seed_charge(db, total_payable=4, user_id=bulk_user)
        r = post_json("/redemption-service-charge/bulk-pay-order", {"user_id": bulk_user})
        body = safe_json(r)
        results["checks"].append({"name": "bulk_pay_valid_keys", "status_code": r.status_code, "body": body})
        expect(r.status_code == 200, f"bulk pay expected 200, got {r.status_code}: {body}")
        expect(str(body.get("order_id", "")).startswith("order_"), f"bad bulk order_id: {body}")
        expect(body.get("amount") == 600, f"bad bulk amount: {body}")
        expect(set(body.get("charge_ids", [])) == {bulk_c1, bulk_c2}, f"bulk charge_ids mismatch: {body}")
        expect(body.get("razorpay_key"), f"bulk returned empty razorpay_key: {body}")

        # 4/5) Blank-key edge cases after backend restart.
        blank_reused_charge = seed_charge(db, total_payable=300, order_id="order_reused_test")
        blank_bulk_user = f"blank-bulk-294-{uuid.uuid4().hex[:8]}"
        seed_charge(db, total_payable=3, user_id=blank_bulk_user)
        seed_charge(db, total_payable=5, user_id=blank_bulk_user)

        set_env_values({"RAZORPAY_KEY_ID": "", "RAZORPAY_KEY_SECRET": original_secret or ""})
        restart_backend()

        r = post_json("/redemption-service-charge/create-payment", {"charge_id": blank_reused_charge})
        body = safe_json(r)
        results["checks"].append({"name": "single_pay_reused_blank_key", "status_code": r.status_code, "body": body})
        expect(r.status_code == 503, f"blank reused expected 503, got {r.status_code}: {body}")
        expect(str(body.get("detail", "")).startswith("Payment service is temporarily unavailable"), f"bad blank detail: {body}")

        r = post_json("/redemption-service-charge/bulk-pay-order", {"user_id": blank_bulk_user})
        body = safe_json(r)
        results["checks"].append({"name": "bulk_pay_blank_key", "status_code": r.status_code, "body": body})
        expect(r.status_code == 503, f"blank bulk expected 503, got {r.status_code}: {body}")
        expect(str(body.get("detail", "")).startswith("Payment service is temporarily unavailable"), f"bad blank bulk detail: {body}")

        results["overall"] = "pass"
    except Exception as exc:
        results["overall"] = "fail"
        results["error"] = repr(exc)
        raise
    finally:
        results["final_restore_attempted"] = True
        BACKEND_ENV.write_text(original_env_text)
        try:
            restart_backend()
            results["final_restore_success"] = True
        except Exception as exc:
            results["final_restore_success"] = False
            results["final_restore_error"] = repr(exc)
        try:
            cleanup(db)
        finally:
            client.close()
        results["finished_at"] = datetime.now(timezone.utc).isoformat()
        RESULT_PATH.write_text(json.dumps(results, indent=2, default=str))


if __name__ == "__main__":
    main()