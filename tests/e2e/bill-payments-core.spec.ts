import { test, expect } from '@playwright/test';

/**
 * Bill Payments Core Tests
 * Tests for the Eko Bill Payments frontend UI
 * Test user: testmember@paras.com / PIN: 123456 (Elite, 50000 PRC)
 */

const BASE_URL = 'https://bbps-dmt-repair.preview.emergentagent.com';

test.describe('Bill Payments API Endpoints', () => {
  
  test('Eko config returns configured', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/config`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.configured).toBe(true);
  });

  test('Eko categories returns bill categories', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/bbps/categories`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.categories.length).toBeGreaterThan(0);
  });

  test('Eko balance responds', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/balance`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBeDefined();
  });
});

test.describe('Bill Payments Page', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    await page.getByPlaceholder('Enter email, mobile or UID').fill('testmember@paras.com');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const pinBoxes = page.locator('input[maxlength="1"]');
    for (let i = 0; i < 6; i++) {
      await pinBoxes.nth(i).click();
      await pinBoxes.nth(i).pressSequentially(String((i + 1) % 10));
    }
    
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('displays service type buttons', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    const mobileBtn = page.getByTestId('service-mobile_recharge');
    await expect(mobileBtn).toBeVisible({ timeout: 15000 });
    
    const dthBtn = page.getByTestId('service-dish_recharge');
    await expect(dthBtn).toBeVisible();
    
    const electricityBtn = page.getByTestId('service-electricity_bill');
    await expect(electricityBtn).toBeVisible();
  });

  test('shows payment mode tabs', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByText('Instant Pay').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Request Based').first()).toBeVisible();
  });

  test('shows provider selection', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByText('Select Provider').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Jio Prepaid').first()).toBeVisible({ timeout: 15000 });
  });

  test('shows payment form after provider selection', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    await page.getByText('Jio Prepaid').first().click();
    await page.waitForTimeout(500);
    
    await expect(page.getByText('Payment Details').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/mobile number|10-digit/i).first()).toBeVisible();
  });
});
