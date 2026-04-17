# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build and maintain a comprehensive digital reward platform (PRC ecosystem) with mining, subscription management, network referrals, bank redeem, bill payments (Eko BBPS), and admin controls.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB (Motor)
- **3rd Party**: OpenAI GPT-4o-mini (Chatbot via Emergent LLM Key), Razorpay (Payments), Eko (BBPS/Recharge)

## What's Been Implemented

### Admin Bank Transfer Enhancements (DONE - April 2026)
- Admin can edit withdrawal amount for pending requests (new_amount <= original)
- User sees updated amount automatically
- Original amount preserved for audit (`original_amount` field)
- Redeem limit info displayed for each request (available, effective, total, unlock %)
- Negative redeem limit highlighted in RED with "NEGATIVE LIMIT" badge
- Redeem limit warning shown in Mark Paid/Failed modal
- Backend: `POST /bank-transfer/admin/edit-amount`, enriched `GET /admin/requests`
- Frontend: Desktop table + mobile cards + action modal updated

### Pool Wallet & Core Team System (DONE - April 2026)
- Mining collect -> 20% (admin-configurable) extra PRC to pool wallet
- Daily midnight cron -> pool balance distributed equally to active Elite core team members
- Admin: Add/Remove core team, change pool rate, manual distribute, view balance/transactions
- User: Dashboard shows pool balance + team count
- PRC Statement: "Core Team Bonus - Pool Distribution" entries
- Backend: `/app/backend/routes/pool_wallet.py` - 8 endpoints
- Frontend: Dashboard pool wallet card, Admin Core Team page (white/dark theme)

### Subscription System Fixes (DONE - April 2026)
- "Upcoming" -> "Next Renewal: Paid & Confirmed" clear timeline UI
- Duplicate ongoing subscription fix
- Invoice GST double-counting fix (base 999, not 1178.82)
- Monthly 30 -> 28 days fix
- extend_subscription admin action
- subscription_expired flag mismatch bulk fix (49 users)
- PRC subscription activation checks

### Eko Refund & Recharge (DONE - April 2026)
- One-click auto-refund flow (Resend OTP -> get data.otp -> Initiate Refund)
- Dashboard-blocking RefundBlockerModal
- Status 208 handling -> "Service temporarily unavailable"

### Redeem Limit Formula (UPDATED - April 2026)
- Changed from ALL users -> ACTIVE ONLY (Elite + mining active) for network size

## Upcoming Tasks
- P1: Invoice PDF Download
- P1: Community Help Page (paused by user)

## Future/Backlog
- P2: WhatsApp Share Receipt on Recharge History
- P2: React hook dependency warnings fix
- P2: localStorage security cleanup + console logs
- P2: Split oversized components (AdminBBPSDashboard.js, AdminBankTransfers.js)
- P2: server.py monolith refactor (Phase 2)
- P3: MongoDB -> PostgreSQL migration
