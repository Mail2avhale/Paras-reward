import { test, expect } from '@playwright/test';
import { DMT_TEST_CREDENTIALS } from '../fixtures/helpers';

/**
 * API Tests for Payment History Features
 * Iteration 105: User subscription page improvements
 */

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://mining-dash-2.preview.emergentagent.com';
const TEST_USER_ID = DMT_TEST_CREDENTIALS.userId;

test.describe('Payment History API Integration', () => {
  
  test('payment history API returns correct structure with include_all', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/razorpay/payment-history/${TEST_USER_ID}?include_all=true`
    );
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('payments');
    expect(Array.isArray(data.payments)).toBeTruthy();
    
    // Each payment should have required fields
    for (const payment of data.payments) {
      expect(payment).toHaveProperty('status_message');
      expect(payment).toHaveProperty('status_color');
      expect(payment).toHaveProperty('plan_name');
      expect(payment).toHaveProperty('plan_type');
      expect(payment).toHaveProperty('amount');
      expect(payment).toHaveProperty('status');
    }
  });

  test('subscription user API returns correct subscription data', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/subscription/user/${TEST_USER_ID}`
    );
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('subscription');
    expect(data.subscription).toHaveProperty('plan');
    expect(data.subscription).toHaveProperty('plan_name');
    expect(data.subscription).toHaveProperty('is_expired');
    expect(data.subscription).toHaveProperty('days_remaining');
  });

  test('razorpay config API returns enabled status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/razorpay/config`);
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('enabled');
    expect(typeof data.enabled).toBe('boolean');
    expect(data).toHaveProperty('key_id');
  });

  test('payment history API returns status_message with correct emoji for each status', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/razorpay/payment-history/${TEST_USER_ID}?include_all=true`
    );
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Verify status message content based on status
    for (const payment of data.payments) {
      const status = payment.status;
      const statusMessage = payment.status_message;
      const statusColor = payment.status_color;
      
      if (status === 'paid') {
        expect(statusMessage).toContain('✅');
        expect(statusColor).toBe('green');
      } else if (status === 'created') {
        expect(statusMessage).toContain('⏳');
        expect(statusColor).toBe('yellow');
      } else if (status === 'failed') {
        expect(statusMessage).toContain('❌');
        expect(statusColor).toBe('red');
      } else if (status === 'error') {
        expect(statusMessage).toContain('⚠️');
        expect(statusColor).toBe('orange');
      } else if (status === 'cancelled') {
        expect(statusMessage).toContain('🚫');
        expect(statusColor).toBe('gray');
      }
    }
  });
});
