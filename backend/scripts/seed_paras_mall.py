"""
Paras Mall — Product Seeder + AI Image Generator (Nano Banana)
===============================================================
One-off script: seeds 47 products with Gemini Nano Banana images.

Run: cd /app/backend && python scripts/seed_paras_mall.py
"""

import asyncio
import base64
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("seed_mall")

PRODUCTS = [
    ("Smartphone", 15000, "electronics"),
    ("Laptop", 50000, "electronics"),
    ("Refrigerator", 25000, "appliances"),
    ("Washing Machine", 22000, "appliances"),
    ("Microwave Oven", 12000, "appliances"),
    ("Air Cooler", 10000, "appliances"),
    ("Inverter", 18000, "appliances"),
    ("Air Conditioner", 40000, "appliances"),
    ("Furniture Set", 50000, "furniture"),
    ("Flour Mill", 18000, "appliances"),
    ("Smart TV", 35000, "electronics"),
    ("Water Purifier RO", 15000, "appliances"),
    ("Mixer Grinder", 5000, "kitchen"),
    ("Gas Stove", 6000, "kitchen"),
    ("Kitchen Chimney", 15000, "kitchen"),
    ("Vacuum Cleaner", 12000, "appliances"),
    ("Ceiling Fan", 3500, "appliances"),
    ("Water Heater Geyser", 8000, "appliances"),
    ("Dining Table Set", 30000, "furniture"),
    ("Sofa Set", 45000, "furniture"),
    ("Double Bed", 35000, "furniture"),
    ("Wardrobe", 25000, "furniture"),
    ("Electric Bike", 120000, "vehicles"),
    ("Water Storage Tank", 12000, "home"),
    ("Pressure Cooker Set", 5000, "kitchen"),
    ("Non-Stick Cookware Set", 8000, "kitchen"),
    ("Kitchen Storage Cabinet", 20000, "furniture"),
    ("Home Study Set", 15000, "furniture"),
    ("Iron Press", 2500, "appliances"),
    ("Sewing Machine", 12000, "appliances"),
    ("Air Fryer", 8000, "kitchen"),
    ("Juicer Machine", 6000, "kitchen"),
    ("Coffee Maker", 7000, "kitchen"),
    ("Dishwasher", 40000, "appliances"),
    ("Home Security CCTV Kit", 20000, "electronics"),
    ("Gold Coin", 20000, "jewelry"),
    ("Silver Coin", 20000, "jewelry"),
    ("Kitchen Appliance Combo", 35000, "kitchen"),
    ("Grocery Voucher", 10000, "vouchers"),
    ("Amazon Shopping Voucher", 25000, "vouchers"),
    ("Flipkart Shopping Voucher", 25000, "vouchers"),
    ("Home Solar Kit", 150000, "home"),
    ("EMI Support Voucher", 25000, "vouchers"),
]

# Image style prompt template — premium, ecommerce look
PROMPT_TEMPLATE = (
    "Studio product photograph of a {name}, premium e-commerce style, "
    "shot on a clean pure white seamless background, soft diffused lighting, "
    "centered composition, photorealistic, ultra detailed, 4k quality, "
    "no text, no watermark, no logo. Indian market context."
)


async def generate_image(product_name: str) -> str | None:
    """Generate one product image via Gemini Nano Banana. Returns image URL (data URI)."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            log.error("EMERGENT_LLM_KEY missing in env")
            return None
        chat = LlmChat(
            api_key=api_key,
            session_id=f"mall-seed-{uuid.uuid4()}",
            system_message="You are an expert product photographer.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
            modalities=["image", "text"]
        )
        msg = UserMessage(text=PROMPT_TEMPLATE.format(name=product_name))
        _, images = await chat.send_message_multimodal_response(msg)
        if not images:
            log.warning(f"No image returned for {product_name}")
            return None
        img = images[0]
        mime = img.get("mime_type", "image/png")
        # Save under public/ so frontend can serve it directly
        out_dir = Path("/app/backend/static/mall")
        out_dir.mkdir(parents=True, exist_ok=True)
        safe = product_name.lower().replace(" ", "_")
        out_path = out_dir / f"{safe}.png"
        out_path.write_bytes(base64.b64decode(img["data"]))
        # Return relative API path (server mounts /api/static separately)
        return f"/api/static/mall/{safe}.png"
    except Exception as e:
        log.error(f"image gen failed for {product_name}: {e}")
        return None


async def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    mc = AsyncIOMotorClient(mongo_url)
    db = mc[db_name]

    log.info(f"Seeding {len(PRODUCTS)} products to {db_name}.mall_products...")

    created = 0
    skipped = 0
    for idx, (name, mrp, category) in enumerate(PRODUCTS, 1):
        existing = await db.mall_products.find_one({"name": name})
        if existing:
            log.info(f"[{idx}/{len(PRODUCTS)}] skip (exists): {name}")
            skipped += 1
            continue

        log.info(f"[{idx}/{len(PRODUCTS)}] generating image: {name}")
        image_url = await generate_image(name)
        if image_url is None:
            log.warning(f"  → no image, using placeholder")
            image_url = "/api/static/mall/placeholder.png"

        product = {
            "product_id": str(uuid.uuid4()),
            "name": name,
            "mrp_inr": mrp,
            "category": category,
            "image_url": image_url,
            "description": f"Premium {name} — book with PRC and unlock via daily mining.",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.mall_products.insert_one(product)
        created += 1
        log.info(f"  → ✓ saved")

        # Light throttle between API calls
        await asyncio.sleep(0.5)

    log.info(f"DONE — created: {created}, skipped: {skipped}")


if __name__ == "__main__":
    asyncio.run(main())
