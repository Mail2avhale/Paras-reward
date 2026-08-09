"""
Careers Phase G — RBAC + Audit trail viewer + Notification templates
Spec: §7 (role matrix), §46-47 (templates + auto reminders), §51-53 (RBAC + audit)

Collections
-----------
hr_roles                : predefined roles + permissions matrix (seeded at first read)
hr_role_bindings        : {binding_id, user, role, assigned_by, assigned_at}
hr_audit_log            : (see utils.audit_log) append-only
notification_templates  : {template_id, key, channel, subject, body, variables, is_active}
"""
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.audit_log import log_action

router = APIRouter(prefix="/public", tags=["Careers Phase G"])
db = None


def set_db(database):
    global db
    db = database


# =========================================================================
# 7-role permission matrix (spec §7)
# =========================================================================

ROLE_MATRIX = {
    "super_admin": {
        "label": "Super Admin",
        "permissions": [
            "career.*", "employee.*", "attendance.*", "leave.*",
            "performance.*", "incentive.*", "rbac.*", "audit.*",
            "notification.*", "system.*",
        ],
    },
    "hr_admin": {
        "label": "HR Admin",
        "permissions": [
            "career.jobs.*", "career.applications.*", "career.tests.*",
            "career.interviews.*", "career.offers.*",
            "employee.read", "employee.create", "employee.update",
            "attendance.read", "attendance.mark",
            "leave.read", "leave.decide",
            "performance.*", "incentive.*",
            "notification.read", "notification.write",
            "audit.read",
        ],
    },
    "recruiter": {
        "label": "Recruiter",
        "permissions": [
            "career.jobs.read", "career.jobs.write",
            "career.applications.*", "career.tests.*", "career.interviews.*",
            "career.offers.read", "career.offers.write",
        ],
    },
    "department_head": {
        "label": "Department Head",
        "permissions": [
            "career.applications.read", "career.interviews.*",
            "employee.read", "attendance.read",
            "leave.decide", "performance.*", "incentive.read", "incentive.approve",
        ],
    },
    "district_manager": {
        "label": "District Manager",
        "permissions": [
            "employee.read", "attendance.read", "attendance.mark",
            "leave.read", "leave.decide", "performance.read",
        ],
    },
    "employee": {
        "label": "Employee",
        "permissions": [
            "employee.self", "attendance.self", "leave.apply",
            "leave.cancel_self", "performance.self",
        ],
    },
    "candidate": {
        "label": "Candidate",
        "permissions": ["career.apply", "career.test.attempt", "career.offer.respond"],
    },
}


def _permission_match(granted: str, requested: str) -> bool:
    """`career.*` matches `career.jobs.read`; exact strings match exactly."""
    if granted == requested:
        return True
    if granted.endswith(".*"):
        prefix = granted[:-2]
        return requested == prefix or requested.startswith(prefix + ".")
    return False


@router.get("/rbac/roles")
async def list_roles():
    return {"roles": [{"role": k, **v} for k, v in ROLE_MATRIX.items()]}


class RoleBinding(BaseModel):
    user: str            # email / user_id / uid
    role: str
    admin_id: str = "admin"


@router.post("/rbac/bind")
async def bind_role(data: RoleBinding):
    if data.role not in ROLE_MATRIX:
        raise HTTPException(status_code=400, detail=f"Invalid role. Use one of: {list(ROLE_MATRIX.keys())}")
    # Idempotent — a user can only hold each role once
    existing = await db.hr_role_bindings.find_one({"user": data.user, "role": data.role}, {"_id": 0})
    if existing:
        return {"success": True, "already_bound": True, "binding": existing}

    now = datetime.now(timezone.utc).isoformat()
    binding = {
        "binding_id": f"RB-{str(uuid.uuid4())[:10].upper()}",
        "user": data.user,
        "role": data.role,
        "assigned_by": data.admin_id,
        "assigned_at": now,
    }
    await db.hr_role_bindings.insert_one(binding)
    await log_action(db, data.admin_id, "rbac.bind", "hr_role_binding", binding["binding_id"], None, binding)
    binding.pop("_id", None)
    return {"success": True, "already_bound": False, "binding": binding}


@router.delete("/rbac/bind/{binding_id}")
async def unbind_role(binding_id: str, admin_id: str = "admin"):
    row = await db.hr_role_bindings.find_one({"binding_id": binding_id})
    if not row:
        raise HTTPException(status_code=404, detail="Binding not found")
    await db.hr_role_bindings.delete_one({"binding_id": binding_id})
    await log_action(db, admin_id, "rbac.unbind", "hr_role_binding", binding_id, row, None)
    return {"success": True}


@router.get("/rbac/bindings")
async def list_bindings(user: Optional[str] = None, role: Optional[str] = None):
    q = {}
    if user: q["user"] = user
    if role: q["role"] = role
    rows = await db.hr_role_bindings.find(q, {"_id": 0}).sort("assigned_at", -1).to_list(1000)
    return {"bindings": rows, "total": len(rows)}


@router.get("/rbac/check")
async def check_permission(user: str, permission: str):
    """Return whether the given user has the permission through any bound role."""
    bindings = await db.hr_role_bindings.find({"user": user}).to_list(50)
    roles = [b["role"] for b in bindings]
    granted_all = []
    for r in roles:
        granted_all.extend(ROLE_MATRIX.get(r, {}).get("permissions", []))
    allowed = any(_permission_match(g, permission) for g in granted_all)
    return {"user": user, "roles": roles, "permission": permission, "allowed": allowed}


# =========================================================================
# Audit log viewer
# =========================================================================

@router.get("/audit")
async def list_audit(
    actor: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = 200,
):
    q = {}
    if actor: q["actor"] = actor
    if action: q["action"] = {"$regex": f"^{re.escape(action)}"}
    if entity_type: q["entity_type"] = entity_type
    if entity_id: q["entity_id"] = entity_id
    limit = max(1, min(1000, int(limit or 200)))
    rows = await db.hr_audit_log.find(q, {"_id": 0}).sort("ts", -1).to_list(limit)
    return {"logs": rows, "total": len(rows)}


# =========================================================================
# Notification templates (§46-47)
# =========================================================================

TEMPLATE_KEYS = [
    "application_received", "test_assigned", "test_completed",
    "interview_scheduled", "interview_reminder",
    "offer_generated", "offer_sent", "offer_accepted", "offer_declined",
    "joining_scheduled", "onboarding_started",
    "leave_requested", "leave_approved", "leave_rejected",
    "appraisal_due", "appraisal_finalised",
    "incentive_calculated", "incentive_approved",
    "birthday", "work_anniversary",
]
CHANNELS = ["email", "sms", "in_app", "whatsapp"]

DEFAULT_TEMPLATES = [
    {"key": "application_received", "channel": "email", "subject": "Application received — {job_title}",
     "body": "Hi {name},\n\nThanks for applying for {job_title}. Your application ID is {application_id}. Our team will review and get back to you shortly.\n\n— Paras Reward HR"},
    {"key": "interview_scheduled", "channel": "email", "subject": "Interview scheduled for {job_title}",
     "body": "Hi {name},\n\nYour {interview_kind} interview is scheduled for {scheduled_at} ({mode}). Link: {meet_link}\n\n— Paras Reward HR"},
    {"key": "offer_generated", "channel": "email", "subject": "Your offer letter — Paras Reward",
     "body": "Hi {name},\n\nWe're thrilled to extend an offer. Please review and respond via {accept_url}. Offer ID: {offer_id}.\n\n— Paras Reward HR"},
    {"key": "leave_approved", "channel": "email", "subject": "Leave approved — {from_date} to {to_date}",
     "body": "Hi {name},\n\nYour {leave_type} leave from {from_date} to {to_date} ({days} days) is approved.\n\n— Paras Reward HR"},
    {"key": "appraisal_finalised", "channel": "email", "subject": "Your appraisal — {cycle}",
     "body": "Hi {name},\n\nYour appraisal for cycle {cycle} has been finalised. Rating: {rating}. Recommendation: {recommendation}.\n\n— Paras Reward HR"},
]


async def _ensure_defaults():
    """Idempotent — seed default templates on first read."""
    for t in DEFAULT_TEMPLATES:
        exists = await db.notification_templates.find_one({"key": t["key"], "channel": t["channel"]})
        if not exists:
            await db.notification_templates.insert_one({
                "template_id": f"NT-{str(uuid.uuid4())[:10].upper()}",
                **t,
                "variables": _extract_vars(t["subject"], t["body"]),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "seeded": True,
            })


_VAR_RX = re.compile(r"\{([a-zA-Z0-9_]+)\}")


def _extract_vars(*strings: str) -> List[str]:
    out = set()
    for s in strings:
        out.update(_VAR_RX.findall(s or ""))
    return sorted(out)


class TemplateRequest(BaseModel):
    key: str
    channel: str
    subject: str
    body: str
    is_active: bool = True
    admin_id: str = "admin"


@router.post("/notifications/templates")
async def create_template(data: TemplateRequest):
    if data.key not in TEMPLATE_KEYS:
        raise HTTPException(status_code=400, detail=f"Invalid key. Use one of: {TEMPLATE_KEYS}")
    if data.channel not in CHANNELS:
        raise HTTPException(status_code=400, detail=f"Invalid channel. Use one of: {CHANNELS}")

    now = datetime.now(timezone.utc).isoformat()
    tpl = {
        "template_id": f"NT-{str(uuid.uuid4())[:10].upper()}",
        "key": data.key,
        "channel": data.channel,
        "subject": data.subject,
        "body": data.body,
        "variables": _extract_vars(data.subject, data.body),
        "is_active": data.is_active,
        "created_by": data.admin_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.notification_templates.insert_one(tpl)
    await log_action(db, data.admin_id, "notification.create", "notification_template", tpl["template_id"], None, tpl)
    tpl.pop("_id", None)
    return {"success": True, "template": tpl}


@router.get("/notifications/templates")
async def list_templates(key: Optional[str] = None, channel: Optional[str] = None, active_only: bool = False):
    await _ensure_defaults()
    q = {}
    if key: q["key"] = key
    if channel: q["channel"] = channel
    if active_only: q["is_active"] = True
    rows = await db.notification_templates.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"templates": rows, "total": len(rows), "keys": TEMPLATE_KEYS, "channels": CHANNELS}


class TemplateUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    is_active: Optional[bool] = None
    admin_id: str = "admin"


@router.put("/notifications/templates/{template_id}")
async def update_template(template_id: str, data: TemplateUpdate):
    row = await db.notification_templates.find_one({"template_id": template_id})
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.subject is not None: updates["subject"] = data.subject
    if data.body is not None: updates["body"] = data.body
    if data.is_active is not None: updates["is_active"] = data.is_active
    if "subject" in updates or "body" in updates:
        updates["variables"] = _extract_vars(updates.get("subject", row["subject"]), updates.get("body", row["body"]))
    await db.notification_templates.update_one({"template_id": template_id}, {"$set": updates})
    await log_action(db, data.admin_id, "notification.update", "notification_template", template_id, row, updates)
    return {"success": True}


@router.delete("/notifications/templates/{template_id}")
async def delete_template(template_id: str, admin_id: str = "admin"):
    row = await db.notification_templates.find_one({"template_id": template_id})
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.notification_templates.delete_one({"template_id": template_id})
    await log_action(db, admin_id, "notification.delete", "notification_template", template_id, row, None)
    return {"success": True}


class TemplateRender(BaseModel):
    key: str
    channel: str = "email"
    context: dict


@router.post("/notifications/render")
async def render_template(data: TemplateRender):
    """Preview a template with a given context using str.format substitution.

    Missing variables render as ``{var}`` verbatim so admins can spot gaps.
    """
    tpl = await db.notification_templates.find_one({"key": data.key, "channel": data.channel, "is_active": True}, {"_id": 0})
    if not tpl:
        raise HTTPException(status_code=404, detail=f"No active template for key={data.key} channel={data.channel}")

    def safe_format(s: str) -> str:
        def replace(m):
            var = m.group(1)
            return str(data.context.get(var, m.group(0)))
        return _VAR_RX.sub(replace, s or "")

    return {
        "template_id": tpl["template_id"],
        "subject": safe_format(tpl["subject"]),
        "body": safe_format(tpl["body"]),
        "variables_used": _extract_vars(tpl["subject"], tpl["body"]),
        "context_keys": list(data.context.keys()),
    }
