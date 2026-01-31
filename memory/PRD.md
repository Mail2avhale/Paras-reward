# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build a comprehensive rewards platform (PARAS REWARD) with:
- User mining/rewards system with daily sessions
- Multi-tier subscription plans (Explorer, Startup, Growth, Elite)
- Referral system with level-based bonuses
- Admin dashboard with analytics
- Manager role with permission-based access
- Bill payments, gift vouchers, and product redemption
- Fraud prevention and security features

## Current Status: Production Ready with Minor Issues

### ✅ Core Features Implemented
1. **Authentication & User Management**
   - JWT-based authentication
   - Role-based access (User, Admin, Manager)
   - KYC verification system

2. **Mining/Rewards System**
   - 24-hour mining sessions
   - Subscription-based reward rates
   - Luxury Life auto-savings (20% deduction)
   - Real-time balance updates

3. **Subscription System**
   - Explorer (Free), Startup, Growth, Elite tiers
   - UTR validation with 12-digit uniqueness check
   - Fraud prevention (rate limiting, IP tracking)

4. **Admin Dashboard**
   - User management with pagination
   - KYC verification workflow
   - Subscription payment approvals
   - Charts and analytics (User Growth, PRC Circulation, Orders, Subscriptions)
   - System diagnostic tools

5. **Manager Role (Merged into Admin)**
   - Permission-based access control
   - Dynamic menu based on assigned permissions

---

## Recent Changes (January 2026)

### January 31, 2026
- **Bug Fix:** "Collect Rewards" balance not updating
  - Root cause: `user_data:{uid}` cache not invalidated after mining claim
  - Fix: Added cache invalidation in `/mining/claim` and `/mining/collect` endpoints

- **Production Fix:** Admin dashboard charts
  - Rewrote all chart APIs to handle multiple date formats
  - Added diagnostic and refresh endpoints
  - Increased timeouts for large datasets

### January 30, 2026
- Merged Manager role into Admin panel
- Implemented UTR validation with fraud prevention
- Added database indexes for performance
- Fixed admin settings hub tabs
- Corrected "Total Redeemed PRC" calculation
- Updated redemption minimum account age (7 days → 3 days)
- Rewrote Live Feed API for dynamic content

---

## Known Issues (Priority Order)

### 🔴 P0 - Critical
1. **Referral Data Discrepancy (Production Only)**
   - Referral counts differ between preview and production
   - Debug endpoints available: `/api/user/{id}/full-debug`

2. **Admin Dashboard Stats (Production Only)**
   - Some stats may show incorrect values
   - Use `/api/admin/system/refresh-dashboard` to clear cache

### 🟡 P1 - High Priority
1. **Search Bar Functionality** - User-facing search not working
2. **Mining Auto-Pause** - Not showing correctly in production

---

## Architecture

### Backend: FastAPI + MongoDB
- Main file: `/app/backend/server.py` (31,000+ lines)
- Database: MongoDB with Upstash Redis caching
- Authentication: JWT tokens

### Frontend: React
- UI: Shadcn/UI components + Tailwind CSS
- State: Local state + Context API
- Routing: React Router v6

### Key API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/mining/claim/{uid}` | Claim mining rewards |
| `/api/user/{uid}` | Get user data (cached 2 min) |
| `/api/admin/stats` | Admin dashboard statistics |
| `/api/admin/charts/*` | Dashboard chart data |
| `/api/admin/system/clear-cache` | Clear all caches |
| `/api/admin/system/dashboard-diagnostic` | Debug production data |

---

## Upcoming Tasks

### P0 - Next Sprint
- Verify admin dashboard fixes on production
- Debug and fix referral data discrepancy
- Fix search bar functionality

### P1 - Backlog
- App separation (user panel vs admin subdomain)
- Play Store release (PWA+TWA vs native)
- ML-based fraud risk scoring

### P2 - Future
- Full AdMob + Unity Ads integration
- Shareable achievement cards
- Backend refactoring (break up server.py)

---

## Third-Party Integrations
- **Upstash Redis**: Backend caching
- **MongoDB**: Primary database

## Test Reports
- Latest: `/app/test_reports/iteration_42.json`
