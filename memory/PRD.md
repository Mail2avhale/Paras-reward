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
- Friendly messages for daily/monthly limit reached

### Admin BBPS Dashboard (DONE)
- Merges 3 collections: redeem_requests + bill_payment_requests + recharge_transactions
- 6 stat cards: Total, Success, Failed, Pending, Refund Pending, Total Amount
- Reason column (full text, not truncated), Fetch Status (Eko Enquiry), Refund PRC
- "Check All Pending" button — bulk Eko enquiry for all pending transactions
- EKO Wallet Refund OTP flow for failed + refund_pending transactions
- Route redirect: /admin/bbps-requests → /admin/bbps

### Eko Refund Flow + User/Admin Enhancements (DONE - April 2026)
- verify_refund_otp auto-updates recharge_transactions + bill_payment_requests + auto-refunds PRC
- admin_enquiry_status handles refund_pending as distinct status + auto-refunds PRC
- User receipt endpoint: GET /api/recharge/receipt/{id}
- User retry endpoint: POST /api/recharge/retry/{id}
- User RechargeCard: View All history, Receipt modal, Retry button

### Single Leg Tree Network Fix (DONE - April 2026)
- BUG: calculate_user_redeem_limit used BFS referral chain (get_network_size) instead of tree_position
- FIX: New get_tree_network_size() function — counts ALL users below user's tree_position
- Impact: All users' unlock % increased (e.g., SANTOSH pos=2: 71.72% → 85.02%)
- Both redeem-limit API and growth-network-stats API now use tree_position-based count

### Subscription Auto-Activation Fix (DONE - April 2026)
- BUG: Cron job expired plan → set "explorer" → did NOT call check_and_activate_upcoming()
- BUG: Dashboard load skipped upcoming check because user already "explorer"
- BUG: check_and_activate_upcoming didn't clear subscription_expired=False
- FIX 1: Cron auto_expire_subscriptions now calls check_and_activate_upcoming after expiry
- FIX 2: Dashboard safety net checks upcoming even when explorer + expired
- FIX 3: check_and_activate_upcoming clears subscription_expired=False

### PRC Subscription Payment (DONE - April 2026)
- Backend: POST /api/subscription/pay-with-prc (already existed, re-enabled)
- Backend: POST /api/subscription/activate-upcoming/{uid} (new, user-facing)
- Admin: Toggle prc_subscription_enabled via Admin Settings page
- Frontend: PRC payment tab on subscription page (shows pricing breakdown)
- Frontend: "Activate Now" button on upcoming plan card (shows when plan expired)
- Frontend: Upcoming plan card on subscription page

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
