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
- **Database:** MongoDB Atlas
- **Cache:** Redis (Upstash)
- **3rd Party:** Eko (DMT/BBPS), Razorpay (Payments)

## Key Files
- `/app/backend/server.py` - Main API server (monolith - needs refactoring)
- `/app/backend/routes/auth.py` - Authentication
- `/app/backend/services/eko_dmt_service.py` - DMT integration
- `/app/backend/db_indexes.py` - Database index definitions
- `/app/frontend/src/App.js` - Main React app
- `/app/frontend/src/pages/DailyRewards.js` - Mining page
- `/app/frontend/src/pages/RedeemPageV2.js` - Redemption services
- `/app/frontend/src/pages/ReferralsEnhanced.js` - Referral system

## Completed Work (March 2026)

### Session - March 11, 2026
- [x] Admin login redirect fix - Roles preserved after refresh
- [x] Database performance fix - maxPoolSize 5→50
- [x] Admin API for index creation: `/api/admin/create-indexes`
- [x] Admin dashboard query optimization (single aggregation)
- [x] Referral cache fix - empty results not cached long
- [x] Service worker cache v7

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
- [ ] DMT & BBPS E2E Flow Verification (Eko docs compliance)
- [ ] Admin login redirect - needs user verification

### P1 - High Priority
- [ ] Production Auto-Burn scheduler (apscheduler not triggering)
- [ ] PRC Burn History logging fix (code ready, needs deploy)
- [ ] Backend refactoring (server.py monolith - 38000+ lines)
- [ ] Referrals "Your Network" card verification

### P2 - Medium Priority
- [ ] Frontend refactoring (RedeemPageV2.js)
- [ ] KYC/Receipt images migration to file storage

### Future/Backlog
- [ ] PRC Vault to Balance Migration Script
- [ ] Email/Mobile OTP verification on signup
- [ ] Admin Panel "Failed to delete plan" investigation
- [ ] Razorpay auto-subscription failures

## Test Credentials
- **Admin:** admin@paras.com / PIN: 153759
- **Admin 2:** mail2avhale@gmail.com / PIN: 153759
- **Test User:** testuser@test.com / PIN: 942133

## Key Admin Endpoints
- `/api/admin/create-indexes` - Trigger database index creation
- `/api/admin/index-status` - Check index status
- `/api/health` - App health check

## Known Issues
1. apscheduler doesn't trigger automatically in production
2. Eko APIs not whitelisted for preview environment
3. First request after cold start is slow (connection warmup)

## Performance Notes
- Login with warm connection: ~0.5s
- Login with cold start: ~27-55s (connection pool warmup)
- API responses (warm): 0.18s - 0.58s
