# PARAS REWARD — Product Requirements Document

## Original Problem Statement
Build "PARAS MALL" gamified reward shopping destination with bug fixes (Product syncing, "Used PRC" ledger counting, Community forum posts, Monotonic booking counters, 1% Sustainability Burn), Delivery Address collection, direct Admin Image Upload with auto-crop, Native Android App build via Capacitor + AdMob, and automated CI/CD pipeline using GitHub Actions to build the signed AAB file automatically on code push.

## Architecture
- **Frontend**: React (CRA) + Tailwind + shadcn/ui — split into User & Admin builds via `REACT_APP_BUILD_TYPE`
- **Backend**: FastAPI (Python) + MongoDB
- **Native App**: Capacitor + AdMob + Android signed AAB (user-only build = 37% smaller)
- **CI/CD**: GitHub Actions — `.github/workflows/build-android.yml`

## Implemented (Jul 01, 2026 — Invite Page "Enter Referral Code" UX Clarification)
- 🐛 **User-reported (production)**: On another user's mobile app, admin saw "Enter Referral Code" card missing on Invite tab. Investigation showed:
  1. The card **IS** rendering correctly for regular users with `referred_by=null` — verified via live Playwright test on `parasreward.com/referrals` (SANTOSH's account: card + input + "Attach Referrer" button all visible).
  2. Two legitimate scenarios hide it: (a) user is admin/manager → redirected to `/admin`, never sees Invite page; (b) user has `referred_by` already attached (Play Store install referrer or self-claim earlier).
  3. Root UX bug: when `referred_by` was set, the section silently disappeared with **no explanation** → user confusion / support tickets.
- 🎨 **Fix — "Referred by …" locked info card** shown instead of silent hide:
  - New backend endpoint `GET /api/referral/my-referrer/{uid}` — returns `{has_referrer, referrer_name, referral_code}` resolving `referred_by` (UID) to a friendly name (falls back to legacy `referral_code` lookup for safety).
  - Frontend `ReferralsEnhanced.js` — when `user.referred_by` is truthy, fetches referrer via new endpoint and renders a gray locked card:
    `[✓] Referred by **SANTOSH AVHALE**` + `Your referrer is already attached — you cannot enter another code.`
  - Test IDs: `already-referred-card`, `attached-referrer-name`
- **E2E verified on preview**: patched a test user with `referred_by=<SANTOSH_uid>` → endpoint returned `{has_referrer:true, referrer_name:"SANTOSH AVHALE", referral_code:"4SQVIISB"}` → info card renders correctly.
- **Production deploy required** to reach live users.

## Implemented (Jun 30, 2026 — Community Forum "🚚 Product Delivery" Auto-Posts)
- 🎁 **New feature**: When admin marks a Mall booking as delivered (`POST /api/admin/mall/bookings/{id}/mark-delivered`), the system now auto-creates a celebratory post in the Community Forum under a brand-new **"Product Delivery"** category.
- Post includes:
  - **Real user name** (per user's choice 1.a) — e.g., `📦 Rahul Shinde received Smartphone!`
  - **Admin-uploaded product image** (per choice 2.a) — pulled from `mall_products.image_url`
  - User's city/state location for social proof
  - Product MRP, congratulatory body, CTA back to Paras Mall
  - Authored as `Paras Mall` (system) with `is_admin_post=True` so users cannot edit/delete
- **Trigger**: Admin "Mark Delivered" click (per choice 3.a) — no separate user confirm step
- **Idempotent**: Existing post detection via `metadata.booking_id` + double mark-delivered blocked by status check
- **Two-system architecture preserved**: `community_feed` (Live Activity Ticker) AND `community_posts` (Forum) both receive entries on delivery
- Files: `backend/routes/paras_mall.py` (new `post_community_forum_delivery` helper + wired into `admin_mark_delivered`), `backend/routes/community.py` (added `"Product Delivery"` to `CATEGORIES` whitelist), `frontend/src/pages/CommunityPage.js` (added `🚚 Product Delivery` chip + `Package` icon + teal color theme + chip→backend mapping)
- **Verified end-to-end on preview**: Created test fulfilled booking → patched delivery address → POST /mark-delivered → forum post auto-appeared with correct title, image, category, real name, content + 2nd attempt idempotently blocked.

## Implemented (Jun 30, 2026 — Admin "Mining Complete" Orders Not Loading — URGENT)
- 🐛 **P0 fix**: Admin Mall page → "Pending Delivery" tab was empty in production despite 7 bookings sitting in `status=fulfilled` (mining complete, awaiting delivery action). Root cause: backend admin endpoint default `limit=200` + sort by `created_at DESC` returned only the most recent 200 rows, which were **100% `mining`/`cancelled`** because production has 1,438 active mining bookings. The 7 fulfilled (≈10 days old) and 0 delivered rows were buried past the cutoff.
- Fix split into two layers:
  - `frontend/src/pages/Admin/AdminParasMall.js` — replaced single `/admin/mall/bookings` call with 3 parallel calls: `?status=fulfilled&limit=500`, `?status=delivered&limit=500`, and `?limit=300` recent. Deduped by `booking_id`, sorted by status priority (fulfilled → delivered → mining → cancelled) then `created_at DESC` so actionable rows always surface at top.
  - `backend/routes/mall_v2.py::order_pipeline` — same fix at backend; now fans out into three `asyncio.gather` queries (fulfilled all, delivered all, mining capped) so the Order Pipeline Kanban "Confirmed"/"Delivered" columns are no longer starved by mining churn.
- Verified on preview: pipeline + admin bookings endpoints respond with correct `fulfilled` and `delivered` rows independent of `mining` volume.
- **Production deploy required** for fix to take effect.

## Implemented (Jun 30, 2026 — Android Build Fix)
- 🐛 **Build failure**: GitHub Actions `:app:processReleaseMainManifest` was failing with `org.xml.sax.SAXParseException: The string "--" is not permitted within comments` at AndroidManifest.xml line 41. XML spec forbids consecutive `--` inside `<!-- ... -->` comments.
- Fix: `/app/frontend/android/app/src/main/AndroidManifest.xml` — replaced `adb shell pm verify-app-links --re-verify com.parasreward.prc` with `adb shell pm verify-app-links (re-verify flag) com.parasreward.prc` in the documentation comment. Functional intent-filter behavior unchanged.
- Verified: all `AndroidManifest.xml` files under `/app/frontend/android/` parse cleanly via `xml.etree.ElementTree`.

## Implemented (Jun 30, 2026 — Production Performance Pass)
- 🐛 **User-side P0**: `/api/user/{uid}/performance-summary` was **10.2 seconds** on prod cold load (scans 17 collections via `get_user_all_time_redeemed` per user). Added 60s endpoint-level cache via `cache_manager`. Cold call still ~1s; warm hit ~80ms. **~120× faster on subsequent loads.**
- 🐛 `/api/user/{uid}/redeem-limit` (1.7s → 80ms warm) — 60s cache wrapping `calculate_user_redeem_limit`
- 🐛 `/api/mining/status/{uid}` (1.6s × polled every 30s → 80ms warm) — 20s cache; auto-invalidated on `/mining/start` and `/mining/collect`
- 🐛 `/api/public/contact-info` (830ms → ~20ms warm) — 300s cache; data is essentially static config
- 🐛 `/api/admin/gst-summary` (3.9s → 80ms warm) — 300s cache; 6+ aggregations on `company_wallet_transactions`
- 🐛 `/api/kyc/stats` (5.2s → 80ms warm) — 60s cache; previously one of the 6 parallel count_documents always hit 5s timeout
- 🐛 **Admin dashboard P0**: `/api/admin/redeem-limits-overview` was timing out at 30s (iterates ALL users with balance × downline tree walk). Removed from initial dashboard mount — now lazy-loaded behind a "Load Data" button (`data-testid="redeem-limits-load-btn"`). Dashboard now renders **instantly** instead of showing a 30s spinner on every admin nav.
- 🔧 **Cache invalidation**: extended `invalidate_lifetime_cache(uid)` (already called after every booking, redemption, payment) to also evict the new endpoint-level caches → users see fresh balance/limit immediately after mutating actions; passive views get 60s amortization.
- **Production impact**: dashboard time-to-data **10s → 1-2s** for all users.

## Implemented (Jun 30, 2026 — Confirm Booking Sheet Visibility Fix)
- 🐛 **P0 fix**: Confirm Booking bottom-sheet's pricing breakdown rows (`.mall-pricing-row`, `.mall-pricing-row.total`, `.mall-pricing-row.upfront-row`, `.mall-pricing-divider`, `.mall-pricing-hint`, `.mall-confirm-prices`) had no light-theme override — they rendered white text on the Spinny-palette white sheet, making MRP / Processing Fee / Mining Target / "You pay now" lines invisible
- Added explicit dark-on-cream color overrides in `/app/frontend/src/pages/ParasMall.css`; upfront row keeps the brand purple→emerald gradient
- Verified end-to-end via Playwright on mobile viewport (420×880) — all rows now legible
- Verified Delivery Address (P0 b) end-to-end: frontend form pre-fills from profile, backend `POST /api/mall/book/{product_id}` validates+persists, admin `GET /api/admin/mall/bookings` returns `delivery` block (addr_present=True, pin/city/mobile included), Admin Mall Bookings tab + Order Pipeline Kanban display full address
- Verified Admin Image Upload + Auto-Crop (P0 c): `POST /api/admin/mall/upload-image` center-crops to 1:1, resizes to 1024×1024, JPEG quality 88, EXIF rotation honored, RGBA flattened onto white — tested with 1600×1200 PNG → 1024×1024 JPEG, 21% smaller

## Implemented (Jun 30, 2026 — PARAS MALL Sub-Batch B: Amazon/Flipkart-grade UX upgrade)
- 🛒 **Hero Carousel + Categories Grid** — landing page refresh
  - New `HeroCarousel.js` component: auto-rotating featured products (4.5s), swipeable, dots + arrows
  - New `CategoriesGrid.js` component: 8 categories (All, Electronics, Appliances, Kitchen, Furniture, Vouchers, Jewelry, Fashion) — click filters Mall
  - Both wire-up on `/mall` under SaverProgressBar (discover tab only)
- 🔍 **Premium Product Detail Sheet** — `ProductDetailSheet.js` bottom-sheet modal
  - Multi-image gallery (uses `product.images[]` with `image_url` fallback) + thumbnails + prev/next
  - Pricing breakdown card (MRP / GST / Processing Fee / Total)
  - Live mining preview tiers (Slow / Typical / Fast) via new `GET /api/mall/v2/mining-preview/{product_id}` — shows daily PRC + days-to-complete per tier
  - Trust badges (delivery, verified stock, cancel anytime)
  - Sticky bottom CTA bar with "Book Now · {upfront PRC}"
  - Reachable from: hero slide tap, product image tap, "View Full Details →" button
- 🤖 **AI Product Assistant** in Admin Products form (Gemini via EMERGENT_LLM_KEY)
  - `POST /api/mall/v2/admin/ai-generate-product` — Gemini `gemini-2.5-flash` returns strict JSON `{title, description, category, keywords[]}` → autofills form
  - `POST /api/mall/v2/admin/ai-generate-image` — Gemini Nano Banana `gemini-3.1-flash-image-preview` returns base64 image, normalized 1024² JPEG, saved to `/app/backend/static/mall/`, returned as `/api/static/mall/...` URL
  - UI: violet/amber `admin-mall-ai-panel` with prompt input + two buttons (Draft, Image) + loading spinners
- 📦 **Order Pipeline Kanban** (Admin)
  - `GET /api/mall/v2/admin/pipeline` returns bookings grouped into 5 columns: Booked → Confirmed → Packed → Shipped → Delivered (hydrates user name/mobile, delivery address, progress %)
  - New `OrderPipelineKanban.js` Kanban board (admin-only) with column header counts, click-to-advance dialog (5 Move To buttons + optional shipping note), and delivery address preview inside the dialog
  - New "Order Pipeline" tab in `/admin/mall` (`admin-mall-tab-pipeline`)
- 🔧 **Bug fix during testing**: `/api/mall/v2/featured` now enriches each product with `compute_pricing_breakdown()` so `ProductDetailSheet` opened via hero tap shows correct upfront PRC / GST / Total (previously rendered ₹0)
- ✅ Backend pytest **10/10 PASS** (`/app/backend/tests/test_mall_v2_sub_batch_b.py` — featured shape, mining-preview formula, RBAC on AI + Pipeline, status-advance round-trip)


## Implemented (Feb 28, 2026 — Self-Claim Referrer ("Enter Referral Code"))
- 🎁 **Restored legacy endpoint** with safety guards. Users who signed up WITHOUT a referral code (e.g., legacy users, or users whose share link lost the `?ref=` param before our Feb 2026 fixes shipped) can now attach a referrer post-signup — one-shot, within 30 days.
- **Backend** `routes/referral.py`:
  - `POST /api/referral/apply/{uid}` (body: `{ referral_code: string }`)
  - Guards: user exists, not already attached, within `SELF_CLAIM_WINDOW_DAYS=30` of signup, not self-referring, no circular chains (walks up the referrer's upline up to 20 levels)
  - Side-effects: sets `referred_by`, `referred_by_name`, `referred_at`, `referred_via='self_claim'`; increments referrer's `referral_count`; inserts a `referral_joined` notification for the referrer
  - Case-insensitive code lookup (matches the registration fix)
- **Frontend** `pages/ReferralsEnhanced.js`:
  - New **"Did someone refer you?"** gradient CTA card — shown ONLY when `!user.referred_by` (auto-hides post-attribution)
  - Modal with live code lookup (debounced 350ms) → green "Referred by X" confirmation before commit
  - Disabled submit until lookup status is `valid` (prevents wasted API calls)
  - On success: closes modal, fires `refreshUserData()` so the CTA hides immediately
  - data-testid coverage: `enter-referral-cta`, `claim-referrer-modal`, `claim-code-input`, `claim-submit-btn`, `claim-modal-close`, `claim-referrer-name`
- **Tested live**:
  - Fresh user (no referrer) → lowercase `?ref=ljua1czp` claim → DB shows `referred_by`, `referred_via=self_claim` ✓
  - Re-claim attempt → 400 "already have a referrer attached" ✓
  - Window-expired user (102 days old) → 400 with friendly message ✓
  - Invalid code → 404 ✓



## Implemented (Feb 28, 2026 — assetlinks.json Auto-Patch in CI)
- 🤖 **Zero-touch SHA-256 setup**: User reported they couldn't run keytool locally, so GitHub Actions now auto-extracts the upload key SHA-256 and patches `frontend/public/.well-known/assetlinks.json` on every AAB build.
- **New workflow step** in `.github/workflows/build-android.yml` (step 7b, after keystore decode, before AAB build):
  1. Runs `keytool -list -v` against the GitHub-stored keystore (already used for signing)
  2. Extracts SHA-256 with `awk '/SHA256:/ {print $2; exit}'`
  3. Reads optional `PLAY_APP_SIGNING_SHA256` secret (user adds this once from Play Console after first AAB upload)
  4. Patches `assetlinks.json` with the resulting fingerprint array (de-dups identicals)
  5. Commits back to `main` with `[skip ci]` so it doesn't loop, only when content actually changed
- **Permissions**: workflow `permissions.contents: write` added so the auto-commit step can push.
- **Doc** `/app/memory/APP_LINKS_SETUP.md` rewritten with the new auto-flow — user only needs to add ONE optional secret (`PLAY_APP_SIGNING_SHA256` from Play Console) for Play Store-installed apps to verify; the upload key is fully automatic.
- **Dry-run tested** locally: both single-fingerprint (no Play SHA secret) and two-fingerprint paths produce valid JSON.



## Implemented (Feb 28, 2026 — Install Referrer + Android App Links)
- 🔗 **Native referral attribution** (closes the MobileAppGate gap): a user who clicks `https://parasreward.com/register?ref=ABC123` on Android browser is forced to Play Store via MobileAppGate; the URL params previously vanished during the install round-trip, breaking attribution. NOW Play Store records the referrer and our app reads it on first launch.
- **Native plugin** `android/app/.../InstallReferrerPlugin.java`:
  - Wraps Google's `com.android.installreferrer:installreferrer:2.2` library.
  - Single Capacitor plugin `InstallReferrer` exposing `getInstallReferrer()` + `markConsumed()`.
  - Caches the Play Store response in SharedPreferences so we never double-fetch (Play's API is one-shot per install).
  - Returns `{ referrer, clickTime, installTime, consumed, fetched, cached }`.
- **JS bridge** `frontend/src/utils/installReferrer.js`:
  - `captureInstallReferrer()` called from `App.js` `useEffect` on every native boot. Parses `ref=XYZ` from the referrer query string and writes to `localStorage.paras_ref_code` (same key RegisterSimple already reads).
  - `markInstallReferrerConsumed()` called from RegisterSimple after a successful referral attribution — prevents replay on subsequent launches.
- **MobileAppGate update** `components/MobileAppGate.js`:
  - `buildPlayStoreUrl()` reads the active `?ref=` (URL param OR localStorage fallback) and URL-encodes it as `&referrer=ref%3DABC` on the Play Store install link. Play Store passes that string back to our app on first launch.
- 🌐 **Android App Links** (deep linking):
  - `AndroidManifest.xml`: added `<intent-filter android:autoVerify="true">` for `https://parasreward.com/*` and `https://bugzappers.emergent.host/*`. Browser link clicks now open the app directly (no chooser dialog).
  - `frontend/public/.well-known/assetlinks.json`: 2-fingerprint template (upload key + Play App Signing key). Already serves at the deployment URL (verified with curl, HTTP 200).
  - 📝 `/app/memory/APP_LINKS_SETUP.md`: step-by-step doc for the user to extract the SHA-256 fingerprints (keytool for upload key, Play Console for Play App Signing key) and paste into assetlinks.json before next AAB ships.
- **Version bump**: `versionCode 13 → 14`, `versionName 1.1.2 → 1.1.3`.
- **End-to-end attribution flow now**:
  1. User A shares `parasreward.com/register?ref=LJUA1CZP`
  2. User B (Android browser) clicks → MobileAppGate intercepts
  3. Install link with `&referrer=ref%3DLJUA1CZP` opens Play Store
  4. User B installs → opens app
  5. `captureInstallReferrer()` fires → reads `ref=LJUA1CZP` from Play Store → writes to localStorage
  6. User B taps "Register" → form pre-fills `LJUA1CZP` → backend stores `referred_by=user_A.uid`
  7. `markInstallReferrerConsumed()` fires → won't re-apply on next launch
  → User A sees User B in their downline ✓



## Implemented (Feb 28, 2026 — Mall Pricing: MRP + 18% GST + 10% Processing Fee)
- 🧾 **Pricing change**: Mall products now follow cascading tax+fee math: `Total = MRP × 1.18 × 1.10 = MRP × 1.298`. GST computed on MRP, Processing fee computed on (MRP + GST).
- **Backend (`routes/paras_mall.py`)**:
  - Constants: `GST_PERCENT = 0.18`, `PROCESSING_PERCENT = 0.10`, `FINAL_PRICE_MULTIPLIER = 1.298`
  - Helper `compute_pricing_breakdown(mrp_inr)` returns full layered breakdown (MRP, GST, Processing, Total in both ₹ and PRC, plus matching upfront breakdown).
  - `compute_total_prc` and `compute_upfront_prc` now delegate to the breakdown helper (back-compat preserved for callers).
  - Product list/detail endpoints (`GET /api/mall/products`, `GET /api/mall/products/{id}`) return the full breakdown for frontend rendering.
  - `POST /api/mall/book/{id}` snapshots an immutable `pricing_breakdown` onto each new booking — historical audit trail in case rates ever change.
  - **NEW** `POST /api/admin/mall/reprice-active-bookings`: idempotent migration that walks every `status="mining"` booking and updates `total_prc` + `remaining_prc` + `pricing_breakdown` to the current formula. `upfront_prc` / `paid_prc` are NEVER touched (immutable financial events).
- **Frontend**:
  - `pages/ParasMall.js` — Booking Confirmation modal now shows the full breakdown: MRP, +GST (18%), +Processing (10%), Total Product Value, then You Pay Now (Upfront) with its own sub-breakdown line.
  - `pages/ParasMall.css` — new `.mall-pricing-row` styles with subtle dividers.
  - `pages/AdminSettings.js` — added a "Reprice All Active Bookings" admin card with one-click button (data-testid `run-reprice-bookings-btn`).
- **Live verification**:
  - Smartphone ₹15,000 → ₹19,470 total (194,700 PRC) ✓
  - Laptop ₹50,000 → ₹64,900 total (649,000 PRC) ✓
  - 37 active bookings repriced successfully in production-like migration test ✓
  - New `pricing_breakdown` snapshot persisted onto each booking ✓


## Implemented (Feb 28, 2026 — Referral Attribution Bug Fix)
- 🐛 **BUG SQUASHED**: New users joining via referral links were NOT showing up under the referrer's downline. Backend DB scan showed 0 users with `referred_by` set across 27 signups.
- **Root causes (2 stacked bugs)**:
  1. **Backend case sensitivity**: `routes/auth.py#simple_register` did `db.users.find_one({"referral_code": referral_code})` without `.upper()`. Codes are stored UPPERCASE (auth.py:216 uses `string.ascii_uppercase`). WhatsApp/Telegram/SMS often lowercase URL paths during share preview generation → `?ref=ljua1czp` → backend rejects with 400 "Invalid referral code".
  2. **Frontend navigation loss**: `RegisterSimple.js` only read `?ref=` from URL on initial mount, no persistence. User flow `link → /register → click "Login" → back → /register (no ref)` lost the attribution entirely.
- **Fixes**:
  - **Backend** `routes/auth.py`: `referral_code.upper()` applied before DB lookup (case-insensitive). Validates against the UPPERCASE-stored codes.
  - **Frontend** `pages/RegisterSimple.js`:
    - URL refCode always normalized to UPPERCASE
    - Persisted to `localStorage.paras_ref_code` with **30-day TTL** + timestamp (JSON)
    - Falls back to localStorage when URL doesn't have the ref param (navigation-proof)
    - On successful attribution, localStorage is cleared (prevents wrong referrer for next signup on shared devices)
    - Submit handler applies forced `.toUpperCase().trim()` as a safety belt
- **Live tested**:
  - `?ref=ljua1czp` (lowercase URL) → form auto-fills `LJUA1CZP` ✓
  - "Referred by: User Profile Test 999" green banner shows ✓
  - `localStorage` snapshot: `{"code":"LJUA1CZP","ts":<epoch>}` ✓
  - `/register` (no ref param) after persistence → field auto-fills from localStorage ✓
  - End-to-end: lowercase code → user registered → DB shows correct `referred_by` UID + referrer's `referral_count` incremented ✓
- **Known gap (P1, separate task)**: MobileAppGate forces Android browser users to Play Store. URL params don't survive the install flow → native app first launch loses referral attribution. Fix requires **Google Play Install Referrer API** integration. User has confirmed this is on the to-do list.



## Implemented (Feb 28, 2026 — Product Mining Anti-Inflation Cap)
- 🛡 **Inflation Control**: Product mining now uses the SAME 6-tier network cap as main mining (range 800-8000 based on L1-L5 referrals). This makes it mathematically impossible for a booking to mint PRC beyond the booking owner's referral capacity, while keeping UX unified.
- **Formula change** in `routes/paras_mall.py#get_daily_rate_for_booking()`:
  ```
  N_raw = active bookings positioned AFTER this booking
  user_cap = calculate_network_cap(L1, L2, L3, L4, L5)  ← same as main mining
  N = min(N_raw, user_cap)
  PRC_per_user(N) = max(2.5, 5 × (21 − log₂(N)) / 14)
  daily_rate = max(50, N × PRC_per_user(N))
  ```
- **Helper added** `get_user_network_cap(user_id)`: thin wrapper around `routes.mining.calculate_network_cap` + `routes.growth_economy.get_downline_level_counts`. Returns 800 on any error (safe default = tier 1 baseline). Computed once per request and passed down to avoid N×BFS queries.
- **Endpoints updated** to compute + pass cap through:
  - `GET /api/mall/my-bookings/{user_id}` — single cap lookup per request, applied to all bookings
  - `GET /api/mall/booking/{booking_id}` — cap lookup uses booking's `user_id`
  - `POST /api/mall/collect/{booking_id}` — cap lookup uses request body's `user_id`
- **Frontend transparency**: `user_network_cap` field added to booking response (only when status="mining"). Frontend can render "Build referrals → raise this cap" CTA.
- **Verified** with unit math + live curl: cap=800 brakes N=50,000 from 125,000 PRC/day uncapped → 3,244 PRC/day capped. Max user (cap=8000) capped at 22,954 PRC/day.



## Implemented (Feb 28, 2026 — App Open Ad Branded Splash Overlay)
- 💎 **UX Polish**: On every cold start, the Capacitor splash screen (`#0a1e50` branded background + "PARAS REWARD" logo) now stays visible while we wait up to 4 seconds for the App Open ad to load. Result: user always sees branded splash → ad → app (zero blank-screen moments).
- **Implementation**:
  - `capacitor.config.json`: `launchShowDuration: 800 → 5000`, `launchAutoHide: true → false` (we hide manually).
  - `AppOpenAdPlugin.java`: new `showOnColdStart({ timeoutMs })` method polls every 200 ms for ad availability; on hit → shows immediately + suppresses the next foreground-lifecycle auto-show to avoid double-firing; on timeout → resolves with `shown=false`.
  - `useAdMob.js`: after `initialize`, awaits `showOnColdStart({ timeoutMs: 4000 })`, then unconditionally calls `SplashScreen.hide({ fadeOutDuration: 200 })` in `finally`.
- **Safety nets**:
  - Native `launchShowDuration: 5000` is a fallback so the splash auto-hides even if our JS path silently fails (slow network, plugin error).
  - `SplashScreen.hide()` is wrapped in try/catch (no-op on web, idempotent on native).


## Implemented (Feb 28, 2026 — App Open Ad Native Plugin)
- 🐛 **BUG SQUASHED**: App Open Ad never displayed on the Android app (AdMob console showed zero impressions for unit `ca-app-pub-3556805218952480/2186165856`).
- **RCA**: `@capacitor-community/admob` v7.x **does NOT support App Open ad format** (only Banner/Interstitial/Rewarded — see [GitHub issue #260](https://github.com/capacitor-community/admob/issues/260)). The previous `useAdMob.js#showAppOpen` called `AdMob.prepareInterstitial({ adId: <appOpenId> })`, which AdMob rejected because the unit's format is App Open, not Interstitial.
- **Fix**:
  - **Native plugin** `android/app/src/main/java/com/parasreward/prc/AppOpenAdPlugin.java` — wraps Google Mobile Ads SDK's `AppOpenAd` class directly (play-services-ads 24.7+ already transitively pulled in via the community AdMob plugin).
  - **Lifecycle observer**: `ProcessLifecycleOwner.onStart` → auto-shows the cached ad on every foreground/resume (cold-start tick is skipped because the ad isn't loaded yet). 4-hour expiry per Google policy with auto-reload.
  - **MainActivity.java**: `registerPlugin(AppOpenAdPlugin.class)` before `super.onCreate`.
  - **JS hook** `frontend/src/hooks/useAdMob.js`: switched `showAppOpen` to call the new `registerPlugin('AppOpenAd')` bridge; `initOnce` calls `AppOpenAd.initialize({ adUnitId, autoShowOnResume: true })`.
  - **App.js**: calls `useAdMob()` at the root so init fires on app boot (was previously only initialized inside `ParasMall`).
  - **ParasMall.js**: removed the misuse of `showAppOpen()` as an after-booking interstitial (App Open ads MUST NOT be triggered after in-app actions per Google policy; doing so risks AdMob suspension).
- **Version bump**: `versionCode 12 → 13`, `versionName 1.1.1 → 1.1.2`.
- **Verification**: Web smoke screenshot passes (App Open is no-op on web). Native verification will happen after the user runs GitHub Actions to build the new AAB and installs it.


## Implemented (Feb 28, 2026 — MobileAppGate + app-ads.txt + Admin Feature Flag)
- 🚧 **MobileAppGate component** (`frontend/src/components/MobileAppGate.js`): full-screen blocker shown ONLY to Android browsers (detects `window.Capacitor.isNativePlatform()` + UA), forcing them to install the Play Store app. iOS, desktop, and native APK users bypass it automatically.
- 📝 **`frontend/public/app-ads.txt`**: AdMob compliance file (required by Google for app monetization disclosure).
- 🎛️ **Admin Feature Flag** `mobile_app_gate_enabled`: stored in `settings` collection (`type=feature_flags`), exposed via `GET /api/admin/feature-flags/public` (public read) and `POST /api/admin/feature-flags` (admin write). Toggle is in `pages/AdminSettings.js`.
- **Result**: Admin can flip the gate on/off without redeploying. Web Android users see "Install the App" wall; native users see normal UX.



## Implemented (Feb 15, 2026 — EIGHTEENTH FIX: Subscription Legacy Fields Phase 2)
- 🧹 **MASSIVE TECH-DEBT CLEANUP**: Eliminated 76% of legacy `subscription_expires` / `vip_expiry` references across the production backend.
- **Scope**: Audit count: 206 references at start, **49 remaining** at end (all intentional — test files validating fallback behavior, migration scripts, the canonical helper itself, and 2 `DEPRECATED` Pydantic schema fields kept for mobile-app API backward-compat).
- **Files refactored (13)**:
  - `server.py` — **90 → 2** (only DEPRECATED Pydantic fields remain)
  - `routes/razorpay_payments.py` — **38 → 0** (full clean)
  - `routes/admin_subscription.py` — **9 → 0** (pilot file)
  - `routes/mining.py` — **4 → 0**
  - `routes/admin_misc.py` — **4 → 0**
  - `routes/manual_bank_transfer.py` — **3 → 0**
  - `routes/admin_redeem_limits.py` — **3 → 0** (also adopted `is_subscription_active()`)
  - `routes/pool_wallet.py` — **2 → 0**
  - `routes/gift_subscription.py` — **2 → 0** (adopted `is_subscription_active()`)
  - `routes/bbps_services.py` — **1 → 0**
  - `routes/bank_redeem.py` — **1 → 0**
  - `routes/auth.py` — **1 → 0** (login expiry-downgrade flow)
  - `utils/helpers.py` — **1 → 0**
- **Pattern changes**:
  - **Reads**: Inline `user.get("subscription_expires") or user.get("subscription_expiry") or user.get("vip_expiry")` chains → single `get_user_expiry(user)` helper call (returns timezone-aware datetime, falls back to legacy fields for un-migrated rows). ~60+ sites.
  - **Writes**: Removed legacy `"subscription_expires": <datetime>` and `"vip_expiry": <iso_str>` from `$set` dictionaries. Canonical write is now `subscription_expiry: <iso_str>` only. ~25+ sites.
  - **Projections**: Stripped `"subscription_expires": 1, "vip_expiry": 1` from MongoDB `find()` projections. ~10 sites.
  - **Queries**: Replaced `{"subscription_expires": {"$gt": now}}` filters with `{"subscription_expiry": {"$gt": now}}` to match canonical schema. ~5 sites.
  - **`$unset`/reset writes**: Removed `subscription_expires: None, vip_expiry: None` siblings.
- **Smoke test (preview)**: Login (`9970100782`) → user dashboard shows correct plan/expiry. Admin login → `/admin/subscription/{uid}/details` returns full current plan (132 days remaining), upcoming plans, history — all driven by `get_user_expiry()`. Notifications regression unchanged (7/7).
- **Unblocked**: Razorpay Auto-renew Subscriptions can now be safely implemented next without dragging legacy field debt into new code.


## Implemented (Feb 15, 2026 — SEVENTEENTH FIX: Admin one-click Notification Backfill UI)
- 🔧 Added a one-click **"Run Notification Backfill"** button inside `/admin/settings` page (`pages/AdminSettings.js`) — placed right after the Social Media Links card.
- **Why**: The migration script `scripts/backfill_notification_user_uid.py` could only be run from a shell with DB access. On production, the admin user wanted to repair legacy notifications without SSH-ing into the pod or running curl with a JWT.
- **How it works**:
  - **Backend** (`server.py`): `POST /api/admin/backfill-notifications` runs the 4-stage migration (user_id↔user_uid sync, read↔is_read mirror, BSON-date → ISO string normalization). Idempotent. Gated by `AdminAuthMiddleware` (admin role required).
  - **Frontend** (`pages/AdminSettings.js`): New "Notification Backfill" card with Wrench icon, descriptive text, amber/orange CTA button. Auto-attaches the admin's JWT via the existing axios interceptor. Displays the JSON result (`before` / `after` / `fixed` counts) in a code block + toast message.
- **Verified live on preview**: admin login → button → confirm → response JSON rendered. Counts are all zero on preview because backfill already ran via CLI; on production the first click will repair all hidden + sort-broken notifications in one shot.


## Implemented (Feb 15, 2026 — SIXTEENTH FIX: Notifications visibility + sort order)
- 🛎️ **P0 BUG SQUASHED**: 79% of notifications were silently invisible to users.
  - **RCA #1 — schema split**: `routes/notifications.py::create_notification()` (the main helper used by ~10 services: KYC, subscription approvals, bank redeem, milestones, etc.) wrote `user_id` ONLY. But the user-facing reader `GET /api/notifications/{uid}` in `routes/notifications_routes.py` queries `user_uid` ONLY. Result on preview DB: 65 of 82 notifications (79%) were completely unreachable to the frontend. Confirmed on production too via user report.
  - **RCA #2 — BSON type mismatch on sort**: 75 docs stored `created_at` as BSON `date` (Python datetime), 7 as BSON `string` (ISO). MongoDB sorts BSON types independently → all date-objects came BEFORE all strings regardless of actual timestamp. So a Feb 2026 datetime-stored notification would appear AHEAD of a May 2026 string-stored one with descending sort. Newer notifications looked "missing" because they sank under older ones.
- **Fix shipped**:
  - 🔧 **Writer normalized**: `create_notification()` now writes BOTH `user_id` + `user_uid` (mirror), `read` + `is_read` (mirror), and `created_at` as ISO string.
  - 🔧 **Reader defensive**: `GET /notifications/{uid}`, `/unread-count`, `/read-all`, `/clear-all` now use `$or: [{user_uid: uid}, {user_id: uid}]` + `$or: [{read: false}, {is_read: false}]` to tolerate legacy schema.
  - 🔧 **Backfill migration** `scripts/backfill_notification_user_uid.py` (idempotent, safe to re-run on prod). 4 stages: (a) copy user_id→user_uid, (b) copy user_uid→user_id, (c) mirror read↔is_read, (d) normalize all BSON-date created_at → ISO string. On preview: backfilled 65 unreachable docs + normalized 75 BSON-date docs → 100% reachable, chronologically sorted.
  - **Verified live**: `9970100782` test account now shows all 7 unread notifications on `/notifications` page in correct newest-first order (May 3 → Apr 29 → Apr 19).
- 🌐 **Bonus**: Created public read-only endpoint `GET /api/public/social-media` so the new Pi-style Sidebar's "Follow us on" footer can render icons for regular users. The admin-only `/admin/social-media-settings` route is gated by `AdminAuthMiddleware` (403 for non-admin), which was causing the sidebar to fall back to "Social links coming soon" even when URLs were configured. Updated `Sidebar.js` to call the new public endpoint.


## Implemented (Feb 15, 2026 — FIFTEENTH FIX: Pi Network-style User Menu redesign)
- 🎨 **USER SIDEBAR REDESIGNED → PI NETWORK GRID STYLE** (`components/Sidebar.js`)
  - **Inspiration**: User shared a screen recording of Pi Network's app menu. Wanted same Pi-style: light off-white background, 4-icon grid per row, category section headers, line icons, "Follow us on" social footer.
  - **Layout**: 5 sections × 4 tiles per row = 20 navigation tiles in total:
    - **Earn**: Dashboard · Subscription · Referrals · Network Feed
    - **Rewards**: Paras Mall · Wishlist · PRC Statement · Usage History
    - **Wallet**: Bank Redeem · My Invoices · KYC · My Reports
    - **Social**: Community · Messages · Notifications · Followers
    - **Account**: My Profile · Support · Terms · Privacy
  - **Header chip**: greeting ("Good morning/afternoon/evening, {full name}") + UID + PRC balance pill showing both PRC and INR conversion (10 PRC = ₹1).
  - **Active page indicator**: subtle blue ring around the active tile's icon + blue dot below the label (Pi-style).
  - **Footer**: "FOLLOW US ON" — wires up to `/api/admin/social-media-settings` to render Facebook / Twitter / Instagram / YouTube / LinkedIn / Telegram / WhatsApp icons. Falls back to "Social links coming soon" if no URLs configured. Includes copyright + version line.
  - **Bug fixed during build**: the existing `useEffect` "close on route change" hook included `isOpen` in its dep array → it ran every time the drawer opened, immediately closing it. Refactored to use a `useRef` to track the previous pathname so we only close on actual navigation.
  - **`TopBar.js`**: added `data-testid="topbar-menu-btn"` + `aria-label="Open menu"` on the hamburger trigger for testability.
  - **Verified live on preview** (logged in as `9970100782`): drawer opens correctly on `/dashboard` AND `/referrals`. Active tile correctly highlights based on `location.pathname`. PRC balance displays `1,00,045.84 PRC ≈ ₹10,004.58`. No lint errors.


## Implemented (Feb 15, 2026 — FOURTEENTH FIX: SEO Audit findings cleanup)
- 🧭 **SEO AUDIT FIXES SHIPPED** (Health Score 81 → expected 90+ on re-audit)
  - **Broken internal links fixed**: sitemap.xml + RewardsHome.js footer referenced `/about-us` and `/contact-us`, but React routes were `/about` and `/contact`. Both old URLs returned 200 OK with the default SPA shell (same title) → Google flagged as "duplicate title + broken link". **Fixed by**: (a) updating sitemap.xml + RewardsHome.js footer to use the canonical `/about` and `/contact` paths; (b) adding React `<Navigate replace>` redirect routes in `App.js` so existing back-links from Google still work; (c) creating `/app/frontend/public/_redirects` for true 301 redirects in Cloudflare Pages deployment.
  - **Dead `/leaderboard` link removed** from `components/Footer.js` (route never existed).
  - **Hreflang errors fixed**: removed `?lang=hi` and `?lang=mr` hreflang alternates from `index.html` — the site does not yet serve language-specific URLs, so the alternates returned identical English content → 63 hreflang errors in audit. Also removed `og:locale:alternate` for `hi_IN` / `mr_IN` for consistency. Kept only `en-IN` + `x-default`.
  - **WebSite SearchAction removed** from JSON-LD schema — pointed at a `/search?q=` endpoint that doesn't exist (would 404).
  - **`/app/frontend/public/llms.txt` created** — proper llmstxt.org-spec AI crawler manifest with key page URLs, mining formula constants, PRC↔INR rate (10:1), Bank Redeem cap (₹2,500), and crawl/training permissions.
  - **`public/sitemap.xml` rebuilt**: clean XML (no leading whitespace before `<?xml`), `lastmod` bumped to 2026-02-15, dead URLs replaced, `/careers` + `/investors` + `/delete-account` added (all real routes).
  - **`public/_headers` enhanced** with correct `Content-Type` for `llms.txt` (text/plain), `sitemap.xml` (application/xml), `robots.txt` (text/plain).
  - **`robots.txt` updated** to also reference `llms.txt`.
  - **Smoke test on preview**: `/llms.txt` returns 200 text/plain, `/sitemap.xml` returns 200 application/xml, `/about-us` client-redirects to `/about` ✅.


## Implemented (Jun 24, 2026 — THIRTEENTH FIX: Subscription expiry field consolidation — Phase 1 of 3)
- 🧹 **LEGACY EXPIRY FIELDS CLEANUP — PHASE 1 SHIPPED** (`utils/subscription_expiry.py` + `scripts/migrate_subscription_expiry_fields.py`)
  - **Problem audited**: 3 fields representing the SAME thing — `subscription_expiry` (262 refs, canonical), `subscription_expires` (133 refs, legacy), `vip_expiry` (64 refs, oldest legacy). Total **459 fallback-chain references** across `server.py` and `routes/`. Preview DB had 3 users with legacy fields, 1 user with all three set. Same field appearing with different dates risked "active on page A / expired on page B" bugs.
  - **Phase 1 delivered today (canonical foundation)**:
    1. **`utils/subscription_expiry.py`** — Single-source-of-truth helpers `get_user_expiry(user) -> datetime` and `is_subscription_active(user) -> bool`. Tolerates legacy fields as a read-only fallback for not-yet-migrated rows so production stays safe during the rolling migration.
    2. **`scripts/migrate_subscription_expiry_fields.py`** — Idempotent one-shot migration. For each user with any legacy field: parses all 3 candidates as UTC-aware datetimes, picks the LATEST (never downgrades an active user), writes to `subscription_expiry`, `$unset`s the legacy two. Writes a row per user into `subscription_expiry_migration_audit` collection for rollback.
    3. **Preview DB migrated**: 3 users touched, 2 picked latest of multiple dates, 1 cleared (no valid date anywhere). After-state: `subscription_expires` 0 docs, `vip_expiry` 0 docs, `subscription_expiry` 4 docs, audit collection has 3 rollback rows.
  - **Phase 2 (later, ~2 days)**: code-wide `find/replace` of the 459 fallback-chain references to use `get_user_expiry()` instead of raw `user.get(...)`. Should be done incrementally, one route file at a time, with tests between batches.
  - **Phase 3 (later, ~1 day)**: Pydantic write-block on `subscription_expires` and `vip_expiry` so accidental new writes fail at validation time. Run migration script once more on production after every release until 100% rows are clean.
  - **Production deploy steps for user**:
    1. `git push` → Emergent dashboard redeploy.
    2. Backend Console: `cd /app/backend && python -m scripts.migrate_subscription_expiry_fields` (idempotent — safe to re-run any time).
    3. App version → still `3.3.1-auth-hardening-jun2026` (this change is backend-internal only, no frontend impact).


## Implemented (Jun 24, 2026 — TWELFTH FIX: Auth hardening on sensitive endpoints)
- 🔒 **AUTH BINDING ON `/mining/collect` AND `/mall/cancel-booking`** — `routes/mining.py`, `routes/paras_mall.py`
  - Testing agent flagged these endpoints as unauthenticated: anyone who knew a target user's uid could call collect-on-their-behalf (forcing explorer burn / ending session prematurely) or cancel-on-their-behalf. Critical before Play Store launch.
  - **Fix**: bound both endpoints to a new `_require_authenticated_user` lazy-import wrapper. The wrapper declares the same `HTTPBearer + HTTPAuthorizationCredentials` signature as `server.get_current_user` so FastAPI can resolve sub-deps at routing time, but resolves the REAL `server.get_current_user` at call time. This sidesteps the circular-import error that would otherwise occur (server.py imports both files at lines 105/107 — BEFORE `get_current_user` is defined at line 249).
  - **Authorization checks added**:
    - `/mining/collect/{uid}`: returns 403 if `current_user["uid"] != uid`.
    - `/mall/cancel-booking/{booking_id}`: returns 403 if `current_user["uid"] != body.user_id`. Existing booking-ownership check inside the function still runs (belt + braces).
  - **No frontend change needed** — `axios.interceptors.request.use` in `App.js` already attaches `Authorization: Bearer <token>` to every API call.
  - **E2E verification on preview** (5/5 PASS):
    1. `/mining/collect` no auth → 401 "Not authenticated"
    2. `/mining/collect` auth + wrong uid → 403 "You can only collect on your own account."
    3. `/mining/collect` auth + own uid → 200 with `burned=true, tier=explorer` (normal flow)
    4. `/mall/cancel-booking` no auth → 401 "Not authenticated"
    5. `/mall/cancel-booking` auth + wrong user_id → 403 "You can only cancel bookings on your own account."
  - App version → `3.3.1-auth-hardening-jun2026`. Lint clean, backend boots cleanly (no more circular import).


## Implemented (Jun 24, 2026 — ELEVENTH FEATURE: Explorer users can Collect — but mined PRC burns; ad bonus is real)
- 🎯 **EXPLORER-TIER COLLECT FLOW** — `routes/mining.py` `/collect/{uid}` endpoint
  - User feedback: "Explorer युजर्स PRC COLLECT करू शकतील पण जेवढे PRC त्या SESSION मध्ये त्यांनी जमा केले आहे ते लगेच BURN होतील आणि त्यांना मिळालेला AD BONUS BURN होणार नाही. PRC STATEMENT मध्ये सर्व दिसले पाहिजे."
  - **Old behaviour**: explorer users hit 403 "Elite subscription required" on `/mining/collect` — they couldn't even enter the rewarded-ad funnel.
  - **New behaviour**:
    1. Tier detection: `is_elite = (subscription_plan in ELITE_PLANS) OR (membership_type in ELITE_PLANS)` where `ELITE_PLANS = {elite, vip, startup, growth, pro}`. Both fields checked, default = explorer.
    2. Mined PRC calculation runs identically for both tiers.
    3. **Elite**: wallet credited as before; ledger entry `type=mining_collect, entry_type=credit, amount=+N, description="Main Mining session collected — +N PRC"`.
    4. **Explorer**: wallet is **NOT** touched (balance_before = balance_after); ledger entry `type=mining_session_burn, entry_type=debit, amount=-N, description="Explorer plan — session PRC burned (N PRC)"`. Pool wallet + employee pool credits still run because they're tied to mined volume, not user retention.
    5. Session ends + 60s cooldown starts identically for both tiers → the existing `<ForcedAdInterstitial>` opens automatically on collect-success → ad bonus PRC (+5..10) is credited normally to **both** explorer and elite via `/api/ads/rewarded/credit` (the v3.2.1 canonical-ledger fix already makes this entry appear in PRC Statement).
    6. Response now includes `tier` (`elite` | `explorer`) and `burned` (boolean) so the frontend can render an appropriate toast. Explorer message: `"Session ended. Watch ad below for bonus PRC."` Elite message: `"Collected N PRC"` (unchanged).
  - **Scope (per user choice)**: Burn rule applies to **dashboard main mining only**. Paras Mall product collect (`/mall/collect`) is unchanged — Explorer users get full mined PRC there.
  - **No backfill** (per user choice) — past explorer collects (back when the endpoint 403'd them) didn't happen, so nothing to migrate. Going forward only.
  - **E2E test on preview passed**: Explorer user with active session → POST /collect → response `burned=true, tier=explorer`, wallet unchanged 99,158 → 99,158, ledger DEBIT entry for `-41.68 PRC` written. Then POST /ads/rewarded/start → /credit → +9 bonus PRC actually credited 99,158 → 99,167, ledger CREDIT entry. Both visible in `prc_ledger.find({user_id: ...})` query that drives the PRC Statement page.
  - App version → `3.3.0-explorer-burn-jun2026`. Lint clean.


## Implemented (Jun 24, 2026 — TENTH FIX: Ad-reward PRC ledger entries now visible on PRC Statement)
- 🔴 **AD BONUS PRC NOT SHOWING IN PRC STATEMENT** — `routes/ads_rewarded.py` `/credit` endpoint
  - User report: "User ला Je ad reward PRC मिळतात त्याची entry PRC statement मध्ये होत नाही. फक्त PRC add होतात."
  - **Root cause**: The `/credit` endpoint was writing to `prc_ledger` with a non-canonical schema:
    - `uid` field instead of the canonical `user_id` → the PRC Statement page queries `{"user_id": uid}` and so silently filtered out every single ad-reward row. The PRC arrived in the wallet (because `users.prc_balance` was updated), but the statement showed no trace of it.
    - Also missing `entry_type`, `txn_id`, `balance_before`/`balance_after`, `service_type`, `service_label`, `timestamp` → no running-balance column, no grouping in admin reports.
  - **Fix**: Rewrote the ledger insert to mirror the canonical pattern used by `mall_booking` / `mall_cancel_refund` / `manual_bank_transfer`. Now writes `user_id`, `entry_type: "credit"`, `balance_before/after` (computed from a fresh read after the wallet credit), `service_type: "rewarded_ad"`, `service_label` derived from placement (`Main Mining` / `Paras Mall` / `Rewarded Ad`), description `Ad Bonus PRC (<label>) — +<N> PRC`, plus `txn_id` and `reference`/`service_ref_id` set to the view_token for full audit traceability.
  - **One-shot migration script** `backend/scripts/backfill_ad_reward_ledger.py` — idempotent, rewrites historical entries with `uid` → `user_id` + adds the missing canonical fields. Run once on production after deploy: `cd /app/backend && python -m scripts.backfill_ad_reward_ledger`. Preview DB had 3 broken historical entries; all fixed.
  - **Full E2E test on preview** passed: `/start` → `/credit` flow added +8 PRC to balance AND wrote a properly-formed ledger row that the PRC Statement query can find. Before: 99,150 PRC. After: 99,158 PRC. Statement row: `entry_type=credit, balance_before=99,150, balance_after=99,158, description="Ad Bonus PRC (Main Mining) — +8 PRC"`.
  - App version → `3.2.1-ad-reward-ledger-fix-jun2026`.


## Implemented (Jun 24, 2026 — NINTH FEATURE: User-initiated Mall booking cancellation)
- 🎯 **CANCEL PARAS MALL BOOKING** — user-initiated, upfront-only refund, mined PRC burned
  - User feedback: "काही युजर्स ची डिमांड आहे की आम्हाला प्रोडक्ट booking cancel करायचे आहे. युजर ला स्वतः प्रोडक्ट cancel करण्याची सुविधा उपलब्ध करुन दे. त्याला फक्त त्याने भरलेले upfront PRC वापस करायचे आहे. बाकीचे त्या प्रोडक्ट साठी जमा केलेले PRC burn होतील. Upfront PRC return करून PRC statement मध्ये entry नोंद दाखवायची."
  - **Backend** (`routes/paras_mall.py`):
    - New endpoint: `POST /api/mall/cancel-booking/{booking_id}` with body `{ user_id }`.
    - Ownership check (only the booking's owner can cancel).
    - Status guard: only `mining` bookings can be cancelled; `fulfilled` / `delivered` / `cancelled` are blocked with a clear 400.
    - On success: refunds `upfront_prc` to `prc_balance`, decrements `total_spent_prc` symmetrically, marks booking `status="cancelled"` + records `cancelled_at`, `refunded_prc`, `burned_prc`, and **zeros `total_prc_deducted`** so the 2,500 INR lifetime cap no longer counts this booking.
    - **PRC ledger CREDIT entry** written (type `mall_cancel_refund`) — appears on user's PRC statement with description: `Paras Mall Booking Cancelled: <product name> (upfront refund; <N> mined PRC burned)`.
    - Invalidates lifetime-redeemed cache.
  - **Frontend** (`pages/ParasMallBookings.js`):
    - "Cancel this booking" link on every booking card while `status === 'mining'`.
    - Confirmation modal explaining refund amount vs burn amount upfront before user confirms.
    - New `cancelled` status in `STATUS_META` (rose-red + XCircle icon) so cancelled bookings render properly in the list with the refund note.
    - Toast shows refunded amount + burned amount on success.
  - App version → `3.2.0-mall-cancel-booking-jun2026`. Backend + frontend lint clean. Endpoint smoke-tested (404/403/clean backend logs).


## Implemented (Jun 24, 2026 — EIGHTH FIX: AdSense web ads + AdMob native dual-mode)
- 🎯 **WEB ADSENSE INTERSTITIAL** (`components/ForcedAdInterstitial.js` — rewritten v3)
  - User noted that AdMob ads do NOT render on the live website (parasreward.com) because Capacitor AdMob only works inside the native Android AAB. Until the Play Store launch this leaves web users seeing only a spinner with no actual ad and no revenue.
  - **New dual-mode rendering**:
    - **Native (Android AAB / Capacitor.isNativePlatform() === true)**: existing AdMob rewarded video plays directly. AdMob's built-in close = skip. Reward callback → `/credit` → toast `+N bonus PRC`.
    - **Web (browser)**: a Google AdSense interstitial slot renders INSIDE the modal. A 5-second mandatory view-time enforces ad impression compliance. After 5s a "Skip" link appears top-right. Auto-closes after 20s. Either Skip or auto-close credits the bonus PRC since the user did watch the minimum 5s impression.
  - **AdSense already configured in `public/index.html`**: `ca-pub-3556805218952480` script + Auto Ads. The interstitial slot reuses the same publisher ID via the `<ins class="adsbygoogle">` element.
  - **Slot ID**: reads from `process.env.REACT_APP_ADSENSE_INTERSTITIAL_SLOT`. If unset (current default), AdSense falls back to Auto Ads inventory inside the slot — modal flow still works end-to-end, only the eCPM is lower. To maximise revenue the user should create a "Display ad" or "In-page ad" unit in AdSense → Ads → By ad unit, then paste the slot ID into `frontend/.env`.
  - Portal-based render at `document.body` retained — production rendering edge cases can't hide it.
  - App version → `3.0.8-adsense-web-jun2026`. Lint clean (only eslint-disable comments are unused, no errors). Preview verified.


## Implemented (Jun 24, 2026 — SEVENTH FIX: Same direct-ad flow on Paras Mall product collects)
- 🎯 **MALL PRODUCT COLLECT — DIRECT REWARDED AD** (`pages/ParasMallBookings.js`)
  - User feedback: "जेव्हा प्रॉडक्ट मध्ये reward points collect करणार तसेच same होणार."
  - Mall product mining now mirrors the dashboard MiningWidget flow exactly:
    1. User clicks the Collect button on a Mall booking card → `collect()` calls `performCollect()` directly (no opt-in modal).
    2. `performCollect()` POSTs `/mall/collect/{booking_id}` → primary PRC credited.
    3. On success it sets `setForcedAdOpen(true)` → `<ForcedAdInterstitial placement="mall_collect">` mounts via Portal at `document.body` and immediately auto-plays the AdMob rewarded video (no Watch/Skip buttons — AdMob's built-in close is the skip path).
    4. Reward credited via `/api/ads/rewarded/credit`, toast `+N bonus PRC credited!`. Failures/skips silently dismiss; the primary product PRC is already in.
  - The legacy `<RewardedAdPrompt placement="mall_collect">` is kept mounted (no triggers) so any in-flight code referencing it doesn't break — can be deleted in a future cleanup pass.
  - App version → `3.0.7-mall-direct-ad-jun2026`. Lint clean, preview verified.


## Implemented (Jun 24, 2026 — SIXTH FIX: Direct rewarded ad after Collect — AdMob policy compliant)
- 🎯 **DIRECT REWARDED AD AFTER COLLECT** (`components/ForcedAdInterstitial.js` — rewritten)
  - User feedback (with screenshot of the v3.0.5 "Earn Bonus PRC / Bonus unavailable" intermediate screen): "त्यापेक्षा असे केले तर collect reward केल्यावर **Direct rewarded ad** दिसणार google admob policy नुसार"
  - **New flow** (matches Google AdMob policy for rewarded interstitials):
    1. Primary `performCollect()` succeeds → `setForcedAdOpen(true)`.
    2. `ForcedAdInterstitial` mounts and IMMEDIATELY calls `/api/ads/rewarded/start` to mint a view_token (no UI prompt).
    3. As soon as the token returns, AdMob `showRewardVideoAd()` plays directly. AdMob's BUILT-IN Close (X) inside the video player IS the skip path — exactly what Google's rewarded-interstitial policy requires.
    4. On reward completion → POST `/credit` → toast "+N bonus PRC credited!"
    5. If `/start` fails (quota/auth/network) OR AdMob fails → silent dismiss. Primary PRC was already collected, so the user is NEVER blocked.
    6. On web (where Capacitor is not native and AdMob is a no-op): the overlay auto-dismisses in 8 s and the view-token credit still works for testers.
  - **No more intermediate Watch/Skip buttons** — the only visible UI during the ad sequence is a clean loading overlay: spinner + "Loading bonus ad…" / "Bonus ad playing…" + tiny "Your PRC is already collected." reassurance.
  - Portal-based render at `document.body` is retained for the same reason as v3.0.5 (production rendering-tree edge cases can't hide it).
  - App version → `3.0.6-direct-rewarded-ad-jun2026`. Lint clean, preview verified.


## Implemented (Jun 24, 2026 — FIFTH FIX: Forced ad after Collect, skippable)
- 🎯 **AD AFTER COLLECT (Portal-based, skippable)** — `components/ForcedAdInterstitial.js` (new) + `components/MiningWidget.js`
  - User feedback: "Forcefully collect reward केल्यावर ad दाखवायची आहे. युजर ती skip करु शकतो."
  - **Flow**:
    1. User clicks "Collect Rewards" → `collectRewards()` calls `performCollect()` directly (primary PRC is collected first — never blocked).
    2. On successful collect, `setForcedAdOpen(true)` mounts `<ForcedAdInterstitial>` automatically.
    3. The modal is rendered via `react-dom.createPortal(modal, document.body)` — it lives at the document root, NOT inside MiningWidget's render tree, so the production rendering edge-case that hid the old `RewardedAdPrompt` cannot reach it.
    4. Two paths: "Watch Ad & Earn Bonus" (calls `/api/ads/rewarded/start` → AdMob → `/api/ads/rewarded/credit` for +5–10 bonus PRC) OR "Skip — without bonus" (closes the modal).
    5. Auto-closes after 30 s so users are never visually stuck.
  - Why a new component instead of reusing `RewardedAdPrompt`?
    - `ForcedAdInterstitial` is intentionally minimal: no inline-arrow deps in useEffect array, single ref guard against StrictMode double-mint, all logic in one effect tied to `[open, placement]`. The old prompt had `onSkip` + `onClose` in its dep array which caused the useEffect to re-run on every parent render — combined with prod minification that likely contributed to the silent-mount failure.
    - Portal ensures the modal mounts at `<body>` level so no ancestor can hide it.
  - App version bumped to `3.0.5-forced-ad-jun2026`. Preview verified — code wired, lint clean, frontend running.


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
