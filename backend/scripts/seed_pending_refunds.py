"""
Seed Pending Refunds (One-Shot Reconciliation)
==============================================
Marks status='refund_pending' on all known Eko transactions that are stuck in
refund-pending state on Eko's side but not yet reflected in our DB.

- 53 BBPS transactions (Mobile Recharge / Bill Payment) — matched by eko_tid or client_ref_id
- 7 DMT transactions (Money Remittance) — matched by eko_client_ref_id / client_ref_id

Run (production):
    cd /app/backend && python scripts/seed_pending_refunds.py

Idempotent: re-running won't duplicate. Safe to run multiple times.

When matched, the user will see a blocking modal on login (RefundBlockerModal)
that lets them complete the refund via Eko OTP flow.
"""

import os
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load .env
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

if not MONGO_URL or not DB_NAME:
    print("ERROR: MONGO_URL / DB_NAME missing from backend/.env")
    sys.exit(1)


# =========================================================
# DATA
# =========================================================
# Source: Eko portal Transaction History export (Refund pending status)

# 53 BBPS Recharge transactions — (eko_tid, client_ref_id, cell_number, amount_inr)
BBPS_PENDING_REFUNDS = [
    ("3554878505", "PAY1775482475430", "9198297047", 1849),
    ("3554878178", "PAY1775482130303", "6393331527", 799),
    ("3554878012", "PAY1775481945055", "6393331527", 799),
    ("3554860600", "PAY1775467163388", "9322003822", 3599),
    ("3554860530", "PAY1775467098363", "9322003822", 3599),
    ("3554860154", "PAY1775466645138", "9936222482", 3599),
    ("3554859979", "PAY1775466414764", "9936222482", 3599),
    ("3554859939", "PAY1775466371055", "8692951107", 859),
    ("3554859834", "PAY1775466237770", "8692951107", 859),
    ("3554859724", "PAY1775466102916", "9936222482", 899),
    ("3554857368", "PAY1775465891150", "9936222482", 3599),
    ("3554856923", "PAY1775465810914", "8181812092", 3599),
    ("3554856915", "PAY1775465804388", "9936222482", 3599),
    ("3554856828", "PAY1775465722709", "9198297047", 859),
    ("3554856565", "PAY1775465462312", "9198297047", 859),
    ("3554856498", "PAY1775465360029", "8874137317", 868),
    ("3554856445", "PAY1775465324846", "8181812092", 3999),
    ("3554856393", "PAY1775465282839", "8874137317", 868),
    ("3554856270", "PAY1775465073662", "9451763818", 899),
    ("3554856224", "PAY1775465023292", "9872893817", 629),
    ("3554852928", "PAY1775463953829", "9026811652", 2249),
    ("3554852872", "PAY1775463884026", "9819646232", 899),
    ("3554852849", "PAY1775463841110", "7310437020", 859),
    ("3554852540", "PAY1775463492983", "8400132628", 859),
    ("3554852416", "PAY1775463322504", "9630092037", 3599),
    ("3554852371", "PAY1775463259069", "7310437020", 739),
    ("3554852309", "PAY1775463200496", "8400132628", 859),
    ("3554852267", "PAY1775463136054", "8400132628", 859),
    ("3554852230", "PAY1775463085600", "7310437020", 859),
    ("3554851948", "PAY1775462767698", "9651151524", 3599),
    ("3554851752", "PAY1775462599601", "9340997838", 599),
    ("3554851704", "PAY1775462517547", "6393331527", 899),
    ("3554851644", "PAY1775462424589", "6393331527", 999),
    ("3554851593", "PAY1775462368187", "8874137317", 868),
    ("3554851488", "PAY1775462349498", "8692951107", 859),
    ("3554848887", "PAY1775462163295", "8692951107", 859),
    ("3554848687", "PAY1775461945136", "9651151524", 3599),
    ("3554848505", "PAY1775461753913", "9309486358", 599),
    ("3554848222", "PAY1775461450514", "9651151524", 3599),
    ("3554847903", "PAY1775461093283", "7431928072", 859),
    ("3554847795", "PAY1775460955497", "7620548792", 599),
    ("3554847749", "PAY1775460890558", "7620548792", 899),
    ("3554847652", "PAY1775460813083", "9987046822", 1640),
    ("3554847505", "PAY1775460639686", "9152157173", 1800),
    ("3554846950", "PAY1775460601376", "9765290412", 579),
    ("3554846767", "PAY1775460596811", "9765290412", 579),
    ("3554844652", "PAY1775460300543", "9765290412", 899),
    ("3554785323", "PAY1775429914367", "9404776221", 1419),
    ("3554779182", "PAY1775426721174", "9404944504", 711),
    ("3554779049", "PAY1775426423214", "9423832894", 1098),
    ("3554769912", "PAY1775421948813", "8419975797", 3599),
    ("3554761303", "PAY1775417178524", "9987474443", 1199),
    ("3554757276", "PAY1775414982465", "6355517524", 1099),
]

# 7 DMT transactions — (eko_client_ref_id, amount_inr, phone, beneficiary_name, account_number, bank_name)
DMT_PENDING_REFUNDS = [
    ("DMT1E6F098CA229", 1000, "917385613884", "SIDDHALI MAHESH SAL", "51000000039879", "Saraswat Co-Op Bank"),
    ("DMT94C4A3C3CE21", 100, "919421331342", "Test User", "04588100009023", "Bank Of Baroda"),
    ("DMTEAFE9F326F00", 1000, "918001755185", "", "110401000020411", "Indian Overseas Bank"),
    ("DMTE3D21184173E", 100, "919421331342", "Test User", "8829010000024578", "DBS Bank"),
    ("DMT8C89EF7B6725", 100, "919970100782", "SANTOSH AVHALE", "04588100009023", "Bank Of Baroda"),
    ("DMTE250F395235F", 100, "919970100782", "SANTOSH AVHALE", "31277621502", "State Bank Of India"),
    ("TEST123456",    100, "919970100782", "SANTOSH AVHALE", "31277621502", "State Bank Of India"),
]


async def match_user_by_mobile(db, mobile: str):
    """Look up user by mobile across common fields."""
    if not mobile:
        return None
    # Strip 91 prefix if present
    norm = mobile.lstrip("+")
    if norm.startswith("91") and len(norm) > 10:
        norm = norm[2:]
    for query in [
        {"mobile": norm},
        {"phone": norm},
        {"mobile": mobile},
        {"phone": mobile},
    ]:
        user = await db.users.find_one(query, {"_id": 0, "uid": 1, "name": 1, "mobile": 1})
        if user:
            return user
    return None


async def mark_as_refund_pending(db, eko_tid: str, client_ref_id: str = None):
    """Try to find the transaction in any of 4 collections and mark status=refund_pending.
    Returns dict with {matched: bool, collection: str, user_id: str, user_name: str}
    """
    collections = [
        "recharge_transactions",
        "bill_payment_requests",
        "dmt_transactions",
        "bank_transfer_requests",
    ]

    ids_to_try = [v for v in [eko_tid, client_ref_id] if v]

    for coll_name in collections:
        coll = db[coll_name]
        for ident in ids_to_try:
            query = {"$or": [
                {"eko_tid": ident},
                {"client_ref_id": ident},
                {"eko_client_ref_id": ident},
            ]}
            txn = await coll.find_one(query, {"_id": 0, "user_id": 1, "status": 1})
            if txn:
                user_id = txn.get("user_id")
                user = await db.users.find_one({"uid": user_id}, {"_id": 0, "name": 1, "mobile": 1}) if user_id else None
                # Only update if not already refunded
                if txn.get("status") not in ("refunded",):
                    await coll.update_one(
                        query,
                        {"$set": {
                            "status": "refund_pending",
                            "refund_pending_marked_at": datetime.now(timezone.utc).isoformat(),
                            "refund_pending_source": "eko_reconciliation",
                        }}
                    )
                return {
                    "matched": True,
                    "collection": coll_name,
                    "user_id": user_id or "",
                    "user_name": (user or {}).get("name", ""),
                    "user_mobile": (user or {}).get("mobile", ""),
                    "already_refunded": txn.get("status") == "refunded",
                }
    return {"matched": False}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("=" * 78)
    print("SEED PENDING REFUNDS — Eko Reconciliation")
    print("=" * 78)

    total = len(BBPS_PENDING_REFUNDS) + len(DMT_PENDING_REFUNDS)
    print(f"Total transactions to reconcile: {total}")
    print(f"  BBPS: {len(BBPS_PENDING_REFUNDS)}")
    print(f"  DMT:  {len(DMT_PENDING_REFUNDS)}")
    print()

    matched = []
    unmatched_bbps = []
    unmatched_dmt = []

    # Process BBPS
    print("[BBPS] Processing 53 pending refunds...")
    for eko_tid, client_ref_id, cell_number, amount in BBPS_PENDING_REFUNDS:
        result = await mark_as_refund_pending(db, eko_tid, client_ref_id)
        if result["matched"]:
            matched.append({
                "type": "BBPS",
                "eko_tid": eko_tid,
                "client_ref_id": client_ref_id,
                "cell_number": cell_number,
                "amount": amount,
                **result,
            })
            flag = " (already refunded)" if result.get("already_refunded") else ""
            print(f"  [OK] {eko_tid} → {result['user_name']} ({result['user_mobile']}) "
                  f"in {result['collection']}{flag}")
        else:
            unmatched_bbps.append({
                "eko_tid": eko_tid,
                "client_ref_id": client_ref_id,
                "cell_number": cell_number,
                "amount": amount,
            })

    print()
    print("[DMT] Processing 7 pending refunds...")
    for cl_id, amount, phone, bname, account, bank in DMT_PENDING_REFUNDS:
        result = await mark_as_refund_pending(db, cl_id, None)
        if result["matched"]:
            matched.append({
                "type": "DMT",
                "client_ref_id": cl_id,
                "amount": amount,
                "phone": phone,
                "beneficiary_name": bname,
                "account_number": account,
                "bank_name": bank,
                **result,
            })
            flag = " (already refunded)" if result.get("already_refunded") else ""
            print(f"  [OK] {cl_id} → {result['user_name']} ({result['user_mobile']}) "
                  f"in {result['collection']}{flag}")
        else:
            unmatched_dmt.append({
                "client_ref_id": cl_id,
                "amount": amount,
                "phone": phone,
                "beneficiary_name": bname,
                "account_number": account,
                "bank_name": bank,
            })

    print()
    print("=" * 78)
    print("SUMMARY")
    print("=" * 78)
    print(f"Matched:           {len(matched)} / {total}")
    print(f"Unmatched BBPS:    {len(unmatched_bbps)} / {len(BBPS_PENDING_REFUNDS)}")
    print(f"Unmatched DMT:     {len(unmatched_dmt)} / {len(DMT_PENDING_REFUNDS)}")
    print()

    # User-wise summary
    user_counts = {}
    for m in matched:
        key = f"{m.get('user_name','?')} ({m.get('user_mobile','?')})"
        user_counts[key] = user_counts.get(key, 0) + 1
    if user_counts:
        print("Impacted users (by count):")
        for k, v in sorted(user_counts.items(), key=lambda x: -x[1]):
            print(f"  {v:3d}  {k}")

    if unmatched_bbps or unmatched_dmt:
        print()
        print("UNMATCHED TRANSACTIONS (need manual investigation):")
        for u in unmatched_bbps:
            print(f"  BBPS eko_tid={u['eko_tid']} ref={u['client_ref_id']} "
                  f"phone={u['cell_number']} amount=₹{u['amount']}")
        for u in unmatched_dmt:
            print(f"  DMT  ref={u['client_ref_id']} beneficiary={u['beneficiary_name']} "
                  f"account={u['account_number']} amount=₹{u['amount']}")
        print()
        print("These transactions were not found in DB by eko_tid or client_ref_id.")
        print("They may have been processed directly on Eko portal without our system "
              "tracking, OR our records use a different identifier.")

    # Log the reconciliation run
    await db.admin_audit_logs.insert_one({
        "action": "seed_pending_refunds_reconciliation",
        "total_candidates": total,
        "matched": len(matched),
        "unmatched_bbps": len(unmatched_bbps),
        "unmatched_dmt": len(unmatched_dmt),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
