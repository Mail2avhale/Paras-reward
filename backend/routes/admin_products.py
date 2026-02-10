"""
Admin Products Routes - Product and marketplace management
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import uuid
import logging

# Create router
router = APIRouter(prefix="/admin", tags=["Admin Products"])

# Database reference
db = None

def set_db(database):
    global db
    db = database


# ========== PRODUCTS CRUD ==========

@router.get("/products")
async def get_admin_products(
    category: str = None,
    status: str = None,
    page: int = 1,
    limit: int = 50
):
    """Get products with filtering"""
    query = {}
    if category:
        query["category"] = category
    if status == "active":
        query["is_active"] = True
    elif status == "inactive":
        query["is_active"] = False
    
    skip = (page - 1) * limit
    total = await db.products.count_documents(query)
    
    products = await db.products.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "products": products,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.post("/products")
async def create_product(request: Request):
    """Create a new product"""
    data = await request.json()
    
    product = {
        "product_id": str(uuid.uuid4()),
        "name": data.get("name"),
        "description": data.get("description", ""),
        "category": data.get("category", "general"),
        "prc_price": float(data.get("prc_price", 0)),
        "inr_price": float(data.get("inr_price", 0)),
        "stock": int(data.get("stock", 0)),
        "image_url": data.get("image_url"),
        "images": data.get("images", []),
        "is_active": data.get("is_active", True),
        "specifications": data.get("specifications", {}),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": data.get("admin_id")
    }
    
    await db.products.insert_one(product)
    product.pop("_id", None)
    
    return {"success": True, "product": product}


@router.get("/products/{product_id}")
async def get_product_detail(product_id: str):
    """Get product details"""
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get order count for this product
    order_count = await db.orders.count_documents({"product_id": product_id})
    product["order_count"] = order_count
    
    return product


@router.put("/products/{product_id}")
async def update_product(product_id: str, request: Request):
    """Update product details"""
    data = await request.json()
    
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    allowed_fields = [
        "name", "description", "category", "prc_price", "inr_price",
        "stock", "image_url", "images", "is_active", "specifications"
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = data.get("admin_id")
    
    await db.products.update_one({"product_id": product_id}, {"$set": update_data})
    
    return {"success": True, "message": "Product updated"}


@router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    """Delete (deactivate) a product"""
    result = await db.products.update_one(
        {"product_id": product_id},
        {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return {"success": True, "message": "Product deleted"}


@router.post("/products/{product_id}/stock")
async def update_product_stock(product_id: str, request: Request):
    """Update product stock"""
    data = await request.json()
    adjustment = int(data.get("adjustment", 0))
    reason = data.get("reason", "Manual adjustment")
    
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    new_stock = product.get("stock", 0) + adjustment
    if new_stock < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")
    
    await db.products.update_one(
        {"product_id": product_id},
        {"$set": {"stock": new_stock, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log stock change
    await db.stock_logs.insert_one({
        "product_id": product_id,
        "previous_stock": product.get("stock", 0),
        "adjustment": adjustment,
        "new_stock": new_stock,
        "reason": reason,
        "admin_id": data.get("admin_id"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "new_stock": new_stock}


# ========== MARKETPLACE SETTINGS ==========

@router.get("/settings/marketplace")
async def get_marketplace_settings():
    """Get marketplace settings"""
    settings = await db.settings.find_one({"key": "marketplace"}, {"_id": 0})
    return settings or {
        "key": "marketplace",
        "enabled": True,
        "min_order_prc": 10,
        "max_order_prc": 10000
    }


@router.put("/settings/marketplace")
async def update_marketplace_settings(request: Request):
    """Update marketplace settings"""
    data = await request.json()
    
    await db.settings.update_one(
        {"key": "marketplace"},
        {"$set": {
            "key": "marketplace",
            "enabled": data.get("enabled", True),
            "min_order_prc": data.get("min_order_prc", 10),
            "max_order_prc": data.get("max_order_prc", 10000),
            "delivery_enabled": data.get("delivery_enabled", True),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Marketplace settings updated"}


# ========== REDEMPTION SETTINGS ==========

@router.get("/settings/redemption-rules")
async def get_redemption_rules():
    """Get redemption rules"""
    rules = await db.settings.find_one({"key": "redemption_rules"}, {"_id": 0})
    return rules or {
        "key": "redemption_rules",
        "min_prc": 100,
        "max_prc_per_day": 1000,
        "service_charge_percent": 5
    }


@router.put("/settings/redemption-rules")
async def update_redemption_rules(request: Request):
    """Update redemption rules"""
    data = await request.json()
    
    await db.settings.update_one(
        {"key": "redemption_rules"},
        {"$set": {
            "key": "redemption_rules",
            "min_prc": data.get("min_prc", 100),
            "max_prc_per_day": data.get("max_prc_per_day", 1000),
            "service_charge_percent": data.get("service_charge_percent", 5),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Redemption rules updated"}


@router.get("/settings/redeem-limits")
async def get_redeem_limits():
    """Get redeem limits"""
    limits = await db.settings.find_one({"key": "redeem_limits"}, {"_id": 0})
    return limits or {"key": "redeem_limits", "daily_limit": 1000, "monthly_limit": 10000}


@router.put("/settings/redeem-limits")
async def update_redeem_limits(request: Request):
    """Update redeem limits"""
    data = await request.json()
    
    await db.settings.update_one(
        {"key": "redeem_limits"},
        {"$set": {
            "key": "redeem_limits",
            "daily_limit": data.get("daily_limit", 1000),
            "monthly_limit": data.get("monthly_limit", 10000),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Redeem limits updated"}


@router.get("/user/{uid}/redeem-limit")
async def get_user_redeem_limit(uid: str):
    """Get user's redemption limit status"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    limits = await db.settings.find_one({"key": "redeem_limits"}, {"_id": 0})
    daily_limit = limits.get("daily_limit", 1000) if limits else 1000
    monthly_limit = limits.get("monthly_limit", 10000) if limits else 10000
    
    # Calculate today's redemptions
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_redeemed = await db.transactions.aggregate([
        {"$match": {
            "user_id": uid,
            "type": {"$in": ["bill_payment", "gift_voucher", "order"]},
            "created_at": {"$gte": today_start}
        }},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
    ]).to_list(1)
    
    # Calculate this month's redemptions
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    month_redeemed = await db.transactions.aggregate([
        {"$match": {
            "user_id": uid,
            "type": {"$in": ["bill_payment", "gift_voucher", "order"]},
            "created_at": {"$gte": month_start}
        }},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
    ]).to_list(1)
    
    today_used = round(today_redeemed[0]["total"], 2) if today_redeemed else 0
    month_used = round(month_redeemed[0]["total"], 2) if month_redeemed else 0
    
    return {
        "daily": {
            "limit": daily_limit,
            "used": today_used,
            "remaining": max(0, daily_limit - today_used)
        },
        "monthly": {
            "limit": monthly_limit,
            "used": month_used,
            "remaining": max(0, monthly_limit - month_used)
        }
    }
