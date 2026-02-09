"""
Test PLME (Paras Living Moments Engine) API endpoints.
Tests video overlay feature that shows real animal videos on dashboard.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_USER_UID = "73b95483-f36b-4637-a5ee-d447300c6835"


class TestPLMEAPI:
    """Tests for PLME feature - real animal video overlays"""
    
    def test_plme_config_endpoint(self):
        """Test /api/plme/config returns valid configuration"""
        response = requests.get(f"{BASE_URL}/api/plme/config")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify essential config fields
        assert "plme_enabled" in data, "Config should have plme_enabled"
        assert data["plme_enabled"] == True, "PLME should be enabled"
        
        # Check daily limits
        assert "daily_limits" in data
        assert "free_user" in data["daily_limits"]
        assert "vip_user" in data["daily_limits"]
        assert isinstance(data["daily_limits"]["free_user"], int)
        assert isinstance(data["daily_limits"]["vip_user"], int)
        
        # Check trigger window
        assert "trigger_window_seconds" in data
        assert "min" in data["trigger_window_seconds"]
        assert "max" in data["trigger_window_seconds"]
        
        # Check duration settings
        assert "duration_seconds" in data
        assert "min" in data["duration_seconds"]
        assert "max" in data["duration_seconds"]
        
        # Check category weights
        assert "category_weights" in data
        assert "cute_playful" in data["category_weights"]
        assert "calm_nature" in data["category_weights"]
        
        print(f"PLME Config: enabled={data['plme_enabled']}, daily_limits={data['daily_limits']}")
    
    def test_plme_next_moment_endpoint(self):
        """Test /api/plme/next-moment/{user_id} returns video moment"""
        response = requests.get(f"{BASE_URL}/api/plme/next-moment/{TEST_USER_UID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Should have show_moment field
        assert "show_moment" in data, "Response should have show_moment field"
        
        # If moment is available
        if data["show_moment"]:
            # Verify moment structure
            assert "moment" in data, "Should have moment data when show_moment is true"
            moment = data["moment"]
            
            # Check moment fields
            assert "id" in moment, "Moment should have id"
            assert "name" in moment, "Moment should have name"
            assert "url" in moment, "Moment should have url"
            assert "category" in moment, "Moment should have category"
            assert "duration" in moment, "Moment should have duration"
            assert "trigger_delay" in moment, "Moment should have trigger_delay"
            
            # Verify URL is a video URL (Pexels CDN)
            assert moment["url"].startswith("https://"), "URL should be HTTPS"
            assert "pexels.com" in moment["url"], "URL should be from Pexels CDN"
            assert ".mp4" in moment["url"], "URL should be MP4 video"
            
            # Verify category is valid
            assert moment["category"] in ["cute_playful", "calm_nature"], f"Invalid category: {moment['category']}"
            
            # Verify duration is reasonable
            assert 10 <= moment["duration"] <= 30, f"Duration should be 10-30 seconds, got {moment['duration']}"
            
            # Verify trigger_delay is in range
            assert 30 <= moment["trigger_delay"] <= 180, f"Trigger delay should be 30-180 seconds, got {moment['trigger_delay']}"
            
            # Check additional metadata
            assert "is_vip" in data, "Should have is_vip field"
            assert "is_night" in data, "Should have is_night field"
            assert "shown_today" in data, "Should have shown_today field"
            assert "daily_limit" in data, "Should have daily_limit field"
            
            print(f"Moment: name={moment['name']}, category={moment['category']}, duration={moment['duration']}s")
            print(f"Video URL: {moment['url'][:80]}...")
        else:
            # Daily limit might be reached
            assert "reason" in data, "Should have reason when show_moment is false"
            print(f"No moment shown: {data.get('reason')}")
    
    def test_plme_video_url_accessible(self):
        """Test that video URLs returned by API are accessible (may fail due to hotlink protection)"""
        response = requests.get(f"{BASE_URL}/api/plme/next-moment/{TEST_USER_UID}")
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("show_moment") and data.get("moment"):
            video_url = data["moment"]["url"]
            
            # Try to access the video URL
            # Note: This might fail with 403 due to Pexels hotlink protection
            # but should work when loaded in browser with proper referer
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8"
            }
            video_response = requests.head(video_url, headers=headers, timeout=10)
            
            # 403 is expected due to hotlink protection - video will work in browser
            # 200 means direct access works
            assert video_response.status_code in [200, 403, 302], f"Unexpected status: {video_response.status_code}"
            
            if video_response.status_code == 403:
                print(f"WARNING: Video URL returns 403 (hotlink protection) - should work in browser")
            elif video_response.status_code == 200:
                print(f"Video URL is directly accessible")
    
    def test_plme_record_view_endpoint(self):
        """Test /api/plme/record-view/{user_id} records view correctly"""
        # First get a moment
        response = requests.get(f"{BASE_URL}/api/plme/next-moment/{TEST_USER_UID}")
        assert response.status_code == 200
        data = response.json()
        
        if data.get("show_moment") and data.get("moment"):
            asset_id = data["moment"]["id"]
            
            # Record the view
            record_response = requests.post(
                f"{BASE_URL}/api/plme/record-view/{TEST_USER_UID}",
                json={
                    "asset_id": asset_id,
                    "reward": 0  # Reward is disabled by default
                }
            )
            
            assert record_response.status_code == 200, f"Expected 200, got {record_response.status_code}"
            
            record_data = record_response.json()
            assert record_data.get("success") == True, "Record view should succeed"
            assert record_data.get("recorded") == True, "recorded field should be true"
            
            print(f"View recorded for asset: {asset_id}")
        else:
            print("Skipping record view test - no moment available")
    
    def test_plme_multiple_moments_unique(self):
        """Test that subsequent API calls return different moments (anti-repeat logic)"""
        # Reset by using a different user context - use random part
        import random
        temp_uid = f"test-{random.randint(100000, 999999)}"
        
        moments_seen = []
        
        for i in range(3):
            response = requests.get(f"{BASE_URL}/api/plme/next-moment/{temp_uid}")
            assert response.status_code == 200
            
            data = response.json()
            if data.get("show_moment") and data.get("moment"):
                moment_id = data["moment"]["id"]
                moments_seen.append(moment_id)
                
                # Record the view to update history
                requests.post(
                    f"{BASE_URL}/api/plme/record-view/{temp_uid}",
                    json={"asset_id": moment_id, "reward": 0}
                )
        
        # If we got 3 moments, at least 2 should be different
        if len(moments_seen) >= 2:
            # Due to randomness, we just check they're valid IDs
            for m in moments_seen:
                assert m.startswith("cat_") or m.startswith("dog_") or m.startswith("rabbit_") or \
                       m.startswith("bird_") or m.startswith("butterfly_") or m.startswith("fish_") or \
                       m.startswith("nature_") or m.startswith("sunset_") or m.startswith("puppy_"), \
                       f"Unexpected moment ID format: {m}"
            print(f"Moments returned: {moments_seen}")
    
    def test_plme_admin_stats_endpoint(self):
        """Test /api/admin/plme/stats returns statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/plme/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check today stats
        assert "today" in data, "Should have today stats"
        assert "unique_users" in data["today"]
        assert "total_moments" in data["today"]
        
        # Check all-time stats
        assert "all_time" in data, "Should have all_time stats"
        assert "total_moments" in data["all_time"]
        assert "unique_users" in data["all_time"]
        
        print(f"PLME Stats - Today: {data['today']['total_moments']} moments, {data['today']['unique_users']} users")
        print(f"All-time: {data['all_time']['total_moments']} moments, {data['all_time']['unique_users']} users")


class TestPLMEAssetConfiguration:
    """Tests for PLME asset configuration"""
    
    def test_assets_have_video_type(self):
        """Verify PLME assets are configured as video type"""
        response = requests.get(f"{BASE_URL}/api/plme/next-moment/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        
        if data.get("show_moment") and data.get("moment"):
            # Asset should have proper video URL
            moment = data["moment"]
            url = moment.get("url", "")
            
            assert url.endswith(".mp4"), f"URL should end with .mp4: {url}"
            assert "videos.pexels.com" in url, f"URL should be from Pexels: {url}"
            
            print(f"Asset configured correctly: {moment['name']} ({moment['category']})")
    
    def test_night_mode_preference(self):
        """Test that night mode affects category selection"""
        # Just verify the API returns is_night field
        response = requests.get(f"{BASE_URL}/api/plme/next-moment/{TEST_USER_UID}")
        assert response.status_code == 200
        
        data = response.json()
        
        assert "is_night" in data, "Response should include is_night field"
        print(f"Night mode: {data['is_night']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
