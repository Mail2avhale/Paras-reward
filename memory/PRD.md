# PARAS REWARD - Product Requirements Document

## Original Problem Statement
User's original request was to redesign the Mining Session UI with a futuristic design and complete the Manual Fintech Redeem System. Later expanded to include a major refactoring to simplify the subscription system from multi-plan (VIP, Startup, Growth) to a two-plan model (Explorer/Elite).

## Application Overview
Paras Reward is a PRC (Paras Reward Coin) mining and redemption platform where:
- Users can earn PRC through mining
- Use PRC for subscriptions, bill payments, gift vouchers
- Redeem to INR via bank transfers
- Earn bonuses through referral system

## Core Features
1. **Mining System** - Time-based PRC mining with referral bonuses
2. **Subscription Plans** - **Explorer (free)** and **Elite (paid)** - Simplified two-plan model
3. **Redemption Services** - BBPS Bill Payments, Gift Vouchers, Bank Transfers
4. **Payment Integration** - Razorpay (online) + Manual UPI/Bank
5. **Admin Panel** - Complete management dashboard

## Subscription System (NEW - March 2026)
- **Explorer** (Free): Basic mining, PRC may expire after 2 days
- **Elite** (Paid): Full features, PRC never expires, unlimited redemptions
- **Legacy Plans**: Startup, Growth, VIP users are treated as Elite for backward compatibility
- **Helper Function**: `is_paid_subscriber()` is the single source of truth for checking paid status

## Tech Stack
- **Frontend**: React.js with Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Razorpay, Eko (BBPS)

---

## What's Been Implemented (March 2026)

### Latest Session (19 March 2026) - VIP/Membership to Elite Refactoring

**COMPLETED: Two-Plan System Refactoring**
- Simplified from 4 plans (VIP, Startup, Growth, Elite) to 2 plans (Explorer, Elite)
- Legacy plans treated as Elite for backward compatibility
- Removed deprecated `membership_type` field usage from new code
- Updated all backend routes to use `subscription_plan` instead of `membership_type`
- Updated frontend UI text from "VIP" to "Elite"

**Key Changes:**
1. **Backend Constants Updated** (`server.py`):
   - `PAID_PLANS = ["elite"]`
   - `LEGACY_PAID_PLANS = ["startup", "growth", "vip", "pro"]`
   - `SUBSCRIPTION_PLANS` dictionary with explorer and elite configs

2. **Helper Function**: `is_paid_subscriber(user)` - centralized check for paid status

3. **Routes Updated**:
   - `auth.py`: Subscription expiry check instead of VIP expiry
   - `razorpay_payments.py`: Removed `membership_type: "vip"` from all user updates
   - `admin_dashboard.py`: Uses `subscription_plan` for elite_users count
   - `admin_users.py`: Filters by `subscription_plan` instead of `membership_type`
   - `admin_misc.py`: Updated renewal notifications to query by plan
   - `admin_reports.py`: Updated conversion analytics

4. **Frontend Updated**:
   - HowItWorks.js: "Unlock Elite Benefits"
   - SupportTickets.js: "KYC/Subscription" category
   - AdminSettings.js: "Elite Payment Settings"
   - RefundPolicy.js: "Elite Membership Fees"
   - AdminPolicies.js: "Elite Membership" policy

5. **Migration Script Created**: `/app/backend/migrations/migrate_to_two_plans.py`

**Test Results**: 19 tests passed (13 backend + 6 frontend)
- Test File: `/app/backend/tests/test_subscription_refactoring.py`
- E2E Test: `/app/tests/e2e/subscription-refactoring.spec.ts`

---

## Known Issues (P0-P2)

### P0 - Blocked
- **Eko Fund Transfer (DMT)**: Bank-side transaction reversals. BLOCKED on Eko support action - user needs to:
  1. Configure callback URL: `https://www.parasreward.com/api/eko/callback`
  2. Ask Eko to investigate why beneficiary banks are reversing transfers
- **Eko Aadhaar Auto-KYC**: Blocked on Eko support - user needs to contact Eko account manager
- **Gift Vouchers White Screen**: Blocked - needs browser console error from user's production environment

### P1 - Pending
- **User Rakhi Ghehlod Refund**: 14,260 PRC refund pending (PRODUCTION ONLY - cannot test in preview)
- **Full audit for unauthorized redemptions**: Need to run on production database
- **Run Migration Script**: `/app/backend/migrations/migrate_to_two_plans.py` on production DB

### P2 - Lower Priority
- **MSEDCL bill payment**: Requires 4-digit "BU" number from user's bill
- **Hardcoded credentials in `eko_kyc_service.py`**: Needs environment variables refactoring

---

## Upcoming Tasks

### P1
1. Run migration script on production to convert legacy users to Elite
2. Update frontend pricing pages to only show Explorer/Elite
3. Admin UI to override category percentages for individual users
4. Backend logic to carry forward unused category limits to next month
5. UI for "Shopping" category redemption

### P2
1. Refactor `eko_kyc_service.py` to remove hardcoded credentials
2. Refactor `unified_redeem_v2.py` to reduce file size
3. Manual bank transfer notifications (Firebase/Email)
4. Refactor `server.py` (44K lines) into smaller modules

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
- **User Login**: `9970100782` / PIN: `997010` (Growth plan - treated as Elite)
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
9. **Two-Plan System**: Explorer (free) and Elite (paid). Legacy plans (startup/growth/vip) treated as Elite
10. Use `is_paid_subscriber(user)` to check if user has paid subscription
