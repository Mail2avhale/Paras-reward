"""Playwright script used via mcp_browser_automation for focused hotfix verification.
This file records the exact UI flow tested; it is not intended to be run standalone.
"""
async def run(page):
    await page.set_viewport_size({"width": 390, "height": 844})
    await page.evaluate("""() => { localStorage.clear(); sessionStorage.clear(); }""")
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/login')
    await page.wait_for_load_state('domcontentloaded')
    await page.locator('[data-testid="login-identifier-input"]').fill('9970100782')
    await page.locator('[data-testid="login-submit-btn"]').click()
    await page.wait_for_selector('[data-testid="login-pin-0"]', timeout=15000)
    for i, digit in enumerate('997010'):
        await page.locator(f'[data-testid="login-pin-{i}"]').fill(digit)
    await page.wait_for_url(lambda url: '/dashboard' in url or '/login' not in url, timeout=20000)
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/dashboard')
    await page.wait_for_timeout(5000)
    assert await page.locator('[data-testid="dashboard-bottom-ad-slot"]').count() == 0
    assert await page.locator('[data-testid="admob-native-slot"]').count() == 0
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/pay-partner-store')
    await page.wait_for_selector('[data-testid="pay-store-page"]', timeout=20000)
    await page.locator('[data-testid="pay-store-query-input"]').fill('100001')
    await page.locator('[data-testid="pay-store-lookup-btn"]').click()
    await page.wait_for_selector('[data-testid="pay-store-found-card"]', timeout=20000)
    await page.locator('[data-testid="pay-store-amount-input"]').fill('1')
    assert await page.locator('[data-testid="pay-store-confirm-btn"]').is_enabled()
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/notifications')
    await page.wait_for_timeout(4000)
    assert not await page.evaluate("() => document.body.innerText.trim().length === 0")
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/community-feed')
    await page.wait_for_timeout(4000)
    assert not await page.evaluate("() => document.body.innerText.trim().length === 0")

async def run_no_user_guard_observation(page):
    await page.set_viewport_size({"width": 390, "height": 844})
    await page.evaluate("""() => { localStorage.clear(); sessionStorage.clear(); }"")
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/pay-partner-store')
    await page.wait_for_timeout(3000)
    # Observed: App route redirects to /login; pay-store-loading-state is not reachable through App route.
    assert await page.locator('[data-testid="login-identifier-input"]').count() == 1
