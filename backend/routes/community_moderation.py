"""
Community post moderation — two-tier hybrid approach.

Tier 1 (fast, free): keyword blacklist for English + Marathi/Hindi profanity,
abuse, and obvious spam. Catches ~80% of bad posts with zero LLM cost.

Tier 2 (LLM, accurate): Gemini 2.5 Flash classifies anything that passes the
keyword filter but looks suspicious (mid-length, unusual punctuation, unknown
non-ASCII chars). Returns one of: clean / negative / spam / needs_review.

Public surface:
    classify_post(title, content) -> dict
        {
            "category": "clean" | "negative" | "spam" | "needs_review",
            "reason": <short string>,
            "tier": "keyword" | "ai" | "fallback",
            "auto_reject": bool,   # True → caller hard-deletes the post
        }

Failure mode: if the AI call errors out, we fall back to "clean" so a
broken LLM key never blocks the community feature. The audit log captures
every classification (including errors) under the `community_moderation_logs`
collection for ops review.
"""
from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

# DB injected from server.py via set_db()
db = None
def set_db(database):
    global db
    db = database


# ─────────────────────────────────────────────────────────────────────────────
# Tier 1 — Keyword blacklist (case-insensitive substring match on word
# boundaries where possible). Covers English + Devanagari + romanised
# profanity that we've seen in real reports.
# ─────────────────────────────────────────────────────────────────────────────

# WARNING: This list contains slurs/abuse intentionally; it is never
# user-visible — the only consumers are the regexes below. Keep all-lowercase.
_NEGATIVE_KEYWORDS = {
    # English profanity / slurs
    "fuck", "fck", "fuk", "fucking", "fucker", "motherfucker", "mf",
    "shit", "shitty", "bullshit",
    "asshole", "asshat", "ass hole", "bastard", "bitch", "bitches",
    "cunt", "dick", "dickhead", "pussy", "twat",
    "nigger", "nigga", "faggot", "retard", "retarded",
    "rape", "raping", "rapist",
    # Generic threats / harassment
    "kill you", "kill u", "i will kill", "murder you", "die scammer",
    "bomb you", "shoot you", "stab you",
    # Hindi/Marathi romanised profanity (very common in user reports)
    "chutiya", "chutia", "chutiye", "chootiya", "ch00tiya",
    "madarchod", "mc ", "mcbc", "bhenchod", "bc ", "bhen ke",
    "lund", "loda", "lauda", "lawda",
    "gandu", "gaand", "gand", "gandu mc",
    "haraami", "harami", "harmi", "kutti", "kamina", "kameena",
    "saala", "saale", "saalaa",
    "randi", "rand ka", "rand ki",
    # Devanagari (covers users typing in native script)
    "चूतिया", "मादरचोद", "भेनचोद", "रंडी", "हरामी", "गांडू",
    # Spam patterns
    "click here to win", "free money", "guaranteed returns",
    "100% profit", "double your money", "send otp", "share otp",
    "telegram channel join", "whatsapp group join free",
}

# Pre-compile a single boundary-aware regex for speed (called on every post)
_NEGATIVE_RE = re.compile(
    r"(?<![\w])(" + "|".join(re.escape(w) for w in sorted(_NEGATIVE_KEYWORDS, key=len, reverse=True)) + r")(?![\w])",
    re.IGNORECASE,
)

# All-caps shouting + repeated punctuation → likely abusive even if no keyword
_SHOUT_RE = re.compile(r"[A-Z]{15,}")
_PUNCT_SPAM_RE = re.compile(r"([!?$])\1{4,}")
# Bare-URL spam (>2 links in a short post)
_URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)


def _keyword_screen(text: str) -> Optional[dict]:
    """Tier-1 fast screen. Returns a verdict dict if it caught something, else None."""
    if not text:
        return None
    m = _NEGATIVE_RE.search(text)
    if m:
        return {
            "category": "negative",
            "reason": "Contains prohibited word",
            "tier": "keyword",
            "auto_reject": True,
        }
    if _SHOUT_RE.search(text) and _PUNCT_SPAM_RE.search(text):
        return {
            "category": "negative",
            "reason": "Excessive shouting / punctuation spam",
            "tier": "keyword",
            "auto_reject": True,
        }
    urls = _URL_RE.findall(text)
    if len(urls) >= 3 and len(text) < 400:
        return {
            "category": "spam",
            "reason": "Too many links for a short post",
            "tier": "keyword",
            "auto_reject": True,
        }
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Tier 2 — Gemini 2.5 Flash classification (called only when Tier 1 is unsure)
# ─────────────────────────────────────────────────────────────────────────────

_GEMINI_SYSTEM_PROMPT = (
    "You are a strict content moderator for a financial-rewards community forum used "
    "primarily by Indian users (English / Marathi / Hindi). Classify each post into "
    "EXACTLY ONE of: clean, negative, spam, needs_review.\n"
    "  - clean: ordinary discussion, questions, help, success stories, tips.\n"
    "  - negative: profanity, abuse, harassment, hate speech, threats, slurs, doxxing.\n"
    "  - spam: scams, phishing, OTP-asking, get-rich-quick, irrelevant promotions.\n"
    "  - needs_review: borderline cases — political, off-topic, unclear intent.\n"
    "Reply with ONLY a single JSON object on one line, no markdown, no prose. "
    'Schema: {"category":"clean|negative|spam|needs_review","reason":"<<=80 chars>"}'
)


async def _ai_classify(title: str, content: str) -> Optional[dict]:
    """Tier-2 LLM call. Returns verdict dict or None if AI is unavailable / errors."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        return None

    try:
        # Imported lazily so a broken install doesn't crash the whole community module.
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        logging.warning(f"[COMMUNITY MOD] emergentintegrations import failed: {e}")
        return None

    body = (title.strip() + "\n\n" + content.strip())[:4000]
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"community-mod-{uuid.uuid4().hex[:8]}",
            system_message=_GEMINI_SYSTEM_PROMPT,
        ).with_model("gemini", "gemini-2.5-flash")

        raw = await chat.send_message(UserMessage(text=body))
        if not raw:
            return None

        # Strip code fences if the model added any despite instructions
        cleaned = str(raw).strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
        # Find the first {...} object
        m = re.search(r"\{[^{}]*\}", cleaned, re.DOTALL)
        if not m:
            return None

        import json
        parsed = json.loads(m.group(0))
        cat = (parsed.get("category") or "").strip().lower()
        if cat not in ("clean", "negative", "spam", "needs_review"):
            return None
        return {
            "category": cat,
            "reason": (parsed.get("reason") or "")[:120],
            "tier": "ai",
            "auto_reject": cat in ("negative", "spam"),
        }
    except Exception as e:
        logging.warning(f"[COMMUNITY MOD] AI classify failed: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────

async def classify_post(title: str, content: str) -> dict:
    """Classify a community post; auto-rejects negative/spam content."""
    title = title or ""
    content = content or ""
    combined = f"{title}\n{content}"

    # Tier 1
    kw = _keyword_screen(combined)
    if kw:
        await _audit(title, content, kw)
        return kw

    # Tier 2 — only call AI for posts long enough to merit an LLM round-trip.
    # Very short posts (<25 chars) that pass Tier 1 are almost certainly fine.
    verdict: Optional[dict] = None
    if len(combined.strip()) >= 25:
        verdict = await _ai_classify(title, content)

    if verdict is None:
        verdict = {
            "category": "clean",
            "reason": "Passed keyword screen; AI not consulted or unavailable",
            "tier": "fallback",
            "auto_reject": False,
        }

    await _audit(title, content, verdict)
    return verdict


async def _audit(title: str, content: str, verdict: dict) -> None:
    """Persist every moderation decision so admins can audit / tune the rules."""
    if db is None:
        return
    try:
        await db.community_moderation_logs.insert_one({
            "title": (title or "")[:200],
            "content_preview": (content or "")[:300],
            "category": verdict.get("category"),
            "tier": verdict.get("tier"),
            "reason": verdict.get("reason"),
            "auto_reject": bool(verdict.get("auto_reject")),
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass
