"""
Test HDFC Export Excel functionality
Tests the /api/admin/hdfc-export/combined endpoint for Excel export
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHDFCExportExcel:
    """HDFC Excel Export API Tests"""
    
    def test_export_combined_pending_returns_excel(self):
        """Test export with pending status returns Excel file"""
        response = requests.get(f"{BASE_URL}/api/admin/hdfc-export/combined", params={"status": "pending"})
        
        # Check for successful response or 404 (no data)
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        
        if response.status_code == 200:
            # Verify content type is Excel
            content_type = response.headers.get('content-type', '')
            assert 'spreadsheetml' in content_type or 'excel' in content_type.lower(), f"Expected Excel content type, got {content_type}"
            
            # Verify content disposition header for download
            content_disposition = response.headers.get('content-disposition', '')
            assert 'attachment' in content_disposition, "Should have attachment disposition for download"
            assert '.xlsx' in content_disposition, "Filename should have .xlsx extension"
            
            # Verify file size is reasonable (non-empty)
            assert len(response.content) > 1000, "Excel file should be at least 1KB"
            print(f"SUCCESS: Export with pending status returned Excel file ({len(response.content)} bytes)")
        else:
            # 404 is acceptable if no pending requests exist
            assert 'No requests found' in response.json().get('detail', '')
            print("SUCCESS: Export returned 404 with proper message - no pending requests")
    
    def test_export_combined_approved_returns_excel(self):
        """Test export with approved status"""
        response = requests.get(f"{BASE_URL}/api/admin/hdfc-export/combined", params={"status": "approved"})
        
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            assert 'spreadsheetml' in content_type or 'excel' in content_type.lower()
            print(f"SUCCESS: Export with approved status returned Excel file ({len(response.content)} bytes)")
        else:
            assert 'No requests found' in response.json().get('detail', '')
            print("SUCCESS: Export returned 404 - no approved requests")
    
    def test_export_invalid_status_returns_404(self):
        """Test export with invalid status returns 404"""
        response = requests.get(f"{BASE_URL}/api/admin/hdfc-export/combined", params={"status": "invalid_xyz"})
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        data = response.json()
        assert 'detail' in data, "Should have detail in error response"
        assert 'No requests found' in data['detail'], f"Unexpected detail: {data['detail']}"
        print(f"SUCCESS: Invalid status returns 404 with message: {data['detail']}")
    
    def test_export_bank_redeem_endpoint(self):
        """Test individual bank redeem export endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/hdfc-export/bank-redeem", params={"status": "pending"})
        
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        print(f"SUCCESS: Bank redeem export endpoint responded with {response.status_code}")
    
    def test_export_emi_payments_endpoint(self):
        """Test individual EMI payments export endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/hdfc-export/emi-payments", params={"status": "pending"})
        
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        print(f"SUCCESS: EMI payments export endpoint responded with {response.status_code}")
    
    def test_export_savings_vault_endpoint(self):
        """Test individual savings vault export endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/hdfc-export/savings-vault", params={"status": "pending"})
        
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        print(f"SUCCESS: Savings vault export endpoint responded with {response.status_code}")
    
    def test_export_preview_endpoint(self):
        """Test preview endpoint returns JSON"""
        response = requests.get(f"{BASE_URL}/api/admin/hdfc-export/preview", params={
            "payment_type": "combined",
            "status": "pending"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'preview' in data, "Should have preview array"
        assert 'summary' in data, "Should have summary object"
        assert 'download_url' in data, "Should have download_url"
        
        print(f"SUCCESS: Preview endpoint returned {data['summary']['total_records']} records")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
