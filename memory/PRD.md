# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 7 April 2026

## COMPLETED: EKO Transaction Callback Webhook (P0) - 7 April 2026
- POST `/api/bbps/callback/status` — EKO pushes status updates for pending/failed transactions
- Auto-updates DB (pending→completed, pending→failed with PRC refund, refunded status)
- Audit log: all callbacks stored in `eko_callbacks` collection
- Admin endpoint: GET `/api/bbps/callback/logs` for debugging
- User needs to configure this URL in EKO dashboard

## COMPLETED: EKO Wallet Balance + Refund Check (P0) - 7 April 2026
- EKO Wallet Balance banner on Admin BBPS Dashboard (real-time from EKO API)
- "Check EKO Wallet Refund Status" button for failed transactions (TID + client_ref_id lookup)
- GET `/api/bbps/status-by-ref/{client_ref_id}` — status inquiry when TID is N/A
- GET `/api/bbps/admin/check-eko-refund/{request_id}` — admin refund verification

## COMPLETED: Admin User 360 Redeem Limits Display (P0) - 7 April 2026
- Backend returns redeem_limit (total_limit, total_redeemed, effective_available)
- Frontend displays 3 color-coded cards: REDEEM LIMIT, USED LIMIT, BAL LIMIT
- Testing: 100% passed (iteration_187)

## COMPLETED: Double Recharge Race Condition Fix (P0) - 6 April 2026
## COMPLETED: PRC Rate Consistency + INR Conversion (P0) - 6 April 2026
## COMPLETED: PRC Subscription Activation Bug Fix (P0) - 6 April 2026
## COMPLETED: 24-Hour Cooldown Fix (P0) - 6 April 2026
## COMPLETED: Deduplication Refactoring Verification (P0) - 6 April 2026
## COMPLETED: Redeem Limit Enforcement on All Endpoints (P0) - 6 April 2026
## COMPLETED: EKO User Code + Source IP Fix (P0) - 6 April 2026
## COMPLETED: Admin BBPS Refund Button (P0) - 6 April 2026
## COMPLETED: Subscription Cooldown 7 Days (P1) - 6 April 2026

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js
- P1: Fund Settlement (EKO Wallet → Bank Transfer) via admin panel

## Future/Backlog
- P2: Split oversized React components
- P2: server.py refactoring (45k+ lines)
- P3: MongoDB → PostgreSQL migration
