# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build and maintain a comprehensive digital reward platform (PRC ecosystem) with mining, subscription management, network referrals, bank redeem, bill payments (Eko BBPS), and admin controls.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB (Motor)
- **3rd Party**: OpenAI GPT-4o-mini (Chatbot via Emergent LLM Key), Razorpay (Payments), Eko (BBPS/Recharge)

## What's Been Implemented

### Core Systems (DONE)
- User auth, mining, subscriptions, network referrals, bank redeem, BBPS, admin dashboard

### Eko Refund Flow — One-Click Auto-Refund (DONE - April 2026)
**Per Eko v1 docs (https://developers.eko.in/v1/reference/refund):**
- `POST /api/recharge/refund/process/{tid}` — ONE-CLICK: Resend OTP → get `data.otp` from response → Initiate Refund automatically
- `POST /api/recharge/refund/verify-otp/{tid}` — MANUAL FALLBACK: if Eko doesn't return OTP in response (production SMS flow)
- `GET /api/recharge/pending-refunds/{user_id}` — list all refund_pending transactions
- Dashboard API `requires_refund_action` flag blocks dashboard until refunds complete
- Frontend `RefundBlockerModal.js`: "Process Refund" one-click button + manual OTP fallback
- Helpers: `_build_eko_headers`, `_eko_credentials_valid`, `_find_user_txn`, `_mark_refunded`
- Cache invalidation, PRC auto-refund, audit logging

### Subscription Payment Issue Banner Fix (DONE - April 2026)
- **BUG**: "Payment Issue Detected" banner showed for ALL paid Razorpay payments when user was on explorer, including old payments that already activated subscriptions which later expired normally
- **FIX**: Exclude payments where `claimed_at` exists OR `status_message` contains "activated"
- **NEW**: "Retry Activation" button added alongside "Contact Support" for genuine unactivated payments

### Single Leg Tree, Subscription Activation, PRC Payment (DONE - April 2026)
- See previous PRD entries for completed core fixes

## Pending Issues
- P1: Fix Missing Hook Dependencies (192 instances)
- P1: Replace Index Keys with Stable Keys
- P1: Remove localStorage Security Risks & Console logs

## Upcoming Tasks
- P1: Invoice PDF Download (InvoiceModal.js)

## Future/Backlog
- P2: WhatsApp Share Receipt button
- P2: Split oversized components
- P2: server.py monolith refactoring Phase 2
- P3: MongoDB → PostgreSQL migration
