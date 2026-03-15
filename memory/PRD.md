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

### March 15, 2026 - P0 Bug Fix: Admin Members Page

#### ✅ Sorting Bug Fixed
- **Problem:** Frontend was sending `sort_field`/`sort_direction` but backend expected `sort_by`/`sort_order`
- **Fix:** Updated `AdminMembers.js` to send correct parameter names
- **Verified:** Elite user (39950 limit) now appears first when sorting by redeem_limit DESC

#### ✅ Redeem Limit Formula Working
- **Formula:** `Plan Price × 5 × 10 × months_active × (1 + 0.20 × active_referrals)`
- **Elite:** 799 × 5 × 10 = 39,950 PRC base/month
- **Growth:** 499 × 5 × 10 = 24,950 PRC base/month
- **Explorer:** 0 PRC (no redeem allowed)
- **+20% bonus** per active direct referral

#### ✅ Test Results
- **24/24 tests passed** (13 backend + 11 frontend)
- **Test File:** `/app/test_reports/iteration_123.json`

#### ✅ Data-testid Added
- Added proper data-testid attributes to AdminMembers.js for E2E testing

### March 14, 2026 - Dynamic PRC Rate System

#### ✅ Dynamic Rate Complete
- PRC-to-INR rate now auto-calculated from `prc_economy.py` model
- Applied across all redeem flows (BBPS, Bank Transfer, Subscription)

#### ✅ PRC Subscription Option
- "Pay with PRC" option for subscriptions
- Uses dynamic rate and respects redeem limits

### March 14, 2026 - Manual Bank Transfer System

#### ✅ Backend APIs Complete
- `GET /api/bank-transfer/config` - Returns PRC rate, fees, limits
- `POST /api/bank-transfer/request` - Create new bank transfer request
- `GET /api/bank-transfer/admin/requests` - Admin view with pagination

#### ✅ Frontend Pages Complete
- **BankRedeemPage.js** - User bank transfer page
- **AdminBankTransfers.js** - Admin panel

---

## Current Architecture

```
/app
├── backend/
│   ├── routes/
│   │   ├── manual_bank_transfer.py  # Bank redeem system
│   │   ├── unified_redeem_v2.py     # BBPS instant payments
│   │   └── bbps_services.py         # Eko BBPS API
│   ├── prc_economy.py               # Dynamic PRC rate model
│   └── server.py                    # /api/admin/members with sorting fix
└── frontend/
    └── src/
        ├── pages/
        │   ├── AdminMembers.js      # Fixed: sorting + data-testid
        │   ├── BankRedeemPage.js    # Bank transfer page
        │   ├── Mining.js            # Mining dashboard
        │   └── SubscriptionPlans.js # With PRC payment option
        └── components/
```

---

## Key Database Collections

### users
```javascript
{
  uid: "...",
  subscription_plan: "elite|growth|startup|explorer",
  created_at: "...",           // For redeem limit calculation
  referral_code: "...",        // To find referrals
  prc_balance: 12345.67
}
```

---

## Pending Issues

### P1: Minor Issues
- `created_at` sorting has minor inconsistency due to date format variations in DB

### P2: Production Issues
- Production deployment sometimes crashes after frontend changes
- 145 failed BBPS transactions root cause unknown

### P3: Enhancements
- Admin UI to manually override PRC rate
- Firebase/Email notifications for bank transfer status

---

## Upcoming Tasks

### P1
- [ ] Add admin UI to override PRC rate manually
- [ ] Test Manual Bank Transfer on production

### P2
- [ ] Investigate production deployment crashes
- [ ] Add notifications for bank transfers

### P3
- [ ] MongoDB to PostgreSQL migration
- [ ] Receipt generation for transactions

---

## Test Credentials
- **User Login:** `9421331342` / PIN: `942133`
- **Admin Login:** `Admin@paras.com` / PIN: `153759`

---

## API Endpoints Summary

### Admin Members
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/members/list | Get paginated members with sorting |
| GET | /api/admin/members/dashboard | Dashboard stats |

### Query Parameters for /api/admin/members/list
- `sort_by`: prc_balance, redeem_limit, used_limit, available_limit, created_at
- `sort_order`: asc, desc
- `page`, `limit`: Pagination
- `search`: Search by name, email, mobile

### Redeem Limit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/user/{uid}/redeem-limit | Get user's limit info |

---

Last Updated: March 15, 2026 (P0 Admin Members Bug Fix)
