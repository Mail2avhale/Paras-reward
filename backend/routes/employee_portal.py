"""
Employee Self-Service Portal — Login + own-data endpoints
Prefix: /api/public/employee/*

Auth: Employee ID + password (bcrypt-hashed on employee doc).
Token: JWT (HS256) signed with JWT_SECRET_KEY, 12h TTL, sent as Authorization: Bearer.

Collections used
----------------
employees              : {employee_id, name, email, department, designation, ...,
                          password_hash (added by admin), password_set_at,
                          failed_login_count, locked_until}
employee_login_events  : audit trail
announcements          : {announcement_id, title, body, published_by, published_at,
                          audience: "all"|"department:{name}", pinned, expires_at}
payroll_runs           : (see hr_payroll.py)
payslips               : (see hr_payroll.py)
leaves                 : reused from careers_phase_d
attendance             : reused from careers_phase_d
performance_reviews    : reused from careers_phase_f (appraisals)
"""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List
import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse

router = APIRouter(prefix="/public/employee", tags=["Employee Self-Service"])
admin_router = APIRouter(prefix="/public/hr", tags=["HR Admin — Employee Credentials + Announcements"])
db = None

JWT_ALGO = "HS256"
JWT_TTL_HOURS = 12
LOCKOUT_THRESHOLD = 5
LOCKOUT_MINUTES = 15


def set_db(database):
    global db
    db = database


def _jwt_secret() -> str:
    return os.environ["JWT_SECRET_KEY"]


def _hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def _verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _make_token(employee_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": employee_id,
        "type": "employee",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=JWT_TTL_HOURS)).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGO)


async def _current_employee(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization[7:].strip()
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "employee":
        raise HTTPException(status_code=401, detail="Invalid token type")
    emp = await db.employees.find_one({"employee_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not emp:
        raise HTTPException(status_code=401, detail="Employee not found")
    if emp.get("status") == "separated":
        raise HTTPException(status_code=403, detail="Account inactive (separated)")
    return emp


# ============================================================================
# ADMIN — set initial password / reset password / list credentials
# ============================================================================

class AdminSetPassword(BaseModel):
    employee_id: str
    password: str = Field(min_length=6, max_length=64)
    admin_id: str = "admin"


@admin_router.post("/employees/set-password")
async def admin_set_password(data: AdminSetPassword):
    """Admin: set or reset an employee's portal password."""
    emp = await db.employees.find_one({"employee_id": data.employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    now = datetime.now(timezone.utc).isoformat()
    await db.employees.update_one(
        {"employee_id": data.employee_id},
        {"$set": {
            "password_hash": _hash_pw(data.password),
            "password_set_at": now,
            "password_set_by": data.admin_id,
            "failed_login_count": 0,
            "locked_until": None,
        }},
    )
    return {"success": True, "employee_id": data.employee_id, "message": "Password updated. Share with employee securely."}


@admin_router.get("/employees/credentials")
async def list_employee_credentials():
    """Admin: quick view of which employees have portal access enabled."""
    rows = await db.employees.find(
        {"status": {"$ne": "separated"}},
        {"_id": 0, "employee_id": 1, "name": 1, "email": 1, "department": 1, "password_set_at": 1, "locked_until": 1},
    ).sort("name", 1).to_list(2000)
    for r in rows:
        r["portal_enabled"] = bool(r.get("password_set_at"))
        locked = r.get("locked_until")
        r["locked"] = bool(locked and locked > datetime.now(timezone.utc).isoformat())
    return {"employees": rows, "total": len(rows)}


# ============================================================================
# EMPLOYEE — Login / Change password / Me
# ============================================================================

class EmployeeLogin(BaseModel):
    employee_id: str
    password: str


@router.post("/login")
async def employee_login(data: EmployeeLogin, request: Request):
    emp = await db.employees.find_one({"employee_id": data.employee_id.strip().upper()})
    if not emp or not emp.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials or portal access not enabled")

    now_iso = datetime.now(timezone.utc).isoformat()
    lu = emp.get("locked_until")
    if lu and lu > now_iso:
        raise HTTPException(status_code=423, detail=f"Account locked until {lu[:19]} UTC. Contact HR to unlock.")

    if not _verify_pw(data.password, emp["password_hash"]):
        fc = int(emp.get("failed_login_count", 0)) + 1
        upd = {"failed_login_count": fc}
        if fc >= LOCKOUT_THRESHOLD:
            upd["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
            upd["failed_login_count"] = 0
        await db.employees.update_one({"employee_id": emp["employee_id"]}, {"$set": upd})
        await db.employee_login_events.insert_one({
            "employee_id": emp["employee_id"], "at": now_iso, "ok": False,
            "ip": request.client.host if request.client else "",
        })
        raise HTTPException(status_code=401, detail="Invalid credentials")

    await db.employees.update_one(
        {"employee_id": emp["employee_id"]},
        {"$set": {"failed_login_count": 0, "locked_until": None, "last_login_at": now_iso}},
    )
    await db.employee_login_events.insert_one({
        "employee_id": emp["employee_id"], "at": now_iso, "ok": True,
        "ip": request.client.host if request.client else "",
    })
    token = _make_token(emp["employee_id"])
    return {
        "success": True,
        "token": token,
        "expires_in_hours": JWT_TTL_HOURS,
        "employee": {
            "employee_id": emp["employee_id"],
            "name": emp.get("name"),
            "email": emp.get("email"),
            "department": emp.get("department"),
            "designation": emp.get("designation"),
        },
    }


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=64)


@router.post("/change-password")
async def change_password(data: ChangePassword, authorization: Optional[str] = Header(None)):
    emp = await _current_employee(authorization)
    full = await db.employees.find_one({"employee_id": emp["employee_id"]})
    if not _verify_pw(data.current_password, full.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    now = datetime.now(timezone.utc).isoformat()
    await db.employees.update_one(
        {"employee_id": emp["employee_id"]},
        {"$set": {"password_hash": _hash_pw(data.new_password), "password_set_at": now, "password_set_by": "self"}},
    )
    return {"success": True}


@router.get("/me")
async def me(authorization: Optional[str] = Header(None)):
    emp = await _current_employee(authorization)
    onboarding = await db.employee_onboarding.find_one({"employee_id": emp["employee_id"]}, {"_id": 0})
    onboarding_progress = None
    if onboarding:
        total = len(onboarding.get("tasks", []))
        done = sum(1 for t in onboarding.get("tasks", []) if t.get("done"))
        onboarding_progress = {"done": done, "total": total, "percent": round(done / total * 100, 1) if total else 0.0}
    return {"employee": emp, "onboarding_progress": onboarding_progress}


# ============================================================================
# EMPLOYEE — Attendance / Leaves / Letters / Appraisals / Payslips / Announcements
# ============================================================================

@router.get("/attendance")
async def my_attendance(month: Optional[str] = None, authorization: Optional[str] = Header(None)):
    emp = await _current_employee(authorization)
    m = month or datetime.now(timezone.utc).strftime("%Y-%m")
    try:
        yr, mo = m.split("-"); int(yr); int(mo)
    except Exception:
        raise HTTPException(status_code=400, detail="month must be YYYY-MM")
    rows = await db.attendance.find(
        {"employee_id": emp["employee_id"], "date": {"$regex": f"^{m}"}},
        {"_id": 0, "marked_by": 0},
    ).sort("date", 1).to_list(50)
    summary = {"present": 0, "absent": 0, "half_day": 0, "wfh": 0, "leave": 0}
    total_hours = 0.0
    for r in rows:
        s = r.get("status")
        if s in summary:
            summary[s] += 1
        if isinstance(r.get("hours_worked"), (int, float)):
            total_hours += r["hours_worked"]
    return {"month": m, "days": rows, "summary": summary, "total_hours": round(total_hours, 2)}


@router.get("/leaves")
async def my_leaves(authorization: Optional[str] = Header(None)):
    emp = await _current_employee(authorization)
    rows = await db.leaves.find({"employee_id": emp["employee_id"]}, {"_id": 0}).sort("applied_at", -1).to_list(200)
    return {"leaves": rows, "total": len(rows)}


@router.get("/leaves/balance")
async def my_leave_balance(authorization: Optional[str] = Header(None)):
    from routes.careers_phase_d import LEAVE_TYPES, DEFAULT_LEAVE_ENTITLEMENT
    emp = await _current_employee(authorization)
    yr = datetime.now(timezone.utc).year
    used = {lt: 0 for lt in LEAVE_TYPES}
    rows = await db.leaves.find(
        {"employee_id": emp["employee_id"], "status": "approved", "from_date": {"$regex": f"^{yr}"}},
        {"_id": 0},
    ).to_list(500)
    for r in rows:
        used[r["leave_type"]] = used.get(r["leave_type"], 0) + r.get("days", 0)
    balance = []
    for lt in LEAVE_TYPES:
        allowed = DEFAULT_LEAVE_ENTITLEMENT.get(lt, 0)
        u = used.get(lt, 0)
        balance.append({"leave_type": lt, "entitlement": allowed, "used": u, "remaining": max(0, allowed - u)})
    return {"year": yr, "balance": balance}


class LeaveSelfApply(BaseModel):
    leave_type: str
    from_date: str
    to_date: str
    reason: str = ""


@router.post("/leaves/apply")
async def apply_own_leave(data: LeaveSelfApply, authorization: Optional[str] = Header(None)):
    from routes.careers_phase_d import LEAVE_TYPES
    emp = await _current_employee(authorization)
    if data.leave_type not in LEAVE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid leave_type. Use one of: {LEAVE_TYPES}")
    try:
        d1 = datetime.fromisoformat(data.from_date).date()
        d2 = datetime.fromisoformat(data.to_date).date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if d2 < d1:
        raise HTTPException(status_code=400, detail="to_date must be >= from_date")
    days = (d2 - d1).days + 1
    now = datetime.now(timezone.utc).isoformat()
    leave_id = f"LV-{str(uuid.uuid4())[:10].upper()}"
    record = {
        "leave_id": leave_id,
        "employee_id": emp["employee_id"],
        "employee_name": emp.get("name"),
        "department": emp.get("department", ""),
        "leave_type": data.leave_type,
        "from_date": data.from_date,
        "to_date": data.to_date,
        "days": days,
        "reason": data.reason,
        "status": "requested",
        "applied_at": now,
        "applied_via": "self_service",
        "approver": None,
        "approver_comment": None,
        "decided_at": None,
    }
    await db.leaves.insert_one(record)
    record.pop("_id", None)
    return {"success": True, "leave": record}


@router.post("/leaves/{leave_id}/cancel")
async def cancel_own_leave(leave_id: str, authorization: Optional[str] = Header(None)):
    emp = await _current_employee(authorization)
    lv = await db.leaves.find_one({"leave_id": leave_id, "employee_id": emp["employee_id"]})
    if not lv:
        raise HTTPException(status_code=404, detail="Leave not found")
    if lv["status"] in ("rejected", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Leave already {lv['status']}")
    now = datetime.now(timezone.utc).isoformat()
    await db.leaves.update_one(
        {"leave_id": leave_id},
        {"$set": {"status": "cancelled", "cancelled_at": now, "cancelled_by": "self"}},
    )
    return {"success": True}


@router.get("/letters")
async def my_letters(authorization: Optional[str] = Header(None)):
    emp = await _current_employee(authorization)
    rows = await db.employee_letters.find(
        {"employee_id": emp["employee_id"]},
        {"_id": 0, "pdf_path": 0},
    ).sort("issued_at", -1).to_list(200)
    for r in rows:
        r["pdf_url"] = f"/api/public/employees/{emp['employee_id']}/letters/{r['letter_id']}/pdf"
    return {"letters": rows, "total": len(rows)}


@router.get("/appraisals")
async def my_appraisals(authorization: Optional[str] = Header(None)):
    emp = await _current_employee(authorization)
    rows = await db.performance_reviews.find(
        {"employee_id": emp["employee_id"]},
        {"_id": 0},
    ).sort("period", -1).to_list(50)
    # Only show finalised ones to employee
    return {"appraisals": [r for r in rows if r.get("status") == "finalized"], "total": len(rows)}


@router.get("/payslips")
async def my_payslips(authorization: Optional[str] = Header(None)):
    emp = await _current_employee(authorization)
    rows = await db.payslips.find(
        {"employee_id": emp["employee_id"]},
        {"_id": 0, "computed_at": 0, "pdf_path": 0},
    ).sort("month", -1).to_list(60)
    for r in rows:
        r["pdf_url"] = f"/api/public/employee/payslips/{r['payslip_id']}/pdf"
    return {"payslips": rows, "total": len(rows)}


@router.get("/payslips/{payslip_id}/pdf")
async def my_payslip_pdf(payslip_id: str, authorization: Optional[str] = Header(None)):
    emp = await _current_employee(authorization)
    from routes.hr_payroll import build_payslip_pdf
    ps = await db.payslips.find_one({"payslip_id": payslip_id, "employee_id": emp["employee_id"]})
    if not ps:
        raise HTTPException(status_code=404, detail="Payslip not found")
    if not ps.get("pdf_path") or not os.path.exists(ps["pdf_path"]):
        build_payslip_pdf(ps)
    return FileResponse(ps["pdf_path"], filename=f"{payslip_id}.pdf", media_type="application/pdf")


@router.get("/announcements")
async def my_announcements(authorization: Optional[str] = Header(None)):
    emp = await _current_employee(authorization)
    now = datetime.now(timezone.utc).isoformat()
    dept = emp.get("department", "")
    q = {
        "$or": [
            {"audience": "all"},
            {"audience": f"department:{dept}"},
        ],
        "$and": [{"$or": [{"expires_at": None}, {"expires_at": {"$gt": now}}]}],
    }
    rows = await db.announcements.find(q, {"_id": 0}).sort([("pinned", -1), ("published_at", -1)]).to_list(100)
    return {"announcements": rows, "total": len(rows)}


# ============================================================================
# ADMIN — Announcements CRUD
# ============================================================================

class AnnouncementCreate(BaseModel):
    title: str
    body: str
    audience: str = "all"   # "all" or "department:{name}"
    pinned: bool = False
    expires_at: Optional[str] = None
    published_by: str = "admin"


@admin_router.post("/announcements")
async def create_announcement(data: AnnouncementCreate):
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "announcement_id": f"ANN-{str(uuid.uuid4())[:10].upper()}",
        "title": data.title,
        "body": data.body,
        "audience": data.audience,
        "pinned": data.pinned,
        "published_by": data.published_by,
        "published_at": now,
        "expires_at": data.expires_at,
    }
    await db.announcements.insert_one(record)
    record.pop("_id", None)
    return {"success": True, "announcement": record}


@admin_router.get("/announcements")
async def list_announcements():
    rows = await db.announcements.find({}, {"_id": 0}).sort([("pinned", -1), ("published_at", -1)]).to_list(500)
    return {"announcements": rows, "total": len(rows)}


@admin_router.delete("/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str):
    r = await db.announcements.delete_one({"announcement_id": announcement_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"success": True}
