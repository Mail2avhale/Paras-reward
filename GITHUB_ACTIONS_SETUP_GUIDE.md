# GitHub Actions Auto-Build Setup (Non-Technical Guide)

> Code GitHub वर push → automatic AAB build → Play Store वर upload.
> तुम्हाला कुठलाही command चालवायची गरज नाही!

---

## ✅ काय करायचंय

3 things:
1. **Keystore + Passwords** GitHub Secrets वर store करायचे (एकदाच)
2. **Google Play Service Account** तयार करायचा (एकदाच) — auto-upload साठी
3. **Workflow trigger** — code push किंवा GitHub button click

**Total time**: एकदाच ~20-30 min setup. नंतर प्रत्येक build फक्त 1 click.

---

## 🔐 STEP 1 — GitHub Secrets Add करा

### Why?
तुमचा keystore + password GitHub Actions ला हवा आहे, पण code मध्ये plain text मध्ये ठेवायचा नाही (security risk). म्हणून **Secrets** वापरतो.

### Steps

1. तुमचा GitHub repo open करा
2. **Settings** tab click करा (top right)
3. Left sidebar मध्ये → **Secrets and variables** → **Actions**
4. **"New repository secret"** button click करा
5. खालील 5 secrets add करा एक-एक करून:

#### Secret 1: `KEYSTORE_BASE64`
- **Name**: `KEYSTORE_BASE64`
- **Value**: (खाली दिलेला long base64 string copy-paste करा)

📋 **Keystore Base64 String** (हे संपूर्ण copy करा — एका line मध्ये):

> File location: `/app/frontend/android/keystores/keystore.base64`
> 3,696 characters long. Code editor मध्ये उघडून पूर्ण copy करा.

#### Secret 2: `KEYSTORE_PASSWORD`
- **Name**: `KEYSTORE_PASSWORD`
- **Value**: `parasreward2026`

#### Secret 3: `KEY_ALIAS`
- **Name**: `KEY_ALIAS`
- **Value**: `paras-reward`

#### Secret 4: `KEY_PASSWORD`
- **Name**: `KEY_PASSWORD`
- **Value**: `parasreward2026`

#### Secret 5: `REACT_APP_BACKEND_URL`
- **Name**: `REACT_APP_BACKEND_URL`
- **Value**: `https://parasreward.com`

✅ **First-time setup done!** आता auto-build ready आहे. (Play Store auto-upload हवा असेल तर STEP 2 करा.)

---

## 🤖 STEP 2 — Google Play Service Account (Auto-Upload हवा असेल तरच)

### Why?
Code push नंतर AAB **automatically Play Store वर upload** करण्यासाठी एक service account तयार करावा लागतो.

> ⚠️ हे **optional** आहे. Skip करायचं असेल तर AAB GitHub Artifacts मधून download करून manually upload करा.

### Sub-steps

#### A. Google Cloud Project (5 min)
1. https://console.cloud.google.com वर sign in
2. वरच्या project dropdown वरून **"New Project"** click
3. Project name: `Paras Reward Mobile`
4. **Create** click

#### B. Service Account तयार करा (5 min)
1. Left menu → **IAM & Admin** → **Service Accounts**
2. **+ CREATE SERVICE ACCOUNT** click
3. **Service account name**: `play-store-uploader`
4. **Create and continue** → **Done**
5. Created account list मध्ये दिसेल → ⋮ menu → **Manage keys**
6. **ADD KEY** → **Create new key** → **JSON** → **Create**
7. एक JSON file download होईल — हे जपून ठेवा!

#### C. Play Console वर Service Account Link करा (5 min)
1. https://play.google.com/console वर sign in
2. Left menu → **Setup** → **API access**
3. **Choose a project to link** → तुमचा Google Cloud project select करा → **Link**
4. Service accounts list मध्ये `play-store-uploader` दिसेल
5. **Grant access** click करा त्या account समोर
6. **Account permissions**:
   - **App access**: `PARAS REWARD` (तुमचा app)
   - **Releases**: Release to **testing tracks**, Release to **production**
7. **Invite user** click

#### D. GitHub Secret मध्ये Service Account JSON Add करा
1. JSON file तुमच्या computer वर उघडा (text editor मध्ये)
2. संपूर्ण content copy करा (`{` पासून `}` पर्यंत)
3. GitHub repo → Settings → Secrets → New secret:
   - **Name**: `PLAY_SERVICE_ACCOUNT_JSON`
   - **Value**: (paste the full JSON)
4. **Add secret**

---

## 🎬 STEP 3 — Build Trigger करा!

### Method A: Manual Build (Recommended पहिल्यांदा)

1. GitHub repo → **Actions** tab click
2. Left side → **"Build Android AAB"** workflow click
3. Right side वर **"Run workflow"** button click
4. **Track** dropdown:
   - `none` = फक्त build (Play Store upload नाही — testing साठी best)
   - `internal` = Internal testing वर auto-upload
   - `alpha` / `beta` = open testing tracks
   - `production` = Production वर live (careful!)
5. **Run workflow** button click करा

### Build Progress बघा
- Workflow सुरू झालं की 🟡 yellow circle दिसेल
- ~10-15 min मध्ये पूर्ण होईल
- 🟢 Green = success | 🔴 Red = error

### AAB Download कशी करायची
1. Successful workflow run click करा
2. Page च्या तळाशी **"Artifacts"** section दिसेल
3. **`paras-reward-release-aab`** download click करा
4. ZIP extract करा → आत `app-release.aab` file मिळेल
5. हीच file Play Console वर upload करा (track=`none` होतं तर)

### Method B: Auto Build on Code Push
- कोणीही `main` branch वर push केलं की workflow automatically सुरू होतं
- `frontend/` folder मधल्या file changes detect होतात
- AAB Artifacts मध्ये दिसते (Play Store upload नाही — manual trigger needed)

---

## 📊 Workflow काय करतो?

```
1. Code download   (GitHub वरून)
2. Java 17 install
3. Node.js 20 install
4. Android SDK install
5. Yarn install dependencies
6. React production build (REACT_APP_BACKEND_URL set)
7. Capacitor Android sync
8. Keystore restore (from base64 secret)
9. Gradle bundleRelease (signed AAB build)
10. AAB upload as artifact
11. (Optional) Upload to Play Store via service account
```

Total: ~10-15 minutes per build.

---

## 🆘 Common Errors

| Error | Fix |
|---|---|
| "KEYSTORE_BASE64 not found" | Secret name typo. Exactly `KEYSTORE_BASE64` (case-sensitive) |
| "ANDROID_HOME not set" | Workflow file itself install करते — re-run try करा |
| "Bundletool failed" | Keystore password चुकीचा. `KEYSTORE_PASSWORD` secret check करा |
| "Service account not authorized" | Play Console → API Access → Service account permissions verify करा |
| "Track not allowed" | Service account ला त्या track ची permission नाही — Step 2C revisit |
| Workflow doesn't trigger on push | `frontend/` folder मध्ये file change पाहिजे (path filter) |

---

## 🎯 Quick Summary (For Daily Use)

After one-time setup, your workflow:

1. **Code change** locally करा
2. `git push origin main` → workflow auto-triggers
3. Wait 10-15 min → AAB ready in GitHub Artifacts
4. Manual upload OR Re-run workflow with `track=production`
5. Done!

OR straight:
1. GitHub Actions → "Build Android AAB" → Run with `track=internal`
2. 15 min later → Live on Play Store Internal Testing track

---

## 🔒 Security Notes

✅ **Safe**:
- Keystore base64 → GitHub Secret (encrypted at rest)
- Service account JSON → GitHub Secret
- Passwords → GitHub Secret
- Code repo (no secrets in plain text)

⚠️ **Never commit**:
- `keystore.base64` file → already in `.gitignore` (or move to safe place)
- Service account JSON file
- Any password in code

---

## 📂 Files Reference

| File | Purpose |
|---|---|
| `.github/workflows/build-android.yml` | The automation workflow |
| `frontend/android/keystores/paras-reward.keystore` | Signing key (binary) |
| `frontend/android/keystores/keystore.base64` | Base64 version for GitHub Secret |
| `frontend/android/app/build.gradle` | Reads env vars from workflow |

---

**तुमच्या मदतीसाठी मी आहे — कुठेतरी अडकलात तर screenshot सोबत मला विचारा!**
