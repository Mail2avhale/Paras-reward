# EKO LEVIN DMT - POSTMAN SETUP GUIDE

## Environment Variables (EKO-DMT-V3)

```
base_url = https://api.eko.in:25002/ekoicici/v3
developer_key = 7c179a397b4710e71b2248d1f5892d19
access_key = 7a2529f5-3587-4add-a2df-3d0606d62460
initiator_id = 9936606966
user_code = 20810200
customer_id = 9421331342
```

## Common Headers

```
developer_key: {{developer_key}}
secret-key: {{secret_key}}
secret-key-timestamp: {{timestamp}}
Content-Type: application/x-www-form-urlencoded
```

## Pre-Request Script (Auto-generate secret)

```javascript
const accessKey = pm.environment.get("access_key");
const encodedKey = btoa(accessKey);
const timestamp = Date.now().toString();
const signature = CryptoJS.HmacSHA256(timestamp, encodedKey);
const secretKey = CryptoJS.enc.Base64.stringify(signature);

pm.environment.set("timestamp", timestamp);
pm.environment.set("secret_key", secretKey);
```

---

## API FLOW

### API 1 - Check Sender Profile
```
GET {{base_url}}/customer/profile/{{customer_id}}?initiator_id={{initiator_id}}&user_code={{user_code}}
```

### API 2 - Get Recipient List
```
GET {{base_url}}/customer/payment/ppi/sender/{{customer_id}}/recipients?initiator_id={{initiator_id}}&user_code={{user_code}}
```

### API 3 - Add Recipient
```
POST {{base_url}}/customer/payment/ppi/sender/{{customer_id}}/recipient

Body (form-urlencoded):
- initiator_id = {{initiator_id}}
- user_code = {{user_code}}
- recipient_name = SANTOSH AVHALE
- recipient_mobile = 8888888888  (MUST be different from sender)
- account = 31277621502
- ifsc = SBIN0013693
- recipient_type = 3
```

### API 4 - Register Recipient with Bank
```
POST {{base_url}}/customer/payment/ppi/sender/{{customer_id}}/bank/recipient

Body:
- initiator_id = {{initiator_id}}
- user_code = {{user_code}}
- recipient_id = {{recipient_id}}
```

### API 5 - Send Transfer OTP
```
POST {{base_url}}/customer/payment/ppi/otp

Body:
- initiator_id = {{initiator_id}}
- user_code = {{user_code}}
- customer_id = {{customer_id}}
- recipient_id = {{recipient_id}}
- beneficiary_id = {{beneficiary_id}}
- amount = 1000
- service_code = 80
```

### API 6 - Initiate Transfer
```
POST {{base_url}}/customer/payment/ppi

Body:
- initiator_id = {{initiator_id}}
- user_code = {{user_code}}
- customer_id = {{customer_id}}
- recipient_id = {{recipient_id}}
- beneficiary_id = {{beneficiary_id}}
- amount = 1000
- currency = INR
- channel = 2
- state = 1
- client_ref_id = TXN{{timestamp}}
- otp = {{transfer_otp}}
- otp_ref_id = {{otp_ref_id}}
```

### API 7 - Check Transaction Status
```
GET {{base_url}}/tools/reference/transaction/{{tid}}
```

---

## Complete Flow

1. Check Sender Profile → Verify sender exists
2. Add Recipient → Get `recipient_id`
3. Register Recipient with Bank → Get `beneficiary_id`
4. Send Transfer OTP → Get `otp_ref_id`
5. Initiate Transfer → Get `tid` (transaction ID)
6. Check Status → Verify transaction

---

## Common Errors

| Code | Meaning |
|------|---------|
| 204 | Sender not verified |
| 302 | Wrong OTP |
| 403 | Authentication error |
| 415 | Wrong content type |
| 500 | PPI module disabled or invalid request |

---

## Current Status (March 13, 2026)

- ✅ API 1 (Sender Profile) - Working
- ❌ API 2-6 (PPI) - 500 Error (PPI module not enabled)

**Action Required:** Ask Eko to enable PPI module for initiator_id: 9936606966
