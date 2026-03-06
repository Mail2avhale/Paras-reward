# PARAS REWARD - Product Requirements Document

## Original Problem Statement
A mining reward application with subscription-based economy. Users mine PRC tokens daily based on:
- Base rate (500 PRC/day = 20.83 PRC/hr)
- Single leg bonus (users who joined after them)
- Team boost from 3 levels of referrals (L1=5%, L2=3%, L3=2%)

### Key Requirements
1. **Mining Economy:** Additive formula: `Total = Base + L1_bonus + L2_bonus + L3_bonus`
2. **Subscription:** ₹799/month Elite plan required for bonuses
3. **Gift Feature:** Gift 24hr subscription to L1 referrals for 600 PRC
4. **BBPS/DMT:** Bill payments and money transfer services via Eko API

## What's Been Implemented

### March 2026
- [x] New mining economy with additive formula (P0 fix)
- [x] `calculate_mining_rate()` returns correct base_rate (not final rate)
- [x] Level bonuses: L1=5%, L2=3%, L3=2% per active user
- [x] Subscription consolidation: Removed ₹299/₹549 plans, migrated to Elite
- [x] Gift 24hr subscription feature
- [x] UI cleanup: Removed L4/L5 references, Earnings History page, AI Coach card
- [x] Hardcoded IP removal from BBPS/DMT services

## API Endpoints

### Mining
- `GET /api/mining/status/{uid}` - Returns mining_rate, base_rate, referral_breakdown
- `POST /api/mining/start/{uid}` - Start mining session
- `POST /api/mining/claim/{uid}` - Claim mined PRC

### Auth
- `POST /api/auth/login` - Login with email/phone and PIN
- `POST /api/gift-subscription` - Gift 24hr subscription to L1 referral

## Key Files
- `backend/routes/mining_economy.py` - Mining calculation logic
- `backend/server.py` - Main API endpoints
- `frontend/src/pages/Mining.js` - Mining UI

## Pending Issues (P1)
1. **BBPS Billers:** AEML, JPDCL fail to fetch bills
2. **DMT in Preview:** 403 errors due to IP whitelist (environment issue)

## Backlog
- Payment Status Check on Login
- DMT v3 with Aadhaar/eKYC
- PRC Vault to Balance migration
- Email/OTP verification
- KYC image storage migration

## Test Credentials
- Admin: admin@paras.com / PIN: 153759
- Test: testmining@paras.com / PIN: 123456
