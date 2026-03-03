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

### Completed (December 2025)

1. **P0 Fix - Eko API Integration**
   - Identified that Eko uses `application/json` format for ALL services (not form-urlencoded)
   - `request_hash` formula: `timestamp + utility_acc_no + amount + user_code`
   - Created `execute_bbps_bill_payment()` function for DTH, Electricity, Gas, EMI
   - Both mobile recharge and BBPS services now use consistent JSON format
   - Code verified against official Eko documentation

2. **Backend Improvements:**
   - Added `/api/eko/bbps/pay-bill-v2` endpoint for testing BBPS services
   - Updated `execute_eko_recharge()` in unified_redeem_v2.py to route correctly
   - All services now properly extract utility_acc_no from request details

3. **IP Whitelisting Issue:**
   - Preview environment IP (34.16.56.64) returns 403 from Eko
   - Production environment has whitelisted IPs and should work
   - This is NOT a code issue - verified against Eko docs

## Service Status

| Service | Code Status | Notes |
|---------|-------------|-------|
| Mobile Recharge | Ready | Uses test_recharge_exact_format() |
| DTH | Ready | Uses execute_bbps_bill_payment() |
| Electricity | Ready | Uses execute_bbps_bill_payment() |
| Gas | Ready | Uses execute_bbps_bill_payment() |
| EMI | Ready | Uses execute_bbps_bill_payment() |
| DMT | Pending | Needs separate implementation |

## API Endpoints

### Redeem APIs
- `POST /api/redeem/request` - Create redeem request
- `POST /api/redeem/admin/approve` - Approve/Reject request
- `POST /api/redeem/admin/complete` - Execute Eko payment
- `GET /api/redeem/admin/requests` - Get requests with filters

### Eko APIs
- `GET /api/eko/balance` - Check Eko wallet balance
- `GET /api/eko/bbps/operators/{type}` - Get operators list
- `POST /api/eko/test-recharge` - Test mobile recharge
- `POST /api/eko/bbps/pay-bill-v2` - Test BBPS bill payment

## Pending Tasks

### P1 - High Priority
- [ ] Test on production environment with whitelisted IP
- [ ] Implement DMT (Bank Transfer) flow
- [ ] Clear ~1700 legacy pending requests
- [ ] Automatic plan fetch for prepaid mobile

### P2 - Medium Priority
- [ ] Full frontend end-to-end testing
- [ ] Admin dashboard tab refresh fix
- [ ] Razorpay Auto-Sync fix

### P3 - Low Priority
- [ ] Email/Mobile OTP verification
- [ ] Decommission old payment pages

## Key Files
- `backend/routes/unified_redeem_v2.py` - Main redeem workflow
- `backend/routes/eko_payments.py` - Eko API integration (execute_bbps_bill_payment)
- `backend/.env` - Eko credentials
- `frontend/.env` - Backend URL

## Admin Credentials
- **Email:** `admin@paras.com`
- **Password:** `test123` or `123456`

## Technical Notes

### Eko API Authentication
All Eko BBPS APIs use:
- **Content-Type:** `application/json`
- **secret-key:** HMAC-SHA256(timestamp, base64(auth_key))
- **request_hash:** HMAC-SHA256(timestamp + utility_acc_no + amount + user_code, base64(auth_key))

### Preview vs Production
- Preview IP: 34.16.56.64 (NOT whitelisted with Eko)
- Production IPs: Provided by Emergent support, whitelisted with Eko
- Deploy to production for live testing

## Deployment Notes
- Supervisor config: `/etc/supervisor/conf.d/supervisord.conf`
- Backend port: 8001
- Frontend port: 3000
- Database: MongoDB Atlas
