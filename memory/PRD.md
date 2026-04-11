# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build and maintain a comprehensive digital reward platform (PRC ecosystem) with mining, subscription management, network referrals, bank redeem, bill payments, and admin controls.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB (Motor)
- **3rd Party**: OpenAI GPT-4o-mini (Chatbot via Emergent LLM Key), Razorpay (Payments), Eko (BBPS/Recharge)

## What's Been Implemented

### Core Systems (DONE)
- User auth (PIN-based login), registration, KYC
- Mining system with growth economy (Single Leg Tree locked with integrity hash)
- Subscription plans (Elite/Explorer) with auto-expire cron
- Network referral system (13-tier, Single Leg Tree)
- Bank redeem (₹1000-₹10000 limits)
- Bill payments (BBPS), Mobile recharge, DTH recharge
- Admin dashboard with User 360° view
- PRC economy with burn system

### Eko Prepaid Mobile & DTH Recharge (DONE — April 2026)
- **Backend**: `/app/backend/routes/eko_recharge.py`
  - Service activation (code 53) with caching — as per Eko developer docs
  - GET /api/recharge/operators/{type} — fetches from Eko BBPS
  - GET /api/recharge/operator-params/{operator_id} — required fields + regex
  - POST /api/recharge/initiate — full recharge flow with Eko paybill
  - GET /api/recharge/history/{user_id}
  - POST /api/recharge/activate-service — admin utility
  - Eko error codes handled: 0 (success), 24/1295 (already active), 347 (insufficient), 463 (not enabled)
  - TX status: 0=success, 1=failed, 2=pending, 3-5 handled
  - Business rules: ₹500 max daily, ₹1500 max monthly (combined Utility+Mobile+DTH), redeem limit check, subscription check
  - All business errors → generic "Technical error" (never expose Eko/wallet details)
  - PRC deducted atomically, refunded on failure only
  - Records in recharge_transactions + bill_payment_requests (Admin BBPS visible)
- **Frontend**: `/app/frontend/src/components/RechargeCard.js`
  - Dashboard card (bottom) with Mobile/DTH toggle
  - Amount hard-capped at 500 (input level block)
  - Operator dropdown from Eko API
  - PRC estimate display
  - Recent 3 successful recharges shown
  - E2E tested: 20/20 backend + all frontend tests passed

### Admin BBPS Dashboard — Dual Collection Merge (DONE — April 2026)
- **Bug**: Eko recharges stored in `bill_payment_requests` were invisible in Admin BBPS dashboard (which only queried `redeem_requests`)
- **Fix**: Updated `get_bbps_requests` in `unified_redeem_v2.py` to query BOTH `redeem_requests` AND `bill_payment_requests`, merge results, deduplicate by request_id, sort by date
- Stats aggregation also covers both collections
- Status filter now case-insensitive (handles Paid/paid/PAID)
- Frontend: Added `dish_recharge` (DTH), `paid/success/retry_failed` status support, proper service name formatting

### Monthly ₹1500 Utility Limit (DONE — April 2026)
- Combined monthly limit across all Utility + Mobile + DTH recharges
- Enforced in BOTH `eko_recharge.py` (Step 3.5) and `unified_redeem_v2.py` (Step 9.2)
- Queries `recharge_transactions` (Eko) + `redeem_requests` (BBPS) to calculate monthly total
- Already completed transactions this month count towards the limit
- Daily ₹500 limit remains active alongside monthly ₹1500
- Frontend `RechargeCard.js` caps input amount to min(daily, monthly) remaining
- User message on limit: "Monthly recharge limit reached"

### Race Condition Fix + Comprehensive Eko Error Handling (DONE — April 2026)
- **Race condition fix**: Pre-insert "pending" record in `recharge_transactions` BEFORE Eko API call. Concurrent requests now see pending amounts.
- **10-minute cooldown** between recharges added.
- **tx_status corrected** per official Eko docs (developers.eko.in/docs/error-codes): 0=Success, 1=Fail, 2=Response Awaited, 3=Refund Pending, 4=Refunded, 5=On Hold
- **User-friendly error messages**: 30+ Eko error patterns mapped (plan errors, operator down, invalid number, etc.)
- **Only hidden**: Eko wallet low balance (347) → "Technical error". All other failures show meaningful message.
- **Admin Detail Fix**: `/admin/bbps-request/{id}` now searches BOTH collections.

### DTH Recharge Flow — As Per Eko Developer Docs (DONE — April 2026)
- Backend: Added `POST /recharge/fetch-bill` endpoint for operators with fetchBill=1
- Backend: Added `billfetchresponse` parameter to paybill for DTH
- Frontend: DTH tab fetches operator params (regex, param_label) on operator selection
- Frontend: Live subscriber ID validation against Eko's per-operator regex
- Frontend: FetchBill step shown when required, bill details displayed before pay
- Mobile flow: UNCHANGED

### Admin Full Transaction Visibility + Fetch Status + Refund PRC (DONE — April 2026)
- Admin BBPS Dashboard now queries ALL 3 collections: `redeem_requests` + `bill_payment_requests` + `recharge_transactions`
- **ALL statuses visible**: Success, Failed, Pending, Refunded, On Hold
- **Reason column**: Shows Eko error/failure reason for failed transactions
- **Fetch Status button**: Calls Eko Transaction Enquiry API (`GET /v1/transactions/{tid}`) — live status check, auto-updates local DB if changed
- **Refund PRC button**: Only shown for failed/pending transactions where PRC not already refunded. Refunds PRC to user and marks transaction as "refunded"
- Status filter: Added "Refunded" option
- Detail endpoint: Also searches `recharge_transactions` collection

## Pending Issues
- P1: Fix Missing Hook Dependencies (192 instances)
- P1: Replace Index Keys with Stable Keys (82 instances)
- P1: Remove localStorage Security Risks & Console logs

## Upcoming Tasks
- P1: Invoice PDF Download (InvoiceModal.js)

## Future/Backlog
- P2: Split oversized components (AdminBBPSDashboard, AdminBankTransfers, DashboardModern)
- P2: server.py monolith refactoring Phase 2
- P3: MongoDB → PostgreSQL migration
