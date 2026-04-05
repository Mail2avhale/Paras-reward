# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 5 April 2026

## COMPLETED: Deep Transaction Investigation (100% Coverage) - 5 April 2026

### Investigation Summary
Traced ALL 30+ `prc_balance` modification points across 15+ backend files.

### Fixes Applied (Chronological):

**Phase 1 — Initial 4 Missing Records:**
| Source | Issue | Fix |
|---|---|---|
| Daily Streak First Login | 5 PRC, no record | Added transactions.insert_one() |
| EKO Callback DMT Refund | PRC refunded, no record | Added transactions.insert_one() |
| Gift Subscription | 600 PRC deducted, embedded array only | Added transactions.insert_one() |
| Fix Negative Balance | Balance reset, audit_log only | Added transactions.insert_one() |

**Phase 2 — balance_after Accuracy:**
| Source | Issue | Fix |
|---|---|---|
| Daily Streak (first login) | balance_after: 0 | Now fetches updated balance after $inc |
| Daily Streak (subsequent) | balance_after: 0 | Now fetches updated balance after $inc |
| EKO Callback Refund | Missing balance_after | Now fetches updated balance |

**Phase 3 — Bulk/Diagnose Missing Records:**
| Source | Issue | Fix |
|---|---|---|
| Bulk Fix - Voucher Refund | prc_balance update, no record | Added transactions.insert_one() |
| Bulk Fix - Bank Transfer Refund | prc_balance update, no record | Added transactions.insert_one() |
| Bulk Fix - Balance Restore | prc_balance update, no record | Added transactions.insert_one() |
| Diagnose - Voucher Refund | prc_balance update, no record | Added transactions.insert_one() |
| Diagnose - Balance Restore | prc_balance update, no record | Added transactions.insert_one() |

**Phase 4 — PRC Statement Fixes:**
| Issue | Fix |
|---|---|
| Missing prc_transactions source | Added as 4th collection source |
| Soft-delete not filtered | All 4 sources now filter deleted:true |
| determine_credit() bug | entry_type priority over amount sign |
| 7 missing TYPE_MAP entries | Added daily_streak, achievement, dmt_refund, etc. |

### Verified Complete (No Missing Records):
- Mining collect ✅, Subscription PRC payment ✅, Admin PRC adjustment ✅
- Bank redeem ✅, Bill payment ✅, Voucher redeem ✅, Unified redeem ✅
- Admin subscription refund ✅, Admin order refund ✅, Bulk reject ✅
- Achievement rewards ✅, Auto-burn ✅, Cleanup refund ✅
- Admin restore ✅, Admin bulk operations ✅

## COMPLETED: Admin Transaction Manager UI - 5 April 2026
- Route: `/admin/transaction-manager`
- Features: Search by UID, type filter, View/Edit/Delete/Refund/Restore
- Backend: Full CRUD + audit logging across 4 collections

## COMPLETED: Core Formula System Audit - 4 April 2026
1. Subscription Active/Inactive — Consolidated in helpers.py
2. Mining Formula — BASE_MINING=1000, threshold=250
3. Redeem Formula — `total_earned = total_mined - total_redeemed`
4. Network Formula — Verified clean
5. PRC Dynamic — Verified clean

## Earlier Completed Work
- Redeem Limit Status Filter Fix, Subscription Desync Bug Fix
- Bulletproof Active/Inactive Detection, Wrongful Burning Fix
- All production fixes 29 Mar - 3 Apr

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js
- P2: server.py refactoring (45k+ lines monolith)
- P2: 218 React hook dependency warnings
- P2: Split large frontend components
- P3: MongoDB → PostgreSQL migration
