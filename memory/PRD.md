# Paras Reward Platform - PRD

## Original Problem Statement
Build a comprehensive reward and loyalty platform with subscription-based membership system, PRC (Platform Reward Currency) mining, marketplace, gift voucher redemption, bill payment services.

## Core Requirements

### User Types
- **Admin**: Full platform control
- **Manager**: Regional management
- **User/Customer**: End user

**REMOVED (Jan 12, 2026):**
- ~~Master Stockist, Sub Stockist, Outlet~~ - Replaced with Direct Delivery Partner model

### Key Features
1. **4-Tier Subscription System** (Updated - Jan 20, 2026)
   | Plan | Multiplier | Tap Limit | Daily PRC (Tap Game) | Ref Weight | Can Redeem | Price |
   |------|------------|-----------|----------------------|------------|------------|-------|
   | Explorer | 1.0x | 100 | 10 PRC | 1.0x | ❌ | FREE |
   | Startup | 1.5x | 100 | 50 PRC | 1.2x | ✅ | ₹299/mo |
   | Growth | 2.0x | 100 | 100 PRC | 1.5x | ✅ | ₹549/mo |
   | Elite | 3.0x | 100 | 200 PRC | 2.0x | ✅ | ₹799/mo |

2. **PRC (Platform Reward Currency)**
   - Mining system with subscription multiplier
   - Daily_Reward = Day × ((BR × User_Multiplier) + Referral_Bonus)
   - Explorer users: PRC burns after 2 days inactivity
   - Paid users: PRC never burns

3. **Marketplace**
   - SBI Rewardz-style design with blue header, category tabs, carousels
   - Product ordering with PRC
   - Paid plans only (Startup/Growth/Elite)
   - Direct Delivery by Delivery Partner
   - Product Badges: New, Trending, Hot Deal, Limited Offer, Bestseller

4. **Bill Payment Services**
   - Mobile recharge, Electricity, Credit cards, DTH, Loan EMI
   - Paid plans only

5. **Gift Voucher Redemption**
   - PhonePe, Amazon, Flipkart vouchers
   - Paid plans only

6. **5-Level Referral System with Subscription Weights**

7. **Social Features** (NEW - Jan 2026)
   - Direct Referral Messaging
   - Nearby Users (IP-based geolocation with privacy toggle)
   - In-app notifications for referral events

8. **Admin Features**
   - Fraud Detection Dashboard
   - Accounting Dashboard with real-time stats
   - Bill Payment, Subscription, Gift Voucher management with pending amount totals and sorting

9. **Performance Optimizations**
   - Backend caching layer (cache_manager.py)
   - Database indexing (db_indexes.py)

10. **Multi-language Support** (9 Indian languages)
    - English, Hindi, Marathi, Gujarati, Tamil, Telugu, Kannada, Bengali, Punjabi

---

## What's Been Implemented

### Jan 25, 2026
- ✅ Completed Dashboard Translations (`DashboardModern.js`)
- ✅ Added 16 new translation keys to `LanguageContext.js`
- ✅ Fixed syntax error in DashboardModern.js
- ✅ Verified AI Chatbot avatar update

### Previous Session (Jan 24-25, 2026)
- ✅ Admin Fraud Dashboard UI
- ✅ Direct Referral Messaging
- ✅ Nearby Users feature with IP geolocation
- ✅ In-app notifications for referral events
- ✅ Fixed Admin Bill Payments missing service details (major regression fix)
- ✅ Fixed Admin Accounting cards showing mock values
- ✅ Fixed User Home Page stats
- ✅ Added pending amount totals and sorting to admin pages
- ✅ Implemented caching layer and database indexes

---

## Pending Issues

### P0 (Critical)
- [ ] Active referral status shows "Inactive" for active mining users (USER VERIFICATION PENDING)

### P1 (High Priority)
- [ ] User-facing search bar functionality (page unknown)
- [ ] Dark Theme fix across all Admin pages
- [ ] Verify Subscription "Extend" Logic
- [ ] KYC Document Upload on Mobile

---

## Upcoming Tasks

### P1
- [ ] Play Store Release Architecture - Plan user-only mobile build vs web-admin split

### P2
- [ ] Full Redis Integration (currently in-memory fallback)
- [ ] ML Risk Scoring for advanced fraud detection
- [ ] AdMob + Unity Ads Integration
- [ ] Shareable Achievement Cards

### P3
- [ ] Refactor monolithic `backend/server.py`

---

## Code Architecture

```
/app/
├── backend/
│   ├── cache_manager.py
│   ├── db_indexes.py
│   ├── fraud_detection.py
│   └── server.py
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── DashboardModern.js (Fully translated)
    │   │   ├── AdminAccountingDashboard.js
    │   │   ├── AdminBillPayments.js
    │   │   ├── AdminGiftVouchers.js
    │   │   ├── AdminSubscriptionManagement.js
    │   │   ├── AdminFraudDashboard.js
    │   │   └── ReferralDashboardAI.js
    │   ├── components/
    │   │   └── AIChatbot.js (Updated avatar)
    │   └── contexts/
    │       └── LanguageContext.js (Translation keys)
```

---

## User Communication Notes
- User communicates in English/Marathi mix
- **Always start responses with "समजलं!"**
- User is sensitive to regressions - thorough testing required
