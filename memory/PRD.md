# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 28 March 2026 (PRC Statement Page)

## COMPLETED: PRC Statement Page - 28 March 2026
- Bank passbook style ledger: Date | Type | Narration | CR | DR | Balance
- Summary header: Total Earned (CR), Total Used (DR), Current Balance
- Filters: All, Reward, Recharge, Bill Pay, Redeem, Bank Redeem, Voucher Redeem, Refund, Burn, Admin
- Mining entries → "Reward" type + "Daily Reward Collected" narration (no mining breakdown)
- Sort newest/oldest, pagination (20/page)
- Data from: prc_ledger + transactions + ledger (deduplicated)
- 13/13 tests passed (iteration_154)

## COMPLETED: MLM Terminology Cleanup - 28 March 2026
- Replaced "Build Team" → "Grow Network", "Referral" → "Growth Network"
- Blog data, SEO, translations, HowItWorks all updated
- "Team" → "Network" in UI labels

## COMPLETED: Bank Redeem 28-Day Cycle Rules - 28 March 2026
- 1 redeem per 28-day subscription cycle
- Subscription active check + expiry check
- Admin sees green/red subscription status

## COMPLETED: Explorer Mining Sessions - 28 March 2026
- Explorer can START mining, Collect disabled (Elite only)

## COMPLETED: Subscription Expiry Auto-Downgrade - 28 March 2026
## COMPLETED: Active-Only Network Counting - 28 March 2026
## COMPLETED: Mining Formula Update - March 2026

## Application Overview
Paras Reward - Performance-Based Digital Reward Ecosystem
"Earn by Activity, Grow by Network, Redeem with Control"

## TWO-PLAN SYSTEM
| Feature | EXPLORER (Free) | ELITE (Paid) |
|---------|-----------------|--------------|
| Mining Start | YES | YES |
| PRC Collect | NO | YES |
| Bank Redeem | NO | YES (1 per 28-day cycle) |

## Tech Stack
- Frontend: React.js + Tailwind CSS + Shadcn/UI
- Backend: FastAPI (Python)
- Database: MongoDB (paras_reward_db)

## Key API Endpoints
- GET /api/prc-statement/{uid} - PRC passbook ledger
- GET /api/mining/status/{uid} - Mining status
- POST /api/mining/start/{uid} - Start session
- POST /api/mining/collect/{uid} - Collect PRC (Elite)
- POST /api/bank-transfer/request - Bank redeem (28-day cycle)
- GET /api/bank-transfer/admin/requests - Admin view

## Upcoming
- P1: Razorpay pricing update (₹999 + GST) - April 1, 2026
- P2: server.py refactoring
- Future: MongoDB → PostgreSQL migration
