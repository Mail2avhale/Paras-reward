# Paras Reward - Product Requirements Document

## Original Problem Statement
Build a unified "Redeem" system for Eko-powered payment services (Mobile Recharge, DTH, Electricity, EMI, Gas, DMT) with admin approval workflow.

## Core Requirements
1. **Unified Redeem Flow:** Single page for all payment services
2. **Admin Approval Workflow:** All requests require admin approval before Eko API call
3. **Charging Logic:** Eko charge + ₹10 flat + 20% admin charge
4. **Play Store Compliance:** Use "Redeem" instead of "Withdrawal"

## Architecture
- **Backend:** FastAPI + MongoDB Atlas
- **Frontend:** React
- **Payment Integration:** Eko BBPS API (Live)
- **Payment Gateway:** Razorpay (Live)

## What's Been Implemented

### ✅ Completed (March 2, 2026)
1. **P0 Fix - Admin Workflow Eko Integration**
   - Root cause: `os.environ.get()` not working in FastAPI async context
   - Fix: Use module-level EKO credentials from `eko_payments.py`
   - `execute_eko_recharge()` now calls `test_recharge_exact_format()` internally
   - Verified with live transactions: TID 3545019914, TID 3545020472

2. **Eko Authentication Logic**
   - Correct `secret-key` and `request_hash` generation
   - HMAC-SHA256 with Base64 encoding
   - Timestamp in milliseconds (13 digits)

3. **Unified Redeem API Endpoints**
   - POST `/api/redeem/request` - Create request
   - POST `/api/redeem/admin/approve` - Approve/Reject
   - POST `/api/redeem/admin/complete` - Execute Eko API
   - GET `/api/redeem/admin/requests` - Admin dashboard with filters

4. **Admin Credentials**
   - Email: `admin@paras.com`
   - Password: `test123`

## Pending Tasks

### P1 - High Priority
- [ ] Clear ~1700 legacy pending requests from production database
- [ ] Full frontend end-to-end testing

### P2 - Medium Priority
- [ ] Test all 6 Eko services (Mobile, DTH, Electricity, Gas, EMI, DMT)
- [ ] Razorpay Auto-Sync error handling fix

### P3 - Low Priority
- [ ] Email/Mobile OTP verification on signup
- [ ] Migrate KYC/Receipt images from base64 to file storage
- [ ] Decommission old payment pages

## Key Files
- `backend/routes/unified_redeem_v2.py` - Main redeem workflow
- `backend/routes/eko_payments.py` - Eko API integration (module-level credentials)
- `backend/.env` - Eko credentials (EKO_AUTHENTICATOR_KEY, EKO_DEVELOPER_KEY)

## Database Collections
- `redeem_requests` - Unified redeem requests
- `users` - User accounts with PRC balance

## Third-Party Integrations
- **Eko:** Live - BBPS Bill Payments & DMT
- **Razorpay:** Live - Payment Gateway
- **MongoDB Atlas:** Live - Database
