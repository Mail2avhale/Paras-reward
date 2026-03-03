# Paras Reward - Eko BBPS Integration

## OFFICIAL EKO FORMAT (from developers.eko.in)

### Authentication Headers:
```
developer_key: Your static API key
secret-key: Dynamic security key
secret-key-timestamp: Timestamp in milliseconds
request_hash: Hash for financial transactions
Content-Type: application/json
```

### Key Generation (OFFICIAL):
```python
# Step 1: Encode access_key using base64
encoded_key = base64.b64encode(access_key.encode()).decode()

# Step 2: Generate secret-key
secret_key = base64.b64encode(
    hmac.new(encoded_key.encode(), timestamp.encode(), hashlib.sha256).digest()
).decode()

# Step 3: Generate request_hash for Bill Payments
# Formula: timestamp + utility_acc_no + amount + user_code
concatenated_string = timestamp + utility_acc_no + amount + user_code
request_hash = base64.b64encode(
    hmac.new(encoded_key.encode(), concatenated_string.encode(), hashlib.sha256).digest()
).decode()
```

### API Call:
```python
payload = {
    "operator_id": operator_id,
    "utility_acc_no": utility_acc_no,
    "amount": amount
}
response = requests.post(url, json=payload, headers=headers)
```

## Service Status

| Service | Function | Status |
|---------|----------|--------|
| Mobile Recharge | test_recharge_exact_format() | ✅ Working |
| Electricity | execute_electricity_payment() | ✅ Working |
| DTH | execute_bbps_bill_payment() | Ready for test |
| Gas | execute_bbps_bill_payment() | Ready for test |
| EMI | execute_bbps_bill_payment() | Ready for test |

## Files Changed
- `backend/routes/eko_payments.py` - Updated with official format
- `backend/routes/unified_redeem_v2.py` - Service routing

## Credentials
- Admin: admin@paras.com / 123456

## Key Learnings
1. **ALWAYS use official documentation** - not assumptions
2. **IP whitelist errors can mask coding issues** - verify format first
3. **Hash formula is critical** - `timestamp + utility_acc_no + amount + user_code`
4. **Use `json=payload`** not `data=json_string` for cleaner code
