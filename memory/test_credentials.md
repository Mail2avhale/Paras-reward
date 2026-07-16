# Test Credentials

## Primary Test User (Cash/INR)
- Mobile: 9970100782
- PIN: 997010
- UID: 76b75808-47fa-48dd-ad7c-8074678e3607
- Plan: Elite (cash)

## PRC Test User
- Mobile: 9421331342
- UID: 6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21
- Plan: Elite (prc - payment method deprecated)

## Admin
- Email: admin@test.com
- PIN: 153759
- Mobile: 9999999999
- UID: admin-test-123
- Role: admin (promoted Jul 2026)

## Admin Operation PINs (backend/.env)
- ADMIN_OPERATION_PIN=123456 (for bulk-fail, admin-credit, approve-all type guards)
- ADMIN_OVERRIDE_PIN=153759 (for force-activate-elite-prc override)

## Partner Store Test Account (Paras Reward v2.0 — Feb 16 2026)
- **Business**: Sharma Kirana Store (Grocery, Nagpur MH)
- **Store ID**: 100001
- **Mobile (Login)**: 8888800001
- **Login PIN**: 999888
- **UID**: pstore-100001
- **Verification Status**: verified + active
- **Bank**: Ramesh Sharma · A/c 12345678901 · IFSC HDFC0001234
- **Role**: partner_store → auto-redirects to /partner-store/dashboard
