# PARAS REWARD - APK Build Guide

## Overview
This guide explains how to build an Android APK for the PARAS REWARD app. The app has been configured with Capacitor to wrap the React web app into a native Android application.

## Prerequisites

### Required Software
1. **Node.js 20+** (Already installed)
2. **Java Development Kit (JDK) 17+**
   ```bash
   # Check if installed
   java -version
   
   # If not installed (Ubuntu/Debian):
   sudo apt update
   sudo apt install openjdk-17-jdk
   
   # Set JAVA_HOME
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   ```

3. **Android Studio** (Recommended) OR **Android Command Line Tools**
   - Download from: https://developer.android.com/studio
   - Install Android SDK Platform 33 (Android 13)
   - Install Android SDK Build-Tools 33.0.0+

4. **Gradle** (Usually comes with Android Studio)

### Environment Variables
Add these to your `~/.bashrc` or `~/.zshrc`:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$PATH:$JAVA_HOME/bin
```

Then reload:
```bash
source ~/.bashrc
```

## Project Structure
```
/app/frontend/
├── android/                  # Native Android project (Capacitor)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── assets/public/  # Web app files
│   │   │   ├── AndroidManifest.xml
│   │   │   └── res/            # App icons, splash screens
│   │   └── build.gradle
│   ├── build.gradle
│   └── gradle/
├── build/                    # Production web build
├── src/                      # React source code
├── public/
├── capacitor.config.json     # Capacitor configuration
└── package.json
```

## Building Process

### Step 1: Build the Web App
```bash
cd /app/frontend
yarn build
```

This creates an optimized production build in the `build/` directory.

### Step 2: Sync with Capacitor
```bash
npx cap sync android
```

This copies the web build to the Android project.

### Step 3: Open in Android Studio (Recommended)
```bash
npx cap open android
```

This opens the Android project in Android Studio where you can:
- Build APK
- Build App Bundle (AAB)
- Run on emulator/device
- Sign the app
- Generate release builds

### Step 4: Build APK via Command Line

#### Debug APK (for testing)
```bash
cd /app/frontend/android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

#### Release APK (for production)
```bash
cd /app/frontend/android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

## Signing the APK (Required for Production)

### Generate Keystore
```bash
keytool -genkey -v -keystore paras-reward.keystore \
  -alias paras-reward \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### Configure Signing in build.gradle
Edit `/app/frontend/android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('paras-reward.keystore')
            storePassword 'YOUR_STORE_PASSWORD'
            keyAlias 'paras-reward'
            keyPassword 'YOUR_KEY_PASSWORD'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Build Signed APK
```bash
cd /app/frontend/android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk` (signed)

## Configuration

### App Configuration
Edit `/app/frontend/capacitor.config.json`:

```json
{
  "appId": "com.parasreward.app",
  "appName": "PARAS REWARD",
  "webDir": "build",
  "server": {
    "url": "https://mining-orders-sync.preview.emergentagent.com",
    "cleartext": true
  },
  "android": {
    "buildOptions": {
      "keystorePath": "paras-reward.keystore",
      "keystoreAlias": "paras-reward"
    }
  }
}
```

### Change App Icon
Replace these files in `/app/frontend/android/app/src/main/res/`:
- `mipmap-hdpi/ic_launcher.png` (72x72)
- `mipmap-mdpi/ic_launcher.png` (48x48)
- `mipmap-xhdpi/ic_launcher.png` (96x96)
- `mipmap-xxhdpi/ic_launcher.png` (144x144)
- `mipmap-xxxhdpi/ic_launcher.png` (192x192)

### Change App Name
Edit `/app/frontend/android/app/src/main/res/values/strings.xml`:
```xml
<resources>
    <string name="app_name">PARAS REWARD</string>
</resources>
```

### Permissions
Edit `/app/frontend/android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

## Testing

### Install Debug APK on Device
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### View Logs
```bash
adb logcat
```

### Uninstall
```bash
adb uninstall com.parasreward.app
```

## Troubleshooting

### Gradle Build Fails
```bash
cd /app/frontend/android
./gradlew clean
./gradlew assembleDebug --stacktrace
```

### Web Assets Not Loading
```bash
cd /app/frontend
yarn build
npx cap copy android
npx cap sync android
```

### Permissions Issues
Check `AndroidManifest.xml` and ensure all required permissions are declared.

### App Crashes on Launch
Check logcat:
```bash
adb logcat | grep -i "paras\|crash\|error"
```

## Production Checklist

- [ ] Build production web app (`yarn build`)
- [ ] Generate signed keystore
- [ ] Configure signing in `build.gradle`
- [ ] Update app version in `build.gradle`
- [ ] Replace app icons with branded icons
- [ ] Remove debug logging
- [ ] Test on multiple devices
- [ ] Build signed release APK
- [ ] Test signed APK installation
- [ ] Verify all features work offline/online
- [ ] Check app size (<50MB recommended)

## Deployment

### Google Play Store
1. Create a Google Play Console account
2. Create a new application
3. Upload the signed APK or App Bundle (AAB)
4. Fill in store listing details
5. Set up pricing and distribution
6. Submit for review

### Direct Distribution
1. Upload the signed APK to your server
2. Share the download link
3. Users must enable "Install from Unknown Sources"

## Version Management

Update version in `/app/frontend/android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        versionCode 1        // Increment for each release
        versionName "1.0.0"  // Semantic version
    }
}
```

## Build Commands Summary

```bash
# Complete build process
cd /app/frontend

# 1. Build web app
yarn build

# 2. Sync with Android
npx cap sync android

# 3. Build debug APK
cd android
./gradlew assembleDebug

# 4. Build release APK (signed)
./gradlew assembleRelease

# 5. Install on device
cd ..
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Notes

- The current configuration points to the preview URL. For production, update the `server.url` in `capacitor.config.json` to your production domain.
- The APK will be a WebView wrapper showing your web app. All business logic runs on the server.
- For better performance, consider implementing:
  - Offline caching with Service Workers
  - Native API integration for camera, notifications, etc.
  - Splash screen and app icons optimization

## Support

For issues:
1. Check Android Studio logs
2. Run `npx cap doctor` to diagnose configuration issues
3. Check Capacitor documentation: https://capacitorjs.com/docs
4. Check Android documentation: https://developer.android.com

---

**Current Status:**
- ✅ Capacitor installed and configured
- ✅ Android platform added
- ✅ Web app built successfully
- ✅ Assets synced to Android project
- ⏳ Ready for APK build (requires Android SDK)

**Next Steps:**
1. Install Android SDK and JDK
2. Run `./gradlew assembleDebug` from `/app/frontend/android/`
3. Find APK in `android/app/build/outputs/apk/debug/`
