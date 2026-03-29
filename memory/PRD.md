# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 29 March 2026

## COMPLETED: Production 520 Error Fix (P0 CRITICAL) - 29 March 2026
- **Root Cause**: `.env` files were committed to git with `MONGO_URL="mongodb://localhost:27017"`. When deployed, the committed `.env` file overwrote the Emergent-generated `.env` (which contains the Atlas connection string from System Keys), causing the backend to connect to a non-existent local MongoDB.
- **Fix Applied**:
  - Removed ALL `.env` files from git tracking (`git rm --cached`)
  - Added `.env` to `.gitignore` to prevent future commits
  - Made `load_dotenv()` conditional (only loads if `.env` file exists)
  - Added `/api/health/debug` endpoint for production diagnostics
- **Result**: Production backend now responds 200 OK with MongoDB Atlas connected
- **Verification**: `https://www.parasreward.com/api/health` returns healthy

## COMPLETED: Crash-Proof Startup (Previous Session) - 28 March 2026
- Made `startup_db` non-blocking using `asyncio.create_task`
- Wrapped `emergentintegrations` and `razorpay` imports in `try/except`
- Removed missing compressors (`snappy`, `zstd`) from MongoDB options

## COMPLETED: Fix Double Breakdown + Burning Consistency - 28 March 2026
- Removed double breakdown from BankRedeemPage and RedeemPageV2
- Added burning to Gift Voucher Order Summary
- Subscription page shows burn rate based on user's subscription_payment_type

## COMPLETED: Subscription + Redeem Burning Formula - 28 March 2026
- Rs999 + 18% GST + Rs10 Processing + 20% Admin + Burning (PRC: 5%, Cash: 1%)

## COMPLETED: Referral Active/Inactive Status - 28 March 2026
## COMPLETED: Mining Formula Math Fix - 28 March 2026
## COMPLETED: PRC Statement, MLM Cleanup, Bank Redeem 28-Day, Explorer Mining, DB Caching

## Pricing Formula
Rs999 + 18% GST = Rs1178.82 base
+ Rs10 Processing Fee
+ 20% Admin on (base_prc + processing_prc)
+ Burning (PRC: 5%, Cash: 1%) on total_before_burn
= Final PRC Amount

## TWO-PLAN SYSTEM
| Feature | Cash Subscription | PRC Subscription |
|---------|------------------|------------------|
| Mining Speed | 100% | 70% |
| Burn Rate | 1% | 5% |

## Upcoming
- P1: Razorpay pricing update (Rs999 + GST) - April 1, 2026
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
