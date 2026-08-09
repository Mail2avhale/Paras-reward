"""
Careers Phase 3 Extended tests (iter 282):
Public apply endpoint with aadhaar/pan/marksheet uploads + education/work_history JSON,
plus generic supporting-document download endpoint.
"""
import io
import json
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://formula-audit-fix.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def job_id():
    r = requests.get(f"{API}/public/careers/jobs", timeout=30)
    assert r.status_code == 200, r.text
    jobs = [j for j in r.json().get("jobs", []) if j.get("is_active")]
    assert jobs, "No active job available for testing"
    return jobs[0]["job_id"]


def _uniq_email(tag=""):
    return f"TEST_p3_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def _pdf_bytes(txt="dummy"):
    # Minimal fake PDF payload — server does not validate content, just size + ext
    return b"%PDF-1.4\n%%EOF\n" + txt.encode()


# --- 1. Full apply with all docs + education + work history ---
def test_apply_with_all_documents_and_lists(job_id):
    email = _uniq_email("full")
    education = [{"degree": "BSc CS", "institution": "IIT", "year": "2024", "marks": "9.1 CGPA"}]
    work = [{"company": "Acme", "role": "SWE", "from": "2024-01", "to": "2025-01", "description": "Built stuff"}]
    files = {
        "resume": ("resume.pdf", _pdf_bytes("resume"), "application/pdf"),
        "aadhaar": ("aadhaar.pdf", _pdf_bytes("aadhaar"), "application/pdf"),
        "pan": ("pan.pdf", _pdf_bytes("pan"), "application/pdf"),
        "marksheet": ("marks.pdf", _pdf_bytes("marks"), "application/pdf"),
    }
    data = {
        "job_id": job_id,
        "name": "TEST Phase3 Full",
        "email": email,
        "phone": "9999999999",
        "experience_years": "2",
        "cover_letter": "hi",
        "linkedin": "https://linkedin.com/in/test",
        "education_json": json.dumps(education),
        "work_history_json": json.dumps(work),
    }
    r = requests.post(f"{API}/public/careers/apply", data=data, files=files, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    app_id = body["application_id"]
    assert app_id.startswith("APP-")

    # Resume download
    r2 = requests.get(f"{API}/public/careers/applications/{app_id}/resume", timeout=30)
    assert r2.status_code == 200
    assert len(r2.content) > 0

    # All 3 documents downloadable
    for kind in ["aadhaar", "pan", "marksheet"]:
        rd = requests.get(f"{API}/public/careers/applications/{app_id}/document/{kind}", timeout=30)
        assert rd.status_code == 200, f"{kind} download failed: {rd.status_code} {rd.text}"
        assert len(rd.content) > 0

    # Invalid kind = 400
    rbad = requests.get(f"{API}/public/careers/applications/{app_id}/document/invalid_kind", timeout=30)
    assert rbad.status_code == 400, rbad.text

    # Listing includes new application with structured fields
    rl = requests.get(f"{API}/public/careers/applications", params={"job_id": job_id}, timeout=30)
    assert rl.status_code == 200
    apps = rl.json().get("applications", [])
    match = next((a for a in apps if a.get("application_id") == app_id), None)
    assert match is not None
    assert isinstance(match.get("education"), list) and len(match["education"]) == 1
    assert match["education"][0]["degree"] == "BSc CS"
    assert isinstance(match.get("work_history"), list) and len(match["work_history"]) == 1
    assert match["work_history"][0]["company"] == "Acme"
    # existence markers (paths are truthy strings)
    assert match.get("aadhaar_path")
    assert match.get("pan_path")
    assert match.get("marksheet_path")


# --- 2. Apply with no supporting docs + malformed json defaults gracefully ---
def test_apply_no_docs_and_malformed_json(job_id):
    email = _uniq_email("min")
    files = {"resume": ("resume.pdf", _pdf_bytes("only"), "application/pdf")}
    data = {
        "job_id": job_id,
        "name": "TEST Phase3 Min",
        "email": email,
        "phone": "8888888888",
        "experience_years": "0",
        "education_json": "not-a-json",  # malformed
        "work_history_json": "{}",       # not a list
    }
    r = requests.post(f"{API}/public/careers/apply", data=data, files=files, timeout=60)
    assert r.status_code == 200, r.text
    app_id = r.json()["application_id"]

    # Missing docs => 404
    for kind in ["aadhaar", "pan", "marksheet"]:
        rd = requests.get(f"{API}/public/careers/applications/{app_id}/document/{kind}", timeout=30)
        assert rd.status_code == 404, f"{kind} expected 404, got {rd.status_code}"

    # Listing shows empty education / work_history
    rl = requests.get(f"{API}/public/careers/applications", params={"job_id": job_id}, timeout=30)
    match = next((a for a in rl.json().get("applications", []) if a.get("application_id") == app_id), None)
    assert match is not None
    assert match.get("education") == []
    assert match.get("work_history") == []
    assert match.get("aadhaar_path") in (None, "")
    assert match.get("pan_path") in (None, "")
    assert match.get("marksheet_path") in (None, "")


# --- 3. Duplicate email guard ---
def test_duplicate_email_rejected(job_id):
    email = _uniq_email("dup")
    files = {"resume": ("resume.pdf", _pdf_bytes("d"), "application/pdf")}
    data = {
        "job_id": job_id, "name": "TEST Dup", "email": email,
        "phone": "7777777777", "experience_years": "1",
    }
    r1 = requests.post(f"{API}/public/careers/apply", data=data, files=files, timeout=60)
    assert r1.status_code == 200, r1.text
    # second attempt same email+job -> 400
    files2 = {"resume": ("resume.pdf", _pdf_bytes("d2"), "application/pdf")}
    r2 = requests.post(f"{API}/public/careers/apply", data=data, files=files2, timeout=60)
    assert r2.status_code == 400, f"expected 400, got {r2.status_code}: {r2.text}"


# --- 4. Invalid kind on random app id still 400 (validated before DB) ---
def test_invalid_document_kind_returns_400_regardless():
    r = requests.get(f"{API}/public/careers/applications/APP-DOESNOTEXIST/document/foo", timeout=30)
    assert r.status_code == 400
