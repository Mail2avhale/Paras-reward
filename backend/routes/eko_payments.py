"""
Eko.in API Integration - LIVE
- BBPS Bill Payments (Electricity, Gas, Water, Mobile, DTH, etc.)
- DMT (Domestic Money Transfer)

Documentation: https://developers.eko.in
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
import httpx
import os
import hashlib
import hmac
import base64
import json
import time
from datetime import datetime, timezone
import logging

router = APIRouter(prefix="/eko", tags=["Eko Bill Payment & DMT"])

# Eko API Configuration - LIVE
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID")
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")

# Database reference
db = None

def set_db(database):
    global db
    db = database


# ==================== HELPER FUNCTIONS ====================

def generate_secret_key():
    """Generate secret-key from authenticator key (base64 encoded)"""
    if not EKO_AUTHENTICATOR_KEY:
        return None
    return base64.b64encode(EKO_AUTHENTICATOR_KEY.encode()).decode()


def get_secret_key_timestamp():
    """Get current timestamp in milliseconds"""
    return str(int(time.time() * 1000))


async def make_eko_request(endpoint: str, method: str = "GET", data: dict = None, form_data: bool = False):
    """Make authenticated request to Eko API"""
    if not EKO_DEVELOPER_KEY or not EKO_AUTHENTICATOR_KEY:
        raise HTTPException(status_code=500, detail="Eko API credentials not configured")
    
    url = f"{EKO_BASE_URL}{endpoint}"
    
    # Generate authentication headers
    secret_key = generate_secret_key()
    secret_key_timestamp = get_secret_key_timestamp()
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": secret_key_timestamp,
    }
    
    # Add initiator_id to data if not present
    if data is None:
        data = {}
    data["initiator_id"] = data.get("initiator_id", EKO_INITIATOR_ID)
    
    async with httpx.AsyncClient(timeout=60.0, verify=True) as client:
        try:
            logging.info(f"Eko API Request: {method} {url}")
            logging.info(f"Eko Data: {data}")
            
            if method == "GET":
                response = await client.get(url, headers=headers, params=data)
            elif method == "POST":
                # Eko uses form data for POST requests
                headers["Content-Type"] = "application/x-www-form-urlencoded"
                response = await client.post(url, headers=headers, data=data)
                else:
                    headers["Content-Type"] = "application/json"
                    response = await client.post(url, headers=headers, json=data)
            elif method == "PUT":
                if form_data:
                    headers["Content-Type"] = "application/x-www-form-urlencoded"
                    response = await client.put(url, headers=headers, data=data)
                else:
                    headers["Content-Type"] = "application/json"
                    response = await client.put(url, headers=headers, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            logging.info(f"Eko API Response: {response.status_code} - {response.text[:200]}")
            
            # Try to parse JSON response
            try:
                result = response.json()
            except:
                result = {"raw_response": response.text}
            
            # Check for Eko error responses
            if response.status_code >= 400:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=result.get("message", result.get("error", str(result)))
                )
            
            return result
            
        except httpx.HTTPStatusError as e:
            logging.error(f"Eko API HTTPStatusError: {e.response.text}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Eko API error: {e.response.text}"
            )
        except httpx.RequestError as e:
            logging.error(f"Eko API RequestError: {type(e).__name__}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Connection error: {type(e).__name__}: {str(e)}")
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Eko request failed: {type(e).__name__}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Request failed: {type(e).__name__}: {str(e)}")


# ==================== PYDANTIC MODELS ====================

class BillFetchRequest(BaseModel):
    category: str  # electricity, water, gas, mobile_postpaid, dth, broadband, etc.
    biller_id: str
    customer_params: dict  # {param_name: value} e.g., {"ca_number": "123456789"}


class BillPayRequest(BaseModel):
    user_id: str
    category: str
    biller_id: str
    customer_params: dict
    amount: float
    bill_fetch_ref: Optional[str] = None


class DMTRecipientRequest(BaseModel):
    customer_mobile: str
    recipient_name: str
    recipient_mobile: str
    bank_ifsc: str
    account_number: str


class DMTTransferRequest(BaseModel):
    user_id: str
    customer_mobile: str
    recipient_id: str
    amount: float
    otp: Optional[str] = None


# ==================== BBPS BILL PAYMENT APIs ====================

@router.get("/config")
async def get_eko_config():
    """Get Eko configuration status"""
    return {
        "configured": bool(EKO_DEVELOPER_KEY and EKO_AUTHENTICATOR_KEY),
        "base_url": EKO_BASE_URL,
        "initiator_id": EKO_INITIATOR_ID,
        "environment": "sandbox" if "staging" in EKO_BASE_URL else "production"
    }


@router.get("/bbps/categories")
async def get_bill_categories():
    """Get available bill payment categories"""
    # Static list - can be fetched from Eko API
    categories = [
        {"id": "electricity", "name": "Electricity", "icon": "⚡"},
        {"id": "water", "name": "Water", "icon": "💧"},
        {"id": "gas", "name": "Gas/LPG", "icon": "🔥"},
        {"id": "mobile_postpaid", "name": "Mobile Postpaid", "icon": "📱"},
        {"id": "landline", "name": "Landline", "icon": "☎️"},
        {"id": "broadband", "name": "Broadband", "icon": "🌐"},
        {"id": "dth", "name": "DTH", "icon": "📺"},
        {"id": "fastag", "name": "FASTag", "icon": "🚗"},
        {"id": "insurance", "name": "Insurance", "icon": "🛡️"},
        {"id": "loan_emi", "name": "Loan EMI", "icon": "💰"},
        {"id": "credit_card", "name": "Credit Card", "icon": "💳"},
        {"id": "education", "name": "Education Fees", "icon": "🎓"},
        {"id": "municipal_tax", "name": "Municipal Tax", "icon": "🏛️"},
    ]
    return {"categories": categories}


@router.get("/bbps/billers/{category}")
async def get_billers_by_category(category: str):
    """Get list of billers for a category"""
    try:
        # Eko API endpoint for billers
        # Base URL already contains /ekoicici, so just add the remaining path
        result = await make_eko_request(
            "/v2/billpayments/operators",
            method="GET",
            data={"category": category}
        )
        return result
    except Exception as e:
        logging.warning(f"Eko billers API failed: {e}")
        # Return sample billers if API fails
        sample_billers = {
            "electricity": [
                {"id": "MSEB", "name": "Maharashtra State Electricity Board"},
                {"id": "TATA_POWER", "name": "Tata Power"},
                {"id": "ADANI", "name": "Adani Electricity"},
            ],
            "mobile_postpaid": [
                {"id": "JIO", "name": "Jio Postpaid"},
                {"id": "AIRTEL", "name": "Airtel Postpaid"},
                {"id": "VI", "name": "Vi Postpaid"},
            ]
        }
        return {"billers": sample_billers.get(category, []), "note": f"Sample data - {str(e)}"}


@router.post("/bbps/fetch-bill")
async def fetch_bill(request: BillFetchRequest):
    """Fetch bill details before payment"""
    try:
        # Eko API call to fetch bill
        result = await make_eko_request(
            "/v2/billpayments/fetchbill",
            method="POST",
            data={
                "utility_acc_no": list(request.customer_params.values())[0],
                "operator_id": request.biller_id,
                "confirmation_mobile_no": EKO_INITIATOR_ID
            }
        )
        
        # Log the fetch
        if db is not None:
            await db.bill_fetch_logs.insert_one({
                "category": request.category,
                "biller_id": request.biller_id,
                "customer_params": request.customer_params,
                "response": result,
                "timestamp": datetime.now(timezone.utc)
            })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Bill fetch failed: {e}")
        raise HTTPException(status_code=500, detail=f"Bill fetch failed: {str(e)}")


@router.post("/bbps/pay-bill")
async def pay_bill(request: BillPayRequest):
    """Pay a bill through BBPS"""
    try:
        # Create unique transaction reference
        txn_ref = f"PARAS{datetime.now().strftime('%Y%m%d%H%M%S')}{request.user_id[-6:]}"
        
        # Eko API call to pay bill
        result = await make_eko_request(
            "/v2/billpayments/paybill",
            method="POST",
            data={
                "utility_acc_no": list(request.customer_params.values())[0],
                "operator_id": request.biller_id,
                "amount": str(int(request.amount)),
                "confirmation_mobile_no": EKO_INITIATOR_ID,
                "client_ref_id": txn_ref,
                "latlong": "19.0760,72.8777",  # Mumbai coordinates
                "source_ip": "34.170.12.145"  # Will be updated
            }
        )
        
        # Log transaction
        if db is not None:
            await db.eko_transactions.insert_one({
                "type": "bill_payment",
                "user_id": request.user_id,
                "category": request.category,
                "biller_id": request.biller_id,
                "customer_params": request.customer_params,
                "amount": request.amount,
                "txn_ref": txn_ref,
                "eko_response": result,
                "status": result.get("status", "pending"),
                "timestamp": datetime.now(timezone.utc)
            })
        
        return {
            "success": True,
            "txn_ref": txn_ref,
            "eko_txn_id": result.get("tid"),
            "status": result.get("status"),
            "message": result.get("message", "Bill payment initiated")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Bill payment failed: {e}")
        raise HTTPException(status_code=500, detail=f"Bill payment failed: {str(e)}")


@router.get("/bbps/transaction-status/{txn_ref}")
async def get_bill_transaction_status(txn_ref: str):
    """Get status of a bill payment transaction"""
    try:
        result = await make_eko_request(
            f"/v2/billpayments/status",
            method="GET",
            data={"client_ref_id": txn_ref}
        )
        return result
    except Exception as e:
        # Check local database
        if db is not None:
            txn = await db.eko_transactions.find_one(
                {"txn_ref": txn_ref},
                {"_id": 0}
            )
            if txn:
                return {"transaction": txn, "source": "local_db"}
        raise HTTPException(status_code=404, detail="Transaction not found")


# ==================== DMT (Money Transfer) APIs ====================

@router.post("/dmt/register-sender")
async def register_dmt_sender(mobile: str, name: str):
    """Register a sender for DMT"""
    try:
        result = await make_eko_request(
            "/v2/customers",
            method="POST",
            data={
                "mobile": mobile,
                "name": name
            }
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sender registration failed: {str(e)}")


@router.get("/dmt/sender/{mobile}")
async def get_sender_details(mobile: str):
    """Get sender details and KYC status"""
    try:
        result = await make_eko_request(
            f"/v2/customers/{mobile}",
            method="GET"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Sender not found: {str(e)}")


@router.post("/dmt/add-recipient")
async def add_dmt_recipient(request: DMTRecipientRequest):
    """Add a bank account recipient for DMT"""
    try:
        result = await make_eko_request(
            f"/v2/customers/{request.customer_mobile}/recipients",
            method="POST",
            data={
                "recipient_name": request.recipient_name,
                "recipient_mobile": request.recipient_mobile,
                "bank_ifsc": request.bank_ifsc,
                "account": request.account_number
            }
        )
        
        # Log recipient addition
        if db is not None:
            await db.dmt_recipients.insert_one({
                "customer_mobile": request.customer_mobile,
                "recipient_name": request.recipient_name,
                "bank_ifsc": request.bank_ifsc,
                "account_last4": request.account_number[-4:],
                "eko_recipient_id": result.get("recipient_id"),
                "timestamp": datetime.now(timezone.utc)
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recipient addition failed: {str(e)}")


@router.get("/dmt/recipients/{mobile}")
async def get_dmt_recipients(mobile: str):
    """Get list of recipients for a sender"""
    try:
        result = await make_eko_request(
            f"/v2/customers/{mobile}/recipients",
            method="GET"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Recipients not found: {str(e)}")


@router.post("/dmt/verify-account")
async def verify_bank_account(ifsc: str, account_number: str):
    """Verify bank account before transfer"""
    try:
        result = await make_eko_request(
            "/v2/banks/ifsc/accounts/verify",
            method="POST",
            data={
                "ifsc": ifsc,
                "account": account_number
            }
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Account verification failed: {str(e)}")


@router.post("/dmt/send-otp")
async def send_dmt_otp(mobile: str, amount: float):
    """Send OTP for DMT transaction"""
    try:
        result = await make_eko_request(
            f"/v2/customers/{mobile}/otp",
            method="POST",
            data={"amount": str(int(amount))}
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OTP sending failed: {str(e)}")


@router.post("/dmt/transfer")
async def initiate_dmt_transfer(request: DMTTransferRequest):
    """Initiate money transfer to bank account"""
    try:
        # Create unique transaction reference
        txn_ref = f"DMT{datetime.now().strftime('%Y%m%d%H%M%S')}{request.user_id[-6:]}"
        
        result = await make_eko_request(
            f"/v2/customers/{request.customer_mobile}/transfer",
            method="POST",
            data={
                "recipient_id": request.recipient_id,
                "amount": str(int(request.amount)),
                "otp": request.otp,
                "client_ref_id": txn_ref,
                "latlong": "19.0760,72.8777",
                "source_ip": "34.170.12.145"
            }
        )
        
        # Log transaction
        if db is not None:
            await db.eko_transactions.insert_one({
                "type": "dmt_transfer",
                "user_id": request.user_id,
                "customer_mobile": request.customer_mobile,
                "recipient_id": request.recipient_id,
                "amount": request.amount,
                "txn_ref": txn_ref,
                "eko_response": result,
                "status": result.get("status", "pending"),
                "timestamp": datetime.now(timezone.utc)
            })
        
        return {
            "success": True,
            "txn_ref": txn_ref,
            "eko_txn_id": result.get("tid"),
            "status": result.get("status"),
            "message": result.get("message", "Transfer initiated")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"DMT transfer failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(e)}")


@router.get("/dmt/transaction-status/{txn_ref}")
async def get_dmt_transaction_status(txn_ref: str):
    """Get status of a DMT transaction"""
    try:
        result = await make_eko_request(
            "/v2/transactions/status",
            method="GET",
            data={"client_ref_id": txn_ref}
        )
        return result
    except Exception as e:
        # Check local database
        if db is not None:
            txn = await db.eko_transactions.find_one(
                {"txn_ref": txn_ref},
                {"_id": 0}
            )
            if txn:
                return {"transaction": txn, "source": "local_db"}
        raise HTTPException(status_code=404, detail="Transaction not found")


# ==================== TRANSACTION HISTORY ====================

@router.get("/transactions/{user_id}")
async def get_user_eko_transactions(user_id: str, limit: int = 50):
    """Get user's Eko transaction history"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    transactions = await db.eko_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(None)
    
    return {"transactions": transactions}


# ==================== WEBHOOK ====================

@router.post("/webhook")
async def eko_webhook(request: Request):
    """Handle Eko transaction status callbacks"""
    try:
        payload = await request.json()
        
        txn_ref = payload.get("client_ref_id")
        status = payload.get("status")
        eko_txn_id = payload.get("tid")
        
        logging.info(f"Eko webhook: {txn_ref} - {status}")
        
        # Update transaction status
        if db is not None and txn_ref:
            await db.eko_transactions.update_one(
                {"txn_ref": txn_ref},
                {
                    "$set": {
                        "status": status,
                        "eko_txn_id": eko_txn_id,
                        "webhook_data": payload,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
        
        return {"status": "ok"}
        
    except Exception as e:
        logging.error(f"Eko webhook error: {e}")
        return {"status": "error", "message": str(e)}
