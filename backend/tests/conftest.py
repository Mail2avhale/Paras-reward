"""
Pytest configuration and shared fixtures for backend tests
"""
import os
import sys

# Ensure /app/backend is on sys.path so `from app.core.database import ...`
# works when pytest is launched from /app or /app/backend/tests.
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

# Load .env so tests see the real MongoDB / Razorpay creds
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(_ROOT, ".env"))
except Exception:
    pass

import pytest  # noqa: E402
import requests  # noqa: E402

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def base_url():
    """Return the base URL for API calls"""
    return BASE_URL
