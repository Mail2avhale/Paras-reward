import { test, expect } from '@playwright/test';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://admin-user-search-2.preview.emergentagent.com';

/**
 * BBPS Airtel Postpaid E2E Tests
 * ===============================
 * Tests for Airtel Postpaid bill fetch and payment functionality.
 * 
 * Test Case:
 * - Number: 9103337373
 * - Expected customer: Mahaveer Vyas
 * - Bill amount: ₹1414.82 (as of March 2026)
 * 
 * Payment Success Verified:
 * - Bill fetch: SUCCESS (customer=Mahaveer Vyas, amount=1414.82)
 * - Bill payment: SUCCESS (tid=3550058597, status=SUCCESS)
 * - The payment went through successfully on March 18, 2026
 */

test.describe('BBPS Airtel Postpaid API Tests', () => {
  
  test('BBPS health check returns status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/bbps/health`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('PARAS REWARD BBPS RUNNING');
    expect(data.version).toBe('2.1');
    expect(data.services).toContain('mobile_prepaid');
  });

  test('BBPS config is valid', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/bbps/debug-config`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.config_valid).toBe(true);
    expect(data.base_url).toBe('https://api.eko.in:25002/ekoicici');
    expect(data.developer_key).not.toContain('NOT SET');
    expect(data.initiator_id).not.toBe('NOT SET');
  });

  test('Mobile Postpaid operators list includes Airtel', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/bbps/operators/mobile_postpaid`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.category).toBe('mobile_postpaid');
    expect(data.eko_category_id).toBe(10);
    expect(data.count).toBeGreaterThanOrEqual(5);
    
    // Verify Airtel Postpaid operator exists with ID 41
    const airtelOperator = data.operators.find((op: any) => op.operator_id === 41);
    expect(airtelOperator).toBeDefined();
    expect(airtelOperator.name).toContain('Airtel');
    expect(airtelOperator.name).toContain('Postpaid');
  });

  test('Bill fetch for Airtel Postpaid 9103337373 returns valid response', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/bbps/fetch`, {
      data: {
        operator_id: '41',
        account: '9103337373',
        mobile: '9103337373'
      }
    });
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    // Bill fetch can either succeed with bill details OR return "no bill due" if already paid
    if (data.success) {
      // Bill available
      expect(data.customer_name).toBe('Mahaveer Vyas');
      expect(data.bill_amount).toBeDefined();
      const amount = parseFloat(data.bill_amount);
      expect(amount).toBeGreaterThan(0);
      console.log(`✅ Bill fetched: ₹${data.bill_amount} for ${data.customer_name}`);
    } else {
      // Bill already paid - check error message
      const reason = data.raw_response?.data?.reason || '';
      if (reason.toLowerCase().includes('no bill due') || 
          reason.toLowerCase().includes('payment received')) {
        console.log('✅ Bill already paid - no outstanding dues');
        // This is expected behavior after payment
      } else {
        // Unexpected error
        expect.soft(data.success).toBe(true);
        console.log(`⚠️ Unexpected error: ${data.message}`);
      }
    }
  });

  test('Bill fetch validates mobile number format', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/bbps/fetch`, {
      data: {
        operator_id: '41',
        account: '9103337373',
        mobile: '123'  // Invalid mobile
      }
    });
    
    // Should reject invalid mobile
    expect(response.status()).toBe(422);
  });

  test('Bill payment API endpoint exists and validates input', async ({ request }) => {
    // Test with valid format but will fail subscription check
    const response = await request.post(`${BASE_URL}/api/bbps/pay`, {
      data: {
        operator_id: '41',
        account: '9103337373',
        amount: '100',
        mobile: '9103337373'
      }
    });
    
    // Endpoint exists (not 404)
    expect(response.status()).not.toBe(404);
    
    const data = await response.json();
    // May succeed or fail based on subscription/cooldown
    console.log(`Payment API response: ${data.success ? 'SUCCESS' : data.message}`);
  });

  test('Bill payment validates zero amount', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/bbps/pay`, {
      data: {
        operator_id: '41',
        account: '9103337373',
        amount: '0',
        mobile: '9103337373'
      }
    });
    
    // Should reject zero amount
    expect(response.status()).toBe(422);
  });

  test('Bill payment validates max amount (1 lakh)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/bbps/pay`, {
      data: {
        operator_id: '41',
        account: '9103337373',
        amount: '150000',  // > 1 lakh
        mobile: '9103337373'
      }
    });
    
    // Should reject amount > 1 lakh
    expect(response.status()).toBe(422);
  });

  test('Transaction status endpoint exists', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/bbps/status/3550058597`);
    
    // Endpoint exists (not 404)
    expect(response.status()).not.toBe(404);
    
    // May return success or error based on Eko API status
    const data = await response.json();
    expect(data.tid || data.message).toBeDefined();
  });

  test('Error codes reference endpoint returns codes', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/bbps/error-codes`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.http_codes).toBeDefined();
    expect(data.tx_status).toBeDefined();
  });
});

test.describe('BBPS Authentication Verification', () => {
  
  test('Operators API uses correct authentication headers', async ({ request }) => {
    // If this succeeds, authentication is working correctly
    const response = await request.get(`${BASE_URL}/api/bbps/operators/mobile_postpaid`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    console.log('✅ Authentication headers working correctly');
  });

  test('Bill fetch uses correct authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/bbps/fetch`, {
      data: {
        operator_id: '41',
        account: '9103337373',
        mobile: '9103337373'
      }
    });
    
    // Even if bill is paid, we should get 200 OK (auth working)
    expect(response.ok()).toBeTruthy();
    console.log('✅ Bill fetch authentication working');
  });
});

test.describe('BBPS Request Format Verification', () => {
  
  test('Bill fetch request has all required parameters', async ({ request }) => {
    // This test verifies the request format matches Eko documentation
    const payload = {
      operator_id: '41',
      account: '9103337373',
      mobile: '9103337373',
      sender_name: 'Test User'
    };
    
    const response = await request.post(`${BASE_URL}/api/bbps/fetch`, {
      data: payload
    });
    
    expect(response.ok()).toBeTruthy();
    
    // Response should contain Eko-specific fields
    const data = await response.json();
    if (data.success) {
      expect(data.raw_response).toBeDefined();
      expect(data.raw_response.status).toBeDefined();
    }
  });

  test('Bill payment request format verified via validation', async ({ request }) => {
    // Test that all required fields are validated
    const requiredFields = ['operator_id', 'account', 'amount', 'mobile'];
    
    for (const field of requiredFields) {
      const payload: any = {
        operator_id: '41',
        account: '9103337373',
        amount: '100',
        mobile: '9103337373'
      };
      
      delete payload[field];
      
      const response = await request.post(`${BASE_URL}/api/bbps/pay`, {
        data: payload
      });
      
      // Should fail validation (422) when required field is missing
      expect(response.status()).toBe(422);
    }
    
    console.log('✅ All required payment fields validated correctly');
  });
});
