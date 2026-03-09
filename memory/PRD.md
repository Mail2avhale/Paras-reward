# PARAS REWARD - Product Requirements Document

## Project Overview
**Name:** Paras Reward  
**URL:** www.parasreward.com  
**Type:** Reward/Loyalty Platform with PRC Mining  
**Users:** 5,359+ Active Members  

---

## Core Features

### 1. PRC Mining System
- 24-hour mining sessions
- Rate based on subscription plan (Elite: 230+ PRC/hr)
- Team boost from referrals
- Single-leg mining economy

### 2. User Subscriptions
- Explorer (Free)
- Startup
- Growth  
- Elite (Premium)

### 3. Referral System
- 3-level referral structure (L1, L2, L3)
- Team boost percentages (10%, 5%, 3%)
- Active referral tracking

### 4. Redemption System
- Bill Payments (BBPS)
- Gift Vouchers
- DMT (Money Transfer via Eko)

### 5. Admin Panel
- User management
- KPI dashboard
- Transaction monitoring

---

## Technical Architecture

### Stack
- **Frontend:** React 18 + TailwindCSS + Shadcn/UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB Atlas (M10)
- **Cache:** Upstash Redis
- **Payments:** Razorpay
- **DMT/BBPS:** Eko API

### Performance Optimizations (March 2026)
- ✅ Parallel database queries (asyncio.gather)
- ✅ Non-blocking password hashing (ThreadPoolExecutor)
- ✅ Redis caching with environment isolation
- ✅ Session validation delay (5 seconds)
- ✅ Stats API parallelization (6 queries → 1 batch)

---

## What's Been Implemented

### March 2026 Session (continued):
8. ✅ **Single Leg Mining Visibility** (March 9, 2026)
   - Backend API returns `single_leg_info` in mining status
   - Single Leg Bonus merged into base rate (hidden from UI per user request)
9. ✅ **Backend Refactoring** (March 9, 2026)
   - Mining routes extracted to `/app/backend/routes/mining.py`
   - 667 lines removed from server.py (38854 → 38187 lines)
   - Admin routes base module created at `/app/backend/routes/admin/`
10. ✅ **PRC Redeem Statement Enhancement** (March 9, 2026)
    - Added DMT transactions to statement (`dmt_transactions` collection)
    - Added Shop Orders to statement (`orders` collection)
    - Added Service Type filter dropdown (BBPS, DMT, Gift Vouchers, Bank Withdrawals, Shop Orders)
    - Backend: `/api/user/prc-statement/{uid}` endpoint updated with `category` parameter
    - Frontend: PRCStatement.js updated with new icons (Send, ShoppingBag) and colors

---

## Pending/Backlog

### P1 (High Priority):
- [ ] Production Performance Monitoring - latent risk
- [ ] DMT Account Verification step (pre-transfer)
- [ ] Production Auto-Burning scheduler fix
- [ ] Backend monolith refactoring (server.py still 38000+ lines)

### P2 (Medium Priority):
- [ ] Mining Rate Display verification on production (Elite user)
- [ ] KYC image migration (base64 → file storage)
- [ ] Razorpay auto-subscription fix
- [ ] PRC Vault migration script
- [ ] Admin Auto-DMT for non-Eko users

### P3 (Low Priority):
- [ ] Email/Mobile OTP verification
- [ ] Admin Panel "Failed to delete plan" error fix
- [ ] BBPS biller verification (AEML, JPDCL)

---

## System Keys (Production)

```
DB_NAME = "bugzappers-test_database"
MONGO_URL = mongodb+srv://... (Atlas)
REACT_APP_BACKEND_URL = "https://parasreward.com"
CACHE_ENV_PREFIX = "prod"
```

---

## Testing Credentials

- **Admin:** mail2avhale@gmail.com / PIN: 153759
- **User UID:** 92bcbe40-b08f-4096-8f66-0b99072ec0c7

---

## Known Constraints

1. Eko APIs only work on production (IP whitelist)
2. Preview uses local MongoDB (separate data)
3. First API call after deploy is slower (cold start)

---

Last Updated: March 9, 2026
