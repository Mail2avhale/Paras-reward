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

3. **Paras Luxury Life** ✅ COMPLETE (Jan 26, 2026)
   - Auto-save 20% of ALL earned PRC for luxury products
   - Applies to ALL users (free and paid)
   - Products:
     - 📱 Mobile (₹1L) - 4% of 20% auto-save - Down payment: 3L PRC (30%)
     - 🏍️ Bike (₹2L) - 6% of 20% auto-save - Down payment: 6L PRC (30%)
     - 🚗 Car (₹12L) - 10% of 20% auto-save - Down payment: 36L PRC (30%)
   - Savings are LOCKED (no withdrawal)
   - Users can claim at 50% completion
   - Admin approval/rejection workflow with reasons
   - Admin can force-redeem at any percentage
   - Integrated with: Mining, Tap Game, PRC Rain

4. **Marketplace** - Product ordering with PRC
5. **Bill Payment Services** - Mobile, Electric, DTH, Loan EMI
6. **Gift Voucher Redemption** - PhonePe, Amazon, Flipkart
7. **5-Level Referral System**
8. **Social Features** - Referral messaging, nearby users
9. **Multi-language Support** - 9 Indian languages

---

## What's Been Implemented

### Jan 26, 2026 (This Session)
- ✅ **Verified Admin Luxury Claims Page** - Fully functional
  - Stats dashboard (Total, Pending, Approved, Rejected)
  - Search & filter functionality
  - Approve/Reject buttons with reason modal
  - Force Redeem (Admin Override) feature
  - Dark theme properly applied
- ✅ **Tested PRC Rain Luxury Savings** - 80/20 split working correctly
  - Positive drops: 80% to wallet, 20% to luxury savings
  - Negative drops: Full amount deducted from wallet (no luxury impact)
  - Session summary includes luxury savings total

### Previous Session
- ✅ **Paras Luxury Life Feature** - Complete implementation
  - Backend APIs for savings, claims, admin management
  - Auto-save integration with mining, tap game, PRC rain
  - Luxury frontend page with HD images and animations
  - Dashboard banner for ALL users
- ✅ Removed "Network" and "Messages" buttons from dashboard
- ✅ Duplicate UTR prevention across all payment types
- ✅ Rejection workflow with mandatory reasons
- ✅ Approval workflow with TXN IDs
- ✅ Browser cache-busting mechanism

---

## Code Architecture

```
/app/
├── backend/
│   └── server.py
│       - Lines 4063-4170: Mining with luxury savings
│       - Lines 4530-4600: Tap game with luxury savings
│       - Lines 21251-21316: PRC Rain with luxury savings
│       - Lines 32881-33030: process_luxury_savings function
│       - Lines 33231-33400: Admin luxury claims APIs
└── frontend/
    └── src/
        ├── pages/
        │   ├── ParasLuxuryLife.js (User luxury savings page)
        │   ├── AdminLuxuryClaims.js (Admin claims management)
        │   └── DashboardModern.js (Luxury banner)
        ├── components/layouts/
        │   └── AdminLayout.js (Sidebar with Luxury Claims link)
        └── App.js (Routes)
```

---

## Pending Issues

### P0 (Critical)
- [ ] Active referral status shows "Inactive" for active users (USER VERIFICATION PENDING)

### P1 (High Priority)
- [ ] User-facing search bar functionality (need page details from user)
- [ ] Dark Theme fix across ALL Admin pages
- [ ] Verify Subscription "Extend" Logic
- [ ] KYC Document Upload on Mobile

---

## Upcoming Tasks (P2)
- [ ] Architect for Play Store Release
- [ ] Full Redis Integration
- [ ] ML Risk Scoring
- [ ] AdMob + Unity Ads Integration
- [ ] Shareable Achievement Cards

## Future Tasks (P3)
- [ ] Refactor monolithic server.py

---

## Key APIs

### Luxury Life APIs
- `GET /api/luxury-life/savings/{user_id}` - Get user savings
- `POST /api/luxury-life/claim/{user_id}/{product_key}` - Submit claim
- `GET /api/admin/luxury-claims` - List all claims (Admin)
- `POST /api/admin/luxury-claims/{claim_id}/approve` - Approve claim
- `POST /api/admin/luxury-claims/{claim_id}/reject` - Reject with reason
- `POST /api/admin/luxury-claims/force-redeem/{user_id}/{product_key}` - Admin override

### DB Collections
- `luxury_savings`: User savings per product
- `luxury_claims`: Claim requests with status tracking
