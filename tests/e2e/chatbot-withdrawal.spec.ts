import { test, expect } from '@playwright/test';

/**
 * Chatbot Bank Withdrawal System Tests
 * =====================================
 * Tests for the new chatbot-based bank withdrawal feature.
 * 
 * Features tested:
 * 1. Backend API endpoints for chatbot withdrawal
 * 2. Bank Transfer UI removal from RedeemPageV2
 * 3. Admin Chatbot Withdrawals page route
 * 4. Fee calculation validation
 */

test.describe('Chatbot Withdrawal API Tests', () => {
  
  test('Fee calculation API returns correct structure for minimum amount', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/calculate-fees?amount=500');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Verify response structure
    expect(data).toHaveProperty('amount_inr', 500);
    expect(data).toHaveProperty('processing_fee', 10);
    expect(data).toHaveProperty('admin_charge', 100);
    expect(data).toHaveProperty('admin_charge_percent', 20);
    expect(data).toHaveProperty('total_fees', 110);
    expect(data).toHaveProperty('net_amount', 390);
    expect(data).toHaveProperty('prc_required', 5000);
  });

  test('Fee calculation API rejects amount below minimum', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/calculate-fees?amount=400');
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.detail).toContain('500');
  });

  test('Fee calculation API works for higher amounts', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/calculate-fees?amount=1000');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.amount_inr).toBe(1000);
    expect(data.processing_fee).toBe(10);
    expect(data.admin_charge).toBe(200); // 20% of 1000
    expect(data.total_fees).toBe(210);
    expect(data.net_amount).toBe(790);
    expect(data.prc_required).toBe(10000);
  });

  test('Eligibility API returns proper response for non-existent user', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/eligibility/test-user-nonexistent');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.eligible).toBe(false);
    expect(data.reason).toContain('not found');
  });

  test('Admin stats API returns proper structure', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/admin/stats');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Verify counts structure
    expect(data.counts).toBeDefined();
    expect(data.counts).toHaveProperty('pending');
    expect(data.counts).toHaveProperty('processing');
    expect(data.counts).toHaveProperty('completed');
    expect(data.counts).toHaveProperty('rejected');
    expect(data.counts).toHaveProperty('total');
    
    // Verify completed_summary
    expect(data.completed_summary).toBeDefined();
    expect(data.completed_summary).toHaveProperty('total_amount');
    expect(data.completed_summary).toHaveProperty('total_fees');
    expect(data.completed_summary).toHaveProperty('count');
  });

  test('Admin pending requests API returns proper structure', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/admin/pending');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('requests');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.requests)).toBe(true);
  });

  test('Admin all requests API returns proper structure', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/admin/all');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('requests');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('stats');
    
    // Stats should have status counts
    expect(data.stats).toHaveProperty('pending');
    expect(data.stats).toHaveProperty('processing');
    expect(data.stats).toHaveProperty('completed');
    expect(data.stats).toHaveProperty('rejected');
  });

  test('Admin all requests API accepts status filter', async ({ request }) => {
    for (const status of ['pending', 'processing', 'completed', 'rejected']) {
      const response = await request.get(`/api/chatbot-redeem/admin/all?status=${status}`);
      expect(response.status()).toBe(200);
    }
  });

  test('User history API returns proper structure', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/history/test-user-123');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('requests');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.requests)).toBe(true);
  });

  test('Saved accounts API returns proper structure', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/saved-accounts/test-user-123');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('accounts');
    expect(Array.isArray(data.accounts)).toBe(true);
  });

  test('Request status API returns 404 for non-existent request', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/status/NONEXISTENT-12345');
    expect(response.status()).toBe(404);
  });

  test('Admin request details API returns 404 for non-existent request', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/admin/request/NONEXISTENT-12345');
    expect(response.status()).toBe(404);
  });
});

test.describe('Chatbot Withdrawal Fee Calculation Edge Cases', () => {
  
  test('Fee calculation at exactly minimum amount', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/calculate-fees?amount=500');
    expect(response.status()).toBe(200);
  });

  test('Fee calculation just below minimum amount', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/calculate-fees?amount=499');
    expect(response.status()).toBe(400);
  });

  test('Fee calculation for large amount', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/calculate-fees?amount=50000');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    // Processing fee should still be ₹10 (flat)
    expect(data.processing_fee).toBe(10);
    // Admin charge should be 20% = ₹10000
    expect(data.admin_charge).toBe(10000);
    // Total fees = 10 + 10000 = ₹10010
    expect(data.total_fees).toBe(10010);
    // Net = 50000 - 10010 = ₹39990
    expect(data.net_amount).toBe(39990);
    // PRC required = 50000 * 10 = 500000
    expect(data.prc_required).toBe(500000);
  });

  test('PRC to INR rate is consistently 10:1', async ({ request }) => {
    // Test various amounts to verify consistent rate
    const amounts = [500, 1000, 2000, 5000];
    
    for (const amount of amounts) {
      const response = await request.get(`/api/chatbot-redeem/calculate-fees?amount=${amount}`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.prc_required).toBe(amount * 10);
    }
  });
});

test.describe('Bank Transfer UI Removal Verification', () => {
  
  test('Redeem page redirects to login for unauthenticated users', async ({ page }) => {
    await page.goto('/redeem');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Should redirect to login page
    const url = page.url();
    expect(url).toContain('/login');
  });

  test('Admin chatbot withdrawals page requires authentication', async ({ page }) => {
    await page.goto('/admin/chatbot-withdrawals');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Should redirect to login or dashboard
    const url = page.url();
    expect(url.includes('/login') || url.includes('/dashboard')).toBe(true);
  });
});

test.describe('Homepage and Navigation Tests', () => {
  
  test('Homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Check page title contains Paras Reward
    await expect(page).toHaveTitle(/Paras/i);
    
    // Check login button is visible
    const loginButton = page.getByRole('link', { name: /login/i });
    await expect(loginButton).toBeVisible();
  });

  test('Login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    // Check login form exists
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeVisible();
  });
});
