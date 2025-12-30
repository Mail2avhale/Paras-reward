# Calculate total redeemed PRC from completed orders

@api_router.get("/user/stats/redeemed/{uid}")
async def get_user_redeemed_stats(uid: str):
    """Get total PRC redeemed and its value for a user"""
    try:
        # Get all completed orders for this user
        completed_orders = await db.orders.find(
            {"user_id": uid, "status": "completed"},
            {"_id": 0, "prc_amount": 1, "product_price": 1}
        ).to_list(1000)
        
        total_prc_redeemed = sum(order.get("prc_amount", 0) for order in completed_orders)
        total_value = sum(order.get("product_price", 0) for order in completed_orders)
        
        # Get completed bill payments
        completed_bills = await db.bill_payment_requests.find(
            {"user_id": uid, "status": "completed"},
            {"_id": 0, "total_prc_deducted": 1, "bill_amount": 1}
        ).to_list(1000)
        
        bill_prc = sum(bill.get("total_prc_deducted", 0) for bill in completed_bills)
        bill_value = sum(bill.get("bill_amount", 0) for bill in completed_bills)
        
        # Get completed gift vouchers
        completed_vouchers = await db.gift_voucher_requests.find(
            {"user_id": uid, "status": "completed"},
            {"_id": 0, "total_prc_deducted": 1, "denomination": 1}
        ).to_list(1000)
        
        voucher_prc = sum(voucher.get("total_prc_deducted", 0) for voucher in completed_vouchers)
        voucher_value = sum(voucher.get("denomination", 0) for voucher in completed_vouchers)
        
        # Total calculations
        total_prc_used = total_prc_redeemed + bill_prc + voucher_prc
        total_rupee_value = total_value + bill_value + voucher_value
        
        return {
            "total_prc_used": round(total_prc_used, 2),
            "total_rupee_value": round(total_rupee_value, 2),
            "breakdown": {
                "marketplace": {
                    "prc": round(total_prc_redeemed, 2),
                    "value": round(total_value, 2),
                    "count": len(completed_orders)
                },
                "bill_payments": {
                    "prc": round(bill_prc, 2),
                    "value": round(bill_value, 2),
                    "count": len(completed_bills)
                },
                "gift_vouchers": {
                    "prc": round(voucher_prc, 2),
                    "value": round(voucher_value, 2),
                    "count": len(completed_vouchers)
                }
            }
        }
    except Exception as e:
        print(f"Error getting redeemed stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
