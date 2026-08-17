"""
Focused Playwright verification for /admin/service-charges route bug.

Checks:
- Admin can log in with test credentials.
- /admin/service-charges renders the Phase-3 PRC Redemption Service Charges dashboard.
- Required dashboard data-testid attributes exist.
- Legacy Bill Payment Service Charges Configuration is not shown on the new route.
- /admin/bill-service-charges still renders the legacy page.
"""

# This file is a saved copy of the script executed via mcp_browser_automation.

async def run(page):
    await page.set_viewport_size({"width": 1920, "height": 1080})
    try:
        print("STEP: clear storage and open login page")
        await page.context.clear_cookies()
        await page.goto("https://formula-audit-fix.preview.emergentagent.com/login", wait_until="domcontentloaded")
        await page.evaluate("localStorage.clear(); sessionStorage.clear();")
        await page.wait_for_load_state("networkidle")

        print("STEP: enter admin identifier")
        await page.get_by_test_id("login-identifier-input").fill("admin@test.com")
        await page.get_by_test_id("login-submit-btn").click()
        await page.wait_for_selector('[data-testid="login-pin-0"]', timeout=15000)

        print("STEP: enter admin PIN")
        for i, digit in enumerate("153759"):
            await page.get_by_test_id(f"login-pin-{i}").fill(digit)
            await page.wait_for_timeout(100)

        await page.wait_for_timeout(2500)
        print(f"After login URL: {page.url}")

        print("STEP: navigate to /admin/service-charges")
        await page.goto("https://formula-audit-fix.preview.emergentagent.com/admin/service-charges", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="admin-svc-charges-page"]', timeout=30000)
        await page.wait_for_timeout(1500)

        required = [
            "admin-svc-charges-page", "stat-pending", "stat-paid", "stat-total", "stat-rate",
            "search-input", "search-btn", "days-filter", "refresh-btn", "charges-table", "revenue-chart"
        ]
        missing = []
        for testid in required:
            count = await page.get_by_test_id(testid).count()
            print(f"testid {testid}: {count}")
            if count < 1:
                missing.append(testid)
        assert not missing, f"Missing required testids: {missing}"

        body_text = await page.locator("body").inner_text()
        assert "Redemption Service Charges" in body_text, "Expected new dashboard heading not found"
        assert "Service Charges Configuration" not in body_text, "Legacy heading appeared on /admin/service-charges"
        assert "Bill Payment & Recharge" not in body_text, "Legacy bill-payment content appeared on /admin/service-charges"
        print("PASS: /admin/service-charges renders new Phase-3 dashboard")

        # Exercise changed-page controls enough to prove they are functional/rendered.
        await page.get_by_test_id("search-input").fill("nonexistent-route-verification")
        await page.get_by_test_id("search-btn").click()
        await page.wait_for_timeout(1000)
        await page.get_by_test_id("days-filter").select_option("7")
        await page.wait_for_timeout(1000)
        await page.get_by_test_id("refresh-btn").click()
        await page.wait_for_timeout(1000)
        print("PASS: new dashboard controls are interactable")

        print("STEP: navigate to /admin/bill-service-charges legacy page")
        await page.goto("https://formula-audit-fix.preview.emergentagent.com/admin/bill-service-charges", wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        legacy_text = await page.locator("body").inner_text()
        assert "Service Charges Configuration" in legacy_text, "Legacy heading not found at /admin/bill-service-charges"
        assert "Bill Payment & Recharge" in legacy_text, "Legacy bill-payment content not found at /admin/bill-service-charges"
        print("PASS: /admin/bill-service-charges renders legacy page")

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

        print("TEST RESULT: SUCCESS")
    except Exception as e:
        print(f"TEST RESULT: FAILURE - {e}")
        raise