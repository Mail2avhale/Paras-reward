# Paras Reward Platform - PRD

## Original Problem Statement
Production application (www.parasreward.com) was experiencing severe performance issues:
- App gets stuck after 2-3 minutes of activity
- "Failed to load data" errors
- Database connections failing intermittently
- 5,000+ live users affected

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

## COMPLETED FIXES (March 2026)

### 🎯 ROOT CAUSE FIX - Razorpay SDK Blocking Calls
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
5. **BBPS Format Fix** - Changed Content-Type to JSON for Eko API
6. **Processing Reject Button** - Added UI for rejecting chatbot withdrawals in processing status

---

## REMAINING TASKS

### P1 - Important
- [ ] Eko API IP Whitelisting (external - contact Eko support)
- [ ] Auto-Burn Scheduler testing on production
- [ ] Backend `server.py` refactoring into smaller route files

### P2 - Future
- [ ] KYC/Receipt images migration from base64 to file storage
- [ ] PRC Vault to Balance migration script
- [ ] Email/Mobile OTP verification on signup
- [ ] Admin "Failed to delete plan" error investigation
- [ ] Razorpay auto-subscription failures investigation

---

## Key API Endpoints
- `GET /api/health` - Health check
- `GET /api/health/connection-status` - DB connection diagnostics
- `GET /api/user/{uid}/dashboard` - User dashboard (optimized)
- `GET /api/mining/status/{uid}` - Mining status (cached 30s)
- `POST /api/bbps/fetch-bill` - BBPS bill fetch (JSON format)

## Test Credentials
- **Admin:** admin@paras.com / PIN: 153759
- **Test User:** 9421331342 / PIN: 942133

## Key Learnings
1. **Never use synchronous SDK calls in async functions** - Always wrap with `asyncio.to_thread()`
2. **APScheduler job misses indicate event loop blocking** - Check for sync calls
3. **MongoDB cursor leaks** - Always use `.to_list()` instead of `async for`
4. **N+1 queries** - Use batch fetching or aggregation pipelines
