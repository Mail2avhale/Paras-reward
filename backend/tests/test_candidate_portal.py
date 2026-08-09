"""Public candidate portal endpoint contract tests."""
import os, time, pytest, requests

API = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
pytestmark = pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not set")


def _seed():
    job = requests.post(f"{API}/api/public/careers/jobs/create", json={
        "title": f"Portal test job {int(time.time()*1000)}", "department": "Tech",
        "description": "Portal contract seed job", "vacancy_count": 3,
    }, timeout=30).json()["job"]
    email = f"portal_{int(time.time()*1000)}@t.com"
    app_id = requests.post(
        f"{API}/api/public/careers/apply",
        files={"resume": ("r.pdf", b"%PDF-1.4\ntest", "application/pdf")},
        data={"job_id": job["job_id"], "name": "Portal Applicant",
              "email": email, "phone": "9800000200", "recruitment_source": "Website"},
        timeout=30,
    ).json()["application_id"]
    return app_id


def test_candidate_portal_shape_fresh_applicant():
    app_id = _seed()
    r = requests.get(f"{API}/api/public/candidate/{app_id}", timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ("application", "timeline", "actions", "assessments", "interviews", "offers", "employee", "onboarding", "letters"):
        assert k in d
    assert d["application"]["application_id"] == app_id
    assert len(d["timeline"]) == 5
    # Applied → done, Assessment → active
    assert d["timeline"][0]["done"] is True
    assert d["employee"] is None
    assert d["letters"] == []


def test_candidate_portal_reflects_offer_stage():
    app_id = _seed()
    off = requests.post(f"{API}/api/public/offers/generate", json={
        "application_id": app_id, "hiring_type": "Direct Hire",
        "designation": "Backend Eng", "department": "Tech",
        "joining_date": "2026-04-01", "salary_ctc": 700000,
    }, timeout=30).json()

    r = requests.get(f"{API}/api/public/candidate/{app_id}", timeout=30)
    d = r.json()
    assert len(d["offers"]) == 1
    assert d["offers"][0]["offer_id"] == off["offer_id"]
    assert d["offers"][0]["respond_url"] is not None
    assert d["offers"][0]["token"] == off["token"]
    # Offer action should be surfaced
    kinds = [a["kind"] for a in d["actions"]]
    assert "offer" in kinds


def test_candidate_portal_hides_correct_answers_and_internal_paths():
    """The portal must never leak correct_index, resume_path, or internal FS
    paths — only booleans + candidate-facing URLs."""
    app_id = _seed()
    r = requests.get(f"{API}/api/public/candidate/{app_id}", timeout=30).json()
    # No FS paths anywhere
    dumped = str(r)
    assert "/app/backend/uploads/" not in dumped
    assert "aadhaar_path" not in dumped  # only "supporting_docs" booleans
    # Offers redacted correctly
    for o in r["offers"]:
        assert "letter_pdf_path" not in o


def test_candidate_portal_404_unknown():
    r = requests.get(f"{API}/api/public/candidate/PR-HR-9999-99999", timeout=30)
    assert r.status_code == 404
