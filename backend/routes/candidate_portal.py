"""
Public Candidate Portal — unified read-only view for a candidate.

One URL, one endpoint. The candidate visits ``/candidate/{application_id}``
in the frontend which hydrates from this endpoint. Bundles:

  * Application snapshot + status + status history
  * Timeline milestones (Applied / Test / Interview / Offer / Joined)
  * Active test assignments (candidate URL, deadline, attempt result)
  * Interview schedules (upcoming + past, with meet link)
  * Offer(s) with candidate accept/decline token
  * Employee record + onboarding progress + issued letters (post-joining)

Auth: this is intentionally public — application_id acts as the shared
secret (PR-HR-YYYY-##### format is guessable but rate-limitable). The
endpoint returns NOTHING sensitive that HR wouldn't already have emailed
the candidate.
"""
import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/public", tags=["Candidate Portal"])
db = None


def set_db(database):
    global db
    db = database


def _redact_offer(o: dict) -> dict:
    """Strip internal fields; keep candidate-facing keys."""
    return {
        "offer_id": o.get("offer_id"),
        "token": o.get("token"),
        "designation": o.get("designation"),
        "department": o.get("department"),
        "work_location": o.get("work_location"),
        "hiring_type": o.get("hiring_type"),
        "joining_date": o.get("joining_date"),
        "salary_ctc": o.get("salary_ctc"),
        "salary_breakdown": o.get("salary_breakdown"),
        "probation_months": o.get("probation_months"),
        "status": o.get("status"),
        "created_at": o.get("created_at"),
        "sent_at": o.get("sent_at"),
        "responded_at": o.get("responded_at"),
        "pdf_url": f"/api/public/offers/{o.get('offer_id')}/pdf",
        "respond_url": f"/api/public/offers/respond/{o.get('token')}" if o.get("token") and o.get("status") in ("generated", "sent") else None,
    }


def _build_timeline(app_status: str, has_test: bool, has_interview: bool, has_offer: bool, joined: bool) -> list:
    """Return the 5-milestone strip the frontend renders."""
    def _s(label, key, done, active=False):
        return {"label": label, "key": key, "done": done, "active": active}

    ordered = ["application_received", "under_screening", "shortlisted",
               "test_assigned", "test_completed", "test_failed",
               "hr_interview_scheduled", "hr_interview_completed",
               "department_interview_scheduled", "department_interview_completed",
               "management_review", "selected", "waitlisted",
               "documents_requested", "documents_under_verification", "documents_verified", "documents_rejected",
               "offer_generated", "offer_sent", "offer_accepted", "offer_declined",
               "joining_scheduled", "joined",
               "internship", "trainee", "probation", "regular_employee",
               "rejected", "application_withdrawn", "application_closed"]
    idx = ordered.index(app_status) if app_status in ordered else 0

    applied_done = True
    test_done = has_test or app_status in ("test_completed", "test_failed") or idx >= ordered.index("test_completed")
    interview_done = has_interview or idx >= ordered.index("hr_interview_completed")
    offer_done = app_status in ("offer_accepted", "offer_declined", "joining_scheduled", "joined") or idx >= ordered.index("offer_accepted")
    joined_done = joined or app_status in ("joined", "internship", "trainee", "probation", "regular_employee")

    # Determine "active" — the current stage
    if joined_done:
        active_key = "joined"
    elif offer_done:
        active_key = "joined"
    elif has_offer and not offer_done:
        active_key = "offer"
    elif interview_done:
        active_key = "offer"
    elif has_interview and not interview_done:
        active_key = "interview"
    elif test_done:
        active_key = "interview"
    elif has_test and not test_done:
        active_key = "test"
    else:
        active_key = "applied"

    return [
        _s("Applied", "applied", applied_done, active_key == "applied"),
        _s("Assessment", "test", test_done, active_key == "test"),
        _s("Interview", "interview", interview_done, active_key == "interview"),
        _s("Offer", "offer", offer_done, active_key == "offer"),
        _s("Joined", "joined", joined_done, active_key == "joined"),
    ]


def _active_actions(app: dict, assignments: list, interviews: list, offers: list) -> list:
    """Compute the 'you need to do this next' banner cards."""
    now = datetime.now(timezone.utc)
    actions = []

    # Test not yet submitted
    for a in assignments:
        if a.get("status") in ("pending", "in_progress") and a.get("token"):
            try:
                dl = datetime.fromisoformat(a["deadline"].replace("Z", "+00:00"))
                hours_left = max(0, int((dl - now).total_seconds() / 3600))
            except Exception:
                hours_left = None
            actions.append({
                "kind": "test",
                "priority": "high",
                "title": f"Take your assessment: {a.get('test_title')}",
                "cta_label": "Start Test",
                "cta_url": f"/careers/test/{a['token']}",
                "hours_left": hours_left,
                "deadline": a.get("deadline"),
            })

    # Upcoming interview
    for iv in interviews:
        if iv.get("status") == "scheduled" and iv.get("scheduled_at"):
            actions.append({
                "kind": "interview",
                "priority": "medium",
                "title": f"{iv.get('kind', 'interview').replace('_', ' ').title()} on {iv['scheduled_at']}",
                "cta_label": "Join Meeting" if iv.get("meet_link") else "View Details",
                "cta_url": iv.get("meet_link") or "#",
                "scheduled_at": iv.get("scheduled_at"),
                "mode": iv.get("mode"),
            })

    # Offer awaiting response
    for o in offers:
        if o.get("status") in ("generated", "sent") and o.get("token"):
            actions.append({
                "kind": "offer",
                "priority": "high",
                "title": f"Offer letter for {o.get('designation')} — awaiting your response",
                "cta_label": "Review & Respond",
                "cta_url": f"/candidate/offer/{o['token']}",
                "offer_id": o.get("offer_id"),
                "pdf_url": f"/api/public/offers/{o.get('offer_id')}/pdf",
            })

    return actions


@router.get("/candidate/{application_id}")
async def candidate_portal(application_id: str):
    """One-shot hydration for the public candidate dashboard."""
    app = await db.job_applications.find_one({"application_id": application_id}, {"_id": 0})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Pull child records in parallel — motor doesn't have gather natively so
    # we just do them sequentially; each query is a single index lookup.
    assignments = await db.test_assignments.find({"application_id": application_id}, {"_id": 0}).sort("assigned_at", -1).to_list(20)
    interviews = await db.interviews.find({"application_id": application_id}, {"_id": 0}).sort("scheduled_at", 1).to_list(20)
    offers_raw = await db.offers.find({"application_id": application_id}).sort("created_at", -1).to_list(20)
    offers = [_redact_offer(o) for o in offers_raw]

    # Employee record + onboarding + letters (only if the candidate joined)
    employee = None
    onboarding = None
    letters = []
    emp_row = await db.employees.find_one({"source_application_id": application_id}, {"_id": 0})
    if emp_row:
        employee = {
            "employee_id": emp_row.get("employee_id"),
            "designation": emp_row.get("designation"),
            "department": emp_row.get("department"),
            "joining_date": emp_row.get("joining_date"),
            "status": emp_row.get("status"),
        }
        onb = await db.employee_onboarding.find_one({"employee_id": emp_row["employee_id"]}, {"_id": 0})
        if onb:
            total = len(onb.get("tasks", []))
            done = sum(1 for t in onb.get("tasks", []) if t.get("done"))
            onboarding = {
                "onboarding_id": onb.get("onboarding_id"),
                "tasks": [{"title": t["title"], "done": t["done"]} for t in onb.get("tasks", [])],
                "progress_percent": round(done / total * 100, 1) if total else 0.0,
                "completed_at": onb.get("completed_at"),
            }
        letter_rows = await db.employee_letters.find({"employee_id": emp_row["employee_id"]}, {"_id": 0}).sort("issued_at", -1).to_list(50)
        for l in letter_rows:
            letters.append({
                "letter_id": l["letter_id"],
                "kind": l["kind"],
                "issued_at": l["issued_at"],
                "pdf_url": f"/api/public/employees/{emp_row['employee_id']}/letters/{l['letter_id']}/pdf",
            })

    # Redact assignments — never leak correct_index / per_question breakdown
    safe_assignments = []
    for a in assignments:
        attempt = a.get("attempt") or None
        safe_assignments.append({
            "assignment_id": a["assignment_id"],
            "test_id": a["test_id"],
            "test_title": a.get("test_title"),
            "assigned_at": a.get("assigned_at"),
            "deadline": a.get("deadline"),
            "status": a.get("status"),
            "started_at": a.get("started_at"),
            "submitted_at": a.get("submitted_at"),
            "token": a.get("token") if a.get("status") in ("pending", "in_progress") else None,
            "attempt_summary": {
                "percentage": attempt.get("percentage"),
                "passed": attempt.get("passed"),
                "marks_earned": attempt.get("marks_earned"),
                "max_marks": attempt.get("max_marks"),
            } if attempt else None,
        })

    # Redact interviews — hide panelists' internal contact info but keep the schedule
    safe_interviews = []
    for iv in interviews:
        safe_interviews.append({
            "interview_id": iv["interview_id"],
            "kind": iv.get("kind"),
            "scheduled_at": iv.get("scheduled_at"),
            "mode": iv.get("mode"),
            "meet_link": iv.get("meet_link") if iv.get("status") == "scheduled" else None,
            "location": iv.get("location"),
            "status": iv.get("status"),
        })

    application = {
        "application_id": app["application_id"],
        "name": app.get("name"),
        "email": app.get("email"),
        "phone": app.get("phone"),
        "job_id": app.get("job_id"),
        "job_code": app.get("job_code"),
        "job_title": app.get("job_title"),
        "status": app.get("status"),
        "status_history": app.get("status_history", []),
        "recruitment_source": app.get("recruitment_source"),
        "created_at": app.get("created_at"),
        "updated_at": app.get("updated_at"),
        "has_resume": bool(app.get("resume_path")),
        "supporting_docs": {
            "aadhaar": bool(app.get("aadhaar_path")),
            "pan": bool(app.get("pan_path")),
            "marksheet": bool(app.get("marksheet_path")),
        },
    }

    timeline = _build_timeline(
        app.get("status", "application_received"),
        has_test=bool(assignments),
        has_interview=bool(interviews),
        has_offer=bool(offers),
        joined=bool(emp_row),
    )
    actions = _active_actions(app, assignments, safe_interviews, offers_raw)

    return {
        "application": application,
        "timeline": timeline,
        "actions": actions,
        "assessments": safe_assignments,
        "interviews": safe_interviews,
        "offers": offers,
        "employee": employee,
        "onboarding": onboarding,
        "letters": letters,
    }
