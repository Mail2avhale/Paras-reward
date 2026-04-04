# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 4 April 2026

## COMPLETED: Subscription Activation Desync Bug Fix (P0 Critical) - 4 April 2026
### Production Bug: User pays PRC for Elite → sees "Explorer" on login
**Root Cause 1 — Cache not invalidated:**
- `subscription_pay_with_prc` and `admin_activate_prc_subscription` did NOT clear user cache after activation
- User continued seeing stale cached "explorer" data for up to 2 minutes
- FIX: Added `cache.delete(f"user_data:{uid}")` + `cache.delete(f"user:dashboard:{uid}")` after activation

**Root Cause 2 — SYNC FIX only checked vip_payments:**
- `get_user_data` (line ~8096) has a SYNC FIX that auto-restores subscription if user is "explorer" but has valid payment
- This ONLY checked `vip_payments` collection (Razorpay/INR payments)
- PRC subscriptions are stored in `subscription_payments` — never checked!
- FIX: Added `subscription_payments` check with `payment_method: "prc"` in SYNC FIX

**Root Cause 3 — subscription_expired flag not cleared:**
- When previous subscription expired, `subscription_expired: True` was set on user document
- New subscription activation did NOT reset this to False
- Some code paths checked this flag and treated user as expired
- FIX: Added `subscription_expired: False` to both activation functions

### Files Fixed:
- `server.py` — `subscription_pay_with_prc`: cache invalidation + subscription_expired: False
- `server.py` — `get_user_data` SYNC FIX: subscription_payments check added
- `routes/admin_misc.py` — `admin_activate_prc_subscription`: subscription_expired: False

## COMPLETED: Redeem Limit Status Filter Bug Fix (P0 Critical) - 4 April 2026
### Phase 1 (Core Fix)
- `server.py` `get_user_all_time_redeemed`: Added `pending`, removed `max(txn_total, total_redeemed)`, orders $nin→$in
- `admin_user360.py`: Uses centralized function via `set_redeemed_fn`

### Phase 2 (Comprehensive — ALL files)
- 15+ locations across 9 files fixed with consistent valid statuses
- Two standardized categories: VALID_REDEEMED (includes pending) + COOLDOWN_ONLY (excludes pending)

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
