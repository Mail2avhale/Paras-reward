"""
Careers Phase D — Onboarding Checklist + HR Letter PDFs
Attendance & Leave Core
Spec: §27-30 (onboarding + org hierarchy), §71 (5 letter templates), §32 §42-43 (attendance + leave)

Collections
-----------
employee_onboarding : {onboarding_id, employee_id, tasks: [{task_id, title, done, done_by, done_at}], created_at, completed_at}
employee_letters    : {letter_id, employee_id, kind, payload, pdf_path, issued_by, issued_at}
attendance          : {attendance_id, employee_id, date (YYYY-MM-DD), status, check_in, check_out, hours_worked, district, department, notes}
leaves              : {leave_id, employee_id, leave_type, from_date, to_date, days, reason, status, applied_at, approver, approver_comment, decided_at}
"""
import os
import uuid
import logging
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

router = APIRouter(prefix="/public", tags=["Careers Phase D + Attendance/Leave"])
db = None

LETTERS_DIR = "/app/backend/uploads/letters"
os.makedirs(LETTERS_DIR, exist_ok=True)

LETTER_KINDS = ["appointment", "confirmation", "increment", "promotion", "experience"]

# Default onboarding checklist template (spec §27)
DEFAULT_ONBOARDING_TASKS = [
    "Send welcome email + joining kit link",
    "Collect signed offer + document originals",
    "Issue company ID card",
    "Provision company email account",
    "Assign laptop / equipment",
    "Grant ERP / attendance system access",
    "Collect bank details for salary account",
    "Register PF / ESI",
    "Assign onboarding buddy",
    "Schedule Day-1 orientation",
]


def set_db(database):
    global db
    db = database


# =========================================================================
#                            ONBOARDING
# =========================================================================

@router.post("/employees/{employee_id}/onboarding/init")
async def init_onboarding(employee_id: str, request: Request):
    """Admin: seed the default checklist for a new hire (idempotent)."""
    try:
        emp = await db.employees.find_one({"employee_id": employee_id})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        existing = await db.employee_onboarding.find_one({"employee_id": employee_id}, {"_id": 0})
        if existing:
            return {"success": True, "already_exists": True, "onboarding": existing}

        data = await request.json() if request.headers.get("content-length") else {}
        admin_id = data.get("admin_id", "admin") if isinstance(data, dict) else "admin"
        custom_tasks = data.get("tasks") if isinstance(data, dict) else None

        tasks_src = custom_tasks if isinstance(custom_tasks, list) and custom_tasks else DEFAULT_ONBOARDING_TASKS
        now = datetime.now(timezone.utc).isoformat()
        onboarding = {
            "onboarding_id": f"ONB-{str(uuid.uuid4())[:10].upper()}",
            "employee_id": employee_id,
            "tasks": [{"task_id": f"T-{i+1:02d}", "title": t, "done": False, "done_by": None, "done_at": None} for i, t in enumerate(tasks_src)],
            "created_by": admin_id,
            "created_at": now,
            "completed_at": None,
        }
        await db.employee_onboarding.insert_one(onboarding)
        onboarding.pop("_id", None)
        return {"success": True, "already_exists": False, "onboarding": onboarding}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ONBOARDING] init error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/employees/{employee_id}/onboarding")
async def get_onboarding(employee_id: str):
    row = await db.employee_onboarding.find_one({"employee_id": employee_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Onboarding not initialised")
    total = len(row["tasks"])
    done = sum(1 for t in row["tasks"] if t.get("done"))
    row["progress"] = {"done": done, "total": total, "percent": round(done / total * 100, 1) if total else 0.0}
    return {"onboarding": row}


class TaskUpdate(BaseModel):
    done: bool
    admin_id: str = "admin"


@router.patch("/employees/{employee_id}/onboarding/{task_id}")
async def update_onboarding_task(employee_id: str, task_id: str, data: TaskUpdate):
    row = await db.employee_onboarding.find_one({"employee_id": employee_id})
    if not row:
        raise HTTPException(status_code=404, detail="Onboarding not initialised")
    now = datetime.now(timezone.utc).isoformat()

    r = await db.employee_onboarding.update_one(
        {"employee_id": employee_id, "tasks.task_id": task_id},
        {"$set": {
            "tasks.$.done": data.done,
            "tasks.$.done_by": data.admin_id if data.done else None,
            "tasks.$.done_at": now if data.done else None,
        }},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")

    # If all tasks done, stamp completed_at (spec §27 completion signal)
    row = await db.employee_onboarding.find_one({"employee_id": employee_id})
    all_done = all(t.get("done") for t in row["tasks"])
    if all_done and not row.get("completed_at"):
        await db.employee_onboarding.update_one({"employee_id": employee_id}, {"$set": {"completed_at": now}})
    elif not all_done and row.get("completed_at"):
        await db.employee_onboarding.update_one({"employee_id": employee_id}, {"$set": {"completed_at": None}})

    return {"success": True, "all_done": all_done}


# =========================================================================
#                            HR LETTER PDFs (§71)
# =========================================================================

class LetterRequest(BaseModel):
    kind: str  # appointment | confirmation | increment | promotion | experience
    payload: dict = Field(default_factory=dict)
    admin_id: str = "admin"


def _base_styles():
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("t", parent=styles["Title"], alignment=TA_CENTER, fontSize=17, spaceAfter=6),
        "sub": ParagraphStyle("s", parent=styles["Normal"], alignment=TA_CENTER, fontSize=9, textColor=colors.HexColor("#6b7280"), spaceAfter=14),
        "h": ParagraphStyle("h", parent=styles["Heading3"], textColor=colors.HexColor("#111827"), spaceBefore=10, spaceAfter=4),
        "body": ParagraphStyle("b", parent=styles["Normal"], alignment=TA_LEFT, fontSize=10.5, leading=14),
    }


def _company_header(story, s, letter_title, letter_id):
    story.append(Paragraph("PARAS REWARD TECHNOLOGIES PRIVATE LIMITED", s["title"]))
    story.append(Paragraph("B-18, Bizz Tower, Chatrapati Sambhaji Nagar, Maharashtra 431006 &nbsp;•&nbsp; www.parasreward.com", s["sub"]))
    story.append(Paragraph(f"<b>{letter_title}</b> &nbsp; ({letter_id})", s["h"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"<b>Date:</b> {datetime.now(timezone.utc).strftime('%d %B %Y')}", s["body"]))


def _employee_block(story, s, emp):
    story.append(Paragraph(f"<b>To:</b> {emp.get('name', '')} ({emp.get('employee_id', '')})", s["body"]))
    story.append(Paragraph(f"<b>Designation:</b> {emp.get('designation', '')} &nbsp;&nbsp;<b>Department:</b> {emp.get('department', '')}", s["body"]))
    story.append(Spacer(1, 8))


def _footer(story, s):
    story.append(Spacer(1, 22))
    story.append(Paragraph("For Paras Reward Technologies Private Limited,", s["body"]))
    story.append(Spacer(1, 24))
    story.append(Paragraph("<b>Authorised Signatory</b><br/>Human Resources Department", s["body"]))


def _build_letter_pdf(letter_id: str, kind: str, employee: dict, payload: dict) -> str:
    fpath = os.path.join(LETTERS_DIR, f"{letter_id}.pdf")
    doc = SimpleDocTemplate(fpath, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm, title=f"{kind.title()} letter — {employee.get('name')}")
    s = _base_styles()
    story = []
    titles = {
        "appointment": "Letter of Appointment",
        "confirmation": "Letter of Confirmation",
        "increment": "Salary Increment Letter",
        "promotion": "Promotion Letter",
        "experience": "Experience & Relieving Letter",
    }
    _company_header(story, s, titles.get(kind, "Letter"), letter_id)
    _employee_block(story, s, employee)

    first = (employee.get("name") or "Employee").split()[0]
    joining = employee.get("joining_date") or payload.get("joining_date") or "your joining date"
    dept = employee.get("department") or payload.get("department") or "your department"

    if kind == "appointment":
        story.append(Paragraph(f"Dear {first},", s["body"]))
        story.append(Paragraph(
            f"With reference to your acceptance of our offer, we are pleased to appoint you as "
            f"<b>{employee.get('designation', '')}</b> in the <b>{dept}</b> department at "
            f"<b>Paras Reward Technologies Pvt. Ltd.</b>, effective from <b>{joining}</b>.",
            s["body"],
        ))
        story.append(Paragraph(
            f"Your annual compensation, terms of employment and probation policy are as communicated to you in the "
            f"accepted offer letter (Offer ID: {payload.get('offer_id', 'as issued')}). All policies of the Company "
            f"as amended from time to time shall be binding on you.",
            s["body"],
        ))
        story.append(Paragraph("We warmly welcome you to the Paras Reward family.", s["body"]))
    elif kind == "confirmation":
        story.append(Paragraph(f"Dear {first},", s["body"]))
        story.append(Paragraph(
            f"We are pleased to inform you that upon satisfactory completion of your probation period, "
            f"your services are hereby <b>confirmed</b> as a permanent employee of the Company with effect from "
            f"<b>{payload.get('confirmation_date', datetime.now(timezone.utc).strftime('%d %B %Y'))}</b>.",
            s["body"],
        ))
        story.append(Paragraph("All existing terms and conditions of your employment shall continue to apply unless amended in writing.", s["body"]))
    elif kind == "increment":
        rows = [["Component", "Previous", "Revised"]]
        rows.append(["Annual CTC", f"₹ {payload.get('previous_ctc', 0):,.2f}", f"₹ {payload.get('new_ctc', 0):,.2f}"])
        if payload.get("effective_from"):
            rows.append(["Effective From", "—", payload["effective_from"]])
        tbl = Table(rows, colWidths=[6 * cm, 5 * cm, 5 * cm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(Paragraph(f"Dear {first},", s["body"]))
        story.append(Paragraph(
            "Based on your performance evaluation, we are pleased to revise your compensation as detailed below:",
            s["body"],
        ))
        story.append(tbl)
    elif kind == "promotion":
        story.append(Paragraph(f"Dear {first},", s["body"]))
        story.append(Paragraph(
            f"In recognition of your contribution and performance, you are hereby <b>promoted</b> to the position of "
            f"<b>{payload.get('new_designation', 'Senior ' + (employee.get('designation') or ''))}</b> "
            f"in the <b>{payload.get('new_department', dept)}</b> department, effective from "
            f"<b>{payload.get('effective_from', datetime.now(timezone.utc).strftime('%d %B %Y'))}</b>.",
            s["body"],
        ))
        if payload.get("new_ctc"):
            story.append(Paragraph(
                f"Your revised annual compensation shall be <b>₹ {payload['new_ctc']:,.2f}</b> as per the updated compensation letter issued separately.",
                s["body"],
            ))
        story.append(Paragraph("We congratulate you and wish you continued success in this new role.", s["body"]))
    elif kind == "experience":
        rd = payload.get("relieving_date", datetime.now(timezone.utc).strftime("%d %B %Y"))
        story.append(Paragraph("To Whom It May Concern,", s["body"]))
        story.append(Paragraph(
            f"This is to certify that <b>{employee.get('name', '')}</b> ({employee.get('employee_id', '')}) was employed with "
            f"<b>Paras Reward Technologies Pvt. Ltd.</b> from <b>{joining}</b> to <b>{rd}</b>. "
            f"At the time of separation, {first} held the position of <b>{employee.get('designation', '')}</b> "
            f"in the <b>{dept}</b> department.",
            s["body"],
        ))
        story.append(Paragraph(
            f"During {first}'s tenure with the Company, we found them to be sincere, hard-working and dedicated. "
            "We wish them the very best in all future endeavours.",
            s["body"],
        ))

    _footer(story, s)
    doc.build(story)
    return fpath


@router.post("/employees/{employee_id}/letters/generate")
async def generate_letter(employee_id: str, data: LetterRequest):
    try:
        if data.kind not in LETTER_KINDS:
            raise HTTPException(status_code=400, detail=f"Invalid kind. Use one of: {LETTER_KINDS}")
        emp = await db.employees.find_one({"employee_id": employee_id})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        letter_id = f"LTR-{data.kind[:3].upper()}-{str(uuid.uuid4())[:8].upper()}"
        pdf_path = _build_letter_pdf(letter_id, data.kind, emp, data.payload)

        now = datetime.now(timezone.utc).isoformat()
        record = {
            "letter_id": letter_id,
            "employee_id": employee_id,
            "kind": data.kind,
            "payload": data.payload,
            "pdf_path": pdf_path,
            "issued_by": data.admin_id,
            "issued_at": now,
        }
        await db.employee_letters.insert_one(record)

        # On experience letter → mark employee as separated
        if data.kind == "experience":
            await db.employees.update_one(
                {"employee_id": employee_id},
                {"$set": {"status": "separated", "separated_at": now, "updated_at": now}},
            )

        record.pop("_id", None)
        return {"success": True, "letter": record, "pdf_url": f"/api/public/employees/{employee_id}/letters/{letter_id}/pdf"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[LETTERS] generate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/employees/{employee_id}/letters")
async def list_letters(employee_id: str):
    rows = await db.employee_letters.find({"employee_id": employee_id}, {"_id": 0}).sort("issued_at", -1).to_list(200)
    return {"letters": rows, "total": len(rows)}


@router.get("/employees/{employee_id}/letters/{letter_id}/pdf")
async def download_letter(employee_id: str, letter_id: str):
    row = await db.employee_letters.find_one({"employee_id": employee_id, "letter_id": letter_id})
    if not row or not row.get("pdf_path"):
        raise HTTPException(status_code=404, detail="Letter not found")
    if not os.path.exists(row["pdf_path"]):
        emp = await db.employees.find_one({"employee_id": employee_id})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee missing")
        _build_letter_pdf(letter_id, row["kind"], emp, row.get("payload") or {})
    return FileResponse(row["pdf_path"], filename=f"{letter_id}.pdf", media_type="application/pdf")


# =========================================================================
#                          ATTENDANCE  (§32, §42)
# =========================================================================

ATTENDANCE_STATUSES = ["present", "absent", "half_day", "wfh", "leave"]


class AttendanceMark(BaseModel):
    employee_id: str
    date: Optional[str] = None  # YYYY-MM-DD, defaults to today UTC
    status: str = "present"
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    hours_worked: Optional[float] = None
    notes: str = ""
    admin_id: str = "admin"


@router.post("/attendance/mark")
async def mark_attendance(data: AttendanceMark):
    if data.status not in ATTENDANCE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use one of: {ATTENDANCE_STATUSES}")
    emp = await db.employees.find_one({"employee_id": data.employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    day = data.date or date.today().isoformat()
    now = datetime.now(timezone.utc).isoformat()
    hours = data.hours_worked
    if hours is None and data.check_in and data.check_out:
        try:
            fmt = "%H:%M" if len(data.check_in) <= 5 else "%H:%M:%S"
            ci = datetime.strptime(data.check_in, fmt)
            co = datetime.strptime(data.check_out, fmt)
            hours = round(max(0, (co - ci).total_seconds() / 3600), 2)
        except Exception:
            hours = None

    record = {
        "employee_id": data.employee_id,
        "employee_name": emp.get("name"),
        "district": emp.get("work_location", ""),
        "department": emp.get("department", ""),
        "date": day,
        "status": data.status,
        "check_in": data.check_in,
        "check_out": data.check_out,
        "hours_worked": hours,
        "notes": data.notes,
        "marked_by": data.admin_id,
        "updated_at": now,
    }

    # Upsert on (employee_id, date) → one entry per day
    r = await db.attendance.update_one(
        {"employee_id": data.employee_id, "date": day},
        {"$set": record, "$setOnInsert": {"created_at": now, "attendance_id": f"ATT-{str(uuid.uuid4())[:10].upper()}"}},
        upsert=True,
    )
    return {"success": True, "upserted": bool(r.upserted_id), "date": day}


@router.get("/attendance/roster")
async def daily_roster(date: Optional[str] = None, district: Optional[str] = None, department: Optional[str] = None):
    """Manager: daily attendance roster for a given date + optional filters."""
    day = date or datetime.now(timezone.utc).date().isoformat()
    query = {"date": day}
    if district:
        query["district"] = district
    if department:
        query["department"] = department
    rows = await db.attendance.find(query, {"_id": 0}).sort("employee_name", 1).to_list(2000)

    # Aggregate counts by status
    by_status = {s: 0 for s in ATTENDANCE_STATUSES}
    for r in rows:
        s = r.get("status")
        if s in by_status:
            by_status[s] += 1
    return {"date": day, "roster": rows, "total": len(rows), "by_status": by_status}


@router.get("/attendance/employee/{employee_id}")
async def employee_attendance(employee_id: str, month: Optional[str] = None):
    """Employee monthly attendance view. Month = YYYY-MM (default = current)."""
    m = month or datetime.now(timezone.utc).strftime("%Y-%m")
    try:
        yr, mo = m.split("-")
        int(yr); int(mo)
    except Exception:
        raise HTTPException(status_code=400, detail="month must be YYYY-MM")

    rows = await db.attendance.find(
        {"employee_id": employee_id, "date": {"$regex": f"^{m}"}},
        {"_id": 0}
    ).sort("date", 1).to_list(50)

    summary = {s: 0 for s in ATTENDANCE_STATUSES}
    total_hours = 0.0
    for r in rows:
        summary[r.get("status", "absent")] = summary.get(r.get("status", "absent"), 0) + 1
        if isinstance(r.get("hours_worked"), (int, float)):
            total_hours += r["hours_worked"]
    return {"employee_id": employee_id, "month": m, "days": rows, "summary": summary, "total_hours": round(total_hours, 2)}


# =========================================================================
#                              LEAVES (§43)
# =========================================================================

LEAVE_TYPES = ["casual", "sick", "earned", "comp_off", "lop", "maternity", "paternity"]
LEAVE_STATUSES = ["requested", "approved", "rejected", "cancelled"]

# Default annual entitlement by leave type (spec §43 — configurable via system_config later)
DEFAULT_LEAVE_ENTITLEMENT = {
    "casual": 12, "sick": 10, "earned": 15, "comp_off": 0, "lop": 0,
    "maternity": 180, "paternity": 15,
}


def _days_between(from_date: str, to_date: str) -> int:
    d1 = datetime.fromisoformat(from_date).date()
    d2 = datetime.fromisoformat(to_date).date()
    if d2 < d1:
        raise ValueError("to_date must be >= from_date")
    return (d2 - d1).days + 1


class LeaveApply(BaseModel):
    employee_id: str
    leave_type: str
    from_date: str  # YYYY-MM-DD
    to_date: str
    reason: str = ""


@router.post("/leaves/apply")
async def apply_leave(data: LeaveApply):
    if data.leave_type not in LEAVE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid leave_type. Use one of: {LEAVE_TYPES}")
    emp = await db.employees.find_one({"employee_id": data.employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    try:
        days = _days_between(data.from_date, data.to_date)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if days <= 0:
        raise HTTPException(status_code=400, detail="Invalid date range")

    now = datetime.now(timezone.utc).isoformat()
    leave_id = f"LV-{str(uuid.uuid4())[:10].upper()}"
    record = {
        "leave_id": leave_id,
        "employee_id": data.employee_id,
        "employee_name": emp.get("name"),
        "department": emp.get("department", ""),
        "leave_type": data.leave_type,
        "from_date": data.from_date,
        "to_date": data.to_date,
        "days": days,
        "reason": data.reason,
        "status": "requested",
        "applied_at": now,
        "approver": None,
        "approver_comment": None,
        "decided_at": None,
    }
    await db.leaves.insert_one(record)
    record.pop("_id", None)
    return {"success": True, "leave": record}


class LeaveDecision(BaseModel):
    action: str  # approve | reject
    approver: str
    comment: str = ""


@router.post("/leaves/{leave_id}/decision")
async def decide_leave(leave_id: str, data: LeaveDecision):
    action = data.action.strip().lower()
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")
    lv = await db.leaves.find_one({"leave_id": leave_id})
    if not lv:
        raise HTTPException(status_code=404, detail="Leave not found")
    if lv["status"] != "requested":
        raise HTTPException(status_code=400, detail=f"Leave already {lv['status']}")

    now = datetime.now(timezone.utc).isoformat()
    new_status = "approved" if action == "approve" else "rejected"
    await db.leaves.update_one(
        {"leave_id": leave_id},
        {"$set": {"status": new_status, "approver": data.approver, "approver_comment": data.comment, "decided_at": now}},
    )

    # Auto-mark attendance as 'leave' for approved days
    if new_status == "approved":
        try:
            d1 = datetime.fromisoformat(lv["from_date"]).date()
            for i in range(lv["days"]):
                day = (d1 + timedelta(days=i)).isoformat()
                await db.attendance.update_one(
                    {"employee_id": lv["employee_id"], "date": day},
                    {
                        "$set": {
                            "status": "leave",
                            "notes": f"Auto-marked from approved leave {leave_id}",
                            "updated_at": now,
                            "employee_id": lv["employee_id"],
                            "employee_name": lv.get("employee_name"),
                            "district": lv.get("district", ""),
                            "department": lv.get("department", ""),
                            "date": day,
                        },
                        "$setOnInsert": {"created_at": now, "attendance_id": f"ATT-{str(uuid.uuid4())[:10].upper()}"},
                    },
                    upsert=True,
                )
        except Exception:
            pass

    return {"success": True, "status": new_status}


class LeaveCancel(BaseModel):
    reason: str = ""


@router.post("/leaves/{leave_id}/cancel")
async def cancel_leave(leave_id: str, data: LeaveCancel):
    lv = await db.leaves.find_one({"leave_id": leave_id})
    if not lv:
        raise HTTPException(status_code=404, detail="Leave not found")
    if lv["status"] in ("rejected", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Leave already {lv['status']}")
    now = datetime.now(timezone.utc).isoformat()
    await db.leaves.update_one(
        {"leave_id": leave_id},
        {"$set": {"status": "cancelled", "cancelled_at": now, "cancel_reason": data.reason}},
    )
    return {"success": True}


@router.get("/leaves")
async def list_leaves(employee_id: Optional[str] = None, status: Optional[str] = None, department: Optional[str] = None):
    q = {}
    if employee_id:
        q["employee_id"] = employee_id
    if status:
        q["status"] = status
    if department:
        q["department"] = department
    rows = await db.leaves.find(q, {"_id": 0}).sort("applied_at", -1).to_list(1000)
    return {"leaves": rows, "total": len(rows)}


@router.get("/leaves/balance/{employee_id}")
async def leave_balance(employee_id: str, year: Optional[int] = None):
    """Compute remaining balance per leave type against yearly entitlement."""
    yr = year or datetime.now(timezone.utc).year
    used = {lt: 0 for lt in LEAVE_TYPES}
    rows = await db.leaves.find(
        {"employee_id": employee_id, "status": "approved", "from_date": {"$regex": f"^{yr}"}},
        {"_id": 0},
    ).to_list(500)
    for r in rows:
        used[r["leave_type"]] = used.get(r["leave_type"], 0) + r.get("days", 0)

    balance = []
    for lt in LEAVE_TYPES:
        allowed = DEFAULT_LEAVE_ENTITLEMENT.get(lt, 0)
        u = used.get(lt, 0)
        balance.append({
            "leave_type": lt,
            "entitlement": allowed,
            "used": u,
            "remaining": max(0, allowed - u),
        })
    return {"employee_id": employee_id, "year": yr, "balance": balance}
