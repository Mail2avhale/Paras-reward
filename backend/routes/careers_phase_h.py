"""
Careers Phase H — Employee Separation Workflow + HR Analytics Reports + System Health
Spec: §69 (separation + F&F), §49-50 (recruitment analytics + HR reports), §80 (final QA / health)

Collections
-----------
separations : {separation_id, employee_id, kind, reason, notice_period_days,
               requested_last_working_day, actual_last_working_day,
               clearances: [{item, owner, done, done_by, done_at}],
               fnf: {gross_dues, deductions, net_payable, status, calculated_at, paid_at},
               status, initiated_by, initiated_at, completed_at}
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.audit_log import log_action

router = APIRouter(prefix="/public", tags=["Careers Phase H"])
db = None


def set_db(database):
    global db
    db = database


# =========================================================================
#                            SEPARATION (§69)
# =========================================================================

SEPARATION_KINDS = ["resignation", "termination", "retirement", "end_of_contract", "absconding"]
SEPARATION_STATUSES = [
    "initiated",         # resignation submitted / termination raised
    "in_clearance",      # clearance checklist ongoing
    "cleared",           # all clearances done
    "fnf_calculated",    # F&F computed
    "fnf_paid",          # payment released
    "completed",         # experience letter issued + employee flipped to 'separated'
    "cancelled",
]

DEFAULT_CLEARANCE_ITEMS = [
    ("it", "IT Department", "Return laptop, revoke email/system access, retrieve badge"),
    ("admin", "Admin Department", "Return ID card, keys, company assets"),
    ("finance", "Finance Department", "Clear cash advances, expense reimbursements"),
    ("hr", "HR Department", "Exit interview, collect resignation acknowledgement"),
    ("manager", "Reporting Manager", "Knowledge transfer, project handover"),
]


class SeparationInitRequest(BaseModel):
    employee_id: str
    kind: str = "resignation"
    reason: str = ""
    notice_period_days: int = 30
    requested_last_working_day: Optional[str] = None
    admin_id: str = "admin"


@router.post("/separations/initiate")
async def initiate_separation(data: SeparationInitRequest):
    if data.kind not in SEPARATION_KINDS:
        raise HTTPException(status_code=400, detail=f"Invalid kind. Use one of: {SEPARATION_KINDS}")
    emp = await db.employees.find_one({"employee_id": data.employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Guard: no active separation already
    existing = await db.separations.find_one({
        "employee_id": data.employee_id,
        "status": {"$nin": ["completed", "cancelled"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Active separation already exists: {existing.get('separation_id')}")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    lwd = data.requested_last_working_day or (now + timedelta(days=max(0, data.notice_period_days))).date().isoformat()

    record = {
        "separation_id": f"SEP-{str(uuid.uuid4())[:10].upper()}",
        "employee_id": data.employee_id,
        "employee_name": emp.get("name"),
        "department": emp.get("department"),
        "designation": emp.get("designation"),
        "kind": data.kind,
        "reason": data.reason,
        "notice_period_days": max(0, int(data.notice_period_days)),
        "requested_last_working_day": lwd,
        "actual_last_working_day": None,
        "clearances": [
            {"item": item, "owner": owner, "description": desc, "done": False, "done_by": None, "done_at": None, "notes": ""}
            for item, owner, desc in DEFAULT_CLEARANCE_ITEMS
        ],
        "fnf": None,
        "status": "initiated",
        "initiated_by": data.admin_id,
        "initiated_at": now_iso,
        "completed_at": None,
    }
    await db.separations.insert_one(record)
    await log_action(db, data.admin_id, "separation.initiate", "separation", record["separation_id"], None, record)
    record.pop("_id", None)
    return {"success": True, "separation": record}


@router.get("/separations")
async def list_separations(status: Optional[str] = None, department: Optional[str] = None, employee_id: Optional[str] = None):
    q = {}
    if status: q["status"] = status
    if department: q["department"] = department
    if employee_id: q["employee_id"] = employee_id
    rows = await db.separations.find(q, {"_id": 0}).sort("initiated_at", -1).to_list(1000)
    return {"separations": rows, "total": len(rows)}


@router.get("/separations/{separation_id}")
async def get_separation(separation_id: str):
    row = await db.separations.find_one({"separation_id": separation_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Separation not found")
    return {"separation": row}


class ClearanceUpdate(BaseModel):
    done: bool
    notes: str = ""
    admin_id: str = "admin"


@router.patch("/separations/{separation_id}/clearance/{item}")
async def update_clearance(separation_id: str, item: str, data: ClearanceUpdate):
    row = await db.separations.find_one({"separation_id": separation_id})
    if not row:
        raise HTTPException(status_code=404, detail="Separation not found")
    if row["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot modify a {row['status']} separation")

    now = datetime.now(timezone.utc).isoformat()
    r = await db.separations.update_one(
        {"separation_id": separation_id, "clearances.item": item},
        {"$set": {
            "clearances.$.done": data.done,
            "clearances.$.done_by": data.admin_id if data.done else None,
            "clearances.$.done_at": now if data.done else None,
            "clearances.$.notes": data.notes,
        }},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Clearance item '{item}' not found in this separation")

    # Advance status if applicable
    fresh = await db.separations.find_one({"separation_id": separation_id})
    all_done = all(c["done"] for c in fresh["clearances"])
    any_done = any(c["done"] for c in fresh["clearances"])
    new_status = fresh["status"]
    if all_done:
        new_status = "cleared"
    elif any_done and fresh["status"] == "initiated":
        new_status = "in_clearance"
    elif not any_done and fresh["status"] in ("in_clearance", "cleared"):
        new_status = "initiated"

    if new_status != fresh["status"]:
        await db.separations.update_one({"separation_id": separation_id}, {"$set": {"status": new_status}})

    await log_action(db, data.admin_id, "separation.clearance.update", "separation", separation_id, {"item": item, "prev_done": None}, {"item": item, "done": data.done})
    return {"success": True, "status": new_status, "all_cleared": all_done}


class FnFCalcRequest(BaseModel):
    gross_dues: float
    deductions: float = 0
    breakdown: Optional[dict] = None  # {salary_pending, unused_leave_encashment, gratuity, notice_recovery, ...}
    admin_id: str = "admin"


@router.post("/separations/{separation_id}/fnf")
async def calculate_fnf(separation_id: str, data: FnFCalcRequest):
    row = await db.separations.find_one({"separation_id": separation_id})
    if not row:
        raise HTTPException(status_code=404, detail="Separation not found")
    if row["status"] not in ("cleared", "in_clearance", "fnf_calculated"):
        raise HTTPException(status_code=400, detail=f"Cannot calculate F&F when separation status is '{row['status']}'")

    now = datetime.now(timezone.utc).isoformat()
    net = round(max(0.0, float(data.gross_dues) - float(data.deductions)), 2)
    fnf = {
        "gross_dues": round(float(data.gross_dues), 2),
        "deductions": round(float(data.deductions), 2),
        "net_payable": net,
        "breakdown": data.breakdown or {},
        "status": "calculated",
        "calculated_at": now,
        "calculated_by": data.admin_id,
        "paid_at": None,
    }
    await db.separations.update_one(
        {"separation_id": separation_id},
        {"$set": {"fnf": fnf, "status": "fnf_calculated"}},
    )
    await log_action(db, data.admin_id, "separation.fnf.calculate", "separation", separation_id, {"fnf": row.get("fnf")}, {"fnf": fnf})
    return {"success": True, "fnf": fnf}


class FnFPayRequest(BaseModel):
    payment_reference: str = ""
    admin_id: str = "admin"


@router.post("/separations/{separation_id}/pay")
async def mark_fnf_paid(separation_id: str, data: FnFPayRequest):
    row = await db.separations.find_one({"separation_id": separation_id})
    if not row:
        raise HTTPException(status_code=404, detail="Separation not found")
    if row["status"] != "fnf_calculated":
        raise HTTPException(status_code=400, detail="F&F must be calculated before payment")

    now = datetime.now(timezone.utc).isoformat()
    await db.separations.update_one(
        {"separation_id": separation_id},
        {"$set": {
            "status": "fnf_paid",
            "fnf.status": "paid",
            "fnf.paid_at": now,
            "fnf.paid_by": data.admin_id,
            "fnf.payment_reference": data.payment_reference,
        }},
    )
    await log_action(db, data.admin_id, "separation.fnf.pay", "separation", separation_id, None, {"payment_reference": data.payment_reference})
    return {"success": True}


class SeparationCompleteRequest(BaseModel):
    actual_last_working_day: Optional[str] = None
    admin_id: str = "admin"


@router.post("/separations/{separation_id}/complete")
async def complete_separation(separation_id: str, data: SeparationCompleteRequest):
    row = await db.separations.find_one({"separation_id": separation_id})
    if not row:
        raise HTTPException(status_code=404, detail="Separation not found")
    if row["status"] not in ("fnf_paid", "cleared", "fnf_calculated"):
        raise HTTPException(status_code=400, detail=f"Cannot complete from status '{row['status']}'")

    now = datetime.now(timezone.utc).isoformat()
    lwd = data.actual_last_working_day or now[:10]

    # 1) Mark employee as separated
    await db.employees.update_one(
        {"employee_id": row["employee_id"]},
        {"$set": {"status": "separated", "separated_at": now, "updated_at": now}},
    )

    # 2) Auto-issue experience letter (reuses Phase D letter builder)
    from routes.careers_phase_d import _build_letter_pdf as build_letter
    emp = await db.employees.find_one({"employee_id": row["employee_id"]})
    letter_id = f"LTR-EXP-{str(uuid.uuid4())[:8].upper()}"
    payload = {"relieving_date": lwd, "separation_id": separation_id}
    try:
        pdf_path = build_letter(letter_id, "experience", emp, payload)
        await db.employee_letters.insert_one({
            "letter_id": letter_id,
            "employee_id": row["employee_id"],
            "kind": "experience",
            "payload": payload,
            "pdf_path": pdf_path,
            "issued_by": data.admin_id,
            "issued_at": now,
        })
    except Exception as e:
        logging.warning(f"[SEPARATION] experience letter generation failed: {e}")
        letter_id = None

    # 3) Update the separation record
    await db.separations.update_one(
        {"separation_id": separation_id},
        {"$set": {
            "status": "completed",
            "actual_last_working_day": lwd,
            "experience_letter_id": letter_id,
            "completed_at": now,
            "completed_by": data.admin_id,
        }},
    )
    await log_action(db, data.admin_id, "separation.complete", "separation", separation_id, row, {"actual_last_working_day": lwd, "experience_letter_id": letter_id})
    return {"success": True, "experience_letter_id": letter_id, "last_working_day": lwd}


@router.post("/separations/{separation_id}/cancel")
async def cancel_separation(separation_id: str, admin_id: str = "admin", reason: str = ""):
    row = await db.separations.find_one({"separation_id": separation_id})
    if not row:
        raise HTTPException(status_code=404, detail="Separation not found")
    if row["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Already {row['status']}")
    now = datetime.now(timezone.utc).isoformat()
    await db.separations.update_one(
        {"separation_id": separation_id},
        {"$set": {"status": "cancelled", "cancelled_at": now, "cancel_reason": reason, "cancelled_by": admin_id}},
    )
    await log_action(db, admin_id, "separation.cancel", "separation", separation_id, row, {"reason": reason})
    return {"success": True}


# =========================================================================
#                       HR ANALYTICS DASHBOARD (§49-50)
# =========================================================================

@router.get("/reports/hr-dashboard")
async def hr_dashboard(from_date: Optional[str] = None, to_date: Optional[str] = None):
    """Aggregate hiring funnel, source ROI, time-to-hire, attrition, headcount.

    Date bounds are inclusive; if omitted, computes from the beginning of the
    current year to now. All numbers are best-effort — the dashboard is read
    optimised, not eventually consistent.
    """
    now = datetime.now(timezone.utc)
    frm = from_date or f"{now.year}-01-01"
    to = to_date or now.date().isoformat()
    to_end = to + "T23:59:59Z"

    date_range = {"$gte": frm, "$lte": to_end}

    # ---------- Recruitment funnel (application status counts) ----------
    funnel_cursor = db.job_applications.aggregate([
        {"$match": {"created_at": date_range}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ])
    funnel = {row["_id"]: row["count"] async for row in funnel_cursor}
    total_apps = sum(funnel.values())

    # ---------- Source ROI (applications + joined per source) ----------
    src_cursor = db.job_applications.aggregate([
        {"$match": {"created_at": date_range}},
        {"$group": {
            "_id": "$recruitment_source",
            "applications": {"$sum": 1},
            "joined": {"$sum": {"$cond": [{"$eq": ["$status", "joined"]}, 1, 0]}},
        }},
    ])
    # Normalise + dedupe: strip/title-case source names so 'website' & ' Website '
    # collapse into one row. Legacy applications with a NULL source count as
    # 'Website' (the default in the apply endpoint).
    source_totals: dict = {}
    async for r in src_cursor:
        raw = (r.get("_id") or "Website")
        key = str(raw).strip().title()
        if not key:
            key = "Website"
        agg = source_totals.setdefault(key, {"applications": 0, "joined": 0})
        agg["applications"] += r["applications"]
        agg["joined"] += r["joined"]
    sources = []
    for key, agg in source_totals.items():
        apps = agg["applications"]
        joined = agg["joined"]
        sources.append({
            "source": key,
            "applications": apps,
            "joined": joined,
            "conversion_pct": round((joined / apps * 100), 2) if apps else 0.0,
        })
    sources.sort(key=lambda x: x["applications"], reverse=True)

    # ---------- Time-to-hire (avg days: application_received → offer_accepted) ----------
    offer_cursor = db.offers.find(
        {"status": {"$in": ["accepted"]}, "responded_at": {"$exists": True}},
        {"application_id": 1, "responded_at": 1, "_id": 0}
    )
    tth_days: List[float] = []
    async for off in offer_cursor:
        app = await db.job_applications.find_one({"application_id": off["application_id"]}, {"created_at": 1, "_id": 0})
        if not app or not app.get("created_at"):
            continue
        try:
            a = datetime.fromisoformat(app["created_at"].replace("Z", "+00:00"))
            b = datetime.fromisoformat(off["responded_at"].replace("Z", "+00:00"))
            if a <= b:
                tth_days.append((b - a).total_seconds() / 86400.0)
        except Exception:
            continue
    avg_tth = round(sum(tth_days) / len(tth_days), 2) if tth_days else 0.0

    # ---------- Attrition & headcount ----------
    active_headcount = await db.employees.count_documents({"status": "active"})
    separated_in_range = await db.separations.count_documents({"status": "completed", "completed_at": date_range})
    attrition_pct = round((separated_in_range / max(1, active_headcount + separated_in_range)) * 100, 2)

    # ---------- Headcount by department ----------
    dept_cursor = db.employees.aggregate([
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
    ])
    departments = []
    async for r in dept_cursor:
        departments.append({"department": r["_id"] or "Unassigned", "count": r["count"]})
    departments.sort(key=lambda x: x["count"], reverse=True)

    # ---------- Active job openings + vacancy status ----------
    open_jobs = await db.job_postings.count_documents({"job_status": "published"})
    total_vacancy = 0
    filled_vacancy = 0
    async for j in db.job_postings.find({"job_status": "published"}, {"vacancy_count": 1, "joined_count": 1, "_id": 0}):
        total_vacancy += j.get("vacancy_count", 0) or 0
        filled_vacancy += j.get("joined_count", 0) or 0

    # ---------- Pending HR actions ----------
    pending = {
        "scorecards": await db.interviews.count_documents({"status": "scheduled"}),
        "offers_awaiting_response": await db.offers.count_documents({"status": {"$in": ["generated", "sent"]}}),
        "leaves_pending": await db.leaves.count_documents({"status": "requested"}),
        "separations_in_progress": await db.separations.count_documents({"status": {"$in": ["initiated", "in_clearance", "cleared", "fnf_calculated", "fnf_paid"]}}),
        "appraisals_pending": await db.performance_appraisals.count_documents({"status": {"$in": ["draft", "self_submitted", "manager_reviewed"]}}),
    }

    return {
        "period": {"from": frm, "to": to},
        "totals": {
            "applications": total_apps,
            "active_employees": active_headcount,
            "open_jobs": open_jobs,
            "total_vacancies": total_vacancy,
            "vacancies_filled": filled_vacancy,
            "vacancies_remaining": max(0, total_vacancy - filled_vacancy),
        },
        "recruitment_funnel": funnel,
        "source_roi": sources,
        "time_to_hire": {"average_days": avg_tth, "sample_size": len(tth_days)},
        "attrition": {"separated_in_range": separated_in_range, "attrition_pct": attrition_pct},
        "headcount_by_department": departments,
        "pending_hr_actions": pending,
    }


# =========================================================================
#                        SYSTEM HEALTH (§80)
# =========================================================================

@router.get("/careers/health")
async def careers_health():
    """Cheap read-only health probe — collection counts + last activity ts."""
    async def _stats(coll):
        total = await coll.count_documents({})
        last = None
        for field in ("created_at", "assigned_at", "issued_at", "ts", "applied_at"):
            row = await coll.find_one({field: {"$exists": True}}, {field: 1, "_id": 0}, sort=[(field, -1)])
            if row:
                last = row.get(field)
                break
        return {"total": total, "last_activity": last}

    return {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "collections": {
            "job_postings": await _stats(db.job_postings),
            "job_applications": await _stats(db.job_applications),
            "test_bank": await _stats(db.test_bank),
            "test_assignments": await _stats(db.test_assignments),
            "interviews": await _stats(db.interviews),
            "offers": await _stats(db.offers),
            "employees": await _stats(db.employees),
            "employee_onboarding": await _stats(db.employee_onboarding),
            "employee_letters": await _stats(db.employee_letters),
            "attendance": await _stats(db.attendance),
            "leaves": await _stats(db.leaves),
            "performance_appraisals": await _stats(db.performance_appraisals),
            "incentive_awards": await _stats(db.incentive_awards),
            "separations": await _stats(db.separations),
            "hr_audit_log": await _stats(db.hr_audit_log),
            "notification_templates": await _stats(db.notification_templates),
        },
    }
