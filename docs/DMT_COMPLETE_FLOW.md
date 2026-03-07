# 🏦 Paras Reward - Eko DMT Complete Flow Documentation

## Overview

आपल्या app मध्ये **दोन flows** आहेत:

### 1. **Chatbot Withdrawal Flow** (Current Implementation)
- User chatbot मधून withdrawal request करतो
- Admin manually DMT process करतो
- No direct user-to-bank transfer

### 2. **Direct DMT Flow** (Eko API Based)
- User directly bank transfer करतो
- OTP verification required
- Immediate transfer

---

## 🔄 CHATBOT WITHDRAWAL FLOW (आपली Current Implementation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CHATBOT WITHDRAWAL FLOW                                  │
│                    (Admin Processed)                                        │
└─────────────────────────────────────────────────────────────────────────────┘

USER SIDE                                    ADMIN SIDE
─────────                                    ──────────

   ┌──────────────┐
   │ User opens   │
   │   Chatbot    │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ Says: "Bank  │
   │  withdrawal" │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ Bot checks:  │
   │ - KYC ✓      │
   │ - Balance ✓  │
   │ - Min ₹500   │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ User gives:  │
   │ - Amount     │
   │ - Bank Name  │
   │ - A/C Number │
   │ - IFSC       │
   │ - Holder Name│
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ Bot shows:   │
   │ Fees: ₹10+20%│
   │ Net: ₹XXX    │
   │ Confirm?     │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ Request      │
   │ Created      │──────────────────────────▶ ┌──────────────┐
   │ ID: WD-XXX   │                            │ Admin sees   │
   │ Status:      │                            │ in Dashboard │
   │ PENDING      │                            └──────┬───────┘
   └──────────────┘                                   │
                                                      ▼
                                               ┌──────────────┐
                                               │ Admin clicks │
                                               │  "Process"   │
                                               └──────┬───────┘
                                                      │
                                                      ▼
                                        ┌─────────────────────────┐
                                        │   ADMIN DOES DMT        │
                                        │   MANUALLY VIA EKO      │
                                        │                         │
                                        │  1. Customer Search     │
                                        │  2. Register (if new)   │
                                        │  3. Verify OTP          │
                                        │  4. Add Recipient       │
                                        │  5. Transfer Money      │
                                        └─────────────┬───────────┘
                                                      │
                                                      ▼
   ┌──────────────┐                            ┌──────────────┐
   │ User gets    │◀───────────────────────────│ Admin marks  │
   │ notification │                            │ COMPLETED    │
   │ "Transfer    │                            │ with Txn ID  │
   │  Done!"      │                            └──────────────┘
   └──────────────┘


API Endpoints Used:
──────────────────
POST /api/chatbot-redeem/eligibility/{uid}  → Check eligibility
POST /api/chatbot-redeem/calculate-fees     → Calculate fees
POST /api/chatbot-redeem/request            → Create request
GET  /api/chatbot-redeem/status/{id}        → Check status
GET  /api/chatbot-redeem/admin/pending      → Admin: Get pending
POST /api/chatbot-redeem/admin/process/{id} → Admin: Process
```

---

## 🔄 DIRECT DMT FLOW (Eko API Based - Admin Processing)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EKO DMT FLOW (Admin Side)                                │
│              जेव्हा Admin withdrawal process करतो                          │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: CUSTOMER SEARCH
───────────────────────
Admin enters user's mobile number

    ┌─────────────────────────────────────────┐
    │ POST /api/eko/dmt/customer/search       │
    │ { "mobile": "9421331342",               │
    │   "user_id": "admin_uid" }              │
    └─────────────────┬───────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │    Response Check      │
         └────────────┬───────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐
│ customer_exists │      │ customer_exists │
│     = true      │      │     = false     │
│   state = 0     │      │                 │
│ (Verified)      │      │ (Need Register) │
└────────┬────────┘      └────────┬────────┘
         │                        │
         │                        ▼
         │               STEP 2: REGISTER
         │               ─────────────────
         │               ┌─────────────────────────────────────────┐
         │               │ POST /api/eko/dmt/customer/register     │
         │               │ { "mobile": "9421331342",               │
         │               │   "name": "SANTOSH AVHALE",             │
         │               │   "user_id": "admin_uid" }              │
         │               └─────────────────┬───────────────────────┘
         │                                 │
         │                                 ▼
         │               ┌─────────────────────────────────────────┐
         │               │  ★ EKO AUTOMATICALLY SENDS OTP SMS ★    │
         │               │  To: 9421331342                         │
         │               │  SMS: "Your OTP is 456789"              │
         │               └─────────────────┬───────────────────────┘
         │                                 │
         │                                 ▼
         │               ┌─────────────────────────────────────────┐
         │               │ Response: { state: 1, otp_sent: true }  │
         │               └─────────────────┬───────────────────────┘
         │                                 │
         │                                 ▼
         │               STEP 3: VERIFY OTP
         │               ──────────────────
         │               ┌─────────────────────────────────────────┐
         │               │ User gets OTP on phone                  │
         │               │ Admin asks user: "OTP क्या आया?"        │
         │               │ User tells: "456789"                    │
         │               └─────────────────┬───────────────────────┘
         │                                 │
         │                                 ▼
         │               ┌─────────────────────────────────────────┐
         │               │ POST /api/eko/dmt/customer/verify-otp   │
         │               │ { "mobile": "9421331342",               │
         │               │   "otp": "456789",                      │
         │               │   "user_id": "admin_uid" }              │
         │               └─────────────────┬───────────────────────┘
         │                                 │
         │                                 ▼
         │               ┌─────────────────────────────────────────┐
         │               │ Response: { verified: true, state: 0 }  │
         │               └─────────────────┬───────────────────────┘
         │                                 │
         │◀────────────────────────────────┘
         │
         ▼
STEP 4: ADD RECIPIENT (Bank Account)
────────────────────────────────────
┌─────────────────────────────────────────────────────┐
│ POST /api/eko/dmt/recipient/add                     │
│ {                                                   │
│   "mobile": "9421331342",                           │
│   "recipient_name": "RAMESH KUMAR",                 │
│   "account_number": "1234567890123",                │
│   "ifsc": "HDFC0001234",                            │
│   "user_id": "admin_uid"                            │
│ }                                                   │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│ Response:                                           │
│ { recipient_id: "REC123", verified: true }          │
│                                                     │
│ Note: status=342 means "Already exists" (OK)        │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
STEP 5: TRANSFER MONEY
──────────────────────
┌─────────────────────────────────────────────────────┐
│ POST /api/eko/dmt/transfer                          │
│ {                                                   │
│   "user_id": "admin_uid",                           │
│   "mobile": "9421331342",                           │
│   "recipient_id": "REC123",                         │
│   "prc_amount": 10000    // ₹1000                   │
│ }                                                   │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│ Response:                                           │
│ {                                                   │
│   tx_status: 0,        // 0=Success                 │
│   tid: "EKO123456",                                 │
│   bank_ref: "UTR789",                               │
│   message: "Transfer successful"                    │
│ }                                                   │
└─────────────────────────────────────────────────────┘

STEP 6: STATUS CHECK (If tx_status = 2 or 5)
────────────────────────────────────────────
┌─────────────────────────────────────────────────────┐
│ GET /api/eko/dmt/status/{tid}                       │
│                                                     │
│ tx_status meanings:                                 │
│   0 = Success ✅                                    │
│   1 = Failed ❌ (Refund PRC)                        │
│   2 = Pending ⏳ (Check again)                      │
│   3 = Refund Pending                                │
│   4 = Refunded                                      │
│   5 = Hold (Check again)                            │
└─────────────────────────────────────────────────────┘
```

---

## 📊 API COMPARISON: EKO vs APP

| Step | Eko API | Our App API | Match? |
|------|---------|-------------|--------|
| Customer Search | GET /v1/customers/mobile_number:{m} | POST /api/eko/dmt/customer/search | ✅ |
| Customer Register | PUT /v1/customers/mobile_number:{m} | POST /api/eko/dmt/customer/register | ✅ |
| Resend OTP | POST /v1/customers/mobile_number:{m}/otp | POST /api/eko/dmt/customer/resend-otp | ✅ |
| Verify OTP | PUT /v1/customers/verification/otp:{otp} | POST /api/eko/dmt/customer/verify-otp | ✅ |
| Add Recipient | PUT /v1/customers/.../recipients/acc_no:{a} | POST /api/eko/dmt/recipient/add | ✅ |
| Transfer | POST /v1/transactions | POST /api/eko/dmt/transfer | ✅ |
| Status Check | GET /v1/transactions/{tid} | GET /api/eko/dmt/status/{tid} | ✅ |

---

## 🔐 AUTHENTICATION FLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION (Per Request)                             │
└─────────────────────────────────────────────────────────────────────────────┘

Every API call to Eko requires these headers:

Headers:
────────
developer_key:       "7c179a397b4710e71b2248d1f5892d19"
secret-key:          <generated per request>
secret-key-timestamp: <milliseconds>
initiator_id:        "9936606966"

Secret Key Generation:
──────────────────────

  authenticator_key = "mining-formula-v2"
              │
              ▼
  ┌───────────────────────────────────────┐
  │ Step 1: encoded_key = Base64(key)     │
  │         = "bWluaW5nLWZvcm11bGEtdjI="  │
  └───────────────────┬───────────────────┘
                      │
                      ▼
  ┌───────────────────────────────────────┐
  │ Step 2: timestamp = current time (ms) │
  │         = "1772866369762"             │
  └───────────────────┬───────────────────┘
                      │
                      ▼
  ┌───────────────────────────────────────┐
  │ Step 3: signature = HMAC-SHA256(      │
  │           key = encoded_key,          │
  │           message = timestamp         │
  │         )                             │
  └───────────────────┬───────────────────┘
                      │
                      ▼
  ┌───────────────────────────────────────┐
  │ Step 4: secret_key = Base64(signature)│
  └───────────────────────────────────────┘


For POST /transactions, also need:
──────────────────────────────────

  request_hash = Base64(
    HMAC-SHA256(
      key = encoded_key,
      message = timestamp + account_no + amount + user_code
    )
  )
```

---

## 📱 OTP FLOW DETAILED

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OTP FLOW                                            │
└─────────────────────────────────────────────────────────────────────────────┘

CASE 1: New Customer Registration
─────────────────────────────────

  Admin                         Eko                          User
    │                            │                             │
    │  1. Register Customer      │                             │
    │  PUT /v1/customers/...     │                             │
    │ ─────────────────────────▶ │                             │
    │                            │                             │
    │  2. Response: state=1      │  3. SMS OTP                 │
    │ ◀───────────────────────── │ ──────────────────────────▶ │
    │     "otp_sent": true       │     "OTP is 456789"         │
    │                            │                             │
    │  4. Ask user for OTP       │                             │
    │ ─────────────────────────────────────────────────────▶   │
    │                            │                             │
    │  5. User tells OTP         │                             │
    │ ◀─────────────────────────────────────────────────────   │
    │     "456789"               │                             │
    │                            │                             │
    │  6. Verify OTP             │                             │
    │  PUT /v1/.../otp:456789    │                             │
    │ ─────────────────────────▶ │                             │
    │                            │                             │
    │  7. Success! state=0       │                             │
    │ ◀───────────────────────── │                             │
    │                            │                             │


CASE 2: Existing Customer (state=1, OTP pending)
────────────────────────────────────────────────

  Admin                         Eko                          User
    │                            │                             │
    │  1. Search Customer        │                             │
    │ ─────────────────────────▶ │                             │
    │                            │                             │
    │  2. Response: state=1      │                             │
    │     "otp_required": true   │                             │
    │ ◀───────────────────────── │                             │
    │                            │                             │
    │  3. Resend OTP             │                             │
    │  POST /v1/.../otp          │                             │
    │ ─────────────────────────▶ │                             │
    │                            │                             │
    │  4. OTP sent response      │  5. SMS OTP                 │
    │ ◀───────────────────────── │ ──────────────────────────▶ │
    │                            │                             │
    │        ... (same as above) ...                           │
    │                            │                             │


CASE 3: OTP Errors
──────────────────

  Error 302: Wrong OTP
  ─────────────────────
  → Ask user to re-enter correct OTP
  
  Error 303: OTP Expired
  ──────────────────────
  → Call Resend OTP API
  → New OTP sent to user
  
  Error 327: OTP Not Generated
  ────────────────────────────
  → Call Resend OTP API
  → New OTP sent to user
```

---

## ⚠️ IMPORTANT NOTES

### 1. IP Whitelisting
```
Production IPs (Whitelisted):
  - 34.44.149.98
  - 34.10.166.75

Preview IP (NOT Whitelisted):
  - 34.170.12.145

→ Preview मध्ये 403 error येतो
→ Production मध्ये काम करेल
```

### 2. Monthly Limits
```
Non-KYC Customer: ₹25,000/month
Full-KYC Customer: Higher limits (varies)
```

### 3. UAT vs Production
```
UAT/Staging:
  - OTP SMS जात नाही
  - कुठलाही 6-digit OTP वापरा (123456)
  
Production:
  - Real SMS जातो
  - Actual OTP required
```

### 4. Fee Structure (Our App)
```
Amount: ₹1000
Processing Fee: ₹10 (flat)
Admin Charge: ₹200 (20%)
Total Fees: ₹210
Net to User: ₹790
PRC Deducted: 10,000 PRC (₹1000 × 10)
```

---

## 🎯 COMPLETE ADMIN WORKFLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              ADMIN: Processing a Chatbot Withdrawal                         │
└─────────────────────────────────────────────────────────────────────────────┘

1. Admin Dashboard → Withdrawals → See Pending Request
   
   Request: WD-20260307-ABC123
   User: SANTOSH AVHALE
   Mobile: 9421331342
   Amount: ₹1000
   Bank: HDFC - ****7890
   IFSC: HDFC0001234

2. Click "Process" → Status changes to "Processing"

3. Open DMT Panel (or use curl/Postman):

   a) Search Customer:
      POST /api/eko/dmt/customer/search
      {"mobile": "9421331342", "user_id": "admin_uid"}
      
      → If customer_exists=false: Go to (b)
      → If state=1: Go to (c)
      → If state=0: Go to (d)

   b) Register Customer:
      POST /api/eko/dmt/customer/register
      {"mobile": "9421331342", "name": "SANTOSH AVHALE", "user_id": "admin_uid"}
      
      → OTP automatically sent to user
      → Call user, ask for OTP

   c) Verify OTP:
      POST /api/eko/dmt/customer/verify-otp
      {"mobile": "9421331342", "otp": "456789", "user_id": "admin_uid"}
      
      → If error 302: Wrong OTP, ask again
      → If error 303: Resend OTP

   d) Add Recipient:
      POST /api/eko/dmt/recipient/add
      {
        "mobile": "9421331342",
        "recipient_name": "SANTOSH AVHALE",
        "account_number": "1234567890",
        "ifsc": "HDFC0001234",
        "user_id": "admin_uid"
      }

   e) Transfer Money:
      POST /api/eko/dmt/transfer
      {
        "user_id": "admin_uid",
        "mobile": "9421331342",
        "recipient_id": "REC123",
        "prc_amount": 7900  // Net amount ₹790 × 10
      }

4. If tx_status=0 (Success):
   → Admin Dashboard → Mark Complete
   → Enter Eko Transaction ID
   → User gets notification

5. If tx_status=1 (Failed):
   → Admin Dashboard → Reject with reason
   → PRC auto-refunded to user
```

---

## 📋 CHECKLIST: Flow Match Verification

| # | Eko Requirement | Our Implementation | Status |
|---|-----------------|-------------------|--------|
| 1 | Customer Search by mobile | ✅ POST /api/eko/dmt/customer/search | ✅ |
| 2 | Customer Registration with name | ✅ POST /api/eko/dmt/customer/register | ✅ |
| 3 | OTP auto-sent on registration | ✅ otp_sent: true in response | ✅ |
| 4 | Resend OTP API | ✅ POST /api/eko/dmt/customer/resend-otp | ✅ |
| 5 | Verify OTP with customer_id_type | ✅ Fixed: customer_id_type + customer_id | ✅ |
| 6 | Add Recipient with IFSC | ✅ POST /api/eko/dmt/recipient/add | ✅ |
| 7 | Transfer with request_hash | ✅ Implemented in eko_dmt_service.py | ✅ |
| 8 | Transaction status check | ✅ GET /api/eko/dmt/status/{tid} | ✅ |
| 9 | Error handling (302, 303, 327) | ✅ Added specific messages | ✅ |
| 10 | Timestamp in milliseconds | ✅ Fixed: time.time() * 1000 | ✅ |

---

**Last Updated:** March 7, 2026
**Version:** 2.0
