#!/usr/bin/env python3
"""Update treasure hunts with multiple treasure locations"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone

async def update_hunts():
    # Connect to MongoDB
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("Updating treasure hunts with multiple treasure locations...")
    
    # Delete old hunts
    result = await db.treasure_hunts.delete_many({})
    print(f"Deleted {result.deleted_count} old hunts")
    
    # Create new hunts with multiple treasure locations
    new_hunts = [
        {
            "hunt_id": "hunt_001",
            "title": "Beginner's Fortune",
            "description": "Find the hidden treasure in the ancient garden. Perfect for new treasure hunters!",
            "difficulty": "easy",
            "prc_cost": 10,
            "reward_prc": 50,
            "cashback_percentage": 50,
            "total_clues": 3,
            "clue_cost": 5,
            "treasure_locations": [
                {"id": 1, "x": 20, "y": 30, "is_treasure": True, "message": "🎉 Congratulations! You found the treasure!"},
                {"id": 2, "x": 45, "y": 60, "is_treasure": True, "message": "🎉 Congratulations! You found the treasure!"},
                {"id": 3, "x": 70, "y": 40, "is_treasure": True, "message": "🎉 Congratulations! You found the treasure!"},
                {"id": 4, "x": 35, "y": 75, "is_treasure": False, "message": "Try another location!"},
                {"id": 5, "x": 60, "y": 20, "is_treasure": False, "message": "Not here either!"},
                {"id": 6, "x": 15, "y": 55, "is_treasure": False, "message": "Nothing here..."},
                {"id": 7, "x": 80, "y": 25, "is_treasure": False, "message": "Keep searching!"},
                {"id": 8, "x": 50, "y": 85, "is_treasure": False, "message": "Empty spot!"},
                {"id": 9, "x": 25, "y": 45, "is_treasure": False, "message": "Try again!"},
                {"id": 10, "x": 65, "y": 70, "is_treasure": False, "message": "Not the right place!"}
            ],
            "clues": [
                "The treasure lies where flowers bloom the brightest.",
                "Look near the center of the map, slightly to the right.",
                "The X and Y coordinates are both between 40 and 60."
            ],
            "time_limit_minutes": 30,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "hunt_id": "hunt_002",
            "title": "Mystic Cave Challenge",
            "description": "Venture deep into the mysterious caves. Are you brave enough?",
            "difficulty": "medium",
            "prc_cost": 25,
            "reward_prc": 120,
            "cashback_percentage": 50,
            "total_clues": 4,
            "clue_cost": 5,
            "treasure_locations": [
                {"id": 1, "x": 15, "y": 85, "is_treasure": True, "message": "💎 Amazing! You discovered the mystic gem!"},
                {"id": 2, "x": 80, "y": 65, "is_treasure": True, "message": "💎 Amazing! You discovered the mystic gem!"},
                {"id": 3, "x": 50, "y": 50, "is_treasure": True, "message": "💎 Amazing! You discovered the mystic gem!"},
                {"id": 4, "x": 30, "y": 20, "is_treasure": True, "message": "💎 Amazing! You discovered the mystic gem!"},
                {"id": 5, "x": 65, "y": 40, "is_treasure": False, "message": "Just rocks here..."},
                {"id": 6, "x": 40, "y": 70, "is_treasure": False, "message": "Nothing of value..."},
                {"id": 7, "x": 25, "y": 55, "is_treasure": False, "message": "Keep looking!"},
                {"id": 8, "x": 75, "y": 30, "is_treasure": False, "message": "Try elsewhere!"},
                {"id": 9, "x": 55, "y": 80, "is_treasure": False, "message": "Empty cave chamber..."},
                {"id": 10, "x": 20, "y": 45, "is_treasure": False, "message": "Dark corner..."},
                {"id": 11, "x": 85, "y": 50, "is_treasure": False, "message": "No treasure here!"},
                {"id": 12, "x": 45, "y": 25, "is_treasure": False, "message": "Wrong spot!"}
            ],
            "clues": [
                "The treasure is hidden in the eastern section of the cave.",
                "It's positioned high up, near the top of the map.",
                "Look for coordinates above 60 on both axes.",
                "The treasure X coordinate is greater than 75."
            ],
            "time_limit_minutes": 45,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "hunt_id": "hunt_003",
            "title": "Dragon's Lair Expedition",
            "description": "Only the bravest can find the dragon's hidden treasure hoard!",
            "difficulty": "hard",
            "prc_cost": 50,
            "reward_prc": 300,
            "cashback_percentage": 50,
            "total_clues": 5,
            "clue_cost": 5,
            "treasure_locations": [
                {"id": 1, "x": 10, "y": 10, "is_treasure": True, "message": "🐉 LEGENDARY! You found the Dragon's Hoard!"},
                {"id": 2, "x": 90, "y": 90, "is_treasure": False, "message": "Wrong corner!"},
                {"id": 3, "x": 55, "y": 45, "is_treasure": True, "message": "🐉 LEGENDARY! You found the Dragon's Hoard!"},
                {"id": 4, "x": 30, "y": 80, "is_treasure": False, "message": "Just dragon scales..."},
                {"id": 5, "x": 75, "y": 25, "is_treasure": True, "message": "🐉 LEGENDARY! You found the Dragon's Hoard!"},
                {"id": 6, "x": 20, "y": 60, "is_treasure": True, "message": "🐉 LEGENDARY! You found the Dragon's Hoard!"},
                {"id": 7, "x": 85, "y": 50, "is_treasure": True, "message": "🐉 LEGENDARY! You found the Dragon's Hoard!"},
                {"id": 8, "x": 40, "y": 35, "is_treasure": False, "message": "Not quite..."},
                {"id": 9, "x": 65, "y": 70, "is_treasure": False, "message": "Try again!"},
                {"id": 10, "x": 50, "y": 15, "is_treasure": False, "message": "Almost there..."},
                {"id": 11, "x": 15, "y": 75, "is_treasure": False, "message": "The dragon isn't here..."},
                {"id": 12, "x": 80, "y": 35, "is_treasure": False, "message": "Empty chamber..."},
                {"id": 13, "x": 35, "y": 50, "is_treasure": False, "message": "Nothing but bones..."},
                {"id": 14, "x": 60, "y": 80, "is_treasure": False, "message": "Keep searching!"},
                {"id": 15, "x": 25, "y": 25, "is_treasure": False, "message": "Wrong path!"}
            ],
            "clues": [
                "The dragon guards its treasure in the heart of the lair.",
                "Look near the center, but not exactly at 50,50.",
                "Both coordinates are between 40 and 60.",
                "The Y coordinate is less than the X coordinate.",
                "The treasure is within 10 units of coordinates 55,45."
            ],
            "time_limit_minutes": 60,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    result = await db.treasure_hunts.insert_many(new_hunts)
    print(f"Created {len(result.inserted_ids)} new hunts")
    
    # Verify
    hunts = await db.treasure_hunts.find({}).to_list(length=10)
    for hunt in hunts:
        treasure_count = sum(1 for loc in hunt["treasure_locations"] if loc.get("is_treasure", False))
        print(f"  {hunt['hunt_id']}: {len(hunt['treasure_locations'])} locations, {treasure_count} potential treasures")
    
    print("\n✅ Treasure hunts updated successfully!")
    client.close()

if __name__ == "__main__":
    asyncio.run(update_hunts())
