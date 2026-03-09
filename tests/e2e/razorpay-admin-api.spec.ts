import { test, expect } from '@playwright/test';

test.describe('Razorpay Admin Subscriptions - API Integration Tests', () => {
  const baseUrl = process.env.REACT_APP_BACKEND_URL || 'https://burn-scheduler-fix.preview.emergentagent.com';
  
  test('GET /api/admin/razorpay-subscriptions returns orders and stats', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/admin/razorpay-subscriptions`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Verify response structure
    expect(data).toHaveProperty('orders');
    expect(data).toHaveProperty('stats');
    expect(Array.isArray(data.orders)).toBeTruthy();
  });

  test('Stats include failed_orders count', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/admin/razorpay-subscriptions`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    const stats = data.stats;
    
    // Critical: Verify failed_orders is present
    expect(stats).toHaveProperty('total_orders');
    expect(stats).toHaveProperty('paid_orders');
    expect(stats).toHaveProperty('pending_orders');
    expect(stats).toHaveProperty('failed_orders');
    expect(stats).toHaveProperty('total_revenue');
  });

  test('Orders include user_current_plan and user_subscription_expiry', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/admin/razorpay-subscriptions`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    if (data.orders.length > 0) {
      const order = data.orders[0];
      
      // Verify new fields are present
      expect(order).toHaveProperty('user_current_plan');
      expect(order).toHaveProperty('user_subscription_expiry');
      expect(order).toHaveProperty('failure_reason');
      expect(order).toHaveProperty('error_code');
    }
  });

  test('Search by name works (admin)', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/admin/razorpay-subscriptions?search=admin`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data.orders)).toBeTruthy();
    
    // If results, should match admin
    for (const order of data.orders) {
      const matches = 
        order.user_name?.toLowerCase().includes('admin') ||
        order.user_email?.toLowerCase().includes('admin') ||
        order.order_id?.toLowerCase().includes('admin');
      expect(matches).toBeTruthy();
    }
  });

  test('Search by email works (mail2avhale)', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/admin/razorpay-subscriptions?search=mail2avhale`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    if (data.orders.length > 0) {
      const hasMatch = data.orders.some(o => 
        o.user_email?.toLowerCase().includes('mail2avhale')
      );
      expect(hasMatch).toBeTruthy();
    }
  });

  test('Search by phone number works', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/admin/razorpay-subscriptions?search=9970100783`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    for (const order of data.orders) {
      expect(order.user_mobile).toContain('9970100783');
    }
  });

  test('Search by order_id works', async ({ request }) => {
    // First get an order ID
    const listResponse = await request.get(`${baseUrl}/api/admin/razorpay-subscriptions`);
    const listData = await listResponse.json();
    
    if (listData.orders.length > 0) {
      const orderId = listData.orders[0].order_id;
      
      const response = await request.get(`${baseUrl}/api/admin/razorpay-subscriptions?search=${orderId}`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      const found = data.orders.some(o => o.order_id === orderId);
      expect(found).toBeTruthy();
    }
  });

  test('Filter by status=paid works', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/admin/razorpay-subscriptions?status=paid`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    for (const order of data.orders) {
      expect(order.status).toBe('paid');
    }
  });

  test('Filter by status=created works (pending)', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/admin/razorpay-subscriptions?status=created`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    for (const order of data.orders) {
      expect(order.status).toBe('created');
    }
  });

  test('Combined search and filter works', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/admin/razorpay-subscriptions?status=created&search=test`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('orders');
    expect(data).toHaveProperty('stats');
  });
});

test.describe('Payment History API Tests', () => {
  const baseUrl = process.env.REACT_APP_BACKEND_URL || 'https://burn-scheduler-fix.preview.emergentagent.com';
  const testUserId = '73b95483-f36b-4637-a5ee-d447300c6835';

  test('GET /api/razorpay/payment-history/{user_id}?include_all=true returns all payments with status_message', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/razorpay/payment-history/${testUserId}?include_all=true`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('payments');
    
    if (data.payments.length > 0) {
      const payment = data.payments[0];
      
      // Critical: Verify status_message is present
      expect(payment).toHaveProperty('status_message');
      expect(payment).toHaveProperty('status_color');
    }
  });

  test('Payment history status_message matches status', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/razorpay/payment-history/${testUserId}?include_all=true`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    for (const payment of data.payments) {
      if (payment.status === 'paid') {
        expect(payment.status_message.toLowerCase()).toMatch(/successful|activated/);
      } else if (payment.status === 'created') {
        expect(payment.status_message.toLowerCase()).toContain('pending');
      } else if (payment.status === 'failed') {
        expect(payment.status_message.toLowerCase()).toContain('failed');
      }
    }
  });

  test('Payment history without include_all returns only successful', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/razorpay/payment-history/${testUserId}`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('payments');
  });
});

test.describe('Sync Pending API Tests', () => {
  const baseUrl = process.env.REACT_APP_BACKEND_URL || 'https://burn-scheduler-fix.preview.emergentagent.com';

  test('POST /api/admin/razorpay/sync-pending works correctly', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/admin/razorpay/sync-pending`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Verify response structure
    expect(data).toHaveProperty('success');
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('synced');
    expect(data).toHaveProperty('total_pending');
  });

  test('Sync-pending returns results array with order details', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/admin/razorpay/sync-pending`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      expect(result).toHaveProperty('order_id');
      expect(result).toHaveProperty('user_id');
      expect(result).toHaveProperty('status');
    }
  });

  test('Sync-pending handles errors gracefully', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/admin/razorpay/sync-pending`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // If there are errors, they should be properly formatted
    if (data.errors && data.errors.length > 0) {
      const error = data.errors[0];
      expect(error).toHaveProperty('order_id');
      expect(error).toHaveProperty('error');
    }
  });
});

test.describe('Razorpay Config API Tests', () => {
  const baseUrl = process.env.REACT_APP_BACKEND_URL || 'https://burn-scheduler-fix.preview.emergentagent.com';

  test('GET /api/razorpay/config returns gateway configuration', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/razorpay/config`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    expect(data).toHaveProperty('key_id');
    expect(data).toHaveProperty('enabled');
    expect(data).toHaveProperty('currency');
    expect(data.currency).toBe('INR');
  });
});

test.describe('Update Order Status API Tests', () => {
  const baseUrl = process.env.REACT_APP_BACKEND_URL || 'https://burn-scheduler-fix.preview.emergentagent.com';

  test('Update order status requires order_id and status', async ({ request }) => {
    // Missing order_id
    const response1 = await request.post(`${baseUrl}/api/razorpay/update-order-status`, {
      data: { status: 'failed' }
    });
    expect(response1.status()).toBe(400);

    // Missing status
    const response2 = await request.post(`${baseUrl}/api/razorpay/update-order-status`, {
      data: { order_id: 'test123' }
    });
    expect(response2.status()).toBe(400);
  });

  test('Update order status validates status values', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/razorpay/update-order-status`, {
      data: {
        order_id: 'test123',
        status: 'invalid_status'
      }
    });
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.detail).toContain('Invalid status');
  });
});
