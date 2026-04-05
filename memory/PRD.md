# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 5 April 2026

## COMPLETED: PRC Dynamic Rate Inconsistency Bug Fix (P0) - 5 April 2026

### Bug Description
Users seeing different PRC rates in production. Critical economy bug.

### Root Cause (Deep Investigation)
**5 different rate functions** reading from **different DB collections** with **different fallback chains**:

| Function | Location | Default | Bug |
|---|---|---|---|
| `get_dynamic_prc_rate()` | server.py | 10 | Multiple fallback sources |
| `get_config()` | manual_bank_transfer.py | 10 | Own calculation logic |
| `get_dynamic_prc_rate()` | manual_bank_transfer.py | 10 | Own fallback chain |
| `get_dynamic_prc_rate()` | bank_redeem.py | **100** | **CRITICAL: 10x wrong default!** |
| `get_dynamic_rate_sync()` | prc_economy.py | 10 | Creates new MongoClient per call |
| `get_dynamic_prc_rate()` | growth_economy.py | 10 | Own cache + calculation |

Additional issues:
- `system_settings.prc_dynamic_rate.updated_at` was 3+ weeks stale
- `get_dynamic_rate_sync()` created new MongoClient connection per call (expensive)
- Different collections used as fallbacks: `app_settings`, `system_settings`, `dmt_settings`, `economy_settings`

### Fix Applied
**Single Source of Truth**: `utils/helpers.py` → `get_prc_rate(db)` and `get_prc_rate_sync()`

Priority chain:
1. Manual override (`app_settings.prc_rate_manual_override`) — if enabled, not expired
2. Cached rate (`system_settings.prc_dynamic_rate`) — if < 5 min old
3. Fresh calculation (`prc_economy.calculate_dynamic_prc_rate`) — saves to DB
4. Any stored rate (even stale) — last resort before default
5. Default: 10

All 6 duplicate functions now delegate to this single function.

### Files Modified
- NEW: `utils/helpers.py` — `get_prc_rate()`, `get_prc_rate_sync()` 
- `server.py` — `get_dynamic_prc_rate()` → delegates to helpers (marked DEPRECATED)
- `bank_redeem.py` — **Fixed 100 default!** Now delegates to helpers
- `manual_bank_transfer.py` — Both rate functions + `/config` endpoint delegate to helpers
- `growth_economy.py` — `get_dynamic_prc_rate()` delegates to helpers
- `prc_economy.py` — Both `get_dynamic_prc_rate_economy()` and `get_dynamic_rate_sync()` delegate to helpers

### Verification
12/12 tests passed. All 7 rate endpoints return consistent value of 11.

## COMPLETED: Deep Transaction Investigation (100% Coverage) - 5 April 2026
- 30+ prc_balance modification points traced, 11 gaps fixed
- PRC Statement: 4 sources, soft-delete filter, determine_credit() bug fixed
- Admin Transaction Manager UI: CRUD + Refund + Restore

## COMPLETED: Core Formula System Audit - 4 April 2026
- 5 formulas audited: Subscription, Mining (BASE=1000), Redeem (total_mined), Network, PRC Dynamic
- All consolidated and de-duplicated

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js
- P2: server.py refactoring (45k+ lines monolith)
- P2: 218 React hook dependency warnings
- P2: Split large frontend components
- P3: MongoDB → PostgreSQL migration
