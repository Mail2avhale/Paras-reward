"""
PARAS REWARD - Support Ticket Routes
=====================================
Customer support ticket management
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/support", tags=["Support"])

# Database reference
db = None

def set_db(database):
    global db
    db = database


@router.post("/tickets/create")
async def create_ticket(request: Request):
    """Create a new support ticket"""
    data = await request.json()
    
    user_id = data.get("user_id")
    subject = data.get("subject")
    description = data.get("description")
    category = data.get("category", "general")
    priority = data.get("priority", "medium")
    
    if not all([user_id, subject, description]):
        raise HTTPException(status_code=400, detail="user_id, subject, and description required")
    
    ticket = {
        "ticket_id": str(uuid.uuid4()),
        "user_id": user_id,
        "subject": subject,
        "description": description,
        "category": category,
        "priority": priority,
        "status": "open",
        "replies": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.support_tickets.insert_one(ticket)
    ticket.pop("_id", None)
    
    return {"success": True, "ticket": ticket}


@router.get("/tickets/user/{user_id}")
async def get_user_tickets(user_id: str, status: str = None):
    """Get all tickets for a user"""
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    
    tickets = await db.support_tickets.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"tickets": tickets}


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str):
    """Get a specific ticket"""
    ticket = await db.support_tickets.find_one(
        {"ticket_id": ticket_id},
        {"_id": 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {"ticket": ticket}


@router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(ticket_id: str, request: Request):
    """Add a reply to a ticket"""
    data = await request.json()
    
    user_id = data.get("user_id")
    message = data.get("message")
    is_admin = data.get("is_admin", False)
    
    if not all([user_id, message]):
        raise HTTPException(status_code=400, detail="user_id and message required")
    
    reply = {
        "reply_id": str(uuid.uuid4()),
        "user_id": user_id,
        "message": message,
        "is_admin": is_admin,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {
            "$push": {"replies": reply},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {"success": True, "reply": reply}


@router.put("/tickets/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, request: Request):
    """Update ticket status"""
    data = await request.json()
    status = data.get("status")
    
    if status not in ["open", "in_progress", "resolved", "closed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {"success": True, "status": status}


@router.get("/tickets")
async def get_all_tickets(
    status: str = None,
    category: str = None,
    priority: str = None,
    page: int = 1,
    limit: int = 20
):
    """Get all tickets (admin)"""
    skip = (page - 1) * limit
    
    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    if priority:
        query["priority"] = priority
    
    tickets = await db.support_tickets.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.support_tickets.count_documents(query)
    
    return {
        "tickets": tickets,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get("/stats")
async def get_support_stats():
    """Get support ticket statistics"""
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    
    status_counts = await db.support_tickets.aggregate(pipeline).to_list(None)
    
    stats = {
        "open": 0,
        "in_progress": 0,
        "resolved": 0,
        "closed": 0,
        "total": 0
    }
    
    for item in status_counts:
        if item["_id"] in stats:
            stats[item["_id"]] = item["count"]
        stats["total"] += item["count"]
    
    return stats


@router.delete("/tickets/{ticket_id}")
async def delete_ticket(ticket_id: str):
    """Delete a ticket (admin only)"""
    result = await db.support_tickets.delete_one({"ticket_id": ticket_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {"success": True}
