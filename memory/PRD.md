# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 7 April 2026

## COMPLETED: server.py Monolith Refactoring (P2) - 7 April 2026
- Reduced server.py from 45,221 → 33,323 lines (-26%, -11,898 lines)
- Extracted 7 new modular route files: admin_accounting (4954), notifications_routes (3010), admin_prc_balance (1542), ai_routes (1050), manager_routes (976), admin_prc_economy (221)
- All 117 extracted routes verified working via curl (401/422/200 responses correct)

## COMPLETED: Reward Page Removed + Mining Widget on Dashboard (P0) - 7 April 2026
- Created MiningWidget.js component (compact self-contained mining logic + UI)
- Embedded mining widget on Dashboard below Plan Card (Time, Earnings, Progress Bar, Collect button)
- Removed Reward page (Mining.js deleted, /daily-rewards redirects to /dashboard)
- Removed Quick Action cards (Rewards + Referrals) from Dashboard
- Removed "Rewards" tab from bottom navigation (Dashboard + BottomNav)
- Removed rewards link from Sidebar
- Cleaned BottomNav.js, SEO.js, App.js unused references

## COMPLETED: Full Burning Concept Removal - User + Admin (P0) - 7 April 2026
- Deleted BurningIndicator.js component, deprecated routes/burning.py
- Removed auto-burn scheduler job (3.33%/day cron), all burn state/functions from AdminDashboard
- Cleaned burn references from 15+ files: DashboardModern, Mining, AdminDashboard, AdminPRCEconomyDashboard, AdminPRCAnalytics, AdminPRCLedger, AdminAccountingDashboard, AdminFinancialReports, AdminProfitLoss, AdminEconomySettings, AdminTransactionManager, AdminUserLedger, PRCStatement, PRCRateDisplay, locales
- Backend: Zeroed out burn in calculate_elite_prc_price, calculate_redemption_charges, get_user_burn_rate, get_bill_payment_service_charge
- Historical burn transactions remain in DB (PRC statement shows as grey "Burn" type for audit trail)

## COMPLETED: Subscription from PRC Full Frontend Cleanup (P0) - 7 April 2026
- Deleted SubscriptionPlans.js (1,803 lines) and removed route from App.js
- Cleaned all user-facing subscription links/buttons from: DashboardModern.js, Sidebar.js, ProfileAdvanced.js, Mining.js, MyInvoices.js, BurningIndicator.js, AIContextualHelp.js
- Admin subscription management, Invoices, PRC historical statements preserved intact
- Frontend compile verified clean (no dead imports)

## COMPLETED: Full BBPS + Gift Voucher + Marketplace Cleanup (P0) - 7 April 2026
- Deleted 7 user-facing pages: RedeemPageV2, BBPSServices, BillPaymentHistory, BankRedeemPage, GiftVoucherRedemption, CategoryLimitsDisplay, FlashSalesPage
- 18+ files cleaned: Dashboard, Sidebar, FAQ, SEO, Terms, Blog, About, Profile, Mining, etc.
- Fixed critical BankRedeemPage runtime crash (references to deleted components in App.js)
- Admin records preserved (BBPS Dashboard, Bank Transfers, Gift Vouchers)

## COMPLETED: Cooldown Time IST Display Fix (P0) - 7 April 2026
## COMPLETED: Admin Members Table Color Fix (P0) - 7 April 2026
## COMPLETED: Deprecated Code Cleanup (P0) - 7 April 2026
## COMPLETED: EKO Integration Fixes - 7 April 2026
## COMPLETED: Excel Reconciliation System - 7 April 2026

## Architecture
/app/backend/
├── server.py (33,323 lines - main monolith, further extraction possible)
├── routes/
│   ├── admin_accounting.py (4,954 lines - 45 routes)
│   ├── notifications_routes.py (3,010 lines - 22 routes)
│   ├── unified_redeem_v2.py (3,182 lines)
│   ├── bbps_services.py (3,104 lines)
│   ├── razorpay_payments.py (3,074 lines)
│   ├── auth.py (1,864 lines)
│   ├── admin_prc_balance.py (1,542 lines - 12 routes)
│   ├── admin_finance.py (1,458 lines)
│   ├── admin_misc.py (1,267 lines)
│   ├── manual_bank_transfer.py (1,107 lines)
│   ├── ai_routes.py (1,050 lines - 11 routes)
│   ├── manager_routes.py (976 lines - 17 routes)
│   ├── prc_economy.py (946 lines)
│   ├── admin_ledger.py (932 lines)
│   ├── kyc.py (913 lines)
│   ├── users.py (792 lines)
│   ├── growth_economy.py (769 lines)
│   ├── mining.py (720 lines)
│   ├── admin_ledger_view.py (683 lines)
│   ├── admin_users.py (658 lines)
│   ├── error_monitor.py (654 lines)
│   ├── admin_withdrawals.py (330 lines)
│   ├── admin_prc_economy.py (221 lines - 10 routes)
│   └── eko_common.py (190 lines)

## Upcoming
- P1: Invoice PDF Download option in InvoiceModal.js

## Future/Backlog
- P2: Continue server.py extraction (33K → target 20K: Auth, Referrals, Subscription routes)
- P2: Split oversized React components
- P3: MongoDB → PostgreSQL migration
