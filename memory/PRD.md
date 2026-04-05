# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 5 April 2026

## COMPLETED: Code Quality Fixes (Critical + Important) - 5 April 2026

### Fixes Applied
1. **Circular Import Resolution** — `helpers.py ↔ prc_economy.py` fixed using callback registration pattern (`register_rate_calculator`)
2. **Hardcoded Secrets Removed** — 4 test files now use `os.environ.get()` for credentials
3. **Mutable Default Arguments** — Fixed `log_transaction()` and `log_activity()` in `server.py` (`metadata: Dict = {}` → `metadata: Optional[Dict] = None`)
4. **Dead Code Removed** — 108+ lines of unreachable code after return statements cleaned up
5. **Undefined Variables** — 36 instances → 0 (sync_db→async, EKO vars from env, dead code removed, deprecated function references)
6. **random → secrets** — PIN generation in `admin_user360.py` + activity feed in `server.py` now use `secrets` module
7. **localStorage Sanitization** — `hashed_pin`, `pin_hash`, `password` stripped before persisting to localStorage
8. **Math.random → crypto.randomUUID** — InvoiceModal.js invoice number generation
9. **Unused Imports Cleaned** — `random`, `timedelta`, `bcrypt` top-level imports removed where unused

### XSS Status
- `BlogArticle.js` — Already uses DOMPurify ✅
- `AdminRazorpaySubscriptions.js` — Already sanitizes user data with DOMPurify ✅
- `InvoiceModal.js` — Already sanitizes via `DOMPurify.sanitize(content.innerHTML)` ✅

### `is` vs `==` Status
- All flagged instances were legitimate `is None` checks ✅ (no fix needed)

### Hook Dependencies Status
- Critical files (AdminMembers, AdminBankTransfers, AdminSubscriptionManagement) already have comprehensive dependency arrays ✅

### Verification
- Backend: 11/11 tests passed (iteration 181)
- Frontend: All UI flows verified

## COMPLETED: PRC Usage History Page (P0) - 5 April 2026
- Backend endpoint + Frontend Recharts UI + Dashboard "Used >" clickable link
- Testing: 100% pass (iteration 180)

## COMPLETED: PRC Dynamic Rate Fix (P0) - 5 April 2026
- Single Source of Truth in `utils/helpers.py`

## COMPLETED: Deep Transaction Investigation - 5 April 2026
- 30+ prc_balance modification points traced, 11 gaps fixed

## COMPLETED: Core Formula System Audit - 4 April 2026
- 5 formulas audited and de-duplicated

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js

## Future/Backlog
- P2: Split oversized React components (AdminAccountingDashboard 1123 lines, AdminBankTransfers 1085 lines, etc.)
- P2: Array index as key (86 instances) — systematic sweep
- P2: server.py refactoring (45k+ lines monolith)
- P2: 218 React hook dependency warnings (most are benign useEffect mount patterns)
- P3: MongoDB → PostgreSQL migration
