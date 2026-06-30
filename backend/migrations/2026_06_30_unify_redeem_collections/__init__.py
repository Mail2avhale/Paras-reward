"""
Unified Redeem Migration — 2026-06-30
======================================

Goal
----
Consolidate the historical user-payout data spread across 5 active legacy
collections into the canonical `redeem_requests` collection. This lets the
admin (and any user-spend analytics) compute the **exact amount a user has
spent** across Bank Redeem (DMT, EMI, bank_transfer, bank_withdrawal) and
Recharge/Utility (mobile, DTH, electricity, gas, etc.) — from ONE collection.

Safety
------
• NOTHING is dropped. Legacy collections will be RENAMED to
  `_archive_2026_06_30_<original>` after migration so they remain available
  for rollback.
• Every migrated doc carries `_migrated_from`, `_migration_date`,
  `_legacy_id`, `_legacy_request_id` for full traceability.
• `request_id` is used to dedupe against the existing `redeem_requests`
  rows so re-running this script is idempotent.

Categories (`service_type` taxonomy)
------------------------------------
• Bank Redeem  : bank_transfer, bank_withdrawal, dmt, emi
• Recharge/Util: mobile_recharge, mobile_prepaid, mobile_postpaid, dth,
                 electricity, gas, water, broadband, landline, lpg

Run order
---------
1. `python migrations/2026_06_30_unify_redeem_collections/snapshot.py`
2. `python migrations/2026_06_30_unify_redeem_collections/migrate.py --dry-run`
3. `python migrations/2026_06_30_unify_redeem_collections/migrate.py --apply`
4. `python migrations/2026_06_30_unify_redeem_collections/archive.py --apply`
5. `python migrations/2026_06_30_unify_redeem_collections/verify.py`
"""
