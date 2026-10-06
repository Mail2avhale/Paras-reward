"""
Transactional email service — Emergent-managed Resend proxy
Sep 17 2026

Sends branded transactional emails (password-reset only, for now) through
Emergent's integrations proxy.  The platform owns the verified sending
domain + the Resend account; we only hold a per-app `EMERGENT_EMAIL_KEY`
in the backend env.

Guardrails enforced per the Emergent email playbook:
  G1 — `from_name` is this app's own brand (Paras Rewards).
  G2 — No credential-asks, no <form>/<input> in HTML.
  G3 — Every link/asset is absolute https pointing at parasreward.com.
  G4 — Recipient + body come from server-side records/templates; the
       caller passes an email address only after we have looked up the
       user record ourselves.
  G5 — Transactional only (password reset, no marketing).
"""

from __future__ import annotations

import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Hardcoded proxy URL (survives deployment)
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Paras Rewards")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO", "info@parasreward.com")

# ------------- Guardrail Gate (verbatim from playbook) -----------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = (
    "reply with your password", "reply with the code", "send your password", "cvv",
    "send us your password", "enter your password below", "confirm your card number",
    "your full card number", "seed phrase", "recovery phrase", "verify your card",
    "social security number", "confirm your bank details",
)
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


# --------------------------- Send helper -------------------------------
async def send_email(*, to: str, subject: str, html: str,
                     reply_to: str | None = None) -> str | None:
    """Send an email through the Emergent proxy. Raises ValueError on
    guardrail failure; returns the Resend message-id on success."""
    _assert_safe_email(subject, html)
    if not EMAIL_KEY:
        raise RuntimeError("EMERGENT_EMAIL_KEY not configured")

    payload = {
        "to": [to],
        "subject": subject,
        "html": html,
        "from_name": EMAIL_FROM_NAME,  # REQUIRED on every send
    }
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"[EMAIL] Send failed: {e.response.status_code} {e.response.text}")
        raise
    except Exception as e:
        logger.error(f"[EMAIL] Send error: {e}")
        raise


# ----------------------- Password reset template -----------------------
APP_URL = "https://parasreward.com"


def build_password_reset_html(*, customer_name: str, reset_url: str) -> str:
    """Server-side password-reset template. No form/input, no credential
    ask-back — the recipient simply clicks the link and sets a new
    password on OUR page. All copy is server-controlled."""
    safe_name = escape(customer_name or "Customer")
    safe_url = escape(reset_url)
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="font-family:Arial,Helvetica,sans-serif;background:#FFF9E6;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0"
           style="background:#FFFFFF;border-radius:12px;border:1px solid #D1FAE5;">
      <tr><td style="padding:28px 28px 8px 28px;">
        <h1 style="margin:0 0 4px 0;font-size:22px;color:#14532D;">
          Reset your Paras Rewards password
        </h1>
        <p style="margin:0;color:#4B5563;font-size:14px;">
          Hi {safe_name}, we received a request to reset your password.
        </p>
      </td></tr>
      <tr><td style="padding:18px 28px;">
        <p style="margin:0 0 16px 0;color:#14532D;font-size:15px;line-height:22px;">
          Click the button below to choose a new password. The link is
          valid for <strong>1 hour</strong>. If you did not ask for a reset,
          you can safely ignore this email — your password will not change.
        </p>
        <p style="margin:28px 0;text-align:center;">
          <a href="{safe_url}"
             style="display:inline-block;padding:14px 28px;background:#3B82F6;
                    color:#FFFFFF;text-decoration:none;border-radius:8px;
                    font-weight:600;font-size:15px;">
            Reset Password
          </a>
        </p>
        <p style="margin:0 0 4px 0;color:#4B5563;font-size:12px;">
          If the button does not work, open this link in your browser:
        </p>
        <p style="margin:0;color:#3B82F6;font-size:12px;word-break:break-all;">
          <a href="{safe_url}" style="color:#3B82F6;text-decoration:underline;">{safe_url}</a>
        </p>
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #D1FAE5;">
        <p style="margin:0;color:#9CA3AF;font-size:11px;line-height:16px;">
          Sent by Paras Rewards.
          We never ask you to send back your password, OTP or card details by email.
          Need help? Reply to this email or write to info@parasreward.com.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
"""


async def send_password_reset_email(*, to: str, customer_name: str, reset_token: str) -> str | None:
    """High-level helper used by /auth/forgot-password."""
    reset_url = f"{APP_URL}/reset-password?token={reset_token}"
    subject = "Reset your Paras Rewards password"
    html = build_password_reset_html(customer_name=customer_name, reset_url=reset_url)
    return await send_email(to=to, subject=subject, html=html)


# ------------------------- Welcome template ---------------------------
PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.parasreward.prc"


def build_welcome_html(*, customer_name: str) -> str:
    """Signup welcome template — professional, transactional, Light pastel
    theme. CTA points to the Google Play listing. No credential ask-back,
    no forms, no shortened URLs. All copy is server-controlled."""
    from datetime import datetime as _dt
    safe_name = escape(customer_name or "there")
    year = _dt.now().year
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="font-family:Arial,Helvetica,sans-serif;background:#FFF9E6;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0"
           style="background:#FFFFFF;border-radius:12px;border:1px solid #D1FAE5;">
      <tr><td style="padding:28px 28px 8px 28px;">
        <h1 style="margin:0 0 8px 0;font-size:22px;color:#14532D;">
          Welcome to Paras Rewards
        </h1>
        <p style="margin:0;color:#4B5563;font-size:14px;">
          Hi {safe_name},
        </p>
      </td></tr>

      <tr><td style="padding:12px 28px;">
        <p style="margin:0 0 12px 0;color:#14532D;font-size:15px;line-height:22px;">
          🎉 We&rsquo;re excited to have you as a part of the Paras Rewards family.
          Your account has been successfully created, and you&rsquo;re now ready to
          discover a smarter way to shop, engage, earn rewards and enjoy more
          value from your everyday activities.
        </p>
      </td></tr>

      <tr><td style="padding:4px 28px 0 28px;">
        <h2 style="margin:0 0 8px 0;font-size:16px;color:#14532D;">
          🌟 Discover Paras Rewards
        </h2>
        <p style="margin:0 0 10px 0;color:#4B5563;font-size:14px;line-height:22px;">
          With Paras Rewards, you can explore exciting opportunities to:
        </p>
        <ul style="margin:0 0 14px 20px;padding:0;color:#374151;font-size:14px;line-height:22px;">
          <li>🛍️ Discover participating businesses &amp; offers</li>
          <li>🎁 Earn Reward benefits through eligible activities</li>
          <li>💰 Get more value from your everyday shopping &amp; engagement</li>
          <li>📲 Access exciting campaigns and promotional rewards</li>
          <li>🚀 Stay connected with new offers, campaigns and opportunities</li>
        </ul>
      </td></tr>

      <tr><td style="padding:4px 28px 0 28px;">
        <h2 style="margin:0 0 8px 0;font-size:16px;color:#14532D;">
          ⚡ Enjoy Paras Rewards Services
        </h2>
        <p style="margin:0 0 10px 0;color:#4B5563;font-size:14px;line-height:22px;">
          Your Paras Rewards account also gives you access to convenient
          services designed to make your rewards more useful in everyday life:
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="margin:0 0 10px 0;">
          <tr>
            <td style="padding:6px 0;color:#374151;font-size:14px;line-height:22px;">
              <strong>📱 Mobile Recharge</strong><br/>
              Recharge your mobile quickly and conveniently.
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#374151;font-size:14px;line-height:22px;">
              <strong>💡 Bill Payment</strong><br/>
              Pay eligible bills using your available reward balance.
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#374151;font-size:14px;line-height:22px;">
              <strong>🏦 Redeem to Bank</strong><br/>
              Redeem eligible rewards to your bank account, subject to
              applicable terms and conditions.
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#374151;font-size:14px;line-height:22px;">
              <strong>🛒 Pay at Partner Stores</strong><br/>
              Use eligible rewards to make payments at participating Paras
              Rewards partner stores.
            </td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:8px 28px 0 28px;">
        <h2 style="margin:0 0 8px 0;font-size:16px;color:#14532D;">
          🚀 Your Reward Journey Starts Now
        </h2>
        <p style="margin:0 0 14px 0;color:#374151;font-size:14px;line-height:22px;">
          Open the Paras Rewards App, complete your profile and start
          exploring the features, services, campaigns and rewards available
          to you.
        </p>
        <p style="margin:0 0 18px 0;color:#14532D;font-size:14px;line-height:22px;">
          <em>Your rewards. Your choices. Your Paras Rewards.</em>
        </p>
        <p style="margin:8px 0 24px 0;text-align:center;">
          <a href="{PLAY_STORE_URL}"
             style="display:inline-block;padding:14px 28px;background:#16A34A;
                    color:#FFFFFF;text-decoration:none;border-radius:8px;
                    font-weight:600;font-size:15px;">
            Download Android App
          </a>
        </p>
      </td></tr>

      <tr><td style="padding:8px 28px 16px 28px;">
        <p style="margin:0 0 6px 0;color:#374151;font-size:13px;line-height:20px;">
          Thank you for choosing Paras Rewards. We&rsquo;re happy to have you
          with us, and we look forward to making your everyday experience
          more rewarding.
        </p>
        <p style="margin:12px 0 0 0;color:#374151;font-size:13px;line-height:20px;">
          Warm regards,<br/>
          <strong>Team Paras Rewards</strong>
        </p>
      </td></tr>

      <tr><td style="padding:16px 28px;border-top:1px solid #D1FAE5;">
        <p style="margin:0 0 4px 0;color:#14532D;font-size:12px;line-height:18px;">
          <em>Your Rewards. Your Benefits. Your Paras Rewards.</em>
        </p>
        <p style="margin:0;color:#9CA3AF;font-size:11px;line-height:16px;">
          &copy; {year} Paras Rewards. All Rights Reserved.<br/>
          Sent by Paras Rewards. We never ask you to send back your
          password, OTP or card details by email. Need help? Reply to this
          email or write to info&#64;parasreward.com.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
"""


async def send_welcome_email(*, to: str, customer_name: str) -> str | None:
    """High-level helper used by signup routes. Fire-and-forget safe —
    callers should wrap in asyncio.create_task so signup latency is
    unaffected and email failures do not block registration."""
    subject = "Welcome to Paras Rewards"
    html = build_welcome_html(customer_name=customer_name)
    return await send_email(to=to, subject=subject, html=html)
