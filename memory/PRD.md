# PARAS Reward Portal - Product Requirements Document

## Original Problem Statement
Build a comprehensive BBPS (Bill Payment) and DMT (Domestic Money Transfer) system for Paras Reward Portal where users can redeem their PRC (Paras Reward Coins) for real-world services like bill payments and bank transfers.

## Core Features

### 1. BBPS Module (COMPLETED)
- Universal bill payment engine for Electricity, DTH, FASTag, Loan/EMI, Gas, LPG
- Robust Eko API error handling
- A-Z sorted operator lists
- Bill fetch functionality for electricity providers

### 2. DMT Module (IN PROGRESS)
- **v1 Backend (COMPLETED)**: Customer/recipient management, money transfers
- **v3 Backend (SCAFFOLDED)**: Aadhaar/eKYC flow - needs implementation
- **Frontend UI**: Needs completion

### 3. Admin Panel Features

#### 3.1 DMT Admin Dashboard (COMPLETED - Dec 2025)
- **Location**: `/admin/dmt`
- **Features**:
  - DMT Enable/Disable toggle
  - Global settings (min/max transfer, PRC rate)
  - Daily/Monthly limits configuration
  - Transaction count limits (daily/monthly)
  - DMT Transaction viewer with filters (date, status, search, amount)
  - Per-user custom DMT limits
  - CSV export functionality
  - Real-time statistics

#### 3.2 Error Monitor (UPDATED - Dec 2025)
- Eko error codes reference (18 status codes)
- DMT transaction status codes (0-5)
- Error interpretation and suggested actions
- Eko-specific error tracking endpoints

#### 3.3 Chatbot (UPDATED - Dec 2025)
- Added DMT transaction context for self-user
- Shows pending/completed/failed DMT transfers
- Last transfer details with status

## Technical Architecture

### Backend Routes
```
/api/admin/dmt/settings      - GET/POST DMT global settings
/api/admin/dmt/toggle        - POST enable/disable DMT
/api/admin/dmt/stats         - GET DMT statistics
/api/admin/dmt/transactions  - GET transactions with filters
/api/admin/dmt/user-limits   - GET/POST/DELETE per-user limits
/api/admin/dmt/export        - GET CSV export
/api/monitor/eko/error-codes - GET all Eko error codes
/api/monitor/eko/errors      - GET Eko-related errors
```

### Key Files
- `backend/routes/admin_dmt_routes.py` - Admin DMT APIs
- `backend/routes/error_monitor.py` - Error monitoring with Eko codes
- `frontend/src/pages/Admin/AdminDMTDashboard.js` - Admin DMT UI
- `backend/routes/eko_dmt_service.py` - DMT v1 backend
- `backend/routes/bbps_services.py` - BBPS engine

## Database Schema

### DMT Settings (settings collection)
```json
{
  "key": "dmt_settings",
  "dmt_enabled": true,
  "min_transfer": 100,
  "max_daily_limit": 5000,
  "max_monthly_limit": 50000,
  "max_daily_transactions": 10,
  "max_monthly_transactions": 100,
  "prc_rate": 100
}
```

### User Custom Limits (users collection)
```json
{
  "custom_dmt_limits": {
    "enabled": true,
    "daily_limit": 10000,
    "monthly_limit": 100000,
    "daily_transaction_limit": 20,
    "monthly_transaction_limit": 200
  }
}
```

## Completed Work (December 2025)
1. ✅ Admin DMT Dashboard with enable/disable toggle
2. ✅ DMT Transaction viewer with filters
3. ✅ Per-user daily/monthly limits
4. ✅ Transaction count limits
5. ✅ Error Monitor with Eko error codes
6. ✅ Chatbot DMT transaction updates

## Pending Tasks

### P0 - Critical
- Test Admin DMT Dashboard UI
- Verify per-user limit enforcement in transfer API

### P1 - High Priority
- Complete DMT v1 Frontend UI
- Implement DMT v3 backend (Aadhaar/eKYC)
- DMT v3 frontend

### P2 - Medium Priority
- Fix "Failed to delete plan" error
- PRC Vault migration script

### P3 - Low Priority/Backlog
- Email/Mobile OTP verification
- KYC images migration to S3
- server.py refactoring

## Test Credentials
- **Admin**: admin@paras.com / PIN: 123456
- **User**: mail2avhale@gmail.com / PIN: 153759

## Third-Party Integrations
- **Eko BBPS API v2**: Bill payments
- **Eko DMT API v1**: Money transfers (implemented)
- **Eko DMT API v3**: Advanced transfers (scaffolded)
- **Razorpay**: Subscription payments
