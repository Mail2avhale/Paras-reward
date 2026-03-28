# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 28 March 2026

## COMPLETED: Subscription + Redeem Burning Formula - 28 March 2026
- Updated subscription pricing: ₹999 + 18% GST + ₹10 Processing + 20% Admin + Burning (as per plan)
- PRC subscription: 5% burn rate, 70% mining speed
- Cash subscription: 1% burn rate, 100% mining speed
- Admin charge changed from 100% → 20%
- Processing fee added: ₹10
- Dynamic PRC rate (fetched from /api/admin/prc-rate/current)
- Burning added to all redeem requests (bank redeem + unified redeem)
- Redeem burning: user pays extra X × burn_rate% on top of amount
- PRCRateDisplay component updated with burnRate prop across all pages
- 15/15 backend tests passed, frontend verified (iteration_156)

## COMPLETED: Referral Active/Inactive Status - 28 March 2026
- Direct Connections show Active (green) / Inactive (red) status
- Active = Elite + mining_active + session not expired
- Stats: Direct, Active (green), Total in 3-column grid

## COMPLETED: Mining Formula Math Fix - 28 March 2026
- Fixed cache read bug (0 treated as falsy)
- 18/18 tests passed (iteration_155)

## COMPLETED: PRC Statement, MLM Cleanup, Bank Redeem 28-Day, Explorer Mining, DB Caching

## Application Overview
Paras Reward - Performance-Based Digital Reward Ecosystem

## Pricing Formula
₹999 + 18% GST (₹179.82) = ₹1178.82 base
+ ₹10 Processing Fee
+ 20% Admin Charge on (base_prc + processing_prc)
+ Burning (PRC: 5%, Cash: 1%) on total_before_burn
= Final PRC Amount

## TWO-PLAN SYSTEM
| Feature | EXPLORER (Free) | ELITE (Paid) |
|---------|-----------------|--------------|
| Mining Start | YES | YES |
| PRC Collect | NO | YES |
| Mining Speed | - | Cash: 100%, PRC: 70% |
| Burn Rate | - | Cash: 1%, PRC: 5% |

## Tech Stack
- Frontend: React.js + Tailwind CSS + Shadcn/UI
- Backend: FastAPI (Python), MongoDB

## Key API Endpoints
- GET /api/subscription/elite-pricing - Returns PRC + Cash pricing with burning
- GET /api/redeem/calculate-charges?amount=X&payment_type=prc|cash - Charges with burning
- GET /api/mining/status/{uid} - Mining status
- GET /api/referrals/{uid}/direct-list - Direct referrals with active status
- POST /api/bank-transfer/request - Bank redeem with burning

## Upcoming
- P1: Razorpay pricing update (999 + GST) - April 1, 2026
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
