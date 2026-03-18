"""
GST Invoice System Tests
========================
Tests for GST-compliant invoicing system integrated with Razorpay.

Features tested:
1. Invoice generation API - POST /api/invoice/generate
2. User invoice list API - GET /api/invoice/user/{user_id}
3. Invoice PDF download API - GET /api/invoice/{invoice_id}/pdf
4. Admin invoice list API - GET /api/invoice/admin/all
5. GST calculation correctness (18% split into CGST 9% + SGST 9%)
6. Sequential invoice numbering (PRC-YYYY-XXXXX format)
"""

import pytest
import requests
import os
import uuid
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user data
TEST_USER_ID = "cbdf46d7-7d66-4d43-8495-e1432a2ab071"

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestGSTCalculation:
    """Test GST calculation correctness"""
    
    def test_gst_calculation_799(self, api_client):
        """Verify GST calculation for ₹799 - standard monthly plan"""
        # For ₹799 total:
        # Base = 799 / 1.18 = 677.12 (rounded)
        # GST = 799 - 677.12 = 121.88
        # CGST = SGST = 60.94
        
        payment_id = f"pay_test_gst_calc_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "user_id": TEST_USER_ID,
            "amount": 799,
            "payment_id": payment_id,
            "plan_name": "growth",
            "plan_type": "monthly"
        }
        
        response = api_client.post(f"{BASE_URL}/api/invoice/generate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
        gst = data["gst_breakdown"]
        assert gst["total_amount"] == 799
        assert gst["base_amount"] == 677.12
        assert gst["gst_amount"] == 121.88
        assert gst["cgst"] == 60.94
        assert gst["sgst"] == 60.94
        assert gst["cgst_rate"] == 9
        assert gst["sgst_rate"] == 9
        
    def test_gst_calculation_1499(self, api_client):
        """Verify GST calculation for ₹1499 - quarterly plan"""
        # For ₹1499 total:
        # Base = 1499 / 1.18 = 1270.34 (rounded)
        # GST = 1499 - 1270.34 = 228.66
        # CGST = SGST = 114.33
        
        payment_id = f"pay_test_gst_calc_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "user_id": TEST_USER_ID,
            "amount": 1499,
            "payment_id": payment_id,
            "plan_name": "elite",
            "plan_type": "quarterly"
        }
        
        response = api_client.post(f"{BASE_URL}/api/invoice/generate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        gst = data["gst_breakdown"]
        
        # Verify base + gst = total (with small tolerance for rounding)
        assert abs(gst["base_amount"] + gst["gst_amount"] - gst["total_amount"]) < 0.01
        # Verify CGST + SGST = GST
        assert abs(gst["cgst"] + gst["sgst"] - gst["gst_amount"]) < 0.01
        # Verify GST rate is 18% (9% CGST + 9% SGST)
        expected_base = round(1499 / 1.18, 2)
        assert gst["base_amount"] == expected_base


class TestInvoiceGeneration:
    """Test Invoice Generation API"""
    
    def test_generate_invoice_success(self, api_client):
        """Test successful invoice generation"""
        payment_id = f"pay_test_invoice_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "user_id": TEST_USER_ID,
            "amount": 599,
            "payment_id": payment_id,
            "plan_name": "startup",
            "plan_type": "monthly"
        }
        
        response = api_client.post(f"{BASE_URL}/api/invoice/generate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "invoice_id" in data
        assert "invoice_number" in data
        assert "gst_breakdown" in data
        assert "pdf_base64" in data
        
        # Verify invoice number format: PRC-YYYY-XXXXX
        invoice_number = data["invoice_number"]
        pattern = r"^PRC-\d{4}-\d{5}$"
        assert re.match(pattern, invoice_number), f"Invoice number {invoice_number} does not match pattern PRC-YYYY-XXXXX"
    
    def test_generate_invoice_duplicate_payment_returns_existing(self, api_client):
        """Test that duplicate payment_id returns existing invoice"""
        payment_id = f"pay_test_dup_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "user_id": TEST_USER_ID,
            "amount": 999,
            "payment_id": payment_id,
            "plan_name": "growth",
            "plan_type": "monthly"
        }
        
        # First request - creates invoice
        response1 = api_client.post(f"{BASE_URL}/api/invoice/generate", json=payload)
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Second request - should return existing invoice
        response2 = api_client.post(f"{BASE_URL}/api/invoice/generate", json=payload)
        assert response2.status_code == 200
        data2 = response2.json()
        
        assert data2["success"] == True
        assert data2["invoice_id"] == data1["invoice_id"]
        assert data2["invoice_number"] == data1["invoice_number"]
        assert "Invoice already exists" in data2["message"]
    
    def test_generate_invoice_invalid_user(self, api_client):
        """Test invoice generation with invalid user ID"""
        payment_id = f"pay_test_invalid_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "user_id": "invalid-user-id-12345",
            "amount": 499,
            "payment_id": payment_id,
            "plan_name": "startup",
            "plan_type": "monthly"
        }
        
        response = api_client.post(f"{BASE_URL}/api/invoice/generate", json=payload)
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]


class TestUserInvoiceList:
    """Test User Invoice List API"""
    
    def test_get_user_invoices(self, api_client):
        """Test fetching user's invoices"""
        response = api_client.get(f"{BASE_URL}/api/invoice/user/{TEST_USER_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "invoices" in data
        assert "count" in data
        assert isinstance(data["invoices"], list)
        
        # Verify each invoice has required fields
        for invoice in data["invoices"]:
            assert "invoice_id" in invoice
            assert "invoice_number" in invoice
            assert "amount" in invoice
            assert "gst_breakdown" in invoice
            assert "created_at" in invoice
            assert "plan_name" in invoice
            assert "plan_type" in invoice
            # pdf_base64 should be excluded in list view
            assert "pdf_base64" not in invoice
    
    def test_get_user_invoices_with_limit(self, api_client):
        """Test invoices list respects limit parameter"""
        response = api_client.get(f"{BASE_URL}/api/invoice/user/{TEST_USER_ID}?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["invoices"]) <= 5


class TestInvoicePDFDownload:
    """Test Invoice PDF Download API"""
    
    def test_get_invoice_pdf(self, api_client):
        """Test PDF download for existing invoice"""
        # First get user's invoices to find an invoice_id
        list_response = api_client.get(f"{BASE_URL}/api/invoice/user/{TEST_USER_ID}")
        assert list_response.status_code == 200
        
        invoices = list_response.json()["invoices"]
        if not invoices:
            pytest.skip("No invoices available for PDF download test")
        
        invoice_id = invoices[0]["invoice_id"]
        
        # Get PDF
        response = api_client.get(f"{BASE_URL}/api/invoice/{invoice_id}/pdf")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "pdf_base64" in data
        assert "invoice_number" in data
        assert data["content_type"] == "application/pdf"
        assert data["filename"].endswith(".pdf")
        
        # Verify pdf_base64 is valid base64
        import base64
        try:
            decoded = base64.b64decode(data["pdf_base64"])
            # PDF files start with %PDF
            assert decoded[:4] == b'%PDF', "Decoded content is not a valid PDF"
        except Exception as e:
            assert False, f"Failed to decode PDF base64: {e}"
    
    def test_get_invoice_pdf_by_invoice_number(self, api_client):
        """Test PDF download using invoice number instead of invoice_id"""
        # Get user's invoices
        list_response = api_client.get(f"{BASE_URL}/api/invoice/user/{TEST_USER_ID}")
        invoices = list_response.json()["invoices"]
        
        if not invoices:
            pytest.skip("No invoices available")
        
        invoice_number = invoices[0]["invoice_number"]
        
        # Get PDF by invoice number
        response = api_client.get(f"{BASE_URL}/api/invoice/{invoice_number}/pdf")
        assert response.status_code == 200
        assert response.json()["success"] == True
    
    def test_get_invoice_pdf_not_found(self, api_client):
        """Test PDF download for non-existent invoice"""
        response = api_client.get(f"{BASE_URL}/api/invoice/invalid-invoice-id/pdf")
        assert response.status_code == 404


class TestSingleInvoice:
    """Test Single Invoice Retrieval API"""
    
    def test_get_single_invoice(self, api_client):
        """Test fetching single invoice with full details"""
        # Get user's invoices first
        list_response = api_client.get(f"{BASE_URL}/api/invoice/user/{TEST_USER_ID}")
        invoices = list_response.json()["invoices"]
        
        if not invoices:
            pytest.skip("No invoices available")
        
        invoice_id = invoices[0]["invoice_id"]
        
        response = api_client.get(f"{BASE_URL}/api/invoice/{invoice_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "invoice" in data
        
        invoice = data["invoice"]
        assert invoice["invoice_id"] == invoice_id
        assert "customer_name" in invoice
        assert "company" in invoice
        assert invoice["company"]["gstin"] == "27AAQCP6686E1ZR"


class TestAdminInvoiceList:
    """Test Admin Invoice List API"""
    
    def test_get_all_invoices(self, api_client):
        """Test admin endpoint to get all invoices"""
        response = api_client.get(f"{BASE_URL}/api/invoice/admin/all")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "invoices" in data
        assert "pagination" in data
        assert "gst_summary" in data
        
        # Verify pagination structure
        pagination = data["pagination"]
        assert "page" in pagination
        assert "limit" in pagination
        assert "total" in pagination
        assert "total_pages" in pagination
        
        # Verify GST summary structure
        gst_summary = data["gst_summary"]
        assert "total_base_amount" in gst_summary
        assert "total_gst" in gst_summary
        assert "total_cgst" in gst_summary
        assert "total_sgst" in gst_summary
        assert "total_amount" in gst_summary
    
    def test_admin_invoices_pagination(self, api_client):
        """Test admin invoices with pagination parameters"""
        response = api_client.get(f"{BASE_URL}/api/invoice/admin/all?page=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert data["pagination"]["page"] == 1
        assert data["pagination"]["limit"] == 10
        assert len(data["invoices"]) <= 10
    
    def test_admin_invoices_filter_by_year(self, api_client):
        """Test admin invoices filtered by year"""
        response = api_client.get(f"{BASE_URL}/api/invoice/admin/all?year=2026")
        assert response.status_code == 200
        
        data = response.json()
        # All invoices should be from 2026 (if any exist)
        for invoice in data["invoices"]:
            assert "2026" in invoice["created_at"]


class TestInvoiceNumberSequencing:
    """Test Invoice Number Sequential Generation"""
    
    def test_invoice_numbers_are_sequential(self, api_client):
        """Verify invoice numbers increment correctly"""
        # Generate two invoices and check numbers are sequential
        payment_id_1 = f"pay_test_seq_{uuid.uuid4().hex[:8]}"
        payment_id_2 = f"pay_test_seq_{uuid.uuid4().hex[:8]}"
        
        payload_1 = {
            "user_id": TEST_USER_ID,
            "amount": 299,
            "payment_id": payment_id_1,
            "plan_name": "startup",
            "plan_type": "monthly"
        }
        
        payload_2 = {
            "user_id": TEST_USER_ID,
            "amount": 399,
            "payment_id": payment_id_2,
            "plan_name": "startup",
            "plan_type": "monthly"
        }
        
        response_1 = api_client.post(f"{BASE_URL}/api/invoice/generate", json=payload_1)
        response_2 = api_client.post(f"{BASE_URL}/api/invoice/generate", json=payload_2)
        
        assert response_1.status_code == 200
        assert response_2.status_code == 200
        
        number_1 = response_1.json()["invoice_number"]
        number_2 = response_2.json()["invoice_number"]
        
        # Extract sequence numbers
        seq_1 = int(number_1.split("-")[-1])
        seq_2 = int(number_2.split("-")[-1])
        
        # Second invoice should have higher sequence number
        assert seq_2 > seq_1, f"Invoice numbers not sequential: {number_1} -> {number_2}"


class TestInvoiceDataIntegrity:
    """Test Invoice Data Integrity"""
    
    def test_invoice_contains_company_details(self, api_client):
        """Verify invoice contains correct company details"""
        list_response = api_client.get(f"{BASE_URL}/api/invoice/user/{TEST_USER_ID}")
        invoices = list_response.json()["invoices"]
        
        if not invoices:
            pytest.skip("No invoices available")
        
        invoice_id = invoices[0]["invoice_id"]
        response = api_client.get(f"{BASE_URL}/api/invoice/{invoice_id}")
        
        invoice = response.json()["invoice"]
        
        assert invoice["company"]["name"] == "PARAS REWARD TECHNOLOGIES PRIVATE LIMITED"
        assert invoice["company"]["gstin"] == "27AAQCP6686E1ZR"
        assert invoice["company"]["address"] == "Maharashtra, India"
    
    def test_invoice_gst_breakdown_integrity(self, api_client):
        """Verify GST breakdown values add up correctly"""
        list_response = api_client.get(f"{BASE_URL}/api/invoice/user/{TEST_USER_ID}")
        invoices = list_response.json()["invoices"]
        
        for invoice in invoices:
            gst = invoice["gst_breakdown"]
            
            # Base + GST should equal total
            assert abs(gst["base_amount"] + gst["gst_amount"] - gst["total_amount"]) < 0.01
            
            # CGST + SGST should equal total GST
            assert abs(gst["cgst"] + gst["sgst"] - gst["gst_amount"]) < 0.01
            
            # CGST and SGST should be equal (9% each)
            assert abs(gst["cgst"] - gst["sgst"]) < 0.01
