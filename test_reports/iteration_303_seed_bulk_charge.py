#!/usr/bin/env python3
"""Create one temporary PENDING charge so the Bulk Pay button is visible for iteration 303 UI testing."""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path('/app')
TEST_UID = '76b75808-47fa-48dd-ad7c-8074678e3607'
MARKER = 'iteration_303_bulk_pay_ui_seed'


def load_env(path: Path):
    for raw in path.read_text().splitlines():
        if raw and '=' in raw and not raw.lstrip().startswith('#'):
            k, v = raw.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


async def main():
    load_env(ROOT / 'backend/.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    try:
        existing = await db.redemption_service_charges.find_one({'qa_marker': MARKER}, {'_id': 0})
        if existing:
            print(f"existing_seed {existing['charge_id']}")
            return
        now = datetime.now(timezone.utc).isoformat()
        suffix = uuid.uuid4().hex[:8].upper()
        doc = {
            'charge_id': f'SVC-ITER303-{suffix}',
            'user_id': TEST_UID,
            'redemption_id': f'iter303-redemption-{suffix}',
            'redemption_type': 'qa_iteration_303',
            'prc_amount': 1000.0,
            'prc_rate': 10,
            'redemption_value_inr': 100.0,
            'service_charge_percentage': 20,
            'service_charge_amount': 20.0,
            'tax_amount': 0.0,
            'total_payable': 20.0,
            'currency': 'INR',
            'status': 'PENDING',
            'payment_order_id': None,
            'payment_id': None,
            'payment_gateway': 'razorpay',
            'payment_attempts': 0,
            'created_at': now,
            'applicable_at': now,
            'paid_at': None,
            'updated_at': now,
            'qa_marker': MARKER,
        }
        await db.redemption_service_charges.insert_one(doc)
        print(f"created_seed {doc['charge_id']}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())