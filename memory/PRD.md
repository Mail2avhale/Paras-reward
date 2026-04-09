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
  - Business rules: ₹500 max, 1/day combined, redeem limit check, subscription check
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
