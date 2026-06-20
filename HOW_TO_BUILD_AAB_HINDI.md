# PARAS REWARD — AAB Build Step-by-Step Guide (Non-Technical)

> **Goal**: तुमच्या Mac/Windows/Linux computer वर एक Play Store ready AAB file तयार करायची.
> **Time**: पहिल्यांदा ~45-60 min, पुढे प्रत्येक update फक्त ~10 min.

---

## ✅ AUDIT REPORT (Preview मध्ये सर्व ready आहे)

| Check | Status |
|---|---|
| Capacitor 7 configured | ✅ |
| AdMob plugin installed (v7.2.0) | ✅ |
| All 4 plugins synced (AdMob, App, Browser, SplashScreen) | ✅ |
| AdMob App ID in Manifest | ✅ |
| Permissions (INTERNET, AD_ID, NETWORK_STATE) | ✅ |
| Release signing config (env-var driven) | ✅ |
| ProGuard rules for AdMob + Capacitor | ✅ 74 lines |
| Keystore generated (25 year validity) | ✅ 2.7 KB |
| App icons (6 densities) | ✅ |
| Splash screens (26 variants) | ✅ |
| versionCode = 2, versionName = "1.0.1" | ✅ |
| Update Banner component active | ✅ |

**कुठलाही component miss नाही. AAB build 100% ready आहे.**

---

# 📋 STEP-BY-STEP GUIDE

## STEP 1️⃣ — आपल्या Computer वर Tools Install करा

### Mac वर (recommended)
```bash
# Homebrew install करा (आधीच नसेल तर)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Java 17 + Android Studio
brew install openjdk@17
brew install --cask android-studio
```

### Windows वर
1. Java 17 download: https://adoptium.net/temurin/releases/?version=17
2. Android Studio download: https://developer.android.com/studio
3. Both install करा (Next, Next, Finish click करत)

### Linux वर
```bash
sudo apt install openjdk-17-jdk
# Android Studio: https://developer.android.com/studio वरून tarball download
```

**Verify**: Terminal/Command Prompt उघडा:
```bash
java -version    # Should print "openjdk 17..."
```

---

## STEP 2️⃣ — Android Studio Setup (एकदाच करायचंय)

1. **Android Studio launch** करा
2. पहिल्यांदा open करताना **"Download SDK"** wizard दिसेल → सर्व **Accept + Next** click करा
3. Wait करा 5-10 मिनिटे (SDK download ~3GB)
4. **Done** click झाल्यावर Android Studio बंद करा

---

## STEP 3️⃣ — आपला Code GitHub वरून Download

```bash
# Computer वर एक folder निवडा (e.g. ~/projects)
cd ~/Desktop

# GitHub repo clone करा (तुमचा repo URL वापरा)
git clone https://github.com/<YOUR-USERNAME>/<YOUR-REPO>.git paras-reward

cd paras-reward/frontend
```

> **Note**: GitHub URL तुमच्या Emergent platform "Save to GitHub" feature नंतर मिळेल.

---

## STEP 4️⃣ — Dependencies Install

```bash
yarn install
```

Wait करा 2-3 मिनिटे. Done message दिसेपर्यंत.

---

## STEP 5️⃣ — Production Build तयार करा

```bash
# Production backend URL set करून build (https://parasreward.com)
REACT_APP_BACKEND_URL=https://parasreward.com yarn build
```

5-10 मिनिटे लागतील. शेवटी "Compiled successfully" आले की OK.

---

## STEP 6️⃣ — Capacitor Sync

```bash
npx cap sync android
```

10-30 seconds. Output मध्ये **"Sync finished"** दिसले की OK.

---

## STEP 7️⃣ — Signing Environment Variables Set करा

**Mac/Linux**:
```bash
export PARAS_KEYSTORE_FILE=$(pwd)/android/keystores/paras-reward.keystore
export PARAS_KEYSTORE_PASSWORD=parasreward2026
export PARAS_KEY_ALIAS=paras-reward
export PARAS_KEY_PASSWORD=parasreward2026
```

**Windows (PowerShell)**:
```powershell
$env:PARAS_KEYSTORE_FILE = "$pwd\android\keystores\paras-reward.keystore"
$env:PARAS_KEYSTORE_PASSWORD = "parasreward2026"
$env:PARAS_KEY_ALIAS = "paras-reward"
$env:PARAS_KEY_PASSWORD = "parasreward2026"
```

---

## STEP 8️⃣ — AAB Build करा 🎉

```bash
cd android
./gradlew bundleRelease       # Mac/Linux
# OR
gradlew.bat bundleRelease     # Windows
```

**पहिल्यांदा** ~10-20 min (Gradle dependencies download).
**पुढे** ~2-3 min.

**Output file**:
```
/Users/your-name/Desktop/paras-reward/frontend/android/app/build/outputs/bundle/release/app-release.aab
```

**याच file ला Play Store वर upload करायचंय!**

---

## STEP 9️⃣ — Play Store वर Upload

1. https://play.google.com/console वर sign in
2. **Create app** click करा (पहिल्यांदा):
   - App name: **PARAS REWARD**
   - Default language: Marathi
   - App / Game: **App**
   - Free / Paid: **Free**
   - Declarations check करा
3. **Internal testing** track निवडा (पहिल्यांदा testing साठी)
4. **Create new release** click करा
5. `app-release.aab` file upload करा
6. **Release name**: `1.0.1` (auto-detected)
7. **Release notes** लिहा (e.g. "Paras Mall launch + Daily mining rewards")
8. **Next** → **Review** → **Start rollout to Internal testing**

✅ ~30-60 min मध्ये Internal testing वर live!

---

## 🔄 NEXT TIME (Updates झाले की)

प्रत्येक नवीन version साठी:

1. `android/app/build.gradle` मध्ये **versionCode बदला** (e.g. 2 → 3) + versionName (e.g. 1.0.2)
2. **Step 5-8 परत** चालवा
3. Play Console → **Production track** → Release upload
4. Backend admin call (banner trigger साठी):
   ```bash
   curl -X POST https://parasreward.com/api/app/admin/version-update \
     -H "Content-Type: application/json" \
     -d '{"version_name":"1.0.2","version_code":3,"release_notes":"New features..."}'
   ```

Users automatically "UPDATE" banner पाहतील!

---

## 🆘 SOS — काही Issue आला तर

| Error | Fix |
|---|---|
| `JAVA_HOME not set` | Mac: `export JAVA_HOME=$(/usr/libexec/java_home -v 17)`<br>Windows: System Environment → JAVA_HOME = JDK path |
| `SDK location not found` | Android Studio → SDK Manager → Note path → `android/local.properties` मध्ये लिहा: `sdk.dir=/path/to/sdk` |
| `Could not find @capacitor/app` | `yarn install` परत चालवा |
| `Keystore was tampered with` | Password चुकीचा. **parasreward2026** बरोबर typing करा |
| Permission denied (gradlew) | `chmod +x android/gradlew` |
| AdMob ads blank/error | App Play Store वर live झाल्यावर **~1 तास** लागतो ads activate व्हायला |

---

## 📦 आजपर्यंत तुमचे झालेले Setup

✅ AdMob खाते linked: `ca-app-pub-3556805218952480~1933993140`
✅ 3 Ad Units: App Open + Rewarded + Rewarded Interstitial
✅ Keystore: `android/keystores/paras-reward.keystore`
✅ Keystore Password: **parasreward2026** (हे कधीच विसरू नका!)
✅ App Package: `com.parasreward.app`
✅ App Name: **PARAS REWARD**
✅ Production Backend: https://parasreward.com
✅ Update Banner (auto-detects new versions)

---

## ⚠️ CRITICAL WARNINGS

1. **Keystore file lose करू नका**! एकदा Play Store वर upload केलं की कधीच बदलता येणार नाही (नवीन keystore = users ला app update करता येणार नाही).
2. **Password**: `parasreward2026` हा password Notes/secure place वर लिहून ठेवा.
3. **SHA-256 Fingerprint** Play Console + AdMob console दोन्हीकडे add करायला विसरू नका:
   ```
   06:44:A2:F7:98:5F:D6:02:E9:EE:47:E7:61:9F:22:BD:CE:B9:89:BB:62:91:E3:E1:BD:87:52:21:B5:35:60:6E
   ```
4. **Privacy Policy URL** Play Console वर add करावा लागेल (ads साठी mandatory). Free generator: https://app-privacy-policy-generator.firebaseapp.com

---

## 🎯 तुमच्या Hand साठी Quick Cheatsheet

```
1. yarn install
2. REACT_APP_BACKEND_URL=https://parasreward.com yarn build
3. npx cap sync android
4. export PARAS_KEYSTORE_FILE=$(pwd)/android/keystores/paras-reward.keystore
   export PARAS_KEYSTORE_PASSWORD=parasreward2026
   export PARAS_KEY_ALIAS=paras-reward
   export PARAS_KEY_PASSWORD=parasreward2026
5. cd android && ./gradlew bundleRelease
6. Upload android/app/build/outputs/bundle/release/app-release.aab to Play Console
```

**सर्व काही तयार आहे!** कुठेही अडकलात तर मला screenshot सोबत message करा.
