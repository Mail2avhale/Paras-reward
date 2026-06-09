"""
Regression tests for KYC Auto-Heal at GET /api/user/{uid}.

Bug (Jun 9, 2026): server.py looked in empty `kyc_documents` collection with
field `user_id` instead of `db.kyc` with field `uid`. Drift never healed
when frontend loaded Profile/BankRedeem pages.

Fix: Read from canonical `db.kyc` with `uid` filter, await the update,
invalidate cache, return healed status to client immediately.

Run: cd /app && pytest backend/tests/test_user_endpoint_kyc_heal.py -v
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

import jwt
import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")

BASE_URL = "http://localhost:8001/api/user"
JWT_SECRET = os.environ["JWT_SECRET_KEY"]


def _now():
    return datetime.now(timezone.utc).isoformat()


def _token(uid: str, role: str = "user") -> str:
    return jwt.encode(
        {"uid": uid, "role": role,
         "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        JWT_SECRET, algorithm="HS256",
    )


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


def _mk_user(db, kyc_user_status: str, kyc_doc_status: str | None):
    uid = f"t_user_{uuid.uuid4().hex[:8]}"
    db.users.insert_one({
        "uid": uid,
        "name": "Heal Test User",
        "email": f"{uid}@test.local",
        "mobile": str(uuid.uuid4().int)[:10],
        "kyc_status": kyc_user_status,
    })
    if kyc_doc_status:
        db.kyc.insert_one({
            "kyc_id": str(uuid.uuid4()),
            "uid": uid,
            "status": kyc_doc_status,
            "verified_at": _now(),
            "submitted_at": _now(),
        })
    return uid


def test_drift_heals_on_user_endpoint(db, cleanup_uids):
    """kyc.verified + users.pending → /api/user/{uid} returns verified + heals DB."""
    uid = _mk_user(db, "pending", "verified")
    cleanup_uids.append(uid)
    r = requests.get(f"{BASE_URL}/{uid}",
                     headers={"Authorization": f"Bearer {_token(uid)}"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["kyc_status"] == "verified"
    persisted = db.users.find_one({"uid": uid})
    assert persisted["kyc_status"] == "verified"
    assert persisted.get("kyc_auto_healed_at")


def test_already_verified_no_extra_work(db, cleanup_uids):
    """Already verified → endpoint returns verified, no heal stamp added."""
    uid = _mk_user(db, "verified", "verified")
    cleanup_uids.append(uid)
    r = requests.get(f"{BASE_URL}/{uid}",
                     headers={"Authorization": f"Bearer {_token(uid)}"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["kyc_status"] == "verified"
    persisted = db.users.find_one({"uid": uid})
    assert "kyc_auto_healed_at" not in persisted


def test_rejected_does_not_heal(db, cleanup_uids):
    """kyc.rejected must never heal users.pending → verified."""
    uid = _mk_user(db, "pending", "rejected")
    cleanup_uids.append(uid)
    r = requests.get(f"{BASE_URL}/{uid}",
                     headers={"Authorization": f"Bearer {_token(uid)}"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["kyc_status"] != "verified"
    assert db.users.find_one({"uid": uid})["kyc_status"] == "pending"


def test_pending_does_not_heal(db, cleanup_uids):
    """kyc.pending must never heal users to verified."""
    uid = _mk_user(db, "pending", "pending")
    cleanup_uids.append(uid)
    r = requests.get(f"{BASE_URL}/{uid}",
                     headers={"Authorization": f"Bearer {_token(uid)}"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["kyc_status"] != "verified"


def test_no_kyc_doc(db, cleanup_uids):
    """No KYC doc at all → status stays not_submitted, no crash."""
    uid = _mk_user(db, "not_submitted", None)
    cleanup_uids.append(uid)
    r = requests.get(f"{BASE_URL}/{uid}",
                     headers={"Authorization": f"Bearer {_token(uid)}"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["kyc_status"] in ("not_submitted", "pending", "")


def test_mixed_case_verified_still_heals(db, cleanup_uids):
    """Legacy 'Verified' / 'VERIFIED' / 'approved' all heal."""
    for label in ("Verified", "VERIFIED", "approved"):
        uid = _mk_user(db, "pending", label)
        cleanup_uids.append(uid)
        r = requests.get(f"{BASE_URL}/{uid}",
                         headers={"Authorization": f"Bearer {_token(uid)}"}, timeout=10)
        assert r.status_code == 200, f"Failed for label={label}"
        assert db.users.find_one({"uid": uid})["kyc_status"] == "verified", \
            f"Failed to heal for label={label}"
