# Paras Reward - DMT Application

## Problem Statement
Build and maintain a Domestic Money Transfer (DMT) application using Eko API integration. The app allows users to transfer money to bank accounts using OTP verification.

## Core Features
1. **DMT Transfers** - Send money to bank accounts via IMPS
2. **Beneficiary Management** - Add/Delete recipients
3. **Transaction History** - View past transactions
4. **Global Redeem Limit** - Apply limits across withdrawal services
5. **Referral Bonus** - Bonus system for referrals
6. **Admin Panel** - Manage users, view transactions

## Technical Architecture

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB
- **API Integration**: Eko DMT API (V3)

### Frontend
- **Framework**: React
- **UI Library**: Tailwind CSS, Shadcn/UI

### Key API Endpoints
- `POST /api/eko/levin-dmt/sender/check` - Check sender profile
- `POST /api/eko/levin-dmt/sender/register` - Register sender (service_code=83)
- `GET /api/eko/levin-dmt/recipients/{mobile}` - Get beneficiary list
- `POST /api/eko/levin-dmt/recipient/add` - Add beneficiary
- `DELETE /api/eko/levin-dmt/recipient/delete` - Delete beneficiary
- `POST /api/eko/levin-dmt/transfer/send-otp` - Generate transfer OTP
- `POST /api/eko/levin-dmt/transfer` - Execute transfer

### Eko API Configuration
- **Base URL V3**: `https://api.eko.in:25002/ekoicici/v3`
- **OTP Endpoint**: `/customer/payment/dmt-levin/otp` (works for both)
- **Transfer Endpoint**: `/customer/payment/dmt` (Regular DMT, pipe 4)
- **Note**: DMT-Levin (pipe 14) requires separate registration - use Regular DMT (pipe 4) instead

## What's Been Implemented

### March 14, 2026
- **DMT Transfer Fixed**: Changed from DMT-Levin endpoint (`/dmt-levin`, pipe 14) to Regular DMT endpoint (`/dmt`, pipe 4)
- **Root Cause**: Customer was registered for Regular DMT (pipe 4) but not for DMT-Levin (pipe 14)
- **Registration**: Uses `service_code=83` for Remittance Levin registration
- **Successful Test**: ₹100 transferred to Mr SANTOSH SHAMRAO AVHALE (SBI, Transaction ID: 3548834855)
- **Transaction History API**: Added `/api/eko/levin-dmt/transactions/{user_id}` endpoint to fetch recent transactions

### Previous Sessions
- Eko API integration with authentication (HMAC-SHA256)
- Sender registration/verification flow
- Beneficiary management (Add/Delete)
- Transaction OTP generation
- Global Redeem Limit implementation
- Admin panel for DMT transactions
- V2 verification endpoint discovery

## Known Issues

### P1 - Production Deployment Crashes
- **Issue**: Production app crashes after frontend changes
- **Workaround**: Hide JSX with CSS instead of deleting
- **Status**: NOT STARTED

### P1 - Razorpay Double Subscription Bug
- **Status**: USER VERIFICATION PENDING

## Upcoming Tasks

### P1
1. Guide user on `fix-double-subscriptions` admin API
2. Full regression test of Add/Delete Beneficiary functionality

### P2
1. Full regression test of the application
2. Investigate production deployment failures

## Future/Backlog Tasks
1. Migrate database from MongoDB to PostgreSQL
2. Migrate KYC/Receipt images from base64 to file storage
3. Add Email/Mobile OTP verification on signup
4. Refactor large DMTPage.js component

## Test Credentials
- **Login**: Mobile: `9970100782`, PIN: `153759`
- **Aadhaar**: `433252933775`

## 3rd Party Integrations
- **Eko API** - DMT transfers (V2 & V3)
- **Razorpay** - Subscriptions
- **MSG91** - OTP services
