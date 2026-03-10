# PARAS REWARD - DMT (Bank Withdrawal) via Chatbot
## Complete E2E Flow Documentation
**Last Updated:** March 10, 2026

---

## 🔄 HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PARAS REWARD - CHATBOT DMT FLOW                               │
│                     (PRC to Bank Transfer via Eko API)                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   USER      │────▶│  CHATBOT    │────▶│   BACKEND   │────▶│   EKO API   │
│  (Mobile)   │◀────│  (React)    │◀────│  (FastAPI)  │◀────│  (Banking)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   MongoDB   │     │   ADMIN     │
                    │  Database   │     │   Panel     │
                    └─────────────┘     └─────────────┘
```

---

## 📱 USER JOURNEY (Chatbot Conversation)

### STEP 1: User Opens Chatbot & Requests Withdrawal
```
┌────────────────────────────────────────────────────────────────┐
│ USER: "मला पैसे काढायचे आहेत" / "Bank withdrawal"              │
│                                                                │
│ CHATBOT: "Sure! Let me help you withdraw your PRC to bank.    │
│          First, let me check your eligibility..."             │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ API CALL: GET /api/chatbot-redeem/eligibility/{uid}            │
│                                                                │
│ CHECKS:                                                        │
│ ✓ KYC Status = Verified?                                      │
│ ✓ PRC Balance >= 5,000? (Min ₹500)                            │
│ ✓ Active Subscription (Startup/Growth/Elite)?                 │
│ ✓ No pending withdrawal request?                              │
└────────────────────────────────────────────────────────────────┘
```

---

### STEP 2: Verification Choice (Mobile OTP or Aadhaar)
```
┌────────────────────────────────────────────────────────────────┐
│ CHATBOT: "Choose verification method:"                         │
│                                                                │
│ ┌──────────────────┐  ┌──────────────────┐                    │
│ │ 📱 Mobile OTP    │  │ 🆔 Aadhaar eKYC  │                    │
│ │ Limit: ₹25,000   │  │ Limit: ₹1,00,000 │                    │
│ └──────────────────┘  └──────────────────┘                    │
└────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ MOBILE OTP FLOW         │     │ AADHAAR eKYC FLOW       │
│ (Eko DMT Customer)      │     │ (Higher Limit)          │
└─────────────────────────┘     └─────────────────────────┘
```

---

### STEP 3A: Mobile OTP Flow (Eko Customer)
```
┌────────────────────────────────────────────────────────────────┐
│ CHATBOT: "Enter your mobile number for verification"           │
│                                                                │
│ USER: "9970100782"                                             │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ API: POST /api/chatbot-redeem/eko/check-customer               │
│ Request: { "uid": "user123", "mobile": "9970100782" }          │
│                                                                │
│ Eko API Call: GET /v1/customers/mobile_number:{mobile}         │
└────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ CUSTOMER EXISTS         │     │ NEW CUSTOMER            │
│ → Skip to OTP           │     │ → Register first        │
│ → Send OTP              │     │                         │
└─────────────────────────┘     └─────────────────────────┘
                                              │
                                              ▼
                              ┌─────────────────────────────────┐
                              │ API: POST /chatbot-redeem/eko/  │
                              │      register-customer          │
                              │                                 │
                              │ Request: {                      │
                              │   "uid": "user123",             │
                              │   "mobile": "9970100782",       │
                              │   "name": "RAMESH KUMAR"        │
                              │ }                               │
                              │                                 │
                              │ → Eko registers customer        │
                              │ → OTP sent automatically        │
                              └─────────────────────────────────┘
```

---

### STEP 4: OTP Verification
```
┌────────────────────────────────────────────────────────────────┐
│ CHATBOT: "Enter the 4-digit OTP sent to 99701****82"           │
│                                                                │
│ USER: "1234"                                                   │
│                                                                │
│ [Max 3 attempts allowed]                                       │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ API: POST /api/chatbot-redeem/eko/verify-otp                   │
│                                                                │
│ Request: {                                                     │
│   "uid": "user123",                                            │
│   "mobile": "9970100782",                                      │
│   "otp": "1234"                                                │
│ }                                                              │
│                                                                │
│ Eko API: POST /v1/customers/verification/otp                   │
└────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ ✅ OTP VERIFIED         │     │ ❌ OTP FAILED           │
│ → Proceed to bank       │     │ → Retry (max 3)        │
│   details               │     │ → Or cancel            │
└─────────────────────────┘     └─────────────────────────┘
```

---

### STEP 5: Bank Details Collection
```
┌────────────────────────────────────────────────────────────────┐
│ CHATBOT: "Great! Now enter your bank details:"                 │
│                                                                │
│ Account Holder Name: [___________________]                     │
│ Account Number:      [___________________]                     │
│ Confirm Account:     [___________________]                     │
│ IFSC Code:          [___________________]                      │
│                                                                │
│ [IFSC auto-fetches bank name & branch]                        │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ 🔍 IFSC LOOKUP (Optional - Razorpay API)                       │
│                                                                │
│ API: GET https://ifsc.razorpay.com/{IFSC_CODE}                │
│                                                                │
│ Response: {                                                    │
│   "BANK": "State Bank of India",                              │
│   "BRANCH": "Mumbai Main Branch",                             │
│   "ADDRESS": "..."                                            │
│ }                                                              │
└────────────────────────────────────────────────────────────────┘
```

---

### STEP 6: Amount Entry & Fee Calculation
```
┌────────────────────────────────────────────────────────────────┐
│ CHATBOT: "How much would you like to withdraw?"                │
│                                                                │
│ Your PRC Balance: 50,000 PRC (₹5,000)                         │
│ Minimum: ₹500 | Maximum: ₹25,000 (Mobile OTP)                 │
│                                                                │
│ Enter Amount: ₹ [____]                                        │
│                                                                │
│ USER: "1000"                                                   │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ 💰 FEE CALCULATION:                                            │
│ ┌─────────────────────────────────────────────┐                │
│ │ Withdrawal Amount:      ₹1,000              │                │
│ │ Processing Fee:         ₹10 (flat)          │                │
│ │ Admin Charge (20%):     ₹200                │                │
│ │ ─────────────────────────────────           │                │
│ │ You Receive:            ₹790                │                │
│ │                                             │                │
│ │ PRC Deducted:           10,000 PRC          │                │
│ │ (Rate: 10 PRC = ₹1)                         │                │
│ └─────────────────────────────────────────────┘                │
└────────────────────────────────────────────────────────────────┘
```

---

### STEP 7: Confirmation & Submission
```
┌────────────────────────────────────────────────────────────────┐
│ CHATBOT: "Please confirm your withdrawal request:"             │
│                                                                │
│ ┌─────────────────────────────────────────────┐                │
│ │ 👤 Account: RAMESH KUMAR                    │                │
│ │ 🏦 Bank: State Bank of India                │                │
│ │ 💳 A/C: ****7890                            │                │
│ │ 🔢 IFSC: SBIN0001234                        │                │
│ │                                             │                │
│ │ 💵 Amount: ₹1,000                           │                │
│ │ 📉 Fees: ₹210                               │                │
│ │ ✅ You Receive: ₹790                        │                │
│ └─────────────────────────────────────────────┘                │
│                                                                │
│ [Confirm & Submit]  [Cancel]                                  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ API: POST /api/chatbot-redeem/withdrawal-request               │
│                                                                │
│ Request: {                                                     │
│   "uid": "user123",                                            │
│   "amount_inr": 1000,                                          │
│   "account_holder_name": "RAMESH KUMAR",                       │
│   "account_number": "1234567890",                              │
│   "bank_name": "State Bank of India",                          │
│   "ifsc_code": "SBIN0001234",                                  │
│   "eko_verified": true                                         │
│ }                                                              │
│                                                                │
│ BACKEND ACTIONS:                                               │
│ 1. Validate all fields                                         │
│ 2. Check PRC balance                                           │
│ 3. Deduct PRC from user                                        │
│ 4. Create withdrawal request (status: pending)                 │
│ 5. Notify admin                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 👨‍💼 ADMIN PROCESSING FLOW

```
┌────────────────────────────────────────────────────────────────┐
│                    ADMIN PANEL                                  │
│           /admin/chatbot-withdrawals                           │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ 📋 PENDING WITHDRAWAL REQUESTS                                 │
│                                                                │
│ ┌──────────┬────────────┬─────────┬──────────┬─────────┐      │
│ │ ID       │ User       │ Amount  │ Status   │ Action  │      │
│ ├──────────┼────────────┼─────────┼──────────┼─────────┤      │
│ │ WD001    │ Ramesh K.  │ ₹1,000  │ Pending  │ [Process│      │
│ │ WD002    │ Suresh P.  │ ₹500    │ Pending  │ [Process│      │
│ └──────────┴────────────┴─────────┴──────────┴─────────┘      │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ ADMIN CLICKS "Process" → DMT Transfer Modal                    │
│                                                                │
│ ┌─────────────────────────────────────────────┐                │
│ │ Transfer Details:                           │                │
│ │ • User: Ramesh Kumar                        │                │
│ │ • Bank: State Bank of India                 │                │
│ │ • Account: ****7890                         │                │
│ │ • IFSC: SBIN0001234                        │                │
│ │ • Amount: ₹790 (after fees)                │                │
│ │                                             │                │
│ │ [Initiate IMPS Transfer]                   │                │
│ └─────────────────────────────────────────────┘                │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ API: POST /api/admin/dmt/process-withdrawal                    │
│                                                                │
│ BACKEND ACTIONS:                                               │
│ 1. Get withdrawal request details                              │
│ 2. Add recipient to Eko (if not exists)                       │
│ 3. Initiate IMPS/NEFT transfer via Eko                        │
│ 4. Update withdrawal status                                    │
│ 5. Notify user                                                 │
└────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ ✅ TRANSFER SUCCESS     │     │ ❌ TRANSFER FAILED      │
│                         │     │                         │
│ • Status: Completed     │     │ • Status: Failed        │
│ • UTR: UTR123456789    │     │ • PRC Refunded          │
│ • User Notified         │     │ • Admin Alerted         │
└─────────────────────────┘     └─────────────────────────┘
```

---

## 🗄️ DATABASE COLLECTIONS

### chatbot_withdrawal_requests
```javascript
{
  "_id": ObjectId("..."),
  "request_id": "WD-20260310-ABC123",
  "uid": "user123",
  "mobile": "9970100782",
  
  // Bank Details
  "account_holder_name": "RAMESH KUMAR",
  "account_number": "1234567890",
  "bank_name": "State Bank of India",
  "ifsc_code": "SBIN0001234",
  
  // Amount
  "amount_inr": 1000,
  "processing_fee": 10,
  "admin_charge": 200,
  "net_amount": 790,
  "prc_deducted": 10000,
  
  // Verification
  "eko_verified": true,
  "eko_customer_id": "EKO123",
  "verification_type": "mobile_otp",  // or "aadhaar"
  
  // Status
  "status": "pending",  // pending → processing → completed/failed
  
  // Transfer Details (after admin processes)
  "eko_tid": null,
  "utr": null,
  "transfer_channel": null,
  
  // Timestamps
  "created_at": ISODate("2026-03-10T10:30:00Z"),
  "processed_at": null,
  "completed_at": null,
  
  // Source
  "source": "chatbot"
}
```

---

## 🔐 SECURITY MEASURES

| Security Layer | Implementation |
|----------------|----------------|
| KYC Mandatory | User must complete KYC before withdrawal |
| OTP Verification | Eko sends OTP to user's registered mobile |
| Max Attempts | 3 OTP attempts, then blocked |
| Daily Limits | ₹25,000 (Mobile) / ₹1,00,000 (Aadhaar) |
| Admin Approval | All withdrawals require admin processing |
| Audit Trail | All actions logged in database |

---

## 📁 CODE FILES REFERENCE

| Component | File Path |
|-----------|-----------|
| Chatbot UI | `/app/frontend/src/components/AIChatbotEnhanced.js` |
| Withdrawal Flow UI | `/app/frontend/src/components/ChatbotWithdrawalFlow.js` |
| Backend APIs | `/app/backend/routes/chatbot_withdrawal.py` |
| Admin DMT Routes | `/app/backend/routes/admin_dmt_routes.py` |
| Admin Panel | `/app/frontend/src/pages/AdminChatbotWithdrawals.js` |

---

## 📊 API ENDPOINTS

### User-Facing (Chatbot)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chatbot-redeem/eligibility/{uid}` | Check user eligibility |
| POST | `/api/chatbot-redeem/eko/check-customer` | Check Eko customer status |
| POST | `/api/chatbot-redeem/eko/register-customer` | Register new Eko customer |
| POST | `/api/chatbot-redeem/eko/verify-otp` | Verify OTP |
| POST | `/api/chatbot-redeem/eko/resend-otp` | Resend OTP |
| POST | `/api/chatbot-redeem/withdrawal-request` | Submit withdrawal request |
| GET | `/api/chatbot-redeem/requests/{uid}` | Get user's requests |
| POST | `/api/chatbot-redeem/cancel/{request_id}` | Cancel pending request |

### Admin-Facing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/chatbot-withdrawals` | List all requests |
| POST | `/api/admin/dmt/process-withdrawal` | Process DMT transfer |
| POST | `/api/admin/chatbot-withdrawals/{id}/approve` | Mark as approved |
| POST | `/api/admin/chatbot-withdrawals/{id}/reject` | Reject request |

---

## 🔄 STATUS FLOW

```
┌──────────┐    ┌────────────┐    ┌───────────┐    ┌───────────┐
│ PENDING  │───▶│ PROCESSING │───▶│ COMPLETED │    │  FAILED   │
└──────────┘    └────────────┘    └───────────┘    └───────────┘
     │                │                                  ▲
     │                └──────────────────────────────────┘
     │
     ▼
┌──────────┐
│ CANCELLED│
└──────────┘
```

---

**Document maintained by:** Paras Reward Development Team
