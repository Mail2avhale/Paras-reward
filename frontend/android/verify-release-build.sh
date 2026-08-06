#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# verify-release-build.sh — Play Console "1 action recommended" check
# ─────────────────────────────────────────────────────────────────────────
# Run from repo root:  bash frontend/android/verify-release-build.sh
#
# Verifies each of Play Console's 5 recommendations against the ACTUAL
# gradle config so you know the AAB you're about to upload will fully
# clear the warning:
#   1. Code Optimization  — proguard-android-optimize.txt + R8 full mode
#   2. Code Obfuscation   — minifyEnabled true (obfuscation is built-in)
#   3. Code Shrinking     — minifyEnabled true
#   4. Resource Shrinking — shrinkResources true
#   5. Release build      — signing config wired from env vars
#
# Exit code 0 = all checks pass. Non-zero = something's off.
# ═══════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_GRADLE="$SCRIPT_DIR/app/build.gradle"
GRADLE_PROPS="$SCRIPT_DIR/gradle.properties"
PROGUARD="$SCRIPT_DIR/app/proguard-rules.pro"

pass() { printf "  ✅ %s\n" "$1"; }
fail() { printf "  ❌ %s\n" "$1"; FAILED=1; }
FAILED=0

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " Play Console Release-Build Verification (v1.3.5+)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────────────────
# 1. Code Optimization
# ─────────────────────────────────────────────────────────────────────
echo "1. Code Optimization"
if grep -q "getDefaultProguardFile('proguard-android-optimize.txt')" "$APP_GRADLE"; then
  pass "proguard-android-optimize.txt referenced (optimizing ProGuard defaults)"
else
  fail "proguard-android-optimize.txt is NOT wired in release buildType"
fi
if grep -q "^android.enableR8.fullMode=true" "$GRADLE_PROPS"; then
  pass "android.enableR8.fullMode=true (whole-program optimization)"
else
  fail "R8 full mode is NOT enabled — Play Console will keep warning"
fi

# ─────────────────────────────────────────────────────────────────────
# 2. Code Obfuscation
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "2. Code Obfuscation"
# minifyEnabled true drives both obfuscation AND shrinking
if awk '/release[[:space:]]*\{/,/^[[:space:]]*}[[:space:]]*$/' "$APP_GRADLE" \
   | grep -q "minifyEnabled true"; then
  pass "minifyEnabled true in release buildType (drives R8 obfuscation)"
else
  fail "minifyEnabled is NOT true in release buildType"
fi

for pattern in \
  "com.getcapacitor" \
  "com.google.firebase" \
  "com.google.android.gms.ads" \
  "com.google.android.gms.common" \
  "com.google.android.gms.tasks" \
  "com.google.gson" \
  "com.android.installreferrer" \
  "androidx.biometric" \
  "com.google.android.play.core" \
  "kotlinx.coroutines" \
  ; do
  if grep -q "$pattern" "$PROGUARD"; then
    pass "keep-rule present for $pattern"
  else
    fail "MISSING keep-rule for $pattern — release build risks runtime crash"
  fi
done

# ─────────────────────────────────────────────────────────────────────
# 3. Code Shrinking
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "3. Code Shrinking"
# Same minifyEnabled flag drives shrinking; already verified above.
if awk '/release[[:space:]]*\{/,/^[[:space:]]*}[[:space:]]*$/' "$APP_GRADLE" \
   | grep -q "minifyEnabled true"; then
  pass "minifyEnabled true (unused classes/methods removed by R8)"
else
  fail "code shrinking not enabled"
fi

# ─────────────────────────────────────────────────────────────────────
# 4. Resource Shrinking
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "4. Resource Shrinking"
if awk '/release[[:space:]]*\{/,/^[[:space:]]*}[[:space:]]*$/' "$APP_GRADLE" \
   | grep -q "shrinkResources true"; then
  pass "shrinkResources true (unused drawables / layouts removed)"
else
  fail "shrinkResources is NOT true"
fi

# ─────────────────────────────────────────────────────────────────────
# 5. Release build signing + versioning
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "5. Release build sanity"
if grep -q 'PARAS_KEYSTORE_FILE' "$APP_GRADLE"; then
  pass "release signing wired from env vars (PARAS_KEYSTORE_*)"
else
  fail "release signing config not wired"
fi
if grep -q "versionCode 35" "$APP_GRADLE" || grep -q "versionCode 3[6-9]" "$APP_GRADLE" || grep -q "versionCode [4-9][0-9]" "$APP_GRADLE"; then
  pass "versionCode is 35 or newer (freshly bumped for Play Console re-check)"
else
  fail "versionCode is stale — bump it before uploading"
fi
if grep -q "ndk {" "$APP_GRADLE" && grep -q "debugSymbolLevel" "$APP_GRADLE"; then
  pass "native debug symbols bundled (Play Console can symbolicate crashes)"
else
  printf "  ⚠️  native debug symbols not configured (optional, not a warning)\n"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then
  echo " ✅ All Play Console recommendations satisfied."
  echo "    Next: PARAS_KEYSTORE_FILE=... ./gradlew :app:bundleRelease"
  exit 0
else
  echo " ❌ One or more checks FAILED. Fix above before uploading AAB."
  exit 1
fi
