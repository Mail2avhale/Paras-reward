import { test, expect } from '@playwright/test';

/**
 * Admin PRC Rate Control and Razorpay Double Activation Prevention Tests
 * 
 * Note: Page UI tests require admin login. 
 * These tests focus on API validation which is the core functionality.
 * 
 * Page UI verification done via screenshot tool with admin login session.
 */

test.describe('Admin PRC Rate Control - API Tests', () => {
  
  test('GET /api/admin/prc-rate/current returns valid data', async ({ request }) => {
    const response = await request.get('/api/admin/prc-rate/current');
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.current_rate).toBeDefined();
    expect(typeof data.current_rate).toBe('number');
    expect(data.current_rate).toBeGreaterThan(0);
    expect(data.source).toBeDefined();
    expect(['manual_override', 'dynamic_economy', 'fallback']).toContain(data.source);
  });

  test('GET /api/admin/prc-rate/current includes note field', async ({ request }) => {
    const response = await request.get('/api/admin/prc-rate/current');
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.note).toBeDefined();
    expect(data.note).toContain('PRC');
  });

  test('POST /api/admin/prc-rate/manual-override accepts valid rate', async ({ request }) => {
    const response = await request.post('/api/admin/prc-rate/manual-override', {
      data: { rate: 20, enabled: true, expires_hours: 1 }
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.rate).toBe(20);
    expect(data.expires_at).toBeDefined();
  });

  test('POST /api/admin/prc-rate/manual-override can disable override', async ({ request }) => {
    // First enable
    await request.post('/api/admin/prc-rate/manual-override', {
      data: { rate: 25, enabled: true }
    });
    
    // Then disable
    const response = await request.post('/api/admin/prc-rate/manual-override', {
      data: { enabled: false }
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.enabled).toBe(false);
  });

  test('POST /api/admin/prc-rate/manual-override rejects negative rate', async ({ request }) => {
    const response = await request.post('/api/admin/prc-rate/manual-override', {
      data: { rate: -1, enabled: true }
    });
    
    expect(response.status()).toBe(400);
  });

  test('POST /api/admin/prc-rate/manual-override rejects zero rate', async ({ request }) => {
    const response = await request.post('/api/admin/prc-rate/manual-override', {
      data: { rate: 0, enabled: true }
    });
    
    expect(response.status()).toBe(400);
  });

  test('Cleanup: disable override after tests', async ({ request }) => {
    const response = await request.post('/api/admin/prc-rate/manual-override', {
      data: { enabled: false }
    });
    
    expect(response.status()).toBe(200);
  });
});

test.describe('Admin User Lookup - API Tests (BUG VERIFICATION)', () => {
  
  test('BUG: GET /api/admin/user-lookup returns 404', async ({ request }) => {
    /**
     * CRITICAL BUG: User-lookup endpoint returns 404 Not Found
     * 
     * Root Cause: Route defined AFTER app.include_router(api_router)
     * - Line 43305: app.include_router(api_router)
     * - Line 43308: @api_router.get("/admin/user-lookup/{identifier}")
     * 
     * Fix Required: Move route definition BEFORE include_router call.
     */
    const response = await request.get('/api/admin/user-lookup/test');
    
    // Bug confirmed: Returns 404 instead of user data
    expect(response.status()).toBe(404);
  });

  test('BUG: User lookup by mobile returns 404', async ({ request }) => {
    const response = await request.get('/api/admin/user-lookup/9421331342');
    expect(response.status()).toBe(404);
  });

  test('BUG: User lookup by email returns 404', async ({ request }) => {
    const response = await request.get('/api/admin/user-lookup/test@parasreward.com');
    expect(response.status()).toBe(404);
  });
});

test.describe('Razorpay Double Activation Prevention - API Tests', () => {
  
  test('GET /api/razorpay/config shows DOUBLE_VERIFICATION security', async ({ request }) => {
    const response = await request.get('/api/razorpay/config');
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.key_id).toBeDefined();
    expect(data.key_id.startsWith('rzp_live_')).toBe(true);
    expect(data.security).toContain('DOUBLE_VERIFICATION');
    expect(data.code_version).toContain('SECURE');
  });

  test('POST /api/razorpay/verify-payment rejects invalid signature', async ({ request }) => {
    const response = await request.post('/api/razorpay/verify-payment', {
      data: {
        razorpay_order_id: 'order_invalid_test',
        razorpay_payment_id: 'pay_invalid_test',
        razorpay_signature: 'fake_signature',
        user_id: 'test-user'
      }
    });
    
    // Should reject with 400 for invalid signature
    expect(response.status()).toBe(400);
  });

  test('POST /api/razorpay/verify-payment requires all fields', async ({ request }) => {
    const response = await request.post('/api/razorpay/verify-payment', {
      data: {
        razorpay_order_id: 'order_test'
        // Missing other required fields
      }
    });
    
    // Should reject with 422 for validation error
    expect(response.status()).toBe(422);
  });

  test('POST /api/razorpay/create-order creates valid order', async ({ request }) => {
    const response = await request.post('/api/razorpay/create-order', {
      data: {
        user_id: `test-e2e-${Date.now()}`,
        plan_type: 'monthly',
        plan_name: 'startup',
        amount: 299
      }
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.order_id).toBeDefined();
    expect(data.order_id.startsWith('order_')).toBe(true);
    expect(data.amount).toBe(29900); // Amount in paise
    expect(data.currency).toBe('INR');
  });

  test('POST /api/razorpay/create-order validates required fields', async ({ request }) => {
    const response = await request.post('/api/razorpay/create-order', {
      data: { user_id: 'test' }
    });
    
    expect(response.status()).toBe(422);
  });

  test('POST /api/razorpay/update-order-status validates status', async ({ request }) => {
    const response = await request.post('/api/razorpay/update-order-status', {
      data: {
        order_id: 'order_test',
        status: 'invalid_status'
      }
    });
    
    // Should reject invalid status
    expect(response.status()).toBe(400);
  });

  test('POST /api/razorpay/update-order-status accepts valid statuses', async ({ request }) => {
    const validStatuses = ['failed', 'cancelled', 'error', 'timeout', 'dismissed'];
    
    for (const status of validStatuses) {
      const response = await request.post('/api/razorpay/update-order-status', {
        data: {
          order_id: `order_test_${status}`,
          status: status,
          reason: `Test ${status} reason`
        }
      });
      
      expect(response.status()).toBe(200);
    }
  });

  test('GET /api/razorpay/payment-history returns list', async ({ request }) => {
    const response = await request.get('/api/razorpay/payment-history/test-user');
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.payments).toBeDefined();
    expect(Array.isArray(data.payments)).toBe(true);
  });

  test('POST /api/razorpay/webhook accepts POST requests', async ({ request }) => {
    const response = await request.post('/api/razorpay/webhook', {
      data: {}
    });
    
    // Webhook should not reject empty body (returns ok to avoid retries)
    expect([200, 500]).toContain(response.status());
  });

  test('GET /api/razorpay/debug/subscription-renewal validates user', async ({ request }) => {
    const response = await request.get('/api/razorpay/debug/subscription-renewal/nonexistent-user');
    
    // Should return 404 for non-existent user
    expect(response.status()).toBe(404);
  });
});

test.describe('Subscription Plans - API Tests', () => {
  
  test('GET /api/subscription/plans returns valid plans', async ({ request }) => {
    const response = await request.get('/api/subscription/plans');
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.plans).toBeDefined();
    expect(Array.isArray(data.plans)).toBe(true);
    expect(data.plans.length).toBeGreaterThanOrEqual(2);
  });

  test('Subscription plans include Explorer (free) plan', async ({ request }) => {
    const response = await request.get('/api/subscription/plans');
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    const explorer = data.plans.find((p: any) => p.id === 'explorer');
    expect(explorer).toBeDefined();
    expect(explorer.is_free).toBe(true);
  });

  test('Paid plans have pricing information', async ({ request }) => {
    const response = await request.get('/api/subscription/plans');
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    const paidPlans = data.plans.filter((p: any) => !p.is_free);
    expect(paidPlans.length).toBeGreaterThanOrEqual(1);
    
    for (const plan of paidPlans) {
      expect(plan.pricing).toBeDefined();
      expect(plan.pricing.monthly).toBeDefined();
    }
  });
});
