# Android App Links — Auto-Setup ✅

## TL;DR — तुम्हाला काही करायचं नाही

`assetlinks.json` मध्ये SHA-256 fingerprints **GitHub Actions automatically populate करेल** प्रत्येक AAB build च्या वेळी. खाली description फक्त माहितीसाठी आहे.

---

## How it Works

प्रत्येक `.github/workflows/build-android.yml` run मध्ये (push to main किंवा manual dispatch):

1. **Step 7b: Auto-patch assetlinks.json**
   - GitHub-stored keystore (KEYSTORE_BASE64 secret) decode होतो
   - `keytool -list -v` ने upload key SHA-256 extract होतो
   - `frontend/public/.well-known/assetlinks.json` मध्ये automatic inject होतो
   - Git commit back होतो main branch वर (commit message: `chore(android): auto-update assetlinks.json [skip ci]`)

2. **Result:** Next frontend deploy मध्ये updated `assetlinks.json` live होतो — App Links autoVerify automatic काम करायला सुरू होतो.

---

## Required GitHub Secrets (आधीच set आहेत)

| Secret | Purpose | Status |
|---|---|---|
| `KEYSTORE_BASE64` | Encoded keystore | ✅ Set |
| `KEYSTORE_PASSWORD` | Keystore password | ✅ Set |
| `KEY_ALIAS` | Key alias name | ✅ Set |
| `KEY_PASSWORD` | Key password | ✅ Set |

---

## Optional: Play App Signing SHA-256 (for first-time enrolled apps)

जर तुम्ही Google Play App Signing वर enrolled असाल (most apps are), तर Google
अपलोड केलेलं AAB त्यांच्या स्वतःच्या key ने re-sign करतात. ती key चा SHA-256
**Play Console वर एकदाच दिसतो**.

**हे करायचं — फक्त एकदा (अनिवार्य नाही, पण recommended):**

1. https://play.google.com/console उघडा
2. **PARAS REWARD** app निवडा
3. Left sidebar: **Setup → App integrity** (किंवा "App signing")
4. **"App signing key certificate"** section मध्ये **SHA-256** copy करा (colon-separated hex)
5. GitHub repo च्या **Settings → Secrets and variables → Actions** मध्ये जा
6. **"New repository secret"** दाबा
7. Name: `PLAY_APP_SIGNING_SHA256`
8. Value: copy केलेला SHA-256 (just paste it as-is — colons included, no quotes)
9. Save

पुढच्या AAB build पासून workflow automatically हे fingerprint पण assetlinks.json
मध्ये include करेल. (Without it, App Links फक्त upload key signed builds वर
verify होतील — Play Store मधून install केलेले apps fail होतील.)

---

## Verification (after deploy)

Android device वर app install केल्यानंतर:

```bash
adb shell pm get-app-links com.parasreward.prc
```

Output मध्ये `parasreward.com` आणि `bugzappers.emergent.host` साठी **`verified`**
status दिसला पाहिजे. जर `none` किंवा `verification_failed` दिसलं तर:

```bash
adb shell pm verify-app-links --re-verify com.parasreward.prc
```

---

## Troubleshooting

**Q: Workflow fail झाला step 7b ला**
→ Logs बघा: keytool को alias किंवा password mismatch असेल. GitHub secrets check करा.

**Q: assetlinks.json commit नाही झाला (no push)**
→ workflow logs मध्ये `ℹ assetlinks.json unchanged — no commit needed.` दिसेल —
म्हणजे SHA already correct होता. Normal.

**Q: App Links work नाही करत device वर**
→ Most likely `PLAY_APP_SIGNING_SHA256` secret set केला नाही, आणि app Play
Store वरून install केलेला आहे. Step वरील "Optional" section follow करा.
