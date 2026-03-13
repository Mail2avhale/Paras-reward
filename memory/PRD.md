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

### 🎯 DMT Transfer Production Fix (March 12, 2026)
**Critical bugs fixed in DMT (Domestic Money Transfer) flow:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Recipient Add failing | Wrong URL format `acc_no:` | Changed to `acc_ifsc:{account}_{ifsc_lowercase}` per V1 docs |
| Transfer route conflict | Legacy `/eko/dmt/transfer` route | Disabled duplicate route in `_archive_eko_payments_legacy.py` |
| Transfer API empty response | Using `json=` payload | Changed to `data=` for form-urlencoded (V1 API requirement) |
| Frontend undefined states | `setShowOTPVerification`, `setOtpValue` | Removed references to deleted V3 OTP flow states |

**Files Modified:**
- `/app/backend/routes/eko_dmt_service.py` - Fixed recipient URL, transfer payload
- `/app/backend/routes/_archive_eko_payments_legacy.py` - Disabled conflicting route
- `/app/frontend/src/pages/DMTPage.js` - Cleaned unused state references

**Test Status:** 
- ✅ Customer Search - Working
- ✅ Customer Registration - Working  
- ✅ Recipient Add - Working (acc_ifsc format)
- ✅ Recipients List - Working
- ✅ Transfer API - Working (returns Eko status correctly)
- ⚠️ Actual Transfer - Blocked by "Insufficient balance" (Eko retailer account needs recharge)

### 🎯 PRC Token Economy Control System (March 12, 2026)
**Implemented complete PRC economy control as per Token Economy Document:**

| Feature | Status | Details |
|---------|--------|---------|
| Base Token Value | ✅ | 10 PRC = ₹1 (adjustable 6-20) |
| Mining Structure | ✅ | 500 PRC/day + 5 PRC per downline |
| Team Boost | ✅ | L1: +10%, L2: +5%, L3: +3% |
| Daily Burn | ✅ | 1% (0.5% × 2 sessions) |
| **Whale Protection** | ✅ NEW | 2% burn for >500,000 PRC wallets |
| Redeem Limit | ✅ | 39,950 PRC + 20% per referral |
| **Dynamic Rate Engine** | ✅ NEW | 5 factors control rate |
| **Redeem Pressure Monitor** | ✅ NEW | Safe threshold: 15% |
| **Emergency Protection** | ✅ NEW | 200% spike detection |
| **Stability Index** | ✅ NEW | 0-100 health score |

**New API Endpoints:**
- `GET /api/admin/prc-economy/dashboard` - Full economy dashboard
- `GET /api/admin/prc-economy/rate` - Dynamic rate with factors
- `GET /api/admin/prc-economy/redeem-pressure` - Pressure monitoring
- `GET /api/admin/prc-economy/stability` - Stability score
- `GET /api/admin/prc-economy/emergency-check` - Emergency detection
- `GET /api/admin/prc-economy/whale-wallets` - Whale wallet list

**Files Added/Modified:**
- `/app/backend/routes/prc_economy.py` - NEW: Complete economy engine
- `/app/backend/server.py` - Whale protection in burn job + API endpoints

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

### 🎯 DMT V1 API Complete Implementation (March 12, 2026)

**V1 API Key Understanding:**
- OTP verification happens during **TRANSFER**, not during customer registration
- All registered customers (state=1, 2, 8) can transact
- **INSTANT TRANSFER** - No admin approval required (like mobile recharge)

**Complete Flow:**
```
1. Customer Search → Check if exists
2. Customer Create → PUT /v1/customers/mobile_number:{mobile}
3. Add Recipient → PUT /v1/customers/mobile_number:{mobile}/recipients
4. Transfer (First call) → POST /v1/transactions → Returns "OTP sent"
5. Enter OTP
6. Transfer (With OTP) → POST /v1/transactions + otp param → SUCCESS ✅
```

**Admin Controls:**
| API | Description |
|-----|-------------|
| `GET /admin/settings` | View current settings |
| `POST /admin/settings` | Update limit/status |
| `POST /admin/enable` | Enable DMT service |
| `POST /admin/disable` | Disable DMT service |
| `GET /admin/transactions` | All transactions with filters |
| `GET /admin/stats` | Dashboard stats |

**Features:**
- **Dynamic Daily Limit** - Admin can set ₹100 to ₹2,00,000
- **Service Toggle** - Enable/Disable DMT anytime
- **Transaction History** - Filters: status, date, mobile
- **Error Handling** - 20+ EKO error codes with Marathi messages

**Test Results:** ✅ 70/70 tests passed
- Backend: 100%
- Frontend: 100%

**Files Modified:**
- `/app/backend/routes/eko_dmt_service.py`
- `/app/frontend/src/pages/DMTPage.js`

---

### 🎯 Architectural Refactor - Phase 4 Complete (March 13, 2026)

**Service-Oriented Architecture Implementation:**

| Component | Status | Description |
|-----------|--------|-------------|
| **WalletService** | ✅ INTEGRATED | Double-entry ledger for all PRC movements |
| **TransactionService** | ✅ INTEGRATED | Transaction state machine (INITIATED→SUCCESS/FAILED) |
| **TaskQueue** | ✅ WORKING | Background worker for async tasks |

**WalletService Integration:**
- ✅ `mining.py` - PRC credits from mining
- ✅ `chatbot_withdrawal.py` - PRC debits for withdrawals + refunds
- ✅ `unified_redeem_v2.py` - ALL PRC deductions and refunds for BBPS services
- ✅ `admin_users.py` - Admin balance adjustments (credit/debit)
- ✅ `admin_misc.py` - Monthly maintenance fees

**TaskQueue Features:**
- 10-second worker interval
- Automatic retry with exponential backoff (1min, 5min, 30min)
- Built-in handlers: `send_notification`, `process_referral_bonus`, `retry_failed_transfer`
- Admin endpoints for monitoring and manual retry

**New API Endpoints:**
- `GET /api/admin/tasks/stats` - Task queue statistics
- `GET /api/admin/tasks/failed` - List failed tasks
- `POST /api/admin/tasks/retry/{task_id}` - Retry failed task
- `POST /api/admin/tasks/enqueue/test` - Test task queue

**Files Modified:**
- `/app/backend/routes/unified_redeem_v2.py` - WalletService integration for all PRC operations
- `/app/backend/routes/admin_users.py` - Admin balance adjustment with ledger
- `/app/backend/routes/admin_misc.py` - Monthly fees with ledger

---

## REMAINING TASKS

### P1 - Important (Architectural Refactor Continuation)
- [x] ~~TaskQueue integration for BBPS auto-retry logic~~ ✅ COMPLETED
- [x] ~~DMT V1 E2E Implementation~~ ✅ COMPLETED
- [ ] Backend `server.py` refactoring into smaller route files

### P2 - Future
- [ ] New DMT provider integration (after Eko V3 activation)
- [ ] MongoDB to PostgreSQL migration
- [ ] KYC/Receipt images migration from base64 to file storage
- [ ] Email/Mobile OTP verification on signup
- [ ] Admin "Failed to delete plan" error investigation
- [ ] Razorpay auto-subscription failures investigation

---

### BBPS Auto-Retry System (March 13, 2026)

**Configuration:**
- Auto-retry enabled by default (env: `BBPS_AUTO_RETRY_ENABLED`)
- Max 3 retries with exponential backoff (1min, 5min, 30min)
- Eligible services: electricity, mobile_postpaid, dth, fastag, broadband

**Features:**
- Automatic retry for transient failures (network, timeout)
- Skips retries for user input errors (invalid account, wrong format)
- Admin notification on max retries exceeded
- Manual retry option via admin panel

**New API Endpoints:**
- `GET /api/admin/tasks/retry-settings` - Get current retry configuration
- `GET /api/admin/tasks/pending-retries` - List pending retry tasks

---

## Key API Endpoints

### DMT APIs (V1 - Rebuilt)
- `GET /api/eko/dmt/health` - Health check ✅
- `GET /api/eko/dmt/wallet/{user_id}` - Get user PRC balance and limits ✅
- `POST /api/eko/dmt/customer/search` - Search customer by mobile ✅
- `POST /api/eko/dmt/customer/register` - Register new customer
- `POST /api/eko/dmt/customer/verify-otp` - Verify OTP for registration
- `POST /api/eko/dmt/customer/resend-otp` - Resend OTP to customer
- `POST /api/eko/dmt/recipient/add` - Add bank account as recipient
- `GET /api/eko/dmt/recipients/{mobile}` - Get list of saved recipients ✅
- `POST /api/eko/dmt/transfer` - Execute money transfer (with WalletService)
- `GET /api/eko/dmt/status/{transaction_id}` - Check transaction status
- `GET /api/eko/dmt/transactions/{user_id}` - Get user transaction history

### DMT Admin APIs
- `GET /api/eko/dmt/admin/settings` - Get DMT service settings
- `POST /api/eko/dmt/admin/enable` - Enable DMT service
- `POST /api/eko/dmt/admin/disable` - Disable DMT service
- `POST /api/eko/dmt/admin/set-limit` - Set daily transfer limit
- `GET /api/eko/dmt/admin/transactions` - Get all transactions with filters
- `GET /api/eko/dmt/admin/stats` - Get DMT statistics

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

### Task Queue Admin APIs (NEW)
- `GET /api/admin/tasks/stats` - Queue statistics (pending, completed, failed)
- `GET /api/admin/tasks/failed` - List of failed tasks
- `POST /api/admin/tasks/retry/{task_id}` - Retry a failed task
- `POST /api/admin/tasks/enqueue/test` - Test the queue system

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
