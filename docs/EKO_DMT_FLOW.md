# Eko DMT E2E Flow - Bank Withdrawal via Chatbot
## Paras Reward Implementation

---

## 1. AUTHENTICATION (Per Request)

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FORMULA                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. timestamp_ms = current time in MILLISECONDS             │
│                                                             │
│  2. encoded_key = Base64(authenticator_key)                 │
│     Example: Base64("mining-formula-v2")                    │
│            = "bWluaW5nLWZvcm11bGEtdjI="                     │
│                                                             │
│  3. secret_key = Base64(HMAC-SHA256(encoded_key, timestamp))│
│                                                             │
│  4. Headers:                                                │
│     - developer_key: 7c179a397b4710e71b2248d1f5892d19       │
│     - secret-key: <generated>                               │
│     - secret-key-timestamp: <milliseconds>                  │
│     - initiator_id: 9936606966                              │
│                                                             │
│  5. For POST requests (transactions):                       │
│     request_hash = Base64(HMAC-SHA256(                      │
│       encoded_key,                                          │
│       timestamp + utility_acc_no + amount + user_code       │
│     ))                                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. COMPLETE E2E FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           USER WITHDRAWAL FLOW                               │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   STEP 1    │     │   STEP 2    │     │   STEP 3    │     │   STEP 4    │
│  User Chat  │────▶│  Validate   │────▶│   Create    │────▶│   Admin     │
│  Request    │     │  Eligibility│     │   Request   │     │  Process    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     │                    │                   │                    │
     │                    │                   │                    │
     ▼                    ▼                   ▼                    ▼
"Bank withdrawal     Check:              Store in DB:          DMT Flow:
 करायचे आहे"        - KYC verified?     - request_id         1. Customer Search
                    - Min ₹500?          - bank_details        2. Register (if needed)
                    - Balance?           - amount              3. Add Recipient
                                        - status: pending      4. Transfer Money



┌──────────────────────────────────────────────────────────────────────────────┐
│                              DMT API FLOW                                    │
└──────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────┐
│ Step 1: Customer      │
│ Search/Registration   │
└───────────┬───────────┘
            │
            ▼
    ┌───────────────┐
    │ GET /v1/      │
    │ customers/    │
    │ mobile_number │
    │ :9421331342   │
    └───────┬───────┘
            │
            ▼
    ┌───────────────────────┐
    │ Status 463?           │───YES──▶ Register Customer
    │ (Customer not found)  │         PUT /v1/customers/
    └───────────┬───────────┘         mobile_number:{mobile}
                │ NO                          │
                │                             ▼
                ▼                     ┌───────────────┐
    ┌───────────────────────┐         │ OTP Required? │
    │ Customer found        │         │ State = 1     │
    │ Get available_limit   │         └───────┬───────┘
    └───────────┬───────────┘                 │ YES
                │                             ▼
                │                     ┌───────────────┐
                │                     │ Verify OTP    │
                │                     │ PUT /v1/      │
                │                     │ customers/    │
                │                     │ verification/ │
                │                     │ otp:{otp}     │
                │                     └───────┬───────┘
                │                             │
                ▼◀────────────────────────────┘
    ┌───────────────────────┐
    │ Step 2: Add Recipient │
    │ (Bank Account)        │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │ PUT /v1/customers/    │
    │ mobile_number:{mobile}│
    │ /recipients/          │
    │ acc_no:{account}      │
    │                       │
    │ Body:                 │
    │ - recipient_name      │
    │ - ifsc                │
    │ - bank_code           │
    │ - recipient_type: 1   │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Status 0 or 342?      │
    │ 0 = Added             │
    │ 342 = Already exists  │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Step 3: Money Transfer│
    │ (IMPS)                │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │ POST /v1/transactions │
    │                       │
    │ Headers:              │
    │ + request_hash        │
    │                       │
    │ Body:                 │
    │ - customer_id         │
    │ - recipient_id        │
    │ - amount              │
    │ - client_ref_id       │
    │ - channel: 2 (IMPS)   │
    │ - state: 1            │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────────────────────┐
    │          TRANSACTION STATUS           │
    ├───────────────────────────────────────┤
    │ tx_status = 0  → SUCCESS (Completed)  │
    │ tx_status = 1  → FAILED (Refund PRC)  │
    │ tx_status = 2  → PENDING (Check later)│
    │ tx_status = 3  → REFUND_PENDING       │
    │ tx_status = 4  → REFUNDED             │
    └───────────────────────────────────────┘
```

---

## 3. API ENDPOINTS (Our Implementation)

### User APIs (Chatbot)
```
GET  /api/chatbot-redeem/eligibility/{uid}     - Check if user can withdraw
GET  /api/chatbot-redeem/calculate-fees        - Calculate fees for amount
POST /api/chatbot-redeem/request               - Create withdrawal request
GET  /api/chatbot-redeem/status/{request_id}   - Check request status
GET  /api/chatbot-redeem/history/{uid}         - Get user's history
```

### Admin APIs
```
GET  /api/chatbot-redeem/admin/pending         - Get pending requests
GET  /api/chatbot-redeem/admin/all             - Get all requests
GET  /api/chatbot-redeem/admin/stats           - Statistics
POST /api/chatbot-redeem/admin/process/{id}    - Approve/Reject/Complete
```

### DMT APIs (Admin Processing)
```
POST /api/eko/dmt/customer/search      - Search customer in Eko
POST /api/eko/dmt/customer/register    - Register new customer
POST /api/eko/dmt/customer/verify-otp  - Verify OTP
POST /api/eko/dmt/recipient/add        - Add bank as recipient
POST /api/eko/dmt/transfer             - Execute transfer
GET  /api/eko/dmt/status/{txn_id}      - Check transaction status
```

---

## 4. FEE STRUCTURE

```
┌─────────────────────────────────────────────┐
│              WITHDRAWAL FEES                │
├─────────────────────────────────────────────┤
│ Minimum Amount:       ₹500                  │
│ Processing Fee:       ₹10 (flat)            │
│ Admin Charge:         20% of amount         │
│                                             │
│ Example (₹1000 withdrawal):                 │
│   Amount:            ₹1,000                 │
│   Processing Fee:    ₹10                    │
│   Admin Charge:      ₹200 (20%)             │
│   Total Fees:        ₹210                   │
│   Net to User:       ₹790                   │
│   PRC Required:      10,000 PRC             │
│                      (₹1 = 10 PRC)          │
└─────────────────────────────────────────────┘
```

---

## 5. ERROR CODES

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Proceed |
| 403 | IP not whitelisted | Whitelist IP in Eko portal |
| 463 | Customer not found | Register customer first |
| 327 | OTP verification pending | Send/Verify OTP |
| 302 | Wrong OTP | Retry with correct OTP |
| 303 | OTP expired | Request new OTP |
| 342 | Recipient exists | Use existing recipient |
| 41 | Invalid IFSC | Check IFSC code |
| 46 | Invalid account | Verify account details |
| 347 | Insufficient wallet | Check Eko wallet balance |

---

## 6. IP WHITELISTING

```
Production IPs (Whitelisted):
  - 34.44.149.98
  - 34.10.166.75

Preview IP (NOT Whitelisted):
  - 34.170.12.145

Note: Only Indian IPs can be whitelisted per Eko compliance.
```

---

## 7. DATABASE COLLECTIONS

```javascript
// chatbot_withdrawal_requests
{
  request_id: "WD-20260307-ABC123",
  uid: "user_id",
  user_name: "संतोष",
  user_mobile: "9421331342",
  amount_inr: 1000,
  processing_fee: 10,
  admin_charge: 200,
  net_amount: 790,
  prc_deducted: 10000,
  account_holder_name: "SANTOSH AVHALE",
  account_number: "1234567890",
  bank_name: "HDFC Bank",
  ifsc_code: "HDFC0001234",
  status: "pending", // pending, processing, completed, rejected
  dmt_transaction_id: null,
  dmt_status: null,
  created_at: ISODate(),
  processed_at: null
}

// dmt_transactions (DMT processing records)
{
  transaction_id: "DMT1772866369762ABC123",
  user_id: "admin_id",
  mobile: "9421331342",
  recipient_id: "123456",
  prc_amount: 10000,
  amount_inr: 1000,
  service_type: "dmt",
  status: "completed",
  eko_tid: "EKO123456789",
  tx_status: 0,
  created_at: ISODate()
}
```

---

## 8. CHATBOT PROMPTS

### Withdrawal Request Flow
```
User: "Bank withdrawal करायचे"

Bot: "KYC आणि balance check करतो..."
     
     ✅ Eligible!
     - Balance: 15,000 PRC (₹1,500)
     - Min: ₹500, Max: ₹1,500
     
     "किती amount withdraw करायचा आहे?"

User: "1000"

Bot: "Fees breakdown:
      Amount: ₹1,000
      Fees: ₹210 (₹10 + 20%)
      Net: ₹790
      
      Bank details द्या:
      - Account holder name
      - Account number
      - Bank name
      - IFSC code"

User: <provides details>

Bot: "Confirm:
      ₹790 will be sent to
      HDFC Bank - ****7890
      
      10,000 PRC will be deducted.
      
      Confirm? (Yes/No)"

User: "Yes"

Bot: "✅ Request created!
      ID: WD-20260307-ABC123
      
      Admin 5-7 days मध्ये process करेल."
```
