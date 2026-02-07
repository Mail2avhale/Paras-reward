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

## What's Been Implemented (Latest: Dec 2025)

### Recently Completed
- [x] Admin Redemption Charges configuration page
  - Processing Fee (flat INR)
  - Admin Charge (percentage)
  - Formula: Total PRC = (Amount + Processing Fee + Admin Charges) × 10
- [x] Fixed infinite redirect loop in AdminSettingsHub
- [x] Mobile-responsive InfoTooltip component across all pages
- [x] "Pay EMI" feature (renamed from "Loan EMI")
- [x] Password visibility toggle on registration
- [x] Full carry-forward for unused monthly PRC limits
- [x] Detailed PRC breakdown on Orders page

### Key API Endpoints
- `/api/redemption/charge-settings` - GET charge settings
- `/api/admin/redemption/charge-settings` - POST update charges
- `/api/request-bill-payment` - Submit bill payment
- `/api/get-charge-breakdown` - Get charge calculation

## Test Credentials
- Admin: `admin@parasreward.com` / `Admin@123`

## Prioritized Backlog

### P0 (Critical)
- [x] Admin Redemption Charges page - DONE
- [ ] Production deployment

### P1 (High)
- [ ] Refactor `main.py` into smaller modules
  - `routes/users.py`
  - `routes/transactions.py`
  - `routes/admin.py`

### P2 (Medium)
- [ ] Add rate limiting for redemption requests
- [ ] Email notifications for transactions

### P3 (Low)
- [ ] Mobile app APK build
- [ ] Performance optimization

## Database Schema (Key Collections)
- `users`: User profiles with PRC balance
- `transactions`: All PRC movements
- `settings`: App configuration including redemption charges
- `bill_payment_requests`: Pending/completed payments
- `gift_voucher_requests`: Voucher redemptions

## Deployment
- **Preview URL**: https://pin-input-toggle.preview.emergentagent.com
- **Status**: Ready for production deployment
- **Action**: Use Emergent "Deploy" button
