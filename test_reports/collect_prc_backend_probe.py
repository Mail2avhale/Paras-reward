#!/usr/bin/env python3
"""
Focused backend probe for Collect PRC dashboard bug.

Seeds the preview test user into an Elite active mining session, verifies
/api/mining/status, verifies /api/mining/collect/{uid} returns a valid 200
payload with Authorization, then re-seeds another active session for the
frontend safety-net browser test.
"""
import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from dotenv import dotenv_values
from pymongo import MongoClient


APP_DIR = Path("/app")
FRONTEND_ENV = dotenv_values(APP_DIR / "frontend" / ".env")
BACKEND_ENV = dotenv_values(APP_DIR / "backend" / ".env")
BACKEND_URL = FRONTEND_ENV.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BACKEND_URL}/api"
MOBILE = "9970100782"
PIN = "997010"
DEVICE_ID = "QA-COLLECT-PRC-SAFETY"
OUT = APP_DIR / "test_reports" / "collect_prc_backend_probe_output.json"


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def seed_active_session(users, uid: str, hours_ago: float = 2.0) -> None:
    now = datetime.now(timezone.utc)
    users.update_one(
        {"uid": uid},
        {
            "$set": {
                "subscription_plan": "elite",
                "membership_type": "elite",
                "subscription_status": "active",
                "subscription_expiry": iso(now + timedelta(days=30)),
                "mining_active": True,
                "mining_start_time": iso(now - timedelta(hours=hours_ago)),
                "mining_session_end": iso(now + timedelta(hours=24 - hours_ago)),
                "next_session_available_at": None,
                "last_mining_action": iso(now),
            }
        },
    )


def main():
    result = {"ok": False, "steps": []}
    session = requests.Session()
    login = session.post(
        f"{API}/auth/login",
        json={
            "identifier": MOBILE,
            "password": PIN,
            "device_id": DEVICE_ID,
            "ip_address": "127.0.0.1",
        },
        timeout=30,
    )
    result["steps"].append({"step": "login", "status": login.status_code})
    login.raise_for_status()
    login_data = login.json()
    uid = login_data["uid"]
    token = login_data["token"]

    client = MongoClient(BACKEND_ENV.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[BACKEND_ENV.get("DB_NAME", "paras_reward_db")]
    users = db.users

    seed_active_session(users, uid, hours_ago=2.0)
    result["steps"].append({"step": "seed_active_session_for_api_collect", "uid": uid})

    status_payload = None
    # If a mining status cache was populated before seeding, wait for its 20s TTL.
    for attempt in range(1, 6):
        status = session.get(
            f"{API}/mining/status/{uid}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        status.raise_for_status()
        status_payload = status.json()
        if status_payload.get("session_active") and status_payload.get("mined_this_session", 0) >= 0.01:
            break
        time.sleep(5)
    result["steps"].append(
        {
            "step": "status_before_collect",
            "session_active": status_payload.get("session_active"),
            "mined_this_session": status_payload.get("mined_this_session"),
            "subscription_type": status_payload.get("subscription_type"),
        }
    )
    assert status_payload.get("session_active"), status_payload
    assert status_payload.get("mined_this_session", 0) >= 0.01, status_payload

    collect = session.post(
        f"{API}/mining/collect/{uid}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    collect_payload = collect.json() if collect.content else {}
    result["steps"].append(
        {
            "step": "collect_endpoint",
            "status": collect.status_code,
            "payload": collect_payload,
        }
    )
    collect.raise_for_status()
    assert collect_payload.get("success") is True, collect_payload
    assert collect_payload.get("collected_amount", 0) >= 0.01, collect_payload
    assert "Collected" in collect_payload.get("message", ""), collect_payload

    # Re-arm the same seeded account for the browser safety-net test.
    seed_active_session(users, uid, hours_ago=1.0)
    result["steps"].append({"step": "reseed_active_session_for_frontend", "uid": uid})

    result.update(
        {
            "ok": True,
            "backend_url": BACKEND_URL,
            "uid": uid,
            "mobile": MOBILE,
            "reseeded_for_frontend": True,
        }
    )
    OUT.write_text(json.dumps(result, indent=2, default=str))
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()