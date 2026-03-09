"""
PRC Redeem Statement Routes
============================
User-facing PRC Redeem and Refund Statement with Date and Narration
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

router = APIRouter(prefix="/user/prc-statement", tags=["PRC Statement"])

# Database reference
db = None

def set_db(database):
    global db
    db = database


@router.get("/{uid}")
async def get_prc_redeem_statement(
    uid: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    transaction_type: Optional[str] = None,  # redeem, refund, all
    category: Optional[str] = None  # bill_payment, dmt, gift_voucher, bank_transfer, shop, all
):
    """
    Get PRC Redeem Statement for a user
    
    Returns:
    - Bill Payments (BBPS)
    - DMT (Money Transfer)
    - Gift Vouchers
    - Bank Withdrawals
    - Shop Orders
    - Refunds
    
    With date and narration for each entry
    """
    try:
        # Verify user exists
        user = await db.users.find_one({"uid": uid}, {"_id": 0, "name": 1, "email": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Default date range - last 30 days
        if not end_date:
            end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if not start_date:
            start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Add time component for proper filtering
        start_datetime = f"{start_date}T00:00:00"
        end_datetime = f"{end_date}T23:59:59"
        
        entries = []
        
        # ========== 1. BILL PAYMENTS (BBPS) ==========
        if transaction_type in [None, "all", "redeem"]:
            bill_query = {
                "user_id": uid,
                "status": {"$in": ["approved", "completed", "success"]},
                "$or": [
                    {"created_at": {"$gte": start_datetime, "$lte": end_datetime}},
                    {"approved_at": {"$gte": start_datetime, "$lte": end_datetime}}
                ]
            }
            
            bill_payments = await db.bill_payment_requests.find(
                bill_query,
                {"_id": 0, "request_id": 1, "bill_type": 1, "operator_name": 1, 
                 "consumer_number": 1, "amount_inr": 1, "prc_used": 1, 
                 "status": 1, "created_at": 1, "approved_at": 1, "eko_tid": 1}
            ).sort("created_at", -1).to_list(500)
            
            for bill in bill_payments:
                bill_type = bill.get("bill_type", "bill").replace("_", " ").title()
                operator = bill.get("operator_name", "")
                consumer = bill.get("consumer_number", "")[-4:] if bill.get("consumer_number") else ""
                
                entries.append({
                    "id": bill.get("request_id", ""),
                    "date": bill.get("approved_at") or bill.get("created_at", ""),
                    "type": "redeem",
                    "category": "bill_payment",
                    "narration": f"{bill_type} - {operator} (...{consumer})",
                    "prc_amount": -abs(bill.get("prc_used", 0)),
                    "inr_value": bill.get("amount_inr", 0),
                    "status": bill.get("status", "completed"),
                    "reference": bill.get("eko_tid", "")
                })
        
        # ========== 2. DMT TRANSACTIONS ==========
        if transaction_type in [None, "all", "redeem"]:
            dmt_query = {
                "user_id": uid,
                "status": {"$in": ["completed", "success"]},
                "created_at": {"$gte": start_datetime, "$lte": end_datetime}
            }
            
            dmt_transactions = await db.dmt_transactions.find(
                dmt_query,
                {"_id": 0, "transaction_id": 1, "recipient_id": 1, "mobile": 1,
                 "amount_inr": 1, "prc_amount": 1, "status": 1, 
                 "created_at": 1, "eko_tid": 1, "beneficiary_name": 1, "bank_name": 1}
            ).sort("created_at", -1).to_list(500)
            
            for dmt in dmt_transactions:
                beneficiary = dmt.get("beneficiary_name", "")
                bank = dmt.get("bank_name", "")
                recipient = dmt.get("recipient_id", "")[-4:] if dmt.get("recipient_id") else ""
                
                narration_parts = ["Money Transfer"]
                if beneficiary:
                    narration_parts.append(beneficiary)
                if bank:
                    narration_parts.append(f"({bank})")
                elif recipient:
                    narration_parts.append(f"(...{recipient})")
                
                entries.append({
                    "id": dmt.get("transaction_id", ""),
                    "date": dmt.get("created_at", ""),
                    "type": "redeem",
                    "category": "dmt",
                    "narration": " - ".join(narration_parts) if len(narration_parts) > 1 else "Money Transfer",
                    "prc_amount": -abs(dmt.get("prc_amount", 0)),
                    "inr_value": dmt.get("amount_inr", 0),
                    "status": dmt.get("status", "completed"),
                    "reference": dmt.get("eko_tid", "") or dmt.get("transaction_id", "")
                })
        
        # ========== 3. GIFT VOUCHERS ==========
        if transaction_type in [None, "all", "redeem"]:
            voucher_query = {
                "user_id": uid,
                "status": {"$in": ["approved", "completed", "delivered"]},
                "$or": [
                    {"created_at": {"$gte": start_datetime, "$lte": end_datetime}},
                    {"approved_at": {"$gte": start_datetime, "$lte": end_datetime}}
                ]
            }
            
            vouchers = await db.gift_voucher_requests.find(
                voucher_query,
                {"_id": 0, "request_id": 1, "voucher_type": 1, "brand_name": 1,
                 "amount_inr": 1, "prc_used": 1, "status": 1, 
                 "created_at": 1, "approved_at": 1, "voucher_code": 1}
            ).sort("created_at", -1).to_list(500)
            
            for voucher in vouchers:
                brand = voucher.get("brand_name") or voucher.get("voucher_type", "Gift Voucher")
                
                entries.append({
                    "id": voucher.get("request_id", ""),
                    "date": voucher.get("approved_at") or voucher.get("created_at", ""),
                    "type": "redeem",
                    "category": "gift_voucher",
                    "narration": f"Gift Voucher - {brand}",
                    "prc_amount": -abs(voucher.get("prc_used", 0)),
                    "inr_value": voucher.get("amount_inr", 0),
                    "status": voucher.get("status", "completed"),
                    "reference": voucher.get("voucher_code", "")[:8] + "..." if voucher.get("voucher_code") else ""
                })
        
        # ========== 4. BANK WITHDRAWALS ==========
        if transaction_type in [None, "all", "redeem"]:
            withdrawal_query = {
                "user_id": uid,
                "status": {"$in": ["approved", "completed", "transferred"]},
                "$or": [
                    {"created_at": {"$gte": start_datetime, "$lte": end_datetime}},
                    {"approved_at": {"$gte": start_datetime, "$lte": end_datetime}}
                ]
            }
            
            withdrawals = await db.withdraw_requests.find(
                withdrawal_query,
                {"_id": 0, "request_id": 1, "bank_name": 1, "account_number": 1,
                 "amount_inr": 1, "prc_used": 1, "status": 1,
                 "created_at": 1, "approved_at": 1, "utr_number": 1}
            ).sort("created_at", -1).to_list(500)
            
            for wd in withdrawals:
                bank = wd.get("bank_name", "Bank")
                acc = wd.get("account_number", "")[-4:] if wd.get("account_number") else ""
                
                entries.append({
                    "id": wd.get("request_id", ""),
                    "date": wd.get("approved_at") or wd.get("created_at", ""),
                    "type": "redeem",
                    "category": "bank_transfer",
                    "narration": f"Bank Transfer - {bank} (...{acc})",
                    "prc_amount": -abs(wd.get("prc_used", 0)),
                    "inr_value": wd.get("amount_inr", 0),
                    "status": wd.get("status", "completed"),
                    "reference": wd.get("utr_number", "")
                })
        
        # ========== 5. SHOP/MARKETPLACE ORDERS ==========
        if transaction_type in [None, "all", "redeem"]:
            shop_query = {
                "user_id": uid,
                "status": {"$in": ["approved", "completed", "delivered", "shipped"]},
                "$or": [
                    {"created_at": {"$gte": start_datetime, "$lte": end_datetime}},
                    {"approved_at": {"$gte": start_datetime, "$lte": end_datetime}}
                ]
            }
            
            shop_orders = await db.orders.find(
                shop_query,
                {"_id": 0, "order_id": 1, "product_name": 1, "product_title": 1,
                 "total_prc": 1, "prc_used": 1, "total_amount": 1, "status": 1, 
                 "created_at": 1, "approved_at": 1, "quantity": 1}
            ).sort("created_at", -1).to_list(500)
            
            for order in shop_orders:
                product = order.get("product_name") or order.get("product_title", "Shop Order")
                qty = order.get("quantity", 1)
                
                entries.append({
                    "id": order.get("order_id", ""),
                    "date": order.get("approved_at") or order.get("created_at", ""),
                    "type": "redeem",
                    "category": "shop",
                    "narration": f"Shop - {product}" + (f" x{qty}" if qty > 1 else ""),
                    "prc_amount": -abs(order.get("total_prc", 0) or order.get("prc_used", 0)),
                    "inr_value": order.get("total_amount", 0),
                    "status": order.get("status", "completed"),
                    "reference": order.get("order_id", "")
                })
        
        # ========== 6. REFUNDS ==========
        if transaction_type in [None, "all", "refund"]:
            # Check transactions collection for refunds
            refund_query = {
                "user_id": uid,
                "transaction_type": {"$in": ["refund", "prc_refund", "admin_credit", "reversal"]},
                "created_at": {"$gte": start_datetime, "$lte": end_datetime}
            }
            
            refunds = await db.transactions.find(
                refund_query,
                {"_id": 0, "transaction_id": 1, "amount": 1, "description": 1,
                 "created_at": 1, "reference_id": 1, "transaction_type": 1}
            ).sort("created_at", -1).to_list(500)
            
            for refund in refunds:
                desc = refund.get("description", "PRC Refund")
                
                entries.append({
                    "id": refund.get("transaction_id", ""),
                    "date": refund.get("created_at", ""),
                    "type": "refund",
                    "category": "refund",
                    "narration": desc,
                    "prc_amount": abs(refund.get("amount", 0)),
                    "inr_value": 0,
                    "status": "completed",
                    "reference": refund.get("reference_id", "")
                })
            
            # Also check for rejected requests that were refunded
            rejected_bills = await db.bill_payment_requests.find(
                {
                    "user_id": uid,
                    "status": "rejected",
                    "refunded": True,
                    "$or": [
                        {"rejected_at": {"$gte": start_datetime, "$lte": end_datetime}},
                        {"refunded_at": {"$gte": start_datetime, "$lte": end_datetime}}
                    ]
                },
                {"_id": 0, "request_id": 1, "prc_used": 1, "bill_type": 1,
                 "rejected_at": 1, "refunded_at": 1, "rejection_reason": 1}
            ).to_list(100)
            
            for bill in rejected_bills:
                entries.append({
                    "id": f"REF-{bill.get('request_id', '')}",
                    "date": bill.get("refunded_at") or bill.get("rejected_at", ""),
                    "type": "refund",
                    "category": "refund",
                    "narration": f"Refund - {bill.get('bill_type', 'Bill')} rejected ({bill.get('rejection_reason', 'N/A')})",
                    "prc_amount": abs(bill.get("prc_used", 0)),
                    "inr_value": 0,
                    "status": "refunded",
                    "reference": bill.get("request_id", "")
                })
        
        # Sort all entries by date (newest first)
        entries.sort(key=lambda x: x.get("date", ""), reverse=True)
        
        # Apply category filter if specified
        if category and category != 'all':
            entries = [e for e in entries if e.get("category") == category]
        
        # Calculate totals
        total_redeemed = sum(abs(e["prc_amount"]) for e in entries if e["type"] == "redeem")
        total_refunded = sum(e["prc_amount"] for e in entries if e["type"] == "refund")
        total_inr_value = sum(e["inr_value"] for e in entries if e["type"] == "redeem")
        
        # Pagination
        total_entries = len(entries)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_entries = entries[start_idx:end_idx]
        
        return {
            "user_name": user.get("name", "User"),
            "period": {
                "start_date": start_date,
                "end_date": end_date
            },
            "summary": {
                "total_redeemed_prc": round(total_redeemed, 2),
                "total_refunded_prc": round(total_refunded, 2),
                "net_redeemed_prc": round(total_redeemed - total_refunded, 2),
                "total_inr_value": round(total_inr_value, 2),
                "transaction_count": total_entries
            },
            "entries": paginated_entries,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_entries,
                "pages": (total_entries + limit - 1) // limit
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching PRC statement: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{uid}/download")
async def download_prc_statement(
    uid: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = "csv"
):
    """
    Download PRC Redeem Statement as CSV
    """
    try:
        # Get full statement
        statement = await get_prc_redeem_statement(
            uid=uid,
            start_date=start_date,
            end_date=end_date,
            page=1,
            limit=1000
        )
        
        if format == "csv":
            lines = [
                "PRC Redeem Statement",
                f"User: {statement['user_name']}",
                f"Period: {statement['period']['start_date']} to {statement['period']['end_date']}",
                "",
                f"Total Redeemed: {statement['summary']['total_redeemed_prc']} PRC",
                f"Total Refunded: {statement['summary']['total_refunded_prc']} PRC",
                f"Net Redeemed: {statement['summary']['net_redeemed_prc']} PRC",
                f"Total INR Value: ₹{statement['summary']['total_inr_value']}",
                "",
                "Date,Type,Category,Narration,PRC Amount,INR Value,Status,Reference"
            ]
            
            for entry in statement["entries"]:
                date = entry["date"][:10] if entry["date"] else ""
                lines.append(
                    f"{date},{entry['type']},{entry['category']},\"{entry['narration']}\","
                    f"{entry['prc_amount']},{entry['inr_value']},{entry['status']},{entry['reference']}"
                )
            
            content = "\n".join(lines)
            
            from fastapi.responses import Response
            return Response(
                content=content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=prc_statement_{start_date}_{end_date}.csv"
                }
            )
        
        return statement
        
    except Exception as e:
        logging.error(f"Error downloading statement: {e}")
        raise HTTPException(status_code=500, detail=str(e))
