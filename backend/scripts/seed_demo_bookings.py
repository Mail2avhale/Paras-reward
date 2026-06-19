"""Create test users + book ~50 products across them to populate mall data."""
import asyncio, os, uuid, random
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

NAMES = [
    "Rahul Shinde", "Pooja Patil", "Amit Kulkarni", "Sneha Joshi", "Vikas Pawar",
    "Anita Deshmukh", "Sachin More", "Priya Jadhav", "Rohit Bhosale", "Kavita Salunkhe",
    "Nilesh Gaikwad", "Sunita Mhatre", "Ganesh Rane", "Madhuri Nikam", "Akash Sutar",
    "Deepa Chavan", "Sandeep Pandit", "Lata Kale", "Mahesh Tambe", "Rekha Khade",
]

async def main():
    mc = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mc[os.environ["DB_NAME"]]
    
    # Reset for clean test
    await db.mall_bookings.delete_many({"user_id": {"$regex": "^demo-"}})
    await db.mall_counters.delete_many({})
    await db.users.delete_many({"uid": {"$regex": "^demo-"}})
    
    # Create 20 demo users with high PRC balance
    demo_users = []
    for i, name in enumerate(NAMES, 1):
        uid = f"demo-{i:02d}"
        doc = {
            "uid": uid, "name": name,
            "mobile": f"99000{i:05d}",
            "email": f"demo{i}@parasmall.test",
            "referral_code": f"DEMO{i:02d}",
            "prc_balance": 5_000_000,
            "prc_locked": 0,
            "subscription_plan": "elite",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(doc)
        demo_users.append(uid)
    
    products = await db.mall_products.find({"active": True}, {"_id": 0}).to_list(50)
    print(f"Products available: {len(products)}, Demo users: {len(demo_users)}")
    
    PRC_RATE = 10
    def compute_upfront(mrp): return max(int(mrp*0.10), 1000) * PRC_RATE
    def compute_total(mrp): return mrp * PRC_RATE
    
    # Book 50 product instances across different users
    bookings_done = 0
    target = min(50, len(products))
    # Round-robin: each user books 2-3 products, but cycle through all 43 products
    booked_pairs = []
    for i in range(target):
        product = products[i % len(products)]
        user_uid = demo_users[i % len(demo_users)]
        booked_pairs.append((user_uid, product))
    random.shuffle(booked_pairs)
    
    position_counter = 1
    for user_uid, product in booked_pairs:
        upfront = compute_upfront(product["mrp_inr"])
        total = compute_total(product["mrp_inr"])
        booking_id = str(uuid.uuid4())
        await db.mall_bookings.insert_one({
            "booking_id": booking_id,
            "user_id": user_uid,
            "product_id": product["product_id"],
            "product_name": product["name"],
            "mrp_inr": product["mrp_inr"],
            "total_prc": total,
            "upfront_prc": upfront,
            "paid_prc": upfront,
            "remaining_prc": total - upfront,
            "position": position_counter,
            "status": "mining",
            "session_start": datetime.now(timezone.utc).isoformat(),
            "laps_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "fulfilled_at": None,
            "delivered_at": None,
        })
        await db.users.update_one({"uid": user_uid}, {"$inc": {"prc_balance": -upfront}})
        # Community post for ticker
        u = await db.users.find_one({"uid": user_uid}, {"name": 1})
        display = u["name"].split()[0][:8].upper()
        await db.community_feed.insert_one({
            "feed_id": str(uuid.uuid4()),
            "user_id": user_uid,
            "type": "mall_booked",
            "message": f"🎉 {display} just booked {product['name']} via Paras Mall!",
            "product_name": product["name"],
            "booking_id": booking_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        position_counter += 1
        bookings_done += 1
    
    # Update mall_counters so future bookings continue
    await db.mall_counters.update_one(
        {"_id": "booking_position"},
        {"$set": {"value": position_counter - 1}},
        upsert=True
    )
    
    # Summary
    total_bookings = await db.mall_bookings.count_documents({"status": "mining"})
    print(f"\n✓ Created {bookings_done} test bookings across {len(demo_users)} users")
    print(f"  Total active mining bookings in DB: {total_bookings}")
    print(f"  Position counter: {position_counter - 1}")
    print(f"  Community feed entries created: {bookings_done}")
    print("\nRate cascade for top-3 bookings (highest boost):")
    top = await db.mall_bookings.find({"status":"mining"}, {"_id":0, "position":1, "product_name":1}).sort("position", 1).limit(3).to_list(3)
    for b in top:
        below = await db.mall_bookings.count_documents({"position": {"$gt": b["position"]}, "status": "mining"})
        print(f"  pos {b['position']:>2} {b['product_name'][:25]:<25} → rate {4*(1+below)} PRC/day")

if __name__ == "__main__":
    asyncio.run(main())
