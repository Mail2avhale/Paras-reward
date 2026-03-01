# PARAS REWARD - Product Requirements Document

## Latest Updates (March 1, 2026)

### ✅ PAYMENT GATEWAY TOGGLE FEATURE - COMPLETE
- **Admin Settings Page:** Added Payment Gateway Controls section
- **Razorpay Toggle:** Enable/Disable Razorpay online payments
- **Manual UPI Toggle:** Enable/Disable Manual UPI/Bank Transfer option
- **Admin PIN Required:** Both toggles require PIN (123456) for security
- **Frontend Integration:** SubscriptionPlans.js shows/hides options based on toggle status

### ✅ PRC COLLECT BUTTON FIX - COMPLETE
- **Free Users:** explorer, free, empty, null plan types cannot collect PRC
- **Upgrade Prompt:** Shows "Upgrade to Collect PRC!" message instead of collect button
- **Mining Page:** Properly handles all free user types

### ✅ RAZORPAY LIVE INTEGRATION - COMPLETE
- **Live Key:** `rzp_live_SLaUMsGWw4ga78`
- **Auto Subscription Activation:** Payment success → Subscription immediately active
- **No Manual Approval Required:** Instant activation

### ✅ ADMIN BILL PAYMENT FLOW - COMPLETE
- **No Auto-Reject:** Eko fails → `eko_failed` status
- **Admin Options:** Retry / Complete Manually / Reject
- **PRC Refund:** Only on admin reject

---

## SUBSCRIPTION PAYMENT FLOW

```
User → Select Plan → Select Duration → Payment Options:

┌─────────────────────────────────────────────────────────────┐
│ Option 1: 💳 ONLINE PAYMENT (Razorpay) ⚡ INSTANT           │
│   • UPI, Cards, Net Banking, Wallets                        │
│   • Subscription activates IMMEDIATELY                       │
│   • Secure via Razorpay                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Option 2: 🏦 MANUAL UPI/BANK TRANSFER                       │
│   • Pay via UPI ID or Bank Account                          │
│   • Upload screenshot + UTR                                 │
│   • Admin approval required (24hr)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## KEY INTEGRATIONS

### Razorpay (LIVE)
- Key ID: `rzp_live_SLaUMsGWw4ga78`
- Features: Orders, Payments, Verification
- Status: ✅ Production Ready

### Eko.in (BBPS + DMT)
- Status: ⚠️ Needs IP Whitelisting
- Production IP required from DigitalOcean

---

## PENDING TASKS

### P0 - Production Deployment
- [ ] Guide user to deploy latest code to parasreward.com
- [ ] Ensure LIVE Razorpay keys are used in production
- [ ] Data restoration for affected users (PRC balance, plans)

### P1 - Post-Deployment
- [ ] Eko IP whitelisting (production server IP needed)
- [ ] Domain SSL setup
- [ ] MongoDB Atlas connection verification
- [ ] Generate AAB file for Play Store submission

### P2 - Performance
- [ ] Admin pages timeout issue - refactor Python loops to MongoDB aggregations
- [ ] Server-side search implementation
- [ ] Team/Level members display fix

### P3 - Future Enhancements
- [ ] Email/Mobile OTP verification on signup
- [ ] KYC/Receipt image migration to file storage
- [ ] Refactor backend/server.py into modules

---

## CREDENTIALS

### Razorpay (LIVE)
- Key ID: `rzp_live_SLaUMsGWw4ga78`
- Secret: `35NF2eDT5payXgk8831MT9d6`

### Admin
- UID: `8175c02a-4fbd-409c-8d47-d864e979f59f`
- PIN: `123456`

---

**Language:** Marathi (मराठी)
