"""
PARAS REWARD - EKO BBPS MULTI SERVICE BACKEND
Clean implementation following official EKO documentation

Services:
1. Electricity Bill Payment
2. DTH Recharge
3. FASTag Recharge
4. Loan / EMI Payment
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import requests
import base64
import hashlib
import hmac
import time
import logging

router = APIRouter(prefix="/bbps", tags=["BBPS Services"])

# ==================== EKO PRODUCTION CONFIG ====================

BASE_URL = "https://api.eko.in:25002/ekoicici"
DEVELOPER_KEY = "7c179a397b4710e71b2248d1f5892d19"
INITIATOR_ID = "9936606966"
AUTH_KEY = "7a2529f5-3587-4add-a2df-3d0606d62460"
SOURCE_IP = "34.44.149.98"
USER_CODE = "20810200"

# ==================== AUTHENTICATION ====================

def generate_headers() -> Dict[str, str]:
    """
    Generate authentication headers as per EKO documentation.
    
    Algorithm:
    1. timestamp = milliseconds
    2. encoded_key = Base64(authenticator_key)
    3. secret_key = Base64(HMAC_SHA256(encoded_key, timestamp))
    """
    timestamp = str(int(time.time() * 1000))
    
    encoded_key = base64.b64encode(AUTH_KEY.encode()).decode()
    
    secret_key = base64.b64encode(
        hmac.new(
            encoded_key.encode(),
            timestamp.encode(),
            hashlib.sha256
        ).digest()
    ).decode()
    
    return {
        "developer_key": DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp,
        "Content-Type": "application/json"
    }


# ==================== REQUEST MODELS ====================

class FetchBillRequest(BaseModel):
    operator_id: str
    account: str  # utility_acc_no
    mobile: str   # confirmation_mobile_no


class PayBillRequest(BaseModel):
    operator_id: str
    account: str
    amount: str
    mobile: str


# ==================== HEALTH CHECK ====================

@router.get("/health")
def health():
    return {"status": "PARAS REWARD BBPS RUNNING"}


# ==================== FETCH BILL ====================

@router.post("/fetch")
def fetch_bill(data: FetchBillRequest):
    """
    Fetch bill details from EKO BBPS API.
    
    Works for: Electricity, DTH, FASTag, EMI
    """
    try:
        url = f"{BASE_URL}/v2/billpayments/fetchbill?initiator_id={INITIATOR_ID}"
        
        body = {
            "operator_id": data.operator_id,
            "utility_acc_no": data.account,
            "confirmation_mobile_no": data.mobile,
            "source_ip": SOURCE_IP,
            "user_code": USER_CODE,
            "client_ref_id": f"FETCH{int(time.time())}",
            "sender_name": "Paras Reward",
            "latlong": "19.9975,73.7898"
        }
        
        logging.info(f"[BBPS FETCH] URL: {url}")
        logging.info(f"[BBPS FETCH] Operator: {data.operator_id}, Account: {data.account[-4:]}")
        
        response = requests.post(url, json=body, headers=generate_headers(), timeout=60)
        
        logging.info(f"[BBPS FETCH] Status: {response.status_code}")
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=response.text
            )
        
        result = response.json()
        logging.info(f"[BBPS FETCH] Response: {result}")
        
        # Parse Eko response
        eko_status = result.get("status")
        eko_data = result.get("data", {})
        
        if eko_status == 0:
            # Success
            return {
                "success": True,
                "bill_amount": eko_data.get("amount"),
                "customer_name": eko_data.get("utilitycustomername"),
                "bill_date": eko_data.get("billdate"),
                "due_date": eko_data.get("duedate"),
                "bill_number": eko_data.get("billnumber"),
                "raw_response": result
            }
        else:
            # Error from Eko
            reason = eko_data.get("reason", "") if isinstance(eko_data, dict) else ""
            return {
                "success": False,
                "message": reason or result.get("message", "Unable to fetch bill"),
                "error_code": str(eko_status),
                "raw_response": result
            }
            
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="EKO server timeout")
    except Exception as e:
        logging.error(f"[BBPS FETCH] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PAY BILL ====================

@router.post("/pay")
def pay_bill(data: PayBillRequest):
    """
    Pay bill via EKO BBPS API.
    
    Works for: Electricity, DTH, FASTag, EMI
    """
    try:
        url = f"{BASE_URL}/v2/billpayments/paybill?initiator_id={INITIATOR_ID}"
        
        body = {
            "amount": data.amount,
            "operator_id": data.operator_id,
            "utility_acc_no": data.account,
            "confirmation_mobile_no": data.mobile,
            "source_ip": SOURCE_IP,
            "user_code": USER_CODE,
            "client_ref_id": f"PAY{int(time.time())}",
            "sender_name": "Paras Reward",
            "latlong": "19.9975,73.7898"
        }
        
        logging.info(f"[BBPS PAY] URL: {url}")
        logging.info(f"[BBPS PAY] Operator: {data.operator_id}, Amount: {data.amount}")
        
        response = requests.post(url, json=body, headers=generate_headers(), timeout=60)
        
        logging.info(f"[BBPS PAY] Status: {response.status_code}")
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=response.text
            )
        
        result = response.json()
        logging.info(f"[BBPS PAY] Response: {result}")
        
        # Parse Eko response
        eko_status = result.get("status")
        eko_data = result.get("data", {})
        
        if eko_status == 0:
            # Success
            return {
                "success": True,
                "status": "SUCCESS",
                "tid": eko_data.get("tid"),
                "bbps_ref": eko_data.get("bbpstrxnrefid"),
                "message": result.get("message", "Payment successful"),
                "raw_response": result
            }
        elif eko_data.get("tx_status") == 2:
            # Processing
            return {
                "success": True,
                "status": "PROCESSING",
                "tid": eko_data.get("tid"),
                "message": "Payment is being processed",
                "raw_response": result
            }
        else:
            # Failed
            return {
                "success": False,
                "status": "FAILED",
                "tid": eko_data.get("tid"),
                "message": result.get("message", "Payment failed"),
                "error_code": str(eko_status),
                "raw_response": result
            }
            
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Payment timeout from EKO")
    except Exception as e:
        logging.error(f"[BBPS PAY] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== GET OPERATORS ====================

@router.get("/operators/{category}")
def get_operators(category: str):
    """
    Get operators list for a category.
    
    EKO BBPS Categories (verified):
    - 1: Mobile Prepaid (92 operators)
    - 4: DTH (5 operators)
    - 6: EMI/Loan legacy (2 operators)
    - 7: Credit Card (29 operators)
    - 8: Electricity (89 operators)
    - 9: Landline (5 operators)
    - 10: Mobile Postpaid (7 operators)
    - 11: Water (54 operators)
    - 12: Housing Society (105 operators)
    - 20: Insurance (40 operators)
    - 21: Loan/EMI (294 operators)
    - 22: FASTag (20 operators)
    """
    category_map = {
        # Recharge
        "mobile_recharge": 1,
        "mobile_prepaid": 1,
        "dth": 4,
        "mobile_postpaid": 10,
        
        # Utility Bills
        "electricity": 8,
        "water": 11,
        "landline": 9,
        "broadband": 1,  # Uses same as mobile prepaid
        
        # Financial
        "emi": 21,
        "loan": 21,
        "loan_emi": 21,
        "credit_card": 7,
        "insurance": 20,
        
        # Transport & Others
        "fastag": 22,
        "housing_society": 12,
        "municipal_tax": 12
    }
    
    category_id = category_map.get(category.lower())
    
    if not category_id:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
    
    try:
        url = f"{BASE_URL}/v2/billpayments/operators?initiator_id={INITIATOR_ID}&category={category_id}"
        
        response = requests.get(url, headers=generate_headers(), timeout=30)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        result = response.json()
        operators = result.get("data", [])
        
        return {
            "success": True,
            "category": category,
            "count": len(operators),
            "operators": [
                {
                    "operator_id": op.get("operator_id"),
                    "name": op.get("name"),
                    "fetch_bill": op.get("billFetchResponse", 0) == 1
                }
                for op in operators
            ]
        }
        
    except Exception as e:
        logging.error(f"[BBPS OPERATORS] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== GET OPERATOR PARAMS ====================

@router.get("/operator-params/{operator_id}")
def get_operator_params(operator_id: int):
    """
    Get operator parameters (required fields, regex validation).
    """
    try:
        url = f"{BASE_URL}/v2/billpayments/operators/{operator_id}?initiator_id={INITIATOR_ID}"
        
        response = requests.get(url, headers=generate_headers(), timeout=30)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        result = response.json()
        
        return {
            "success": True,
            "operator_id": operator_id,
            "operator_name": result.get("operator_name"),
            "fetch_bill_required": result.get("fetchBill") == 1,
            "parameters": result.get("parameters", []),
            "raw_response": result
        }
        
    except Exception as e:
        logging.error(f"[BBPS PARAMS] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
