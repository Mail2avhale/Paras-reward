# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Financial rewards platform "Paras Reward" with bill payment integration via Eko API.

---

## CHANGELOG

### February 28, 2026 (Current Session)

#### ✅ ADMIN CONTROL FLOW - NO AUTO-REJECT
**User Request:** "Direct reject नको - Admin manually reject करेल. Manual approval पण करता आली पाहिजे."

**New Flow:**
```
pending → Admin Approve → Eko API (3 retries)
    ├─ SUCCESS: completed (auto + Eko TXN)
    └─ FAIL: eko_failed (Admin decides)
         ├─ 🔄 Retry: Try Eko again
         ├─ ✅ Complete: Manual completion
         └─ ❌ Reject: Reject + PRC refund
```

**Key Changes:**
- ❌ Removed auto-reject on Eko failure
- ✅ New `eko_failed` status (instead of rejected)
- ✅ Admin gets full control: Retry / Complete / Reject
- ✅ PRC refund only on manual reject

**Admin Actions:**
| Action | From Status | To Status | Description |
|--------|-------------|-----------|-------------|
| approve | pending | completed / eko_failed | Try Eko API |
| retry | eko_failed | completed / eko_failed | Retry Eko |
| complete | pending / eko_failed | completed | Manual completion |
| reject | any (not completed) | rejected | Reject + refund |

---

## CURRENT STATUS

### Production IP Issue
**⚠️ IMPORTANT:** Eko कडून email आला की IP whitelist केला. पण preview server IP (`34.170.12.145`) वापरला जात आहे. 

**Action Required:** 
1. Production server चा actual IP check करा
2. Eko ला योग्य IP पाठवा किंवा code मध्ये IP update करा

Code location: `/app/backend/server.py` - line 25808, 25865
```python
"source_ip": "34.170.12.145"  # ← Change to production IP
```

---

## TESTING STATUS

**Test Report:** `/app/test_reports/iteration_86.json`
- Backend: 10/10 passed ✅
- Frontend: 17/17 passed ✅

---

## KEY API ENDPOINTS

### Bill Payment Admin
```
POST /api/admin/bill-payment/process
Body: {
    "request_id": "...",
    "action": "approve" | "retry" | "complete" | "reject",
    "admin_uid": "...",
    "reject_reason": "..." (for reject),
    "txn_reference": "..." (for complete)
}
```

### Status Flow
```
pending ──approve──> completed (Eko success)
                └──> eko_failed (Eko fail)
                         │
                         ├──retry──> completed / eko_failed
                         ├──complete──> completed
                         └──reject──> rejected (PRC refund)
```

---

## CREDENTIALS

### Admin Login
- UID: 8175c02a-4fbd-409c-8d47-d864e979f59f
- PIN: 123456

### Eko.in
- Developer Key: 7c179a397b4710e71b2248d1f5892d19
- Initiator ID: 9936606966
- Base URL: https://api.eko.in:25002/ekoicici

---

## USER LANGUAGE
**Marathi (मराठी)**
