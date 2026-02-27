# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Financial rewards platform "Paras Reward" - stabilization, bug fixes, payment integrations, and Google Play Store preparation.

## Core Features
- PRC (Paras Reward Coin) earning and redemption system
- VIP Subscription plans (Startup, Growth, Elite)
- Bill Payment integration (Eko BBPS) - Admin Approval Flow
- DMT (Domestic Money Transfer) - Instant bank transfers
- Razorpay Payment Gateway
- Referral system with multi-level rewards
- Admin dashboard for user management

---

## CHANGELOG

### February 27, 2026 (Latest Session)

#### ✅ ADMIN APPROVAL FLOW - VERIFIED & TESTED
- **Problem Solved:** When admin approves a bill payment, if Eko API fails, status was incorrectly showing as "approved" on frontend
- **Solution:** 
  1. Backend now returns `approved_manual` status when Eko fails (403 IP not whitelisted)
  2. Frontend updated to handle `approved_manual` status properly
  3. "Manual Required" amber badge shows for such requests
  4. "Complete" button added for manual finalization
  5. Error reason (e.g., "IP not whitelisted") displayed to admin

#### Files Modified:
- `/app/backend/server.py` - Added `/api/admin/bill-payment/complete` endpoint, expanded valid request types
- `/app/frontend/src/pages/AdminBillPayments.js` - Added `approved_manual` status handling, Complete button, handleManualComplete function

#### Testing Status:
- Backend Tests: 12/12 passed ✅
- Frontend Tests: 15/15 passed ✅
- Test files created:
  - `/app/tests/e2e/admin-bill-payment-approval.spec.ts`
  - `/app/backend/tests/test_admin_bill_payment_approval.py`

---

## COMPLETED INTEGRATIONS

### ✅ Eko.in (Bill Payment & DMT)
- **Status:** LIVE (IP whitelisting required for production)
- **Services Supported:** Mobile Recharge, DTH, Electricity, Postpaid, Broadband, Water, Gas, LPG, Insurance, FASTag, Credit Card, Loan EMI, Municipal Tax, Bank Transfer (DMT)
- **Admin Approval Flow:** User Request → Admin Approve → Eko Auto-Pay → Success OR → approved_manual (on failure) → Admin Manual Complete

### ✅ Razorpay (Payments)
- **Status:** Working (Test Mode)
- **Key ID:** rzp_test_SL4M5PYZu27Uqw

---

## PENDING TASKS

### P0 - Critical
- [x] Admin approval flow - Eko fail handling ✅ COMPLETED

### P1 - Deployment
- [ ] Production server setup (Indian VPS for Eko IP whitelisting)
- [ ] AAB file for Play Store (via PWA Builder)

### P2 - Performance & UX
- [ ] Admin page timeout optimization (Profit & Loss page)
- [ ] Server-side search for admin
- [ ] Team/Level members display fix

### P3 - Future
- [ ] `server.py` refactor (26,000+ lines - critical technical debt)
- [ ] Push notifications (Firebase)
- [ ] Email/Mobile OTP verification

---

## TECHNICAL ARCHITECTURE

### Backend
- Python 3.11 + FastAPI
- MongoDB (Motor async)
- Redis Cache (Upstash)

### Frontend  
- React 18 + Vite
- TailwindCSS + Shadcn UI

### Key Files
```
/app/backend/
├── server.py                    # Main server (26k+ lines)
├── routes/
│   ├── auth.py                  # Authentication
│   ├── eko_payments.py          # Eko BBPS & DMT helpers

/app/frontend/src/pages/
├── AdminBillPayments.js         # Bill payment admin (approved_manual handling)
├── BillPayments.js              # User bill payment form
```

---

## KEY API ENDPOINTS

### Bill Payment Admin
- `GET /api/admin/bill-payment/requests` - List all requests
- `POST /api/admin/bill-payment/process` - Approve/Reject request (action: approve, reject)
- `POST /api/admin/bill-payment/complete` - Manual completion for approved_manual status

### Status Flow
```
pending → (approve) → completed (Eko success)
                    → approved_manual (Eko failed) → (complete) → completed
        → (reject) → rejected (PRC refunded)
```

---

## CREDENTIALS

### Admin Login
- UID: 8175c02a-4fbd-409c-8d47-d864e979f59f
- PIN: 123456

### Eko.in (LIVE)
- Developer Key: 7c179a397b4710e71b2248d1f5892d19
- Initiator ID: 9936606966

---

## USER COMMUNICATION LANGUAGE
**Marathi (मराठी)** - All user communication must be in Marathi.
