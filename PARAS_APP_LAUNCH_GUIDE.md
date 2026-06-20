# PARAS REWARD — Android App Launch Guide

## 📦 What's Configured (Preview)

✅ **Capacitor 7** initialized (`com.parasreward.app`)
✅ **AdMob plugin** installed (`@capacitor-community/admob@7.2.0`)
✅ **AdMob App ID + 3 Ad Units** wired into AndroidManifest
✅ **App icon** + **splash screen** generated from logo (100 assets, all densities)
✅ **Release keystore** created (`android/keystores/paras-reward.keystore`)
✅ **Gradle release signing** configured (env-var driven)
✅ **React hook** `useAdMob` ready to call from any component

## 🔑 Keystore Credentials (KEEP SAFE!)

```
File:     /app/frontend/android/keystores/paras-reward.keystore
Alias:    paras-reward
Password: parasreward2026
Validity: 25 years (until ~2051)
SHA-256:  06:44:A2:F7:98:5F:D6:02:E9:EE:47:E7:61:9F:22:BD:CE:B9:89:BB:62:91:E3:E1:BD:87:52:21:B5:35:60:6E
```

**⚠️ WARNING**: हे keystore lose झाला तर तुम्ही Play Store वर app update करू शकणार नाही. एक backup secure ठिकाणी ठेवा!

## 📱 Ad Units (AdMob)

| Type | Unit ID | Use Case |
|---|---|---|
| App ID | `ca-app-pub-3556805218952480~1933993140` | App-level identifier |
| App Open | `ca-app-pub-3556805218952480/2186165856` | Show on app launch |
| Rewarded | `ca-app-pub-3556805218952480/7314369451` | "Watch ad → +PRC" rewards |
| Rewarded Interstitial | `ca-app-pub-3556805218952480/2377737544` | Collect button bonus |

## 🚀 Build AAB on Local Machine (Recommended)

The preview container lacks Android SDK. Build the signed AAB on your local Mac/PC:

### Prerequisites
- Android Studio (latest) OR Android command-line tools
- JDK 17
- Git

### Steps

```bash
# 1. Clone your repo
git clone <YOUR_GITHUB_REPO> paras-reward
cd paras-reward/frontend

# 2. Install dependencies + build React production bundle
yarn install
REACT_APP_BACKEND_URL=https://parasreward.com yarn build

# 3. Sync to Android
npx cap sync android

# 4. Set signing env vars
export PARAS_KEYSTORE_FILE=$(pwd)/android/keystores/paras-reward.keystore
export PARAS_KEYSTORE_PASSWORD=parasreward2026
export PARAS_KEY_ALIAS=paras-reward
export PARAS_KEY_PASSWORD=parasreward2026

# 5. Build signed AAB for Play Store
cd android
./gradlew bundleRelease

# Output:
# android/app/build/outputs/bundle/release/app-release.aab
```

### Upload to Play Console
1. https://play.google.com/console वर Sign in
2. Create app → Internal Testing → Upload `app-release.aab`
3. SHA-256 fingerprint **AdMob console** मध्ये register करायला विसरू नका

## 💻 Calling Ads from React

```jsx
import { useAdMob } from '../hooks/useAdMob';

function MiningWidget() {
  const { showRewarded } = useAdMob();

  const handleBonusClick = async () => {
    const { shown, reward } = await showRewarded();
    if (shown) {
      // User watched ad → call backend to credit PRC bonus
      await axios.post('/api/mining/ad-bonus', { uid });
    }
  };

  return <button onClick={handleBonusClick}>Watch ad for +10 PRC</button>;
}
```

For **App Open ad** — call `showAppOpen()` in App.js `useEffect` after auth check.

## 🏗️ Cloud Build Alternative (No Local Setup)

Use **Codemagic** / **EAS Build** / **Bitrise** free tier:
1. Connect GitHub repo
2. Set workflow: Capacitor Android
3. Upload keystore as secret file + add env vars
4. Trigger build → download AAB

## 🐛 Troubleshooting

| Issue | Fix |
|---|---|
| Build fails: "SDK location not found" | Set `ANDROID_HOME` env var OR create `local.properties` in `android/` |
| AdMob shows blank | Add device's test ID to AdMob console (Settings → Test Devices) |
| App crashes on launch | Check `adb logcat` — usually missing AdMob App ID in manifest |
| White screen | `REACT_APP_BACKEND_URL` not baked in → re-build with env var set |

## ✅ Pre-Launch Checklist

- [ ] AAB built & signed locally
- [ ] Test on real Android device (`adb install` debug APK first)
- [ ] AdMob test ads showing
- [ ] Production ads enabled (~ 1 hr after AAB live in Play Console)
- [ ] Privacy policy URL added in Play Console (required for ads)
- [ ] Internal testing track populated with 5-10 testers
- [ ] App icon + splash screen visible
- [ ] Production backend URL baked in (`parasreward.com`)
- [ ] Service worker version bumped to current

## 📞 Next Steps After Live

1. Monitor AdMob dashboard (impressions, eCPM, fill rate)
2. Add **Firebase Analytics** for user behavior tracking (P2)
3. Set up **Sentry** for crash reporting (P2)
4. Plan **deep links** for sharing referrals (P2)
