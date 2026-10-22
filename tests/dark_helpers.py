B = "https://formula-audit-fix.preview.emergentagent.com"
JS = open('/app/tests/dark_audit.js').read()


async def login(page, ident="9970100782", pin="997010", dest="**/dashboard**"):
    await page.goto(B + "/login")
    await page.wait_for_selector('[data-testid="login-identifier-input"]', timeout=15000)
    await page.fill('[data-testid="login-identifier-input"]', ident)
    await page.click('[data-testid="login-submit-btn"]')
    await page.wait_for_selector('[data-testid="login-pin-0"]', timeout=10000)
    await page.click('[data-testid="login-pin-0"]')
    await page.keyboard.type(pin)
    await page.wait_for_timeout(1000)
    if "login" in page.url:
        await page.click('[data-testid="login-submit-btn"]')
    await page.wait_for_url(dest, timeout=20000)
    await page.wait_for_timeout(2000)


async def audit(page, name, n_lc=14, n_p=8):
    await page.wait_for_timeout(3500)
    h = await page.evaluate("document.body.scrollHeight")
    for y in range(0, h, 700):
        await page.evaluate("window.scrollTo(0,%d)" % y)
        await page.wait_for_timeout(250)
    await page.evaluate("window.scrollTo(0,0)")
    res = await page.evaluate(JS)
    print("=== %s url=%s h=%s body=%s LC=%s panels=%s" % (name, page.url[len(B):], h, res['bodyClass'], res['nIssues'], res['nPanels']))
    for i in res['issues'][:n_lc]:
        print("  LC", i['ratio'], repr(i['text'][:35]), i['color'], 'on', i['bg'], '|', i['el'][:60], '| tid', i['tid'], '| bgEl', i['bgEl'][:60], '| y', i['y'])
    for p in res['panels'][:n_p]:
        print("  PANEL", p['bg'], p['size'], p['el'][:80], 'tid', p['tid'], 'y', p['y'])
    return res
