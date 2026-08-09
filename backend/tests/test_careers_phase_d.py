"""
Phase D Onboarding + Letter PDFs + Attendance & Leave contract tests.

Runs against the LIVE backend via REACT_APP_BACKEND_URL. Covers:
- Onboarding checklist init (idempotent) + per-task update + completion signal
- 5 letter PDF generation kinds — each produces a valid %PDF blob
- Attendance mark (upsert) + roster + monthly summary
- Leave apply → decision (approve marks attendance) → cancel; balance computation
"""
import os
import re
import time
import pytest
import requests

API = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
pytestmark = pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not set")


# ---------- Helpers: seed a joined employee ready for D-phase actions ----------

def _seed_employee():
    """Create job → apply → generate offer → accept → convert to employee."""
    job = requests.post(f"{API}/api/public/careers/jobs/create", json={
        "title": f"Phase D job {int(time.time()*1000)}",
        "department": "Operations",
        "description": "Auto-seed for Phase D tests",
        "vacancy_count": 5,
        "admin_id": "pytest_d",
    }, timeout=30).json()["job"]

    email = f"phaseD_{int(time.time()*1000)}@t.com"
    r = requests.post(
        f"{API}/api/public/careers/apply",
        files={"resume": ("r.pdf", b"%PDF-1.4\nseed", "application/pdf")},
        data={"job_id": job["job_id"], "name": "Phase D Applicant", "email": email, "phone": "9800000000"},
        timeout=30,
    )
    app_id = r.json()["application_id"]
    off = requests.post(f"{API}/api/public/offers/generate", json={
        "application_id": app_id, "hiring_type": "Direct Hire",
        "designation": "Ops Executive", "department": "Operations",
        "joining_date": "2026-03-01", "salary_ctc": 500000, "probation_months": 3,
    }, timeout=30).json()
    requests.post(f"{API}/api/public/offers/respond", json={"token": off["token"], "action": "accept"}, timeout=30)
    emp = requests.post(f"{API}/api/public/employees/from-application", json={"application_id": app_id}, timeout=30).json()["employee"]
    return app_id, emp, off["offer_id"]


# ---------------- Onboarding ----------------

def test_onboarding_init_idempotent_and_completion():
    _, emp, _ = _seed_employee()

    r = requests.post(f"{API}/api/public/employees/{emp['employee_id']}/onboarding/init", json={"admin_id": "hr"}, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["already_exists"] is False
    onb = body["onboarding"]
    assert len(onb["tasks"]) == 10  # default checklist
    assert onb["completed_at"] is None

    # Second init is idempotent
    r = requests.post(f"{API}/api/public/employees/{emp['employee_id']}/onboarding/init", json={}, timeout=30)
    assert r.json()["already_exists"] is True

    # Progress = 0%
    r = requests.get(f"{API}/api/public/employees/{emp['employee_id']}/onboarding", timeout=30)
    assert r.json()["onboarding"]["progress"]["percent"] == 0.0

    # Mark all tasks done → completed_at stamped
    for t in onb["tasks"]:
        r = requests.patch(
            f"{API}/api/public/employees/{emp['employee_id']}/onboarding/{t['task_id']}",
            json={"done": True, "admin_id": "hr"}, timeout=30,
        )
        assert r.status_code == 200

    final = requests.get(f"{API}/api/public/employees/{emp['employee_id']}/onboarding", timeout=30).json()["onboarding"]
    assert final["progress"]["percent"] == 100.0
    assert final["completed_at"] is not None

    # Un-mark one → completed_at cleared
    requests.patch(
        f"{API}/api/public/employees/{emp['employee_id']}/onboarding/{onb['tasks'][0]['task_id']}",
        json={"done": False}, timeout=30,
    )
    again = requests.get(f"{API}/api/public/employees/{emp['employee_id']}/onboarding", timeout=30).json()["onboarding"]
    assert again["completed_at"] is None


def test_onboarding_custom_tasks():
    _, emp, _ = _seed_employee()
    custom = ["Meet CEO", "Sign NDA", "Tour office"]
    r = requests.post(
        f"{API}/api/public/employees/{emp['employee_id']}/onboarding/init",
        json={"tasks": custom, "admin_id": "hr"}, timeout=30,
    )
    onb = r.json()["onboarding"]
    assert [t["title"] for t in onb["tasks"]] == custom


# ---------------- Letters ----------------

@pytest.mark.parametrize("kind,payload", [
    ("appointment", {"offer_id": "OFR-TEST"}),
    ("confirmation", {"confirmation_date": "01 March 2026"}),
    ("increment", {"previous_ctc": 500000, "new_ctc": 650000, "effective_from": "01 April 2026"}),
    ("promotion", {"new_designation": "Ops Manager", "new_ctc": 800000, "effective_from": "01 May 2026"}),
    ("experience", {"relieving_date": "30 April 2027"}),
])
def test_letter_generation_produces_pdf(kind, payload):
    _, emp, _ = _seed_employee()
    r = requests.post(
        f"{API}/api/public/employees/{emp['employee_id']}/letters/generate",
        json={"kind": kind, "payload": payload, "admin_id": "hr"}, timeout=30,
    )
    assert r.status_code == 200, r.text
    letter = r.json()["letter"]
    assert letter["kind"] == kind
    assert re.match(r"^LTR-[A-Z]{3}-[A-Z0-9]{8}$", letter["letter_id"]), letter["letter_id"]

    # Download the actual PDF
    pdf = requests.get(f"{API}/api/public/employees/{emp['employee_id']}/letters/{letter['letter_id']}/pdf", timeout=30)
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")
    assert len(pdf.content) > 500


def test_experience_letter_marks_employee_separated():
    _, emp, _ = _seed_employee()
    r = requests.post(
        f"{API}/api/public/employees/{emp['employee_id']}/letters/generate",
        json={"kind": "experience", "payload": {"relieving_date": "30 April 2027"}}, timeout=30,
    )
    assert r.status_code == 200
    detail = requests.get(f"{API}/api/public/employees/{emp['employee_id']}", timeout=30).json()["employee"]
    assert detail["status"] == "separated"
    assert detail.get("separated_at")


def test_letter_invalid_kind_400():
    _, emp, _ = _seed_employee()
    r = requests.post(
        f"{API}/api/public/employees/{emp['employee_id']}/letters/generate",
        json={"kind": "gossip", "payload": {}}, timeout=30,
    )
    assert r.status_code == 400


def test_letter_list_for_employee():
    _, emp, _ = _seed_employee()
    for k in ("appointment", "confirmation"):
        requests.post(
            f"{API}/api/public/employees/{emp['employee_id']}/letters/generate",
            json={"kind": k, "payload": {}}, timeout=30,
        )
    r = requests.get(f"{API}/api/public/employees/{emp['employee_id']}/letters", timeout=30)
    assert r.json()["total"] >= 2


# ---------------- Attendance ----------------

def test_attendance_mark_upsert_and_roster():
    _, emp, _ = _seed_employee()
    today = "2026-02-27"
    r = requests.post(f"{API}/api/public/attendance/mark", json={
        "employee_id": emp["employee_id"], "date": today,
        "status": "present", "check_in": "09:30", "check_out": "18:30",
    }, timeout=30)
    assert r.status_code == 200
    assert r.json()["upserted"] is True

    # Second call same day → upsert (not insert)
    r = requests.post(f"{API}/api/public/attendance/mark", json={
        "employee_id": emp["employee_id"], "date": today,
        "status": "wfh", "check_in": "10:00", "check_out": "19:00",
    }, timeout=30)
    assert r.json()["upserted"] is False

    # Roster for that day includes the employee with the LATEST status = wfh
    roster = requests.get(f"{API}/api/public/attendance/roster?date={today}", timeout=30).json()
    assert roster["date"] == today
    match = next(a for a in roster["roster"] if a["employee_id"] == emp["employee_id"])
    assert match["status"] == "wfh"
    # Hours worked auto-computed
    assert isinstance(match.get("hours_worked"), (int, float))
    assert match["hours_worked"] == 9.0


def test_attendance_invalid_status():
    _, emp, _ = _seed_employee()
    r = requests.post(f"{API}/api/public/attendance/mark", json={
        "employee_id": emp["employee_id"], "date": "2026-02-27", "status": "napping"
    }, timeout=30)
    assert r.status_code == 400


def test_attendance_monthly_summary():
    _, emp, _ = _seed_employee()
    for d in ("2026-02-01", "2026-02-02", "2026-02-03"):
        requests.post(f"{API}/api/public/attendance/mark", json={
            "employee_id": emp["employee_id"], "date": d, "status": "present",
            "check_in": "09:00", "check_out": "18:00",
        }, timeout=30)
    r = requests.get(f"{API}/api/public/attendance/employee/{emp['employee_id']}?month=2026-02", timeout=30).json()
    assert len(r["days"]) >= 3
    assert r["summary"]["present"] >= 3
    assert r["total_hours"] >= 27.0


# ---------------- Leaves ----------------

def test_leave_apply_and_approve_marks_attendance():
    _, emp, _ = _seed_employee()

    r = requests.post(f"{API}/api/public/leaves/apply", json={
        "employee_id": emp["employee_id"], "leave_type": "casual",
        "from_date": "2026-03-10", "to_date": "2026-03-12", "reason": "Family function",
    }, timeout=30)
    assert r.status_code == 200
    lv = r.json()["leave"]
    assert lv["days"] == 3
    assert lv["status"] == "requested"

    # Approve
    r = requests.post(f"{API}/api/public/leaves/{lv['leave_id']}/decision", json={
        "action": "approve", "approver": "mgr@paras.com", "comment": "Approved",
    }, timeout=30)
    assert r.status_code == 200
    assert r.json()["status"] == "approved"

    # Second decision → 400
    r = requests.post(f"{API}/api/public/leaves/{lv['leave_id']}/decision", json={"action": "reject", "approver": "mgr"}, timeout=30)
    assert r.status_code == 400

    # Attendance auto-marked for each day
    for d in ("2026-03-10", "2026-03-11", "2026-03-12"):
        roster = requests.get(f"{API}/api/public/attendance/roster?date={d}", timeout=30).json()
        match = next(a for a in roster["roster"] if a["employee_id"] == emp["employee_id"])
        assert match["status"] == "leave"


def test_leave_reject_and_invalid_type():
    _, emp, _ = _seed_employee()
    r = requests.post(f"{API}/api/public/leaves/apply", json={
        "employee_id": emp["employee_id"], "leave_type": "vacation_from_reality",
        "from_date": "2026-03-01", "to_date": "2026-03-01",
    }, timeout=30)
    assert r.status_code == 400

    r = requests.post(f"{API}/api/public/leaves/apply", json={
        "employee_id": emp["employee_id"], "leave_type": "sick",
        "from_date": "2026-03-05", "to_date": "2026-03-05",
    }, timeout=30)
    leave_id = r.json()["leave"]["leave_id"]

    r = requests.post(f"{API}/api/public/leaves/{leave_id}/decision", json={"action": "reject", "approver": "mgr"}, timeout=30)
    assert r.json()["status"] == "rejected"


def test_leave_cancel():
    _, emp, _ = _seed_employee()
    lv = requests.post(f"{API}/api/public/leaves/apply", json={
        "employee_id": emp["employee_id"], "leave_type": "casual",
        "from_date": "2026-04-01", "to_date": "2026-04-01",
    }, timeout=30).json()["leave"]
    r = requests.post(f"{API}/api/public/leaves/{lv['leave_id']}/cancel", json={"reason": "Not needed"}, timeout=30)
    assert r.status_code == 200

    # Second cancel → 400
    r = requests.post(f"{API}/api/public/leaves/{lv['leave_id']}/cancel", json={}, timeout=30)
    assert r.status_code == 400


def test_leave_balance_computes_remaining():
    _, emp, _ = _seed_employee()
    # Apply + approve 2 casual leaves totalling 5 days (single leave)
    lv = requests.post(f"{API}/api/public/leaves/apply", json={
        "employee_id": emp["employee_id"], "leave_type": "casual",
        "from_date": "2026-05-04", "to_date": "2026-05-08",
    }, timeout=30).json()["leave"]
    requests.post(f"{API}/api/public/leaves/{lv['leave_id']}/decision", json={"action": "approve", "approver": "mgr"}, timeout=30)

    r = requests.get(f"{API}/api/public/leaves/balance/{emp['employee_id']}?year=2026", timeout=30).json()
    casual = next(b for b in r["balance"] if b["leave_type"] == "casual")
    assert casual["entitlement"] == 12
    assert casual["used"] >= 5
    assert casual["remaining"] <= 7
