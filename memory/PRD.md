# PARAS REWARD - Product Requirements Document

## Original Problem Statement
PARAS REWARD is a comprehensive rewards and subscription management platform with features including:
- User authentication with PIN-based login
- Mining/rewards system
- KYC verification
- Subscription management (VIP plans)
- Admin dashboard for managing users, orders, and finances
- Bill payments, Gift vouchers, Network/referral system

## Current Status: ✅ Production Working (Feb 15, 2026)

### Critical Bugs Fixed Today

**Bug 1: Production Login "Not Found" Error**
- **Root Cause:** Double `/api/api/` prefix in API calls
- **Fix:** Removed extra `/api` from ~80 files
- **Status:** FIXED ✅

**Bug 2: Dashboard/Mining Data Not Loading**
- **Root Cause:** Missing `/api` prefix in API variable definition
- **Pattern 1:** `const API = process.env.REACT_APP_BACKEND_URL;` (missing `/api`)
- **Pattern 2:** `const API = process.env.REACT_APP_BACKEND_URL || '';` (missing `/api`)
- **Fix:** Changed to `const API = \`${process.env.REACT_APP_BACKEND_URL}/api\`;` in ~67 files
- **Status:** FIXED ✅

**Bug 3: Profile Page White Screen**
- **Status:** FIXED ✅ (Cache clear resolved)

## Architecture

### Tech Stack
- **Frontend:** React.js with Tailwind CSS, Shadcn UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Authentication:** JWT + PIN-based login

### API URL Pattern
```javascript
// CORRECT pattern for all frontend files:
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Then use:
axios.get(`${API}/endpoint`)  // Results in: https://domain.com/api/endpoint
```

### Environment Variables
- **Production:** `REACT_APP_BACKEND_URL = https://parasreward.com`
- **Preview:** `REACT_APP_BACKEND_URL = https://parasreward-staging.preview.emergentagent.com`

## Completed Features
- User authentication (PIN + password migration)
- Admin dashboard with full stats
- Subscription management with approval/rejection
- KYC verification system
- Mining/rewards system
- Bill payments
- Network referrals
- Contact form submissions
- User Dashboard with balance display
- Profile page

## Pending Tasks

### P1 - High Priority
1. **UPI Payment Gateway Integration** - User requested Razorpay integration

### P2 - Medium Priority
2. **"DIRECTOR 365" Subscription Plan** - New plan design
3. **Force PIN Change Feature** - Admin ability

### P3 - Low Priority
4. **Backend Subscription Pricing Audit**
5. **Advanced PRC Burning Concepts**

## Test Credentials
- **Admin:** admin@test.com / PIN: 123456
- **Production User:** mail2avhale@gmail.com / PIN: 152759

## Notes
- User communicates in Marathi - respond in Marathi
- Production URL: parasreward.com
- Always clear browser cache after deployment
