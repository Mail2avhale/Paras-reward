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
- **Bank Withdrawal via Chatbot**: Hidden withdrawal system
- **Payment Issue Auto-Fix via Chatbot**: Auto-resolve subscription payment issues (NEW)
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
1. **Marketplace** - All product, cart, order routes removed (~2,130 lines)
2. **Luxury Life** - Auto-save feature removed (~700 lines)
3. **TAP Game** - Tap-to-earn removed (~130 lines)
4. **Direct Bank Transfer UI** - Moved to chatbot

#### 🆕 Bank Withdrawal via Chatbot
**User Flow:**
```
"Bank withdrawal करायचे" → KYC check → Balance check → 
Bank details collect → Confirm → Request ID → Admin processes
```
**Fees:** ₹10 flat + 20% admin charge

#### 🆕 Payment Issue Auto-Fix via Chatbot (NEW)

**Problem Solved:** "Payment झाले पण subscription activate नाही"

**User Flow:**
```
User: "Payment problem"
Bot: Collects - Amount, Date, Payment ID/UTR
Bot: Verifies with Razorpay API
Bot: Auto-activates subscription if confirmed
User: "✅ Subscription activated!"
```

**Features:**
- Razorpay API verification
- Auto subscription activation
- 30-day time limit
- Rate limiting (5 attempts/day)
- Audit logging

**API Endpoints:**
- `GET /api/chatbot-payment-fix/check-pending/{uid}` - Check pending orders
- `POST /api/chatbot-payment-fix/search-payment` - Search by amount+date+payment_id
- `POST /api/chatbot-payment-fix/resolve-payment` - Verify & activate
- `GET /api/chatbot-payment-fix/resolution-history/{uid}` - User history
- `GET /api/chatbot-payment-fix/admin/stats` - Admin statistics

**Files Created:**
- `routes/chatbot_payment_fix.py` (450+ lines)

---

## Testing Status

### Latest Tests
- **Chatbot Payment Fix**: All endpoints verified ✅
  - Rate limiting: Working (5/day)
  - Time limit: Working (30 days)
  - Razorpay verification: Configured

### Previous Iterations
- Iteration 110 (Chatbot Withdrawal): 46/46 passed ✅
- Iteration 109 (Subscription E2E): 50/51 passed ✅
- Iteration 108 (BBPS/DMT): 36/36 passed ✅

---

## Chatbot Capabilities Summary

| Feature | Status | Description |
|---------|--------|-------------|
| **Bank Withdrawal** | ✅ | Request withdrawal via chatbot |
| **Payment Issue Fix** | ✅ | Auto-resolve subscription payment issues |
| **Bill Payments Guide** | ✅ | Step-by-step guidance |
| **Diagnostic Mode** | ✅ | Real-time user data analysis |
| **Multi-language** | ✅ | English, Hindi, Marathi |

---

## Prioritized Backlog

### P0 - Critical (BLOCKED - Preview Environment Only)
- [ ] **Eko DMT API** - Authentication code FIXED ✅. Preview IP (`34.170.12.145`) not whitelisted. Production IPs (`34.44.149.98`, `34.10.166.75`) ARE whitelisted. **Test on production server to verify.**

### P1 - High Priority
- [ ] BBPS billers (AEML, JPDCL) fix - Some operators failing to fetch bills
- [ ] Continue server.py refactoring (currently ~38k lines)
- [ ] Production deploy with chatbot features

### P2 - Medium Priority
- [ ] Admin DMT processing workflow enhancement
- [ ] Payment check on login safeguard

### P3 - Low Priority
- [ ] Eko DMT v3 with Aadhaar/eKYC
- [ ] Email/Mobile OTP verification
- [ ] KYC images migration (base64 to file storage)

---

## API Endpoints Summary

### Chatbot Features (NEW)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chatbot-redeem/*` | Various | Bank withdrawal via chatbot |
| `/api/chatbot-payment-fix/*` | Various | Payment issue auto-fix |

### Core APIs
- `/api/health` - Health check
- `/api/bbps/*` - BBPS bill payments
- `/api/eko/dmt/*` - DMT money transfer
- `/api/kyc/*` - KYC operations
- `/api/razorpay/*` - Subscription payments

## Credentials (Test)
- Admin (Production): admin@paras.com / PIN: 153759


