"""
Eko API Service - Complete Integration with Standards
=====================================================
Supports: DMT (IMPS/NEFT), BBPS, Account Verification
Features:
- Proper authentication with HMAC SHA256
- Transaction status tracking
- Real-time status updates
- Comprehensive error handling
- Retry mechanism
- Logging and audit trail

Eko Transaction Status Codes:
- 0: Success
- 1: Failed
- 2: Initiated/Response Awaited (NEFT)
- 3: Refund Pending
- 4: Refunded
- 5: Hold (Inquiry Required)
"""

import os
import hmac
import hashlib
import base64
import time
import logging
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from enum import Enum
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("eko_service")

# ==================== CONFIGURATION ====================

class EkoConfig:
    """Eko API Configuration"""
    DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY")
    AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY")
    INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID")
    USER_CODE = os.environ.get("EKO_USER_CODE", "20810200")  # Default retailer code
    
    # API URLs
    PRODUCTION_URL = "https://api.eko.in:25002/ekoicici/v2"
    STAGING_URL = "https://staging.eko.in:25004/ekoapi/v2"
    
    # Use production by default, staging for testing
    BASE_URL = os.environ.get("EKO_BASE_URL", PRODUCTION_URL)
    
    # Timeouts
    DEFAULT_TIMEOUT = 60.0
    INQUIRY_TIMEOUT = 30.0
    
    # Retry settings
    MAX_RETRIES = 3
    RETRY_DELAY = 2  # seconds
    
    @classmethod
    def is_configured(cls) -> bool:
        """Check if Eko is properly configured"""
        return bool(cls.DEVELOPER_KEY and cls.AUTHENTICATOR_KEY and cls.INITIATOR_ID)
    
    @classmethod
    def get_config_status(cls) -> Dict[str, Any]:
        """Get configuration status for debugging"""
        return {
            "configured": cls.is_configured(),
            "has_developer_key": bool(cls.DEVELOPER_KEY),
            "has_auth_key": bool(cls.AUTHENTICATOR_KEY),
            "has_initiator_id": bool(cls.INITIATOR_ID),
            "base_url": cls.BASE_URL,
            "is_production": "api.eko.in" in cls.BASE_URL
        }


# ==================== ENUMS & DATA CLASSES ====================

class EkoTxStatus(Enum):
    """Eko Transaction Status Codes"""
    SUCCESS = 0
    FAILED = 1
    INITIATED = 2  # Response Awaited / NEFT Pending
    REFUND_PENDING = 3
    REFUNDED = 4
    HOLD = 5  # Inquiry Required
    
    @classmethod
    def from_value(cls, value: int) -> 'EkoTxStatus':
        for status in cls:
            if status.value == value:
                return status
        return cls.HOLD  # Default to HOLD for unknown status
    
    @property
    def description(self) -> str:
        descriptions = {
            0: "Transaction Successful",
            1: "Transaction Failed",
            2: "Transaction Initiated - Awaiting Response",
            3: "Refund Pending",
            4: "Amount Refunded",
            5: "Transaction on Hold - Inquiry Required"
        }
        return descriptions.get(self.value, "Unknown Status")
    
    @property
    def is_final(self) -> bool:
        """Check if status is final (no more updates expected)"""
        return self.value in [0, 1, 4]
    
    @property
    def needs_inquiry(self) -> bool:
        """Check if transaction needs status inquiry"""
        return self.value in [2, 5]


class EkoChannel(Enum):
    """Transfer Channel"""
    NEFT = 1
    IMPS = 2


@dataclass
class EkoResponse:
    """Standardized Eko API Response"""
    success: bool
    status_code: int
    message: str
    data: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None
    eko_tid: Optional[str] = None
    utr_number: Optional[str] = None
    tx_status: Optional[EkoTxStatus] = None
    raw_response: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "status_code": self.status_code,
            "message": self.message,
            "data": self.data,
            "error_code": self.error_code,
            "eko_tid": self.eko_tid,
            "utr_number": self.utr_number,
            "tx_status": self.tx_status.value if self.tx_status else None,
            "tx_status_desc": self.tx_status.description if self.tx_status else None
        }


# ==================== AUTHENTICATION ====================

class EkoAuth:
    """Eko Authentication Handler with HMAC SHA256"""
    
    @staticmethod
    def generate_secret_key() -> tuple:
        """
        Generate secret-key and secret-key-timestamp for Eko API
        
        IMPORTANT: Eko's Python example does NOT base64 encode the key first!
        Only Java/PHP/C# examples do base64 encoding.
        
        Algorithm (from Eko Python example):
        1. Get current timestamp in milliseconds
        2. Use key directly (NOT base64 encoded) for HMAC
        3. Compute HMAC-SHA256 of timestamp
        4. Base64 encode the signature to get secret-key
        
        Returns:
            tuple: (secret_key, timestamp)
        """
        if not EkoConfig.AUTHENTICATOR_KEY:
            raise ValueError("EKO_AUTHENTICATOR_KEY not configured")
        
        # Get timestamp in milliseconds
        timestamp = str(int(time.time() * 1000))
        
        # Use key directly (as per Eko's Python example - NOT base64 encoded)
        key = EkoConfig.AUTHENTICATOR_KEY
        key_bytes = key.encode('utf-8')
        
        # Compute HMAC SHA256 of timestamp using key directly
        message = timestamp.encode('utf-8')
        signature = hmac.new(key_bytes, message, hashlib.sha256).digest()
        
        # Base64 encode the signature to get secret-key
        secret_key = base64.b64encode(signature).decode('utf-8')
        
        return secret_key, timestamp
    
    @staticmethod
    def get_headers() -> Dict[str, str]:
        """Get authenticated headers for Eko API requests"""
        if not EkoConfig.is_configured():
            raise ValueError("Eko API not configured. Check environment variables.")
        
        secret_key, timestamp = EkoAuth.generate_secret_key()
        
        return {
            "developer_key": EkoConfig.DEVELOPER_KEY,
            "secret-key": secret_key,
            "secret-key-timestamp": timestamp,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        }
    
    @staticmethod
    def generate_request_hash(timestamp: str, utility_acc_no: str, amount: str, user_code: str) -> str:
        """
        Generate request_hash for additional security (optional)
        
        Used for sensitive operations like fund transfer
        
        Algorithm (from Eko Python example - same as secret-key):
        Use key directly, NOT base64 encoded
        """
        if not EkoConfig.AUTHENTICATOR_KEY:
            raise ValueError("EKO_AUTHENTICATOR_KEY not configured")
        
        # Use key directly (as per Eko Python example)
        key = EkoConfig.AUTHENTICATOR_KEY
        key_bytes = key.encode('utf-8')
        
        # Concatenate parameters
        concat_string = f"{timestamp}{utility_acc_no}{amount}{user_code}"
        message = concat_string.encode('utf-8')
        
        # Compute HMAC SHA256 with key directly
        signature = hmac.new(key_bytes, message, hashlib.sha256).digest()
        
        return base64.b64encode(signature).decode('utf-8')


# ==================== EKO SERVICE CLASS ====================

class EkoService:
    """
    Main Eko Service Class
    Handles all Eko API operations with proper error handling
    """
    
    def __init__(self, db=None):
        self.db = db
        self.client = None
    
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        timeout: float = EkoConfig.DEFAULT_TIMEOUT
    ) -> EkoResponse:
        """
        Make authenticated request to Eko API
        
        Args:
            method: HTTP method (GET, POST)
            endpoint: API endpoint (without base URL)
            data: Form data for POST requests
            params: Query parameters
            timeout: Request timeout in seconds
            
        Returns:
            EkoResponse object
        """
        if not EkoConfig.is_configured():
            return EkoResponse(
                success=False,
                status_code=500,
                message="Eko API not configured",
                error_code="EKO_NOT_CONFIGURED"
            )
        
        url = f"{EkoConfig.BASE_URL}{endpoint}"
        
        try:
            headers = EkoAuth.get_headers()
            
            async with httpx.AsyncClient(timeout=timeout) as client:
                if method.upper() == "GET":
                    response = await client.get(url, headers=headers, params=params)
                elif method.upper() == "POST":
                    response = await client.post(url, headers=headers, data=data, params=params)
                else:
                    return EkoResponse(
                        success=False,
                        status_code=400,
                        message=f"Unsupported HTTP method: {method}",
                        error_code="INVALID_METHOD"
                    )
                
                result = response.json()
                logger.info(f"Eko API Response [{endpoint}]: {result}")
                
                # Parse response
                status = result.get("status", -1)
                response_status_id = result.get("response_status_id", -1)
                
                if status == 0 or response_status_id == 0:
                    # Success
                    data_obj = result.get("data", {})
                    tx_status_val = data_obj.get("tx_status")
                    tx_status = EkoTxStatus.from_value(int(tx_status_val)) if tx_status_val is not None else None
                    
                    return EkoResponse(
                        success=True,
                        status_code=status,
                        message=result.get("message", "Success"),
                        data=data_obj,
                        eko_tid=data_obj.get("tid"),
                        utr_number=data_obj.get("utrnumber") or data_obj.get("bank_ref_num"),
                        tx_status=tx_status,
                        raw_response=result
                    )
                else:
                    # Error
                    return EkoResponse(
                        success=False,
                        status_code=status,
                        message=result.get("message", "Request failed"),
                        error_code=str(result.get("response_type_id", "UNKNOWN")),
                        raw_response=result
                    )
                    
        except httpx.TimeoutException:
            logger.error(f"Eko API Timeout: {endpoint}")
            return EkoResponse(
                success=False,
                status_code=504,
                message="Request timeout - please check transaction status",
                error_code="TIMEOUT"
            )
        except httpx.ConnectError as e:
            logger.error(f"Eko API Connection Error: {e}")
            return EkoResponse(
                success=False,
                status_code=503,
                message="Unable to connect to Eko API",
                error_code="CONNECTION_ERROR"
            )
        except Exception as e:
            logger.error(f"Eko API Error: {e}")
            return EkoResponse(
                success=False,
                status_code=500,
                message=str(e),
                error_code="INTERNAL_ERROR"
            )
    
    # ==================== ACCOUNT VERIFICATION ====================
    
    async def verify_bank_account(self, ifsc: str, account_number: str) -> EkoResponse:
        """
        Verify bank account details using Eko API
        
        Args:
            ifsc: Bank IFSC code
            account_number: Bank account number
            
        Returns:
            EkoResponse with account holder name if verified
        """
        endpoint = f"/banks/ifsc:{ifsc}/accounts/{account_number}"
        params = {
            "initiator_id": EkoConfig.INITIATOR_ID,
            "user_code": EkoConfig.USER_CODE
        }
        
        response = await self._make_request("GET", endpoint, params=params, timeout=60.0)
        
        if response.success and response.data:
            response.data["account_holder"] = response.data.get("account_name", "")
            response.data["verified"] = True
        
        return response
    
    # ==================== CUSTOMER MANAGEMENT ====================
    
    async def get_customer_info(self, customer_mobile: str) -> EkoResponse:
        """
        Get customer information from Eko
        
        Args:
            customer_mobile: Customer's 10-digit mobile number
        """
        endpoint = f"/customers/mobile_number:{customer_mobile}"
        params = {
            "initiator_id": EkoConfig.INITIATOR_ID,
            "user_code": EkoConfig.USER_CODE
        }
        
        return await self._make_request("GET", endpoint, params=params)
    
    async def create_customer(self, customer_mobile: str, customer_name: str) -> EkoResponse:
        """
        Create/Register a new customer on Eko platform
        
        Args:
            customer_mobile: Customer's 10-digit mobile number
            customer_name: Customer's full name
        """
        endpoint = f"/customers/mobile_number:{customer_mobile}"
        data = {
            "initiator_id": EkoConfig.INITIATOR_ID,
            "user_code": EkoConfig.USER_CODE,
            "name": customer_name,
            "residence_address": "India"
        }
        
        return await self._make_request("POST", endpoint, data=data)
    
    async def verify_customer_otp(self, customer_mobile: str, otp: str) -> EkoResponse:
        """
        Verify customer using OTP
        
        Args:
            customer_mobile: Customer's mobile number
            otp: OTP received on mobile
        """
        endpoint = f"/customers/verification/otp:{otp}"
        data = {
            "initiator_id": EkoConfig.INITIATOR_ID,
            "user_code": EkoConfig.USER_CODE,
            "id_type": "mobile_number",
            "id": customer_mobile
        }
        
        return await self._make_request("POST", endpoint, data=data)
    
    # ==================== RECIPIENT MANAGEMENT ====================
    
    async def add_recipient(
        self,
        customer_mobile: str,
        recipient_name: str,
        account_number: str,
        ifsc: str,
        recipient_mobile: str = None
    ) -> EkoResponse:
        """
        Add a new recipient/beneficiary for money transfer
        
        Args:
            customer_mobile: Customer's mobile number
            recipient_name: Recipient's name as per bank
            account_number: Recipient's bank account number
            ifsc: Bank IFSC code
            recipient_mobile: Recipient's mobile (optional)
        """
        endpoint = f"/customers/mobile_number:{customer_mobile}/recipients"
        data = {
            "initiator_id": EkoConfig.INITIATOR_ID,
            "user_code": EkoConfig.USER_CODE,
            "recipient_name": recipient_name,
            "recipient_mobile": recipient_mobile or customer_mobile,
            "recipient_type": "3",  # Bank account
            "bank_id": "0",  # Will be derived from IFSC
            "account": account_number,
            "ifsc": ifsc
        }
        
        return await self._make_request("POST", endpoint, data=data)
    
    async def get_recipients(self, customer_mobile: str) -> EkoResponse:
        """
        Get list of recipients for a customer
        """
        endpoint = f"/customers/mobile_number:{customer_mobile}/recipients"
        params = {
            "initiator_id": EkoConfig.INITIATOR_ID,
            "user_code": EkoConfig.USER_CODE
        }
        
        return await self._make_request("GET", endpoint, params=params)
    
    # ==================== MONEY TRANSFER (DMT) ====================
    
    async def initiate_transfer(
        self,
        customer_mobile: str,
        recipient_id: str,
        amount: int,
        client_ref_id: str,
        channel: EkoChannel = EkoChannel.IMPS,
        latlong: str = "19.0760,72.8777"
    ) -> EkoResponse:
        """
        Initiate money transfer to a recipient
        
        Args:
            customer_mobile: Customer's mobile number
            recipient_id: Recipient ID from add_recipient
            amount: Amount in INR (integer)
            client_ref_id: Unique reference ID from your system
            channel: Transfer channel (IMPS or NEFT)
            latlong: Location coordinates
            
        Returns:
            EkoResponse with transaction details
            
        Transaction Status in response:
            - tx_status: 0 = Success, 2 = Initiated (check later)
        """
        endpoint = "/transactions"
        
        # Generate timestamp for request
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        
        data = {
            "initiator_id": EkoConfig.INITIATOR_ID,
            "user_code": EkoConfig.USER_CODE,
            "customer_id": customer_mobile,
            "recipient_id": recipient_id,
            "amount": str(int(amount)),
            "timestamp": timestamp,
            "currency": "INR",
            "client_ref_id": client_ref_id,
            "channel": str(channel.value),
            "state": "1",  # 1 = Commit
            "latlong": latlong
        }
        
        response = await self._make_request("POST", endpoint, data=data, timeout=90.0)
        
        # Log transaction for audit
        await self._log_transaction(client_ref_id, "initiate", response)
        
        return response
    
    async def direct_transfer(
        self,
        account_number: str,
        ifsc: str,
        amount: int,
        recipient_name: str,
        recipient_mobile: str,
        client_ref_id: str,
        channel: EkoChannel = EkoChannel.IMPS
    ) -> EkoResponse:
        """
        Direct bank transfer without customer registration (Settlement API)
        
        This is used for merchant-initiated transfers where the merchant
        pays from their own wallet to any bank account.
        
        Args:
            account_number: Destination bank account
            ifsc: Bank IFSC code
            amount: Amount in INR
            recipient_name: Name of recipient
            recipient_mobile: Mobile number of recipient
            client_ref_id: Unique reference ID
            channel: IMPS or NEFT
        """
        # Use settlement API for direct transfers
        endpoint = f"/agent/user_code:{EkoConfig.USER_CODE}/settlement"
        
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        
        data = {
            "initiator_id": EkoConfig.INITIATOR_ID,
            "recipient_name": recipient_name,
            "account": account_number,
            "ifsc": ifsc,
            "amount": str(int(amount)),
            "client_ref_id": client_ref_id,
            "customer_id": recipient_mobile,
            "timestamp": timestamp,
            "channel": str(channel.value),
            "latlong": "19.0760,72.8777"
        }
        
        response = await self._make_request("POST", endpoint, data=data, timeout=90.0)
        
        # Log transaction
        await self._log_transaction(client_ref_id, "direct_transfer", response)
        
        return response
    
    # ==================== TRANSACTION STATUS ====================
    
    async def check_transaction_status(
        self,
        transaction_id: str,
        use_client_ref: bool = False
    ) -> EkoResponse:
        """
        Check status of a transaction
        
        Args:
            transaction_id: Eko TID or client_ref_id
            use_client_ref: If True, use client_ref_id format
            
        Returns:
            EkoResponse with current transaction status
        """
        if use_client_ref:
            endpoint = f"/transactions/client_ref_id:{transaction_id}"
        else:
            endpoint = f"/transactions/{transaction_id}"
        
        params = {
            "initiator_id": EkoConfig.INITIATOR_ID,
            "user_code": EkoConfig.USER_CODE
        }
        
        return await self._make_request(
            "GET", 
            endpoint, 
            params=params, 
            timeout=EkoConfig.INQUIRY_TIMEOUT
        )
    
    async def poll_transaction_until_final(
        self,
        transaction_id: str,
        use_client_ref: bool = False,
        max_attempts: int = 10,
        interval_seconds: int = 5
    ) -> EkoResponse:
        """
        Poll transaction status until it reaches a final state
        
        Useful for NEFT transactions which may take time
        
        Args:
            transaction_id: Transaction ID to poll
            use_client_ref: Use client reference ID
            max_attempts: Maximum polling attempts
            interval_seconds: Seconds between polls
        """
        import asyncio
        
        for attempt in range(max_attempts):
            response = await self.check_transaction_status(transaction_id, use_client_ref)
            
            if not response.success:
                logger.warning(f"Status check failed (attempt {attempt + 1}): {response.message}")
                if attempt < max_attempts - 1:
                    await asyncio.sleep(interval_seconds)
                continue
            
            if response.tx_status and response.tx_status.is_final:
                logger.info(f"Transaction {transaction_id} reached final status: {response.tx_status.description}")
                return response
            
            logger.info(f"Transaction {transaction_id} status: {response.tx_status.description if response.tx_status else 'Unknown'} (attempt {attempt + 1})")
            
            if attempt < max_attempts - 1:
                await asyncio.sleep(interval_seconds)
        
        # Return last response even if not final
        return response
    
    # ==================== REFUND ====================
    
    async def process_refund(self, eko_tid: str) -> EkoResponse:
        """
        Process refund for a failed transaction
        
        Args:
            eko_tid: Eko transaction ID
        """
        endpoint = f"/transactions/{eko_tid}/refund"
        data = {
            "initiator_id": EkoConfig.INITIATOR_ID,
            "user_code": EkoConfig.USER_CODE,
            "state": "1"  # Commit refund
        }
        
        return await self._make_request("POST", endpoint, data=data)
    
    # ==================== BALANCE CHECK ====================
    
    async def check_wallet_balance(self) -> EkoResponse:
        """
        Check Eko wallet/settlement balance
        """
        endpoint = f"/v1/customers/mobile_number:{EkoConfig.INITIATOR_ID}/balance"
        params = {
            "initiator_id": EkoConfig.INITIATOR_ID,
            "user_code": EkoConfig.USER_CODE
        }
        
        response = await self._make_request("GET", endpoint, params=params, timeout=30.0)
        
        if response.success and response.data:
            response.data["balance"] = float(response.data.get("balance", 0))
            response.data["currency"] = "INR"
        
        return response
    
    # ==================== LOGGING & AUDIT ====================
    
    async def _log_transaction(
        self,
        client_ref_id: str,
        operation: str,
        response: EkoResponse
    ):
        """Log transaction for audit trail"""
        if self.db is None:
            return
        
        try:
            log_entry = {
                "client_ref_id": client_ref_id,
                "operation": operation,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "success": response.success,
                "status_code": response.status_code,
                "message": response.message,
                "eko_tid": response.eko_tid,
                "utr_number": response.utr_number,
                "tx_status": response.tx_status.value if response.tx_status else None
            }
            
            await self.db.eko_transaction_logs.insert_one(log_entry)
        except Exception as e:
            logger.error(f"Failed to log transaction: {e}")


# ==================== TRANSACTION STATUS UPDATER ====================

class EkoStatusUpdater:
    """
    Background service to update pending transaction statuses
    """
    
    def __init__(self, db, eko_service: EkoService):
        self.db = db
        self.eko_service = eko_service
    
    async def update_pending_transactions(self, collection_name: str = "bank_withdrawal_requests"):
        """
        Check and update status of all pending Eko transactions
        
        Should be called periodically (every 5-10 minutes)
        """
        if self.db is None:
            logger.error("Database not configured")
            return {"updated": 0, "errors": [], "checked": 0}
        
        # Find pending transactions with Eko TID
        pending = await self.db[collection_name].find({
            "status": {"$in": ["pending", "processing", "eko_initiated"]},
            "$or": [
                {"eko_tid": {"$exists": True, "$ne": None}},
                {"eko_txn_id": {"$exists": True, "$ne": None}}
            ]
        }).to_list(100)
        
        updated = 0
        errors = []
        
        for txn in pending:
            try:
                eko_tid = txn.get("eko_tid") or txn.get("eko_txn_id")
                client_ref = txn.get("request_id") or txn.get("client_ref_id")
                
                # Check status using TID first, then client_ref
                response = await self.eko_service.check_transaction_status(eko_tid)
                
                if not response.success and client_ref:
                    response = await self.eko_service.check_transaction_status(client_ref, use_client_ref=True)
                
                if response.success and response.tx_status:
                    new_status = self._map_eko_status_to_internal(response.tx_status)
                    
                    update_data = {
                        "eko_tx_status": response.tx_status.value,
                        "eko_tx_status_desc": response.tx_status.description,
                        "eko_last_checked": datetime.now(timezone.utc).isoformat(),
                        "utr_number": response.utr_number
                    }
                    
                    if new_status != txn.get("status"):
                        update_data["status"] = new_status
                        update_data["status_updated_at"] = datetime.now(timezone.utc).isoformat()
                        
                        if new_status == "completed":
                            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
                        elif new_status == "failed":
                            update_data["failed_at"] = datetime.now(timezone.utc).isoformat()
                            update_data["failure_reason"] = response.message
                    
                    await self.db[collection_name].update_one(
                        {"_id": txn["_id"]},
                        {"$set": update_data}
                    )
                    updated += 1
                    
                    logger.info(f"Updated transaction {client_ref}: {txn.get('status')} -> {new_status}")
                    
            except Exception as e:
                errors.append({"txn_id": str(txn.get("_id")), "error": str(e)})
                logger.error(f"Error updating transaction: {e}")
        
        return {"updated": updated, "errors": errors, "checked": len(pending)}
    
    def _map_eko_status_to_internal(self, eko_status: EkoTxStatus) -> str:
        """Map Eko status to internal status"""
        mapping = {
            EkoTxStatus.SUCCESS: "completed",
            EkoTxStatus.FAILED: "failed",
            EkoTxStatus.INITIATED: "processing",
            EkoTxStatus.REFUND_PENDING: "refund_pending",
            EkoTxStatus.REFUNDED: "refunded",
            EkoTxStatus.HOLD: "on_hold"
        }
        return mapping.get(eko_status, "processing")


# ==================== UTILITY FUNCTIONS ====================

def get_eko_service(db=None) -> EkoService:
    """Factory function to get EkoService instance"""
    return EkoService(db)


async def quick_status_check(client_ref_id: str) -> Dict[str, Any]:
    """Quick utility to check transaction status"""
    service = EkoService()
    response = await service.check_transaction_status(client_ref_id, use_client_ref=True)
    return response.to_dict()


# ==================== ERROR CODES ====================

EKO_ERROR_CODES = {
    "44": "Customer not found",
    "45": "Recipient not found",
    "131": "Invalid OTP",
    "302": "Insufficient balance",
    "303": "Daily limit exceeded",
    "304": "Monthly limit exceeded",
    "305": "Invalid amount",
    "306": "Invalid IFSC",
    "307": "Invalid account number",
    "308": "Account verification failed",
    "309": "Transfer failed - bank error",
    "310": "Transfer timeout",
    "311": "Duplicate transaction",
    "312": "Invalid recipient",
    "403": "Access denied - check IP whitelist",
    "500": "Internal server error",
    "503": "Service temporarily unavailable"
}


def get_error_message(error_code: str) -> str:
    """Get human-readable error message from Eko error code"""
    return EKO_ERROR_CODES.get(str(error_code), f"Unknown error (code: {error_code})")
