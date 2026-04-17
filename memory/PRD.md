# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build and maintain a comprehensive digital reward platform (PRC ecosystem) with mining, subscription management, network referrals, bank redeem, bill payments (Eko BBPS), and admin controls.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB (Motor)
- **3rd Party**: OpenAI GPT-4o-mini (Chatbot via Emergent LLM Key), Razorpay (Payments), Eko (BBPS/Recharge)

## What's Been Implemented

### Pool Wallet & Core Team System (DONE - April 2026)
- Mining collect → 20% (admin-configurable) extra PRC to pool wallet
- Daily midnight cron → pool balance distributed equally to active Elite core team members
- Admin: Add/Remove core team, change pool rate, manual distribute, view balance/transactions
- User: Dashboard shows pool balance + team count + "Core Team" badge
- PRC Statement: "Core Team Bonus - Pool Distribution" entries
- Backend: `/app/backend/routes/pool_wallet.py` — 8 endpoints
- Frontend: Dashboard pool wallet card with indigo theme

### Subscription System Fixes (DONE - April 2026)
- "Upcoming" → "Next Renewal: Paid & Confirmed" — clear timeline UI
- Duplicate ongoing subscription fix (only most recent = ongoing)
- Invoice GST double-counting fix (base ₹999, not ₹1178.82)
- Monthly 30 → 28 days fix
- extend_subscription admin action for duplicate payment compensation
- subscription_expired flag mismatch bulk fix (49 users)
- Upcoming plan URL prefix fix (/admin/subscription/)
- PRC subscription activation: checks subscription_expired flag

### Eko Refund & Recharge (DONE - April 2026)
- One-click auto-refund flow (Resend OTP → get data.otp → Initiate Refund)
- Dashboard-blocking RefundBlockerModal
- Status 208 handling → "Service temporarily unavailable"
- PRC Statement: subscription_payments scan + empty txn_id dedup fix

### Redeem Limit Formula (UPDATED - April 2026)
- Changed from ALL users → ACTIVE ONLY (Elite + mining active) for network size in redeem limit calculation

## Upcoming Tasks
- P1: Admin Core Team Management UI page
- P1: Invoice PDF Download

## Future/Backlog
- P2: Community Help Page
- P2: WhatsApp Share Receipt
- P2: server.py monolith refactor
- P3: MongoDB → PostgreSQL migration
