"""
Tests for:
- Employee self-service endpoints (/api/employees/reports/my/*)
- Dashboard pool_wallet.total_distributed bug fix
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Test user linked to EMP-0001
TEST_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
# Another uid not linked to any employee
NON_EMP_UID = "6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Employee self-service ----------

class TestEmployeeSelfServiceProfile:
    def test_my_profile_linked_user_returns_200(self, session):
        r = session.get(f"{API}/employees/reports/my/profile", params={"user_id": TEST_UID}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert "employee" in data
        emp = data["employee"]
        assert emp.get("employee_id") == "EMP-0001"
        # Sanitized
        assert "_id" not in emp
        assert "documents" not in emp
        # Leave + pool blocks
        assert "leave_balance" in data
        assert "cl" in data["leave_balance"]
        assert "remaining" in data["leave_balance"]["cl"]
        assert "pool_this_month" in data
        assert "pool_ytd" in data

    def test_my_profile_non_employee_returns_404(self, session):
        r = session.get(f"{API}/employees/reports/my/profile", params={"user_id": NON_EMP_UID}, timeout=10)
        assert r.status_code == 404, r.text

    def test_my_profile_missing_user_id_returns_422(self, session):
        r = session.get(f"{API}/employees/reports/my/profile", timeout=10)
        assert r.status_code == 422


class TestEmployeeSelfServiceYTD:
    def test_my_ytd_ok(self, session):
        r = session.get(f"{API}/employees/reports/my/ytd",
                        params={"user_id": TEST_UID, "fy_start_year": 2026}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # ytd_earnings returns a dict; should NOT leak _id
        assert "_id" not in str(data)[:500] or '"_id"' not in r.text
        # Should have some YTD keys (employee_id or fy)
        assert isinstance(data, dict)

    def test_my_ytd_non_employee_404(self, session):
        r = session.get(f"{API}/employees/reports/my/ytd",
                        params={"user_id": NON_EMP_UID, "fy_start_year": 2026}, timeout=10)
        assert r.status_code == 404


class TestEmployeeSelfServicePoolHistory:
    def test_my_pool_history_ok(self, session):
        r = session.get(f"{API}/employees/reports/my/pool-history",
                        params={"user_id": TEST_UID}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert data.get("employee_id") == "EMP-0001"
        assert isinstance(data.get("transactions"), list)
        assert "total_earned" in data
        assert "count" in data
        # ensure no raw _id leaked
        for t in data["transactions"]:
            assert "_id" not in t

    def test_my_pool_history_non_employee_404(self, session):
        r = session.get(f"{API}/employees/reports/my/pool-history",
                        params={"user_id": NON_EMP_UID}, timeout=10)
        assert r.status_code == 404


class TestEmployeeSelfServiceLeaveHistory:
    def test_my_leave_history_ok(self, session):
        r = session.get(f"{API}/employees/reports/my/leave-history",
                        params={"user_id": TEST_UID}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert isinstance(data.get("leaves"), list)
        assert "count" in data
        for lv in data["leaves"]:
            assert "_id" not in lv

    def test_my_leave_history_non_employee_404(self, session):
        r = session.get(f"{API}/employees/reports/my/leave-history",
                        params={"user_id": NON_EMP_UID}, timeout=10)
        assert r.status_code == 404


class TestEmployeeSelfServiceAttendance:
    def test_my_attendance_ok(self, session):
        r = session.get(f"{API}/employees/reports/my/attendance",
                        params={"user_id": TEST_UID, "month": 1, "year": 2026}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert data.get("month") == 1
        assert data.get("year") == 2026
        assert "days" in data and isinstance(data["days"], list)
        assert "summary" in data
        for d in data["days"]:
            assert "_id" not in d

    def test_my_attendance_non_employee_404(self, session):
        r = session.get(f"{API}/employees/reports/my/attendance",
                        params={"user_id": NON_EMP_UID, "month": 1, "year": 2026}, timeout=10)
        assert r.status_code == 404

    def test_my_attendance_invalid_month(self, session):
        r = session.get(f"{API}/employees/reports/my/attendance",
                        params={"user_id": TEST_UID, "month": 13, "year": 2026}, timeout=10)
        assert r.status_code == 422


# ---------- Dashboard Pool Wallet bug ----------

class TestDashboardPoolWallet:
    def test_dashboard_returns_pool_wallet_with_total_distributed(self, session):
        r = session.get(f"{API}/user/{TEST_UID}/dashboard", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "pool_wallet" in data, "pool_wallet missing"
        pw = data["pool_wallet"]
        # Field MUST now be present (bug fix)
        assert "total_distributed" in pw, f"total_distributed missing in pool_wallet: {pw}"
        assert "balance" in pw
        assert "core_team_count" in pw
        assert "is_core_member" in pw
        assert isinstance(pw["total_distributed"], (int, float))
        # Given distributions exist on EMP-0001, expect > 0
        # Pool-history total_earned should correspond
        ph = session.get(f"{API}/employees/reports/my/pool-history",
                         params={"user_id": TEST_UID}, timeout=10).json()
        if ph.get("total_earned", 0) > 0:
            assert pw["total_distributed"] > 0, (
                f"Dashboard total_distributed=0 but pool history shows {ph['total_earned']}"
            )
        print(f"pool_wallet: balance={pw['balance']} total_distributed={pw['total_distributed']}")
