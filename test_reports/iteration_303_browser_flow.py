"""Exact Playwright script body executed through mcp_browser_automation for iteration 303."""

try:
    BASE = "https://formula-audit-fix.preview.emergentagent.com"
    await page.set_viewport_size({"width": 390, "height": 844})
    await page.add_init_script("""
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 ParasRewardApp/1.4.5 Mobile'
      });
      Object.defineProperty(navigator, 'platform', { get: () => 'Linux armv8l' });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    """)

    async def collect_checkout_text():
        details = []
        upi_visible = False
        for frame in page.frames:
            url = frame.url or ''
            if 'razorpay' in url.lower() or frame != page.main_frame:
                try:
                    txt = await frame.locator('body').inner_text(timeout=3000)
                    sample = txt.replace('\n', ' ')[:600]
                    details.append({'url': url[:180], 'sample': sample})
                    if 'upi' in txt.lower() or 'phonepe' in txt.lower() or 'gpay' in txt.lower() or 'paytm' in txt.lower():
                        upi_visible = True
                except Exception as exc:
                    details.append({'url': url[:180], 'error': str(exc)[:160]})
        return upi_visible, details

    async def open_and_verify(label, locator):
        print(f'Opening checkout for {label}')
        await locator.click(force=True)
        await page.wait_for_timeout(8000)
        frame_count = len(page.frames)
        iframe_count = await page.locator('iframe').count()
        upi_visible, details = await collect_checkout_text()
        # Some service-charge checkouts ask for contact first when the app user
        # object lacks `mobile`; enter the known test mobile and continue to the
        # actual method-selection screen, without completing any payment.
        if not upi_visible:
            for frame in page.frames:
                try:
                    txt = await frame.locator('body').inner_text(timeout=1000)
                    if 'Contact details' in txt or 'Mobile number' in txt:
                        mobile_box = frame.locator('input[type="tel"], input[placeholder*="Mobile"], input[placeholder*="mobile"]').first
                        await mobile_box.fill('9970100782')
                        await frame.get_by_text('Continue', exact=True).click(force=True)
                        await page.wait_for_timeout(5000)
                        upi_visible, details = await collect_checkout_text()
                        break
                except Exception:
                    pass
        if not upi_visible:
            for _ in range(6):
                await page.wait_for_timeout(2500)
                upi_visible, details = await collect_checkout_text()
                if upi_visible:
                    break
        print(f'{label}: frame_count={frame_count}, iframe_count={iframe_count}, upi_visible={upi_visible}, frame_details={details}')
        if iframe_count < 1:
            raise Exception(f'{label}: Razorpay iframe did not open')
        if not upi_visible:
            raise Exception(f'{label}: UPI/PhonePe/GPay/Paytm text not visible in checkout frames')
        await page.goto(BASE + '/my-service-charges', wait_until='domcontentloaded')
        await page.wait_for_selector('[data-testid="my-service-charges-page"]', timeout=30000)
        await page.wait_for_timeout(1200)

    await page.goto(BASE + '/login', wait_until='domcontentloaded')
    print('Login page loaded')
    await page.get_by_test_id('login-identifier-input').fill('9970100782')
    await page.get_by_test_id('login-submit-btn').click(force=True)
    await page.wait_for_selector('[data-testid="login-pin-0"]', timeout=30000)
    for i, d in enumerate('997010'):
        await page.get_by_test_id(f'login-pin-{i}').fill(d)
    await page.get_by_test_id('login-submit-btn').click(force=True)
    await page.wait_for_timeout(5000)
    print('Post-login URL:', page.url)

    await page.goto(BASE + '/dashboard', wait_until='domcontentloaded')
    await page.wait_for_timeout(5000)
    await page.wait_for_selector('[data-testid="banner-pay-btn"]', timeout=30000)
    print('Service-charge banner visible on dashboard')
    await open_and_verify('banner Pay button', page.get_by_test_id('banner-pay-btn'))

    row_pay = page.locator('button[data-testid^="pay-btn-"]').first
    await row_pay.wait_for(timeout=30000)
    await open_and_verify('row Pay Now button', row_pay)

    await page.get_by_test_id('bulk-pay-btn').wait_for(timeout=30000)
    await open_and_verify('bulk Pay All button', page.get_by_test_id('bulk-pay-btn'))

    error_text = await page.evaluate("""() => {
    const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
    return errorElements.map(el => el.textContent).join(", ");
    }""")
    if error_text:
        print(f"Found error message: {error_text}")
    else:
        print("No error messages found on the page")
    print('ITERATION_303_BROWSER_TEST_SUCCESS')
except Exception as e:
    print('ITERATION_303_BROWSER_TEST_FAILURE', str(e))
    error_text = await page.evaluate("""() => {
    const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
    return errorElements.map(el => el.textContent).join(", ");
    }""")
    if error_text:
        print(f"Found error message: {error_text}")
    else:
        print("No error messages found on the page")
    raise