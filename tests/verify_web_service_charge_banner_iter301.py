#!/usr/bin/env python3
"""Iteration 301 focused web regression for /my-service-charges Razorpay banner Pay.

Verifies the previous v1.4.2 web fixes still work in preview: the pending service
charge banner Pay button receives a real click and opens a Razorpay checkout iframe.
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
OUT_PATH = Path("/app/test_reports/web_service_charge_banner_iter301_results.json")
BAD_SNIPPETS = ("window.Razorpay is not a constructor", "Razorpay is not a constructor")


def seed_one_charge():
    subprocess.run(["python", SEED_SCRIPT, "1"], check=True, cwd="/app")


def login_payload() -> dict:
    response = requests.post(
        f"{API_BASE}/auth/login",
        json={
            "identifier": MOBILE,
            "password": PIN,
            "device_id": "WEB-QA-UPI-ITER301",
            "device_model": "Playwright QA Iter301",
            "os_version": "web",
            "ip_address": "127.0.0.1",
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    assert data.get("uid") == UID, data
    return data


async def iframe_count(page) -> int:
    return await page.evaluate(
        """() => document.querySelectorAll(
          'iframe.razorpay-checkout-frame, iframe[src*="razorpay"], iframe[name*="razorpay"], iframe[id*="razorpay"]'
        ).length"""
    )


async def script_count(page) -> int:
    return await page.evaluate(
        "document.querySelectorAll('script[src=\"https://checkout.razorpay.com/v1/checkout.js\"]').length"
    )


async def main():
    seed_one_charge()
    user = login_payload()
    safe_user = {k: v for k, v in user.items() if k not in {"hashed_pin", "pin_hash", "password"}}
    logs: list[str] = []
    result = {"scenario": "web_banner_pay_opens_razorpay_checkout", "passed": False}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path="/usr/bin/chromium")
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        await context.add_init_script(
            f"""
            localStorage.clear();
            sessionStorage.clear();
            localStorage.setItem('paras_user', {json.dumps(json.dumps(safe_user))});
            localStorage.setItem('paras_session_token', {json.dumps(user.get('session_token', ''))});
            localStorage.setItem('token', {json.dumps(user.get('token', ''))});
            """
        )
        page = await context.new_page()
        page.on("console", lambda msg: logs.append(f"{msg.type}: {msg.text}"))
        page.on("pageerror", lambda exc: logs.append(f"pageerror: {exc}"))

        try:
            await page.goto(f"{BASE_URL}/my-service-charges", wait_until="domcontentloaded")
            await expect(page.get_by_test_id("my-service-charges-page")).to_be_visible(timeout=30000)
            await expect(page.get_by_test_id("svc-charge-banner")).to_be_visible(timeout=30000)
            pay_button = page.get_by_test_id("banner-pay-btn")
            await expect(pay_button).to_contain_text("Pay ₹300", timeout=15000)

            hit_test = await pay_button.evaluate(
                """(btn) => {
                  const r = btn.getBoundingClientRect();
                  const x = r.left + r.width / 2;
                  const y = r.top + r.height / 2;
                  const top = document.elementFromPoint(x, y);
                  return {topTag: top?.tagName, topTestId: top?.getAttribute('data-testid'), buttonText: btn.textContent, x, y};
                }"""
            )
            if hit_test.get("topTestId") != "banner-pay-btn":
                raise AssertionError(f"Banner Pay button is not topmost at center: {hit_test}")

            await pay_button.click()
            await page.wait_for_function(
                """() => document.querySelectorAll(
                  'iframe.razorpay-checkout-frame, iframe[src*="razorpay"], iframe[name*="razorpay"], iframe[id*="razorpay"]'
                ).length > 0""",
                timeout=30000,
            )
            await page.wait_for_timeout(1000)
            constructor_error = any(bad in "\n".join(logs) for bad in BAD_SNIPPETS)
            result.update(
                {
                    "passed": not constructor_error,
                    "hit_test": hit_test,
                    "checkout_iframes": await iframe_count(page),
                    "script_count": await script_count(page),
                    "constructor_error_in_logs": constructor_error,
                    "logs_tail": logs[-12:],
                }
            )
            if result["checkout_iframes"] < 1:
                result["passed"] = False
                result["failure"] = "No Razorpay checkout iframe appeared after banner Pay click"
            if result["script_count"] != 1:
                result["passed"] = False
                result["failure"] = f"Expected exactly one checkout.js script tag, got {result['script_count']}"
            if constructor_error:
                result["failure"] = "Razorpay constructor error appeared in browser logs"
        except Exception as exc:
            result.update(
                {
                    "passed": False,
                    "failure": repr(exc),
                    "checkout_iframes": await iframe_count(page),
                    "script_count": await script_count(page),
                    "logs_tail": logs[-20:],
                }
            )
        finally:
            await context.close()
            await browser.close()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    if not result.get("passed"):
        raise SystemExit("web banner Razorpay regression failed")


if __name__ == "__main__":
    asyncio.run(main())