# Test Credentials for Paras Rewards

## Admin (preview + production)
- **Email**: admin@test.com
- **Password / PIN**: 153759
- **Role**: admin

## Production Admin
- **Mobile**: 9696969696
- **PIN**: 969696
- **UID**: e2edbfbb-38f3-4fd1-96d3-454a5334f45c
- **Email**: bo@paras.com
- **Role**: admin (Company Manager)

## Admin Operation PINs (backend env)
- `ADMIN_OPERATION_PIN=123456`
- `ADMIN_OVERRIDE_PIN=153759`

## Admin PIN for Backfill / Migration Endpoints
- `admin_pin: "969696"` — used by:
  - POST `/api/admin/redemption-limit/reset-all-anchors`
  - POST `/api/admin/redemption-service-charge/backfill-missing`
  - POST `/api/invoice/admin/backfill-service-charges`
  - POST `/api/invoice/admin/regenerate-pdfs`
  - POST `/api/invoice/admin/audit-invoices-captured`

## Email Service
- `EMERGENT_EMAIL_KEY` set in `/app/backend/.env`
- `EMAIL_FROM_NAME=Paras Rewards`
- `EMAIL_REPLY_TO=info@parasreward.com`
- Resend proxy URL (hardcoded): https://integrations.emergentagent.com

## Notes
- Production URL: https://parasreward.com
- Preview backend: use `REACT_APP_BACKEND_URL` from `/app/frontend/.env`
- Password reset admin PIN auto-restored after pytest test suite runs

## Explorer (free) preview test user (UI testing)
- **Mobile**: 9000006864
- **PIN**: 900006
- **UID**: edc80e3f-22ff-469b-b3cf-f7f0212e605b
- subscription_plan: explorer (PIN set by testing agent, iteration 307)

## Paid Elite preview test user
- **Identifier**: 9970100782 / PIN 997010 -> resolves to uid 76b75808-47fa-48dd-ad7c-8074678e3607 (phone field), elite
