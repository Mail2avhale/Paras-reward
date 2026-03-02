#!/usr/bin/env python3
"""
DISABLE ALL REDEEM SERVICES

Run this after bulk_reject_script.py:
    python3 disable_redeem_services.py

This will disable:
- Bank Transfer
- Bill Payments (Mobile, DTH, Electricity, etc.)
- Gift Voucher
- All redemption services
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# Production MongoDB URL
MONGO_URL = "mongodb+srv://mining-boost-1:d46727klqs2c73fimmi0@customer-apps.hfzqpg.mongodb.net/?appName=admin-payment-hub-5&maxPoolSize=5&retryWrites=true&w=majority"
DB_NAME = "paras_reward"

async def disable_services():
    print("=" * 60)
    print("🔒 DISABLE REDEEM SERVICES")
    print("=" * 60)
    
    print("\n🔗 Connecting to Production MongoDB Atlas...")
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=30000)
    db = client[DB_NAME]
    
    try:
        await client.admin.command('ping')
        print("✅ Connected to MongoDB Atlas!")
        
        now = datetime.now(timezone.utc)
        
        # Services to disable
        services_to_disable = [
            "bank_transfer",
            "bill_payment", 
            "gift_voucher",
            "mobile_recharge",
            "dth_recharge",
            "electricity_bill",
            "gas_bill",
            "lpg_booking",
            "credit_card_payment",
            "loan_emi",
            "postpaid_mobile",
            "broadband_bill",
            "water_bill"
        ]
        
        print(f"\n🔒 Disabling {len(services_to_disable)} services...")
        
        for service in services_to_disable:
            # Update or insert service status
            result = await db.service_settings.update_one(
                {"service_name": service},
                {"$set": {
                    "service_name": service,
                    "enabled": False,
                    "disabled_at": now.isoformat(),
                    "disabled_reason": "Services temporarily disabled by Admin",
                    "updated_at": now.isoformat()
                }},
                upsert=True
            )
            print(f"  ✅ {service}: DISABLED")
        
        # Also update app_settings if it exists
        await db.app_settings.update_one(
            {"setting_type": "redeem_services"},
            {"$set": {
                "setting_type": "redeem_services",
                "all_redeem_enabled": False,
                "bank_transfer_enabled": False,
                "bill_payment_enabled": False,
                "gift_voucher_enabled": False,
                "disabled_at": now.isoformat(),
                "disabled_reason": "All redeem services temporarily disabled",
                "updated_at": now.isoformat()
            }},
            upsert=True
        )
        
        print("\n" + "=" * 60)
        print("🎉 ALL REDEEM SERVICES DISABLED!")
        print("=" * 60)
        print("\nUsers will NOT be able to:")
        print("  ❌ Request Bank Transfer")
        print("  ❌ Request Bill Payments")
        print("  ❌ Request Gift Vouchers")
        print("  ❌ Any other redemption")
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()
        print("🔌 Disconnected from MongoDB")

if __name__ == "__main__":
    asyncio.run(disable_services())
