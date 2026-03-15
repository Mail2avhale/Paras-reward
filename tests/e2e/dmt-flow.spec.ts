/**
 * DMT (Domestic Money Transfer) Frontend E2E Tests
 * =================================================
 * Tests for the DMT user flow including:
 * - DMT page UI components
 * - Customer search by mobile number
 * - Recipients list display
 * - Transfer form functionality
 * 
 * BUG DISCOVERED: DMTPage.js reads from localStorage.getItem('user') but login
 * stores under 'paras_user'. This causes wallet balance to show 0 PRC on DMT page.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'https://dynamic-rate-system-1.preview.emergentagent.com';

const DMT_TEST_CREDENTIALS = {
  email: 'mail2avhale@gmail.com',
  pin: '153759',
  userId: '73b95483-f36b-4637-a5ee-d447300c6835',
  customerMobile: '9970100782',
  recipientId: '15186062'
};

// Helper to login and wait for dashboard
async function loginAsDMTTestUser(page: any) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Enter email
  const emailInput = page.getByPlaceholder('Enter email, mobile or UID');
  await emailInput.fill(DMT_TEST_CREDENTIALS.email);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(2000);

  // Enter PIN
  const pin = DMT_TEST_CREDENTIALS.pin;
  const pinInputs = page.locator('input[inputmode="numeric"]');
  for (let i = 0; i < 6; i++) {
    await pinInputs.nth(i).fill(pin[i]);
    await page.waitForTimeout(100);
  }

  // Wait for dashboard
  await page.waitForURL(/dashboard|home/i, { timeout: 30000 });
  await page.waitForTimeout(2000);
}

test.describe('DMT Page - UI Tests', () => {

  test('DMT page loads with correct UI elements', async ({ page }) => {
    await loginAsDMTTestUser(page);
    await page.goto('/dmt', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Verify page title
    await expect(page.getByText('Bank Transfer (DMT)')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Transfer PRC to bank account instantly')).toBeVisible();
    
    // Verify wallet card exists (shows 0 PRC due to bug)
    await expect(page.getByText('PRC Balance')).toBeVisible();
    
    // Verify customer search input
    const mobileInput = page.getByTestId('customer-mobile-input');
    await expect(mobileInput).toBeVisible();
    
    // Verify search button
    const searchBtn = page.getByTestId('search-customer-btn');
    await expect(searchBtn).toBeVisible();
    
    // Verify tabs
    await expect(page.getByRole('tab', { name: /Transfer/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Add Account/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /History/i })).toBeVisible();
  });

  test('Conversion info displays correctly at bottom', async ({ page }) => {
    await loginAsDMTTestUser(page);
    await page.goto('/dmt', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Verify conversion rate
    await expect(page.getByText('100 PRC = ₹1')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Conversion Rate')).toBeVisible();
    
    // Verify minimum transfer
    await expect(page.getByText('₹100')).toBeVisible();
    await expect(page.getByText('Minimum Transfer')).toBeVisible();
    
    // Verify daily limit
    await expect(page.getByText('₹5,000')).toBeVisible();
    await expect(page.getByText('Daily Limit')).toBeVisible();
    
    // Verify IMPS transfer
    await expect(page.getByText('IMPS Transfer')).toBeVisible();
  });

  test('Customer mobile input accepts numeric values', async ({ page }) => {
    await loginAsDMTTestUser(page);
    await page.goto('/dmt', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    const mobileInput = page.getByTestId('customer-mobile-input');
    await mobileInput.fill(DMT_TEST_CREDENTIALS.customerMobile);
    await expect(mobileInput).toHaveValue(DMT_TEST_CREDENTIALS.customerMobile);
  });

  test('Add Account tab shows form fields', async ({ page }) => {
    await loginAsDMTTestUser(page);
    await page.goto('/dmt', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Click Add Account tab
    await page.getByRole('tab', { name: /Add Account/i }).click();
    await page.waitForTimeout(1000);
    
    // Verify form fields
    await expect(page.getByTestId('recipient-name-input')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('account-number-input')).toBeVisible();
    await expect(page.getByTestId('ifsc-input')).toBeVisible();
    await expect(page.getByTestId('add-recipient-btn')).toBeVisible();
  });
});

test.describe('DMT API Tests', () => {
  
  test('DMT health endpoint returns correct status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/dmt/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('DMT SERVICE RUNNING');
    expect(data.prc_rate).toBe('100 PRC = ₹1');
    expect(data.min_redeem).toBe('₹100');
    expect(data.max_daily).toBe('₹5000');
  });

  test('Customer search API returns customer data', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/eko/dmt/customer/search`, {
      data: {
        mobile: DMT_TEST_CREDENTIALS.customerMobile,
        user_id: DMT_TEST_CREDENTIALS.userId
      }
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.customer_exists).toBe(true);
    expect(data.data.mobile).toBe(DMT_TEST_CREDENTIALS.customerMobile);
    expect(data.data.name).toContain('Santosh');
  });

  test('Recipients API returns recipient list', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/eko/dmt/recipients/${DMT_TEST_CREDENTIALS.customerMobile}?user_id=${DMT_TEST_CREDENTIALS.userId}`
    );
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.count).toBeGreaterThanOrEqual(1);
    
    // Verify test recipient exists
    const testRecipient = data.data.recipients.find(
      (r: any) => String(r.recipient_id) === DMT_TEST_CREDENTIALS.recipientId
    );
    expect(testRecipient).toBeTruthy();
    expect(testRecipient.recipient_name).toContain('SANTOSH');
  });

  test('Wallet API returns balance data', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/eko/dmt/wallet/${DMT_TEST_CREDENTIALS.userId}`
    );
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('prc_balance');
    expect(data.data).toHaveProperty('inr_equivalent');
    expect(data.data).toHaveProperty('daily_limit_inr');
    expect(data.data.daily_limit_inr).toBe(5000);
  });

  test('Transactions API returns history', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/eko/dmt/transactions/${DMT_TEST_CREDENTIALS.userId}?limit=5`
    );
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('total');
    expect(data.data).toHaveProperty('transactions');
    expect(Array.isArray(data.data.transactions)).toBe(true);
  });
});
