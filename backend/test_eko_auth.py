"""
Eko DMT API Authentication Test Script
======================================
Run this script to test Eko API connectivity.

Usage:
    python test_eko_auth.py

Expected Result:
    - If IP is whitelisted: Customer data or "463" (not found)
    - If IP not whitelisted: 403 Forbidden
"""

import hmac
import base64
import hashlib
import time
import requests
import os

# Load credentials from environment or use defaults
EKO_DEVELOPER_KEY = os.environ.get("EKO_DEVELOPER_KEY", "7c179a397b4710e71b2248d1f5892d19")
EKO_AUTHENTICATOR_KEY = os.environ.get("EKO_AUTHENTICATOR_KEY", "mining-formula-v2")
EKO_INITIATOR_ID = os.environ.get("EKO_INITIATOR_ID", "9936606966")
EKO_USER_CODE = os.environ.get("EKO_USER_CODE", "20810200")
EKO_BASE_URL = os.environ.get("EKO_BASE_URL", "https://api.eko.in:25002/ekoicici")


def generate_secret_key(timestamp_ms: str, auth_key: str) -> str:
    """
    Generate Eko secret-key as per official documentation.
    
    Formula:
    1. Base64 encode the authenticator key
    2. HMAC-SHA256(base64_key, timestamp_ms)
    3. Base64 encode the result
    """
    # Base64 encode the key
    encoded_key = base64.b64encode(auth_key.encode('utf-8')).decode('utf-8')
    
    # HMAC-SHA256
    signature = hmac.new(
        encoded_key.encode('utf-8'),
        timestamp_ms.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    # Base64 encode
    secret_key = base64.b64encode(signature).decode('utf-8')
    
    return secret_key


def test_customer_search(mobile: str = "9421331342"):
    """Test Eko Customer Search API"""
    print("=" * 60)
    print("EKO DMT API Authentication Test")
    print("=" * 60)
    
    # Get current IP
    try:
        ip_response = requests.get("https://api.ipify.org", timeout=5)
        current_ip = ip_response.text
        print(f"Current Server IP: {current_ip}")
    except:
        current_ip = "Unknown"
        print("Could not determine current IP")
    
    print(f"\nCredentials:")
    print(f"  Developer Key: {EKO_DEVELOPER_KEY[:10]}...")
    print(f"  Initiator ID: {EKO_INITIATOR_ID}")
    print(f"  User Code: {EKO_USER_CODE}")
    print(f"  Auth Key: {EKO_AUTHENTICATOR_KEY[:10]}...")
    
    # Generate authentication
    timestamp_ms = str(int(time.time() * 1000))
    secret_key = generate_secret_key(timestamp_ms, EKO_AUTHENTICATOR_KEY)
    
    print(f"\nAuthentication:")
    print(f"  Timestamp (ms): {timestamp_ms}")
    print(f"  Secret Key: {secret_key[:20]}...")
    
    # Prepare request
    url = f"{EKO_BASE_URL}/v1/customers/mobile_number:{mobile}?initiator_id={EKO_INITIATOR_ID}&user_code={EKO_USER_CODE}"
    
    headers = {
        "developer_key": EKO_DEVELOPER_KEY,
        "secret-key": secret_key,
        "secret-key-timestamp": timestamp_ms,
        "initiator_id": EKO_INITIATOR_ID
    }
    
    print(f"\nRequest:")
    print(f"  URL: {url}")
    print(f"  Method: GET")
    
    # Make request
    print(f"\nCalling Eko API...")
    try:
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"\nResponse:")
        print(f"  Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"  Status: {data.get('status')}")
                print(f"  Message: {data.get('message')}")
                
                if data.get('status') == 0:
                    print("\n✅ SUCCESS! Eko API is working!")
                    print(f"  Customer Data: {data.get('data', {})}")
                elif data.get('status') == 463:
                    print("\n✅ SUCCESS! API authenticated but customer not found (463)")
                    print("  This is expected for new customers")
                else:
                    print(f"\n⚠️ API returned status: {data.get('status')}")
            except:
                print(f"  Raw Response: {response.text[:500]}")
        
        elif response.status_code == 403:
            print("\n❌ 403 FORBIDDEN - IP NOT WHITELISTED!")
            print(f"   Current IP: {current_ip}")
            print(f"   Whitelisted IPs (production): 34.44.149.98, 34.10.166.75")
            print("\n   ACTION REQUIRED:")
            print(f"   Add IP '{current_ip}' to Eko whitelist at connect.eko.in")
            print(f"   Raw Response: {response.text[:200]}")
        
        else:
            print(f"  Response: {response.text[:500]}")
            
    except requests.exceptions.Timeout:
        print("\n❌ Request timed out!")
    except requests.exceptions.ConnectionError as e:
        print(f"\n❌ Connection error: {e}")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    test_customer_search()
