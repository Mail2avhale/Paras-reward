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

### January 6, 2026 (Current Session - Part 8)
- ✅ **Phase 2: Full Accounting Suite (TESTED - 27/27 Backend Tests Passed, 100% Frontend)**
  
  **1. Accounts Receivable (AR)** (`/admin/accounts-receivable`):
  - येणे बाकी - Money owed TO the business
  - Create invoices with customer, amount, due date
  - Mark as paid (auto-creates cash_book entry)
  - Filter by status (pending, overdue, paid)
  - Summary: total_pending, total_overdue, total_collected, total_outstanding
  
  **2. Accounts Payable (AP)** (`/admin/accounts-payable`):
  - देणे बाकी - Money owed BY the business
  - Create bills with vendor, amount, due date
  - Pay via Cash or Bank (auto-creates expense entry)
  - Includes PRC redemption liability (10 PRC = ₹1)
  - Summary: total_pending, total_overdue, total_paid, prc_liability
  
  **3. Bank Reconciliation**:
  - Book balance vs bank statement comparison
  - Unreconciled entries tracking
  - Monthly reconciliation status
  
  **4. GST/Tax Tracking**:
  - Input GST and Output GST tracking
  - Supports rates: 0%, 5%, 12%, 18%, 28%
  - Net GST payable/credit calculation
  - GST by rate breakdown
  
  **5. Budget vs Actual**:
  - Set monthly budgets by category
  - Compare with actual expenses
  - Variance and utilization calculation
  - Status: under/over/on_track
  
  **6. Financial Ratios Dashboard** (`/admin/financial-ratios`):
  - Health Score (0-100) with status
  - Current Ratio (benchmark: 2.0)
  - Quick Ratio (benchmark: 1.0)
  - Profit Margin % (benchmark: 15%)
  - Expense Ratio % (benchmark: ≤70%)
  - Improvement tips based on ratios
  
  **7. Audit Trail**:
  - Paginated audit logs
  - Tracks: user, action, entity, timestamp
  - Filter by action type
  
  Test report: `/app/test_reports/iteration_14.json`

### January 6, 2026 (Current Session - Part 7)
- ✅ **Phase 1: Accounting Foundation (TESTED - 14/14 Backend Tests Passed, 100% Frontend)**
  
  **1. Capital & Owner's Equity Management** (`/admin/capital-management`):
  - Opening Capital entry (भांडवल)
  - Additional Capital investments
  - Owner's Drawings (मालकाने काढलेले पैसे)
  - Automatic cash_book entry creation when capital is added
  - Equity Calculation: Opening + Additional - Drawings + Retained = Total Equity
  - APIs: `GET/POST /api/admin/accounting/capital`, `/api/admin/accounting/capital/entry`
  
  **2. Trial Balance** (`/admin/trial-balance`):
  - Total Debits vs Total Credits verification
  - Balance status indicator (✓ Balanced or ⚠ Difference amount)
  - Account-wise debit/credit breakdown
  - API: `GET /api/admin/accounting/trial-balance`
  
  **3. Chart of Accounts**:
  - 39 accounts across 5 categories (Assets, Liabilities, Equity, Income, Expenses)
  - Account codes: 1xxx=Assets, 2xxx=Liabilities, 3xxx=Equity, 4xxx=Income, 5xxx=Expenses
  - Normal balance indicators (Debit/Credit)
  - API: `GET /api/admin/accounting/chart-of-accounts`
  
  **4. Balance Sheet Enhancement**:
  - Now shows detailed equity breakdown: Opening Capital, Additional Capital, Less Drawings, Retained Earnings
  - Balance check: Assets = Liabilities + Equity verification
  
  Test report: `/app/test_reports/iteration_13.json`

### January 6, 2026 (Current Session - Part 6)
- ✅ **PRC Ledger with DR/CR Accounting (TESTED - 18/18 Backend Tests Passed, 100% Frontend)**
  - **Feature**: Complete PRC transaction ledger with INR value conversion
  - **Conversion Rate**: 10 PRC = ₹1 INR
  - **Backend API** (`/app/backend/server.py`):
    - `GET /api/admin/accounting/prc-ledger` - All PRC transactions with DR/CR classification
    - `POST /api/admin/accounting/sync-prc-to-books` - Sync PRC transactions to Cash Book
  - **Frontend Page** (`/app/frontend/src/pages/AdminPRCLedger.js`):
    - 4 Summary Cards: Total Mined (CR), Total Consumed (DR), Total Burned, Net in Circulation
    - Filter tabs: All Transactions, Credits (CR), Debits (DR)
    - Transaction table with Date, Description, Type, PRC Amount, INR Value, DR/CR
    - "Sync to Cash Book" button for INR value entries
  - Test report: `/app/test_reports/iteration_12.json`

- ✅ **Monthly Financial Reports (TESTED - 100% Pass Rate)**
  - **Backend APIs** (`/app/backend/server.py`):
    - `GET /api/admin/reports/profit-loss-statement` - Monthly P&L with income, expenses, net profit, profit margin
    - `GET /api/admin/reports/balance-sheet` - Assets, Liabilities, Equity with balance check
    - `GET /api/admin/reports/prc-flow` - PRC inflow/outflow/net with daily breakdown
  - **Frontend Page** (`/app/frontend/src/pages/AdminFinancialReports.js`):
    - 3 Tabs: Profit & Loss, Balance Sheet, PRC Flow
    - Month/Year selector for filtering
    - Income/Expense category breakdown
    - PRC metrics per period

- ✅ **Auto Expense Categorization (TESTED - 100% Pass Rate)**
  - **Backend APIs** (`/app/backend/server.py`):
    - `POST /api/admin/accounting/auto-categorize` - Auto-suggest category based on description keywords
    - `GET /api/admin/accounting/category-suggestions` - All available categories with keywords
  - **Keywords Supported**: rent, salary, utilities, maintenance, purchase, travel, marketing, capital, vip_fee, ads_income, prc_income, prc_redemption
  - **Features**: 
    - Keyword matching (90% confidence)
    - Amount pattern matching (70% confidence)
    - Marathi keywords supported (भाडे, पगार, विज, etc.)
  - **Frontend Integration** (`/app/frontend/src/pages/AdminCashBankBook.js`):
    - Real-time auto-suggestion on description input
    - "Apply" button to accept suggestion
    - Shows match reason and confidence

### January 6, 2026 (Current Session - Part 5)
- ✅ **Cash Book & Bank Book Accounting System (TESTED - 14/14 Backend Tests Passed, 100% Frontend)**
  - **Feature**: Complete double-entry accounting system for tracking company cash and bank transactions
  - **Backend APIs** (`/app/backend/server.py`):
    - `GET /api/admin/accounting/summary` - Overview with cash, bank, and total balance
    - `GET /api/admin/accounting/cash-book` - Cash entries with pagination and running balance
    - `GET /api/admin/accounting/bank-book` - Bank entries with pagination and running balance
    - `POST /api/admin/accounting/cash-book/entry` - Add income/expense to cash book
    - `POST /api/admin/accounting/bank-book/entry` - Add income/expense to bank book
    - `POST /api/admin/accounting/transfer` - Transfer between cash and bank
    - `POST /api/admin/accounting/set-opening-balance` - Set opening balance for cash/bank
  - **Frontend Page** (`/app/frontend/src/pages/AdminCashBankBook.js`):
    - 3 Summary Cards: Cash in Hand, Bank Balance, Total Balance
    - 3 Tabs: Summary, Cash Book, Bank Book
    - Add Entry Modal with category selection (Capital, VIP Fee, Ads Income, Rent, Salary, etc.)
    - Transfer Modal for cash ↔ bank transfers
    - Set Opening Balance Modal with bank name/account number for bank
    - Transaction table with running balance
  - **Files Modified**:
    - `/app/frontend/src/App.js` (added route `/admin/cash-bank-book`)
    - `/app/frontend/src/components/layouts/AdminLayout.js` (added "Cash & Bank Book" link in Finance menu)
  - Test report: `/app/test_reports/iteration_11.json`

### January 6, 2026 (Current Session - Part 4)
- ✅ **Bug Fixes & Improvements**
  - **Smart Insights Text Visibility**: Fixed contrast issue - changed text colors from light to dark for better readability
  - **PRC Economy Link in Admin**: Added "PRC Emergency Controls" link to Finance menu
  - **User Controls Card Removed from Dashboard**: Removed "User Controls" card from user dashboard (was showing Pause Mining, Daily PRC Cap, etc.) - these are admin-only features
  - **Admin User Controls Page Created**: New `/admin/user-controls` page for admins to:
    - Search users by name/email
    - View user mining status, daily caps, PRC balance
    - Pause/Resume mining for individual users
    - Set daily PRC caps (Unlimited, 100, 500, 1000, 2000, 5000 PRC)
    - Toggle utility-only mode
    - Bulk actions: Pause All, Resume All, Set Cap, Remove Cap
    - Detailed user modal with all settings
  - Files Modified:
    - `/app/frontend/src/pages/DashboardModern.js` (removed user-controls card)
    - `/app/frontend/src/pages/AdminUserControls.js` (NEW)
    - `/app/frontend/src/components/layouts/AdminLayout.js` (added link)
    - `/app/frontend/src/App.js` (added route)

### January 6, 2026 (Current Session - Part 3)
- ✅ **Draggable Dashboard Cards (TESTED - 100% Frontend Tests Passed)**
  - **Feature**: Users can customize their dashboard by dragging and reordering cards
  - **Implementation Details**:
    - Uses `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` libraries
    - Created `DraggableDashboard.jsx` component with:
      - `SortableCard` wrapper with drag handles
      - `DraggableDashboard` container with edit mode controls
      - `DashboardCard` wrapper for individual cards
    - 9 draggable cards: stats-cards, smart-insights, quick-actions, recent-activity, security-trust, user-controls, statement-export, activity-feed, vip-banner
  - **UI Features**:
    - Purple floating edit button (gear icon) in bottom right corner
    - Edit mode control panel with Save/Reset/Close buttons
    - Purple drag handles (⠿) on left side of each card in edit mode
    - Purple ring outline on cards in edit mode
    - "Cards drag करा आणि reorder करा" instruction banner
    - VIP banner is **locked** (gray lock icon, cannot be moved)
  - **Persistence**: Layout saved to `localStorage` with key `dashboard_card_order`
  - **Files Modified**:
    - `/app/frontend/src/components/DraggableDashboard.jsx` (NEW)
    - `/app/frontend/src/pages/DashboardModern.js` (MODIFIED)
    - `/app/frontend/package.json` (added @dnd-kit packages)
  - Test report: `/app/test_reports/iteration_9.json`

### January 6, 2026 (Current Session - Part 2)
- ✅ **Multi-Language Tutorial Support (TESTED - 100% Frontend Tests Passed)**
  - **Tutorial Translations**: AppTutorial.js now fully supports English, Hindi, and Marathi
  - **8 Slides Translated**: Welcome, Mining, Referral, Rain, Marketplace, Redeem, VIP, Ready
  - **Translation Coverage**:
    - Titles, subtitles, descriptions for each slide
    - Tips (3 per slide)
    - Mascot speech bubbles
    - Navigation buttons (Back/Next/Start)
  - **Language Selection Screen** (NEW):
    - Shows before tutorial starts for first-time users
    - Beautiful purple gradient header with rotating globe icon
    - Three language options with colorful flag icons (🇮🇳 Marathi, 🇮🇳 Hindi, 🇬🇧 English)
    - "You can change this later in Settings" helper text
    - Skip button (X) to use default language
  - **Implementation Details**:
    - Uses `useLanguage()` hook from LanguageContext
    - `LanguageSelectionScreen` component for language picker
    - `getTutorialSlides(t)` function generates slides with translations
    - `useMemo` with `[t, language]` dependency for performance
    - 50+ translation keys added to `/app/frontend/src/locales/translations.js`
  - **Bug Fixes Applied**:
    - Fixed skip button z-index (added z-30 class)
    - Fixed ESLint warning for useMemo dependencies
  - **Files Modified**:
    - `/app/frontend/src/components/AppTutorial.js`
    - `/app/frontend/src/locales/translations.js`
  - Test report: `/app/test_reports/iteration_8.json`

### January 6, 2026 (Current Session - Part 1)
- ✅ **Backend Fix: Comprehensive Ledger System APIs**
  - **Issue Fixed**: Removed 924 lines of duplicate ledger API code
  - All 17 new ledger endpoints now working correctly

- ✅ **Quick View Mode for Admin Accounting Dashboard (TESTED)**
  - View Mode Toggle: "Quick View" (default) and "Detailed"
  - 5 Key Metric Cards with real data showing

- ✅ **Phase 1: Global Live Features**
  - Live Mining Indicator - "Mining Active • LIVE" badge
  - Live Transparency Panel - Platform-wide stats with 111.8K PRC total
  - Removed redundant Today's Summary Strip

- ✅ **Tutorial Updated**
  - Added Paras Buddy mascot with cartoon animations
  - Different emotions per slide (waving, mining, excited, celebrating)
  - Speech bubbles with translated text
  - Multi-language support: English, Hindi, Marathi (completed)

- ✅ **Phase 2: Smart Features**
  - **Smart User Insights** (`/app/frontend/src/components/SmartUserInsights.jsx`)
    - Personalized messages like "VIP म्हणून तुम्ही 2x PRC कमावत आहात! 👑"
    - Auto-rotating insights every 5 seconds
    - Backend API: `/api/user/insights/{uid}`
  - **Live Activity Feed** (`/app/frontend/src/components/LiveActivityFeed.jsx`)
    - Shows "User from {city} {action}" social proof
    - Real-time rotating activities
    - Backend API: `/api/public/live-activity`

- ✅ **Phase 3: Trust & Control Features**
  - **Security & Trust Center** (`/app/frontend/src/components/SecurityTrustCenter.jsx`)
    - Trust Score calculation (Account, PRC, KYC, Active)
    - Expandable details (Last Login, Device, Location, KYC Status)
    - Backend API: `/api/user/security/{uid}`
  - **User Control Settings** (`/app/frontend/src/components/UserControlSettings.jsx`)
    - Pause Mining toggle
    - Daily PRC Cap options (Unlimited to 2000 PRC)
    - Utility Only Mode toggle
    - Notifications toggle
    - Backend API: `/api/user/settings/{uid}`
  - **Live Statement Export** (`/app/frontend/src/components/LiveStatementExport.jsx`)
    - PDF/CSV format selection
    - Period selection (7 days, 30 days, 3 months, 1 year)
    - Google compliant disclaimer header
    - Backend API: `/api/user/statement/{uid}`

### January 5, 2026 (Current Session - Part 4)
- ✅ **Dashboard Bug Fixes & Enhancements**
  - **Bill Pay button color**: Fixed from faded cyan to proper teal gradient
  - **Multi-language translations**: All dashboard text now translates (Quick Actions, Stats Cards, Bottom Nav, VIP Banner)
  - **AdMob Privacy Policy Compliance**: Added Section 9 "Advertising & Third-Party Services" with:
    - Mobile advertising disclosure
    - Personalized ads opt-out instructions (Android/iOS)
    - Third-party ad network links (Google AdMob, Unity Ads)
    - PRC earnings through ads disclosure

- ✅ **Homepage Multi-Language Support & AdMob Compliance**
  - **Language Selector** in navigation bar with EN/HI/MR options
  - **Full Homepage Translation**: Hero section, Features, Footer - all text translates
  - **Privacy Notice Banner**: Prominent banner in footer for AdMob compliance
  - **Advertising Policy Link**: Dedicated link in Legal section (highlighted in blue)
  - **Pages Updated**:
    - `/app/frontend/src/pages/RewardsHome.js` - Full translations with 30+ strings
    - `/app/frontend/src/pages/Mining.js` - Added language support
    - `/app/frontend/src/pages/Referrals.js` - Added language support  
    - `/app/frontend/src/pages/ProfileAdvanced.js` - Added language support

### January 5, 2026 (Current Session - Part 3)
- ✅ **User Dashboard Language Selector & Today Stats (TESTED - 9/9 Backend + All Frontend Tests Passed)**
  - **Multi-Language Support** in User Dashboard (`DashboardModern.js`):
    - Language selector dropdown in header (Globe icon)
    - Supports English, Hindi (हिंदी), Marathi (मराठी)
    - Language preference persists in localStorage
    - Default language: Marathi (mr)
  - **Today's Summary Strip** in Dashboard:
    - Shows "Today Earned" PRC with green up arrow
    - Shows "Today Spent" PRC with red down arrow
    - Labels translate based on selected language
  - **New Backend API**: `/api/user/stats/today/{uid}`
    - Returns today_prc_earned, today_prc_spent, today_net
    - Includes earning_breakdown and spending_breakdown by transaction type
    - Returns date in YYYY-MM-DD format
  - **Files Modified**:
    - Backend: `/app/backend/server.py` - New endpoint
    - Frontend: `/app/frontend/src/pages/DashboardModern.js`
    - Frontend: `/app/frontend/src/contexts/LanguageContext.js` (existing)
    - Frontend: `/app/frontend/src/locales/translations.js` (existing)
  - Test file: `/app/tests/test_dashboard_language_today_stats.py`

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
- **Dashboard Test User**: dashboard_test@test.com / test123

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

### Comprehensive Ledger APIs (Added Jan 6, 2026)
- `GET /api/admin/ledger/master-summary` - Overall financial summary (income, expense, P&L, PRC stats)
- `GET/POST /api/admin/ledger/cash` - Cash ledger entries with running balance
- `GET/POST /api/admin/ledger/bank` - Bank ledger entries with running balance
- `GET/POST /api/admin/ledger/subscription-income` - VIP/Premium subscription income
- `GET/POST /api/admin/ledger/commission-income` - Commission from recharges, bills, products
- `GET/POST /api/admin/ledger/penalty-income` - Penalty/forfeit PRC income
- `GET/POST /api/admin/ledger/interest-income` - Interest income from capital
- `GET/POST /api/admin/ledger/ad-revenue` - AdMob/Unity ad revenue
- `GET/POST/PUT /api/admin/ledger/redeem-payout` - Redemption payouts with status
- `GET/POST /api/admin/ledger/expenses` - Operational expenses (server, SMS, salary, etc.)
- `GET/POST /api/admin/ledger/deposits` - Stockist deposits (received, renewed, refunded)
- `POST /api/admin/ledger/deposits/{id}/refund` - Process deposit refund
- `GET/POST /api/admin/ledger/renewal-fees` - Renewal fee income
- `GET /api/admin/ledger/mobile-recharge` - Mobile recharge ledger (auto-populated)
- `GET/POST /api/admin/ledger/product-purchase` - Product purchase ledger
- `GET /api/admin/ledger/daily-cash-bank-summary` - Daily cash/bank reconciliation
- `POST /api/admin/ledger/daily-cash-bank-summary/generate` - Generate daily summary
- `GET /api/admin/ledger/profit-loss-summary` - P&L summaries
- `POST /api/admin/ledger/profit-loss-summary/generate` - Generate P&L summary
- `GET /api/admin/ledger/balance-sheet` - Balance sheet with assets, liabilities, equity

### Accounting APIs (Added Jan 5, 2026)
- `GET /api/admin/accounting/master-dashboard` - Complete accounting overview
- `GET /api/admin/accounting/prc-mint-ledger` - PRC inflow ledger
- `GET /api/admin/accounting/prc-burn-ledger` - PRC outflow ledger
- `GET /api/admin/accounting/liability-ledger` - INR liability with ageing
- `GET /api/admin/accounting/reserve-fund` - Reserve fund status
- `POST /api/admin/accounting/reserve-fund/add` - Add to reserve fund
- `POST /api/admin/accounting/reserve-fund/settings` - Update reserve %
- `GET /api/admin/accounting/conversion-rate` - Get conversion rate history
- `POST /api/admin/accounting/conversion-rate` - Update conversion rate
- `GET /api/admin/accounting/daily-summary` - Get daily summaries
- `POST /api/admin/accounting/daily-summary/generate` - Trigger summary generation
- `GET /api/admin/accounting/user-cost-analysis` - Loss-making users analysis
- `GET /api/admin/accounting/settings` - Get accounting settings
- `POST /api/admin/accounting/settings` - Update accounting settings
- `POST /api/admin/accounting/burn-inactive-prc` - Trigger 180-day burn

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
