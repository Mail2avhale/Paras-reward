# Paras Reward - Product Requirements Document

## Project Overview
A social rewards platform where users can earn PRC (Paras Reward Coins) through daily activities, referrals, and mining. Users can redeem PRC for gift vouchers, bill payments, and marketplace products.

## Core Features (Implemented)
- ✅ User Authentication & Registration
- ✅ Daily Mining/Rewards System
- ✅ 4-Tier Subscription Plans (Explorer, Startup, Growth, Elite)
- ✅ Referral System with Multi-level Rewards
- ✅ KYC Verification System
- ✅ Gift Voucher Redemption
- ✅ Bill Payment Requests
- ✅ Admin Dashboard with Analytics
- ✅ Request Timeline with SLA Warnings
- ✅ In-App Notification System
- ✅ Marketplace & Orders
- ✅ **Upstash Redis Caching**
- ✅ **Network Analytics Dashboard** (NEW - January 28, 2027)

## Recent Changes (January 2027)

### January 30, 2027
- **Manager Role Permissions System Implemented** ✅
  - Manager now uses Admin panel with permission-based access control
  - Admin can set which pages Manager can access via checkbox UI
  - Permissions managed in Admin > Users > Click Shield icon on Manager row
  - Default permissions: Users, Subscription Payment, KYC, Bill Payments, Gift Vouchers
  - All permissions configurable: Dashboard, Analytics, Orders, Marketplace, Finance, etc.

- **Major Code Cleanup - Manager Pages Removed** ✅
  - Deleted entire `/pages/manager/` folder (8 files, ~3,000+ lines)
  - Deleted `ManagerLayout.js` component
  - Deleted manager-specific components (MetricCard, StatusBadge)
  - Manager routes now redirect to `/admin`
  - Manager uses AdminLayout with filtered menu based on permissions
  - Simplified role structure: User, Manager, Admin (3 roles only)

- **Earlier Cleanup** (same session)
  - Deleted unused files (~1,258 lines):
    - `AIChatbot.js`, `PRCAnalytics.js`, `ManagerDashboard.js`
  - Build verified: PASS

### January 28, 2027
- **Network Analytics Feature Complete** (P0 - Improved Referral/Downline View)
  - New comprehensive Network Analytics modal on /referrals page
  - Network Health Score (0-100) with color-coded status indicators
  - Subscription Distribution visualization (Elite, Growth, Startup, Explorer)
  - Level Distribution (L1-L5) with active/inactive breakdown per level
  - Top Performers section showing highest earning referrals
  - Re-engagement Opportunities with "Remind" buttons for inactive users
  - Untapped Potential banner showing bonus opportunity from inactive users
  - New API endpoint: `GET /api/referrals/{user_id}/network-analytics`

- **Apply Referral Code Feature** (User Request)
  - Added "Referral Code आहे का?" button on /referrals page
  - Users without a referrer can now apply a referral code
  - Input field with Apply button and Marathi instructions
  - Shows confirmation when referral is already applied
  - API endpoint: `POST /api/referrals/apply` (existing)

### January 27, 2027
- **Upstash Redis Integration Complete**
  - Cloud-hosted Redis caching enabled
  - API response caching for better performance
  - Cache stats endpoint: `GET /api/cache/stats`
  - Credentials: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

- **Bug Fixes:**
  - Fixed IndexedDB error in OfflineIndicator.js
  - Added 10-second loading timeout to prevent infinite loading
  - Proper fallback data implementation for slow networks

- **Performance Optimization:**
  - All polling intervals increased from 30s to 60s
  - Affected: NotificationContext, NotificationBell, AdminDashboard, etc.

- **Fixed P0 Regression:** Admin pages were failing to load data
  - Fixed incorrect API endpoints in AdminDashboard.js

## Architecture

### Frontend (React)
- `/app/frontend/src/pages/` - Main pages
- `/app/frontend/src/components/` - Reusable components
- `/app/frontend/src/context/` - React contexts
- UI: Shadcn/UI components + Tailwind CSS

### Backend (FastAPI + MongoDB + Redis)
- `/app/backend/server.py` - Main API server
- `/app/backend/cache_manager.py` - Redis/Upstash cache manager
- Database: MongoDB + Upstash Redis (caching)

### Environment Variables (Production)
```
MONGO_URL=<your_mongodb_url>
DB_NAME=prc_rewards
UPSTASH_REDIS_REST_URL=https://safe-warthog-9980.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your_token>
```

## Pending Issues (Priority Order)

### P1 - High Priority
1. Active referral status shows "Inactive" for active mining users (verification pending)
2. User-facing search bar functionality broken
3. Apply Dark Theme to all Admin pages
4. Verify Subscription "Extend" Logic
5. KYC Document Upload on Mobile

### P2 - Medium Priority
1. Improve user subscription purchase flow

## Upcoming Tasks
- **ML Risk Scoring** - Fraud detection and user risk assessment
- **Play Store Release Architecture** - PWA or WebView wrapper (awaiting user decision)
- AdMob + Unity Ads Integration
- Shareable Achievement Cards

## API Endpoints Reference
- `GET /api/cache/stats` - Cache system statistics
- `GET /api/referrals/{user_id}/network-analytics` - Network analytics dashboard (NEW)
- `GET /api/admin/orders/all` - Get admin orders
- `GET /api/kyc/list` - Get all KYC documents
- `GET /api/admin/vip-payments` - Get subscription payments
- `GET /api/admin/gift-voucher/requests` - Get gift voucher requests

## Environment
- Frontend: React on port 3000
- Backend: FastAPI on port 8001
- Database: MongoDB + Upstash Redis
- Preview URL: https://mining-referral-fix.preview.emergentagent.com
- Production: https://parasreward.com

## Test Credentials
- Admin: `admin@paras.com` / `admin123`
- Manager: `manager@paras.com` / `manager123`
