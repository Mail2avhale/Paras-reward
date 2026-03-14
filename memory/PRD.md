# PARAS REWARD - Product Requirements Document

## Original Problem Statement
User's main objectives are to build a complete fintech rewards and cashback platform with:
1. **Manual Bank Transfer Redeem System:** PRC to INR bank transfer with admin approval
2. **BBPS Instant Payments:** Mobile recharge, DTH, electricity, gas bills etc.
3. **Subscription Management:** Razorpay integration for VIP plans
4. **PRC Economy:** Mining, referrals, expiry, limits

## User Language
**Primary Language: Marathi (मराठी)**

---

## What's Been Implemented

### March 14, 2026 - Manual Bank Transfer System

#### ✅ Backend APIs Complete
- `GET /api/bank-transfer/config` - Returns PRC rate, fees, limits
- `GET /api/bank-transfer/calculate-fees` - Fee calculation for any amount
- `POST /api/bank-transfer/verify-ifsc` - IFSC verification with Eko API + fallback
- `POST /api/bank-transfer/request` - Create new bank transfer request
- `GET /api/bank-transfer/my-requests/{user_id}` - User's request history
- `GET /api/bank-transfer/admin/requests` - Admin view with pagination, search, filters
- `POST /api/bank-transfer/admin/mark-paid` - Mark request as paid with UTR
- `POST /api/bank-transfer/admin/mark-failed` - Mark failed with PRC refund
- `GET /api/bank-transfer/admin/stats` - Dashboard statistics

#### ✅ Frontend Pages Complete
- **BankRedeemPage.js** - User page with:
  - Amount input with validation (₹200-₹10,000)
  - Fee breakdown display
  - IFSC verification with auto bank name
  - Account number validation (match confirmation)
  - Policy agreement modal
  - Request history tab
  - **Global Redeem Limit Display** (Total/Used/Remaining PRC)
  
- **AdminBankTransfers.js** - Admin panel with:
  - Stats cards (Pending/Paid/Failed counts and amounts)
  - Search by name, phone, account
  - Filter by status
  - Date range filter
  - Sort order (Oldest/Newest first)
  - Pagination
  - Mark Paid (with UTR) / Mark Failed (with refund) actions

#### ✅ Routing & Navigation
- User route: `/prc-to-bank` or `/bank-redeem`
- Admin route: `/admin/bank-transfers`
- Sidebar menu items added for both user and admin

#### ✅ Fee Structure
- 1 INR = 10 PRC
- Transaction Fee: ₹10 flat
- Admin Fee: 20% of withdrawal amount
- Min: ₹200, Max: ₹10,000

#### ✅ Double Subscription Fix
- Added atomic locking in Razorpay verify-payment and webhook handlers
- Prevents race condition between verify-payment and webhook
- Uses `find_one_and_update` with claim mechanism

### Previous Sessions
- DMT V1/V3 removed completely
- Old admin pages (bill-payments, unified-payments) removed
- Production PRC deduction bug fixed with wallet_service_v2
- Global redeem limit system implemented
- PRC expiry disabled

---

## Current Architecture

```
/app
├── backend/
│   ├── routes/
│   │   ├── manual_bank_transfer.py  # NEW: Manual bank redeem system
│   │   ├── unified_redeem_v2.py     # BBPS instant payments
│   │   ├── bbps_services.py         # Eko BBPS API
│   │   ├── razorpay_payments.py     # Subscription with double-fix
│   │   ├── admin_ledger_view.py     # Ledger view + diagnostic APIs
│   │   └── wallet.py                # Wallet routes
│   ├── app/services/
│   │   └── wallet_service_v2.py     # PRC debit/credit service
│   └── server.py
└── frontend/
    └── src/
        ├── pages/
        │   ├── BankRedeemPage.js         # NEW: User bank transfer page
        │   ├── Admin/AdminBankTransfers.js # NEW: Admin bank transfers
        │   ├── RedeemPageV2.js           # BBPS instant payments
        │   └── AdminRazorpaySubscriptions.js
        └── components/
            ├── Sidebar.js                # User menu
            └── layouts/AdminLayout.js    # Admin menu
```

---

## Key Database Collections

### bank_transfer_requests (NEW)
```javascript
{
  request_id: "BTR-20260314...",
  user_id: "...",
  user_name: "...",
  user_phone: "...",
  withdrawal_amount: 500,    // INR
  admin_fee: 100,            // INR
  transaction_fee: 10,       // INR
  total_inr: 610,            // INR
  prc_deducted: 6100,        // PRC
  account_holder_name: "...",
  account_number: "...",
  ifsc_code: "...",
  bank_name: "...",
  status: "pending|paid|failed",
  utr_number: "...",         // For paid
  admin_remark: "...",
  prc_refunded: false,
  created_at: "...",
  processed_at: "..."
}
```

---

## Pending Issues

### P1: Production Deployment Crashes
- App sometimes crashes after frontend deployment
- Needs investigation of build process

### P2: 145 Failed BBPS Transactions (No Eko TID)
- Root cause unknown
- Likely fixed by code updates but unconfirmed

### P3: PRC Double Issue
- User reported PRC doubled for user `166c67d6-99c4-4cb0-9ca3-38cd8b0c5fa2`
- Diagnostic API created: `/api/admin/ledger/diagnose-prc-double/{user_id}`
- Needs production investigation

---

## Upcoming Tasks

### P1
- [ ] Test Manual Bank Transfer on production after deploy
- [ ] Investigate PRC double issue on production
- [ ] Add Firebase/Email notifications for bank transfer status

### P2
- [ ] Admin analytics dashboard for bank transfers
- [ ] Rate limiting on new APIs
- [ ] Receipt generation for bank transfers

### P3
- [ ] MongoDB to PostgreSQL migration (user requested)
- [ ] Email/Mobile OTP verification
- [ ] Large component refactoring

---

## Test Credentials
- **User Login:** `9421331342` / PIN: `942133`
- **Admin Login:** `Admin@paras.com` / PIN: `153759`

---

## API Endpoints Summary

### Bank Transfer
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/bank-transfer/config | Get config (rates, limits) |
| GET | /api/bank-transfer/calculate-fees | Calculate fees |
| POST | /api/bank-transfer/verify-ifsc | Verify IFSC code |
| POST | /api/bank-transfer/request | Create request |
| GET | /api/bank-transfer/my-requests/{uid} | User history |
| GET | /api/bank-transfer/admin/requests | Admin list |
| GET | /api/bank-transfer/admin/stats | Admin stats |
| POST | /api/bank-transfer/admin/mark-paid | Mark as paid |
| POST | /api/bank-transfer/admin/mark-failed | Mark as failed |

### Redeem Limit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/user/{uid}/redeem-limit | Get user's limit info |

### Diagnostic
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/ledger/diagnose-prc-double/{uid} | PRC double diagnosis |
| POST | /api/admin/ledger/fix-prc-double/{uid} | Fix PRC double |

---

Last Updated: March 14, 2026
