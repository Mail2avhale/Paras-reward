# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 4 April 2026

## COMPLETED: Redeem Limit Status Filter Bug Fix (P0 Critical) - 4 April 2026
### Phase 1 (Core Fix)
- `server.py` `get_user_all_time_redeemed`: Added `pending`, removed `max(txn_total, total_redeemed)`, orders $nin→$in
- `admin_user360.py`: Uses centralized function via `set_redeemed_fn`

### Phase 2 (Comprehensive — ALL files across codebase)
Files fixed with consistent valid statuses:
1. `server.py` — `get_user_all_time_redeemed` (core), `get_user_total_redeemed` (debug), `get_user_redemption_stats`, `get_paid_users_wallet_summary`, User360 redeem breakdown, admin stats, user listing, weekly cooldowns
2. `routes/users.py` — User stats total_redeemed
3. `routes/admin_user360.py` — Centralized via `set_redeemed_fn`
4. `routes/admin_dashboard.py` — All 8 global aggregation queries
5. `routes/prc_audit.py` — All 6 debit collection queries  
6. `routes/bank_redeem.py` — Cooldown check (added `paid` variants)
7. `routes/admin_misc.py` — Blocking status checks
8. `routes/unified_redeem_v2.py` — Admin audit queries
9. `utils/redeem_validations.py` — Monthly category limit check

### Two standardized status categories:
- **VALID_REDEEMED** (Used amount calculation): completed, success, approved, paid, pending, processing, delivered (+ ALL case variants)
- **COOLDOWN_ONLY** (blocking/cooldown): Same minus pending/processing

### Remaining (low priority, not calculation):
- Admin charts (24350-24474): reporting only
- Display/listing endpoints (14166-14281): intentional status grouping
- Product order fulfillment (30564-45099): business logic
- Utility scripts: maintenance

## Earlier Completed Work (Summary)
- Production 520 Error Fix, Single Leg Tree + Mining, Growth Network UI (29 Mar)
- Economy Rules, Razorpay + PRC Pricing, Login Bug Fix (29 Mar)
- RewardLoader Spinners, Registration Error Handling (29 Mar)
- 3-Tier Network Cap Formula, PRC Collect Balance UI Bug Fix (29-30 Mar)
- Smart AI Chatbot, Auto-Burning System, Admin Redeem Limits Overview (30 Mar)
- Chatbot Earning Projections, Daily Mining Base Rate Change (30-31 Mar)
- Speed Display Rebranding, Admin Auto-Burn Manual Trigger (31 Mar)
- Invoice Display with Print, Auto-Burn Background Cron Job (31 Mar)
- Popcorn Icon UI Replacement (31 Mar)
- Subscription Expiry Bug Fix, Admin Dashboard PRC Economy Stats (1 Apr)
- PRC Audit Endpoint, Holiday Calendar Date Fix (1 Apr)
- Admin Login-As-User Dual Logout Bug Fix (1 Apr)
- Login "Account Not Found" Bug Fix (2 Apr)
- PRC Subscription Bypasses Redeem Limit (2 Apr)
- Redeem Limit Formula Fix — Total Earned = Balance Only (2 Apr)
- PRC Dynamic Rate Inconsistency Bug Fix (3 Apr)
- Admin PRC Subscription & Redeem Actions (3 Apr)
- Admin Subscription Management + Upcoming Plan Concept (3 Apr)
- Code Quality & Security Fixes (3 Apr)

## Active Architecture
- Mining: (500 + N×prc_per_user) × boost (Cash=1.0, PRC=0.70)
- Network Cap: min(6000, 800 + 16×D + 5×L1)
- Burn: Cash=1%, PRC=5% on ALL services
- PRC rate: Dynamic `/api/prc-economy/current-rate`

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js
- P2: server.py refactoring (45k+ lines)
- P2: 218 React hook dependency warnings fix
- P2: Large frontend component files split
- P3: MongoDB → PostgreSQL migration
