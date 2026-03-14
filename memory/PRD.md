# PARAS REWARD - Product Requirements Document

## Original Problem Statement
User's main objectives are to fix and improve Eko DMT and BBPS features:
1. **DMT Functionality:** Fix DMT transactions failing with "Transaction Declined" and "Customer is not registered" errors
2. **BBPS Functionality:** Fix all BBPS transactions failing except mobile recharge (Electricity, Gas, DTH, Credit Card, etc.)
3. **New DMT Implementation:** Stop current V3 DMT system and implement new DMT using Eko's V1 Fund Transfer API
4. **Receipt Generation:** Generate receipts for successful bill payments
5. **Beneficiary Management:** Fix issues with adding and deleting beneficiaries
6. **Transaction Issues:** Investigate successful transactions where money is not credited to account

## User Language
**Primary Language: Marathi (मराठी)**

---

## What's Been Implemented

### March 2026 - Session Updates

#### ✅ DMT Transfer Fixed
- Switched from failing `/dmt-levin` endpoint to working `/v3/customer/payment/dmt` endpoint
- Transactions now successful through API

#### ✅ Beneficiary Management Fixed  
- "Add Beneficiary" and "List Beneficiaries" now working with corrected `/dmt` API path

#### ✅ BBPS Feature Implemented & Fixed
- Diagnosed and fixed `403 Forbidden` error by discovering BBPS service activation (service code 53)
- Created `/api/bbps/activate-service` endpoint
- Successfully tested `v2/billpayments/paybill` API for mobile recharge
- Built backend support for various BBPS services (Electricity, Gas, DTH, Credit Card, etc.)

#### ✅ Instant BBPS Integration (March 14, 2026)
- **Backend**: Rewrote `execute_eko_recharge` function in `unified_redeem_v2.py` to use verified working `bbps_services.py` API
- **Frontend**: Updated `RedeemPageV2.js`:
  - Changed "Submit Request" → "Pay Now"
  - Changed "Admin will process 24-48 hours" → "Instant payment via BBPS"
  - Changed "Submitting..." → "Processing Payment..."
- **Tested**: Direct BBPS API on production - ₹19 Jio recharge successful (TID: 3548867123)

---

## Current Architecture

```
/app
├── backend/
│   ├── routes/
│   │   ├── bbps_services.py        # Working BBPS API (verified)
│   │   ├── unified_redeem_v2.py    # Updated to use bbps_services.py
│   │   ├── dmt_levin_service.py    # Legacy V3 DMT (to be disabled)
│   │   └── eko_auth.py             # Eko header generation
│   └── server.py
└── frontend/
    └── src/
        └── pages/
            ├── RedeemPageV2.js     # Updated for instant BBPS
            ├── BBPSServices.js     # Direct BBPS page
            └── DMTPage.js
```

---

## Key API Endpoints

### Working & In Use
- `POST /api/bbps/pay` - Instant BBPS payments (verified working)
- `POST /v3/customer/payment/dmt` - Successful money transfers
- `POST /v2/billpayments/paybill` - BBPS payments via Eko
- `PUT /v1/user/service/activate` - Activate Eko services
- `GET /v2/billpayments/operators` - Get BBPS operators

### To be Implemented
- `POST /v1/user/fundtransfer/initiate` - New V1 DMT endpoint
- Receipt generation endpoint

---

## P0 - Critical/Blocked Issues

### Issue 1: Transaction successful but money not received
- **Status:** BLOCKED on Eko Support
- **Details:** Transaction ID 3548834855 shows success but funds not credited, `bank_ref_num` empty
- **Action:** User needs to contact Eko support

### Issue 2: Delete Beneficiary 500 error
- **Status:** BLOCKED on Eko Support
- **Details:** Eko API returns 500 Internal Server Error for delete requests
- **Action:** User needs to contact Eko support

---

## Prioritized Backlog

### P0 (Critical)
- [x] Instant BBPS integration in Redeem page
- [ ] **DEPLOY TO PRODUCTION** (changes ready, need deployment)

### P1 (High Priority)
- [ ] V1 Fund Transfer implementation (user documentation provided)
- [ ] Receipt Generation for successful payments
- [ ] Block/comment V3 DMT code (`dmt_levin_service.py`)

### P2 (Medium Priority)
- [ ] End-to-end testing of all BBPS services with valid user data
- [ ] Razorpay double subscription bug fix
- [ ] Production deployment crash investigation

### P3 (Future)
- [ ] MongoDB to PostgreSQL migration
- [ ] KYC/Receipt images file storage solution
- [ ] DMTPage.js component refactoring
- [ ] Email/Mobile OTP verification on signup

---

## Test Credentials
- **Login:** `9421331342` / PIN: `942133`
- **Eko Initiator ID:** `9936606966`
- **Eko User Code:** `19560001`

---

## 3rd Party Integrations
1. **Eko** - DMT and BBPS (V1, V2, V3 APIs)
2. **Razorpay** - Subscriptions (has pending bug)

---

## Technical Notes
- BBPS 403 error was solved by activating service code 53 (not IP whitelist issue)
- All BBPS services now use `bbps_services.py` which is verified working
- PRC flow: Deduct → API Call → Success/Refund on failure
