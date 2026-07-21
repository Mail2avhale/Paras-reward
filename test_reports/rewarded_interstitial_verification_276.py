"""
Focused Playwright verification for bug_verification_276:
Rewarded interstitial '+5 bonus PRC' modal should appear after tapping
View Live Community Activity on /referrals, then be one-shot guarded.

This file mirrors the script executed through the browser automation tool.
"""

async def run(page):
    await page.set_viewport_size({"width": 390, "height": 844})
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/login')
    await page.evaluate("""() => { localStorage.clear(); sessionStorage.clear(); }""")
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/login')
    await page.wait_for_selector('[data-testid="login-identifier-input"]', timeout=20000)
    await page.fill('[data-testid="login-identifier-input"]', '9970100782')
    await page.click('[data-testid="login-submit-btn"]')
    await page.wait_for_selector('[data-testid="login-pin-0"]', timeout=20000)
    await page.click('[data-testid="login-pin-0"]')
    await page.keyboard.type('997010')
    await page.wait_for_url(lambda url: '/login' not in url, timeout=30000)
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/referrals')
    await page.wait_for_selector('[data-testid="view-community-activity-btn"]', timeout=45000)
    await page.click('[data-testid="view-community-activity-btn"]')
    await page.wait_for_url('**/referrals/live-feed', timeout=15000)
    await page.wait_for_selector('[data-testid="rewarded-interstitial-watch-btn"]', state='visible', timeout=10000)
    await page.wait_for_selector('[data-testid="rewarded-interstitial-skip-btn"]', state='visible', timeout=10000)
    await page.click('[data-testid="rewarded-interstitial-skip-btn"]')
    await page.wait_for_selector('[data-testid="rewarded-interstitial-watch-btn"]', state='detached', timeout=10000)
    await page.reload()
    await page.wait_for_load_state('domcontentloaded')
    await page.wait_for_timeout(2500)
    assert await page.locator('[data-testid="rewarded-interstitial-watch-btn"]').count() == 0
    await page.evaluate("sessionStorage.removeItem('pending_rewarded_ad')")
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/referrals/live-feed')
    await page.wait_for_timeout(2500)
    assert await page.locator('[data-testid="rewarded-interstitial-watch-btn"]').count() == 0