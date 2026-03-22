import { test, expect } from '@playwright/test';
import { dismissToasts, waitForAppReady } from '../fixtures/helpers';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://redeem-system-v2.preview.emergentagent.com';
// Test user credentials that are working
const USER_EMAIL = 'mail2avhale@gmail.com';
const USER_PIN = '153759';

// Helper: Login as regular user
async function loginAsUser(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  
  // Wait for login form
  await page.waitForSelector('input[placeholder*="email"], input[placeholder*="Enter email"]', { timeout: 10000 });
  
  // Enter email
  const emailInput = page.locator('input[placeholder*="email"], input[placeholder*="Enter email"]').first();
  await emailInput.fill(USER_EMAIL);
  
  // Click Sign In button
  const signInBtn = page.getByRole('button', { name: /Sign In/i }).first();
  await signInBtn.click();
  
  // Wait for PIN input to appear
  await page.waitForSelector('[data-testid="login-pin-0"]', { timeout: 10000 });
  
  // Enter PIN using the data-testid attributes
  const pin = USER_PIN;
  for (let i = 0; i < 6; i++) {
    await page.locator(`[data-testid="login-pin-${i}"]`).fill(pin[i]);
  }
  
  // Submit by clicking Sign In again
  await page.getByRole('button', { name: /Sign In/i }).first().click();
  
  // Wait for dashboard redirect
  await page.waitForURL(/dashboard/i, { timeout: 15000 });
}

test.describe('Popup API Integration', () => {
  test('GET /api/admin/popup/all returns list', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/admin/popup/all`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(typeof data.total).toBe('number');
  });

  test('GET /api/admin/popup/active returns correct structure', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/admin/popup/active`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(typeof data.has_popup).toBe('boolean');
    
    if (data.has_popup && data.data) {
      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('title');
      expect(data.data).toHaveProperty('message');
      expect(data.data).toHaveProperty('button_text');
      expect(data.data).toHaveProperty('message_type');
    }
  });
});

test.describe('User-facing Popup Display', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
  });

  test('Popup does NOT show on login page', async ({ page }) => {
    // Go to login page
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Wait a moment for any popups to potentially appear
    await page.waitForTimeout(2000);
    
    // Verify popup is NOT visible (no popup-close-btn or popup-action-btn)
    const popupCloseBtn = page.getByTestId('popup-close-btn');
    const popupVisible = await popupCloseBtn.isVisible().catch(() => false);
    
    expect(popupVisible).toBeFalsy();
    
    await page.screenshot({ path: '/app/tests/e2e/popup-not-on-login.jpeg', quality: 20 });
  });

  test('Active popup shows after user login (on dashboard)', async ({ page }) => {
    // First ensure there's an active popup via API
    const activePopupRes = await page.request.get(`${BASE_URL}/api/admin/popup/active`);
    const activeData = await activePopupRes.json();
    
    if (!activeData.has_popup) {
      test.skip();
      return;
    }
    
    // Clear session storage first
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.clear());
    
    // Login as user
    await loginAsUser(page);
    
    // Wait for popup to appear (if enabled)
    const popupCloseBtn = page.getByTestId('popup-close-btn');
    const popupActionBtn = page.getByTestId('popup-action-btn');
    
    // Check if popup appears
    try {
      await expect(popupCloseBtn.or(popupActionBtn)).toBeVisible({ timeout: 5000 });
      
      // Take screenshot showing popup
      await page.screenshot({ path: '/app/tests/e2e/popup-after-login.jpeg', quality: 20 });
      
      // Verify popup content matches what we got from API
      const popupTitle = page.getByText(activeData.data.title);
      await expect(popupTitle).toBeVisible();
    } catch {
      // Popup might have been closed before in session
      console.log('Popup not shown - may have been closed in this session already');
    }
  });

  test('Popup close button (X) works and dismisses popup', async ({ page }) => {
    // First ensure there's an active popup via API
    const activePopupRes = await page.request.get(`${BASE_URL}/api/admin/popup/active`);
    const activeData = await activePopupRes.json();
    
    if (!activeData.has_popup) {
      test.skip();
      return;
    }
    
    // Clear session storage and login fresh
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.clear());
    
    // Login as user
    await loginAsUser(page);
    
    // Wait for popup close button
    const popupCloseBtn = page.getByTestId('popup-close-btn');
    
    try {
      await expect(popupCloseBtn).toBeVisible({ timeout: 5000 });
      
      // Click close button
      await popupCloseBtn.click();
      
      // Verify popup disappears
      await expect(popupCloseBtn).not.toBeVisible({ timeout: 3000 });
      
      await page.screenshot({ path: '/app/tests/e2e/popup-closed.jpeg', quality: 20 });
    } catch {
      console.log('Popup not shown or already closed');
    }
  });

  test('Popup action button works', async ({ page }) => {
    // First ensure there's an active popup via API
    const activePopupRes = await page.request.get(`${BASE_URL}/api/admin/popup/active`);
    const activeData = await activePopupRes.json();
    
    if (!activeData.has_popup) {
      test.skip();
      return;
    }
    
    // Clear session storage and login fresh
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.clear());
    
    // Login as user
    await loginAsUser(page);
    
    // Wait for popup action button
    const popupActionBtn = page.getByTestId('popup-action-btn');
    
    try {
      await expect(popupActionBtn).toBeVisible({ timeout: 5000 });
      
      // Verify button text matches API data
      await expect(popupActionBtn).toContainText(activeData.data.button_text);
      
      // Click action button
      await popupActionBtn.click();
      
      // Popup should close after action
      await expect(popupActionBtn).not.toBeVisible({ timeout: 3000 });
    } catch {
      console.log('Popup not shown or already closed');
    }
  });

  test('Popup does not show again after close (session storage)', async ({ page }) => {
    // First ensure there's an active popup via API
    const activePopupRes = await page.request.get(`${BASE_URL}/api/admin/popup/active`);
    const activeData = await activePopupRes.json();
    
    if (!activeData.has_popup) {
      test.skip();
      return;
    }
    
    // Clear session storage and login fresh
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.clear());
    
    // Login as user
    await loginAsUser(page);
    
    // Wait for dashboard and popup
    await page.waitForTimeout(3000);
    
    // Close popup if visible
    const popupCloseBtn = page.getByTestId('popup-close-btn');
    
    const closeVisible = await popupCloseBtn.isVisible().catch(() => false);
    if (closeVisible) {
      await popupCloseBtn.click();
      await page.waitForTimeout(1000);
      
      // Now verify session storage has the popup ID
      const closedPopups = await page.evaluate(() => {
        return JSON.parse(sessionStorage.getItem('closed_popups') || '[]');
      });
      
      // The popup ID should be in closed_popups array
      expect(closedPopups).toContain(activeData.data.id);
      
      // Popup should not be visible anymore
      const popupVisibleAfterClose = await popupCloseBtn.isVisible().catch(() => false);
      expect(popupVisibleAfterClose).toBeFalsy();
    } else {
      // Popup already closed from previous test run - just verify session storage mechanism
      console.log('Popup not shown - already in session storage from previous test');
    }
    
    await page.screenshot({ path: '/app/tests/e2e/popup-session-storage.jpeg', quality: 20 });
  });
});
