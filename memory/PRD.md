# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 28 March 2026

## COMPLETED: Fix Double Breakdown + Burning Consistency - 28 March 2026
- Removed double breakdown from BankRedeemPage (removed old "Fee Breakdown", kept PRCRateDisplay)
- Removed double breakdown from RedeemPageV2 (removed PRCRateDisplay, kept "Charge Breakdown" with burning)
- Added burning to Gift Voucher Order Summary (with burn_rate from subscription type)
- Subscription page now shows burn rate based on user's subscription_payment_type (Cash=1%, PRC=5%)
- All redeem APIs pass payment_type for correct burn rate calculation

## COMPLETED: Subscription + Redeem Burning Formula - 28 March 2026
- ₹999 + 18% GST + ₹10 Processing + 20% Admin + Burning (PRC: 5%, Cash: 1%)
- Admin changed from 100% → 20%, Dynamic PRC rate
- Burning applied to all redeem requests

## COMPLETED: Referral Active/Inactive Status - 28 March 2026
## COMPLETED: Mining Formula Math Fix - 28 March 2026
## COMPLETED: PRC Statement, MLM Cleanup, Bank Redeem 28-Day, Explorer Mining, DB Caching

## Pricing Formula
₹999 + 18% GST = ₹1178.82 base
+ ₹10 Processing Fee
+ 20% Admin on (base_prc + processing_prc)
+ Burning (PRC: 5%, Cash: 1%) on total_before_burn
= Final PRC Amount

## TWO-PLAN SYSTEM
| Feature | Cash Subscription | PRC Subscription |
|---------|------------------|------------------|
| Mining Speed | 100% | 70% |
| Burn Rate | 1% | 5% |

## Upcoming
- P1: Razorpay pricing update (₹999 + GST) - April 1, 2026
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
