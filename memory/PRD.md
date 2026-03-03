# Paras Reward - Product Requirements Document

## Original Problem Statement
Eko payment integration for a reward platform with BBPS (Bill Payments) and DMT (Money Transfer) services.

## Core Features
- **Mobile Recharge** with auto-detect operator and plans
- **DTH Recharge** 
- **Electricity Bill Payment**
- **Gas Bill Payment**
- **EMI Payment**
- **Bank Account Transfer (DMT v3)**
- **Mining/Tap Game** for earning PRC rewards

## Architecture

### Backend
- FastAPI server at `/app/backend/server.py`
- Eko API routes at `/app/backend/routes/eko_payments.py`
- MongoDB database

### Frontend
- React app with Tailwind CSS
- Dashboard at `/app/frontend/src/pages/DashboardModern.js`
- Redeem page at `/app/frontend/src/pages/RedeemPageV2.js`

## API Endpoints

### Eko BBPS
- `GET /api/eko/bbps/operators/{category}` - Get operators
- `POST /api/eko/bbps/fetch-bill` - Fetch bill details
- `POST /api/eko/bbps/pay-bill` - Pay bill

### Eko DMT v3
- `GET /api/eko/dmt/v3/banks` - Bank list
- `GET /api/eko/dmt/v3/customer/{mobile}` - Check customer
- `POST /api/eko/dmt/v3/recipient/add` - Add beneficiary
- `POST /api/eko/dmt/v3/transfer` - Money transfer

### Auto-Detect (NEW)
- `GET /api/eko/recharge/detect/{mobile}` - Auto-detect operator & fetch plans

## What's Been Implemented

### December 2025 - Session Updates

#### ✅ PRC Vault Feature Removal (Completed)
- Removed "PRC SAVINGS VAULT" banner from dashboard
- Disabled 20% auto-deduction from mining rewards
- Users now receive 100% of mined PRC
- Created migration script: `/app/backend/migrate_vault_to_prc.py`

#### ✅ Auto-Detect Operator Feature (Completed)
- New API endpoint to auto-detect operator from mobile number
- Returns operator name, circle, confidence level
- Auto-fetches available recharge plans
- Integrated into mobile recharge form

#### ✅ DMT v3 Backend (Completed)
- Implemented Eko DMT v3 API integration
- Customer verification, beneficiary management, money transfer
- Hash formula: `timestamp + customer_id + recipient_id + amount + client_ref_id`

## Service Status

| Service | Status | Notes |
|---------|--------|-------|
| Mobile Recharge | ✅ Ready | Auto-detect implemented |
| DTH | ✅ Ready | Working |
| Electricity | ✅ Ready | Bill fetch working |
| Gas | ✅ Ready | Working |
| EMI | ✅ Ready | Working |
| DMT v3 | ⚠️ Blocked | IP whitelist issue in preview |

## Known Issues

1. **Eko API IP Whitelist**: Preview environment IP not whitelisted by Eko. Code is correct but testing blocked.
2. **Admin Dashboard Refresh**: Tabs don't refresh after status change.

## Upcoming Tasks

### P1 - High Priority
- Complete DMT self-service frontend flow
- End-to-end testing on whitelisted environment

### P2 - Medium Priority
- Fix admin dashboard tab refresh bug
- Clear ~1700 legacy pending requests

### P3 - Low Priority
- Razorpay auto-sync error handling
- Email/Mobile OTP verification
- KYC image migration to file storage

## Test Credentials

- **Test User**: testuser@test.com / PIN: 123456
- **DMT Test Account**: 
  - Name: Santosh Shamrao Avhale
  - Account: 8829010000024578
  - Bank: DBS Bank
  - IFSC: DBSS0IN0829

## Database Schema

### users
```
{
  uid: String,
  email: String,
  prc_balance: Number,
  kyc_status: String,
  subscription_plan: String
}
```

### redeem_requests
```
{
  request_id: String,
  user_id: String,
  service_type: String,
  amount: Number,
  status: String
}
```

## Tech Stack
- Backend: Python, FastAPI, MongoDB
- Frontend: React, Tailwind CSS, Shadcn UI
- APIs: Eko (BBPS, DMT), Razorpay
