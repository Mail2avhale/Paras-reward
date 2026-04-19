"""
CAREERS & INVESTORS API TESTS
=============================
Tests for public Careers and Investors pages:
- Careers: Job postings CRUD, applications with resume upload, status check
- Investors: Metrics, documents, FAQ, team, press, contact inquiries
"""

import pytest
import requests
import os
import io
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ==================== FIXTURES ====================

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def test_job_id():
    """Create a test job and return its ID for other tests"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    job_data = {
        "title": f"TEST_QA Engineer {uuid.uuid4().hex[:6]}",
        "department": "Technology",
        "location": "Chatrapati Sambhaji Nagar, Maharashtra",
        "job_type": "Full-time",
        "experience_min": 2,
        "experience_max": 5,
        "salary_min": 30000,
        "salary_max": 50000,
        "show_salary": True,
        "description": "Test job description for QA Engineer position",
        "requirements": "Python, Selenium, API Testing",
        "responsibilities": "Write and execute test cases",
        "benefits": "Health insurance, PF",
        "is_active": True,
        "admin_id": "test_admin"
    }
    
    response = session.post(f"{BASE_URL}/api/public/careers/jobs/create", json=job_data)
    if response.status_code == 200:
        data = response.json()
        return data.get("job", {}).get("job_id")
    return None


# ==================== CAREERS: META ====================

class TestCareersMeta:
    """Test career metadata endpoints"""
    
    def test_get_career_meta(self, api_client):
        """GET /api/public/careers/meta - Returns departments and job_types"""
        response = api_client.get(f"{BASE_URL}/api/public/careers/meta")
        assert response.status_code == 200
        
        data = response.json()
        assert "departments" in data
        assert "job_types" in data
        assert "company" in data
        
        # Verify departments list
        assert isinstance(data["departments"], list)
        assert len(data["departments"]) > 0
        assert "Technology" in data["departments"]
        
        # Verify job types
        assert isinstance(data["job_types"], list)
        assert "Full-time" in data["job_types"]
        
        # Verify company info
        assert data["company"]["name"] == "Paras Reward Technologies Private Limited"
        print(f"PASS: Career meta returns {len(data['departments'])} departments, {len(data['job_types'])} job types")


# ==================== CAREERS: JOB POSTINGS CRUD ====================

class TestCareersJobsCRUD:
    """Test job postings CRUD operations"""
    
    def test_create_job_posting(self, api_client):
        """POST /api/public/careers/jobs/create - Creates a job posting"""
        job_data = {
            "title": f"TEST_Software Developer {uuid.uuid4().hex[:6]}",
            "department": "Technology",
            "location": "Chatrapati Sambhaji Nagar, Maharashtra",
            "job_type": "Full-time",
            "experience_min": 1,
            "experience_max": 3,
            "salary_min": 25000,
            "salary_max": 40000,
            "show_salary": True,
            "description": "We are looking for a talented software developer to join our team.",
            "requirements": "React, Node.js, MongoDB",
            "responsibilities": "Develop and maintain web applications",
            "benefits": "Health insurance, PF, flexible hours",
            "is_active": True,
            "admin_id": "test_admin"
        }
        
        response = api_client.post(f"{BASE_URL}/api/public/careers/jobs/create", json=job_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "job" in data
        assert data["job"]["title"] == job_data["title"]
        assert data["job"]["department"] == "Technology"
        assert "job_id" in data["job"]
        assert data["job"]["job_id"].startswith("JOB-")
        
        # Store for cleanup
        self.__class__.created_job_id = data["job"]["job_id"]
        print(f"PASS: Created job {data['job']['job_id']}")
    
    def test_list_active_jobs(self, api_client):
        """GET /api/public/careers/jobs - Returns active job listings"""
        response = api_client.get(f"{BASE_URL}/api/public/careers/jobs?active_only=true")
        assert response.status_code == 200
        
        data = response.json()
        assert "jobs" in data
        assert "total" in data
        assert isinstance(data["jobs"], list)
        
        # All returned jobs should be active
        for job in data["jobs"]:
            assert job.get("is_active") == True
            assert "job_id" in job
            assert "title" in job
            assert "department" in job
        
        print(f"PASS: Listed {data['total']} active jobs")
    
    def test_list_all_jobs(self, api_client):
        """GET /api/public/careers/jobs?active_only=false - Returns all jobs"""
        response = api_client.get(f"{BASE_URL}/api/public/careers/jobs?active_only=false")
        assert response.status_code == 200
        
        data = response.json()
        assert "jobs" in data
        print(f"PASS: Listed {data['total']} total jobs (including inactive)")
    
    def test_get_job_detail(self, api_client, test_job_id):
        """GET /api/public/careers/jobs/{job_id} - Returns job detail"""
        if not test_job_id:
            pytest.skip("No test job available")
        
        response = api_client.get(f"{BASE_URL}/api/public/careers/jobs/{test_job_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "job" in data
        assert data["job"]["job_id"] == test_job_id
        assert "title" in data["job"]
        assert "description" in data["job"]
        assert "department" in data["job"]
        print(f"PASS: Got job detail for {test_job_id}")
    
    def test_get_nonexistent_job(self, api_client):
        """GET /api/public/careers/jobs/{job_id} - Returns 404 for nonexistent job"""
        response = api_client.get(f"{BASE_URL}/api/public/careers/jobs/JOB-NONEXISTENT-123456")
        assert response.status_code == 404
        print("PASS: Returns 404 for nonexistent job")
    
    def test_update_job(self, api_client, test_job_id):
        """PUT /api/public/careers/jobs/{job_id} - Updates a job"""
        if not test_job_id:
            pytest.skip("No test job available")
        
        update_data = {
            "title": "TEST_Updated Job Title",
            "salary_max": 60000
        }
        
        response = api_client.put(f"{BASE_URL}/api/public/careers/jobs/{test_job_id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
        # Verify update persisted
        verify_response = api_client.get(f"{BASE_URL}/api/public/careers/jobs/{test_job_id}")
        verify_data = verify_response.json()
        assert verify_data["job"]["title"] == "TEST_Updated Job Title"
        assert verify_data["job"]["salary_max"] == 60000
        print(f"PASS: Updated job {test_job_id}")
    
    def test_delete_job(self, api_client):
        """DELETE /api/public/careers/jobs/{job_id} - Deletes a job"""
        # Create a job to delete
        job_data = {
            "title": f"TEST_ToDelete {uuid.uuid4().hex[:6]}",
            "department": "Technology",
            "description": "This job will be deleted",
            "is_active": True
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/public/careers/jobs/create", json=job_data)
        assert create_response.status_code == 200
        job_id = create_response.json()["job"]["job_id"]
        
        # Delete the job
        delete_response = api_client.delete(f"{BASE_URL}/api/public/careers/jobs/{job_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] == True
        
        # Verify deletion
        verify_response = api_client.get(f"{BASE_URL}/api/public/careers/jobs/{job_id}")
        assert verify_response.status_code == 404
        print(f"PASS: Deleted job {job_id}")


# ==================== CAREERS: APPLICATIONS ====================

class TestCareersApplications:
    """Test job application endpoints"""
    
    def test_apply_for_job_with_resume(self, test_job_id):
        """POST /api/public/careers/apply - Submits application with resume"""
        if not test_job_id:
            pytest.skip("No test job available")
        
        # Create a test PDF file
        pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n199\n%%EOF"
        
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        
        files = {
            'resume': ('test_resume.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        data = {
            'job_id': test_job_id,
            'name': 'Test Applicant',
            'email': unique_email,
            'phone': '9876543210',
            'experience_years': '3',
            'cover_letter': 'I am excited to apply for this position.',
            'linkedin': 'https://linkedin.com/in/testapplicant'
        }
        
        response = requests.post(f"{BASE_URL}/api/public/careers/apply", data=data, files=files)
        assert response.status_code == 200
        
        result = response.json()
        assert result["success"] == True
        assert "application_id" in result
        assert result["application_id"].startswith("APP-")
        
        self.__class__.test_application_id = result["application_id"]
        self.__class__.test_email = unique_email
        print(f"PASS: Application submitted with ID {result['application_id']}")
    
    def test_apply_duplicate_rejected(self, test_job_id):
        """POST /api/public/careers/apply - Rejects duplicate application"""
        if not test_job_id or not hasattr(self.__class__, 'test_email'):
            pytest.skip("No test job or previous application")
        
        pdf_content = b"%PDF-1.4\ntest"
        files = {
            'resume': ('resume.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        data = {
            'job_id': test_job_id,
            'name': 'Test Applicant',
            'email': self.__class__.test_email,  # Same email
            'phone': '9876543210',
            'experience_years': '3'
        }
        
        response = requests.post(f"{BASE_URL}/api/public/careers/apply", data=data, files=files)
        assert response.status_code == 400
        assert "already applied" in response.json().get("detail", "").lower()
        print("PASS: Duplicate application rejected")
    
    def test_check_application_status(self, api_client):
        """GET /api/public/careers/check-status?email=... - Checks application status"""
        if not hasattr(TestCareersApplications, 'test_email'):
            pytest.skip("No test application")
        
        response = api_client.get(f"{BASE_URL}/api/public/careers/check-status?email={TestCareersApplications.test_email}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["found"] == True
        assert "applications" in data
        assert len(data["applications"]) > 0
        
        app = data["applications"][0]
        assert "application_id" in app
        assert "status" in app
        assert "job_title" in app
        print(f"PASS: Found {len(data['applications'])} application(s) for email")
    
    def test_check_status_no_applications(self, api_client):
        """GET /api/public/careers/check-status - Returns empty for unknown email"""
        response = api_client.get(f"{BASE_URL}/api/public/careers/check-status?email=nonexistent_{uuid.uuid4().hex}@test.com")
        assert response.status_code == 200
        
        data = response.json()
        assert data["found"] == False
        assert len(data["applications"]) == 0
        print("PASS: Returns empty for unknown email")
    
    def test_list_all_applications(self, api_client):
        """GET /api/public/careers/applications - Lists all applications with stats"""
        response = api_client.get(f"{BASE_URL}/api/public/careers/applications")
        assert response.status_code == 200
        
        data = response.json()
        assert "applications" in data
        assert "stats" in data
        assert "total" in data["stats"]
        assert "new" in data["stats"]
        assert "reviewed" in data["stats"]
        print(f"PASS: Listed {data['stats']['total']} applications")
    
    def test_update_application_status(self, api_client):
        """PUT /api/public/careers/applications/{app_id}/status - Updates status"""
        if not hasattr(TestCareersApplications, 'test_application_id'):
            pytest.skip("No test application")
        
        app_id = TestCareersApplications.test_application_id
        
        response = api_client.put(
            f"{BASE_URL}/api/public/careers/applications/{app_id}/status",
            json={"status": "reviewed"}
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        print(f"PASS: Updated application status to 'reviewed'")
    
    def test_update_application_invalid_status(self, api_client):
        """PUT /api/public/careers/applications/{app_id}/status - Rejects invalid status"""
        if not hasattr(TestCareersApplications, 'test_application_id'):
            pytest.skip("No test application")
        
        app_id = TestCareersApplications.test_application_id
        
        response = api_client.put(
            f"{BASE_URL}/api/public/careers/applications/{app_id}/status",
            json={"status": "invalid_status"}
        )
        assert response.status_code == 400
        print("PASS: Invalid status rejected")
    
    def test_add_application_note(self, api_client):
        """POST /api/public/careers/applications/{app_id}/note - Adds admin note"""
        if not hasattr(TestCareersApplications, 'test_application_id'):
            pytest.skip("No test application")
        
        app_id = TestCareersApplications.test_application_id
        
        response = api_client.post(
            f"{BASE_URL}/api/public/careers/applications/{app_id}/note",
            json={"note": "Good candidate, schedule interview", "admin_id": "test_admin"}
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        print("PASS: Added admin note to application")


# ==================== INVESTORS: METRICS ====================

class TestInvestorsMetrics:
    """Test investor metrics endpoint"""
    
    def test_get_investor_metrics(self, api_client):
        """GET /api/public/investors/metrics - Returns real DB metrics"""
        response = api_client.get(f"{BASE_URL}/api/public/investors/metrics")
        assert response.status_code == 200
        
        data = response.json()
        assert "metrics" in data
        assert "company" in data
        
        metrics = data["metrics"]
        assert "total_users" in metrics
        assert "active_subscribers" in metrics
        assert "monthly_active_users" in metrics
        assert "total_transactions" in metrics
        assert "prc_in_circulation" in metrics
        assert "user_growth_rate" in metrics
        assert "this_month_signups" in metrics
        
        # Verify types
        assert isinstance(metrics["total_users"], int)
        assert isinstance(metrics["active_subscribers"], int)
        
        print(f"PASS: Metrics - {metrics['total_users']} users, {metrics['active_subscribers']} subscribers")


# ==================== INVESTORS: FAQ ====================

class TestInvestorsFAQ:
    """Test investor FAQ endpoints"""
    
    def test_get_investor_faq(self):
        """GET /api/public/investors/faq - Returns FAQ list"""
        response = requests.get(f"{BASE_URL}/api/public/investors/faq")
        assert response.status_code == 200
        
        data = response.json()
        assert "faqs" in data
        assert isinstance(data["faqs"], list)
        assert len(data["faqs"]) > 0
        
        # Verify FAQ structure
        faq = data["faqs"][0]
        assert "question" in faq
        assert "answer" in faq
        print(f"PASS: Got {len(data['faqs'])} FAQs")


# ==================== INVESTORS: TEAM ====================

class TestInvestorsTeam:
    """Test investor team endpoints"""
    
    def test_get_leadership_team(self):
        """GET /api/public/investors/team - Returns leadership team"""
        response = requests.get(f"{BASE_URL}/api/public/investors/team")
        assert response.status_code == 200
        
        data = response.json()
        assert "team" in data
        assert isinstance(data["team"], list)
        
        if len(data["team"]) > 0:
            member = data["team"][0]
            assert "name" in member
            assert "role" in member
        print(f"PASS: Got {len(data['team'])} team members")


# ==================== INVESTORS: PRESS ====================

class TestInvestorsPress:
    """Test investor press endpoints"""
    
    def test_get_press_releases(self, api_client):
        """GET /api/public/investors/press - Returns press releases"""
        response = api_client.get(f"{BASE_URL}/api/public/investors/press")
        assert response.status_code == 200
        
        data = response.json()
        assert "press" in data
        assert isinstance(data["press"], list)
        print(f"PASS: Got {len(data['press'])} press releases")


# ==================== INVESTORS: DOCUMENTS ====================

class TestInvestorsDocuments:
    """Test investor document endpoints"""
    
    def test_list_investor_documents(self, api_client):
        """GET /api/public/investors/documents - Lists investor documents"""
        response = api_client.get(f"{BASE_URL}/api/public/investors/documents")
        assert response.status_code == 200
        
        data = response.json()
        assert "documents" in data
        assert isinstance(data["documents"], list)
        
        # Verify no sensitive data exposed
        for doc in data["documents"]:
            assert "filepath" not in doc
            assert "password" not in doc
        print(f"PASS: Listed {len(data['documents'])} documents")
    
    def test_upload_investor_document(self):
        """POST /api/public/investors/documents/upload - Uploads a document"""
        pdf_content = b"%PDF-1.4\nTest investor document content"
        
        files = {
            'file': ('test_pitch_deck.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        data = {
            'title': f'TEST_Pitch Deck {uuid.uuid4().hex[:6]}',
            'doc_type': 'Pitch Deck',
            'password': 'testpass123',
            'admin_id': 'test_admin'
        }
        
        response = requests.post(f"{BASE_URL}/api/public/investors/documents/upload", data=data, files=files)
        assert response.status_code == 200
        
        result = response.json()
        assert result["success"] == True
        assert "doc_id" in result
        
        self.__class__.test_doc_id = result["doc_id"]
        print(f"PASS: Uploaded document {result['doc_id']}")
    
    def test_download_protected_document_wrong_password(self, api_client):
        """POST /api/public/investors/documents/{doc_id}/download - Wrong password rejected"""
        if not hasattr(TestInvestorsDocuments, 'test_doc_id'):
            pytest.skip("No test document")
        
        doc_id = TestInvestorsDocuments.test_doc_id
        
        response = api_client.post(
            f"{BASE_URL}/api/public/investors/documents/{doc_id}/download",
            json={"password": "wrongpassword"}
        )
        assert response.status_code == 403
        print("PASS: Wrong password rejected for protected document")
    
    def test_download_protected_document_correct_password(self):
        """POST /api/public/investors/documents/{doc_id}/download - Correct password works"""
        if not hasattr(TestInvestorsDocuments, 'test_doc_id'):
            pytest.skip("No test document")
        
        doc_id = TestInvestorsDocuments.test_doc_id
        
        response = requests.post(
            f"{BASE_URL}/api/public/investors/documents/{doc_id}/download",
            json={"password": "testpass123"}
        )
        assert response.status_code == 200
        assert response.headers.get('content-type') in ['application/pdf', 'application/octet-stream']
        print("PASS: Document downloaded with correct password")


# ==================== INVESTORS: CONTACT ====================

class TestInvestorsContact:
    """Test investor contact/inquiry endpoints"""
    
    def test_submit_investor_inquiry(self, api_client):
        """POST /api/public/investors/contact - Submits investor inquiry"""
        inquiry_data = {
            "name": "Test Investor",
            "email": f"investor_{uuid.uuid4().hex[:6]}@test.com",
            "phone": "9876543210",
            "organization": "Test Investment Firm",
            "investment_range": "5-25L",
            "message": "Interested in learning more about investment opportunities."
        }
        
        response = api_client.post(f"{BASE_URL}/api/public/investors/contact", json=inquiry_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print("PASS: Investor inquiry submitted")
    
    def test_list_investor_inquiries(self, api_client):
        """GET /api/public/investors/inquiries - Lists all inquiries"""
        response = api_client.get(f"{BASE_URL}/api/public/investors/inquiries")
        assert response.status_code == 200
        
        data = response.json()
        assert "inquiries" in data
        assert isinstance(data["inquiries"], list)
        
        if len(data["inquiries"]) > 0:
            inquiry = data["inquiries"][0]
            assert "inquiry_id" in inquiry
            assert "name" in inquiry
            assert "email" in inquiry
        print(f"PASS: Listed {len(data['inquiries'])} inquiries")


# ==================== CLEANUP ====================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_jobs(self, api_client):
        """Delete TEST_ prefixed jobs"""
        response = api_client.get(f"{BASE_URL}/api/public/careers/jobs?active_only=false")
        if response.status_code == 200:
            jobs = response.json().get("jobs", [])
            deleted = 0
            for job in jobs:
                if job.get("title", "").startswith("TEST_"):
                    del_response = api_client.delete(f"{BASE_URL}/api/public/careers/jobs/{job['job_id']}")
                    if del_response.status_code == 200:
                        deleted += 1
            print(f"CLEANUP: Deleted {deleted} test jobs")
        assert True  # Always pass cleanup
