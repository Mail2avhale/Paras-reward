# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 4 April 2026

## COMPLETED: Bulletproof Active/Inactive Detection + Redeem Limit Fix - 4 April 2026

### Burning System — Bulletproof Active Detection
**Problem:** Elite users with missing `subscription_status`/`subscription_expiry` fields were treated as inactive → burned daily → balance dropping → redeem limit going negative daily
**Fix — `is_subscription_active()` in burning.py:**
1. `subscription_plan = explorer/free` → NOT active (burn)
2. `subscription_status = "active"` → ACTIVE (no burn)
3. Any expiry date in future → ACTIVE (no burn)
4. **NEW: Paid plan (elite/vip/growth) + NO expiry data → ASSUME ACTIVE** (safe default, missing data ≠ expired)
5. Paid plan + expiry in past + subscription_expired=True → NOT active (burn)

### Mining SYNC FIX — check_subscription_expiry in mining.py
- If user is "explorer" but has active `subscription_payments` record → AUTO-RESTORE to elite
- Sets subscription_plan, subscription_status, subscription_expired, membership_type
- Invalidates cache after restoration

### Redeem Limit Formula
```
total_earned  = current_balance
redeemable    = total_earned × unlock%
available     = max(0, redeemable - total_redeemed)   ← NEVER negative
effective     = min(available, current_balance)
```
- Available capped at 0 — users see 0 instead of -45000
- Active users don't get burned → balance stable → limit stable
- Users who've over-redeemed → available = 0 until mining recovers

### Files Modified
- `routes/burning.py` — `is_subscription_active()` bulletproof
- `routes/mining.py` — `check_subscription_expiry()` with subscription_payments SYNC FIX
- `server.py` — `calculate_user_redeem_limit()` max(0) cap

## COMPLETED: Subscription Activation Desync Bug Fix (P0) - 4 April 2026
- Cache invalidation after subscription activation
- SYNC FIX checks both vip_payments AND subscription_payments
- `subscription_expired: False` set during activation

## COMPLETED: Redeem Limit Status Filter Bug Fix (P0) - 4 April 2026  
- 15+ locations across 9 files fixed with consistent valid statuses
- pending/PENDING/Pending added, max() logic removed, orders $nin→$in

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
- P3: MongoDB → PostgreSQL migration
