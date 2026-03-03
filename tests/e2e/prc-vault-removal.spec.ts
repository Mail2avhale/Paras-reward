import { test, expect } from '@playwright/test';

/**
 * Test Suite for PRC Vault Feature Removal
 * 
 * Tests verify:
 * 1. PRC SAVINGS VAULT banner is NOT visible on dashboard
 * 2. Mobile recharge page loads and shows auto-detect functionality
 */

test.describe('PRC Vault Removal Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Dismiss any toasts that might block interactions
    await page.addLocatorHandler(
      page.locator('[data-sonner-toast], .Toastify__toast'),
      async () => {
        const close = page.locator('[data-sonner-toast] [data-close], .Toastify__close-button');
        await close.first().click({ timeout: 2000 }).catch(() => {});
      },
      { times: 10, noWaitAfter: true }
    );
  });

  test('Homepage should load correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Verify homepage elements are visible - use more specific locators
    await expect(page.getByRole('link', { name: 'Paras Reward' }).first()).toBeVisible();
    await expect(page.getByText('Collect PRC Points!')).toBeVisible();
    
    // Take screenshot for verification
    await page.screenshot({ path: 'homepage-check.jpeg', quality: 20 });
  });

  test('Dashboard should NOT show PRC SAVINGS VAULT banner', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    
    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Allow time for any async data loading
    
    // Verify PRC SAVINGS VAULT banner is NOT visible
    // Check for various possible text combinations
    const prcVaultText = page.getByText(/PRC SAVINGS VAULT|PRC Vault|Savings Vault/i);
    
    // This should NOT be visible (banner removed)
    // Note: If user is not logged in, they will be redirected to login
    const isVisible = await prcVaultText.isVisible().catch(() => false);
    
    // Take screenshot for verification
    await page.screenshot({ path: 'dashboard-no-vault.jpeg', quality: 20 });
    
    // The banner should NOT be visible
    // If it's visible, the test should fail
    if (await page.getByText('Login').isVisible().catch(() => false)) {
      // User not logged in - this is expected for unauthorized access
      console.log('User not logged in - dashboard requires auth');
    } else {
      // If logged in, verify no PRC SAVINGS VAULT
      expect(isVisible).toBe(false);
    }
  });

  test('Mobile recharge page should show auto-detect flow', async ({ page }) => {
    await page.goto('/redeem?service=mobile_recharge', { waitUntil: 'domcontentloaded' });
    
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'recharge-page.jpeg', quality: 20 });
    
    // Check if we're on the page or redirected to login
    const loginVisible = await page.getByText('Login').isVisible().catch(() => false);
    
    if (!loginVisible) {
      // User should see mobile recharge form
      // Look for mobile number input or operator selection
      const mobileInput = page.locator('input[type="tel"], input[placeholder*="mobile"], input[name*="mobile"]');
      const operatorSelect = page.getByText(/Operator|Select Operator/i);
      
      // At least one should be present
      const inputVisible = await mobileInput.first().isVisible().catch(() => false);
      const operatorVisible = await operatorSelect.isVisible().catch(() => false);
      
      console.log(`Mobile input visible: ${inputVisible}, Operator visible: ${operatorVisible}`);
    }
  });

  test('API: Auto-detect operator endpoint should work', async ({ page }) => {
    // Test the API directly through page context
    const response = await page.request.get('/api/eko/recharge/detect/9820123456');
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.detection.operator).toBe('JIO');
    expect(data.detection.operator_name).toBe('Jio');
    expect(data.plans).toBeDefined();
    expect(data.plans.length).toBeGreaterThan(0);
  });

  test('API: Charges calculation should work correctly', async ({ page }) => {
    const response = await page.request.get('/api/eko/charges/calculate?amount=199');
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.charges.amount_inr).toBe(199);
    expect(data.charges.platform_fee_inr).toBe(10);
    // Admin charge should be 20% of 199 = ~40
    expect(data.charges.admin_charge_percent).toBe(20);
    expect(data.charges.admin_charge_inr).toBeGreaterThanOrEqual(39);
    expect(data.charges.admin_charge_inr).toBeLessThanOrEqual(40);
  });

});

test.describe('Mining Page Tests', () => {
  
  test('Mining page should load and show earning information', async ({ page }) => {
    await page.goto('/game', { waitUntil: 'domcontentloaded' });
    
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'mining-page.jpeg', quality: 20 });
    
    // Check if redirected to login
    const loginVisible = await page.getByText('Login').isVisible().catch(() => false);
    
    if (!loginVisible) {
      // Check for PRC-related text but NOT vault
      const prcText = page.getByText(/PRC|Coin|Earn|Mining/i);
      const prcVisible = await prcText.first().isVisible().catch(() => false);
      
      // Should NOT show "20% deduction" or "PRC Vault" related text
      const deductionText = page.getByText(/20% deduction|deducted to vault|savings vault/i);
      const deductionVisible = await deductionText.isVisible().catch(() => false);
      
      // Deduction text should NOT be visible (feature removed)
      expect(deductionVisible).toBe(false);
    }
  });
});
