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
- ✅ **Upstash Redis Caching** (NEW)

## Recent Changes (January 2027)

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
  - Affected: NotificationContext, NotificationBell, AdminDashboard, 
    AdminBillPayments, AdminGiftVouchers, AdminKYC, etc.

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
- **Play Store Release Architecture** - PWA or WebView wrapper
- AdMob + Unity Ads Integration
- Shareable Achievement Cards

## API Endpoints Reference
- `GET /api/cache/stats` - Cache system statistics (NEW)
- `GET /api/admin/orders/all` - Get admin orders
- `GET /api/kyc/list` - Get all KYC documents
- `GET /api/admin/vip-payments` - Get subscription payments
- `GET /api/admin/gift-voucher/requests` - Get gift voucher requests

## Environment
- Frontend: React on port 3000
- Backend: FastAPI on port 8001
- Database: MongoDB + Upstash Redis
- Preview URL: https://rewards-plus.preview.emergentagent.com
- Production: https://parasreward.com
