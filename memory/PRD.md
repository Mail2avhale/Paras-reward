# Paras Reward Platform - PRD

## Latest Update (March 14, 2026)
- ✅ **Aadhaar Validation UI Added** - Frontend DMTPage.js updated with Aadhaar input and OTP verification step
- ✅ **Backend Aadhaar APIs Ready** - `/api/eko/levin-dmt/sender/aadhaar/generate-otp` and `/api/eko/levin-dmt/sender/aadhaar/verify-otp`
- ⚠️ **BLOCKED by Eko** - Eko API returning "Adhar Validation Failed" (error 2138) - Service needs to be activated on Eko account

---

## Original Problem Statement
Production application (www.parasreward.com) was experiencing severe performance issues:
- App gets stuck after 2-3 minutes of activity
- "Failed to load data" errors
- Database connections failing intermittently
- 5,000+ live users affected
- **Eko BBPS integration failing** - All bill payment services not working

## Core Requirements
- **Stability (P0):** App must remain responsive under load
- **Performance (P0):** APIs must respond quickly (<1s for most endpoints)
- **Functionality:** BBPS, DMT, Mining, Referrals must work correctly

## Architecture
- **Backend:** FastAPI + Python 3.11
- **Database:** MongoDB Atlas M10
- **Frontend:** React
- **Integrations:** Razorpay, Eko (BBPS/DMT), Redis (Upstash)

---

## CURRENT BLOCKER: Eko Aadhaar Validation Service

### Problem
The Eko Levin DMT API requires Aadhaar validation before users can make transfers. The sender profile shows "Aadhar Validation Pending" (state 8 - Minimum KYC), but when we try to generate Aadhaar OTP, Eko returns:
```json
{"response_status_id":1,"response_type_id":2138,"message":"Adhar Validation Failed","status":2138}
```

### What's Been Implemented
1. **Frontend (DMTPage.js)**:
   - Added Aadhaar number input field (12-digit)
   - Added Aadhaar OTP input field
   - Added `handleGenerateAadhaarOTP()` function
   - Added `handleVerifyAadhaarOTP()` function
   - UI shows Marathi messages for user-friendliness

2. **Backend (dmt_levin_service.py)**:
   - `POST /api/eko/levin-dmt/sender/aadhaar/generate-otp` - Tries two Eko endpoints
   - `POST /api/eko/levin-dmt/sender/aadhaar/verify-otp` - Validates Aadhaar OTP

### Resolution Required
**Contact Eko Support:**
- Request: "Enable Aadhaar Validation service for DMT Levin"
- Account: `initiator_id`: 9936606966, `user_code`: 19560001
- Reference error: `response_type_id: 2138`

### Test Credentials
- **Login:** `id: 9970100782`, `pin: 153759`
- **Aadhaar Number (for testing):** `433252933775`

---

## COMPLETED FIXES

### 🚨 CRITICAL: Double Subscription Bug Fix (March 13, 2026)

**Problem:** Users paying ₹799 for monthly plan (28 days) were getting 56 days (double).

**Root Cause:** Two auto-sync functions were both activating the same payment:
1. `auto_sync_razorpay_payments()` - checks pending orders
2. `auto_sync_captured_from_razorpay()` - checks captured payments

**Fix Applied:**
- Added duplicate check in `vip_payments` collection before activation
- Both functions now verify payment wasn't already used
- Each activation creates a record in `vip_payments` for tracking

**Admin Tools Added:**
- `GET /api/admin/fix-double-subscriptions` - Preview affected users
- `POST /api/admin/fix-double-subscriptions` - Fix affected users (dry_run option)

### 🎯 DMT Error Messages Sanitized (March 13, 2026)
- Technical errors (like "Insufficient balance Last_used_OkeyKey: 6") now show user-friendly message
- Users see: "Service temporarily unavailable. Please try again later."

### 🎯 DMT Menu Link Added (March 13, 2026)
- "Money Transfer" option added to user sidebar
- Route: `/dmt`

### 🎯 Levin DMT V3 - PARTIALLY WORKING (March 14, 2026)

**Critical Fix: API Endpoints Corrected**
- Changed from `/ppi/` to `/dmt-levin/` path (PPI module not required for Levin DMT)
- Production `user_code`: `19560001` (not staging `20810200`)

**APIs Status:**
| API | Endpoint | Status |
|-----|----------|--------|
| Check Sender | `POST /api/eko/levin-dmt/sender/check` | ✅ Working |
| Register Sender | `POST /api/eko/levin-dmt/sender/register` | ✅ Working |
| Get Recipients | `GET /api/eko/levin-dmt/recipients/{mobile}` | ✅ Working |
| Generate Aadhaar OTP | `POST /api/eko/levin-dmt/sender/aadhaar/generate-otp` | ❌ Blocked by Eko |
| Verify Aadhaar OTP | `POST /api/eko/levin-dmt/sender/aadhaar/verify-otp` | ❌ Blocked by Eko |
| Send Transfer OTP | `POST /api/eko/levin-dmt/transfer/send-otp` | ⚠️ Depends on Aadhaar |
| Transfer | `POST /api/eko/levin-dmt/transfer` | ⚠️ Depends on Aadhaar |

**NEW: Admin DMT Controls (March 13, 2026)**
| Feature | API | Status |
|---------|-----|--------|
| DMT Service Toggle | `POST /api/admin/service-toggles/dmt` | ✅ Working |
| Global DMT Limits | `GET/PUT /api/admin/dmt-limits` | ✅ Working |
| User DMT Usage | `GET /api/admin/user/{id}/dmt-usage` | ✅ Working |

**Default Limits:**
- Daily: ₹25,000 per user
- Weekly: ₹1,00,000 per user  
- Monthly: ₹2,00,000 per user
- Per Transaction: ₹25,000
- Minimum Amount: ₹100

---

## REMAINING TASKS

### P0 - Critical (Blocked)
- [ ] **Eko Aadhaar Validation** - Waiting for Eko support to enable service

### P1 - Important
- [ ] **Razorpay Double Subscription Verification** - User needs to confirm if new subscriptions are working correctly
- [ ] Backend `server.py` refactoring into smaller route files

### P2 - Future
- [ ] MongoDB to PostgreSQL migration
- [ ] KYC/Receipt images migration from base64 to file storage
- [ ] Email/Mobile OTP verification on signup
- [ ] Investigate production deployment failures after frontend changes

---

## Key API Endpoints

### DMT Levin APIs (V3)
- `GET /api/eko/levin-dmt/health` - Health check ✅
- `POST /api/eko/levin-dmt/sender/check` - Check sender profile ✅
- `POST /api/eko/levin-dmt/sender/register` - Onboard sender ✅
- `POST /api/eko/levin-dmt/sender/verify-otp` - Verify registration OTP ✅
- `POST /api/eko/levin-dmt/sender/aadhaar/generate-otp` - Generate Aadhaar OTP ❌
- `POST /api/eko/levin-dmt/sender/aadhaar/verify-otp` - Verify Aadhaar OTP ❌
- `GET /api/eko/levin-dmt/recipients/{mobile}` - List recipients ✅
- `POST /api/eko/levin-dmt/recipient/add` - Add recipient ✅
- `POST /api/eko/levin-dmt/recipient/activate` - Activate recipient ✅
- `DELETE /api/eko/levin-dmt/recipient/delete` - Delete recipient ✅
- `POST /api/eko/levin-dmt/transfer/send-otp` - Send transfer OTP ⚠️
- `POST /api/eko/levin-dmt/transfer` - Execute transfer ⚠️
- `GET /api/eko/levin-dmt/transaction/{id}` - Check status ✅

### Global Redeem Limit API
- `GET /api/user/{user_id}/redeem-limit` - Get user's available redeem limit with carry-forward logic

### Other APIs
- `GET /api/health` - Health check
- `GET /api/health/connection-status` - DB connection diagnostics
- `GET /api/user/{uid}/dashboard` - User dashboard (optimized)
- `GET /api/mining/status/{uid}` - Mining status (cached 30s)

## Test Credentials
- **Admin:** admin@paras.com / PIN: 153759
- **Test User:** 9970100782 / PIN: 153759

## Eko Credentials (Production)
- **Base URL:** https://api.eko.in:25002/ekoicici
- **Developer Key:** 7c179a397b4710e71b2248d1f5892d19
- **Initiator ID:** 9936606966
- **User Code:** 19560001
- **Authenticator Key:** 7a2529f5-3587-4add-a2df-3d0606d62460

## Key Learnings
1. **Never use synchronous SDK calls in async functions** - Always wrap with `asyncio.to_thread()`
2. **APScheduler job misses indicate event loop blocking** - Check for sync calls
3. **MongoDB cursor leaks** - Always use `.to_list()` instead of `async for`
4. **N+1 queries** - Use batch fetching or aggregation pipelines
5. **Always verify API endpoints with documentation** - Eko v3 GET endpoint didn't work, v2 POST did
6. **Eko DMT V1 requires service activation** - Transfer API returns 204 if service not activated
7. **Eko Aadhaar validation requires separate service activation** - Error 2138 means service not enabled

---

## Files Modified in Current Session
- `/app/backend/routes/dmt_levin_service.py` - Updated Aadhaar OTP endpoints with multiple fallback options
- `/app/frontend/src/pages/DMTPage.js` - Added Aadhaar validation UI step with Marathi messages

## Code Architecture
```
/app
├── backend/
│   ├── routes/
│   │   ├── admin_misc.py          # Admin APIs including DMT transactions
│   │   └── dmt_levin_service.py   # Levin DMT V3 APIs + Aadhaar validation
│   └── server.py                  # Main server with redeem limit logic
└── frontend/
    └── src/
        ├── pages/
        │   ├── DMTPage.js         # DMT page with Aadhaar step
        │   └── Admin/
        │       └── DMTTransactions.js
        └── App.js
```
