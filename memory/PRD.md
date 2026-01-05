# Paras Reward Platform - PRD

## Original Problem Statement
Build a comprehensive reward and loyalty platform with VIP membership system, PRC (Platform Reward Currency) mining, marketplace, gift voucher redemption, bill payment services, and multi-level user hierarchy.

## Core Requirements

### User Types
- **Admin**: Full platform control
- **Manager**: Regional management
- **Master Stockist**: Distribution head
- **Sub Stockist**: Sub-distributor
- **Outlet**: Point of sale
- **User/Customer**: End user

### Key Features
1. **VIP Membership System**
   - Monthly/Quarterly/Yearly plans
   - Access to premium features (marketplace, gift vouchers, bill payments)
   - Expiry-based restrictions

2. **PRC (Platform Reward Currency)**
   - Mining system for earning PRC
   - Expiry rules (Free: 48hrs, VIP expired: 5 days post-expiry)
   - Burn mechanisms

3. **Marketplace**
   - Product ordering with PRC
   - VIP-only access
   - Stock management

4. **Bill Payment Services**
   - Mobile recharge
   - Electricity bills
   - Credit card payments
   - VIP-only feature

5. **Gift Voucher Redemption**
   - PhonePe vouchers
   - Various denominations
   - VIP-only feature

## What's Been Implemented

### January 5, 2026 (Current Session - Part 2)
- ✅ **Fintech Accounting System (TESTED - 15/15 Backend + 8/8 Frontend Tests Passed)**
  - **Master Accounting Dashboard** (`/admin/accounting`):
    - Risk Score (0-100) with SAFE/WARNING/CRITICAL status
    - PRC Supply Overview (Total Minted, Burned, Circulating)
    - INR Liability tracking with Reserve Fund & Backing Ratio
    - Monthly Financials (Revenue, Expenses, P&L)
    - Company Wallets summary
    - Alert system for critical issues
  - **PRC Mint Ledger**: Tracks all PRC inflows (mining, referral, cashback, etc.)
  - **PRC Burn Ledger**: Tracks all PRC outflows (orders, redemptions, burns, etc.)
  - **Liability Ledger**: INR redemption tracking with Ageing Analysis (0-7d Safe, 8-30d Warning, 31+d Critical)
  - **Reserve Fund Management**: Manual additions + configurable auto-allocation %
  - **Conversion Rate System**: 1 INR = 10 PRC (default), with rate change history
  - **Daily System Summary**: Auto-calculated with risk score, trends
  - **User Cost Analysis**: Identifies loss-making users (PRC earned vs spent)
  - **180-Day PRC Expiry**: Scheduled burn for inactive users
  - **Accounting Settings**: Configurable prc_per_inr, reserve_fund_percentage, inactive_expiry_days, alert thresholds
  - **Scheduled Jobs**:
    - Daily System Summary: 12:05 AM
    - Inactive User PRC Burn: Weekly Sunday 4 AM
  - Test file: `/app/tests/test_accounting_system.py`

### January 5, 2026 (Current Session - Part 1)
- ✅ **Admin Settings Page Fixes (TESTED - 10/10 Tests Passed)**
  - **Mining Formula Settings**: Fixed save functionality
  - **Contact Settings**: Fixed save functionality with new fields
  - **Logo & Branding**: Implemented file upload feature (replaced URL input)

### January 1, 2026 (Current Session - Part 2)
- ✅ **Admin PRC Rain Input Fields Fix**
  - Removed `Math.min/max` constraints from `onChange` handlers
  - Added validation only on save (in `handleSave` function)
  - Admin can now freely type any value like "40", "100", "120"
  - Values are validated and constrained to valid ranges when saving

### January 1, 2026 (Earlier Session)
- ✅ **User Wallet Ledger System (Admin-Only)**
  - Non-editable, append-only transaction ledger
  - Filter by user, wallet type, transaction type, date range
  - Summary statistics (credits, debits, unique users)
  - Export to CSV functionality
  - New page: `/admin/user-ledger`

- ✅ **Redemption Safety Settings**
  - Configurable daily limits per user and global
  - Manual approval thresholds
  - Suspicious amount flagging
  - Max transactions per day
  - Minimum KYC and VIP tenure requirements
  - Cool-off period between redemptions
  - New page: `/admin/settings/redeem`

- ✅ **Monthly P&L Snapshots**
  - Detailed monthly P&L reports (income, expenses, profit)
  - Save historical snapshots
  - New API: `/api/admin/finance/profit-loss/monthly`

- ✅ **Automatic Wallet Reconciliation**
  - Daily scheduled job at 3 AM
  - Compares actual vs expected wallet balances
  - Auto-transfers net profit to profit wallet
  - Manual trigger available
  - Fixed ObjectId serialization bug

- ✅ **Financial Management System (Foundation)**
  - Company Master Wallets (5 wallets with transfer/adjust)
  - Ads Income Module (manual AdMob/Unity tracking)
  - Fixed Expenses Module (categories, paid/pending status)
  - VIP Payment Verification (approve/reject with wallet credit)
  - Fraud Detection System (IP/Device tracking, auto-freeze)
  - Export system (CSV for P&L, Ledger, Wallets)
  - Admin sidebar reorganized: Finance, Settings, Payments groups

### December 31, 2025
- ✅ **VIP Membership Expiry Feature**
  - Login shows expiry message for expired VIP users
  - Marketplace blocked for expired VIP (403)
  - Gift Vouchers blocked for expired VIP (403)
  - Bill Payments blocked for expired VIP (403)
  - PRC mined after expiry burns after 5 days
  - Fixed double deduction bug in PRC burn

### Previous Sessions
- ✅ Admin panel with 16+ working routes
- ✅ Pagination on all admin list pages
- ✅ PRC Analytics Dashboard
- ✅ Auditing Service Dashboard
- ✅ Profit & Loss Dashboard
- ✅ Liquidity Management Dashboard

## Test Credentials
- **Admin**: admin@paras.com / admin
- **Manager**: manager_txn_1762416719@test.com / testpassword
- **Test Expired VIP**: final_test_vip@test.com / testpass123

## Pending/In-Progress

### P2 - Medium Priority
- [ ] Verify pagination on Voucher History page
- [ ] Verify pagination on Bill Payments History page

### P1.1 - Upcoming
- [ ] AdMob + Unity Ads Integration (automation for ads income)
- [ ] PWA Setup (Add to Home Screen functionality)

### P3 - Future/Backlog
- [ ] Hierarchical Reporting Structure
- [ ] "Save PRC" feature
- [ ] Admin backup system
- [ ] Anti-hack security measures
- [ ] Display graphical representation for "Total PRC Used"
- [ ] Update processing time message to "3-7 days"

## Key API Endpoints

### Finance APIs (New)
- `GET /api/admin/finance/user-ledger` - Paginated user transactions
- `GET /api/admin/finance/user-ledger/{uid}` - Specific user's ledger
- `GET /api/admin/finance/redeem-settings` - Get redemption settings
- `PUT /api/admin/finance/redeem-settings` - Update redemption settings
- `GET /api/admin/finance/profit-loss/monthly` - Monthly P&L report
- `POST /api/admin/finance/profit-loss/snapshot` - Save P&L snapshot
- `POST /api/admin/finance/reconciliation/run` - Manual reconciliation
- `GET /api/admin/finance/reconciliation/status` - Wallet status

### VIP & Service APIs
- `POST /api/auth/login` - Returns vip_expired, vip_days_expired, vip_expiry_message
- `GET /api/marketplace/products` - 403 for expired VIP
- `POST /api/gift-voucher/request` - 403 for expired VIP
- `POST /api/bill-payment/request` - 403 for expired VIP
- `POST /api/admin/burn-prc-now` - Manual PRC burn trigger

### Analytics Dashboards
- `GET /api/admin/prc-analytics-v2`
- `GET /api/admin/audit-logs`
- `GET /api/admin/profit-loss`
- `GET /api/admin/liquidity-status`

### Admin Settings APIs (Fixed Jan 5, 2026)
- `GET /api/admin/mining-settings` - Get mining formula settings
- `POST /api/admin/mining-settings` - Update mining formula settings
- `GET /api/admin/contact-settings` - Get contact information
- `POST /api/admin/contact-settings/update` - Update contact information
- `GET /api/admin/logo-settings` - Get logo/branding settings
- `POST /api/admin/logo-settings/update` - Update logo/branding settings
- `POST /api/admin/logo-upload` - Upload logo/favicon files (multipart/form-data)

## Architecture
```
/app/
├── backend/
│   └── server.py (FastAPI + MongoDB)
└── frontend/
    └── src/
        ├── App.js (Routes)
        ├── components/
        │   └── layouts/
        │       └── AdminLayout.js (Sidebar with Finance, Settings, Payments groups)
        └── pages/
            ├── AdminUserLedger.js (NEW - User Wallet Ledger)
            ├── AdminRedeemSettings.js (NEW - Redemption Safety Settings)
            ├── AdminCompanyWallets.js
            ├── AdminAdsIncome.js
            ├── AdminFixedExpenses.js
            └── ... (other admin pages)
```

## Key Functions
- `check_vip_service_access(uid, service_name)` - Checks VIP status and expiry
- `burn_expired_vip_prc()` - Burns PRC mined after VIP expiry (5+ days old)
- `burn_expired_prc_for_free_users()` - Burns free user PRC (48hrs expiry)
- `check_redeem_safety(user_id, amount_inr)` - Validates redemption against safety rules
- `daily_wallet_reconciliation()` - Scheduled daily reconciliation job
- `log_transaction()` - Central function for all balance updates (prevents double deduction)

## Scheduled Jobs (APScheduler)
1. **Free User PRC Burn**: Every hour - Burns PRC older than 48 hours
2. **Expired VIP PRC Burn**: Daily at 2 AM - Burns PRC mined after VIP expiry (5+ days old)
3. **Wallet Reconciliation**: Daily at 3 AM - Reconciles company wallets and calculates profit
