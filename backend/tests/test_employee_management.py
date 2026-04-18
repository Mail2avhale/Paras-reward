"""
Employee Management System Backend Tests
=========================================
Tests for:
1. Employee CRUD (Add, List, Update, Resign)
2. Employee Pool Wallet (Balance, Settings, Distribute, Post Salary)
3. Attendance (Mark single, Bulk mark, Get attendance)
4. Salary Slip (Generate, View)
5. ID Card Data
6. User Search for adding employees
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEmployeeDepartments:
    """Test GET /api/employees/departments - returns departments and designations lists"""
    
    def test_get_departments_returns_lists(self):
        response = requests.get(f"{BASE_URL}/api/employees/departments")
        assert response.status_code == 200
        data = response.json()
        
        # Verify departments list exists and has items
        assert "departments" in data
        assert isinstance(data["departments"], list)
        assert len(data["departments"]) > 0
        assert "Technology" in data["departments"]
        
        # Verify designations list exists and has items
        assert "designations" in data
        assert isinstance(data["designations"], list)
        assert len(data["designations"]) > 0
        assert "Software Developer" in data["designations"]


class TestEmployeeSearchUser:
    """Test GET /api/employees/search-user - search users for adding as employees"""
    
    def test_search_user_with_query(self):
        response = requests.get(f"{BASE_URL}/api/employees/search-user?q=999")
        assert response.status_code == 200
        data = response.json()
        
        assert "users" in data
        assert isinstance(data["users"], list)
        
        # Each user should have is_employee flag
        for user in data["users"]:
            assert "uid" in user
            assert "is_employee" in user
            assert isinstance(user["is_employee"], bool)
    
    def test_search_user_short_query_returns_empty(self):
        response = requests.get(f"{BASE_URL}/api/employees/search-user?q=a")
        assert response.status_code == 200
        data = response.json()
        assert data["users"] == []


class TestEmployeeList:
    """Test GET /api/employees/list - returns employees with stats"""
    
    def test_list_employees_returns_stats(self):
        response = requests.get(f"{BASE_URL}/api/employees/list")
        assert response.status_code == 200
        data = response.json()
        
        # Verify employees list
        assert "employees" in data
        assert isinstance(data["employees"], list)
        
        # Verify stats object
        assert "stats" in data
        stats = data["stats"]
        assert "total" in stats
        assert "active" in stats
        assert "resigned" in stats
        assert "total_monthly_salary" in stats
        
        # Stats should be numeric
        assert isinstance(stats["total"], int)
        assert isinstance(stats["active"], int)
        assert isinstance(stats["total_monthly_salary"], (int, float))
    
    def test_list_employees_with_status_filter(self):
        response = requests.get(f"{BASE_URL}/api/employees/list?status=active")
        assert response.status_code == 200
        data = response.json()
        
        # All returned employees should be active
        for emp in data["employees"]:
            assert emp["status"] == "active"


class TestEmployeeDetail:
    """Test GET /api/employees/detail/{employee_id}"""
    
    def test_get_employee_detail(self):
        response = requests.get(f"{BASE_URL}/api/employees/detail/EMP-0001")
        assert response.status_code == 200
        data = response.json()
        
        # Verify employee data
        assert "employee" in data
        emp = data["employee"]
        assert emp["employee_id"] == "EMP-0001"
        assert "name" in emp
        assert "department" in emp
        assert "designation" in emp
        assert "monthly_salary" in emp
        assert "salary_breakdown" in emp
        
        # Verify attendance data
        assert "attendance" in data
        assert "current_month" in data["attendance"]
        assert "summary" in data["attendance"]
        
        # Verify salary slips
        assert "salary_slips" in data
    
    def test_get_nonexistent_employee_returns_404(self):
        response = requests.get(f"{BASE_URL}/api/employees/detail/EMP-9999")
        assert response.status_code == 404


class TestEmployeeAdd:
    """Test POST /api/employees/add - creates employee with EMP-XXXX ID"""
    
    def test_add_employee_requires_fields(self):
        # Missing required fields should fail
        response = requests.post(f"{BASE_URL}/api/employees/add", json={
            "admin_id": "admin"
        })
        assert response.status_code == 422  # Validation error
    
    def test_add_employee_nonexistent_user_returns_404(self):
        response = requests.post(f"{BASE_URL}/api/employees/add", json={
            "user_id": "nonexistent-user-id",
            "department": "Technology",
            "designation": "Software Developer",
            "monthly_salary": 30000,
            "admin_id": "admin"
        })
        assert response.status_code == 404
    
    def test_add_already_employee_returns_400(self):
        # User 76b75808-47fa-48dd-ad7c-8074678e3607 is already EMP-0001
        response = requests.post(f"{BASE_URL}/api/employees/add", json={
            "user_id": "76b75808-47fa-48dd-ad7c-8074678e3607",
            "department": "Technology",
            "designation": "Software Developer",
            "monthly_salary": 30000,
            "admin_id": "admin"
        })
        assert response.status_code == 400
        assert "already" in response.json().get("detail", "").lower()


class TestEmployeeUpdate:
    """Test PUT /api/employees/update - can change department, designation, salary"""
    
    def test_update_employee_requires_employee_id(self):
        response = requests.put(f"{BASE_URL}/api/employees/update", json={
            "admin_id": "admin"
        })
        assert response.status_code == 422
    
    def test_update_nonexistent_employee_returns_404(self):
        response = requests.put(f"{BASE_URL}/api/employees/update", json={
            "employee_id": "EMP-9999",
            "department": "Marketing",
            "admin_id": "admin"
        })
        assert response.status_code == 404


class TestEmployeeResign:
    """Test POST /api/employees/resign - marks employee as resigned"""
    
    def test_resign_requires_employee_id(self):
        response = requests.post(f"{BASE_URL}/api/employees/resign", json={
            "admin_id": "admin"
        })
        assert response.status_code == 422
    
    def test_resign_nonexistent_employee_returns_404(self):
        response = requests.post(f"{BASE_URL}/api/employees/resign", json={
            "employee_id": "EMP-9999",
            "admin_id": "admin"
        })
        assert response.status_code == 404


class TestEmployeeAttendance:
    """Test attendance endpoints"""
    
    def test_get_attendance_for_employee(self):
        response = requests.get(f"{BASE_URL}/api/employees/attendance/EMP-0001?month=4&year=2026")
        assert response.status_code == 200
        data = response.json()
        
        assert data["employee_id"] == "EMP-0001"
        assert data["month"] == 4
        assert data["year"] == 2026
        assert "records" in data
        assert "summary" in data
        
        # Verify summary fields
        summary = data["summary"]
        assert "total_days" in summary
        assert "present" in summary
        assert "absent" in summary
        assert "half_day" in summary
        assert "leave" in summary
        assert "holiday" in summary
        assert "working_days" in summary
    
    def test_mark_single_attendance_requires_fields(self):
        response = requests.post(f"{BASE_URL}/api/employees/attendance/mark", json={
            "admin_id": "admin"
        })
        assert response.status_code == 422
    
    def test_mark_attendance_invalid_status_returns_400(self):
        response = requests.post(f"{BASE_URL}/api/employees/attendance/mark", json={
            "employee_id": "EMP-0001",
            "date": "2026-04-20",
            "status": "invalid_status",
            "admin_id": "admin"
        })
        assert response.status_code == 400
    
    def test_bulk_attendance_requires_fields(self):
        response = requests.post(f"{BASE_URL}/api/employees/attendance/bulk", json={
            "admin_id": "admin"
        })
        assert response.status_code == 422


class TestSalarySlip:
    """Test salary slip generation and retrieval"""
    
    def test_generate_salary_slip(self):
        response = requests.post(f"{BASE_URL}/api/employees/salary-slip/generate", json={
            "employee_id": "EMP-0001",
            "month": 4,
            "year": 2026,
            "admin_id": "admin"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "salary_slip" in data
        
        slip = data["salary_slip"]
        assert slip["employee_id"] == "EMP-0001"
        assert slip["month"] == 4
        assert slip["year"] == 2026
        
        # Verify company info
        assert "company" in slip
        assert slip["company"]["name"] == "Paras Reward Technologies Private Limited"
        
        # Verify earnings breakdown
        assert "earnings" in slip
        earnings = slip["earnings"]
        assert "basic_salary" in earnings
        assert "hra" in earnings
        assert "conveyance_allowance" in earnings
        assert "special_allowance" in earnings
        assert "medical_allowance" in earnings
        assert "total_earnings" in earnings
        
        # Verify deductions breakdown
        assert "deductions" in slip
        deductions = slip["deductions"]
        assert "pf_employee" in deductions
        assert "esi_employee" in deductions
        assert "professional_tax" in deductions
        assert "tds" in deductions
        assert "loss_of_pay" in deductions
        assert "total_deductions" in deductions
        
        # Verify attendance info
        assert "attendance" in slip
        assert "net_salary" in slip
    
    def test_generate_salary_slip_nonexistent_employee(self):
        response = requests.post(f"{BASE_URL}/api/employees/salary-slip/generate", json={
            "employee_id": "EMP-9999",
            "month": 4,
            "year": 2026,
            "admin_id": "admin"
        })
        assert response.status_code == 404
    
    def test_get_salary_slips_for_employee(self):
        response = requests.get(f"{BASE_URL}/api/employees/salary-slips/EMP-0001")
        assert response.status_code == 200
        data = response.json()
        
        assert "slips" in data
        assert isinstance(data["slips"], list)


class TestIDCard:
    """Test GET /api/employees/id-card/{employee_id}"""
    
    def test_get_id_card_data(self):
        response = requests.get(f"{BASE_URL}/api/employees/id-card/EMP-0001")
        assert response.status_code == 200
        data = response.json()
        
        assert "id_card" in data
        card = data["id_card"]
        
        # Verify company details
        assert card["company_name"] == "Paras Reward Technologies Private Limited"
        assert "B-18" in card["company_address"]
        assert card["company_website"] == "www.parasreward.com"
        
        # Verify employee details
        assert card["employee_id"] == "EMP-0001"
        assert "name" in card
        assert "designation" in card
        assert "department" in card
        assert "joining_date" in card
        assert "status" in card
    
    def test_get_id_card_nonexistent_employee(self):
        response = requests.get(f"{BASE_URL}/api/employees/id-card/EMP-9999")
        assert response.status_code == 404


class TestPoolWallet:
    """Test employee pool wallet endpoints"""
    
    def test_get_pool_balance(self):
        response = requests.get(f"{BASE_URL}/api/employees/pool/balance")
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields
        assert "pool_balance" in data
        assert "pool_rate" in data
        assert "prc_to_inr_rate" in data
        assert "enabled" in data
        assert "active_employees" in data
        assert "total_monthly_salary" in data
        
        # Verify types
        assert isinstance(data["pool_balance"], (int, float))
        assert isinstance(data["pool_rate"], (int, float))
        assert isinstance(data["prc_to_inr_rate"], (int, float))
        assert isinstance(data["enabled"], bool)
        assert isinstance(data["active_employees"], int)
    
    def test_update_pool_settings(self):
        response = requests.post(f"{BASE_URL}/api/employees/pool/settings", json={
            "pool_rate": 20,
            "prc_to_inr_rate": 0.10
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
    
    def test_distribute_pool(self):
        response = requests.post(f"{BASE_URL}/api/employees/pool/distribute", json={})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
    
    def test_post_salary(self):
        response = requests.post(f"{BASE_URL}/api/employees/pool/post-salary", json={
            "admin_id": "admin"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
    
    def test_get_pool_transactions(self):
        response = requests.get(f"{BASE_URL}/api/employees/pool/transactions?limit=10")
        assert response.status_code == 200
        data = response.json()
        
        assert "transactions" in data
        assert isinstance(data["transactions"], list)


class TestSalaryBreakdownCalculation:
    """Test that salary breakdown is calculated correctly"""
    
    def test_salary_breakdown_in_employee_list(self):
        response = requests.get(f"{BASE_URL}/api/employees/list")
        assert response.status_code == 200
        data = response.json()
        
        for emp in data["employees"]:
            if emp.get("salary_breakdown"):
                breakdown = emp["salary_breakdown"]
                
                # Verify earnings structure
                assert "earnings" in breakdown
                earnings = breakdown["earnings"]
                assert "basic_salary" in earnings
                assert "hra" in earnings
                assert "total_earnings" in earnings
                
                # Verify deductions structure
                assert "deductions" in breakdown
                deductions = breakdown["deductions"]
                assert "pf_employee" in deductions
                assert "total_deductions" in deductions
                
                # Verify net salary
                assert "net_salary" in breakdown
                
                # Basic validation: net = earnings - deductions
                expected_net = earnings["total_earnings"] - deductions["total_deductions"]
                assert abs(breakdown["net_salary"] - expected_net) < 0.01


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
