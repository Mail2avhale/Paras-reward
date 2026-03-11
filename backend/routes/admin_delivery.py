"""
Admin Delivery Routes - Delivery partners and order management
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import logging

# Create router
router = APIRouter(prefix="/admin", tags=["Admin Delivery"])

# Database reference
db = None

# Models reference
DeliveryPartner = None
DeliveryPartnerCreate = None

def set_db(database):
    global db
    db = database

def set_models(models: dict):
    global DeliveryPartner, DeliveryPartnerCreate
    DeliveryPartner = models.get('DeliveryPartner')
    DeliveryPartnerCreate = models.get('DeliveryPartnerCreate')


# ========== DELIVERY PARTNERS ==========

@router.get("/delivery-partners")
async def get_delivery_partners(status: str = "all", page: int = 1, limit: int = 20):
    """Get all delivery partners with optional filtering"""
    query = {}
    if status == "active":
        query["is_active"] = True
    elif status == "inactive":
        query["is_active"] = False
    elif status == "verified":
        query["is_verified"] = True
    
    skip = (page - 1) * limit
    
    partners = await db.delivery_partners.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(1000)
    total = await db.delivery_partners.count_documents(query)
    
    for partner in partners:
        partner.pop("_id", None)
        if isinstance(partner.get("created_at"), datetime):
            partner["created_at"] = partner["created_at"].isoformat()
        if isinstance(partner.get("updated_at"), datetime):
            partner["updated_at"] = partner["updated_at"].isoformat()
    
    return {
        "partners": partners,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.get("/delivery-partners/stats")
async def get_delivery_partner_stats():
    """Get delivery partner statistics"""
    total_partners = await db.delivery_partners.count_documents({})
    active_partners = await db.delivery_partners.count_documents({"is_active": True})
    verified_partners = await db.delivery_partners.count_documents({"is_verified": True})
    
    pending_orders = await db.orders.count_documents({
        "status": "pending",
        "delivery_partner_id": None
    })
    out_for_delivery = await db.orders.count_documents({"status": "out_for_delivery"})
    
    return {
        "total_partners": total_partners,
        "active_partners": active_partners,
        "verified_partners": verified_partners,
        "pending_assignment": pending_orders,
        "out_for_delivery": out_for_delivery
    }


@router.get("/delivery-partners/{partner_id}")
async def get_delivery_partner(partner_id: str):
    """Get single delivery partner details"""
    partner = await db.delivery_partners.find_one({"partner_id": partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    partner.pop("_id", None)
    if isinstance(partner.get("created_at"), datetime):
        partner["created_at"] = partner["created_at"].isoformat()
    if isinstance(partner.get("updated_at"), datetime):
        partner["updated_at"] = partner["updated_at"].isoformat()
    
    recent_orders = await db.orders.find(
        {"delivery_partner_id": partner_id}
    ).sort("created_at", -1).limit(10).to_list(1000)
    
    for order in recent_orders:
        order.pop("_id", None)
    
    return {
        "partner": partner,
        "recent_orders": recent_orders
    }


@router.post("/delivery-partners")
async def create_delivery_partner(request: Request):
    """Create a new delivery partner"""
    data = await request.json()
    
    partner_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    partner_data = {
        "partner_id": partner_id,
        "name": data.get("name"),
        "company_name": data.get("company_name"),
        "phone": data.get("phone"),
        "email": data.get("email"),
        "service_states": data.get("service_states", []),
        "service_districts": data.get("service_districts", []),
        "commission_type": data.get("commission_type", "percentage"),
        "commission_rate": data.get("commission_rate", 10),
        "is_active": True,
        "is_verified": False,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.delivery_partners.insert_one(partner_data)
    partner_data.pop("_id", None)
    
    return {
        "message": "Delivery partner created successfully",
        "partner_id": partner_id,
        "partner": partner_data
    }


@router.put("/delivery-partners/{partner_id}")
async def update_delivery_partner(partner_id: str, request: Request):
    """Update delivery partner details"""
    data = await request.json()
    
    partner = await db.delivery_partners.find_one({"partner_id": partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    allowed_fields = [
        "name", "company_name", "phone", "email", 
        "service_states", "service_districts",
        "is_active", "is_verified",
        "commission_type", "commission_rate"
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.delivery_partners.update_one(
        {"partner_id": partner_id},
        {"$set": update_data}
    )
    
    return {"message": "Delivery partner updated successfully"}


@router.delete("/delivery-partners/{partner_id}")
async def delete_delivery_partner(partner_id: str):
    """Delete a delivery partner (soft delete)"""
    partner = await db.delivery_partners.find_one({"partner_id": partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    pending_orders = await db.orders.count_documents({
        "delivery_partner_id": partner_id,
        "status": {"$in": ["pending", "verified", "out_for_delivery"]}
    })
    
    if pending_orders > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete partner with {pending_orders} pending orders. Reassign orders first."
        )
    
    await db.delivery_partners.update_one(
        {"partner_id": partner_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Delivery partner deactivated successfully"}


@router.get("/delivery-partners/available/{state}")
async def get_available_partners_by_state(state: str):
    """Get available delivery partners for a state"""
    partners = await db.delivery_partners.find({
        "is_active": True,
        "is_verified": True,
        "$or": [
            {"service_states": state},
            {"service_states": {"$in": [state, "all", "All"]}}
        ]
    }, {"_id": 0, "partner_id": 1, "name": 1, "company_name": 1, "commission_rate": 1}).to_list(1000)
    
    return {"partners": partners, "count": len(partners)}


# ========== ORDER MANAGEMENT ==========

@router.post("/orders/{order_id}/assign-partner")
async def assign_delivery_partner(order_id: str, request: Request):
    """Assign delivery partner to an order"""
    data = await request.json()
    partner_id = data.get("partner_id")
    admin_id = data.get("admin_id")
    
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("status") not in ["pending", "verified"]:
        raise HTTPException(status_code=400, detail=f"Cannot assign partner to order with status: {order.get('status')}")
    
    partner = await db.delivery_partners.find_one({"partner_id": partner_id, "is_active": True})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found or inactive")
    
    now = datetime.now(timezone.utc)
    
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "delivery_partner_id": partner_id,
            "delivery_partner_name": partner.get("name"),
            "assigned_at": now.isoformat(),
            "assigned_by": admin_id,
            "status": "out_for_delivery",
            "updated_at": now.isoformat()
        }}
    )
    
    await db.activity_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "order_assigned",
        "order_id": order_id,
        "partner_id": partner_id,
        "admin_id": admin_id,
        "timestamp": now.isoformat()
    })
    
    return {
        "message": "Delivery partner assigned successfully",
        "partner_name": partner.get("name")
    }


@router.post("/orders/{order_id}/mark-delivered")
async def mark_order_delivered(order_id: str, request: Request):
    """Mark order as delivered"""
    data = await request.json()
    admin_id = data.get("admin_id")
    delivery_notes = data.get("notes", "")
    
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("status") != "out_for_delivery":
        raise HTTPException(status_code=400, detail=f"Cannot mark as delivered. Current status: {order.get('status')}")
    
    now = datetime.now(timezone.utc)
    
    # Calculate delivery partner commission
    partner_id = order.get("delivery_partner_id")
    commission = 0
    if partner_id:
        partner = await db.delivery_partners.find_one({"partner_id": partner_id})
        if partner:
            if partner.get("commission_type") == "percentage":
                commission = order.get("total_prc", 0) * (partner.get("commission_rate", 10) / 100)
            else:
                commission = partner.get("commission_rate", 0)
            
            # Credit commission to partner
            await db.delivery_partners.update_one(
                {"partner_id": partner_id},
                {
                    "$inc": {"total_commission": commission, "total_deliveries": 1},
                    "$set": {"last_delivery_at": now.isoformat()}
                }
            )
    
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "status": "delivered",
            "delivered_at": now.isoformat(),
            "delivery_notes": delivery_notes,
            "delivery_commission": commission,
            "updated_at": now.isoformat()
        }}
    )
    
    await db.activity_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "order_delivered",
        "order_id": order_id,
        "partner_id": partner_id,
        "admin_id": admin_id,
        "commission": commission,
        "timestamp": now.isoformat()
    })
    
    return {
        "message": "Order marked as delivered",
        "commission_credited": commission
    }
