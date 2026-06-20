# PARAS REWARD — Product Requirements Document

## Original Problem Statement
Build "PARAS MALL" gamified reward shopping destination with bug fixes (Product syncing, "Used PRC" ledger counting, Community forum posts, Monotonic booking counters, 1% Sustainability Burn), Delivery Address collection, direct Admin Image Upload with auto-crop, Native Android App build via Capacitor + AdMob, and automated CI/CD pipeline using GitHub Actions to build the signed AAB file automatically on code push.

## Architecture
- **Frontend**: React (CRA) + Tailwind + shadcn/ui — PARAS MALL UI, Admin panel, UpdateBanner
- **Backend**: FastAPI (Python) + MongoDB — `/api/mall/*`, `/api/community/*`, `/api/prc_statement/*`, `/api/admin/mall/upload-image`, `/api/app/version-info`
- **Native App**: Capacitor + AdMob + Android signed AAB
- **CI/CD**: GitHub Actions — `.github/workflows/build-android.yml`

## Implemented (Feb 2026)
- ✅ PARAS MALL UI: Filter sheet, search icon, CSS centering
- ✅ Admin E2E Delivery Flow + User address prefill
- ✅ PRC "Used" Ledger integration + 1% Sustainability Burn
- ✅ Monotonic "X booked" counter + Community Forum auto-post
- ✅ Admin direct product image upload (PIL auto-crop 600x600)
- ✅ 3 new Voucher products in Mall
- ✅ App Update Banner + `/api/app/version-info` endpoint
- ✅ Capacitor + AdMob plugin setup
- ✅ Keystore generation (paras-reward.keystore)
- ✅ GitHub Actions workflow created
- ✅ **AAB build successful via CI/CD (21MB, 5m 46s)** — Feb 2026
  - Fixed: yarn.lock cache, gradle-wrapper.jar auto-download, Java 21, Groovy var conflict, minSdk 23 (AdMob)

## P0 — Immediate
- 🔄 User uploading AAB to Google Play Console (manual step)

## P1 — Upcoming
- HRMS Reporting — Email integration (Resend/SendGrid)
- Invoice "Download as PDF" in InvoiceModal.js
- "Share Receipt via WhatsApp" button on Recharge History
- Optional: `PLAY_SERVICE_ACCOUNT_JSON` secret for direct Play Console upload

## P2 — Backlog
- Audit Trail `/admin/audit/kyc-force-approvals`
- Beneficiary "Sponsored by [Name]" badge
- Top Sponsors Leaderboard (Elite Ambassadors)
- Floating Earnings Calculator widget on homepage hero
- Eko Refund OTP fix (BLOCKED on vendor)

## P3 — Future
- MongoDB → PostgreSQL migration

## Key Files
- `/app/.github/workflows/build-android.yml`
- `/app/frontend/android/app/build.gradle`
- `/app/frontend/android/variables.gradle`
- `/app/backend/routes/paras_mall.py`
- `/app/frontend/src/pages/ParasMall.js`
- `/app/frontend/src/components/UpdateBanner.js`

## 3rd Party Integrations
- Razorpay (Payments) — User API Key
- Eko India BBPS — User API Key (Refund OTP issue pending vendor)
- Gemini Nano Banana (Image Gen) — Emergent LLM Key
- Google AdMob — Publisher ID `ca-app-pub-3556805218952480~1933993140`
- GitHub Actions — CI/CD (5 secrets configured)

## Test Credentials
See `/app/memory/test_credentials.md`

## Critical Notes
- User is non-technical, Marathi speaker — spoon-feed step-by-step
- Frontend changes require bumping `/app/frontend/public/service-worker.js` version
- All Android build files use Java 21, minSdk 23, compileSdk 35
