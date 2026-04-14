# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build and maintain a comprehensive digital reward platform (PRC ecosystem) with mining, subscription management, network referrals, bank redeem, bill payments (Eko BBPS), and admin controls.

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
- Service activation, operators, operator params, paybill, history
- Business rules: 500 max daily, 1500 max monthly, redeem limit check
- Race condition fix: pre-insert pending record + 10-min cooldown
- Error handling: Real Eko errors shown to user (clean prefix), only wallet balance (347) hidden

### Admin BBPS Dashboard (DONE)
- Merges 3 collections: redeem_requests + bill_payment_requests + recharge_transactions
- 6 stat cards, Reason column, Fetch Status, Refund PRC
- "Check All Pending" button — bulk Eko enquiry
- EKO Wallet Refund OTP flow for admin

### Single Leg Tree Network Fix (DONE - April 2026)
- Fixed: calculate_user_redeem_limit now uses tree_position (not BFS referral chain)

### Subscription Auto-Activation Fix (DONE - April 2026)
- Fixed: Cron + Dashboard race condition, upcoming plan activation

### PRC Subscription Payment (DONE - April 2026)
- Pay with PRC, Activate Now button, Admin toggle

### User-Facing Dashboard-Blocking OTP Refund Flow (DONE - April 2026)
**Aligned with Eko API documentation:**
- **Eko Get Refund OTP**: POST {BASE_URL}/v1/transactions/{tid}/refund/otp → stores otp_ref_id
- **Eko Initiate Refund**: POST {BASE_URL}/v2/transactions/{tid}/refund → passes otp_ref_id, user_code, otp, state=1
- Backend: async httpx (not blocking requests), helper functions (_build_eko_headers, _eko_credentials_valid, _find_user_txn)
- Backend: GET /api/recharge/pending-refunds/{uid}, POST send-otp/{tid}, POST verify-otp/{tid}
- Backend: Dashboard API returns requires_refund_action flag + pending_refund_count
- Backend: Cache invalidation on successful refund
- Admin endpoints also updated: async httpx, otp_ref_id support
- Frontend: RefundBlockerModal — full-screen non-dismissible overlay
- Frontend: Send OTP → OTP input → Verify per transaction
- Testing: 100% pass (iteration_199: 13/13, iteration_200: 17/17)

## Pending Issues
- P1: Fix Missing Hook Dependencies (192 instances)
- P1: Replace Index Keys with Stable Keys (82 instances)
- P1: Remove localStorage Security Risks & Console logs

## Upcoming Tasks
- P1: Invoice PDF Download (InvoiceModal.js)

## Future/Backlog
- P2: WhatsApp Share Receipt button
- P2: Split oversized components
- P2: server.py monolith refactoring Phase 2
- P3: MongoDB → PostgreSQL migration
