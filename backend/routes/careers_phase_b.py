"""
Careers Phase B — Online Tests + Interview Scheduler + Scorecards
Spec: §15 (online-test system), §16-18 (interview management), §74 (practical tests)

Collections
-----------
test_bank         : reusable question sets per role/department
test_assignments  : one-per-application assignment token + attempt result
interviews        : HR / Department / Panel interview records with scorecards

All endpoints mounted under the /public prefix in server.py, mirroring the
existing careers_investors module. Actual admin-gating is deferred to
Phase G; this phase focuses on shape + data flow.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/public", tags=["Careers Phase B"])
db = None


def set_db(database):
    global db
    db = database


# ==================== Test Bank ====================

class TestQuestion(BaseModel):
    q_id: Optional[str] = None
    text: str
    options: List[str] = Field(..., min_length=2, max_length=6)
    correct_index: int = Field(..., ge=0)
    marks: int = 1


class TestBankRequest(BaseModel):
    title: str
    department: str = "General"
    role_tags: List[str] = []
    duration_minutes: int = 30
    passing_marks: int = 40  # percentage
    negative_marking: float = 0.0  # per-wrong penalty, 0 = disabled
    questions: List[TestQuestion]
    is_active: bool = True
    admin_id: str = ""


def _q_id():
    return f"Q-{str(uuid.uuid4())[:8].upper()}"


@router.post("/tests")
async def create_test(data: TestBankRequest):
    try:
        now = datetime.now(timezone.utc).isoformat()
        test_id = f"TEST-{str(uuid.uuid4())[:10].upper()}"
        questions = []
        total = 0
        for q in data.questions:
            if q.correct_index >= len(q.options):
                raise HTTPException(status_code=400, detail=f"correct_index out of range for question: {q.text[:40]}")
            qd = q.model_dump()
            qd["q_id"] = qd.get("q_id") or _q_id()
            questions.append(qd)
            total += q.marks

        await db.test_bank.insert_one({
            "test_id": test_id,
            "title": data.title,
            "department": data.department,
            "role_tags": data.role_tags,
            "duration_minutes": max(5, int(data.duration_minutes)),
            "passing_marks": max(0, min(100, int(data.passing_marks))),
            "negative_marking": max(0.0, float(data.negative_marking)),
            "questions": questions,
            "total_marks": total,
            "is_active": data.is_active,
            "created_by": data.admin_id,
            "created_at": now,
            "updated_at": now,
        })
        return {"success": True, "test_id": test_id, "total_marks": total, "question_count": len(questions)}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[TESTS] create error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tests")
async def list_tests(active_only: bool = False):
    q = {"is_active": True} if active_only else {}
    tests = await db.test_bank.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    for t in tests:
        t["question_count"] = len(t.get("questions", []))
    return {"tests": tests, "total": len(tests)}


@router.get("/tests/{test_id}")
async def get_test(test_id: str, include_answers: bool = False):
    t = await db.test_bank.find_one({"test_id": test_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Test not found")
    if not include_answers:
        for q in t.get("questions", []):
            q.pop("correct_index", None)
    return {"test": t}


@router.put("/tests/{test_id}")
async def update_test(test_id: str, request: Request):
    data = await request.json()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data.pop("test_id", None)
    r = await db.test_bank.update_one({"test_id": test_id}, {"$set": data})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"success": True}


@router.delete("/tests/{test_id}")
async def delete_test(test_id: str):
    r = await db.test_bank.delete_one({"test_id": test_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"success": True}


# ==================== Test Assignment + Attempt ====================

class AssignTestRequest(BaseModel):
    application_id: str
    test_id: str
    deadline_hours: int = 72
    admin_id: str = "admin"


@router.post("/tests/assign")
async def assign_test(data: AssignTestRequest):
    """Admin: assign a test to a candidate. Auto-flips app to test_assigned."""
    try:
        app = await db.job_applications.find_one({"application_id": data.application_id})
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")
        test = await db.test_bank.find_one({"test_id": data.test_id})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        now = datetime.now(timezone.utc)
        deadline = now.timestamp() + max(1, int(data.deadline_hours)) * 3600
        deadline_iso = datetime.fromtimestamp(deadline, tz=timezone.utc).isoformat()
        assignment_id = f"ASGN-{str(uuid.uuid4())[:10].upper()}"
        token = str(uuid.uuid4())  # single-use candidate token

        await db.test_assignments.insert_one({
            "assignment_id": assignment_id,
            "token": token,
            "application_id": data.application_id,
            "test_id": data.test_id,
            "test_title": test.get("title"),
            "assigned_by": data.admin_id,
            "assigned_at": now.isoformat(),
            "deadline": deadline_iso,
            "status": "pending",       # pending -> in_progress -> submitted / expired
            "attempt": None,
        })

        # Advance the application to test_assigned (§10)
        await _advance_status(data.application_id, "test_assigned", data.admin_id, f"Test {test.get('title')} assigned")

        return {
            "success": True,
            "assignment_id": assignment_id,
            "token": token,
            "candidate_url": f"/careers/test/{token}",
            "deadline": deadline_iso,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[TESTS] assign error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tests/attempt/{token}")
async def fetch_attempt_test(token: str):
    """Candidate-facing: fetch test paper (without answers) using the token."""
    asgn = await db.test_assignments.find_one({"token": token}, {"_id": 0})
    if not asgn:
        raise HTTPException(status_code=404, detail="Invalid or expired test link")
    if asgn["status"] == "submitted":
        return {"assignment": asgn, "already_submitted": True}
    if datetime.now(timezone.utc) > datetime.fromisoformat(asgn["deadline"].replace("Z", "+00:00")):
        await db.test_assignments.update_one({"token": token}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Test link has expired")
    test = await db.test_bank.find_one({"test_id": asgn["test_id"]}, {"_id": 0})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    for q in test.get("questions", []):
        q.pop("correct_index", None)
    # First fetch → mark in_progress
    if asgn["status"] == "pending":
        await db.test_assignments.update_one({"token": token}, {"$set": {"status": "in_progress", "started_at": datetime.now(timezone.utc).isoformat()}})
        asgn["status"] = "in_progress"
    return {"assignment": asgn, "test": test}


class TestAnswer(BaseModel):
    q_id: str
    selected_index: int


class TestSubmission(BaseModel):
    token: str
    answers: List[TestAnswer]


@router.post("/tests/attempt/submit")
async def submit_attempt(data: TestSubmission):
    """Candidate-facing: submit answers → auto-score."""
    try:
        asgn = await db.test_assignments.find_one({"token": data.token})
        if not asgn:
            raise HTTPException(status_code=404, detail="Invalid submission link")
        if asgn["status"] == "submitted":
            raise HTTPException(status_code=400, detail="Test already submitted")
        if datetime.now(timezone.utc) > datetime.fromisoformat(asgn["deadline"].replace("Z", "+00:00")):
            raise HTTPException(status_code=400, detail="Test deadline has passed")
        test = await db.test_bank.find_one({"test_id": asgn["test_id"]})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        # Score
        answer_map = {a.q_id: a.selected_index for a in data.answers}
        earned = 0.0
        max_marks = test.get("total_marks", 0) or 0
        per_q = []
        neg = float(test.get("negative_marking", 0.0))
        for q in test.get("questions", []):
            sel = answer_map.get(q["q_id"])
            correct_index = q["correct_index"]
            marks = q.get("marks", 1)
            is_correct = sel == correct_index
            if is_correct:
                earned += marks
            elif sel is not None and neg > 0:
                earned -= neg
            per_q.append({"q_id": q["q_id"], "selected": sel, "correct": correct_index, "is_correct": is_correct, "marks": marks})
        earned = max(0.0, earned)
        pct = round((earned / max_marks) * 100.0, 2) if max_marks else 0.0
        passed = pct >= float(test.get("passing_marks", 40))
        submitted_at = datetime.now(timezone.utc).isoformat()

        await db.test_assignments.update_one(
            {"token": data.token},
            {"$set": {
                "status": "submitted",
                "submitted_at": submitted_at,
                "attempt": {
                    "answers": [a.model_dump() for a in data.answers],
                    "per_question": per_q,
                    "marks_earned": earned,
                    "max_marks": max_marks,
                    "percentage": pct,
                    "passed": passed,
                    "submitted_at": submitted_at,
                }
            }}
        )

        # Auto-advance application status (§10)
        new_status = "test_completed" if passed else "test_failed"
        await _advance_status(
            asgn["application_id"], new_status, "system",
            f"Auto-scored: {earned}/{max_marks} ({pct}%)"
        )

        return {
            "success": True,
            "marks_earned": earned,
            "max_marks": max_marks,
            "percentage": pct,
            "passed": passed,
            "status": new_status,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[TESTS] submit error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tests/assignments")
async def list_assignments(application_id: Optional[str] = None):
    q = {"application_id": application_id} if application_id else {}
    rows = await db.test_assignments.find(q, {"_id": 0, "attempt.answers": 0}).sort("assigned_at", -1).to_list(500)
    return {"assignments": rows, "total": len(rows)}


# ==================== Interviews + Scorecards (§16-18) ====================

class ScheduleInterviewRequest(BaseModel):
    application_id: str
    kind: str = "hr"  # hr | department | panel | practical
    scheduled_at: str  # ISO
    mode: str = "online"  # online | offline
    meet_link: Optional[str] = None
    location: Optional[str] = None
    panelists: List[str] = []  # email or names
    admin_id: str = "admin"


_INTERVIEW_KIND_STATUS = {
    "hr": ("hr_interview_scheduled", "hr_interview_completed"),
    "department": ("department_interview_scheduled", "department_interview_completed"),
    "panel": ("department_interview_scheduled", "department_interview_completed"),
    "practical": ("test_assigned", "test_completed"),  # spec §74 practical test
}


@router.post("/interviews/schedule")
async def schedule_interview(data: ScheduleInterviewRequest):
    try:
        app = await db.job_applications.find_one({"application_id": data.application_id})
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")
        if data.kind not in _INTERVIEW_KIND_STATUS:
            raise HTTPException(status_code=400, detail=f"Invalid kind. Use one of: {sorted(_INTERVIEW_KIND_STATUS.keys())}")

        interview_id = f"INT-{str(uuid.uuid4())[:10].upper()}"
        now = datetime.now(timezone.utc).isoformat()
        await db.interviews.insert_one({
            "interview_id": interview_id,
            "application_id": data.application_id,
            "kind": data.kind,
            "scheduled_at": data.scheduled_at,
            "mode": data.mode,
            "meet_link": data.meet_link,
            "location": data.location,
            "panelists": data.panelists,
            "status": "scheduled",
            "scorecards": [],
            "created_by": data.admin_id,
            "created_at": now,
            "updated_at": now,
        })

        # Advance application status to *_scheduled
        target = _INTERVIEW_KIND_STATUS[data.kind][0]
        await _advance_status(data.application_id, target, data.admin_id, f"{data.kind} interview scheduled for {data.scheduled_at}")

        return {"success": True, "interview_id": interview_id, "status_moved_to": target}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[INTERVIEWS] schedule error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ScorecardRequest(BaseModel):
    reviewer: str  # email or name
    ratings: dict  # {communication:1-5, technical:1-5, culture:1-5, ...}
    recommendation: str = "maybe"  # yes | no | maybe
    comment: str = ""


@router.post("/interviews/{interview_id}/scorecard")
async def submit_scorecard(interview_id: str, data: ScorecardRequest):
    try:
        interview = await db.interviews.find_one({"interview_id": interview_id})
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        # Compute average rating for this scorecard
        vals = [v for v in data.ratings.values() if isinstance(v, (int, float))]
        avg = round(sum(vals) / len(vals), 2) if vals else 0.0

        card = {
            "card_id": f"SC-{str(uuid.uuid4())[:8].upper()}",
            "reviewer": data.reviewer,
            "ratings": data.ratings,
            "average": avg,
            "recommendation": data.recommendation,
            "comment": data.comment,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        await db.interviews.update_one(
            {"interview_id": interview_id},
            {"$push": {"scorecards": card}, "$set": {"updated_at": card["at"], "status": "completed"}},
        )

        # Move application to *_completed if not already
        kind = interview.get("kind")
        target = _INTERVIEW_KIND_STATUS.get(kind, (None, None))[1]
        if target:
            await _advance_status(interview["application_id"], target, data.reviewer, f"Scorecard by {data.reviewer}: {data.recommendation}")

        # Aggregate across all scorecards for this interview
        interview = await db.interviews.find_one({"interview_id": interview_id})
        cards = interview.get("scorecards", [])
        overall_avg = round(sum(c["average"] for c in cards) / len(cards), 2) if cards else 0.0

        return {"success": True, "scorecard": card, "interview_overall_avg": overall_avg, "scorecard_count": len(cards)}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[INTERVIEWS] scorecard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interviews")
async def list_interviews(application_id: Optional[str] = None):
    q = {"application_id": application_id} if application_id else {}
    rows = await db.interviews.find(q, {"_id": 0}).sort("scheduled_at", -1).to_list(500)
    return {"interviews": rows, "total": len(rows)}


@router.get("/interviews/{interview_id}")
async def get_interview(interview_id: str):
    row = await db.interviews.find_one({"interview_id": interview_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Interview not found")
    cards = row.get("scorecards", [])
    row["overall_avg"] = round(sum(c["average"] for c in cards) / len(cards), 2) if cards else 0.0
    return {"interview": row}


# ==================== Internal helper: advance application status ====================

async def _advance_status(application_id: str, to_status: str, by: str, comment: str = ""):
    """Push a status_history entry + set current status. Kept private so
    Phase B modules always log transitions consistently."""
    app = await db.job_applications.find_one({"application_id": application_id})
    if not app:
        return
    prev = app.get("status")
    now = datetime.now(timezone.utc).isoformat()
    await db.job_applications.update_one(
        {"application_id": application_id},
        {
            "$set": {"status": to_status, "updated_at": now},
            "$push": {"status_history": {"from": prev, "to": to_status, "by": by, "at": now, "comment": comment}},
        },
    )
