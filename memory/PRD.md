# PARAS REWARD - Bill Payment Platform

## Original Problem Statement
Full-stack bill payment platform using Eko BBPS APIs for electricity, mobile, DTH, FASTag, and other utility bill payments.

## Architecture
- **Frontend:** React.js with Tailwind CSS, Shadcn UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Payment Gateway:** Razorpay (subscriptions), Eko (BBPS)

## What's Been Implemented

### Session: 2026-03-05 - Standard Error Handling & Category Fix

**Standard Error Handling Implemented (as per Eko Documentation):**

1. **HTTP Response Code Handling:**
   - 200: OK - Check status, tx_status, message
   - 403: Forbidden - Authentication failed
   - 404: Not Found - Invalid URL
   - 405: Method Not Allowed
   - 415: Unsupported Media Type
   - 500: Server Error

2. **Eko Status Code Handling (45+ codes):**
   - 0: Success
   - 347: Insufficient balance
   - 463: User not found
   - 544: Bank not available
   - 945: Limit exhausted
   - And 40+ more documented codes

3. **Transaction Status (tx_status) Handling:**
   - 0: SUCCESS - Transaction complete
   - 1: FAILED - Transaction failed
   - 2: PENDING - Awaiting response (NEFT)
   - 3: REFUND_PENDING - Refund in progress
   - 4: REFUNDED - Amount refunded
   - 5: ON_HOLD - Requires inquiry

**Files Created/Modified:**
- `/app/backend/routes/eko_error_handler.py` - NEW: Central error handling module
- `/app/backend/routes/bbps_services.py` - REWRITTEN: Standard error handling

**Category Mapping Fixed:**
```python
"mobile_prepaid": 5,     # Jio, Airtel, Vi, BSNL (was 1)
"dth": 4,
"electricity": 8,
"fastag": 22,           # (was 5)
"emi": 21,              # (was 6)
```

**Language Fix:**
- All Marathi UI text converted to English

### Key Eko API Configuration
```
EKO_BASE_URL=https://api.eko.in:25002/ekoicici
EKO_DEVELOPER_KEY=7c179a397b4710e71b2248d1f5892d19
EKO_AUTHENTICATOR_KEY=7a2529f5-3587-4add-a2df-3d0606d62460
EKO_INITIATOR_ID=9936606966
EKO_USER_CODE=20810200
```

## Standard BBPS Process Flow

### 1. Fetch Bill
```
Client → /api/bbps/fetch → Eko API
↓
HTTP 200? → Parse status
↓
status=0? → Return bill details
status!=0? → Return user-friendly error
```

### 2. Pay Bill
```
Client → /api/bbps/pay → Eko API
↓
HTTP 200? → Parse status + tx_status
↓
status=0, tx_status=0 → SUCCESS
status=0, tx_status=1 → FAILED
status=0, tx_status=2 → PENDING (check status later)
status=0, tx_status=3 → REFUND_PENDING
status=0, tx_status=4 → REFUNDED
status=0, tx_status=5 → ON_HOLD (inquiry required)
status!=0 → Error with user message
```

### 3. Check Status (for pending transactions)
```
Client → /api/bbps/status/{tid} → Eko API
↓
Returns current tx_status with description
```

## Pending/Backlog Tasks

### P1 - High Priority
- [ ] Some BBPS services may need HG Pay enrollment from Eko
- [ ] Admin Panel "Failed to delete plan" error

### P2 - Medium Priority
- [ ] Eko DMT Service integration (blocked on API specs)
- [ ] PRC Vault to PRC Balance migration script

### P3 - Low Priority
- [ ] Email/Mobile OTP verification on signup
- [ ] KYC/Receipt images file storage migration

## API Endpoints Reference

### Electricity Bill Payment Flow
```
1. GET /api/eko/bbps/operators/{category}    - List operators
2. GET /api/eko/bbps/operator-params/{id}    - Get required parameters
3. POST /api/eko/bbps/fetch-bill             - Fetch bill details
4. POST /api/eko/bbps/pay-bill               - Execute payment
```

### Admin Endpoints
```
POST /api/razorpay/admin/manual-activate-by-email  - Manual subscription activation
GET /admin/error-monitor                            - Error monitoring dashboard
```

## Test Credentials
- **User:** mail2avhale@gmail.com / PIN: 153759
- **Admin:** admin@paras.com / 123456

## Notes
- MSEDCL operator is currently down (Eko side issue)
- Fetch bill may timeout (up to 120s) - normal Eko latency
- For operators with billFetchResponse=0, fetch is not required
