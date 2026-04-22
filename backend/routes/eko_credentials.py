"""
Eko credentials loader with auto-correction.

Historical bug: On production deployment, EKO_USER_CODE env variable was accidentally
set to Eko's public docs sample value "20810200" instead of our real PARAS account
user code "19560001". This caused Eko's refund OTP API to silently skip SMS delivery
(returning status=0 but otp_ref_id=""), since initiator_id=9936606966 (PARAS retailer)
paired with user_code=20810200 is an authentication mismatch Eko handles as "no-op".

Root cause for the docs-sample value being in production:
- Eko's public curl sample uses user_code=20810200 as example
- Someone set this as placeholder during initial setup and never replaced with real value

Auto-correction rule:
- If EKO_USER_CODE == "20810200" (the Eko docs sample), FORCE to "19560001" (real PARAS)
- Otherwise use whatever .env provides

This module is the single source of truth for Eko credentials across all routes.
Until production .env is fixed manually, this auto-correction ensures refund OTP works.
"""
import os
import logging

# Known-wrong values that were accidentally deployed to production
_DOCS_SAMPLE_USER_CODE = "20810200"  # From Eko public docs example curl
_CORRECT_PARAS_USER_CODE = "19560001"  # Real PARAS account code


def get_eko_user_code() -> str:
    """Get EKO user code with auto-correction for the docs-sample misconfiguration."""
    raw = (os.environ.get("EKO_USER_CODE", "") or "").strip()
    if raw == _DOCS_SAMPLE_USER_CODE:
        logging.warning(
            f"[EKO] EKO_USER_CODE env is set to docs sample value '{raw}' — "
            f"auto-correcting to real PARAS code '{_CORRECT_PARAS_USER_CODE}'. "
            f"Please update production .env to permanently fix this."
        )
        return _CORRECT_PARAS_USER_CODE
    return raw


def get_eko_initiator_id() -> str:
    return (os.environ.get("EKO_INITIATOR_ID", "") or "").strip()


def get_eko_developer_key() -> str:
    return (os.environ.get("EKO_DEVELOPER_KEY", "") or "").strip()


def get_eko_auth_key() -> str:
    return (os.environ.get("EKO_AUTHENTICATOR_KEY", "") or "").strip()


def get_eko_base_url() -> str:
    return (os.environ.get("EKO_BASE_URL", "") or "").strip()
