# Paras Reward Platform - PRD

## Original Problem Statement
Build a comprehensive reward and loyalty platform with subscription-based membership system, PRC (Platform Reward Currency) mining, marketplace, gift voucher redemption, bill payment services, and multi-level user hierarchy.

## Core Requirements

### User Types
- **Admin**: Full platform control
- **Manager**: Regional management
- **Master Stockist**: Distribution head
- **Sub Stockist**: Sub-distributor
- **Outlet**: Point of sale
- **User/Customer**: End user

### Key Features
1. **4-Tier Subscription System** (NEW - Jan 12, 2026)
   | Plan | Multiplier | Tap Limit | Ref Weight | Can Redeem | Price |
   |------|------------|-----------|------------|------------|-------|
   | Explorer | 1.0x | 100 | 1.0x | ❌ | FREE |
   | Startup | 1.5x | 200 | 1.2x | ✅ | ₹299/mo |
   | Growth | 2.0x | 300 | 1.5x | ✅ | ₹549/mo |
   | Elite | 3.0x | 400 | 2.0x | ✅ | ₹799/mo |

2. **PRC (Platform Reward Currency)**
   - Mining system with subscription multiplier
   - NEW: Daily_Reward = Day × ((BR × User_Multiplier) + Referral_Bonus)
   - Explorer users: PRC burns after 2 days inactivity
   - Paid users: PRC never burns

3. **Marketplace**
   - Product ordering with PRC
   - Paid plans only (Startup/Growth/Elite)
   - Stock management

4. **Bill Payment Services**
   - Mobile recharge, Electricity, Credit cards
   - Paid plans only

5. **Gift Voucher Redemption**
   - Various platform vouchers
   - Paid plans only

6. **5-Level Referral System with Subscription Weights**
   - Level 1: 10% × referral_subscription_weight
   - Level 2: 5% × referral_subscription_weight
   - Level 3: 2.5% × referral_subscription_weight
   - Level 4: 1.5% × referral_subscription_weight
   - Level 5: 1% × referral_subscription_weight

7. **AI Features**
   - AI Chatbot (Multilingual: English, Hindi, Marathi)
   - AI KYC Document Verification

## What's Been Implemented

### January 12, 2026 (Latest Session)

#### Pagination Implementation ✅ (P2)
- **Orders Page** (`/orders`): Added pagination with 10 items per page
- **Marketplace Page** (`/marketplace`): Added pagination with 12 items per page, resets on filter/search change
- **GiftVoucherRedemption** (`/gift-vouchers`): Already had pagination, added data-testid
- **BillPayments** (`/bill-payments`): Already had pagination, added data-testid, fixed duplicate "Next" bug
- **ReferralEarningsHistory** (`/referral-earnings`): Already had pagination with 15 items per page
- **Testing**: 100% frontend pass rate

#### Other Fixes This Session
- ✅ Tap Game daily reset bug fixed (in `/api/user/{uid}` endpoint)
- ✅ KYC Document Upload - Camera/Gallery buttons fixed with native HTML5 inputs
- ✅ Referral Link auto-join working (`/register?ref=CODE`)
- ✅ Achievements page and menu removed (for AdMob compliance)

### January 10, 2026 (Previous Session)

#### KYC Document Upload Fix ✅ (P0 - CRITICAL BUG FIX)
- **Problem**: Camera showed black screen, Gallery button incorrectly opened camera instead of file picker
- **Root Cause**: getUserMedia-based camera implementation was unreliable on mobile devices
- **Solution**: Replaced with native HTML5 file inputs
  - Camera input: `<input type="file" accept="image/*" capture="environment">` - Opens native camera app
  - Gallery input: `<input type="file" accept="image/*">` - Opens file picker (no capture attribute)
- **Component**: `frontend/src/components/AdvancedDocumentUpload.js` (rewritten)
- **Testing**: Verified by testing agent - DOM structure confirms TWO separate file inputs with correct attributes
- **Status**: FIXED and VERIFIED

### January 10, 2026 (Previous Session)

#### App Loading Speed Optimization ✅
- **Critical CSS in HTML**: Added inline critical CSS for instant first paint with branded loader
- **Preconnect/DNS Prefetch**: Added preconnect to external asset domains for faster resource loading
- **Dashboard Skeleton**: Created DashboardSkeleton component for smooth loading experience
- **Parallel API Calls**: Optimized DashboardModern.js to use Promise.allSettled for parallel data fetching
- **Lazy Image Loading**: Added LazyImage component with native loading="lazy" and decoding="async"
- **Initial Loader**: Added branded amber spinner in HTML that shows before React loads
- **Theme Color Update**: Changed to dark theme color (#030712) matching app design
- **Cache Headers**: Updated meta tags for proper static asset caching
- **Code Splitting**: Admin, Manager, and Stockist pages split into separate webpack chunks (~30% smaller initial bundle)
- **Tutorial Removed**: Removed AppTutorialAdvanced - AI Chatbot now handles user guidance

#### Advanced AI Chatbot Features ✅
- **Quick Action Buttons**: Chatbot responses include clickable action buttons based on intent (Start Session, View VIP, etc.)
- **Proactive Tips**: AI-powered tips shown based on user's current page and status
- **Voice Input (STT)**: Users can speak questions using microphone (OpenAI Whisper)
- **Voice Output (TTS)**: Chatbot can read responses aloud (OpenAI TTS with Nova voice)
- **Voice Toggle**: Enable/disable voice features with speaker icon
- **Listen Button**: Each bot message has a "Listen" button to hear the response
- **Backend Endpoints**: `/api/ai/voice/transcribe`, `/api/ai/voice/speak`, `/api/ai/proactive-tips/{uid}`

#### Interactive Walkthrough ✅
- **6-Step Animated Tour**: Welcome → Daily Rewards → Referrals → VIP → Marketplace → Complete
- **Progress Dots**: Visual progress indicator with click-to-navigate
- **Floating Particles**: Animated background for premium feel
- **Step-specific Tips**: Pro tips for each feature
- **Action Buttons**: Direct navigation to features on completion
- **useWalkthrough Hook**: Easy integration with any page

#### AdMob Compliance Updates ✅
- **Leaderboard Removed**: Removed Leaderboard page and all navigation links for AdMob compliance
- **Button Text Change**: Changed "Submit Request" to "Redeem" on Bill Payments page

#### Referral Earnings History Page (NEW) ✅
- New page at `/referral-earnings` accessible from Referrals page
- Summary cards showing: Total Earned, This Month, This Week, Today
- Earnings breakdown by level (L1-L5) with bonus percentages
- Detailed transaction history with pagination
- Filter options: All Time, Today, This Week, This Month
- "Invite Friends" CTA when no earnings exist

#### Referrals Page Enhancement ✅
- Added "View Earnings History" button to navigate to new earnings page
- All referral data verification confirmed working

### January 9, 2026 (Previous Session)

#### AI Chatbot - Google AdMob Compliant ✅
- Multilingual support (English, Hindi, Marathi)
- Auto-detects user's language and responds accordingly
- Financial disclaimer in all languages
- Complete platform information:
  - How to earn PRC (Daily check-in, Sessions, Referrals, Tap Game, PRC Rain Drop)
  - How to claim/redeem rewards
  - Uses of PRC (Gift vouchers, Bill payments, Shopping, VIP upgrade)
  - VIP membership benefits
  - Life impact and user benefits
  - PRC Rain Drop feature explanation

#### Referral Page Redesign ✅
- Live Referral Bonus Speed section showing PRC/hr per level
- Level-wise active/inactive user display with session status
- All text converted to English
- Session status indicators (● Session Active / ○ No Session)
- Referral bonus only for active users with running sessions

#### Credit Card Design ✅
- PARAS REWARD logo on top-left
- ACTIVE indicator with green blinking dot
- Artistic line-art SVG background (coins, trophy, stars, gift, wallet)
- Removed EMV chip as requested

#### VIP Payment Flow ✅
- Admin can set payment details (UPI, Bank, QR code)
- User sees payment details on VIP page
- Payment submission creates request for admin verification
- VIP Payment History section added to VIP page

#### Bug Fixes ✅
- Bill payment input fields - text now visible (white text on dark bg)
- Free user redirect to dashboard for VIP-only pages (Bill, Gift, Shopping)
- Gift voucher endpoint fixed (/redeem → /request)
- Admin mining settings save/load functionality verified
- Referral bonus logic updated - only for users with active sessions

### Previously Implemented Features
- Dashboard with 3D credit card design
- Sliding action carousel
- Global activity feed
- Birthday greetings
- Profile fields (Birthday, Address, Tahsil, District, State, PIN)
- Admin VIP Payment Settings with QR upload
- Homepage live stats API
- 5-level referral network display
- PRC Rain Drop game
- Tap Game
- KYC verification with AI

## Deployment Status

### Health Check Results ✅
- ✅ Environment files configured
- ✅ Backend running (FastAPI on port 8001)
- ✅ Frontend running (React on port 3000)
- ✅ MongoDB running
- ✅ All critical API endpoints working
- ✅ AI Chatbot functional
- ✅ No hardcoded URLs in frontend
- ✅ LLM Key configured
- ✅ CORS configured

### Ready for Deployment ✅

## Pending/Future Tasks

### P1 (High Priority)
- AdMob + Unity Ads Integration
- AI Smart Financial Advisor
- Automated Monthly Reports

### P2 (Medium Priority)
- AI Product Recommendations
- PWA functionality
- ~~Referral earnings history page~~ ✅ COMPLETED
- ~~App Loading Speed Optimization~~ ✅ COMPLETED
- Pagination on history pages (GiftVoucherRedemption.js, BillPayments.js)
- ~~KYC Document Upload Fix (camera/gallery issue)~~ ✅ FIXED (Jan 10, 2026)

### P3 (Low Priority)
- Hierarchical Reporting Structure
- Advanced analytics dashboard

## Tech Stack
- **Frontend**: React, TailwindCSS, Framer Motion, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI**: Emergent LLM Key (GPT, Gemini)
- **Deployment**: Kubernetes on Emergent Platform

## Key API Endpoints
- `/api/auth/login` - User authentication
- `/api/vip/payment-config` - VIP payment settings
- `/api/vip/payment/submit` - Submit VIP payment
- `/api/ai/chatbot` - AI chatbot
- `/api/mining/status/{uid}` - Mining status with referral breakdown
- `/api/referrals/{user_id}/levels` - Referral network
- `/api/referral-earnings/{user_id}` - Detailed referral earnings history (NEW)
- `/api/global/live-activity` - Global activity feed
- `/api/public/live-stats` - Platform statistics

## Admin Credentials
- Email: admin@paras.com
- Password: admin123
