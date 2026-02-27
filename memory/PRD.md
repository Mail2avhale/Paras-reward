# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Financial rewards platform "Paras Reward" stabilization, bug fixes, admin usability improvements, and Google Play Store preparation.

## Core Features
- PRC (Paras Reward Coin) earning and redemption system
- VIP Subscription plans (Startup, Growth, Elite)
- Bill Payment integration (Eko BBPS)
- DMT (Domestic Money Transfer)
- Referral system with multi-level rewards
- Admin dashboard for user management

---

## CHANGELOG - February 26, 2026

### 🔴 CRITICAL BUG FIXES

1. **PRC Balance Reset Bug - FIXED**
   - Issue: Paid subscribers' PRC balance was resetting to 0 on login
   - Root Cause: Login code only checked `membership_type == "vip"`, not `subscription_plan`
   - Fix: Updated `/app/backend/routes/auth.py` to check both conditions
   - Impact: All 106 paid users now retain their PRC balance

2. **Database Sync - COMPLETED**
   - Issue: 73 paid users had incorrect `membership_type`
   - Fix: Synced all paid subscribers to `membership_type = "vip"`
   - Result: 106/106 paid users now have correct status

### 🟢 FEATURE IMPLEMENTATIONS

3. **Subscription Days Update**
   - Changed from 30-day to 28-day cycle
   - Monthly: 28 days
   - Quarterly: 84 days (28 × 3)
   - Half-yearly: 168 days (28 × 6)
   - Yearly: 336 days (28 × 12)

4. **KYC Pending Card**
   - New UI card for users with pending KYC
   - Shows "Complete KYC Now" message
   - Different colors for pending (amber) vs rejected (red)
   - File: `/app/frontend/src/pages/DashboardModern.js`

5. **SEO Implementation (react-helmet)**
   - Added dynamic meta tags to 12 public pages:
     - RewardsHome, Login, Register, AboutUs
     - ContactUs, TermsConditions, PrivacyPolicy
     - Disclaimer, RefundPolicy, FAQ, HowItWorks, Blog
   - Each page now has unique title, description, canonical URL
   - Open Graph and Twitter Card tags included

6. **Razorpay Payment Gateway - INTEGRATED**
   - File: `/app/backend/routes/razorpay_payments.py`
   - APIs: create-order, verify-payment, webhook, payment-history
   - Credentials: Test mode configured
   - Status: ✅ Working

7. **Eko Bill Payment & DMT - INTEGRATED**
   - File: `/app/backend/routes/eko_payments.py`
   - BBPS APIs: categories, billers, fetch-bill, pay-bill
   - DMT APIs: register-sender, add-recipient, verify-account, transfer
   - Credentials: LIVE credentials configured
   - Status: ⏳ Waiting for IP whitelist from Eko

### 🟡 ADMIN FEATURES

8. **PRC Burn Control**
   - Execute Burn Now functionality working
   - Last burn: 4,177.32 PRC burned, 9 users affected

---

## PENDING TASKS

### P0 - Critical (Waiting)
- [ ] Eko IP Whitelisting (email sent to sales.engineer@eko.co.in)

### P1 - High Priority
- [ ] Production deployment
- [ ] AAB file generation for Play Store
- [ ] Frontend Razorpay checkout integration

### P2 - Medium Priority
- [ ] Admin pages performance optimization
- [ ] Search functionality improvements
- [ ] Team/Level members display fix

### P3 - Future
- [ ] Indian VPS migration (for Eko API)
- [ ] Push notifications (Firebase)
- [ ] UPI Payment Gateway
- [ ] Backend code refactoring

---

## TECHNICAL ARCHITECTURE

### Backend Stack
- Python 3.11 + FastAPI
- MongoDB (Motor async driver)
- Redis Cache (Upstash)
- Key files:
  - `/app/backend/server.py` - Main server
  - `/app/backend/routes/auth.py` - Authentication
  - `/app/backend/routes/razorpay_payments.py` - Payments
  - `/app/backend/routes/eko_payments.py` - Bill Payment & DMT

### Frontend Stack
- React 18 + Vite
- TailwindCSS + Shadcn UI
- react-helmet-async for SEO

### Integrations
- ✅ Razorpay (Test: rzp_test_SL4M5PYZu27Uqw)
- ⏳ Eko.in (LIVE credentials, waiting IP whitelist)
- ✅ MSG91 SMS
- ✅ OpenAI LLM

---

## CREDENTIALS REFERENCE

### Razorpay (Test)
- Key ID: rzp_test_SL4M5PYZu27Uqw
- Location: `/app/backend/.env`

### Eko.in (LIVE)
- Developer Key: 7c179a397b4710e71b2248d1f5892d19
- Initiator ID: 9936606966
- Base URL: https://api.eko.in:25002/ekoicici
- Status: Waiting for IP whitelist

### Server IP (for Eko whitelist)
- IP: 34.170.12.145
- Location: Google Cloud, Iowa, USA

---

## CONTACT
- Eko Support: sales.engineer@eko.co.in
- Eko Developer Portal: https://developers.eko.in
