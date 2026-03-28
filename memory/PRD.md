# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 28 March 2026 (Explorer Mining + Expiry + Active Network)

## COMPLETED: Explorer Mining Sessions - 28 March 2026
- Explorer users can now START mining sessions (see timer, progress, rate)
- Collect button is DISABLED for Explorer (403 from backend, disabled in UI)
- "Upgrade to Elite" prompt shown during active session for Explorer
- Backend: mining/start allows all users, mining/collect blocks non-Elite
- 15/15 tests passed (iteration_152)

## COMPLETED: Subscription Expiry Auto-Downgrade - 28 March 2026
- check_subscription_expiry() added to mining routes
- If subscription_expiry date is past, user auto-set to explorer
- Applied to status, start, and collect endpoints
- Sets subscription_expired=True in DB

## COMPLETED: Active-Only Network Counting - 28 March 2026
- get_network_size() now only counts Elite + active mining session users
- Active = subscription_plan is Elite AND mining_active=True AND mining_session_end > now
- Applied to both mining.py and growth_economy.py
- Network traversal still visits all nodes but only counts active members

## COMPLETED: Redeem Limit UI Verification - 28 March 2026
- Verified CategoryLimitsDisplay.js shows clear Limit -> Used -> Balance layout
- Backend API returns correct data (10.88% unlocked, 5327.72 PRC limit)
- Component renders properly on Redeem, BankRedeem, and GiftVoucher pages

## COMPLETED: Mining Formula Update - 28 March 2026
- Updated mining formula to spreadsheet-based: Base 500 PRC/day + Team Bonus
- PRC_per_user = max(2.5, 5 x (21 - log2(N)) / 14)
- Network cap: Binary (0 refs=800, >=1 ref=4000)
- Speed: Explorer=Demo (can't collect), Elite Cash/Razorpay/Manual=100%, Elite PRC=70%

## COMPLETED: Dynamic Redeem Limit System - 28 March 2026
- Growth Network based dynamic limits
- Formula: Unlock% = min(Level x 10, AdminMaxCap)
- Level tiers (cumulative users): L1:2, L2:6, L3:14, etc.

## COMPLETED: Growth Economy System - 26 March 2026
- Complete economy system with mining, network, redeem calculations
- MLM-Free terminology

## Application Overview
Paras Reward is a PRC mining and redemption platform:
- Users earn PRC through mining (time-based)
- Use PRC for subscriptions, bill payments, gift vouchers
- Redeem to INR via bank transfers
- Referral system increases network for mining bonus

## TWO-PLAN SYSTEM
| Feature | EXPLORER (Free) | ELITE (Paid) |
|---------|-----------------|--------------|
| Mining Start | YES | YES |
| Mining Speed | 100% (visible) | Cash=100%, PRC=70% |
| PRC Collect | NO (disabled) | YES |
| Redeem | NO | YES |

## Mining Formula (Current - March 2026)
- Base: 500 PRC/day
- Team Bonus: N x PRC_per_user(N) — only ACTIVE users counted
- Active User = Elite + mining_active + session not expired
- PRC_per_user(N) = max(2.5, 5 x (21 - log2(N)) / 14)
- Network Cap: 0 referrals = 800, >=1 referral = 4000

## Tech Stack
- Frontend: React.js with Tailwind CSS, Shadcn/UI
- Backend: FastAPI (Python)
- Database: MongoDB (paras_reward_db)
- Payments: Razorpay, Eko (BBPS)

## Key API Endpoints
- GET /api/mining/status/{uid} - Mining status (Explorer + Elite)
- POST /api/mining/start/{uid} - Start session (Explorer + Elite)
- POST /api/mining/collect/{uid} - Collect PRC (Elite ONLY)
- GET /api/mining/rate-breakdown/{uid} - Rate calculation
- GET /api/growth/mining-speed/{uid} - Growth economy mining speed
- GET /api/growth/network-stats/{uid} - Network statistics (active only)
- GET /api/user/{uid}/redeem-limit - Dynamic redeem limit

## Known Issues
### P0 - None currently
### P1 - Pending
- Razorpay Elite Pricing Update: Rs 999 + 18% GST (User requested April 1, 2026)
### P2 - Lower Priority
- server.py refactoring (45K+ lines)
- MongoDB -> PostgreSQL migration

## Upcoming Tasks
### P1
1. Razorpay pricing update (Rs 999 + GST) - April 1, 2026

### P2
1. Refactor server.py into smaller modules
2. Manual bank transfer notifications

### Future
1. Database migration to PostgreSQL
2. Email/Mobile OTP verification

## Credentials
- Primary Test User: 9970100782 / PIN: 997010 (Elite)
- Elite User: burntest1@test.com / PIN: 246813
- Explorer Test User: uid d99f75fc-a9f6-478d-901b-dfc7b06090bb
- Admin: Admin@paras.com / PIN: 153759

## Notes for Next Agent
1. User's primary language: Marathi mixed with English
2. MLM terminology banned - use "Growth Network", "Network Members"
3. Two-step login flow: ID verify -> PIN
4. Cache invalidation required after balance changes
5. subscription_payment_type field determines mining speed multiplier
6. server.py is very large (~45K lines) - needs refactoring
7. DB_NAME is paras_reward_db (not paras_reward)
8. Explorer can START mining but CANNOT collect - this is by design
9. Network size counts ONLY active users (Elite + mining session active)
10. check_subscription_expiry() auto-downgrades expired subscriptions
