# EKO BBPS INTEGRATION - DEVELOPER GUIDE
## Complete A-Z Documentation for PARAS REWARD

---

## 1. OVERVIEW

### What is BBPS?
Bharat Bill Payment System (BBPS) is an RBI mandated interoperable bill payment system that offers integrated bill payment services across India.

### Supported Services (22+ Categories)
| Category ID | Category Name | Operators | Use Case |
|-------------|---------------|-----------|----------|
| 5 | Mobile Prepaid | 6 | Jio, Airtel, Vi, BSNL recharge |
| 10 | Mobile Postpaid | 7 | Postpaid bill payment |
| 4 | DTH | 5 | Dish TV, Tata Sky, Airtel DTH |
| 8 | Electricity | 89 | MSEB, AEML, all state boards |
| 11 | Water | 54 | Municipal water bills |
| 1 | Broadband | 92 | Internet service providers |
| 7 | Credit Card | 29 | All bank credit cards |
| 20 | Insurance | 40 | LIC, health insurance |
| 21 | Loan/EMI | 294 | All bank/NBFC loans |
| 22 | FASTag | 20 | Highway toll tags |
| 9 | Landline | 5 | Landline bills |
| 12 | Housing Society | 105 | Maintenance bills |

---

## 2. AUTHENTICATION MECHANISM

### BBPS vs DMT Authentication Difference
**BBPS uses MILLISECONDS, DMT uses SECONDS for timestamp!**

```python
# BBPS Authentication Algorithm
timestamp = str(round(time.time() * 1000))  # MILLISECONDS

# Step 1: Encode authenticator key
encoded_key = base64.b64encode(AUTH_KEY.encode()).decode()

# Step 2: Generate secret-key
secret_key = base64.b64encode(
    hmac.new(
        encoded_key.encode(),
        timestamp.encode(),
        hashlib.sha256
    ).digest()
).decode()

# Step 3: For PAYMENT - Generate request_hash
concatenated = f"{timestamp}{account}{amount}{user_code}"
request_hash = base64.b64encode(
    hmac.new(
        encoded_key.encode(),
        concatenated.encode(),
        hashlib.sha256
    ).digest()
).decode()
```

### Required Headers
| Header | Description | Required For |
|--------|-------------|--------------|
| developer_key | Static API key | All requests |
| secret-key | Dynamic HMAC signature | All requests |
| secret-key-timestamp | Millisecond timestamp | All requests |
| initiator_id | Registered mobile number | All requests |
| request_hash | Payment verification hash | PAY only |
| Content-Type | application/json (fetch) or application/x-www-form-urlencoded (pay) | All requests |

---

## 3. API ENDPOINTS

### Base URL
- **Production:** `https://api.eko.in:25002/ekoicici`
- **Staging:** `https://staging.eko.in:25004/ekoapi`

### 3.1 Get Operators
```
GET /v2/billpayments/operators?initiator_id={id}&category={cat_id}
```
**Response:**
```json
{
  "operators": [
    {
      "operator_id": "163",
      "name": "MSEB",
      "billFetchResponse": 1,
      "category": "8"
    }
  ]
}
```

### 3.2 Get Operator Parameters
```
GET /v2/billpayments/operators/{operator_id}/params?initiator_id={id}
```
**Response:**
```json
{
  "parameters": [
    {
      "param_name": "utility_acc_no",
      "param_label": "Consumer Number",
      "param_type": "NUMERIC",
      "regex": "^[0-9]{10,15}$",
      "min_length": 10,
      "max_length": 15,
      "is_mandatory": true
    }
  ]
}
```

### 3.3 Fetch Bill
```
POST /v2/billpayments/fetchbill?initiator_id={id}
Content-Type: application/json
```
**Request Body:**
```json
{
  "operator_id": "163",
  "utility_acc_no": "123456789012",
  "confirmation_mobile_no": "9876543210",
  "user_code": "20810200",
  "client_ref_id": "FETCH1234567890",
  "sender_name": "Customer Name",
  "latlong": "19.9975,73.7898"
}
```
**Success Response:**
```json
{
  "status": 0,
  "data": {
    "amount": "1250.00",
    "utilitycustomername": "JOHN DOE",
    "billdate": "2025-02-15",
    "duedate": "2025-03-15",
    "billnumber": "BILL123456",
    "billfetchresponse": "BASE64_ENCODED_STRING"
  }
}
```

### 3.4 Pay Bill
```
POST /v2/billpayments/paybill?initiator_id={id}
Content-Type: application/x-www-form-urlencoded
```
**Request Body (form-urlencoded):**
```
amount=1250
operator_id=163
utility_acc_no=123456789012
confirmation_mobile_no=9876543210
user_code=20810200
client_ref_id=PAY1234567890
sender_name=Customer Name
latlong=19.9975,73.7898
billfetchresponse=BASE64_STRING (if operator requires)
```

**Response:**
```json
{
  "status": 0,
  "data": {
    "tx_status": 0,
    "tid": "TID123456789",
    "bbpstrxnrefid": "BBPS123456789",
    "amount": "1250.00",
    "commission": "12.50"
  }
}
```

### 3.5 Transaction Status
```
GET /v2/transactions?initiator_id={id}&tx_id={tid}
```

---

## 4. ERROR HANDLING

### HTTP Status Codes
| Code | Meaning | Action |
|------|---------|--------|
| 200 | OK - Check response body | Parse status and tx_status |
| 403 | Forbidden | Check secret-key, timestamp |
| 404 | Not Found | Check URL |
| 500 | Server Error | Retry after delay |

### Eko Status Codes
| Code | Message | User Message |
|------|---------|--------------|
| 0 | Success | Operation successful |
| 347 | Insufficient Balance | Please add funds |
| 463 | User Not Found | Complete registration |
| 544 | Bank Not Available | Try again later |
| 1003 | Invalid Consumer Number | Check consumer number |
| 1004 | Consumer Not Found | Verify account details |
| 1468 | Unable to Fetch Bill | Check consumer number format |
| 1469 | Biller System Error | Try again later |

### Transaction Status (tx_status)
| Status | Meaning | Action |
|--------|---------|--------|
| 0 | SUCCESS | Transaction completed |
| 1 | FAILED | Show error, no retry |
| 2 | PENDING | Call status API after 5 mins |
| 3 | REFUND_PENDING | Refund in 24-48 hours |
| 4 | REFUNDED | Amount refunded |
| 5 | ON_HOLD | Contact support |

---

## 5. SERVICE-SPECIFIC PARAMETERS

### 5.1 Electricity (MSEB)
- **Consumer Number:** 12 digits
- **billfetchresponse:** Required (operator flag = 1)

### 5.2 Mobile Recharge (Jio/Airtel)
- **Account:** 10-digit mobile number
- **billfetchresponse:** Not required

### 5.3 FASTag
- **Vehicle Number:** Format: MH12AB1234
- **billfetchresponse:** Varies by bank

### 5.4 Loan/EMI
- **Loan Account Number:** Bank specific format
- **DOB:** Required for LIC (DD/MM/YYYY)

### 5.5 Credit Card
- **Card Number:** 16 digits (last 4 visible)
- **Amount:** Minimum ₹100

---

## 6. COMPLETE FLOW

```
┌─────────────────────────────────────────────────────────────┐
│                    BBPS PAYMENT FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. SELECT SERVICE                                          │
│     └─> GET /bbps/operators/{category}                      │
│         └─> Display operator list                           │
│                                                             │
│  2. GET FORM FIELDS                                         │
│     └─> GET /bbps/operator-params/{operator_id}             │
│         └─> Build dynamic form with validation              │
│                                                             │
│  3. FETCH BILL (if billFetchResponse=1)                     │
│     └─> POST /bbps/fetch                                    │
│         ├─> Success: Show bill amount, customer name        │
│         └─> Error: Show message, allow manual amount        │
│                                                             │
│  4. CONFIRM PAYMENT                                         │
│     └─> User confirms amount and details                    │
│                                                             │
│  5. PAY BILL                                                │
│     └─> POST /bbps/pay                                      │
│         ├─> tx_status=0: SUCCESS - Show receipt             │
│         ├─> tx_status=1: FAILED - Show error                │
│         ├─> tx_status=2: PENDING - Show "Processing"        │
│         └─> tx_status=5: ON_HOLD - Show support contact     │
│                                                             │
│  6. CHECK STATUS (if pending)                               │
│     └─> GET /bbps/status/{tid}                              │
│         └─> Poll every 5 minutes until final state          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. CURRENT IMPLEMENTATION STATUS

### ✅ WORKING
- All 11 service categories configured
- Bill fetch API with proper error handling
- Bill payment API with request_hash
- Transaction status inquiry
- Operator listing by category
- Operator parameter fetch
- Comprehensive error messages

### ⚠️ NEEDS VERIFICATION
- Service activation for agent (service_code=53)
- High commission channel (hc_channel=1)
- Specific operator parameter validation

### 🔧 INTEGRATION CHECKLIST
- [x] IP Whitelisting (user confirmed)
- [x] Production credentials configured
- [ ] Service activation via API
- [ ] End-to-end test with real consumer number
- [ ] Frontend UI for all services

---

## 8. ENVIRONMENT VARIABLES

```env
EKO_DEVELOPER_KEY="your_developer_key"
EKO_INITIATOR_ID="registered_mobile"
EKO_AUTHENTICATOR_KEY="your_auth_key"
EKO_BASE_URL="https://api.eko.in:25002/ekoicici"
EKO_USER_CODE="your_user_code"
```

---

## 9. FILES REFERENCE

| File | Purpose |
|------|---------|
| /app/backend/routes/bbps_services.py | Main BBPS API routes |
| /app/backend/routes/eko_error_handler.py | Error handling module |
| /app/backend/.env | Eko credentials |

---

**Last Updated:** March 9, 2026
**Version:** 2.0
