# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build and maintain a comprehensive digital reward platform (PRC ecosystem) with mining, subscription management, network referrals, bank redeem, bill payments, and admin controls.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB (Motor)
- **3rd Party**: OpenAI GPT-4o-mini (Chatbot via Emergent LLM Key), Razorpay (Payments), Eko (DMT/BBPS)

## What's Been Implemented

### Core Systems (DONE)
- User auth (PIN-based login), registration, KYC
- Mining system with growth economy
- Subscription plans (Elite/Explorer) with auto-expire cron
- Network referral system (13-tier)
- Bank redeem (₹1000-₹10000 limits)
- Bill payments (BBPS), DMT, Mobile recharge
- Admin dashboard with User 360° view
- PRC economy with burn system

### Recent Session Work (April 2026)
- ✅ Landing page redesigned (12-section fintech style) with official company profile content
- ✅ Global logo replacement (transparent, animated spinner)
- ✅ SEO (dynamic titles, OG tags, sitemap)
- ✅ Bank redeem limits updated (₹1000-₹10000)
- ✅ Network size BFS bug verified fixed
- ✅ pin_hash removed from API responses (security)
- ✅ Subscription auto-expire cron job (every 30 min) - downgrades expired Elite to Explorer
- ✅ Subscription expiry handles BOTH cases: expired date AND no expiry + no payment
- ✅ Login/Dashboard expiry checks with immediate downgrade
- ✅ Admin manual trigger API: POST /api/admin/run-expire-subscriptions
- ✅ Scheduler missing imports fixed (generate_daily_summary, hard_delete_expired_accounts)
- ✅ Admin profile edit URL mismatch fixed (user360 → user-360 + user_id in body)
- ✅ Admin update cache clear added
- ✅ TopBar logo: black bg + object-contain for full visibility
- ✅ Dashboard card logo: h-16 w-16 (bigger)
- ✅ Official company content: About Us, Aim, Vision, Mission, Disclaimer, T&C Summary, Final Statement

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
