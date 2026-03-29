# PARAS REWARD - Product Requirements Document

## LAST UPDATED - 29 March 2026

## COMPLETED: Production 520 Error Fix (P0) - 29 March 2026
## COMPLETED: Single Leg Tree + Mining - 29 March 2026
## COMPLETED: Growth Network UI - 29 March 2026

## COMPLETED: Subscription & Redeem Economy Rules (P0) - 29 March 2026
- Explorer=Free, Elite(Cash)=₹999+GST/100% speed/1% burn, Elite(PRC)=70% speed/5% burn
- Burn on ALL redeem: Subtotal = Amount + ₹10 + 20% Admin; Burn = rate% × Subtotal; Total = Subtotal + Burn

## COMPLETED: Razorpay Pricing Active - 29 March 2026
- ₹999 + 18% GST = ₹1178.82. All Razorpay flows set `subscription_payment_type: "cash"`

## COMPLETED: Burn Rate Breakdown Frontend - 29 March 2026
- All 3 redeem pages (Redeem, Bank, GiftVoucher) show burn line

## COMPLETED: PRC Subscription Burn Rate + Dynamic PRC Rate - 29 March 2026
- **Added 5% burn to PRC subscription pricing**: 
  - Base: 12,967 PRC + Processing: 110 + Admin(20%): 2,615 = 15,692 subtotal
  - Burn (5%): +785 PRC → **Total: 16,477 PRC**
- **Removed ALL hardcoded PRC rate = 10** from frontend:
  - `SubscriptionPlans.js`, `RedeemPageV2.js`, `GiftVoucherRedemption.js`, `DashboardModern.js`, `PRCRateDisplay.js`
  - All now use `useState(null)` and fetch from public `/api/prc-economy/current-rate` (rate=11)
- **Fixed PRCRateDisplay component**: Public 3-level fallback, correct admin charge on amount only
- Testing: iteration 162 (17/17 PASS)

## Active Architecture
- Mining: (500 + N×prc_per_user) × boost (Cash=1.0, PRC=0.70)
- Burn: Cash=1%, PRC=5% of (Amount + Processing + Admin)
- Razorpay: ₹999 + 18% GST = ₹1178.82
- PRC subscription: 16,477.05 PRC (with 5% burn, dynamic rate=11)
- PRC rate: Dynamic from `/api/prc-economy/current-rate`

## Upcoming
- P2: server.py refactoring (45k+ lines)
- Future: MongoDB to PostgreSQL migration
