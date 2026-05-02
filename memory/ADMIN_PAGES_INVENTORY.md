# Admin Pages Inventory — May 2, 2026
Total: ~95 admin routes. Below grouped by usage frequency category. **तुम्ही चिन्ह करा कोणते optimize करायचे.**

---

## 🔴 CATEGORY A — Daily Critical (Highest Traffic)
हे pages admin team रोज वारंवार वापरतो — performance + zero-error MUST.

| # | Route | Page | वापर |
|---|-------|------|------|
| 1 | `/admin` (dashboard) | AdminDashboard | Login झाल्यावर पहिलंच पान — stats, paid subs, mining, revenue overview |
| 2 | `/admin/subscriptions` | AdminSubscriptionManagement | Manual Razorpay/UTR approve, reject, edit user subscription (✅ optimized) |
| 3 | `/admin/user360` | AdminUser360New | User search → 360° view (✅ optimized) |
| 4 | `/admin/pending-requests` | AdminPendingRequests | All pending redeems/payments queue |
| 5 | `/admin/bbps` / `/admin/bbps-requests` | BBPS recharge requests | DTH, electricity, mobile recharge approvals |
| 6 | `/admin/bank-transfers` | Bank Redeem requests | Manual bank transfer queue |
| 7 | `/admin/dmt` / `/admin/dmt-transactions` | DMT money transfer | Eko DMT transactions |
| 8 | `/admin/gift-vouchers` | Gift Voucher requests | Voucher redemption queue |
| 9 | `/admin/failed-transactions` | Failed/refund queue | User issue resolution |
| 10 | `/admin/transaction-manager` | Transaction Manager | Master ledger view |

---

## 🟡 CATEGORY B — Weekly Usage (Medium Traffic)
Operational reviews, finance team weekly tasks.

| # | Route | Page | वापर |
|---|-------|------|------|
| 11 | `/admin/analytics` | AdminAnalytics | Revenue, growth, user analytics |
| 12 | `/admin/prc-analytics` | PRC Analytics | PRC mining/burn/redeem stats |
| 13 | `/admin/kyc` | KYC | KYC verification queue |
| 14 | `/admin/fraud-alerts` / `/admin/fraud-dashboard` | Fraud monitoring | Fraud signal review |
| 15 | `/admin/orders` | Orders | Shop orders |
| 16 | `/admin/members` | Members Dashboard | All paid members list |
| 17 | `/admin/razorpay-subscriptions` | Razorpay Subs | Auto-payment subscriptions |
| 18 | `/admin/vip-verification` | VIP verification | Manual VIP approvals |
| 19 | `/admin/user-ledger` | User-specific ledger | PRC ledger by user |
| 20 | `/admin/prc-ledger` | Global PRC ledger | All PRC transactions |
| 21 | `/admin/community` | Community moderation | Forum posts |
| 22 | `/admin/support` | Support tickets | User support queue |
| 23 | `/admin/contact-submissions` | Contact form submissions | Inquiries |
| 24 | `/admin/popup-messages` | Popup announcements | Push to all users |
| 25 | `/admin/eko-services` | Eko BBPS services config | API status / margin |
| 26 | `/admin/bulk-refund-otp` | Bulk refund tool | Mass refund operations |

---

## 🟢 CATEGORY C — Monthly / Periodic (Finance & HR)
End-of-month, audits, accounting team.

| # | Route | Page | वापर |
|---|-------|------|------|
| 27 | `/admin/accounting` | Accounting Dashboard | Monthly close |
| 28 | `/admin/profit-loss` | P&L statement | Monthly P&L |
| 29 | `/admin/cash-bank-book` | Cash & Bank Book | Cash flow |
| 30 | `/admin/trial-balance` | Trial Balance | Audit |
| 31 | `/admin/financial-reports` | Financial Reports | Reports export |
| 32 | `/admin/financial-ratios` | Financial Ratios | KPIs |
| 33 | `/admin/accounts-receivable` | A/R | Invoices outstanding |
| 34 | `/admin/accounts-payable` | A/P | Vendor payments |
| 35 | `/admin/gst-report` | GST Report | GST filing |
| 36 | `/admin/fixed-expenses` | Fixed Expenses | Recurring costs |
| 37 | `/admin/capital-management` | Capital Mgmt | Equity tracking |
| 38 | `/admin/liquidity` | Liquidity | Cash position |
| 39 | `/admin/employees` / `/admin/employees/reports` | HRMS | Salary/attendance |
| 40 | `/admin/performance-report` | Performance | Employee KPIs |
| 41 | `/admin/holidays` | Holiday calendar | HR calendar |
| 42 | `/admin/careers` | Careers | Job posts |
| 43 | `/admin/investors` | Investors | Investor data |
| 44 | `/admin/core-team` | Core Team | Core team members |
| 45 | `/admin/company-wallets` | Company Wallets | Internal wallets |
| 46 | `/admin/ads-income` | Ads Income | Ad revenue |
| 47 | `/admin/prc-economy` | PRC Economy | PRC economic dashboard |
| 48 | `/admin/prc-rate-control` | PRC Rate Control | PRC pricing |

---

## ⚪ CATEGORY D — Settings & Configuration (Rare)
Setup-time, occasional tweaks.

| # | Route | Page | वापर |
|---|-------|------|------|
| 49 | `/admin/settings-hub` | Settings Hub | Master settings |
| 50 | `/admin/settings/system` | System Settings | App-wide config |
| 51 | `/admin/settings/web` | Web Settings | Frontend config |
| 52 | `/admin/settings/social` | Social Links | Footer/social |
| 53 | `/admin/settings/redeem` | Redeem Settings | Min/max limits |
| 54 | `/admin/economy-settings` | Economy Settings | PRC rates etc |
| 55 | `/admin/contact-settings` | Contact info | Public contact |
| 56 | `/admin/service-charges` | Service Charges | Fee config |
| 57 | `/admin/service-toggles` | Service On/Off | Feature flags |
| 58 | `/admin/policies` | Policies | TnC, Privacy |
| 59 | `/admin/marketplace` | Marketplace | Shop config |
| 60 | `/admin/delivery-partners` | Delivery partners | Logistics |
| 61 | `/admin/video-ads` | Video Ads | Ad video upload |
| 62 | `/admin/data-backup` | Data Backup | DB backups |
| 63 | `/admin/force-activate-subscription` | Force Activate | Manual override |
| 64 | `/admin/audit` | Audit Service | Self-audit run |
| 65 | `/admin/security` | Security Dashboard | Security events |
| 66 | `/admin/error-monitor` | Error Monitor | App errors |
| 67 | `/admin/health-check` | Health Check | System health |
| 68 | `/admin/web-vitals` | Web Vitals | Frontend perf |
| 69 | `/admin/chatbot-withdrawals` | Chatbot withdrawals | Chatbot operations |
| 70 | `/admin/dmt-refunds` | DMT Refunds | DMT failures |

---

## 📋 तुम्ही कसं सांगायचं

मला reply करा अशा format मध्ये:
- `A सगळे` → Category A चे सगळे 10 pages optimize करा
- `A 1,2,5,9` → Category A मधले फक्त हे numbers
- `A सगळे + B 11,13,18` → A चे सगळे + B चे काही specific
- किंवा priority list द्या: `1, 4, 5, 11, 12...`

प्रत्येक page साठी मी हे करेन:
1. Page लोड करताना कोणत्या API endpoints हिट होतात ते check
2. Sequential queries → `asyncio.gather` (parallelize)
3. Missing MongoDB indexes add (auto-startup)
4. Heavy aggregations → cache layer (Redis/in-mem with appropriate TTL)
5. Frontend: stale state clear on tab change + actionable error toasts
6. Curl-test timing (preview) before/after

**तुम्ही कोणते pages priority म्हणून सांगाल ते मला सांगा.**
