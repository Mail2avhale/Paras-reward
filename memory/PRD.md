# Paras Reward System - PRD

## Original Problem Statement
PRC Wallet System with mining, referrals, subscriptions, and redemption features.

## What's Been Implemented (March 2026)

### Session: March 15, 2026

#### Critical Fixes Applied:
1. **PRC Balance Restoration** - All ~1,221 users with missing balance restored
   - Formula: `total_mined - legitimate_redemptions + 20% compensation`
   - API: `/api/admin/prc-balance/fix-all-missing`

2. **Pro/Growth → Elite Upgrade** - 24 Growth users upgraded to Elite
   - API: `/api/admin/upgrade-to-elite`

3. **Active User Condition Updated**
   - New Logic: `Active = Elite subscription + Mining session active`
   - Both conditions must be true
   - Updated in: server.py, referral.py

4. **Diagnostic APIs Created**
   - `/api/admin/prc-balance/check-user/{uid}` - Check any user's balance data
   - `/api/admin/prc-balance/proper-restore` - Restore from balance_corrections
   - `/api/admin/prc-balance/fix-all-missing` - Fix all users with missing balance

### Previous Session Fixes:
- 100x PRC refund bug data correction (~5.94 crore removed from 491 users)
- Admin page sorting timeout optimization
- "Used" limit and "Active Referrals" calculation fix
- Razorpay subscription double activation fix
- Webhook-based auto-burn system

## Pending Issues

### P1 (High Priority):
- **100x Refund Bug Root Cause** - The bulk reject operation bug not yet fixed at source

### P2 (Medium Priority):
- PRC Rate manual override UI for admin
- Manual bank transfer notifications
- Production deployment crash issues

### P3 (Low Priority):
- 145 failed BBPS transactions root cause
- "Redeem to Bank" page routing issue

## Key APIs

### Balance Management:
- `GET /api/admin/prc-balance/check-user/{uid}` - Diagnose user balance
- `GET /api/admin/prc-balance/fix-all-missing?dry_run=false` - Fix missing balances
- `POST /api/admin/upgrade-to-elite?dry_run=false` - Upgrade Pro/Growth to Elite

### Referrals:
- `GET /api/referrals/{user_id}/levels?force_refresh=true` - Get referral tree (bypass cache)

## Test Credentials
- **User Login:** `id: 9421331342`, `pin: 942133`
- **Admin Login:** `email: Admin@paras.com`, `pin: 153759`

## Architecture
```
/app
├── backend/
│   ├── server.py          # Main API logic
│   ├── routes/
│   │   └── referral.py    # Referral APIs
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/
        └── components/
```

## Active User Logic (Updated March 15, 2026)
```python
# User is ACTIVE only if:
# 1. subscription_plan == "elite" AND
# 2. mining_active == True AND mining_session_end > now
is_active = is_elite AND is_mining
```
