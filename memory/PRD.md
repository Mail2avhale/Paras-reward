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
- **Bank Withdrawal via Chatbot**: Hidden withdrawal system with OTP verification
- **Payment Issue Auto-Fix via Chatbot**: Auto-resolve subscription payment issues
- **Recurring Deposits**: PRC savings with interest

## Tech Stack
- **Frontend**: React.js with Shadcn/UI components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Razorpay for subscriptions, Eko for BBPS/DMT
- **Hosting**: Emergent Infrastructure

---

## What's Been Implemented

### March 7, 2026 - Server.py Refactoring Phase 1

#### Code Extraction Complete
1. **Admin Ledger System** - Extracted 900 lines to `routes/admin_ledger.py`
   - Income Ledgers (Subscription, Commission, Penalty, Interest, Ad Revenue)
   - Expense Ledgers (Redeem Payout, Operational)
   - Cash & Bank Ledgers
   - Deposit & Stockist Ledgers
   - Summary & Reconciliation (P&L, Balance Sheet)

#### Performance Metrics
- **server.py reduced**: 39,662 → 38,762 lines (900 lines removed)
- **Preview environment load time**: 1.76 seconds (excellent)
- **All APIs functional**: ✅

### December 2025 - Major Refactoring Session

#### Features Removed
1. **Marketplace** - All product, cart, order routes removed (~2,130 lines)
2. **Luxury Life** - Auto-save feature removed (~700 lines)
3. **TAP Game** - Tap-to-earn removed (~130 lines)
4. **Direct Bank Transfer UI** - Moved to chatbot

#### Bank Withdrawal via Chatbot
**User Flow:**
```
"Bank withdrawal करायचे" → KYC check → Eko OTP verification → 
Balance check → Bank details collect → Confirm → Request ID → Admin processes
```
**Fees:** ₹10 flat + 20% admin charge

#### Payment Issue Auto-Fix via Chatbot
**Problem Solved:** "Payment झाले पण subscription activate नाही"
- Razorpay API verification
- Auto subscription activation
- 30-day time limit
- Rate limiting (5 attempts/day)

---

## Prioritized Backlog

### P0 - Critical (BLOCKED)
- [ ] **Eko DMT API Testing** - Preview IP `34.170.12.145` not whitelisted in Eko portal
  - Code is correct, authentication fixed
  - User must whitelist IP to test

### P1 - High Priority
- [ ] **Production Environment Issues** - User reported API timeouts, auto-navigation bugs
  - Cannot debug without production access
  - server.py refactoring may help when deployed
- [ ] **Continue server.py Refactoring** - Extract more sections:
  - LIVE PLATFORM STATS (~804 lines)
  - PRC ECONOMY CONTROLS (~367 lines)
  - PHASE 2 ACCOUNTING (~900 lines)
- [ ] BBPS billers (AEML, JPDCL) fix

### P2 - Medium Priority
- [ ] Payment Status Check on Login safeguard
- [ ] Remove `_archive_eko_payments_legacy.py` after verifying no dependencies

### P3 - Low Priority
- [ ] Eko DMT v3 with Aadhaar/eKYC
- [ ] Email/Mobile OTP verification on signup
- [ ] KYC images migration (base64 to file storage)

---

## API Endpoints Summary

### New Routes (Extracted)
| Route File | Prefix | Description |
|------------|--------|-------------|
| `admin_ledger.py` | `/api/admin/ledger` | Complete Ledger System |

### Chatbot Features
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

---

## Testing Status
- **Latest Iteration**: server.py refactoring verified
- **Ledger APIs**: All endpoints tested ✅
- **Previous**: Iteration 110 (Chatbot Withdrawal): 46/46 passed ✅

---

## Credentials (Test)
- **Admin (Production)**: admin@paras.com / PIN: 153759
- **Test User (Preview)**: 9876543210 / PIN: 123456

---

## Architecture After Refactoring

```
/app/backend/
├── server.py (38,762 lines - still needs more extraction)
├── routes/
│   ├── admin_ledger.py (NEW - 900 lines extracted)
│   ├── chatbot_withdrawal.py
│   ├── chatbot_payment_fix.py
│   ├── eko_common.py (auth fixed)
│   ├── eko_dmt_service.py (flow corrected)
│   └── ... (other routes)
└── .env

/app/frontend/
├── .env (GENERATE_SOURCEMAP=false for optimization)
└── src/
    ├── App.js (lazy loaded AIContextualHelp)
    └── components/
        └── Chatbot/Chatbot.js (redesigned UI)
```
