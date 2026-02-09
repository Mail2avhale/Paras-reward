# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build a PRC (point-based reward currency) system web application where users can:
- Earn PRC through mining and referrals
- Redeem PRC for bill payments and gift vouchers
- Manage their account and view transaction history

## Architecture
- **Frontend**: React.js with Material-UI, Tailwind CSS
- **Backend**: Python FastAPI (monolithic `server.py`)
- **Database**: MongoDB
- **Authentication**: JWT-based custom auth

## Core Requirements

### User Features
- Mining PRC (daily claims)
- Referral system with bonus earnings
- Bill payments (Electricity, Mobile, DTH, etc.)
- Gift voucher redemption
- KYC verification
- VIP membership subscription

### Admin Features  
- User management (360 view)
- KYC approval workflow
- Transaction monitoring
- Configurable redemption charges
- Financial reporting
- PRC analytics

## What's Been Implemented (Latest: Feb 2026)

### Recently Completed
- [x] **Advanced Network Tree View** (Feb 2026)
  - New dedicated `/network-tree` page
  - Backend API: `/api/referrals/network-tree/{user_id}`
  - Analytics dashboard with level distribution
  - Search by name/email/mobile
  - Filter by level, subscription plan, activity
  - Export to CSV functionality
  - Tree view with expand/collapse nodes
  - User details modal on click
  - Responsive design with data-testid attributes
  - Files: `NetworkTreeAdvanced.js`, `server.py` (line 26752)
- [x] **Forgot PIN with MSG91 OTP** (Feb 2026)
  - Mobile number verification
  - MSG91 OTP Widget integration
  - Secure PIN reset after OTP verification
  - APIs: `/auth/forgot-pin/check-mobile`, `/auth/forgot-pin/verify-otp`, `/auth/forgot-pin/reset`
- [x] **Auto-login after PIN entry** (Feb 2026)
  - Automatically submits login form when 6 digits entered
  - No need to click "Sign In" button
  - 300ms delay to show last digit before submitting
- [x] **Masked PIN Input with Show/Hide Toggle** (Feb 2026)
  - Created reusable `PinInput.js` component
  - PIN digits masked by default (shows • dots)
  - Eye icon toggles visibility
  - Applied to Login, Registration, and SetNewPin pages
  - Fixed React infinite loop bug using useRef pattern
- [x] **6-Digit PIN Authentication System** (Dec 2025)
  - Replaced traditional password with 6-digit PIN
  - Weak PIN validation (blocks sequential/repeated digits)
  - Hybrid login for legacy password users
  - Forced PIN migration for old users
- [x] **Progressive Account Lockout** (Dec 2025)
  - 5 min lock after 3 failed attempts
  - 24 hour lock after 5 failed attempts
  - Login history tracking
- [x] Admin Redemption Charges configuration page
  - Processing Fee (flat INR)
  - Admin Charge (percentage)
  - Formula: Total PRC = (Amount + Processing Fee + Admin Charges) × 10
- [x] Contact Details Feature (Admin + Landing page)
- [x] Advanced Support Ticket System
- [x] SEO & Policy Pages (Privacy, Terms, Disclaimer)
- [x] Fixed infinite redirect loop in AdminSettingsHub
- [x] Mobile-responsive InfoTooltip component across all pages

### Key API Endpoints
- `/api/redemption/charge-settings` - GET charge settings
- `/api/admin/redemption/charge-settings` - POST update charges
- `/api/request-bill-payment` - Submit bill payment
- `/api/get-charge-breakdown` - Get charge calculation

## Test Credentials
- Admin (PIN): `admin@paras.com` / PIN: `123456`
- Legacy User (Password): `mail2avhale@gmail.com` / Password: `Secure*123`

## Prioritized Backlog

### P0 (Critical)
- [x] Masked PIN Input with Show/Hide Toggle - DONE
- [x] 6-Digit PIN Authentication System - DONE
- [ ] Production deployment

### P1 (High)
- [x] Refactor `server.py` into smaller modules - IN PROGRESS
  - [x] `routes/referral.py` - DONE (Dec 2025)
  - [x] `routes/auth.py` - DONE (Dec 2025) - All authentication routes
  - [ ] `routes/users.py` - Pending
  - [ ] `routes/wallet.py` - Pending
  - [ ] `routes/admin.py` - Pending

### P2 (Medium)
- [ ] Add rate limiting for redemption requests
- [ ] Email notifications for transactions
- [ ] Two-factor authentication (OTP via SMS/Email)

### P3 (Low)
- [ ] Mobile app APK build
- [ ] Performance optimization

## Key Files Reference
- `/app/frontend/src/pages/NetworkTreeAdvanced.js` - Advanced network tree visualization
- `/app/backend/routes/referral.py` - **NEW** Extracted referral routes (refactored from server.py)
- `/app/backend/routes/auth.py` - **NEW** Extracted auth routes (Dec 2025) - registration, login, PIN, biometric, password reset
- `/app/frontend/src/components/PinInput.js` - Reusable PIN input with masking
- `/app/frontend/src/pages/LoginNew.js` - Hybrid PIN/Password login
- `/app/frontend/src/pages/RegisterSimple.js` - Registration with PIN
- `/app/frontend/src/pages/SetNewPin.js` - PIN migration page
- `/app/frontend/src/pages/ReferralsEnhanced.js` - Referral system with link to network tree
- `/app/backend/server.py` - Main backend APIs (being refactored)

## Database Schema (Key Collections)
- `users`: User profiles with PRC balance
- `transactions`: All PRC movements
- `settings`: App configuration including redemption charges
- `bill_payment_requests`: Pending/completed payments
- `gift_voucher_requests`: Voucher redemptions

## Deployment
- **Preview URL**: https://server-cleanup-8.preview.emergentagent.com
- **Status**: Ready for production deployment
- **Action**: Use Emergent "Deploy" button
