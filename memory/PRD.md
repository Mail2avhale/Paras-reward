# PARAS REWARD - Product Requirements Document

## Latest Updates (March 1, 2026)

### ✅ ADVANCED SORTING & FILTERING - COMPLETE
- **Admin Subscriptions Page (AdminSubscriptionManagement.js):** Enhanced with comprehensive filtering
  - Sort By: Submit Date, Process Date, Amount
  - Sort Order: Latest First / Oldest First toggle
  - Plan Filter: All Plans, Startup, Growth, Elite
  - Subscription Type Filter: New, Renewal, Upgrade, Downgrade
  - Amount Range Filter: Min/Max inputs with presets (≤₹999, ₹1K-3K, ≥₹3K)
  - Processed By Filter: Shows for Approved/Rejected tabs only
  - Active Filters Summary: Shows filter badges with remove option
  - Clear All Filters button
- **Admin Bill Payments Page (AdminBillPayments.js):** Already has advanced filtering
  - Status, Date Range, Amount, Admin filters
  - Sorting by created_at, approved_at, rejected_at, amount

### ✅ EKO INTEGRATION COMPLETE - STANDARDIZED
- **New Eko Service Module:** `/app/backend/services/eko_service.py`
- **Proper HMAC SHA256 Authentication:** As per Eko documentation
- **Transaction Status Codes:** 0=Success, 1=Failed, 2=Initiated, 3=Refund Pending, 4=Refunded, 5=Hold
- **Real-time Status Updates:** Background job every 5 minutes
- **Admin APIs:** Status check, Sync pending, Verify account, Transaction logs
- **Error Handling:** Comprehensive error codes and retry mechanism

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

## EKO INTEGRATION ARCHITECTURE

### Service Module: `/app/backend/services/eko_service.py`
```
EkoConfig      - Configuration management
EkoAuth        - HMAC SHA256 authentication
EkoService     - Main API service class
EkoStatusUpdater - Background status sync
```

### API Endpoints:
- `GET /api/eko/admin/status` - Integration status & wallet balance
- `GET /api/eko/admin/transaction/{id}` - Check transaction status
- `POST /api/eko/admin/sync-pending` - Manual sync of pending transactions
- `POST /api/eko/admin/verify-account` - Verify bank account
- `GET /api/eko/admin/logs` - Transaction audit logs
- `GET /api/eko/status-codes` - Status codes reference

### Transaction Status Flow:
```
Initiate → tx_status=2 (Initiated)
    ↓
Poll Status (every 5 min)
    ↓
tx_status=0 (Success) → Complete
tx_status=1 (Failed) → Refund Process
tx_status=3 → Refund Pending
tx_status=4 → Refunded
tx_status=5 → Manual Review
```

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
- Status: ⚠️ Needs **Production Server IP** Whitelisting
- Integration: ✅ Complete with proper authentication
- Note: Will work only when IP is whitelisted by Eko

---

## PENDING TASKS

### P0 - Production Deployment
- [ ] Guide user to deploy latest code to parasreward.com
- [ ] Ensure LIVE Razorpay keys are used in production
- [ ] Data restoration for affected users (PRC balance, plans)
- [ ] **Get Emergent/Production Server IP for Eko whitelisting**

### P1 - Post-Deployment
- [ ] Eko IP whitelisting with production IP
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
