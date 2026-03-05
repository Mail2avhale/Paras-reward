# PARAS REWARD - Bill Payment Platform

## Original Problem Statement
Full-stack bill payment platform using Eko BBPS APIs for electricity, mobile, DTH, FASTag, and other utility bill payments with DMT (Domestic Money Transfer) for bank transfers.

## Architecture
- **Frontend:** React.js with Tailwind CSS, Shadcn UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Payment Gateway:** Razorpay (subscriptions), Eko (BBPS + DMT)

## What's Been Implemented

### Session: 2026-03-05 - Complete DMT Implementation

**DMT v1 (Basic Flow)** - `/api/eko/dmt/*`
- Customer Search/Registration
- Add Bank Recipient
- Money Transfer (PRC to INR)
- Transaction Status & History
- PRC refund on failure

**DMT v3 (Advanced Flow with Aadhaar)** - `/api/dmt/v3/*`
- Airtel DMT Flow
- Fino DMT Flow  
- Levin DMT Flow
- Aadhaar OTP Verification
- Biometric eKYC
- Transaction OTP

**Frontend DMT Page** - `/dmt` or `/bank-transfer`
- Customer search
- Recipient management
- Transfer execution
- Transaction history
- PRC balance display

### BBPS Services (Bill Payments)
| Service | Category | Operators |
|---------|----------|-----------|
| Mobile Prepaid | 5 | 6 (Jio, Airtel, Vi, BSNL) |
| Electricity | 8 | 89 |
| DTH | 4 | 5 |
| FASTag | 22 | 20 |
| EMI/Loan | 21 | 294 |
| Water | 11 | 54 |
| Credit Card | 7 | 29 |
| Insurance | 20 | 40 |

### PRC Conversion Rules
- 100 PRC = ₹1 INR
- Minimum Redeem: ₹100 (10,000 PRC)
- Maximum Daily: ₹5,000 (5,00,000 PRC)
- Auto refund on failure

## API Endpoints Summary

### BBPS APIs
```
GET  /api/bbps/health
GET  /api/bbps/operators/{category}
GET  /api/bbps/operator-params/{id}
POST /api/bbps/fetch
POST /api/bbps/pay
GET  /api/bbps/status/{tid}
```

### DMT v1 APIs
```
GET  /api/eko/dmt/health
GET  /api/eko/dmt/wallet/{user_id}
POST /api/eko/dmt/customer/search
POST /api/eko/dmt/customer/register
POST /api/eko/dmt/recipient/add
GET  /api/eko/dmt/recipients/{mobile}
POST /api/eko/dmt/transfer
GET  /api/eko/dmt/status/{tid}
GET  /api/eko/dmt/transactions/{user_id}
```

### DMT v3 APIs (Aadhaar/eKYC)
```
GET  /api/dmt/v3/health
POST /api/dmt/v3/sender/profile
POST /api/dmt/v3/sender/onboard
POST /api/dmt/v3/sender/aadhaar/otp
POST /api/dmt/v3/sender/aadhaar/verify
POST /api/dmt/v3/recipient/add
GET  /api/dmt/v3/recipients/{mobile}
POST /api/dmt/v3/transaction/otp
POST /api/dmt/v3/transaction/initiate
GET  /api/dmt/v3/transaction/status/{id}
```

## Eko Configuration
```
BASE_URL=https://api.eko.in:25002/ekoicici
DEVELOPER_KEY=7c179a397b4710e71b2248d1f5892d19
AUTHENTICATOR_KEY=7a2529f5-3587-4add-a2df-3d0606d62460
INITIATOR_ID=9936606966
USER_CODE=20810200
```

## Pending/Backlog Tasks

### P1 - High Priority
- [ ] End-to-end DMT testing with real bank transfer
- [ ] BBPS bill fetch timeout handling

### P2 - Medium Priority
- [ ] Admin Panel delete plan error
- [ ] PRC Vault migration script

### P3 - Low Priority
- [ ] Email/OTP verification on signup
- [ ] Code refactoring

## API Endpoints Reference

### Electricity Bill Payment Flow
```
1. GET /api/eko/bbps/operators/{category}    - List operators
2. GET /api/eko/bbps/operator-params/{id}    - Get required parameters
3. POST /api/eko/bbps/fetch-bill             - Fetch bill details
4. POST /api/eko/bbps/pay-bill               - Execute payment
```

### Admin Endpoints
```
POST /api/razorpay/admin/manual-activate-by-email  - Manual subscription activation
GET /admin/error-monitor                            - Error monitoring dashboard
```

## Test Credentials
- **User:** mail2avhale@gmail.com / PIN: 153759
- **Admin:** admin@paras.com / 123456

## Notes
- MSEDCL operator is currently down (Eko side issue)
- Fetch bill may timeout (up to 120s) - normal Eko latency
- For operators with billFetchResponse=0, fetch is not required
