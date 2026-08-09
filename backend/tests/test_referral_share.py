"""Referral link + shared URL deep-link contract tests."""
import os, time, pytest, requests

API = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
pytestmark = pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not set")


def test_shared_referral_apply_by_job_code_records_employee_referral():
    """A friend visits /careers?job=PR-JOB-YYYY-####&ref=... and applies. The
    frontend pre-fills recruitment_source='Employee Referral'; verify the
    backend accepts an apply-by-job-code with that source and persists it."""
    # Create fresh job
    job = requests.post(f"{API}/api/public/careers/jobs/create", json={
        "title": f"Referral job {int(time.time()*1000)}", "department": "Sales",
        "description": "Referral pytest job", "vacancy_count": 3,
    }, timeout=30).json()["job"]

    email = f"ref_{int(time.time()*1000)}@t.com"
    r = requests.post(
        f"{API}/api/public/careers/apply",
        files={"resume": ("r.pdf", b"%PDF-1.4\nseed", "application/pdf")},
        data={
            "job_id": job["job_code"],  # share URL uses job_code
            "name": "Referred Friend",
            "email": email,
            "phone": "9800000901",
            "recruitment_source": "Employee Referral",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    app_id = r.json()["application_id"]

    # Fetch back — source must be persisted correctly
    listing = requests.get(f"{API}/api/public/careers/applications", timeout=30).json()
    match = next(a for a in listing["applications"] if a["application_id"] == app_id)
    assert match["recruitment_source"] == "Employee Referral"
    assert match["job_id"] == job["job_id"]  # accepted by job_code, resolved to job_id


def test_portal_returns_job_code_for_share_url_construction():
    """Portal must expose job_code so the frontend can build the share URL."""
    job = requests.post(f"{API}/api/public/careers/jobs/create", json={
        "title": f"Share test job {int(time.time()*1000)}", "department": "Tech",
        "description": "Share URL contract test", "vacancy_count": 1,
    }, timeout=30).json()["job"]
    email = f"share_{int(time.time()*1000)}@t.com"
    app_id = requests.post(
        f"{API}/api/public/careers/apply",
        files={"resume": ("r.pdf", b"%PDF-1.4\nseed", "application/pdf")},
        data={"job_id": job["job_id"], "name": "Sharer", "email": email, "phone": "9800000902"},
        timeout=30,
    ).json()["application_id"]

    r = requests.get(f"{API}/api/public/candidate/{app_id}", timeout=30).json()
    assert r["application"]["job_code"] == job["job_code"]
    assert r["application"]["job_title"] == job["title"]
