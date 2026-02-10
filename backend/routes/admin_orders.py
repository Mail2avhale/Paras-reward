"""
Admin Orders Routes - Order management
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging

# Create router
router = APIRouter(prefix="/admin", tags=["Admin Orders"])

# Database reference
db = None

# Cache reference
cache = None

# Helpers
log_admin_action = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager

def set_helpers(helpers: dict):
    global log_admin_action
    log_admin_action = helpers.get('log_admin_action')


# ========== ORDER LISTING ==========

@router.get("/orders")
async def get_admin_orders(
    status: str = None,
    user_id: str = None,
    start_date: str = None,
    end_date: str = None,
    page: int = 1,
    limit: int = 50
):
    """Get orders with filtering"""
    query = {}
    
    if status:
        query["status"] = status
    if user_id:
        query["user_id"] = user_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["created_at"] = date_query
    
    skip = (page - 1) * limit
    total = await db.orders.count_documents(query)
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user info
    for order in orders:
        user_id = order.get("user_id")
        if user_id:
            user = await db.users.find_one({"uid": user_id}, {"_id": 0, "name": 1, "email": 1, "mobile": 1})
            if user:
                order["user_name"] = user.get("name")
                order["user_email"] = user.get("email")
                order["user_mobile"] = user.get("mobile")
    
    return {
        "orders": orders,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.get("/orders/stats")
async def get_order_stats():
    """Get order statistics (cached for 60 seconds)"""
    try:
        # Try cache first
        cache_key = "admin:order_stats"
        if cache:
            cached = await cache.get(cache_key)
            if cached:
                return cached
        
        total = await db.orders.count_documents({})
        pending = await db.orders.count_documents({"status": "pending"})
        verified = await db.orders.count_documents({"status": "verified"})
        out_for_delivery = await db.orders.count_documents({"status": "out_for_delivery"})
        delivered = await db.orders.count_documents({"status": "delivered"})
        cancelled = await db.orders.count_documents({"status": "cancelled"})
        
        # Today's orders
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        today_orders = await db.orders.count_documents({"created_at": {"$gte": today_start}})
        
        result = {
            "total": total,
            "pending": pending,
            "verified": verified,
            "out_for_delivery": out_for_delivery,
            "delivered": delivered,
            "cancelled": cancelled,
            "today": today_orders
        }
        
        # Cache for 60 seconds
        if cache:
            await cache.set(cache_key, result, ttl=60)
        
        return result
    except Exception as e:
        return {"error": str(e)}


@router.get("/orders/{order_id}")
async def get_order_detail(order_id: str):
    """Get order details"""
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get user info
    user_id = order.get("user_id")
    if user_id:
        user = await db.users.find_one({"uid": user_id}, {"_id": 0, "name": 1, "email": 1, "mobile": 1, "address": 1})
        order["user"] = user
    
    # Get delivery partner info
    partner_id = order.get("delivery_partner_id")
    if partner_id:
        partner = await db.delivery_partners.find_one({"partner_id": partner_id}, {"_id": 0, "name": 1, "phone": 1})
        order["delivery_partner"] = partner
    
    return order


# ========== ORDER ACTIONS ==========

@router.post("/orders/{order_id}/verify")
async def verify_order(order_id: str, request: Request):
    """Verify an order"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot verify order with status: {order.get('status')}")
    
    now = datetime.now(timezone.utc)
    
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "status": "verified",
            "verified_at": now.isoformat(),
            "verified_by": admin_id
        }}
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="order_verified",
            entity_type="order",
            entity_id=order_id
        )
    
    return {"success": True, "message": "Order verified"}


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, request: Request):
    """Cancel an order"""
    data = await request.json()
    admin_id = data.get("admin_id")
    reason = data.get("reason", "Cancelled by admin")
    refund = data.get("refund", True)
    
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("status") in ["delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order with status: {order.get('status')}")
    
    now = datetime.now(timezone.utc)
    
    # Refund PRC if requested
    if refund and order.get("total_prc"):
        user_id = order.get("user_id")
        refund_amount = order.get("total_prc", 0)
        
        await db.users.update_one(
            {"uid": user_id},
            {"$inc": {"prc_balance": refund_amount}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": f"REF{now.strftime('%Y%m%d%H%M%S')}",
            "user_id": user_id,
            "type": "order_refund",
            "amount": refund_amount,
            "description": f"Refund for cancelled order {order_id}",
            "reference_id": order_id,
            "created_at": now.isoformat()
        })
    
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now.isoformat(),
            "cancelled_by": admin_id,
            "cancellation_reason": reason,
            "refunded": refund
        }}
    )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="order_cancelled",
            entity_type="order",
            entity_id=order_id,
            details={"reason": reason, "refunded": refund}
        )
    
    return {"success": True, "message": "Order cancelled", "refunded": refund}


@router.put("/orders/{order_id}")
async def update_order(order_id: str, request: Request):
    """Update order details"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    allowed_fields = ["status", "delivery_address", "delivery_notes", "delivery_date"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = admin_id
    
    await db.orders.update_one({"order_id": order_id}, {"$set": update_data})
    
    return {"success": True, "message": "Order updated"}


# ========== BULK OPERATIONS ==========

@router.post("/orders/bulk-verify")
async def bulk_verify_orders(request: Request):
    """Verify multiple orders"""
    data = await request.json()
    admin_id = data.get("admin_id")
    order_ids = data.get("order_ids", [])
    
    if not order_ids:
        raise HTTPException(status_code=400, detail="No order IDs provided")
    
    now = datetime.now(timezone.utc)
    
    result = await db.orders.update_many(
        {"order_id": {"$in": order_ids}, "status": "pending"},
        {"$set": {
            "status": "verified",
            "verified_at": now.isoformat(),
            "verified_by": admin_id
        }}
    )
    
    return {"success": True, "verified_count": result.modified_count}


@router.post("/orders/bulk-assign")
async def bulk_assign_delivery(request: Request):
    """Assign delivery partner to multiple orders"""
    data = await request.json()
    admin_id = data.get("admin_id")
    order_ids = data.get("order_ids", [])
    partner_id = data.get("partner_id")
    
    if not order_ids or not partner_id:
        raise HTTPException(status_code=400, detail="Order IDs and partner ID required")
    
    partner = await db.delivery_partners.find_one({"partner_id": partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    now = datetime.now(timezone.utc)
    
    result = await db.orders.update_many(
        {"order_id": {"$in": order_ids}, "status": "verified"},
        {"$set": {
            "status": "out_for_delivery",
            "delivery_partner_id": partner_id,
            "delivery_partner_name": partner.get("name"),
            "assigned_at": now.isoformat(),
            "assigned_by": admin_id
        }}
    )
    
    return {"success": True, "assigned_count": result.modified_count}
