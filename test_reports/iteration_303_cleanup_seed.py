#!/usr/bin/env python3
"""Remove temporary iteration 303 service-charge seed data."""
import asyncio
import os
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path('/app')
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
        result = await db.redemption_service_charges.delete_many({'qa_marker': MARKER})
        print(f'deleted_seed_count {result.deleted_count}')
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())