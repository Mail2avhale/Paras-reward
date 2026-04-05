# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 6 April 2026

## COMPLETED: PRC Rate Consistency Fix + INR Conversion (P0) - 6 April 2026
### Bug Report
PRC rate was showing differently on different pages (e.g., 12 on Dashboard, 11 on Bank Transfer). Users lost trust.
### Root Cause
Multiple independent API calls fetched dynamic PRC rate at different times. Rate changes between calls caused desync.
### Fix Applied
- `PRCRateDisplay` component: Added `rateOverride` prop — parent pages pass their own rate, component skips independent fetch
- Dashboard combined API: Now includes `prc_rate` in response (single source of truth)
- Added PRC to INR conversion (≈ ₹X) next to: Total Limit, Used, Remaining, PRC Balance on Dashboard
- Files: PRCRateDisplay.js, DashboardModern.js, BankRedeemPage.js, RedeemPageV2.js, SubscriptionPlans.js, GiftVoucherRedemption.js, server.py
- Testing: 10/10 backend + Frontend all passed (iteration_186)

## COMPLETED: PRC Subscription Activation Bug Fix (P0) - 6 April 2026
- Frontend was checking Redeem Limit instead of PRC Balance for subscription purchase. Fixed.

## COMPLETED: 24-Hour Cooldown Fix (P0) - 6 April 2026
- Bank redeem cooldown 28 days → 24 hours from last request time

## COMPLETED: Deduplication Refactoring Verification (P0) - 6 April 2026
## COMPLETED: Double-Count Deduplication Fix (P0) - 5 April 2026
## COMPLETED: Total Redeem Limit Formula Change (P0) - 5 April 2026
## COMPLETED: Redeem Used Details Page - 5 April 2026
## COMPLETED: Code Quality Fixes - 5 April 2026
## COMPLETED: PRC Dynamic Rate Fix - 5 April 2026
## COMPLETED: Core Formula System Audit - 4 April 2026

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js

## Future/Backlog
- P2: Split oversized React components
- P2: server.py refactoring (45k+ lines)
- P3: MongoDB -> PostgreSQL migration
