"""
Focused backend/seed verifier for iteration 297 Collect PRC regression.

What it does:
1. Logs in as the preview test user to obtain a real JWT.
2. Seeds an active mining session ~90 minutes old for uid
   76b75808-47fa-48dd-ad7c-8074678e3607.
3. Clears relevant cache keys through the running backend.
4. Verifies /api/mining/status reports an active, collectible session.
5. Verifies POST /api/mining/collect/{uid} returns 200 with a valid payload.
6. Re-seeds the active session again for the browser/UI test.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from pymongo import MongoClient


UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
MOBILE = "9970100782"
PIN = "997010"
BACKEND_URL = "https://formula-audit-fix.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"
OUT = Path("/app/test_reports/collect_prc_seed_backend_297_output.json")


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def seed_active_session(db, label: str) -> dict:
    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=90)
    end = start + timedelta(hours=24)
    update = {
        "mining_active": True,
        "is_mining_active": True,
        "mining_start_time": iso(start),
        "mining_session_end": iso(end),
        "current_session_prc": 5.0,
        "last_mining_action": iso(now),
        "next_session_available_at": None,
        "subscription_plan": "elite",
        "membership_type": "elite",
        "subscription_status": "active",
        "subscription_expired": False,
        "subscription_expiry": iso(now + timedelta(days=90)),
    }
    res = db.users.update_one({"uid": UID}, {"$set": update})
    if res.matched_count != 1:
        raise RuntimeError(f"User {UID} not found while seeding {label}")
    return {"label": label, "matched": res.matched_count, "modified": res.modified_count, **update}


def clear_cache() -> dict:
    keys = [
        f"user_data:{UID}",
        f"user:dashboard:{UID}",
        f"mining:status:{UID}",
        f"user:perf_summary:{UID}",
        f"user:redeem_limit:{UID}",
    ]
    results = {}
    for key in keys:
        r = requests.delete(f"{API}/admin/clear-cache/{key}", timeout=15)
        results[key] = {"status": r.status_code, "body": safe_json(r)}
    return results


def safe_json(resp: requests.Response):
    try:
        return resp.json()
    except Exception:
        return resp.text[:500]


def main() -> int:
    load_dotenv("/app/backend/.env")
    mongo_url = os.environ["MONGO_URL"].strip('"')
    db_name = os.environ.get("DB_NAME", "paras_reward_db").strip('"')
    client = MongoClient(mongo_url)
    db = client[db_name]

    result: dict = {"uid": UID, "api": API, "started_at": iso(datetime.now(timezone.utc))}

    login = requests.post(
        f"{API}/auth/login",
        json={"identifier": MOBILE, "password": PIN, "device_id": "QA-iteration-297-backend"},
        timeout=30,
    )
    result["login"] = {"status": login.status_code, "body_keys": sorted(list(safe_json(login).keys())) if login.ok else safe_json(login)}
    login.raise_for_status()
    token = login.json().get("token") or login.json().get("access_token")
    if not token:
        raise RuntimeError("Login response did not include token/access_token")
    headers = {"Authorization": f"Bearer {token}"}

    result["seed_for_backend_collect"] = seed_active_session(db, "backend_collect")
    result["cache_clear_before_backend"] = clear_cache()

    status = requests.get(f"{API}/mining/status/{UID}", headers=headers, timeout=30)
    result["status_before_collect"] = {"status": status.status_code, "body": safe_json(status)}
    status.raise_for_status()
    status_body = status.json()
    assert status_body.get("session_active") is True, status_body
    assert status_body.get("can_collect") is True, status_body
    assert float(status_body.get("mined_this_session", 0)) > 0, status_body

    collect = requests.post(f"{API}/mining/collect/{UID}", headers=headers, timeout=45)
    result["collect"] = {"status": collect.status_code, "body": safe_json(collect)}
    collect.raise_for_status()
    collect_body = collect.json()
    assert collect_body.get("success") is True, collect_body
    assert float(collect_body.get("collected_amount", 0)) > 0, collect_body
    assert collect_body.get("new_balance") is not None, collect_body
    assert collect_body.get("cooldown_seconds") == 60, collect_body

    result["seed_for_frontend_ui"] = seed_active_session(db, "frontend_ui")
    result["cache_clear_before_frontend"] = clear_cache()

    # One final status probe proves the browser will have an active session to render.
    status2 = requests.get(f"{API}/mining/status/{UID}", headers=headers, timeout=30)
    result["status_before_frontend"] = {"status": status2.status_code, "body": safe_json(status2)}
    status2.raise_for_status()
    status2_body = status2.json()
    assert status2_body.get("session_active") is True, status2_body
    assert status2_body.get("can_collect") is True, status2_body
    assert float(status2_body.get("mined_this_session", 0)) > 0, status2_body

    result["finished_at"] = iso(datetime.now(timezone.utc))
    result["ok"] = True
    OUT.write_text(json.dumps(result, indent=2, default=str))
    print(json.dumps(result, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())