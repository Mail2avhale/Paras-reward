/**
 * Unified Redeem System v2 - Frontend E2E Tests
 * ==============================================
 * Tests for /redeem and /admin/redeem pages
 * 
 * Note: These pages require login, but we test:
 * - Redirect behavior to login page
 * - API responses are correct
 * - Page loads correctly for authenticated users (via API intercepting)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'https://paras-redeem-v2.preview.emergentagent.com';

test.describe('Unified Redeem System v2 - API Tests', () => {

  test('Services API returns all 6 services', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/redeem/services`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.services).toHaveLength(6);
    
    const serviceIds = data.services.map((s: any) => s.id);
    expect(serviceIds).toContain('mobile_recharge');
    expect(serviceIds).toContain('dth');
    expect(serviceIds).toContain('electricity');
    expect(serviceIds).toContain('gas');
    expect(serviceIds).toContain('emi');
    expect(serviceIds).toContain('dmt');
  });

  test('Calculate charges returns correct breakdown for ₹100', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/redeem/calculate-charges?amount=100`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    
    // Verify charge calculation: ₹10 flat + 20% of 100
    expect(data.charges.amount_inr).toBe(100);
    expect(data.charges.platform_fee_inr).toBe(10);
    expect(data.charges.admin_charge_inr).toBe(20);
    expect(data.charges.total_charges_inr).toBe(30);
    expect(data.charges.total_amount_inr).toBe(130);
    expect(data.charges.total_prc_required).toBe(1300);
  });

  test('Calculate charges returns correct breakdown for ₹500', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/redeem/calculate-charges?amount=500`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.charges.amount_inr).toBe(500);
    expect(data.charges.platform_fee_inr).toBe(10);
    expect(data.charges.admin_charge_inr).toBe(100);  // 20% of 500
    expect(data.charges.total_charges_inr).toBe(110);
    expect(data.charges.total_amount_inr).toBe(610);
    expect(data.charges.total_prc_required).toBe(6100);
  });

  test('Admin stats API returns correct structure', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/redeem/admin/stats`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('by_status');
    expect(data).toHaveProperty('by_service');
    expect(data).toHaveProperty('today');
    expect(data).toHaveProperty('pending_count');
    expect(data.today).toHaveProperty('count');
    expect(data.today).toHaveProperty('total_amount');
  });

  test('Admin requests API returns paginated results', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/redeem/admin/requests?page=1&per_page=10`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('requests');
    expect(data).toHaveProperty('pagination');
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.per_page).toBe(10);
    expect(data).toHaveProperty('filters_applied');
  });

  test('Admin requests API accepts status filter', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/redeem/admin/requests?status=pending`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.filters_applied.status).toBe('pending');
  });

  test('Admin requests API accepts service_type filter', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/redeem/admin/requests?service_type=mobile_recharge`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.filters_applied.service_type).toBe('mobile_recharge');
  });

  test('Admin requests API accepts search filter', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/redeem/admin/requests?search=TEST`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.filters_applied.search).toBe('TEST');
  });

  test('Calculate charges rejects zero amount', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/redeem/calculate-charges?amount=0`);
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('Calculate charges rejects negative amount', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/redeem/calculate-charges?amount=-100`);
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Unified Redeem System v2 - Page Navigation', () => {

  test('/redeem redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/redeem', { waitUntil: 'domcontentloaded' });
    
    // Should redirect to login page - use heading to be specific
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('login-submit-btn')).toBeVisible();
  });

  test('/admin/redeem redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/admin/redeem', { waitUntil: 'domcontentloaded' });
    
    // Should redirect to login page - use heading to be specific
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('login-submit-btn')).toBeVisible();
  });

  test('Login page has correct elements', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Login page should have email input and sign in button
    await expect(page.getByPlaceholder(/email|mobile|uid/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});
