#!/usr/bin/env python3
"""Iteration 301 focused verification for Android Razorpay UPI WebView fix.

Scope: static Android code/manifest checks plus app-version DB/API/file sync.
This does not run inside a real Capacitor Android WebView.
"""

import json
import re
from pathlib import Path

import requests
from pymongo import MongoClient


ROOT = Path("/app")
OUT = ROOT / "test_reports" / "android_upi_static_version_iter301_results.json"
EXPECTED_VERSION_NAME = "1.4.3"
EXPECTED_VERSION_CODE = 43


def read(path: str) -> str:
    return (ROOT / path).read_text()


def env_value(path: Path, key: str) -> str:
    for line in path.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"')
    raise AssertionError(f"{key} missing from {path}")


def assert_contains(text: str, needle: str, label: str, results: list[dict]):
    ok = needle in text
    results.append({"check": label, "passed": ok})
    if not ok:
        raise AssertionError(f"Missing {label}: {needle}")


def main():
    results: list[dict] = []

    main_activity = read("frontend/android/app/src/main/java/com/parasreward/prc/MainActivity.java")
    manifest_xml = read("frontend/android/app/src/main/AndroidManifest.xml")
    app_version_py = read("backend/routes/app_version.py")
    pwa_manifest = json.loads(read("frontend/public/manifest.json"))
    build_gradle = read("frontend/android/app/build.gradle")

    # MainActivity: intent:// support.
    for needle, label in [
        ("Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME)", "intent scheme parsed with URI_INTENT_SCHEME"),
        ("intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)", "external intent gets NEW_TASK flag"),
        ("startActivity(intent)", "external intent dispatches startActivity"),
        ("catch (ActivityNotFoundException e)", "ActivityNotFoundException explicitly handled"),
        ("return super.shouldOverrideUrlLoading(view, request);", "non-UPI schemes delegated to Capacitor parent"),
    ]:
        assert_contains(main_activity, needle, label, results)

    # MainActivity: direct UPI/app schemes.
    for scheme in ["upi", "phonepe", "tez", "paytmmp", "paytm", "gpay", "bhim", "credpay"]:
        assert_contains(main_activity, f'scheme.equalsIgnoreCase("{scheme}")', f"direct scheme handled: {scheme}", results)
    assert_contains(main_activity, "new Intent(Intent.ACTION_VIEW, url)", "direct schemes dispatch ACTION_VIEW with URL", results)

    # Sanity check: ActivityNotFoundException blocks return false rather than swallowing the click as handled.
    if len(re.findall(r"catch \(ActivityNotFoundException e\) \{\s*return false;\s*\}", main_activity, re.S)) < 2:
        raise AssertionError("Expected ActivityNotFoundException to return false in both intent:// and direct-scheme handlers")
    results.append({"check": "ActivityNotFoundException returns false for Razorpay fallback", "passed": True})

    # Manifest package visibility for UPI apps.
    for needle, label in [
        ("<queries>", "manifest has <queries> block"),
        ('<action android:name="android.intent.action.VIEW" />', "queries generic VIEW action"),
        ('<data android:scheme="upi" />', "queries generic upi scheme"),
    ]:
        assert_contains(manifest_xml, needle, label, results)
    for package in [
        "com.phonepe.app",
        "com.google.android.apps.nbu.paisa.user",
        "net.one97.paytm",
        "in.org.npci.upiapp",
        "in.amazon.mShop.android.shopping",
        "com.whatsapp",
        "com.dreamplug.androidapp",
    ]:
        assert_contains(manifest_xml, f'<package android:name="{package}" />', f"manifest queries package: {package}", results)

    # Version sync in code/assets.
    assert_contains(app_version_py, f'LATEST_VERSION_NAME = "{EXPECTED_VERSION_NAME}"', "backend fallback version name", results)
    assert_contains(app_version_py, f"LATEST_VERSION_CODE = {EXPECTED_VERSION_CODE}", "backend fallback version code", results)
    if pwa_manifest.get("version") != EXPECTED_VERSION_NAME:
        raise AssertionError(f"PWA manifest version mismatch: {pwa_manifest.get('version')}")
    results.append({"check": "PWA manifest version", "passed": True, "value": pwa_manifest.get("version")})
    assert_contains(build_gradle, f"versionCode {EXPECTED_VERSION_CODE}", "Android build.gradle versionCode", results)
    assert_contains(build_gradle, f'versionName "{EXPECTED_VERSION_NAME}"', "Android build.gradle versionName", results)

    # DB and API version check.
    backend_env = ROOT / "backend" / ".env"
    mongo_url = env_value(backend_env, "MONGO_URL")
    db_name = env_value(backend_env, "DB_NAME")
    db = MongoClient(mongo_url)[db_name]
    doc = db.app_config.find_one({"key": "android_app_version"}, {"_id": 0})
    if not doc:
        raise AssertionError("DB app_config android_app_version document missing")
    db_ok = doc.get("version_name") == EXPECTED_VERSION_NAME and int(doc.get("version_code", -1)) == EXPECTED_VERSION_CODE
    results.append({"check": "DB app_config android_app_version", "passed": db_ok, "value": doc})
    if not db_ok:
        raise AssertionError(f"DB version mismatch: {doc}")

    frontend_env = ROOT / "frontend" / ".env"
    base_url = env_value(frontend_env, "REACT_APP_BACKEND_URL")
    response = requests.get(f"{base_url}/api/app/version-info", timeout=30)
    response.raise_for_status()
    payload = response.json()
    api_ok = payload.get("latest_version_name") == EXPECTED_VERSION_NAME and int(payload.get("latest_version_code", -1)) == EXPECTED_VERSION_CODE
    results.append({"check": "GET /api/app/version-info", "passed": api_ok, "value": payload})
    if not api_ok:
        raise AssertionError(f"API version mismatch: {payload}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()