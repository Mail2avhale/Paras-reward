"""
Careers Phase C — Offer Management + PDF Generation + Accept/Decline
Employee Master Skeleton — PR-EMP-##### IDs + auto-create on 'joined'
Spec: §21-26 (hiring type + offer flow), §71 (offer letter PDF), §28 (employee master)

Collections
-----------
offers       : per-application offer record (draft/generated/sent/accepted/declined)
employees    : master employee record (created when candidate accepts + joins)
"""
import io
import os
import logging
import uuid
from datetime import datetime, timezone
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

from utils.id_counters import next_employee_id

router = APIRouter(prefix="/public", tags=["Careers Phase C + Employee"])
db = None

HIRING_TYPES = ["Fresher / Trainee", "Internship", "Direct Hire", "Probation", "Contract"]
OFFERS_DIR = "/app/backend/uploads/offers"
os.makedirs(OFFERS_DIR, exist_ok=True)


def set_db(database):
    global db
    db = database


# ==================== Offer Management ====================

class OfferRequest(BaseModel):
    application_id: str
    hiring_type: str
    designation: str
    department: str
    work_location: str = "Chatrapati Sambhaji Nagar"
    joining_date: str  # ISO date
    salary_ctc: float = Field(..., ge=0)
    salary_breakdown: Optional[dict] = None   # {basic, hra, incentive, deductions, ...}
    probation_months: int = 0
    reports_to: Optional[str] = None
    additional_notes: str = ""
    admin_id: str = "admin"


def _fmt_inr(amount: float) -> str:
    try:
        return f"₹ {float(amount):,.2f}"
    except Exception:
        return f"₹ {amount}"


def _build_offer_pdf(*, offer: dict, application: dict) -> str:
    """Render the offer letter PDF to disk and return the file path."""
    fname = f"{offer['offer_id']}.pdf"
    fpath = os.path.join(OFFERS_DIR, fname)

    doc = SimpleDocTemplate(
        fpath, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm,
        title=f"Offer Letter — {application.get('name')}",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], alignment=TA_CENTER, fontSize=18, spaceAfter=8)
    subtitle = ParagraphStyle("sub", parent=styles["Normal"], alignment=TA_CENTER, fontSize=9, textColor=colors.HexColor("#6b7280"), spaceAfter=16)
    h = ParagraphStyle("h", parent=styles["Heading3"], textColor=colors.HexColor("#111827"), spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("body", parent=styles["Normal"], alignment=TA_LEFT, fontSize=10.5, leading=14)

    story = []
    story.append(Paragraph("PARAS REWARD TECHNOLOGIES PRIVATE LIMITED", title_style))
    story.append(Paragraph("B-18, Bizz Tower, Chatrapati Sambhaji Nagar, Maharashtra 431006 &nbsp;•&nbsp; www.parasreward.com", subtitle))
    story.append(Paragraph(f"<b>Offer Letter</b> &nbsp; ({offer['offer_id']})", h))
    story.append(Spacer(1, 6))

    today = datetime.now(timezone.utc).strftime("%d %B %Y")
    story.append(Paragraph(f"<b>Date:</b> {today}", body))
    story.append(Paragraph(f"<b>To:</b> {application.get('name', '')}", body))
    story.append(Paragraph(f"<b>Email:</b> {application.get('email', '')} &nbsp;&nbsp;<b>Phone:</b> {application.get('phone', '')}", body))
    story.append(Spacer(1, 8))
    story.append(Paragraph(f"Dear {application.get('name', '').split()[0] if application.get('name') else 'Candidate'},", body))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"We are pleased to offer you the position of <b>{offer['designation']}</b> in the "
        f"<b>{offer['department']}</b> department at <b>Paras Reward Technologies Pvt. Ltd.</b>, "
        f"under the hiring type <b>{offer['hiring_type']}</b>. Your date of joining will be "
        f"<b>{offer['joining_date']}</b> at our <b>{offer['work_location']}</b> office.",
        body,
    ))

    # Compensation table
    story.append(Paragraph("Compensation Details", h))
    rows = [["Component", "Amount"]]
    if offer.get("salary_breakdown"):
        for k, v in offer["salary_breakdown"].items():
            rows.append([k.replace("_", " ").title(), _fmt_inr(v)])
    rows.append(["Annual CTC", _fmt_inr(offer["salary_ctc"])])
    tbl = Table(rows, colWidths=[10 * cm, 6 * cm])
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
    story.append(tbl)

    if offer.get("probation_months", 0) > 0:
        story.append(Paragraph("Probation & Confirmation", h))
        story.append(Paragraph(
            f"You will be on probation for the first <b>{offer['probation_months']} months</b> "
            "from the date of joining. Confirmation will be subject to satisfactory performance "
            "evaluation as per company policy.",
            body,
        ))

    story.append(Paragraph("Terms & Conditions", h))
    for line in [
        "This offer is contingent upon satisfactory verification of the documents submitted along with your application.",
        "You are expected to maintain confidentiality of all company information both during and after your employment.",
        "This letter supersedes any prior communication regarding your employment terms.",
        "Kindly indicate your acceptance by clicking Accept in the applicant portal or by replying to this letter within 7 days.",
    ]:
        story.append(Paragraph(f"• {line}", body))

    if offer.get("additional_notes"):
        story.append(Paragraph("Additional Notes", h))
        story.append(Paragraph(offer["additional_notes"], body))

    story.append(Spacer(1, 24))
    story.append(Paragraph("Warm regards,", body))
    story.append(Spacer(1, 20))
    story.append(Paragraph("<b>HR Department</b><br/>Paras Reward Technologies Private Limited", body))

    doc.build(story)
    return fpath


@router.post("/offers/generate")
async def generate_offer(data: OfferRequest):
    """Admin: generate an offer + PDF letter, move application to offer_generated."""
    try:
        if data.hiring_type not in HIRING_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid hiring_type. Use one of: {HIRING_TYPES}")
        app = await db.job_applications.find_one({"application_id": data.application_id})
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

        offer_id = f"OFR-{str(uuid.uuid4())[:10].upper()}"
        token = str(uuid.uuid4())  # candidate accept/decline token
        now = datetime.now(timezone.utc).isoformat()
        offer = {
            "offer_id": offer_id,
            "token": token,
            "application_id": data.application_id,
            "candidate_name": app.get("name"),
            "candidate_email": app.get("email"),
            "job_id": app.get("job_id"),
            "job_title": app.get("job_title"),
            "hiring_type": data.hiring_type,
            "designation": data.designation,
            "department": data.department,
            "work_location": data.work_location,
            "joining_date": data.joining_date,
            "salary_ctc": float(data.salary_ctc),
            "salary_breakdown": data.salary_breakdown or {},
            "probation_months": int(data.probation_months),
            "reports_to": data.reports_to,
            "additional_notes": data.additional_notes,
            "status": "generated",  # generated | sent | accepted | declined | withdrawn
            "created_by": data.admin_id,
            "created_at": now,
            "updated_at": now,
        }

        # PDF
        pdf_path = _build_offer_pdf(offer=offer, application=app)
        offer["letter_pdf_path"] = pdf_path

        await db.offers.insert_one(offer)
        await _advance_status(data.application_id, "offer_generated", data.admin_id, f"Offer {offer_id} generated")

        return {"success": True, "offer_id": offer_id, "token": token, "pdf_url": f"/careers/offers/{offer_id}/pdf", "accept_url": f"/careers/offers/respond/{token}"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[OFFERS] generate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/offers/{offer_id}/send")
async def send_offer(offer_id: str, request: Request):
    """Admin: mark offer as sent (email delivery deferred to Phase G)."""
    data = await request.json() if request.headers.get("content-length") else {}
    admin_id = data.get("admin_id", "admin") if isinstance(data, dict) else "admin"
    offer = await db.offers.find_one({"offer_id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    now = datetime.now(timezone.utc).isoformat()
    await db.offers.update_one({"offer_id": offer_id}, {"$set": {"status": "sent", "sent_at": now, "updated_at": now}})
    await _advance_status(offer["application_id"], "offer_sent", admin_id, f"Offer {offer_id} sent")
    return {"success": True}


@router.get("/offers/{offer_id}/pdf")
async def get_offer_pdf(offer_id: str):
    offer = await db.offers.find_one({"offer_id": offer_id})
    if not offer or not offer.get("letter_pdf_path"):
        raise HTTPException(status_code=404, detail="Offer PDF not found")
    if not os.path.exists(offer["letter_pdf_path"]):
        # Try to rebuild lazily
        app = await db.job_applications.find_one({"application_id": offer["application_id"]})
        if not app:
            raise HTTPException(status_code=404, detail="Application missing")
        _build_offer_pdf(offer=offer, application=app)
    return FileResponse(offer["letter_pdf_path"], filename=f"{offer_id}.pdf", media_type="application/pdf")


@router.get("/offers/respond/{token}")
async def get_offer_by_token(token: str):
    """Candidate-facing: fetch offer summary using the accept/decline token."""
    offer = await db.offers.find_one({"token": token}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Invalid link")
    return {"offer": offer, "pdf_url": f"/api/public/careers/offers/{offer['offer_id']}/pdf"}


class OfferResponse(BaseModel):
    token: str
    action: str  # accept | decline
    reason: str = ""


@router.post("/offers/respond")
async def respond_offer(data: OfferResponse):
    """Candidate: accept or decline the offer via the token."""
    try:
        offer = await db.offers.find_one({"token": data.token})
        if not offer:
            raise HTTPException(status_code=404, detail="Invalid link")
        if offer["status"] in ("accepted", "declined", "withdrawn"):
            raise HTTPException(status_code=400, detail=f"Offer already {offer['status']}")
        action = data.action.strip().lower()
        if action not in ("accept", "decline"):
            raise HTTPException(status_code=400, detail="action must be 'accept' or 'decline'")

        new_status = "accepted" if action == "accept" else "declined"
        app_status = "offer_accepted" if action == "accept" else "offer_declined"
        now = datetime.now(timezone.utc).isoformat()

        await db.offers.update_one(
            {"token": data.token},
            {"$set": {"status": new_status, "responded_at": now, "response_reason": data.reason, "updated_at": now}},
        )
        await _advance_status(offer["application_id"], app_status, offer.get("candidate_email", "candidate"), f"Candidate {action}ed offer{': ' + data.reason if data.reason else ''}")

        # If accepted, auto-move to joining_scheduled on the joining_date
        if action == "accept":
            await _advance_status(offer["application_id"], "joining_scheduled", "system", f"Joining scheduled for {offer['joining_date']}")

        return {"success": True, "status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[OFFERS] respond error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/offers")
async def list_offers(application_id: Optional[str] = None):
    q = {"application_id": application_id} if application_id else {}
    rows = await db.offers.find(q, {"_id": 0, "token": 0}).sort("created_at", -1).to_list(500)
    return {"offers": rows, "total": len(rows)}


# ==================== Employee Master (Phase D skeleton) ====================

class ConvertToEmployeeRequest(BaseModel):
    application_id: str
    reports_to: Optional[str] = None
    admin_id: str = "admin"


@router.post("/employees/from-application")
async def convert_to_employee(data: ConvertToEmployeeRequest):
    """Admin: promote a joined applicant to an Employee record.

    Idempotent — if an employee already exists for this application, returns
    the existing record instead of creating a duplicate.
    """
    try:
        app = await db.job_applications.find_one({"application_id": data.application_id})
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

        existing = await db.employees.find_one({"source_application_id": data.application_id}, {"_id": 0})
        if existing:
            return {"success": True, "already_exists": True, "employee": existing}

        # Prefer offer details for department/designation/hiring_type
        offer = await db.offers.find_one({"application_id": data.application_id, "status": "accepted"}) \
                 or await db.offers.find_one({"application_id": data.application_id})
        employee_id = await next_employee_id(db)
        now = datetime.now(timezone.utc).isoformat()

        record = {
            "employee_id": employee_id,
            "source_application_id": data.application_id,
            "name": app.get("name"),
            "email": app.get("email"),
            "phone": app.get("phone"),
            "department": (offer or {}).get("department") or "General",
            "designation": (offer or {}).get("designation") or "Employee",
            "hiring_type": (offer or {}).get("hiring_type") or "Direct Hire",
            "work_location": (offer or {}).get("work_location") or "Chatrapati Sambhaji Nagar",
            "joining_date": (offer or {}).get("joining_date") or now,
            "probation_months": (offer or {}).get("probation_months", 0),
            "reports_to": data.reports_to,
            "status": "active",   # active | on_leave | terminated | resigned
            "created_by": data.admin_id,
            "created_at": now,
            "updated_at": now,
        }
        await db.employees.insert_one(record)

        # Advance application status to `joined` if not already there
        if app.get("status") != "joined":
            await _advance_status(data.application_id, "joined", data.admin_id, f"Converted to employee {employee_id}")

        record.pop("_id", None)
        return {"success": True, "already_exists": False, "employee": record}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[EMPLOYEES] convert error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/employees")
async def list_employees(status: Optional[str] = None, department: Optional[str] = None):
    q = {}
    if status:
        q["status"] = status
    if department:
        q["department"] = department
    rows = await db.employees.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return {"employees": rows, "total": len(rows)}


@router.get("/employees/{employee_id}")
async def get_employee(employee_id: str):
    row = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"employee": row}


# ==================== Internal helper ====================

async def _advance_status(application_id: str, to_status: str, by: str, comment: str = ""):
    app = await db.job_applications.find_one({"application_id": application_id})
    if not app:
        return
    prev = app.get("status")
    if prev == to_status:
        return
    now = datetime.now(timezone.utc).isoformat()
    await db.job_applications.update_one(
        {"application_id": application_id},
        {
            "$set": {"status": to_status, "updated_at": now},
            "$push": {"status_history": {"from": prev, "to": to_status, "by": by, "at": now, "comment": comment}},
        },
    )
