"""
PARAS REWARD - Gift Subscription Feature
=========================================

Parent user can gift 24-hour Elite subscription to their L1 (direct) referrals.

Rules:
- Cost: 600 PRC from parent
- Duration: 24 hours
- Plan: Elite features
- Only unsubscribed children can receive
- Multiple gifts allowed
- Child gets notification
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

router = APIRouter(prefix="/gift", tags=["Gift Subscription"])

# Database connection (imported from server.py context)
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "test_database")

def get_db():
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]

# Constants
GIFT_PRC_COST = 600
GIFT_DURATION_HOURS = 24
GIFT_PLAN = "elite"  # Child gets Elite features


class GiftSubscriptionRequest(BaseModel):
    parent_uid: str
    child_uid: str


class GiftSubscriptionResponse(BaseModel):
    success: bool
    message: str
    gift_details: Optional[dict] = None


@router.get("/eligible-referrals/{parent_uid}")
async def get_eligible_referrals(parent_uid: str):
    """
    Get list of L1 referrals who can receive gift subscription.
    Only shows unsubscribed (explorer/free) users.
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    
    # Verify parent exists
    parent = await db.users.find_one({"uid": parent_uid})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent user not found")
    
    parent_prc = parent.get("prc_balance", 0)
    
    # Get L1 referrals (direct referrals)
    l1_referrals = await db.users.find(
        {"referred_by": parent_uid},
        {
            "_id": 0,
            "uid": 1,
            "name": 1,
            "email": 1,
            "mobile": 1,
            "subscription_plan": 1,
            "subscription_expiry": 1,
            "subscription_expires": 1,
            "vip_expiry": 1,
            "created_at": 1,
            "last_login": 1
        }
    ).to_list(None)
    
    eligible = []
    ineligible = []
    
    for ref in l1_referrals:
        # Check if subscription is active
        is_subscribed = False
        expiry_date = None
        
        for field in ['subscription_expiry', 'subscription_expires', 'vip_expiry']:
            expiry = ref.get(field)
            if expiry:
                try:
                    if isinstance(expiry, str):
                        expiry_dt = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
                    else:
                        expiry_dt = expiry
                    
                    if expiry_dt.tzinfo is None:
                        expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
                    
                    if expiry_dt > now:
                        is_subscribed = True
                        expiry_date = expiry_dt.isoformat()
                        break
                except:
                    continue
        
        plan = (ref.get('subscription_plan') or 'explorer').lower()
        
        user_info = {
            "uid": ref.get("uid"),
            "name": ref.get("name", "Unknown"),
            "email": ref.get("email", ""),
            "mobile": ref.get("mobile", ""),
            "subscription_plan": plan,
            "is_subscribed": is_subscribed,
            "expiry_date": expiry_date,
            "created_at": ref.get("created_at"),
            "last_login": ref.get("last_login")
        }
        
        # Only unsubscribed users are eligible
        if not is_subscribed or plan in ['explorer', 'free', '', None]:
            eligible.append(user_info)
        else:
            ineligible.append(user_info)
    
    return {
        "success": True,
        "parent_uid": parent_uid,
        "parent_prc_balance": parent_prc,
        "gift_cost": GIFT_PRC_COST,
        "gift_duration_hours": GIFT_DURATION_HOURS,
        "can_afford": parent_prc >= GIFT_PRC_COST,
        "eligible_count": len(eligible),
        "ineligible_count": len(ineligible),
        "eligible_referrals": eligible,
        "ineligible_referrals": ineligible
    }


@router.post("/send")
async def send_gift_subscription(request: GiftSubscriptionRequest):
    """
    Gift 24-hour Elite subscription to a L1 referral.
    
    Process:
    1. Verify parent has 600+ PRC
    2. Verify child is parent's L1 referral
    3. Verify child is not already subscribed
    4. Deduct 600 PRC from parent
    5. Activate 24hr Elite subscription for child
    6. Create notification for child
    7. Log transaction
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    
    # Step 1: Verify parent
    parent = await db.users.find_one({"uid": request.parent_uid})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent user not found")
    
    parent_prc = parent.get("prc_balance", 0)
    if parent_prc < GIFT_PRC_COST:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient PRC balance. Need {GIFT_PRC_COST} PRC, have {parent_prc} PRC"
        )
    
    # Step 2: Verify child exists and is L1 referral
    child = await db.users.find_one({"uid": request.child_uid})
    if not child:
        raise HTTPException(status_code=404, detail="Child user not found")
    
    if child.get("referred_by") != request.parent_uid:
        raise HTTPException(
            status_code=400, 
            detail="This user is not your direct referral (Level 1)"
        )
    
    # Step 3: Check child is not already subscribed
    child_subscribed = False
    for field in ['subscription_expiry', 'subscription_expires', 'vip_expiry']:
        expiry = child.get(field)
        if expiry:
            try:
                if isinstance(expiry, str):
                    expiry_dt = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
                else:
                    expiry_dt = expiry
                
                if expiry_dt.tzinfo is None:
                    expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
                
                if expiry_dt > now:
                    child_subscribed = True
                    break
            except:
                continue
    
    child_plan = (child.get('subscription_plan') or 'explorer').lower()
    if child_subscribed and child_plan not in ['explorer', 'free', '', None]:
        raise HTTPException(
            status_code=400,
            detail="This user already has an active subscription"
        )
    
    # Step 4: Deduct PRC from parent
    new_parent_prc = parent_prc - GIFT_PRC_COST
    
    gift_id = f"GIFT_{int(now.timestamp() * 1000)}"
    new_expiry = now + timedelta(hours=GIFT_DURATION_HOURS)
    
    await db.users.update_one(
        {"uid": request.parent_uid},
        {
            "$set": {"prc_balance": new_parent_prc},
            "$push": {
                "prc_transactions": {
                    "type": "gift_subscription",
                    "amount": -GIFT_PRC_COST,
                    "recipient_uid": request.child_uid,
                    "recipient_name": child.get("name", "Unknown"),
                    "gift_id": gift_id,
                    "timestamp": now.isoformat()
                }
            }
        }
    )
    
    # Step 5: Activate subscription for child
    await db.users.update_one(
        {"uid": request.child_uid},
        {
            "$set": {
                "subscription_plan": GIFT_PLAN,
                "subscription_expiry": new_expiry.isoformat(),
                "subscription_expires": new_expiry.isoformat(),
                "gift_subscription": True,
                "gift_from": request.parent_uid,
                "gift_from_name": parent.get("name", "Unknown"),
                "gift_activated_at": now.isoformat()
            },
            "$push": {
                "subscription_history": {
                    "type": "gift_received",
                    "plan": GIFT_PLAN,
                    "duration_hours": GIFT_DURATION_HOURS,
                    "from_uid": request.parent_uid,
                    "from_name": parent.get("name", "Unknown"),
                    "gift_id": gift_id,
                    "activated_at": now.isoformat(),
                    "expires_at": new_expiry.isoformat()
                }
            }
        }
    )
    
    # Step 6: Create notification for child
    await db.notifications.insert_one({
        "user_id": request.child_uid,
        "type": "gift_subscription",
        "title": "🎁 Gift Subscription Received!",
        "message": f"{parent.get('name', 'Someone')} ने तुम्हाला 24 तासांची Elite subscription gift केली!",
        "data": {
            "gift_id": gift_id,
            "from_uid": request.parent_uid,
            "from_name": parent.get("name", "Unknown"),
            "plan": GIFT_PLAN,
            "duration_hours": GIFT_DURATION_HOURS,
            "expires_at": new_expiry.isoformat()
        },
        "read": False,
        "created_at": now.isoformat()
    })
    
    # Step 7: Log the gift transaction
    await db.gift_transactions.insert_one({
        "gift_id": gift_id,
        "parent_uid": request.parent_uid,
        "parent_name": parent.get("name"),
        "child_uid": request.child_uid,
        "child_name": child.get("name"),
        "prc_cost": GIFT_PRC_COST,
        "plan": GIFT_PLAN,
        "duration_hours": GIFT_DURATION_HOURS,
        "activated_at": now.isoformat(),
        "expires_at": new_expiry.isoformat(),
        "status": "active"
    })
    
    logging.info(f"[Gift] {request.parent_uid} gifted 24hr Elite to {request.child_uid}")
    
    return {
        "success": True,
        "message": f"Successfully gifted 24-hour Elite subscription!",
        "gift_details": {
            "gift_id": gift_id,
            "recipient_name": child.get("name", "Unknown"),
            "recipient_uid": request.child_uid,
            "plan": GIFT_PLAN,
            "duration_hours": GIFT_DURATION_HOURS,
            "prc_deducted": GIFT_PRC_COST,
            "parent_new_balance": new_parent_prc,
            "expires_at": new_expiry.isoformat()
        }
    }


@router.get("/history/{user_uid}")
async def get_gift_history(user_uid: str):
    """Get gift subscription history for a user (sent and received)."""
    db = get_db()
    
    # Gifts sent by this user
    sent = await db.gift_transactions.find(
        {"parent_uid": user_uid},
        {"_id": 0}
    ).sort("activated_at", -1).to_list(50)
    
    # Gifts received by this user
    received = await db.gift_transactions.find(
        {"child_uid": user_uid},
        {"_id": 0}
    ).sort("activated_at", -1).to_list(50)
    
    return {
        "success": True,
        "user_uid": user_uid,
        "sent_count": len(sent),
        "received_count": len(received),
        "gifts_sent": sent,
        "gifts_received": received
    }
