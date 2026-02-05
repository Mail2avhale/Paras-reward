# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build a comprehensive rewards and loyalty platform with:
- PRC (PARAS Reward Coin) earning through mining, referrals, and activities
- Bill payment redemption system
- Gamification features (Rain Drop game, achievements)
- Multi-tier subscription plans (Free, Startup, Growth, Elite)
- Admin panel for user management and analytics

## User Personas
1. **Regular Users**: Earn PRC through activities, redeem for bill payments
2. **VIP Subscribers**: Access premium features, higher earning rates
3. **Admins**: Manage users, approve requests, view analytics

## Core Requirements

### Implemented Features ✅

#### Bill Payment System (COMPLETED - Dec 2025, Updated Feb 2026)
- [x] Mobile Recharge, DTH, Electricity, Credit Card, Loan/EMI
- [x] PRC deduction with service charges
- [x] Admin approval workflow: pending → completed (APPROVE = COMPLETE - Feb 2026)
- [x] **Gamification Features:**
  - Live Timer for pending requests
  - Animated Journey tracker (Submitted → Processing → Completed)
  - Confetti celebration on completion
  - Speed Badges (Lightning Fast ≤1h, Quick Service ≤4h, On Time ≤8h)
  - Processing time calculation and display
- [x] Rejection reason display with PRC refund
- [x] TXN number generation

#### Admin Analytics Dashboard (COMPLETED - Dec 2025)
- [x] New `/admin/analytics` page with recharts
- [x] Date range filtering (Today, Week, Month, Year, Custom)
- [x] Real-time auto-refresh toggle
- [x] PRC circulation stats (10 PRC = ₹1 INR conversion)
- [x] User breakdown charts (by subscription plan)
- [x] Key metrics: Total users, Active miners, Revenue

#### Profile & Subscription (COMPLETED - Dec 2025)
- [x] Profile Completion Ring (hides at 100%)
- [x] Subscription start date display on dashboard
- [x] KYC verification flow

#### Authentication
- [x] Email/Password login
- [x] JWT token authentication
- [x] Role-based access (user, admin, manager)

### Pending Issues 🔴

1. **P0: Production Data Discrepancy** - BLOCKED
   - Referral page shows incorrect counts
   - Admin dashboard stats mismatch
   - Needs user action on production server

2. **P1: Mining Issues (Production)**
   - Auto-pause not working
   - Reward rate not displaying

3. **P1: Search Bar Broken**
   - User-facing search functionality not working

### Recently Completed ✅ (Feb 5, 2026)

#### Full Carry Forward for Monthly Redeem Limit
- [x] Implemented full carry forward feature - unused monthly limit now accumulates
- [x] Created `calculate_carry_forward_limit()` function to calculate unused limits from all previous months
- [x] Updated `calculate_user_monthly_redeem_limit()` to include carry forward in total limit
- [x] Added new user-facing API: `GET /api/user/{uid}/redeem-limit` to show limit breakdown
- [x] Updated admin endpoint with carry forward details
- [x] Error messages now show carry forward breakdown

#### Total Referral Earnings Fix
- [x] Fixed "Total Referral Earnings: 0 PRC" bug in Network Analytics page
- [x] Updated transaction queries to check all referral types: `referral`, `referral_bonus`, `referral_reward`
- [x] Added referral bonus tracking when mining is claimed (creates separate transaction)
- [x] Added `total_referral_earnings` field tracking on user document
- [x] Added estimated historical earnings calculation for users without transaction history

#### Balance & Label Consistency Fix
- [x] Unified "Total Earned" → "Lifetime Earnings" label on Mining and Orders pages
- [x] Mining page now fetches `total_earned` from `/api/user/{uid}/redemption-stats` for data consistency
- [x] Both pages use same data source for balance and earnings
- [x] Mining page adds current session PRC (`sessionPRC`) to show running total

**Files modified:** `backend/server.py`, `Mining.js`, `Orders.js`

### Upcoming Tasks 🟡

1. **P0: Rain Drop Game Enhancement**
   - Combo System
   - Fever Mode
   - Golden/Bomb Drops
   - Leaderboard
   - Achievements
   - Power-ups
   - Visual/Audio enhancements

2. **P0: Admin Panel Separation**
   - Migrate to separate subdomain
   - Architecture planning

3. **P1: Play Store Release**
   - Evaluate PWA+TWA vs native app

### Future/Backlog 🔵

- ML Risk Scoring for fraud detection
- Full AdMob + Unity Ads Integration
- Shareable Achievement Cards
- Server.py refactoring (modular routers)

## Technical Architecture

### Backend (FastAPI)
- `/app/backend/server.py` - Main monolithic server (needs refactoring)
- MongoDB for data storage
- Upstash Redis for caching

### Frontend (React)
- `/app/frontend/src/pages/` - Page components
- `/app/frontend/src/components/` - Reusable components
  - `BillPaymentJourney.jsx` - Gamification animations
- Shadcn/UI component library
- Recharts for data visualization
- canvas-confetti for celebrations

### Key API Endpoints
- `POST /api/admin/analytics-v2` - Advanced analytics with date filtering
- `POST /api/admin/bill-payment/process` - Approve/Reject/Complete requests
- `GET /api/user/{uid}/dashboard` - User dashboard data
- `GET /api/bill-payment/requests/{uid}` - User's bill payment history

### Database Collections
- `users` - User profiles, balances, subscriptions
- `bill_payment_requests` - Payment requests with status workflow
- `vip_payments` - Subscription payments
- `transactions` - Wallet transaction history
- `referrals` - Referral relationships

## Business Rules
- PRC to INR: 10 PRC = ₹1
- Service charge: 2% on bill payments
- Processing time target: 3-7 days
- Speed badges based on completion time

## Test Credentials
- Admin: `testadmin@emergent.com` / `testpassword`
- Elite User: `elitetest@test.com` / `testpassword`
- Test User: `testuser123@emergent.com` / `testpassword`

---
Last Updated: February 5, 2026
