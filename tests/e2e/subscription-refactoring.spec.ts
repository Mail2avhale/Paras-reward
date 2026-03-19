import { test, expect } from '@playwright/test';

/**
 * Subscription Refactoring E2E Tests
 * Tests the VIP/Membership to Explorer/Elite transition
 * 
 * Features tested:
 * - User login with legacy growth plan
 * - HowItWorks page shows "Elite" instead of "VIP"
 * - Dashboard loads correctly for paid users
 */

const USER_MOBILE = '9970100782';
const USER_PIN = '997010';

test.describe('Subscription Refactoring Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Dismiss any toasts that might appear
    await page.addLocatorHandler(
      page.locator('[data-sonner-toast], .Toastify__toast'),
      async () => {
        const close = page.locator('[data-sonner-toast] [data-close], .Toastify__close-button').first();
        await close.click({ timeout: 2000 }).catch(() => {});
      },
      { times: 10, noWaitAfter: true }
    );
  });

  test('Homepage loads correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Check that homepage loads
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'homepage.jpeg', quality: 20, fullPage: false });
  });

  test('How It Works page shows Elite terminology', async ({ page }) => {
    await page.goto('/how-it-works', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Should show "Elite" in the benefits section
    const eliteText = page.getByText(/Elite/i).first();
    await expect(eliteText).toBeVisible();
    
    // Scroll to see the Elite benefits section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    // Verify "Unlock Elite Benefits" is shown (not VIP)
    const eliteBenefitsHeader = page.getByText(/Unlock Elite Benefits/i).or(page.getByText(/Upgrade to Elite/i));
    await expect(eliteBenefitsHeader.first()).toBeVisible();
    
    await page.screenshot({ path: 'how-it-works-elite.jpeg', quality: 20, fullPage: false });
  });

  test('Login page displays correctly', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Check login form is visible
    const identifierInput = page.getByTestId('login-identifier-input').or(page.getByPlaceholder(/email|mobile|uid/i)).first();
    await expect(identifierInput).toBeVisible();
    
    // Check Sign In button
    const signInBtn = page.getByTestId('login-submit-btn').or(page.getByRole('button', { name: /sign in/i })).first();
    await expect(signInBtn).toBeVisible();
    
    await page.screenshot({ path: 'login-page.jpeg', quality: 20, fullPage: false });
  });

  test('User with legacy growth plan can login successfully', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Enter mobile number
    const identifierInput = page.getByTestId('login-identifier-input').or(page.getByPlaceholder(/email|mobile|uid/i)).first();
    await identifierInput.fill(USER_MOBILE);
    
    // Click Sign In button
    const signInBtn = page.getByTestId('login-submit-btn').or(page.getByRole('button', { name: /sign in/i })).first();
    await signInBtn.click();
    
    // Wait for PIN entry screen
    await page.waitForTimeout(2000);
    
    // Enter PIN
    const pinInputs = page.locator('input[type="password"], input[inputmode="numeric"]');
    const count = await pinInputs.count();
    
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await pinInputs.nth(i).fill(USER_PIN[i]);
      }
    } else {
      await pinInputs.first().fill(USER_PIN);
    }
    
    // Submit PIN
    const loginBtn = page.getByRole('button', { name: /login|sign in|verify|submit/i }).first();
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
    }
    
    // Wait for navigation to dashboard
    await page.waitForURL(/dashboard|home/i, { timeout: 20000 });
    
    // Verify dashboard loaded
    await expect(page).toHaveURL(/dashboard|home/i);
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'dashboard-after-login.jpeg', quality: 20, fullPage: false });
  });

  test('Dashboard shows user balance after login', async ({ page }) => {
    // Login first
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const identifierInput = page.getByTestId('login-identifier-input').or(page.getByPlaceholder(/email|mobile|uid/i)).first();
    await identifierInput.fill(USER_MOBILE);
    
    const signInBtn = page.getByTestId('login-submit-btn').or(page.getByRole('button', { name: /sign in/i })).first();
    await signInBtn.click();
    
    await page.waitForTimeout(2000);
    
    const pinInputs = page.locator('input[type="password"], input[inputmode="numeric"]');
    const count = await pinInputs.count();
    
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await pinInputs.nth(i).fill(USER_PIN[i]);
      }
    } else {
      await pinInputs.first().fill(USER_PIN);
    }
    
    const loginBtn = page.getByRole('button', { name: /login|sign in|verify|submit/i }).first();
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
    }
    
    await page.waitForURL(/dashboard|home/i, { timeout: 20000 });
    await page.waitForTimeout(3000);
    
    // Check that PRC balance is displayed (growth user should have their balance preserved)
    // Look for PRC text or balance indicator
    const prcText = page.getByText(/PRC|Balance|Points/i).first();
    await expect(prcText).toBeVisible();
    
    await page.screenshot({ path: 'dashboard-with-balance.jpeg', quality: 20, fullPage: false });
  });

  test('Profile page accessible after login', async ({ page }) => {
    // Login first
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const identifierInput = page.getByTestId('login-identifier-input').or(page.getByPlaceholder(/email|mobile|uid/i)).first();
    await identifierInput.fill(USER_MOBILE);
    
    const signInBtn = page.getByTestId('login-submit-btn').or(page.getByRole('button', { name: /sign in/i })).first();
    await signInBtn.click();
    
    await page.waitForTimeout(2000);
    
    const pinInputs = page.locator('input[type="password"], input[inputmode="numeric"]');
    const count = await pinInputs.count();
    
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await pinInputs.nth(i).fill(USER_PIN[i]);
      }
    } else {
      await pinInputs.first().fill(USER_PIN);
    }
    
    const loginBtn = page.getByRole('button', { name: /login|sign in|verify|submit/i }).first();
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
    }
    
    await page.waitForURL(/dashboard|home/i, { timeout: 20000 });
    await page.waitForTimeout(2000);
    
    // Navigate to profile using bottom navigation tab (more reliable)
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Verify profile page loaded
    await expect(page).toHaveURL(/profile/i);
    
    await page.screenshot({ path: 'profile-page.jpeg', quality: 20, fullPage: false });
  });
});
