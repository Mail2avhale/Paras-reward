# PARAS Reward Portal - Product Requirements Document

## Original Problem Statement
Build a comprehensive BBPS (Bill Payment) and DMT (Domestic Money Transfer) system for Paras Reward Portal where users can redeem their PRC (Paras Reward Coins) for real-world services like bill payments and bank transfers.

## Core Features

### 1. BBPS Module (COMPLETED ✅)
- Universal bill payment engine for Electricity, DTH, FASTag, Loan/EMI, Gas, LPG
- Robust Eko API error handling
- A-Z sorted operator lists

### 2. DMT Module (COMPLETED ✅)
- **Backend APIs**: Customer search, registration, OTP, recipient management, transfers
- **Frontend UI**: Integrated in RedeemPageV2 with existing recipients display
- **Direct Transfer**: No admin approval - instant IMPS transfer via Eko
- **Limits Enforced**: Monthly 1 transaction, ₹1000 max (admin configurable)

### 3. Admin Panel (COMPLETED ✅)
- DMT Dashboard with enable/disable toggle
- Global & per-user limits configuration
- Transaction viewer with filters
- Error Monitor with Eko codes

### 4. Chatbot (UPDATED ✅)
- Money Transfer guide added
- Marathi/Hindi/English keywords supported
- Shows user's DMT transaction status

## Routes
| Route | Page | Purpose |
|-------|------|---------|
| `/redeem?service=dmt` | RedeemPageV2 | Main Bank Transfer flow |
| `/dmt` | DMTPage | Standalone DMT (backup) |
| `/admin/dmt` | AdminDMTDashboard | Admin controls |

## Removed/Disabled
- ❌ Old BankRedeem.js routes (redirected to new flow)
- ❌ DMT v3 router (scaffolding only, disabled)
- ❌ `requiresAdmin` flag removed from DMT service

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

## Completed Work (This Session)
1. ✅ DMT backend APIs (v1) with limit enforcement
2. ✅ RedeemPageV2 integration - existing recipients display
3. ✅ OTP registration flow for new customers
4. ✅ Direct EKO transfer (no admin approval)
5. ✅ Monthly limits: 1 txn, ₹1000
6. ✅ Chatbot Money Transfer guide
7. ✅ Old code cleanup (v3 disabled, old routes removed)
8. ✅ Real transfer test: ₹100 to SBI (TID: 3545730163)

## Pending/Future
- P1: DMT v3 with Aadhaar/eKYC (if needed later)
- P2: "Failed to delete plan" admin bug
- P3: Email/Mobile OTP verification
