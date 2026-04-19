from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging
import uuid

try:
    from server import get_user_friendly_error
except Exception:
    def get_user_friendly_error(error):
        return str(error)

router = APIRouter(prefix="/manager", tags=["Manager"])

db = None

def set_db(database):
    global db
    db = database

@router.get("/dashboard")
async def get_manager_dashboard(uid: str):
    """Get manager dashboard overview metrics"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        # Get current date range
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        # Total active users
        total_users = await db.users.count_documents({"active": True, "role": "user"})
        
        # Users registered this week
        new_users_week = await db.users.count_documents({
            "role": "user",
            "created_at": {"$gte": week_ago.isoformat()}
        })
        
        # Total orders
        total_orders = await db.orders.count_documents({})
        
        # Orders today
        orders_today = await db.orders.count_documents({
            "created_at": {"$gte": today.isoformat()}
        })
        
        # Pending KYC approvals
        pending_kyc = await db.users.count_documents({
            "kyc_status": "pending",
            "role": "user"
        })
        
        # Pending withdrawals
        pending_withdrawals = await db.cashback_withdrawals.count_documents({
            "status": "pending"
        })
        
        # Calculate revenue (sum of completed orders) - OPTIMIZED with aggregation
        revenue_pipeline = [
            {"$match": {"status": "delivered"}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]
        revenue_result = await db.orders.aggregate(revenue_pipeline).to_list(1)
        total_revenue = revenue_result[0]["total"] if revenue_result else 0
        
        # Sales trend (last 7 days) - OPTIMIZED: Single aggregation instead of 7 queries
        trend_pipeline = [
            {"$match": {
                "created_at": {"$gte": (today - timedelta(days=7)).isoformat(), "$lt": (today + timedelta(days=1)).isoformat()}
            }},
            {"$addFields": {
                "order_date": {"$substr": ["$created_at", 0, 10]}
            }},
            {"$group": {
                "_id": "$order_date",
                "orders": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        trend_result = await db.orders.aggregate(trend_pipeline).to_list(10)
        trend_map = {r["_id"]: r["orders"] for r in trend_result}
        
        sales_trend = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_str = day.strftime("%Y-%m-%d")
            sales_trend.append({
                "date": day_str,
                "orders": trend_map.get(day_str, 0)
            })
        
        # Recent activities (last 10)
        recent_orders = await db.orders.find().sort("created_at", -1).limit(5).to_list(length=5)
        recent_users = await db.users.find({"role": "user"}).sort("created_at", -1).limit(5).to_list(length=5)
        
        activities = []
        for order in recent_orders:
            activities.append({
                "type": "order",
                "message": f"New order #{order.get('order_id')} - ₹{order.get('total_amount', 0)}",
                "time": order.get("created_at"),
                "status": order.get("status")
            })
        
        for user in recent_users:
            activities.append({
                "type": "user",
                "message": f"New user registered: {user.get('name', 'Unknown')}",
                "time": user.get("created_at"),
                "status": "active"
            })
        
        # Sort activities by time
        activities.sort(key=lambda x: x.get("time", ""), reverse=True)
        activities = activities[:10]
        
        return {
            "metrics": {
                "total_users": total_users,
                "new_users_week": new_users_week,
                "total_orders": total_orders,
                "orders_today": orders_today,
                "pending_kyc": pending_kyc,
                "pending_withdrawals": pending_withdrawals,
                "total_revenue": round(total_revenue, 2)
            },
            "sales_trend": sales_trend,
            "recent_activities": activities
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.get("/users")
async def get_manager_users(
    uid: str,
    search: Optional[str] = None,
    kyc_status: Optional[str] = None,
    membership_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get users list with filters for manager"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        # Build query
        query = {"role": "user"}
        
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"mobile": {"$regex": search, "$options": "i"}},
                {"uid": {"$regex": search, "$options": "i"}}
            ]
        
        if kyc_status:
            query["kyc_status"] = kyc_status
        
        if membership_type:
            query["membership_type"] = membership_type
        
        # Get total count
        total = await db.users.count_documents(query)
        
        # Get users
        users = await db.users.find(query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
        
        # Remove sensitive data
        for user in users:
            user.pop("password", None)
            user.pop("_id", None)
        
        return {
            "users": users,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.put("/kyc/approve")
async def approve_kyc(uid: str, user_id: str):
    """Approve user KYC (Manager access)"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        user = await db.users.find_one({"uid": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.get("kyc_status") != "pending":
            raise HTTPException(status_code=400, detail="KYC is not pending")
        
        # Update KYC status
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {
                "kyc_status": "verified",
                "kyc_verified_at": datetime.now(timezone.utc).isoformat(),
                "kyc_verified_by": uid
            }}
        )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "kyc_approve",
            "target_user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"user_email": user.get("email")}
        })
        
        return {"message": "KYC approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.put("/kyc/reject")
async def reject_kyc(request: Request, uid: str, user_id: str):
    """Reject user KYC with reason (Manager access)"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        reason = data.get("reason", "Documents not clear or incorrect")
        
        user = await db.users.find_one({"uid": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.get("kyc_status") != "pending":
            raise HTTPException(status_code=400, detail="KYC is not pending")
        
        # Update KYC status
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {
                "kyc_status": "rejected",
                "kyc_rejection_reason": reason,
                "kyc_rejected_at": datetime.now(timezone.utc).isoformat(),
                "kyc_rejected_by": uid
            }}
        )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "kyc_reject",
            "target_user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"user_email": user.get("email"), "reason": reason}
        })
        
        return {"message": "KYC rejected", "reason": reason}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# Manager Orders routes - REMOVED (Marketplace removed)

@router.get("/reports/sales")
async def get_sales_report(
    uid: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get sales report (Manager access)"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        # Default to last 30 days
        if not end_date:
            end_date = datetime.now(timezone.utc).isoformat()
        if not start_date:
            start_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        
        # Build query
        query = {
            "created_at": {"$gte": start_date, "$lte": end_date}
        }
        
        # Get orders
        orders = await db.orders.find(query).to_list(length=1000)
        
        # Calculate metrics
        total_orders = len(orders)
        total_revenue = sum(order.get("total_amount", 0) for order in orders)
        
        # Orders by status
        status_breakdown = {}
        for order in orders:
            status = order.get("status", "unknown")
            status_breakdown[status] = status_breakdown.get(status, 0) + 1
        
        # Daily breakdown
        daily_sales = {}
        for order in orders:
            date = order.get("created_at", "")[:10]  # Get YYYY-MM-DD
            if date not in daily_sales:
                daily_sales[date] = {"orders": 0, "revenue": 0}
            daily_sales[date]["orders"] += 1
            daily_sales[date]["revenue"] += order.get("total_amount", 0)
        
        # Convert to list
        daily_sales_list = [
            {"date": date, **metrics}
            for date, metrics in sorted(daily_sales.items())
        ]
        
        return {
            "period": {"start": start_date, "end": end_date},
            "summary": {
                "total_orders": total_orders,
                "total_revenue": round(total_revenue, 2),
                "average_order_value": round(total_revenue / total_orders if total_orders > 0 else 0, 2)
            },
            "status_breakdown": status_breakdown,
            "daily_sales": daily_sales_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.get("/reports/users")
async def get_users_report(
    uid: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get users report (Manager access)"""
    # Verify manager role
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        # Default to last 30 days
        if not end_date:
            end_date = datetime.now(timezone.utc).isoformat()
        if not start_date:
            start_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        
        # Total users
        total_users = await db.users.count_documents({"role": "user"})
        
        # New users in period
        new_users = await db.users.count_documents({
            "role": "user",
            "created_at": {"$gte": start_date, "$lte": end_date}
        })
        
        # VIP vs Free
        vip_users = await db.users.count_documents({"role": "user", "membership_type": "vip"})
        free_users = total_users - vip_users
        
        # KYC status breakdown
        kyc_verified = await db.users.count_documents({"role": "user", "kyc_status": "verified"})
        kyc_pending = await db.users.count_documents({"role": "user", "kyc_status": "pending"})
        kyc_rejected = await db.users.count_documents({"role": "user", "kyc_status": "rejected"})
        kyc_not_submitted = total_users - (kyc_verified + kyc_pending + kyc_rejected)
        
        # Daily user growth
        users_list = await db.users.find({
            "role": "user",
            "created_at": {"$gte": start_date, "$lte": end_date}
        }).to_list(length=1000)
        
        daily_growth = {}
        for user in users_list:
            date = user.get("created_at", "")[:10]
            daily_growth[date] = daily_growth.get(date, 0) + 1
        
        daily_growth_list = [
            {"date": date, "new_users": count}
            for date, count in sorted(daily_growth.items())
        ]
        
        return {
            "period": {"start": start_date, "end": end_date},
            "summary": {
                "total_users": total_users,
                "new_users": new_users,
                "vip_users": vip_users,
                "free_users": free_users
            },
            "kyc_breakdown": {
                "verified": kyc_verified,
                "pending": kyc_pending,
                "rejected": kyc_rejected,
                "not_submitted": kyc_not_submitted
            },
            "daily_growth": daily_growth_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ========== PHASE 2: FINANCIAL MANAGEMENT ==========

@router.get("/withdrawals")
async def get_manager_withdrawals(
    uid: str,
    status: Optional[str] = None,
    wallet_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get withdrawal requests (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        # Query both cashback and profit withdrawals
        cashback_query = {}
        profit_query = {}
        
        if status:
            cashback_query["status"] = status
            profit_query["status"] = status
        
        cashback_withdrawals = []
        profit_withdrawals = []
        
        if not wallet_type or wallet_type == "cashback":
            cashback_withdrawals = await db.cashback_withdrawals.find(cashback_query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
            for w in cashback_withdrawals:
                w.pop("_id", None)
                w["wallet_type"] = "cashback"
                # Get user info
                user = await db.users.find_one({"uid": w.get("user_id")})
                if user:
                    w["user_name"] = user.get("name")
                    w["user_email"] = user.get("email")
        
        if not wallet_type or wallet_type == "profit":
            profit_withdrawals = await db.profit_withdrawals.find(profit_query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
            for w in profit_withdrawals:
                w.pop("_id", None)
                w["wallet_type"] = "profit"
                # Get user info
                user = await db.users.find_one({"uid": w.get("user_id")})
                if user:
                    w["user_name"] = user.get("name")
                    w["user_email"] = user.get("email")
        
        all_withdrawals = cashback_withdrawals + profit_withdrawals
        all_withdrawals.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {
            "withdrawals": all_withdrawals[:limit],
            "total": len(all_withdrawals)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.put("/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(withdrawal_id: str, request: Request, uid: str):
    """Approve withdrawal request (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        wallet_type = data.get("wallet_type", "cashback")
        transaction_id = data.get("transaction_id", "")
        notes = data.get("notes", "")
        
        collection = db.cashback_withdrawals if wallet_type == "cashback" else db.profit_withdrawals
        
        withdrawal = await collection.find_one({"withdrawal_id": withdrawal_id})
        if not withdrawal:
            raise HTTPException(status_code=404, detail="Withdrawal not found")
        
        if withdrawal.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Withdrawal is not pending")
        
        # Update withdrawal status
        await collection.update_one(
            {"withdrawal_id": withdrawal_id},
            {"$set": {
                "status": "approved",
                "approved_by": uid,
                "approved_at": datetime.now(timezone.utc).isoformat(),
                "transaction_id": transaction_id,
                "admin_notes": notes
            }}
        )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "withdrawal_approve",
            "target_withdrawal_id": withdrawal_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {
                "wallet_type": wallet_type,
                "amount": withdrawal.get("amount"),
                "user_id": withdrawal.get("user_id")
            }
        })
        
        return {"message": "Withdrawal approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.put("/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(withdrawal_id: str, request: Request, uid: str):
    """Reject withdrawal request (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        wallet_type = data.get("wallet_type", "cashback")
        reason = data.get("reason", "")
        
        collection = db.cashback_withdrawals if wallet_type == "cashback" else db.profit_withdrawals
        
        withdrawal = await collection.find_one({"withdrawal_id": withdrawal_id})
        if not withdrawal:
            raise HTTPException(status_code=404, detail="Withdrawal not found")
        
        if withdrawal.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Withdrawal is not pending")
        
        # Update withdrawal status
        await collection.update_one(
            {"withdrawal_id": withdrawal_id},
            {"$set": {
                "status": "rejected",
                "rejected_by": uid,
                "rejected_at": datetime.now(timezone.utc).isoformat(),
                "rejection_reason": reason
            }}
        )
        
        # Refund amount back to user's wallet
        user_id = withdrawal.get("user_id")
        amount = withdrawal.get("amount", 0)
        
        if wallet_type == "cashback":
            await db.users.update_one(
                {"uid": user_id},
                {"$inc": {"cashback_wallet": amount}}
            )
        else:
            await db.users.update_one(
                {"uid": user_id},
                {"$inc": {"profit_wallet": amount}}
            )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "withdrawal_reject",
            "target_withdrawal_id": withdrawal_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {
                "wallet_type": wallet_type,
                "amount": amount,
                "user_id": user_id,
                "reason": reason
            }
        })
        
        return {"message": "Withdrawal rejected and amount refunded"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.get("/transactions")
async def get_manager_transactions(
    uid: str,
    transaction_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """Get transaction history (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        query = {}
        if transaction_type:
            query["transaction_type"] = transaction_type
        
        total = await db.transactions.count_documents(query)
        transactions = await db.transactions.find(query).skip(skip).limit(limit).sort("timestamp", -1).to_list(length=limit)
        
        for txn in transactions:
            txn.pop("_id", None)
            # Get user info
            user = await db.users.find_one({"uid": txn.get("user_id")})
            if user:
                txn["user_name"] = user.get("name")
        
        return {
            "transactions": transactions,
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ========== PHASE 2: COMMUNICATION TOOLS ==========

@router.post("/announcements")
async def create_announcement(request: Request, uid: str):
    """Create announcement for users (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        
        announcement_id = str(uuid.uuid4())
        announcement = {
            "announcement_id": announcement_id,
            "title": data.get("title"),
            "message": data.get("message"),
            "target_audience": data.get("target_audience", "all"),  # all, vip, free, stockists
            "priority": data.get("priority", "normal"),  # low, normal, high
            "created_by": uid,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": data.get("expires_at"),
            "active": True
        }
        
        await db.announcements.insert_one(announcement)
        
        # Create notifications for targeted users
        query = {"role": "user"}
        if data.get("target_audience") == "vip":
            query["membership_type"] = "vip"
        elif data.get("target_audience") == "free":
            query["$or"] = [{"membership_type": "free"}, {"membership_type": {"$exists": False}}]
        elif data.get("target_audience") == "stockists":
            query["role"] = {"$in": ["master_stockist", "sub_stockist", "outlet"]}
        
        target_users = await db.users.find(query).to_list(length=1000)
        
        notifications = []
        for user in target_users:
            notifications.append({
                "notification_id": str(uuid.uuid4()),
                "user_id": user.get("uid"),
                "title": data.get("title"),
                "message": data.get("message"),
                "type": "announcement",
                "priority": data.get("priority", "normal"),
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        if notifications:
            await db.notifications.insert_many(notifications)
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "announcement_create",
            "target_announcement_id": announcement_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {
                "title": data.get("title"),
                "target_audience": data.get("target_audience"),
                "recipients_count": len(notifications)
            }
        })
        
        return {
            "message": "Announcement created successfully",
            "announcement_id": announcement_id,
            "recipients": len(notifications)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.get("/announcements")
async def get_announcements(uid: str, skip: int = 0, limit: int = 50):
    """Get all announcements (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        total = await db.announcements.count_documents({})
        announcements = await db.announcements.find().skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
        
        for announcement in announcements:
            announcement.pop("_id", None)
        
        return {
            "announcements": announcements,
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ========== PHASE 3: SUPPORT TICKETS ==========

@router.get("/tickets")
async def get_manager_tickets(
    uid: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get support tickets (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        query = {}
        if status:
            query["status"] = status
        if priority:
            query["priority"] = priority
        
        total = await db.support_tickets.count_documents(query)
        tickets = await db.support_tickets.find(query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
        
        for ticket in tickets:
            ticket.pop("_id", None)
            # Get user info
            user = await db.users.find_one({"uid": ticket.get("user_id")})
            if user:
                ticket["user_name"] = user.get("name")
                ticket["user_email"] = user.get("email")
        
        return {
            "tickets": tickets,
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.put("/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, request: Request, uid: str):
    """Update support ticket (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        
        update_data = {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": uid
        }
        
        if "status" in data:
            update_data["status"] = data["status"]
            if data["status"] == "resolved":
                update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
                update_data["resolved_by"] = uid
        
        if "priority" in data:
            update_data["priority"] = data["priority"]
        
        if "response" in data:
            update_data["response"] = data["response"]
            update_data["responded_at"] = datetime.now(timezone.utc).isoformat()
            update_data["responded_by"] = uid
        
        if "assigned_to" in data:
            update_data["assigned_to"] = data["assigned_to"]
        
        result = await db.support_tickets.update_one(
            {"ticket_id": ticket_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "ticket_update",
            "target_ticket_id": ticket_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"updates": list(update_data.keys())}
        })
        
        return {"message": "Ticket updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ========== VIP MEMBERSHIP APPROVAL ==========

@router.get("/vip-requests")
async def get_vip_requests(
    uid: str,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get VIP membership payment requests (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        query = {}
        if status:
            query["status"] = status
        
        total = await db.vip_payments.count_documents(query)
        payments = await db.vip_payments.find(query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
        
        for payment in payments:
            payment.pop("_id", None)
            # Get user info
            user = await db.users.find_one({"uid": payment.get("user_id")})
            if user:
                payment["user_name"] = user.get("name")
                payment["user_email"] = user.get("email")
                payment["current_membership"] = user.get("membership_type", "free")
        
        return {
            "payments": payments,
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.put("/vip-requests/{payment_id}/approve")
async def approve_vip_payment(payment_id: str, uid: str):
    """Approve VIP membership payment (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        payment = await db.vip_payments.find_one({"payment_id": payment_id})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        if payment.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Payment is not pending")
        
        user_id = payment.get("user_id")
        
        # Update payment status
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": {
                "status": "approved",
                "approved_by": uid,
                "approved_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update user to VIP
        expiry_date = datetime.now(timezone.utc) + timedelta(days=365)
        await db.users.update_one(
            {"uid": user_id},
            {"$set": {
                "membership_type": "vip",
                "vip_activated_at": datetime.now(timezone.utc).isoformat(),
                "vip_expires_at": expiry_date.isoformat()
            }}
        )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "vip_approve",
            "target_payment_id": payment_id,
            "target_user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"amount": payment.get("amount")}
        })
        
        # Notify user about VIP approval
        await create_notification(
            user_id=user_id,
            title="🎉 VIP Membership Activated!",
            message=f"Congratulations! Your {payment.get('subscription_plan', 'VIP')} subscription has been approved. Enjoy your premium benefits!",
            notification_type="subscription",
            related_id=payment_id,
            icon="👑"
        )
        
        return {"message": "VIP membership approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

@router.put("/vip-requests/{payment_id}/reject")
async def reject_vip_payment(payment_id: str, request: Request, uid: str):
    """Reject VIP membership payment (Manager access)"""
    if not await verify_management(uid):
        raise HTTPException(status_code=403, detail="Manager access required")
    
    try:
        data = await request.json()
        reason = data.get("reason", "")
        
        payment = await db.vip_payments.find_one({"payment_id": payment_id})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        if payment.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Payment is not pending")
        
        # Update payment status
        await db.vip_payments.update_one(
            {"payment_id": payment_id},
            {"$set": {
                "status": "rejected",
                "rejected_by": uid,
                "rejected_at": datetime.now(timezone.utc).isoformat(),
                "rejection_reason": reason
            }}
        )
        
        # Log action
        await db.manager_actions.insert_one({
            "action_id": str(uuid.uuid4()),
            "manager_id": uid,
            "action_type": "vip_reject",
            "target_payment_id": payment_id,
            "target_user_id": payment.get("user_id"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"reason": reason}
        })
        
        # Notify user about rejection
        await create_notification(
            user_id=payment.get("user_id"),
            title="❌ Subscription Payment Rejected",
            message=f"Your subscription payment was rejected. Reason: {reason or 'Not specified'}. Please contact support if you have questions.",
            notification_type="subscription",
            related_id=payment_id,
            icon="❌"
        )
        
        return {"message": "VIP payment rejected", "reason": reason}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_user_friendly_error(e))

# ========== END MANAGER DASHBOARD ENDPOINTS ==========

# ========== ADMIN SETTINGS ENDPOINTS ==========

class SocialMediaSettings(BaseModel):
    """Social Media Settings Model"""
    facebook: Optional[str] = ""
    twitter: Optional[str] = ""
    instagram: Optional[str] = ""
    linkedin: Optional[str] = ""
    youtube: Optional[str] = ""
    telegram: Optional[str] = ""
    whatsapp: Optional[str] = ""
