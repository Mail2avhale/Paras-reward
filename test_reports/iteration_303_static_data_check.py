#!/usr/bin/env python3
"""Focused static/data checks for iteration 303 Razorpay UPI service-charge bug."""
import asyncio
import json
import os
import re
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path('/app')
TEST_UID = '76b75808-47fa-48dd-ad7c-8074678e3607'


def load_env(path: Path):
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        if not raw or raw.strip().startswith('#') or '=' not in raw:
            continue
        k, v = raw.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def no_object_id(doc):
    if not doc:
        return doc
    return {k: v for k, v in doc.items() if k != '_id'}


def static_checks():
    my = (ROOT / 'frontend/src/pages/MyServiceCharges.js').read_text()
    banner = (ROOT / 'frontend/src/components/ServiceChargePendingBanner.jsx').read_text()
    cap = json.loads((ROOT / 'frontend/capacitor.config.json').read_text())
    manifest = json.loads((ROOT / 'frontend/public/manifest.json').read_text())
    app_version = (ROOT / 'backend/routes/app_version.py').read_text()
    gradle = (ROOT / 'frontend/android/app/build.gradle').read_text()

    method_exact = 'method: { upi: true, card: true, netbanking: true, wallet: true }'
    config_exact = 'config: { display: { preferences: { show_default_blocks: true } } }'
    return {
        'my_service_charges_method_count': my.count(method_exact),
        'my_service_charges_config_count': my.count(config_exact),
        'banner_method_present': method_exact in banner,
        'banner_config_present': config_exact in banner,
        'capacitor_android_appendUserAgent': cap.get('android', {}).get('appendUserAgent'),
        'backend_latest_version_name': re.search(r'LATEST_VERSION_NAME\s*=\s*"([^"]+)"', app_version).group(1),
        'backend_latest_version_code': int(re.search(r'LATEST_VERSION_CODE\s*=\s*(\d+)', app_version).group(1)),
        'manifest_version': manifest.get('version'),
        'gradle_version_name': re.findall(r'^\s*versionName\s+"([^"]+)"', gradle, flags=re.M)[-1],
        'gradle_version_code': int(re.findall(r'^\s*versionCode\s+(\d+)', gradle, flags=re.M)[-1]),
    }


async def db_checks():
    load_env(ROOT / 'backend/.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    try:
        app_cfg = await db.app_config.find_one({'key': 'android_app_version'})
        pending = await db.redemption_service_charges.find(
            {'user_id': TEST_UID, 'status': 'PENDING'}, {'_id': 0}
        ).sort('created_at', -1).to_list(20)
        return {
            'db_app_config': no_object_id(app_cfg),
            'pending_charge_count_for_test_user': len(pending),
            'pending_charges_for_test_user': pending,
        }
    finally:
        client.close()


async def main():
    load_env(ROOT / 'frontend/.env')
    result = {
        'static': static_checks(),
        'db': await db_checks(),
    }
    print(json.dumps(result, indent=2, default=str))


if __name__ == '__main__':
    asyncio.run(main())