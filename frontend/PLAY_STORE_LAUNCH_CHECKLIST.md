# Paras Reward — Play Store Launch Checklist

> Goal: Launch the **user-only** Android build to Google Play Internal Testing
> first, then Closed → Open → Production.
>
> This checklist mirrors Google's launch requirements as of **Aug 31, 2026**
> (target SDK 35 deadline) and Play Console Data Safety / signing / privacy
> rules.

---

## 0. Pre-launch Snapshot (auto-tracked)

| Item | Value | Source |
|---|---|---|
| App ID | `com.parasreward.app` | `android/app/build.gradle` |
| Version Code | `2` | `android/app/build.gradle` |
| Version Name | `1.0.1` | `android/app/build.gradle` |
| Compile SDK | `35` (Android 15) | `android/variables.gradle` |
| Target SDK | `35` (Android 15) | `android/variables.gradle` |
| Min SDK | `22` (Android 5.1) | `android/variables.gradle` |
| Gradle | `8.10.2` | `gradle/wrapper/gradle-wrapper.properties` |
| Android Gradle Plugin | `8.7.2` | `android/build.gradle` |
| Backend URL | `<read REACT_APP_BACKEND_URL>` | `frontend/.env` |

---

## 1. Build Pipeline (run in this exact order)

```bash
# From /app/frontend
yarn install --frozen-lockfile
yarn build:user                # admin pages excluded by REACT_APP_BUILD_TYPE=user
npx cap sync android           # copies build/ into android/app/src/main/assets/public

cd android
# Sanity check that gradle wrapper works
./gradlew --version

# Smoke-test compile (no signing required)
./gradlew assembleDebug

# Production AAB (must have signing env vars set — see §2)
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 2. Release Signing (env-vars only — keystore stays out of repo)

Before running `./gradlew bundleRelease`, export these in your shell or CI:

```bash
export PARAS_KEYSTORE_FILE="/secure/path/paras-release.jks"
export PARAS_KEYSTORE_PASSWORD="********"
export PARAS_KEY_ALIAS="paras-release"
export PARAS_KEY_PASSWORD="********"
```

If env vars are absent, the release build silently falls back to **debug
signing** — useful for CI smoke runs but **NEVER upload that AAB to Play**.

### Generate keystore once (if you don't have one yet)

```bash
keytool -genkey -v \
  -keystore paras-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias paras-release
```

Store the `.jks` file in a password manager / 1Password vault. Losing it
means you can never push updates to the same Play listing — Google does
NOT allow re-uploading with a different key.

> **Recommended**: Enroll in [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
> on first upload. Google holds the production key; you only manage the upload
> key. Lost upload key can be reset; lost production key cannot.

---

## 3. assetlinks.json (Digital Asset Links) — TWA / deep links

After enrolling in Play App Signing, copy the **App signing key SHA-256**
fingerprint from Play Console → Setup → App Integrity → App signing key
certificate, and paste into:

```
frontend/public/.well-known/assetlinks.json
                 → "sha256_cert_fingerprints": ["XX:XX:..."]
```

Verify after deploy:

```bash
curl -sS https://<your-prod-domain>/.well-known/assetlinks.json | jq .
```

The package name MUST match `com.parasreward.app`.

---

## 4. Play Console — Data Safety / Privacy / Content

- [ ] Privacy Policy URL filled in Play Console (link to a PUBLIC, working URL)
- [ ] Data Safety form completed:
  - [ ] Personal info collected: Name, Email, Phone, Address (KYC), Photos (KYC)
  - [ ] Financial info collected: Bank account, UPI ID, transaction history
  - [ ] Encrypted in transit: ✅ (HTTPS)
  - [ ] Users can request data deletion: ✅ (link in app + email)
  - [ ] Independent security review? (optional but boosts trust)
- [ ] Content rating questionnaire submitted
- [ ] Target audience: 18+ (financial app)
- [ ] App category: **Finance**
- [ ] Tags: Rewards, UPI, Bill Payments
- [ ] App access: All features **available without login** for review? → No (gated). Provide reviewer credentials in "App access" section.

### Reviewer test credentials to upload

| Field | Value |
|---|---|
| Email | `reviewer@parasreward.com` (create + KYC pre-approve before submission) |
| Password | `<set strong password>` |
| Notes | "Reviewer account already KYC-approved. PRC balance is preloaded so all redeem flows can be tested." |

---

## 5. Required Store Listing Assets

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG, 32-bit | ⬜ |
| Feature graphic | 1024×500 PNG/JPG | ⬜ |
| Phone screenshots | 2-8 images, 16:9 or 9:16, ≥ 1080 px | ⬜ |
| 7" tablet screenshots (optional) | 2-8 images | ⬜ |
| 10" tablet screenshots (optional) | 2-8 images | ⬜ |
| Short description | ≤ 80 chars | ⬜ |
| Full description | ≤ 4000 chars | ⬜ |
| Promo video (optional) | YouTube URL | ⬜ |

---

## 6. Pre-Launch Smoke Test Plan (physical device only)

Run on a real Android phone (Android 5.1+). Avoid emulators for first pass.

- [ ] Cold start → splash → login screen renders < 3 s
- [ ] **Register** new user with mobile + OTP
- [ ] **Login** with existing test credentials (admin@test.com / 153759)
- [ ] **Dashboard** loads, PRC balance & subscription status correct
- [ ] **Profile** edit name, email, address — saves successfully
- [ ] **KYC** upload Aadhaar/PAN images — both upload + verify
- [ ] **Subscription** purchase Elite via PRC → 7-day cooldown enforced
- [ ] **Mining / Tap Game** earns PRC
- [ ] **Referrals** copy referral link → share via WhatsApp
- [ ] **Bank Redeem** (full flow) — bank details → request → success toast
- [ ] **Bill Payment** (mobile recharge) — success
- [ ] **Notifications** push received (test FCM if configured)
- [ ] **Logout → Re-login** session persists
- [ ] **Offline mode** graceful error (no white screen)
- [ ] **Deep links** `https://<prod-domain>/login` opens in app (TWA)
- [ ] **Back button** behaves correctly (no double-back exit issues)
- [ ] **Permissions** Camera (KYC) + Storage prompts only when needed

---

## 7. Pre-launch Report (Play Console)

After upload, Play runs an **automatic 5-min crawl** on real devices and
returns a Pre-launch Report with:

- Crash issues
- Performance (ANR, slow start, frame drops)
- Accessibility issues (low contrast, missing labels)
- Security warnings (unencrypted HTTP, exposed secrets)

**Do NOT promote to Production until Pre-launch Report is GREEN.**

---

## 8. Track Promotion Path

```
Internal Testing  →  Closed Testing (50 trusted users)
                  →  Open Testing (public beta, opt-in via link)
                  →  Production (staged rollout 5% → 20% → 50% → 100%)
```

Stay on Internal for **at least 7 days**. Stay on Open for **at least 14 days**
to surface issues at scale before full Production rollout.

---

## 9. Post-launch Monitoring (Day 1 → Week 2)

- [ ] Crashlytics / Sentry dashboard checked daily
- [ ] Play Console "Vitals" → ANR rate < 0.47%, Crash rate < 1.09% (Google's bad-behaviour thresholds)
- [ ] Backend error monitor (`/admin/error-monitor`) reviewed for new 500s
- [ ] User reviews on Play monitored & responded within 24h
- [ ] Conversion funnel (install → register → first PRC earn) measured

---

## 10. Things This Environment CANNOT Verify

These steps require a workstation outside the agent's container:

- ❗ Final AAB build (`./gradlew bundleRelease`) — needs Node/Yarn installed
- ❗ Real device smoke test (§6) — needs physical Android phone
- ❗ Play Console submission — needs Google Play Developer account ($25 one-time)
- ❗ Play App Signing enrollment — first-upload step
- ❗ FCM key configuration (if using push notifications)

---

## 11. Quick Pass/Fail Gate (before clicking "Submit for Review")

| Check | Pass? |
|---|---|
| AAB signed with release key (not debug)? | ⬜ |
| `targetSdk >= 35`? | ✅ (set to 35 in this PR) |
| `assetlinks.json` package_name matches `com.parasreward.app`? | ✅ (fixed in this PR) |
| `assetlinks.json` SHA256 fingerprint is REAL (not placeholder)? | ⬜ |
| Privacy Policy URL is public + reachable? | ⬜ |
| Data Safety form submitted? | ⬜ |
| Content rating completed? | ⬜ |
| Reviewer credentials filled in App Access? | ⬜ |
| Pre-launch Report GREEN? | ⬜ |
| Crash test on real device < 1% rate? | ⬜ |

---

_Last updated: This file is auto-generated by the build pipeline. Re-run
the launch script to refresh values._
