# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 7 April 2026

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

## COMPLETED: Admin User 360 Redeem Limits Display (P0) - 7 April 2026
## COMPLETED: Double Recharge Race Condition Fix (P0) - 6 April 2026
## COMPLETED: PRC Rate Consistency + INR Conversion (P0) - 6 April 2026
## COMPLETED: PRC Subscription Activation Bug Fix (P0) - 6 April 2026
## COMPLETED: 24-Hour Cooldown Fix (P0) - 6 April 2026
## COMPLETED: Redeem Limit Enforcement on All Endpoints (P0) - 6 April 2026
## COMPLETED: EKO User Code + Source IP Fix (P0) - 6 April 2026

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js
- P1: Fund Settlement (EKO Wallet → Bank Transfer) via admin panel

## Future/Backlog
- P2: Split oversized React components
- P2: server.py refactoring (45k+ lines)
- P3: MongoDB → PostgreSQL migration
