#!/usr/bin/env python3
"""Iteration 300 focused verification for My Service Charges banner CTA reachability.

This test intentionally uses a real Playwright click (no force=True) on the
banner Pay button after checking document.elementFromPoint at the button center.
It blocks Razorpay checkout.js and polls for the user-visible loader-error toast
within 15 seconds.
"""

import asyncio
import json
import os
import subprocess
import time
from pathlib import Path

import requests
from playwright.async_api import async_playwright, expect


BASE_URL = os.environ.get("PARAS_PREVIEW_URL", "https://formula-audit-fix.preview.emergentagent.com")
API_BASE = f"{BASE_URL}/api"
MOBILE = "9970100782"
PIN = "997010"
UID = "76b75808-47fa-48dd-ad7c-8074678e3607"
SEED_SCRIPT = "/app/tests/seed_service_charges_for_razorpay_bug.py"
OUT_PATH = Path("/app/test_reports/banner_reachability_iter300_results.json")

EXPECTED_TOAST_SNIPPETS = (
    "Razorpay checkout.js failed to load",
    "Razorpay checkout.js load timed out",
)
BAD_SNIPPETS = (
    "window.Razorpay is not a constructor",
    "Razorpay is not a constructor",
    "Failed to create payment order",
)


def seed_one_pending_charge() -> None:
    subprocess.run(["python", SEED_SCRIPT, "1"], check=True, cwd="/app")


def login_payload() -> dict:
    response = requests.post(
        f"{API_BASE}/auth/login",
        json={
            "identifier": MOBILE,
            "password": PIN,
            "device_id": "WEB-QA-BANNER-REACHABILITY-ITER300",
            "device_model": "Playwright QA Iter300",
            "os_version": "web",
            "ip_address": "127.0.0.1",
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    assert data.get("uid") == UID, data
    return data


async def toast_text(page) -> str:
    return await page.evaluate(
        """() => {
          const nodes = Array.from(document.querySelectorAll('[data-sonner-toast], [role="status"], [role="alert"], .error, [class*="error"], [id*="error"]'));
          return nodes.map(n => n.textContent || '').join(' | ');
        }"""
    )


async def wait_for_expected_toast(page, timeout_ms=15000) -> str:
    deadline = time.monotonic() + timeout_ms / 1000
    last_text = ""
    while time.monotonic() < deadline:
        last_text = await toast_text(page)
        if any(snippet in last_text for snippet in EXPECTED_TOAST_SNIPPETS):
            return last_text
        await page.wait_for_timeout(200)
    raise AssertionError(f"Expected Razorpay loader error toast within {timeout_ms}ms, last toast text: {last_text!r}")


async def main():
    seed_one_pending_charge()
    user = login_payload()
    safe_user = {k: v for k, v in user.items() if k not in {"hashed_pin", "pin_hash", "password"}}
    result = {
        "scenario": "mobile_banner_real_hit_test_blocked_cdn",
        "passed": False,
        "base_url": BASE_URL,
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path="/usr/bin/chromium")
        context = await browser.new_context(viewport={"width": 390, "height": 844})
        await context.add_init_script(
            f"""
            localStorage.clear();
            sessionStorage.clear();
            localStorage.setItem('paras_user', {json.dumps(json.dumps(safe_user))});
            localStorage.setItem('paras_session_token', {json.dumps(user.get('session_token', ''))});
            localStorage.setItem('token', {json.dumps(user.get('token', ''))});
            """
        )

        async def abort_razorpay(route):
            await route.abort()

        await context.route("https://checkout.razorpay.com/v1/checkout.js", abort_razorpay)
        page = await context.new_page()
        logs: list[str] = []
        page.on("console", lambda msg: logs.append(f"{msg.type}: {msg.text}"))
        page.on("pageerror", lambda exc: logs.append(f"pageerror: {exc}"))

        try:
            await page.goto(f"{BASE_URL}/my-service-charges", wait_until="domcontentloaded")
            await expect(page.get_by_test_id("my-service-charges-page")).to_be_visible(timeout=30000)
            await expect(page.get_by_test_id("svc-charge-banner")).to_be_visible(timeout=30000)
            await expect(page.get_by_test_id("banner-pay-btn")).to_contain_text("Pay ₹300", timeout=15000)

            # Let the banner preload fail, reproducing the stale failed-script path users hit.
            await page.wait_for_timeout(1500)

            await page.evaluate(
                """() => {
                  window.__bannerClicks = 0;
                  const btn = document.querySelector('[data-testid="banner-pay-btn"]');
                  btn.addEventListener('click', () => { window.__bannerClicks += 1; }, true);
                }"""
            )

            hit_test = await page.locator('[data-testid="banner-pay-btn"]').evaluate(
                """btn => {
                  const r = btn.getBoundingClientRect();
                  const x = r.left + r.width / 2;
                  const y = r.top + r.height / 2;
                  const topEl = document.elementFromPoint(x, y);
                  return {
                    rect: {left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom},
                    center: {x, y},
                    topTag: topEl?.tagName,
                    topTestId: topEl?.getAttribute('data-testid'),
                    topText: topEl?.textContent,
                    topClass: topEl?.getAttribute('class'),
                    topIsButtonOrChild: topEl === btn || btn.contains(topEl),
                  };
                }"""
            )
            result["hit_test"] = hit_test
            assert hit_test["topIsButtonOrChild"], f"banner-pay-btn is not topmost at center: {hit_test}"

            # Real user click; do not use force=True, because this is the bug contract.
            await page.get_by_test_id("banner-pay-btn").click(timeout=15000)
            click_count = await page.evaluate("window.__bannerClicks")
            result["click_count_after_real_click"] = click_count
            assert click_count >= 1, f"real Playwright click did not reach banner pay handler, count={click_count}"

            toast = await wait_for_expected_toast(page, timeout_ms=15000)
            scripts = await page.evaluate(
                "document.querySelectorAll('script[src=\"https://checkout.razorpay.com/v1/checkout.js\"]').length"
            )
            all_text = toast + "\n" + "\n".join(logs)
            result.update(
                {
                    "passed": not any(bad in all_text for bad in BAD_SNIPPETS),
                    "toast": toast,
                    "script_count": scripts,
                    "constructor_or_generic_order_error_seen": any(bad in all_text for bad in BAD_SNIPPETS),
                    "logs_tail": logs[-12:],
                }
            )
            if result["constructor_or_generic_order_error_seen"]:
                result["failure"] = "Old constructor/generic order error appeared in UI or console logs"
        except Exception as exc:
            result.update(
                {
                    "passed": False,
                    "failure": repr(exc),
                    "toast": await toast_text(page),
                    "click_count_after_real_click": result.get("click_count_after_real_click"),
                    "logs_tail": logs[-12:],
                }
            )
        finally:
            await context.close()
            await browser.close()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    if not result.get("passed"):
        raise SystemExit("banner reachability verification failed")


if __name__ == "__main__":
    asyncio.run(main())