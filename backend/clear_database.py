import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'paras_reward_db')

async def clear_database():
    """Clear all collections in the database"""
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        
        print(f"🔗 Connected to MongoDB: {DB_NAME}")
        print("⚠️  Starting database clear operation...")
        print("=" * 60)
        
        # Get all collection names
        collections = await db.list_collection_names()
        
        if not collections:
            print("ℹ️  Database is already empty. No collections found.")
            client.close()
            return
        
        print(f"📋 Found {len(collections)} collections to clear:")
        for collection_name in collections:
            print(f"   - {collection_name}")
        
        print("=" * 60)
        
        # Drop each collection
        for collection_name in collections:
            await db[collection_name].drop()
            print(f"✓ Dropped collection: {collection_name}")
        
        print("=" * 60)
        print("✅ Database cleared successfully!")
        print(f"✅ All {len(collections)} collections have been deleted")
        print("\n📝 Next step: Run make_admin.py to create admin user")
        
        # Close connection
        client.close()
        
    except Exception as e:
        print(f"❌ Error clearing database: {str(e)}")
        raise

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("🗑️  DATABASE CLEAR OPERATION")
    print("=" * 60)
    asyncio.run(clear_database())
    print("=" * 60 + "\n")
