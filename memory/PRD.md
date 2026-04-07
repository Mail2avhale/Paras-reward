# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 7 April 2026

## COMPLETED: Redeem PRC Feature Deletion (P0) - 7 April 2026
- Deleted 4 user-facing pages: RedeemPageV2.js (2664 lines), BBPSServices.js (672), BillPaymentHistory.js (348), BankRedeemPage.js (743)
- Cleaned 8 routes in App.js (redirect to /dashboard), Sidebar, DashboardModern, AIContextualHelp
- Admin BBPS Dashboard + Admin Bank Transfers preserved for historical records
- Database collections (redeem_requests, bill_payment_requests) preserved

## COMPLETED: Cooldown Time IST Display Fix (P0) - 7 April 2026
- Cooldown end time was displayed in UTC, now correctly shows IST
- Fixed both BBPS and Bank Transfer cooldown messages in server.py

## COMPLETED: Admin Members Table Fix (P0) - 7 April 2026
- Color contrast fix: green/yellow-400 → green/orange-600 for visibility on white background
- Added effective_available field mapping for accurate Available column

## COMPLETED: Deprecated Code Cleanup (P0) - 7 April 2026
- Removed 12 deprecated/dead-code functions from bbps_services.py and unified_redeem_v2.py (367 lines)

## COMPLETED: EKO Refund API Integration - 7 April 2026
## COMPLETED: 4 Critical EKO Bugs Fixed - 7 April 2026
## COMPLETED: EKO Transaction Callback Webhook - 7 April 2026
## COMPLETED: EKO Wallet Balance + Refund Check - 7 April 2026
## COMPLETED: Excel Reconciliation System - 7 April 2026
## COMPLETED: EKO API URL 405 Fix - 7 April 2026
## COMPLETED: Admin BBPS UI Filters Fix - 7 April 2026

## Upcoming
- P1: Core Formula System Audit (Mining, Redeem, Network, PRC Dynamic) — remove hardcoded logic
- P1: Invoice PDF Download option for InvoiceModal.js

## Future/Backlog
- P2: Split oversized React components
- P2: server.py refactoring (45k+ lines)
- P3: MongoDB → PostgreSQL migration
