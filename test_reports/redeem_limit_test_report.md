# Redeem Limit Validation Test Report

**Date:** 2026-03-21  
**Test Type:** Logic Validation  
**Tested By:** Automated Testing

---

## Test Scenario

| Parameter | Value |
|-----------|-------|
| Redeem Limit | 10,000 PRC |
| Available PRC Balance | 5,000 PRC |
| Redeem Request Amount | 6,000 PRC |

---

## Expected Result

**REJECTED** - Insufficient PRC Balance

---

## Validation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    REDEEM REQUEST: 6000 PRC                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Check Redeem Limit                                  │
│ ─────────────────────────────                               │
│ Total Limit: 10,000 PRC                                     │
│ Used: 0 PRC                                                 │
│ Remaining: 10,000 PRC                                       │
│ Request: 6,000 PRC                                          │
│                                                             │
│ CHECK: 6000 <= 10000 ? ✅ YES                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Check PRC Balance                                   │
│ ─────────────────────────────                               │
│ Available: 5,000 PRC                                        │
│ Required: 6,000 PRC (amount + charges)                      │
│                                                             │
│ CHECK: 6000 <= 5000 ? ❌ NO                                 │
│                                                             │
│ ERROR: "Insufficient PRC balance.                           │
│         Required: 6000 PRC, Available: 5000 PRC"            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   ❌ REJECTED   │
                    └─────────────────┘
```

---

## Code Reference

**File:** `/app/backend/routes/unified_redeem_v2.py`  
**Lines:** 1056-1062

```python
# Check PRC balance
current_balance = user.get("prc_balance", 0)
if current_balance < total_prc_required:
    raise HTTPException(
        status_code=400,
        detail=f"Insufficient PRC balance. Required: {total_prc_required} PRC, Available: {current_balance} PRC"
    )
```

---

## All Validation Checks (In Order)

| # | Check | Condition | Your Scenario | Result |
|---|-------|-----------|---------------|--------|
| 1 | User Exists | user != None | User exists | ✅ Pass |
| 2 | Redeem Limit | request <= remaining_limit | 6000 <= 10000 | ✅ Pass |
| 3 | PRC Balance | balance >= required | 5000 >= 6000 | ❌ **FAIL** |
| 4 | Category Limit | category_used <= category_limit | Not checked | - |
| 5 | Cooldown Period | last_redeem + 7 days < now | Not checked | - |
| 6 | KYC Verified | user.kyc_verified == true | Not checked | - |

---

## Summary

### Answer to Your Question:

> **Q:** User ने 6000 ची redeem request केली तर होईल का?  
> - Redeem Limit: 10,000  
> - Available PRC: 5,000

**A:** ❌ **नाही, redeem होणार नाही!**

**कारण:** User कडे फक्त 5,000 PRC आहे पण त्याने 6,000 PRC ची request केली. Limit check pass होईल पण Balance check fail होईल.

**Error Message:**
```
"Insufficient PRC balance. Required: 6000 PRC, Available: 5000 PRC"
```

---

## Important Notes

1. **Redeem Limit ≠ PRC Balance**
   - Limit = Maximum amount user CAN redeem (based on subscription)
   - Balance = Actual PRC user HAS

2. **User can only redeem: MIN(Remaining Limit, Available Balance)**
   - In this case: MIN(10000, 5000) = 5000 PRC max

3. **Validation order matters** - Balance is checked AFTER limit check
