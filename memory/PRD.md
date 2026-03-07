# Paras Reward App - Product Requirements Document

## Original Problem Statement
Paras Reward is a mining economy app with subscription-based rewards. Users can mine PRC (Paras Reward Coins) based on their subscription level and network (referrals).

## Core Features
- **Mining System**: Users mine PRC based on subscription tier + single-leg bonus + team boost
- **Subscription Plans**: Multiple tiers (Explorer, Basic, Plus, Premium, Enterprise)
- **Referral/Invite System**: Multi-level referral bonuses
- **KYC Verification**: Aadhaar + PAN verification for withdrawals
- **BBPS Integration**: Bill payments using Eko API
- **DMT Integration**: Domestic Money Transfer using Eko API
- **Bank Withdrawal via Chatbot**: Hidden withdrawal system (NEW)
- **Recurring Deposits**: PRC savings with interest

## Tech Stack
- **Frontend**: React.js with Shadcn/UI components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Razorpay for subscriptions, Eko for BBPS/DMT

---

## What's Been Implemented

### December 2025 - Major Refactoring Session

#### Features Removed
1. **Marketplace** - All product, cart, order, checkout routes removed (~2,130 lines)
2. **Luxury Life** - Auto-save for luxury products feature removed (~700 lines)
3. **TAP Game** - Tap-to-earn game feature removed (~130 lines)
4. **Direct Bank Transfer UI** - Removed from RedeemPageV2 (moved to chatbot)

#### Code Refactoring
1. **KYC Routes Extracted** - `routes/kyc.py` created
2. **BBPS/DMT Separation** - Clean separation of payment services
3. **Unused Route Files Deleted** - social.py, support.py, admin_ledger.py

#### 🆕 Bank Withdrawal via Chatbot (NEW)

**User Flow:**
```
1. User: "Bank withdrawal करायचे आहे"
2. Bot checks: KYC verified + Balance sufficient + Min ₹500
3. Bot shows: Balance, fees calculation
4. User provides: Account holder name, Account number, Bank name, IFSC
5. User confirms
6. Request ID generated (WD-YYYYMMDD-XXXXXX)
7. Admin processes via DMT in 5-7 days
8. Status updates via chatbot
```

**Fee Structure:**
- Processing Fee: ₹10 (flat)
- Admin Charge: 20% of amount
- Example: ₹500 withdrawal → User receives: ₹390

**Requirements:**
- ✅ KYC Verified
- ✅ Minimum ₹500
- ✅ 10 PRC = ₹1

**Files Created:**
- `routes/chatbot_withdrawal.py` - Backend API (400+ lines)
- `AdminChatbotWithdrawals.js` - Admin panel (500+ lines)

**Admin Panel Features:**
- Pending/Processing/Completed/Rejected tabs
- Request details with user & bank info
- Approve → Process via DMT → Complete
- Reject with reason (PRC refunded)

---

## Testing Status

### Iteration 110 - Chatbot Withdrawal
- Backend: 26/26 passed ✅
- Frontend: 20/20 passed ✅
- Total: 46/46 passed ✅

### Previous Iterations
- Iteration 108 (BBPS/DMT): 36/36 passed ✅
- Iteration 109 (Subscription E2E): 50/51 passed ✅

---

## Prioritized Backlog

### P0 - Critical
- [ ] Razorpay auto-subscription fails on production (fix in preview, needs deployment)

### P1 - High Priority
- [ ] BBPS billers (AEML, JPDCL) fail to fetch bills
- [ ] Production deploy with all changes

### P2 - Medium Priority
- [ ] "Payment Status Check on Login" safeguard
- [ ] DMT APIs in preview (IP now whitelisted ✅)

### P3 - Low Priority
- [ ] Eko DMT v3 with Aadhaar/eKYC
- [ ] Email/Mobile OTP verification on signup

---

## API Endpoints (Key)

### Chatbot Withdrawal (NEW)
- `GET /api/chatbot-redeem/eligibility/{uid}` - Check eligibility
- `GET /api/chatbot-redeem/calculate-fees?amount=500` - Calculate fees
- `POST /api/chatbot-redeem/request` - Create withdrawal request
- `GET /api/chatbot-redeem/status/{request_id}` - Check status
- `GET /api/chatbot-redeem/history/{uid}` - User history
- `GET /api/chatbot-redeem/admin/pending` - Admin pending list
- `POST /api/chatbot-redeem/admin/process/{request_id}` - Admin process

### Other
- `/api/health` - Health check
- `/api/bbps/*` - BBPS bill payments
- `/api/eko/dmt/*` - DMT money transfer
- `/api/kyc/*` - KYC operations

## Credentials (Test)
- Admin (Production): admin@paras.com / PIN: 153759

