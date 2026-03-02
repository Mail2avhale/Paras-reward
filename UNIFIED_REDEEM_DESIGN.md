# Unified Redeem System - Technical Design Document

## Based on Eko Developer Documentation

---

## 1. SERVICES SUPPORTED

| # | Service | Eko Category ID | Type |
|---|---------|-----------------|------|
| 1 | Mobile Prepaid | 5 | BBPS |
| 2 | DTH | 4 | BBPS |
| 3 | Electricity | 8 | BBPS |
| 4 | Gas (PNG) | 2 | BBPS |
| 5 | LPG | 18 | BBPS |
| 6 | EMI/Loan | 21 | BBPS |
| 7 | Credit Card | 7 | BBPS |
| 8 | Bank Transfer | - | DMT |

---

## 2. CHARGES CALCULATION

```
Service Amount = User enters (e.g., ₹500)

Eko Charges (from API response):
  - fee: Transaction fee from Eko
  - commission: Our commission (negative = cost to us)
  
Our Charges:
  - Flat Fee: ₹10 (on top of Eko)
  - Admin Charges: 20% of service amount

Total PRC Deducted = Service Amount + Eko Fee + ₹10 + (20% of Service Amount)

Example for ₹500 recharge:
  - Service Amount: ₹500
  - Eko Fee: ~₹5 (varies)
  - Flat Fee: ₹10
  - Admin Charges: ₹100 (20% of 500)
  - Total: ₹615 PRC
```

---

## 3. EKO API FLOW

### BBPS Flow (Mobile, DTH, Electricity, Gas, EMI):

```
Step 1: Get Operator List
  GET /v2/billpayments/operators?category={category_id}
  
Step 2: Get Operator Parameters (what fields are required)
  GET /v2/billpayments/operators/{operator_id}
  
Step 3: Fetch Bill (if fetchBill=1 for operator)
  POST /v2/billpayments/fetchbill?initiator_id={id}
  
Step 4: Pay Bill
  POST /v2/billpayments/paybill?initiator_id={id}
```

### DMT Flow (Bank Transfer):

```
Step 1: Check/Create Customer
  GET /v1/customers/mobile_number:{mobile}
  POST /v1/customers/mobile_number:{mobile}
  
Step 2: Verify Customer (OTP)
  PUT /v1/customers/verification/otp:{otp}
  
Step 3: Add Recipient
  PUT /v1/customers/mobile_number:{mobile}/recipients
  
Step 4: Initiate Transfer
  POST /v1/transactions
```

---

## 4. AUTHENTICATION (CRITICAL!)

```python
# Step 1: Encode authenticator key with Base64
authenticator_key = "7a2529f5-3587-4add-a2df-3d0606d62460"
encoded_key = base64.b64encode(authenticator_key.encode()).decode()

# Step 2: Generate timestamp (milliseconds)
timestamp = str(int(time.time() * 1000))

# Step 3: Generate secret-key
secret_key = base64.b64encode(
    hmac.new(encoded_key.encode(), timestamp.encode(), hashlib.sha256).digest()
).decode()

# Step 4: Generate request_hash (for Pay Bill only)
# Sequence: timestamp + utility_acc_no + amount + user_code
concat = timestamp + utility_acc_no + amount + user_code
request_hash = base64.b64encode(
    hmac.new(encoded_key.encode(), concat.encode(), hashlib.sha256).digest()
).decode()

# Headers for API call
headers = {
    "developer_key": "7c179a397b4710e71b2248d1f5892d19",
    "secret-key": secret_key,
    "secret-key-timestamp": timestamp,
    "request_hash": request_hash,  # Only for paybill
    "Content-Type": "application/json"
}
```

---

## 5. ERROR HANDLING

### Status Codes:
| Status | Meaning | Action |
|--------|---------|--------|
| 0 | Success | Complete transaction |
| 1-999 | Various errors | Show error message, refund PRC |

### Transaction Status (tx_status):
| tx_status | Status | Final? | Action |
|-----------|--------|--------|--------|
| 0 | Success | Yes | Complete |
| 1 | Failed | Yes | Refund PRC |
| 2 | Initiated | No | Poll status |
| 3 | Refund Pending | No | Wait |
| 4 | Refunded | Yes | Update status |
| 5 | Hold | No | Manual review |

---

## 6. DATABASE SCHEMA

### Collection: `redeem_requests`

```javascript
{
  "request_id": "RDM20260302123456789",
  "user_id": "uuid",
  "user_name": "string",
  "user_mobile": "string",
  
  // Service Info
  "service_type": "mobile_recharge|dth|electricity|gas|lpg|emi|credit_card|dmt",
  "operator_id": "1",  // Eko operator ID
  "operator_name": "Airtel Prepaid",
  "category_id": 5,
  
  // Request Details (varies by service)
  "utility_acc_no": "9876543210",  // Mobile/Account number
  "beneficiary_name": "string",  // For DMT
  "bank_account": "string",  // For DMT
  "ifsc_code": "string",  // For DMT
  
  // Amount Details
  "service_amount": 500,
  "eko_fee": 5,
  "flat_fee": 10,
  "admin_charges": 100,  // 20% of service_amount
  "total_prc_deducted": 615,
  
  // Status
  "status": "pending|approved|processing|completed|failed|rejected",
  "eko_status": null,  // tx_status from Eko
  "eko_tid": null,  // Transaction ID from Eko
  "eko_response": {},  // Full response
  
  // Admin
  "processed_by": null,
  "processed_at": null,
  "reject_reason": null,
  "admin_notes": null,
  
  // Timestamps
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

---

## 7. USER FLOW

```
1. User opens "Redeem PRC" page
2. Selects service (Mobile/DTH/Electricity/Gas/EMI/DMT)
3. Selects operator (dropdown from Eko API)
4. Enters required fields (based on operator parameters)
5. System shows:
   - Service Amount
   - Eko Fee (estimate)
   - Platform Fee: ₹10
   - Admin Charges: 20%
   - Total PRC Required
6. User confirms
7. PRC deducted, request created with status "pending"
8. Admin sees in dashboard
9. Admin clicks "Process with Eko"
10. Eko API called
11. Success → Complete | Fail → Admin can retry/reject
```

---

## 8. ADMIN FLOW

```
Admin Dashboard → Redeem Requests

Tabs: All | Mobile | DTH | Electricity | Gas | EMI | DMT

For each request:
  - View details
  - "Process with Eko" button
  - "Reject" button (refunds PRC)
  - "Manual Complete" (with UTR)

Filters:
  - Status: Pending/Completed/Failed/Rejected
  - Date Range
  - Amount Range
  - Service Type
  - User Search

Pagination: 20 per page
```

---

## 9. API ENDPOINTS (New)

### User Endpoints:
```
GET  /api/redeem/services              # List all services
GET  /api/redeem/operators/{category}  # Get operators
GET  /api/redeem/operator-params/{id}  # Get required fields
POST /api/redeem/calculate-charges     # Calculate total charges
POST /api/redeem/request               # Submit request
GET  /api/redeem/my-requests           # User's requests
```

### Admin Endpoints:
```
GET  /api/admin/redeem/requests        # All requests with filters
GET  /api/admin/redeem/request/{id}    # Single request detail
POST /api/admin/redeem/process/{id}    # Process with Eko
POST /api/admin/redeem/reject/{id}     # Reject with refund
POST /api/admin/redeem/complete/{id}   # Manual complete
GET  /api/admin/redeem/stats           # Dashboard stats
```

---

## 10. FRONTEND PAGES

### User: `/redeem` (Single Page)
- PhonePe-like design
- Service cards
- Dynamic form based on operator
- Real-time charge calculation
- Request history

### Admin: `/admin/redeem` (Single Page)
- Unified dashboard
- Tab-based service view
- Advanced filters
- Bulk actions
- Real-time stats

---

## 11. IMPORTANT NOTES

1. **IP Whitelisting**: Production IP must be whitelisted by Eko
2. **latlong**: Required for all transactions (use fixed value)
3. **source_ip**: Use server IP
4. **user_code**: "20810200" (our retailer code)
5. **initiator_id**: "9936606966" (our registered mobile)
6. **Fetch Bill**: Required for operators with fetchBill=1
7. **request_hash**: Only for paybill, not for other APIs

---

## 12. EKO CREDENTIALS (Production)

```
Developer Key: 7c179a397b4710e71b2248d1f5892d19
Authenticator Key: 7a2529f5-3587-4add-a2df-3d0606d62460
Initiator ID: 9936606966
User Code: 20810200
Base URL: https://api.eko.in:25002/ekoicici
```
