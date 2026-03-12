# Paras Reward Platform - PRD

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

## COMPLETED FIXES

### 🎯 New BBPS Categories Added (March 12, 2026)
**Added 6 new service categories to Redeem page:**

| Category | Cat ID | Operators | Examples |
|----------|--------|-----------|----------|
| OTT/Subscription | 13 | 17 | Amazon Prime, JioHotstar, Hungama |
| Hospital | 19 | 6 | Narayana Health, Billroth |
| Transport/Challan | 27 | 5 | Delhi Traffic, AP Traffic |
| Loan Repayment | 25 | 283 | Agent/Customer repayments |
| Municipal Corp Metro | 6 | 2 | KDMC, AMC |

**Files Modified:**
- `/app/backend/routes/bbps_services.py` - Complete category mapping
- `/app/frontend/src/pages/RedeemPageV2.js` - UI categories added

### 🎯 Bill Payment History Feature (March 11, 2026)
**New Feature:** Added Bill Payment History page with "Pay Again" functionality.

**Features:**
- View all past bill payments (Electricity, Gas, Water, EMI, DTH, etc.)
- Filter by status (All, Completed, Pending, Processing, Failed)
- "Pay Again" button for completed payments - pre-fills form with previous details
- Transaction reference display for successful payments
- Pagination support for large history

**Files Added:**
- `/app/frontend/src/pages/BillPaymentHistory.js` - New component
- Route: `/bill-history`

**UI Enhancements:**
- Added "Bill History" button on Redeem page header
- Service-specific icons and colors for each payment type

### 🎯 BBPS Integration Fix (March 11, 2026)
**Problem:** All BBPS services (Electricity, Water, Gas, EMI, DTH, etc.) were failing with HTTP 500 errors.

**Root Cause:** 
- Bill fetch API was using `GET /v3/customer/payment/bbps/bill` endpoint
- Eko's actual working endpoint is `POST /v2/billpayments/fetchbill`
- Gas category was incorrectly mapped to 14 (Education) instead of 2 (PNG)

**Fix Applied:**
1. Changed fetch_bill to use `POST /v2/billpayments/fetchbill` endpoint
2. Fixed gas category mapping from 14 to 2
3. Fixed LPG category from 23 to 18

**Files Modified:** `/app/backend/routes/bbps_services.py`

**Test Results:**
- ✅ Electricity: 89 operators working
- ✅ Gas (PNG): 29 operators working  
- ✅ Water: 54 operators working
- ✅ EMI/Loan: 294 operators working
- ✅ DTH: 5 operators working
- ✅ LPG: 3 operators working
- ✅ Credit Card: 29 operators working
- ✅ Bill Fetch: Successfully returns bill details

### 🎯 ROOT CAUSE FIX - Razorpay SDK Blocking Calls (Earlier)
**Problem:** Razorpay Python SDK uses synchronous `requests` library. When called from async functions, it blocked the entire event loop.

**Impact:**
- APScheduler jobs ran every 1-2 minutes making Razorpay API calls
- Each call blocked for 100-500ms
- 200 orders × 2 calls = 20-200 seconds of blocking per job
- User requests couldn't be processed → App stuck!

**Fix:** Wrapped all Razorpay SDK calls with `asyncio.to_thread()`:
```python
# Before (BLOCKING):
razorpay_client.order.fetch(order_id)

# After (NON-BLOCKING):
await asyncio.to_thread(razorpay_client.order.fetch, order_id)
```

**Files Modified:** `/app/backend/server.py` (lines 1650, 1657, 1797, 8521, 8528, 8658, 8692, 8791, 8968, 9170, 9182)

### Other Fixes Applied:
1. **DateTime Crash Fix** - `get_timestamp()` function handles all datetime formats with UTC timezone
2. **Referral Tree Optimization** - Replaced recursive N+1 queries with `$graphLookup` aggregation
3. **Unbounded Query Limits** - All `to_list(None)` → `to_list(1000)`
4. **N+1 Pattern Fixes** - Batch fetching for users in multiple endpoints
5. **Processing Reject Button** - Added UI for rejecting chatbot withdrawals in processing status

---

## REMAINING TASKS

### P1 - Important
- [ ] Eko API IP Whitelisting (external - contact Eko support if needed)
- [ ] Auto-Burn Scheduler testing on production (verify after deploy)
- [ ] Backend `server.py` refactoring into smaller route files

### P2 - Future
- [ ] KYC/Receipt images migration from base64 to file storage
- [ ] PRC Vault to Balance migration script
- [ ] Email/Mobile OTP verification on signup
- [ ] Admin "Failed to delete plan" error investigation
- [ ] Razorpay auto-subscription failures investigation

---

## Key API Endpoints

### BBPS APIs (FIXED)
- `GET /api/bbps/operators/{category}` - Get operators for service category
- `GET /api/bbps/operator-params/{operator_id}` - Get required params for operator
- `POST /api/bbps/fetch` - Fetch bill details (uses POST v2 endpoint)
- `POST /api/bbps/pay` - Pay bill

### Other APIs
- `GET /api/health` - Health check
- `GET /api/health/connection-status` - DB connection diagnostics
- `GET /api/user/{uid}/dashboard` - User dashboard (optimized)
- `GET /api/mining/status/{uid}` - Mining status (cached 30s)

## Test Credentials
- **Admin:** admin@paras.com / PIN: 153759
- **Test User:** 9421331342 / PIN: 942133

## Eko Credentials (Production)
- **Base URL:** https://api.eko.in:25002/ekoicici
- **Developer Key:** 7c179a397b4710e71b2248d1f5892d19
- **Initiator ID:** 9936606966
- **Authenticator Key:** 7a2529f5-3587-4add-a2df-3d0606d62460

## Key Learnings
1. **Never use synchronous SDK calls in async functions** - Always wrap with `asyncio.to_thread()`
2. **APScheduler job misses indicate event loop blocking** - Check for sync calls
3. **MongoDB cursor leaks** - Always use `.to_list()` instead of `async for`
4. **N+1 queries** - Use batch fetching or aggregation pipelines
5. **Always verify API endpoints with documentation** - Eko v3 GET endpoint didn't work, v2 POST did
