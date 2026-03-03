"""
PRC Vault Migration Script
--------------------------
This script migrates all users' PRC vault (luxury_savings) balance to their main prc_balance.

Steps:
1. Find all users with luxury_savings records
2. Add their total_savings to prc_balance
3. Mark the luxury_savings record as migrated
4. Create a transaction record for audit trail
"""

import asyncio
import os
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import ObjectId
import uuid

# Database connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "paras_reward")

def run_migration():
    """
    Migrate all PRC vault (luxury_savings) balances to users' prc_balance
    """
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 60)
    print("PRC VAULT TO PRC BALANCE MIGRATION")
    print("=" * 60)
    
    # Statistics
    total_users_processed = 0
    total_prc_migrated = 0
    migration_errors = []
    
    # Find all luxury_savings records that haven't been migrated
    luxury_records = list(db.luxury_savings.find({
        "total_savings": {"$gt": 0},
        "vault_migrated_to_prc": {"$ne": True}  # Not already migrated
    }))
    
    print(f"\nFound {len(luxury_records)} users with vault balance to migrate\n")
    
    for record in luxury_records:
        user_id = record.get("user_id")
        total_savings = record.get("total_savings", 0) or 0
        mobile_savings = record.get("mobile_savings", 0) or 0
        bike_savings = record.get("bike_savings", 0) or 0
        car_savings = record.get("car_savings", 0) or 0
        
        if total_savings <= 0:
            continue
        
        try:
            # Get current user
            user = db.users.find_one({"uid": user_id})
            if not user:
                print(f"[SKIP] User {user_id} not found")
                continue
            
            current_balance = user.get("prc_balance", 0) or 0
            new_balance = current_balance + total_savings
            
            # Update user's prc_balance
            db.users.update_one(
                {"uid": user_id},
                {
                    "$set": {"prc_balance": new_balance},
                    "$inc": {"vault_migration_amount": total_savings}
                }
            )
            
            # Mark luxury_savings as migrated
            db.luxury_savings.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "vault_migrated_to_prc": True,
                        "vault_migration_date": datetime.now(timezone.utc).isoformat(),
                        "vault_migration_amount": total_savings,
                        # Reset balances to 0
                        "total_savings": 0,
                        "mobile_savings": 0,
                        "bike_savings": 0,
                        "car_savings": 0
                    }
                }
            )
            
            # Create wallet transaction for audit
            db.wallet_transactions.insert_one({
                "transaction_id": str(uuid.uuid4()),
                "user_id": user_id,
                "type": "credit",
                "wallet_type": "prc",
                "amount": total_savings,
                "description": f"PRC Vault Migration - {total_savings:.2f} PRC transferred from Savings Vault",
                "balance_before": current_balance,
                "balance_after": new_balance,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "metadata": {
                    "migration_type": "vault_to_prc",
                    "mobile_savings": mobile_savings,
                    "bike_savings": bike_savings,
                    "car_savings": car_savings
                }
            })
            
            total_users_processed += 1
            total_prc_migrated += total_savings
            
            print(f"[OK] User {user_id}: {total_savings:.2f} PRC migrated (Balance: {current_balance:.2f} -> {new_balance:.2f})")
            
        except Exception as e:
            migration_errors.append({"user_id": user_id, "error": str(e)})
            print(f"[ERROR] User {user_id}: {e}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("MIGRATION SUMMARY")
    print("=" * 60)
    print(f"Total users processed: {total_users_processed}")
    print(f"Total PRC migrated: {total_prc_migrated:.2f}")
    print(f"Errors: {len(migration_errors)}")
    
    if migration_errors:
        print("\nErrors:")
        for err in migration_errors:
            print(f"  - {err['user_id']}: {err['error']}")
    
    print("\n✅ Migration complete!")
    
    client.close()
    
    return {
        "users_processed": total_users_processed,
        "prc_migrated": total_prc_migrated,
        "errors": migration_errors
    }


if __name__ == "__main__":
    run_migration()
