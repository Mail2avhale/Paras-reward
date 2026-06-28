# Android App Links Setup — Final SHA256 Step

## ⚠️ One-time Required Action

The `frontend/public/.well-known/assetlinks.json` file currently contains
**placeholder SHA256 fingerprints**. App Links will NOT verify until you
replace these with the real fingerprints from your signing keys.

## Step 1: Get the Upload Key SHA256 (from your keystore)

Run **locally** (where you have the keystore file):

```bash
keytool -list -v \
  -keystore /path/to/paras-reward.keystore \
  -alias <your-alias> \
  -storepass <your-password>
```

In the output, look for the line starting with `SHA256:` like:
```
SHA256: AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00
```

Copy this entire colon-separated hex string.

## Step 2: Get the Play App Signing SHA256 (from Play Console)

Google re-signs every AAB with their own key (called "Play App Signing"),
so the *production* fingerprint is different from your upload key:

1. Open https://play.google.com/console
2. Select **PARAS REWARD** app
3. Left sidebar: **Setup → App integrity** (or "App signing")
4. Look for **"App signing key certificate"** section
5. Copy the **SHA-256 certificate fingerprint** (colon-separated hex)

## Step 3: Paste BOTH into assetlinks.json

Edit `frontend/public/.well-known/assetlinks.json` and replace:
- `REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FROM_PLAY_CONSOLE` → the Step 2 value
- `REPLACE_WITH_UPLOAD_KEY_SHA256_FROM_KEYSTORE` → the Step 1 value

Both fingerprints MUST be present because:
- During development (sideload), the app is signed with the **upload key**
- On Play Store installs, the app is signed by Google with the **Play App Signing key**
- Including both fingerprints means App Links verify in both scenarios.

## Step 4: Deploy and Verify

1. Deploy frontend so `https://parasreward.com/.well-known/assetlinks.json` returns the new file (verify with `curl`).
2. Build a new AAB (versionCode bump already in place: 13 → 14).
3. After install, run:
   ```bash
   adb shell pm get-app-links com.parasreward.prc
   ```
   Status `verified` means App Links work — links to your domain will open
   the app directly instead of the browser chooser.

## Troubleshooting

- **Fingerprint format**: Use the colon-separated UPPERCASE hex, exactly as
  shown by keytool / Play Console. JSON strings, no quotes around colons.
- **Multiple lines**: If keytool wraps the fingerprint across lines, join
  them into one continuous string.
- **Cached verification**: After updating assetlinks.json on a deployed
  device, force re-verification:
  ```bash
  adb shell pm verify-app-links --re-verify com.parasreward.prc
  ```
