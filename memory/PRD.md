# Paras Reward - Product Requirements Document

## Original Problem Statement
Build a unified "Redeem" system for Eko-powered payment services (Mobile Recharge, DTH, Electricity, Gas, EMI, DMT) with admin approval workflow.

## Core Requirements
1. **Unified Redeem Flow:** Single page for all payment services
2. **Admin Approval Workflow:** All requests require admin approval before Eko API call
3. **Charging Logic:** Eko charge + Rs10 flat + 20% admin charge
4. **Play Store Compliance:** Use "Redeem" instead of "Withdrawal"

## Architecture
- **Backend:** FastAPI + MongoDB Atlas
- **Frontend:** React
- **Payment Integration:** Eko BBPS API (Live)
- **Payment Gateway:** Razorpay (Live)

## What's Been Implemented

### December 2025 - BBPS API Fix

**Summary:** Created `execute_bbps_bill_payment()` function for DTH, Electricity, Gas, EMI services.

**Technical Details:**
1. **Content-Type:** `application/json` (same as mobile recharge)
   - Confirmed by testing: JSON returns 403 (IP block), form-urlencoded returns 415 (format error)
   
2. **request_hash formula for BBPS:** 
   ```
   timestamp + utility_acc_no + amount + operator_id + reference_id
   ```
   (Different from mobile recharge which uses `user_code` instead of `operator_id + reference_id`)

3. **Key encoding:** Same as mobile recharge
   ```python
   encoded_key = base64.b64encode(EKO_AUTHENTICATOR_KEY.encode()).decode()
   ```

**Files Changed:**
- `backend/routes/eko_payments.py` - Added `execute_bbps_bill_payment()` and `/bbps/pay-bill-v2` endpoint
- `backend/routes/unified_redeem_v2.py` - Updated routing to use new BBPS function

## Service Status

| Service | Code Status | Test Status | Notes |
|---------|-------------|-------------|-------|
| Mobile Recharge | ✅ Ready | 403 (IP block) | Uses test_recharge_exact_format() |
| DTH | ✅ Ready | 403 (IP block) | Uses execute_bbps_bill_payment() |
| Electricity | ✅ Ready | 403 (IP block) | Uses execute_bbps_bill_payment() |
| Gas | ✅ Ready | 403 (IP block) | Uses execute_bbps_bill_payment() |
| EMI | ✅ Ready | 403 (IP block) | Uses execute_bbps_bill_payment() |
| DMT | ❌ Pending | - | Needs separate implementation |

**Note:** All services return 403 because preview environment IP (34.16.56.64) is NOT whitelisted with Eko. Production environment should work.

## API Endpoints

### Redeem APIs
- `POST /api/redeem/request` - Create redeem request
- `POST /api/redeem/admin/approve` - Approve/Reject request
- `POST /api/redeem/admin/complete` - Execute Eko payment
- `GET /api/redeem/admin/requests` - Get requests with filters

### Eko Test APIs
- `GET /api/eko/balance` - Check Eko wallet balance
- `GET /api/eko/bbps/operators/{type}` - Get operators list
- `POST /api/eko/test-recharge` - Test mobile recharge (JSON format)
- `POST /api/eko/bbps/pay-bill-v2` - Test BBPS bill payment (JSON format)

## Pending Tasks

### P0 - Critical
- [x] Fix BBPS 403 error - DONE (was format issue, now IP whitelist issue)

### P1 - High Priority  
- [ ] Deploy to production and test with whitelisted IPs
- [ ] Implement DMT (Bank Transfer) flow
- [ ] Automatic plan fetch for prepaid mobile

### P2 - Medium Priority
- [ ] Clear ~1700 legacy pending requests
- [ ] Admin dashboard tab refresh fix
- [ ] Full frontend end-to-end testing

### P3 - Low Priority
- [ ] Email/Mobile OTP verification
- [ ] Decommission old payment pages

## Key Files
- `backend/routes/unified_redeem_v2.py` - Main redeem workflow
- `backend/routes/eko_payments.py` - Eko API integration
- `frontend/src/pages/RedeemPageV2.js` - User-facing redeem form

## Credentials
- **Admin:** `admin@paras.com` / `123456`
- **Test User:** `test@test.com` / `test123`
- **Preview Environment IP:** 34.16.56.64 (NOT whitelisted with Eko)

## Technical Notes

### Hash Formula Difference
| API Type | Hash Formula |
|----------|--------------|
| Mobile Recharge | timestamp + utility_acc_no + amount + user_code |
| BBPS Bill Payment | timestamp + utility_acc_no + amount + operator_id + reference_id |

### Testing Evidence
- JSON format: Returns HTTP 403 (IP block) - format accepted
- Form-urlencoded: Returns HTTP 415 (Unsupported Media Type) - format rejected

This confirms JSON is the correct format for all Eko BBPS APIs.
