"""
Admin Careers Panel - Backend CRUD Testing
Tests full lifecycle for job postings and application management endpoints.
Endpoints under /api/public/careers/*
"""
import os
import io
import uuid
import pytest
import requests

# Load frontend .env to get public URL
def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for ln in f:
                    if ln.startswith("REACT_APP_BACKEND_URL="):
                        url = ln.strip().split("=", 1)[1]
                        break
        except Exception:
            pass
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not set")
    return url.rstrip("/")


BASE_URL = _load_base_url()
API = f"{BASE_URL}/api/public/careers"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_job(api_client):
    """Create a test job for lifecycle tests and cleanup."""
    payload = {
        "title": "TEST_SDET_Engineer",
        "department": "Technology",
        "location": "Remote",
        "job_type": "Full-time",
        "experience_min": 1,
        "experience_max": 5,
        "description": "TEST job posting for automated SDET validation.",
        "requirements": "Python, pytest",
        "responsibilities": "Write tests",
        "benefits": "PTO",
        "is_active": True,
        "admin_id": "admin@test.com"
    }
    r = api_client.post(f"{API}/jobs/create", json=payload)
    assert r.status_code == 200, f"Create job failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["success"] is True
    assert "job" in data
    job = data["job"]
    assert job["title"] == payload["title"]
    assert job["department"] == payload["department"]
    assert job["is_active"] is True
    assert job.get("job_id", "").startswith("JOB-")
    yield job
    # Cleanup
    try:
        api_client.delete(f"{API}/jobs/{job['job_id']}")
    except Exception:
        pass


# ---------- META ----------

class TestMeta:
    def test_meta_returns_lists(self, api_client):
        r = api_client.get(f"{API}/meta")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["departments"], list) and len(d["departments"]) > 0
        assert isinstance(d["job_types"], list) and len(d["job_types"]) > 0
        assert d["company"]["name"]


# ---------- JOB CRUD ----------

class TestJobCRUD:
    def test_create_job_validation_missing_title(self, api_client):
        r = api_client.post(f"{API}/jobs/create", json={
            "department": "Technology",
            "description": "Some valid description text here"
        })
        # title missing -> 422 Pydantic
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"

    def test_create_job_validation_short_title(self, api_client):
        r = api_client.post(f"{API}/jobs/create", json={
            "title": "ab",  # <3
            "department": "Technology",
            "description": "Valid description content here."
        })
        assert r.status_code == 422

    def test_create_job_validation_short_description(self, api_client):
        r = api_client.post(f"{API}/jobs/create", json={
            "title": "TEST_Title",
            "department": "Technology",
            "description": "short"  # <10
        })
        assert r.status_code == 422

    def test_create_and_persist(self, api_client, created_job):
        job_id = created_job["job_id"]
        r = api_client.get(f"{API}/jobs/{job_id}")
        assert r.status_code == 200
        j = r.json()["job"]
        assert j["job_id"] == job_id
        assert j["title"] == created_job["title"]
        assert j["application_count"] == 0

    def test_list_jobs_active_only_true(self, api_client, created_job):
        r = api_client.get(f"{API}/jobs?active_only=true")
        assert r.status_code == 200
        d = r.json()
        ids = [x["job_id"] for x in d["jobs"]]
        assert created_job["job_id"] in ids
        # All should be active
        assert all(x.get("is_active") for x in d["jobs"])

    def test_list_jobs_active_only_false_admin(self, api_client, created_job):
        r = api_client.get(f"{API}/jobs?active_only=false")
        assert r.status_code == 200
        d = r.json()
        assert "jobs" in d and "total" in d
        assert d["total"] == len(d["jobs"])

    def test_update_job_partial(self, api_client, created_job):
        job_id = created_job["job_id"]
        r = api_client.put(f"{API}/jobs/{job_id}", json={
            "title": "TEST_SDET_Engineer_Updated",
            "location": "Mumbai"
        })
        assert r.status_code == 200
        assert r.json()["success"] is True
        # verify persistence via GET
        g = api_client.get(f"{API}/jobs/{job_id}").json()["job"]
        assert g["title"] == "TEST_SDET_Engineer_Updated"
        assert g["location"] == "Mumbai"
        # other fields should remain
        assert g["department"] == created_job["department"]

    def test_toggle_is_active(self, api_client, created_job):
        job_id = created_job["job_id"]
        r = api_client.put(f"{API}/jobs/{job_id}", json={"is_active": False})
        assert r.status_code == 200
        g = api_client.get(f"{API}/jobs/{job_id}").json()["job"]
        assert g["is_active"] is False
        # Should not appear in active_only=true
        lst = api_client.get(f"{API}/jobs?active_only=true").json()["jobs"]
        assert job_id not in [x["job_id"] for x in lst]
        # Flip back on
        api_client.put(f"{API}/jobs/{job_id}", json={"is_active": True})
        g2 = api_client.get(f"{API}/jobs/{job_id}").json()["job"]
        assert g2["is_active"] is True

    def test_update_non_existing_job(self, api_client):
        r = api_client.put(f"{API}/jobs/JOB-DOESNOTEXIST-XYZ", json={"title": "X"})
        assert r.status_code == 404

    def test_get_non_existing_job(self, api_client):
        r = api_client.get(f"{API}/jobs/JOB-DOESNOTEXIST-XYZ")
        assert r.status_code == 404

    def test_delete_non_existing_job(self, api_client):
        r = api_client.delete(f"{API}/jobs/JOB-DOESNOTEXIST-XYZ")
        assert r.status_code == 404

    def test_delete_job_lifecycle(self, api_client):
        # Create a disposable job
        payload = {
            "title": "TEST_DisposableJob",
            "department": "Operations",
            "description": "Will be deleted shortly by test."
        }
        r = api_client.post(f"{API}/jobs/create", json=payload)
        assert r.status_code == 200
        jid = r.json()["job"]["job_id"]
        # Delete
        d = api_client.delete(f"{API}/jobs/{jid}")
        assert d.status_code == 200
        assert d.json()["success"] is True
        # Verify gone
        g = api_client.get(f"{API}/jobs/{jid}")
        assert g.status_code == 404


# ---------- APPLICATIONS ----------

@pytest.fixture(scope="module")
def seeded_application(api_client, created_job):
    """Seed an application via the public /apply multipart endpoint."""
    job_id = created_job["job_id"]
    unique_email = f"test_sdet_{uuid.uuid4().hex[:8]}@example.com"
    files = {
        "resume": ("resume.pdf", io.BytesIO(b"%PDF-1.4 fake test resume content"), "application/pdf")
    }
    data = {
        "job_id": job_id,
        "name": "TEST Applicant",
        "email": unique_email,
        "phone": "9999999999",
        "experience_years": 2,
        "cover_letter": "I am TEST applicant.",
        "linkedin": "https://linkedin.com/in/test"
    }
    r = requests.post(f"{API}/apply", data=data, files=files)
    assert r.status_code == 200, f"Apply failed: {r.status_code} {r.text}"
    app_id = r.json()["application_id"]
    return {"application_id": app_id, "job_id": job_id, "email": unique_email}


class TestApplications:
    def test_list_applications_stats_structure(self, api_client, seeded_application):
        r = api_client.get(f"{API}/applications")
        assert r.status_code == 200
        d = r.json()
        assert "applications" in d and "stats" in d
        for k in ["total", "new", "reviewed", "shortlisted", "interview", "hired", "rejected"]:
            assert k in d["stats"]
        ids = [a["application_id"] for a in d["applications"]]
        assert seeded_application["application_id"] in ids

    def test_list_applications_filter_by_job(self, api_client, seeded_application):
        r = api_client.get(f"{API}/applications", params={"job_id": seeded_application["job_id"]})
        assert r.status_code == 200
        apps = r.json()["applications"]
        assert all(a["job_id"] == seeded_application["job_id"] for a in apps)
        assert seeded_application["application_id"] in [a["application_id"] for a in apps]

    def test_list_applications_filter_by_status_new(self, api_client, seeded_application):
        r = api_client.get(f"{API}/applications", params={"status": "new"})
        assert r.status_code == 200
        apps = r.json()["applications"]
        assert all(a.get("status") == "new" for a in apps)

    def test_duplicate_application_blocked(self, api_client, seeded_application, created_job):
        # Attempt second application with same email+job
        files = {
            "resume": ("resume2.pdf", io.BytesIO(b"%PDF fake duplicate"), "application/pdf")
        }
        data = {
            "job_id": seeded_application["job_id"],
            "name": "TEST Dup",
            "email": seeded_application["email"],
            "phone": "9999999999",
            "experience_years": 2
        }
        r = requests.post(f"{API}/apply", data=data, files=files)
        assert r.status_code == 400
        assert "already applied" in r.text.lower()

    def test_update_status_valid_flow(self, api_client, seeded_application):
        app_id = seeded_application["application_id"]
        for status in ["reviewed", "shortlisted", "interview", "hired", "rejected", "new"]:
            r = api_client.put(f"{API}/applications/{app_id}/status", json={"status": status})
            assert r.status_code == 200, f"{status}: {r.text}"
            # Verify via list
            apps = api_client.get(f"{API}/applications").json()["applications"]
            matched = [a for a in apps if a["application_id"] == app_id]
            assert matched and matched[0]["status"] == status

    def test_update_status_invalid(self, api_client, seeded_application):
        app_id = seeded_application["application_id"]
        r = api_client.put(f"{API}/applications/{app_id}/status", json={"status": "bogus"})
        assert r.status_code == 400
        assert "invalid status" in r.text.lower()

    def test_update_status_non_existing_app(self, api_client):
        r = api_client.put(f"{API}/applications/APP-NOT-EXIST/status", json={"status": "reviewed"})
        assert r.status_code == 404

    def test_add_note(self, api_client, seeded_application):
        app_id = seeded_application["application_id"]
        r = api_client.post(f"{API}/applications/{app_id}/note", json={
            "note": "TEST internal note", "admin_id": "admin@test.com"
        })
        assert r.status_code == 200
        assert r.json()["success"] is True
        # Verify note appears in stored doc via list
        apps = api_client.get(f"{API}/applications").json()["applications"]
        matched = [a for a in apps if a["application_id"] == app_id][0]
        notes = matched.get("admin_notes", [])
        assert any(n.get("note") == "TEST internal note" for n in notes)

    def test_add_note_non_existing_app(self, api_client):
        r = api_client.post(f"{API}/applications/APP-NO/note", json={"note": "x"})
        assert r.status_code == 404

    def test_download_resume(self, api_client, seeded_application):
        app_id = seeded_application["application_id"]
        r = api_client.get(f"{API}/applications/{app_id}/resume")
        assert r.status_code == 200
        assert len(r.content) > 0
        # Should be our seeded fake pdf content
        assert b"PDF" in r.content[:10]

    def test_download_resume_not_found(self, api_client):
        r = api_client.get(f"{API}/applications/APP-NOPE/resume")
        assert r.status_code == 404

    def test_check_status_public(self, api_client, seeded_application):
        r = api_client.get(f"{API}/check-status", params={"email": seeded_application["email"]})
        assert r.status_code == 200
        d = r.json()
        assert d["found"] is True
        assert any(a["application_id"] == seeded_application["application_id"] for a in d["applications"])

    def test_check_status_unknown_email(self, api_client):
        r = api_client.get(f"{API}/check-status", params={"email": f"nobody_{uuid.uuid4().hex}@x.com"})
        assert r.status_code == 200
        assert r.json()["found"] is False


# ---------- CLEANUP ----------

def test_zz_cleanup_applications_and_jobs(api_client):
    """Cleanup TEST_ prefixed jobs created by this suite."""
    jobs = api_client.get(f"{API}/jobs?active_only=false").json().get("jobs", [])
    for j in jobs:
        if j.get("title", "").startswith("TEST_"):
            api_client.delete(f"{API}/jobs/{j['job_id']}")
    # Applications cleanup - direct DB not available via API; leave as TEST_ flagged
