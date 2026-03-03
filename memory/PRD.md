# Paras Reward - Eko API Integration

## OFFICIAL EKO FORMATS (from developers.eko.in)

### BBPS (Bill Payments) - Electricity, DTH, Gas, EMI
```
URL: https://api.eko.in:25002/ekoicici/v2/billpayments/paybill
Content-Type: application/json
request_hash: timestamp + utility_acc_no + amount + user_code
Body: { operator_id, utility_acc_no, amount }
API call: requests.post(url, json=payload, headers=headers)
```

### DMT (Money Transfer) - Bank Transfer
```
URL: https://api.eko.in:25002/ekoapi/v2/...
Content-Type: application/x-www-form-urlencoded
request_hash formulas:
  - Money Transfer: timestamp + customer_id + recipient_id + amount
  - Add Recipient: timestamp only
Body: Form data
API call: requests.post(url, data=form_data, headers=headers)
```

## Service Status

| Service | Function | Hash Formula | Status |
|---------|----------|--------------|--------|
| Mobile Recharge | test_recharge_exact_format() | timestamp + mobile + amount + user_code | ✅ Working |
| Electricity | execute_electricity_payment() | timestamp + utility_acc_no + amount + user_code | ✅ Working |
| DTH | execute_bbps_bill_payment() | timestamp + utility_acc_no + amount + user_code | Ready |
| Gas | execute_bbps_bill_payment() | timestamp + utility_acc_no + amount + user_code | Ready |
| EMI | execute_bbps_bill_payment() | timestamp + utility_acc_no + amount + user_code | Ready |
| DMT | execute_dmt_transfer() | timestamp + customer_id + recipient_id + amount | Ready |

## DMT API Endpoints (v2)
- `GET /api/eko/dmt/customer/v2/{mobile}` - Get customer
- `POST /api/eko/dmt/customer/create/v2` - Create customer
- `GET /api/eko/dmt/recipients/v2/{mobile}` - Get recipients
- `POST /api/eko/dmt/recipient/add/v2` - Add recipient
- `POST /api/eko/dmt/transfer/v2` - Initiate transfer
- `GET /api/eko/dmt/transaction/v2/{ref}` - Get status
- `GET /api/eko/dmt/banks` - Get bank list

## Key Files
- `backend/routes/eko_payments.py` - All Eko APIs
- `backend/routes/unified_redeem_v2.py` - Service routing

## Credentials
- Admin: admin@paras.com / 123456

## Notes
- Preview IP not whitelisted - test in production
- DMT uses different base URL: `/ekoapi/v2/` vs `/ekoicici/v2/`
