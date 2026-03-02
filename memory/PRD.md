# Paras Reward - Product Requirements Document

## Original Problem Statement
Build a unified "Redeem" system for Eko-powered payment services (Mobile Recharge, DTH, Electricity, Gas, EMI, DMT) with admin approval workflow.

## Core Requirements
1. **Unified Redeem Flow:** Single page for all payment services
2. **Admin Approval Workflow:** All requests require admin approval before Eko API call
3. **Charging Logic:** Eko charge + ₹10 flat + 20% admin charge
4. **Play Store Compliance:** Use "Redeem" instead of "Withdrawal"

## Architecture
- **Backend:** FastAPI + MongoDB Atlas
- **Frontend:** React
- **Payment Integration:** Eko BBPS API (Live)
- **Payment Gateway:** Razorpay (Live)

## What's Been Implemented

### ✅ Completed (March 2, 2026)

1. **P0 Fix - Admin Workflow Eko Integration**
   - Root cause: `os.environ.get()` not working in FastAPI async context
   - Fix: Use module-level EKO credentials from `eko_payments.py`
   - `execute_eko_recharge()` now calls `test_recharge_exact_format()` internally

2. **Verified Live Transactions:**
   - Mobile Recharge: ✅ TID 3545019914, 3545020472
   - DTH: ✅ API working (needs valid subscriber ID)
   - Electricity: ✅ API working (needs exact bill amount)
   - Gas: ✅ API working (needs exact bill amount)

3. **Deployment Preparation:**
   - Fixed .gitignore (removed *.env blocks)
   - Updated admin-frontend .env
   - Verified supervisor configuration
   - All services running healthy

## Service Status

| Service | Status | Notes |
|---------|--------|-------|
| Mobile Recharge | ✅ Live | Fully working |
| DTH | ✅ Live | Min ₹200, needs valid subscriber |
| Electricity | ✅ Live | Needs exact bill amount |
| Gas | ✅ Live | Needs exact bill amount |
| EMI | ✅ Live | Same as electricity |
| DMT | ❌ Pending | Needs separate Eko DMT API |

## Admin Credentials
- **Email:** `admin@paras.com`
- **Password:** `test123`

## API Endpoints

### Redeem APIs
- `POST /api/redeem/request` - Create redeem request
- `POST /api/redeem/admin/approve` - Approve/Reject request
- `POST /api/redeem/admin/complete` - Execute Eko payment
- `GET /api/redeem/admin/requests` - Get requests with filters

### Eko APIs
- `GET /api/eko/balance` - Check Eko wallet balance
- `GET /api/eko/bbps/operators/{type}` - Get operators list
- `POST /api/eko/test-recharge` - Test recharge endpoint

## Pending Tasks

### P1 - High Priority
- [ ] Clear ~1700 legacy pending requests
- [ ] DMT (Bank Transfer) implementation

### P2 - Medium Priority
- [ ] Full frontend end-to-end testing
- [ ] Razorpay Auto-Sync fix

### P3 - Low Priority
- [ ] Email/Mobile OTP verification
- [ ] Decommission old payment pages

## Key Files
- `backend/routes/unified_redeem_v2.py` - Main redeem workflow
- `backend/routes/eko_payments.py` - Eko API integration
- `backend/.env` - Eko credentials
- `frontend/.env` - Backend URL

## Deployment Notes
- Supervisor config: `/etc/supervisor/conf.d/supervisord.conf`
- Backend port: 8001
- Frontend port: 3000
- Database: MongoDB Atlas (DB_NAME will change in production)
