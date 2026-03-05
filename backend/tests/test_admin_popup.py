"""
Test Admin Popup Message Feature
Tests CRUD operations for popup messages
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope='module')
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def test_popup_id():
    """Create a test popup and return its ID, then cleanup after test"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Create test popup
    timestamp = int(time.time())
    response = session.post(f"{BASE_URL}/api/admin/popup/create", json={
        "title": f"TEST_Popup_{timestamp}",
        "message": "Test message for automated testing",
        "button_text": "Close",
        "message_type": "info",
        "enabled": False  # Create disabled to not interfere with user experience
    })
    
    data = response.json()
    popup_id = data.get('data', {}).get('popup_id')
    
    yield popup_id
    
    # Cleanup: Delete the test popup
    if popup_id:
        session.delete(f"{BASE_URL}/api/admin/popup/delete/{popup_id}")


class TestPopupAPIs:
    """Test Popup Message API Endpoints"""
    
    def test_get_all_popups(self, api_client):
        """GET /api/admin/popup/all - Returns all popup messages"""
        response = api_client.get(f"{BASE_URL}/api/admin/popup/all")
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert 'data' in data
        assert 'total' in data
        assert isinstance(data['data'], list)
    
    def test_get_active_popup(self, api_client):
        """GET /api/admin/popup/active - Returns active popup for users"""
        response = api_client.get(f"{BASE_URL}/api/admin/popup/active")
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert 'has_popup' in data
        assert 'data' in data
        
        # If there's an active popup, verify structure
        if data['has_popup'] and data['data']:
            popup = data['data']
            assert 'id' in popup
            assert 'title' in popup
            assert 'message' in popup
            assert 'button_text' in popup
            assert 'message_type' in popup
    
    def test_create_popup(self, api_client):
        """POST /api/admin/popup/create - Creates new popup message"""
        timestamp = int(time.time())
        
        response = api_client.post(f"{BASE_URL}/api/admin/popup/create", json={
            "title": f"TEST_Create_{timestamp}",
            "message": "Test popup creation",
            "button_text": "OK",
            "message_type": "info",
            "enabled": False
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert 'data' in data
        
        popup = data['data']
        assert 'popup_id' in popup
        assert popup['title'] == f"TEST_Create_{timestamp}"
        assert popup['message'] == "Test popup creation"
        assert popup['button_text'] == "OK"
        assert popup['message_type'] == "info"
        assert popup['enabled'] is False
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/admin/popup/delete/{popup['popup_id']}")
    
    def test_create_popup_required_fields(self, api_client):
        """POST /api/admin/popup/create - Validates required fields"""
        # Title is required
        response = api_client.post(f"{BASE_URL}/api/admin/popup/create", json={
            "message": "Missing title"
        })
        # Should return 422 validation error
        assert response.status_code == 422
        
        # Message is required
        response = api_client.post(f"{BASE_URL}/api/admin/popup/create", json={
            "title": "Missing message"
        })
        assert response.status_code == 422
    
    def test_update_popup(self, api_client, test_popup_id):
        """PUT /api/admin/popup/update/{id} - Updates popup message"""
        response = api_client.put(f"{BASE_URL}/api/admin/popup/update/{test_popup_id}", json={
            "title": "Updated Title",
            "message": "Updated message content"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        
        # Verify update by getting all popups
        all_response = api_client.get(f"{BASE_URL}/api/admin/popup/all")
        all_data = all_response.json()
        
        updated_popup = next((p for p in all_data['data'] if p['popup_id'] == test_popup_id), None)
        assert updated_popup is not None
        assert updated_popup['title'] == "Updated Title"
        assert updated_popup['message'] == "Updated message content"
    
    def test_update_popup_not_found(self, api_client):
        """PUT /api/admin/popup/update/{id} - Returns 404 for non-existent popup"""
        response = api_client.put(f"{BASE_URL}/api/admin/popup/update/popup_nonexistent", json={
            "title": "Test"
        })
        
        assert response.status_code == 404
    
    def test_toggle_popup(self, api_client, test_popup_id):
        """PATCH /api/admin/popup/toggle/{id} - Toggles popup enabled/disabled"""
        # Get initial state
        all_response = api_client.get(f"{BASE_URL}/api/admin/popup/all")
        all_data = all_response.json()
        initial_popup = next((p for p in all_data['data'] if p['popup_id'] == test_popup_id), None)
        initial_enabled = initial_popup['enabled']
        
        # Toggle
        response = api_client.patch(f"{BASE_URL}/api/admin/popup/toggle/{test_popup_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['enabled'] is not initial_enabled
        
        # Toggle back to original state
        api_client.patch(f"{BASE_URL}/api/admin/popup/toggle/{test_popup_id}")
    
    def test_toggle_popup_not_found(self, api_client):
        """PATCH /api/admin/popup/toggle/{id} - Returns 404 for non-existent popup"""
        response = api_client.patch(f"{BASE_URL}/api/admin/popup/toggle/popup_nonexistent")
        
        assert response.status_code == 404
    
    def test_delete_popup(self, api_client):
        """DELETE /api/admin/popup/delete/{id} - Deletes popup message"""
        # Create a popup to delete
        timestamp = int(time.time())
        create_response = api_client.post(f"{BASE_URL}/api/admin/popup/create", json={
            "title": f"TEST_Delete_{timestamp}",
            "message": "Will be deleted",
            "enabled": False
        })
        popup_id = create_response.json()['data']['popup_id']
        
        # Delete
        response = api_client.delete(f"{BASE_URL}/api/admin/popup/delete/{popup_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        
        # Verify deletion
        all_response = api_client.get(f"{BASE_URL}/api/admin/popup/all")
        all_data = all_response.json()
        deleted_popup = next((p for p in all_data['data'] if p['popup_id'] == popup_id), None)
        assert deleted_popup is None
    
    def test_delete_popup_not_found(self, api_client):
        """DELETE /api/admin/popup/delete/{id} - Returns 404 for non-existent popup"""
        response = api_client.delete(f"{BASE_URL}/api/admin/popup/delete/popup_nonexistent")
        
        assert response.status_code == 404
    
    def test_only_one_active_popup(self, api_client):
        """Verify that enabling a popup disables all others"""
        import time as t
        
        # Create first popup and enable it
        response1 = api_client.post(f"{BASE_URL}/api/admin/popup/create", json={
            "title": f"TEST_First_{int(t.time())}",
            "message": "First popup",
            "enabled": True
        })
        data1 = response1.json()
        popup1_id = data1['data']['popup_id']
        
        t.sleep(1.1)  # Wait > 1 second since popup_id uses seconds timestamp
        
        # Create second popup and enable it
        response2 = api_client.post(f"{BASE_URL}/api/admin/popup/create", json={
            "title": f"TEST_Second_{int(t.time())}",
            "message": "Second popup",
            "enabled": True
        })
        data2 = response2.json()
        popup2_id = data2['data']['popup_id']
        
        # Verify they have different IDs
        assert popup1_id != popup2_id, f"Popup IDs should be unique: {popup1_id} vs {popup2_id}"
        
        # Verify only second is active
        all_response = api_client.get(f"{BASE_URL}/api/admin/popup/all")
        all_data = all_response.json()
        
        popup1 = next((p for p in all_data['data'] if p['popup_id'] == popup1_id), None)
        popup2 = next((p for p in all_data['data'] if p['popup_id'] == popup2_id), None)
        
        assert popup1 is not None, f"Popup1 not found: {popup1_id}"
        assert popup2 is not None, f"Popup2 not found: {popup2_id}"
        assert popup1['enabled'] is False, f"Popup1 should be disabled, got: {popup1['enabled']}"
        assert popup2['enabled'] is True, f"Popup2 should be enabled, got: {popup2['enabled']}"
        
        # Verify active endpoint returns popup2
        active_response = api_client.get(f"{BASE_URL}/api/admin/popup/active")
        active_data = active_response.json()
        assert active_data['has_popup'] is True
        assert active_data['data']['id'] == popup2_id
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/admin/popup/delete/{popup1_id}")
        api_client.delete(f"{BASE_URL}/api/admin/popup/delete/{popup2_id}")


class TestPopupMessageTypes:
    """Test popup message types"""
    
    @pytest.mark.parametrize("message_type", ["info", "success", "warning", "error"])
    def test_create_popup_with_different_types(self, api_client, message_type):
        """Test creating popups with different message types"""
        timestamp = int(time.time())
        
        response = api_client.post(f"{BASE_URL}/api/admin/popup/create", json={
            "title": f"TEST_{message_type}_{timestamp}",
            "message": f"Test {message_type} message",
            "message_type": message_type,
            "enabled": False
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['data']['message_type'] == message_type
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/admin/popup/delete/{data['data']['popup_id']}")


class TestPopupButtonLink:
    """Test popup button link functionality"""
    
    def test_create_popup_with_link(self, api_client):
        """Test creating popup with button link"""
        timestamp = int(time.time())
        
        response = api_client.post(f"{BASE_URL}/api/admin/popup/create", json={
            "title": f"TEST_Link_{timestamp}",
            "message": "Test with link",
            "button_text": "Go to Page",
            "button_link": "/redeem?service=dmt",
            "enabled": False
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data['data']['button_link'] == "/redeem?service=dmt"
        assert data['data']['button_text'] == "Go to Page"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/admin/popup/delete/{data['data']['popup_id']}")
    
    def test_create_popup_without_link(self, api_client):
        """Test creating popup without button link defaults to Close"""
        timestamp = int(time.time())
        
        response = api_client.post(f"{BASE_URL}/api/admin/popup/create", json={
            "title": f"TEST_NoLink_{timestamp}",
            "message": "Test without link",
            "enabled": False
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data['data']['button_text'] == "Close"
        assert data['data']['button_link'] is None
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/admin/popup/delete/{data['data']['popup_id']}")
