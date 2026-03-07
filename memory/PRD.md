# PARAS REWARD - Product Requirements Document

## Original Problem Statement
A mining reward application with subscription-based economy. Users mine PRC tokens daily based on:
- Base rate (500 PRC/day = 20.83 PRC/hr)
- Single leg bonus (0.375 PRC/hr per PAID user, max 500)
- Team boost from 3 levels of friends (L1=5%, L2=3%, L3=2% = **10% total**)

### Key Requirements
1. **Mining Economy:** Additive formula: `Total = Base + SingleLeg + TeamBoost`
2. **Subscription:** ₹799/month Elite plan required for bonuses
3. **Google Play Policy:** 
   - Use "Invite Friends" instead of "Referral"
   - Use "Reward Points" not "Balance"
   - "Estimated Redeem Value" not fixed rate
4. **Mining Formula:** CONFIDENTIAL - Chatbot must NOT share

## What's Been Implemented

### March 2026 - Code Refactoring
- [x] Created `/models/schemas.py` - All Pydantic models
- [x] Created `/utils/helpers.py` - Common utility functions
- [x] Fixed duplicate `get_user()` function
- [x] Proper directory structure

### March 2026 - Mining Changes
- [x] Single leg bonus: 12 → **9 PRC/day** (0.375/hr per user)
- [x] Single leg count: **Only PAID subscribers** (Free excluded)
- [x] Razorpay auto-sync: 5 min → **1 min** (faster activation)

### March 2026 - UI/Policy
- [x] Google Play Policy Safe PRC Card
- [x] Tap Game REMOVED from bottom nav
- [x] "Referral" → "Invite Friends" everywhere

## Backend Structure
```
/app/backend/
├── models/
│   ├── __init__.py
│   └── schemas.py          # Pydantic models
├── routes/                  # 46 route files
│   ├── mining_economy.py
│   ├── referral.py
│   └── ...
├── utils/
│   ├── helpers.py          # Common utilities
│   └── query_optimizer.py
├── services/
└── server.py               # 43K lines (needs more refactoring)
```

## Pending Issues
1. **BBPS Billers:** AEML, JPDCL fail
2. **DMT Preview:** IP whitelist issue

## Test Credentials
- Admin: admin@paras.com / PIN: 153759
- Test: testmining@paras.com / PIN: 123456
