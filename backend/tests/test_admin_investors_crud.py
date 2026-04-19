"""
Admin Investors Panel Backend Tests
Covers: FAQ, Team, Press, Documents (upload/list/download/delete),
Inquiries (list/status-update/delete), Metrics
All endpoints live under /api/public/investors/* (no auth gate).
"""
import os
import io
import pytest
import requests

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        env_path = "/app/frontend/.env"
        if os.path.exists(env_path):
            with open(env_path) as fh:
                for line in fh:
                    if line.strip().startswith("REACT_APP_BACKEND_URL="):
                        url = line.strip().split("=", 1)[1].strip().strip('"').strip("'")
                        break
    assert url, "REACT_APP_BACKEND_URL not configured"
    return url.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api/public/investors"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    return s


# ---------- FAQ ----------
class TestInvestorFAQ:
    faq_id = None

    def test_list_faqs(self, client):
        r = client.get(f"{API}/faq")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "faqs" in data and isinstance(data["faqs"], list)

    def test_create_faq(self, client):
        payload = {"question": "TEST_Q?", "answer": "TEST_A", "order": 50}
        r = client.post(f"{API}/faq", json=payload)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        # Fetch list and capture created id
        lst = client.get(f"{API}/faq").json()["faqs"]
        created = [f for f in lst if f.get("question") == "TEST_Q?"]
        assert created, "Newly created FAQ not found in list"
        TestInvestorFAQ.faq_id = created[0].get("faq_id")
        assert TestInvestorFAQ.faq_id, "faq_id missing on created FAQ"

    def test_update_faq(self, client):
        assert TestInvestorFAQ.faq_id
        payload = {
            "faq_id": TestInvestorFAQ.faq_id,
            "question": "TEST_Q_UPDATED?",
            "answer": "TEST_A_UPDATED",
            "order": 51,
        }
        r = client.post(f"{API}/faq", json=payload)
        assert r.status_code == 200

        lst = client.get(f"{API}/faq").json()["faqs"]
        match = [f for f in lst if f.get("faq_id") == TestInvestorFAQ.faq_id]
        assert match and match[0]["question"] == "TEST_Q_UPDATED?"
        assert match[0]["answer"] == "TEST_A_UPDATED"

    def test_delete_faq(self, client):
        assert TestInvestorFAQ.faq_id
        r = client.delete(f"{API}/faq/{TestInvestorFAQ.faq_id}")
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        lst = client.get(f"{API}/faq").json()["faqs"]
        assert not any(f.get("faq_id") == TestInvestorFAQ.faq_id for f in lst)

    def test_delete_faq_not_found(self, client):
        r = client.delete(f"{API}/faq/FAQ-nonexistent-xyz")
        assert r.status_code == 404


# ---------- TEAM ----------
class TestInvestorTeam:
    member_id = None

    def test_list_team(self, client):
        r = client.get(f"{API}/team")
        assert r.status_code == 200
        assert "team" in r.json()

    def test_create_team_member(self, client):
        payload = {
            "name": "TEST_Founder",
            "role": "TEST_CTO",
            "bio": "TEST_bio",
            "linkedin": "https://linkedin.com/in/test",
            "order": 99,
        }
        r = client.post(f"{API}/team", json=payload)
        assert r.status_code == 200, r.text

        team = client.get(f"{API}/team").json()["team"]
        match = [m for m in team if m.get("name") == "TEST_Founder"]
        assert match
        TestInvestorTeam.member_id = match[0]["member_id"]
        assert TestInvestorTeam.member_id.startswith("TM-")

    def test_update_team_member(self, client):
        assert TestInvestorTeam.member_id
        payload = {
            "member_id": TestInvestorTeam.member_id,
            "name": "TEST_Founder_Updated",
            "role": "TEST_CEO",
            "bio": "TEST_bio_updated",
            "order": 98,
        }
        r = client.post(f"{API}/team", json=payload)
        assert r.status_code == 200

        team = client.get(f"{API}/team").json()["team"]
        match = [m for m in team if m.get("member_id") == TestInvestorTeam.member_id]
        assert match and match[0]["name"] == "TEST_Founder_Updated"
        assert match[0]["role"] == "TEST_CEO"

    def test_delete_team_member(self, client):
        assert TestInvestorTeam.member_id
        r = client.delete(f"{API}/team/{TestInvestorTeam.member_id}")
        assert r.status_code == 200

        team = client.get(f"{API}/team").json()["team"]
        assert not any(m.get("member_id") == TestInvestorTeam.member_id for m in team)

    def test_delete_team_member_not_found(self, client):
        r = client.delete(f"{API}/team/TM-doesnotexist")
        assert r.status_code == 404


# ---------- PRESS ----------
class TestInvestorPress:
    press_id = None

    def test_list_press(self, client):
        r = client.get(f"{API}/press")
        assert r.status_code == 200
        assert "press" in r.json()

    def test_create_press(self, client):
        payload = {
            "title": "TEST_PressTitle",
            "summary": "TEST_summary",
            "url": "https://example.com",
            "source": "TEST_Source",
            "date": "2026-01-15",
        }
        r = client.post(f"{API}/press", json=payload)
        assert r.status_code == 200
        assert r.json().get("success") is True

        press = client.get(f"{API}/press").json()["press"]
        match = [p for p in press if p.get("title") == "TEST_PressTitle"]
        assert match
        TestInvestorPress.press_id = match[0]["press_id"]
        assert TestInvestorPress.press_id.startswith("PR-")

    def test_delete_press(self, client):
        assert TestInvestorPress.press_id
        r = client.delete(f"{API}/press/{TestInvestorPress.press_id}")
        assert r.status_code == 200

        press = client.get(f"{API}/press").json()["press"]
        assert not any(p.get("press_id") == TestInvestorPress.press_id for p in press)

    def test_delete_press_not_found(self, client):
        r = client.delete(f"{API}/press/PR-nonexistent")
        assert r.status_code == 404


# ---------- DOCUMENTS ----------
class TestInvestorDocuments:
    doc_id = None
    filepath = None

    def _dummy_pdf(self):
        # Minimal valid-ish PDF bytes (not rendering, but fine as file bytes)
        return b"%PDF-1.4\n%TEST_INVESTOR_DOC\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"

    def test_upload_document(self, client):
        pdf_bytes = self._dummy_pdf()
        files = {"file": ("test_pitch.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        data = {
            "title": "TEST_PitchDeck",
            "doc_type": "pitch_deck",
            "password": "secret123",
            "admin_id": "admin@test.com",
        }
        r = client.post(f"{API}/documents/upload", files=files, data=data)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        TestInvestorDocuments.doc_id = body.get("doc_id")
        assert TestInvestorDocuments.doc_id and TestInvestorDocuments.doc_id.startswith("DOC-")

        # Verify physical file exists
        expected_dir = "/app/backend/uploads/investor_docs"
        files_on_disk = [f for f in os.listdir(expected_dir)
                         if f.startswith(TestInvestorDocuments.doc_id)]
        assert files_on_disk, "Uploaded file not found on disk"
        TestInvestorDocuments.filepath = os.path.join(expected_dir, files_on_disk[0])

    def test_list_documents_excludes_sensitive(self, client):
        r = client.get(f"{API}/documents")
        assert r.status_code == 200
        docs = r.json()["documents"]
        match = [d for d in docs if d.get("doc_id") == TestInvestorDocuments.doc_id]
        assert match
        d = match[0]
        assert "filepath" not in d, "filepath should be excluded from public list"
        assert "password" not in d, "password should be excluded from public list"
        assert d.get("is_protected") is True
        assert d.get("title") == "TEST_PitchDeck"

    def test_download_wrong_password(self, client):
        assert TestInvestorDocuments.doc_id
        r = client.post(
            f"{API}/documents/{TestInvestorDocuments.doc_id}/download",
            json={"password": "wrong"},
        )
        assert r.status_code == 403

    def test_download_correct_password(self, client):
        assert TestInvestorDocuments.doc_id
        r = client.post(
            f"{API}/documents/{TestInvestorDocuments.doc_id}/download",
            json={"password": "secret123"},
        )
        assert r.status_code == 200
        assert r.content.startswith(b"%PDF")

    def test_download_not_found(self, client):
        r = client.post(f"{API}/documents/DOC-doesnotexist/download", json={"password": ""})
        assert r.status_code == 404

    def test_delete_document_removes_file(self, client):
        assert TestInvestorDocuments.doc_id
        assert TestInvestorDocuments.filepath
        assert os.path.exists(TestInvestorDocuments.filepath)

        r = client.delete(f"{API}/documents/{TestInvestorDocuments.doc_id}")
        assert r.status_code == 200

        # File removed from disk
        assert not os.path.exists(TestInvestorDocuments.filepath), "Physical file should be removed"

        # Doc removed from listing
        docs = client.get(f"{API}/documents").json()["documents"]
        assert not any(d.get("doc_id") == TestInvestorDocuments.doc_id for d in docs)


# ---------- INQUIRIES ----------
class TestInvestorInquiries:
    inquiry_id = None

    def test_create_inquiry_via_contact(self, client):
        payload = {
            "name": "TEST_Investor",
            "email": "test_inv@example.com",
            "phone": "+911234567890",
            "organization": "TEST_Fund",
            "investment_range": "10L-1Cr",
            "message": "TEST_interest",
        }
        r = client.post(f"{API}/contact", json=payload)
        assert r.status_code == 200
        assert r.json().get("success") is True

        lst = client.get(f"{API}/inquiries").json()["inquiries"]
        match = [i for i in lst if i.get("name") == "TEST_Investor"
                 and i.get("email") == "test_inv@example.com"]
        assert match
        TestInvestorInquiries.inquiry_id = match[0]["inquiry_id"]
        assert match[0]["status"] == "new"

    def test_list_inquiries(self, client):
        r = client.get(f"{API}/inquiries")
        assert r.status_code == 200
        assert isinstance(r.json().get("inquiries"), list)

    @pytest.mark.parametrize("status", ["contacted", "in_discussion", "closed", "rejected", "new"])
    def test_update_inquiry_status_all_valid(self, client, status):
        assert TestInvestorInquiries.inquiry_id
        r = client.put(
            f"{API}/inquiries/{TestInvestorInquiries.inquiry_id}",
            json={"status": status, "note": f"TEST_note_{status}"},
        )
        assert r.status_code == 200, r.text
        assert status in r.json().get("message", "")

        # Verify persisted
        lst = client.get(f"{API}/inquiries").json()["inquiries"]
        match = [i for i in lst if i.get("inquiry_id") == TestInvestorInquiries.inquiry_id]
        assert match and match[0]["status"] == status
        assert match[0].get("admin_note") == f"TEST_note_{status}"

    def test_update_inquiry_invalid_status(self, client):
        assert TestInvestorInquiries.inquiry_id
        r = client.put(
            f"{API}/inquiries/{TestInvestorInquiries.inquiry_id}",
            json={"status": "bogus_status"},
        )
        assert r.status_code == 400

    def test_update_inquiry_not_found(self, client):
        r = client.put(
            f"{API}/inquiries/INV-doesnotexist",
            json={"status": "contacted"},
        )
        assert r.status_code == 404

    def test_delete_inquiry(self, client):
        assert TestInvestorInquiries.inquiry_id
        r = client.delete(f"{API}/inquiries/{TestInvestorInquiries.inquiry_id}")
        assert r.status_code == 200

        lst = client.get(f"{API}/inquiries").json()["inquiries"]
        assert not any(i.get("inquiry_id") == TestInvestorInquiries.inquiry_id for i in lst)

    def test_delete_inquiry_not_found(self, client):
        r = client.delete(f"{API}/inquiries/INV-doesnotexist")
        assert r.status_code == 404


# ---------- METRICS ----------
class TestInvestorMetrics:
    def test_metrics_shape(self, client):
        r = client.get(f"{API}/metrics")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "metrics" in body
        m = body["metrics"]
        for key in [
            "total_users", "active_subscribers", "monthly_active_users",
            "total_transactions", "prc_in_circulation",
            "user_growth_rate", "this_month_signups",
        ]:
            assert key in m, f"Missing metric: {key}"
        assert isinstance(m["total_users"], int)
        assert isinstance(m["total_transactions"], int)
        assert "company" in body
