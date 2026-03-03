# Paras Reward - Product Requirements Document

## Original Problem Statement
Build a unified "Redeem" system for Eko-powered payment services.

## ELECTRICITY FIX - December 2025

### CORRECT FORMAT (from Eko docs):
```python
# Content-Type: application/json
# request_hash = timestamp + utility_acc_no + amount (ONLY 3 values!)
# Body: { operator_id, utility_acc_no, amount }
# API: requests.post(url, json=payload, headers=headers)
```

### Files Changed:
- `backend/routes/eko_payments.py` - `execute_electricity_payment()` function

### Test Status:
- Preview: 403 (IP not whitelisted - expected)
- Production: **NEEDS TESTING**

## Service Status

| Service | Format | Hash Formula | Status |
|---------|--------|--------------|--------|
| Mobile Recharge | JSON | timestamp + mobile + amount + user_code | ✅ Working |
| Electricity | JSON | timestamp + utility_acc_no + amount | ✅ Ready for prod test |
| DTH/Gas/EMI | - | - | Pending |

## Credentials
- **Admin:** `admin@paras.com` / `123456`
- **Preview IP:** 34.16.56.64 (NOT whitelisted)
