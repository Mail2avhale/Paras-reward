# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 7 April 2026

## COMPLETED: Deprecated Code Cleanup (P0) - 7 April 2026
- Removed 12 deprecated/dead-code functions from `bbps_services.py` and `unified_redeem_v2.py`
- Deleted: debug_config, debug_fastag_errors, activate_bbps_service (PUT duplicate), test_fetch_bill, debug_pay_bill, handle_eko_response, handle_bill_fetch_response, handle_bill_payment_response, validate_bbps_request, log_eko_transaction, get_client_ip_bbps, duplicate get_available_services
- 367 total lines removed, all active endpoints verified working

## COMPLETED: EKO Refund API Integration (P0) - 7 April 2026
- POST `/api/bbps/refund/resend-otp/{tid}` — Resend refund OTP to customer
- POST `/api/bbps/refund/verify/{tid}?otp=XXXX` — Verify OTP & refund to EKO wallet
- Admin BBPS Dashboard: "Send Refund OTP" → Enter OTP → "Verify & Refund" flow
- Refund logs stored in `eko_refund_logs` collection

## COMPLETED: 4 Critical EKO Bugs Fixed (P0) - 7 April 2026
- eko_common.py: Timestamp SECONDS→MILLISECONDS, header request-hash→request_hash, default form_data True→False
- Hardcoded source_ip (34.44.149.98) replaced with EKO_SOURCE_IP env var across 5 files
- .pyc cache cleared

## COMPLETED: EKO Transaction Callback Webhook (P0) - 7 April 2026
- POST `/api/bbps/callback/status` — EKO webhook for status updates
- Auto-updates DB, auto PRC refund on failure
- GET `/api/bbps/callback/logs` for audit

## COMPLETED: EKO Wallet Balance + Refund Check (P0) - 7 April 2026
- Wallet balance banner (blue gradient) on Admin BBPS Dashboard
- "Check EKO Wallet Refund Status" button + "Copy for EKO Support" button
- Failed Transactions Excel export

## COMPLETED: Excel Reconciliation System (P0) - 7 April 2026
- POST `/api/bbps/reconcile/upload` — Parse Eko Excel, match with internal DB
- POST `/api/bbps/reconcile/fix` — Bulk fix mismatched records
- Admin UI for upload, stats display, and "Fix All" action

## COMPLETED: EKO API URL 405 Fix (P0) - 7 April 2026
- Fixed status check URLs from `?client_ref_id=` to `/client_ref_id:` format
- Fixed false timeout failures in `execute_eko_recharge`

## COMPLETED: Admin BBPS UI Filters Fix (P0) - 7 April 2026
- Fixed search bar and date filter on Admin BBPS Dashboard

## COMPLETED: Admin User 360 Redeem Limits Display (P0) - 7 April 2026
## COMPLETED: Double Recharge Race Condition Fix (P0) - 6 April 2026
## COMPLETED: PRC Rate Consistency + INR Conversion (P0) - 6 April 2026
## COMPLETED: PRC Subscription Activation Bug Fix (P0) - 6 April 2026
## COMPLETED: 24-Hour Cooldown Fix (P0) - 6 April 2026
## COMPLETED: Redeem Limit Enforcement on All Endpoints (P0) - 6 April 2026
## COMPLETED: EKO User Code + Source IP Fix (P0) - 6 April 2026

## Upcoming
- P1: Core Formula System Audit (Mining, Redeem, Network, PRC Dynamic) — remove hardcoded logic
- P1: Invoice PDF Download option for InvoiceModal.js
- P1: Fund Settlement (EKO Wallet → Bank Transfer) via admin panel

## Future/Backlog
- P2: Split oversized React components
- P2: server.py refactoring (45k+ lines)
- P3: MongoDB → PostgreSQL migration
