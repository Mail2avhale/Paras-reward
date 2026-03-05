# PARAS Reward Portal - Product Requirements Document

## Original Problem Statement
Build a comprehensive BBPS (Bill Payment) and DMT (Domestic Money Transfer) system for Paras Reward Portal where users can redeem their PRC (Paras Reward Coins) for real-world services like bill payments and bank transfers.

## Core Features

### 1. BBPS Module (COMPLETED ✅)
- Universal bill payment engine for Electricity, DTH, FASTag, Loan/EMI, Gas, LPG
- Robust Eko API error handling
- A-Z sorted operator lists

### 2. DMT Module (COMPLETED ✅ - BUGS FIXED March 2026)
- **Backend APIs**: Customer search, registration, OTP, recipient management, transfers
- **Frontend UI**: Integrated in RedeemPageV2 with existing recipients display
- **Direct Transfer**: No admin approval - instant IMPS transfer via Eko
- **Limits Enforced**: Monthly 1 transaction, ₹1000 max (admin configurable)
- **P0 Bugs Fixed** (March 5, 2026):
  - ✅ OTP flow working - EKO_AUTHENTICATOR_KEY fixed in backend/.env
  - ✅ Saved bank accounts now visible - Recipients API working
  - ✅ Direct transfer only - No admin approval, uses /eko/dmt/transfer

### 3. Admin Panel (COMPLETED ✅)
- DMT Dashboard with enable/disable toggle
- Global & per-user limits configuration
- Transaction viewer with filters
- Error Monitor with Eko codes
- **Popup Message feature (COMPLETED ✅ March 5, 2026)**
  - Admin can create, edit, toggle, delete popup messages
  - Users see active popup after login (not on login page)
  - Session storage prevents repeat showing
  - Route: `/admin/popup-messages`

### 4. Chatbot (UPDATED ✅)
- Money Transfer guide added
- Marathi/Hindi/English keywords supported
- Shows user's DMT transaction status

## Routes
| Route | Page | Purpose |
|-------|------|---------|
| `/redeem?service=dmt` | RedeemPageV2 | Main Bank Transfer flow |
| `/dmt` | DMTPage | Standalone DMT (backup) |
| `/admin/dmt` | AdminDMTDashboard | Admin DMT controls |
| `/admin/popup-messages` | AdminPopupMessages | Admin popup broadcast |

## Removed/Disabled
- ❌ Old BankRedeem.js routes (redirected to new flow)
- ❌ DMT v3 router (scaffolding only, disabled)
- ❌ `requiresAdmin` flag removed from DMT service
- ❌ Admin approval route for DMT (NEVER used now)

## DMT Limits (Current)
- **Monthly Transactions**: 1
- **Monthly Amount**: ₹1000
- **Minimum Transfer**: ₹100
- Admin can increase via `/admin/dmt` → Settings/User Limits

## Bank Support
| Bank | Status |
|------|--------|
| SBI | ✅ Working |
| HDFC (Savings) | ✅ Should work |
| ICICI, Axis | ✅ Should work |
| Business/Current Accounts | ❌ Not supported |
| Small banks (DBS, Slice, NESF) | ❌ IFSC not in Eko |

## Test Credentials
- **User**: mail2avhale@gmail.com / PIN: 153759
- **Mobile**: 9970100782 (Eko registered)
- **SBI Recipient ID**: 15186062
- **Admin**: admin@paras.com / 123456

## Completed Work (March 5, 2026)
1. ✅ **P0 Bug Fix**: EKO_AUTHENTICATOR_KEY restored in backend/.env
2. ✅ **P0 Bug Fix**: Recipients now display correctly on RedeemPageV2
3. ✅ **P0 Bug Fix**: DMT ALWAYS uses direct transfer API (no admin approval)
4. ✅ **Testing**: 29/29 tests passed (19 backend + 10 frontend)
5. ✅ **P1 Complete**: Admin Popup Message feature (24/24 tests passed)
   - Backend CRUD APIs at `/api/admin/popup/*`
   - Admin UI at `/admin/popup-messages`
   - User-facing popup shows after login only

## Pending/Future
- P1: In-App Notifications (sonner toasts) for transfer status
- P1: DMT v3 with Aadhaar OTP eKYC (planned after deploy)
- P2: API route conflict cleanup (eko_payments.py vs eko_dmt_service.py)
- P2: "Failed to delete plan" admin bug
- P3: Email/Mobile OTP verification
- P3: KYC images migration to S3
