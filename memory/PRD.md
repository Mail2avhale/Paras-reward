# PARAS REWARD - Product Requirements Document

## Original Problem Statement
User's original request was to redesign the Mining Session UI with a futuristic design and complete the Manual Fintech Redeem System.

## Application Overview
Paras Reward is a PRC (Paras Reward Coin) mining and redemption platform where:
- Users can earn PRC through mining
- Use PRC for subscriptions, bill payments, gift vouchers
- Redeem to INR via bank transfers
- Earn bonuses through referral system

## Core Features
1. **Mining System** - Time-based PRC mining with referral bonuses
2. **Subscription Plans** - Explorer (free), Startup, Growth, Elite
3. **Redemption Services** - BBPS Bill Payments, Gift Vouchers, Bank Transfers
4. **Payment Integration** - Razorpay (online) + Manual UPI/Bank
5. **Admin Panel** - Complete management dashboard

## Tech Stack
- **Frontend**: React.js with Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Razorpay, Eko (BBPS)

---

## What's Been Implemented (March 2026)

### Latest Session (18 March 2026) - Validation Order Verification

**Redemption Validation Order Verified & Tested:**
1. **Validation Order in `unified_redeem_v2.py`** is correctly implemented:
   - Emergency pause check
   - User exists check
   - KYC verification (line 879)
   - Subscription plan check (line 888)
   - Subscription expiry check (line 899)
   - Service type validation
   - Service-specific validation
   - Weekly service limit check
   - Global redeem limit check
   - PRC balance check
   - Category limit check (40/30/30)

2. **Test Results**: 18 tests passed, 1 skipped
   - KYC check happens BEFORE subscription check ✅
   - Subscription expiry check happens BEFORE limit checks ✅
   - Expired subscription returns "subscription error" NOT "limit error" ✅
   - Category-wise limits enforced (40/30/30) ✅
   - GST invoice generation working ✅

3. **Key Test File**: `/app/backend/tests/test_redemption_validation_order.py`

### Previous Session (18 March 2026) - Critical Bug Fixes

**Two Critical Bugs Fixed:**
1. **Subscription Expiry Check**: Added logic to block redemptions for users with expired subscriptions
2. **Category Limit Enforcement**: Added backend validation to enforce 40% Utility, 30% Shopping, 30% Bank spending limits

**BBPS Cooldown Logic Fixed:**
- Corrected service name mappings in `server.py`
- Only counts successful transactions for 7-day cooldown

**Eko Callback Endpoint Created:**
- `POST /api/eko/callback` for receiving transaction status updates from Eko

**GST Invoice System Completed:**
- Fixed database connection bug (`if db is None:` instead of `if not db:`)
- Frontend route and UI links working
- Full flow (payment -> invoice generation -> UI display) functional

---

## Known Issues (P0-P2)

### P0 - Blocked
- **Eko Fund Transfer (DMT)**: Bank-side transaction reversals. BLOCKED on Eko support action - user needs to:
  1. Configure callback URL: `https://www.parasreward.com/api/eko/callback`
  2. Ask Eko to investigate why beneficiary banks are reversing transfers
- **Eko Aadhaar Auto-KYC**: Blocked on Eko support - user needs to contact Eko account manager

### P1 - Pending
- **User Rakhi Ghehlod Refund**: 14,260 PRC refund pending (PRODUCTION ONLY - cannot test in preview)
- **Full audit for unauthorized redemptions**: Need to run on production database

### P2 - Lower Priority
- **MSEDCL bill payment**: Requires 4-digit "BU" number from user's bill
- **Hardcoded credentials in `eko_kyc_service.py`**: Needs environment variables refactoring

---

## Upcoming Tasks

### P1
1. Admin UI to override category percentages for individual users
2. Backend logic to carry forward unused category limits to next month
3. UI for "Shopping" category redemption

### P2
1. Refactor `eko_kyc_service.py` to remove hardcoded credentials
2. Refactor `unified_redeem_v2.py` to reduce file size
3. Manual bank transfer notifications (Firebase/Email)

### Future
1. Database migration to PostgreSQL
2. Email/Mobile OTP verification
3. Receipt generation for transactions

---

## Key API Endpoints

### Redemption
- `POST /api/redeem/request` - Create redemption request (with full validation)
- `GET /api/redeem/services` - List available services
- `GET /api/redeem/calculate-charges` - Calculate PRC required

### GST Invoice
- `POST /api/invoice/generate` - Generate GST invoice with PDF
- `GET /api/invoice/user/{user_id}` - List user's invoices
- `GET /api/invoice/{invoice_id}/pdf` - Download invoice PDF
- `GET /api/invoice/admin/all` - Admin: All invoices with GST summary

### Eko Integration
- `POST /api/eko/callback` - Receive transaction status updates from Eko

---

## Credentials (Testing)
- **User Login**: `9970100782` / PIN: `997010`
- **Admin Login**: `Admin@paras.com` / PIN: `153759`
- **Test User UID (KYC verified, Growth plan)**: `6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21`

---

## Notes for Next Agent
1. User's primary language is **English and Marathi** - respond accordingly
2. Razorpay webhook is **disabled** by user
3. `server.py` is very large (~44K lines) - needs refactoring
4. Always run tests after making changes to redemption logic
5. **Eko DMT is BLOCKED** - needs Eko support action, not code fix
6. **Rakhi Ghehlod refund (14,260 PRC)** - PRODUCTION ONLY task
7. Category-based redeem limits: Utility (40%), Shopping (30%), Bank (30%)
8. Validation order is correct - KYC -> Subscription -> Expiry -> Limits
