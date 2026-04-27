"""
Retry the unresolved request_ids by fetching each one's user limit individually.

For each request_id:
  1. GET /admin/request/{request_id}
  2. Look up user's current redeem limit individually
  3. If over-limit (raw < 0), append to over-limit list

After collection, optionally bulk-fail.
"""
import json
import time
from pathlib import Path
import httpx

PROD = "https://www.parasreward.com"
ADMIN_EMAIL = "Admin@paras.com"
ADMIN_PIN = "153759"

UNRESOLVED = Path(__file__).resolve().parent / "_prod_unresolved_no_data.json"
OVERLIMIT_OUT = Path(__file__).resolve().parent / "_prod_unresolved_overlimit.json"


def login():
    r = httpx.post(
        f"{PROD}/api/auth/login",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PIN},
        timeout=30,
    )
    r.raise_for_status()
    d = r.json()
    return d["uid"], d["token"]


def main():
    admin_uid, token = login()
    headers = {"Authorization": f"Bearer {token}"}
    ids = json.load(open(UNRESOLVED))
    print(f"Retrying {len(ids)} unresolved request_ids...")

    overlimit = []
    no_data_again = []
    within_limit = []

    with httpx.Client(timeout=60) as client:
        for i, rid in enumerate(ids, 1):
            try:
                # Fetch one record by sliding limit=1 with skip = its position?
                # Easier: fetch detail (no enrichment), then use direct user
                # query via the requests endpoint with limit=1.
                # Use /admin/request/{rid} for full info.
                r = client.get(f"{PROD}/api/bank-transfer/admin/request/{rid}",
                               headers=headers)
                r.raise_for_status()
                detail = r.json().get("request", {})
                uid = detail.get("user_id")
                prc = detail.get("prc_deducted") or detail.get("total_prc_deducted") or 0
                inr = detail.get("withdrawal_amount") or detail.get("amount") or 0

                # Now ask backend to evaluate this single user's limit by
                # hitting the requests endpoint filtered to that user (limit=1).
                # Simpler: just request a tiny page with the request itself
                # and rely on enrichment for 1 user.
                r2 = client.get(
                    f"{PROD}/api/bank-transfer/admin/requests"
                    f"?status=pending&search={rid}&limit=1",
                    headers=headers,
                )
                r2.raise_for_status()
                reqs = r2.json().get("requests", [])
                if not reqs:
                    print(f"  {i:3d}/{len(ids)} {rid} no longer pending (already processed)")
                    continue
                row = reqs[0]
                raw = row.get("redeem_limit_raw")
                if raw is None:
                    no_data_again.append({"request_id": rid, "user_id": uid,
                                          "prc": prc, "inr": inr})
                    print(f"  {i:3d}/{len(ids)} {rid} STILL no_data")
                elif raw < 0:
                    overlimit.append({
                        "request_id": rid,
                        "user_id": uid,
                        "user_name": row.get("user_name"),
                        "withdrawal_amount": row.get("withdrawal_amount"),
                        "prc_deducted": row.get("prc_deducted"),
                        "redeem_limit_raw": raw,
                    })
                    print(f"  {i:3d}/{len(ids)} {rid} OVER-LIMIT (raw={raw:,.0f})")
                else:
                    within_limit.append(rid)
                    print(f"  {i:3d}/{len(ids)} {rid} within limit (raw={raw:,.0f})")
            except Exception as e:
                print(f"  {i:3d}/{len(ids)} {rid} error: {e}")
                no_data_again.append({"request_id": rid, "error": str(e)})
            time.sleep(0.3)

    print(f"\nResults: overlimit={len(overlimit)} within={len(within_limit)} "
          f"still_no_data={len(no_data_again)}")
    json.dump(overlimit, open(OVERLIMIT_OUT, "w"), indent=2, default=str)
    print(f"Saved over-limit list to {OVERLIMIT_OUT}")

    # Now bulk-fail the over-limit ones
    if overlimit:
        ids_to_fail = [r["request_id"] for r in overlimit]
        with httpx.Client(timeout=300) as client:
            r = client.post(
                f"{PROD}/api/bank-transfer/admin/bulk-mark-failed",
                json={
                    "request_ids": ids_to_fail,
                    "admin_id": admin_uid,
                    "remark": "Over Limit",
                    "mark_all_pending": False,
                },
                headers=headers,
            )
            r.raise_for_status()
            res = r.json()
            print(f"\nFAIL EXEC: failed={res.get('failed_count')} "
                  f"refund={res.get('total_refunded'):,.0f} PRC "
                  f"errors={res.get('error_count')}")


if __name__ == "__main__":
    main()
