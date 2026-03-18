"""
Eko Transaction Status Callback Handler

This endpoint receives transaction status updates from Eko for:
- Fund Transfer (DMT/Payout)
- BBPS Bill Payments
- QR Payments
- CMS Collections

Eko sends POST requests with transaction status updates.
Must return HTTP 200 to acknowledge receipt.

Setup: Email callback URL to sales.engineer@eko.co.in
"""

from fastapi import APIRouter, Request, HTTPException
from datetime import datetime
import logging

router = APIRouter(prefix="/eko", tags=["eko-callback"])

# Database reference (set by server.py)
db = None

def set_db(database):
    global db
    db = database

# Transaction status mapping
TX_STATUS_MAP = {
    0: "SUCCESS",
    1: "FAILED", 
    2: "INITIATED",
    3: "REFUND_PENDING",
    4: "REFUNDED",
    5: "ON_HOLD"
}

@router.post("/callback")
async def eko_transaction_callback(request: Request):
    """
    Receive transaction status updates from Eko
    
    Eko sends payload like:
    {
        "tx_status": 0,
        "amount": 120.0,
        "payment_mode": "5",
        "txstatus_desc": "SUCCESS",
        "fee": 5.0,
        "gst": 0.76,
        "sender_name": "...",
        "tid": 12971412,
        "beneficiary_account_type": null,
        "client_ref_id": "...",
        "old_tx_status": 2,
        "old_tx_status_desc": "Initiated",
        "bank_ref_num": "87694239",
        "ifsc": "SBIN0000001",
        "recipient_name": "...",
        "account": "...",
        "timestamp": "2019-11-01 18:03:48"
    }
    """
    try:
        # Get raw body for logging
        body = await request.json()
        
        logging.info(f"[EKO CALLBACK] Received: {body}")
        
        # Extract key fields
        tid = body.get("tid")
        client_ref_id = body.get("client_ref_id")
        tx_status = body.get("tx_status")
        old_tx_status = body.get("old_tx_status")
        txstatus_desc = body.get("txstatus_desc")
        amount = body.get("amount")
        bank_ref_num = body.get("bank_ref_num")
        account = body.get("account")
        ifsc = body.get("ifsc")
        recipient_name = body.get("recipient_name")
        timestamp = body.get("timestamp")
        
        # Log status change
        status_text = TX_STATUS_MAP.get(tx_status, f"UNKNOWN({tx_status})")
        old_status_text = TX_STATUS_MAP.get(old_tx_status, f"UNKNOWN({old_tx_status})")
        
        logging.info(f"[EKO CALLBACK] TID: {tid}, Ref: {client_ref_id}")
        logging.info(f"[EKO CALLBACK] Status: {old_status_text} -> {status_text}")
        logging.info(f"[EKO CALLBACK] Amount: {amount}, UTR: {bank_ref_num}")
        
        # Store callback in database
        if db is not None:
            callback_record = {
                "tid": tid,
                "client_ref_id": client_ref_id,
                "tx_status": tx_status,
                "old_tx_status": old_tx_status,
                "txstatus_desc": txstatus_desc,
                "amount": amount,
                "bank_ref_num": bank_ref_num,
                "account": account,
                "ifsc": ifsc,
                "recipient_name": recipient_name,
                "eko_timestamp": timestamp,
                "received_at": datetime.utcnow().isoformat(),
                "raw_payload": body
            }
            
            await db.eko_callbacks.insert_one(callback_record)
            logging.info(f"[EKO CALLBACK] Stored in database")
            
            # Update related redeem request if exists
            if client_ref_id:
                update_result = await db.redeem_requests.update_one(
                    {"eko_client_ref_id": client_ref_id},
                    {
                        "$set": {
                            "eko_tx_status": tx_status,
                            "eko_txstatus_desc": txstatus_desc,
                            "eko_bank_ref_num": bank_ref_num,
                            "eko_callback_received": True,
                            "eko_callback_at": datetime.utcnow().isoformat(),
                            "updated_at": datetime.utcnow().isoformat()
                        }
                    }
                )
                
                if update_result.modified_count > 0:
                    logging.info(f"[EKO CALLBACK] Updated redeem_request for {client_ref_id}")
                    
                    # If transaction failed/refunded, handle PRC refund
                    if tx_status in [1, 4]:  # FAILED or REFUNDED
                        await _handle_failed_transaction(client_ref_id, body)
        
        # Must return 200 to acknowledge
        return {"status": "success", "message": "Callback received"}
        
    except Exception as e:
        logging.error(f"[EKO CALLBACK] Error processing callback: {e}")
        # Still return 200 to prevent Eko from retrying
        return {"status": "error", "message": str(e)}


async def _handle_failed_transaction(client_ref_id: str, callback_data: dict):
    """Handle failed/refunded transactions - refund PRC to user if needed"""
    try:
        # Find the original request
        request = await db.redeem_requests.find_one(
            {"eko_client_ref_id": client_ref_id},
            {"_id": 0}
        )
        
        if not request:
            logging.warning(f"[EKO CALLBACK] No request found for {client_ref_id}")
            return
            
        user_id = request.get("user_id")
        prc_amount = request.get("prc_amount", 0)
        already_refunded = request.get("prc_refunded", False)
        
        if already_refunded:
            logging.info(f"[EKO CALLBACK] PRC already refunded for {client_ref_id}")
            return
            
        if user_id and prc_amount > 0:
            # Refund PRC to user
            await db.users.update_one(
                {"uid": user_id},
                {"$inc": {"prc_balance": prc_amount}}
            )
            
            # Mark as refunded
            await db.redeem_requests.update_one(
                {"eko_client_ref_id": client_ref_id},
                {
                    "$set": {
                        "prc_refunded": True,
                        "prc_refunded_at": datetime.utcnow().isoformat(),
                        "status": "refunded"
                    }
                }
            )
            
            logging.info(f"[EKO CALLBACK] Refunded {prc_amount} PRC to user {user_id}")
            
    except Exception as e:
        logging.error(f"[EKO CALLBACK] Error handling failed transaction: {e}")


@router.get("/callback/test")
async def test_callback_endpoint():
    """Test endpoint to verify callback URL is accessible"""
    return {
        "status": "ok",
        "message": "Eko callback endpoint is active",
        "endpoint": "/api/eko/callback",
        "method": "POST",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/callbacks/recent")
async def get_recent_callbacks(limit: int = 20):
    """Admin: Get recent Eko callbacks for debugging"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    callbacks = await db.eko_callbacks.find(
        {},
        {"_id": 0}
    ).sort("received_at", -1).limit(limit).to_list(length=limit)
    
    return {
        "success": True,
        "count": len(callbacks),
        "callbacks": callbacks
    }
