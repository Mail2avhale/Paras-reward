# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 5 April 2026

## COMPLETED: Total Redeem Limit Formula Change (P0) - 5 April 2026

### Change
**OLD**: `TOTAL LIMIT = total_earned × (unlock% / 100)` where `total_earned = total_mined - total_redeemed`
**NEW**: `TOTAL LIMIT = total_mined × (unlock% / 100)`

### Why
The old formula had a "shrinking limit" problem — as users redeemed PRC, their `total_earned` decreased, which decreased the TOTAL LIMIT, making it progressively harder to redeem. The new formula bases the limit on `total_mined` (only grows), preventing this.

### Impact (Example: Santosh, 62.51% unlock)
- OLD TOTAL LIMIT: 267,250 → NEW: 291,659 (+24,408 PRC)
- OLD REMAINING: 228,203 → NEW: 252,612

### File Modified
- `/app/backend/server.py` — `calculate_user_redeem_limit()` function (single source of truth)

## COMPLETED: Redeem Used Details Page Fix (P0) - 5 April 2026
- Fixed mismatch: usage-history now queries 17 service collections (same as dashboard)

## COMPLETED: Code Quality Fixes - 5 April 2026
- Circular imports, undefined vars (36→0), mutable defaults, random→secrets, localStorage sanitization

## COMPLETED: PRC Dynamic Rate Fix - 5 April 2026
## COMPLETED: Deep Transaction Investigation - 5 April 2026
## COMPLETED: Core Formula System Audit - 4 April 2026

## Upcoming
- P1: Invoice PDF Download option for InvoiceModal.js

## Future/Backlog
- P2: Split oversized React components
- P2: server.py refactoring (45k+ lines)
- P3: MongoDB → PostgreSQL migration
