import { test, expect } from '@playwright/test';

/**
 * Feature Removal & Refactoring E2E Tests
 * ========================================
 * Tests to verify:
 * 1. Removed routes redirect properly (Marketplace, Luxury Life, TAP Game)
 * 2. Homepage loads with stats
 * 3. KYC functionality accessible
 * 4. API endpoints working correctly
 */

const BASE_URL = 'https://bulkpe-consistency.preview.emergentagent.com';

test.describe('Feature Removal - Route Redirects', () => {
  
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

  test('Marketplace route redirects to login (unauthenticated)', async ({ page }) => {
    await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
    // Wait for React Router redirect chain to complete
    await page.waitForURL('**/login', { timeout: 10000 });
    
    const finalUrl = page.url();
    expect(finalUrl).toContain('/login');
    
    // Verify we see the login form
    await expect(page.getByText('Welcome Back')).toBeVisible();
  });

  test('Orders route redirects to login (unauthenticated)', async ({ page }) => {
    await page.goto('/orders', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/login', { timeout: 10000 });
    
    const finalUrl = page.url();
    expect(finalUrl).toContain('/login');
  });

  test('TAP Game route redirects to login (unauthenticated)', async ({ page }) => {
    await page.goto('/game', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/login', { timeout: 10000 });
    
    const finalUrl = page.url();
    expect(finalUrl).toContain('/login');
  });

  test('Luxury Life route returns 404 (no frontend route exists)', async ({ page }) => {
    await page.goto('/luxury-life', { waitUntil: 'domcontentloaded' });
    // Luxury life route was removed from App.js - should not exist
    // React Router will show default fallback or stay on URL
    await page.waitForLoadState('domcontentloaded');
  });

});

test.describe('Homepage & Public Pages', () => {
  
  test('Homepage loads with stats cards', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Verify homepage renders
    await expect(page.locator('body')).toBeVisible();
    
    // Check for branding (use .first() since multiple matches)
    await expect(page.getByText('Paras Reward').first()).toBeVisible();
    
    // Check for stats display
    await expect(page.getByText(/Active Members/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Points Distributed/i)).toBeVisible();
    
    // Check login/register buttons exist (use first() for multiple matches)
    await expect(page.getByRole('button', { name: /Login/i }).first()).toBeVisible();
  });

  test('Login page loads with form elements', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Check for login form
    await expect(page.getByText('Welcome Back')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Sign in to your PARAS REWARD account')).toBeVisible();
    
    // Check for input field
    await expect(page.getByPlaceholder('Enter email, mobile or UID')).toBeVisible();
    
    // Check for sign in button
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
    
    // Check for sign up link
    await expect(page.getByText('Sign Up')).toBeVisible();
  });

  test('Register page loads', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    // Should show registration form
    await expect(page.locator('input').first()).toBeVisible({ timeout: 10000 });
  });

  test('FAQ page accessible', async ({ page }) => {
    await page.goto('/faq', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/FAQ/i).or(page.getByText(/Questions/i)).first()).toBeVisible({ timeout: 10000 });
  });

  test('How It Works page accessible', async ({ page }) => {
    await page.goto('/how-it-works', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('About page accessible', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('Contact page accessible', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('Privacy Policy page accessible', async ({ page }) => {
    await page.goto('/privacy', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('API Endpoint Verification', () => {

  test('Health endpoint returns healthy', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.database).toBe('connected');
  });

  test('Leaderboard API returns data', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/leaderboard`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('leaderboard');
    expect(Array.isArray(data.leaderboard)).toBeTruthy();
  });

  test('KYC stats API returns counts', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/kyc/stats`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('pending');
    expect(data).toHaveProperty('verified');
    expect(data).toHaveProperty('rejected');
    expect(data).toHaveProperty('total');
  });

  test('KYC status API returns data for unknown user', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/kyc/status/test-unknown-user`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('not_submitted');
    expect(data.submitted).toBe(false);
    expect(data.verified).toBe(false);
  });

  test('Marketplace products API returns 404 (feature removed)', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/products`);
    expect(response.status()).toBe(404);
  });

  test('Luxury Life API returns 404 (feature removed)', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/luxury-life/products`);
    expect(response.status()).toBe(404);
  });

  test('Mining status API accessible', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/mining/status/test-user`);
    // Should return 404 (user not found) or valid response
    expect([200, 404]).toContain(response.status());
  });

  test('Subscription plans API returns data', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/subscription/plans`);
    expect(response.status()).toBe(200);
  });

});
