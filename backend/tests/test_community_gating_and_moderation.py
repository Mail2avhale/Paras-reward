"""
End-to-end tests for community forum gating + moderation.

Covers:
  - Explorer / free / no-plan users → 403 on every interaction (post, comment, like, react, bookmark, comment-like)
  - Elite + admin + moderator → allowed
  - Negative-keyword posts/comments → 400 with friendly message + audit log
  - Spam-pattern posts → 400 + audit log
  - URL-spam pattern → 400
  - Clean posts → 200
  - AI tier is mocked (so tests are deterministic + free)

Tests use REAL MongoDB (dev) and exercise the route handlers directly,
matching the style of test_refund_otp_v1_e2e.py.
"""
import os
import sys
import asyncio
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
load_dotenv(BACKEND / ".env")
sys.path.insert(0, str(BACKEND))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from routes import community, community_moderation  # noqa: E402


SUFFIX = uuid.uuid4().hex[:6]
ELITE_USER = f"comm-elite-{SUFFIX}"
EXPLORER_USER = f"comm-explorer-{SUFFIX}"
ADMIN_USER = f"comm-admin-{SUFFIX}"
MOD_USER = f"comm-mod-{SUFFIX}"
NO_USER = f"comm-ghost-{SUFFIX}"


@pytest.fixture(scope="function")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    community.set_db(database)
    community_moderation.set_db(database)

    # Seed the four user types we need (mobile suffixed with SUFFIX → unique per run)
    base = int(SUFFIX, 16) % 90000 + 1000  # 4-5 digit deterministic-ish suffix
    users = [
        {"uid": ELITE_USER, "name": "Elite User", "subscription_plan": "elite",
         "email": f"{ELITE_USER}@test.local", "mobile": f"7{base:09d}"[:10]},
        {"uid": EXPLORER_USER, "name": "Explorer User", "subscription_plan": "explorer",
         "email": f"{EXPLORER_USER}@test.local", "mobile": f"7{base+1:09d}"[:10]},
        {"uid": ADMIN_USER, "name": "Admin User", "subscription_plan": "explorer",
         "is_admin": True, "role": "admin",
         "email": f"{ADMIN_USER}@test.local", "mobile": f"7{base+2:09d}"[:10]},
        {"uid": MOD_USER, "name": "Mod User", "subscription_plan": "explorer",
         "email": f"{MOD_USER}@test.local", "mobile": f"7{base+3:09d}"[:10]},
    ]
    for u in users:
        await database.users.replace_one({"uid": u["uid"]}, u, upsert=True)
    # Mod entry
    await database.community_moderators.replace_one(
        {"user_id": MOD_USER},
        {"user_id": MOD_USER, "status": "active"},
        upsert=True,
    )

    yield database

    # Cleanup
    uid_filter = {"$in": [ELITE_USER, EXPLORER_USER, ADMIN_USER, MOD_USER, NO_USER]}
    await database.users.delete_many({"uid": uid_filter})
    await database.community_moderators.delete_many({"user_id": uid_filter})
    await database.community_posts.delete_many({"user_id": uid_filter})
    await database.community_comments.delete_many({"user_id": uid_filter})
    await database.community_likes.delete_many({"user_id": uid_filter})
    await database.community_reactions.delete_many({"user_id": uid_filter})
    await database.community_bookmarks.delete_many({"user_id": uid_filter})
    await database.community_comment_likes.delete_many({"user_id": uid_filter})
    await database.community_moderation_logs.delete_many(
        {"title": {"$regex": SUFFIX}}
    )


def _post_req(uid, title="A perfectly nice and chill post about saving money and tips.",
              content="Hello friends, here is a useful tip about saving money and using bank transfers safely. Thanks!",
              category="General Discussion"):
    return community.CreatePostRequest(
        user_id=uid, user_name="Tester",
        title=title, content=content, category=category,
    )


# ─────────────────────────────────────────────────────────────────────────────
# PLAN GATING
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_explorer_cannot_create_post(db):
    with pytest.raises(HTTPException) as exc:
        await community.create_post(_post_req(EXPLORER_USER))
    assert exc.value.status_code == 403
    assert "Upgrade to Elite" in exc.value.detail


@pytest.mark.asyncio
async def test_no_user_cannot_create_post(db):
    with pytest.raises(HTTPException) as exc:
        await community.create_post(_post_req(NO_USER))
    # Either 401 (login) or 403 (not found / upgrade) — both block the action
    assert exc.value.status_code in (401, 403)


@pytest.mark.asyncio
async def test_explorer_cannot_like(db):
    # First seed a post by Elite so we have a valid post_id to like
    res = await community.create_post(_post_req(ELITE_USER))
    post_id = res["post"]["post_id"]

    class _Req:
        async def json(self):
            return {"user_id": EXPLORER_USER}

    with pytest.raises(HTTPException) as exc:
        await community.toggle_like(post_id, _Req())
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_explorer_cannot_react(db):
    res = await community.create_post(_post_req(ELITE_USER))
    post_id = res["post"]["post_id"]

    class _Req:
        async def json(self):
            return {"user_id": EXPLORER_USER, "emoji": "fire"}

    with pytest.raises(HTTPException) as exc:
        await community.toggle_reaction(post_id, _Req())
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_explorer_cannot_comment(db):
    res = await community.create_post(_post_req(ELITE_USER))
    post_id = res["post"]["post_id"]
    cmt = community.CommentRequest(
        user_id=EXPLORER_USER, user_name="X",
        content="Hello, this is a perfectly clean comment.",
    )
    with pytest.raises(HTTPException) as exc:
        await community.add_comment(post_id, cmt)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_explorer_cannot_bookmark(db):
    res = await community.create_post(_post_req(ELITE_USER))
    post_id = res["post"]["post_id"]

    class _Req:
        async def json(self):
            return {"user_id": EXPLORER_USER}

    with pytest.raises(HTTPException) as exc:
        await community.toggle_bookmark(post_id, _Req())
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_elite_can_create_post(db):
    res = await community.create_post(_post_req(ELITE_USER))
    assert res["success"] is True
    assert res["post"]["user_plan"] == "elite"


@pytest.mark.asyncio
async def test_admin_can_create_post(db):
    res = await community.create_post(_post_req(ADMIN_USER))
    assert res["success"] is True


@pytest.mark.asyncio
async def test_moderator_can_create_post(db):
    res = await community.create_post(_post_req(MOD_USER))
    assert res["success"] is True


# ─────────────────────────────────────────────────────────────────────────────
# CONTENT MODERATION — TIER 1 (keyword)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_negative_keyword_post_rejected(db):
    # English profanity
    bad = _post_req(
        ELITE_USER,
        title=f"This is bullshit fucking issue {SUFFIX}",
        content="I am so angry I want to say fuck this app forever.",
    )
    with pytest.raises(HTTPException) as exc:
        await community.create_post(bad)
    assert exc.value.status_code == 400
    assert "inappropriate content" in exc.value.detail.lower()

    # Hindi/Marathi profanity (romanised)
    bad2 = _post_req(
        ELITE_USER,
        title=f"You are all chutiya scammers test {SUFFIX}",
        content="Madarchod app is a fraud and you are bhenchod admins.",
    )
    with pytest.raises(HTTPException) as exc2:
        await community.create_post(bad2)
    assert exc2.value.status_code == 400


@pytest.mark.asyncio
async def test_url_spam_post_rejected(db):
    spammy = _post_req(
        ELITE_USER,
        title=f"Hot offer link list {SUFFIX}",
        content="Visit https://a.com and https://b.com plus https://c.com fast deals!",
    )
    with pytest.raises(HTTPException) as exc:
        await community.create_post(spammy)
    assert exc.value.status_code == 400
    assert "spam" in exc.value.detail.lower() or "could not be published" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_admin_bypasses_moderation(db):
    # Admin should be allowed to post even profanity-laden content
    bad = _post_req(
        ADMIN_USER,
        title=f"Admin warning post {SUFFIX}",
        content="We are removing fuck-laden spam. Users repeating chutiya words will be banned.",
    )
    res = await community.create_post(bad)
    assert res["success"] is True


@pytest.mark.asyncio
async def test_negative_keyword_comment_rejected(db):
    res = await community.create_post(_post_req(ELITE_USER))
    post_id = res["post"]["post_id"]
    bad_cmt = community.CommentRequest(
        user_id=ELITE_USER, user_name="Tester",
        content="You are all chutiya, go fuck yourself.",
    )
    with pytest.raises(HTTPException) as exc:
        await community.add_comment(post_id, bad_cmt)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_clean_post_passes_moderation(db):
    res = await community.create_post(_post_req(ELITE_USER))
    assert res["success"] is True
    assert res["post"]["status"] == "active"


@pytest.mark.asyncio
async def test_moderation_audit_log_written(db):
    bad = _post_req(
        ELITE_USER,
        title=f"chutiya app frauds {SUFFIX}",
        content="this fucking app is a scam, madarchod admins",
    )
    with pytest.raises(HTTPException):
        await community.create_post(bad)

    log = await db.community_moderation_logs.find_one(
        {"title": {"$regex": SUFFIX}, "auto_reject": True}
    )
    assert log is not None
    assert log.get("category") in ("negative", "spam")
    assert log.get("tier") == "keyword"


# ─────────────────────────────────────────────────────────────────────────────
# CONTENT MODERATION — TIER 2 (AI mocked)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ai_negative_verdict_rejects_post(db):
    """Mock _ai_classify to return a negative verdict on otherwise-clean text."""
    fake_verdict = {
        "category": "negative",
        "reason": "Sarcastic harassment detected by AI",
        "tier": "ai",
        "auto_reject": True,
    }
    with patch.object(community_moderation, "_ai_classify",
                      AsyncMock(return_value=fake_verdict)):
        sneaky = _post_req(
            ELITE_USER,
            title=f"A subtly worded post that bypasses keywords {SUFFIX}",
            content="No bad words but the meaning is hostile and mocking everyone here.",
        )
        with pytest.raises(HTTPException) as exc:
            await community.create_post(sneaky)
        assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_ai_failure_falls_back_to_clean(db):
    """If AI errors out, post should be allowed (do not block on AI failure)."""
    with patch.object(community_moderation, "_ai_classify",
                      AsyncMock(return_value=None)):  # AI unavailable
        clean = _post_req(
            ELITE_USER,
            title=f"Useful topic about earning rewards safely {SUFFIX}",
            content="Step by step guide on how to use the rewards system effectively without any risks.",
        )
        res = await community.create_post(clean)
        assert res["success"] is True


# ─────────────────────────────────────────────────────────────────────────────
# Moderation module unit-level tests (no HTTP, no DB writes needed for the verdict)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_keyword_screen_catches_devanagari(db):
    v = await community_moderation.classify_post(
        title="नमस्कार",
        content="हे चूतिया लोक scam करत आहेत.",
    )
    assert v["category"] == "negative"
    assert v["tier"] == "keyword"
    assert v["auto_reject"] is True


@pytest.mark.asyncio
async def test_keyword_screen_passes_clean_marathi(db):
    # AI is not consulted because text is short — fallback to clean
    v = await community_moderation.classify_post(
        title="नमस्कार",
        content="मला हा app आवडतो.",
    )
    assert v["category"] == "clean"
    assert v["auto_reject"] is False
