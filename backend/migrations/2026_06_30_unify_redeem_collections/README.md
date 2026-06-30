# Unified Redeem Migration — 2026-06-30

**Goal**: One single source of truth (`redeem_requests`) for every user-initiated
PRC outflow. Lets the admin compute the **exact amount a user has spent**
across Bank Redeem (DMT, EMI, bank_transfer, bank_withdrawal) and
Recharge/Utility (mobile, DTH, electricity, gas, etc.) — from ONE
collection.

---

## What changed

Before this migration, the same conceptual data was scattered across 5 active
+ 4 dead collections. **All scattered data has now been merged into
`redeem_requests`** (the canonical collection already used by
`unified_redeem_v2.py`).

| Source collection | Docs migrated | Mapped `service_type` |
|---|---|---|
| `bank_transfer_requests` | 3 | `bank_transfer` |
| `bank_withdrawal_requests` | 2 | `bank_withdrawal` |
| `chatbot_withdrawal_requests` | 10 | `bank_transfer` |
| `recharge_transactions` | 16 | `mobile_recharge` (best-guess; legacy minimal schema) |
| `bill_payment_requests` | 2 | `electricity` / `gas` / `water` / ... (inferred from `bill_type`) |

Every migrated doc carries `_migrated_from`, `_migration_date`,
`_legacy_id`, `_legacy_request_id` for full traceability.

---

## Safety (user explicitly chose "rollback possible")

1. **Snapshots first** — Every legacy collection was dumped to
   `snapshots/<collection>.json` BEFORE any write.
2. **No data lost** — Legacy collections were temporarily renamed
   `_archive_2026_06_30_<name>` then RESTORED to their original names so old
   readers/writers continue to work.
3. **Idempotent** — Re-running `migrate.py` skips rows already present in
   `redeem_requests` (keyed by `_legacy_request_id`).
4. **Auto-sync** — A scheduler job (`server.py`,
   `sync_legacy_to_unified_redeem`, every 15 min) keeps `redeem_requests` in
   sync with any new writes to the legacy collections, so admin reports stay
   current without refactoring every writer.

---

## How to query "exact amount user X has spent"

```bash
# Per-user breakdown (Bank + Utility) — admin auth required
GET /api/admin/unified-spend/user/{uid}

# Global totals
GET /api/admin/unified-spend/summary
GET /api/admin/unified-spend/summary?category=bank
GET /api/admin/unified-spend/summary?category=utility&only_success=true

# Top spenders leaderboard
GET /api/admin/unified-spend/top-spenders?limit=20
```

Sample response (`/user/{uid}`):
```json
{
  "uid": "cbdf46d7-...",
  "user": { "name": "SANTOSH AVHALE", "mobile": "9970100782" },
  "totals": {
    "bank_inr": 7900, "bank_prc": 108010,
    "utility_inr": 1565, "utility_prc": 19887,
    "grand_inr": 9465, "grand_prc": 127897
  },
  "by_service_type": [
    { "category": "bank", "service_type": "bank_transfer", "txns": 4, "inr": 6000, ... },
    { "category": "bank", "service_type": "bank_withdrawal", "txns": 1, "inr": 1900, ... },
    { "category": "utility", "service_type": "mobile_postpaid", "txns": 1, "inr": 1415, ... }
  ],
  "recent": [ ... last 20 transactions, newest first ... ]
}
```

---

## Service-type taxonomy

| Category | service_type values |
|---|---|
| **Bank Redeem** | `bank_transfer`, `bank_withdrawal`, `dmt`, `emi` |
| **Recharge/Utility** | `mobile_recharge`, `mobile_prepaid`, `mobile_postpaid`, `dth`, `electricity`, `gas`, `water`, `broadband`, `landline`, `lpg` |

---

## Rollback (if needed)

Snapshots are at `snapshots/*.json` — restore via mongoimport. Migrated
rows in `redeem_requests` can be removed in bulk via
`db.redeem_requests.deleteMany({_migrated_from: {$exists: true}})`.

---

## Scripts

| Script | Purpose |
|---|---|
| `snapshot.py` | JSON-dump every legacy collection. **Run first.** |
| `migrate.py --apply` | Merge legacy rows into `redeem_requests`. Idempotent. |
| `archive.py --apply` | Rename legacy collections to `_archive_...`. *(Not used in production — we keep originals intact and let auto-sync mirror new rows.)* |
| `unarchive.py --apply` | Reverse of archive.py. |
| `verify.py` | Print post-migration totals + sanity checks. |

The auto-sync job (every 15 min) is the production mechanism — these
scripts are for the initial one-time migration + ad-hoc verification.
