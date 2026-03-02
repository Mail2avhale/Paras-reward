# PARAS REWARD - Product Requirements Document

## Latest Updates (March 2, 2026)

### ✅ EKO BBPS LIVE OPERATORS INTEGRATION - COMPLETE
- **New BBPS Operators Endpoint:** `GET /api/eko/bbps/operators/{service_type}`
- **Supported Services:** electricity, gas, lpg, dth, mobile_prepaid, mobile_postpaid, credit_card, loan_emi, insurance, fastag, water, broadband
- **Live Data from Eko API:** All operators fetched dynamically from Eko BBPS
- **Frontend Integration:** BillPayments.js updated with dynamic operator dropdowns
- **Electricity:** 89 live operators
- **Gas:** 29 live operators  
- **LPG:** 3 operators (Indane, HP Gas, Bharat Gas)
- **DTH:** 5 operators
- **Loan/EMI:** 294 lenders/banks
- **Credit Card:** 29 banks
- **Insurance:** 40 providers
- **FASTag:** 20 providers

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

### ✅ EKO INTEGRATION - STANDARDIZED
- **Eko Service Module:** `/app/backend/services/eko_service.py`
- **Proper HMAC SHA256 Authentication:** Base64 encode key first (as per Eko Java/PHP docs)
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

## EKO BBPS OPERATOR CATEGORIES (Eko API)

| Category ID | Service Type      | Count |
|-------------|-------------------|-------|
| 1           | Broadband         | 92    |
| 2           | Gas (PNG)         | 29    |
| 4           | DTH               | 5     |
| 5           | Mobile Prepaid    | 6     |
| 7           | Credit Card       | 29    |
| 8           | Electricity       | 89    |
| 9           | Landline          | 5     |
| 10          | Mobile Postpaid   | 7     |
| 11          | Water             | 54    |
| 18          | LPG               | 3     |
| 20          | Insurance         | 40    |
| 21          | Loan/EMI          | 294   |
| 22          | FASTag            | 20    |

---

## EKO INTEGRATION ARCHITECTURE

### API Endpoints:
- `GET /api/eko/bbps/operators/{service_type}` - Get live operators for service
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
- **Authentication:** ✅ Fixed (HMAC SHA256 with Base64 encoded key)
- **Services Activated:** BBPS, DMT, Settlement, AePS
- **Balance Check:** ✅ Working (₹9,845.24 available)
- **Operators API:** ✅ Live data from Eko
- **Transactional API:** ⚠️ May need production IP whitelisting
- Status: ✅ Authentication working, awaiting production deployment for full testing

---

## PENDING TASKS

### P0 - Critical
- [ ] Test Eko transactional APIs after production deployment
- [ ] Fix any remaining "No key for Response" errors

### P1 - Production Deployment
- [ ] Guide user to deploy latest code to parasreward.com
- [ ] Ensure LIVE Razorpay keys are used in production
- [ ] Data restoration for affected users (PRC balance, plans)
- [ ] **Get Emergent/Production Server IP for Eko whitelisting**

### P2 - Post-Deployment & Performance
- [ ] Admin pages timeout issue - refactor Python loops to MongoDB aggregations
- [ ] Server-side search implementation (Currently frontend filtering)

### P3 - Known Issues
- [ ] Team/Level members display fix
- [ ] Search functionality reliability improvement

### P4 - Future Enhancements
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

### Eko
- Wallet Balance: ₹9,845.24
- Services: BBPS, DMT, Settlement, AePS

---

**Language:** Marathi (मराठी)
