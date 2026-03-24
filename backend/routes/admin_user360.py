"""
Admin User 360° View - Restructured & Optimized
Complete user profile, transactions, referrals, and activity view
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import logging
import re
import uuid
import random
import bcrypt

router = APIRouter(prefix="/admin/user360", tags=["Admin User 360"])

# Database reference (set by server.py)
db = None

def set_db(database):
    global db
    db = database


# ========== HELPER FUNCTIONS ==========

def sanitize_doc(doc, depth=0):
    """Convert MongoDB documents to JSON-serializable format"""
    if depth > 15 or doc is None:
        return str(doc) if doc is not None else None
    
    try:
        if isinstance(doc, dict):
            return {str(k): sanitize_doc(v, depth + 1) for k, v in doc.items()}
        elif isinstance(doc, list):
            return [sanitize_doc(item, depth + 1) for item in doc[:100]]  # Limit list items
        elif hasattr(doc, '__str__') and type(doc).__name__ == 'ObjectId':
            return str(doc)
        elif isinstance(doc, datetime):
            return doc.isoformat()
        elif isinstance(doc, (int, float, str, bool)):
            return doc
        elif isinstance(doc, bytes):
            return doc.decode('utf-8', errors='replace')
        else:
            return str(doc)
    except Exception:
        return str(doc) if doc is not None else None


def safe_float(value, default=0.0):
    """Safely convert to float"""
    try:
        return float(value) if value is not None else default
    except (ValueError, TypeError):
        return default


def safe_int(value, default=0):
    """Safely convert to int"""
    try:
        return int(value) if value is not None else default
    except (ValueError, TypeError):
        return default


# ========== MAIN SEARCH ENDPOINT ==========

@router.get("/search")
async def search_user(q: str):
    """
    Search user by email, mobile, UID, referral code, PAN
    Returns basic user info for selection
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Search query too short (min 2 chars)")
    
    query = q.strip()
    escaped = re.escape(query)
    
    search_conditions = [
        {"email": {"$regex": f"^{escaped}$", "$options": "i"}},
        {"mobile": query},
        {"uid": query},
        {"referral_code": {"$regex": f"^{escaped}$", "$options": "i"}},
        {"pan_number": {"$regex": f"^{escaped}$", "$options": "i"}}
    ]
    
    if query.isdigit() and len(query) == 4:
        search_conditions.append({"aadhaar_number": {"$regex": f"{escaped}$"}})
    elif query.isdigit() and len(query) == 12:
        search_conditions.append({"aadhaar_number": query})
    
    try:
        user = await db.users.find_one(
            {"$or": search_conditions},
            {"_id": 0, "password_hash": 0, "pin_hash": 0, "hashed_pin": 0, "password": 0, "reset_token": 0}
        )
    except Exception as e:
        logging.error(f"[USER360] Search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)[:80]}")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "user": sanitize_doc(user)}


@router.get("/full/{uid}")
async def get_user_full_360(uid: str):
    """
    Get complete 360° view of a user
    Returns: profile, stats, referrals, transactions, activity
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    logging.info(f"[USER360] Loading full data for: {uid}")
    
    # ========== 1. GET USER ==========
    try:
        user = await db.users.find_one(
            {"uid": uid},
            {"_id": 0, "password_hash": 0, "pin_hash": 0, "hashed_pin": 0, "password": 0, "reset_token": 0}
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[USER360] User fetch error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user: {str(e)[:80]}")
    
    # ========== 2. FINANCIAL STATS ==========
    stats = {"total_mined": 0, "total_redeemed": 0, "total_referral_bonus": 0}
    
    try:
        # Total mined
        mined_result = await db.transactions.aggregate([
            {"$match": {"user_id": uid, "type": {"$in": ["mining", "tap_game", "referral", "admin_credit"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        stats["total_mined"] = safe_float(mined_result[0]["total"]) if mined_result else 0
        
        # Total redeemed
        redeemed_result = await db.redeem_requests.aggregate([
            {"$match": {"user_id": uid, "status": {"$in": ["completed", "COMPLETED", "success", "SUCCESS"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}}}
        ]).to_list(1)
        stats["total_redeemed"] = safe_float(redeemed_result[0]["total"]) if redeemed_result else 0
        
        # Referral bonus
        ref_result = await db.transactions.aggregate([
            {"$match": {"user_id": uid, "type": "referral"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        stats["total_referral_bonus"] = safe_float(ref_result[0]["total"]) if ref_result else 0
        
    except Exception as e:
        logging.warning(f"[USER360] Stats error for {uid}: {e}")
    
    # ========== 3. REFERRAL DATA ==========
    referral_data = {"l1_count": 0, "l2_count": 0, "l1_users": [], "total_network": 0}
    
    try:
        # L1 referrals
        l1_users = await db.users.find(
            {"referred_by": uid},
            {"_id": 0, "uid": 1, "name": 1, "email": 1, "created_at": 1, "subscription_plan": 1}
        ).limit(50).to_list(50)
        
        referral_data["l1_count"] = len(l1_users)
        referral_data["l1_users"] = sanitize_doc(l1_users)
        
        # L2 count
        if l1_users:
            l1_uids = [u["uid"] for u in l1_users]
            l2_count = await db.users.count_documents({"referred_by": {"$in": l1_uids}})
            referral_data["l2_count"] = l2_count
        
        referral_data["total_network"] = referral_data["l1_count"] + referral_data["l2_count"]
        
    except Exception as e:
        logging.warning(f"[USER360] Referral error for {uid}: {e}")
    
    # ========== 4. RECENT TRANSACTIONS ==========
    transactions = []
    try:
        txns = await db.transactions.find(
            {"user_id": uid}
        ).sort("created_at", -1).limit(50).to_list(50)
        transactions = sanitize_doc(txns)
    except Exception as e:
        logging.warning(f"[USER360] Transactions error for {uid}: {e}")
    
    # ========== 5. REDEEM REQUESTS ==========
    redeem_requests = []
    try:
        redeems = await db.redeem_requests.find(
            {"user_id": uid}
        ).sort("created_at", -1).limit(30).to_list(30)
        redeem_requests = sanitize_doc(redeems)
    except Exception as e:
        logging.warning(f"[USER360] Redeem error for {uid}: {e}")
    
    # ========== 6. SUBSCRIPTION HISTORY ==========
    subscription_history = []
    try:
        subs = await db.subscription_payments.find(
            {"user_id": uid}
        ).sort("created_at", -1).limit(20).to_list(20)
        subscription_history = sanitize_doc(subs)
    except Exception as e:
        logging.warning(f"[USER360] Subscription history error for {uid}: {e}")
    
    # ========== 7. KYC DOCUMENTS ==========
    kyc_data = None
    try:
        kyc = await db.kyc_documents.find_one({"user_id": uid}, {"_id": 0})
        kyc_data = sanitize_doc(kyc) if kyc else None
    except Exception as e:
        logging.warning(f"[USER360] KYC error for {uid}: {e}")
    
    # ========== 8. LOGIN HISTORY ==========
    login_history = []
    try:
        logins = await db.login_history.find(
            {"user_id": uid}
        ).sort("timestamp", -1).limit(20).to_list(20)
        login_history = sanitize_doc(logins)
    except Exception as e:
        logging.warning(f"[USER360] Login history error for {uid}: {e}")
    
    # ========== 9. BUILD RESPONSE ==========
    response = {
        "success": True,
        "user": sanitize_doc(user),
        "stats": stats,
        "referral": referral_data,
        "transactions": transactions,
        "redeem_requests": redeem_requests,
        "subscription_history": subscription_history,
        "kyc": kyc_data,
        "login_history": login_history
    }
    
    logging.info(f"[USER360] Successfully loaded data for: {uid}")
    return response


# ========== USER ACTIONS ==========

class UserActionRequest(BaseModel):
    action: str  # ban, unban, block_user, unblock_user, add_prc, deduct_prc, update_plan, reset_pin, change_role, change_referral, delete_user
    value: Optional[Any] = None
    reason: Optional[str] = None
    admin_id: Optional[str] = None
    new_role: Optional[str] = None
    new_referrer: Optional[str] = None


@router.post("/action/{uid}")
async def perform_user_action(uid: str, request: UserActionRequest):
    """
    Perform admin action on user
    Actions: ban, unban, add_prc, deduct_prc, update_plan, reset_pin
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    timestamp = datetime.now(timezone.utc).isoformat()
    update_data = {"updated_at": timestamp}
    
    if request.action == "ban":
        update_data["is_banned"] = True
        update_data["ban_reason"] = request.reason or "Admin action"
        update_data["banned_at"] = timestamp
        
    elif request.action == "unban":
        update_data["is_banned"] = False
        update_data["ban_reason"] = None
        update_data["unbanned_at"] = timestamp
        
    elif request.action == "add_prc":
        amount = safe_float(request.value, 0)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        current_balance = safe_float(user.get("prc_balance"), 0)
        new_balance = current_balance + amount
        update_data["prc_balance"] = new_balance
        
        # Log transaction
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": uid,
            "type": "admin_credit",
            "amount": amount,
            "balance_before": current_balance,
            "balance_after": new_balance,
            "description": request.reason or "Admin credit",
            "admin_id": request.admin_id,
            "created_at": timestamp
        })
        
    elif request.action == "deduct_prc":
        amount = safe_float(request.value, 0)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        current_balance = safe_float(user.get("prc_balance"), 0)
        if current_balance < amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        new_balance = current_balance - amount
        update_data["prc_balance"] = new_balance
        
        # Log transaction
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": uid,
            "type": "admin_debit",
            "amount": -amount,
            "balance_before": current_balance,
            "balance_after": new_balance,
            "description": request.reason or "Admin debit",
            "admin_id": request.admin_id,
            "created_at": timestamp
        })
        
    elif request.action == "update_plan":
        valid_plans = ["free", "explorer", "startup", "growth", "elite"]
        if request.value not in valid_plans:
            raise HTTPException(status_code=400, detail=f"Invalid plan. Must be one of: {valid_plans}")
        
        update_data["subscription_plan"] = request.value
    
    # Block user (alias for ban)
    elif request.action == "block_user":
        update_data["is_banned"] = True
        update_data["ban_reason"] = request.reason or "Admin action"
        update_data["banned_at"] = timestamp
    
    # Unblock user (alias for unban)
    elif request.action == "unblock_user":
        update_data["is_banned"] = False
        update_data["ban_reason"] = None
        update_data["unbanned_at"] = timestamp
    
    # Reset PIN - Generate new random 6-digit PIN
    elif request.action == "reset_pin":
        import random
        import bcrypt
        new_pin = str(random.randint(100000, 999999))
        hashed_pin = bcrypt.hashpw(new_pin.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        update_data["hashed_pin"] = hashed_pin
        update_data["pin_hash"] = hashed_pin  # Backward compatibility
        update_data["pin_reset_at"] = timestamp
        
        # Return new PIN in response
        await db.users.update_one({"uid": uid}, {"$set": update_data})
        await db.admin_audit_logs.insert_one({
            "admin_id": request.admin_id,
            "action": "reset_pin",
            "target_user": uid,
            "reason": request.reason,
            "timestamp": timestamp
        })
        return {
            "success": True,
            "message": "PIN reset successfully",
            "new_pin": new_pin,
            "updated_fields": list(update_data.keys())
        }
    
    # Change user role
    elif request.action == "change_role":
        valid_roles = ["user", "sub_admin", "admin"]
        new_role = request.new_role or request.value
        if new_role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
        
        update_data["role"] = new_role
        update_data["role_updated_at"] = timestamp
    
    # Change referral (new referrer UID)
    elif request.action == "change_referral":
        new_referrer = request.new_referrer or request.value
        
        if new_referrer and new_referrer.lower() == "remove":
            # Remove referral
            update_data["referred_by"] = None
            update_data["referral_removed_at"] = timestamp
        else:
            # Validate new referrer exists
            referrer_user = await db.users.find_one({"uid": new_referrer})
            if not referrer_user:
                raise HTTPException(status_code=404, detail=f"Referrer user not found: {new_referrer}")
            
            if new_referrer == uid:
                raise HTTPException(status_code=400, detail="User cannot be their own referrer")
            
            old_referrer = user.get("referred_by")
            update_data["referred_by"] = new_referrer
            update_data["referral_changed_at"] = timestamp
            update_data["previous_referrer"] = old_referrer
    
    # Delete user permanently
    elif request.action == "delete_user":
        # Archive user data before deletion
        user_archive = {
            **sanitize_doc(user),
            "deleted_at": timestamp,
            "deleted_by_admin": request.admin_id,
            "deletion_reason": request.reason or "Admin action"
        }
        await db.deleted_users_archive.insert_one(user_archive)
        
        # Delete from users collection
        await db.users.delete_one({"uid": uid})
        
        # Log deletion
        await db.admin_audit_logs.insert_one({
            "admin_id": request.admin_id,
            "action": "delete_user",
            "target_user": uid,
            "user_email": user.get("email"),
            "user_name": user.get("name"),
            "reason": request.reason,
            "timestamp": timestamp
        })
        
        return {
            "success": True,
            "message": f"User {uid} deleted permanently. Archived in deleted_users_archive collection.",
            "deleted_uid": uid
        }
        
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}")
    
    # Apply update
    await db.users.update_one({"uid": uid}, {"$set": update_data})
    
    # Log admin action
    await db.admin_audit_logs.insert_one({
        "admin_id": request.admin_id,
        "action": request.action,
        "target_user": uid,
        "value": request.value,
        "reason": request.reason,
        "timestamp": timestamp
    })
    
    return {
        "success": True,
        "message": f"Action '{request.action}' completed successfully",
        "updated_fields": list(update_data.keys())
    }


# ========== QUICK STATS ==========

@router.get("/quick-stats/{uid}")
async def get_quick_stats(uid: str):
    """Get quick stats for user (faster than full load)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user = await db.users.find_one(
        {"uid": uid},
        {"_id": 0, "uid": 1, "name": 1, "prc_balance": 1, "subscription_plan": 1, "is_banned": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Quick counts
    txn_count = await db.transactions.count_documents({"user_id": uid})
    redeem_count = await db.redeem_requests.count_documents({"user_id": uid})
    referral_count = await db.users.count_documents({"referred_by": uid})
    
    return {
        "success": True,
        "user": sanitize_doc(user),
        "counts": {
            "transactions": txn_count,
            "redeems": redeem_count,
            "referrals": referral_count
        }
    }
