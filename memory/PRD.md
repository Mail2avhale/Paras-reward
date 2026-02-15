# PARAS REWARD - Product Requirements Document

## Original Problem Statement
PARAS REWARD is a comprehensive rewards and subscription management platform with features including:
- User authentication with PIN-based login
- Mining/rewards system
- KYC verification
- Subscription management (VIP plans)
- Admin dashboard for managing users, orders, and finances
- Bill payments
- Gift vouchers
- Network/referral system

## Current Status: Production Ready (After Bug Fix)

### Critical Bug Fixed (Feb 15, 2026)
**Issue:** Production login failing with "Not Found" error
**Root Cause:** Double `/api/api/` prefix in API calls
- Frontend code defined `const API = ${BACKEND_URL}/api`
- Then used `${API}/api/...` causing double prefix
**Fix:** Removed extra `/api` from all API calls across ~80 files
**Status:** FIXED and TESTED

## Architecture

### Tech Stack
- **Frontend:** React.js with Tailwind CSS, Shadcn UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Authentication:** JWT + PIN-based login

### Key Directories
```
/app
├── backend/
│   ├── routes/          # API endpoints
│   ├── models/          # Data models
│   └── server.py        # Main FastAPI app
└── frontend/
    └── src/
        ├── pages/       # Page components
        ├── components/  # Reusable components
        └── utils/       # Utility functions
```

## Completed Features
- User authentication (PIN + password migration)
- Admin dashboard with full stats
- Subscription management with approval/rejection
- KYC verification system
- Mining/rewards system
- Bill payments
- Network referrals
- Contact form submissions

## Pending Tasks

### P1 - High Priority
1. **UPI Payment Gateway Integration** - User requested Razorpay/PhonePe integration
2. **"DIRECTOR 365" Subscription Plan** - New plan design needed

### P2 - Medium Priority
3. **Force PIN Change Feature** - Admin ability to force users to change PIN
4. **Backend Subscription Pricing Audit** - Full audit of pricing logic

### P3 - Low Priority
5. **Advanced PRC Burning Concepts** - Enhanced token burning mechanics

## API Endpoints Reference
- `POST /api/auth/login` - User login
- `GET /api/auth/check-auth-type` - Check user auth type (PIN/password)
- `PUT /api/admin/vip-payments/{id}/approve` - Approve subscription
- `PUT /api/admin/vip-payments/{id}/reject` - Reject subscription

## Test Credentials
- **Admin:** admin@test.com / PIN: 123456
- **Test User:** test@test.com / PIN: 123456

## Notes
- User communicates in Marathi - respond in Marathi
- Production URL: parasreward.com
- Preview URL: parasreward-staging.preview.emergentagent.com
