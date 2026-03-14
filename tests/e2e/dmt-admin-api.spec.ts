/**
 * DMT V3 Limits API E2E Tests
 * ===========================
 * Tests for Eko Levin DMT V3 implementation with admin controls:
 * - DMT Service Toggle API - Enable/Disable DMT service
 * - DMT Global Limits API - Get and Update limits (daily/weekly/monthly/per_txn/min_amount)
 * - User DMT Usage API - Track user's daily/weekly/monthly usage
 * - Levin DMT Health API - Check service health
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'https://fund-transfer-app-4.preview.emergentagent.com';

// Test data
const TEST_USER_ID = 'test_playwright_user_' + Date.now();
const ADMIN_ID = 'test_admin';

// ========================================
// DMT GLOBAL LIMITS API TESTS
// ========================================

test.describe('DMT Global Limits API', () => {
  
  // Restore original limits after each test
  test.afterEach(async ({ request }) => {
    await request.put(`${BASE_URL}/api/admin/dmt-limits`, {
      data: {
        daily_limit: 25000,
        weekly_limit: 100000,
        monthly_limit: 200000,
        per_txn_limit: 25000,
        min_amount: 100,
        admin_id: 'test_cleanup'
      }
    });
  });

  test('GET /api/admin/dmt-limits returns success with all limit fields', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/dmt-limits`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.limits).toBeDefined();
    expect(data.limits.daily_limit).toBeDefined();
    expect(data.limits.weekly_limit).toBeDefined();
    expect(data.limits.monthly_limit).toBeDefined();
    expect(data.limits.per_txn_limit).toBeDefined();
    expect(data.limits.min_amount).toBeDefined();
  });

  test('GET /api/admin/dmt-limits returns valid limit hierarchy', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/dmt-limits`);
    const data = await response.json();
    const limits = data.limits;
    
    // per_txn <= daily <= weekly <= monthly
    expect(limits.per_txn_limit).toBeLessThanOrEqual(limits.daily_limit);
    expect(limits.daily_limit).toBeLessThanOrEqual(limits.weekly_limit);
    expect(limits.weekly_limit).toBeLessThanOrEqual(limits.monthly_limit);
  });

  test('PUT /api/admin/dmt-limits updates all limits successfully', async ({ request }) => {
    const newLimits = {
      daily_limit: 30000,
      weekly_limit: 120000,
      monthly_limit: 240000,
      per_txn_limit: 20000,
      min_amount: 150,
      admin_id: ADMIN_ID
    };
    
    const response = await request.put(`${BASE_URL}/api/admin/dmt-limits`, { data: newLimits });
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('updated successfully');
    expect(data.limits.daily_limit).toBe(30000);
    expect(data.limits.weekly_limit).toBe(120000);
    expect(data.limits.monthly_limit).toBe(240000);
    expect(data.limits.per_txn_limit).toBe(20000);
    expect(data.limits.min_amount).toBe(150);
  });

  test('PUT /api/admin/dmt-limits changes persist in GET', async ({ request }) => {
    // Update limits
    await request.put(`${BASE_URL}/api/admin/dmt-limits`, {
      data: {
        daily_limit: 35000,
        weekly_limit: 140000,
        monthly_limit: 280000,
        per_txn_limit: 25000,
        min_amount: 200,
        admin_id: ADMIN_ID
      }
    });
    
    // Verify with GET
    const getResponse = await request.get(`${BASE_URL}/api/admin/dmt-limits`);
    const getData = await getResponse.json();
    
    expect(getData.limits.daily_limit).toBe(35000);
    expect(getData.limits.weekly_limit).toBe(140000);
    expect(getData.limits.monthly_limit).toBe(280000);
    expect(getData.limits.min_amount).toBe(200);
  });

  test('PUT /api/admin/dmt-limits rejects daily > weekly', async ({ request }) => {
    const response = await request.put(`${BASE_URL}/api/admin/dmt-limits`, {
      data: {
        daily_limit: 200000,
        weekly_limit: 100000,
        monthly_limit: 300000,
        per_txn_limit: 25000,
        min_amount: 100
      }
    });
    
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.detail).toContain('Daily limit cannot exceed weekly limit');
  });

  test('PUT /api/admin/dmt-limits rejects weekly > monthly', async ({ request }) => {
    const response = await request.put(`${BASE_URL}/api/admin/dmt-limits`, {
      data: {
        daily_limit: 20000,
        weekly_limit: 400000,
        monthly_limit: 200000,
        per_txn_limit: 15000,
        min_amount: 100
      }
    });
    
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.detail).toContain('Weekly limit cannot exceed monthly limit');
  });

  test('PUT /api/admin/dmt-limits rejects per_txn > daily', async ({ request }) => {
    const response = await request.put(`${BASE_URL}/api/admin/dmt-limits`, {
      data: {
        daily_limit: 20000,
        weekly_limit: 100000,
        monthly_limit: 200000,
        per_txn_limit: 50000,
        min_amount: 100
      }
    });
    
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.detail).toContain('Per transaction limit cannot exceed daily limit');
  });

  test('PUT /api/admin/dmt-limits records updated_by admin', async ({ request }) => {
    await request.put(`${BASE_URL}/api/admin/dmt-limits`, {
      data: {
        daily_limit: 25000,
        weekly_limit: 100000,
        monthly_limit: 200000,
        per_txn_limit: 25000,
        min_amount: 100,
        admin_id: 'special_admin_123'
      }
    });
    
    const getResponse = await request.get(`${BASE_URL}/api/admin/dmt-limits`);
    const getData = await getResponse.json();
    
    expect(getData.limits.updated_by).toBe('special_admin_123');
    expect(getData.limits.updated_at).toBeDefined();
  });
});

// ========================================
// USER DMT USAGE API TESTS
// ========================================

test.describe('User DMT Usage API', () => {
  
  test('GET /api/admin/user/{user_id}/dmt-usage returns success', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/user/${TEST_USER_ID}/dmt-usage`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user_id).toBe(TEST_USER_ID);
  });

  test('GET user DMT usage returns daily/weekly/monthly usage', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/user/${TEST_USER_ID}/dmt-usage`);
    const data = await response.json();
    
    // Daily usage
    expect(data.usage.daily).toBeDefined();
    expect(data.usage.daily).toHaveProperty('used');
    expect(data.usage.daily).toHaveProperty('limit');
    expect(data.usage.daily).toHaveProperty('remaining');
    expect(data.usage.daily).toHaveProperty('count');
    
    // Weekly usage
    expect(data.usage.weekly).toBeDefined();
    expect(data.usage.weekly).toHaveProperty('used');
    expect(data.usage.weekly).toHaveProperty('limit');
    expect(data.usage.weekly).toHaveProperty('remaining');
    
    // Monthly usage
    expect(data.usage.monthly).toBeDefined();
    expect(data.usage.monthly).toHaveProperty('used');
    expect(data.usage.monthly).toHaveProperty('limit');
    expect(data.usage.monthly).toHaveProperty('remaining');
  });

  test('GET user DMT usage returns transaction limits', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/user/${TEST_USER_ID}/dmt-usage`);
    const data = await response.json();
    
    expect(data.limits).toBeDefined();
    expect(data.limits.per_txn_limit).toBeDefined();
    expect(data.limits.min_amount).toBeDefined();
  });

  test('New user has zero usage', async ({ request }) => {
    const newUserId = `brand_new_user_${Date.now()}`;
    const response = await request.get(`${BASE_URL}/api/admin/user/${newUserId}/dmt-usage`);
    const data = await response.json();
    
    expect(data.usage.daily.used).toBe(0);
    expect(data.usage.daily.count).toBe(0);
    expect(data.usage.weekly.used).toBe(0);
    expect(data.usage.monthly.used).toBe(0);
  });

  test('User remaining equals limit for new user', async ({ request }) => {
    const newUserId = `fresh_user_${Date.now()}`;
    const response = await request.get(`${BASE_URL}/api/admin/user/${newUserId}/dmt-usage`);
    const data = await response.json();
    
    expect(data.usage.daily.remaining).toBe(data.usage.daily.limit);
    expect(data.usage.weekly.remaining).toBe(data.usage.weekly.limit);
    expect(data.usage.monthly.remaining).toBe(data.usage.monthly.limit);
  });

  test('User usage reflects global limits changes', async ({ request }) => {
    // Set specific limits
    await request.put(`${BASE_URL}/api/admin/dmt-limits`, {
      data: {
        daily_limit: 40000,
        weekly_limit: 160000,
        monthly_limit: 320000,
        per_txn_limit: 25000,
        min_amount: 100,
        admin_id: ADMIN_ID
      }
    });
    
    // Check user usage reflects new limits
    const response = await request.get(`${BASE_URL}/api/admin/user/${TEST_USER_ID}/dmt-usage`);
    const data = await response.json();
    
    expect(data.usage.daily.limit).toBe(40000);
    expect(data.usage.weekly.limit).toBe(160000);
    expect(data.usage.monthly.limit).toBe(320000);
    
    // Restore limits
    await request.put(`${BASE_URL}/api/admin/dmt-limits`, {
      data: {
        daily_limit: 25000,
        weekly_limit: 100000,
        monthly_limit: 200000,
        per_txn_limit: 25000,
        min_amount: 100,
        admin_id: 'test_cleanup'
      }
    });
  });
});

// ========================================
// DMT SERVICE TOGGLE API TESTS
// ========================================

test.describe('DMT Service Toggle API', () => {
  
  // Ensure DMT is enabled after each test
  test.afterEach(async ({ request }) => {
    await request.post(`${BASE_URL}/api/admin/service-toggles/dmt`, {
      data: { enabled: true, admin_id: 'test_cleanup' }
    });
  });

  test('POST enable DMT service', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/admin/service-toggles/dmt`, {
      data: { enabled: true, admin_id: ADMIN_ID }
    });
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.service).toBe('dmt');
    expect(data.enabled).toBe(true);
  });

  test('POST disable DMT service', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/admin/service-toggles/dmt`, {
      data: { enabled: false, admin_id: ADMIN_ID }
    });
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.service).toBe('dmt');
    expect(data.enabled).toBe(false);
  });

  test('DMT toggle change persists in service list', async ({ request }) => {
    // Disable DMT
    await request.post(`${BASE_URL}/api/admin/service-toggles/dmt`, {
      data: { enabled: false, admin_id: ADMIN_ID }
    });
    
    // Verify in GET service toggles
    const response = await request.get(`${BASE_URL}/api/admin/service-toggles`);
    const data = await response.json();
    
    expect(data.services.dmt.enabled).toBe(false);
  });

  test('Enable/disable DMT toggle cycle works', async ({ request }) => {
    // Disable
    let response = await request.post(`${BASE_URL}/api/admin/service-toggles/dmt`, {
      data: { enabled: false, admin_id: ADMIN_ID }
    });
    expect((await response.json()).enabled).toBe(false);
    
    // Enable
    response = await request.post(`${BASE_URL}/api/admin/service-toggles/dmt`, {
      data: { enabled: true, admin_id: ADMIN_ID }
    });
    expect((await response.json()).enabled).toBe(true);
    
    // Disable again
    response = await request.post(`${BASE_URL}/api/admin/service-toggles/dmt`, {
      data: { enabled: false, admin_id: ADMIN_ID }
    });
    expect((await response.json()).enabled).toBe(false);
  });
});

// ========================================
// SERVICE TOGGLES LIST API TESTS
// ========================================

test.describe('Service Toggles List API', () => {
  
  test('GET /api/admin/service-toggles returns services', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/service-toggles`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.services).toBeDefined();
  });

  test('GET service toggles includes DMT service', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/service-toggles`);
    const data = await response.json();
    
    expect(data.services.dmt).toBeDefined();
    expect(data.services.dmt.name).toBeDefined();
    expect(data.services.dmt.enabled).toBeDefined();
    expect(data.services.dmt.key).toBe('dmt');
  });

  test('DMT service has correct display name', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/service-toggles`);
    const data = await response.json();
    
    const dmtName = data.services.dmt.name;
    expect(dmtName.includes('Money Transfer') || dmtName.includes('DMT')).toBe(true);
  });
});

// ========================================
// LEVIN DMT HEALTH API TESTS
// ========================================

test.describe('Levin DMT Health API', () => {
  
  test('GET /api/eko/levin-dmt/health returns healthy status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/levin-dmt/health`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('Levin DMT V3');
  });

  test('GET levin-dmt health returns configuration', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/levin-dmt/health`);
    const data = await response.json();
    
    expect(data.base_url).toBeDefined();
    expect(data.user_code).toBe('19560001'); // From provided credentials
    expect(data.timestamp).toBeDefined();
  });
});

// ========================================
// DMT LIMITS INTEGRATION TESTS
// ========================================

test.describe('DMT Limits Integration', () => {
  
  test.afterEach(async ({ request }) => {
    // Restore defaults
    await request.put(`${BASE_URL}/api/admin/dmt-limits`, {
      data: {
        daily_limit: 25000,
        weekly_limit: 100000,
        monthly_limit: 200000,
        per_txn_limit: 25000,
        min_amount: 100,
        admin_id: 'test_cleanup'
      }
    });
    await request.post(`${BASE_URL}/api/admin/service-toggles/dmt`, {
      data: { enabled: true, admin_id: 'test_cleanup' }
    });
  });

  test('Global limits affect user usage endpoint', async ({ request }) => {
    // Set custom limits
    await request.put(`${BASE_URL}/api/admin/dmt-limits`, {
      data: {
        daily_limit: 50000,
        weekly_limit: 200000,
        monthly_limit: 400000,
        per_txn_limit: 25000,
        min_amount: 500,
        admin_id: ADMIN_ID
      }
    });
    
    // Verify user usage reflects new limits
    const userResponse = await request.get(`${BASE_URL}/api/admin/user/${TEST_USER_ID}/dmt-usage`);
    const userData = await userResponse.json();
    
    expect(userData.usage.daily.limit).toBe(50000);
    expect(userData.usage.weekly.limit).toBe(200000);
    expect(userData.usage.monthly.limit).toBe(400000);
    expect(userData.limits.min_amount).toBe(500);
  });

  test('Multiple services can be toggled independently', async ({ request }) => {
    // Disable DMT
    await request.post(`${BASE_URL}/api/admin/service-toggles/dmt`, {
      data: { enabled: false, admin_id: ADMIN_ID }
    });
    
    // Verify DMT disabled but other services unaffected
    const response = await request.get(`${BASE_URL}/api/admin/service-toggles`);
    const data = await response.json();
    
    expect(data.services.dmt.enabled).toBe(false);
    // Other services should still be enabled (unless changed)
    if (data.services.mobile_recharge) {
      expect(data.services.mobile_recharge.enabled).toBeDefined();
    }
  });

  test('Limit validation maintains data integrity', async ({ request }) => {
    // Get current limits
    const beforeResponse = await request.get(`${BASE_URL}/api/admin/dmt-limits`);
    const beforeData = await beforeResponse.json();
    
    // Attempt invalid update
    await request.put(`${BASE_URL}/api/admin/dmt-limits`, {
      data: {
        daily_limit: 999999,  // Invalid: > weekly
        weekly_limit: 100000,
        monthly_limit: 200000,
        per_txn_limit: 25000,
        min_amount: 100
      }
    });
    
    // Verify limits unchanged after failed update
    const afterResponse = await request.get(`${BASE_URL}/api/admin/dmt-limits`);
    const afterData = await afterResponse.json();
    
    expect(afterData.limits.daily_limit).toBe(beforeData.limits.daily_limit);
  });
});
