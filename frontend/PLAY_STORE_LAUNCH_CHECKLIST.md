# Play Store launch checklist

This app is configured for a user-only Play Store build with Capacitor Android.

## User-only web build

Build the React app without admin pages:

```bash
yarn install
yarn build:user
npx cap sync android
```

`REACT_APP_BUILD_TYPE=user` removes admin page imports from the production bundle and redirects `/admin/*` routes to `/dashboard`.
`npx cap sync android` must run before the Android bundle build because generated Capacitor files and copied web assets are intentionally git-ignored.

## Android App Bundle

The Android project targets API 35, which is required for new Play Store apps in 2026.

Set release-signing values through environment variables before building:

```bash
export PARAS_RELEASE_STORE_FILE=/secure/path/paras-reward.keystore
export PARAS_RELEASE_STORE_PASSWORD=...
export PARAS_RELEASE_KEY_ALIAS=paras-reward
export PARAS_RELEASE_KEY_PASSWORD=...
cd android
./gradlew bundleRelease
```

Do not commit keystores, passwords, or generated release bundles.

## Required manual checks before production

- Confirm `REACT_APP_BACKEND_URL` points to the production API.
- Confirm login, registration, dashboard, profile, KYC, subscription, referrals, support, and bank redeem flows on a physical Android device.
- Confirm Play Console Data safety, privacy policy, screenshots, app icon, and content rating are complete.
- Replace placeholder Digital Asset Links fingerprint in `public/.well-known/assetlinks.json` with the SHA-256 fingerprint of the Play/App Signing certificate if app links/TWA verification are used.
- Upload the generated `.aab` to Internal testing first, then promote only after review-device smoke testing passes.
