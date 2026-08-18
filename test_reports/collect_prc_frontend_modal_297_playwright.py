"""
Playwright script body used by mcp_browser_automation for iteration 297.

Focused assertions for the reported regression:
- Login as 9970100782 / PIN 997010 on preview.
- Open /dashboard with a pre-seeded active mining session.
- Verify collect-rewards-btn is visible and enabled.
- Click Collect and assert immediate 'Loading reward…' feedback.
- Assert forced-ad-overlay and forced-ad-modal render within 2 seconds while
  the active MiningWidget branch is still mounted.
- Complete the modal via the 5s web fallback Skip path and verify exactly one
  /api/mining/collect response occurs; wait past 25s to ensure the safety timer
  was cleared and did not fire a duplicate collect.
"""

try:
    await page.set_viewport_size({"width": 390, "height": 844})
    collect_events = []
    status_events = []
    console_errors = []

    def on_response(resp):
        if "/api/mining/collect/" in resp.url:
            collect_events.append({"url": resp.url, "status": resp.status})
            print(f"Collect API response observed: status={resp.status} url={resp.url}")
        if "/api/mining/status/" in resp.url:
            status_events.append({"url": resp.url, "status": resp.status})

    def on_console(msg):
        if msg.type in ["error", "warning"]:
            console_errors.append(f"{msg.type}: {msg.text}")

    page.on("response", on_response)
    page.on("console", on_console)

    print("Navigating to login")
    await page.goto("https://formula-audit-fix.preview.emergentagent.com/login", wait_until="domcontentloaded")
    await page.locator('[data-testid="login-identifier-input"]').fill("9970100782")
    await page.locator('[data-testid="login-submit-btn"]').click(force=True)
    await page.wait_for_selector('[data-testid="login-pin-0"]', timeout=20000)
    for i, digit in enumerate("997010"):
        await page.locator(f'[data-testid="login-pin-{i}"]').fill(digit)
    print("PIN entered; waiting for dashboard")
    await page.wait_for_url("**/dashboard", timeout=45000)
    await page.wait_for_load_state("domcontentloaded")

    collect_btn = page.locator('[data-testid="collect-rewards-btn"]').first
    await collect_btn.wait_for(state="visible", timeout=45000)
    enabled = await collect_btn.is_enabled()
    text = await collect_btn.inner_text()
    active_count = await page.locator('[data-testid="mining-widget-active"]').count()
    print(f"Collect button visible. enabled={enabled}, active_widget_count={active_count}, text={text}")
    if not enabled:
        raise AssertionError("Collect Rewards button rendered but is disabled")
    if active_count < 1:
        raise AssertionError("Collect button is visible but active MiningWidget container was not found")

    print("Clicking Collect Rewards and checking immediate UI feedback + modal render")
    click_start_ms = await page.evaluate("Date.now()")
    await collect_btn.click(force=True)

    try:
        await page.wait_for_function(
            "() => document.body && /Loading reward/.test(document.body.innerText)",
            timeout=1000,
        )
        print("Immediate feedback PASS: 'Loading reward…' text/toast appeared within 1s")
    except Exception:
        body_now = await page.locator("body").inner_text()
        raise AssertionError("Immediate 'Loading reward…' feedback did not appear within 1s. Body excerpt: " + body_now[:1000])

    await page.wait_for_selector('[data-testid="forced-ad-overlay"]', state="visible", timeout=2000)
    await page.wait_for_selector('[data-testid="forced-ad-modal"]', state="visible", timeout=2000)
    overlay_ms = await page.evaluate("Date.now()")
    overlay_elapsed = round((overlay_ms - click_start_ms) / 1000, 3)
    overlay_count = await page.locator('[data-testid="forced-ad-overlay"]').count()
    modal_count = await page.locator('[data-testid="forced-ad-modal"]').count()
    countdown_text = await page.locator('[data-testid="forced-ad-countdown"]').first.inner_text()
    print(f"Forced ad modal PASS: overlay_count={overlay_count}, modal_count={modal_count}, elapsed={overlay_elapsed}s, countdown='{countdown_text}'")
    if overlay_elapsed > 2.0:
        raise AssertionError(f"Forced ad modal appeared too late: {overlay_elapsed}s")

    # Complete the modal through the web fallback so onAdCompleted/onClose clear the 25s safety timer.
    await page.wait_for_selector('[data-testid="forced-ad-skip"]', state="visible", timeout=9000)
    await page.locator('[data-testid="forced-ad-skip"]').click(force=True)
    print("Clicked forced-ad skip/continue after countdown")
    await page.wait_for_selector('[data-testid="forced-ad-overlay"]', state="detached", timeout=5000)

    # Wait for the collect API triggered by onAdCompleted.
    for _ in range(15):
        if collect_events:
            break
        await page.wait_for_timeout(1000)
    if not collect_events:
        raise AssertionError("No /api/mining/collect response observed after completing forced ad modal")
    if collect_events[0]["status"] != 200:
        raise AssertionError(f"/api/mining/collect returned non-200: {collect_events}")
    print(f"Collect after ad PASS: first collect event={collect_events[0]}")

    # Wait until after the 25-second safety timer would have fired. If onClose/onAdCompleted
    # failed to clear it, this can cause a duplicate collect attempt. Exact bug safety net stays armed.
    now_ms = await page.evaluate("Date.now()")
    remaining_ms = max(0, 27500 - (now_ms - click_start_ms))
    if remaining_ms:
        print(f"Waiting {remaining_ms}ms to verify 25s safety timer is cleared")
        await page.wait_for_timeout(remaining_ms)
    if len(collect_events) != 1:
        raise AssertionError(f"Expected exactly one collect API response after modal completion and safety window, saw {len(collect_events)}: {collect_events}")
    print("Safety timer clear PASS: no duplicate collect event after 25s safety window")

    body_text = await page.locator("body").inner_text()
    has_success_feedback = ("Collected" in body_text and "PRC" in body_text) or await page.locator('[data-testid="start-mining-btn"]').count() > 0
    print(f"Post-collect UI feedback present={has_success_feedback}")
    if not has_success_feedback:
        raise AssertionError("Collect succeeded but no collected toast or post-collect idle/cooldown UI was visible")

    # Get error messages using specific selectors
    error_text = await page.evaluate("""() => {
    const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
    return errorElements.map(el => el.textContent).join(", ");
    }""")
    if error_text:
        print(f"Found error message: {error_text}")
    else:
        print("No error messages found on the page")

    print(f"Status API responses observed: {status_events[-3:]}")
    print(f"Console warnings/errors captured: {console_errors[:10]}")
    print("FRONTEND_COLLECT_MODAL_TEST_PASS")
except Exception as e:
    print(f"FRONTEND_COLLECT_MODAL_TEST_FAIL: {e}")
    raise