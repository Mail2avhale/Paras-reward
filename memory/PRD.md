# Paras Reward Platform - PRD

## Original Problem Statement
Build a comprehensive reward and loyalty platform with subscription-based membership system, PRC (Platform Reward Currency) mining, marketplace, gift voucher redemption, bill payment services.

## Core Requirements

### User Types
- **Admin**: Full platform control
- **Manager**: Regional management
- **User/Customer**: End user

### Key Features

1. **4-Tier Subscription System**
   | Plan | Multiplier | Tap Limit | Daily PRC | Ref Weight | Can Redeem | Price |
   |------|------------|-----------|-----------|------------|------------|-------|
   | Explorer | 1.0x | 100 | 10 PRC | 1.0x | ❌ | FREE |
   | Startup | 1.5x | 100 | 50 PRC | 1.2x | ✅ | ₹299/mo |
   | Growth | 2.0x | 100 | 100 PRC | 1.5x | ✅ | ₹549/mo |
   | Elite | 3.0x | 100 | 200 PRC | 2.0x | ✅ | ₹799/mo |

2. **PRC (Platform Reward Currency)**
   - Mining system with subscription multiplier
   - Explorer users: PRC burns after 2 days inactivity
   - Paid users: PRC never burns

3. **Paras Luxury Life** (NEW - Jan 26, 2026)
   - Auto-save 20% of earned PRC for luxury products
   - Products:
     - 📱 Mobile (₹1L) - 4% auto-save - Down payment: 3L PRC
     - 🏍️ Bike (₹3L) - 6% auto-save - Down payment: 9L PRC  
     - 🚗 Car (₹12L) - 10% auto-save - Down payment: 36L PRC
   - Only for paid plan users
   - Savings are LOCKED (no withdrawal)
   - Admin approval required for claims
   - Down payment = 30% of product value

4. **Marketplace** - Product ordering with PRC
5. **Bill Payment Services** - Mobile, Electric, DTH, Loan EMI
6. **Gift Voucher Redemption** - PhonePe, Amazon, Flipkart
7. **5-Level Referral System**
8. **Social Features** - Referral messaging, nearby users
9. **Multi-language Support** - 9 Indian languages

---

## What's Been Implemented

### Jan 26, 2026
- ✅ **Paras Luxury Life Feature** - Complete implementation
  - Backend APIs for savings, claims, admin management
  - Auto-save integration with mining and tap game
  - Luxury frontend page with HD images and animations
  - Dashboard banner for paid users
- ✅ Removed "Network" and "Messages" buttons from dashboard (per user request)

### Jan 25, 2026
- ✅ Dashboard Translations
- ✅ Bot avatar update

---

## Code Architecture

```
/app/
├── backend/
│   ├── server.py (MODIFIED: Luxury Life APIs, auto-save logic)
│   ├── cache_manager.py
│   ├── db_indexes.py
│   └── fraud_detection.py
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── ParasLuxuryLife.js (NEW)
    │   │   ├── DashboardModern.js (MODIFIED: Luxury banner)
    │   │   └── ...
    │   └── App.js (MODIFIED: Luxury route)
```

---

## Pending Issues

### P0 (Critical)
- [ ] Active referral status shows "Inactive" for active users

### P1 (High Priority)
- [ ] Admin page for Luxury Claims management
- [ ] User-facing search bar functionality
- [ ] Dark Theme fix across Admin pages

---

## Upcoming Tasks
- [ ] Play Store Release Architecture
- [ ] Full Redis Integration
- [ ] ML Risk Scoring

---

## User Communication Notes
- **Always start with "समजलं!"**
- User is sensitive to regressions
