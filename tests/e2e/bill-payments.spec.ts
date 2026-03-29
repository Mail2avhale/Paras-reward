import { test, expect } from '@playwright/test';

/**
 * Bill Payments Feature Tests
 * Tests for the Eko Bill Payments frontend UI
 * 
 * Test user: testmember@paras.com / PIN: 123456 (Elite, 50000 PRC)
 */

const BASE_URL = 'https://economy-platform-v2.preview.emergentagent.com';

// Reusable login helper
async function loginTestUser(page: any) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  
  // Enter email
  const emailInput = page.getByPlaceholder('Enter email, mobile or UID');
  await emailInput.fill('testmember@paras.com');
  
  // Click Sign In
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  
  // Enter PIN
  const pinBoxes = page.locator('input[maxlength="1"]');
  const pin = '123456';
  for (let i = 0; i < 6; i++) {
    await pinBoxes.nth(i).click();
    await pinBoxes.nth(i).pressSequentially(pin[i]);
  }
  
  // Click Sign In
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Handle set-new-pin if prompted (may happen for first login after security upgrade)
  if (page.url().includes('set-new-pin')) {
    const newPinBoxes = page.locator('input[maxlength="1"]');
    const newPin = '847293';
    
    for (let i = 0; i < 6; i++) {
      await newPinBoxes.nth(i).click();
      await newPinBoxes.nth(i).fill(newPin[i]);
    }
    await page.waitForTimeout(300);
    for (let i = 6; i < 12; i++) {
      await newPinBoxes.nth(i).click();
      await newPinBoxes.nth(i).fill(newPin[i - 6]);
    }
    
    await page.getByRole('button', { name: /Set PIN|Continue/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Re-login with new PIN
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await emailInput.fill('testmember@paras.com');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const pinBoxes2 = page.locator('input[maxlength="1"]');
    for (let i = 0; i < 6; i++) {
      await pinBoxes2.nth(i).click();
      await pinBoxes2.nth(i).pressSequentially(newPin[i]);
    }
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  }
}

test.describe('Homepage and Public Pages', () => {
  
  test('homepage loads with stats', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    const title = page.getByText('Collect PRC Points');
    await expect(title).toBeVisible({ timeout: 10000 });
    
    const activeMembers = page.getByText('Active Members');
    await expect(activeMembers).toBeVisible();
  });

  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    const welcomeBack = page.getByText('Welcome Back');
    await expect(welcomeBack).toBeVisible({ timeout: 10000 });
    
    const emailInput = page.getByPlaceholder('Enter email, mobile or UID');
    await expect(emailInput).toBeVisible();
  });
});

test.describe('Bill Payments API Endpoints', () => {
  
  test('Eko config endpoint returns configured', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/config`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.configured).toBe(true);
    expect(data.environment).toBe('production');
  });

  test('Eko categories endpoint returns bill categories', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/bbps/categories`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.categories.length).toBeGreaterThan(0);
    
    const categoryIds = data.categories.map((c: any) => c.id);
    expect(categoryIds).toContain('electricity');
    expect(categoryIds).toContain('dth');
    expect(categoryIds).toContain('mobile_postpaid');
  });

  test('Eko balance endpoint responds', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/balance`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBeDefined();
  });

  test('Health endpoint returns healthy', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.database).toBe('connected');
  });
});

test.describe('Bill Payments Page - Authenticated', () => {
  
  test.beforeEach(async ({ page }) => {
    await loginTestUser(page);
  });

  test('can access dashboard after login', async ({ page }) => {
    // After login, should be on dashboard
    await expect(page.getByText(/Good|Welcome/i)).toBeVisible({ timeout: 10000 });
    // Use .first() to avoid strict mode violation when multiple elements match
    await expect(page.getByText('testmember').first()).toBeVisible();
    await expect(page.getByText(/PRC|Balance/i).first()).toBeVisible();
  });

  test('can navigate to Bill Payments page', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Check for page header
    const header = page.getByText(/Bill Payments|Recharge/i).first();
    await expect(header).toBeVisible({ timeout: 15000 });
  });

  test('displays service type selection buttons', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check for service selection using data-testid
    const mobileRechargeBtn = page.getByTestId('service-mobile_recharge');
    const dthRechargeBtn = page.getByTestId('service-dish_recharge');
    const electricityBtn = page.getByTestId('service-electricity_bill');
    
    await expect(mobileRechargeBtn).toBeVisible({ timeout: 15000 });
    await expect(dthRechargeBtn).toBeVisible();
    await expect(electricityBtn).toBeVisible();
  });

  test('displays payment mode tabs (Instant Pay vs Request Based)', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Payment mode tabs
    const instantPayTab = page.getByText('Instant Pay').first();
    const requestBasedTab = page.getByText('Request Based').first();
    
    await expect(instantPayTab).toBeVisible({ timeout: 15000 });
    await expect(requestBasedTab).toBeVisible();
  });

  test('shows provider selection for Instant Pay mode', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Provider selection section
    const providerSection = page.getByText('Select Provider').first();
    await expect(providerSection).toBeVisible({ timeout: 15000 });
  });

  test('shows static fallback billers for mobile recharge', async ({ page }) => {
    await page.goto('/bill-payments?type=mobile_recharge', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Should show fallback providers
    const jioProvider = page.getByText('Jio Prepaid').first();
    await expect(jioProvider).toBeVisible({ timeout: 15000 });
    
    const airtelProvider = page.getByText('Airtel Prepaid').first();
    await expect(airtelProvider).toBeVisible();
  });

  test('can switch between service types', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Click on DTH
    const dthBtn = page.getByTestId('service-dish_recharge');
    await expect(dthBtn).toBeVisible({ timeout: 15000 });
    await dthBtn.click();
    await page.waitForTimeout(2000);
    
    // Should show DTH providers
    const tataPlay = page.getByText(/Tata Play|Tata Sky/i).first();
    await expect(tataPlay).toBeVisible({ timeout: 10000 });
  });

  test('shows payment form after selecting provider', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Select Jio provider
    const jioProvider = page.getByText('Jio Prepaid').first();
    await expect(jioProvider).toBeVisible({ timeout: 15000 });
    await jioProvider.click();
    await page.waitForTimeout(1000);
    
    // Payment details form should appear
    const paymentDetails = page.getByText('Payment Details').first();
    await expect(paymentDetails).toBeVisible({ timeout: 5000 });
    
    // Mobile number input
    const mobileInput = page.getByPlaceholder(/mobile number|10-digit/i).first();
    await expect(mobileInput).toBeVisible();
  });

  test('shows charge breakdown when amount entered', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Select provider
    const jioProvider = page.getByText('Jio Prepaid').first();
    await expect(jioProvider).toBeVisible({ timeout: 15000 });
    await jioProvider.click();
    await page.waitForTimeout(1000);
    
    // Fill mobile number
    const mobileInput = page.getByPlaceholder(/mobile number|10-digit/i).first();
    await expect(mobileInput).toBeVisible({ timeout: 5000 });
    await mobileInput.fill('9876543210');
    
    // Fill amount
    const amountInput = page.getByPlaceholder(/0.00/i).first();
    await amountInput.fill('100');
    await page.waitForTimeout(500);
    
    // Charge breakdown should appear
    const chargeBreakdown = page.getByText('Charge Breakdown').first();
    await expect(chargeBreakdown).toBeVisible({ timeout: 5000 });
    
    // Processing fee
    const processingFee = page.getByText('Processing Fee').first();
    await expect(processingFee).toBeVisible();
    
    // Admin charges
    const adminCharges = page.getByText(/Admin Charges/i).first();
    await expect(adminCharges).toBeVisible();
  });

  test('displays PRC balance on bill payments page', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // PRC balance should be displayed
    const prcBalance = page.getByText(/PRC/i).first();
    await expect(prcBalance).toBeVisible({ timeout: 15000 });
  });

  test('TIMEOUT FIX: loading spinner disappears and fallback billers show within 8 seconds', async ({ page }) => {
    // This test verifies the fix for the loading spinner persistence issue
    // The fix adds an 8 second timeout with AbortController, after which fallback billers are shown
    
    await page.goto('/bill-payments?type=mobile_recharge', { waitUntil: 'domcontentloaded' });
    
    // Record start time
    const startTime = Date.now();
    
    // Wait for Select Provider section to appear
    const providerSection = page.getByText('Select Provider').first();
    await expect(providerSection).toBeVisible({ timeout: 15000 });
    
    // Wait for fallback billers to appear (8 second timeout + buffer)
    const jioProvider = page.getByText('Jio Prepaid').first();
    await expect(jioProvider).toBeVisible({ timeout: 12000 });
    
    // Verify loading spinner is NOT visible after providers load
    const loadingSpinner = page.locator('[class*="animate-spin"]').first();
    await expect(loadingSpinner).not.toBeVisible({ timeout: 2000 });
    
    // Calculate elapsed time - should be less than 12 seconds
    const elapsedTime = Date.now() - startTime;
    console.log(`[TIMEOUT FIX] Fallback billers loaded in ${elapsedTime}ms`);
    
    // Verify this completes within reasonable time (under 12 seconds including navigation)
    expect(elapsedTime).toBeLessThan(12000);
  });
});
