"""
Admin Transaction Management API
================================
Allows admin to view, edit, delete, and refund PRC transactions.
Operates across all transaction collections: transactions, prc_transactions, prc_ledger, ledger.
"""
import logging
import uuid
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional

router = APIRouter(prefix="/admin/transactions", tags=["Admin Transactions"])

db = None

def set_db(database):
    global db
    db = database


# All collections that store PRC transaction records
TXN_COLLECTIONS = ["transactions", "prc_transactions", "prc_ledger", "ledger"]

# ID field mapping per collection
ID_FIELDS = {
    "transactions": "transaction_id",
    "prc_transactions": "transaction_id",
    "prc_ledger": "txn_id",
    "ledger": "txn_id",
}


class EditTransactionRequest(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    type: Optional[str] = None
    admin_id: str
    reason: str


class DeleteTransactionRequest(BaseModel):
    admin_id: str
    reason: str


class RefundTransactionRequest(BaseModel):
    admin_id: str
    reason: str


async def find_transaction(txn_id: str):
    """Search all collections for a transaction by its ID."""
    for coll_name in TXN_COLLECTIONS:
        id_field = ID_FIELDS[coll_name]
        doc = await db[coll_name].find_one({id_field: txn_id})
        if doc:
            doc_id = doc.pop("_id", None)
            return doc, coll_name, doc_id
    return None, None, None


@router.get("/{user_id}")
async def get_user_transactions(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=10, le=200),
    txn_type: str = Query("all")
):
    """Get all transactions for a user across all collections."""
    all_txns = []
    seen_ids = set()

    for coll_name in TXN_COLLECTIONS:
        id_field = ID_FIELDS[coll_name]
        query = {"user_id": user_id}
        if txn_type != "all":
            query["type"] = txn_type

        docs = await db[coll_name].find(query, {"_id": 0}).to_list(5000)
        for doc in docs:
            tid = doc.get(id_field, "")
            if tid and tid in seen_ids:
                continue
            if tid:
                seen_ids.add(tid)
            doc["_source_collection"] = coll_name
            doc["_txn_id"] = tid
            all_txns.append(doc)

    # Sort by date (newest first)
    def get_date(t):
        d = t.get("created_at") or t.get("timestamp") or ""
        if isinstance(d, str):
            try:
                return datetime.fromisoformat(d.replace("Z", "+00:00")).timestamp()
            except Exception:
                return 0
        if isinstance(d, datetime):
            return d.timestamp()
        return 0

    all_txns.sort(key=get_date, reverse=True)

    total = len(all_txns)
    total_pages = max(1, (total + limit - 1) // limit)
    start = (page - 1) * limit
    page_txns = all_txns[start:start + limit]

    return {
        "success": True,
        "user_id": user_id,
        "transactions": page_txns,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages
        }
    }


@router.put("/{txn_id}")
async def edit_transaction(txn_id: str, req: EditTransactionRequest):
    """Edit a transaction's amount, description, or type."""
    doc, coll_name, doc_id = await find_transaction(txn_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Transaction not found")

    update_fields = {
        "edited_at": datetime.now(timezone.utc).isoformat(),
        "edited_by": req.admin_id,
        "edit_reason": req.reason,
    }
    old_values = {}

    if req.amount is not None:
        old_values["amount"] = doc.get("amount")
        update_fields["amount"] = req.amount
    if req.description is not None:
        old_values["description"] = doc.get("description")
        update_fields["description"] = req.description
    if req.type is not None:
        old_values["type"] = doc.get("type")
        update_fields["type"] = req.type

    if not old_values:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields["edit_history"] = doc.get("edit_history", []) + [{
        "old_values": old_values,
        "edited_by": req.admin_id,
        "reason": req.reason,
        "edited_at": datetime.now(timezone.utc).isoformat()
    }]

    id_field = ID_FIELDS[coll_name]
    await db[coll_name].update_one(
        {id_field: txn_id},
        {"$set": update_fields}
    )

    # Audit log
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "edit_transaction",
        "entity_type": "transaction",
        "entity_id": txn_id,
        "collection": coll_name,
        "performed_by": req.admin_id,
        "changes": {"old": old_values, "new": {k: v for k, v in update_fields.items() if k in old_values}},
        "reason": req.reason,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {
        "success": True,
        "message": "Transaction updated",
        "txn_id": txn_id,
        "collection": coll_name,
        "old_values": old_values
    }


@router.delete("/{txn_id}")
async def delete_transaction(txn_id: str, req: DeleteTransactionRequest):
    """Soft-delete a transaction (marks as deleted, does NOT remove from DB)."""
    doc, coll_name, doc_id = await find_transaction(txn_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Transaction not found")

    id_field = ID_FIELDS[coll_name]
    await db[coll_name].update_one(
        {id_field: txn_id},
        {"$set": {
            "deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": req.admin_id,
            "delete_reason": req.reason
        }}
    )

    # Audit log
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "delete_transaction",
        "entity_type": "transaction",
        "entity_id": txn_id,
        "collection": coll_name,
        "performed_by": req.admin_id,
        "reason": req.reason,
        "transaction_snapshot": doc,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {
        "success": True,
        "message": "Transaction deleted (soft delete)",
        "txn_id": txn_id,
        "collection": coll_name
    }


@router.post("/{txn_id}/refund")
async def refund_transaction(txn_id: str, req: RefundTransactionRequest):
    """Refund a debit transaction — restores PRC to user's balance."""
    doc, coll_name, doc_id = await find_transaction(txn_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if doc.get("refunded"):
        raise HTTPException(status_code=400, detail="Transaction already refunded")

    amount = doc.get("amount", 0)
    if amount >= 0:
        raise HTTPException(status_code=400, detail="Only debit transactions can be refunded")

    refund_amount = abs(amount)
    user_id = doc.get("user_id")

    if not user_id:
        raise HTTPException(status_code=400, detail="Transaction has no user_id")

    # Get current balance
    user = await db.users.find_one({"uid": user_id}, {"_id": 0, "prc_balance": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_balance = float(user.get("prc_balance", 0))
    new_balance = current_balance + refund_amount

    # Refund PRC
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"prc_balance": new_balance}}
    )

    # Mark original transaction as refunded
    id_field = ID_FIELDS[coll_name]
    await db[coll_name].update_one(
        {id_field: txn_id},
        {"$set": {
            "refunded": True,
            "refunded_at": datetime.now(timezone.utc).isoformat(),
            "refunded_by": req.admin_id,
            "refund_reason": req.reason
        }}
    )

    # Create refund transaction record
    refund_txn_id = f"REF-{uuid.uuid4()}"
    await db.transactions.insert_one({
        "transaction_id": refund_txn_id,
        "user_id": user_id,
        "type": "admin_refund",
        "amount": refund_amount,
        "description": f"Admin refund: {req.reason} (original: {txn_id})",
        "reference_id": txn_id,
        "balance_before": current_balance,
        "balance_after": new_balance,
        "admin_id": req.admin_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # Audit log
    await db.audit_logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "action": "refund_transaction",
        "entity_type": "transaction",
        "entity_id": txn_id,
        "collection": coll_name,
        "performed_by": req.admin_id,
        "reason": req.reason,
        "refund_amount": refund_amount,
        "user_id": user_id,
        "balance_before": current_balance,
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {
        "success": True,
        "message": f"Refunded {refund_amount} PRC to user",
        "txn_id": txn_id,
        "refund_txn_id": refund_txn_id,
        "refund_amount": refund_amount,
        "new_balance": new_balance
    }


@router.post("/{txn_id}/restore")
async def restore_deleted_transaction(txn_id: str, admin_id: str = Query(...)):
    """Restore a soft-deleted transaction."""
    doc, coll_name, doc_id = await find_transaction(txn_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if not doc.get("deleted"):
        raise HTTPException(status_code=400, detail="Transaction is not deleted")

    id_field = ID_FIELDS[coll_name]
    await db[coll_name].update_one(
        {id_field: txn_id},
        {"$set": {
            "deleted": False,
            "restored_at": datetime.now(timezone.utc).isoformat(),
            "restored_by": admin_id
        }}
    )

    return {
        "success": True,
        "message": "Transaction restored",
        "txn_id": txn_id
    }
