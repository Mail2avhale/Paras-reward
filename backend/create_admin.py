import asyncio
import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'paras_reward_db')

async def create_admin():
    """Create default admin user"""
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        
        print("🔗 Connected to MongoDB")
        print("=" * 60)
        
        # Check if admin already exists
        existing_admin = await db.users.find_one({"email": "admin@paras.com"})
        if existing_admin:
            print("⚠️  Admin user already exists!")
            print(f"   Email: admin@paras.com")
            print(f"   UID: {existing_admin['uid']}")
            client.close()
            return
        
        # Create admin user
        admin_uid = str(uuid.uuid4())
        hashed_password = pwd_context.hash("admin123")
        
        admin_user = {
            "uid": admin_uid,
            "email": "admin@paras.com",
            "password": hashed_password,
            "name": "Admin User",
            "mobile": "+91-9999999999",
            "role": "admin",
            "is_vip": True,
            "vip_expiry": None,  # Never expires
            "prc_balance": 10000,  # Starting PRC
            "cashback_wallet": 1000.0,  # Starting INR
            "profit_wallet": 0.0,
            "pending_lien": 0.0,
            "last_fee_date": datetime.now(timezone.utc).isoformat(),
            "referral_code": f"ADMIN{admin_uid[:8].upper()}",
            "referred_by": None,
            "kyc_verified": True,
            "kyc_status": "approved",
            "active_mining": False,
            "last_mining_time": None,
            "total_mined_prc": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "district": "Mumbai",
            "tahsil": "Mumbai City",
            "pincode": "400001",
            "state": "Maharashtra"
        }
        
        await db.users.insert_one(admin_user)
        
        print("✅ Admin user created successfully!")
        print("=" * 60)
        print("📧 Email: admin@paras.com")
        print("🔑 Password: admin123")
        print(f"🆔 UID: {admin_uid}")
        print(f"👤 Role: admin")
        print(f"💎 VIP Status: Yes (Permanent)")
        print(f"🪙 PRC Balance: 10,000")
        print(f"💰 Cashback Wallet: ₹1,000")
        print("=" * 60)
        print("✅ You can now login with these credentials")
        
        # Close connection
        client.close()
        
    except Exception as e:
        print(f"❌ Error creating admin: {str(e)}")
        raise

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("👤 ADMIN USER CREATION")
    print("=" * 60)
    asyncio.run(create_admin())
    print("=" * 60 + "\n")
