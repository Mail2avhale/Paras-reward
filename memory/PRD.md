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
   - Real-time balance updates (FIXED: Cache invalidation on collect)

3. **Subscription System**
   - Explorer (Free), Startup, Growth, Elite tiers
   - UTR validation with 12-digit uniqueness check
   - Fraud prevention (rate limiting, IP tracking)

4. **Admin Dashboard**
   - Redesigned WITHOUT charts (cleaner, faster)
   - User management with pagination
   - KYC verification workflow
   - Subscription payment approvals
   - System diagnostic tools

5. **Manager Role (Merged into Admin)**
   - Permission-based access control
   - Dynamic menu based on assigned permissions

6. **Weekly Redemption Limits (NEW - Jan 31, 2026)**
   - VIP tier-based limits per service type
   - Monday-Sunday weekly reset cycle
   - Smart "partner issue" rejection messages
   - Cooldown timer after first redemption

---

## Recent Changes (January/February 2026)

### February 1, 2026
- **Bug Fix:** Profile Completion Ring not updating/hiding
  - Added missing fields (`mobile`, `kyc_status`, `city`, `district`, `state`) to `/api/user/{uid}/dashboard` endpoint
  - Ring and Floating Reminder now correctly hide when profile is 100% complete
  - Tested with both complete and incomplete profile scenarios

- **Bug Fix:** Subscription Start Date not showing on subscription card
  - Added `subscription_start` field to dashboard API
  - Added fallback logic: VIP payment approved_at → calculated from expiry - 30 days
  - Auto-syncs calculated start date to user document

- **Bug Fix:** Bill Payment reject not updating status
  - Backend required `reject_reason` but frontend wasn't sending it
  - Added reject reason dialog with quick-select options
  - Now both single and bulk reject require and send reason

- **Bug Fix:** Bill Payment approve not updating status properly
  - Added `approved_at` timestamp on approve
  - Added `processing_time` calculation on complete
  - Admin can now "Mark Complete" for processing requests

- **Feature:** Bill Payment Gamification
  - ⏱️ Real-time live counter (seconds updating)
  - 🚀 Request Journey Animation (सबमिट → प्रोसेसिंग → पूर्ण)
  - 🎊 Confetti celebration on completion
  - ⚡ Speed badges (Lightning Fast, Quick Service, On Time)

### January 31, 2026
- **NEW FEATURE:** VIP-Based Weekly Redemption Limits
  - Per-service limits: Mobile, DTH, Electricity, Credit Card, EMI, Gift Voucher, Shopping
  - Limits vary by subscription tier (Explorer → Elite)
  - Smart rejection messages (partner issues, not "limit reached")
  - Cooldown timer shows days until Monday reset
  - New API: `GET /api/user/{uid}/weekly-limits`

- **Bug Fix:** "Collect Rewards" balance not updating
  - Added `user_data:{uid}` cache invalidation

- **UI Change:** Removed "REDEEMED" from dashboard card (per user request)

- **Admin Dashboard Redesign:**
  - Removed all charts (User Growth, PRC Flow, Orders, Subscriptions)
  - Added clean stat cards with progress bars
  - Better visual hierarchy

### January 30, 2026
- Merged Manager role into Admin panel
- Implemented UTR validation with fraud prevention
- Added database indexes for performance
- Fixed admin settings hub tabs
- Corrected "Total Redeemed PRC" calculation
- Updated redemption minimum account age (7 days → 3 days)
- Rewrote Live Feed API for dynamic content

---

## Weekly Redemption Limits Configuration

| Service | Explorer | Startup | Growth | Elite |
|---------|----------|---------|--------|-------|
| Mobile Recharge | 1 | 2 | 3 | 5 |
| DTH Recharge | 1 | 2 | 3 | 5 |
| Electricity Bill | 1 | 1 | 2 | 3 |
| Credit Card | 1 | 1 | 2 | 3 |
| EMI Payment | 1 | 1 | 2 | 3 |
| Gift Voucher | 1 | 2 | 3 | 5 |
| Shopping | 10 | 15 | 20 | 999 (Unlimited) |

**Reset:** Every Monday 00:00 UTC
**User Messaging:** Partner/technical issues (never mentions "limit")

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
- Main file: `/app/backend/server.py` (32,000+ lines)
- Database: MongoDB with Upstash Redis caching
- Authentication: JWT tokens

### Frontend: React
- UI: Shadcn/UI components + Tailwind CSS
- State: Local state + Context API
- Routing: React Router v6

### Key API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/user/{uid}/weekly-limits` | Get weekly redemption limits per service |
| `/api/bill-payment/request` | Submit bill payment (with weekly limit check) |
| `/api/gift-voucher/request` | Request gift voucher (with weekly limit check) |
| `/api/orders/checkout` | Shopping checkout (with weekly limit check) |
| `/api/mining/claim/{uid}` | Claim mining rewards |
| `/api/admin/stats` | Admin dashboard statistics |

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
