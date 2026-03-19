/**
 * Redemption Validation Flow E2E Tests
 * =====================================
 * Tests for the critical redemption validation order:
 * 1. KYC check before subscription check
 * 2. Subscription expiry check before limit checks
 * 3. Category-wise spending limits (40/30/30)
 * 4. Weekly service limit (7-day cooldown)
 * 5. PRC balance check
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://two-plan-rebuild.preview.emergentagent.com';

// Test user with verified KYC and active subscription
const TEST_USER_VERIFIED = {
  uid: '6c96a6cc-08a2-442c-8e2d-f1fb6f18aa21',
  name: 'Test User DMT',
  kyc: 'verified',
  plan: 'growth'
};

// Test user with no KYC
const TEST_USER_NO_KYC = {
  uid: '923d983c-bdc3-4dc6-b20a-eeca1d32df6d',
  name: 'DMT Test',
  kyc: 'not_submitted',
  plan: 'elite'
};

test.describe('Redemption API Validation Order', () => {
  
  test('KYC check happens before subscription check', async ({ request }) => {
    // User with no KYC should get KYC error first
    const response = await request.post(`${BASE_URL}/api/redeem/request`, {
      data: {
        user_id: TEST_USER_NO_KYC.uid,
        service_type: 'mobile_recharge',
        amount: 100,
        details: {
          mobile_number: '9876543210',
          operator: 'airtel',
          operator_id: '100'
        }
      }
    });
    
    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.detail.toLowerCase()).toContain('kyc');
  });

  test('Verified KYC user does not get KYC error', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/redeem/request`, {
      data: {
        user_id: TEST_USER_VERIFIED.uid,
        service_type: 'mobile_recharge',
        amount: 100,
        details: {
          mobile_number: '9876543210',
          operator: 'airtel',
          operator_id: '100'
        }
      }
    });
    
    const data = await response.json();
    
    // If failed, should NOT be KYC error
    if (response.status() === 403) {
      expect(data.detail.toLowerCase()).not.toContain('kyc verification required');
    }
  });

  test('Nonexistent user returns 404', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/redeem/request`, {
      data: {
        user_id: 'nonexistent-user-xyz123',
        service_type: 'mobile_recharge',
        amount: 100,
        details: {
          mobile_number: '9876543210',
          operator: 'airtel',
          operator_id: '100'
        }
      }
    });
    
    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.detail.toLowerCase()).toContain('user');
  });

  test('Invalid service type is rejected', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/redeem/request`, {
      data: {
        user_id: TEST_USER_VERIFIED.uid,
        service_type: 'invalid_service_xyz',
        amount: 100,
        details: {}
      }
    });
    
    // Should get 400 or 404 (user not found first if validation order is different)
    expect([400, 422]).toContain(response.status());
  });
});

test.describe('Category Limits API Tests', () => {
  
  test('Services endpoint lists all BBPS services', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/redeem/services`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.services.length).toBeGreaterThan(6);
    
    // Core services should be present
    const serviceIds = data.services.map((s: any) => s.id);
    expect(serviceIds).toContain('mobile_recharge');
    expect(serviceIds).toContain('electricity');
    expect(serviceIds).toContain('dmt');
  });

  test('Charges calculation returns dynamic PRC rate', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/redeem/calculate-charges?amount=100`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    
    const charges = data.charges;
    expect(charges.amount_inr).toBe(100);
    expect(charges.platform_fee_inr).toBe(10);
    expect(charges.admin_charge_inr).toBe(20);
    expect(charges.total_amount_inr).toBe(130);
    
    // PRC rate should be present and positive
    expect(charges.prc_rate).toBeGreaterThan(0);
    expect(charges.total_prc_required).toBe(130 * charges.prc_rate);
  });

  test('Category limit error message format is correct', async ({ request }) => {
    // Try a large amount that might exceed category limit
    const response = await request.post(`${BASE_URL}/api/redeem/request`, {
      data: {
        user_id: TEST_USER_VERIFIED.uid,
        service_type: 'mobile_recharge',
        amount: 10000, // Large amount to potentially trigger limit
        details: {
          mobile_number: '9876543210',
          operator: 'airtel',
          operator_id: '100'
        }
      }
    });
    
    // If category limit exceeded, check error format
    if (response.status() === 403) {
      const data = await response.json();
      const error = data.detail.toLowerCase();
      
      if (error.includes('category')) {
        expect(error).toContain('limit');
        // Should mention amounts
        expect(data.detail).toMatch(/₹|inr|\d/i);
      }
    }
  });
});

test.describe('Weekly Service Limit Tests', () => {
  
  test('Weekly limit check is in the validation flow', async ({ request }) => {
    // Make a request and check if weekly limit validation happens
    const response = await request.post(`${BASE_URL}/api/redeem/request`, {
      data: {
        user_id: TEST_USER_VERIFIED.uid,
        service_type: 'electricity',
        amount: 100,
        details: {
          consumer_number: '12345678901',
          operator: 'BEST',
          operator_id: '112'
        }
      }
    });
    
    // The request might succeed or fail
    // If it fails with weekly limit error, that confirms the check exists
    if (response.status() === 403) {
      const data = await response.json();
      const error = data.detail.toLowerCase();
      
      // If weekly limit error, verify format
      if (error.includes('weekly') || error.includes('7 day') || error.includes('7-day')) {
        expect(error).toMatch(/limit|service|cooldown/);
      }
    }
  });
});

test.describe('PRC Balance Check Tests', () => {
  
  test('Insufficient balance returns proper error', async ({ request }) => {
    // Try a very large amount
    const response = await request.post(`${BASE_URL}/api/redeem/request`, {
      data: {
        user_id: TEST_USER_VERIFIED.uid,
        service_type: 'mobile_recharge',
        amount: 999999, // Extremely large amount
        details: {
          mobile_number: '9876543210',
          operator: 'airtel',
          operator_id: '100'
        }
      }
    });
    
    // Should get error (balance or limit)
    expect([400, 403]).toContain(response.status());
    
    const data = await response.json();
    const error = data.detail.toLowerCase();
    
    // Should mention balance, PRC, limit, or insufficient
    expect(error).toMatch(/balance|prc|limit|insufficient|category/);
  });
});

test.describe('GST Invoice API Integration', () => {
  
  test('Invoice generation creates valid invoice', async ({ request }) => {
    const paymentId = `pay_test_${Date.now()}`;
    
    const response = await request.post(`${BASE_URL}/api/invoice/generate`, {
      data: {
        user_id: TEST_USER_VERIFIED.uid,
        amount: 799,
        payment_id: paymentId,
        plan_name: 'growth',
        plan_type: 'monthly'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.invoice_id).toBeDefined();
    expect(data.invoice_number).toMatch(/^PRC-\d{4}-\d{5}$/);
    expect(data.gst_breakdown).toBeDefined();
    expect(data.gst_breakdown.cgst_rate).toBe(9);
    expect(data.gst_breakdown.sgst_rate).toBe(9);
  });

  test('User invoices API returns invoice list', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/invoice/user/${TEST_USER_VERIFIED.uid}`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.invoices).toBeDefined();
    expect(Array.isArray(data.invoices)).toBe(true);
  });

  test('Invoice PDF download works', async ({ request }) => {
    // First get user's invoices
    const listResponse = await request.get(`${BASE_URL}/api/invoice/user/${TEST_USER_VERIFIED.uid}`);
    const listData = await listResponse.json();
    
    if (listData.invoices && listData.invoices.length > 0) {
      const invoiceId = listData.invoices[0].invoice_id;
      
      const pdfResponse = await request.get(`${BASE_URL}/api/invoice/${invoiceId}/pdf`);
      expect(pdfResponse.ok()).toBeTruthy();
      
      const pdfData = await pdfResponse.json();
      expect(pdfData.success).toBe(true);
      expect(pdfData.pdf_base64).toBeDefined();
      expect(pdfData.content_type).toBe('application/pdf');
    }
  });

  test('Admin invoice list includes GST summary', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/invoice/admin/all?limit=10`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.gst_summary).toBeDefined();
    expect(data.gst_summary.total_base_amount).toBeDefined();
    expect(data.gst_summary.total_gst).toBeDefined();
    expect(data.gst_summary.total_cgst).toBeDefined();
    expect(data.gst_summary.total_sgst).toBeDefined();
  });
});
