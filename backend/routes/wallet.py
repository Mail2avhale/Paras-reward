"""
Wallet Routes - All wallet and transaction-related API endpoints
Extracted from server.py for better code organization

Includes:
- Wallet balance
- Transaction history
- Withdrawal history
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import logging

# Create router
router = APIRouter(tags=["Wallet"])

# Database reference - will be set from main server
db = None

def set_db(database):
    """Set the database reference"""
    global db
    db = database


# ========== WALLET ENDPOINTS ==========

@router.get("/wallet/{uid}")
async def get_wallet(uid: str):
    """Get wallet balance and status"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "prc_balance": user.get("prc_balance", 0),
        "wallet_status": user.get("wallet_status", "active")
    }


@router.get("/wallet/withdrawals/{uid}")
async def get_user_withdrawals(uid: str):
    """Get user's withdrawal history"""
    cashback_withdrawals = await db.cashback_withdrawals.find(
        {"user_id": uid},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    profit_withdrawals = await db.profit_withdrawals.find(
        {"user_id": uid},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "cashback_withdrawals": cashback_withdrawals,
        "profit_withdrawals": profit_withdrawals
    }


@router.get("/wallet/transactions/{uid}")
async def get_wallet_transactions(uid: str, wallet_type: str = None, page: int = 1, limit: int = 10):
    """Get user's comprehensive wallet transaction history with pagination"""
    query = {"user_id": uid}
    
    if wallet_type:
        query["wallet_type"] = wallet_type
    
    total = await db.transactions.count_documents(query)
    total_pages = (total + limit - 1) // limit
    skip = (page - 1) * limit
    
    transactions = await db.transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total_credit = sum(t["amount"] for t in transactions if t["type"] in ["mining", "referral", "cashback", "withdrawal_rejected", "admin_credit", "profit_share"])
    total_debit = sum(t["amount"] for t in transactions if t["type"] in ["order", "withdrawal", "admin_debit", "delivery_charge"])
    
    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "total_credit": total_credit,
        "total_debit": total_debit,
        "has_next": page < total_pages,
        "has_prev": page > 1
    }


# ========== TRANSACTION ENDPOINTS ==========

@router.get("/transactions/user/{uid}")
async def get_user_transactions_simple(uid: str, page: int = 1, limit: int = 5):
    """Get recent transactions for user dashboard with pagination"""
    try:
        skip = (page - 1) * limit
        
        total = await db.transactions.count_documents({"user_id": uid})
        total_pages = (total + limit - 1) // limit if total > 0 else 1
        
        transactions = await db.transactions.find(
            {"user_id": uid},
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        formatted = []
        for txn in transactions:
            txn_type = txn.get("type", "unknown")
            
            if txn_type == "mining":
                description = "Claimed mining rewards"
            elif txn_type == "mining_started":
                description = "Started mining session"
            elif txn_type in ["marketplace_purchase", "order"]:
                description = txn.get("description", "Marketplace purchase")
            elif txn_type == "bill_payment_request":
                description = txn.get("description", "Bill payment request submitted")
            elif txn_type == "gift_voucher_request":
                description = txn.get("description", "Gift voucher request submitted")
            elif txn_type in ["referral_bonus", "referral"]:
                description = "Referral bonus earned"
            # tap_game REMOVED - feature deprecated
            elif txn_type == "delivery_commission":
                description = "Delivery commission earned"
            elif txn_type == "delivery_charge":
                description = txn.get("description", "Delivery charge deducted")
            else:
                description = txn.get("description", txn_type.replace("_", " ").title())
            
            formatted.append({
                "type": txn_type,
                "amount": txn.get("amount", 0),
                "timestamp": txn.get("created_at"),
                "description": description
            })
        
        return {
            "transactions": formatted,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            }
        }
    except Exception as e:
        logging.error(f"Error fetching transactions: {e}")
        return {
            "transactions": [],
            "pagination": {
                "page": 1,
                "limit": 5,
                "total": 0,
                "total_pages": 1,
                "has_next": False,
                "has_prev": False
            }
        }


@router.get("/transactions/user/{uid}/detailed")
async def get_detailed_transaction_history(
    uid: str, 
    wallet_type: str = None,
    transaction_type: str = None,
    start_date: str = None,
    end_date: str = None,
    limit: int = 100,
    skip: int = 0
):
    """Get detailed transaction history with advanced filtering"""
    query = {"user_id": uid}
    
    if wallet_type:
        query["wallet_type"] = wallet_type
    if transaction_type:
        query["type"] = transaction_type
    
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        if date_query:
            query["created_at"] = date_query
    
    total = await db.transactions.count_documents(query)
    
    transactions = await db.transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Calculate summaries
    total_credit = 0
    total_debit = 0
    credit_types = ["mining", "referral", "referral_bonus", "cashback", "withdrawal_rejected", "admin_credit", "profit_share", "bonus"]
    debit_types = ["order", "withdrawal", "admin_debit", "delivery_charge", "bill_payment", "gift_voucher", "prc_burn"]
    
    for txn in transactions:
        amount = abs(txn.get("amount", 0))
        if txn.get("type") in credit_types:
            total_credit += amount
        elif txn.get("type") in debit_types:
            total_debit += amount
    
    return {
        "transactions": transactions,
        "total": total,
        "skip": skip,
        "limit": limit,
        "summary": {
            "total_credit": round(total_credit, 4),
            "total_debit": round(total_debit, 4),
            "net": round(total_credit - total_debit, 4)
        },
        "filters_applied": {
            "wallet_type": wallet_type,
            "transaction_type": transaction_type,
            "start_date": start_date,
            "end_date": end_date
        }
    }
