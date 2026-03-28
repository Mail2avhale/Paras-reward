# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 28 March 2026 (Bank Redeem 28-Day Cycle Rules)

## COMPLETED: Bank Redeem 28-Day Cycle Rules - 28 March 2026
- 1 redeem per 28-day subscription cycle (replaced 7-day cooldown)
- Subscription active check: explorer/free users blocked (403)
- Subscription expiry check: expired users blocked (403)
- Cycle calculation from subscription_start date (28-day periods)
- Admin sees green/red subscription active indicator for each bank request
- BankRedeemPage shows "28 days" policy info
- 13/13 tests passed (iteration_153)

## COMPLETED: Explorer Mining Sessions - 28 March 2026
- Explorer users can START mining sessions (see timer, progress, rate)
- Collect button DISABLED for Explorer (403 from backend, disabled in UI)
- 15/15 tests passed (iteration_152)

## COMPLETED: Subscription Expiry Auto-Downgrade - 28 March 2026
- check_subscription_expiry() auto-downgrades expired subscriptions to explorer

## COMPLETED: Active-Only Network Counting - 28 March 2026
- get_network_size() only counts Elite + active mining session users

## COMPLETED: Redeem Limit UI Verification - 28 March 2026
- Verified CategoryLimitsDisplay.js shows Limit -> Used -> Balance layout

## COMPLETED: Mining Formula Update - March 2026
- Base 500 PRC/day + Team Bonus (active users only)
- Speed: Elite Cash=100%, PRC=70%, Explorer=visible but can't collect

## Application Overview
Paras Reward is a PRC mining and redemption platform:
- Users earn PRC through mining (time-based)
- Use PRC for subscriptions, bill payments, gift vouchers
- Redeem to INR via bank transfers (1 per 28-day cycle)
- Referral system increases network for mining bonus

## TWO-PLAN SYSTEM
| Feature | EXPLORER (Free) | ELITE (Paid) |
|---------|-----------------|--------------|
| Mining Start | YES | YES |
| Mining Speed | 100% (visible) | Cash=100%, PRC=70% |
| PRC Collect | NO (disabled) | YES |
| Bank Redeem | NO | YES (1 per 28-day cycle) |

## Bank Redeem Rules (Current - March 2026)
- 1 redeem per 28-day subscription cycle
- Subscription must be active (not explorer, not expired)
- KYC must be verified
- Unlock % criteria must be met
- Cycle resets when new subscription cycle starts
- Admin can see subscription active status (green/red) when processing

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
- GET /api/mining/status/{uid} - Mining status
- POST /api/mining/start/{uid} - Start session (Explorer + Elite)
- POST /api/mining/collect/{uid} - Collect PRC (Elite ONLY)
- GET /api/bank-transfer/config - Bank config (cycle_days=28)
- POST /api/bank-transfer/request - Submit bank redeem (28-day cycle enforced)
- GET /api/bank-transfer/admin/requests - Admin view (subscription_active included)
- GET /api/user/{uid}/redeem-limit - Dynamic redeem limit

## Known Issues / Upcoming
### P1
- Razorpay Elite Pricing Update: Rs 999 + 18% GST (April 1, 2026)
### P2
- server.py refactoring (45K+ lines)
- MongoDB -> PostgreSQL migration

## Credentials
- Primary Test User: 9970100782 / PIN: 997010 (Elite)
- Elite User: burntest1@test.com / PIN: 246813
- Explorer: uid d99f75fc-a9f6-478d-901b-dfc7b06090bb
- Admin: Admin@paras.com / PIN: 153759

## Notes for Next Agent
1. User's primary language: Marathi mixed with English
2. MLM terminology banned - use "Growth Network"
3. DB_NAME is paras_reward_db
4. Explorer can START mining but CANNOT collect
5. Network size counts ONLY active users (Elite + mining session active)
6. Bank redeem: 28-day cycle from subscription_start
7. Admin bank transfers page shows green/red subscription status
