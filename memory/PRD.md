# PARAS REWARD - Product Requirements Document

## Original Problem Statement
वापरकर्त्याची मूळ विनंती मायनिंग सेशन UI ला भविष्यवेधी डिझाइनमध्ये पुन्हा तयार करणे आणि मॅन्युअल फिनटेक रिडीम सिस्टम पूर्ण करणे ही होती.

## Application Overview
Paras Reward एक PRC (Paras Reward Coin) mining आणि redemption platform आहे जिथे:
- वापरकर्ते mining करून PRC कमवू शकतात
- PRC वापरून subscriptions, bill payments, gift vouchers घेऊ शकतात
- Bank transfers द्वारे INR मध्ये redeem करू शकतात
- Referral system द्वारे bonus मिळवू शकतात

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

### Latest Session (16 March 2026) - PRC Rate Display & Admin Settings

**PRC Rate Display Component:**
1. Created reusable `PRCRateDisplay.js` component showing:
   - Rate Change Alert Banner (पूर्वी vs आता)
   - Breakdown Calculator (Amount × Rate + Fees + Admin Charge = Total)
   - Comparison with old rate (10 PRC = ₹1 base)

2. Added to all redemption pages:
   - BBPSServices.js - Step 4 (Confirm Payment)
   - GiftVoucherRedemption.js - Balance Card section
   - SubscriptionPlans.js - PRC Payment section
   - BankRedeemPage.js - Before Fees Breakdown

**Admin Settings API Fix:**
1. Fixed FastAPI route ordering issue in `admin_settings.py`
2. AdminSettingsHub now correctly loads AdminSystemSettings for `system` tab
3. All settings APIs working: PRC Rate, Mining Rates, Redeem Limit

### Previous Session Fixes
1. **Razorpay Double Subscription Prevention**
   - Atomic claim mechanism with `processing` status
   - `last_payment_id` check on user
   - Idempotency in webhook handler
   - Check `vip_payments` and `transactions` before activation

2. **Admin PRC Rate Control UI** (`/admin/prc-rate-control`)
   - Manual override set/disable
   - Duration-based expiry (hours or permanent)
   - Current rate display with source info

3. **Admin User Lookup UI**
   - Search by UID, mobile, email, or name
   - Mining details, referral breakdown
   - Balance analysis, FAQ answers
   - **BUG FIX**: Route moved before `include_router`

4. **PRC Subscription Payment Fix**
   - Removed WalletService dependency (direct deduction)
   - Increased variance from 5% to 10%
   - Better error messages
   - **BUG FIX**: Cooldown collection changed from `subscriptions` to `subscription_payments`

5. **Service Cooldown System**
   - Subscription: 15 days
   - Other services: 24 hours

6. **Dynamic PRC Rate**
   - All services use same dynamic rate
   - Admin override available

---

## Known Issues (P0-P2)

### P0 - Blocked
- **Eko Aadhaar Auto-KYC**: Blocked on Eko support - user needs to contact Eko account manager to activate "Aadhaar eKYC service"

### P1 - Pending
- **User Rakhi Ghehlod Refund**: 14,260 PRC refund pending (MULTIPLE SESSIONS MISSED!)
- **145 Failed BBPS Transactions**: Root cause unknown, needs production logs

### P2 - Lower Priority
- Production deployment crashes (intermittent)
- "Redeem to Bank" page routing issue

---

## Upcoming Tasks

### P1
1. **User Rakhi Ghehlod Refund**: 14,260 PRC refund pending (PRIORITY!)
2. BBPS transaction failure root cause analysis
3. User refund automation

### P2
1. Manual bank transfer notifications (Firebase/Email)
2. Mining session UI redesign (futuristic)

### Future
1. Database migration to PostgreSQL
2. Email/Mobile OTP verification
3. Receipt generation for transactions

---

## Key API Endpoints

### Admin
- `POST /api/admin/prc-rate/manual-override` - Set/disable rate override
- `GET /api/admin/prc-rate/current` - Get current rate with source
- `GET /api/admin/user-lookup/{identifier}` - User details lookup
- `POST /api/admin/prc-balance/fix-all-missing` - Balance restoration

### Subscription
- `POST /api/subscription/pay-with-prc` - PRC subscription payment
- `POST /api/subscription/razorpay/create-order` - Create Razorpay order
- `POST /api/subscription/razorpay/verify-payment` - Verify and activate
- `POST /api/subscription/razorpay/webhook` - Razorpay webhook (disabled by user)

### Services
- `POST /api/bbps/bill-payment` - BBPS bill payment
- `POST /api/gift-voucher/redeem` - Gift voucher redemption
- `GET /api/service/cooldown/{user_id}/{service_type}` - Check cooldown

---

## Credentials (Testing)
- **User**: `9421331342` / PIN: `942133`
- **Admin**: `Admin@paras.com` / PIN: `153759`

---

## Notes for Next Agent
1. User's primary language is **Marathi** - respond in Marathi only
2. Razorpay webhook is **disabled** by user
3. `server.py` is very large (~44K lines) - needs refactoring
4. Always use `testing_agent` for critical changes
5. User has lost trust due to previous agent mistakes - verify before claiming success
6. **Eko Aadhaar is BLOCKED** - don't waste time debugging, needs Eko support
7. **Rakhi Ghehlod refund (14,260 PRC)** - PRIORITY P1, missed multiple times!
8. `eko_kyc_service.py` has hardcoded credentials - needs environment variables
