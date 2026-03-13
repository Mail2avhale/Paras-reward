"""
PARAS REWARD - Transaction Service
==================================
Manages transaction lifecycle with state machine.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from enum import Enum

from app.core.database import get_sync_db


class TransactionState(str, Enum):
    """Transaction state machine states."""
    INITIATED = "initiated"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    REFUND_PENDING = "refund_pending"
    REFUNDED = "refunded"
    HOLD = "hold"
    CANCELLED = "cancelled"


# Valid state transitions
STATE_TRANSITIONS = {
    TransactionState.INITIATED: [TransactionState.PROCESSING, TransactionState.CANCELLED, TransactionState.FAILED],
    TransactionState.PROCESSING: [TransactionState.SUCCESS, TransactionState.FAILED, TransactionState.HOLD],
    TransactionState.HOLD: [TransactionState.SUCCESS, TransactionState.FAILED, TransactionState.REFUND_PENDING],
    TransactionState.FAILED: [TransactionState.REFUND_PENDING, TransactionState.REFUNDED],
    TransactionState.REFUND_PENDING: [TransactionState.REFUNDED],
    TransactionState.SUCCESS: [],  # Terminal state
    TransactionState.REFUNDED: [],  # Terminal state
    TransactionState.CANCELLED: [],  # Terminal state
}


class TransactionService:
    """
    Centralized transaction management.
    Ensures proper state transitions and audit trail.
    """
    
    @staticmethod
    def create(
        user_id: str,
        txn_type: str,
        amount: float,
        description: str,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Create a new transaction.
        
        Args:
            user_id: User initiating the transaction
            txn_type: Type (withdrawal, recharge, etc.)
            amount: Transaction amount
            description: Human readable description
            metadata: Additional data
        
        Returns:
            Transaction object
        """
        db = get_sync_db()
        
        txn_id = f"TXN-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:8].upper()}"
        
        transaction = {
            "txn_id": txn_id,
            "user_id": user_id,
            "type": txn_type,
            "amount": amount,
            "description": description,
            "status": TransactionState.INITIATED.value,
            "status_history": [
                {
                    "status": TransactionState.INITIATED.value,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "note": "Transaction created"
                }
            ],
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        db.transactions.insert_one(transaction)
        
        logging.info(f"[Transaction] Created {txn_id} for user {user_id}")
        
        # Remove _id for response
        transaction.pop("_id", None)
        
        return {
            "success": True,
            "transaction": transaction
        }
    
    @staticmethod
    def update_status(
        txn_id: str,
        new_status: TransactionState,
        note: Optional[str] = None,
        metadata_update: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Update transaction status with validation.
        
        Args:
            txn_id: Transaction ID
            new_status: New status to set
            note: Optional note for status change
            metadata_update: Additional metadata to merge
        
        Returns:
            Updated transaction
        """
        db = get_sync_db()
        
        # Get current transaction
        txn = db.transactions.find_one({"txn_id": txn_id})
        if not txn:
            return {"success": False, "error": "Transaction not found"}
        
        current_status = TransactionState(txn["status"])
        
        # Validate transition
        if new_status not in STATE_TRANSITIONS.get(current_status, []):
            return {
                "success": False,
                "error": f"Invalid transition from {current_status.value} to {new_status.value}"
            }
        
        # Build update
        status_entry = {
            "status": new_status.value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "note": note or f"Status changed to {new_status.value}"
        }
        
        update = {
            "$set": {
                "status": new_status.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {
                "status_history": status_entry
            }
        }
        
        if metadata_update:
            for key, value in metadata_update.items():
                update["$set"][f"metadata.{key}"] = value
        
        db.transactions.update_one({"txn_id": txn_id}, update)
        
        logging.info(f"[Transaction] {txn_id} status: {current_status.value} -> {new_status.value}")
        
        return {
            "success": True,
            "txn_id": txn_id,
            "old_status": current_status.value,
            "new_status": new_status.value
        }
    
    @staticmethod
    def get(txn_id: str) -> Dict[str, Any]:
        """Get transaction by ID."""
        db = get_sync_db()
        
        txn = db.transactions.find_one({"txn_id": txn_id}, {"_id": 0})
        if not txn:
            return {"success": False, "error": "Transaction not found"}
        
        return {"success": True, "transaction": txn}
    
    @staticmethod
    def get_user_transactions(
        user_id: str,
        status: Optional[str] = None,
        txn_type: Optional[str] = None,
        limit: int = 50,
        skip: int = 0
    ) -> Dict[str, Any]:
        """Get transactions for a user with filters."""
        db = get_sync_db()
        
        query = {"user_id": user_id}
        if status:
            query["status"] = status
        if txn_type:
            query["type"] = txn_type
        
        transactions = list(db.transactions.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit))
        
        total = db.transactions.count_documents(query)
        
        return {
            "success": True,
            "transactions": transactions,
            "total": total,
            "has_more": total > skip + limit
        }
    
    @staticmethod
    def get_pending_transactions(txn_type: Optional[str] = None) -> List[Dict]:
        """Get all pending transactions for processing."""
        db = get_sync_db()
        
        query = {
            "status": {"$in": [
                TransactionState.INITIATED.value,
                TransactionState.PROCESSING.value,
                TransactionState.HOLD.value
            ]}
        }
        
        if txn_type:
            query["type"] = txn_type
        
        return list(db.transactions.find(query, {"_id": 0}))
    
    @staticmethod
    def mark_success(txn_id: str, reference: Optional[str] = None) -> Dict[str, Any]:
        """Mark transaction as successful."""
        return TransactionService.update_status(
            txn_id=txn_id,
            new_status=TransactionState.SUCCESS,
            note="Transaction completed successfully",
            metadata_update={"reference": reference} if reference else None
        )
    
    @staticmethod
    def mark_failed(txn_id: str, reason: str) -> Dict[str, Any]:
        """Mark transaction as failed."""
        return TransactionService.update_status(
            txn_id=txn_id,
            new_status=TransactionState.FAILED,
            note=f"Transaction failed: {reason}",
            metadata_update={"failure_reason": reason}
        )
