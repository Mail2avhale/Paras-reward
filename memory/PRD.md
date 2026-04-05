# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 4 April 2026

## COMPLETED: Core Formula System Audit & Refactor (P0) - 4 April 2026

### 1. Subscription Active/Inactive — Consolidated
- `is_subscription_active()` now single source of truth in `utils/helpers.py`
- `burning.py` imports from helpers.py (removed duplicate 50+ line function)
- Rule order: Explorer/free check FIRST → status check → expiry check → paid plan + no expiry → expired flag
- Ensures data inconsistencies (explorer + status=active) are handled correctly

### 2. Mining Formula — Fixed & Synchronized
- **BASE_MINING = 1000 PRC/day** (user confirmed)
- Fixed `growth_economy.py` DEFAULT_BASE_MINING from 500 → 1000
- Added `DEFAULT_BASE_MINING_THRESHOLD = 250` to growth_economy.py (was missing)
- Now both `mining.py` and `growth_economy.py` use same logic: base=1000 if network<250, else 0
- Fixed undefined variable bug in `/mining/rate-breakdown` endpoint
- DB economy_settings updated to base_mining=1000

### 3. Redeem Formula — Critical Fix
- **OLD (buggy)**: `total_earned = current_balance` → burned users get decreasing limits daily
- **NEW (correct)**: `total_earned = total_mined - total_redeemed`
- Reconciliation: `total_mined = max(total_mined_prc, total_mined, current_balance + total_redeemed)`
  - Handles users with missing/inaccurate total_mined fields
  - Backward compatible: for users without tracking, ≈ current_balance
  - Going forward: actual total_mined grows via mining collect
- Removed ~140 lines of dead/unreachable code (old plan-based formula)
- `available = max(0, ...)` prevents negative limits
- Added `total_mined` field to redeem-limit API response

### 4. Network Formula — Verified Clean
- 3-Tier Cap: min(6000, 800 + 16×D + 5×L1) — consistent across mining.py and growth_economy.py
- PRC_per_user = max(2.5, 5 × (21 - log₂(N)) / 14) — consistent
- No hardcoded overrides found

### 5. PRC Dynamic — Verified Clean
- 5-factor calculation in `prc_economy.py` (supply, demand, redeem pressure, time, manual override)
- Rate stored in `system_settings` collection, cached 5 minutes
- Fallback: DB app_settings → default 10 PRC = ₹1
- No hardcoded rate overrides found

### 6. Mining Collect — Dual Field Fix
- `mining.py` collect now increments BOTH `total_mined_prc` AND `total_mined`
- Ensures redeem limit formula has accurate data going forward

### Files Modified
- `routes/burning.py` — removed local is_subscription_active, import from helpers.py
- `utils/helpers.py` — added explorer/free check as Rule 1
- `routes/mining.py` — dual field increment, fixed rate-breakdown bug
- `routes/growth_economy.py` — BASE_MINING=1000, added THRESHOLD=250
- `server.py` — calculate_user_redeem_limit rewritten with total_mined formula, removed dead code

## COMPLETED: Bulletproof Active/Inactive Detection + Redeem Limit Fix - 4 April 2026

### Burning System — Bulletproof Active Detection
**Problem:** Elite users with missing `subscription_status`/`subscription_expiry` fields were treated as inactive → burned daily → balance dropping → redeem limit going negative daily
**Fix:** Now centralized in `utils/helpers.py`

### Mining SYNC FIX — check_subscription_expiry in mining.py
- If user is "explorer" but has active `subscription_payments` record → AUTO-RESTORE to elite

### Redeem Limit Formula
```
total_mined     = max(total_mined_prc, total_mined, current_balance + total_redeemed)
total_earned    = max(0, total_mined - total_redeemed)
redeemable      = total_earned × unlock%
available       = max(0, redeemable - total_redeemed)
effective       = min(available, current_balance)
```

## COMPLETED: Subscription Activation Desync Bug Fix (P0) - 4 April 2026
- Cache invalidation after subscription activation
- SYNC FIX checks both vip_payments AND subscription_payments
- `subscription_expired: False` set during activation

## COMPLETED: Redeem Limit Status Filter Bug Fix (P0) - 4 April 2026  
- 15+ locations across 9 files fixed with consistent valid statuses

## Earlier Completed Work (Summary)
- Production 520 Error Fix, Single Leg Tree + Mining, Growth Network UI (29 Mar)
- Economy Rules, Razorpay + PRC Pricing, Login Bug Fix (29 Mar)
- RewardLoader Spinners, Registration Error Handling, 3-Tier Network Cap (29 Mar)
- PRC Collect Balance UI Bug, Smart AI Chatbot, Auto-Burning System (30 Mar)
- Admin Redeem Limits, Chatbot Earning Projections (30 Mar)
- Daily Mining Base Rate Change, Speed Display Rebranding (31 Mar)
- Admin Auto-Burn, Invoice Display, Auto-Burn Cron Job (31 Mar)
- Popcorn Icon, Subscription Expiry Bug Fix, PRC Economy Stats (31 Mar - 1 Apr)
- PRC Audit, Holiday Calendar Fix, Admin Login-As-User Fix (1 Apr)
- Login "Account Not Found" Fix, PRC Sub Bypasses Redeem (2 Apr)
- Redeem Limit Formula, PRC Rate Inconsistency Fix (2-3 Apr)
- Admin PRC Actions, Subscription Management, Code Quality & Security (3 Apr)

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js
- P2: server.py refactoring (45k+ lines)
- P2: 218 React hook dependency warnings fix
- P2: Split large frontend components
- P3: MongoDB → PostgreSQL migration
