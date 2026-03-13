import { test, expect, Page } from '@playwright/test';

/**
 * Test: Subscription Plan Flickering Fix
 * Bug: Subscription is ELITE but sometimes shows EXPLORER during page load
 * 
 * Root Cause: Initial state had subscriptionPlan: 'explorer' as default,
 * causing ELITE users to briefly see EXPLORER badge until API data loaded.
 * 
 * Fix: Initialize state from user prop instead of hardcoded 'explorer'
 */

const BASE_URL = process.env.BASE_URL || 'https://fintech-refactor-3.preview.emergentagent.com';

// Test user with ELITE subscription
const TEST_USER_EMAIL = 'elite_test@test.com';
const TEST_USER_PIN = '123456';
const EXPECTED_SUBSCRIPTION = 'elite';

/**
 * Helper function to login with the test user
 * Login is a two-step process:
 * 1. Enter identifier (email/mobile/UID)
 * 2. Wait for PIN input to appear
 * 3. Enter PIN
 * 4. Click Sign In
 */
async function loginWithTestUser(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  
  // Step 1: Enter identifier
  const identifierInput = page.getByTestId('login-identifier-input');
  await expect(identifierInput).toBeVisible({ timeout: 10000 });
  await identifierInput.fill(TEST_USER_EMAIL);
  
  // Click Sign In to trigger identifier check (it shows PIN input after validation)
  const submitBtn = page.getByTestId('login-submit-btn');
  await submitBtn.click();
  
  // Step 2: Wait for PIN input to appear
  // The PIN input appears after identifier is validated
  const pinInput = page.locator('input[data-testid*="login-pin"]').first();
  await expect(pinInput).toBeVisible({ timeout: 10000 });
  
  // Enter PIN digits (PinInput component is 6 separate inputs)
  const pinDigits = TEST_USER_PIN.split('');
  for (let i = 0; i < pinDigits.length; i++) {
    const digitInput = page.locator(`input[data-testid="login-pin-${i}"]`);
    await digitInput.fill(pinDigits[i]);
  }
  
  // Step 3: Submit login
  await submitBtn.click();
  
  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

test.describe('Subscription Flickering Fix', () => {
  
  test.beforeEach(async ({ page }) => {
    // Remove Emergent preview badge if present
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        const badge = document.querySelector('[class*="emergent"], [id*="emergent-badge"]');
        if (badge) badge.remove();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  });
  
  test('should login and verify ELITE user credentials work', async ({ page }) => {
    await loginWithTestUser(page);
    
    // Should be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    await page.screenshot({ path: 'subscription-flickering-login-success.jpeg', quality: 20 });
  });
  
  test('Dashboard should show ELITE subscription badge immediately without flickering', async ({ page }) => {
    await loginWithTestUser(page);
    
    // CRITICAL TEST: Check subscription badge text immediately
    // The badge should show ELITE, not EXPLORER
    
    // Wait brief moment for initial render
    await page.waitForTimeout(300);
    
    // Take screenshot to capture initial state
    await page.screenshot({ path: 'subscription-badge-initial-state.jpeg', quality: 20 });
    
    // Check for Elite badge - should be visible from start for ELITE user
    const eliteBadge = page.locator('text=Elite').first();
    await expect(eliteBadge).toBeVisible({ timeout: 5000 });
    
    // EXPLORER should NOT be visible for an ELITE user
    const explorerBadge = page.locator('text=Explorer');
    const explorerCount = await explorerBadge.count();
    expect(explorerCount).toBe(0);
  });
  
  test('Dashboard subscription card should display correct plan styling from start', async ({ page }) => {
    await loginWithTestUser(page);
    
    // Wait for page to render
    await page.waitForTimeout(500);
    
    // Check for gold/amber color scheme (ELITE styling)
    // ELITE uses amber-500/amber-400 colors
    const eliteGoldElements = page.locator('[class*="amber-500"], [class*="amber-400"], .text-amber-400, .bg-amber-500');
    const eliteCount = await eliteGoldElements.count();
    
    // Should have multiple amber-styled elements for ELITE plan
    expect(eliteCount).toBeGreaterThan(0);
    
    await page.screenshot({ path: 'subscription-card-elite-styling.jpeg', quality: 20 });
  });
  
  test('Daily Rewards page should show correct subscription plan from user prop', async ({ page }) => {
    await loginWithTestUser(page);
    
    // Navigate to Daily Rewards (Mining) page
    await page.goto('/daily-rewards', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'daily-rewards-initial-state.jpeg', quality: 20 });
    
    // Check for ELITE user features:
    // 1. Should NOT show "Upgrade to Collect PRC!" message (that's for free users)
    // 2. Should show 3x BONUS badge for ELITE plan
    
    const upgradePrompt = page.locator('text=Upgrade to Collect PRC');
    const upgradeCount = await upgradePrompt.count();
    
    // ELITE user should NOT see the upgrade prompt
    expect(upgradeCount).toBe(0);
    
    // Should see 3x BONUS badge for ELITE
    const bonusBadge = page.locator('text=3x BONUS');
    await expect(bonusBadge).toBeVisible({ timeout: 5000 });
  });
  
  test('Mining page subscription plan should not flicker from EXPLORER to ELITE', async ({ page }) => {
    // This test specifically checks for the flickering issue
    // We'll capture screenshots at different times to verify no flicker
    
    await loginWithTestUser(page);
    
    // Setup to track if EXPLORER text ever appears
    let explorerEverShown = false;
    
    // Navigate to Mining page and check immediately
    await page.goto('/daily-rewards', { waitUntil: 'domcontentloaded' });
    
    // Check at 200ms - very early in page load
    await page.waitForTimeout(200);
    const explorerAt200ms = await page.locator('text=Explorer').count();
    if (explorerAt200ms > 0) explorerEverShown = true;
    await page.screenshot({ path: 'mining-200ms.jpeg', quality: 20 });
    
    // Check at 500ms
    await page.waitForTimeout(300);
    const explorerAt500ms = await page.locator('text=Explorer').count();
    if (explorerAt500ms > 0) explorerEverShown = true;
    await page.screenshot({ path: 'mining-500ms.jpeg', quality: 20 });
    
    // Check at 1000ms
    await page.waitForTimeout(500);
    const explorerAt1000ms = await page.locator('text=Explorer').count();
    if (explorerAt1000ms > 0) explorerEverShown = true;
    await page.screenshot({ path: 'mining-1000ms.jpeg', quality: 20 });
    
    // Wait for full page load
    await page.waitForTimeout(1500);
    
    // Final check - should definitely show ELITE/3x BONUS
    const bonusBadge = page.locator('text=3x BONUS');
    await expect(bonusBadge).toBeVisible({ timeout: 5000 });
    
    await page.screenshot({ path: 'mining-final-state.jpeg', quality: 20 });
    
    // CRITICAL ASSERTION: Explorer should NEVER have been shown for ELITE user
    expect(explorerEverShown).toBe(false);
  });
  
  test('User localStorage should contain subscription_plan after login', async ({ page }) => {
    // This test verifies that the user prop contains subscription info
    // which is the key fix for preventing flickering
    
    await loginWithTestUser(page);
    
    // Check localStorage for user data
    const storedUser = await page.evaluate(() => {
      const user = localStorage.getItem('paras_user');
      return user ? JSON.parse(user) : null;
    });
    
    // User should exist in localStorage
    expect(storedUser).not.toBeNull();
    
    // User should have subscription_plan field
    expect(storedUser.subscription_plan).toBeDefined();
    
    // For this test user, subscription should be 'elite'
    expect(storedUser.subscription_plan.toLowerCase()).toBe(EXPECTED_SUBSCRIPTION);
    
    console.log('Stored user subscription_plan:', storedUser.subscription_plan);
  });
  
});
