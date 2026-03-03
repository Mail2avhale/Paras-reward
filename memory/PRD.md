# Paras Reward - Eko API Integration

## DMT v3 API FORMAT (PRODUCTION)

### Base URL
```
https://api.eko.in:25002/ekoapi/v3
```

### Step 1: Check Customer
```bash
curl -X GET "https://api.eko.in:25002/ekoapi/v3/customers/mobile/9876543210" \
-H "developer_key: YOUR_KEY" \
-H "secret-key: YOUR_SECRET_KEY" \
-H "secret-key-timestamp: YOUR_TIMESTAMP"
```

### Step 2: Add Beneficiary
```bash
curl -X POST "https://api.eko.in:25002/ekoapi/v3/customers/CUSTOMER_ID/recipients" \
-H "Content-Type: application/json" \
-H "developer_key: YOUR_KEY" \
-H "secret-key: YOUR_SECRET_KEY" \
-H "secret-key-timestamp: YOUR_TIMESTAMP" \
-H "request_hash: YOUR_HASH" \
-d '{
  "recipient_name": "RAHUL SHARMA",
  "bank_code": "HDFC",
  "account_number": "123456789012",
  "ifsc": "HDFC0001234",
  "recipient_mobile": "9876543210"
}'
```

### Step 3: Money Transfer
```bash
curl -X POST "https://api.eko.in:25002/ekoapi/v3/transactions" \
-H "Content-Type: application/json" \
-H "developer_key: YOUR_KEY" \
-H "secret-key: YOUR_SECRET_KEY" \
-H "secret-key-timestamp: YOUR_TIMESTAMP" \
-H "request_hash: YOUR_HASH" \
-d '{
  "service_code": "45",
  "customer_id": "CUSTOMER_ID",
  "recipient_id": "RECIPIENT_ID",
  "amount": 100,
  "channel": "IMPS",
  "client_ref_id": "TXN10001"
}'
```

### Hash Formula
```
DMT REQUEST HASH = timestamp + customer_id + recipient_id + amount + client_ref_id
```

## App API Endpoints (DMT v3)
- `GET /api/eko/dmt/v3/customer/{mobile}` - Check customer
- `POST /api/eko/dmt/v3/recipient/add` - Add beneficiary
- `POST /api/eko/dmt/v3/transfer` - Money transfer
- `GET /api/eko/dmt/v3/banks` - Bank list ✅

## BBPS API FORMAT

### Base URL
```
https://api.eko.in:25002/ekoicici/v2/billpayments/paybill
```

### Hash Formula
```
BBPS REQUEST HASH = timestamp + utility_acc_no + amount + user_code
```

## Service Status

| Service | API Version | Hash Formula | Status |
|---------|-------------|--------------|--------|
| Mobile Recharge | BBPS v2 | timestamp + mobile + amount + user_code | ✅ Working |
| Electricity | BBPS v2 | timestamp + consumer + amount + user_code | ✅ Working |
| DTH | BBPS v2 | timestamp + consumer + amount + user_code | Ready |
| Gas | BBPS v2 | timestamp + consumer + amount + user_code | Ready |
| EMI | BBPS v2 | timestamp + loan_acc + amount + user_code | Ready |
| DMT | v3 | timestamp + customer_id + recipient_id + amount + client_ref_id | Ready for prod test |
