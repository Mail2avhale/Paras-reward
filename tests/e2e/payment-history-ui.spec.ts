import { test, expect } from '@playwright/test';
import { dismissToasts } from '../fixtures/helpers';

/**
 * UI Tests for Payment History Features
 * Iteration 105: User subscription page improvements - UI tests
 */

// Helper to login with test user
async function loginTestUser(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  
  // Enter email
  const emailInput = page.locator('input[placeholder*="Enter email"]').first();
  await emailInput.fill('mail2avhale@gmail.com');
  
  // Click Sign In to show PIN field
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForSelector('input[type="tel"]', { timeout: 5000 });
  
  // Enter PIN 153759
  const pinInputs = page.locator('input[type="tel"]');
  const pin = '153759';
  for (let i = 0; i < 6; i++) {
    await pinInputs.nth(i).fill(pin[i]);
  }
  
  // Click Sign In button
  await page.getByRole('button', { name: /sign in/i }).click();
  
  // Wait for redirect to dashboard
  await page.waitForURL(/dashboard|home/i, { timeout: 15000 });
  
  // Close popup if present
  await page.click('.lucide-x', { force: true }).catch(() => {});
}

test.describe('Subscription Page - Payment History UI', () => {
  
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
    await loginTestUser(page);
  });

  test('subscription page loads with payment history section', async ({ page }) => {
    await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
    
    // Wait for page to load
    await expect(page.getByText(/subscription plans/i)).toBeVisible({ timeout: 10000 });
    
    // Should show current plan banner
    await expect(page.getByText(/current plan/i)).toBeVisible({ timeout: 5000 });
    
    // Payment history toggle should be visible
    await expect(page.getByTestId('payment-history-toggle')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: '.screenshots/subscription-with-payment-history.jpeg', quality: 20 });
  });

  test('payment history expands and shows status message', async ({ page }) => {
    await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/subscription plans/i)).toBeVisible({ timeout: 10000 });
    
    // Click to expand payment history
    await page.getByTestId('payment-history-toggle').click();
    
    // Payment attempts list should appear
    await expect(page.getByTestId('payment-attempts-list')).toBeVisible({ timeout: 5000 });
    
    // Status message should be visible
    const statusMessage = page.getByTestId('payment-status-message').first();
    await expect(statusMessage).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: '.screenshots/payment-history-expanded-status.jpeg', quality: 20 });
  });

  test('plan selection flow works correctly', async ({ page }) => {
    await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/subscription plans/i)).toBeVisible({ timeout: 10000 });
    
    // Scroll down to see plan cards
    await page.evaluate(() => window.scrollTo(0, 500));
    
    // Click on Startup plan
    await page.getByTestId('plan-startup').click();
    
    // Should show duration selection step
    await expect(page.getByText(/select duration/i)).toBeVisible({ timeout: 5000 });
    
    // Duration option should be visible
    await expect(page.getByTestId('duration-monthly')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: '.screenshots/plan-selection-flow.jpeg', quality: 20 });
  });
});
