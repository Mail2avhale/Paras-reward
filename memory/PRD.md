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

### P0 - Deployment
- [ ] DigitalOcean account create
- [ ] Droplet setup (Mumbai BLR1)
- [ ] Get production IP
- [ ] Eko IP whitelisting

### P1 - Production Checklist
- [x] Razorpay Live keys ✅
- [x] Auto subscription activation ✅
- [ ] Domain SSL setup
- [ ] MongoDB Atlas connection

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
