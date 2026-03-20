"""
PRC Field Standardization Migration Script
==========================================

This script standardizes all PRC redemption amount fields across all collections
to use a single field name: `total_prc_deducted`

LEGACY FIELDS (to be migrated to total_prc_deducted):
- prc_used
- prc_amount (in context of redemption)
- prc_deducted
- amount (when it represents PRC)

COLLECTIONS AFFECTED:
1. bill_payment_requests - prc_used → total_prc_deducted
2. bank_withdrawal_requests - prc_deducted, prc_amount → total_prc_deducted
3. bank_transfer_requests - prc_deducted → total_prc_deducted
4. dmt_transactions - prc_deducted, prc_amount → total_prc_deducted
5. redeem_requests - prc_amount → total_prc_deducted
6. gift_voucher_orders - prc_used, prc_amount → total_prc_deducted
7. orders - total_prc → total_prc_deducted (rename)

USAGE:
    # Dry run (preview changes):
    python standardize_prc_fields.py --dry-run

    # Actually apply changes:
    python standardize_prc_fields.py --apply

Created: March 2026
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

# Load environment
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')

# Standard field name that all collections should use
STANDARD_FIELD = "total_prc_deducted"

# Collections and their legacy field mappings
# Format: (collection_name, legacy_fields_to_migrate, field_to_check_for_existing_value)
COLLECTION_MAPPINGS = [
    {
        "collection": "bill_payment_requests",
        "legacy_fields": ["prc_used", "prc_amount"],
        "description": "Bill payments (BBPS) - prc_used → total_prc_deducted"
    },
    {
        "collection": "bank_withdrawal_requests",
        "legacy_fields": ["prc_deducted", "prc_amount", "prc_used"],
        "description": "Bank withdrawals - prc_deducted → total_prc_deducted"
    },
    {
        "collection": "bank_transfer_requests",
        "legacy_fields": ["prc_deducted", "prc_amount"],
        "description": "Manual bank transfers - prc_deducted → total_prc_deducted"
    },
    {
        "collection": "dmt_transactions",
        "legacy_fields": ["prc_deducted", "prc_amount"],
        "description": "DMT transactions - prc_deducted → total_prc_deducted"
    },
    {
        "collection": "redeem_requests",
        "legacy_fields": ["prc_amount", "prc_required", "prc_used"],
        "description": "Generic redeem requests - prc_amount → total_prc_deducted"
    },
    {
        "collection": "gift_voucher_orders",
        "legacy_fields": ["prc_used", "prc_amount"],
        "description": "Gift voucher orders - prc_used → total_prc_deducted"
    },
    {
        "collection": "orders",
        "legacy_fields": ["total_prc", "prc_amount", "total_prc_price"],
        "description": "Product orders - total_prc → total_prc_deducted"
    },
    {
        "collection": "subscription_payments",
        "legacy_fields": ["prc_amount"],
        "description": "PRC subscription payments - prc_amount → total_prc_deducted"
    },
    {
        "collection": "chatbot_dmt_requests",
        "legacy_fields": ["prc_deducted", "prc_amount"],
        "description": "Chatbot DMT requests - prc_deducted → total_prc_deducted"
    },
]


async def get_value_from_legacy_fields(doc, legacy_fields):
    """Get the first non-null value from legacy fields"""
    for field in legacy_fields:
        value = doc.get(field)
        if value is not None and value != 0:
            try:
                return float(value), field
            except (ValueError, TypeError):
                continue
    return None, None


async def analyze_collection(db, mapping, dry_run=True):
    """Analyze a single collection and optionally migrate its data"""
    collection_name = mapping["collection"]
    legacy_fields = mapping["legacy_fields"]
    description = mapping["description"]
    
    collection = db[collection_name]
    
    print(f"\n{'='*60}")
    print(f"Collection: {collection_name}")
    print(f"Description: {description}")
    print(f"Legacy fields: {legacy_fields}")
    print(f"{'='*60}")
    
    # Build query to find documents with legacy fields but missing standard field
    or_conditions = []
    for field in legacy_fields:
        or_conditions.append({field: {"$exists": True, "$ne": None, "$ne": 0}})
    
    # Find documents that have legacy fields
    query = {"$or": or_conditions}
    
    total_docs = await collection.count_documents({})
    docs_with_legacy = await collection.count_documents(query)
    docs_with_standard = await collection.count_documents({STANDARD_FIELD: {"$exists": True, "$ne": None, "$ne": 0}})
    
    print(f"Total documents: {total_docs}")
    print(f"Documents with legacy fields: {docs_with_legacy}")
    print(f"Documents already having {STANDARD_FIELD}: {docs_with_standard}")
    
    # Find documents that need migration (have legacy but not standard)
    migration_query = {
        "$and": [
            {"$or": or_conditions},
            {"$or": [
                {STANDARD_FIELD: {"$exists": False}},
                {STANDARD_FIELD: None},
                {STANDARD_FIELD: 0}
            ]}
        ]
    }
    
    docs_needing_migration = await collection.count_documents(migration_query)
    print(f"Documents needing migration: {docs_needing_migration}")
    
    if docs_needing_migration == 0:
        print("✅ No migration needed for this collection")
        return {"collection": collection_name, "migrated": 0, "status": "already_done"}
    
    if dry_run:
        # Show sample documents
        sample_docs = await collection.find(migration_query).limit(3).to_list(3)
        print(f"\nSample documents to migrate:")
        for doc in sample_docs:
            doc_id = doc.get("request_id") or doc.get("order_id") or doc.get("txn_id") or str(doc.get("_id"))
            value, source_field = await get_value_from_legacy_fields(doc, legacy_fields)
            print(f"  - ID: {doc_id}, {source_field}={value} → {STANDARD_FIELD}")
        
        print(f"\n⚠️  DRY RUN: Would migrate {docs_needing_migration} documents")
        return {"collection": collection_name, "migrated": 0, "would_migrate": docs_needing_migration, "status": "dry_run"}
    
    # Actually perform migration
    print(f"\n🔄 Starting migration of {docs_needing_migration} documents...")
    
    migrated_count = 0
    errors = []
    
    cursor = collection.find(migration_query)
    async for doc in cursor:
        doc_id = doc.get("_id")
        value, source_field = await get_value_from_legacy_fields(doc, legacy_fields)
        
        if value is not None:
            try:
                # Update document with standard field
                update_result = await collection.update_one(
                    {"_id": doc_id},
                    {
                        "$set": {
                            STANDARD_FIELD: value,
                            "_prc_migrated": True,
                            "_prc_source_field": source_field,
                            "_prc_migrated_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                
                if update_result.modified_count > 0:
                    migrated_count += 1
                    
                if migrated_count % 100 == 0:
                    print(f"  Migrated {migrated_count} documents...")
                    
            except Exception as e:
                errors.append({"doc_id": str(doc_id), "error": str(e)})
    
    print(f"✅ Migration complete: {migrated_count} documents migrated")
    if errors:
        print(f"⚠️  Errors: {len(errors)}")
        for err in errors[:5]:
            print(f"    - {err['doc_id']}: {err['error']}")
    
    return {
        "collection": collection_name,
        "migrated": migrated_count,
        "errors": len(errors),
        "status": "completed"
    }


async def run_migration(dry_run=True):
    """Run the full migration across all collections"""
    print("="*70)
    print("PRC Field Standardization Migration")
    print(f"Target field: {STANDARD_FIELD}")
    print(f"Mode: {'DRY RUN (preview only)' if dry_run else 'APPLYING CHANGES'}")
    print("="*70)
    
    if not MONGO_URL or not DB_NAME:
        print("ERROR: MONGO_URL and DB_NAME environment variables required")
        return
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Verify connection
    try:
        await client.admin.command('ping')
        print(f"✅ Connected to database: {DB_NAME}")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return
    
    results = []
    
    for mapping in COLLECTION_MAPPINGS:
        try:
            result = await analyze_collection(db, mapping, dry_run)
            results.append(result)
        except Exception as e:
            print(f"❌ Error processing {mapping['collection']}: {e}")
            results.append({
                "collection": mapping["collection"],
                "status": "error",
                "error": str(e)
            })
    
    # Summary
    print("\n" + "="*70)
    print("MIGRATION SUMMARY")
    print("="*70)
    
    total_migrated = 0
    total_would_migrate = 0
    
    for result in results:
        status_icon = "✅" if result.get("status") in ["completed", "already_done"] else "⚠️"
        print(f"{status_icon} {result['collection']}: {result.get('status', 'unknown')}")
        if result.get('migrated'):
            print(f"    Migrated: {result['migrated']}")
            total_migrated += result['migrated']
        if result.get('would_migrate'):
            print(f"    Would migrate: {result['would_migrate']}")
            total_would_migrate += result['would_migrate']
        if result.get('errors'):
            print(f"    Errors: {result['errors']}")
    
    print(f"\nTotal documents {'that would be' if dry_run else ''} migrated: {total_migrated if not dry_run else total_would_migrate}")
    
    if dry_run:
        print("\n⚠️  This was a DRY RUN. No changes were made.")
        print("To apply changes, run: python standardize_prc_fields.py --apply")
    else:
        print("\n✅ Migration completed!")
        
        # Create a migration log
        await db.migration_logs.insert_one({
            "migration": "standardize_prc_fields",
            "executed_at": datetime.now(timezone.utc).isoformat(),
            "results": results,
            "total_migrated": total_migrated
        })
        print("Migration log saved to 'migration_logs' collection")
    
    client.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Standardize PRC fields across all collections")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Preview changes without applying (default)")
    parser.add_argument("--apply", action="store_true", help="Actually apply the migration")
    
    args = parser.parse_args()
    
    # If --apply is specified, set dry_run to False
    dry_run = not args.apply
    
    asyncio.run(run_migration(dry_run=dry_run))
