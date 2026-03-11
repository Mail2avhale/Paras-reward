# Paras Reward - Product Requirements Document

## Original Problem Statement
Build and maintain a stable, production-ready rewards/loyalty application (www.parasreward.com) with:
- PRC (Paras Reward Coin) mining and redemption system
- DMT (Domestic Money Transfer) via Eko APIs
- BBPS (Bharat Bill Payment System) services
- User subscription tiers (Explorer, Startup, Growth, Elite)
- Admin dashboard for management

## Core Requirements
1. **Stability (P0):** App must not freeze, show white screens, or become unresponsive
2. **DMT/BBPS (P0):** 100% Eko API compliance for money transfers and bill payments
3. **Mining (P1):** Session persistence across page refreshes
4. **Performance (P1):** Optimize for mobile users

## Architecture
- **Frontend:** React with Shadcn/UI components
- **Backend:** FastAPI (Python)
- **Database:** MongoDB Atlas (maxPoolSize=50)
- **Cache:** Redis (Upstash)
- **3rd Party:** Eko (DMT/BBPS), Razorpay (Payments)

## Key Files
- `/app/backend/server.py` - Main API server (38000+ lines - needs refactoring)
- `/app/backend/routes/auth.py` - Authentication
- `/app/backend/routes/bbps_services.py` - BBPS integration
- `/app/backend/services/eko_dmt_service.py` - DMT integration
- `/app/backend/db_indexes.py` - Database index definitions
- `/app/frontend/src/App.js` - Main React app with timeout protection
- `/app/frontend/src/pages/RedeemPageV2.js` - Redemption services (2670 lines)
- `/app/frontend/src/pages/ReferralsEnhanced.js` - Referral system

## Completed Work (March 11, 2026)

### This Session - All Fixes
1. [x] Admin login redirect fix - Roles preserved after refresh
2. [x] Database performance fix - maxPoolSize 5→50
3. [x] Admin API for index creation: `/api/admin/create-indexes`
4. [x] Admin dashboard query optimization (single aggregation)
5. [x] Referral cache fix - empty results not cached long
6. [x] **PRC Balance loading fix** - Wrong API endpoint `/auth/user/` → `/user/`
7. [x] **Electricity duplicate dropdown fix** - Removed from generic form
8. [x] **App stuck timeout protection** - 15sec API timeout, 20sec loading fallback
9. [x] **Database keep-alive ping** - Every 2 minutes to prevent cold start
10. [x] Service worker v8

### Previous Sessions
- [x] Referral page timeout fix (N+1 query)
- [x] Admin dashboard "Data 0" bug (cache busting)
- [x] Mobile "App Stuck" bug (service worker force update)
- [x] Mining page performance optimization
- [x] Mining session persistence bug
- [x] PRC collect white screen fix
- [x] Redeem page UI redesign (glass-morphism)

## Pending/In-Progress

### P0 - Critical
- [ ] Admin login redirect - needs user verification on production
- [ ] DMT & BBPS E2E Flow Verification (Eko 403 error - IP whitelist issue)

### P1 - High Priority
- [ ] Production Auto-Burn scheduler (apscheduler not triggering)
- [ ] PRC Burn History logging fix (code ready, needs deploy)
- [ ] Backend refactoring (server.py monolith - 38000+ lines)
- [ ] Referrals "Your Network" card - L1+L2+L3 display verification

### P2 - Medium Priority
- [ ] Frontend refactoring (RedeemPageV2.js - 2670 lines)
- [ ] KYC/Receipt images migration to file storage

### Future/Backlog
- [ ] PRC Vault to Balance Migration Script
- [ ] Email/Mobile OTP verification on signup
- [ ] Admin Panel "Failed to delete plan" investigation
- [ ] Razorpay auto-subscription failures

## Test Credentials
- **Admin:** admin@paras.com / PIN: 153759
- **Admin 2:** mail2avhale@gmail.com / PIN: 153759
- **Test User:** 9421331342 / PIN: 942133 (SUWARNA SANTOSH AVHALE, PRC: 48342)

## Key Admin Endpoints
- `/api/admin/create-indexes` - Trigger database index creation
- `/api/admin/index-status` - Check index status
- `/api/admin/bill-payments` - View bill payment requests
- `/api/admin/chatbot-withdrawals` - View DMT withdrawal requests
- `/api/admin/scheduler/status` - Check scheduler jobs status
- `/api/health` - App health check

## Background Jobs (APScheduler)
- 🔥 PRC Burn: 11 AM & 11 PM IST
- 💰 Wallet reconciliation: 3 AM daily
- 📊 Daily system summary: 12:05 AM
- ⚡ Inactive user PRC burn: Sunday 4 AM
- 🗑️ Account hard delete: 3:30 AM daily
- 🔓 Auto lockout clear: 12 PM & 12 AM
- 🔄 Razorpay auto-sync: Every 1 minute
- 💳 Razorpay captured-sync: Every 2 minutes
- 🏦 Eko status update: Every 5 minutes
- 💓 **DB keep-alive ping: Every 2 minutes** (NEW)

## Known Issues
1. apscheduler doesn't trigger automatically in production
2. Eko BBPS bill fetch returning 403 - IP whitelist issue
3. First request after cold start is slow (mitigated by keep-alive)

## Performance Notes
- Login with warm connection: ~0.5s
- API responses (warm): 0.02s - 0.6s
- Keep-alive ping keeps connections warm

## API Endpoint Reference
- `/api/user/{uid}` - Get user data with PRC balance ✅
- `/api/auth/user/{uid}` - ❌ Does NOT exist
- `/api/user/{uid}/dashboard` - Combined dashboard data
- `/api/bbps/operators/{category}` - Get BBPS operators
- `/api/bbps/fetch` - Fetch bill details
- `/api/chatbot-redeem/eligibility/{uid}` - Check withdrawal eligibility
