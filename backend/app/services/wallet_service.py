"""
PARAS REWARD - Wallet Service
=============================
Handles all wallet operations with ledger integration.
Every wallet change MUST go through this service.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple

from app.core.database import get_sync_db
from app.models.ledger import (
    LedgerEntry, 
    LedgerAccountType, 
    LedgerEntryType,
    create_withdrawal_ledger_entries,
    create_mining_ledger_entries
)


class WalletService:
    """
    Centralized wallet operations.
    All PRC balance changes must use this service.
    """
    
    @staticmethod
    def get_balance(user_id: str) -> Dict[str, Any]:
        """Get user's current PRC balance."""
        db = get_sync_db()
        user = db.users.find_one({"uid": user_id}, {"prc_balance": 1, "_id": 0})
        
        if not user:
            return {"success": False, "error": "User not found"}
        
        prc_balance = user.get("prc_balance", 0)
        
        # Get PRC rate
        prc_rate = WalletService._get_prc_rate()
        
        return {
            "success": True,
            "prc_balance": prc_balance,
            "inr_equivalent": round(prc_balance / prc_rate, 2),
            "prc_rate": prc_rate
        }
    
    @staticmethod
    def credit(
        user_id: str, 
        amount: float, 
        txn_type: str,
        description: str,
        reference: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Credit PRC to user's wallet.
        Creates ledger entry for audit trail.
        
        Args:
            user_id: User's unique ID
            amount: PRC amount to credit (positive)
            txn_type: Type of transaction (mining, referral, refund, etc.)
            description: Human readable description
            reference: Optional external reference
        
        Returns:
            Result dict with new balance
        """
        if amount <= 0:
            return {"success": False, "error": "Amount must be positive"}
        
        db = get_sync_db()
        
        # Get current balance
        user = db.users.find_one({"uid": user_id}, {"prc_balance": 1})
        if not user:
            return {"success": False, "error": "User not found"}
        
        balance_before = user.get("prc_balance", 0)
        balance_after = balance_before + amount
        
        # Generate transaction ID
        txn_id = f"CR-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6].upper()}"
        
        # Create ledger entry
        ledger_entry = {
            "entry_id": f"LED-{uuid.uuid4().hex[:12].upper()}",
            "txn_id": txn_id,
            "txn_type": txn_type,
            "user_id": user_id,
            "entry_type": "credit",
            "amount": amount,
            "balance_before": balance_before,
            "balance_after": balance_after,
            "description": description,
            "reference": reference,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Update balance and log transaction
        try:
            # CRITICAL: Check if update was successful  
            update_result = db.users.update_one(
                {"uid": user_id},
                {
                    "$set": {"prc_balance": balance_after},
                    "$push": {
                        "prc_transactions": {
                            "type": txn_type,
                            "amount": amount,
                            "txn_id": txn_id,
                            "description": description,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                    }
                }
            )
            
            # VERIFY update was applied
            if update_result.modified_count == 0:
                logging.error(f"[Wallet] CRITICAL: Credit update not applied for {user_id}. matched={update_result.matched_count}, modified={update_result.modified_count}")
            
            # Save ledger entry
            db.ledger.insert_one(ledger_entry)
            
            logging.info(f"[Wallet] Credit {amount} PRC to {user_id}. New balance: {balance_after}. matched={update_result.matched_count}, modified={update_result.modified_count}")
            
            return {
                "success": True,
                "txn_id": txn_id,
                "amount": amount,
                "balance_before": balance_before,
                "balance_after": balance_after
            }
            
        except Exception as e:
            logging.error(f"[Wallet] Credit failed for {user_id}: {e}")
            import traceback
            logging.error(f"[Wallet] Traceback: {traceback.format_exc()}")
            return {"success": False, "error": str(e)}
    
    @staticmethod
    def debit(
        user_id: str,
        amount: float,
        txn_type: str,
        description: str,
        reference: Optional[str] = None,
        check_balance: bool = True
    ) -> Dict[str, Any]:
        """
        Debit PRC from user's wallet.
        Creates ledger entry for audit trail.
        
        Args:
            user_id: User's unique ID
            amount: PRC amount to debit (positive)
            txn_type: Type of transaction (withdrawal, purchase, etc.)
            description: Human readable description
            reference: Optional external reference
            check_balance: Whether to check sufficient balance
        
        Returns:
            Result dict with new balance
        """
        if amount <= 0:
            return {"success": False, "error": "Amount must be positive"}
        
        db = get_sync_db()
        
        # Get current balance
        user = db.users.find_one({"uid": user_id}, {"prc_balance": 1})
        if not user:
            return {"success": False, "error": "User not found"}
        
        balance_before = user.get("prc_balance", 0)
        
        # Check sufficient balance
        if check_balance and balance_before < amount:
            return {
                "success": False, 
                "error": "Insufficient balance",
                "balance": balance_before,
                "required": amount
            }
        
        balance_after = balance_before - amount
        
        # Generate transaction ID
        txn_id = f"DR-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6].upper()}"
        
        # Create ledger entry
        ledger_entry = {
            "entry_id": f"LED-{uuid.uuid4().hex[:12].upper()}",
            "txn_id": txn_id,
            "txn_type": txn_type,
            "user_id": user_id,
            "entry_type": "debit",
            "amount": amount,
            "balance_before": balance_before,
            "balance_after": balance_after,
            "description": description,
            "reference": reference,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Update balance and log transaction
        try:
            # CRITICAL: Check if update was successful
            update_result = db.users.update_one(
                {"uid": user_id},
                {
                    "$set": {"prc_balance": balance_after},
                    "$push": {
                        "prc_transactions": {
                            "type": txn_type,
                            "amount": -amount,
                            "txn_id": txn_id,
                            "description": description,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                    }
                }
            )
            
            # VERIFY update was applied
            if update_result.modified_count == 0:
                logging.error(f"[Wallet] CRITICAL: Debit update not applied for {user_id}. matched={update_result.matched_count}, modified={update_result.modified_count}")
                # Double-check by reading back
                verify_user = db.users.find_one({"uid": user_id}, {"prc_balance": 1})
                if verify_user:
                    actual_balance = verify_user.get("prc_balance", 0)
                    if actual_balance != balance_after:
                        logging.error(f"[Wallet] VERIFICATION FAILED: Expected {balance_after}, Actual {actual_balance}")
                        return {"success": False, "error": "Balance update not applied"}
                    else:
                        logging.info(f"[Wallet] Balance already correct (idempotent)")
                else:
                    return {"success": False, "error": "User not found after update"}
            
            # Save ledger entry
            db.ledger.insert_one(ledger_entry)
            
            logging.info(f"[Wallet] Debit {amount} PRC from {user_id}. New balance: {balance_after}. matched={update_result.matched_count}, modified={update_result.modified_count}")
            
            return {
                "success": True,
                "txn_id": txn_id,
                "amount": amount,
                "balance_before": balance_before,
                "balance_after": balance_after
            }
            
        except Exception as e:
            logging.error(f"[Wallet] Debit failed for {user_id}: {e}")
            import traceback
            logging.error(f"[Wallet] Traceback: {traceback.format_exc()}")
            return {"success": False, "error": str(e)}
    
    @staticmethod
    def transfer(
        from_user_id: str,
        to_user_id: str,
        amount: float,
        description: str = "P2P Transfer"
    ) -> Dict[str, Any]:
        """
        Transfer PRC between users.
        Creates ledger entries for both sides.
        """
        # Debit from sender
        debit_result = WalletService.debit(
            user_id=from_user_id,
            amount=amount,
            txn_type="transfer_out",
            description=f"{description} to {to_user_id}"
        )
        
        if not debit_result["success"]:
            return debit_result
        
        # Credit to receiver
        credit_result = WalletService.credit(
            user_id=to_user_id,
            amount=amount,
            txn_type="transfer_in",
            description=f"{description} from {from_user_id}",
            reference=debit_result["txn_id"]
        )
        
        if not credit_result["success"]:
            # Rollback - credit back to sender
            WalletService.credit(
                user_id=from_user_id,
                amount=amount,
                txn_type="transfer_rollback",
                description="Transfer failed - rollback"
            )
            return credit_result
        
        return {
            "success": True,
            "debit_txn": debit_result["txn_id"],
            "credit_txn": credit_result["txn_id"],
            "amount": amount
        }
    
    @staticmethod
    def _get_prc_rate() -> int:
        """Get current PRC to INR rate."""
        try:
            db = get_sync_db()
            config = db.prc_economy_config.find_one({"_id": "economy_config"})
            if config:
                return config.get("prc_rate", 100)
        except:
            pass
        return 100  # Default: 100 PRC = ₹1
    
    @staticmethod
    def get_transaction_history(user_id: str, limit: int = 50) -> Dict[str, Any]:
        """Get user's transaction history from ledger."""
        db = get_sync_db()
        
        transactions = list(db.ledger.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit))
        
        return {
            "success": True,
            "transactions": transactions,
            "count": len(transactions)
        }
