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

### March 2026 Session:
1. ✅ Speed optimization (Login: 0.5s, APIs: <2s)
2. ✅ Session persistence fix
3. ✅ Mining page enhancements (particles, animations)
4. ✅ Haptic feedback for mobile
5. ✅ Push notifications for session end
6. ✅ Cache isolation (preview/production)
7. ✅ Stats API parallelization

---

## Pending/Backlog

### P1 (High Priority):
- [ ] BBPS biller verification (AEML, JPDCL)
- [ ] Aadhaar DMT v3 implementation
- [ ] Admin Auto-DMT for non-Eko users

### P2 (Medium Priority):
- [ ] KYC image migration (base64 → file storage)
- [ ] Razorpay auto-subscription fix
- [ ] PRC Vault migration script

### P3 (Low Priority):
- [ ] Email/Mobile OTP verification
- [ ] Backend monolith refactoring

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
