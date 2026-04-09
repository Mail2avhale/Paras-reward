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
- PRC economy with burn system (deprecated, 0% burn)

### Recent Session Work (April 2026)
- ✅ Landing page redesigned with official legal content
- ✅ Global logo replacement
- ✅ Subscription auto-expire cron job (every 30 min)
- ✅ Admin profile edit URL mismatch fixed
- ✅ Network Size & Redeem Unlock % → Single Leg Tree
- ✅ Formula Lock System with integrity hashes
- ✅ **Eko Prepaid Mobile & DTH Recharge Integration (NEW)**
  - Backend: `/app/backend/routes/eko_recharge.py`
  - Frontend: `/app/frontend/src/components/RechargeCard.js`
  - Dashboard card with Mobile/DTH toggle
  - Max ₹500/day combined limit, 1 recharge/day
  - Operators fetched live from Eko BBPS API
  - PRC deduction on success, refund on failure
  - Records in `recharge_transactions` + `bill_payment_requests` (Admin BBPS visible)
  - PRC Statement logging via `log_transaction`
  - All business rule errors → generic "Technical error" to user
  - 100% backend test pass rate (16/16 tests)

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
