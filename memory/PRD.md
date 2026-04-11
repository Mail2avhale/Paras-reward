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
- Bank redeem (1000-10000 limits)
- Bill payments (BBPS), Mobile recharge, DTH recharge
- Admin dashboard with User 360 view
- PRC economy with burn system

### Eko Prepaid Mobile & DTH Recharge (DONE)
- Backend: `/app/backend/routes/eko_recharge.py`
- Service activation, operators, operator params, paybill, history
- Business rules: 500 max daily, 1500 max monthly, redeem limit check, subscription check
- Error mapping per Eko docs, PRC atomic deduction + refund on failure
- Race condition fix: pre-insert pending record + 10-min cooldown

### Admin BBPS Dashboard (DONE)
- Queries 3 collections: `redeem_requests` + `bill_payment_requests` + `recharge_transactions`
- All statuses visible: Success, Failed, Pending, Refunded, Refund Pending, On Hold
- Reason column, Fetch Status (Eko Enquiry API), Refund PRC button
- Eko Reconciliation Tool (Excel upload)
- EKO Wallet Balance banner

### Eko Refund Flow + User/Admin Enhancements (DONE - April 2026)
- **Backend Fixes:**
  - Fixed `bbps_services.py` collection name bug (`recharge_requests` -> `recharge_transactions`)
  - `verify_refund_otp` now updates `recharge_transactions` + `bill_payment_requests` after successful Eko wallet refund
  - `verify_refund_otp` auto-refunds PRC to user if not already refunded after successful Eko OTP refund
  - `admin_enquiry_status` now handles `refund_pending` as distinct status (separate from `refunded`)
  - `admin_enquiry_status` auto-refunds PRC when status changes from pending -> failed/refund_pending/refunded
  - New endpoint: `GET /api/recharge/receipt/{request_id}` - user-facing transaction receipt
  - New endpoint: `POST /api/recharge/retry/{request_id}` - retry failed recharge (returns original params)
- **Admin Dashboard Enhancements:**
  - New "Refund Pending" stat card (clickable filter)
  - "Pending" card now clickable (Response Awaited dashboard shortcut)
  - 6 stat cards total: Total, Success, Failed, Pending, Refund Pending, Total Amount
  - Status filter dropdown includes "Refund Pending" option
  - OTP Refund section shows for both `failed` and `refund_pending` transactions
  - Check EKO Wallet Refund shows for both `failed` and `refund_pending`
- **User Enhancements (RechargeCard.js):**
  - "View All" history toggle showing all transactions (not just successful)
  - Each transaction shows status icon, date, amount
  - Receipt modal with full transaction details + "Copy Receipt" button
  - Retry button for failed/refunded/refund_pending transactions (pre-fills recharge form)
  - Status indicators: Success, Processing, Failed, Refunded, Refund Pending

## Pending Issues
- P1: Fix Missing Hook Dependencies (192 instances)
- P1: Replace Index Keys with Stable Keys (82 instances)
- P1: Remove localStorage Security Risks & Console logs

## Upcoming Tasks
- P1: Invoice PDF Download (InvoiceModal.js)

## Future/Backlog
- P2: Split oversized components (AdminBBPSDashboard, AdminBankTransfers, DashboardModern)
- P2: server.py monolith refactoring Phase 2
- P3: MongoDB -> PostgreSQL migration
