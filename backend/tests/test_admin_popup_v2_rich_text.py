"""
Backend tests for Rich-Text Popup Messages v2 feature.

Covers:
- POST /api/admin/popup/create with HTML sanitization + YouTube parsing + multi-CTA
- GET /api/admin/popup/active as public unauthenticated endpoint
- POST /api/admin/popup/upload-image (with auth + 16:9 normalization)
- HTML sanitizer XSS vector blocking (script/onerror/javascript/iframe/style)
- PUT /api/admin/popup/update/{id} — CTA array replacement + enabled=True disables others
- Auth guards: upload-image WITHOUT auth = 401, with regular-user token = 403
"""
import io
import os
import time
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = "admin@test.com"
ADMIN_PIN = "153759"
USER_MOBILE = "9970100782"
USER_PIN = "997010"


# ---------------- fixtures ----------------

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN},
        timeout=20,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok, f"no token in admin login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def user_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"mobile": USER_MOBILE, "pin": USER_PIN},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip(f"user login failed: {r.status_code} {r.text}")
    return r.json().get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def cleanup_popups(admin_headers):
    """Yields a list to append popup_ids to for teardown cleanup."""
    created = []
    yield created
    for pid in created:
        try:
            requests.delete(
                f"{BASE_URL}/api/admin/popup/delete/{pid}",
                headers=admin_headers,
                timeout=10,
            )
        except Exception:
            pass


# ---------------- create + sanitize ----------------

class TestCreateRichPopup:
    def test_create_with_html_youtube_ctas_sanitized(self, admin_headers, cleanup_popups):
        payload = {
            "title": "TEST_RichPopup",
            "message_html": (
                "<h2>Hi</h2><p>Body <strong>bold</strong> "
                "<script>alert(1)</script>"
                '<a href="https://parasreward.com">Visit</a></p>'
            ),
            "youtube_url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "cta_buttons": [
                {"text": "Learn More", "link": "https://parasreward.com", "style": "primary"},
                {"text": "Dismiss", "link": None, "style": "ghost"},
            ],
            "message_type": "success",
            "enabled": True,
        }
        r = requests.post(
            f"{BASE_URL}/api/admin/popup/create",
            json=payload, headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True, d
        data = d["data"]
        cleanup_popups.append(data["popup_id"])

        html = data["message_html"]
        # bleach strips <script> tags entirely (element removed).
        # Note: bleach preserves inner text content by default; that's safe
        # because it's rendered as text (never executed), but flagged here
        # for reviewer awareness.
        assert "<script" not in html.lower(), f"script tag not stripped: {html}"
        assert "<strong>bold</strong>" in html, f"strong not preserved: {html}"
        assert "<h2>Hi</h2>" in html, html
        # anchor safety
        assert 'target="_blank"' in html, f"target=_blank missing: {html}"
        assert 'rel="noopener noreferrer"' in html, f"rel missing: {html}"

        assert data["youtube_id"] == "dQw4w9WgXcQ", data
        assert data["youtube_url"] == payload["youtube_url"]

        ctas = data["cta_buttons"]
        assert isinstance(ctas, list) and len(ctas) == 2, ctas
        assert ctas[0]["text"] == "Learn More"
        assert ctas[0]["link"] == "https://parasreward.com"
        assert ctas[0]["style"] == "primary"
        assert ctas[1]["text"] == "Dismiss"
        assert ctas[1]["style"] == "ghost"


# ---------------- public /active ----------------

class TestPublicActive:
    def test_public_get_active_no_auth(self, admin_headers, cleanup_popups):
        # Create an active popup
        r = requests.post(
            f"{BASE_URL}/api/admin/popup/create",
            json={
                "title": "TEST_PublicActive",
                "message_html": "<p>Hello <strong>world</strong></p>",
                "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
                "image_url": None,
                "cta_buttons": [{"text": "OK", "link": "/x", "style": "primary"}],
                "enabled": True,
            },
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200, r.text
        pid = r.json()["data"]["popup_id"]
        cleanup_popups.append(pid)

        # No auth header
        r2 = requests.get(f"{BASE_URL}/api/admin/popup/active", timeout=15)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d.get("success") is True
        assert d.get("has_popup") is True, d
        popup = d["data"]
        for key in ("message_html", "image_url", "youtube_url", "youtube_id", "cta_buttons"):
            assert key in popup, f"missing key {key} in public response: {popup}"
        assert popup["youtube_id"] == "dQw4w9WgXcQ"


# ---------------- image upload ----------------

def _make_test_png_bytes(w=400, h=300, color=(120, 60, 200)):
    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestImageUpload:
    def test_upload_image_admin_success_large(self, admin_token):
        """Upload 1600x900 image — should be resized to 800x450 JPEG."""
        blob = _make_test_png_bytes(1600, 900)
        files = {"file": ("test_popup_large.png", blob, "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/admin/popup/upload-image",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True, d
        assert d["image_url"].startswith("/api/static/popups/"), d
        assert d["dimensions"] == "800x450", f"large image should be 800x450, got {d['dimensions']}"

        # Fetch image (public static).
        img_url = f"{BASE_URL}{d['image_url']}"
        r2 = requests.get(img_url, timeout=15)
        assert r2.status_code == 200, f"cannot fetch uploaded image: {r2.status_code} {img_url}"
        ct = r2.headers.get("content-type", "")
        assert "image/jpeg" in ct, f"unexpected content-type: {ct}"

    def test_upload_image_admin_small_16_9_crop(self, admin_token):
        """Upload 400x300 (4:3) — 16:9 crop applied; NOTE current impl only
        downsizes >800 wide, so smaller images are NOT upscaled to 800x450.
        This test documents actual behavior and verifies the crop still works.
        """
        blob = _make_test_png_bytes(400, 300)
        files = {"file": ("test_popup_small.png", blob, "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/admin/popup/upload-image",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True, d
        # Aspect ratio must be 16:9 regardless of dimensions.
        w, h = d["dimensions"].split("x")
        w, h = int(w), int(h)
        ratio = w / h
        assert abs(ratio - 16 / 9) < 0.01, f"expected 16:9 ratio, got {w}x{h}"

    def test_upload_image_rejects_oversize(self, admin_token):
        """Files > 5MB should be rejected with 400."""
        big = b"\x89PNG\r\n\x1a\n" + b"A" * (6 * 1024 * 1024)
        files = {"file": ("big.png", big, "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/admin/popup/upload-image",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 400, f"expected 400 for >5MB, got {r.status_code}"

    def test_upload_image_rejects_bad_extension(self, admin_token):
        blob = b"not-a-real-image"
        files = {"file": ("bad.gif", blob, "image/gif")}
        r = requests.post(
            f"{BASE_URL}/api/admin/popup/upload-image",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_upload_image_no_auth_returns_401(self):
        blob = _make_test_png_bytes(100, 100)
        files = {"file": ("nauth.png", blob, "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/admin/popup/upload-image",
            files=files, timeout=15,
        )
        assert r.status_code == 401, f"expected 401 without auth, got {r.status_code}: {r.text}"

    def test_upload_image_regular_user_returns_403(self, user_token):
        if not user_token:
            pytest.skip("no user token")
        blob = _make_test_png_bytes(100, 100)
        files = {"file": ("reg.png", blob, "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/admin/popup/upload-image",
            files=files,
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403 for regular user, got {r.status_code}: {r.text}"


# ---------------- XSS vectors ----------------

class TestSanitizerBlocksXSS:
    @pytest.mark.parametrize("attack,check", [
        ("<script>alert('xss')</script><p>ok</p>", "<script"),
        ('<a href="javascript:alert(1)">bad</a>', "javascript:"),
        ('<img src=x onerror=alert(1)>', "onerror"),
        ('<iframe src="https://evil.com"></iframe>', "<iframe"),
        ('<p style="background:url(javascript:alert(1))">x</p>', "javascript:"),
    ])
    def test_attack_stripped(self, admin_headers, cleanup_popups, attack, check):
        r = requests.post(
            f"{BASE_URL}/api/admin/popup/create",
            json={
                "title": "TEST_XSS",
                "message_html": attack,
                "enabled": False,
            },
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True, d
        pid = d["data"]["popup_id"]
        cleanup_popups.append(pid)

        html = d["data"]["message_html"]
        assert check.lower() not in html.lower(), (
            f"XSS vector `{check}` not stripped: {html}"
        )


# ---------------- update ----------------

class TestUpdate:
    def test_update_replaces_cta_array_and_enables_only_one(self, admin_headers, cleanup_popups):
        # Popup A
        rA = requests.post(
            f"{BASE_URL}/api/admin/popup/create",
            json={"title": "TEST_A", "message_html": "<p>A</p>",
                  "cta_buttons": [{"text": "One", "link": "/a", "style": "primary"}],
                  "enabled": True},
            headers=admin_headers, timeout=20,
        )
        assert rA.status_code == 200
        pidA = rA.json()["data"]["popup_id"]
        cleanup_popups.append(pidA)

        time.sleep(0.5)

        # Popup B — disabled initially
        rB = requests.post(
            f"{BASE_URL}/api/admin/popup/create",
            json={"title": "TEST_B", "message_html": "<p>B</p>", "enabled": False},
            headers=admin_headers, timeout=20,
        )
        assert rB.status_code == 200
        pidB = rB.json()["data"]["popup_id"]
        cleanup_popups.append(pidB)

        # PUT update Popup B: replace CTA array + enable=True
        new_ctas = [
            {"text": "Alpha", "link": "https://a.example.com", "style": "primary"},
            {"text": "Beta", "link": None, "style": "secondary"},
            {"text": "Gamma", "link": "https://g.example.com", "style": "ghost"},
        ]
        rU = requests.put(
            f"{BASE_URL}/api/admin/popup/update/{pidB}",
            json={"cta_buttons": new_ctas, "enabled": True},
            headers=admin_headers, timeout=20,
        )
        assert rU.status_code == 200, rU.text
        assert rU.json().get("success") is True

        # Verify via /all listing
        rAll = requests.get(
            f"{BASE_URL}/api/admin/popup/all", headers=admin_headers, timeout=15,
        )
        docs = rAll.json()["data"]
        docA = next(p for p in docs if p["popup_id"] == pidA)
        docB = next(p for p in docs if p["popup_id"] == pidB)
        assert docB["enabled"] is True, docB
        assert docA["enabled"] is False, f"A should be auto-disabled by enabling B: {docA}"
        assert len(docB["cta_buttons"]) == 3, docB["cta_buttons"]
        assert [c["text"] for c in docB["cta_buttons"]] == ["Alpha", "Beta", "Gamma"]
