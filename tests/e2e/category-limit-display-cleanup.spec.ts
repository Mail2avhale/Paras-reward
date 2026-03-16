import { test, expect } from '@playwright/test';

/**
 * Test Suite: Category-Based Redeem Limit UI Simplification
 * 
 * Requirements:
 * 1. Remove the main 'Monthly Redeem Limit' card from all redemption pages
 * 2. Remove the percentage labels (e.g., '(40%)', '(30%)', '(30%)') from category limit titles
 * 3. Show only the relevant category limit on each page:
 *    - 'Utility Limit' on BBPS page (bill-payments)
 *    - 'Bank Limit' on bank redeem page
 *    - 'Utility Limit' on Gift Voucher page
 */

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://category-cleanup-2.preview.emergentagent.com';
const TEST_USER = {
  mobile: '9970100782',
  pin: '997010'
};

// Helper function to login
async function loginUser(page: any) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  // Enter mobile
  const mobileInput = page.locator('input').first();
  await mobileInput.fill(TEST_USER.mobile);
  await page.waitForTimeout(1000);
  
  // Enter PIN
  const pinInputs = page.locator('input[type="tel"], input[inputmode="numeric"]');
  for (let i = 0; i < 6; i++) {
    await pinInputs.nth(i).fill(TEST_USER.pin[i]);
    await page.waitForTimeout(100);
  }
  
  // Click Sign In
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.waitForTimeout(5000);
}

test.describe('Category Limit Display Cleanup', () => {
  
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });
  
  test('BankRedeemPage shows Bank Limit card without percentage label', async ({ page }) => {
    // Navigate to Bank Redeem page
    await page.goto('/bank-redeem', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Verify Bank Limit card is visible
    const bankLimitHeader = page.locator('text=Bank Limit').first();
    await expect(bankLimitHeader).toBeVisible();
    
    // Verify NO percentage label like "(30%)" in the Bank Limit title
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toMatch(/Bank Limit\s*\(\d+%\)/);
    
    // Verify Monthly Redeem Limit card is NOT present
    const monthlyLimitCard = page.locator('text=Monthly Redeem Limit');
    await expect(monthlyLimitCard).toHaveCount(0);
    
    // Verify only ONE category limit card is visible (Bank Limit)
    // Check that Utility Limit is NOT shown
    const utilityLimitOnBankPage = page.locator('text=Utility Limit');
    await expect(utilityLimitOnBankPage).toHaveCount(0);
  });
  
  test('RedeemPageV2 (BBPS) shows Utility Limit card without percentage label', async ({ page }) => {
    // Navigate to BBPS page (bill-payments)
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Verify Utility Limit card is visible
    const utilityLimitHeader = page.locator('text=Utility Limit').first();
    await expect(utilityLimitHeader).toBeVisible();
    
    // Verify NO percentage label like "(40%)" in the Utility Limit title
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toMatch(/Utility Limit\s*\(\d+%\)/);
    
    // Verify Monthly Redeem Limit card is NOT present
    const monthlyLimitCard = page.locator('text=Monthly Redeem Limit');
    await expect(monthlyLimitCard).toHaveCount(0);
    
    // Verify only Utility Limit is shown (not Bank Limit)
    const bankLimitOnBBPSPage = page.locator('text=Bank Limit');
    await expect(bankLimitOnBBPSPage).toHaveCount(0);
  });
  
  test('GiftVoucherRedemption shows Utility Limit card without percentage label', async ({ page }) => {
    // Navigate to Gift Voucher page
    await page.goto('/gift-vouchers', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Verify Utility Limit card is visible
    const utilityLimitHeader = page.locator('text=Utility Limit').first();
    await expect(utilityLimitHeader).toBeVisible();
    
    // Verify NO percentage label like "(40%)" in the Utility Limit title
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toMatch(/Utility Limit\s*\(\d+%\)/);
    
    // Verify Monthly Redeem Limit card is NOT present
    const monthlyLimitCard = page.locator('text=Monthly Redeem Limit');
    await expect(monthlyLimitCard).toHaveCount(0);
    
    // Verify only Utility Limit is shown (not Bank Limit)
    const bankLimitOnGiftPage = page.locator('text=Bank Limit');
    await expect(bankLimitOnGiftPage).toHaveCount(0);
  });
  
  test('CategoryLimitsDisplay component has correct structure', async ({ page }) => {
    // Navigate to Bank Redeem page to check the component structure
    await page.goto('/bank-redeem', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Verify the category card shows Total, Used, and Available values
    const totalLabel = page.locator('text=TOTAL').or(page.locator('text=Total')).first();
    await expect(totalLabel).toBeVisible();
    
    const usedLabel = page.locator('text=USED').or(page.locator('text=Used')).first();
    await expect(usedLabel).toBeVisible();
    
    const availableLabel = page.locator('text=AVAILABLE').or(page.locator('text=Available')).first();
    await expect(availableLabel).toBeVisible();
    
    // Verify there's a percentage indicator (e.g., "0% used")
    const usagePercent = page.locator('text=/\\d+%\\s*used/i').first();
    await expect(usagePercent).toBeVisible();
  });
  
  test('All redemption pages show correct category for their context', async ({ page }) => {
    // Test 1: Bank Redeem -> Bank Limit only
    await page.goto('/bank-redeem', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    let bankLimit = page.locator('text=Bank Limit').first();
    await expect(bankLimit).toBeVisible();
    
    // Test 2: BBPS -> Utility Limit only
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    let utilityLimit = page.locator('text=Utility Limit').first();
    await expect(utilityLimit).toBeVisible();
    
    // Test 3: Gift Vouchers -> Utility Limit only
    await page.goto('/gift-vouchers', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    utilityLimit = page.locator('text=Utility Limit').first();
    await expect(utilityLimit).toBeVisible();
  });
});

test.describe('Category Limit API Verification', () => {
  
  test('Backend redeem-categories settings API returns categories', async ({ request }) => {
    // Get global category settings
    const response = await request.get(`${BASE_URL}/api/redeem-categories/settings`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.categories).toBeDefined();
    
    // Verify default categories exist
    expect(data.categories.utility).toBeDefined();
    expect(data.categories.bank).toBeDefined();
    expect(data.categories.shopping).toBeDefined();
    
    // Verify category structure
    expect(data.categories.utility.percentage).toBeDefined();
    expect(data.categories.bank.percentage).toBeDefined();
    expect(data.categories.shopping.percentage).toBeDefined();
  });
  
  test('PRC Rate API returns current rate', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/prc-rate/current`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.current_rate).toBeDefined();
    expect(typeof data.current_rate).toBe('number');
    expect(data.current_rate).toBeGreaterThan(0);
  });
});
