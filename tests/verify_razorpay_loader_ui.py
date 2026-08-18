#!/usr/bin/env python3
"""Focused UI verification for service-charge Razorpay SDK loader regression.

Tests only the reported bug paths:
  1. Global ServiceChargePendingBanner Pay button on /my-service-charges.
  2. My Service Charges row Pay Now button.
  3. Bulk Pay All button with 2+ pending charges.
  4. CDN-failure toast/hang behavior when checkout.js is blocked.
"""

import asyncio
import json
import os
import subprocess
from pathlib import Path

import requests
from playwright.async_api import async_playwright, expect


BASE_URL = os.environ.get("PARAS_PREVIEW_URL", "https://formula-audit-fix.preview.emergentagent.com")
API_BASE = f"{BASE_URL}/api"
MOBILE = "9970100782"
PIN = "997010"
UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
SEED_SCRIPT = "/app/tests/seed_service_charges_for_razorpay_bug.py"


def seed(count: int):
    subprocess.run(["python", SEED_SCRIPT, str(count)], check=True, cwd="/app")


def login_payload() -> dict:
    r = requests.post(
        f"{API_BASE}/auth/login",
        json={
            "identifier": MOBILE,
            "password": PIN,
            "device_id": "WEB-QA-RAZORPAY-LOADER",
            "device_model": "Playwright QA",
            "os_version": "web",
            "ip_address": "127.0.0.1",
        },
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    assert data.get("uid") == UID, data
    return data


async def make_context(browser, user: dict, block_cdn: bool = False):
    context = await browser.new_context(viewport={"width": 1920, "height": 1080})
    safe_user = {k: v for k, v in user.items() if k not in {"hashed_pin", "pin_hash", "password"}}
    init = f"""
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('paras_user', {json.dumps(json.dumps(safe_user))});
      localStorage.setItem('paras_session_token', {json.dumps(user.get('session_token', ''))});
      localStorage.setItem('token', {json.dumps(user.get('token', ''))});
    """
    await context.add_init_script(init)
    if block_cdn:
        async def abort_razorpay(route):
            await route.abort()
        await context.route("https://checkout.razorpay.com/v1/checkout.js", abort_razorpay)
    return context


async def page_with_list(context):
    page = await context.new_page()
    logs = []
    page.on("console", lambda msg: logs.append(f"{msg.type}: {msg.text}"))
    page.on("pageerror", lambda exc: logs.append(f"pageerror: {exc}"))
    await page.goto(f"{BASE_URL}/my-service-charges", wait_until="domcontentloaded")
    await expect(page.get_by_test_id("my-service-charges-page")).to_be_visible(timeout=30000)
    await expect(page.get_by_test_id("svc-charge-banner")).to_be_visible(timeout=30000)
    return page, logs


async def script_count(page) -> int:
    return await page.evaluate("document.querySelectorAll('script[src*=\"checkout.razorpay.com\"]').length")


async def iframe_count(page) -> int:
    return await page.evaluate("""
      () => document.querySelectorAll(
        'iframe.razorpay-checkout-frame, iframe[src*=\"razorpay\"], iframe[name*=\"razorpay\"], iframe[id*=\"razorpay\"]'
      ).length
    """)


async def wait_for_checkout(page):
    await page.wait_for_function(
        """() => document.querySelectorAll(
          'iframe.razorpay-checkout-frame, iframe[src*=\"razorpay\"], iframe[name*=\"razorpay\"], iframe[id*=\"razorpay\"]'
        ).length > 0""",
        timeout=30000,
    )
    await page.wait_for_timeout(1000)


async def toast_text(page) -> str:
    return await page.evaluate("""() => {
      const nodes = Array.from(document.querySelectorAll('[data-sonner-toast], [role="status"], [role="alert"], .error, [class*="error"], [id*="error"]'));
      return nodes.map(n => n.textContent || '').join(' | ');
    }""")


async def clear_checkout(page):
    await page.evaluate("""() => {
      document.querySelectorAll('.razorpay-container, iframe[src*=\"razorpay\"], iframe[name*=\"razorpay\"], iframe[id*=\"razorpay\"]').forEach(e => e.remove());
      document.body.style.overflow = '';
    }""")


async def run():
    user = login_payload()
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path="/usr/bin/chromium")

        # Scenario 1: global banner Pay ₹300 on a non-/subscription page.
        seed(1)
        ctx = await make_context(browser, user)
        page, logs = await page_with_list(ctx)
        await expect(page.get_by_test_id("banner-pay-btn")).to_contain_text("Pay ₹300", timeout=15000)
        await page.wait_for_function("document.querySelectorAll('script[src*=\"checkout.razorpay.com\"]').length <= 1")
        await page.get_by_test_id("banner-pay-btn").click(force=True)
        await wait_for_checkout(page)
        results.append({
            "scenario": "banner_pay",
            "checkout_iframes": await iframe_count(page),
            "script_count": await script_count(page),
            "constructor_error": any("Razorpay is not a constructor" in x or "window.Razorpay is not a constructor" in x for x in logs),
            "toast": await toast_text(page),
            "url": page.url,
        })
        await clear_checkout(page)
        await ctx.close()

        # Scenario 2: row Pay Now on My Service Charges.
        seed(1)
        ctx = await make_context(browser, user)
        page, logs = await page_with_list(ctx)
        row_pay = page.locator('[data-testid^="pay-btn-"]').first
        await expect(row_pay).to_be_visible(timeout=15000)
        await row_pay.click(force=True)
        await wait_for_checkout(page)
        results.append({
            "scenario": "row_pay_now",
            "checkout_iframes": await iframe_count(page),
            "script_count": await script_count(page),
            "constructor_error": any("Razorpay is not a constructor" in x or "window.Razorpay is not a constructor" in x for x in logs),
            "toast": await toast_text(page),
            "url": page.url,
        })
        await clear_checkout(page)
        await ctx.close()

        # Scenario 3: bulk Pay All with 2 pending charges.
        seed(2)
        ctx = await make_context(browser, user)
        page, logs = await page_with_list(ctx)
        await expect(page.get_by_test_id("bulk-pay-banner")).to_be_visible(timeout=15000)
        await page.get_by_test_id("bulk-pay-btn").click(force=True)
        await wait_for_checkout(page)
        results.append({
            "scenario": "bulk_pay_all",
            "checkout_iframes": await iframe_count(page),
            "script_count": await script_count(page),
            "constructor_error": any("Razorpay is not a constructor" in x or "window.Razorpay is not a constructor" in x for x in logs),
            "toast": await toast_text(page),
            "url": page.url,
        })
        await clear_checkout(page)
        await ctx.close()

        # Scenario 4: blocked checkout.js should surface clear load error, not constructor error.
        seed(1)
        ctx = await make_context(browser, user, block_cdn=True)
        page, logs = await page_with_list(ctx)
        await page.wait_for_timeout(1500)  # allow banner preload attempt to fail before user click
        await page.get_by_test_id("banner-pay-btn").click(force=True)
        await page.wait_for_timeout(5000)
        results.append({
            "scenario": "cdn_blocked_banner_pay",
            "checkout_iframes": await iframe_count(page),
            "script_count": await script_count(page),
            "button_text": await page.get_by_test_id("banner-pay-btn").inner_text(),
            "constructor_error": any("Razorpay is not a constructor" in x or "window.Razorpay is not a constructor" in x for x in logs),
            "toast": await toast_text(page),
            "logs_tail": logs[-10:],
            "url": page.url,
        })
        await ctx.close()

        await browser.close()
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    asyncio.run(run())