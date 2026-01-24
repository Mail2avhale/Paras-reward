"""
Database Index Manager for Paras Rewards Platform
Ensures all critical indexes exist for optimal query performance
"""

async def create_performance_indexes(db):
    """
    Create all necessary indexes for high-performance queries
    Call this on application startup
    """
    print("🔧 Creating database indexes for optimal performance...")
    
    try:
        # ============ USERS COLLECTION ============
        # Primary lookups
        await db.users.create_index("uid", unique=True, background=True)
        await db.users.create_index("email", unique=True, background=True)
        await db.users.create_index("mobile", unique=True, sparse=True, background=True)
        
        # Referral system queries
        await db.users.create_index("referred_by", background=True)
        await db.users.create_index("referral_code", unique=True, sparse=True, background=True)
        
        # Subscription/membership queries
        await db.users.create_index("subscription_plan", background=True)
        await db.users.create_index("membership_type", background=True)
        await db.users.create_index([("subscription_plan", 1), ("subscription_end_date", 1)], background=True)
        
        # Mining queries
        await db.users.create_index("mining_active", background=True)
        await db.users.create_index([("mining_active", 1), ("mining_session_end", 1)], background=True)
        
        # KYC queries
        await db.users.create_index("kyc_verified", background=True)
        await db.users.create_index("kyc_status", background=True)
        
        # Location-based queries (Nearby users)
        await db.users.create_index("city", background=True)
        await db.users.create_index("state", background=True)
        await db.users.create_index([("city", 1), ("show_location", 1)], background=True)
        await db.users.create_index([("state", 1), ("show_location", 1)], background=True)
        
        # Activity tracking
        await db.users.create_index("last_login", background=True)
        await db.users.create_index("created_at", background=True)
        
        # Admin queries
        await db.users.create_index("role", background=True)
        await db.users.create_index("is_admin", background=True)
        
        # Fraud detection
        await db.users.create_index("aadhaar_number", sparse=True, background=True)
        await db.users.create_index("pan_number", sparse=True, background=True)
        await db.users.create_index("device_fingerprint", sparse=True, background=True)
        await db.users.create_index("registration_ip", background=True)
        
        print("  ✅ Users indexes created")
        
        # ============ TRANSACTIONS COLLECTION ============
        await db.transactions.create_index("transaction_id", unique=True, background=True)
        await db.transactions.create_index("user_id", background=True)
        await db.transactions.create_index("transaction_type", background=True)
        await db.transactions.create_index("created_at", background=True)
        await db.transactions.create_index([("user_id", 1), ("transaction_type", 1)], background=True)
        await db.transactions.create_index([("user_id", 1), ("created_at", -1)], background=True)
        await db.transactions.create_index([("transaction_type", 1), ("created_at", -1)], background=True)
        
        print("  ✅ Transactions indexes created")
        
        # ============ BILL PAYMENT REQUESTS ============
        await db.bill_payment_requests.create_index("request_id", unique=True, background=True)
        await db.bill_payment_requests.create_index("user_id", background=True)
        await db.bill_payment_requests.create_index("status", background=True)
        await db.bill_payment_requests.create_index("created_at", background=True)
        await db.bill_payment_requests.create_index([("status", 1), ("created_at", -1)], background=True)
        await db.bill_payment_requests.create_index([("user_id", 1), ("status", 1)], background=True)
        
        print("  ✅ Bill payment indexes created")
        
        # ============ SUBSCRIPTIONS ============
        await db.subscriptions.create_index("user_id", background=True)
        await db.subscriptions.create_index("status", background=True)
        await db.subscriptions.create_index("utr_number", unique=True, sparse=True, background=True)
        await db.subscriptions.create_index([("status", 1), ("submitted_at", -1)], background=True)
        
        await db.vip_subscriptions.create_index("user_id", background=True)
        await db.vip_subscriptions.create_index("status", background=True)
        await db.vip_subscriptions.create_index("utr_number", unique=True, sparse=True, background=True)
        
        print("  ✅ Subscription indexes created")
        
        # ============ GIFT VOUCHERS ============
        await db.gift_voucher_requests.create_index("request_id", unique=True, background=True)
        await db.gift_voucher_requests.create_index("user_id", background=True)
        await db.gift_voucher_requests.create_index("status", background=True)
        await db.gift_voucher_requests.create_index([("status", 1), ("created_at", -1)], background=True)
        
        print("  ✅ Gift voucher indexes created")
        
        # ============ ORDERS ============
        await db.orders.create_index("order_id", unique=True, background=True)
        await db.orders.create_index("user_id", background=True)
        await db.orders.create_index("status", background=True)
        await db.orders.create_index([("user_id", 1), ("created_at", -1)], background=True)
        
        print("  ✅ Orders indexes created")
        
        # ============ PRODUCTS ============
        await db.products.create_index("product_id", unique=True, background=True)
        await db.products.create_index("category", background=True)
        await db.products.create_index("is_active", background=True)
        await db.products.create_index([("is_active", 1), ("category", 1)], background=True)
        
        print("  ✅ Products indexes created")
        
        # ============ MESSAGES ============
        await db.messages.create_index("message_id", unique=True, background=True)
        await db.messages.create_index("sender_uid", background=True)
        await db.messages.create_index("receiver_uid", background=True)
        await db.messages.create_index([("sender_uid", 1), ("receiver_uid", 1), ("created_at", -1)], background=True)
        await db.messages.create_index([("receiver_uid", 1), ("read", 1)], background=True)
        
        print("  ✅ Messages indexes created")
        
        # ============ NOTIFICATIONS ============
        await db.notifications.create_index("notification_id", unique=True, background=True)
        await db.notifications.create_index("user_uid", background=True)
        await db.notifications.create_index([("user_uid", 1), ("read", 1), ("created_at", -1)], background=True)
        
        print("  ✅ Notifications indexes created")
        
        # ============ FOLLOWS ============
        await db.follows.create_index([("follower_uid", 1), ("following_uid", 1)], unique=True, background=True)
        await db.follows.create_index("follower_uid", background=True)
        await db.follows.create_index("following_uid", background=True)
        
        print("  ✅ Follows indexes created")
        
        # ============ ACTIVITY LOGS ============
        await db.activity_logs.create_index("user_id", background=True)
        await db.activity_logs.create_index("action_type", background=True)
        await db.activity_logs.create_index("created_at", background=True)
        await db.activity_logs.create_index([("action_type", 1), ("created_at", -1)], background=True)
        
        print("  ✅ Activity logs indexes created")
        
        # ============ FRAUD LOGS ============
        await db.fraud_logs.create_index("user_id", background=True)
        await db.fraud_logs.create_index("ip_address", background=True)
        await db.fraud_logs.create_index("event_type", background=True)
        await db.fraud_logs.create_index("timestamp", background=True)
        await db.fraud_logs.create_index([("ip_address", 1), ("timestamp", -1)], background=True)
        
        print("  ✅ Fraud logs indexes created")
        
        # ============ VIDEO ADS ============
        await db.video_ads.create_index("video_ad_id", unique=True, background=True)
        await db.video_ads.create_index("placement", background=True)
        await db.video_ads.create_index("is_active", background=True)
        await db.video_ads.create_index([("is_active", 1), ("placement", 1)], background=True)
        
        await db.video_ad_views.create_index([("user_id", 1), ("video_ad_id", 1)], background=True)
        await db.video_ad_views.create_index([("user_id", 1), ("viewed_at", -1)], background=True)
        
        print("  ✅ Video ads indexes created")
        
        # ============ LEADERBOARD (compound indexes) ============
        await db.users.create_index([("prc_balance", -1)], background=True)
        await db.users.create_index([("total_earnings", -1)], background=True)
        
        print("  ✅ Leaderboard indexes created")
        
        # ============ TEXT SEARCH INDEXES ============
        try:
            await db.users.create_index([("name", "text"), ("email", "text")], background=True)
            print("  ✅ Text search indexes created")
        except Exception as e:
            print(f"  ⚠️ Text search index skipped (may already exist): {e}")
        
        print("✅ All database indexes created successfully!")
        print("🚀 Database is now optimized for high performance!")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating indexes: {e}")
        return False


async def get_index_stats(db) -> dict:
    """Get statistics about database indexes"""
    stats = {}
    
    collections = ["users", "transactions", "bill_payment_requests", 
                   "subscriptions", "orders", "messages", "notifications"]
    
    for collection_name in collections:
        try:
            collection = db[collection_name]
            indexes = await collection.index_information()
            stats[collection_name] = {
                "index_count": len(indexes),
                "indexes": list(indexes.keys())
            }
        except Exception as e:
            stats[collection_name] = {"error": str(e)}
    
    return stats
