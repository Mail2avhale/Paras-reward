import { Page, expect } from '@playwright/test';

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
}

export async function dismissToasts(page: Page) {
  await page.addLocatorHandler(
    page.locator('[data-sonner-toast], .Toastify__toast, [role="status"].toast, .MuiSnackbar-root'),
    async () => {
      const close = page.locator('[data-sonner-toast] [data-close], [data-sonner-toast] button[aria-label="Close"], .Toastify__close-button, .MuiSnackbar-root button');
      await close.first().click({ timeout: 2000 }).catch(() => {});
    },
    { times: 10, noWaitAfter: true }
  );
}

export async function checkForErrors(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const errorElements = Array.from(
      document.querySelectorAll('.error, [class*="error"], [id*="error"]')
    );
    return errorElements.map(el => el.textContent || '').filter(Boolean);
  });
}

export async function loginAsTestUser(page: Page) {
  // Test user credentials: testmember@paras.com with PIN 123456
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  
  // Enter email
  const emailInput = page.getByPlaceholder('your@email.com').or(page.locator('input[type="email"]')).first();
  await emailInput.fill('testmember@paras.com');
  
  // Click continue or submit
  const continueBtn = page.getByRole('button', { name: /continue|next|submit/i }).first();
  await continueBtn.click();
  
  // Wait for PIN input to appear
  await page.waitForSelector('input[type="password"], input[inputmode="numeric"]', { timeout: 10000 });
  
  // Enter PIN digits
  const pinInputs = page.locator('input[type="password"], input[inputmode="numeric"]');
  const count = await pinInputs.count();
  
  if (count >= 6) {
    // 6 separate PIN boxes
    const pin = '123456';
    for (let i = 0; i < 6; i++) {
      await pinInputs.nth(i).fill(pin[i]);
    }
  } else if (count === 1) {
    // Single PIN input
    await pinInputs.first().fill('123456');
  }
  
  // Submit PIN
  const submitBtn = page.getByRole('button', { name: /login|sign in|submit|verify/i }).first();
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
  }
  
  // Wait for redirect to dashboard
  await page.waitForURL(/dashboard|home/i, { timeout: 15000 });
}

export async function navigateToBillPayments(page: Page) {
  await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
}

// DMT Test credentials
export const DMT_TEST_CREDENTIALS = {
  email: 'mail2avhale@gmail.com',
  pin: '153759',
  userId: '73b95483-f36b-4637-a5ee-d447300c6835',
  customerMobile: '9970100782',
  recipientId: '15186062'
};

export async function loginAsDMTTestUser(page: Page) {
  // Login with DMT test user credentials
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  
  // Wait for login form to load
  await page.waitForSelector('input[type="email"], input[placeholder*="email"]', { timeout: 10000 });
  
  // Enter email
  const emailInput = page.getByPlaceholder('your@email.com').or(page.locator('input[type="email"]')).first();
  await emailInput.fill(DMT_TEST_CREDENTIALS.email);
  
  // Click continue
  const continueBtn = page.getByRole('button', { name: /continue|next|submit/i }).first();
  await continueBtn.click();
  
  // Wait for PIN input
  await page.waitForSelector('input[type="password"], input[inputmode="numeric"], input[type="tel"]', { timeout: 10000 });
  
  // Enter PIN digits (6 digit PIN: 153759)
  const pinInputs = page.locator('input[type="password"], input[inputmode="numeric"], input[type="tel"]');
  const count = await pinInputs.count();
  
  if (count >= 6) {
    // 6 separate PIN boxes
    const pin = DMT_TEST_CREDENTIALS.pin;
    for (let i = 0; i < 6; i++) {
      await pinInputs.nth(i).fill(pin[i]);
    }
  } else if (count === 1) {
    // Single PIN input
    await pinInputs.first().fill(DMT_TEST_CREDENTIALS.pin);
  }
  
  // Submit login
  const loginBtn = page.getByRole('button', { name: /login|sign in|submit|verify/i }).first();
  if (await loginBtn.isVisible()) {
    await loginBtn.click();
  }
  
  // Wait for redirect to dashboard
  await page.waitForURL(/dashboard|home|dmt/i, { timeout: 15000 });
}

export async function navigateToDMT(page: Page) {
  await page.goto('/dmt', { waitUntil: 'domcontentloaded' });
}
