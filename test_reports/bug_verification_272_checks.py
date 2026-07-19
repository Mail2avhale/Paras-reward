#!/usr/bin/env python3
"""Focused verification for Dashboard AdMob + PayPartnerStore blank-page hotfix."""
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path('/app')
results = {}

def read(rel):
    return (ROOT / rel).read_text()

app = read('frontend/src/App.js')
global_ad = read('frontend/src/components/GlobalBannerAd.js')
admob = read('frontend/src/components/AdMobBanner.js')
pay = read('frontend/src/pages/PayPartnerStore.js')
dash = read('frontend/src/pages/DashboardModern.js')
build_gradle = read('frontend/android/app/build.gradle')
app_version = read('backend/routes/app_version.py')
pkg = json.loads(read('frontend/package.json'))
manifest = json.loads(read('frontend/public/manifest.json'))

results['global_banner_hides_dashboard'] = "'/dashboard'" in global_ad and 'margin: 90' in global_ad
results['global_banner_mounted_after_webvitals_for_user'] = '<WebVitalsReporter user={user} />' in app and '{user && <GlobalBannerAd />}' in app
results['dashboard_no_rendered_admob_banner'] = '<AdMobBanner placement="dashboard_home"' not in dash and 'Dashboard AdMob banner removed Feb 17 2026' in dash
results['admob_no_native_show_banner_call'] = not re.search(r'\bAdMob\.showBanner\s*\(', admob)
results['pay_store_guard_present'] = 'data-testid="pay-store-loading-state"' in pay and 'if (!user || !user.uid)' in pay
results['pay_store_route_error_boundary_present'] = 'path="/pay-partner-store"' in app and 'RouteErrorBoundary routeName="pay-partner-store"' in app

# Critical APK/user-build regression check: routes inside {!IS_USER_BUILD && AdminLayout && (...)} are omitted from Android user AAB.
idx_guard = app.find('{!IS_USER_BUILD && AdminLayout &&')
idx_pay_route = app.find('path="/pay-partner-store"')
idx_guard_close = app.find('{IS_USER_BUILD &&', idx_guard)
results['pay_store_route_available_in_user_build'] = not (idx_guard != -1 and idx_pay_route != -1 and idx_guard < idx_pay_route < idx_guard_close)
results['pay_store_route_inside_admin_only_block'] = idx_guard != -1 and idx_pay_route != -1 and idx_guard < idx_pay_route < idx_guard_close

results['versions_source'] = {
    'build_gradle_versionCode_22': 'versionCode 22' in build_gradle,
    'build_gradle_versionName_1_2_2': 'versionName "1.2.2"' in build_gradle,
    'backend_latest_name_1_2_2': 'LATEST_VERSION_NAME = "1.2.2"' in app_version,
    'backend_latest_code_22': 'LATEST_VERSION_CODE = 22' in app_version,
    'package_version_0_3_2': pkg.get('version') == '0.3.2',
    'manifest_version_1_2_2': manifest.get('version') == '1.2.2',
}
try:
    req = urllib.request.Request('https://formula-audit-fix.preview.emergentagent.com/api/app/version-info', headers={'User-Agent':'Mozilla/5.0 bug-verification'})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.load(resp)
    results['version_api'] = {
        'latest_version_name': data.get('latest_version_name'),
        'latest_version_code': data.get('latest_version_code'),
        'ok': data.get('latest_version_name') == '1.2.2' and data.get('latest_version_code') == 22,
    }
except Exception as e:
    results['version_api'] = {'error': str(e), 'ok': False}

print(json.dumps(results, indent=2, sort_keys=True))
