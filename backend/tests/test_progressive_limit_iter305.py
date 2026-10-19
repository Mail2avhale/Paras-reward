# Iteration 305: Unified progressive redeem limit (bank redeem + recharge) + object storage regression
import os
import io
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
TEST_UID = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"  # 9970100782

_mc = MongoClient("mongodb://localhost:27017")
mdb = _mc["paras_reward_db"]


def _cap(n):
    return 5 * n * (n + 1)


BANK = {"account_holder_name": "TEST User", "account_number": "123456789012", "ifsc_code": "SBIN0000001"}


@pytest.fixture
def restore_user():
    """Snapshot limit/block fields and restore after the test."""
    u = mdb.users.find_one({"uid": TEST_UID}, {"_id": 0, "redemption_limit_used_prc": 1,
                                              "bank_redeem_blocked": 1, "bank_redeem_blocked_reason": 1})
    yield u
    s, uns = {}, {}
    for k in ["redemption_limit_used_prc", "bank_redeem_blocked", "bank_redeem_blocked_reason"]:
        if k in u:
            s[k] = u[k]
        else:
            uns[k] = ""
    upd = {}
    if s:
        upd["$set"] = s
    if uns:
        upd["$unset"] = uns
    mdb.users.update_one({"uid": TEST_UID}, upd)


# ---- Progressive limit status API ----
class TestStatus:
    def test_status_formula(self):
        r = requests.get(f"{BASE_URL}/api/redemption-limit/status/{TEST_UID}")
        assert r.status_code == 200
        d = r.json()
        n = d["day_number"]
        assert d["cumulative_cap"] == _cap(n)
        assert d["available_prc"] == max(0, d["cumulative_cap"] - d["used_prc"])
        assert d["prc_rate"] == 10


# ---- Bank transfer request uses progressive limit ----
class TestBankTransferLimit:
    def test_exceeds_limit_returns_400(self, restore_user):
        st = requests.get(f"{BASE_URL}/api/redemption-limit/status/{TEST_UID}").json()
        # leave 500 PRC available -> ₹100 (1000 PRC) must be rejected
        mdb.users.update_one({"uid": TEST_UID}, {"$set": {"redemption_limit_used_prc": float(st["cumulative_cap"] - 500)}})
        mdb.users.update_one({"uid": TEST_UID}, {"$unset": {"bank_redeem_blocked": ""}})
        before = mdb.bank_transfer_requests.count_documents({"user_id": TEST_UID})
        r = requests.post(f"{BASE_URL}/api/bank-transfer/request",
                          json={"user_id": TEST_UID, "amount": 100, "bank_details": BANK})
        print(r.status_code, r.text)
        assert r.status_code == 400, r.text
        assert "Available PRC LIMIT = 500 PRC" in r.json()["detail"]
        assert mdb.bank_transfer_requests.count_documents({"user_id": TEST_UID}) == before

    def test_lifetime_cap_not_enforced_message(self, restore_user):
        # with limit exhausted, error must be the progressive one, never the ₹2,500 lifetime one
        st = requests.get(f"{BASE_URL}/api/redemption-limit/status/{TEST_UID}").json()
        mdb.users.update_one({"uid": TEST_UID}, {"$set": {"redemption_limit_used_prc": float(st["cumulative_cap"])}})
        r = requests.post(f"{BASE_URL}/api/bank-transfer/request",
                          json={"user_id": TEST_UID, "amount": 1000, "bank_details": BANK})
        assert r.status_code == 400
        assert "Lifetime" not in r.text and "2,500" not in r.text
        assert "Available PRC LIMIT = 0 PRC" in r.json()["detail"]

    def test_blocked_returns_403(self, restore_user):
        mdb.users.update_one({"uid": TEST_UID}, {"$set": {"bank_redeem_blocked": True,
                                                         "bank_redeem_blocked_reason": "TEST blocked"}})
        r = requests.post(f"{BASE_URL}/api/bank-transfer/request",
                          json={"user_id": TEST_UID, "amount": 100, "bank_details": BANK})
        assert r.status_code == 403
        assert r.json()["detail"] == "TEST blocked"

    def test_invalid_amount_400(self):
        r = requests.post(f"{BASE_URL}/api/bank-transfer/request",
                          json={"user_id": TEST_UID, "amount": 150, "bank_details": BANK})
        assert r.status_code == 400
        assert "Invalid amount" in r.json()["detail"]


# ---- Object storage migration regression ----
class TestObjectStorage:
    def test_investor_doc_upload_download_delete(self):
        content = b"%PDF-1.4 TEST investor doc " + uuid.uuid4().hex.encode()
        r = requests.post(f"{BASE_URL}/api/public/investors/documents/upload",
                          data={"title": "TEST_doc", "doc_type": "pitch", "password": "", "admin_id": "TEST"},
                          files={"file": ("TEST_doc.pdf", io.BytesIO(content), "application/pdf")})
        assert r.status_code == 200, r.text
        doc_id = r.json()["doc_id"]
        try:
            d = requests.post(f"{BASE_URL}/api/public/investors/documents/{doc_id}/download", json={})
            assert d.status_code == 200, d.text
            assert d.content == content
        finally:
            x = requests.delete(f"{BASE_URL}/api/public/investors/documents/{doc_id}")
            assert x.status_code == 200
        assert mdb.investor_documents.count_documents({"doc_id": doc_id}) == 0

    def test_community_image_upload_and_get(self):
        post_id = f"TEST_post_{uuid.uuid4().hex[:8]}"
        mdb.community_posts.insert_one({"post_id": post_id, "user_id": "TEST", "title": "TEST", "content": "TEST",
                                        "category": "general", "status": "deleted"})
        try:
            png = (b"\x89PNG\r\n\x1a\n" + b"\x00" * 64)
            r = requests.post(f"{BASE_URL}/api/community/posts/{post_id}/upload-image",
                              files={"file": ("t.png", io.BytesIO(png), "image/png")})
            assert r.status_code == 200, r.text
            assert r.json()["image_url"] == f"/api/community/image/{post_id}"
            g = requests.get(f"{BASE_URL}/api/community/image/{post_id}")
            assert g.status_code == 200
            assert g.content == png
            assert "image" in g.headers.get("content-type", "")
        finally:
            mdb.community_posts.delete_one({"post_id": post_id})


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": "admin@test.com", "password": "153759"})
    if r.status_code != 200 or not r.json().get("token"):
        pytest.skip(f"admin login failed {r.status_code}")
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ---- Misc regression (route shadowing / ObjectId) ----
class TestMiscRegression:
    def test_tests_assignments_json(self):
        r = requests.get(f"{BASE_URL}/api/public/tests/assignments")
        print(r.status_code, r.text[:300])
        assert r.status_code in (200, 400, 401, 403, 422)
        assert r.headers.get("content-type", "").startswith("application/json")
        assert "Test not found" not in r.text

    def test_admin_video_ads(self, admin_headers):
        urls = [f"{BASE_URL}/api/admin/video-ads", f"{BASE_URL}/api/admin/accounting/admin/video-ads"]
        res = {u: requests.get(u, headers=admin_headers) for u in urls}
        for u, r in res.items():
            print(u, r.status_code, r.text[:200])
        assert any(r.status_code == 200 and "video_ads" in r.json() for r in res.values())

    def test_ledger_subscription_income_post(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/ledger/subscription-income",
                          json={"user_id": "TEST_ledger", "plan_name": "TEST", "amount": 1}, headers=admin_headers)
        print(r.status_code, r.text[:300])
        try:
            assert r.status_code == 200, r.text
            e = r.json()["entry"]
            assert "_id" not in e and e["user_id"] == "TEST_ledger"
        finally:
            mdb.subscription_income_ledger.delete_many({"user_id": "TEST_ledger"})
