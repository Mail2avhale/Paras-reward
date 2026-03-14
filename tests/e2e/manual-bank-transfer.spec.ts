import { test, expect } from '@playwright/test';

/**
 * Manual Bank Transfer Feature Tests - Iteration 121
 * Tests for the Manual Fintech Redeem System
 * 
 * NOTE: UI tests require authentication which is not available in this preview.
 * These tests focus on API validation through Playwright.
 */

test.describe('Bank Transfer Config API', () => {
  test('should return correct configuration values', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/config');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.prc_rate).toBe(10);
    expect(data.transaction_fee).toBe(10);
    expect(data.admin_fee_percent).toBe(20);
    expect(data.min_withdrawal).toBe(200);
    expect(data.max_withdrawal).toBe(10000);
    expect(data.note).toContain('1 INR = 10 PRC');
  });
});

test.describe('Fee Calculation API', () => {
  test('should calculate fees correctly for minimum amount (₹200)', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/calculate-fees?amount=200');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.fees.withdrawal_amount).toBe(200);
    expect(data.fees.admin_fee).toBe(40); // 20% of 200
    expect(data.fees.transaction_fee).toBe(10);
    expect(data.fees.total_inr).toBe(250); // 200 + 40 + 10
    expect(data.fees.total_prc).toBe(2500); // 250 * 10
    expect(data.fees.user_receives).toBe(200);
  });

  test('should calculate fees correctly for maximum amount (₹10,000)', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/calculate-fees?amount=10000');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.fees.withdrawal_amount).toBe(10000);
    expect(data.fees.admin_fee).toBe(2000); // 20% of 10000
    expect(data.fees.transaction_fee).toBe(10);
    expect(data.fees.total_inr).toBe(12010);
    expect(data.fees.total_prc).toBe(120100);
    expect(data.fees.user_receives).toBe(10000);
  });

  test('should calculate fees correctly for mid amount (₹5,000)', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/calculate-fees?amount=5000');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.fees.withdrawal_amount).toBe(5000);
    expect(data.fees.admin_fee).toBe(1000); // 20% of 5000
    expect(data.fees.total_prc).toBe(60100); // (5000 + 1000 + 10) * 10
  });

  test('should reject amount below minimum (₹200)', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/calculate-fees?amount=100');
    expect(response.status()).toBe(422);
    
    const data = await response.json();
    expect(JSON.stringify(data)).toContain('greater_than_equal');
  });

  test('should reject amount above maximum (₹10,000)', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/calculate-fees?amount=20000');
    expect(response.status()).toBe(422);
    
    const data = await response.json();
    expect(JSON.stringify(data)).toContain('less_than_equal');
  });
});

test.describe('IFSC Verification API', () => {
  test('should verify HDFC IFSC code', async ({ request }) => {
    const response = await request.post('/api/bank-transfer/verify-ifsc?ifsc=HDFC0001234');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.ifsc).toBe('HDFC0001234');
    expect(data.bank_details.valid).toBe(true);
    expect(data.bank_details.bank_name).toContain('HDFC');
  });

  test('should verify ICICI IFSC code', async ({ request }) => {
    const response = await request.post('/api/bank-transfer/verify-ifsc?ifsc=ICIC0001234');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.bank_details.bank_name).toContain('ICICI');
  });

  test('should verify SBI IFSC code', async ({ request }) => {
    const response = await request.post('/api/bank-transfer/verify-ifsc?ifsc=SBIN0001234');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.bank_details.bank_name).toMatch(/State Bank|SBI/);
  });

  test('should verify Axis IFSC code', async ({ request }) => {
    const response = await request.post('/api/bank-transfer/verify-ifsc?ifsc=UTIB0001234');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.bank_details.bank_name).toContain('Axis');
  });

  test('should reject invalid IFSC format', async ({ request }) => {
    const response = await request.post('/api/bank-transfer/verify-ifsc?ifsc=INVALID123');
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.detail).toContain('Invalid IFSC format');
  });

  test('should reject short IFSC code', async ({ request }) => {
    const response = await request.post('/api/bank-transfer/verify-ifsc?ifsc=HDFC001');
    expect(response.status()).toBe(400);
  });

  test('should accept and convert lowercase IFSC to uppercase', async ({ request }) => {
    const response = await request.post('/api/bank-transfer/verify-ifsc?ifsc=hdfc0001234');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.ifsc).toBe('HDFC0001234'); // Should be uppercase
  });
});

test.describe('Admin Requests API', () => {
  test('should return requests list with correct structure', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/admin/requests');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('requests');
    expect(data).toHaveProperty('pagination');
    expect(data).toHaveProperty('stats');
    
    expect(data.pagination).toHaveProperty('total');
    expect(data.pagination).toHaveProperty('limit');
    expect(data.pagination).toHaveProperty('skip');
    expect(data.pagination).toHaveProperty('pages');
    
    expect(data.stats).toHaveProperty('pending');
    expect(data.stats).toHaveProperty('paid');
    expect(data.stats).toHaveProperty('failed');
  });

  test('should support status filter for pending', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/admin/requests?status=pending');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('should support status filter for paid', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/admin/requests?status=paid');
    expect(response.status()).toBe(200);
  });

  test('should support status filter for failed', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/admin/requests?status=failed');
    expect(response.status()).toBe(200);
  });

  test('should support search parameter', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/admin/requests?search=test');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('should support pagination parameters', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/admin/requests?limit=10&skip=0');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.pagination.limit).toBe(10);
    expect(data.pagination.skip).toBe(0);
  });
});

test.describe('Admin Stats API', () => {
  test('should return stats with correct structure', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/admin/stats');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('stats');
    
    const stats = data.stats;
    expect(stats).toHaveProperty('total_pending');
    expect(stats).toHaveProperty('total_paid');
    expect(stats).toHaveProperty('total_failed');
    expect(stats).toHaveProperty('total_prc_burned');
    expect(stats).toHaveProperty('pending_amount');
    expect(stats).toHaveProperty('paid_amount');
    expect(stats).toHaveProperty('today');
    
    expect(stats.today).toHaveProperty('new_requests');
    expect(stats.today).toHaveProperty('processed');
  });

  test('should return numeric values for all stats', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/admin/stats');
    const data = await response.json();
    
    expect(typeof data.stats.total_pending).toBe('number');
    expect(typeof data.stats.total_paid).toBe('number');
    expect(typeof data.stats.total_failed).toBe('number');
    expect(typeof data.stats.total_prc_burned).toBe('number');
  });
});

test.describe('User Requests API', () => {
  test('should return empty array for non-existent user', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/my-requests/nonexistent-user-id');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.requests).toEqual([]);
  });

  test('should support status filter', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/my-requests/test-user?status=pending');
    expect(response.status()).toBe(200);
  });

  test('should support pagination', async ({ request }) => {
    const response = await request.get('/api/bank-transfer/my-requests/test-user?limit=10&skip=0');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('limit');
    expect(data).toHaveProperty('skip');
  });
});

test.describe('BankRedeemPage UI - Unauthenticated', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/bank-redeem', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Welcome Back')).toBeVisible();
  });
});

test.describe('AdminBankTransfers UI - Unauthenticated', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/admin/bank-transfers', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Welcome Back')).toBeVisible();
  });
});
