import { test, expect } from '@playwright/test';

/**
 * Paras Reward App - Session Persistence & Login Tests
 * Tests for: login, navigation, session persistence, page refresh
 * Production URL: https://www.parasreward.com
 */
test.describe('Paras Reward App - Session Persistence', () => {
  const credentials = {
    email: 'mail2avhale@gmail.com',
    pin: '153759',
    userName: 'SANTOSH SHAMRAO AVHALE',
    balance: '208543'
  };

  // Helper to login with proper waits
  async function loginUser(page) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Enter email
    const emailInput = page.getByTestId('login-identifier-input');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(credentials.email);
    
    // Wait for PIN input to appear (auth type check completes)
    // This appears after the 500ms debounce + API call
    await expect(page.getByTestId('login-pin-0')).toBeVisible({ timeout: 25000 });
    
    // Enter PIN digits
    for (let i = 0; i < 6; i++) {
      const pinInput = page.getByTestId(`login-pin-${i}`);
      await pinInput.fill(credentials.pin[i]);
    }
    
    // Wait for redirect to dashboard (auto-submit after 6 digits)
    await expect(page).toHaveURL(/dashboard/, { timeout: 60000 });
  }

  // Helper to dismiss popup
  async function dismissPopup(page) {
    const popup = page.locator('button:has-text("सहयोग है")');
    if (await popup.isVisible({ timeout: 3000 }).catch(() => false)) {
      await popup.click();
    }
  }

  test('Login flow - user should be able to login and reach dashboard', async ({ page }) => {
    await loginUser(page);
    
    // Wait for dashboard content to appear
    await dismissPopup(page);
    
    // Verify user data is loaded (name or balance visible) - use .first() to avoid strict mode
    const userIndicator = page.locator(`text=${credentials.userName}`).first();
    await expect(userIndicator).toBeVisible({ timeout: 20000 });
  });

  test('Session persistence - navigating to Mining page should NOT logout user', async ({ page }) => {
    await loginUser(page);
    await dismissPopup(page);
    
    // Navigate to Mining/Daily Rewards page
    await page.goto('/daily-rewards', { waitUntil: 'domcontentloaded' });
    
    // Verify we're on mining page (NOT redirected to login)
    await expect(page).toHaveURL(/daily-rewards/);
    
    // Verify mining page content is visible (balance or start session button)
    const miningContent = page.locator('text=Current Balance').or(page.locator('text=Start Session'));
    await expect(miningContent.first()).toBeVisible({ timeout: 20000 });
    
    // Verify user balance is shown (proves user is still logged in)
    await expect(page.locator(`text=${credentials.balance}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('Session persistence - navigating to Profile page should NOT logout user', async ({ page }) => {
    await loginUser(page);
    await dismissPopup(page);
    
    // Navigate to Profile page
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    
    // Verify we're NOT redirected to login
    await expect(page).not.toHaveURL(/login/);
    
    // Verify profile content is visible (profile text or user name)
    const profileContent = page.locator('text=Profile').or(page.locator(`text=${credentials.userName}`));
    await expect(profileContent.first()).toBeVisible({ timeout: 20000 });
  });

  test('Navigation between pages should maintain session', async ({ page }) => {
    await loginUser(page);
    await dismissPopup(page);
    
    // Navigate to Mining
    await page.goto('/daily-rewards', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/daily-rewards/);
    await expect(page.locator(`text=${credentials.balance}`).first()).toBeVisible({ timeout: 15000 });
    
    // Navigate back to Dashboard
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/dashboard/);
    
    // Verify user is still logged in
    await dismissPopup(page);
    await expect(page.locator(`text=${credentials.balance}`).first()).toBeVisible({ timeout: 15000 });
    
    // Navigate to Referrals
    await page.goto('/referrals', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/login/);
  });
});
