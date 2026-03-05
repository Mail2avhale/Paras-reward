# PARAS Reward Portal - Product Requirements Document

## Original Problem Statement
Build a comprehensive BBPS (Bill Payment) and DMT (Domestic Money Transfer) system for Paras Reward Portal where users can redeem their PRC (Paras Reward Coins) for real-world services like bill payments and bank transfers.

## Core Features

### 1. BBPS Module (COMPLETED ✅)
- Universal bill payment engine for Electricity, DTH, FASTag, Loan/EMI, Gas, LPG
- Robust Eko API error handling
- A-Z sorted operator lists
- Bill fetch functionality for electricity providers

### 2. DMT Module (COMPLETED ✅)
- **v1 Backend**: Complete - Customer/recipient management, money transfers
- **Frontend UI**: Complete - DMTPage.js with Transfer, Add Account, History tabs
- **Real Transfer Test**: ₹100 successfully transferred to SBI account (TID: 3545730163)

### 3. Admin Panel Features (COMPLETED ✅)

#### 3.1 DMT Admin Dashboard
- **Location**: `/admin/dmt`
- **Features**:
  - DMT Enable/Disable toggle
  - Global settings (min/max transfer, PRC rate)
  - Daily/Monthly limits configuration
  - Transaction count limits (daily/monthly)
  - DMT Transaction viewer with filters
  - Per-user custom DMT limits
  - CSV export functionality

#### 3.2 Error Monitor (UPDATED ✅)
- Eko error codes reference (18 status codes)
- DMT transaction status codes (0-5)
- `/api/monitor/eko/error-codes` endpoint

#### 3.3 Chatbot (UPDATED ✅)
- Added DMT transaction context for self-user
- Shows pending/completed/failed DMT transfers

## Testing Results (December 2025)
- **Total Tests**: 28
- **Passed**: 28 (100%)
- **Backend**: 19 pytest tests - 100% pass
- **Frontend**: 9 Playwright specs - 100% pass
- **Test Files Created**:
  - `/app/tests/e2e/dmt-flow.spec.ts`
  - `/app/backend/tests/test_dmt_flow.py`

## Technical Architecture

### Backend API Endpoints
```
# DMT APIs
POST /api/eko/dmt/customer/search    - Search customer by mobile
POST /api/eko/dmt/customer/register  - Register new customer
POST /api/eko/dmt/customer/resend-otp - Send OTP
POST /api/eko/dmt/customer/verify-otp - Verify OTP
POST /api/eko/dmt/recipient/add      - Add bank recipient
GET  /api/eko/dmt/recipients/{mobile} - Get recipients
POST /api/eko/dmt/transfer           - Execute transfer

# Admin DMT APIs
GET/POST /api/admin/dmt/settings     - DMT settings
POST     /api/admin/dmt/toggle       - Enable/disable DMT
GET      /api/admin/dmt/stats        - Statistics
GET      /api/admin/dmt/transactions - Transaction list
GET/POST /api/admin/dmt/user-limits  - Per-user limits

# Error Monitor
GET /api/monitor/eko/error-codes     - Eko error codes reference
GET /api/monitor/eko/errors          - Recent Eko errors
```

### Key Files
- `backend/routes/eko_dmt_service.py` - DMT v1 backend
- `backend/routes/eko_payments.py` - Transfer API
- `backend/routes/admin_dmt_routes.py` - Admin DMT APIs
- `frontend/src/pages/DMTPage.js` - DMT frontend

## Bank Support Status
| Bank | Status | Notes |
|------|--------|-------|
| SBI | ✅ Working | Transfer successful |
| HDFC (Savings) | ✅ Should work | Not tested |
| ICICI | ✅ Should work | Not tested |
| HDFC Business | ❌ | DMT doesn't support business accounts |
| DBS Bank | ❌ | IFSC not in Eko database |
| Slice/NESF | ❌ | IFSC not in Eko database |
| Suryoday | ❌ | IFSC not in Eko database |

## Bugs Fixed (This Session)
1. ✅ localStorage key mismatch - Changed 'user' to 'paras_user' in DMTPage.js
2. ✅ Eko API Content-Type - Fixed JSON vs form-urlencoded
3. ✅ Transfer API endpoint - Fixed v1/transactions format
4. ✅ Request hash generation - Added channel/state parameters

## Test Credentials
- **User**: mail2avhale@gmail.com / PIN: 153759
- **User UID**: 73b95483-f36b-4637-a5ee-d447300c6835
- **Eko Customer Mobile**: 9970100782
- **Verified Recipient**: SBI Account (ID: 15186062)

## Completed Work Summary
1. ✅ Full BBPS Module
2. ✅ DMT Backend APIs (v1)
3. ✅ DMT Frontend UI
4. ✅ Admin DMT Dashboard
5. ✅ Per-user limits
6. ✅ Error Monitor with Eko codes
7. ✅ Chatbot DMT updates
8. ✅ Real money transfer test (₹100 to SBI)
9. ✅ 28 automated tests (100% pass)

## Pending Tasks
### P1 - High Priority
- DMT v3 implementation (Aadhaar/eKYC flow)

### P2 - Medium Priority
- Fix "Failed to delete plan" admin error
- PRC Vault migration script

### P3 - Low Priority
- Email/Mobile OTP verification
- KYC images S3 migration
