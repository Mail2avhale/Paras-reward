import { test, expect } from '@playwright/test';

/**
 * Bill Payments Feature Tests (Public/Non-Auth)
 * Tests for the Eko Bill Payments frontend UI
 * 
 * Note: Authentication has issues - new PIN not working after security upgrade
 */

const BASE_URL = 'https://reward-bills.preview.emergentagent.com';

test.describe('Homepage and Login Page', () => {
  
  test('homepage loads with stats', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Check for key elements
    const title = page.getByText('Collect PRC Points');
    await expect(title).toBeVisible({ timeout: 10000 });
    
    // Check for stats cards
    const activeMembers = page.getByText('Active Members');
    await expect(activeMembers).toBeVisible();
    
    const pointsDistributed = page.getByText('Points Distributed');
    await expect(pointsDistributed).toBeVisible();
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Check for login form
    const welcomeBack = page.getByText('Welcome Back');
    await expect(welcomeBack).toBeVisible({ timeout: 10000 });
    
    const emailInput = page.getByPlaceholder('Enter email, mobile or UID');
    await expect(emailInput).toBeVisible();
    
    const signInBtn = page.getByRole('button', { name: 'Sign In' });
    await expect(signInBtn).toBeVisible();
  });

  test('login shows PIN input after email entry', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Enter email
    const emailInput = page.getByPlaceholder('Enter email, mobile or UID');
    await emailInput.fill('testmember@paras.com');
    
    // Click Sign In
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle');
    
    // Should show PIN input
    const pinLabel = page.getByText('Enter 6-Digit PIN');
    await expect(pinLabel).toBeVisible({ timeout: 10000 });
    
    // Should have 6 PIN boxes
    const pinBoxes = page.locator('input[maxlength="1"]');
    await expect(pinBoxes).toHaveCount(6);
  });
});

test.describe('Bill Payments API Endpoints', () => {
  
  test('Eko config endpoint returns config', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/config`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.configured).toBe(true);
    expect(data.base_url).toContain('eko.in');
    expect(data.environment).toBe('production');
  });

  test('Eko categories endpoint returns bill categories', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/bbps/categories`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.categories).toBeDefined();
    expect(data.categories.length).toBeGreaterThan(0);
    
    // Check for expected categories
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
    // Balance may be 0 but endpoint should respond
    if (data.success) {
      expect(data.balance).toBeDefined();
      expect(data.currency).toBe('INR');
    }
  });

  test('Health endpoint returns healthy', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.database).toBe('connected');
  });
});

test.describe('Authentication Flow - Security Upgrade Issue', () => {
  
  test('user is redirected to set-new-pin after login with old PIN', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Enter email
    const emailInput = page.getByPlaceholder('Enter email, mobile or UID');
    await emailInput.fill('testmember@paras.com');
    
    // Click Sign In
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Enter old PIN (123456 as mentioned in context)
    const pinBoxes = page.locator('input[maxlength="1"]');
    const loginPin = '123456';
    for (let i = 0; i < 6; i++) {
      await pinBoxes.nth(i).click();
      await pinBoxes.nth(i).pressSequentially(loginPin[i]);
    }
    
    // Click Sign In
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Should redirect to set-new-pin page (security upgrade)
    expect(page.url()).toContain('set-new-pin');
  });

  test('set-new-pin page validates PIN requirements', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Login flow
    await page.getByPlaceholder('Enter email, mobile or UID').fill('testmember@paras.com');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Enter PIN
    const pinBoxes = page.locator('input[maxlength="1"]');
    for (let i = 0; i < 6; i++) {
      await pinBoxes.nth(i).click();
      await pinBoxes.nth(i).pressSequentially(String((i + 1) % 10));
    }
    
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/set-new-pin/, { timeout: 15000 });
    
    // Try sequential PIN - should be rejected
    const newPinBoxes = page.locator('input[maxlength="1"]');
    const sequentialPin = '123456';
    
    for (let i = 0; i < 6; i++) {
      await newPinBoxes.nth(i).click();
      await newPinBoxes.nth(i).fill(sequentialPin[i]);
    }
    
    // Should show validation error
    const errorMsg = page.getByText(/cannot be sequential|don't use sequential/i);
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });
});
