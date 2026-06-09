"""
Regression tests for KYC Auto-Heal Sync Gap fix (June 2026).

Scenario: kyc.status = "verified" but users.kyc_status != "verified"
          (legacy sync gap from older admin approvals).
Fix: GET /api/kyc/status/{uid} lazily mirrors canonical KYC status onto user.

Run: cd /app && pytest backend/tests/test_kyc_auto_heal.py -v
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")

BASE_URL = "http://localhost:8001/api/kyc/status"


def _now():
    return datetime.now(timezone.utc).isoformat()


def _mk_doc(prefix: str, kyc_status: str):
    uid = f"t_{prefix}_{uuid.uuid4().hex[:6]}"
    return uid, {
        "uid": uid,
        "kyc_status": kyc_status,
        "email": f"{uid}@test.local",
        "mobile": str(uuid.uuid4().int)[:10],
    }


@pytest.fixture
def db():
    client = MongoClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


@pytest.fixture
def cleanup_uids(db):
    uids = []
    yield uids
    for uid in uids:
        db.users.delete_one({"uid": uid})
        db.kyc.delete_one({"uid": uid})


def test_drift_auto_heal(db, cleanup_uids):
    """kyc.verified + users.pending → users gets healed to verified."""
    uid, doc = _mk_doc("d", "pending")
    cleanup_uids.append(uid)
    db.users.insert_one(doc)
    db.kyc.insert_one({
        "kyc_id": str(uuid.uuid4()),
        "uid": uid,
        "status": "verified",
        "verified_at": _now(),
        "submitted_at": _now(),
    })
    r = requests.get(f"{BASE_URL}/{uid}", timeout=5).json()
    u = db.users.find_one({"uid": uid}, {"_id": 0, "kyc_status": 1, "kyc_auto_healed_at": 1})
    assert r["status"] == "verified"
    assert u["kyc_status"] == "verified"
    assert u.get("kyc_auto_healed_at")


def test_already_verified_no_reheal(db, cleanup_uids):
    """users already verified → no kyc_auto_healed_at written."""
    uid, doc = _mk_doc("v", "verified")
    cleanup_uids.append(uid)
    db.users.insert_one(doc)
    db.kyc.insert_one({
        "kyc_id": str(uuid.uuid4()),
        "uid": uid,
        "status": "verified",
        "submitted_at": _now(),
        "verified_at": _now(),
    })
    r = requests.get(f"{BASE_URL}/{uid}", timeout=5).json()
    u = db.users.find_one({"uid": uid}, {"_id": 0, "kyc_auto_healed_at": 1})
    assert r["status"] == "verified"
    assert "kyc_auto_healed_at" not in (u or {})


def test_rejected_does_not_heal(db, cleanup_uids):
    """kyc.rejected must never auto-heal a user to verified."""
    uid, doc = _mk_doc("r", "pending")
    cleanup_uids.append(uid)
    db.users.insert_one(doc)
    db.kyc.insert_one({
        "kyc_id": str(uuid.uuid4()),
        "uid": uid,
        "status": "rejected",
        "submitted_at": _now(),
    })
    r = requests.get(f"{BASE_URL}/{uid}", timeout=5).json()
    u = db.users.find_one({"uid": uid}, {"_id": 0, "kyc_status": 1})
    assert r["status"] == "rejected"
    assert u["kyc_status"] == "pending"


def test_pending_does_not_heal(db, cleanup_uids):
    """kyc.pending must never auto-heal a user to verified."""
    uid, doc = _mk_doc("p", "pending")
    cleanup_uids.append(uid)
    db.users.insert_one(doc)
    db.kyc.insert_one({
        "kyc_id": str(uuid.uuid4()),
        "uid": uid,
        "status": "pending",
        "submitted_at": _now(),
    })
    r = requests.get(f"{BASE_URL}/{uid}", timeout=5).json()
    u = db.users.find_one({"uid": uid}, {"_id": 0, "kyc_status": 1})
    assert r["status"] == "pending"
    assert u["kyc_status"] == "pending"


def test_no_kyc_submitted(db, cleanup_uids):
    """No KYC record at all → submitted=false, no crash."""
    uid, doc = _mk_doc("n", "not_submitted")
    cleanup_uids.append(uid)
    db.users.insert_one(doc)
    r = requests.get(f"{BASE_URL}/{uid}", timeout=5).json()
    assert r["submitted"] is False


def test_mixed_case_verified_still_heals(db, cleanup_uids):
    """Legacy records may have 'Verified' or 'VERIFIED' — still must heal."""
    uid, doc = _mk_doc("mc", "Pending")
    cleanup_uids.append(uid)
    db.users.insert_one(doc)
    db.kyc.insert_one({
        "kyc_id": str(uuid.uuid4()),
        "uid": uid,
        "status": "Verified",
        "verified_at": _now(),
        "submitted_at": _now(),
    })
    requests.get(f"{BASE_URL}/{uid}", timeout=5)
    u = db.users.find_one({"uid": uid}, {"_id": 0, "kyc_status": 1, "kyc_auto_healed_at": 1})
    assert u["kyc_status"] == "verified"
    assert u.get("kyc_auto_healed_at")
