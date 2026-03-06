# PARAS Reward Portal - Product Requirements Document

## Original Problem Statement
Build a comprehensive BBPS (Bill Payment) and DMT (Domestic Money Transfer) system for Paras Reward Portal where users can redeem their PRC (Paras Reward Coins) for real-world services like bill payments and bank transfers.

## Core Features

### 1. BBPS Module (COMPLETED ✅)
- Universal bill payment engine for Electricity, DTH, FASTag, Loan/EMI, Gas, LPG
- Robust Eko API error handling with user-friendly Marathi messages
- A-Z sorted operator lists
- **March 6, 2026**: Removed all hardcoded values (SOURCE_IP, credentials)

### 2. DMT Module (REWRITTEN ✅ - March 6, 2026)
Complete E2E Flow:
1. **Customer Search** → Check if mobile registered with Eko
2. **Customer Registration** → Register new sender with name
3. **OTP Verification** → Complete registration via OTP
4. **Add Recipient** → Add bank account (IFSC, Account Number)
5. **Money Transfer** → Execute IMPS transfer
6. **Transaction Status** → Check pending/completed status

**Key Fixes (March 6, 2026)**:
- ✅ NO HARDCODED VALUES - All config from environment variables
- ✅ Dynamic IP detection from request headers (X-Forwarded-For, X-Real-IP)
- ✅ Config validation on startup
- ✅ Proper error messages in Marathi

### 3. Admin Panel (COMPLETED ✅)
- DMT Dashboard with enable/disable toggle
- Global & per-user limits configuration
- Transaction viewer with filters
- Error Monitor with Eko codes
- Popup Message feature

### 4. Razorpay Integration (FIXED ✅ - Previous Session)
- Webhook configured correctly
- Manual sync tools for payment activation
- Subscription renewal adds remaining days

## Environment Variables Required

### EKO Configuration (backend/.env)
```
EKO_DEVELOPER_KEY=7c179a397b4710e71b2248d1f5892d19
EKO_INITIATOR_ID=9936606966
EKO_AUTHENTICATOR_KEY=7a2529f5-3587-4add-a2df-3d0606d62460
EKO_USER_CODE=20810200
EKO_BASE_URL=https://api.eko.in:25002/ekoicici
```

### Important Notes for Production
1. **IP Whitelisting**: Your production server IP must be whitelisted in Eko dashboard
2. **No Hardcoded IPs**: Code now uses client IP from request headers
3. **Config Validation**: APIs will fail gracefully if env vars missing

## API Endpoints

### DMT APIs (Prefix: /api/eko/dmt)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /health | Service health check |
| GET | /wallet/{user_id} | Get PRC balance |
| POST | /customer/search | Search/verify customer |
| POST | /customer/register | Register new customer |
| POST | /customer/resend-otp | Resend verification OTP |
| POST | /customer/verify-otp | Verify OTP |
| POST | /recipient/add | Add bank account |
| GET | /recipients/{mobile} | Get saved recipients |
| POST | /transfer | Execute money transfer |
| GET | /status/{transaction_id} | Check transaction status |
| GET | /transactions/{user_id} | Transaction history |
| POST | /verify-account | Verify bank account (penny drop) |

### BBPS APIs (Prefix: /api/bbps)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /health | Service health check |
| GET | /operators/{category} | Get operators list |
| GET | /operator-params/{operator_id} | Get operator parameters |
| POST | /fetch | Fetch bill details |
| POST | /pay | Pay bill |
| GET | /status/{transaction_id} | Check payment status |

## Error Codes (Eko)

### Common Error Codes
| Code | Message | User Action |
|------|---------|-------------|
| 0 | Success | - |
| 403 | Authentication failed | Contact admin (IP whitelist issue) |
| 463 | Customer not found | Register first |
| 302 | Invalid OTP | Re-enter OTP |
| 303 | OTP expired | Request new OTP |
| 41 | Invalid IFSC | Check IFSC code |
| 46 | Invalid account | Verify account details |
| 347 | Insufficient balance | Add funds |
| 544 | Bank unavailable | Try later |
| 1468 | Bill fetch failed | Verify consumer number |

## Test Credentials
- **User**: 9421331342 / PIN: 942133
- **Admin**: admin@paras.com / PIN: 123456 or 153759

## Files Modified (March 6, 2026)
1. `/app/backend/routes/eko_dmt_service.py` - Complete rewrite, no hardcoding
2. `/app/backend/routes/bbps_services.py` - Removed hardcoded SOURCE_IP
3. `/app/backend/.env` - Fixed EKO_AUTHENTICATOR_KEY

## Known Issues
1. **Preview Environment**: DMT returns 403 because IP not whitelisted with Eko
2. **AEML, JPDCL Billers**: May require additional parameters - investigate operator-specific requirements

## Pending Tasks
- P0: Test DMT flow after production deployment (IP whitelist)
- P1: Investigate failing billers (AEML, JPDCL)
- P2: Remove legacy eko_payments.py router
- P2: Admin "Failed to delete plan" bug
- P3: Email/Mobile OTP verification
