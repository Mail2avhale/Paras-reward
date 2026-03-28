# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 28 March 2026 (Referral Active/Inactive Status)

## COMPLETED: Referral Active/Inactive Status - 28 March 2026
- Removed Mining Formula from Mining page (user requested)
- Direct Connections on Referral page now show Active (green) / Inactive (red) status
- Active = Elite + mining_active + session not expired
- Header shows "X Active" / "Y Inactive" counts
- Each user has green/red dot indicator + status badge
- Stats: Direct, Active (green), Total in 3-column grid
- Fixed API URL mismatch (frontend was calling wrong endpoint)

## COMPLETED: Mining Formula Math Fix - 28 March 2026
- Fixed cache read bug: Python `or` operator treated 0 as falsy
- Changed to explicit `is None` checks in mining.py and growth_economy.py
- Added active_network, total_network_members, direct_referrals to mining API
- 18/18 backend tests passed (iteration_155)

## COMPLETED: PRC Statement Page - 28 March 2026
- Bank passbook style ledger with CR/DR/Balance
- Filters and pagination, 13/13 tests passed

## COMPLETED: MLM Terminology Cleanup - 28 March 2026
## COMPLETED: Bank Redeem 28-Day Cycle Rules - 28 March 2026
## COMPLETED: Explorer Mining Sessions - 28 March 2026
## COMPLETED: Subscription Expiry Auto-Downgrade - 28 March 2026
## COMPLETED: Active-Only Network Counting - 28 March 2026
## COMPLETED: DB-Level Network Caching - 28 March 2026

## Application Overview
Paras Reward - Performance-Based Digital Reward Ecosystem

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
- GET /api/mining/status/{uid} - Mining status
- GET /api/mining/rate-breakdown/{uid} - Formula breakdown
- GET /api/referrals/{user_id}/direct-list - Direct referrals with active status
- GET /api/growth/network-stats/{user_id} - Network stats
- GET /api/prc-statement/{uid} - PRC passbook ledger
- POST /api/mining/start/{uid} - Start session
- POST /api/mining/collect/{uid} - Collect PRC (Elite)
- POST /api/bank-transfer/request - Bank redeem

## Upcoming
- P1: Razorpay pricing update (999 + GST) - April 1, 2026
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
