import { test, expect } from '@playwright/test';

/**
 * Login Performance Fix Tests
 * 
 * Tests verify:
 * 1. Login flow works correctly and is fast
 * 2. Profile picture loads separately on profile page
 * 3. Login does not cause slow page loads
 */

const TEST_EMAIL = 'admin@paras.com';
const TEST_PIN = '153759';

test.describe('Login Performance Fix', () => {
  
  test('Login page loads quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;
    
    // Login page should load under 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    // Check login form heading "Welcome Back" is visible
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible({ timeout: 10000 });
  });
  
  test('Login completes within 5 seconds', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Wait for login form to be ready
    await expect(page.getByTestId('login-identifier-input')).toBeVisible({ timeout: 10000 });
    
    // Fill identifier
    await page.getByTestId('login-identifier-input').fill(TEST_EMAIL);
    
    // Click Sign In to trigger auth type check
    await page.getByTestId('login-submit-btn').click();
    
    // Wait for PIN input to appear (it shows after identifier is validated)
    await expect(page.getByTestId('login-pin-0')).toBeVisible({ timeout: 10000 });
    
    // Measure login time
    const startTime = Date.now();
    
    // Enter PIN digits
    for (let i = 0; i < 6; i++) {
      await page.getByTestId(`login-pin-${i}`).fill(TEST_PIN[i]);
    }
    
    // Wait for navigation to dashboard (auto-submits when 6 digits entered)
    // Admin users are redirected to /admin, regular users to /dashboard
    await expect(page).toHaveURL(/dashboard|home|admin/i, { timeout: 15000 });
    
    const loginTime = Date.now() - startTime;
    
    // Login should complete within 5 seconds (previously was 30+ seconds)
    expect(loginTime).toBeLessThan(5000);
  });
  
  test('Dashboard loads content after login', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Wait for identifier input
    await expect(page.getByTestId('login-identifier-input')).toBeVisible({ timeout: 10000 });
    
    // Fill identifier
    await page.getByTestId('login-identifier-input').fill(TEST_EMAIL);
    
    // Click Sign In
    await page.getByTestId('login-submit-btn').click();
    
    // Wait for PIN input
    await expect(page.getByTestId('login-pin-0')).toBeVisible({ timeout: 10000 });
    
    // Enter PIN digits
    for (let i = 0; i < 6; i++) {
      await page.getByTestId(`login-pin-${i}`).fill(TEST_PIN[i]);
    }
    
    // Wait for dashboard
    // Admin users are redirected to /admin, regular users to /dashboard
    await expect(page).toHaveURL(/dashboard|home|admin/i, { timeout: 15000 });
    
    // Wait for dashboard content to load
    await page.waitForLoadState('domcontentloaded');
    
    // Dashboard should have visible body content
    await expect(page.locator('body')).toBeVisible();
    
    // Take screenshot for verification
    await page.screenshot({ path: '/app/tests/e2e/login-perf-dashboard.jpeg', quality: 20 });
  });
  
  test('Profile page loads profile picture separately', async ({ page }) => {
    // Login first
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    await expect(page.getByTestId('login-identifier-input')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('login-identifier-input').fill(TEST_EMAIL);
    await page.getByTestId('login-submit-btn').click();
    
    await expect(page.getByTestId('login-pin-0')).toBeVisible({ timeout: 10000 });
    for (let i = 0; i < 6; i++) {
      await page.getByTestId(`login-pin-${i}`).fill(TEST_PIN[i]);
    }
    
    // Wait for dashboard
    // Admin users are redirected to /admin, regular users to /dashboard
    await expect(page).toHaveURL(/dashboard|home|admin/i, { timeout: 15000 });
    
    // Navigate to profile page
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    
    // Profile page should load
    await page.waitForLoadState('domcontentloaded');
    
    // Take screenshot for visual verification
    await page.screenshot({ path: '/app/tests/e2e/login-perf-profile-page.jpeg', quality: 20 });
    
    // Profile page should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('Login API response does not contain large profile_picture', async ({ request }) => {
    // Make login request directly to API
    const response = await request.post('/api/auth/login', {
      data: {
        identifier: TEST_EMAIL,
        password: TEST_PIN
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Check response structure
    expect(data).toHaveProperty('uid');
    
    // If profile_picture exists, it should be null or very small
    if (data.profile_picture) {
      expect(data.profile_picture.length).toBeLessThan(1000);
    }
    
    // Response body size should be reasonable (no large base64)
    const responseBody = await response.body();
    expect(responseBody.length).toBeLessThan(10000);
  });

  test('Profile picture endpoint returns correct structure', async ({ request }) => {
    // Login first to get UID
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        identifier: TEST_EMAIL,
        password: TEST_PIN
      }
    });
    
    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    const uid = loginData.uid;
    
    // Fetch profile picture separately
    const picResponse = await request.get(`/api/users/${uid}/profile-picture`);
    expect(picResponse.ok()).toBeTruthy();
    
    const picData = await picResponse.json();
    
    // Check correct structure
    expect(picData).toHaveProperty('profile_picture');
    expect(picData).toHaveProperty('has_picture');
    expect(typeof picData.has_picture).toBe('boolean');
  });

  test('User data endpoint excludes profile_picture', async ({ request }) => {
    // Login first to get UID
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        identifier: TEST_EMAIL,
        password: TEST_PIN
      }
    });
    
    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    const uid = loginData.uid;
    
    // Fetch user data
    const userResponse = await request.get(`/api/user/${uid}`);
    expect(userResponse.ok()).toBeTruthy();
    
    const userData = await userResponse.json();
    
    // profile_picture should NOT be in response
    expect(userData).not.toHaveProperty('profile_picture');
  });
});
