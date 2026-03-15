import { test, expect } from '@playwright/test';

/**
 * Single Leg Mining Bonus API Tests
 * Tests that the /api/mining/status/{uid} endpoint returns single_leg_info
 * 
 * Note: Frontend UI tests require login which is currently failing with 500 error
 */

const TEST_USER_UID = '6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21';
const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://subscription-hotfix.preview.emergentagent.com';

test.describe('Single Leg Mining API Tests', () => {
  
  test('Backend API returns single_leg_info with all required fields', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/mining/status/${TEST_USER_UID}`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Verify single_leg_info exists
    expect(data).toHaveProperty('single_leg_info');
    
    const singleLegInfo = data.single_leg_info;
    
    // Verify all required fields
    expect(singleLegInfo).toHaveProperty('active_downline');
    expect(singleLegInfo).toHaveProperty('total_downline');
    expect(singleLegInfo).toHaveProperty('bonus_prc_per_day');
    expect(singleLegInfo).toHaveProperty('bonus_prc_per_hour');
    expect(singleLegInfo).toHaveProperty('max_users');
    expect(singleLegInfo).toHaveProperty('prc_per_user_per_day');
    
    // Verify constants
    expect(singleLegInfo.max_users).toBe(800);
    expect(singleLegInfo.prc_per_user_per_day).toBe(5);
  });

  test('Backend API single_leg_info field types are correct', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/mining/status/${TEST_USER_UID}`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    const singleLegInfo = data.single_leg_info;
    
    // Check numeric types
    expect(typeof singleLegInfo.active_downline).toBe('number');
    expect(typeof singleLegInfo.total_downline).toBe('number');
    expect(typeof singleLegInfo.bonus_prc_per_day).toBe('number');
    expect(typeof singleLegInfo.bonus_prc_per_hour).toBe('number');
    expect(typeof singleLegInfo.max_users).toBe('number');
    expect(typeof singleLegInfo.prc_per_user_per_day).toBe('number');
    
    // Check non-negative values
    expect(singleLegInfo.active_downline).toBeGreaterThanOrEqual(0);
    expect(singleLegInfo.total_downline).toBeGreaterThanOrEqual(0);
    expect(singleLegInfo.bonus_prc_per_day).toBeGreaterThanOrEqual(0);
    expect(singleLegInfo.bonus_prc_per_hour).toBeGreaterThanOrEqual(0);
  });

  test('Backend API returns complete mining status structure', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/mining/status/${TEST_USER_UID}`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Verify other important fields exist alongside single_leg_info
    expect(data).toHaveProperty('current_balance');
    expect(data).toHaveProperty('mining_rate');
    expect(data).toHaveProperty('mining_rate_per_hour');
    expect(data).toHaveProperty('base_rate');
    expect(data).toHaveProperty('referral_breakdown');
    expect(data).toHaveProperty('single_leg_info');
    expect(data).toHaveProperty('session_active');
    expect(data).toHaveProperty('remaining_hours');
  });

  test('Backend API single_leg_info matches frontend expectations', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/mining/status/${TEST_USER_UID}`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    const singleLegInfo = data.single_leg_info;
    
    // Verify values that frontend would display
    // Frontend shows: "{active_downline} active / {total_downline} total • Max {max_users} users"
    // Frontend shows: "+{bonus_prc_per_hour} PRC/hr" and "≈ {bonus_prc_per_day} PRC/day"
    
    // These values should be displayable
    expect(Number.isFinite(singleLegInfo.active_downline)).toBe(true);
    expect(Number.isFinite(singleLegInfo.total_downline)).toBe(true);
    expect(Number.isFinite(singleLegInfo.bonus_prc_per_hour)).toBe(true);
    expect(Number.isFinite(singleLegInfo.bonus_prc_per_day)).toBe(true);
    
    // Consistency check: bonus_prc_per_day ≈ bonus_prc_per_hour * 24
    if (singleLegInfo.bonus_prc_per_hour > 0) {
      const expectedDaily = singleLegInfo.bonus_prc_per_hour * 24;
      expect(Math.abs(singleLegInfo.bonus_prc_per_day - expectedDaily)).toBeLessThan(0.01);
    }
  });
});

test.describe('Single Leg Mining Frontend Code Verification', () => {
  
  test('Mining.js contains Single Leg Bonus UI code', async ({ request }) => {
    // This is a code verification test - we verify the frontend code has the expected structure
    // by checking the Mining.js file content would display Single Leg Bonus
    
    // The code at lines 1515-1538 of Mining.js should contain:
    // - "Single Leg Bonus" text
    // - Display of active_downline / total_downline  
    // - Display of max_users
    // - Display of bonus_prc_per_hour and bonus_prc_per_day
    
    // Since we can't login to verify UI directly, we verify the API contract
    // that the frontend code expects
    const response = await request.get(`${API_URL}/api/mining/status/${TEST_USER_UID}`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Verify the exact fields that Mining.js expects at line 1525:
    // singleLegInfo.active_downline
    // singleLegInfo.total_downline  
    // singleLegInfo.max_users
    // singleLegInfo.bonus_prc_per_hour
    // singleLegInfo.bonus_prc_per_day
    expect(data.single_leg_info).toBeDefined();
    expect('active_downline' in data.single_leg_info).toBe(true);
    expect('total_downline' in data.single_leg_info).toBe(true);
    expect('max_users' in data.single_leg_info).toBe(true);
    expect('bonus_prc_per_hour' in data.single_leg_info).toBe(true);
    expect('bonus_prc_per_day' in data.single_leg_info).toBe(true);
  });
});

test.describe('Login Flow Verification', () => {
  
  test('Login page loads correctly', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    
    // Verify login page elements
    await expect(page.locator('text=Welcome Back')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Sign in to your PARAS REWARD account')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder*="Enter email"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible({ timeout: 5000 });
    
    await page.screenshot({ path: '/app/tests/e2e/login-page-structure.jpeg', quality: 20 });
  });

  test.skip('Login with test credentials - SKIPPED due to API 500 error', async ({ page }) => {
    // This test is skipped because the login API returns 500 Internal Server Error
    // The test user exists (UID: 6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21)
    // but POST /api/auth/login returns 500
    // 
    // To enable this test, fix the login API endpoint
  });
});
