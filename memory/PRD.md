# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 5 April 2026

## COMPLETED: Transaction Record Audit & Admin Management (P0) - 5 April 2026

### Deep Investigation Results
Traced ALL `prc_balance` modifications across 25+ locations in 15+ files. Found 4 missing transaction records:

| Entry Type | Issue | Fix |
|---|---|---|
| Daily Streak First Login | 5 PRC awarded, NO transaction | Added `transactions.insert_one()` |
| EKO Callback DMT Refund | PRC refunded, NO transaction | Added `transactions.insert_one()` with type=dmt_refund |
| Gift Subscription | 600 PRC deducted, only embedded array | Added `transactions.insert_one()` with type=gift_subscription |
| Fix Negative Balance | Balance reset to 0, only audit_log | Added `transactions.insert_one()` with type=admin_adjustment |

### PRC Statement (Wallet) — Missing Source Fixed
- **Before**: Read from 3 collections (prc_ledger, transactions, ledger)
- **After**: Reads from 4 collections (+prc_transactions for auto-burn & admin credits)
- All 4 sources now filter `deleted: {$ne: True}` for soft-delete support
- Added 7 new type mappings: daily_streak, achievement, admin_refund, order_refund, gift_subscription, subscription_refund, dmt_refund

### Admin Transaction Management API (NEW)
- `GET /api/admin/transactions/{user_id}` — List all transactions across 4 collections with pagination & type filter
- `PUT /api/admin/transactions/{txn_id}` — Edit amount/description/type with audit log + edit_history
- `DELETE /api/admin/transactions/{txn_id}` — Soft-delete (marks deleted=true, preserves in DB)
- `POST /api/admin/transactions/{txn_id}/refund` — Refund debit transactions, validates not-already-refunded
- `POST /api/admin/transactions/{txn_id}/restore` — Restore soft-deleted transactions

### Files Created/Modified
- NEW: `routes/admin_transactions.py` — Full CRUD + Refund + Restore
- Modified: `routes/prc_statement.py` — 4th source (prc_transactions), soft-delete filter, 7 new TYPE_MAP entries
- Modified: `routes/eko_callback.py` — DMT refund transaction record
- Modified: `routes/gift_subscription.py` — Gift subscription transaction record
- Modified: `server.py` — First login bonus transaction, negative balance fix transaction, router registration

## COMPLETED: Core Formula System Audit & Refactor (P0) - 4 April 2026

### 1. Subscription Active/Inactive — Consolidated
- Single source of truth in `utils/helpers.py`
- `burning.py` imports from helpers.py (removed 50+ line duplicate)
- Rule: Explorer check FIRST → status → expiry → paid plan + no expiry → expired flag

### 2. Mining Formula — Fixed & Synchronized
- BASE_MINING = 1000 PRC/day (user confirmed)
- Fixed growth_economy.py DEFAULT_BASE_MINING 500→1000
- Added DEFAULT_BASE_MINING_THRESHOLD=250 to growth_economy.py
- DB economy_settings updated

### 3. Redeem Formula — Critical Fix
- OLD: `total_earned = current_balance` → negative drift from auto-burn
- NEW: `total_earned = total_mined - total_redeemed` with reconciliation fallback
- Removed 140 lines dead code
- `max(0)` prevents negative limits

### 4. Network Formula — Verified Clean
### 5. PRC Dynamic — Verified Clean (5-factor in prc_economy.py)

### 6. Mining Collect — Dual Field Fix
- Now increments both `total_mined_prc` AND `total_mined`

## Earlier Completed Work (Summary)
- Redeem Limit Status Filter Fix (15+ files, 9 locations)
- Subscription Activation Desync Bug Fix
- Bulletproof Active/Inactive Detection + Wrongful Burning Fix
- Production fixes, Growth Network, Mining, Economy, Admin features (29 Mar - 3 Apr)

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js
- P2: server.py refactoring (45k+ lines monolith)
- P2: 218 React hook dependency warnings
- P2: Split large frontend components
- P3: MongoDB → PostgreSQL migration
