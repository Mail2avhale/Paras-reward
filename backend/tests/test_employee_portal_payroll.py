"""Backend tests for Employee Self-Service Portal + Payroll + Org Chart.

Covers:
- Employee portal auth (login lockout, JWT, /me, change password)
- Own attendance / leaves apply + cancel + balance
- Announcements audience filtering
- Payroll config, salary structure, run, payslip PDF, statutory CSVs, NEFT
- Org chart tree, cycle detection, set manager
"""
import os
import io
import uuid
import pytest
import httpx
from datetime import datetime, timezone

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "https://formula-audit-fix.preview.emergentagent.com"
API = f"{BASE}/api"


# ---------------- Fixtures ----------------

def _uid(prefix="T"):
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


@pytest.fixture(scope="module")
def created_employee():
    """Create an application (multipart with resume), convert to employee. Returns (employee_id, name, email)."""
    with httpx.Client(base_url=API, timeout=30) as c:
        email = f"test_{_uid()}@paras.test"
        jobs = c.get("/public/careers/jobs").json().get("jobs", [])
        assert jobs, "Need at least one active job in DB"
        job = jobs[0]
        # Apply — multipart with resume file
        r = c.post(
            "/public/careers/apply",
            data={"job_id": job["job_id"], "name": f"Portal Test {_uid('N')}", "email": email, "phone": "9998887777"},
            files={"resume": ("r.pdf", b"%PDF-1.4\nself-service", "application/pdf")},
        )
        assert r.status_code == 200, r.text
        app_id = r.json()["application_id"]

        # Convert to employee
        r = c.post("/public/employees/from-application", json={"application_id": app_id, "admin_id": "test-admin"})
        assert r.status_code == 200, r.text
        emp = r.json()["employee"]
        yield emp["employee_id"], emp["name"], emp["email"]


# ---------------- Employee auth ----------------

def test_login_disabled_by_default(created_employee):
    eid, _, _ = created_employee
    with httpx.Client(base_url=API, timeout=10) as c:
        r = c.post("/public/employee/login", json={"employee_id": eid, "password": "anything"})
        assert r.status_code == 401


def test_admin_set_password_and_login_flow(created_employee):
    eid, name, _ = created_employee
    with httpx.Client(base_url=API, timeout=15) as c:
        # Admin sets password
        r = c.post("/public/hr/employees/set-password", json={"employee_id": eid, "password": "SecretP@ss1", "admin_id": "test-admin"})
        assert r.status_code == 200

        # Employee login
        r = c.post("/public/employee/login", json={"employee_id": eid, "password": "SecretP@ss1"})
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        assert token and r.json()["employee"]["name"] == name

        # /me works with token
        r = c.get("/public/employee/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["employee"]["employee_id"] == eid

        # /me without token → 401
        r = c.get("/public/employee/me")
        assert r.status_code == 401


def test_change_password(created_employee):
    eid, _, _ = created_employee
    with httpx.Client(base_url=API, timeout=15) as c:
        c.post("/public/hr/employees/set-password", json={"employee_id": eid, "password": "OldPass1!", "admin_id": "test-admin"})
        token = c.post("/public/employee/login", json={"employee_id": eid, "password": "OldPass1!"}).json()["token"]
        # Change with wrong current
        r = c.post("/public/employee/change-password",
                   json={"current_password": "wrong", "new_password": "NewPass2!"},
                   headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 400
        # Correct change
        r = c.post("/public/employee/change-password",
                   json={"current_password": "OldPass1!", "new_password": "NewPass2!"},
                   headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        # New password works
        r = c.post("/public/employee/login", json={"employee_id": eid, "password": "NewPass2!"})
        assert r.status_code == 200


def test_lockout_after_failed_attempts(created_employee):
    eid, _, _ = created_employee
    with httpx.Client(base_url=API, timeout=15) as c:
        c.post("/public/hr/employees/set-password", json={"employee_id": eid, "password": "Lockout1!", "admin_id": "test-admin"})
        # 5 failed
        for _ in range(5):
            c.post("/public/employee/login", json={"employee_id": eid, "password": "bad"})
        # 6th should say locked
        r = c.post("/public/employee/login", json={"employee_id": eid, "password": "Lockout1!"})
        assert r.status_code == 423
        # Admin unlock
        c.post("/public/hr/employees/set-password", json={"employee_id": eid, "password": "Lockout1!", "admin_id": "test-admin"})
        r = c.post("/public/employee/login", json={"employee_id": eid, "password": "Lockout1!"})
        assert r.status_code == 200


# ---------------- Self-service data ----------------

def _login(c, eid, pw="Selfserv1!"):
    c.post("/public/hr/employees/set-password", json={"employee_id": eid, "password": pw, "admin_id": "test-admin"})
    return c.post("/public/employee/login", json={"employee_id": eid, "password": pw}).json()["token"]


def test_own_attendance_and_leave_flow(created_employee):
    eid, _, _ = created_employee
    with httpx.Client(base_url=API, timeout=15) as c:
        token = _login(c, eid)
        hdrs = {"Authorization": f"Bearer {token}"}

        # Apply leave
        today = datetime.now(timezone.utc).date().isoformat()
        r = c.post("/public/employee/leaves/apply", headers=hdrs, json={
            "leave_type": "casual", "from_date": today, "to_date": today, "reason": "self test",
        })
        assert r.status_code == 200
        leave_id = r.json()["leave"]["leave_id"]

        # List own leaves
        r = c.get("/public/employee/leaves", headers=hdrs)
        assert r.status_code == 200
        assert any(lv["leave_id"] == leave_id for lv in r.json()["leaves"])

        # Balance
        r = c.get("/public/employee/leaves/balance", headers=hdrs)
        assert r.status_code == 200
        assert any(b["leave_type"] == "casual" for b in r.json()["balance"])

        # Cancel
        r = c.post(f"/public/employee/leaves/{leave_id}/cancel", headers=hdrs)
        assert r.status_code == 200

        # Attendance (empty month is fine)
        r = c.get("/public/employee/attendance", headers=hdrs)
        assert r.status_code == 200
        assert "summary" in r.json()


def test_announcements_visibility(created_employee):
    eid, _, _ = created_employee
    with httpx.Client(base_url=API, timeout=15) as c:
        # Admin creates an "all" announcement
        r = c.post("/public/hr/announcements", json={
            "title": f"Test all {_uid()}", "body": "everyone sees this", "audience": "all", "pinned": True,
        })
        assert r.status_code == 200
        aid_all = r.json()["announcement"]["announcement_id"]

        # Get employee's dept
        emp = c.get("/public/employee/me", headers={"Authorization": f"Bearer {_login(c, eid)}"}).json()["employee"]
        dept = emp.get("department") or "Technology"

        # Admin creates a dept-specific one
        r = c.post("/public/hr/announcements", json={
            "title": f"Dept-only {_uid()}", "body": "dept only", "audience": f"department:{dept}",
        })
        aid_dept = r.json()["announcement"]["announcement_id"]

        # Employee sees both
        token = _login(c, eid)
        r = c.get("/public/employee/announcements", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        ids = {a["announcement_id"] for a in r.json()["announcements"]}
        assert aid_all in ids and aid_dept in ids

        # Cleanup
        c.delete(f"/public/hr/announcements/{aid_all}")
        c.delete(f"/public/hr/announcements/{aid_dept}")


# ---------------- Payroll ----------------

def test_payroll_config_and_component_math():
    """Direct unit test of the pure component math (imports module directly to avoid routes/__init__)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("hr_payroll_test", "/app/backend/routes/hr_payroll.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    out = mod.compute_payslip_components(monthly_ctc=50000, unpaid_days=0, working_days=26, month="2026-01", cfg=mod.DEFAULTS)
    assert out["earnings"]["basic"] == 25000.0
    assert out["earnings"]["hra"] == 10000.0
    assert out["earnings"]["gross"] == 50000.0
    assert out["deductions"]["pf"] == 1800.0   # 12% of 15000 cap
    assert out["deductions"]["esi"] == 0.0     # gross > 21k
    assert out["net_pay"] > 0
    # With LOP
    out2 = mod.compute_payslip_components(50000, 2, 26, "2026-02", mod.DEFAULTS)
    assert out2["deductions"]["lop"] > 0
    assert out2["net_pay"] < out["net_pay"]


def test_payroll_full_run_and_reports(created_employee):
    eid, _, _ = created_employee
    with httpx.Client(base_url=API, timeout=30) as c:
        # Set salary structure
        r = c.post(f"/public/payroll/salary-structure/{eid}", json={
            "monthly_ctc": 60000, "bank_account": "1234567890", "ifsc": "HDFC0000001",
            "pan": "ABCDE1234F", "pf_uan": "UAN123456789", "admin_id": "test-admin",
        })
        assert r.status_code == 200

        # Use a unique month string in the future so no collision
        # Use 12 months from now to guarantee uniqueness
        month = "2099-12"

        # Cancel any prior fake run for that month
        prior = c.get("/public/payroll/runs").json()["runs"]
        for pr in prior:
            if pr["month"] == month and pr["status"] != "cancelled":
                c.delete(f"/public/payroll/run/{pr['run_id']}")

        r = c.post("/public/payroll/run", json={"month": month, "employee_ids": [eid], "admin_id": "test-admin"})
        assert r.status_code == 200, r.text
        run = r.json()["run"]
        assert run["total_employees"] == 1
        run_id = run["run_id"]

        # Idempotency: second run for same month should 400
        r = c.post("/public/payroll/run", json={"month": month, "employee_ids": [eid]})
        assert r.status_code == 400

        # Fetch run detail
        r = c.get(f"/public/payroll/run/{run_id}")
        assert r.status_code == 200
        payslips = r.json()["payslips"]
        assert len(payslips) == 1
        ps_id = payslips[0]["payslip_id"]

        # Payslip PDF renders
        r = c.get(f"/public/payroll/payslip/{ps_id}/pdf")
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert len(r.content) > 500

        # Employee sees own payslips via portal
        token = _login(c, eid)
        r = c.get("/public/employee/payslips", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert any(p["payslip_id"] == ps_id for p in r.json()["payslips"])

        # Employee downloads own payslip PDF
        r = c.get(f"/public/employee/payslips/{ps_id}/pdf", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert len(r.content) > 500

        # Statutory reports CSV
        for path in [f"/public/payroll/reports/pf?month={month}",
                     f"/public/payroll/reports/esi?month={month}",
                     f"/public/payroll/reports/pt?month={month}",
                     f"/public/payroll/reports/neft?run_id={run_id}"]:
            r = c.get(path)
            assert r.status_code == 200, f"{path} → {r.status_code}"
            assert "text/csv" in r.headers.get("content-type", "")
            assert eid in r.text or "employee_id" in r.text

        # TDS quarterly report (Q4 covers Jan-Feb-Mar of year)
        r = c.get("/public/payroll/reports/tds?quarter=2099-Q4")
        # Q4 = jan/feb/mar; our month is 2099-12 which is Q3 so should give empty rows but 200 OK
        assert r.status_code == 200

        # Cleanup
        c.delete(f"/public/payroll/run/{run_id}")


# ---------------- Org Chart ----------------

def test_orgchart_tree_and_cycle_detection():
    with httpx.Client(base_url=API, timeout=15) as c:
        r = c.get("/public/orgchart/tree")
        assert r.status_code == 200
        d = r.json()
        assert "tree" in d and "total_employees" in d and "orphans" in d
        assert d["total_employees"] > 0

        # Cycle detection: pick any two employees
        flat = c.get("/public/orgchart/flat").json()["employees"]
        if len(flat) >= 2:
            a, b = flat[0]["employee_id"], flat[1]["employee_id"]
            # Set b.reports_to = a
            r = c.patch(f"/public/orgchart/employees/{b}", json={"reports_to": a})
            assert r.status_code == 200
            # Now try a.reports_to = b (cycle)
            r = c.patch(f"/public/orgchart/employees/{a}", json={"reports_to": b})
            assert r.status_code == 400
            # Cleanup
            c.patch(f"/public/orgchart/employees/{b}", json={"reports_to": None})

        # Cannot report to self
        if flat:
            a = flat[0]["employee_id"]
            r = c.patch(f"/public/orgchart/employees/{a}", json={"reports_to": a})
            assert r.status_code == 400
