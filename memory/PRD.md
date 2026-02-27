# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Financial rewards platform "Paras Reward" - stabilization, bug fixes, payment integrations, and Google Play Store preparation.

## Core Features
- PRC (Paras Reward Coin) earning and redemption system
- VIP Subscription plans (Startup, Growth, Elite)
- Bill Payment integration (Eko BBPS)
- DMT (Domestic Money Transfer) - Instant bank transfers
- Razorpay Payment Gateway
- Referral system with multi-level rewards
- Admin dashboard for user management

---

## CHANGELOG

### February 27, 2026 (Latest)

#### 🎉 EKO AUTO-PAY for ALL SERVICES - COMPLETED
- **सर्व Bill Payments:** Mobile, DTH, Electricity, Postpaid, Broadband, Water, Gas, LPG, Insurance, FASTag, Credit Card, Loan EMI, Municipal Tax
- **DMT (Bank Transfer):** Automatic bank transfer via Eko DMT on admin approval
- **Flow:** User Request → Admin Approve → Eko API Auto-Pay → User Notification

#### Backend Integration:
- Admin approve केल्यावर automatic Eko API call
- BBPS: Bill payments (14+ categories)
- DMT: Bank transfers with beneficiary management
- Fallback: Manual completion if Eko fails

#### Files Modified:
- `/app/backend/server.py` - Bill payment approval with Eko integration
- `/app/frontend/src/pages/BillPayments.js` - Simplified UI (removed payment mode selector)

### February 26, 2026

#### 🔴 CRITICAL BUG FIXES
1. **PRC Balance Reset Bug - FIXED**
   - Paid subscribers' PRC no longer resets on login
   - File: `/app/backend/routes/auth.py`

2. **Database Sync - COMPLETED**
   - 73 paid users fixed (membership_type = "vip")
   - 106/106 paid users now correct

#### 🟢 FEATURE IMPLEMENTATIONS
3. **Subscription Days: 30 → 28**
   - Monthly: 28, Quarterly: 84, Half-yearly: 168, Yearly: 336

4. **KYC Pending Card**
   - Shows "Complete KYC" message for pending users
   - Different colors for pending (amber) vs rejected (red)

5. **SEO Implementation**
   - react-helmet-async on 12 public pages
   - Dynamic title, description, canonical URLs

6. **Razorpay Payment Gateway ✅**
   - Test mode configured
   - APIs: create-order, verify-payment, webhook

7. **Eko Integration ✅**
   - BBPS Bill Payment APIs
   - DMT Money Transfer APIs
   - LIVE credentials configured

---

## COMPLETED INTEGRATIONS

### ✅ Razorpay (Payments)
- **Status:** Working (Test Mode)
- **Key ID:** rzp_test_SL4M5PYZu27Uqw
- **APIs:** `/api/razorpay/*`

### ✅ Eko.in (Bill Payment & DMT)
- **Status:** LIVE & Working
- **Developer Key:** 7c179a397b4710e71b2248d1f5892d19
- **Initiator ID:** 9936606966
- **Balance:** ₹0.00 (needs top-up)
- **APIs:** `/api/eko/*`

### ✅ MSG91 (SMS)
- Configured for OTP

### ✅ Redis (Cache)
- Upstash Redis configured

---

## PENDING TASKS

### P0 - Ready for Production
- [x] All critical bugs fixed
- [x] Payment integrations complete
- [x] Bill Payments Frontend UI (Mobile, DTH, Electricity)
- [ ] Eko wallet top-up (for DMT transfers)
- [ ] Razorpay LIVE keys

### P1 - Deployment
- [ ] Production server setup (Indian VPS recommended for Eko IP whitelisting)
- [ ] SSL certificate
- [ ] Domain configuration
- [ ] AAB file for Play Store (via PWA Builder)

### P2 - Enhancements
- [ ] Admin performance optimization (Profit & Loss page timeout)
- [ ] Push notifications (Firebase) - clarify vs in-app notifications
- [ ] UPI Payment Gateway
- [ ] Server-side search for admin

---

## TECHNICAL ARCHITECTURE

### Backend
- Python 3.11 + FastAPI
- MongoDB (Motor async)
- Redis Cache (Upstash)

### Frontend  
- React 18 + Vite
- TailwindCSS + Shadcn UI
- react-helmet-async (SEO)

### Key Files
```
/app/backend/
├── server.py                    # Main server
├── routes/
│   ├── auth.py                  # Authentication (PRC bug fixed)
│   ├── bank_redeem.py           # Bank withdrawals + Eko DMT
│   ├── razorpay_payments.py     # Razorpay integration
│   └── eko_payments.py          # Eko BBPS & DMT

/app/frontend/src/pages/
├── AdminUnifiedPayments.js      # Admin dashboard (Eko balance card)
├── DashboardModern.js           # User dashboard (KYC card)
└── BankRedeem.js                # Bank redemption
```

---

## CREDENTIALS REFERENCE

### Eko.in (LIVE)
```
Developer Key: 7c179a397b4710e71b2248d1f5892d19
Authenticator Key: 7a2529f5-3587-4add-a2df-3d0606d62460
Initiator ID: 9936606966
Base URL: https://api.eko.in:25002/ekoicici
```

### Razorpay (Test)
```
Key ID: rzp_test_SL4M5PYZu27Uqw
Key Secret: 3yN3xjFK9qDPOXa2W4ToaFLB
```

### Server
```
IP: 34.170.12.145 (whitelisted with Eko)
Preview: https://reward-staging.preview.emergentagent.com
```

---

## DEPLOYMENT

See `/app/DEPLOYMENT_GUIDE.md` for complete deployment instructions.

---

## CONTACTS

- **Eko Support:** sales.engineer@eko.co.in
- **Eko Portal:** https://developers.eko.in
- **Razorpay:** https://dashboard.razorpay.com
