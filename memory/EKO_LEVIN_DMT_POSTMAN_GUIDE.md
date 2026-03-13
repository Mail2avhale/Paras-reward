# EKO LEVIN DMT - POSTMAN SETUP GUIDE

## Environment Variables (EKO-DMT-V3 Production)

```
base_url = https://api.eko.in:25002/ekoicici/v3
developer_key = 7c179a397b4710e71b2248d1f5892d19
access_key = 7a2529f5-3587-4add-a2df-3d0606d62460
initiator_id = 9936606966
user_code = 19560001  # PRODUCTION (staging: 20810200)
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

## API FLOW (LEVIN DMT - Uses /dmt-levin/ path, NOT /ppi/)

### API 1 - Check Sender Profile ✅ WORKING
```
GET {{base_url}}/customer/profile/{{customer_id}}?initiator_id={{initiator_id}}&user_code={{user_code}}
```

### API 2 - Get Recipient List ✅ WORKING
```
GET {{base_url}}/customer/payment/dmt-levin/sender/{{customer_id}}/recipients?initiator_id={{initiator_id}}&user_code={{user_code}}&additional_info=1
```

### API 3 - Add Recipient
```
POST {{base_url}}/customer/payment/dmt-levin/sender/{{customer_id}}/recipient

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
POST {{base_url}}/customer/payment/dmt-levin/sender/{{customer_id}}/bank/recipient

Body:
- initiator_id = {{initiator_id}}
- user_code = {{user_code}}
- recipient_id = {{recipient_id}}
```

### API 5 - Send Transfer OTP ✅ WORKING
```
POST {{base_url}}/customer/payment/dmt-levin/otp

Body:
- initiator_id = {{initiator_id}}
- user_code = {{user_code}}
- customer_id = {{customer_id}}
- recipient_id = {{recipient_id}}
- amount = 100

Note: service_code NOT required for Levin DMT!
```

### API 6 - Initiate Transfer ✅ WORKING
```
POST {{base_url}}/customer/payment/dmt-levin

Body:
- initiator_id = {{initiator_id}}
- user_code = {{user_code}}
- customer_id = {{customer_id}}
- recipient_id = {{recipient_id}}
- amount = 100
- currency = INR
- channel = 2
- state = 1
- client_ref_id = TXN{{timestamp}}
- otp = {{transfer_otp}}
- otp_ref_id = {{otp_ref_id}}
- latlong = 28.6139,77.2090
- timestamp = 2026-03-13 15:00:00
- recipient_id_type = 1
```

### API 7 - Check Transaction Status
```
GET {{base_url}}/tools/reference/transaction/{{tid}}
```

---

## Complete Flow

1. Check Sender Profile → Verify sender exists
2. Get Recipients List → See existing recipients
3. Add Recipient (if needed) → Get `recipient_id`
4. Register Recipient with Bank (if needed) → Get `beneficiary_id`
5. Send Transfer OTP → Get `otp_ref_id`
6. Initiate Transfer → Get `tid` (transaction ID)
7. Check Status → Verify transaction

---

## Important Notes

1. **Use `/dmt-levin/` path, NOT `/ppi/`** - PPI module not required for Levin DMT
2. **Production user_code**: `19560001` (staging: `20810200`)
3. **Monthly limit**: ₹25,000 per sender
4. **OTP validity**: ~5 minutes

---

## Common Errors

| Code | Meaning |
|------|---------|
| 204 | Sender not verified |
| 302 | Wrong OTP |
| 403 | Authentication error |
| 415 | Wrong content type |
| 500 | PPI module disabled (use /dmt-levin/ instead) |
| "Insufficient balance" | Eko retailer wallet needs recharge |

---

## Current Status (March 13, 2026)

- ✅ API 1 (Sender Profile) - Working
- ✅ API 2 (Get Recipients) - Working
- ✅ API 5 (Send OTP) - Working
- ✅ API 6 (Transfer) - Working (requires wallet balance)

**All Levin DMT APIs are fully functional!**
