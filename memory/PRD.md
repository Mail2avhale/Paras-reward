# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build and maintain a comprehensive digital reward platform (PRC ecosystem) with mining, subscription management, network referrals, bank redeem, bill payments (Eko BBPS), and admin controls.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB (Motor)
- **3rd Party**: OpenAI GPT-4o-mini (Chatbot via Emergent LLM Key), Razorpay (Payments), Eko (BBPS/Recharge)

## What's Been Implemented

### Mining Formula v2.0 - Subscription Position Based (DONE - April 18, 2026)
- **MAJOR CHANGE**: Mining network now based on subscription purchase/renewal ORDER, not user joining date
- Each subscription purchase/renewal assigns a new `subscription_position` (auto-increment)
- Network size = active subscriptions with position > user's position
- Gradual migration (Option B): existing subscribers get positions in tree_position order
- New subscribers/renewals get fresh positions automatically
- **Referrals & Redeem Limit: UNCHANGED** (still tree_position based)
- Hooked into ALL 6 activation points: Razorpay auto-sync, Captured-sync, PRC payment, Manual activate, Admin 360, Upcoming auto-activate
- Migration API: `POST /admin/migrate-subscription-positions`
- Migration script: `/app/backend/scripts/migrate_subscription_positions.py`

### Admin Bank Transfer Enhancements (DONE - April 2026)
- Admin can edit withdrawal amount for pending requests
- Redeem limit info + OVER LIMIT warning displayed
- Backend: `POST /bank-transfer/admin/edit-amount`

### Pool Wallet & Core Team System (DONE - April 2026)
- 20% mining bonus to pool, daily midnight IST distribution
- Admin management page, Dashboard widget

### Bug Fixes (April 2026)
- PRC Analytics 500 error: Replaced in-memory filtering with MongoDB aggregation
- Admin Analytics auth token: Improved interceptor + direct token storage
- Admin PRC Add from User 360: Added `add_prc`/`deduct_prc` to `/user-360/action`
- Pool Wallet cron timezone: Fixed to midnight IST (18:30 UTC)

## Upcoming Tasks
- P0: Deploy + run migration on production (`POST /admin/migrate-subscription-positions`)
- P1: Invoice PDF Download
- P1: Community Help Page (paused)

## Future/Backlog
- P2: WhatsApp Share Receipt
- P2: server.py monolith refactor
- P3: MongoDB -> PostgreSQL migration
