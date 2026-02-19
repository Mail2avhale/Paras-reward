# PARAS REWARD - Play Store AAB Creation Guide
## Step-by-Step Instructions (Marathi & English)

---

## 📱 Method 1: PWABuilder (सर्वात सोपे / Easiest)

### Step 1: PWABuilder Website वापरा

1. **Browser मध्ये जा:** https://www.pwabuilder.com/
2. **URL टाका:** `https://parasreward.com`
3. **"Start" बटण दाबा**

### Step 2: Analysis पूर्ण होऊ द्या

- PWABuilder तुमची website scan करेल
- Manifest, Service Worker, Icons check होतील
- Score दिसेल (80+ असावे)

### Step 3: Android Package तयार करा

1. **"Package for stores" वर क्लिक करा**
2. **"Android" निवडा**
3. **Options भरा:**
   - Package ID: `com.parasreward.app`
   - App Name: `PARAS REWARD`
   - Version: `1.0.0`
   - Version Code: `1`

### Step 4: Signing Key तयार करा

⚠️ **महत्त्वाचे:** ही key कायमसाठी जपून ठेवा! हरवली तर app update करता येणार नाही!

1. **"Let PWABuilder create a new signing key" निवडा**
2. **किंवा** Android Studio मध्ये स्वतः तयार करा:
   ```bash
   keytool -genkey -v -keystore paras-reward.keystore -alias paras-reward -keyalg RSA -keysize 2048 -validity 10000
   ```

### Step 5: AAB Download करा

1. **"Generate" बटण दाबा**
2. **ZIP file download होईल**
3. **त्यात `.aab` file असेल**

---

## 📱 Method 2: Bubblewrap CLI (Advanced)

### Prerequisites:
```bash
# Node.js install असणे आवश्यक
npm install -g @anthropic/anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@anthropic/anthropic@bubblewrap/cli

# Android SDK install असणे आवश्यक
# Java JDK 11+ install असणे आवश्यक
```

### Create TWA Project:
```bash
# Initialize project
bubblewrap init --manifest https://parasreward.com/manifest.json

# Build AAB
bubblewrap build
```

---

## 🔐 Digital Asset Links Setup (महत्त्वाचे!)

AAB तयार केल्यानंतर, तुम्हाला SHA256 fingerprint मिळेल. 

### Step 1: SHA256 Fingerprint मिळवा

AAB sign केल्यानंतर:
```bash
keytool -list -v -keystore paras-reward.keystore -alias paras-reward
```

### Step 2: assetlinks.json update करा

Website वर `/public/.well-known/assetlinks.json` file update करा:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.parasreward.app",
      "sha256_cert_fingerprints": [
        "YOUR_SHA256_FINGERPRINT_HERE"
      ]
    }
  }
]
```

### Step 3: Website Deploy करा

assetlinks.json update केल्यानंतर website deploy करा.

**Verify करा:** https://parasreward.com/.well-known/assetlinks.json

---

## 📊 AdMob Integration

### Step 1: AdMob Account Setup

1. https://admob.google.com/ वर जा
2. New App तयार करा:
   - Platform: Android
   - App Name: PARAS REWARD
   - Is your app listed?: No (first time)

### Step 2: Ad Unit IDs मिळवा

1. **Banner Ad:** Dashboard मध्ये दाखवण्यासाठी
2. **Interstitial Ad:** Level complete किंवा screen transition साठी
3. **Rewarded Ad:** Extra PRC points साठी

### Step 3: App ID आणि Ad Unit IDs लक्षात ठेवा

```
App ID: ca-app-pub-3556805218952480~XXXXXXXXXX
Banner: ca-app-pub-3556805218952480/XXXXXXXXXX
Interstitial: ca-app-pub-3556805218952480/XXXXXXXXXX
Rewarded: ca-app-pub-3556805218952480/XXXXXXXXXX
```

### Step 4: PWABuilder मध्ये AdMob Settings

PWABuilder मध्ये Android options मध्ये:
- "Enable AdMob monetization" check करा
- App ID टाका
- Ad Unit IDs टाका

---

## 📤 Play Store Upload

### Step 1: Play Console Login

1. https://play.google.com/console वर जा
2. तुमच्या Developer Account मध्ये login करा

### Step 2: New App तयार करा

1. **"Create app"** बटण दाबा
2. **App details भरा:**
   - App name: PARAS REWARD
   - Default language: English (India) - en-IN
   - App or Game: App
   - Free or Paid: Free
   - Declarations: Check all boxes

### Step 3: Store Listing तयार करा

1. **App icon:** 512x512 PNG (High-res)
2. **Feature graphic:** 1024x500 PNG
3. **Screenshots:** 
   - Phone: 2-8 screenshots (recommended: 4)
   - Tablet: Optional
4. **Short description:** 80 characters
5. **Full description:** 4000 characters max

### Step 4: AAB Upload करा

1. **Production** track मध्ये जा
2. **"Create new release"** दाबा
3. **AAB file upload करा**
4. **Release notes लिहा**

### Step 5: Content Rating भरा

1. **Start questionnaire** वर क्लिक करा
2. **Category:** Utility / Entertainment
3. **Questions:** सर्व प्रश्नांची उत्तरे द्या
4. **Rating मिळेल** (PEGI, ESRB, etc.)

### Step 6: App Content भरा

1. **Privacy Policy URL:** https://parasreward.com/privacy-policy
2. **App Category:** Lifestyle / Entertainment
3. **Contact details:** Email, phone
4. **Data safety:** Fill form

### Step 7: Review साठी Submit करा

1. सर्व sections पूर्ण करा (green checkmarks)
2. **"Submit for review"** दाबा
3. **Review time:** 1-7 days

---

## ⚠️ महत्त्वाची माहिती

### Signing Key बद्दल:
- **कधीही हरवू नका!** 
- Backup ठेवा (Google Drive, USB drive)
- Password लक्षात ठेवा

### AdMob Policy:
- कमीत कमी 3 ad units वापरा
- Content योग्य असावे
- Invalid clicks टाळा

### Updates:
- App update करताना same signing key वापरा
- Version code वाढवा (1 → 2 → 3...)

---

## 📞 Help

काही प्रश्न असल्यास:
- PWABuilder Documentation: https://docs.pwabuilder.com/
- Play Console Help: https://support.google.com/googleplay/android-developer/

---

**तयार झाल्यावर मला सांगा, मी पुढची मदत करतो!** 🚀
