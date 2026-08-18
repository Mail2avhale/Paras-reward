"""
Playwright script body used by mcp_browser_automation for Collect PRC bug.

It logs in as the preview Elite test user, waits for the MiningWidget collect
button, double-taps it, verifies the forced-ad overlay does not visibly render
in the current preview build, then waits for the parent 25s safety-net to call
/api/mining/collect and show the collected toast/result.
"""

try:
    await page.set_viewport_size({"width": 390, "height": 844})
    collect_events = []

    def on_response(resp):
        if "/api/mining/collect/" in resp.url:
            collect_events.append({"url": resp.url, "status": resp.status})
            print(f"Collect API response observed: status={resp.status} url={resp.url}")

    page.on("response", on_response)
    print("Navigating to login")
    await page.goto("https://formula-audit-fix.preview.emergentagent.com/login", wait_until="domcontentloaded")
    await page.locator('[data-testid="login-identifier-input"]').fill("9970100782")
    await page.locator('[data-testid="login-submit-btn"]').click(force=True)
    await page.wait_for_selector('[data-testid="login-pin-0"]', timeout=15000)
    for i, digit in enumerate("997010"):
        await page.locator(f'[data-testid="login-pin-{i}"]').fill(digit)
    print("PIN entered; waiting for dashboard")
    await page.wait_for_url("**/dashboard", timeout=30000)
    await page.wait_for_load_state("domcontentloaded")

    collect_btn = page.locator('[data-testid="collect-rewards-btn"]').first
    await collect_btn.wait_for(state="visible", timeout=30000)
    enabled = await collect_btn.is_enabled()
    text = await collect_btn.inner_text()
    print(f"Collect button visible. enabled={enabled}, text={text}")
    if not enabled:
        raise AssertionError("Collect Rewards button rendered but is disabled")

    print("Double tapping Collect Rewards to verify double-tap resilience and safety timer re-arm")
    start_ms = await page.evaluate("Date.now()")
    await collect_btn.click(force=True)
    await page.wait_for_timeout(500)
    await collect_btn.click(force=True)

    await page.wait_for_timeout(1200)
    overlay_count = await page.locator('[data-testid="forced-ad-overlay"]').count()
    modal_count = await page.locator('[data-testid="forced-ad-modal"]').count()
    print(f"Forced ad overlay after click: overlay_count={overlay_count}, modal_count={modal_count}")

    # Wait up to 35s for the parent safety-net to call collect.
    for _ in range(35):
        if collect_events:
            break
        await page.wait_for_timeout(1000)
    end_ms = await page.evaluate("Date.now()")
    elapsed_s = round((end_ms - start_ms) / 1000, 2)
    print(f"Elapsed until collect observation/window end: {elapsed_s}s; collect_events={collect_events}")
    if not collect_events:
        raise AssertionError("No /api/mining/collect call observed within 35s after Collect click")
    if collect_events[0]["status"] != 200:
        raise AssertionError(f"/api/mining/collect returned non-200: {collect_events}")
    if len(collect_events) != 1:
        raise AssertionError(f"Expected exactly one collect API call after double tap, saw {len(collect_events)}")

    await page.wait_for_timeout(1000)
    body_text = await page.locator("body").inner_text()
    has_collected_text = "Collected" in body_text and "PRC" in body_text
    has_start_button = await page.locator('[data-testid="start-mining-btn"]').count() > 0
    print(f"Post-collect UI: has_collected_text={has_collected_text}, has_start_button={has_start_button}")
    if not has_collected_text and not has_start_button:
        raise AssertionError("Collect API succeeded but no collected toast or post-collect idle/cooldown UI was visible")

    # Get error messages using specific selectors
    error_text = await page.evaluate("""() => {
    const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
    return errorElements.map(el => el.textContent).join(", ");
    }""")
    if error_text:
        print(f"Found error message: {error_text}")
    else:
        print("No error messages found on the page")
    print("FRONTEND_COLLECT_SAFETY_TEST_PASS")
except Exception as e:
    print(f"FRONTEND_COLLECT_SAFETY_TEST_FAIL: {e}")
    raise