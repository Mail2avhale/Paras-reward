#!/usr/bin/env python3
"""Focused regression checks for PRC redemption service charge Razorpay order creation.

This script seeds QA-only pending service charges for the requested preview user,
calls the affected backend endpoints, temporarily mutates Razorpay env values to
exercise new diagnostics, and restores /app/backend/.env exactly before exit.
"""
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from pymongo import MongoClient


APP_DIR = Path("/app")
BACKEND_ENV = APP_DIR / "backend" / ".env"
REPORT_PATH = APP_DIR / "test_reports" / "svc_charge_payment_backend_result.json"
API = os.environ.get("BACKEND_API", "http://127.0.0.1:8001/api")
USER_ID = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"
QA_PREFIX = "SVC-QA-ORDERCREATE"


def parse_env(text: str) -> dict:
    vals = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        vals[key.strip()] = val.strip().strip('"').strip("'")
    return vals


def set_env_value(text: str, key: str, value: str) -> str:
    lines = text.splitlines()
    out = []
    found = False
    for line in lines:
        if line.startswith(f"{key}="):
            out.append(f'{key}="{value}"')
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f'{key}="{value}"')
    # Preserve trailing newline if present.
    return "\n".join(out) + ("\n" if text.endswith("\n") else "")


def restart_backend() -> None:
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, timeout=60)


def wait_backend(timeout: int = 75) -> None:
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            r = requests.get(f"{API}/health", timeout=5)
            if r.status_code == 200:
                return
            last = f"HTTP {r.status_code}: {r.text[:120]}"
        except Exception as exc:  # noqa: BLE001
            last = repr(exc)
        time.sleep(2)
    raise RuntimeError(f"backend did not become healthy: {last}")


def charge_doc(charge_id: str, amount: float = 1.0) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "charge_id": charge_id,
        "user_id": USER_ID,
        "redemption_id": f"QA-REDEMPTION-{charge_id}",
        "redemption_type": "qa_order_create_regression",
        "prc_amount": amount * 50,  # arbitrary non-zero PRC source amount
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
        "qa_marker": QA_PREFIX,
    }


def seed_charges(db, suffix: str, count: int, amount: float = 1.0) -> list[str]:
    charge_ids = [f"{QA_PREFIX}-{suffix}-{i}-{int(time.time() * 1000)}" for i in range(count)]
    db.redemption_service_charges.insert_many([charge_doc(cid, amount) for cid in charge_ids])
    return charge_ids


def clean_qa_charges(db) -> None:
    db.redemption_service_charges.delete_many({
        "$or": [
            {"qa_marker": QA_PREFIX},
            {"charge_id": {"$regex": f"^{QA_PREFIX}"}},
            {"redemption_id": {"$regex": f"^QA-REDEMPTION-{QA_PREFIX}"}},
        ]
    })


def post(path: str, payload: dict) -> requests.Response:
    return requests.post(f"{API}{path}", json=payload, timeout=45)


def assert_no_secret_leak(detail: str, original_key_id: str, original_secret: str) -> None:
    if original_key_id and original_key_id in detail:
        raise AssertionError("Razorpay key id leaked in error detail")
    if original_secret and original_secret in detail:
        raise AssertionError("Razorpay key secret leaked in error detail")


def main() -> int:
    original_env = BACKEND_ENV.read_text()
    vals = parse_env(original_env)
    client = MongoClient(vals["MONGO_URL"])
    db = client[vals["DB_NAME"]]
    result = {
        "api": API,
        "user_id": USER_ID,
        "checks": [],
        "seeded_charge_ids": [],
        "ok": False,
    }

    def record(name: str, ok: bool, **extra):
        item = {"name": name, "ok": ok, **extra}
        result["checks"].append(item)
        print(json.dumps(item, ensure_ascii=False))

    try:
        wait_backend()
        clean_qa_charges(db)

        # Happy path: single Pay Now order creation.
        single_id = seed_charges(db, "SINGLE", 1, 1.0)[0]
        result["seeded_charge_ids"].append(single_id)
        r = post("/redemption-service-charge/create-payment", {"charge_id": single_id})
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
        assert r.status_code == 200, body
        for field in ["order_id", "amount", "currency", "razorpay_key", "charge_id"]:
            assert field in body, body
        assert body["amount"] == 100 and body["currency"] == "INR" and body["charge_id"] == single_id, body
        assert str(body["order_id"]).startswith("order_"), body
        record("single_create_payment_200", True, status=r.status_code, amount=body["amount"], order_id_prefix=str(body["order_id"])[:12])

        # Happy path: Bulk Pay order creation for all pending charges.
        bulk_ids = seed_charges(db, "BULK", 2, 1.0)
        result["seeded_charge_ids"].extend(bulk_ids)
        expected_pending_ids = [d["charge_id"] for d in db.redemption_service_charges.find(
            {"user_id": USER_ID, "status": "PENDING", "payment_attempts": {"$lt": 5}}, {"_id": 0, "charge_id": 1}
        )]
        expected_total = int(sum(float(d["total_payable"]) * 100 for d in db.redemption_service_charges.find(
            {"user_id": USER_ID, "status": "PENDING", "payment_attempts": {"$lt": 5}}, {"_id": 0, "total_payable": 1}
        )))
        r = post("/redemption-service-charge/bulk-pay-order", {"user_id": USER_ID})
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
        assert r.status_code == 200, body
        for field in ["order_id", "amount", "currency", "charge_ids", "charge_count", "razorpay_key", "bulk_receipt"]:
            assert field in body, body
        assert body["amount"] == expected_total and body["currency"] == "INR", body
        assert set(body["charge_ids"]) == set(expected_pending_ids), body
        assert body["charge_count"] == len(expected_pending_ids), body
        record("bulk_pay_order_200", True, status=r.status_code, amount=body["amount"], charge_count=body["charge_count"], order_id_prefix=str(body["order_id"])[:12])

        # Missing-key diagnostic: both endpoints must return 503 with the new detail.
        missing_single = seed_charges(db, "MISSING-SINGLE", 1, 1.0)[0]
        missing_bulk = seed_charges(db, "MISSING-BULK", 2, 1.0)
        result["seeded_charge_ids"].extend([missing_single, *missing_bulk])
        missing_env = set_env_value(original_env, "RAZORPAY_KEY_ID", "")
        missing_env = set_env_value(missing_env, "RAZORPAY_KEY_SECRET", vals.get("RAZORPAY_KEY_SECRET", ""))
        BACKEND_ENV.write_text(missing_env)
        restart_backend(); wait_backend()
        for name, path, payload in [
            ("single_missing_env_503", "/redemption-service-charge/create-payment", {"charge_id": missing_single}),
            ("bulk_missing_env_503", "/redemption-service-charge/bulk-pay-order", {"user_id": USER_ID}),
        ]:
            r = post(path, payload)
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
            detail = body.get("detail", "")
            assert r.status_code == 503, body
            assert detail.startswith("Payment service is temporarily unavailable"), body
            record(name, True, status=r.status_code, detail_prefix=detail[:64])

        # Bad-auth diagnostic: both endpoints must return 502 with SDK error text and no live keys.
        bad_single = seed_charges(db, "BAD-SINGLE", 1, 1.0)[0]
        bad_bulk = seed_charges(db, "BAD-BULK", 2, 1.0)
        result["seeded_charge_ids"].extend([bad_single, *bad_bulk])
        bad_env = set_env_value(original_env, "RAZORPAY_KEY_ID", "rzp_live_QAInvalidKeyId")
        bad_env = set_env_value(bad_env, "RAZORPAY_KEY_SECRET", "qa-invalid-secret")
        BACKEND_ENV.write_text(bad_env)
        restart_backend(); wait_backend()
        for name, path, payload in [
            ("single_bad_razorpay_502", "/redemption-service-charge/create-payment", {"charge_id": bad_single}),
            ("bulk_bad_razorpay_502", "/redemption-service-charge/bulk-pay-order", {"user_id": USER_ID}),
        ]:
            r = post(path, payload)
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
            detail = body.get("detail", "")
            assert r.status_code == 502, body
            assert detail.startswith("Payment gateway error: "), body
            assert len(detail) <= len("Payment gateway error: ") + 180, body
            assert_no_secret_leak(detail, vals.get("RAZORPAY_KEY_ID", ""), vals.get("RAZORPAY_KEY_SECRET", ""))
            record(name, True, status=r.status_code, detail_prefix=detail[:100])

        result["ok"] = all(c["ok"] for c in result["checks"])
        return 0
    except Exception as exc:  # noqa: BLE001
        record("failure", False, error=repr(exc))
        return 1
    finally:
        BACKEND_ENV.write_text(original_env)
        try:
            restart_backend(); wait_backend()
        finally:
            # Leave exactly two fresh pending QA rows for the UI rendering/click test.
            clean_qa_charges(db)
            ui_ids = seed_charges(db, "UI", 2, 1.0)
            result["ui_charge_ids"] = ui_ids
            result["final_env_restored"] = BACKEND_ENV.read_text() == original_env
            REPORT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False))
            print(f"Wrote {REPORT_PATH}")


if __name__ == "__main__":
    raise SystemExit(main())