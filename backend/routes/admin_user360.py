"""
Admin User 360° View - Restructured & Optimized
Complete user profile, transactions, referrals, and activity view
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, timezone
import logging
import re
import uuid

router = APIRouter(prefix="/admin/user360", tags=["Admin User 360"])

# Database reference (set by server.py)
db = None
_get_all_time_redeemed = None
_calculate_redeem_limit = None

def set_db(database):
    global db
    db = database

def set_redeemed_fn(fn):
    global _get_all_time_redeemed
    _get_all_time_redeemed = fn

def set_redeem_limit_fn(fn):
    global _calculate_redeem_limit
    _calculate_redeem_limit = fn


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
        
        # Total redeemed — use centralized status-filtered function
        if _get_all_time_redeemed:
            stats["total_redeemed"] = safe_float(await _get_all_time_redeemed(uid))
        else:
            # Fallback: query individual collections with status filter
            valid_statuses = [
                "completed", "COMPLETED", "Completed",
                "success", "SUCCESS", "Success",
                "approved", "APPROVED", "Approved",
                "paid", "PAID", "Paid",
                "pending", "PENDING", "Pending",
                "processing", "PROCESSING", "Processing",
                "delivered", "DELIVERED", "Delivered"
            ]
            burn_types = ["prc_burn", "admin_burn", "hourly_burn", "daily_burn", "burn", "auto_burn", "burn_overcorrection_fix"]
            redeemed_result = await db.transactions.aggregate([
                {"$match": {"user_id": uid, "amount": {"$lt": 0}, "type": {"$nin": burn_types}}},
                {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
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
    # NOTE: Return BOTH schemas (new: l1_count/l1_users/l2_count/total_network;
    #       old: total_referrals/active_referrals/referrals) so frontend
    #       AdminUser360New.js (which reads total_referrals/referrals) stays compatible
    #       whether it calls this fallback endpoint or the primary /admin/user-360.
    referral_data = {
        "l1_count": 0, "l2_count": 0, "l1_users": [], "total_network": 0,
        "total_referrals": 0, "active_referrals": 0, "total_earnings": 0.0,
        "referrals": [], "referred_by_name": None,
    }
    
    try:
        # L1 referrals (direct)
        l1_users = await db.users.find(
            {"referred_by": uid},
            {"_id": 0, "uid": 1, "name": 1, "email": 1, "created_at": 1,
             "subscription_plan": 1, "mining_active": 1}
        ).sort("created_at", -1).limit(50).to_list(50)
        
        referral_data["l1_count"] = len(l1_users)
        referral_data["l1_users"] = sanitize_doc(l1_users)
        referral_data["total_referrals"] = len(l1_users)
        referral_data["referrals"] = sanitize_doc(l1_users)[:10]
        referral_data["active_referrals"] = sum(
            1 for u in l1_users if u.get("mining_active")
        )
        
        # L2 count
        if l1_users:
            l1_uids = [u["uid"] for u in l1_users]
            l2_count = await db.users.count_documents({"referred_by": {"$in": l1_uids}})
            referral_data["l2_count"] = l2_count
        
        referral_data["total_network"] = referral_data["l1_count"] + referral_data["l2_count"]
        
        # Referred by (upline)
        if user and user.get("referred_by"):
            referrer = await db.users.find_one(
                {"uid": user["referred_by"]},
                {"_id": 0, "name": 1, "email": 1}
            )
            if referrer:
                referral_data["referred_by_name"] = referrer.get("name") or (referrer.get("email") or "").split("@")[0]
        
        # Referral earnings
        try:
            earnings_agg = await db.transactions.aggregate([
                {"$match": {"user_id": uid, "type": {"$in": ["referral", "referral_bonus", "referral_reward"]}}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]).to_list(1)
            if earnings_agg:
                referral_data["total_earnings"] = round(float(earnings_agg[0].get("total", 0) or 0), 2)
        except Exception:
            pass
        
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
    upcoming_plan = None
    try:
        subs = await db.subscription_payments.find(
            {"user_id": uid}
        ).sort("created_at", -1).limit(20).to_list(20)
        subscription_history = sanitize_doc(subs)

        # Fetch earliest upcoming plan for quick admin visibility
        up = await db.subscription_payments.find_one(
            {"user_id": uid, "status": "upcoming"},
            {"_id": 0, "plan_name": 1, "scheduled_start": 1, "scheduled_end": 1,
             "duration_days": 1, "payment_method": 1, "prc_amount": 1, "created_at": 1},
            sort=[("scheduled_start", 1)]
        )
        upcoming_plan = sanitize_doc(up) if up else None
    except Exception as e:
        logging.warning(f"[USER360] Subscription history error for {uid}: {e}")
    
    # ========== 6b. EMPLOYEE FLAG (for badges) ==========
    # Core Team fetch removed Feb 17 2026 — feature retired.
    employee_data = None
    try:
        emp = await db.employees.find_one(
            {"user_id": uid, "status": "active"},
            {"_id": 0, "employee_id": 1, "designation": 1, "department": 1, "monthly_salary": 1, "joined_at": 1}
        )
        employee_data = sanitize_doc(emp) if emp else None
    except Exception:
        employee_data = None

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
    # Calculate redeem limit info
    redeem_limit_data = {}
    try:
        if _calculate_redeem_limit:
            redeem_limit_data = await _calculate_redeem_limit(uid)
    except Exception as e:
        logging.warning(f"[USER360] Redeem limit calc error for {uid}: {e}")
    
    response = {
        "success": True,
        "user": {**sanitize_doc(user), "upcoming_plan": upcoming_plan, "employee": employee_data},
        "stats": stats,
        "redeem_limit": redeem_limit_data,
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
        valid_plans = ["explorer", "elite"]  # Only 2 plans now (March 2026)
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
        import secrets as _secrets
        import bcrypt
        new_pin = str(_secrets.randbelow(900000) + 100000)
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
        valid_roles = ["user", "manager", "sub_admin", "admin"]
        new_role = request.new_role or request.value
        if new_role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
        
        update_data["role"] = new_role
        update_data["role_updated_at"] = timestamp
        
        # If changed to manager, set default permissions
        if new_role == "manager":
            update_data["allowed_pages"] = [
                "dashboard", "members", "users", "user360", "subscription_payment", "kyc", 
                "gift_vouchers", "bank-transfers", "razorpay-subs", "bbps-dashboard", "eko-services"
            ]
    
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



SUCCESS_STATUSES = ["completed", "approved", "success", "paid"]

_SERVICE_LABELS = {
    "mobile_recharge": ("Mobile Recharge", "mobile"),
    "mobile_prepaid": ("Mobile Recharge", "mobile"),
    "prepaid": ("Mobile Recharge", "mobile"),
    "mobile_postpaid": ("Mobile Postpaid", "mobile"),
    "postpaid": ("Mobile Postpaid", "mobile"),
    "dth": ("DTH Recharge", "dth"),
    "dth_recharge": ("DTH Recharge", "dth"),
    "bank_transfer": ("Bank Redeem", "bank"),
    "bank_withdrawal": ("Bank Redeem", "bank"),
    "electricity": ("Electricity Bill", "bolt"),
    "gas": ("Gas Bill", "fire"),
    "piped_gas": ("Gas Bill", "fire"),
    "lpg_gas": ("LPG Booking", "fire"),
    "water": ("Water Bill", "droplet"),
    "broadband": ("Broadband Bill", "wifi"),
    "landline": ("Landline Bill", "wifi"),
    "loan": ("Loan EMI", "receipt"),
    "loan_repayment": ("Loan EMI", "receipt"),
    "insurance": ("Insurance Premium", "shield"),
    "fastag": ("FASTag Recharge", "receipt"),
    "cable": ("Cable TV Bill", "dth"),
    "housing_society": ("Society Bill", "receipt"),
    "municipal": ("Municipal Tax", "receipt"),
    "education": ("Education Fee", "receipt"),
}


def _resolve_svc(stype: str):
    if not stype:
        return ("Transaction", "receipt")
    k = stype.lower().strip().replace(" ", "_")
    return _SERVICE_LABELS.get(k, (k.replace("_", " ").title(), "receipt"))


def _pick_ts(d: dict) -> str:
    for k in ("created_at", "approved_at", "timestamp", "updated_at"):
        v = d.get(k)
        if v:
            return v if isinstance(v, str) else v.isoformat()
    return ""


@router.get("/{uid}/all-transactions")
async def get_user_all_transactions(uid: str, status: str = "success", limit: int = 200):
    """
    Admin: Get all successful transactions for a specific user across all services.
    Merges: redeem_requests, bill_payment_requests, bank_withdrawal_requests,
    chatbot_withdrawal_requests, and subscription_payments.

    Query params:
      status: "all" returns all statuses; default "success" = completed/approved/success/paid
      limit: max items returned (default 200)
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    status_filter = SUCCESS_STATUSES if status != "all" else None

    def _mk_status_q():
        return {"$in": status_filter} if status_filter else {"$exists": True}

    items = []

    # 1. redeem_requests
    try:
        docs = await db.redeem_requests.find(
            {"user_id": uid, "status": _mk_status_q()},
            {"_id": 0, "request_id": 1, "service_type": 1, "account_number": 1,
             "amount": 1, "amount_inr": 1, "created_at": 1, "approved_at": 1,
             "status": 1, "details": 1, "operator_name": 1},
        ).sort("created_at", -1).limit(80).to_list(80)
        for d in docs:
            label, icon = _resolve_svc(d.get("service_type"))
            acct = d.get("account_number") or (d.get("details", {}) or {}).get("mobile_number", "") or ""
            amt = d.get("amount_inr") or d.get("amount") or 0
            items.append({
                "txn_id": d.get("request_id") or "",
                "source": "redeem_requests",
                "service": label, "icon": icon,
                "account": acct,
                "operator": d.get("operator_name", ""),
                "amount": round(float(amt or 0), 2),
                "status": d.get("status", ""),
                "created_at": _pick_ts(d),
            })
    except Exception as e:
        logging.warning(f"[USER360-TXN] redeem_requests error: {e}")

    # 2. bill_payment_requests (BBPS - electricity/gas/water/etc.)
    try:
        docs = await db.bill_payment_requests.find(
            {"user_id": uid, "status": _mk_status_q()},
            {"_id": 0, "request_id": 1, "consumer_number": 1, "amount_inr": 1,
             "created_at": 1, "approved_at": 1, "operator_name": 1,
             "bill_type": 1, "status": 1},
        ).sort("created_at", -1).limit(80).to_list(80)
        for d in docs:
            label, icon = _resolve_svc(d.get("bill_type"))
            items.append({
                "txn_id": d.get("request_id") or "",
                "source": "bill_payment_requests",
                "service": label, "icon": icon,
                "account": d.get("consumer_number", ""),
                "operator": d.get("operator_name", ""),
                "amount": round(float(d.get("amount_inr", 0) or 0), 2),
                "status": d.get("status", ""),
                "created_at": _pick_ts(d),
            })
    except Exception as e:
        logging.warning(f"[USER360-TXN] bill_payment_requests error: {e}")

    # 3. bank_withdrawal_requests
    try:
        docs = await db.bank_withdrawal_requests.find(
            {"user_id": uid, "status": _mk_status_q()},
            {"_id": 0, "request_id": 1, "user_mobile": 1, "amount_inr": 1,
             "account_number": 1, "bank_name": 1, "created_at": 1, "approved_at": 1, "status": 1},
        ).sort("created_at", -1).limit(50).to_list(50)
        for d in docs:
            items.append({
                "txn_id": d.get("request_id") or "",
                "source": "bank_withdrawal_requests",
                "service": "Bank Redeem", "icon": "bank",
                "account": d.get("account_number", "") or d.get("user_mobile", ""),
                "operator": d.get("bank_name", ""),
                "amount": round(float(d.get("amount_inr", 0) or 0), 2),
                "status": d.get("status", ""),
                "created_at": _pick_ts(d),
            })
    except Exception as e:
        logging.warning(f"[USER360-TXN] bank_withdrawal error: {e}")

    # 4. chatbot_withdrawal_requests (legacy)
    try:
        docs = await db.chatbot_withdrawal_requests.find(
            {"uid": uid, "status": _mk_status_q()},
            {"_id": 0, "request_id": 1, "mobile": 1, "inr_amount": 1,
             "bank_name": 1, "account_number": 1, "created_at": 1, "approved_at": 1, "status": 1},
        ).sort("created_at", -1).limit(30).to_list(30)
        for d in docs:
            items.append({
                "txn_id": d.get("request_id") or "",
                "source": "chatbot_withdrawal_requests",
                "service": "Bank Redeem", "icon": "bank",
                "account": d.get("account_number", "") or d.get("mobile", ""),
                "operator": d.get("bank_name", ""),
                "amount": round(float(d.get("inr_amount", 0) or 0), 2),
                "status": d.get("status", ""),
                "created_at": _pick_ts(d),
            })
    except Exception as e:
        logging.warning(f"[USER360-TXN] chatbot_withdrawal error: {e}")

    # 5. subscription_payments
    try:
        sub_statuses = ["paid"] if status != "all" else None
        q = {"user_id": uid}
        if sub_statuses:
            q["status"] = {"$in": sub_statuses}
        docs = await db.subscription_payments.find(
            q,
            {"_id": 0, "payment_id": 1, "plan_name": 1, "plan_type": 1,
             "inr_equivalent": 1, "prc_amount": 1, "created_at": 1, "status": 1,
             "payment_method": 1},
        ).sort("created_at", -1).limit(30).to_list(30)
        for d in docs:
            plan = (d.get("plan_name") or d.get("plan_type") or "plan").title()
            amt = d.get("inr_equivalent") or d.get("prc_amount") or 0
            items.append({
                "txn_id": d.get("payment_id") or "",
                "source": "subscription_payments",
                "service": f"{plan} Subscription", "icon": "crown",
                "account": "",
                "operator": d.get("payment_method", ""),
                "amount": round(float(amt or 0), 2),
                "status": d.get("status", ""),
                "created_at": _pick_ts(d),
            })
    except Exception as e:
        logging.warning(f"[USER360-TXN] subscription error: {e}")

    # Sort newest first, drop bad items
    items = [i for i in items if i.get("service") and i["service"] != "Transaction"]
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items = items[:max(1, min(limit, 500))]

    # Category counts
    from collections import Counter
    by_category = dict(Counter(i["service"] for i in items))
    total_amount = round(sum(i["amount"] for i in items), 2)

    return {
        "success": True,
        "uid": uid,
        "count": len(items),
        "total_amount": total_amount,
        "by_category": by_category,
        "items": items,
    }
