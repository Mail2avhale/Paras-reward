"""
REGRESSION GUARD — 29 Apr 2026
==============================

PRODUCTION BUG (RCA):
  User PRAFULLA MUKUND KOYANDE registered first with email
  `Prafullakoyande8@gmail.com` (capital P) on 1 Feb 2026 — earned 1.82 lakh PRC,
  bought Elite plan. On 27 Mar 2026, the same person signed up AGAIN using a
  different mobile and the same email but lowercase: `prafullakoyande8@gmail.com`.
  Because `routes/auth.py register_user()` did a case-SENSITIVE
  `find_one({"email": data["email"]})` check, the duplicate slipped through.
  Result: a fresh Explorer account with 0 PRC. User logged into the new account
  on 29 Apr and saw "everything gone" — extreme support pain.

This test pins the fix:
  1. Email is lowercased BEFORE storage AND BEFORE duplicate check.
  2. Duplicate check uses case-insensitive regex anchor.
  3. Duplicate response surfaces the existing user's masked mobile so they
     can log in to the right account (or use password reset).
  4. Duplicate mobile is also blocked.

Run with:
    cd /app/backend && python -m pytest tests/test_regression_email_case_signup.py -v
"""

import pytest


def test_register_email_case_insensitive_duplicate_check_present():
    """The signup duplicate-email check must use a case-insensitive match,
    not a literal equality. Without this, `Foo@bar.com` and `foo@bar.com`
    create two separate accounts."""
    src_path = "/app/backend/routes/auth.py"
    with open(src_path, "r") as fp:
        contents = fp.read()
    # Look for the case-insensitive guard
    assert '"$options": "i"' in contents and "email" in contents, (
        "REGRESSION: routes/auth.py register_user() no longer uses a "
        "case-insensitive email duplicate check. Two users with the same "
        "email but different case will create separate accounts."
    )


def test_register_email_lowercased_before_store():
    """The email must be lowercased before storage. Otherwise users who type
    `User@Gmail.com` will be findable only with that exact case."""
    src_path = "/app/backend/routes/auth.py"
    with open(src_path, "r") as fp:
        contents = fp.read()
    # Look for the strip().lower() normalization right inside register_user
    assert 'data["email"] = data["email"].strip().lower()' in contents, (
        "REGRESSION: register_user() does not lowercase the email before storing."
    )


def test_register_duplicate_mobile_blocked():
    """Duplicate mobile must also be blocked. Otherwise the same person can
    create N accounts with N variations of the same email but the same phone."""
    src_path = "/app/backend/routes/auth.py"
    with open(src_path, "r") as fp:
        contents = fp.read()
    assert '"mobile": mobile' in contents and "An account with this mobile number already exists" in contents, (
        "REGRESSION: register_user() no longer blocks duplicate mobile signups."
    )


def test_duplicate_helpful_error_includes_masked_mobile():
    """The duplicate-email error MUST tell the user which mobile their existing
    account uses (last 4 digits) so they can log in to the right account
    instead of creating yet another duplicate."""
    src_path = "/app/backend/routes/auth.py"
    with open(src_path, "r") as fp:
        contents = fp.read()
    assert "mobile number ending in" in contents and "[-4:]" in contents, (
        "REGRESSION: duplicate-email error no longer surfaces masked mobile."
    )


@pytest.mark.asyncio
async def test_live_register_blocks_case_variant_duplicate():
    """Live integration: register a user with one email case, then attempt
    to register again with the same email in a different case + different
    mobile. The second registration must fail with a clear message."""
    import os
    import httpx
    import uuid
    from dotenv import load_dotenv
    load_dotenv("/app/frontend/.env")

    base = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
    if not base:
        pytest.skip("REACT_APP_BACKEND_URL not set")

    # Random unique base email
    suffix = uuid.uuid4().hex[:8]
    email_lc = f"casecheck-{suffix}@test.local"
    email_uc = f"CaseCheck-{suffix}@test.local"
    mobile1 = "9" + uuid.uuid4().hex[:9].upper().replace("A", "1").replace("B", "2").replace("C", "3").replace("D", "4").replace("E", "5").replace("F", "6")[:9]
    # Numeric mobile
    mobile1 = str(9100000000 + (hash(suffix) % 9000000000))[:10]
    mobile2 = str(9200000000 + (hash(suffix + "y") % 9000000000))[:10]

    payload1 = {
        "name": "Case Test 1",
        "email": email_lc,
        "mobile": mobile1,
        "password": "Password@123",
    }
    payload2 = {
        "name": "Case Test 2",
        "email": email_uc,  # SAME email, different case
        "mobile": mobile2,  # different mobile to bypass mobile dedup
        "password": "Password@123",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        r1 = await client.post(f"{base}/api/auth/register", json=payload1)
        if r1.status_code not in (200, 201):
            pytest.skip(f"first registration failed (env may not allow registration): {r1.status_code} {r1.text[:200]}")

        r2 = await client.post(f"{base}/api/auth/register", json=payload2)

        # Cleanup: delete the fresh accounts to keep DB clean
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            from dotenv import load_dotenv as _ld
            _ld("/app/backend/.env")
            mc = AsyncIOMotorClient(os.environ["MONGO_URL"])
            db = mc[os.environ["DB_NAME"]]
            await db.users.delete_many({"email": {"$regex": f"^casecheck-{suffix}@test.local$", "$options": "i"}})
        except Exception:
            pass

    assert r2.status_code == 400, f"second registration must be rejected, got {r2.status_code}: {r2.text[:200]}"
    detail = r2.json().get("detail", "").lower()
    assert "already exists" in detail or "already registered" in detail, (
        f"Duplicate response should be clear, got: {detail}"
    )
