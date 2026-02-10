"""
Admin Fraud Routes - Fraud detection and management
Extracted from server.py for better code organization
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

# Create router
router = APIRouter(prefix="/admin/fraud", tags=["Admin Fraud"])

# Database reference
db = None

# Helper function references
log_admin_action = None
fraud_detector = None

def set_db(database):
    global db
    db = database

def set_helpers(helpers: dict):
    global log_admin_action, fraud_detector
    log_admin_action = helpers.get('log_admin_action')
    fraud_detector = helpers.get('fraud_detector')


# ========== FRAUD DASHBOARD ==========

@router.get("/dashboard")
async def get_fraud_dashboard():
    """Get fraud detection dashboard summary"""
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        week_start = (now - timedelta(days=7)).isoformat()
        
        # Today's stats
        today_blocks = await db.fraud_blocks.count_documents({"blocked_at": {"$gte": today_start}})
        today_flags = await db.fraud_flags.count_documents({"flagged_at": {"$gte": today_start}})
        
        # Weekly stats
        week_blocks = await db.fraud_blocks.count_documents({"blocked_at": {"$gte": week_start}})
        week_flags = await db.fraud_flags.count_documents({"flagged_at": {"$gte": week_start}})
        
        # High risk users
        high_risk_users = await db.users.count_documents({"fraud_risk_level": "high"})
        
        # Recent fraud alerts
        recent_alerts = await db.fraud_alerts.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        return {
            "today": {
                "blocks": today_blocks,
                "flags": today_flags
            },
            "week": {
                "blocks": week_blocks,
                "flags": week_flags
            },
            "high_risk_users": high_risk_users,
            "recent_alerts": recent_alerts,
            "generated_at": now.isoformat()
        }
    except Exception as e:
        logging.error(f"Fraud dashboard error: {e}")
        return {"error": str(e)}


# ========== FRAUD ALERTS ==========

@router.get("/alerts")
async def get_fraud_alerts(
    severity: str = None,
    status: str = None,
    limit: int = 50,
    skip: int = 0
):
    """Get fraud alerts with filtering"""
    query = {}
    if severity:
        query["severity"] = severity
    if status:
        query["status"] = status
    
    total = await db.fraud_alerts.count_documents(query)
    alerts = await db.fraud_alerts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"alerts": alerts, "total": total, "skip": skip, "limit": limit}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_fraud_alert(alert_id: str, request: Request):
    """Resolve a fraud alert"""
    data = await request.json()
    admin_id = data.get("admin_id")
    resolution = data.get("resolution", "Investigated and resolved")
    action_taken = data.get("action_taken", "none")
    
    result = await db.fraud_alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolved_by": admin_id,
            "resolution": resolution,
            "action_taken": action_taken
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="fraud_alert_resolved",
            entity_type="fraud",
            entity_id=alert_id,
            details={"resolution": resolution, "action_taken": action_taken}
        )
    
    return {"success": True, "message": "Alert resolved"}


@router.post("/alerts/{alert_id}/escalate")
async def escalate_fraud_alert(alert_id: str, request: Request):
    """Escalate a fraud alert"""
    data = await request.json()
    admin_id = data.get("admin_id")
    notes = data.get("notes", "")
    
    result = await db.fraud_alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {
            "status": "escalated",
            "escalated_at": datetime.now(timezone.utc).isoformat(),
            "escalated_by": admin_id,
            "escalation_notes": notes
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"success": True, "message": "Alert escalated"}


# ========== FRAUD BLOCKS ==========

@router.get("/blocks")
async def get_fraud_blocks(
    block_type: str = None,
    limit: int = 50,
    skip: int = 0
):
    """Get fraud blocks (IPs, devices, etc.)"""
    query = {}
    if block_type:
        query["block_type"] = block_type
    
    total = await db.fraud_blocks.count_documents(query)
    blocks = await db.fraud_blocks.find(query, {"_id": 0}).sort("blocked_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"blocks": blocks, "total": total, "skip": skip, "limit": limit}


@router.post("/blocks")
async def add_fraud_block(request: Request):
    """Add a fraud block"""
    data = await request.json()
    admin_id = data.get("admin_id")
    
    block = {
        "block_id": f"BLK{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "block_type": data.get("block_type", "ip"),  # ip, device, aadhaar, pan
        "value": data.get("value"),
        "reason": data.get("reason", "Suspicious activity"),
        "blocked_by": admin_id,
        "blocked_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    await db.fraud_blocks.insert_one(block)
    block.pop("_id", None)
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="fraud_block_added",
            entity_type="fraud",
            details={"block_type": block["block_type"], "value": block["value"]}
        )
    
    return {"success": True, "block": block}


@router.delete("/blocks/{block_id}")
async def remove_fraud_block(block_id: str, admin_id: str):
    """Remove a fraud block"""
    result = await db.fraud_blocks.delete_one({"block_id": block_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Block not found")
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="fraud_block_removed",
            entity_type="fraud",
            entity_id=block_id
        )
    
    return {"success": True, "message": "Block removed"}


# ========== FRAUD FLAGS ==========

@router.get("/flags")
async def get_fraud_flags(
    user_id: str = None,
    flag_type: str = None,
    limit: int = 50,
    skip: int = 0
):
    """Get fraud flags"""
    query = {}
    if user_id:
        query["user_id"] = user_id
    if flag_type:
        query["flag_type"] = flag_type
    
    total = await db.fraud_flags.count_documents(query)
    flags = await db.fraud_flags.find(query, {"_id": 0}).sort("flagged_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"flags": flags, "total": total, "skip": skip, "limit": limit}


@router.post("/flags/{uid}")
async def flag_user_for_fraud(uid: str, request: Request):
    """Flag a user for fraud investigation"""
    data = await request.json()
    admin_id = data.get("admin_id")
    flag_type = data.get("flag_type", "suspicious_activity")
    notes = data.get("notes", "")
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    flag = {
        "flag_id": f"FLG{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "user_id": uid,
        "flag_type": flag_type,
        "notes": notes,
        "flagged_by": admin_id,
        "flagged_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    
    await db.fraud_flags.insert_one(flag)
    
    # Update user risk level
    await db.users.update_one(
        {"uid": uid},
        {"$set": {"fraud_flagged": True, "fraud_risk_level": "high"}}
    )
    
    flag.pop("_id", None)
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="user_fraud_flagged",
            entity_type="user",
            entity_id=uid,
            details={"flag_type": flag_type}
        )
    
    return {"success": True, "flag": flag}


@router.delete("/flags/{flag_id}")
async def remove_fraud_flag(flag_id: str, admin_id: str):
    """Remove a fraud flag"""
    flag = await db.fraud_flags.find_one({"flag_id": flag_id})
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    
    await db.fraud_flags.delete_one({"flag_id": flag_id})
    
    # Check if user has other flags
    user_id = flag.get("user_id")
    if user_id:
        remaining_flags = await db.fraud_flags.count_documents({"user_id": user_id})
        if remaining_flags == 0:
            await db.users.update_one(
                {"uid": user_id},
                {"$set": {"fraud_flagged": False, "fraud_risk_level": "low"}}
            )
    
    if log_admin_action:
        await log_admin_action(
            admin_uid=admin_id,
            action="fraud_flag_removed",
            entity_type="fraud",
            entity_id=flag_id
        )
    
    return {"success": True, "message": "Flag removed"}


# ========== RISK ASSESSMENT ==========

@router.get("/risk-assessment/{uid}")
async def get_user_risk_assessment(uid: str):
    """Get fraud risk assessment for a user"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Count fraud indicators
    flags = await db.fraud_flags.count_documents({"user_id": uid, "status": "active"})
    
    # Check login patterns
    recent_logins = await db.login_history.find(
        {"user_id": uid},
        {"_id": 0, "ip_address": 1, "login_time": 1}
    ).sort("login_time", -1).limit(20).to_list(20)
    
    unique_ips = len(set(login.get("ip_address") for login in recent_logins if login.get("ip_address")))
    
    # Calculate risk score
    risk_score = 0
    risk_factors = []
    
    if flags > 0:
        risk_score += flags * 20
        risk_factors.append(f"{flags} active fraud flags")
    
    if unique_ips > 5:
        risk_score += (unique_ips - 5) * 5
        risk_factors.append(f"{unique_ips} unique IPs in recent logins")
    
    if user.get("fraud_flagged"):
        risk_score += 30
        risk_factors.append("Previously flagged for fraud")
    
    risk_level = "low"
    if risk_score >= 50:
        risk_level = "high"
    elif risk_score >= 25:
        risk_level = "medium"
    
    return {
        "uid": uid,
        "risk_score": min(risk_score, 100),
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "active_flags": flags,
        "unique_login_ips": unique_ips,
        "assessed_at": datetime.now(timezone.utc).isoformat()
    }


# ========== IP ANALYSIS ==========

@router.get("/ip-analysis/{ip_address}")
async def analyze_ip_address(ip_address: str):
    """Analyze an IP address for fraud indicators"""
    # Get users who logged in from this IP
    users_from_ip = await db.login_history.aggregate([
        {"$match": {"ip_address": ip_address}},
        {"$group": {"_id": "$user_id"}},
        {"$limit": 50}
    ]).to_list(50)
    
    user_ids = [u["_id"] for u in users_from_ip]
    
    # Check if IP is blocked
    is_blocked = await db.fraud_blocks.find_one({"block_type": "ip", "value": ip_address, "is_active": True})
    
    # Get login count
    login_count = await db.login_history.count_documents({"ip_address": ip_address})
    
    # Check for failed logins
    failed_logins = await db.security_alerts.count_documents({
        "alert_type": "failed_login",
        "ip_address": ip_address
    })
    
    return {
        "ip_address": ip_address,
        "is_blocked": is_blocked is not None,
        "total_logins": login_count,
        "failed_login_attempts": failed_logins,
        "unique_users": len(user_ids),
        "user_ids": user_ids[:10],  # First 10 only
        "analyzed_at": datetime.now(timezone.utc).isoformat()
    }
