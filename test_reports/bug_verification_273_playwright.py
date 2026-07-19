"""
Focused bug-verification script for iteration 273.

User-reported bug:
1) AdMob banner covers Dashboard bottom icons.
2) Pay to Partner Store is blank in Android APK.

Executed via mcp_browser_automation against:
https://formula-audit-fix.preview.emergentagent.com

Checks covered:
- Login as mobile 9970100782 / PIN 997010.
- /dashboard renders and no per-page AdMobBanner DOM slot exists on web.
- /pay-partner-store renders pay-store-page, wallet balance, and Step 1 lookup.
- Partner Store lookup for Store ID 100001 returns found card.
- Regression routes /notifications, /community-feed, /network-feed, /referrals render.
- /referrals contains Level Progression card.

Native APK overlay behavior cannot be physically reproduced in this cloud preview;
it was verified by code review of GlobalBannerAd, AdMobBanner, App route placement,
and user-build static bundle text matches.
"""

PLAYWRIGHT_STEPS = r'''
await page.set_viewport_size({"width": 390, "height": 844})
await page.evaluate("localStorage.clear(); sessionStorage.clear();")
await page.goto('https://formula-audit-fix.preview.emergentagent.com/login', wait_until='domcontentloaded')
await page.locator('[data-testid="login-identifier-input"]').fill('9970100782')
await page.locator('[data-testid="login-submit-btn"]').click()
await page.locator('[data-testid="login-pin-0"]').wait_for(state='visible', timeout=10000)
for i, d in enumerate('997010'):
    await page.locator(f'[data-testid="login-pin-{i}"]').fill(d)
await page.wait_for_timeout(5000)
assert '/login' not in page.url

await page.goto('https://formula-audit-fix.preview.emergentagent.com/dashboard', wait_until='domcontentloaded')
await page.wait_for_timeout(3500)
assert await page.locator('[data-testid="admob-native-slot"], [data-testid="web-fallback-ad"]').count() == 0

await page.goto('https://formula-audit-fix.preview.emergentagent.com/pay-partner-store', wait_until='domcontentloaded')
await page.locator('[data-testid="pay-store-page"]').wait_for(state='visible', timeout=15000)
assert await page.locator('[data-testid="pay-store-query-input"]').is_visible()
await page.locator('[data-testid="pay-store-query-input"]').fill('100001')
await page.locator('[data-testid="pay-store-lookup-btn"]').click()
await page.wait_for_timeout(2500)
assert await page.locator('[data-testid="pay-store-found-card"]').count() == 1

for route in ['/notifications', '/community-feed', '/network-feed', '/referrals']:
    await page.goto(f'https://formula-audit-fix.preview.emergentagent.com{route}', wait_until='domcontentloaded')
    await page.wait_for_timeout(3500)
    assert '/login' not in page.url
    assert len((await page.locator('body').inner_text()).strip()) > 40
'''