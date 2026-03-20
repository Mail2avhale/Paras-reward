# PARAS REWARD - Product Requirements Document

## ✅ DEPLOYED - 19 March 2026
## 📝 LAST UPDATED - 20 March 2026

## ⚠️ IMPORTANT: TWO-PLAN SYSTEM ONLY ⚠️
```
╔════════════════════════════════════════════════════════════════╗
║  ACTIVE PLANS (March 2026 onwards):                            ║
║  ┌─────────────┬─────────────┐                                 ║
║  │  EXPLORER   │    ELITE    │                                 ║
║  │   (FREE)    │   (PAID)    │                                 ║
║  │  ₹0/month   │  ₹799/month │                                 ║
║  └─────────────┴─────────────┘                                 ║
║                                                                 ║
║  ❌ NO MORE: VIP, Startup, Growth, Pro                         ║
║  ✅ Legacy users (Startup/Growth/VIP) → Treated as Elite       ║
╚════════════════════════════════════════════════════════════════╝
```

## ⚠️ IMPORTANT: PRC FIELD STANDARDIZATION (March 2026)
```
╔════════════════════════════════════════════════════════════════╗
║  STANDARD FIELD: total_prc_deducted                            ║
║                                                                 ║
║  LEGACY FIELDS (handled via get_prc_amount() helper):          ║
║  • prc_used - old bill_payment_requests                        ║
║  • prc_deducted - old bank transfers                           ║
║  • prc_amount - generic legacy field                           ║
║  • total_prc - orders                                          ║
║                                                                 ║
║  Helper: /app/backend/utils/prc_fields.py                      ║
║  Migration: /app/backend/migrations/standardize_prc_fields.py  ║
╚════════════════════════════════════════════════════════════════╝
```

## ⚠️ DEPRECATED FEATURES (March 2026)
```
╔════════════════════════════════════════════════════════════════╗
║  CHATBOT WITHDRAWAL - COMPLETELY REMOVED                       ║
║                                                                 ║
║  Files Removed:                                                 ║
║  • chatbot_withdrawal.py, chatbot_payment_fix.py               ║
║  • AdminChatbotWithdrawals.js, UserWithdrawalHistory.js        ║
║  • AIChatbotEnhanced.js, ChatbotWithdrawalFlow.js              ║
║                                                                 ║
║  Endpoints deprecated (return deprecation notice):             ║
║  • POST /api/ai/chatbot                                        ║
║  • GET /api/ai/chatbot/history/{uid}                           ║
║                                                                 ║
║  DMT (Fund Transfer) - Also removed (Eko API not working)      ║
╚════════════════════════════════════════════════════════════════╝
```

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
2. **Subscription Plans** - **Explorer (FREE)** and **Elite (PAID)** ONLY
3. **Redemption Services** - BBPS Bill Payments, Gift Vouchers, Bank Transfers
4. **Payment Integration** - Razorpay (online) + Manual UPI/Bank
5. **Admin Panel** - Complete management dashboard

## Subscription System (FINALIZED - March 2026)

### ONLY TWO PLANS - SAME MINING SPEED:
```
╔═══════════════════════════════════════════════════════════════════╗
║  Feature          │  EXPLORER (Free)   │  ELITE (₹799/month)      ║
╠═══════════════════════════════════════════════════════════════════╣
║  Mining Speed     │  SAME              │  SAME                    ║
║  PRC दिसेल         │  ✅ Yes            │  ✅ Yes                  ║
║  PRC Collect      │  ❌ NO             │  ✅ Yes                  ║
║  Redeem           │  ❌ NO             │  ✅ Yes                  ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Key Difference:** Explorer users can MINE but CANNOT COLLECT or REDEEM PRC!

### Code Implementation:
```python
# In server.py - SUBSCRIPTION_PLANS
"explorer": {
    "mining_rate": 90,      # SAME as Elite
    "prc_per_tap": 2.0,     # SAME as Elite
    "can_collect": False,   # ❌ Cannot collect
    "can_redeem": False     # ❌ Cannot redeem
}
"elite": {
    "mining_rate": 90,
    "prc_per_tap": 2.0,
    "can_collect": True,    # ✅ Can collect
    "can_redeem": True      # ✅ Can redeem
}

# Use this function to check paid status:
is_paid_subscriber(user)  # Returns True for Elite + Legacy plans
```

### Legacy Plan Handling:
- Existing Startup/Growth/VIP users → Automatically treated as Elite
- Their features work exactly like Elite
- No new signups for legacy plans

## Tech Stack
- **Frontend**: React.js with Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Razorpay, Eko (BBPS)

---

## What's Been Implemented (March 2026)

### Session (20 March 2026) - Security Audit & BBPS Fixes

**CRITICAL SECURITY FIXES:**

1. **Webhook Signature Enforcement**
   - Fixed: Invalid Razorpay webhook signatures now rejected (was being skipped!)
   - File: `routes/razorpay_payments.py` line 555-558

2. **Rate Limiting Added:**
   - `/verify-payment`: Max 5 attempts per order per 5 minutes
   - `/mining/claim`: 60-second cooldown between claims

3. **Eko Balance Pre-Check:**
   - BBPS payments now check Eko wallet balance before initiating
   - Prevents stuck transactions when balance is insufficient

4. **Admin Audit Endpoints:**
   - `POST /api/razorpay/admin/audit-cancelled-elite` - Find suspicious users
   - `POST /api/razorpay/admin/bulk-reverse-subscriptions` - Mass downgrade
   - `POST /api/razorpay/admin/reverse-subscription` - Single user downgrade
   - `POST /api/razorpay/admin/fix-cancelled-subscriptions` - Auto-fix

**SECURITY AUDIT REPORT:** `/app/backend/SECURITY_AUDIT.md`

**BBPS FIXES:**
- MSEDCL Electricity: Fixed `cycle_number` (BU) extraction
- Credit Card: Added `registered_mobile_number` field
- Sender name sanitization working
- Jio Prepaid working with `recharge_plan_id`

**Admin Tools:**
- `/admin/pending-requests` - Manage stuck requests with bulk fail
- Eko wallet balance display on redeem page

### Previous Session (19 March 2026) - VIP/Membership to Elite Refactoring

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

### Deprecated Features Removed (19 March 2026)
**Completely removed from codebase:**
| Feature | Files Deleted | DB Collections Dropped |
|---------|---------------|------------------------|
| Tap Game | - | tap_games, tap_game_sessions |
| Rain Drop / PRC Rain | - | prc_rain, prc_rain_drops, rain_drops |
| Luxury Life | - | luxury_life, luxury_claims, luxury_savings |
| PRC Savings Vault | ParasRecurringDeposit.js, AdminRecurringDeposits.js, recurring_deposit.py | recurring_deposits, rd_deposits, rd_transactions, prc_vault, prc_savings_vault |

**Routes Removed:**
- `/recurring-deposit`, `/rd` → Redirect to `/dashboard`
- `/admin/recurring-deposits`, `/admin/rd` → Redirect to `/admin`

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
