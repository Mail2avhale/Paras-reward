"""
Focused Playwright verification for bug: duplicate Community labels/icons in BottomNav.

Checks authenticated UI only:
- Bottom nav has exactly 5 tabs ordered Home, Refer & Earn, Mall, Community, Profile.
- nav-referrals label is Refer & Earn and icon is Lucide Gift, not Users.
- nav-community label remains Community and icon is Lucide MessageCircle.
- Clicking Refer & Earn routes to /referrals; clicking Community routes to /community.
"""

import asyncio
from playwright.async_api import async_playwright, expect

BASE_URL = "https://formula-audit-fix.preview.emergentagent.com"
MOBILE = "9970100782"
PIN = "997010"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 390, "height": 844})
        page = await context.new_page()
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
        await page.get_by_test_id("login-identifier-input").fill(MOBILE)
        await page.get_by_test_id("login-submit-btn").click()
        await page.wait_for_selector('[data-testid="login-pin-0"]', timeout=20000)
        for i, digit in enumerate(PIN):
            await page.get_by_test_id(f"login-pin-{i}").fill(digit)
        await page.wait_for_url("**/dashboard", timeout=30000)

        await page.wait_for_selector('[data-testid="nav-referrals"]', timeout=20000)

        nav_snapshot = await page.evaluate(
            """() => Array.from(document.querySelectorAll('[data-testid^="nav-"]')).map((el, index) => ({
                index,
                testid: el.getAttribute('data-testid'),
                label: (el.querySelector('span')?.textContent || '').trim(),
                svgClass: el.querySelector('svg')?.getAttribute('class') || '',
                svgOuter: el.querySelector('svg')?.outerHTML || ''
            }))"""
        )
        print("NAV_SNAPSHOT", nav_snapshot)

        expected = [
            ("nav-home", "Home"),
            ("nav-referrals", "Refer & Earn"),
            ("nav-mall", "Mall"),
            ("nav-community", "Community"),
            ("nav-profile", "Profile"),
        ]
        actual = [(item["testid"], item["label"]) for item in nav_snapshot]
        assert actual == expected, f"Unexpected nav order/labels: {actual}"
        assert len(nav_snapshot) == 5, f"Expected 5 bottom nav tabs, got {len(nav_snapshot)}"

        labels = [item["label"] for item in nav_snapshot]
        assert labels.count("Community") == 1, f"Duplicate Community labels found: {labels}"
        assert len(labels) == len(set(labels)), f"Bottom nav labels are not unique: {labels}"

        referrals = next(item for item in nav_snapshot if item["testid"] == "nav-referrals")
        community = next(item for item in nav_snapshot if item["testid"] == "nav-community")
        assert "lucide-gift" in referrals["svgClass"], f"nav-referrals is not using Gift icon: {referrals['svgClass']}"
        assert "lucide-users" not in referrals["svgClass"].lower(), f"nav-referrals still uses Users icon: {referrals['svgClass']}"
        assert "lucide-message-circle" in community["svgClass"], f"nav-community is not using MessageCircle icon: {community['svgClass']}"

        await page.get_by_test_id("nav-referrals").click()
        await page.wait_for_url("**/referrals", timeout=20000)
        print("REFERRALS_ROUTE", page.url)
        await page.get_by_test_id("nav-community").click()
        await page.wait_for_url("**/community", timeout=20000)
        print("COMMUNITY_ROUTE", page.url)

        # Get error messages using specific selectors
        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")
        print("CONSOLE_ERRORS", console_errors)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())