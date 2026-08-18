#!/usr/bin/env python3
"""Iteration 299 focused UI verification for Razorpay checkout.js loader.

Scope: only the reported My Service Charges payment regression.
Verifies three user payment entry points with checkout.js available, with the CDN
aborted, and one silent CDN hang to exercise the 12s hard timeout.
"""

import asyncio
import json
import os
import subprocess
import time
from pathlib import Path

import requests
from playwright.async_api import async_playwright, expect, TimeoutError as PlaywrightTimeoutError


BASE_URL = os.environ.get("PARAS_PREVIEW_URL", "https://formula-audit-fix.preview.emergentagent.com")
API_BASE = f"{BASE_URL}/api"
MOBILE = "9970100782"
PIN = "997010"
UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
SEED_SCRIPT = "/app/tests/seed_service_charges_for_razorpay_bug.py"
OUT_PATH = Path("/app/test_reports/razorpay_loader_ui_iter299_results.json")

EXPECTED_TOAST_SNIPPETS = (
    "Razorpay checkout.js failed to load",
    "Razorpay checkout.js load timed out",
)
BAD_SNIPPETS = (
    "window.Razorpay is not a constructor",
    "Razorpay is not a constructor",
)


def seed(count: int):
    subprocess.run(["python", SEED_SCRIPT, str(count)], check=True, cwd="/app")


def login_payload() -> dict:
    response = requests.post(
        f"{API_BASE}/auth/login",
        json={
            "identifier": MOBILE,
            "password": PIN,
            "device_id": "WEB-QA-RAZORPAY-LOADER-ITER299",
            "device_model": "Playwright QA Iter299",
            "os_version": "web",
            "ip_address": "127.0.0.1",
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    assert data.get("uid") == UID, data
    return data


async def make_context(browser, user: dict, block_mode: str | None = None):
    context = await browser.new_context(viewport={"width": 1920, "height": 1080})
    safe_user = {k: v for k, v in user.items() if k not in {"hashed_pin", "pin_hash", "password"}}
    await context.add_init_script(
        f"""
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('paras_user', {json.dumps(json.dumps(safe_user))});
        localStorage.setItem('paras_session_token', {json.dumps(user.get('session_token', ''))});
        localStorage.setItem('token', {json.dumps(user.get('token', ''))});
        """
    )

    if block_mode == "abort":
        async def abort_razorpay(route):
            await route.abort()
        await context.route("https://checkout.razorpay.com/v1/checkout.js", abort_razorpay)
    elif block_mode == "hang":
        async def hang_razorpay(route):
            await asyncio.sleep(30)
            try:
                await route.abort()
            except Exception:
                pass
        await context.route("https://checkout.razorpay.com/v1/checkout.js", hang_razorpay)
    return context


async def page_with_charges(context):
    page = await context.new_page()
    logs: list[str] = []
    page.on("console", lambda msg: logs.append(f"{msg.type}: {msg.text}"))
    page.on("pageerror", lambda exc: logs.append(f"pageerror: {exc}"))
    await page.goto(f"{BASE_URL}/my-service-charges", wait_until="domcontentloaded")
    await expect(page.get_by_test_id("my-service-charges-page")).to_be_visible(timeout=30000)
    await expect(page.get_by_test_id("svc-charge-banner")).to_be_visible(timeout=30000)
    return page, logs


async def script_count(page) -> int:
    return await page.evaluate(
        "document.querySelectorAll('script[src=\"https://checkout.razorpay.com/v1/checkout.js\"]').length"
    )


async def iframe_count(page) -> int:
    return await page.evaluate(
        """() => document.querySelectorAll(
          'iframe.razorpay-checkout-frame, iframe[src*="razorpay"], iframe[name*="razorpay"], iframe[id*="razorpay"]'
        ).length"""
    )


async def toast_text(page) -> str:
    return await page.evaluate(
        """() => {
          const nodes = Array.from(document.querySelectorAll('[data-sonner-toast], [role="status"], [role="alert"], .error, [class*="error"], [id*="error"]'));
          return nodes.map(n => n.textContent || '').join(' | ');
        }"""
    )


async def clear_checkout_overlay(page):
    await page.evaluate(
        """() => {
          document.querySelectorAll('.razorpay-container, iframe[src*="razorpay"], iframe[name*="razorpay"], iframe[id*="razorpay"]').forEach(e => e.remove());
          document.body.style.overflow = '';
        }"""
    )


async def wait_for_checkout(page):
    await page.wait_for_function(
        """() => document.querySelectorAll(
          'iframe.razorpay-checkout-frame, iframe[src*="razorpay"], iframe[name*="razorpay"], iframe[id*="razorpay"]'
        ).length > 0""",
        timeout=30000,
    )
    await page.wait_for_timeout(1000)


async def wait_for_expected_toast(page, timeout_ms=15000):
    deadline = time.monotonic() + timeout_ms / 1000
    last_text = ""
    while time.monotonic() < deadline:
        last_text = await toast_text(page)
        if any(snippet in last_text for snippet in EXPECTED_TOAST_SNIPPETS):
            return last_text
        await page.wait_for_timeout(250)
    raise AssertionError(f"Expected Razorpay loader error toast within {timeout_ms}ms, last toast text: {last_text!r}")


async def run_happy(browser, user, scenario: str, count: int):
    seed(count)
    context = await make_context(browser, user)
    page, logs = await page_with_charges(context)
    result = {"scenario": f"happy_{scenario}", "passed": False}
    try:
        if scenario == "banner":
            await expect(page.get_by_test_id("banner-pay-btn")).to_contain_text("Pay ₹300", timeout=15000)
            await page.get_by_test_id("banner-pay-btn").click(force=True)
        elif scenario == "row":
            button = page.locator('[data-testid^="pay-btn-"]').first
            await expect(button).to_be_visible(timeout=15000)
            await button.click(force=True)
        elif scenario == "bulk":
            await expect(page.get_by_test_id("bulk-pay-banner")).to_be_visible(timeout=15000)
            await page.get_by_test_id("bulk-pay-btn").click(force=True)
        else:
            raise AssertionError(f"unknown scenario {scenario}")

        await wait_for_checkout(page)
        result.update(
            {
                "passed": True,
                "checkout_iframes": await iframe_count(page),
                "script_count": await script_count(page),
                "toast": await toast_text(page),
                "constructor_error_in_logs": any(bad in "\n".join(logs) for bad in BAD_SNIPPETS),
                "logs_tail": logs[-8:],
            }
        )
        if result["script_count"] != 1:
            result["passed"] = False
            result["failure"] = f"Expected exactly one checkout.js script tag, got {result['script_count']}"
        if result["constructor_error_in_logs"]:
            result["passed"] = False
            result["failure"] = "Constructor error appeared in console logs"
    except Exception as exc:
        result.update(
            {
                "passed": False,
                "failure": repr(exc),
                "checkout_iframes": await iframe_count(page),
                "script_count": await script_count(page),
                "toast": await toast_text(page),
                "logs_tail": logs[-12:],
            }
        )
    finally:
        await clear_checkout_overlay(page)
        await context.close()
    return result


async def run_blocked(browser, user, scenario: str, count: int, block_mode: str = "abort"):
    seed(count)
    context = await make_context(browser, user, block_mode=block_mode)
    page, logs = await page_with_charges(context)
    result = {"scenario": f"blocked_{block_mode}_{scenario}", "passed": False}
    try:
        # Let banner preload fail first; this reproduces the previously failed stale-script case.
        if block_mode == "abort":
            await page.wait_for_timeout(1500)

        if scenario == "banner":
            await page.get_by_test_id("banner-pay-btn").click(force=True)
        elif scenario == "row":
            button = page.locator('[data-testid^="pay-btn-"]').first
            await expect(button).to_be_visible(timeout=15000)
            await button.click(force=True)
        elif scenario == "bulk":
            await expect(page.get_by_test_id("bulk-pay-banner")).to_be_visible(timeout=15000)
            await page.get_by_test_id("bulk-pay-btn").click(force=True)
        else:
            raise AssertionError(f"unknown scenario {scenario}")

        text = await wait_for_expected_toast(page, timeout_ms=15000)
        all_text = text + "\n" + "\n".join(logs)
        result.update(
            {
                "passed": not any(bad in all_text for bad in BAD_SNIPPETS),
                "toast": text,
                "checkout_iframes": await iframe_count(page),
                "script_count": await script_count(page),
                "constructor_error_in_text_or_logs": any(bad in all_text for bad in BAD_SNIPPETS),
                "logs_tail": logs[-12:],
            }
        )
        if result["constructor_error_in_text_or_logs"]:
            result["failure"] = "Constructor error appeared in toast or logs"
        if not text.strip():
            result["passed"] = False
            result["failure"] = "Toast text was empty"
    except Exception as exc:
        result.update(
            {
                "passed": False,
                "failure": repr(exc),
                "toast": await toast_text(page),
                "checkout_iframes": await iframe_count(page),
                "script_count": await script_count(page),
                "logs_tail": logs[-12:],
            }
        )
    finally:
        await context.close()
    return result


async def main():
    user = login_payload()
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path="/usr/bin/chromium")
        try:
            for scenario, count in [("banner", 1), ("row", 1), ("bulk", 2)]:
                results.append(await run_happy(browser, user, scenario, count))
            for scenario, count in [("banner", 1), ("row", 1), ("bulk", 2)]:
                results.append(await run_blocked(browser, user, scenario, count, block_mode="abort"))
            # Explicit hard-timeout proof using a clickable row button: request is left pending so neither
            # script.onload nor script.onerror fires; ensureRazorpayLoaded should reject after 12s.
            results.append(await run_blocked(browser, user, "row", 1, block_mode="hang"))
            results.append(await run_blocked(browser, user, "banner", 1, block_mode="hang"))
        finally:
            await browser.close()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))
    failed = [r for r in results if not r.get("passed")]
    if failed:
        raise SystemExit(f"{len(failed)} Razorpay loader UI scenario(s) failed")


if __name__ == "__main__":
    asyncio.run(main())