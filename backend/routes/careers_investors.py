"""
CAREERS & INVESTORS BACKEND
=============================
1. Career: Dynamic job postings (Admin CRUD), Application with resume upload
2. Investors: Real metrics from DB, Password-protected documents
Both pages are PUBLIC (no auth required for viewing)
"""

import logging
import uuid
import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/public", tags=["Public Pages"])

db = None

COMPANY = {
    "name": "Paras Reward Technologies Private Limited",
    "address": "B-18, Bizz Tower, Chatrapati Sambhaji Nagar, Maharashtra 431006",
    "website": "www.parasreward.com",
    "email": "info@parasreward.com",
    "founded": "2025"
}

JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Remote", "Hybrid"]
JOB_DEPARTMENTS = [
    "Technology", "Marketing", "Sales", "Operations",
    "Finance", "Human Resources", "Customer Support",
    "Business Development", "Design", "Management"
]


def set_db(database):
    global db
    db = database


# ==================== CAREER: JOB POSTINGS ====================

class JobPostingRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    department: str
    location: str = "Chatrapati Sambhaji Nagar, Maharashtra"
    job_type: str = "Full-time"
    experience_min: int = 0
    experience_max: int = 0
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    show_salary: bool = False
    description: str = Field(..., min_length=10)
    requirements: str = ""
    responsibilities: str = ""
    benefits: str = ""
    is_active: bool = True
    admin_id: str = ""


@router.post("/careers/jobs/create")
async def create_job(data: JobPostingRequest):
    try:
        now = datetime.now(timezone.utc).isoformat()
        job_id = f"JOB-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

        job = {
            "job_id": job_id,
            "title": data.title,
            "department": data.department,
            "location": data.location,
            "job_type": data.job_type,
            "experience_min": data.experience_min,
            "experience_max": data.experience_max,
            "salary_min": data.salary_min,
            "salary_max": data.salary_max,
            "show_salary": data.show_salary,
            "description": data.description,
            "requirements": data.requirements,
            "responsibilities": data.responsibilities,
            "benefits": data.benefits,
            "is_active": data.is_active,
            "application_count": 0,
            "created_by": data.admin_id,
            "created_at": now,
            "updated_at": now
        }

        await db.job_postings.insert_one(job)
        job.pop("_id", None)
        return {"success": True, "message": "Job posted", "job": job}
    except Exception as e:
        logging.error(f"[CAREERS] Create job error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/careers/jobs/{job_id}")
async def update_job(job_id: str, request: Request):
    try:
        data = await request.json()
        update = {k: v for k, v in data.items() if k not in ["job_id", "_id", "created_at", "created_by"]}
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = await db.job_postings.update_one({"job_id": job_id}, {"$set": update})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"success": True, "message": "Job updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/careers/jobs/{job_id}")
async def delete_job(job_id: str):
    try:
        result = await db.job_postings.delete_one({"job_id": job_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"success": True, "message": "Job deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/careers/jobs")
async def list_jobs(active_only: bool = True):
    """Public: Get all active job postings."""
    try:
        query = {"is_active": True} if active_only else {}
        jobs = await db.job_postings.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        return {"jobs": jobs, "total": len(jobs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/careers/jobs/{job_id}")
async def get_job_detail(job_id: str):
    try:
        job = await db.job_postings.find_one({"job_id": job_id}, {"_id": 0})
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"job": job}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/careers/meta")
async def get_career_meta():
    return {"departments": JOB_DEPARTMENTS, "job_types": JOB_TYPES, "company": COMPANY}


# ==================== CAREER: APPLICATIONS ====================

@router.post("/careers/apply")
async def apply_for_job(
    job_id: str = Form(...),
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    experience_years: int = Form(0),
    cover_letter: str = Form(""),
    linkedin: str = Form(""),
    resume: UploadFile = File(...),
    # Phase 3 extended (Feb 27 2026) — optional supporting documents
    # and structured education / work history. All fields are optional
    # so existing simple applications keep working unchanged.
    aadhaar: Optional[UploadFile] = File(None),
    pan: Optional[UploadFile] = File(None),
    marksheet: Optional[UploadFile] = File(None),
    education_json: str = Form("[]"),        # JSON list of {degree, institution, year, marks}
    work_history_json: str = Form("[]"),     # JSON list of {company, role, from, to, description}
):
    """Public: Apply for a job with resume + optional supporting docs."""
    try:
        job = await db.job_postings.find_one({"job_id": job_id, "is_active": True})
        if not job:
            raise HTTPException(status_code=404, detail="Job not found or no longer active")

        # Check duplicate
        existing = await db.job_applications.find_one({"job_id": job_id, "email": email})
        if existing:
            raise HTTPException(status_code=400, detail="You have already applied for this position")

        # Save resume
        contents = await resume.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Resume must be under 5MB")

        upload_dir = "/app/backend/uploads/resumes"
        os.makedirs(upload_dir, exist_ok=True)
        ext = resume.filename.split(".")[-1] if "." in resume.filename else "pdf"
        app_id = f"APP-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6].upper()}"
        filename = f"{app_id}.{ext}"
        filepath = os.path.join(upload_dir, filename)

        with open(filepath, "wb") as f:
            f.write(contents)

        # Supporting-doc helper — each doc is optional, capped at 5 MB.
        async def _save_supporting(up: Optional[UploadFile], kind: str) -> Optional[str]:
            if up is None or not up.filename:
                return None
            data = await up.read()
            if len(data) > 5 * 1024 * 1024:
                raise HTTPException(status_code=400, detail=f"{kind} must be under 5MB")
            docs_dir = "/app/backend/uploads/documents"
            os.makedirs(docs_dir, exist_ok=True)
            ext2 = up.filename.split(".")[-1] if "." in up.filename else "pdf"
            fpath = os.path.join(docs_dir, f"{app_id}-{kind}.{ext2}")
            with open(fpath, "wb") as f:
                f.write(data)
            return fpath

        aadhaar_path = await _save_supporting(aadhaar, "aadhaar")
        pan_path = await _save_supporting(pan, "pan")
        marksheet_path = await _save_supporting(marksheet, "marksheet")

        # Parse structured lists — accept malformed JSON gracefully.
        import json as _json
        try:
            education = _json.loads(education_json) if education_json else []
            if not isinstance(education, list):
                education = []
        except Exception:
            education = []
        try:
            work_history = _json.loads(work_history_json) if work_history_json else []
            if not isinstance(work_history, list):
                work_history = []
        except Exception:
            work_history = []

        now = datetime.now(timezone.utc).isoformat()
        application = {
            "application_id": app_id,
            "job_id": job_id,
            "job_title": job.get("title", ""),
            "name": name,
            "email": email,
            "phone": phone,
            "experience_years": experience_years,
            "cover_letter": cover_letter,
            "linkedin": linkedin,
            "resume_path": filepath,
            "resume_filename": resume.filename,
            # Phase 3 extended — supporting docs + structured history
            "aadhaar_path": aadhaar_path,
            "pan_path": pan_path,
            "marksheet_path": marksheet_path,
            "education": education,
            "work_history": work_history,
            "status": "new",  # new, reviewed, shortlisted, interview, hired, rejected
            "created_at": now
        }

        await db.job_applications.insert_one(application)
        await db.job_postings.update_one({"job_id": job_id}, {"$inc": {"application_count": 1}})

        return {"success": True, "message": "Application submitted successfully!", "application_id": app_id}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[CAREERS] Apply error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/careers/applications")
async def list_applications(job_id: Optional[str] = None, status: Optional[str] = None):
    """Admin: Get all applications."""
    try:
        query = {}
        if job_id:
            query["job_id"] = job_id
        if status:
            query["status"] = status
        
        apps = await db.job_applications.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        
        stats = {
            "total": len(apps),
            "new": sum(1 for a in apps if a.get("status") == "new"),
            "reviewed": sum(1 for a in apps if a.get("status") == "reviewed"),
            "shortlisted": sum(1 for a in apps if a.get("status") == "shortlisted"),
            "interview": sum(1 for a in apps if a.get("status") == "interview"),
            "hired": sum(1 for a in apps if a.get("status") == "hired"),
            "rejected": sum(1 for a in apps if a.get("status") == "rejected")
        }
        
        return {"applications": apps, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/careers/applications/{app_id}/status")
async def update_application_status(app_id: str, request: Request):
    try:
        data = await request.json()
        new_status = data.get("status")
        valid = ["new", "reviewed", "shortlisted", "interview", "hired", "rejected"]
        if new_status not in valid:
            raise HTTPException(status_code=400, detail=f"Invalid status. Use: {valid}")

        result = await db.job_applications.update_one(
            {"application_id": app_id},
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")
        return {"success": True, "message": f"Status updated to {new_status}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/careers/applications/{app_id}/resume")
async def download_resume(app_id: str):
    try:
        app = await db.job_applications.find_one({"application_id": app_id})
        if not app or not app.get("resume_path"):
            raise HTTPException(status_code=404, detail="Resume not found")
        
        if os.path.exists(app["resume_path"]):
            return FileResponse(
                app["resume_path"],
                filename=app.get("resume_filename", f"{app_id}.pdf"),
                media_type="application/pdf"
            )
        raise HTTPException(status_code=404, detail="Resume file not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Phase 3 extended document downloads ====================

_SUPPORTING_DOC_KINDS = {"aadhaar", "pan", "marksheet"}


@router.get("/careers/applications/{app_id}/document/{kind}")
async def download_supporting_document(app_id: str, kind: str):
    """Admin: download an Aadhaar / PAN / Marksheet file uploaded during application.

    Kind must be one of ``aadhaar``, ``pan``, ``marksheet``. Files are stored on
    disk during ``apply_for_job`` (see ``_save_supporting``) — this endpoint
    streams them back with an inferred media type from the extension.
    """
    if kind not in _SUPPORTING_DOC_KINDS:
        raise HTTPException(status_code=400, detail=f"Invalid document kind. Use one of: {sorted(_SUPPORTING_DOC_KINDS)}")

    try:
        app = await db.job_applications.find_one({"application_id": app_id})
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

        path = app.get(f"{kind}_path")
        if not path or not os.path.exists(path):
            raise HTTPException(status_code=404, detail=f"{kind.title()} document not uploaded for this application")

        ext = os.path.splitext(path)[1].lower().lstrip(".") or "pdf"
        media = {
            "pdf": "application/pdf",
            "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "webp": "image/webp",
        }.get(ext, "application/octet-stream")

        return FileResponse(path, filename=f"{app_id}-{kind}.{ext}", media_type=media)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CAREER: APPLICATION STATUS CHECK (Public) ====================

@router.get("/careers/check-status")
async def check_application_status(email: str):
    """Public: Applicant can check their application status by email."""
    try:
        if not email:
            raise HTTPException(status_code=400, detail="Email required")
        
        apps = await db.job_applications.find(
            {"email": email.lower().strip()},
            {"_id": 0, "application_id": 1, "job_title": 1, "status": 1, "created_at": 1, "name": 1}
        ).sort("created_at", -1).to_list(20)
        
        if not apps:
            return {"found": False, "message": "No applications found for this email", "applications": []}
        
        return {"found": True, "applications": apps}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CAREER: ADMIN NOTES ====================

@router.post("/careers/applications/{app_id}/note")
async def add_application_note(app_id: str, request: Request):
    """Admin: Add note/feedback to an application."""
    try:
        data = await request.json()
        note = data.get("note", "")
        admin_id = data.get("admin_id", "admin")
        
        app = await db.job_applications.find_one({"application_id": app_id})
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")
        
        now = datetime.now(timezone.utc).isoformat()
        note_entry = {
            "note": note,
            "admin_id": admin_id,
            "created_at": now
        }
        
        await db.job_applications.update_one(
            {"application_id": app_id},
            {"$push": {"admin_notes": note_entry}, "$set": {"updated_at": now}}
        )
        return {"success": True, "message": "Note added"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== INVESTORS: FAQ ====================

@router.get("/investors/faq")
async def get_investor_faq():
    """Public: Get investor FAQ."""
    try:
        faqs = await db.investor_faqs.find({}, {"_id": 0}).sort("order", 1).to_list(50)
        if not faqs:
            faqs = [
                {"question": "What is Paras Reward?", "answer": "Paras Reward is India's first PRC-powered digital reward ecosystem with subscription-based mining, integrated bill payments, and a community-driven platform.", "order": 1},
                {"question": "What is PRC?", "answer": "PRC (Paras Reward Coin) is our digital reward token. Users earn PRC through mining, referrals, and platform activities. PRC can be used for bill payments, recharges, and marketplace purchases.", "order": 2},
                {"question": "What is the business model?", "answer": "Revenue comes from monthly subscriptions (Elite/VIP plans), transaction fees on BBPS/bill payments, PRC marketplace commissions, and platform service charges.", "order": 3},
                {"question": "What stage is the company at?", "answer": "We are in the growth phase with an established product, active user base, and multiple revenue streams. We are looking for strategic investors to scale operations.", "order": 4},
                {"question": "What is the minimum investment?", "answer": "We welcome investors across all ranges. Please connect with our team through the contact form to discuss opportunities that match your investment goals.", "order": 5},
                {"question": "Is the platform compliant?", "answer": "Yes. We are fully compliant with Indian regulations including GST, PF, ESI, TDS, and operate as a registered Private Limited company in Maharashtra.", "order": 6}
            ]
            for faq in faqs:
                await db.investor_faqs.insert_one(faq)
        return {"faqs": faqs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/investors/faq")
async def add_or_update_faq(request: Request):
    """Admin: Add/update FAQ."""
    try:
        data = await request.json()
        question = data.get("question")
        answer = data.get("answer")
        order = data.get("order", 99)
        faq_id = data.get("faq_id")
        
        if faq_id:
            await db.investor_faqs.update_one(
                {"faq_id": faq_id},
                {"$set": {"question": question, "answer": answer, "order": order}}
            )
        else:
            await db.investor_faqs.insert_one({
                "faq_id": f"FAQ-{str(uuid.uuid4())[:6]}",
                "question": question,
                "answer": answer,
                "order": order
            })
        return {"success": True, "message": "FAQ saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/investors/faq/{faq_id}")
async def delete_faq(faq_id: str):
    """Admin: Delete FAQ."""
    try:
        result = await db.investor_faqs.delete_one({"faq_id": faq_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="FAQ not found")
        return {"success": True, "message": "FAQ deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== INVESTORS: TEAM ====================

@router.get("/investors/team")
async def get_team():
    """Public: Get leadership team."""
    try:
        team = await db.investor_team.find({}, {"_id": 0}).sort("order", 1).to_list(20)
        if not team:
            team = [
                {
                    "member_id": "TM-001",
                    "name": "Founder",
                    "role": "CEO & Founder",
                    "bio": "Visionary entrepreneur building India's first PRC-powered digital reward ecosystem.",
                    "photo_url": None,
                    "linkedin": "",
                    "order": 1
                }
            ]
            for t in team:
                await db.investor_team.insert_one(t)
        return {"team": team}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/investors/team")
async def add_or_update_team_member(request: Request):
    """Admin: Add/update team member."""
    try:
        data = await request.json()
        member_id = data.get("member_id")
        
        entry = {
            "name": data.get("name", ""),
            "role": data.get("role", ""),
            "bio": data.get("bio", ""),
            "photo_url": data.get("photo_url"),
            "linkedin": data.get("linkedin", ""),
            "order": data.get("order", 99),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if member_id:
            await db.investor_team.update_one({"member_id": member_id}, {"$set": entry})
        else:
            entry["member_id"] = f"TM-{str(uuid.uuid4())[:6]}"
            await db.investor_team.insert_one(entry)
        
        return {"success": True, "message": "Team member saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/investors/team/{member_id}")
async def delete_team_member(member_id: str):
    """Admin: Delete team member."""
    try:
        result = await db.investor_team.delete_one({"member_id": member_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Team member not found")
        return {"success": True, "message": "Team member deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== INVESTORS: PRESS/NEWS ====================

@router.get("/investors/press")
async def get_press():
    """Public: Get press releases and news."""
    try:
        press = await db.investor_press.find({}, {"_id": 0}).sort("date", -1).to_list(20)
        return {"press": press}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/investors/press")
async def add_press(request: Request):
    """Admin: Add press release."""
    try:
        data = await request.json()
        entry = {
            "press_id": f"PR-{str(uuid.uuid4())[:6]}",
            "title": data.get("title", ""),
            "summary": data.get("summary", ""),
            "url": data.get("url", ""),
            "source": data.get("source", ""),
            "date": data.get("date", datetime.now(timezone.utc).isoformat()[:10]),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.investor_press.insert_one(entry)
        return {"success": True, "message": "Press release added"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/investors/press/{press_id}")
async def delete_press(press_id: str):
    """Admin: Delete press release."""
    try:
        result = await db.investor_press.delete_one({"press_id": press_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Press release not found")
        return {"success": True, "message": "Press release deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ==================== INVESTORS: REAL METRICS ====================

@router.get("/investors/metrics")
async def get_investor_metrics():
    """Public: Get real platform metrics for investors. Uses cached/estimated counts to avoid timeouts on large prod collections."""
    from datetime import timedelta

    # Defaults for safety — any individual failure shouldn't break the whole page
    total_users = 0
    active_subs = 0
    monthly_active = 0
    total_transactions = 0
    prc_circulation = 0
    this_month_users = 0
    last_month_users = 0

    try:
        total_users = await db.users.count_documents({})
    except Exception as e:
        logging.warning(f"[INVESTORS] total_users failed: {e}")

    try:
        active_subs = await db.users.count_documents({
            "subscription_plan": {"$in": ["elite", "vip", "startup", "growth", "pro"]}
        })
    except Exception as e:
        logging.warning(f"[INVESTORS] active_subs failed: {e}")

    try:
        thirty_days = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        monthly_active = await db.users.count_documents({"last_login": {"$gte": thirty_days}})
    except Exception as e:
        logging.warning(f"[INVESTORS] monthly_active failed: {e}")

    # Use estimated_document_count to avoid COLLSCAN on large transactions collection
    try:
        total_transactions = await db.transactions.estimated_document_count()
    except Exception as e:
        logging.warning(f"[INVESTORS] total_transactions failed: {e}")

    try:
        circ = await db.users.aggregate([
            {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$prc_balance", 0]}}}}
        ]).to_list(1)
        prc_circulation = circ[0]["total"] if circ else 0
    except Exception as e:
        logging.warning(f"[INVESTORS] prc_circulation failed: {e}")

    try:
        this_month_start = datetime.now(timezone.utc).replace(day=1).isoformat()
        last_month_start = (datetime.now(timezone.utc).replace(day=1) - timedelta(days=1)).replace(day=1).isoformat()
        this_month_users = await db.users.count_documents({"created_at": {"$gte": this_month_start}})
        last_month_users = await db.users.count_documents({
            "created_at": {"$gte": last_month_start, "$lt": this_month_start}
        })
    except Exception as e:
        logging.warning(f"[INVESTORS] growth rate failed: {e}")

    growth_rate = round(((this_month_users - last_month_users) / max(last_month_users, 1)) * 100, 1) if last_month_users > 0 else 0

    return {
        "metrics": {
            "total_users": total_users,
            "active_subscribers": active_subs,
            "monthly_active_users": monthly_active,
            "total_transactions": total_transactions,
            "prc_in_circulation": round(prc_circulation, 2),
            "user_growth_rate": growth_rate,
            "this_month_signups": this_month_users
        },
        "company": COMPANY
    }


# ==================== INVESTORS: DOCUMENTS ====================

@router.post("/investors/documents/upload")
async def upload_investor_document(
    title: str = Form(...),
    doc_type: str = Form(...),
    password: str = Form(""),
    admin_id: str = Form(""),
    file: UploadFile = File(...)
):
    """Admin: Upload investor document (pitch deck, financials, etc.)."""
    try:
        contents = await file.read()
        if len(contents) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File must be under 20MB")

        upload_dir = "/app/backend/uploads/investor_docs"
        os.makedirs(upload_dir, exist_ok=True)
        doc_id = f"DOC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
        ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
        filename = f"{doc_id}.{ext}"
        filepath = os.path.join(upload_dir, filename)

        with open(filepath, "wb") as f:
            f.write(contents)

        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "doc_id": doc_id,
            "title": title,
            "doc_type": doc_type,
            "filename": file.filename,
            "filepath": filepath,
            "password": password,
            "is_protected": bool(password),
            "download_count": 0,
            "uploaded_by": admin_id,
            "created_at": now
        }

        await db.investor_documents.insert_one(doc)
        return {"success": True, "message": "Document uploaded", "doc_id": doc_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/investors/documents")
async def list_investor_documents():
    """Public: List available investor documents (without file paths)."""
    try:
        docs = await db.investor_documents.find(
            {}, {"_id": 0, "filepath": 0, "password": 0}
        ).sort("created_at", -1).to_list(50)
        return {"documents": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/investors/documents/{doc_id}/download")
async def download_investor_document(doc_id: str, request: Request):
    """Public: Download document (password required if protected)."""
    try:
        doc = await db.investor_documents.find_one({"doc_id": doc_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        if doc.get("is_protected") and doc.get("password"):
            data = await request.json()
            if data.get("password") != doc["password"]:
                raise HTTPException(status_code=403, detail="Incorrect password")

        await db.investor_documents.update_one({"doc_id": doc_id}, {"$inc": {"download_count": 1}})

        if os.path.exists(doc["filepath"]):
            return FileResponse(doc["filepath"], filename=doc.get("filename", f"{doc_id}.pdf"))
        raise HTTPException(status_code=404, detail="File not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/investors/documents/{doc_id}")
async def delete_investor_document(doc_id: str):
    try:
        doc = await db.investor_documents.find_one({"doc_id": doc_id})
        if doc and doc.get("filepath") and os.path.exists(doc["filepath"]):
            os.remove(doc["filepath"])
        await db.investor_documents.delete_one({"doc_id": doc_id})
        return {"success": True, "message": "Document deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== INVESTOR CONTACT ====================

@router.post("/investors/contact")
async def investor_contact(request: Request):
    """Public: Investor inquiry form."""
    try:
        data = await request.json()
        now = datetime.now(timezone.utc).isoformat()

        inquiry = {
            "inquiry_id": f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:4]}",
            "name": data.get("name", ""),
            "email": data.get("email", ""),
            "phone": data.get("phone", ""),
            "organization": data.get("organization", ""),
            "investment_range": data.get("investment_range", ""),
            "message": data.get("message", ""),
            "status": "new",
            "created_at": now
        }

        await db.investor_inquiries.insert_one(inquiry)
        return {"success": True, "message": "Thank you for your interest! We will get back to you soon."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/investors/inquiries")
async def list_investor_inquiries():
    """Admin: List all investor inquiries."""
    try:
        inquiries = await db.investor_inquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
        return {"inquiries": inquiries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/investors/inquiries/{inquiry_id}")
async def update_inquiry_status(inquiry_id: str, request: Request):
    """Admin: Update investor inquiry status."""
    try:
        data = await request.json()
        valid_statuses = ["new", "contacted", "in_discussion", "closed", "rejected"]
        new_status = data.get("status")
        if new_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Use: {valid_statuses}")
        note = data.get("note", "")

        update = {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}
        if note:
            update["admin_note"] = note

        result = await db.investor_inquiries.update_one({"inquiry_id": inquiry_id}, {"$set": update})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Inquiry not found")
        return {"success": True, "message": f"Status updated to {new_status}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/investors/inquiries/{inquiry_id}")
async def delete_inquiry(inquiry_id: str):
    """Admin: Delete investor inquiry."""
    try:
        result = await db.investor_inquiries.delete_one({"inquiry_id": inquiry_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Inquiry not found")
        return {"success": True, "message": "Inquiry deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
