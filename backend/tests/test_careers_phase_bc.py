"""
Phase B + C + Employee Master contract tests.

Runs against the LIVE backend via REACT_APP_BACKEND_URL. Covers:
- Test bank CRUD (§15)
- Assign → attempt → auto-score → status auto-flip (§15)
- Interview scheduling + scorecard aggregation (§16-18)
- Offer generate → PDF stream → send → candidate accept flow (§21-26, §71)
- Employee master creation from application (§28, PR-EMP-##### format)
"""
import io
import os
import re
import time
import pytest
import requests

API = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
pytestmark = pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not set")


# ---------------- Helpers ----------------

def _make_job():
    r = requests.post(f"{API}/api/public/careers/jobs/create", json={
        "title": f"Phase BC job {int(time.time()*1000)}",
        "department": "Technology",
        "description": "Phase B/C contract job",
        "vacancy_count": 1,
        "admin_id": "pytest_bc",
    }, timeout=30)
    r.raise_for_status()
    return r.json()["job"]


def _apply(job_key, email):
    files = {"resume": ("r.pdf", b"%PDF-1.4\ntest", "application/pdf")}
    data = {"job_id": job_key, "name": "BC Applicant", "email": email, "phone": "9876500000"}
    r = requests.post(f"{API}/api/public/careers/apply", files=files, data=data, timeout=30)
    r.raise_for_status()
    return r.json()["application_id"]


def _fresh_test():
    payload = {
        "title": f"Phase B test {int(time.time()*1000)}",
        "department": "Technology",
        "duration_minutes": 15,
        "passing_marks": 50,
        "questions": [
            {"text": "2+2 = ?", "options": ["3", "4", "5"], "correct_index": 1, "marks": 1},
            {"text": "Capital of Maharashtra?", "options": ["Pune", "Mumbai", "Nagpur"], "correct_index": 1, "marks": 1},
            {"text": "React library maker?", "options": ["Google", "Meta", "Amazon"], "correct_index": 1, "marks": 1},
            {"text": "MongoDB is?", "options": ["SQL", "NoSQL", "Graph"], "correct_index": 1, "marks": 1},
        ],
    }
    r = requests.post(f"{API}/api/public/tests", json=payload, timeout=30)
    r.raise_for_status()
    return r.json()["test_id"]


# ---------------- Test bank CRUD ----------------

def test_test_bank_crud():
    tid = _fresh_test()

    r = requests.get(f"{API}/api/public/tests/{tid}", timeout=30)
    assert r.status_code == 200
    t = r.json()["test"]
    # correct_index MUST be stripped from candidate fetch
    assert all("correct_index" not in q for q in t["questions"])
    assert len(t["questions"]) == 4

    r = requests.get(f"{API}/api/public/tests/{tid}?include_answers=true", timeout=30)
    assert all("correct_index" in q for q in r.json()["test"]["questions"])

    # list
    lst = requests.get(f"{API}/api/public/tests?active_only=true", timeout=30).json()
    assert any(t2["test_id"] == tid for t2 in lst["tests"])

    # update
    r = requests.put(f"{API}/api/public/tests/{tid}", json={"title": "Updated", "is_active": False}, timeout=30)
    assert r.status_code == 200

    # delete
    r = requests.delete(f"{API}/api/public/tests/{tid}", timeout=30)
    assert r.status_code == 200
    r = requests.get(f"{API}/api/public/tests/{tid}", timeout=30)
    assert r.status_code == 404


def test_assign_and_attempt_auto_score_pass():
    tid = _fresh_test()
    job = _make_job()
    app_id = _apply(job["job_id"], f"pass_{int(time.time())}@t.com")

    # Assign
    r = requests.post(f"{API}/api/public/tests/assign", json={"application_id": app_id, "test_id": tid, "deadline_hours": 1}, timeout=30)
    assert r.status_code == 200
    body = r.json()
    token = body["token"]

    # Fetch (candidate)
    r = requests.get(f"{API}/api/public/tests/attempt/{token}", timeout=30)
    assert r.status_code == 200
    fetched = r.json()
    assert fetched["assignment"]["status"] == "in_progress"
    q_ids = [q["q_id"] for q in fetched["test"]["questions"]]

    # Submit ALL CORRECT — spec §15 auto-scoring: expect 100% + test_completed
    submission = {"token": token, "answers": [{"q_id": q, "selected_index": 1} for q in q_ids]}
    r = requests.post(f"{API}/api/public/tests/attempt/submit", json=submission, timeout=30)
    assert r.status_code == 200
    result = r.json()
    assert result["percentage"] == 100.0
    assert result["passed"] is True
    assert result["status"] == "test_completed"

    # App status must have moved
    apps = requests.get(f"{API}/api/public/careers/applications", timeout=30).json()["applications"]
    match = next(a for a in apps if a["application_id"] == app_id)
    assert match["status"] == "test_completed"

    # Second submit rejected
    r = requests.post(f"{API}/api/public/tests/attempt/submit", json=submission, timeout=30)
    assert r.status_code == 400


def test_assign_and_attempt_fail_flow():
    tid = _fresh_test()
    job = _make_job()
    app_id = _apply(job["job_id"], f"fail_{int(time.time())}@t.com")
    token = requests.post(f"{API}/api/public/tests/assign", json={"application_id": app_id, "test_id": tid}, timeout=30).json()["token"]
    requests.get(f"{API}/api/public/tests/attempt/{token}", timeout=30)
    # All wrong (index 0) → 0% → test_failed
    fetched = requests.get(f"{API}/api/public/tests/attempt/{token}", timeout=30).json()
    submission = {"token": token, "answers": [{"q_id": q["q_id"], "selected_index": 0} for q in fetched["test"]["questions"]]}
    r = requests.post(f"{API}/api/public/tests/attempt/submit", json=submission, timeout=30).json()
    assert r["passed"] is False
    assert r["status"] == "test_failed"


# ---------------- Interviews ----------------

def test_interview_schedule_and_scorecard():
    job = _make_job()
    app_id = _apply(job["job_id"], f"int_{int(time.time())}@t.com")

    r = requests.post(f"{API}/api/public/interviews/schedule", json={
        "application_id": app_id,
        "kind": "hr",
        "scheduled_at": "2026-03-15T10:00:00Z",
        "mode": "online",
        "meet_link": "https://meet.example.com/xyz",
        "panelists": ["hr1@paras.com"],
    }, timeout=30)
    assert r.status_code == 200
    b = r.json()
    interview_id = b["interview_id"]
    assert b["status_moved_to"] == "hr_interview_scheduled"

    # Submit scorecard
    r = requests.post(f"{API}/api/public/interviews/{interview_id}/scorecard", json={
        "reviewer": "hr1@paras.com",
        "ratings": {"communication": 4, "technical": 4, "culture": 5},
        "recommendation": "yes",
        "comment": "Great candidate",
    }, timeout=30)
    assert r.status_code == 200
    b = r.json()
    assert b["scorecard"]["average"] == round((4+4+5)/3, 2)

    # Second panellist
    r = requests.post(f"{API}/api/public/interviews/{interview_id}/scorecard", json={
        "reviewer": "hr2@paras.com",
        "ratings": {"communication": 3, "technical": 3, "culture": 4},
        "recommendation": "maybe",
    }, timeout=30)
    b = r.json()
    assert b["scorecard_count"] == 2
    assert b["interview_overall_avg"] > 0

    # Application moved to hr_interview_completed
    apps = requests.get(f"{API}/api/public/careers/applications", timeout=30).json()["applications"]
    assert next(a for a in apps if a["application_id"] == app_id)["status"] == "hr_interview_completed"

    # Invalid kind
    r = requests.post(f"{API}/api/public/interviews/schedule", json={"application_id": app_id, "kind": "bogus", "scheduled_at": "2026-03-15T10:00:00Z"}, timeout=30)
    assert r.status_code == 400


# ---------------- Offers + PDF + accept ----------------

def test_offer_generate_pdf_and_accept_flow():
    job = _make_job()
    app_id = _apply(job["job_id"], f"ofr_{int(time.time())}@t.com")

    r = requests.post(f"{API}/api/public/offers/generate", json={
        "application_id": app_id,
        "hiring_type": "Direct Hire",
        "designation": "Software Engineer",
        "department": "Technology",
        "joining_date": "2026-03-01",
        "salary_ctc": 800000,
        "salary_breakdown": {"basic": 400000, "hra": 200000, "special": 200000},
        "probation_months": 6,
        "additional_notes": "Welcome aboard!",
    }, timeout=30)
    assert r.status_code == 200, r.text
    b = r.json()
    offer_id = b["offer_id"]
    token = b["token"]

    # PDF stream
    r = requests.get(f"{API}/api/public/offers/{offer_id}/pdf", timeout=30)
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")
    assert len(r.content) > 500

    # App status = offer_generated
    apps = requests.get(f"{API}/api/public/careers/applications", timeout=30).json()["applications"]
    assert next(a for a in apps if a["application_id"] == app_id)["status"] == "offer_generated"

    # Send
    r = requests.post(f"{API}/api/public/offers/{offer_id}/send", json={"admin_id": "hr"}, timeout=30)
    assert r.status_code == 200

    # Candidate view via token
    r = requests.get(f"{API}/api/public/offers/respond/{token}", timeout=30)
    assert r.status_code == 200
    assert r.json()["offer"]["designation"] == "Software Engineer"

    # Accept
    r = requests.post(f"{API}/api/public/offers/respond", json={"token": token, "action": "accept"}, timeout=30)
    assert r.status_code == 200
    # App must now be joining_scheduled (auto-advanced)
    apps = requests.get(f"{API}/api/public/careers/applications", timeout=30).json()["applications"]
    match = next(a for a in apps if a["application_id"] == app_id)
    assert match["status"] == "joining_scheduled"

    # Second respond rejected
    r = requests.post(f"{API}/api/public/offers/respond", json={"token": token, "action": "decline"}, timeout=30)
    assert r.status_code == 400


def test_offer_decline_flow():
    job = _make_job()
    app_id = _apply(job["job_id"], f"decl_{int(time.time())}@t.com")
    b = requests.post(f"{API}/api/public/offers/generate", json={
        "application_id": app_id, "hiring_type": "Fresher / Trainee",
        "designation": "Trainee", "department": "Marketing",
        "joining_date": "2026-04-01", "salary_ctc": 300000,
    }, timeout=30).json()
    r = requests.post(f"{API}/api/public/offers/respond", json={"token": b["token"], "action": "decline", "reason": "Accepted another offer"}, timeout=30)
    assert r.status_code == 200
    apps = requests.get(f"{API}/api/public/careers/applications", timeout=30).json()["applications"]
    assert next(a for a in apps if a["application_id"] == app_id)["status"] == "offer_declined"


def test_offer_invalid_hiring_type():
    job = _make_job()
    app_id = _apply(job["job_id"], f"badht_{int(time.time())}@t.com")
    r = requests.post(f"{API}/api/public/offers/generate", json={
        "application_id": app_id, "hiring_type": "Full-Time Perm Ninja",
        "designation": "SE", "department": "Tech",
        "joining_date": "2026-03-01", "salary_ctc": 100000,
    }, timeout=30)
    assert r.status_code == 400


# ---------------- Employee master ----------------

def test_convert_to_employee_and_id_format():
    job = _make_job()
    app_id = _apply(job["job_id"], f"emp_{int(time.time())}@t.com")
    # Generate + accept offer first
    off = requests.post(f"{API}/api/public/offers/generate", json={
        "application_id": app_id, "hiring_type": "Direct Hire",
        "designation": "Backend Engineer", "department": "Technology",
        "joining_date": "2026-03-01", "salary_ctc": 600000,
    }, timeout=30).json()
    requests.post(f"{API}/api/public/offers/respond", json={"token": off["token"], "action": "accept"}, timeout=30)

    # Convert to employee
    r = requests.post(f"{API}/api/public/employees/from-application", json={"application_id": app_id}, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["already_exists"] is False
    emp = body["employee"]
    assert re.match(r"^PR-EMP-\d{5}$", emp["employee_id"]), emp["employee_id"]
    assert emp["department"] == "Technology"
    assert emp["designation"] == "Backend Engineer"
    assert emp["status"] == "active"

    # Idempotent second call returns same record
    r2 = requests.post(f"{API}/api/public/employees/from-application", json={"application_id": app_id}, timeout=30)
    assert r2.json()["already_exists"] is True
    assert r2.json()["employee"]["employee_id"] == emp["employee_id"]

    # App must be `joined`
    apps = requests.get(f"{API}/api/public/careers/applications", timeout=30).json()["applications"]
    assert next(a for a in apps if a["application_id"] == app_id)["status"] == "joined"

    # Employee list + detail
    lst = requests.get(f"{API}/api/public/employees?status=active", timeout=30).json()
    assert any(e["employee_id"] == emp["employee_id"] for e in lst["employees"])
    detail = requests.get(f"{API}/api/public/employees/{emp['employee_id']}", timeout=30).json()
    assert detail["employee"]["employee_id"] == emp["employee_id"]
