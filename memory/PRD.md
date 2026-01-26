# PARAS Rewards Platform - Product Requirements Document

## Original Problem Statement
Build a comprehensive social rewards platform with features including:
- User authentication and KYC verification
- Mining and PRC (Paras Rewards Coin) earning mechanisms
- VIP subscription tiers (Basic, Growth, Elite)
- Bill payments and gift voucher redemption using PRC
- "Paras Luxury Life" - Automated savings for luxury products (mobile, bike, car)
- Admin dashboard for managing users, payments, and platform operations
- Referral system with activity tracking

## User Personas
1. **Regular Users**: Earn PRC through mining, tap games, referrals; redeem for bill payments/gift vouchers
2. **VIP Subscribers**: Enhanced earning rates and features based on tier
3. **Admins**: Manage platform operations, approve/reject requests, monitor fraud

## Core Architecture
- **Frontend**: React with Tailwind CSS, Shadcn/UI components
- **Backend**: FastAPI (Python) with MongoDB
- **State Management**: React Context API
- **Authentication**: JWT-based

## What's Been Implemented

### January 26, 2026 - Request Timeline Feature
- Created reusable `RequestTimeline` component with SLA badges
- Enhanced Admin pages (Bill Payments, Gift Vouchers, Subscriptions) with:
  - SLA warning badges (yellow >48h, red >96h)
  - Visual timeline showing request submission and processing timestamps
  - Admin name display (`processed_by`)
  - Processing time calculation
- Enhanced User pages (Bill Payments, Gift Voucher Redemption) with:
  - Expandable rows/cards showing compact timeline view
- Cleaned up unused `LuxuryProductCard` component from RewardsHome.js

### Previous Session - Bug Fixes & Enhancements
- Fixed critical 80/20 luxury savings split bug (frontend API endpoint mismatch)
- Fixed "Total Redeemed" calculation to exclude rejected requests
- Complete redesign of landing page (RewardsHome.js) for AdMob compliance
- Created public `/api/stats` endpoint for landing page statistics
- Added pagination to AdminSubscriptionManagement.js
- Added status filter tabs to user-facing Bill Payments and Gift Voucher pages

## Pending Issues (P0-P1)

### P0 - Critical
- None currently

### P1 - High Priority
1. **Active referral status bug** - Shows "Inactive" for active mining users (USER VERIFICATION PENDING, recurring issue)
2. **KYC "Failed to approve" error** - Admin cannot approve KYC (BLOCKED - needs user logs from production)
3. **User-facing search bar** - Functionality is broken
4. **Dark Theme for Admin pages** - Inconsistent styling across admin pages
5. **Subscription "Extend" Logic** - Needs verification
6. **KYC Document Upload on Mobile** - Not working properly

## Upcoming Tasks (P1)
- Architect for Play Store Release (user-only frontend version)

## Future/Backlog Tasks (P2-P3)

### P2
- Full Redis Integration (replace in-memory cache)
- ML Risk Scoring for fraud detection
- AdMob + Unity Ads Integration
- Shareable Achievement Cards

### P3
- Refactor monolithic `backend/server.py` into modules

## Key Files Reference

### Frontend
- `/app/frontend/src/components/RequestTimeline.js` - Reusable timeline component
- `/app/frontend/src/pages/AdminBillPayments.js` - Admin bill payment management
- `/app/frontend/src/pages/AdminGiftVouchers.js` - Admin gift voucher management
- `/app/frontend/src/pages/AdminSubscriptionManagement.js` - Admin subscription management
- `/app/frontend/src/pages/BillPayments.js` - User bill payment page
- `/app/frontend/src/pages/GiftVoucherRedemption.js` - User gift voucher page
- `/app/frontend/src/pages/RewardsHome.js` - Public landing page
- `/app/frontend/src/pages/Mining.js` - Mining/PRC collection

### Backend
- `/app/backend/server.py` - Main API server (monolithic, needs refactoring)

## Database Collections
- `users` - User accounts with roles, balances, subscription info
- `bill_payment_requests` - Bill payment requests with `processed_by`, `created_at`, `processed_at`
- `gift_voucher_requests` - Gift voucher requests with `processed_by`, `created_at`, `processed_at`
- `vip_payments` - Subscription payment records with `processed_by`, `created_at`, `processed_at`
- `luxury_savings` - User luxury savings (mobile, bike, car)
- `mining_history` - Mining activity records
- `kyc_submissions` - KYC verification documents

## Test Reports
- `/app/test_reports/iteration_37.json` - Latest test report (luxury savings split fix)
- `/app/backend/tests/test_luxury_savings_split.py` - Luxury savings test file

## Critical Notes for Developers
1. **User Communication**: Start responses with `समजलं!` (Marathi acknowledgment)
2. **Environment**: Preview and production use different databases
3. **Browser Cache**: Users may need hard refresh (Ctrl+Shift+R) after updates
4. **Admin Login**: admin@paras.com / admin123
