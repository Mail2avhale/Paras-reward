# Eko v3: operator detect, plans list, admin pay-api switch (iter 315). Read-only Eko calls; never initiate.
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
MOBILE = "9936606966"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": "admin@test.com", "password": "153759", "device_id": f"t-{uuid.uuid4()}"})
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code}")
    d = r.json()
    tok = d.get("token") or d.get("access_token")
    return {"Authorization": f"Bearer {tok}"}


# Operator detection
class TestDetect:
    def test_detect_jio(self):
        r = requests.get(f"{BASE_URL}/api/recharge/detect-operator/{MOBILE}", timeout=40)
        assert r.status_code == 200, r.text
        d = r.json()
        print(d)
        assert d["success"] is True
        assert d["operator_id"] == "90"
        assert d["circle"] == "14"

    @pytest.mark.parametrize("num", ["123", "5936606966", "99366069661", "abcdefghij"])
    def test_detect_invalid(self, num):
        r = requests.get(f"{BASE_URL}/api/recharge/detect-operator/{num}", timeout=20)
        assert r.status_code == 400
        assert "valid" in r.json().get("detail", "").lower()


# Plans list
class TestPlans:
    def test_plans_sorted(self):
        r = requests.get(f"{BASE_URL}/api/recharge/plans/{MOBILE}",
                         params={"operator_id": "90", "circle": "14"}, timeout=40)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["available"] is True
        plans = d["plans"]
        print("plan count", len(plans), plans[:3])
        assert len(plans) > 0
        amts = [p["amount"] for p in plans]
        assert amts == sorted(amts)
        for p in plans:
            assert set(p.keys()) == {"amount", "validity", "description"}
            assert isinstance(p["amount"], int) and p["amount"] > 0
        dup = len(amts) - len(set(amts))
        print("duplicate amounts:", dup)

    def test_plans_missing_params(self):
        r = requests.get(f"{BASE_URL}/api/recharge/plans/{MOBILE}", timeout=20)
        assert r.status_code == 422


# Admin pay-api switch
class TestPayApi:
    def test_unauth(self):
        assert requests.get(f"{BASE_URL}/api/recharge/admin/pay-api").status_code == 401
        assert requests.post(f"{BASE_URL}/api/recharge/admin/pay-api/v3").status_code == 401

    def test_switch_flow(self, admin_headers):
        h = admin_headers
        r = requests.get(f"{BASE_URL}/api/recharge/admin/pay-api", headers=h)
        assert r.status_code == 200 and r.json()["pay_api"] == "v2"
        try:
            r = requests.post(f"{BASE_URL}/api/recharge/admin/pay-api/v3", headers=h)
            assert r.status_code == 200 and r.json()["pay_api"] == "v3"
            assert requests.get(f"{BASE_URL}/api/recharge/admin/pay-api", headers=h).json()["pay_api"] == "v3"
            r = requests.post(f"{BASE_URL}/api/recharge/admin/pay-api/v9", headers=h)
            assert r.status_code == 400
            assert requests.get(f"{BASE_URL}/api/recharge/admin/pay-api", headers=h).json()["pay_api"] == "v3"
        finally:
            r = requests.post(f"{BASE_URL}/api/recharge/admin/pay-api/v2", headers=h)
            assert r.status_code == 200
        assert requests.get(f"{BASE_URL}/api/recharge/admin/pay-api", headers=h).json()["pay_api"] == "v2"
