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

## Recent Changes (January 2027)

### January 27, 2027
- **Fixed P0 Regression**: Admin pages were failing to load data
  - Fixed incorrect API endpoints in AdminDashboard.js
  - `/api/admin/orders` → `/api/admin/orders/all`
  - `/api/admin/kyc` → `/api/kyc/list`

- **Performance Optimization**: Reduced excessive API polling
  - All polling intervals increased from 30s to 60s
  - Affected components: NotificationContext, NotificationBell, AdminDashboard, 
    AdminBillPayments, AdminGiftVouchers, AdminKYC, AdminSecurityDashboard, 
    PRCRain, LiveActivityFeed, LiveTransparencyPanel

### Previous Session
- Implemented Request Timeline UI with SLA warning badges
- Integrated in-app notification system for admin actions
- Fixed deployment failure (.gitignore blocking .env files)
- Fixed CORS configuration
- Optimized N+1 query issues in backend
- Fixed bill payment rejection issue
- Fixed KYC/Subscription race conditions

## Architecture

### Frontend (React)
- `/app/frontend/src/pages/` - Main pages
- `/app/frontend/src/components/` - Reusable components
- `/app/frontend/src/context/` - React contexts
- UI: Shadcn/UI components + Tailwind CSS

### Backend (FastAPI + MongoDB)
- `/app/backend/server.py` - Main API server
- `/app/backend/models.py` - Data models
- Database: MongoDB

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
- Play Store Release Architecture
- Full Redis Integration
- ML Risk Scoring
- AdMob + Unity Ads Integration
- Shareable Achievement Cards

## API Endpoints Reference
- `/api/admin/orders/all` - Get admin orders
- `/api/kyc/list` - Get all KYC documents
- `/api/admin/vip-payments` - Get subscription payments
- `/api/admin/gift-voucher/requests` - Get gift voucher requests
- `/api/admin/subscription-stats` - Get subscription statistics

## Environment
- Frontend: React on port 3000
- Backend: FastAPI on port 8001
- Database: MongoDB (MONGO_URL from backend/.env)
- Preview URL: https://rewardflow-13.preview.emergentagent.com
- Production: https://parasreward.com
