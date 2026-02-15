# PARAS REWARD - Production Application

## Product Overview
A production-grade reward platform serving 3000+ users with subscription management, referral system, mining features, and marketplace.

## Recent Changes (December 2025)

### Admin Subscription Management - REBUILT ✅
**Problem:** "Database temporarily unavailable" errors during subscription approval
**Solution:** Complete rebuild of `admin_vip.py` with simplified architecture

**Changes Made:**
1. Removed complex circuit breaker pattern
2. Removed retry logic with exponential backoff
3. Replaced parallel `asyncio.gather()` operations with sequential database calls
4. Simplified error handling
5. Frontend `AdminSubscriptionManagement.js` also cleaned up and simplified

**Test Results:** 100% tests passed (15/15 backend, all frontend UI verified)

### Referrals/Invite Page - VERIFIED ✅
**Status:** Working correctly
- Backend API `/api/referrals/{user_id}/levels` returns user data correctly
- Frontend displays 5 levels with user details
- Note: Admin users are redirected from /referrals by design

## Architecture

### Backend (`/app/backend/`)
- FastAPI with async operations
- MongoDB database
- In-memory caching with TTL
- JWT authentication

### Frontend (`/app/frontend/`)
- React 18
- Tailwind CSS
- Shadcn/UI components
- Sonner for toast notifications

## Key Files

### Subscription Management
- Backend: `/app/backend/routes/admin_vip.py` (REBUILT)
- Frontend: `/app/frontend/src/pages/AdminSubscriptionManagement.js` (SIMPLIFIED)

### Referrals
- Backend: `/app/backend/server.py` (lines 26200-26385)
- Frontend: `/app/frontend/src/pages/ReferralsEnhanced.js`

## API Endpoints

### Admin Subscription
- `GET /api/admin/subscription-stats` - Get plan counts
- `GET /api/admin/vip-payments?status=pending|approved|rejected` - List payments
- `POST /api/admin/vip-payment/{id}/approve` - Approve payment
- `POST /api/admin/vip-payment/{id}/reject` - Reject payment
- `PUT /api/admin/vip-payments/{id}` - Update payment
- `DELETE /api/admin/vip-payments/{id}` - Delete payment

### Referrals
- `GET /api/referrals/{user_id}/levels` - Get referral levels with users

## Test Credentials
- Admin: `admin@test.com` / PIN: `123456`

## Upcoming Tasks
- P1: UPI Payment Gateway Integration (Razorpay/PhonePe/Paytm)
- P1: "DIRECTOR 365" Subscription Plan
- P1: Advanced PRC Burning Concepts
- P2: Force PIN Change Feature

## Known Behaviors
- Admin users are redirected from `/referrals` to `/admin` (by design)
- Subscription page refresh recommended after approval operations
