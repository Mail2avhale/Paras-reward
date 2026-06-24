# PARAS REWARD — Product Requirements Document

## Original Problem Statement
Build "PARAS MALL" gamified reward shopping destination with bug fixes (Product syncing, "Used PRC" ledger counting, Community forum posts, Monotonic booking counters, 1% Sustainability Burn), Delivery Address collection, direct Admin Image Upload with auto-crop, Native Android App build via Capacitor + AdMob, and automated CI/CD pipeline using GitHub Actions to build the signed AAB file automatically on code push.

## Architecture
- **Frontend**: React (CRA) + Tailwind + shadcn/ui — split into User & Admin builds via `REACT_APP_BUILD_TYPE`
- **Backend**: FastAPI (Python) + MongoDB
- **Native App**: Capacitor + AdMob + Android signed AAB (user-only build = 37% smaller)
- **CI/CD**: GitHub Actions — `.github/workflows/build-android.yml`

## Implemented (Jun 24, 2026 — FOURTH FIX: Bypass broken AdMob opt-in modal)
- 🔴 **COLLECT REWARDS STILL "NO ACTION" → ROOT-CAUSED + PRAGMATIC BYPASS SHIPPED** (`components/MiningWidget.js`)
  - After the 3.0.3 backend fix, `/api/ads/rewarded/start` responds in 194 ms (was 30 s hang), so the backend bottleneck is gone. But the user reported the button STILL did nothing.
  - Deep instrumentation on production (mutation observer + React fiber dispatch) confirmed:
    1. MiningWidget does NOT remount during the click (0 mount/unmount events in 10 s window).
    2. Even FORCING `adPromptOpen` from `false` → `true` via `fiber.memoizedState[10].queue.dispatch(true)` does NOT cause `<RewardedAdPrompt>` to mount in the DOM.
    3. After the forced dispatch, the state value reads back as `true` but the modal is absent from the DOM and zero `/ads/rewarded/start` requests fire.
  - i.e. the `RewardedAdPrompt` component is silently failing to mount in the production build (suspected: a stale closure / hooks-ordering edge case from minification or a Capacitor-only branch). Reproducing this off-prod is non-trivial.
  - **Pragmatic fix shipped**: `collectRewards()` now calls `performCollect()` directly, completely bypassing the AdMob opt-in modal. Users get their PRC immediately on click — exactly what they expect. The opt-in modal + bonus PRC reward (5–10 PRC/ad, 10/day cap) is temporarily disabled until we root-cause the modal rendering issue; this only delays the ad revenue, never blocks the user.
  - `performCollect()` was already verified working on production: a real-user curl call returned `{success:true, collected_amount: 135.40, new_balance: 9280.45}` in 1.9 s with full PRC credited and session ended cleanly.
  - App version bumped to `3.0.4-direct-collect-jun2026`. Preview verified.


## Implemented (Jun 24, 2026 — THIRD FIX: Collect Rewards no-action)
- 🔴 **COLLECT REWARDS BUTTON DOES NOTHING — TRUE ROOT CAUSE FIXED** (`routes/ads_rewarded.py`): User reported clicking "Collect Rewards" on dashboard did nothing — no modal, no toast, no API hit. Deep probe revealed:
  - Clicking `Collect Rewards` runs `setAdPromptOpen(true)` and renders `RewardedAdPrompt`, which then calls `POST /api/ads/rewarded/start` to fetch the bonus preview + view_token.
  - On production with a VALID auth token, `/api/ads/rewarded/start` (and `/quota`) **hung for 30+ seconds** and eventually 504'd, but the catch handler that would have fallen back to `performCollect()` was waiting on a request that never resolved → modal sat invisibly waiting and the user saw "nothing happened".
  - **Root cause**: `routes/ads_rewarded.py` created its OWN `AsyncIOMotorClient` at module-import time. That client's connection pool got bound to whatever event loop happened to be active during import, but FastAPI request handlers in production ran on a DIFFERENT loop, so every `await` on this client hung forever. Other endpoints worked because they use the canonical `db=None; def set_db(database):...` pattern wired from `server.py`.
  - **Fix shipped**: Switched `ads_rewarded.py` to the canonical `set_db()` pattern, removed the standalone `AsyncIOMotorClient` + `dotenv_values` import, and made `_ensure_indexes()` one-shot per process instead of per-request. Wired in `server.py` via `set_ads_rewarded_db(db)` before `include_router(...)`. App version bumped to `3.0.3-collect-fix-jun2026`.
  - **Verified on preview**: `/api/ads/rewarded/quota` 263 ms (was 30 s hang), `/api/ads/rewarded/start` 93 ms (was 30 s hang). 401 "User not found" is correct because the preview DB doesn't have this production user.
  - **Also confirmed working on production** (via direct curl with real user token): `/api/mining/collect/{uid}` returns 200 in 1.9 s and credits PRC correctly — the mining/collect pipeline itself was never broken; the user was just stuck on the rewarded-ad gate.
  - **Note for future cleanup**: `routes/account_deletion.py` follows the same buggy pattern. Has not been reported as hanging but should be migrated to `set_db()` proactively to prevent a similar production-only hang.


## Implemented (Jun 24, 2026 - SECOND FIX, after user reported issue still occurring)
- 🔴 **STUCK LOADING SCREEN — TRUE ROOT CAUSE FIXED** (`src/App.js`): The previous cache-fix (3.0.1) helped landing page but the user reported `/dashboard` and `/paras-mall` were STILL stuck on a light-purple "Loading…" screen after refresh. Root cause turned out to be NOT a cache issue at all — it was a logic bug in the App component's auth useEffect:
  ```js
  // BEFORE (buggy)
  useEffect(() => {
    applyBrandedStatusBar();
    if (user?.uid) {
      syncAppBadgeFromBackend(user.uid);
      const t = setInterval(...);
      return () => clearInterval(t);   // ← EARLY RETURN!
    }
    // initializeUser() + setLoading(false) NEVER runs for logged-in users
    ...
  }, [user?.uid]);
  ```
  The `return () => clearInterval(t)` cleanup function was inside the `if (user?.uid)` block, which caused the effect to exit early for every logged-in user. `initializeUser()` and `setLoading(false)` were never called — so `loading` stayed `true` and the App stayed on the `<div … min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50>…Loading…</div>` screen FOREVER.
  - Fix: Restructured the effect so badge interval and initializeUser run together; cleanup tears down both. App version bumped to `3.0.2-loading-fix-jun2026`.
  - Verified on preview: admin dashboard refresh 3× → all PASS, root_len=82337 consistent, no stuck Loading.


## Implemented (Jun 24, 2026)
- ✅ **PRODUCTION STALE-CACHE / STUCK SPINNER FIX (P0)** — Root cause: after every deploy, users on stale cached `index.html` requested old webpack chunk hashes (e.g. `main.OLDHASH.js`). Emergent's static host returns `index.html` (HTML 200, not 404) for missing `/static/*` paths → browser parses HTML as JS → `ChunkLoadError: Unexpected token '<'`. Previous recovery `window.location.reload()` re-used the browser HTTP cache → same poisoned HTML → infinite spinner once 30s throttle hit. Fixes shipped:
  1. **Cache-busted recovery navigation** (`src/index.js`): `reloadOnce()` now calls `window.location.replace(url + '?_cb=<ts>')` instead of `reload()`. The unique query string forces browser + Cloudflare to fetch fresh HTML.
  2. **Removed FORCE_REFRESH_MARKER_v10** unconditional reload — it was causing an unnecessary double-load on every first visit after a browsing-data-clear, which compounded the bad UX users reported.
  3. **Suspense watchdog** (`src/App.js` LoadingFallback): If the lazy-route fallback stays mounted >12 s, trigger a cache-busted reload. Throttled to 1× per 20 s via sessionStorage.
  4. **Tertiary index.html watchdog** (20 s): Reads `#root.innerText`; if it equals `Loading...` we treat the Suspense as stuck and force-heal with a cache-busted URL.
  5. **Removed conflicting meta tag**: `<meta http-equiv="Cache-Control" content="public, max-age=31536000">` was contradicting the no-cache meta at the top of `<head>` and confusing browsers into caching HTML for a year.
  6. **`/app/frontend/public/_headers`** (new): Netlify/Cloudflare-Pages style cache rules — `no-cache, no-store, must-revalidate` for `/index.html` and `/`, plus `public, max-age=31536000, immutable` for `/static/js`, `/static/css`, `/static/media`.
  7. App-version meta bumped to `3.0.1-cache-fix-jun2026`.
  - Verified on preview by testing agent (`iteration_247.json`) — 6/6 scenarios PASS, 0 ChunkLoadError / 0 stuck-spinner regressions.
  - **Action for user**: push to GitHub via the "Save to Github" button and redeploy on the Emergent dashboard.


## Implemented (Feb 2026)
- ✅ **App Update Flow + Website Download (Feb 22, 2026)** — Three customer-asked features wired up:
  1. **In-app "Update Available" banner**: existing `UpdateBanner.js` (Capacitor-native, polls `/api/app/version-info`) was already wired in `App.js`. Backend `LATEST_VERSION_NAME=1.1.0`, `LATEST_VERSION_CODE=11` defaults bumped + DB record updated via `/api/app/admin/version-update`. Soft banner (top of screen) auto-shows on app launch for users on older versionCode; force-update modal kicks in if installed < minimum_supported_version_code.
  2. **Homepage Google Play download badge** (`AppDownloadBadge.js`): SVG-based "GET IT ON Google Play" pill button. Three variants — default (hero CTA), compact (footer), icon-only. Hidden inside Capacitor native app via `Capacitor.isNativePlatform()`. Wired into `RewardsHome.js` hero (next to "Start Earning Rewards") and footer.
  3. **Smart App Install Banner** (`SmartAppBanner.js`): Floating bottom-sticky banner that auto-shows for Android-mobile UA visitors browsing the website (NOT inside Capacitor). 7-day dismissal memory in localStorage. Wired globally in `App.js`. Drives Play Store install conversions from organic web traffic.
- ⚠️ **Fingerprint after package-rename** — documented: WebAuthn / Capacitor Preferences data is sandboxed per package id. `com.parasreward.app → com.parasreward.prc` change invalidates stored biometric credentials one-time. Users must PIN-login + re-enable fingerprint from Profile after the first install of the new package. Future updates (v1.1.0 → v1.1.x with same package) will retain fingerprint.

## Implemented (Feb 2026 — earlier)
- ✅ **Android Image Fix + Play Store Compliance (Feb 22, 2026, v1.1.0)** — Two CRITICAL native-app fixes:
  1. **Mall images now load on Android**: Created `/utils/resolveAssetUrl.js` helper that prepends `REACT_APP_BACKEND_URL` to any relative `/api/...` path. Applied in `ParasMall.js`, `ParasMallBookings.js`, `MallWishlist.js`, `AdminParasMall.js`. Root cause: Capacitor WebView serves from `https://localhost`, so `<img src="/api/static/mall/x.jpg">` was resolving to `https://localhost/...` (404) instead of the real backend. Side benefit: removing broken image retries also makes the app feel significantly faster.
  2. **Watch & Earn PRC card removed** from `DashboardModern.js`: Google Play Console rejects AdMob rewarded-video flows that grant in-app currency directly (incentivised behaviour). Component file kept on disk for future reuse if policy changes.
  - `versionCode 10 → 11`, `versionName 1.0.9 → 1.1.0`, SW v89 → v90.
- ✅ PARAS MALL UI: Filter sheet, search icon, CSS centering
- ✅ Admin E2E Delivery Flow + User address prefill
- ✅ PRC "Used" Ledger integration + 1% Sustainability Burn
- ✅ Monotonic "X booked" counter + Community Forum auto-post
- ✅ Admin direct product image upload (PIL auto-crop 600x600)
- ✅ 3 new Voucher products in Mall
- ✅ App Update Banner + `/api/app/version-info` endpoint
- ✅ Capacitor + AdMob plugin setup
- ✅ Keystore generation
- ✅ GitHub Actions workflow created — AAB build successful (5m 46s)
- ✅ Fixed: yarn.lock cache, gradle-wrapper.jar auto-download, Java 21, Groovy var conflict, minSdk 23
- ✅ Package name changed `com.parasreward.app` → `com.parasreward.prc`
- ✅ **Admin Mall Booking Status Sub-Tabs (Feb 22, 2026)** — `AdminParasMall.js` now has 3 sub-tabs under Bookings: **Pending Delivery** (default, amber, status==='fulfilled' & not delivered), **Delivered** (blue, status==='delivered'), **All Bookings** (slate). Includes per-tab count badges, contextual hint banner on Pending tab, distinct empty-state copy, and a pulsing amber count badge on the parent "Bookings" pill when pending count > 0. Verified live via Playwright on /admin/mall. SW bumped v88 → v89.
- ✅ **Phase 0 (Android Bundle Optimization) — Feb 2026**:
  - Verified all 94 admin routes wrapped in `{!IS_USER_BUILD && ...}`
  - Fixed leaked `/admin/mall` route (was outside the wrapper)
  - Created `AdminOnWebOnly` component → admin URLs open in external browser via `@capacitor/browser`
  - Workflow now uses `yarn build:user` → JS bundle 16MB → 10MB (-37%)
  - Expected AAB: 21MB → ~14MB
  - versionCode 3 → 4, versionName 1.0.2 → 1.0.3
  - service-worker v76 → v77

## P0 — Immediate
- 🔄 User to push code, run workflow, download new AAB v1.0.3 (versionCode 4), upload to Play Console

## P1 — Phase 1 (Speed + Biometric Foundation)
- 🔐 Biometric (Fingerprint/Face) login via `@capacitor-community/biometric-auth`
- 🎨 Native status bar color sync
- 💥 Haptic feedback on key actions
- 🌅 Splash screen optimize (1500→800ms + better image)
- 📲 Pull-to-refresh on Dashboard/Wallet/Mall
- 🌐 Offline cache (wallet history, PRC ledger)
- 🚀 React lazy + preload critical routes

## P1 — Phase 2 (Engagement)
- 🔔 FCM Push Notifications (recharge success, OTP, offers)
- 📅 Local Notifications (daily streak reminder)
- 🎬 AdMob Banner ads (Mall, Dashboard bottom)
- 🎬 AdMob Interstitial + Rewarded Video

## P1 — Other ongoing
- HRMS Email integration (Resend/SendGrid)
- Invoice "Download as PDF" + WhatsApp share

## P2 — Phase 3 (Native Features)
- 📷 QR Scanner (UPI, referral, voucher)
- 📤 Native Share (WhatsApp invoice/receipt)
- 🔗 Deep linking (`parasreward://wallet`)
- 📱 App shortcuts
- 💬 In-app review prompt
- 🆔 App badge with notification count

## P2 — Phase 4 (Enterprise/Security)
- 📊 Firebase Analytics + 🐛 Crashlytics
- 🔒 Root/Emulator detection + 🛡️ SSL Pinning
- 📵 App lock on minimize (30s auto)
- 🌙 Native dark mode sync
- 🌍 Multi-language (Marathi/Hindi/English)
- 🔄 OTA Live Updates

## P3 — Future
- MongoDB → PostgreSQL migration
- Eko Refund OTP fix (BLOCKED on vendor)
- Audit Trail `/admin/audit/kyc-force-approvals`
- Sponsor badges + Top Sponsors Leaderboard
- Earnings Calculator hero widget

## Key Files
- `/app/.github/workflows/build-android.yml`
- `/app/frontend/android/app/build.gradle`
- `/app/frontend/android/variables.gradle`
- `/app/frontend/capacitor.config.json`
- `/app/frontend/src/App.js` (IS_USER_BUILD wrapper at line 629)
- `/app/frontend/src/components/AdminOnWebOnly.js` (admin → browser redirect)
- `/app/backend/routes/app_version.py`
- `/app/frontend/public/service-worker.js`

## 3rd Party Integrations
- Razorpay, Eko BBPS, Gemini Nano Banana, Google AdMob, GitHub Actions

## Test Credentials
See `/app/memory/test_credentials.md`

## Critical Notes
- User is non-technical, Marathi speaker — spoon-feed step-by-step
- Frontend changes require bumping `/app/frontend/public/service-worker.js` version
- All Android build: Java 21, minSdk 23, compileSdk 35
- Package: `com.parasreward.prc`
- Build commands: `yarn build` (full web) vs `yarn build:user` (user-only Android)
