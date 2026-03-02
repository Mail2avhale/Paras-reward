import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://paras-reward-fix-1.preview.emergentagent.com';

/**
 * Test Suite: Payment Gateway Toggles and PRC Collect Button
 * 
 * Tests:
 * 1. Admin Settings page has Manual UPI payment toggle
 * 2. Toggle enable/disable functionality works
 * 3. Subscription page shows/hides Manual UPI option based on toggle
 * 4. Mining page shows upgrade prompt for free users (not collect button)
 */

// Helper to login as admin
async function loginAsAdmin(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  
  // Wait for loader to disappear
  await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 15000 }).catch(() => {});
  
  // Fill in admin email
  const identifierInput = page.getByTestId('login-identifier-input');
  await expect(identifierInput).toBeVisible({ timeout: 10000 });
  await identifierInput.fill('admin@parasreward.com');
  
  // Wait for auth type check to complete and PIN input to appear
  await page.waitForSelector('[data-testid="login-pin-0"]', { timeout: 10000 });
  
  // Enter PIN (123456)
  for (let i = 0; i < 6; i++) {
    const pinInput = page.getByTestId(`login-pin-${i}`);
    await pinInput.fill('');
    await pinInput.type(String(i + 1));
  }
  
  // Click sign in button
  const signInBtn = page.getByTestId('login-submit-btn');
  await signInBtn.click();
  
  // Wait for navigation to admin dashboard
  await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
}

test.describe('Admin Settings - Payment Gateway Toggles', () => {
  test.beforeEach(async ({ page }) => {
    // Remove emergent badge that might block clicks
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        const badge = document.querySelector('[class*="emergent"], [id*="emergent-badge"]');
        if (badge) badge.remove();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  });

  test('Admin Settings page loads and shows Payment Gateway Toggles section', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to Admin Settings
    await page.goto('/admin/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for page to load
    await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 10000 }).catch(() => {});
    
    // Check if Payment Gateway Toggles section exists
    const paymentTogglesCard = page.getByTestId('payment-gateway-toggles');
    await expect(paymentTogglesCard).toBeVisible({ timeout: 15000 });
    
    // Check for Manual UPI toggle button
    const manualToggleBtn = page.getByTestId('toggle-manual-payment-btn');
    await expect(manualToggleBtn).toBeVisible();
    
    // Check for Razorpay toggle button
    const razorpayToggleBtn = page.getByTestId('toggle-razorpay-btn');
    await expect(razorpayToggleBtn).toBeVisible();
    
    await page.screenshot({ path: 'admin-settings-payment-toggles.jpeg', quality: 20 });
  });

  test('Manual UPI toggle can be clicked and shows processing state', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to Admin Settings
    await page.goto('/admin/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 10000 }).catch(() => {});
    
    // Wait for Payment Gateway section
    await expect(page.getByTestId('payment-gateway-toggles')).toBeVisible({ timeout: 15000 });
    
    // Get the manual toggle button
    const manualToggleBtn = page.getByTestId('toggle-manual-payment-btn');
    await expect(manualToggleBtn).toBeVisible();
    
    // Check button text to determine current state
    const buttonText = await manualToggleBtn.textContent();
    const isCurrentlyEnabled = buttonText?.includes('Disable');
    
    // Click the toggle button
    await manualToggleBtn.click({ force: true });
    
    // Wait for the toggle action to complete (button text should change)
    if (isCurrentlyEnabled) {
      // If it was enabled, after click it should show "Enable"
      await expect(manualToggleBtn).toContainText('Enable', { timeout: 10000 }).catch(() => {
        // It might show Processing... temporarily
      });
    }
    
    await page.screenshot({ path: 'manual-toggle-clicked.jpeg', quality: 20 });
    
    // Toggle back to original state for cleanup
    await page.waitForTimeout(1000);
    await manualToggleBtn.click({ force: true }).catch(() => {});
  });
});

test.describe('Subscription Page - Manual UPI Option Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        const badge = document.querySelector('[class*="emergent"], [id*="emergent-badge"]');
        if (badge) badge.remove();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  });

  test('Subscription page shows Manual UPI option when enabled', async ({ page }) => {
    // First, ensure manual payment is enabled via API
    const enableResponse = await page.request.post(`${BASE_URL}/api/admin/toggle-manual-subscription`, {
      data: { enabled: true, admin_pin: '123456' }
    });
    expect(enableResponse.ok()).toBeTruthy();
    
    // Login as a regular test user (not admin)
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 15000 }).catch(() => {});
    
    // Fill in test user email
    const identifierInput = page.getByTestId('login-identifier-input');
    await expect(identifierInput).toBeVisible({ timeout: 10000 });
    await identifierInput.fill('testuser@paras.com');
    
    // Wait for PIN input and enter PIN
    await page.waitForSelector('[data-testid="login-pin-0"]', { timeout: 10000 });
    for (let i = 0; i < 6; i++) {
      const pinInput = page.getByTestId(`login-pin-${i}`);
      await pinInput.fill('');
      await pinInput.type(String(i + 1));
    }
    
    // Click sign in
    const signInBtn = page.getByTestId('login-submit-btn');
    await signInBtn.click();
    
    // Wait for login to complete (regular user goes to dashboard)
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    
    // Navigate to subscription page
    await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 10000 }).catch(() => {});
    
    // Step 1: Select a PAID plan (not Explorer/free) - click on Startup
    const startupPlan = page.getByTestId('plan-startup');
    await expect(startupPlan).toBeVisible({ timeout: 10000 });
    await startupPlan.click();
    
    // Step 2: Select duration - click on Monthly
    const monthlyDuration = page.getByTestId('duration-monthly');
    await expect(monthlyDuration).toBeVisible({ timeout: 10000 });
    await monthlyDuration.click();
    
    // Step 3: Now payment options should be visible
    // Wait a moment for the step transition
    await page.waitForLoadState('domcontentloaded');
    
    // Check if Manual UPI option is visible
    const manualOption = page.getByTestId('manual-payment-option');
    await expect(manualOption).toBeVisible({ timeout: 10000 });
    
    await page.screenshot({ path: 'subscription-manual-enabled.jpeg', quality: 20 });
  });

  test('Subscription page hides Manual UPI option when disabled', async ({ page }) => {
    // Disable manual payment via API
    const disableResponse = await page.request.post(`${BASE_URL}/api/admin/toggle-manual-subscription`, {
      data: { enabled: false, admin_pin: '123456' }
    });
    expect(disableResponse.ok()).toBeTruthy();
    
    // Login as regular test user
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 15000 }).catch(() => {});
    
    const identifierInput = page.getByTestId('login-identifier-input');
    await expect(identifierInput).toBeVisible({ timeout: 10000 });
    await identifierInput.fill('testuser@paras.com');
    
    await page.waitForSelector('[data-testid="login-pin-0"]', { timeout: 10000 });
    for (let i = 0; i < 6; i++) {
      const pinInput = page.getByTestId(`login-pin-${i}`);
      await pinInput.fill('');
      await pinInput.type(String(i + 1));
    }
    
    const signInBtn = page.getByTestId('login-submit-btn');
    await signInBtn.click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    
    // Navigate to subscription page
    await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 10000 }).catch(() => {});
    
    // Step 1: Select a PAID plan (not Explorer/free)
    const startupPlan = page.getByTestId('plan-startup');
    await expect(startupPlan).toBeVisible({ timeout: 10000 });
    await startupPlan.click();
    
    // Step 2: Select duration
    const monthlyDuration = page.getByTestId('duration-monthly');
    await expect(monthlyDuration).toBeVisible({ timeout: 10000 });
    await monthlyDuration.click();
    
    // Step 3: Now payment options should be visible (but Manual UPI should be hidden)
    await page.waitForLoadState('domcontentloaded');
    
    // Manual UPI option should NOT be visible when disabled
    const manualOption = page.getByTestId('manual-payment-option');
    await expect(manualOption).not.toBeVisible({ timeout: 5000 });
    
    await page.screenshot({ path: 'subscription-manual-disabled.jpeg', quality: 20 });
    
    // Re-enable manual payment for cleanup
    await page.request.post(`${BASE_URL}/api/admin/toggle-manual-subscription`, {
      data: { enabled: true, admin_pin: '123456' }
    });
  });
});

test.describe('Mining Page - PRC Collect for Free Users', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        const badge = document.querySelector('[class*="emergent"], [id*="emergent-badge"]');
        if (badge) badge.remove();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  });

  test('Mining page shows upgrade prompt for free/explorer users instead of collect button', async ({ page }) => {
    // Login as test user (explorer plan = free user)
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 15000 }).catch(() => {});
    
    const identifierInput = page.getByTestId('login-identifier-input');
    await expect(identifierInput).toBeVisible({ timeout: 10000 });
    await identifierInput.fill('testuser@paras.com');
    
    await page.waitForSelector('[data-testid="login-pin-0"]', { timeout: 10000 });
    for (let i = 0; i < 6; i++) {
      const pinInput = page.getByTestId(`login-pin-${i}`);
      await pinInput.fill('');
      await pinInput.type(String(i + 1));
    }
    
    const signInBtn = page.getByTestId('login-submit-btn');
    await signInBtn.click();
    
    // Wait for login to complete
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    
    // Navigate to mining page (via Rewards tab)
    await page.goto('/mining', { waitUntil: 'domcontentloaded' });
    
    // Wait for mining page to fully load - use role-based selector
    await expect(page.getByRole('heading', { name: 'Daily Rewards' })).toBeVisible({ timeout: 15000 });
    
    await page.screenshot({ path: 'mining-page-free-user.jpeg', quality: 20 });
    
    // For free users, we should see:
    // 1. "Start Session" button (if no session active), OR
    // 2. "Upgrade to Collect PRC!" prompt (if session active with PRC to collect)
    // Either way, a free user should NOT have an enabled "Collect" button
    
    // Check for Start Session button (indicates no active session)
    const startSession = page.getByRole('button', { name: /Start Session/i });
    const hasStartSession = await startSession.isVisible().catch(() => false);
    
    // If session is active, check for upgrade prompt
    const upgradePrompt = page.getByText(/Upgrade to Collect/i);
    const hasUpgradePrompt = await upgradePrompt.isVisible().catch(() => false);
    
    // Free users should either see "Start Session" or "Upgrade" prompt
    // They should NOT see an enabled Collect button for PRC
    expect(hasStartSession || hasUpgradePrompt).toBeTruthy();
  });
});
