# PARAS REWARD — Security Audit Report

**Date**: Feb 22, 2026
**Auditor**: Emergent Security Audit Agent (read-only static review)
**Scope**: Full-stack (FastAPI + MongoDB backend, React frontend). Native Android manifest / deep-links not covered.
**Status**: 🚨 **FAIL — ACTION REQUIRED**
**User decision (Feb 22, 2026)**: Reviewed and paused patch work. To be scheduled explicitly.

---

## Executive Summary

Three HIGH severity issues are exploitable **right now** on production. All three stem from over-reliance on shared static PINs / hard-coded secrets and one input-validation gap in the reset flow. Combined they let an unauthenticated attacker:
- Mass-approve every pending KYC record (SEC-001)
- Run ~30 back-office bulk actions including subscription and payment mutations (SEC-002)
- Bypass password/PIN reset tokens for any account (SEC-003)

---

## HIGH Severity Findings

### SEC-001 [HIGH] [CONFIRMED] — Mass KYC approval via hard-coded static PIN, no login
- **File / Lines**: `/app/backend/routes/kyc.py:878-904` (GET/POST `/api/kyc/admin/approve-all-pending`); default value at `/app/backend/routes/inactive_user_cleanup.py:63`
- **Root cause**: `ADMIN_OVERRIDE_PIN` defaults to a literal 6-digit value that is also printed in comments. Endpoint has no `Depends(get_current_admin)`.
- **Impact**: Anyone (unauthenticated) can approve all pending KYC records + sync users in one call.
- **CVSS-like**: HIGH — remote, unauthenticated, integrity impact on identity/fraud controls
- **Fix**: Remove hard-coded default; require authenticated admin session; treat PIN as second factor only; rotate the value in env.
- **Standards**: OWASP A01:2025 Broken Access Control; OWASP API5:2023 BFLA; CWE-862 (Missing Authorization), CWE-798 (Hard-coded Credentials)
- **Priority**: P1

### SEC-002 [HIGH] [CONFIRMED] — ~30 financial/admin bulk operations gated only by a shared static PIN
- **File / Lines**: `/app/backend/server.py:142` (`ADMIN_OPERATION_PIN` default `"123456"`); ~30 PIN-only endpoints at `server.py:1820, 9790, 10260, ...`; same pattern in `routes/partner_positions.py`, `routes/community_leader.py`, `routes/device_binding.py`
- **Root cause**: PIN-only gate with weak default. No `Depends(get_current_admin)`.
- **Impact**: Unauthenticated bulk subscription / payment / index / cleanup mutations. High-risk endpoints include razorpay-cleanup, force-fix, ensure-indexes.
- **CVSS-like**: HIGH — remote, unauthenticated, integrity + availability impact on money flows
- **Fix**: Enforce `Depends(get_current_admin)` on all mutating endpoints; treat PIN as second factor only; remove `"123456"` default (fail closed if env unset).
- **Standards**: OWASP API5:2023 BFLA; CWE-862, CWE-798
- **Priority**: P1

### SEC-003 [HIGH] [LIKELY] — NoSQL operator injection bypasses reset-token secret
- **File / Lines**: `/app/backend/routes/auth.py:2243, 2271` (`/password-recovery/*`) and `/app/backend/routes/auth.py:1707` (`/forgot-pin/reset-by-email`)
- **Root cause**: Raw JSON `token` / `reset_token` passed straight into `db.users.find_one({"reset_token": token})` with no type check. An attacker posts `{"reset_token": {"$ne": null}}` (or `{"$gt": ""}`) and matches an arbitrary user document without knowing the actual token.
- **Impact**: Reset-token secret is defeated. Full takeover depends on which credential field the reset then overwrites (login prefers `pin_hash`; some resets touch `password` / `password_hash`).
- **CVSS-like**: HIGH — remote, unauthenticated, full account takeover on affected paths
- **Fix**: Add `isinstance(token, str)` guard, or better, use a Pydantic string model for all recovery request bodies. Same for `reset_token`, `otp`, `email` (defence in depth).
- **Standards**: OWASP A03:2025 Injection; OWASP A07:2025 Identification & Authentication Failures; CWE-943, CWE-640
- **Priority**: P1

---

## P3 Hardening (LOW–MEDIUM)

| ID | Issue | File | Fix | Effort |
|---|---|---|---|---|
| H-01 | CORS falls back to `allow_origin_regex=".*"` + `allow_credentials=True` when `CORS_ORIGINS` env unset | `server.py:34982-34996` | Fail closed with an explicit allowlist | 5 min |
| H-02 | Razorpay order-signature compare uses `!=` (timing side-channel) | `razorpay_payments.py:252` | Use `hmac.compare_digest` (webhook at line 706 already does) | 5 min |
| H-03 | User (non-admin) JWTs stay valid after logout / credential change until expiry | `server.py:262-274` | Check session for all roles; rotate `session_token` on credential change | 15 min |
| H-04 | PII (identifier / email) written to logs and security alerts in raw form | `routes/auth.py:781, 914` | Mask (e.g. `9970***782`, `t***@example.com`) | 10 min |
| H-05 | `dangerouslySetInnerHTML` renders admin-authored `message_html` without sanitization | `frontend/src/components/PopupMessage.js:181`; `frontend/src/components/AdMobBanner.js:124` | Sanitize with DOMPurify (BlogArticle already does) | 15 min |

---

## Coverage & Limits

- ✅ Reviewed: JWT + PIN auth (bcrypt cost 10, HS256, strong secret required), login rate-limit, password/PIN recovery, Razorpay order + webhook verification, admin PIN gating, user IDOR checks (`users.py` / `wallet.py` enforce `verify_user_access`), CORS, recovery NoSQL sinks, frontend HTML sinks.
- 🟡 Partial: 38k-line `server.py` legacy endpoint inventory not exhaustively enumerated; direct `prc_balance` self-mutation risk not fully confirmed absent.
- ❌ Not covered: native Android manifest / deep-link intents; runtime auth testing (read-only static review only).

---

## Suggested Fix Order (when user resumes)

1. **SEC-003 (10 min)** — smallest change, biggest downside if left. Add Pydantic string models to 3 recovery endpoints.
2. **SEC-002 (~60 min)** — mass edit: wrap ~30 admin endpoints in `Depends(get_current_admin)`, remove `"123456"` default. Test each via existing admin JWT.
3. **SEC-001 (15 min)** — wrap `/api/kyc/admin/approve-all-pending` in `Depends(get_current_admin)`, remove default, rotate PIN.
4. **P3 hardening bundle (~45 min)** — CORS lockdown + `compare_digest` + session invalidation + PII masking + DOMPurify.

**Total effort: ~2 hours** across backend + frontend. Would require testing (bug_testing_agent) and one production redeploy.

---

## Notes for future agent

- Report is intentionally saved without patches applied. User (Feb 22) chose to review first.
- When user says "resume security fixes" or "start patching", pick from the fix order above.
- Do NOT touch production credentials unless user explicitly rotates env values via the Emergent System Keys UI.
