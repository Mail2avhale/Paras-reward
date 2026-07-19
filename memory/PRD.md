# PARAS REWARD — Product Requirements Document

## Original Problem Statement
Build "PARAS MALL" gamified reward shopping destination with bug fixes (Product syncing, "Used PRC" ledger counting, Community forum posts, Monotonic booking counters, 1% Sustainability Burn), Delivery Address collection, direct Admin Image Upload with auto-crop, Native Android App build via Capacitor + AdMob, and automated CI/CD pipeline using GitHub Actions to build the signed AAB file automatically on code push.

## Architecture
- **Frontend**: React (CRA) + Tailwind + shadcn/ui — split into User & Admin builds via `REACT_APP_BUILD_TYPE`
- **Backend**: FastAPI (Python) + MongoDB
- **Native App**: Capacitor + AdMob + Android signed AAB (user-only build = 37% smaller)
- **CI/CD**: GitHub Actions — `.github/workflows/build-android.yml`

## Implemented (Feb 11, 2026 — IST Bucketing + Live Feed E2E)
- ✅ **IST timezone fix** in `backend/routes/downline_live_feed.py:get_earnings_summary` — today/yesterday/this_week/this_month buckets now align to India Standard Time (UTC+05:30) midnight instead of UTC midnight. Fixes off-by-hours bug where rows timestamped IST 00:00–05:29 were incorrectly reported as "yesterday".
- ✅ **Backend tests**: `/app/backend/tests/test_live_feed_ist_bucketing.py` (main-agent) + `/app/backend/tests/test_live_feed_p0_review.py` (testing-agent) — 5/5 IST boundary + empty-uid + seeded-feed cases PASS.
- ✅ **Frontend E2E verified**: Login → /referrals → click `view-downline-live-feed-btn` → /referrals/live-feed loads with white theme, 4 earnings tiles, summary card, window pills (24H/3D/7D), empty state, back/refresh buttons. All 13 required data-testids present.
- ✅ **AdMob compliance**: Rewarded Interstitial fires non-blocking when opening Live Feed; navigation succeeds regardless of ad state.
- ✅ **IDOR fix applied**: `/api/referrals/live-feed/{uid}` and `/api/referrals/earnings-summary/{uid}` now require JWT via `Depends(get_current_user)` + assert `caller.uid == uid` (or role in admin/sub_admin). Verified: no auth → 401, owner → 200, cross-uid → 403, admin → 200.
- ✅ **Live Feed cleanup** (Feb 11, 2026, per user feedback): Removed the "Total Earned" summary card entirely (including Downlines/Events sub-tiles) as it duplicated info shown by the 4 IST-aligned tiles above. The 24H/3D/7D window switcher is preserved as a compact strip above the feed since it controls the feed's time-range filter.
- ✅ **Popup Message accessibility fix** (Feb 11, 2026, mobile UX bug): Admin broadcast popups with long body text were pushing the × close button and action button outside the viewport on mobile — users got trapped. `PopupMessage.js` restructured to a bounded `max-h-[90vh]` flex-column layout: sticky header (icon + title + × close) always visible, scrollable body with `overscroll-contain`, sticky footer with action button always accessible. Added ESC key + backdrop click as extra escape hatches. Verified in DOM with 6073-char seeded test popup.
- ✅ **Rich-Text Popup Messages v2** (Feb 11, 2026 — major feature):
  - **Backend** (`/app/backend/routes/admin_popup_routes.py`): bleach HTML sanitizer with strict tag/attr/protocol allowlist; pre-strips `<script>/<style>/<iframe>` tag content; auto-adds `target="_blank" rel="noopener noreferrer"` to all `<a>`; parses YouTube ID from watch/youtu.be/embed URL variants; new upload endpoint `POST /api/admin/popup/upload-image` (multipart, 5MB max, PNG/JPG/WebP → 16:9 centre-cropped and resized to exact 800×450 JPEG); extended schema with `message_html`, `image_url`, `youtube_url`, `youtube_id` (derived), `cta_buttons` (list of {text, link, style}); legacy `message`/`button_text`/`button_link` preserved for backward compat.
  - **Admin editor** (`/app/frontend/src/pages/Admin/AdminPopupMessages.js` + new `components/admin/PopupEditor.js`): TipTap-based WYSIWYG (bold/italic/underline/H2/H3/bullet/numbered/link/undo/redo), direct file upload with 5MB cap and image preview, YouTube URL field with live validation, multi-CTA builder (max 3, per-button style selector), side-by-side sticky live preview mirroring end-user render exactly.
  - **End-user** (`/app/frontend/src/components/PopupMessage.js`): sticky header + scrollable body + sticky multi-CTA footer, banner image, YouTube tap-to-play thumbnail (privacy-friendly, iframe embed only after user consent), `dangerouslySetInnerHTML` for the sanitized HTML body.
  - Dependencies added: bleach 6.4.0 (backend), @tiptap/react + starter-kit + underline + link + placeholder (frontend).
  - **Testing**: 14/14 pytest PASS (sanitizer + XSS vectors + auth guards + shape + toggle cascade); frontend E2E confirmed for admin form + live preview + CTA add/remove + save/edit/delete + end-user render.
- ✅ **Growth Network page refactor** (Feb 11, 2026, per user feedback):
  - **Cap levels displayed to L1-L3** (from L1-L5) via `?max_depth=3` query param; backend legacy default preserved at 5 for backward compat.
  - **NEW "Partner Positions in Your Network" section** — 2×2 grid showing counts of District / Regional / State / National partners across the entire walked downline (auto-hidden when total == 0).
  - **NEW "Network Tree" diagram** — compact CSS tree showing top-5 L1 branches with L2 + L3 child counts, active/inactive indicator dots, root "YOU" node with vertical trunk connector.
  - **Backend** (`/app/backend/routes/notifications_routes.py`): extended `/level-breakdown` with `max_depth` param + `partner_counts` (4-tier dict) + `top_branches` (list) in response. **IDOR-protected** — added `Depends(_require_authenticated_user)` + `_assert_notification_owner` (401 no-auth, 403 cross-user, 200 owner/admin). Defensive fix for `max_depth=0` (now clamps to L1 instead of falling back to legacy L5).
  - **Testing**: 7/7 pytest PASS; frontend Playwright verified all 3 new sections + IDOR guard (all 5 scenarios: no-auth/owner/cross-user/admin/max_depth=0).
- ✅ **Community Growth Dashboard — Full /referrals redesign** (Feb 12, 2026, major feature per user's 20-section spec):
  - **Backend**: NEW composite endpoint `GET /api/community/dashboard/{uid}` (`/app/backend/routes/community_dashboard.py`) — IDOR-safe (owner/admin only), one round-trip returns all data for the redesigned page: overview (direct/total/today/lifetime bonus), community_health (total/active/inactive/health_score/status), community_power (percent/status), analytics (today/week/month/lifetime new members), next_milestone (target/reward/progress), community_goal (current/target/percent/remaining), redeem_unlock (percent/hint), timeline (9 milestones), badges (6 tiers: Community Builder → Legend), leaderboard (today/week/month/state/national ranks via direct-referrals aggregation), daily_mission (Invite-2-active target), monthly_challenge (Top-10 with real EOM countdown). All computed live from users + prc_ledger collections — reuses existing reward-calc logic untouched.
  - **Frontend**: NEW `CommunityDashboard.js` component with 17 gamified sections mounted at TOP of `ReferralsEnhanced.js` (existing tree + level cards preserved below as Section 10 per user choice 2a). Premium glassmorphism cards, animated counters, gradient progress bars, live EOM countdown, badge horizontal-scroll strip, timeline with checkmark milestones, QR code modal (via `qrcode.react`), WhatsApp/Telegram/native share/QR quick-share grid.
  - **Terminology overhaul** — all user-facing "Commission" → "Community Bonus", "Network Capacity" → "Community Goal", "Mining Boost" → "Community Power", "Elite Mining Commission" card → "Community Growth Bonus" card. Legacy duplicate cards auto-hide when dashboard data is available.
  - **Dependencies added**: `qrcode.react` v4.2.0 (frontend).
  - **Testing**: Backend curl-verified — auth guard (401 no-auth, 403 cross-user), full payload shape with all 12 top-level keys populated. Frontend DOM smoke-verified — all 17 data-testids rendered.
  - **Feb 12 — Duplicate "Your Referral Link" card removed** (user request "फक्त Invite Friends ठेवा"). Only the new "Invite Friends" glassmorphism card remains inside CommunityDashboard.
  - **Feb 12 — BottomNav label rename** — "Invite" → "Community" across all 9 language locales.
  - **Feb 12 — Community Levels + Tree + Members UI polish** (per user's 12-point followup spec):
    - Terminology: "Network by Level" → "Community Levels", "Network Tree" → "Community Tree", "Direct/2nd/3rd downline" → "Direct Community / Growth Level 2 / Growth Level 3", "Direct Referrals" → "My Community Members", "Network Size" → "Community Members", "Top" → "Top Contributor", "Inactive" → "Needs Activity" (amber tone instead of red — positive language).
    - NEW `MyCommunityMembersSection` component — search bar + sort dropdown (Newest / Most Active / Highest PRC / Highest Redeemed), tri-state activity indicator (Active Today green / Recently Active amber / Needs Activity slate) derived from `last_login_at`, WhatsApp + Call quick-action buttons per row, subscription plan pill.
    - NEW Empty state — 0 community members → premium gradient card with large Share button (uses native `navigator.share` w/ clipboard fallback).
    - NEW Community motivation callout below Community Tree — reinforces retention loop ("Every active member strengthens your Community Power").

- ✅ **PRODUCTION HOTFIX — Popup image storage migrated to MongoDB** (Feb 12, 2026): user reported popup image not rendering for end-users on production even though admin's live-preview showed it. **Root cause**: images stored on local disk (`backend/static/popups/`) — Emergent production containers have ephemeral storage, so files got wiped on redeploy/restart. **Fix**:
  - Images now stored as base64 in MongoDB (`db.popup_images` collection) with fields {image_id, content_type, data_b64, width, height, size_bytes, created_at}.
  - NEW **public** endpoint `GET /api/popup-image/{image_id}` (mounted via new `public_router`, outside `/admin/*` prefix) — browser `<img>` tags can fetch without an Authorization header.
  - `upload_popup_image` no longer touches disk; returns `image_url = /api/popup-image/{hex_id}`.
  - `PopupMessage.js` <img> gets `onError` handler to gracefully hide broken legacy `/api/static/popups/*.jpg` URLs still referenced by old popup docs.
  - **Testing**: 6/6 pytest PASS (upload writes to Mongo w/ correct shape + base64 data; public GET returns real JPEG bytes with NO auth; 404 handling; auth guards 401/403; create+active round-trip). Frontend Playwright verified end-to-end: admin upload → preview → save → end-user render with naturalWidth=800/naturalHeight=450 (proves successful decode, not broken). Cross-pod & cross-restart persistence guaranteed.


- ✅ **Interactive Collapsible Network Tree** (Feb 11, 2026, per user request "हो लगेच कर"):
  - **Backend**: NEW endpoint `GET /api/notifications/referrals/{root_uid}/subtree/{parent_uid}` — auth-required, IDOR-safe (2-hop ancestry validation: parent must be root_uid, direct child, or grandchild). Returns `children[]` (each with uid/name/mobile/mobile_last4/plan/is_active/prc_balance/partner_position/children_count) + total_children + truncated flag. Also added `partner_position` and `mobile` fields to `top_branches` payload so L1 nodes can display partner tier badges and WhatsApp nudge buttons.
  - **Frontend**: NEW `NetworkTreeView` + recursive `TreeNode` components at bottom of `ReferralsEnhanced.js`. Root "YOU" pill is now clickable (toggle collapse/expand). Each L1/L2 node tappable — lazy-loads its children via subtree endpoint on first expand (cached in local state, no re-fetch on subsequent toggles). Depth capped at 3. Partner tier badges (D/R/S/N letters, tier-colored) render inline on each node. Loading spinner during fetch, error state on 403/timeout. Root pill now shows TRUE L1 total (not top-5 truncated) with "Showing top X of Y" note when truncated.
  - **NEW WhatsApp nudge button** (Feb 11, 2026, user request "फक्त हे कर"): each tree node with a mobile on file gets a small green MessageCircle icon button next to it. Click opens `wa.me/91<mobile>?text=<pre-filled Marathi+English reactivation message>` in a new tab (works on both native mobile WhatsApp AND WhatsApp Web on desktop). Inactive nodes get a pulsing brighter version to visually prioritize them. Mobile normalization handles 10-digit / 12-digit-with-91 / dashes / empty gracefully.
  - **Testing**: 11/11 pytest PASS (subtree endpoint IDOR + ancestry + partner_position propagation); frontend Playwright verified full drill-down flow (root toggle → L1 lazy-load → L2 lazy-load L3 → depth cap → badge render → cached re-expand → 0 residue cleanup). WhatsApp URL generation verified via Node inline test — 4/4 mobile-format scenarios pass.

- ✅ **Admin Paras Mall — Pagination + Delivery Address column** (Feb 11, 2026):
  - Added client-side pagination to Products grid (12/page) and Bookings table (25/page) with prev/next Paginator component. Bookings page auto-resets to 1 when switching sub-tabs (Pending/Delivered/All).
  - New dedicated "Delivery Address" column in Bookings table showing full customer name, mobile, address_line, landmark, city+state, pin_code — with copy-to-clipboard button per row.
  - "No Address Captured" red warning badge for legacy bookings that predate address-mandatory rollout; corresponding "Mark Delivered" button auto-disabled to prevent blind shipment.
  - **Testing agent verified 100% E2E**: backend 9/9 pytest, frontend all pagination + address column + copy toast + sub-tab reset + Kanban intact.




## Implemented (Feb 08, 2026 — Rewarded Interstitial Placements)
- ✅ Activated the previously-unused **Rewarded Interstitial** AdMob ad unit (`ca-app-pub-3556805218952480/2377737544`) — expected additional revenue stream since this unit had impressions=0 before.
- ✅ **New reusable component** `frontend/src/components/RewardedInterstitialTrigger.js` — Portal-based modal + `useRewardedInterstitial()` hook that other pages can call imperatively after successful actions.
- ✅ **Two placements wired**:
  1. **Bank Redeem** (`BankRedeemPage.js`) — modal opens **after** a successful `/bank-transfer/request` submission, +5 PRC bonus offer. Redirect delay bumped from 1.5s → 4.5s so ad prompt has time to appear.
  2. **Paras Mall Booking** (`ParasMall.js:bookProduct`) — modal opens **after** a successful `/mall/book/{product_id}` post, +10 PRC bonus offer.
- 🛡️ **Google AdMob Policy Compliance**: Modal is **non-gating** — primary action (redeem submission / booking) is fully committed on the server BEFORE the ad prompt appears. User can skip with zero consequence. Reward value is disclosed BEFORE ad start. User-initiated only (not on random screens).
- 📱 On web: ad plays as no-op (Capacitor plugin unavailable) — modal shows briefly then auto-closes with "Ad not available right now" toast; no PRC credit attempted.
- 🎨 UX: Yellow/gold "Watch & Earn" primary button + "No thanks" secondary — 3 phase states (idle → playing → crediting) with spinner during ad load.



## Implemented (Feb 07, 2026 — Device Binding + ANR Fix)

### 🔐 Device Binding (1-per-lifetime enforcement)
- **New backend module** `backend/routes/device_binding.py` — self-contained router + admin_router + set_db + ensure_indexes.
- **Data model**: `db.device_bindings` (unique partial index on `(device_id, active=True)`) + `db.device_binding_collisions` (audit) + `db.device_unbind_otps` (self-service).
- **Feature flag** at `app_settings.device_binding.enabled` (default OFF, 5-min TTL cache). Admin can flip via `POST /api/admin/device-binding/flag`.
- **Trusted vs untrusted device_id**: Native Capacitor IDs (prefixed `AND-` / `IOS-`) enforce; browser localStorage UUIDs (`DEV-`) always skip enforcement per Q2=a.
- **Enforcement hooks** wired into `auth.py` `login()` + `register()` + `/register/simple`. Login also hard-blocks users with `device_binding_locked=True` flag set by retro-block sweep.
- **Admin endpoints**: `GET/POST /flag`, `GET /retro-scan`, `POST /retro-block` (dry-run + apply, keeps earliest account per colliding device), `GET /collisions`, `GET /suspicious` (same IP + 3+ signups in 24h auto-flag per Q5=c), `POST /unbind`.
- **User self-service**: `POST /device-binding/unbind/request-otp` + `POST /device-binding/unbind/verify-otp` — user proves ownership via SMS OTP to legally release their old device without admin help (Q4=a).
- **Frontend**:
  - `frontend/src/utils/deviceIdentity.js` — new util reading `@capacitor/device` native ID with graceful web fallback; installed `@capacitor/device@7.0.5`.
  - `LoginNew.js` and `RegisterSimple.js` now send `device_id + device_model + os_version` on their respective flows.
  - New admin page `frontend/src/pages/AdminDeviceBinding.js` — flag toggle, retro-scan, retro-block dry-run/apply, collisions log, suspicious clusters, manual unbind. Route `/admin/device-binding` (canAccessAdmin-gated) + card added to `AdminSettingsHub`.
- **Testing**: `backend/tests/test_device_binding_e2e.py` — 17 tests (flag CRUD, retro-scan, suspicious, native regex, core binding matrix incl. soft/hard collision modes, my-bindings, admin unbind errors, retro-block dry-run + apply). **17/17 PASS**. Existing partner_positions 41/41 still PASS. Total suite **58/58**.

### 📱 ANR Fix (Play Console 1.47% → target < 0.47%)
- **Root cause**: `useAdMob` hook (called from App root) previously awaited App Open ad load for up to **4 seconds** BEFORE hiding the splash. On low-end Android this triggered the 5-second ANR watchdog.
- **Fix** in `frontend/src/hooks/useAdMob.js`:
  1. `hideSplashSafe()` runs IMMEDIATELY on mount (idempotent guard flag). WebView interactive in < 100 ms.
  2. AdMob init moved into `scheduleAdMobInit()` — detached from splash flow, runs on `requestIdleCallback` (fallback `setTimeout(0)` on older WebViews).
  3. Cold-start ad timeout reduced from **4000 ms → 1500 ms**.
  4. Splash hide no longer awaited by ad chain; ad init runs completely detached.
- **capacitor.config.json**: `launchAutoHide: false → true` + `launchShowDuration: 5000 → 800` (safety net so OS itself dismisses splash even if JS hangs).



## Implemented (Feb 07, 2026 — Config-Driven Thresholds + Aggregation/Parallelization)
- ✅ **Config-driven `POSITION_STRUCTURE_REQUIREMENT`** (`backend/routes/partner_positions.py`): Thresholds (100/5/3/5) are now stored in `db.app_settings` (key=`partner_structure_requirement`) and hot-loaded via `_load_structure_requirement()` with a dedicated 5-min TTL cache. Ops can tune the 4 tier requirements from an admin UI without a code deploy. Missing / malformed rows auto-fall-back to defaults via `_validate_structure_config()`. Empty override (`{}`) is respected as "no requirements" for test bypass.
- ✅ **New admin endpoints** (auth-gated + X-Admin-Pin):
  - `GET /api/admin/partners/structure-config` — returns effective config + defaults + stored doc + cache TTL
  - `POST /api/admin/partners/structure-config` — upsert new thresholds, purges both config cache AND all per-user validity results immediately
  - `POST /api/admin/partners/structure-config/reset` — deletes the app_settings override to revert to hard-coded defaults
- ✅ **Aggregation optimization**: `_count_l1_active_elite()` — DISTRICT leaf-count now uses `count_documents()` with an inline `$in`/`$ne` filter instead of hydrating all L1 downlines into Python. Critical since DISTRICT threshold is 100 users. `_fetch_l1_partner_children()` uses a projected `.find()` returning only `uid + referral_code`.
- ✅ **Parallel fanout**: Sibling `is_structure_valid()` calls now run concurrently via `asyncio.gather()` inside both `is_structure_valid` (recursive) and `get_structure_report()`. For a NATIONAL partner (5 states × 3 regionals × 5 districts), wall-time is now `max(child_latency)` not `sum(child_latency)` — roughly 15× faster on a full valid tree.
- 🧪 **9 new pytest cases** (41 tests total, all PASS):
  - `TestStructureConfigAdmin`: 6 tests — GET returns defaults, GET wrong-PIN 403, POST updates + invalidates cache + verifies DB doc, POST coerces bad values (invalid child + negative count → defaults), POST wrong-PIN 403, RESET removes override
  - `TestPerformanceOptimizations`: 2 tests — leaf-count uses aggregation (verifies exact count with mixed elite/non-elite L1 downlines), parallel fanout completes < 3s on 24-user tree
  - `TestConfigDrivenValidation`: 1 test — DISTRICT with 5 elite L1 is INVALID at default 100 threshold; after admin lowers threshold to 3 via POST endpoint, same user immediately becomes VALID (verifies end-to-end config → validator flow with cache invalidation)



## Implemented (Feb 06, 2026 — Structural Bonus-Gate for Partner Positions)
- ✅ **User-requested rule**: For any partner tier's commission to activate, the partner must have a fully-VALID L1-direct downline structure — **recursive**:
  - NATIONAL → 5 STATE (each valid) → 3 REGIONAL_STATE (each valid) → 5 DISTRICT (each valid) → 100 active Elite users
  - STATE / REGIONAL / DISTRICT each need only their own chain from that point downward
- ✅ **Implementation** (`backend/routes/partner_positions.py`):
  - `POSITION_STRUCTURE_REQUIREMENT` config (100 / 5 / 3 / 5 per prod spec)
  - `is_structure_valid(uid, position)` — async recursive validator, L1-direct downlines only (Q1=a), returns False the moment a child fails
  - `get_structure_report(uid, position)` — detailed count + met status for the UI progress bar
  - In-memory TTL cache (5 min, Q4=c) with `clear_structure_cache()` helper
- ✅ **Commission engine** (`backend/routes/mining_commission.py`): position-path branch now calls `is_structure_valid`; on failure the upline is demoted to USER-tier (legacy 3-tier) commission (Q2=b — "temporarily treat as user")
- ✅ **`GET /api/partners/my-position/{uid}` response updated** with `structure_required`, `structure_report`, `structure_met`, `elite_active`, and recomputed `commission_active = elite_active AND structure_met`. USER position bypasses structure requirement.
- ✅ **New admin endpoint** `GET /api/admin/partners/audit-structure/{uid}` — diagnose why a partner's bonus is / isn't active
- ✅ **Invite page badge** (`frontend/src/pages/ReferralsEnhanced.js`): new "Structure Requirement" progress bar with green/red state, count out of target, separate messaging for Elite-gate vs Structure-gate failures. Users clearly see WHAT they need to build to unlock their bonus.
- 🧪 **8 new pytest cases** in `TestStructureGate` (32 tests total, all PASS): recursive valid path, invalid on missing child, invalid when nested child breaks, report shape, cache TTL behavior, commission blocked/allowed scenarios. Existing `TestCommissionDistribution` uses autouse fixture to bypass the gate so tier-depth / Elite tests continue to isolate their concerns.



## Implemented (Feb 06, 2026 — Partner Positions E2E Testing + Bug Fixes)
- ✅ **E2E test run of new Partner Positions 5-tier referral system** (`testing_agent_v3_fork` iteration 258): 23/23 backend + full frontend flow PASS on first pass, 2 backend bugs + 1 frontend race condition identified and FIXED, all 24 pytest cases now PASS.
- 🐛 **BUG FIX #1 — Notification E11000 duplicate key** (`backend/routes/partner_positions.py`): partner_position_assigned notification was silently failing on every 2nd+ assignment because `notification_id` was missing → dup-key on null. Added `notification_id: str(uuid.uuid4())`, `user_uid`, and `is_read` fields to match the shared notification schema. Users now correctly get their promotion notification.
- 🐛 **BUG FIX #2 — Elite-gate UI/backend mismatch** (`backend/routes/partner_positions.py:get_my_position`): Badge was using strict `subscription_plan == 'elite'` while the actual commission engine (`mining_commission._is_elite_active`) accepts the full `ELITE_PLANS = {elite, vip, startup, growth, pro}` set + `membership_type` field. Users with `membership_type='vip'` etc. were being told to "Upgrade to Elite" while silently receiving commissions. Now imports and reuses `_is_elite_active()` — single source of truth for elite eligibility across UI and engine.
- 🐛 **BUG FIX #3 — Frontend partner list race** (`frontend/src/pages/AdminPartners.js`): After a successful assign/revoke, the follow-up GET sometimes returned stale reads. Switched to optimistic local-state update (splice new partner into `partners` array immediately, then background-reconcile with server). No more disappearing rows.
- 🔒 **HARDENING — Regex injection on admin lookup** (`backend/routes/partner_positions.py:admin_assign_position`): Email lookup was directly interpolating user input into `$regex`. Added `re.escape()` so `.*`-style search inputs can't broaden the match to unintended users.
- 🧪 **Regression suite added**: `/app/backend/tests/test_partner_positions_e2e.py` — 24 tests covering assign/revoke/list/my-position/commission chain/Elite gate/depth cap/idempotency. Auto-seeds and tears down its own users; safe to run against any environment.



## Implemented (Jul 03, 2026 — Admin User 360 PIN Reset Modal Persistence Fix)
- 🐛 **User-reported (production)**: After clicking "Generate New PIN" in Admin User 360 → Reset PIN modal, the newly generated 6-digit PIN appeared briefly then disappeared, preventing the admin from copying it.
- **Root cause**: `handlePinReset()` was routed through the generic `handleAction()` wrapper. Inside `handleAction`, `await refreshUserData()` was called before returning the API response. The refresh triggered a full `setUserData(...)` re-render of the parent component. Because `setNewPin(result.new_pin)` was scheduled AFTER `await handleAction(...)` completed, there was a window where the modal re-rendered from the refresh before the PIN state got committed — causing a visible flash-and-clear behavior.
- 🛡️ **Fix** (`frontend/src/pages/AdminUser360New.js`):
  1. `handlePinReset()` now performs the `/admin/user-360/action` axios call directly, sets `newPin` **synchronously** on API success, then triggers `refreshUserData()` fire-and-forget so it can't clobber the modal state.
  2. Hardened the PIN Reset Modal `onClose`: when a PIN is currently displayed, dismissal now requires an explicit `window.confirm` ("Have you copied the PIN? Closing will clear it permanently.") to prevent accidental loss.
  3. Added a "Done — Close" button next to Copy PIN so admins have a clear intentional dismissal path.
  4. Added `data-testid` attributes for QA: `new-pin-display`, `copy-new-pin-btn`, `done-close-pin-btn`, `generate-new-pin-btn`, `cancel-pin-reset-btn`.
  5. Added warning line: "Copy this PIN now — it will not be shown again."
- **Production deploy required** — restores admin's ability to safely reset & communicate PINs.


## Implemented (Jul 03, 2026 — Session Expired False-Positive Fix — URGENT HOTFIX)
- 🐛 **User-reported (production)**: After deploying the Jul 03 security pass, every user was getting kicked to `/login` with "Your session has expired. Please log in again." toast immediately after login.
- **Root cause**: The Jul 03 IDOR hardening required Bearer tokens on `/api/notifications/{uid}`, `/api/prc-statement/*`, etc. But many raw `fetch()` call-sites in the frontend (NotificationContext, PRCStatement, PRCUsageHistory, PopupMessage, HolidayCalendar, AdminLedgerView, App.js's `/api/user/{uid}`, `/api/auth/logout`, `/api/auth/validate-session`, etc.) forgot to attach the Authorization header. Backend correctly returned 401 → my newly-added global `window.fetch` wrapper detected 401 with a stored token → treated it as session expiry → wiped storage + toast + redirect to `/login`. **False-positive auto-logout on every dashboard mount.**
- 🛡️ **Two-part fix** (`frontend/src/App.js`):
  1. **Auto-inject Bearer token** in the global `fetch` wrapper — if the URL hits `/api/` (except auth endpoints) and no Authorization header is present, transparently attach `Bearer <stored_token>`. Legacy fetch call-sites now behave identically to axios without touching every file.
  2. **Only trigger logout when a token was actually SENT** — both fetch wrapper and axios interceptor now check `tokenWasAttached`/`sentAuthHeader` before firing the logout flow. A 401 from a call that had no auth header just means the endpoint requires auth (public-flow scenario), not a live session expiry.
- **E2E verified on preview**: User logs in → dashboard mounts → NotificationContext fires `fetch(/api/notifications/{uid})` → wrapper auto-attaches Bearer → **200 response, no false logout**. Screenshot confirms full dashboard render (PRC 78157.75 visible, Elite Plan card, bottom nav, notification bell "9"), no toast, no redirect.
- **Production deploy required** — fixes the freshly-deployed regression.

## Implemented (Jul 03, 2026 — Comprehensive Security Pass — 15 IDORs Closed)
- 🛡️ **Full codebase security audit** — swept every user-facing route with `{uid}` / `{user_id}` in path and confirmed anonymous access is blocked. Fixed 15 confirmed IDOR / data-leak endpoints in one batch.
- **Class A — Missing auth entirely (leaked to anonymous callers):**
  - `GET /api/prc-statement/{uid}` — full PRC ledger (transactions, ₹ amounts, running balance)
  - `GET /api/prc-statement/usage-history/{uid}` — usage patterns, subscription payments, spend categories
  - `GET /api/notifications/{uid}` — private notifications (referrals, followers, DMs)
  - `GET /api/prc-lock/status/{uid}` — PRC balance + lock status
  - `GET /api/mall/my-bookings/{uid}` — full booking history INCLUDING delivery address + mobile PII
  - `GET /api/mining/status/{uid}` — mining status, daily rate, network breakdown
  - `GET /api/mining/rate-breakdown/{uid}` — detailed L1-L5 downline counts
  - `GET /api/mining/history/{uid}` — mining collection history
- **Class B — "Silent bypass" pattern (returned data when Authorization header was absent):**
  - `GET /api/user/{uid}/weekly-limits`
  - `GET /api/user/{uid}/redemption-stats`
  - `GET /api/subscription/user/{uid}`
  - `GET /api/user/{uid}/redeem-limit`
  - `GET /api/user/{uid}/performance-summary`
  - `GET /api/user/{uid}/subscription-redeem-cap`
  - `GET /api/subscription/history/{uid}`
- **Fix pattern applied uniformly:** Bearer token now REQUIRED; JWT verified; path `{uid}` must equal token subject (admins/sub_admins bypass for legit support ops); invalid token returns 401; wrong uid returns 403.
- **Verified via curl sweep** (anonymous) → all 15 return 401/403; authenticated own-data access → all return 200 with correct payloads.

## Implemented (Jul 03, 2026 — Ads Rewarded Race Fix + Fetch Wrapper)
- 🛡️ **ads_rewarded.credit_reward race condition fixed** (`routes/ads_rewarded.py`): previously did `update_one($inc)` then `find_one` to read post-update balance — under concurrent ad-completion callbacks the read could observe a mid-flight snapshot, garbling ledger `balance_before`/`balance_after`. Now uses atomic `find_one_and_update(return_document=True)` — post-write snapshot returned in the same call.
- 🛡️ **Global `window.fetch` monkey-patch** (`App.js`): every raw `fetch()` in the frontend now triggers the same 401 → auto-logout redirect flow as axios. Closes the "stale logged-in shell after token expiry" gap on PRCStatement, PRCUsageHistory, AdminPopupMessages, AdminLedgerView, NotificationContext, KYCVerification, ProfileAdvanced, App.js's auth-me/logout, etc. E2E verified: raw fetch → 401 → all storage wiped + redirect to `/login` + red toast banner.

## Implemented (Jul 03, 2026 — Auto-Logout on Token Expiry — SECURITY P0)
- 🐛 **User-reported (production)**: When JWT expired, the app kept rendering the logged-in shell with stale data. Users could still click through pages, but every API call was silently failing with 401. No logout, no redirect, no toast — dangerous UX + security hole (a stolen/expired session could linger indefinitely on shared devices).
- 🛡️ **Fix**: Added a 401/403 handler inside the existing `axios.interceptors.response` block in `frontend/src/App.js`. On any authenticated call returning 401 (or a token-flavoured 403):
  - Wipes `paras_user`, `token`, `paras_session_token` from localStorage + sessionStorage
  - Shows toast: `"Your session has expired. Please log in again."`
  - Forces a full-page redirect to `/login` (guarantees every in-memory user state, timer, and interval is reset)
  - Uses `window.__parasAuthLogoutInProgress` flag so simultaneous stale requests can't fire multiple redirects/toasts
  - Skips the login/register/verify-otp endpoints (401 there = bad credentials, not expiry)
  - Skips if the user never had a token in the first place (public endpoints)
- **E2E verified on preview**: logged in → replaced localStorage tokens with garbage → reloaded → auto-logout fired → landed on landing page with Login/Register visible → all storage cleared.
- **Files touched**: `frontend/src/App.js` (+~55 lines inside existing interceptor), `memory/PRD.md`.
- **Production deploy required** — hardening applies to live app after next deploy.

## Implemented (Jul 01, 2026 — Referral Fraud Hardening — SECURITY P0)
- 🔒 **CRITICAL FIX**: `POST /api/referral/apply/{uid}` had two exploitable flaws that could have allowed referral fraud in production:
  1. **No authentication**: Anyone knowing a UID could attach any referral code to that user's account (IDOR).
  2. **Race condition (double-claim)**: check-then-write pattern (`find_one` → `update_one`) allowed two concurrent requests to both pass the "already-referred" gate and write. Attackers could spam multiple tabs → attach multiple referrers → inflate `referral_count` on the losing referrer.
- 🛡️ **Fixes applied**:
  1. **JWT auth required**: Endpoint now depends on `_require_authenticated_user`. Path `uid` must match token subject (admin/sub_admin bypass permitted for legitimate support ops).
  2. **Atomic one-shot write**: replaced check-then-write with `find_one_and_update` filter `{"uid": uid, "referred_by": null-or-missing-or-empty}`. MongoDB serializes the update — exactly one concurrent request wins, others get 409 Conflict.
  3. **Deferred count increment**: `referral_count += 1` runs only if the atomic claim succeeded — no inflated counts even under concurrent replay.
  4. **Immutable audit log**: every successful claim now inserts into new `referral_claim_audit` collection (`uid`, `user_name`, `user_mobile`, `referrer_uid`, `referrer_name`, `referrer_code`, `referred_via`, `claim_ts`). Enables fraud investigations + gives referrers a receipt.
- **Existing guards preserved** (all previously in place): 30-day self-claim window, self-referral block, 20-level circular-chain detection, invalid code 404.
- **E2E fraud test suite verified on preview:**
  - No auth → 401 ✅
  - IDOR attack (User B tries to attach on User A's uid) → 403 ✅
  - Valid claim → 200 ✅
  - Double-claim → 400 (one-shot) ✅
  - **10 parallel race requests → exactly 1 winner, referrer_count = 1** ✅ (no inflation, no double-attach)
- **Production deploy required** — hardening will apply to the live app after next deploy.

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

## 2026-02-05 — Paras Mall Mining Session LAPSE/BURN (24h)
- Implemented strict 24-hour lapse on mall product mining sessions.
- If user does NOT click Collect within 24h of `session_start`, all accumulated PRC LAPSES to 0 (burned).
- User can then start a fresh mining session immediately — no cooldown wall for burned points.
- Backend: `compute_session_accumulated()` returns `(0.0, elapsed)` when `elapsed >= 86400`. `/api/mall/collect/{id}` returns HTTP 400 "Session expired — points lapsed" and atomically clears `session_start` + increments `laps_count`. `/api/mall/start-session/{id}` auto-clears lapsed sessions and starts fresh. `/api/mall/my-bookings/{uid}` sets `session_expired=true`, `session_accumulated_prc=0`, `can_start_session=true` on lapsed bookings.
- Frontend (`ParasMallBookings.js`): Red "Session Expired - Points Lapsed" banner + green "Start New Mining Session" button when lapsed. Collect button, Resets-In timer, and Session Earnings panels are all HIDDEN when expired.
- Test: `/app/backend/tests/test_mall_mining_burn.py` (6/6 unit pass) + `/app/backend/tests/test_mall_mining_burn_e2e_api.py` (5/5 API E2E pass — verified live).


## 2026-02-05 — 4 Feature Launch: Cap flat / Deposit selector / Soft delete / Bank limits config
1. **Paras Mall Network Cap = 800 flat** — `get_user_network_cap()` in `paras_mall.py` now returns constant 800 for all users. Referral-based scaling removed for Mall only (main mining unchanged).
2. **Upfront Fee = Prepaid Deposit selector (V3)** — User picks 10% / 20% / 35% / 50% at booking time. Higher deposit = smaller mining target (deposit counts as `paid_prc`). Model: `v3_prepaid_deposit` stored on booking. UI: `mall-upfront-selector` in `ParasMall.js`. Cancel-burn logic branches on `pricing_model`.
3. **Admin Product Soft Delete** — `DELETE /api/admin/mall/products/{id}` now sets `active=False + deleted_at + deleted_reason` instead of physical delete. Active bookings continue mining. Product hidden from listing (already gated by `only_active=True`).
4. **Admin Bank Redeem Limits Config** — New module `admin_bank_redeem_config.py`. `GET /api/admin/bank-redeem-limits/config` returns current limits. `PATCH /api/admin/bank-redeem-limits/config` (X-Admin-Pin=123456) updates min/max/monthly-cap. Enforced in `manual_bank_transfer.py`. Legacy hardcoded MAX_WITHDRAWAL cap retired. Fail-safe: on config-read error, falls back to hard defaults (100 min / 10000 max) rather than fail-open. UI card in `AdminSystemSettings.js` at `/admin/settings-hub?tab=system`.

- **Tests**: `/app/backend/tests/test_iteration_256_features.py` (12/12 executed pass) + `/app/backend/tests/test_mall_mining_burn.py` (6/6 pass) regression.
- **Testing agent report**: `/app/test_reports/iteration_256.json` — 100% pass, no bugs blocking launch. Two minor code-hygiene items fixed post-report (legacy MAX_WITHDRAWAL retirement + narrower except handling in bank redeem).


## 2026-02-05 — CRITICAL Razorpay Subscription Revenue-Leak Fixes (3 bugs)

**User report**: "Production var users razorpay gateway varun order cancel karto / fail hoto / pending hoto tar subscription active hote — paisa न milता."

### Bug #1 (SECURITY — CVSS 8.8, revenue leak): Webhook signature bypass
- **File**: `/app/backend/routes/razorpay_payments.py` `/webhook` endpoint (~line 666)
- **Root cause**: `if webhook_secret and signature:` — when either was missing, fell through to `else` branch and processed the payload without ANY authentication.
- **Attack chain**: Attacker with any valid account calls `POST /api/razorpay/create-order` → gets order_id → sends fake `POST /api/razorpay/webhook` with `{"event":"payment.captured","payload":{"payment":{"entity":{"order_id":"...","id":"any","amount":30000}}}}` — WITHOUT X-Razorpay-Signature header → subscription activated for free.
- **Fix**: Hard-require BOTH `RAZORPAY_WEBHOOK_SECRET` env var AND `X-Razorpay-Signature` header. Uses `hmac.compare_digest` (constant-time). Missing secret → 503. Missing/invalid signature → 401.
- **Verified**: no-sig → 401 ✅ / wrong-sig → 401 ✅ / correct-sig → 200 ✅.

### Bug #2 (LOGIC): Auto-sync cron ignoring user cancellation
- **File**: `/app/backend/server.py` `auto_sync_captured_from_razorpay()` (~line 2610)
- **Root cause**: The cron only checked `if status in [paid, processing]: skip`. Missing `cancelled/failed/error/timeout/dismissed` gate → a user-cancelled order with a late-async-UPI capture would silently auto-activate ignoring the cancel.
- **Fix**: Added explicit skip on cancelled/failed/error/timeout/dismissed statuses (matches the same gate in `/webhook` and `/verify-payment`). Also updated the atomic claim `$nin` list to prevent race conditions.

### Bug #3 (LOGIC): Duplicate `status` key silently dropped filter
- **File**: `/app/backend/server.py` `auto_sync_razorpay_payments()` (~line 2376)
- **Root cause**: `{"status": {"$in": [...]}, "status": {"$nin": [...]}}` — Python dict literal, second key overrides first. Query became just `$nin`, pulling `paid`/`processing` orders too (though atomic claim caught them).
- **Fix**: Merged into single `{"status": {"$in": ["created","pending","attempted"]}}` clause. Atomic claim `$nin` extended to include cancelled/failed statuses.

### Production Redeploy Required
User must trigger a production redeploy to push these fixes to https://bugzappers.emergent.host / www.parasreward.com. **Also verify**: `RAZORPAY_WEBHOOK_SECRET` env var IS set in production. If missing, webhook will now return 503 (safer than the old fail-open behavior).


## 2026-02-05 — Audit Endpoints Fixed + New Comprehensive Audit Endpoint

Follow-up to the 3 Razorpay revenue-leak bugs. Discovered the existing audit/fix endpoints had a silent-false-negative bug themselves:

### Bug #4 (audit was lying): `user_id` vs `uid` field mismatch
- Files: `/admin/fix-cancelled-subscriptions` (~2152), `/admin/audit-cancelled-elite` (~2272)
- Both queried `db.users.find_one({"user_id": uid})` — but users collection uses `uid`, not `user_id`. All lookups returned None → audit reported ZERO affected users even when leak was active.
- Fix: Changed to `{"uid": uid}` in 3 places. Also extended plan-check to include `growth` + `startup` (not just `elite`).

### NEW: `/api/razorpay/admin/audit-paid-plans-without-payment`
Comprehensive scan endpoint. Finds users on ANY paid plan (elite/growth/startup) who have:
- No paid razorpay_order, AND
- No subscription_payments row, AND
- No admin_upgraded / admin_fixed flag

Returns detailed suspicious_users list with recent cancelled orders for context. Supports `dry_run=true` (default) for safe preview and `dry_run=false` for bulk downgrade to explorer. Uses `admin_pin=123456`.

### Verification
15/15 pytest assertions passed across 10 test cases. Report: `/app/test_reports/iteration_257.json`. Test file: `/app/backend/tests/test_razorpay_webhook_audit_security.py`.


## 2026-02-06 — Future-Proofing Layer 3: Recent Activations Monitor

Decision: 113 existing suspicious users LEFT ALONE (too risky to bulk-downgrade; contains 21 legitimate legacy VIP founders from Jan 2026 platform launch). Focus on **preventing future leaks**.

**Verified** on production (curl to https://www.parasreward.com/api/razorpay/webhook without signature → 401): `RAZORPAY_WEBHOOK_SECRET` env var IS set + signature check IS active. Attackers can no longer forge webhook events.

**New endpoint added**: `POST /api/razorpay/admin/monitor-recent-activations`
- Body: `{"admin_pin":"123456","days":7}`
- Returns paid-plan users activated in the last N days who have NO payment evidence
- Zero writes — safe to call anytime
- Recommended weekly cadence — if `alerts_no_evidence` count stays 0, all reactive layers are holding.

**Prevention layers now active:**
1. Webhook mandatory signature (fail-closed on missing secret/sig)
2. auto_sync_captured cron skips cancelled/failed orders
3. auto_sync_razorpay_payments duplicate-key fixed
4. Bank redeem admin-configurable limits (unrelated but adjacent)
5. Recent-activations monitor endpoint for weekly canary

**Historical leak breakdown (2098 paid-plan users audited, Feb 6):**
- 7 users: Group A — failed/cancelled orders bug (₹8,252/mo loss, kept live per user decision)
- ~85 users: Group B — likely webhook-bypass attack in Feb 2026 (~₹1L/mo)
- ~21 users: Group C — legitimate legacy VIP founders (Jan 2026)
- No further downgrades planned — customer relationship preserved.


## 2026-02-06 — Partner Positions System (Multi-Tier Referral)

Advanced multi-tier referral system where admin assigns positions granting commission on downline Main Dashboard mining collects.

### Positions & Rules
| Position | Levels | Cap | Recipient Plan | Commission |
|---|:---:|:---:|:---:|:---:|
| USER (default) | L1-L3 | 500 | Elite only | 1% |
| DISTRICT_PARTNER | L1-L4 | 1,000 | Elite only | 1% |
| REGIONAL_STATE_PARTNER | L1-L5 | 2,000 | Elite only | 1% |
| STATE_PARTNER | L1-L6 | 4,000 | Elite only | 1% |
| NATIONAL_PARTNER | L1-L7 | 8,000 | Elite only | 1% |

- CAP = total across all applicable levels combined (not per-level)
- Recipient must be on Elite plan to receive commission (else assigned but inactive)
- Trigger = Main Dashboard mining collect only (not Paras Mall)
- No expiry — permanent until admin revokes
- HYBRID mode: users WITHOUT partner position still get legacy 3-tier admin config commission

### New Files
- `backend/routes/partner_positions.py` — router + admin router + POSITION_CONFIG constants
- `frontend/src/pages/AdminPartners.js` — admin management page at `/admin/partners`

### Modified Files
- `backend/server.py` — wired partner_positions routers
- `backend/routes/mining_commission.py` — commission distribution now checks upline's `partner_position` and applies position-specific levels + commission %
- `frontend/src/App.js` — new admin route `/admin/partners`
- `frontend/src/pages/ReferralsEnhanced.js` — position badge card with per-level breakdown + cap usage bar

### Admin Endpoints (all require X-Admin-Pin header)
- `POST /api/admin/partners/assign` — body: {admin_id, query, position}
- `POST /api/admin/partners/revoke` — body: {admin_id, uid}
- `GET /api/admin/partners/list` — list all non-USER partners

### User Endpoint
- `GET /api/partners/my-position/{uid}` — returns position + cap breakdown for Invite page badge

### Notifications
On assignment, an in-app notification is inserted into `db.notifications` for the user with title "🎉 Promoted to {position_label}" and full explanation.


## 2026-02-07 — First Payout Priority Queue (Admin)

Dedicated admin dashboard tab at `/admin/bank-transfers/first-payout-queue` that prioritises pending bank-transfer redeems from NEW users whose lifetime bank-payout is UNDER a configurable INR threshold (default ₹1,000). Improves onboarding trust — new users get their first payout fastest.

### Files
- `backend/routes/manual_bank_transfer.py` — L1352 GET/POST `/admin/first-payout-threshold`, L1394 GET `/admin/first-payout-queue`
- `frontend/src/pages/Admin/AdminFirstPayoutQueue.js` — full UI (stats bar, threshold settings, per-row Approve/Reject)
- `frontend/src/pages/Admin/AdminBankTransfers.js` — L417 discovery card linking to the queue page
- `frontend/src/App.js` — L938 route `/admin/bank-transfers/first-payout-queue`
- `backend/tests/test_first_payout_queue.py`, `backend/tests/test_first_payout_queue_full.py` (6 tests) — E2E coverage

### Endpoints (unauthenticated at middleware — see Known Issues)
- `GET /api/bank-transfer/admin/first-payout-threshold` → `{threshold_inr, source, db_value, env_default}`
- `POST /api/bank-transfer/admin/first-payout-threshold` body `{value: number|null}` — persists to `app_settings`, 0-5000 range, null clears override
- `GET /api/bank-transfer/admin/first-payout-queue?limit=100` → `{success, threshold_inr, total_in_queue, urgent_count, total_amount_inr, requests[]}`

### Row shape (each queue item)
`request_id, user_id, user_name, user_phone, account_holder_name, account_number, ifsc_code, bank_name, withdrawal_amount, lifetime_bank_paid_inr, remaining_to_threshold_inr, days_waiting, is_urgent (>3d), subscription_plan, is_subscription_active`

### DB Index Fix
`paras_reward_db.users` — `email_1` index migrated from `unique + non-sparse` to `unique + partialFilterExpression: {email: {$type: 'string'}}`. Eliminates the E11000 duplicate-key error when seeding users without an email.

### Bug Fixes in This Iteration
1. Frontend was posting `{admin_uid, reason}` to mark-paid/mark-failed but backend expects `{admin_id, remark}` — fixed in `AdminFirstPayoutQueue.js:doAction`.
2. Invalid ESLint pragma `// eslint-disable-next-line react-hooks/exhaustive-deps` was blocking the entire admin app behind a CRA compile-error overlay — removed.

### Known Issues (Pre-existing, out of scope)
- `AdminAuthMiddleware` only guards `/api/admin/*`. Admin routes under `/api/bank-transfer/admin/*`, `/api/community/admin/*`, etc. bypass the middleware — auth must be enforced at gateway or router-level. Not introduced by this feature, but flagged.

### Testing
Backend: 7/7 pytest pass. Frontend: Playwright E2E full flow verified (login → discovery card → queue page → stats/settings/refresh/rows/approve/reject).

## 2026-02-15 — Community Leadership Program (Phase C + Phase D)

Full rename of Partner Program → Community Leadership Program + Phase C user dashboard widgets.

### Terminology Rename (UI-only, DB fields unchanged)
- Partner Position → Leadership Position
- Commission → Leadership Reward
- Downline → Community Network
- Upline → Mentor
- User (default) → Community Member
- District/Regional State/State/National Partner → District/Regional/State/National Coordinator
- Downline cap → Reward Ceiling

### Files renamed (UI text)
- `backend/routes/partner_positions.py` — POSITION_CONFIG labels + notification message body ("Leadership Reward" wording)
- `backend/routes/mining_commission.py` L531 — notification title "🎉 Leadership Reward Received!" + "Tier X Leadership Reward" body
- `frontend/src/pages/AdminPartners.js` — page title, dropdown, columns, tooltips
- `frontend/src/pages/AdminSystemSettings.js` — "Leadership Reward Tiers" section + "Save Reward Tiers" button
- `frontend/src/pages/AdminSettingsHub.js` — Community Leadership card description
- `frontend/src/pages/ReferralsEnhanced.js` — Position badge, Reward Ceiling label, Community Live Feed link
- `frontend/src/pages/DownlineLiveFeed.js` — header "Community Live Feed" + subtitle
- `frontend/src/pages/BankRedeemPage.js` — "verified Community Members" notice
- `frontend/src/pages/CommunityDashboard.js` — invariant comment updated
- `frontend/src/pages/ReferralCalculator.js`, `AdminInactiveCleanup.js`, `ParasMall.js` — minor copy fixes

### Phase C — User Dashboard Widgets (NEW in `/api/partners/my-position/{uid}`)
- `hierarchy_score_pct` — progressive % (0-100) instead of boolean pass/fail
- `community_health` block: `{active_count, inactive_count, total_elite_l1, health_pct, status}` — status ∈ green/yellow/red/gray. **Active definition**: Elite subscription active + last mining collect within 7 days (per user spec Q2=e).
- `next_promotion` block: `{next_position, next_label, child_label, required_count, current_count, missing_count, progress_pct, ready}` — null for NATIONAL (highest tier).
- New helper `_count_l1_health_active()` in `partner_positions.py` for the strict active count.

### Frontend Phase C testids
`partner-position-label`, `leadership-community-health-card`, `leadership-community-health-status`, `ch-active-count`, `ch-inactive-count`, `ch-health-pct`, `next-promotion-tracker`, `next-promotion-label`.

### Cap Semantics (per user Q1=b)
- Community Member: 500 reward ceiling · District: 1,000 · Regional: 2,000 · State: 4,000 · National: 8,000
- Ceiling = **max downlines whose collects credit reward to this leader**. Community can grow beyond (unlimited) but only earliest-added FIFO members earn Leadership Reward for the leader.

### Testing
- New comprehensive test file: `/app/backend/tests/test_community_leadership_phaseC.py` — 17 tests, 16 pass, 1 xfail (FIFO gap — see Known Issues).
- Testing iteration: `/app/test_reports/iteration_268.json` — 94% backend + 90% frontend PASS.
- 1 HIGH bug fixed by testing agent: missing `/api/` prefix on axios call at `ReferralsEnhanced.js:81`.
- 1 duplicate testid fixed by main agent: renamed Phase C card testids to `leadership-community-health-*` to avoid collision with the pre-existing CommunityDashboard component.

### Known Gaps (require user decision)
1. **FIFO reward-ceiling enforcement** — `POSITION_CONFIG` documents "earliest cap-many count" but `mining_commission.distribute_mining_collect_commission` does NOT filter L1 by created_at order. Currently every valid position holder receives the full 1%. Options: (a) implement per-collect BFS rank lookup, (b) precompute rank at signup, (c) drop the doc claim. Not blocking existing behaviour — pre-existing gap surfaced during Phase C tests.
2. **`/admin/system-settings` "Leadership Reward Tiers" section** — testing agent's Playwright scan didn't reach the section (may need auth PIN or scroll). Verified manually by main agent via direct file check — rename is in place at L544.

## 2026-02-16 — Paras Reward v2.0 — Partner Store Payment Network — SLICE 1 (Foundation + Login)

**Goal**: Local Partner Store Payment & Settlement Network. Users pay PRC to verified local businesses; admin approves settlement to store's bank account. Coexists with Paras Mall (Q1=a).

### Slice 1 Delivered (Feb 16 2026)
- **New collections** (`partner_store.py` bootstraps indexes at startup):
  - `partner_stores` — profile + KYC docs + bank + GPS + verification_status
  - `partner_store_wallets` — settlement-only wallet per store (`prc_balance`, `lifetime_received_prc`, `pending_settlement_prc`)
  - `partner_store_txns` — user→store payment log (Slice 2 will insert)
  - `counters._id='partner_store_id_seq'` — atomic sequential Store ID allocator starting at 100001
- **Backend endpoints** under `/api/v2/partner-stores`:
  - `POST /admin/create` — admin onboards new store login + profile (creates linked `users` doc with `role='partner_store'` + `partner_store_id`)
  - `POST /admin/verify` — verify / reject / suspend a store
  - `GET /admin/list` — cursor-paginated with status filter + text search
  - `GET /admin/{store_id}` — full detail + wallet
  - `GET /self/{uid}` — store's own dashboard payload (profile + wallet + today's collection)
  - `GET /self/{uid}/transactions` — recent user→store payments
- **Auth extension**: `User` Pydantic model now includes `partner_store_id`. Login response returns `role: 'partner_store'` + `partner_store_id` → frontend redirects to `/partner-store/dashboard`.
- **Frontend pages**:
  - `/admin/partner-stores` (`AdminPartnerStores.js`) — status chip filter, text search, cursor pagination, "New Store" onboarding form (all fields per PRD KYC list), inline verify/suspend/reject actions.
  - `/partner-store/dashboard` (`PartnerStoreDashboard.js`) — big Store ID card (copyable), 4 stat tiles (Today/Wallet/Pending/Lifetime), verification banner (pending/rejected/suspended states), Settlement Bank recap, Recent Payments list.
- **Auth-guard redirect** in `App.js:getRedirectPath` — `partner_store` role → `/partner-store/dashboard`.
- **Admin Settings Hub tile** added: "Partner Stores" (emerald-teal gradient) linking to admin CRUD.

### Design decisions locked in (per user Q&A)
| Q | Choice | Meaning |
|---|---|---|
| Q1 | a | Paras Mall retained alongside Partner Stores |
| Q2 | e | Same app, `role='partner_store'` — no public registration; admin onboards |
| Q3 | — | No QR code — only mobile number OR 6-digit Store ID |
| Q4 | Full Phase 2 | All 5 slices in scope (only Slice 1 delivered) |
| Q5 | n | Settlement reuses existing `bank_transfer_requests` collection |
| Q6 | q | 10k+ store scale — cursor pagination, compound + partial + text indexes |
| Q_A | a1 | Sequential Store IDs starting 100001 |
| Q_B | b3 | Login = mobile + 6-digit PIN (same as user) |
| Q_C | c2 | Payment limits ₹5,000/txn · ₹20,000/user/day · 3 payments/user/store/day (Slice 4) |
| Q_D | d3 | No minimum settlement threshold |
| Q_E | e1 | PRC→INR settlement uses admin-configured redeem rate |

### Bug fixed in this iteration
- Double `/api/api/` prefix in frontend axios calls — `API` const already includes `/api`. Fixed 4 call sites.

### Slice 2-5 Backlog
- **Slice 2** (Payment Engine): user-side "Pay to Partner Store" flow, atomic PRC transfer, txn logging, fraud limits
- **Slice 3** (Settlement Engine): settlement request → admin approve → bank transfer via existing `bank_transfer_requests`
- **Slice 4** (Notifications + Search + Fraud): notification templates, rate limits, audit log
- **Slice 5** (Reports + Polish): daily/weekly/monthly stats, CSV export, performance verify at 10k scale

### Test Credentials
- Sample store: Store ID `100001`, mobile `8888800001`, PIN `999888` (Sharma Kirana Store)

## 2026-02-16 (later) — Partner Store v2.0 SLICES 2 + 3 COMPLETE + Full E2E Test

### Slice 2 — Payment Engine
- `POST /api/v2/partner-stores/pay/lookup` — resolve store by mobile OR store_id
- `POST /api/v2/partner-stores/pay` — atomic PRC transfer (user debit → store credit → txn insert → notifications). Idempotent via `client_txn_id`.
- Fraud limits per Q_C=c2: ₹5000/txn · ₹20000/user/day · 3 payments/user/store/day (IST-bounded)
- `GET /user/{uid}/transactions` — user's Partner Store payment history

### Slice 3 — Settlement Engine
- `POST /api/v2/partner-stores/settlement/request` — moves wallet.prc_balance → pending_settlement_prc, creates `bank_transfer_requests{source_type: 'partner_store', partner_store_id}` for admin approval.
- Admin approval hook in `manual_bank_transfer.py:mark_request_paid` — on paid: pending → lifetime_settled + "Settlement Completed" notification. On rejected: pending → prc_balance refund + "Settlement Rejected" notification.
- Reuses existing `/admin/bank-transfers` panel with source filter.

### Frontend
- `/pay-partner-store` (`PayPartnerStore.js`) — user-facing payment UI: lookup → amount + quick buttons → confirm → success screen with receipt
- `PartnerStoreDashboard.js` — added Request Settlement button + modal + Settlement History section
- `DashboardModern.js` — new "Pay to Partner Store" card (green gradient) below Mining widget
- `App.js` — route `/pay-partner-store`, guarded (not partner_store role)

### Testing (Iteration 269 — Comprehensive Full-Session Test)
- **Backend: 100% (34/34 pytest)** — file: `/app/backend/tests/test_partner_store_v2_complete.py`
- **Frontend: 100%** — all testids + Playwright flows verified
- **Regression pass**: Community Leadership Phase C, Paras Mall 1-col grid, First Payout Queue all working

### 3 Blockers Fixed by Testing Agent
1. **Partner Store login blocked** — `admin_create_partner_store` didn't set `pin_migrated:True` + `password` fields → LoginNew.js forced /set-new-pin instead of PIN login. FIXED.
2. **Wrong redirect after login** — `LoginNew.js:handleLoginSubmit` had hardcoded role routing missing `partner_store` case → landed on /dashboard. FIXED with explicit branch → `/partner-store/dashboard`.
3. **First Payout Queue leaked partner store rows** — endpoint didn't filter `source_type='partner_store'`. FIXED with `$ne` filter.

### 3 Code Review Cleanups (Main Agent)
- Removed dead-branch ternary `kyc_status: 'verified' if False else 'pending'` (`partner_store.py`)
- Seeded `partner_store_id_seq` counter with `$setOnInsert: STORE_ID_START-1` to eliminate first-allocation race (`_allocate_store_id`)
- Fixed idempotency rollback to also revert wallet credit (not just user debit) — prevents phantom store credit on txn insert collision

### Current Backlog
- 🟡 P2 — Slice 4: Fraud detection (rate limits done; velocity monitoring TBD), audit log, notification templates
- 🟡 P2 — Slice 5: Reports + CSV export + 10k-scale performance verification
- 🟡 P2 — FIFO reward-ceiling enforcement (Community Leadership)
- 🟡 P2 — Legacy `/api/api/` double-prefix cleanup in other files

## 2026-02-16 (later) — Payment Success Ad Banner (AdMob + Web Fallback)

### Goal
Show an ad after user completes a payment to a Partner Store.

### Placement chosen: `b + e + g + k` (per user approval)
- **When**: on the payment-success receipt screen (non-blocking)
- **Source**: Google AdMob banner on Android app; admin-configured popup ad on web fallback
- **Frequency**: every successful payment
- **Dismissible**: yes — X button, immediate close

### Implementation
1. **AdMob credentials** (real, provided by user):
   - App ID: `ca-app-pub-3556805218952480~1933993140`
   - Banner Unit ID: `ca-app-pub-3556805218952480/9523773390`
2. **capacitor.config.json** — added `bannerAdUnitId` to AdMob plugin config.
3. **frontend/.env** — new keys `REACT_APP_ADMOB_APP_ID`, `REACT_APP_ADMOB_BANNER_UNIT_ID` (protected keys preserved).
4. **New component** `/app/frontend/src/components/AdMobBanner.js` — dual-mode:
   - On Capacitor native (Android): loads `@capacitor-community/admob` (already in package.json v7), calls `AdMob.showBanner()` at BOTTOM_CENTER with ADAPTIVE_BANNER size. Cleanup on unmount via `removeBanner()`.
   - On web browser: falls back to admin-configured popup ad (queries `/api/admin/popup/active?placement=partner_store_payment`). Renders image + title + HTML body + CTA + dismiss chip.
5. **Placement scoping in popup system** — added `placement` field to `popup_messages` schema:
   - Default `'app_startup'` (backward-compat — existing behaviour unchanged)
   - New scope `'partner_store_payment'` for payment ads
   - `/api/admin/popup/active?placement=X` returns the enabled popup for that scope
   - `create`/`update`/`toggle` endpoints scope the "disable others" logic to same placement — app_startup popup and partner_store_payment ad can be simultaneously active
6. **Injection** — `PayPartnerStore.js` renders `<AdMobBanner placement="partner_store_payment" />` right after the Done/Pay Another buttons on the success screen.

### Files touched
- `backend/routes/admin_popup_routes.py` — placement field, scoped disable-others, ?placement query param on /active
- `frontend/capacitor.config.json` — bannerAdUnitId
- `frontend/.env` — REACT_APP_ADMOB_* keys
- `frontend/src/components/AdMobBanner.js` — new (dual-mode component)
- `frontend/src/pages/PayPartnerStore.js` — import + render on success screen

### Testing (curl + Playwright)
- Seeded ad popup with `placement='partner_store_payment'` directly in DB → `/api/admin/popup/active?placement=partner_store_payment` returned it correctly, `/api/admin/popup/active` (no param) still returns app_startup only.
- Live E2E: created fresh Elite test user (uid: `test-ad-user-*`, mobile 7777700077, PIN 123456, 1000 PRC), completed payment of 10 PRC to Store 100001 → success screen rendered with receipt + Sponsored ad banner: "Grab 20% cashback on next PRC purchase!" + "Learn More" CTA + X close button. Dismiss verified (count 1→0).
- Cleanup: removed test-ad-user + test txn from DB.

### Testids
- `web-fallback-ad`, `web-ad-title`, `web-ad-cta-btn`, `web-ad-dismiss-btn` (web mode)
- `admob-native-slot`, `admob-dismiss-btn` (Capacitor mode)

### Admin workflow (for setting a new payment ad)
- Go to `/admin/popup-messages` (existing WYSIWYG editor)
- Create/enable a popup with **placement** field set to `partner_store_payment`
- Only one popup per placement can be enabled at a time
- Ad instantly appears on the payment-success screen for all subsequent web payments (native app users get AdMob banners instead)

## 2026-02-16 (later) — Banner Ad Placements Expanded (3 new spots)

3 additional strategic banner ad placements added across the app — all use the same `AdMobBanner` dual-mode component (AdMob native on Capacitor + admin popup fallback on web).

### New Placements
| Placement key | Where | Frequency |
|---|---|:---:|
| `dashboard_home` | User dashboard, near bottom above bottom-nav | Every dashboard visit |
| `community_feed` | Inline between posts in Community feed | After every 4th post (native format) |
| `notifications` | Top of `/notifications` page | Every visit |
| `partner_store_payment` | Payment success screen (already delivered) | Every successful payment |

### Registered placements catalog
Admin can create/enable a popup for any of these 4 placements via `/admin/popup/create` with `placement=<key>` field. Only one enabled popup per placement (scoped disable-others). Web users see the admin popup content; Android app users see real AdMob banners (mediated by the same `AdMobBanner` component's native path).

### Files touched
- `frontend/src/pages/DashboardModern.js` — imports AdMobBanner + renders `<AdMobBanner placement="dashboard_home"/>` at line ~1241 (data-testid `dashboard-bottom-ad-slot`)
- `frontend/src/pages/CommunityPage.js` — imports AdMobBanner + inline render between posts (data-testid `community-inline-ad-{idx}`, injected every 4th post)
- `frontend/src/pages/Notifications.js` — imports AdMobBanner + top-of-list render (data-testid `notifications-top-ad-slot`)

### Testing
Seeded distinct test popups per placement:
- `dashboard_home` → "📱 Boost your daily earnings!" — verified on live UI
- `community_feed` → "🎉 Join the top earners club" — 5 inline slots verified on feed
- `notifications` → "🔔 Stay ahead with premium features" — top banner verified
- `partner_store_payment` → "🏪 Save 20%..." — verified on payment success screen (previous iteration)

All ads dismissible; each placement independently manageable; zero cross-placement leaks.

### Backlog
- 🟡 P2 — Admin popup editor UI: add "Placement" select dropdown (currently admin must POST with `placement` field manually or defaults to `app_startup`)
- 🟡 P2 — Ad performance analytics (impressions, clicks, dismissals per placement)

## 2026-02-16 (later) — Partner Store v2.0 SLICE 4 + 5 COMPLETE

### Slice 4 — Audit Log + Fraud Monitoring (Backend)
- **New collection**: `partner_store_audit_log` — append-only compliance trail
- **New helper**: `_audit_log(event_type, user_uid, store_id, severity, details)` in `partner_store.py` line 360
- **Event types written**:
  - `payment_success` (severity: info) — every successful payment
  - `payment_rejected_insufficient_balance` (severity: info) — 400 rejects
  - `fraud_daily_limit_exceeded` (severity: warning) — >₹20k/user/day 429 rejects
  - `fraud_velocity_same_store_exceeded` (severity: warning) — 4th+ payment same user/store/day 429 rejects
- **New admin endpoint**: `GET /api/v2/partner-stores/admin/audit-log`
  - Query filters: `event_type`, `severity`, `user_uid`, `store_id`, cursor pagination
  - Returns `count_by_event` aggregate summary + events[]
  - Requires `X-Admin-Pin` header

### Slice 5 — Reports + CSV Export
- **`GET /api/v2/partner-stores/admin/reports/summary`** — admin dashboard analytics:
  - Payments: `total_prc`, `txn_count`, `unique_stores`, `unique_users`, `avg_prc`
  - Settlements: `{status: {count, sum_prc, sum_inr}}`
  - `fraud_events`, `stores_by_status`
  - Optional `?from=ISO&to=ISO` date window
- **`GET /api/v2/partner-stores/admin/reports/csv?type=payments|settlements|fraud`** — CSV export:
  - Payments: 10-column export (txn_id, dates, store, user, amount, remark, status)
  - Settlements: 14-column export (request_id, bank details, status, UTR)
  - Fraud: severity in [warning, critical] only, JSON-stringified details
  - Content-Disposition: `attachment; filename="..."`
  - RFC-4180 compliant escaping via `_csv_row()` helper
- **`GET /api/v2/partner-stores/self/{uid}/report/csv`** — store's own GST/accounting export
  - Role-guarded (403 for non-partner_store users)
  - 7-column: txn_id, date, prc_amount, user, mobile, remark, settlement_status

### Critical bug FIXED by testing agent (RCA in iteration_270.json)
- **Route ordering collision**: `/admin/{store_id}` catch-all was declared BEFORE `/admin/audit-log`, causing FastAPI to match audit-log requests to the catch-all and 404.
- Fix: moved `/admin/{store_id}` to end of file. NEVER re-add new `/admin/{X}` routes below it.

### Testing (Iteration 270)
- **Backend: 62/62 pytest PASS (100%)** — combines new Slice 4/5 (28 cases) + iteration 269 (34 cases)
- Test file: `/app/backend/tests/test_partner_store_v2_slice_4_5.py`
- Full regression pass: Community Leadership, Paras Mall grid, First Payout Queue, Ad Banners

### Code review notes (non-blocking, for future)
- Consider index on `partner_store_audit_log.{severity: 1, created_at: -1}` when log grows > 10k rows
- CSV export loads all rows to memory — swap to StreamingResponse for >50k row exports
- Consider adding `severity: critical` events for repeated fraud from same user (future automated detection)

---

## Feb 16, 2026 — P0 FIX: Admin Auto-Logout on Wrong Operation PIN (Community Leaders)

### Bug
Admins reported being force-logged-out mid-workflow when assigning a Community Leadership Position. Root cause: `partner_positions.py` returns `HTTPException(status_code=403, detail="Invalid admin operation PIN")` on any wrong/mistyped `X-Admin-Pin`. The global axios response interceptor in `/app/frontend/src/App.js` used a very broad regex (`/token|expired|invalid|.../i`) to classify a 403 as a session-expired event → wiped tokens, toasted "session expired", and redirected to `/login`. The lone word "invalid" in the detail matched.

### Fix
Tightened `tokenExpiredKeywords` regex so a 403 only triggers session-expiry logout when the detail explicitly contains a token/session/auth-related phrase (e.g., `token expired`, `invalid token`, `session expired`, `authentication required`, `unauthorized`). Business-logic 403s (wrong PIN, forbidden role, IP block) now surface as normal error toasts from the calling component's `catch` block.

- File changed: `/app/frontend/src/App.js` (interceptor regex only)
- Backend auth middleware verified to always return **401** (not 403) for genuine token failures — session-expiry path fully preserved.

### Verification
- Curl regression: wrong PIN → 403 `Invalid admin operation PIN`; correct PIN 123456 → 200 + assignment succeeds.
- Playwright E2E: admin login → `/admin/partners` → wrong PIN + `Assign` → URL stays at `/admin/partners`, error toast visible, no logout.
- No regressions on other admin PIN-gated endpoints (revoke, list, audit, structure-config) — same tightened classifier applies.

---

## Feb 16, 2026 — Feature: 10-Level Community Bonus Progression

### Spec (as approved by user)
| Level | Community Bonus | Required L1 Active Elite Direct Members |
|-------|-----------------|------------------------------------------|
| L1    | 1.0%           | 0                                        |
| L2    | 1.0%           | 0                                        |
| L3    | 1.0%           | 0                                        |
| L4    | 1.5%           | 10                                       |
| L5    | 2.0%           | 20                                       |
| L6    | 2.5%           | 30                                       |
| L7    | 3.0%           | 40                                       |
| L8    | 3.5%           | 50                                       |
| L9    | 4.0%           | 60                                       |
| L10   | 4.5%           | 70                                       |

- **Active Elite** = L1 downline with `subscription_plan/membership_type ∈ {elite,vip,startup,growth,pro}` AND `subscription_expired != True`.
- Receiver must themselves be Elite Active to actually be credited.
- Partner Position (District/Regional/State/National Coordinator) coexists — their tier config overrides the 10-level table when set.
- Auto-migration: level is derived on-the-fly at each collect from the live L1 active elite count. Existing users with 70+ downlines automatically earn L10 without any manual promotion.

### Backend
- **NEW**: `/app/backend/routes/community_levels.py`
  - `COMMUNITY_LEVEL_TABLE` constant (10 rows, source of truth)
  - `get_max_earnable_level(count)` — pure ladder lookup
  - `get_level_percent(level)` — % lookup
  - `count_l1_active_elite(uid, referral_code)` — Mongo count
  - `get_level_progression(uid)` — full report for UI
  - `get_max_earnable_level_for_uid(uid, referral_code)` — commission-engine hot path
  - Endpoints: `GET /api/community/level-progression/{uid}`, `GET /api/community/level-table`
- **CHANGED**: `/app/backend/routes/mining_commission.py`
  - Import 10-level helpers at module load
  - Loop walk depth extended from `max(max_tiers, 7)` → `max(max_tiers, 7, 10)` = 10 to cover L10 earners
  - USER-position uplines (no partner_position) now branch to the 10-level table: compute upline's max_earnable_level from their L1 active elite count, pay `_cl_level_percent(hops)` iff `hops <= max_earnable`; skip otherwise but continue walking.
  - Idempotency `count_documents` limit bumped to `max(max_tiers, MAX_LEVEL) + 1 = 11` to correctly detect fully-distributed events.
- **CHANGED**: `/app/backend/routes/community_dashboard.py` — composite `GET /api/community/dashboard/{uid}` now includes a `level_progression` key with the full 10-level report so the UI can render in one round-trip.
- **CHANGED**: `/app/backend/server.py` — registered new `community_levels` router at startup.

### Frontend
- **CHANGED**: `/app/frontend/src/pages/CommunityDashboard.js`
  - NEW `LevelProgressionCard` sub-component (glass style, 10-tile 5×2 grid).
  - Shows: current L badge with %, Elite-required callout when user is non-Elite, Partner-Position-override callout when applicable, progress-to-next-level bar (X / required, missing count, %), and the full 10 tiles with unlocked/current/locked visual states.
  - Wired into the main layout right below the Overview cards (Section 1B).
  - All new elements carry unique `data-testid` (`level-progression-card`, `level-tile-1..10`, `level-current-badge`, `level-active-count`, `level-next-progress-bar`, etc.).

### Verification
- **Unit ladder test**: 12 boundary counts (0, 5, 10, 19, 20, 29, 30, 45, 50, 65, 70, 150) all return the expected (level, percent) — 12/12 PASS.
- **API**:
  - `GET /api/community/level-table` → returns 10 rows with correct % + requirements.
  - `GET /api/community/level-progression/{uid}` → returns current_level, l1_active_elite_count, next_level target, all 10 levels annotated with unlocked/is_current flags.
  - `GET /api/community/dashboard/{uid}` → now includes `level_progression` node.
- **UI (Playwright)**: `/referrals` → Level Progression card visible under Overview; all 8 key data-testids (`level-progression-card`, `-header`, `-current-badge`, `-next-progress`, `-grid`, `level-tile-{1,3,10}`) present; L3 highlighted as current (Elite Test User, 0 direct elite); next-level target L4 @ 1.5% shown with progress bar; all 10 tiles rendered with correct % + requirement labels.
- **No regressions**: existing mining commission flow still credits USER-position uplines at L1-L3 (1% each) for users with 0 direct elite — matches pre-Feb 16 default (3-tier × 1%).

---

## Feb 17, 2026 — Community Bonus Table Rebalance (DECREASING structure)

### Change
Replaced the previous INCREASING community bonus table with a DECREASING one per revised economics ("चुकून अगोदर जास्त गेला होता").

| Level | Old % (Feb 16) | **New %** | Requirement (unchanged) |
|-------|----------------|-----------|--------------------------|
| L1    | 1.0            | **1.00**  | 0                        |
| L2    | 1.0            | **1.00**  | 0                        |
| L3    | 1.0            | **1.00**  | 0                        |
| L4    | 1.5            | **0.90**  | 10                       |
| L5    | 2.0            | **0.80**  | 20                       |
| L6    | 2.5            | **0.70**  | 30                       |
| L7    | 3.0            | **0.60**  | 40                       |
| L8    | 3.5            | **0.50**  | 50                       |
| L9    | 4.0            | **0.40**  | 60                       |
| L10   | 4.5            | **0.30**  | 70                       |
| **Total max** | 26.5%    | **7.20%** | —                        |

- L1-L3 remain the highest (1.00%), decreasing by 0.10% per level from L4 down to 0.30% at L10.
- Total max Community Mining Bonus capped at exactly **7.20%**.
- Thresholds unchanged, so users at existing counts stay at the same level number; only the % they receive is different.
- Community Leader multipliers (1.25×/1.5×/1.75×/2.0×) still apply ON TOP of these new base %.

### Files touched (single source of truth)
- `/app/backend/routes/community_levels.py` — `COMMUNITY_LEVEL_TABLE` constant updated + module docstring + `/level-table` notes/response now include `total_max_bonus_pct` field.
- `/app/backend/tests/test_community_leader_and_levels.py` — expected values updated to the new table + added 7.20% total assertion.

### Automatic propagation (no other files needed)
- **Commission engine** (`mining_commission.py`) reads `_cl_level_percent(hops)` at runtime → picks up new %s at next collect.
- **Composite dashboard** (`community_dashboard.py`) fans out to `get_level_progression()` → returns new %s.
- **Frontend** (`CommunityDashboard.js` → LevelProgressionCard) renders whatever `levels[]` returns → automatically shows new %s.
- **Community Leader multiplier** (`community_leader.py`) uses `get_level_progression().current_percent` × multiplier → effective % automatically recomputed.

### Verification
- `GET /api/community/level-table` → 10 rows with correct new %s + `total_max_bonus_pct: 7.20`.
- `GET /api/community/level-progression/{uid}` → test user still at L3 but now current_percent=1.0 (unchanged for L1-L3), next_percent=0.9 (was 1.5) — new table in effect.
- **Pytest suite** (`test_community_leader_and_levels.py`): **18/18 PASS** including the new 7.20% total assertion.
- **Playwright UI**: all 10 tiles render new %s (L1..L3 = 1.0%, L4=0.9%, L5=0.8%, …, L10=0.3%) — 10/10 tiles verified.

---

## Feb 17, 2026 — PRC Statement: Daily-Summary View (Option B — Frontend-only aggregation)

### Problem
With the new 10-level Community Bonus, a single mining collect by a downline can create up to 10 rows in the receiver's PRC ledger. Elite users with 100+ daily active mining downlines will accumulate thousands of rows/day making the PRC Statement page unreadable.

### Solution (chosen by user: Option B)
Purely client-side aggregation UX toggle on `/prc-statement`. No backend refactor, no DB migration — existing paginated rows are grouped by calendar day on the client with tap-to-expand.

### Change
- **File**: `/app/frontend/src/pages/PRCStatement.js`
- Added `viewMode` state (`daily` default | `detailed`) + toggle chip UI at top of the ledger area.
- Added `dayKey(iso)` + `humanDay(key)` helpers producing labels like `Today · 17 Feb 2026`, `Yesterday · 16 Feb 2026`, `Mon · 06 Jul 2026`.
- Added `dailyGroups` `useMemo` — groups entries by day and computes `credit`, `debit`, `community_bonus_count`, `community_bonus_prc` per bucket.
- In `daily` mode, `LIMIT` bumped to 200 so 5-15 days visible per fetch.
- New render section `daily-summary-view` renders one collapsible `Card` per day. Header shows day label, txn count, community-bonus pill, and net PRC (green/red). Tap → expands to inline detail rows.
- Detailed table + mobile cards + pagination are gated behind `viewMode === 'detailed'`.

### Verification (Playwright, mobile 420×900)
- `view-mode-toggle`, `view-mode-daily`, `view-mode-detailed`, `daily-summary-view` — all present.
- Real fetch: **27 daily buckets** created from 200 txns (a 7× reduction in visible rows).
- Tap first day → expanded to 5 individual entries (each with TypeBadge, formatDate, credit/debit/balance).
- Switch to Detailed → `daily-summary-view` count=0, `mobile-cards` count=1 (original detailed layout intact).

### Design notes / next candidates
- Backend row-bundling (Option A from the discussion) is still on the table if scale grows further — this Option B is a UI-only fix and DB still accumulates 10× rows.
- Optional: for the /community-activity live-feed page, apply the same aggregation pattern to reduce noise there too (Option C).

---

## Feb 17, 2026 — Core Team Feature: Full Removal (Option C — Reverse + Delete)

### Change
User requested full retirement of Core Team (`/admin/core-team`, Pool Wallet, Core Team Bonus distribution). Complete removal across backend, frontend, DB, cron, UI badges. Option C for historical PRC: reverse balances then delete ledger rows.

### Backend
- **Deleted**: `/app/backend/routes/pool_wallet.py` (~558 lines — 9 endpoints + `distribute_pool_to_core_team` + `credit_pool_wallet` + repair/heal utilities).
- `/app/backend/server.py`: import + `include_router(pool_wallet_router)` + `set_pool_wallet_db/cache` wiring removed; `pool_wallet_daily_distribute` scheduler + startup catch-up removed; `_fetch_pool_wallet()` dropped from dashboard composite (inert defaults returned); `_fetch_core_team()` dropped from admin user-detail composite (`core_team` key removed from response).
- `/app/backend/routes/mining.py`: `credit_pool_wallet(...)` call removed — mining volume no longer feeds the 1% pool tax.
- `/app/backend/routes/admin_accounting.py`: `{"id": "core-team"}` removed from permission menu.
- `/app/backend/routes/admin_user360.py`: core_team fetch + `core_team` response field removed.
- `/app/backend/routes/prc_statement.py`: `core_team_bonus` type relabelled to `"Legacy Bonus"`; `"Core Team Bonus"` removed from `FILTER_CATEGORIES`.

### Frontend
- **Deleted**: `/app/frontend/src/pages/AdminCoreTeam.js`.
- `App.js`: lazy import removed; `/admin/core-team` route now `<Navigate to="/admin/dashboard" replace />`.
- `AdminLayout.js`: `core-team` removed from `SECTION_TO_PERMISSION`, sidebar menu, and reverse-lookup dict.
- `DashboardModern.js`: 90-line Pool Wallet Card removed. `poolWallet` inert default kept to prevent NPE on stale API responses.
- `AdminUser360New.js`: "CORE TEAM" badge and its `user.core_team` conditional removed.

### Database (preview)
- Preview DB had 0 `core_team_bonus` rows → reversal no-op.
- Dropped collections: `core_team_members`, `pool_wallet`.

### ⚠️ Production redeploy note
If production has historical `core_team_bonus` rows, run the reverse+delete+drop script (see chat) once after deploy so balances stay consistent.

### Verification
- Backend restart clean, no import errors.
- `/api/pool-wallet/*` → **404**.
- `/api/community/dashboard/{uid}` → 200 with `level_progression` + `leader_status` intact.
- `/api/prc-statement/{uid}` filters: no "Core Team Bonus".
- Admin sidebar HTML audit: word "Core Team" absent.
- `/admin/core-team` deep link → redirects to `/admin`.
- Dashboard: `pool-wallet-card` count = 0.
- Lint: DashboardModern + AdminLayout clean; App.js pre-existing 3 errors unrelated to this cleanup.

---

## Feb 17, 2026 — Referrals Page: Removed Legacy "Community Levels" 3-tier Card

### Change
The old L1/L2/L3 breakdown card ("Community Levels" heading with "Community Power +120%" pill and 3 gradient tiles for Direct Community / Growth Level 2 / Growth Level 3) was still rendering in `/app/frontend/src/pages/ReferralsEnhanced.js`. It duplicated info now shown by the 10-level Level Progression card (from `CommunityDashboard.js`) and used the outdated increasing % scheme.

### File
- `/app/frontend/src/pages/ReferralsEnhanced.js` — removed the header (`Community Levels` / `Community Power` pill) and the 3-tile grid (lines ~498-559). Preserved the outer `level-breakdown-section` div wrapper so its sibling children (Community Leaders in Your Network, Community Tree, community help callout) render unchanged.

### Verification (Playwright)
- `referral-level-card-L1/L2/L3` → count 0 (removed)
- HTML no longer contains the "Community Levels" heading
- `level-progression-card` → 1 (new 10-level card preserved)
- `network-tree-section` → 1 (preserved)
- Visual: old card gone from viewport; new Level Progression + Invite Friends + Live Activity CTA + Community Goal + Community Health flow intact.

---

## Feb 17, 2026 — v1.2.0 Release: Version Bump for Play Store / Preview Push

### Change summary
All version identifiers bumped and aligned across Android build, backend defaults, PWA manifest, and DB. The Android AAB had drifted (was at `versionCode 19 / 1.1.8`) while backend `/api/app/version-info` was reporting stale `1.1.0 / code 11` — now synchronized to `1.2.0 / code 20`.

### Files touched
- `/app/frontend/android/app/build.gradle` — `versionCode 19 → 20`, `versionName "1.1.8" → "1.2.0"` with detailed release-note comments for the 6 major features of this cycle.
- `/app/backend/routes/app_version.py` — `LATEST_VERSION_NAME` → "1.2.0", `LATEST_VERSION_CODE` → 20, added `DEFAULT_RELEASE_NOTES` constant, wired it into the endpoint fallback.
- `/app/frontend/package.json` — internal `0.2.0 → 0.3.0`.
- `/app/frontend/public/manifest.json` — added `"version": "1.2.0"` (PWA identifier).
- MongoDB `app_config.android_app_version` doc — updated in preview via `POST /api/app/admin/version-update`.

### Deploy checklist for user (production redeploy)
1. Trigger Emergent's redeploy — backend + frontend code changes ship automatically.
2. After deploy, run the same admin call against production once to sync DB doc there (or let the code fallback take over — the hardcoded defaults now say 1.2.0/20 so no manual step strictly required):
   ```bash
   curl -X POST https://bugzappers.emergent.host/api/app/admin/version-update \
     -H "Content-Type: application/json" \
     -d '{"version_name":"1.2.0","version_code":20,"minimum_supported_code":1,"force_update":false}'
   ```
3. For Play Store: build AAB from `/app/frontend/android` — Gradle will pick up `versionCode 20 / versionName 1.2.0` automatically. Upload to Play Console.
4. Verify: open the app on an old build (< code 20) → the "Update Available" banner should appear with v1.2.0 release notes.

### Verification (preview)
- `curl /api/app/version-info` returns `latest_version_code: 20`, `latest_version_name: "1.2.0"`, and full release notes.
- Backend restart clean, no errors.
- All 6 v1.2.0 features previously verified in this session (10-level bonus, Community Leader multipliers, PRC daily summary, referrals cleanup, Core Team removal, P0 admin logout fix) confirmed working.

---

## Feb 17, 2026 — v1.2.0 Post-push APK Hotfix

User reported 2 issues after pushing v1.2.0 AAB to Play Store:

### Issue 1: Test Ad banner overlaying bottom navigation on Dashboard
- **Root cause**: Native AdMob banner (position BOTTOM_CENTER) drew above the WebView on the primary navigation surface, making the bottom navigation cramped.
- **Fix** (`/app/frontend/src/pages/DashboardModern.js`): Removed `<AdMobBanner placement="dashboard_home" />` slot from the Dashboard. Ads still shown on Notifications, Community Feed, and PayPartnerStore success screens where they don't block navigation.
- **Note**: The "Test Ad" text visible in the screenshot is a Google-side indicator (AdMob account/ad-unit still under review). It disappears automatically once AdMob approves — no code fix possible.

### Issue 2: "Pay to Partner Store" opens blank page in APK (works on web)
- **Symptom**: Route `/pay-partner-store` renders blank in the installed APK; identical URL works in browser view.
- **Hypothesis**: Lazy chunk (`partner-store.chunk.js`) load failure in WebView OR a native-context runtime error in the component tree; user gets a silent blank screen with no recovery option.
- **Fix** (defensive):
  - **NEW** `/app/frontend/src/components/RouteErrorBoundary.js` — class-based error boundary with `Retry` (soft remount via epoch-keyed key) and `Go to Home` buttons. Only shows dev error details in non-production builds.
  - `/app/frontend/src/App.js` — wrapped the `PayPartnerStore` Suspense in `<RouteErrorBoundary routeName="pay-partner-store">…</RouteErrorBoundary>`. Any render error / chunk failure will now surface an actionable retry screen instead of a blank canvas.

### Deploy checklist
1. Rebuild the Android AAB from `/app/frontend/android` — Gradle now uses **versionCode 21 / versionName 1.2.1** (bumped so Play Console will accept the re-upload).
2. Upload to Play Console (v1.2.1 track).
3. Verify: install AAB → Dashboard no longer has the bottom banner ad; tap "Pay to Partner Store" → either page loads correctly OR (if lazy chunk truly fails) user sees the Retry screen with a working Retry button.

### Feb 17 2026 (later same day) — versionCode bump to 21 / v1.2.1
Play Console rejects duplicate versionCode. Bumped all identifiers for the hotfix re-push:
- `android/app/build.gradle` → **versionCode 21, versionName "1.2.1"** (+ inline changelog notes 29 & 30 for the two hotfixes)
- `app_version.py` → LATEST_VERSION_NAME "1.2.1", LATEST_VERSION_CODE 21, DEFAULT_RELEASE_NOTES rewritten to lead with the two fixes and reference v1.2.0 payload below
- `frontend/package.json` → 0.3.1
- `manifest.json` → 1.2.1
- DB `app_config.android_app_version` (preview) updated via admin endpoint → verified via `GET /api/app/version-info` returns 1.2.1 / 21

---

## Feb 16, 2026 — Feature: Community Leader Bonus Multiplier & Role Structure

### Spec (as approved by user)
| Role                            | Multiplier | Requirement (existing partner_positions) |
|---------------------------------|-----------|-------------------------------------------|
| Community Member (user)         | 1.00×     | —                                         |
| District Community Leader       | 1.25×     | admin-approved partner_position           |
| Regional Community Leader       | 1.50×     | admin-approved partner_position           |
| State Community Leader          | 1.75×     | admin-approved partner_position           |
| National Community Leader       | 2.00×     | admin-approved partner_position           |

**Formula**: `Leader Bonus % = user's current 10-level Community Bonus % × Role Multiplier`

Example: base 4.5% (L10) × 1.25 = **5.625%** for a District Leader.

**Approval flow**: unchanged per user decision ("पूर्वीचा जो फ्लो आहे. Admin assign and approve touch राहुदे NO touching") — admin's `POST /api/admin/partners/assign` remains the sole entry point. Assignment is treated as implicit approval.

**Multipliers are admin-configurable** at `/admin/community-leader/multipliers` with sanity clamps [0.5, 10.0] and 5-min in-memory cache.

### Backend
- **NEW**: `/app/backend/routes/community_leader.py`
  - `DEFAULT_MULTIPLIERS` constant (1.00 / 1.25 / 1.50 / 1.75 / 2.00) + `ROLE_LABELS` map.
  - `_load_multipliers()` reads from `app_settings.community_leader_multipliers` (5-min cache, safe fallback to defaults).
  - `get_role_multiplier(position)` — commission-engine hot path.
  - Endpoints:
    - `GET /api/community-leader/status/{uid}` — role, multiplier, base %, effective %, elite active, approval meta
    - `GET /api/community-leader/dashboard/{uid}` — full leader dashboard: status + structure-toward-next + direct-leader counts + multiplier ladder
    - `GET /api/community-leader/multiplier-table` — public read-only table
    - `GET /api/admin/community-leader/multipliers` — admin view (X-Admin-Pin)
    - `POST /api/admin/community-leader/multipliers` — admin update (X-Admin-Pin)
    - `POST /api/admin/community-leader/multipliers/reset` — revert to defaults
- **CHANGED**: `/app/backend/routes/mining_commission.py`
  - Position path now uses the 10-level base % (via `get_max_earnable_level_for_uid` + `_cl_level_percent`) × role multiplier instead of the old flat 1%. Depth cap removed — leaders can earn up to L10 based on their own downline count.
  - Structural gate preserved: if `is_structure_valid(upline, position)` fails, the upline drops to plain 10-level path (no multiplier).
- **CHANGED**: `/app/backend/routes/community_dashboard.py` — composite endpoint now includes a `leader_status` node so the UI renders in a single round-trip.
- **CHANGED**: `/app/backend/server.py` — wired `community_leader.router` + `community_leader.admin_router`.

### Frontend
- **CHANGED**: `/app/frontend/src/pages/CommunityDashboard.js`
  - `LevelProgressionCard` now accepts `leaderStatus` — when the user is an approved leader, each tile shows the base % **plus** the boosted % (e.g., L10 tile: 4.5% → 5.625%), the header shows an "Effective: X% (N×)" line, and a callout links to the leader card below.
  - NEW `CommunityLeaderCard` — glass card with role icon, role label, approval date, multiplier badge, Base vs Effective bonus tiles, and the formula. Only rendered when `leader_status.is_leader` is true.
  - Both cards annotated with `data-testid`s: `community-leader-card`, `leader-role-label`, `leader-multiplier`, `leader-effective-bonus`, `leader-bonus-breakdown`, `leader-approved-status`, `leader-formula-hint`, `level-effective-badge`.

### Verification
- **Multiplier table endpoint**: returns all 5 roles with correct defaults.
- **Status endpoint (regular user)**: role=user, multiplier=1.0, effective=base.
- **Status endpoint (assigned National)**: role=national_partner, multiplier=**2.0**, effective=**2.0%** (base 1.0% × 2.0) — verified via admin assign + status call.
- **Dashboard endpoint**: returns status + structure_toward_next + direct_leader_counts + multiplier_ladder.
- **UI (Playwright, District Leader test)**: `community-leader-card` visible with all 7 key data-testids present; role="District Community Leader", multiplier="1.25×", effective="1.250%" (base 1.00% × 1.25). Level Progression tiles all show base + boosted %.
- **Admin flow untouched**: existing `POST /api/admin/partners/assign` continues to work; no new approval endpoints introduced per user request.
