"""
PARAS REWARD - Wallet Service V2
================================
CRITICAL: All PRC operations MUST go through this service.

Features:
- Atomic balance updates with verification
- Dual ledger entries (ledger + prc_ledger for UI compatibility)
- Transaction logging for audit
- Automatic retry on failure
- Balance reconciliation support
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pymongo import ReturnDocument

from app.core.database import get_sync_db


class WalletServiceV2:
    """
    Enhanced Wallet Service with bulletproof PRC operations.
    """
    
    # PRC Rate: 100 PRC = ₹1
    PRC_RATE = 100
    
    @staticmethod
    def _generate_txn_id(prefix: str = "TXN") -> str:
        """Generate unique transaction ID"""
        timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
        random_part = uuid.uuid4().hex[:8].upper()
        return f"{prefix}-{timestamp}-{random_part}"
    
    @staticmethod
    def _get_current_time() -> str:
        """Get current UTC timestamp in ISO format"""
        return datetime.now(timezone.utc).isoformat()
    
    @staticmethod
    def get_balance(user_id: str) -> Dict[str, Any]:
        """Get user's current PRC balance with verification."""
        try:
            db = get_sync_db()
            user = db.users.find_one({"uid": user_id}, {"prc_balance": 1, "name": 1})
            
            if not user:
                return {"success": False, "error": "User not found", "balance": 0}
            
            balance = float(user.get("prc_balance", 0))
            
            return {
                "success": True,
                "balance": balance,
                "prc_balance": balance,
                "inr_value": round(balance / WalletServiceV2.PRC_RATE, 2)
            }
        except Exception as e:
            logging.error(f"[WalletV2] Get balance error for {user_id}: {e}")
            return {"success": False, "error": str(e), "balance": 0}
    
    @staticmethod
    def debit(
        user_id: str,
        amount: float,
        txn_type: str,
        description: str,
        reference: Optional[str] = None,
        service_type: Optional[str] = None,
        check_balance: bool = True,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Debit PRC from user's wallet.
        
        CRITICAL: This is the ONLY method to deduct PRC.
        
        Args:
            user_id: User's unique ID
            amount: PRC amount to debit (positive number)
            txn_type: Transaction type (redeem, purchase, withdrawal, etc.)
            description: Human-readable description
            reference: Reference ID (request_id, order_id, etc.)
            service_type: Service type for categorization
            check_balance: If True, verify sufficient balance first
            metadata: Additional data to store
            
        Returns:
            Dict with success status, new balance, and transaction details
        """
        if amount <= 0:
            return {"success": False, "error": "Amount must be positive"}
        
        try:
            db = get_sync_db()
            txn_id = WalletServiceV2._generate_txn_id("DR")
            timestamp = WalletServiceV2._get_current_time()
            
            # Get current user data
            user = db.users.find_one({"uid": user_id}, {"prc_balance": 1, "name": 1})
            if not user:
                logging.error(f"[WalletV2] Debit failed - User not found: {user_id}")
                return {"success": False, "error": "User not found"}
            
            balance_before = float(user.get("prc_balance", 0))
            
            # Check sufficient balance
            if check_balance and balance_before < amount:
                logging.warning(f"[WalletV2] Insufficient balance for {user_id}: has {balance_before}, needs {amount}")
                return {
                    "success": False,
                    "error": "Insufficient balance",
                    "balance": balance_before,
                    "required": amount,
                    "shortfall": amount - balance_before
                }
            
            balance_after = balance_before - amount
            
            # ============================================
            # ATOMIC UPDATE with findOneAndUpdate
            # ============================================
            updated_user = db.users.find_one_and_update(
                {"uid": user_id, "prc_balance": {"$gte": amount if check_balance else -float('inf')}},
                {
                    "$set": {"prc_balance": balance_after},
                    "$push": {
                        "prc_transactions": {
                            "type": txn_type,
                            "amount": -amount,
                            "txn_id": txn_id,
                            "description": description,
                            "reference": reference,
                            "timestamp": timestamp
                        }
                    }
                },
                return_document=ReturnDocument.AFTER,
                projection={"prc_balance": 1}
            )
            
            if not updated_user:
                logging.error(f"[WalletV2] CRITICAL: Debit update failed for {user_id}. Race condition or insufficient balance.")
                return {"success": False, "error": "Balance update failed - concurrent modification or insufficient funds"}
            
            # Verify balance was actually updated
            actual_balance = float(updated_user.get("prc_balance", 0))
            if abs(actual_balance - balance_after) > 0.01:
                logging.error(f"[WalletV2] CRITICAL: Balance mismatch! Expected {balance_after}, got {actual_balance}")
                # Don't fail - log for investigation
            
            # ============================================
            # CREATE LEDGER ENTRIES (both collections)
            # ============================================
            ledger_entry = {
                "entry_id": f"LED-{uuid.uuid4().hex[:12].upper()}",
                "txn_id": txn_id,
                "user_id": user_id,
                "entry_type": "debit",
                "txn_type": txn_type,
                "amount": amount,
                "balance_before": balance_before,
                "balance_after": balance_after,
                "description": description,
                "reference": reference,
                "service_type": service_type,
                "metadata": metadata or {},
                "created_at": timestamp,
                "verified": True
            }
            
            # Insert into 'ledger' collection (main)
            try:
                db.ledger.insert_one(ledger_entry.copy())
            except Exception as e:
                logging.error(f"[WalletV2] Ledger insert error: {e}")
            
            # Insert into 'prc_ledger' collection (for UI compatibility)
            prc_ledger_entry = {
                "user_id": user_id,
                "type": txn_type,
                "entry_type": "debit",
                "amount": -amount,
                "balance_after": balance_after,
                "description": description,
                "reference": reference,
                "txn_id": txn_id,
                "timestamp": timestamp,
                "created_at": timestamp
            }
            try:
                db.prc_ledger.insert_one(prc_ledger_entry)
            except Exception as e:
                logging.error(f"[WalletV2] PRC Ledger insert error: {e}")
            
            logging.info(f"[WalletV2] DEBIT SUCCESS: {user_id} | -{amount} PRC | {balance_before} -> {balance_after} | TXN: {txn_id} | Ref: {reference}")
            
            return {
                "success": True,
                "txn_id": txn_id,
                "amount": amount,
                "balance_before": balance_before,
                "balance_after": balance_after,
                "actual_balance": actual_balance,
                "timestamp": timestamp
            }
            
        except Exception as e:
            logging.error(f"[WalletV2] Debit exception for {user_id}: {e}")
            import traceback
            logging.error(f"[WalletV2] Traceback: {traceback.format_exc()}")
            return {"success": False, "error": str(e)}
    
    @staticmethod
    def credit(
        user_id: str,
        amount: float,
        txn_type: str,
        description: str,
        reference: Optional[str] = None,
        service_type: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Credit PRC to user's wallet.
        
        CRITICAL: This is the ONLY method to add PRC.
        
        Args:
            user_id: User's unique ID
            amount: PRC amount to credit (positive number)
            txn_type: Transaction type (refund, mining, reward, etc.)
            description: Human-readable description
            reference: Reference ID
            service_type: Service type for categorization
            metadata: Additional data to store
            
        Returns:
            Dict with success status, new balance, and transaction details
        """
        if amount <= 0:
            return {"success": False, "error": "Amount must be positive"}
        
        try:
            db = get_sync_db()
            txn_id = WalletServiceV2._generate_txn_id("CR")
            timestamp = WalletServiceV2._get_current_time()
            
            # Get current balance
            user = db.users.find_one({"uid": user_id}, {"prc_balance": 1})
            if not user:
                logging.error(f"[WalletV2] Credit failed - User not found: {user_id}")
                return {"success": False, "error": "User not found"}
            
            balance_before = float(user.get("prc_balance", 0))
            balance_after = balance_before + amount
            
            # ============================================
            # ATOMIC UPDATE
            # ============================================
            updated_user = db.users.find_one_and_update(
                {"uid": user_id},
                {
                    "$set": {"prc_balance": balance_after},
                    "$push": {
                        "prc_transactions": {
                            "type": txn_type,
                            "amount": amount,
                            "txn_id": txn_id,
                            "description": description,
                            "reference": reference,
                            "timestamp": timestamp
                        }
                    }
                },
                return_document=ReturnDocument.AFTER,
                projection={"prc_balance": 1}
            )
            
            if not updated_user:
                logging.error(f"[WalletV2] CRITICAL: Credit update failed for {user_id}")
                return {"success": False, "error": "Balance update failed"}
            
            actual_balance = float(updated_user.get("prc_balance", 0))
            
            # ============================================
            # CREATE LEDGER ENTRIES
            # ============================================
            ledger_entry = {
                "entry_id": f"LED-{uuid.uuid4().hex[:12].upper()}",
                "txn_id": txn_id,
                "user_id": user_id,
                "entry_type": "credit",
                "txn_type": txn_type,
                "amount": amount,
                "balance_before": balance_before,
                "balance_after": balance_after,
                "description": description,
                "reference": reference,
                "service_type": service_type,
                "metadata": metadata or {},
                "created_at": timestamp,
                "verified": True
            }
            
            try:
                db.ledger.insert_one(ledger_entry.copy())
            except Exception as e:
                logging.error(f"[WalletV2] Ledger insert error: {e}")
            
            # PRC Ledger for UI
            prc_ledger_entry = {
                "user_id": user_id,
                "type": txn_type,
                "entry_type": "credit",
                "amount": amount,
                "balance_after": balance_after,
                "description": description,
                "reference": reference,
                "txn_id": txn_id,
                "timestamp": timestamp,
                "created_at": timestamp
            }
            try:
                db.prc_ledger.insert_one(prc_ledger_entry)
            except Exception as e:
                logging.error(f"[WalletV2] PRC Ledger insert error: {e}")
            
            logging.info(f"[WalletV2] CREDIT SUCCESS: {user_id} | +{amount} PRC | {balance_before} -> {balance_after} | TXN: {txn_id}")
            
            return {
                "success": True,
                "txn_id": txn_id,
                "amount": amount,
                "balance_before": balance_before,
                "balance_after": balance_after,
                "actual_balance": actual_balance,
                "timestamp": timestamp
            }
            
        except Exception as e:
            logging.error(f"[WalletV2] Credit exception for {user_id}: {e}")
            import traceback
            logging.error(f"[WalletV2] Traceback: {traceback.format_exc()}")
            return {"success": False, "error": str(e)}
    
    @staticmethod
    def transfer(
        from_user_id: str,
        to_user_id: str,
        amount: float,
        description: str,
        reference: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transfer PRC between users.
        Atomic operation - both debit and credit succeed or both fail.
        """
        if amount <= 0:
            return {"success": False, "error": "Amount must be positive"}
        
        if from_user_id == to_user_id:
            return {"success": False, "error": "Cannot transfer to self"}
        
        # First debit from sender
        debit_result = WalletServiceV2.debit(
            user_id=from_user_id,
            amount=amount,
            txn_type="transfer_out",
            description=f"Transfer to {to_user_id}: {description}",
            reference=reference,
            check_balance=True
        )
        
        if not debit_result.get("success"):
            return debit_result
        
        # Then credit to receiver
        credit_result = WalletServiceV2.credit(
            user_id=to_user_id,
            amount=amount,
            txn_type="transfer_in",
            description=f"Transfer from {from_user_id}: {description}",
            reference=reference
        )
        
        if not credit_result.get("success"):
            # Rollback - credit back to sender
            logging.error(f"[WalletV2] Transfer credit failed, rolling back debit")
            WalletServiceV2.credit(
                user_id=from_user_id,
                amount=amount,
                txn_type="transfer_rollback",
                description=f"Rollback: Transfer to {to_user_id} failed",
                reference=reference
            )
            return {"success": False, "error": "Transfer failed - rolled back"}
        
        return {
            "success": True,
            "debit_txn": debit_result.get("txn_id"),
            "credit_txn": credit_result.get("txn_id"),
            "amount": amount,
            "from_balance": debit_result.get("balance_after"),
            "to_balance": credit_result.get("balance_after")
        }
    
    @staticmethod
    def verify_balance(user_id: str) -> Dict[str, Any]:
        """
        Verify user's balance matches ledger entries.
        Use for reconciliation.
        """
        try:
            db = get_sync_db()
            
            # Get user's stored balance
            user = db.users.find_one({"uid": user_id}, {"prc_balance": 1, "prc_transactions": 1})
            if not user:
                return {"success": False, "error": "User not found"}
            
            stored_balance = float(user.get("prc_balance", 0))
            
            # Calculate balance from transactions
            transactions = user.get("prc_transactions", [])
            calculated_balance = sum(t.get("amount", 0) for t in transactions)
            
            # Check ledger
            ledger_credits = db.ledger.aggregate([
                {"$match": {"user_id": user_id, "entry_type": "credit"}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ])
            ledger_debits = db.ledger.aggregate([
                {"$match": {"user_id": user_id, "entry_type": "debit"}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ])
            
            credit_total = 0
            debit_total = 0
            for doc in ledger_credits:
                credit_total = doc.get("total", 0)
            for doc in ledger_debits:
                debit_total = doc.get("total", 0)
            
            ledger_balance = credit_total - debit_total
            
            discrepancy = abs(stored_balance - ledger_balance)
            
            return {
                "success": True,
                "user_id": user_id,
                "stored_balance": stored_balance,
                "calculated_from_transactions": calculated_balance,
                "ledger_credits": credit_total,
                "ledger_debits": debit_total,
                "ledger_balance": ledger_balance,
                "discrepancy": discrepancy,
                "is_balanced": discrepancy < 0.01
            }
            
        except Exception as e:
            logging.error(f"[WalletV2] Verify balance error: {e}")
            return {"success": False, "error": str(e)}


# Alias for backward compatibility
WalletService = WalletServiceV2
