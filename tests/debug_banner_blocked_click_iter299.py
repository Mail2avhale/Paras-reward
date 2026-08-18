#!/usr/bin/env python3
"""Debug-only script for iteration 299 banner CDN-block behavior."""

import asyncio
import json
import subprocess
import requests
from playwright.async_api import async_playwright, expect

BASE_URL = "https://formula-audit-fix.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"
UID = "76b75808-47fa-48dd-ad7c-8074678e3607"


async def main():
    subprocess.run(["python", "/app/tests/seed_service_charges_for_razorpay_bug.py", "1"], check=True, cwd="/app")
    user = requests.post(
        f"{API_BASE}/auth/login",
        json={"identifier": "9970100782", "password": "997010", "device_id": "DEBUG-BANNER", "device_model": "QA", "os_version": "web", "ip_address": "127.0.0.1"},
        timeout=30,
    ).json()
    assert user["uid"] == UID
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path="/usr/bin/chromium")
        context = await browser.new_context(viewport={"width": 390, "height": 844})
        safe_user = {k: v for k, v in user.items() if k not in {"hashed_pin", "pin_hash", "password"}}
        await context.add_init_script(f"""
          localStorage.clear(); sessionStorage.clear();
          localStorage.setItem('paras_user', {json.dumps(json.dumps(safe_user))});
          localStorage.setItem('paras_session_token', {json.dumps(user.get('session_token', ''))});
          localStorage.setItem('token', {json.dumps(user.get('token', ''))});
        """)
        async def abort(route):
            print("ROUTE abort checkout.js")
            await route.abort()
        await context.route("https://checkout.razorpay.com/v1/checkout.js", abort)
        page = await context.new_page()
        page.on("console", lambda msg: print("CONSOLE", msg.type, msg.text))
        page.on("pageerror", lambda exc: print("PAGEERROR", exc))
        page.on("request", lambda req: print("REQ", req.method, req.url) if "razorpay" in req.url or "redemption-service-charge" in req.url else None)
        page.on("requestfailed", lambda req: print("REQFAILED", req.url, req.failure))
        await page.goto(f"{BASE_URL}/my-service-charges", wait_until="domcontentloaded")
        await expect(page.get_by_test_id("svc-charge-banner")).to_be_visible(timeout=30000)
        await page.evaluate("""() => {
          window.__bannerClicks = 0;
          document.querySelectorAll('[data-testid="banner-pay-btn"]').forEach((el, idx) => {
            el.addEventListener('click', () => { window.__bannerClicks += 1; console.log('DEBUG native banner click captured #' + idx); }, true);
          });
        }""")
        print("banner btn count", await page.get_by_test_id("banner-pay-btn").count())
        print("boxes", await page.locator('[data-testid="banner-pay-btn"]').evaluate_all("els => els.map(e => ({text:e.textContent, disabled:e.disabled, rect:e.getBoundingClientRect().toJSON ? e.getBoundingClientRect().toJSON() : {x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}, topEl: document.elementFromPoint(e.getBoundingClientRect().x + e.getBoundingClientRect().width/2, e.getBoundingClientRect().y + e.getBoundingClientRect().height/2)?.outerHTML.slice(0,500)}))"))
        print("hit map", await page.locator('[data-testid="banner-pay-btn"]').evaluate("""e => {
          const r = e.getBoundingClientRect();
          return [5, 20, 40, 60, 75].map(dx => {
            const el = document.elementFromPoint(r.x + dx, r.y + r.height/2);
            return {dx, tag: el?.tagName, testid: el?.getAttribute('data-testid'), cls: el?.getAttribute('class'), text: el?.textContent, html: el?.outerHTML.slice(0,120)};
          });
        }"""))
        await page.wait_for_timeout(1500)
        print("before click", await page.get_by_test_id("banner-pay-btn").inner_text(), "disabled=", await page.get_by_test_id("banner-pay-btn").is_disabled())
        await page.get_by_test_id("banner-pay-btn").click(force=True)
        print("after click count", await page.evaluate("window.__bannerClicks"))
        await page.wait_for_timeout(15000)
        toast = await page.evaluate("""() => Array.from(document.querySelectorAll('[data-sonner-toast], [role="status"], [role="alert"], .error, [class*="error"], [id*="error"]')).map(n => n.textContent || '').join(' | ')""")
        scripts = await page.evaluate("document.querySelectorAll('script[src=\"https://checkout.razorpay.com/v1/checkout.js\"]').length")
        print("FINAL", {"toast": toast, "scripts": scripts, "button": await page.get_by_test_id("banner-pay-btn").inner_text(), "disabled": await page.get_by_test_id("banner-pay-btn").is_disabled()})
        print("dispatching synthetic click directly on banner button")
        await page.get_by_test_id("banner-pay-btn").dispatch_event("click")
        await page.wait_for_timeout(3000)
        toast2 = await page.evaluate("""() => Array.from(document.querySelectorAll('[data-sonner-toast], [role="status"], [role="alert"], .error, [class*="error"], [id*="error"]')).map(n => n.textContent || '').join(' | ')""")
        scripts2 = await page.evaluate("document.querySelectorAll('script[src=\"https://checkout.razorpay.com/v1/checkout.js\"]').length")
        print("AFTER_SYNTHETIC", {"toast": toast2, "scripts": scripts2, "clicks": await page.evaluate("window.__bannerClicks")})
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())