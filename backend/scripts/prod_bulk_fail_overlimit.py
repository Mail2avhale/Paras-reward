"""
PRODUCTION - Bulk Fail Over-Limit Bank Redeem Requests

Two modes:
  --dry-run   : Identify all over-limit pending requests, save to JSON.
  --execute   : Read JSON, call /admin/bulk-mark-failed in chunks.

Usage:
  python -m scripts.prod_bulk_fail_overlimit --dry-run
  python -m scripts.prod_bulk_fail_overlimit --execute
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx

PROD = "https://www.parasreward.com"
ADMIN_EMAIL = "Admin@paras.com"
ADMIN_PIN = "153759"

OUT = Path(__file__).resolve().parent / "_prod_overlimit_pending.json"
PAGE_SIZE = 30   # backend enrichment hits 15s timeout above ~30 users/page
CHUNK = 50       # bulk-mark-failed batch size (keep modest to avoid timeout)
REMARK = "Over Limit"


def login() -> tuple[str, str]:
    r = httpx.post(
        f"{PROD}/api/auth/login",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PIN},
        timeout=30,
    )
    r.raise_for_status()
    d = r.json()
    return d["uid"], d["token"]


def _fetch_page(client, headers, skip, page_size):
    url = (
        f"{PROD}/api/bank-transfer/admin/requests"
        f"?status=pending"
        f"&sort_by=created_at&sort_order=asc"
        f"&limit={page_size}&skip={skip}"
    )
    r = client.get(url, headers=headers)
    r.raise_for_status()
    return r.json()


def fetch_overlimit(token: str) -> list[dict]:
    """Paginate /admin/requests; client-side filter by redeem_limit_raw < 0.

    If a page comes back with all redeem_limit_raw=None (enrichment timeout),
    retry that range with smaller chunks to get usable data.
    """
    headers = {"Authorization": f"Bearer {token}"}
    collected = []
    seen_ids = set()
    skip = 0
    page = 0
    final_no_data_ids = []  # request_ids we couldn't enrich after retries

    def _absorb(reqs):
        page_overlimit = 0
        page_no_data = 0
        for req in reqs:
            rid = req.get("request_id")
            raw = req.get("redeem_limit_raw")
            if not rid or rid in seen_ids:
                continue
            if raw is None:
                page_no_data += 1
                continue
            if raw < 0:
                seen_ids.add(rid)
                collected.append({
                    "request_id": rid,
                    "user_id": req.get("user_id"),
                    "user_name": req.get("user_name"),
                    "user_phone": req.get("user_phone"),
                    "withdrawal_amount": req.get("withdrawal_amount"),
                    "prc_deducted": req.get("prc_deducted"),
                    "redeem_limit_raw": raw,
                    "redeem_limit_total": req.get("redeem_limit_total"),
                    "redeem_limit_used": req.get("redeem_limit_used"),
                    "created_at": req.get("created_at"),
                })
                page_overlimit += 1
            else:
                seen_ids.add(rid)  # within limit, mark as seen
        return page_overlimit, page_no_data

    with httpx.Client(timeout=60) as client:
        while True:
            page += 1
            try:
                d = _fetch_page(client, headers, skip, PAGE_SIZE)
            except Exception as e:
                print(f"  p{page:3d} skip={skip} fetch err: {e}; retry in 5s")
                time.sleep(5)
                try:
                    d = _fetch_page(client, headers, skip, PAGE_SIZE)
                except Exception as e2:
                    print(f"  p{page:3d} second fail: {e2}; advance.")
                    skip += PAGE_SIZE
                    continue
            reqs = d.get("requests", [])
            total = d.get("pagination", {}).get("total", 0)
            ol, nd = _absorb(reqs)

            # If all rows on this page came back with no enrichment, retry
            # the SAME range with smaller chunks (limit=10) to get data.
            if nd == len(reqs) and len(reqs) > 0:
                retry_ol = 0
                retry_nd = 0
                got_reqs = 0
                for sub_skip in range(skip, skip + len(reqs), 10):
                    try:
                        sub = _fetch_page(client, headers, sub_skip, 10)
                        sub_reqs = sub.get("requests", [])
                        got_reqs += len(sub_reqs)
                        a, b = _absorb(sub_reqs)
                        retry_ol += a
                        retry_nd += b
                        # any still-no-data rows from this sub-range
                        for sr in sub_reqs:
                            if sr.get("redeem_limit_raw") is None:
                                final_no_data_ids.append(sr.get("request_id"))
                    except Exception as e:
                        print(f"    retry sub_skip={sub_skip} err: {e}")
                    time.sleep(0.4)
                print(
                    f"  p{page:3d} skip={skip:5d}/{total} BIG-PAGE-TIMEOUT: "
                    f"retried with limit=10, ol+={retry_ol} still_no_data={retry_nd}"
                )
                ol += retry_ol
                nd = retry_nd
            else:
                # Track no-data rids for potential later retry
                for r in reqs:
                    if r.get("redeem_limit_raw") is None:
                        final_no_data_ids.append(r.get("request_id"))

            print(
                f"  p{page:3d} skip={skip:5d}/{total} returned={len(reqs):2d} "
                f"overlimit={ol} no_data={nd} "
                f"cum_ol={len(collected)} cum_nd={len(final_no_data_ids)}",
                flush=True,
            )
            skip += PAGE_SIZE
            if skip >= total or not reqs:
                break
            time.sleep(0.4)
    print(
        f"\nTotal pages: {page} | over-limit found: {len(collected)} | "
        f"unresolved no_data: {len(final_no_data_ids)}"
    )
    # Persist the no_data list separately so we can retry it later
    if final_no_data_ids:
        with open(OUT.parent / "_prod_unresolved_no_data.json", "w") as f:
            json.dump(final_no_data_ids, f, indent=2)
    return collected


def bulk_fail(admin_uid: str, token: str, request_ids: list[str]) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "request_ids": request_ids,
        "admin_id": admin_uid,
        "remark": REMARK,
        "mark_all_pending": False,
    }
    with httpx.Client(timeout=300) as client:
        r = client.post(
            f"{PROD}/api/bank-transfer/admin/bulk-mark-failed",
            json=payload,
            headers=headers,
        )
        r.raise_for_status()
        return r.json()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--execute", action="store_true")
    args = ap.parse_args()

    if not (args.dry_run or args.execute):
        ap.error("Pass --dry-run or --execute")

    print(f"[1/3] Logging in as {ADMIN_EMAIL}...")
    admin_uid, token = login()
    print(f"      admin_uid={admin_uid}\n")

    if args.dry_run:
        print("[2/3] Fetching all OVER-LIMIT pending requests (paginated)...")
        rows = fetch_overlimit(token)
        total_prc = sum(float(r.get("prc_deducted") or 0) for r in rows)
        total_inr = sum(float(r.get("withdrawal_amount") or 0) for r in rows)
        with open(OUT, "w") as f:
            json.dump(
                {
                    "count": len(rows),
                    "total_prc_to_refund": total_prc,
                    "total_inr": total_inr,
                    "remark": REMARK,
                    "rows": rows,
                },
                f,
                indent=2,
                default=str,
            )
        print(f"\n[3/3] DRY RUN COMPLETE")
        print(f"      Over-limit pending: {len(rows)}")
        print(f"      Total PRC to refund: {total_prc:,.2f}")
        print(f"      Total INR to fail:   ₹{total_inr:,.0f}")
        print(f"      Saved to: {OUT}")
        return

    # EXECUTE
    if not OUT.exists():
        print(f"ERROR: {OUT} not found. Run --dry-run first.")
        sys.exit(1)
    data = json.load(open(OUT))
    rows = data["rows"]
    ids = [r["request_id"] for r in rows if r.get("request_id")]
    print(f"[2/3] Loaded {len(ids)} request IDs from dry-run file.")

    if not ids:
        print("Nothing to do.")
        return

    print(f"[3/3] EXECUTING bulk-mark-failed in chunks of {CHUNK}...")
    total_failed = 0
    total_refunded = 0
    total_errors = 0
    for i in range(0, len(ids), CHUNK):
        chunk = ids[i : i + CHUNK]
        try:
            res = bulk_fail(admin_uid, token, chunk)
            fc = res.get("failed_count", 0)
            tr = res.get("total_refunded", 0)
            ec = res.get("error_count", 0)
            total_failed += fc
            total_refunded += tr
            total_errors += ec
            print(
                f"  chunk {i//CHUNK+1} ({len(chunk)} ids): "
                f"failed={fc} refund={tr:,.0f} errors={ec}"
            )
        except Exception as e:
            print(f"  chunk {i//CHUNK+1} FAILED: {e}")
            total_errors += len(chunk)
        time.sleep(0.5)

    print("\n=== EXECUTION COMPLETE ===")
    print(f"  Total failed:   {total_failed}")
    print(f"  Total refunded: {total_refunded:,.2f} PRC")
    print(f"  Total errors:   {total_errors}")


if __name__ == "__main__":
    main()
