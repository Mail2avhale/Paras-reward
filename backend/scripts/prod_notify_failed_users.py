"""
Send in-app notifications to users whose bank redeems were just failed
with reason "Over Limit". Uses the new /admin/notify-failed-users endpoint.

PREREQ: Production must be deployed with the new endpoint
        (POST /api/bank-transfer/admin/notify-failed-users).

Usage:
    python -m scripts.prod_notify_failed_users
"""
import json
import time
from pathlib import Path
import httpx

PROD = "https://www.parasreward.com"
ADMIN_EMAIL = "Admin@paras.com"
ADMIN_PIN = "153759"

DRY_FILE = Path(__file__).resolve().parent / "_prod_overlimit_pending.json"
RETRY_FILE = Path(__file__).resolve().parent / "_prod_unresolved_overlimit.json"

CHUNK = 100


def login():
    r = httpx.post(f"{PROD}/api/auth/login",
                   json={"identifier": ADMIN_EMAIL, "password": ADMIN_PIN},
                   timeout=30)
    r.raise_for_status()
    d = r.json()
    return d["uid"], d["token"]


def main():
    admin_uid, token = login()
    headers = {"Authorization": f"Bearer {token}"}

    ids = []
    if DRY_FILE.exists():
        ids += [r["request_id"] for r in json.load(open(DRY_FILE))["rows"]
                if r.get("request_id")]
    if RETRY_FILE.exists():
        ids += [r["request_id"] for r in json.load(open(RETRY_FILE))
                if r.get("request_id")]
    ids = list(dict.fromkeys(ids))  # dedup
    print(f"Loaded {len(ids)} request IDs to notify.")

    totals = {"sent": 0, "already_notified": 0, "not_failed": 0, "skipped": 0}
    with httpx.Client(timeout=180) as client:
        for i in range(0, len(ids), CHUNK):
            batch = ids[i:i + CHUNK]
            try:
                r = client.post(
                    f"{PROD}/api/bank-transfer/admin/notify-failed-users",
                    json={
                        "request_ids": batch,
                        "title": "Bank Redeem Failed",
                        "use_admin_remark_as_reason": True,
                    },
                    headers=headers,
                )
                r.raise_for_status()
                d = r.json()
                for k in totals:
                    totals[k] += d.get(k, 0)
                print(f"  chunk {i//CHUNK+1} ({len(batch)}): "
                      f"sent={d.get('sent')} dup={d.get('already_notified')} "
                      f"not_failed={d.get('not_failed')} skipped={d.get('skipped')}")
            except Exception as e:
                print(f"  chunk {i//CHUNK+1} ERROR: {e}")
            time.sleep(0.5)

    print("\n=== NOTIFICATION SEND COMPLETE ===")
    for k, v in totals.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
