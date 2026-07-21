"""App version info endpoint — drives the in-app "Update Available" banner.

The latest version is stored as a single document in `app_config` collection
(key: "android_app_version"). Admins can update via a future admin endpoint,
or directly in MongoDB. Falls back to hardcoded defaults if absent.
"""
from fastapi import APIRouter
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/app", tags=["App Version"])

db = None


def set_db(database):
    global db
    db = database


# ── Defaults — bump these whenever you push a new Play Store build ──────────
# Feb 20 2026 — v1.2.3 release over v1.2.2:
#   • R8 FULL MODE enabled (Play Console recommendation) — ~20-30% smaller
#     AAB, ~15% lower cold-start memory. Aggressive whole-program
#     optimization + method inlining + class merging + dead-code
#     elimination on top of the shrinking/obfuscation that were already on.
#   • FIFO Monthly Reward Ceiling — per-role monthly caps on all
#     community-bonus earnings (User ₹1L / District ₹3L / Regional ₹4L /
#     State ₹5L / National ₹10L). Silent-skip on cap-hit.
#   • Same-or-higher partner_position structure validation — promoted
#     downlines still count toward parent's structure requirement.
#   • Admin Popup Placement Dropdown — 7 targeting surfaces.
#   • Redis-to-Mongo cache resilience — 500ms per-op timeout + circuit
#     breaker. Users no longer see the intermittent 30s "Verifying…"
#     hang when Upstash Redis flakes.
# v1.2.2 payload (Feb 17): AdMob global banner + PayPartnerStore blank fix.
LATEST_VERSION_NAME = "1.2.5"
LATEST_VERSION_CODE = 25
MINIMUM_SUPPORTED_VERSION_CODE = 1  # below this → force-update
PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.parasreward.prc"

# Human-readable release notes shown in the in-app "Update Available" banner
# when no custom notes are stored in Mongo (`app_config.android_app_version`).
DEFAULT_RELEASE_NOTES = (
    "What's new in v1.2.4:\n"
    "• Bigger rewards! Watch a short ad after KYC (+10 PRC), Redeem to Bank (+25 PRC), or Pay to Partner Store (+15 PRC)\n"
    "• Fixed: 'View Live Community Activity' now correctly shows the bonus-ad offer\n"
    "• New: Native-style 300×250 ads on Community Live Feed & Notifications (better content fit)\n"
    "• Behind the scenes: R8 Full Mode enabled — faster app launch, lower memory use\n"
    "\n"
    "Also includes v1.2.0/1.2.1/1.2.2/1.2.3 features:\n"
    "• 10-Level Community Bonus (max 7.20%)\n"
    "• Community Leader multipliers — District 1.25× → National 2.00×\n"
    "• Monthly Reward Ceiling display on Community page\n"
    "• PRC Statement Daily Summary view\n"
    "• Fixed: Ad banner no longer covers the bottom navigation"
)


class VersionUpdate(BaseModel):
    version_name: str
    version_code: int
    minimum_supported_code: Optional[int] = None
    release_notes: Optional[str] = None
    force_update: Optional[bool] = False


@router.get("/version-info")
async def get_version_info():
    """Returns latest version info. The Capacitor app polls this on launch
    and shows an in-app banner if its installed versionCode < latest.
    """
    doc = None
    try:
        doc = await db.app_config.find_one({"key": "android_app_version"})
    except Exception:
        pass
    cfg = doc or {}
    return {
        "platform": "android",
        "latest_version_name": cfg.get("version_name", LATEST_VERSION_NAME),
        "latest_version_code": int(cfg.get("version_code", LATEST_VERSION_CODE)),
        "minimum_supported_version_code": int(cfg.get("minimum_supported_code", MINIMUM_SUPPORTED_VERSION_CODE)),
        "force_update": bool(cfg.get("force_update", False)),
        "release_notes": cfg.get("release_notes", DEFAULT_RELEASE_NOTES),
        "play_store_url": PLAY_STORE_URL,
    }


@router.post("/admin/version-update")
async def admin_update_version(body: VersionUpdate):
    """Admin endpoint to bump latest app version (called after each AAB upload).
    No auth deps wired here — relies on admin frontend gating. Add admin-token
    check before exposing publicly.
    """
    update_doc = {
        "key": "android_app_version",
        "version_name": body.version_name,
        "version_code": body.version_code,
        "minimum_supported_code": body.minimum_supported_code or 1,
        "release_notes": body.release_notes or "Latest improvements and bug fixes.",
        "force_update": body.force_update or False,
    }
    await db.app_config.update_one({"key": "android_app_version"}, {"$set": update_doc}, upsert=True)
    return {"success": True, "version": update_doc}
