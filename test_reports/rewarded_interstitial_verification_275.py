"""
Focused Playwright verification for bug iteration 275:
Clicking /referrals "View Live Community Activity" should navigate to
/referrals/live-feed and show the rewarded interstitial +5 PRC opt-in modal.

Executed via mcp_browser_automation against:
https://formula-audit-fix.preview.emergentagent.com
"""

async def run(page):
    await page.set_viewport_size({"width": 390, "height": 844})
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/login', wait_until='domcontentloaded')
    await page.evaluate("""() => { localStorage.clear(); sessionStorage.clear(); }""")

    # Review-request credential 9696969696/969696 did not show PIN inputs in preview;
    # fallback credential from /app/memory/test_credentials.md was used.
    await page.get_by_test_id('login-identifier-input').fill('9970100782')
    await page.get_by_test_id('login-submit-btn').click()
    await page.wait_for_timeout(1200)
    for i, digit in enumerate('997010'):
        await page.get_by_test_id(f'login-pin-{i}').fill(digit)
        await page.wait_for_timeout(60)
    await page.wait_for_timeout(3000)

    # Negative direct URL case: no flag means no modal.
    await page.evaluate("""() => sessionStorage.removeItem('pending_rewarded_ad')""")
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/referrals/live-feed', wait_until='domcontentloaded')
    await page.wait_for_selector('[data-testid="downline-live-feed-page"]', timeout=15000)
    await page.wait_for_timeout(1000)
    assert await page.get_by_test_id('rewarded-interstitial-watch-btn').count() == 0

    # Positive bug flow: click CTA from /referrals; expected modal did NOT appear.
    await page.goto('https://formula-audit-fix.preview.emergentagent.com/referrals', wait_until='domcontentloaded')
    await page.wait_for_timeout(6000)
    await page.wait_for_selector('[data-testid="view-community-activity-btn"]', timeout=25000)
    await page.get_by_test_id('view-community-activity-btn').click(force=True)
    await page.wait_for_url('**/referrals/live-feed', timeout=15000)
    await page.wait_for_selector('[data-testid="downline-live-feed-page"]', timeout=15000)
    await page.wait_for_timeout(3000)
    assert await page.get_by_test_id('rewarded-interstitial-watch-btn').count() == 1
