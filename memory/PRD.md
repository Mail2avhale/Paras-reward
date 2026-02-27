# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Financial rewards platform "Paras Reward" - stabilization, bug fixes, payment integrations, and Google Play Store preparation.

## Core Features
- PRC (Paras Reward Coin) earning and redemption system
- VIP Subscription plans (Startup, Growth, Elite)
- Bill Payment integration (Eko BBPS) - Fully Automatic
- DMT (Domestic Money Transfer) - Instant bank transfers
- Razorpay Payment Gateway
- Referral system with multi-level rewards
- Admin dashboard for user management

---

## CHANGELOG

### February 27, 2026 (Session 2)

#### ✅ FULLY AUTOMATIC EKO PAYMENT FLOW - IMPLEMENTED
**User Request:** "Manual काहीच नको - सर्व Eko API through झाले पाहिजे, retry करून, नाहीतर reject with reason"

**New Flow:**
```
User Request → pending
Admin Approve → Eko API Call (3 retries with exponential backoff: 2s, 4s, 6s)
    ├─ SUCCESS → completed (Eko TXN number auto-saved)
    └─ FAIL → rejected (reason + PRC auto-refunded)
```

**Key Changes:**
1. ❌ Removed `approved_manual` status completely
2. ❌ Removed `/api/admin/bill-payment/complete` endpoint
3. ❌ Removed "Complete" button from frontend
4. ✅ Added 3x automatic retry with exponential backoff
5. ✅ Auto-reject with clear error reason on Eko fail
6. ✅ Auto-refund PRC to user on rejection
7. ✅ Eko Transaction ID saved on success

**Supported Services (via Eko):**
- Mobile Recharge (Prepaid/Postpaid)
- DTH Recharge
- Electricity, Water, Gas Bills
- Broadband, Landline Bills
- LPG Booking
- Insurance Premium
- FASTag Recharge
- Credit Card Bills
- Loan EMI
- Municipal Tax
- **Bank Transfer (DMT)**

### February 27, 2026 (Session 1)
- Implemented initial admin approval flow
- Added `approved_manual` status (now removed)
- Fixed PRC mining for free users

---

## CURRENT STATUS

### Bill Payment Flow (Production Ready)
```
┌─────────────────────────────────────────────────────────────┐
│  USER: Submit Bill Payment Request                          │
│         ↓                                                   │
│  STATUS: pending (PRC deducted)                             │
│         ↓                                                   │
│  ADMIN: Click "Approve"                                     │
│         ↓                                                   │
│  SYSTEM: Call Eko API (3 retries)                          │
│         ↓                                                   │
│  ┌─────────────────┬─────────────────────────────────┐     │
│  │ Eko SUCCESS     │ Eko FAIL (after 3 retries)     │     │
│  │    ↓            │         ↓                       │     │
│  │ completed       │ rejected                        │     │
│  │ +Eko TXN ID     │ +Error Reason                   │     │
│  │                 │ +PRC Refund                     │     │
│  └─────────────────┴─────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### ⚠️ IMPORTANT: Eko IP Whitelisting Required
- All Eko API calls currently fail with **403 Forbidden**
- Reason: Preview environment IP not whitelisted by Eko
- **Solution:** Deploy to Indian VPS and whitelist that IP with Eko
- The auto-reject + PRC refund flow is working correctly

---

## KEY API ENDPOINTS

### Bill Payment Admin
- `GET /api/admin/bill-payment/requests` - List all requests
- `POST /api/admin/bill-payment/process` - Approve/Reject (action: approve, reject ONLY)
  - approve → triggers Eko with 3 retries → completed OR rejected

### Status Values
| Status | Description |
|--------|-------------|
| pending | User submitted, awaiting admin |
| completed | Eko payment successful |
| rejected | Eko failed / Admin rejected (PRC refunded) |

---

## TESTING STATUS

**Latest Test Report: /app/test_reports/iteration_85.json**
- Backend: 10/10 passed ✅
- Frontend: 18/18 passed ✅
- Total: 28/28 passed

**Test Files:**
- `/app/tests/e2e/admin-bill-payment-approval.spec.ts`
- `/app/backend/tests/test_admin_bill_payment_approval.py`

---

## PENDING TASKS

### P1 - Deployment (Blocking Eko Integration)
- [ ] Indian VPS setup with static IP
- [ ] Eko IP whitelisting (send IP to Eko support)
- [ ] Production deployment

### P1 - Play Store
- [ ] AAB file generation (via PWA Builder)

### P2 - Performance
- [ ] Admin page timeout optimization
- [ ] Server-side search

### P3 - Future
- [ ] `server.py` refactor (26k+ lines)
- [ ] Push notifications (Firebase)

---

## CREDENTIALS

### Admin Login
- UID: 8175c02a-4fbd-409c-8d47-d864e979f59f
- PIN: 123456

### Eko.in (LIVE - needs IP whitelisting)
- Developer Key: 7c179a397b4710e71b2248d1f5892d19
- Initiator ID: 9936606966

---

## USER LANGUAGE
**Marathi (मराठी)** - All communication in Marathi.
