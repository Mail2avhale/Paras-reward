"""
CRITICAL FIX: Reverse subscriptions for cancelled orders

This script finds all users who have:
1. Cancelled/failed Razorpay orders
2. Active Elite subscription
3. NO paid orders

And downgrades them to Explorer.

RUN THIS ON PRODUCTION:
1. SSH to production server
2. cd /app/backend
3. python fix_cancelled_subscriptions.py --dry-run    # First check
4. python fix_cancelled_subscriptions.py              # Apply fix
"""

import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "parasreward")

async def fix_cancelled_subscriptions(dry_run=True):
    """Find and fix users with cancelled orders but active subscriptions"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"\n{'='*60}")
    print(f"FIX CANCELLED SUBSCRIPTIONS - {'DRY RUN' if dry_run else 'APPLYING FIX'}")
    print(f"{'='*60}\n")
    
    # Find all cancelled/failed orders
    cancelled_statuses = ["cancelled", "failed", "error", "timeout", "dismissed"]
    cancelled_orders = await db.razorpay_orders.find({
        "status": {"$in": cancelled_statuses}
    }).to_list(10000)
    
    print(f"Found {len(cancelled_orders)} cancelled/failed orders\n")
    
    affected_users = []
    already_correct = 0
    has_paid_order = 0
    
    # Get unique user IDs from cancelled orders
    cancelled_user_ids = set()
    for order in cancelled_orders:
        user_id = order.get("user_id")
        if user_id:
            cancelled_user_ids.add(user_id)
    
    print(f"Unique users with cancelled orders: {len(cancelled_user_ids)}\n")
    
    for user_id in cancelled_user_ids:
        # Get user
        user = await db.users.find_one({"user_id": user_id})
        if not user:
            continue
        
        current_plan = user.get("subscription_plan", "explorer")
        
        # Only process if user has Elite
        if current_plan != "elite":
            already_correct += 1
            continue
        
        # Check if user has ANY paid orders
        paid_order = await db.razorpay_orders.find_one({
            "user_id": user_id,
            "status": "paid"
        })
        
        if paid_order:
            has_paid_order += 1
            continue  # User has legitimate paid order
        
        # User has Elite but NO paid orders - BUG!
        # Get the cancelled order details
        cancelled_order = await db.razorpay_orders.find_one({
            "user_id": user_id,
            "status": {"$in": cancelled_statuses}
        }, sort=[("created_at", -1)])
        
        affected_users.append({
            "user_id": user_id,
            "name": user.get("name", "Unknown"),
            "email": user.get("email"),
            "mobile": user.get("mobile"),
            "current_plan": current_plan,
            "subscription_expiry": str(user.get("subscription_expiry") or user.get("subscription_expires")),
            "cancelled_order_id": cancelled_order.get("order_id") if cancelled_order else None,
            "cancelled_reason": cancelled_order.get("failure_reason") if cancelled_order else "Unknown"
        })
        
        print(f"AFFECTED: {user.get('name')} ({user.get('email')}) - Elite but NO paid orders")
        
        if not dry_run:
            # Downgrade to Explorer
            await db.users.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "subscription_plan": "explorer",
                        "subscription_expires": None,
                        "subscription_expiry": None,
                        "subscription_start": None,
                        "downgrade_reason": f"Cancelled order - no paid orders found",
                        "downgrade_date": datetime.now(timezone.utc).isoformat(),
                        "admin_fixed": True
                    }
                }
            )
            print(f"  -> FIXED: Downgraded to Explorer")
    
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Total cancelled/failed orders: {len(cancelled_orders)}")
    print(f"Users already on correct plan: {already_correct}")
    print(f"Users with valid paid orders: {has_paid_order}")
    print(f"AFFECTED USERS (Elite but no paid orders): {len(affected_users)}")
    
    if dry_run:
        print(f"\n⚠️  DRY RUN - No changes made")
        print(f"Run with --apply to fix these {len(affected_users)} users")
    else:
        print(f"\n✅ FIXED {len(affected_users)} users - downgraded to Explorer")
    
    client.close()
    return affected_users


if __name__ == "__main__":
    import sys
    
    dry_run = True
    if len(sys.argv) > 1 and sys.argv[1] in ["--apply", "-a", "--fix"]:
        dry_run = False
        print("\n⚠️  APPLYING FIX - This will modify the database!\n")
        confirm = input("Type 'YES' to confirm: ")
        if confirm != "YES":
            print("Aborted.")
            sys.exit(1)
    
    asyncio.run(fix_cancelled_subscriptions(dry_run=dry_run))
