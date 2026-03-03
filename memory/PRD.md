# Paras Redeem - Product Requirements Document

## Original Problem Statement
PRC (Paras Reward Coin) based redemption platform where users earn PRC through mining and referrals, then redeem for:
- Mobile Recharges
- DTH Recharges
- Electricity Bills
- Gas Bills
- Bank Transfers (DMT)
- Other utility payments

## Core Architecture
- **Frontend:** React.js with Tailwind CSS
- **Backend:** FastAPI (Python)
- **Database:** MongoDB Atlas
- **Payment Gateway:** Eko India (BBPS & DMT APIs)
- **Secondary:** Razorpay for subscriptions

## What's Been Implemented

### March 2026 Updates:

#### ✅ Eko Authentication Fix (Mar 3, 2026)
- Fixed Authenticator Key in `.env`
- Corrected secret-key generation algorithm (Base64 encoded key + HMAC-SHA256)
- Fixed request_hash generation for BBPS payments

#### ✅ BBPS Bill Payment Services (Mar 3, 2026)
- **Electricity:** Tested BEST Mumbai ₹1,160 - SUCCESS
- **DTH:** Tested Dish TV ₹236 - SUCCESS
- **Mobile Recharge:** Already working

#### ✅ Error Handling Improvements (Mar 3, 2026)
- Added user-friendly error messages for Eko API errors
- Added `eko_failed` status display in Orders page
- Improved admin dashboard with bank transfer details display

#### ✅ PRC Vault Removal (Previous Session)
- Removed PRC Savings Vault feature
- Removed 20% deduction logic
- Migration script created at `/app/migration_script.py`

#### ✅ Mining Formula Simplification (Previous Session)
- Fixed-rate mining per subscription plan
- Removed complex date/subscription multipliers
- Formula: `Final Rate = Base_Rate + Referral_Bonus`

## Pending/In Progress

### 🔴 P0 - DMT (Bank Transfer)
- **Status:** Waiting for Eko support reply
- **Issue:** Add Recipient API returns 405 for POST method
- **Blocker:** Cannot complete recipient registration flow

### 🟡 P1 - PRC Vault Migration
- **Status:** Script ready, awaiting production confirmation
- **Action:** Run `/app/migration_script.py` on production database

### 🟡 P2 - Other Issues
- Admin dashboard tabs refresh issue
- ~1700 legacy pending requests to clear
- Razorpay Auto-Sync error handling

## Key API Endpoints

### Eko BBPS (Working)
- `POST /api/eko/bbps/paybill` - Bill payment
- `POST /api/eko/bbps/fetch-bill` - Fetch bill details
- `GET /api/eko/bbps/operators/{category}` - Get operators list

### Eko DMT (Pending Fix)
- `GET /api/eko/dmt/v3/customer/{mobile}` - Check customer
- `POST /api/eko/dmt/v3/recipient/add` - Add recipient (needs fix)
- `POST /api/eko/dmt/v3/transfer` - Initiate transfer

## Credentials
- **Eko Production URL:** https://api.eko.in:25002/ekoicici
- **Eko Initiator ID:** 9936606966
- **Eko User Code:** 20810200

## Files of Reference
- `backend/routes/eko_payments.py` - All Eko API integrations
- `backend/server.py` - Main FastAPI app, redeem processing
- `backend/config.py` - Mining rates, limits, weights
- `frontend/src/pages/RedeemPageV2.js` - Redeem UI
- `frontend/src/pages/Orders.js` - User orders display
