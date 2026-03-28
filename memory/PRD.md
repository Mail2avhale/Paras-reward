# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 28 March 2026 (Mining Formula P0 Fix Complete)

## COMPLETED: Mining Formula Update - 28 March 2026
- Updated mining formula to spreadsheet-based: Base 500 PRC/day + Team Bonus
- PRC_per_user = max(2.5, 5 x (21 - log2(N)) / 14)
- Network cap: Binary (0 refs=800, >=1 ref=4000)
- Speed: Explorer=Demo (can't collect), Elite Cash/Razorpay/Manual=100%, Elite PRC=70%
- subscription_payment_type field added to user document for speed tracking
- All 16 backend tests passed (iteration_151), Frontend verified

## COMPLETED: Mining Collect P0 Bug Fix - 28 March 2026
- Fixed frontend using deprecated /api/mining/claim -> correct /api/mining/collect
- Verified with 14 automated tests (iteration_149)
- Translation key 'processing' added to LanguageContext.js

## COMPLETED: Auto-Start Session After Collect - 28 March 2026
- Backend /api/mining/collect now auto-starts a new session after collecting PRC
- Returns auto_started: true, new_session_start, new_session_end
- Frontend handles auto-start: keeps mining UI active with fresh 24h timer

## COMPLETED: Login Two-Step Flow Fix - 28 March 2026
- Step 1 (ID only) -> Click Sign In -> DB verify -> Step 2 (PIN input)
- Non-existent users get "Account Not Found" error
- "Change" button on Step 2 to go back
- File: /app/frontend/src/pages/LoginNew.js

## COMPLETED: Dynamic Redeem Limit System - 28 March 2026
- Growth Network based dynamic limits
- Formula: Unlock% = min(Level x 10, AdminMaxCap)
- Level tiers (cumulative users): L1:2, L2:6, L3:14, L4:30, L5:62, L6:126, L7:254, L8:454, L9:654, L10:800
- Admin max cap default 70%, configurable
- 17 backend tests passed (iteration_150)

## COMPLETED: Growth Economy System - 26 March 2026
- Complete economy system with mining, network, redeem calculations
- MLM-Free terminology
- Testing: 100% passed (27/27 tests)

## Application Overview
Paras Reward is a PRC mining and redemption platform:
- Users earn PRC through mining (time-based)
- Use PRC for subscriptions, bill payments, gift vouchers
- Redeem to INR via bank transfers
- Referral system increases network for mining bonus

## TWO-PLAN SYSTEM
| Feature | EXPLORER (Free) | ELITE (Paid) |
|---------|-----------------|--------------|
| Mining Speed | Shows (Demo) | Full Speed |
| PRC Collect | NO | YES |
| Redeem | NO | YES |
| Speed Multiplier | 100% (demo only) | Cash=100%, PRC=70% |

## Mining Formula (Current - March 2026)
- Base: 500 PRC/day
- Team Bonus: N x PRC_per_user(N)
- PRC_per_user(N) = max(2.5, 5 x (21 - log2(N)) / 14)
- Network Cap: 0 referrals = 800, >=1 referral = 4000
- Elite Cash/Razorpay/Manual = 100% speed
- Elite PRC payment = 70% speed
- Explorer = Demo (shows speed, can't collect)

## Tech Stack
- Frontend: React.js with Tailwind CSS, Shadcn/UI
- Backend: FastAPI (Python)
- Database: MongoDB
- Payments: Razorpay, Eko (BBPS)

## Key API Endpoints
- GET /api/mining/status/{uid} - Mining status with session info
- GET /api/mining/rate-breakdown/{uid} - Detailed rate calculation
- POST /api/mining/start/{uid} - Start mining session
- POST /api/mining/collect/{uid} - Collect PRC, auto-start new session
- GET /api/growth/mining-speed/{uid} - Growth economy mining speed
- GET /api/growth/network-stats/{uid} - Network statistics
- GET /api/user/{uid}/redeem-limit - Dynamic redeem limit

## Known Issues
### P0 - None currently
### P1 - Pending
- Razorpay Elite Pricing Update: ₹999 + 18% GST (User requested April 1, 2026)
- User Rakhi Ghehlod Refund: 14,260 PRC (PRODUCTION ONLY)
### P2 - Lower Priority
- server.py refactoring (45K+ lines)
- MongoDB -> PostgreSQL migration

## Upcoming Tasks
### P1
1. Razorpay pricing update (₹999 + GST) - April 1, 2026
2. Run migration script on production

### P2
1. Refactor server.py into smaller modules
2. Manual bank transfer notifications

### Future
1. Database migration to PostgreSQL
2. Email/Mobile OTP verification

## Credentials
- Elite User: burntest1@test.com / PIN: 246813
- Admin: Admin@paras.com / PIN: 153759
- Test User: 9970100782 (no PIN)

## Notes for Next Agent
1. User's primary language: Marathi mixed with English
2. MLM terminology banned - use "Growth Network", "Network Members"
3. Two-step login flow: ID verify -> PIN
4. Cache invalidation required after balance changes (user_data:{uid}, user:dashboard:{uid})
5. subscription_payment_type field determines mining speed multiplier
6. server.py is very large (~45K lines) - needs refactoring
