import { test, expect } from '@playwright/test';

/**
 * Admin Manual Approval Tests - FAST VERSION
 * Testing white screen issue with button clicks
 */

const BASE_URL = 'https://elite-explorer-app.preview.emergentagent.com';
const ADMIN_UID = '8175c02a-4fbd-409c-8d47-d864e979f59f';
const ADMIN_PIN = '123456';

test.describe('API Tests - Manual Approval', () => {
  
  test('GET /api/admin/bill-payment/requests works', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/bill-payment/requests?limit=5`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.requests).toBeDefined();
  });
  
  test('GET /api/admin/bank-redeem/requests works', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/bank-redeem/requests?limit=5`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.requests).toBeDefined();
  });
  
  test('POST /api/admin/bill-payment/process validates action', async ({ request }) => {
    const listResponse = await request.get(`${BASE_URL}/api/admin/bill-payment/requests?limit=1`);
    const data = await listResponse.json();
    
    if (data.requests.length === 0) {
      test.skip(true, 'No requests available');
      return;
    }
    
    const requestId = data.requests[0].request_id;
    
    // Invalid action should return 400
    const response = await request.post(`${BASE_URL}/api/admin/bill-payment/process`, {
      data: {
        request_id: requestId,
        action: 'invalid_action',
        admin_uid: ADMIN_UID
      }
    });
    
    expect(response.status()).toBe(400);
  });
  
  test('POST /api/admin/bank-redeem/{id}/manual-complete requires UTR', async ({ request }) => {
    const listResponse = await request.get(`${BASE_URL}/api/admin/bank-redeem/requests?limit=10`);
    const data = await listResponse.json();
    
    const pendingRequests = data.requests.filter((r: any) => r.status === 'pending');
    if (pendingRequests.length === 0) {
      test.skip(true, 'No pending requests');
      return;
    }
    
    const requestId = pendingRequests[0].request_id;
    
    // Empty UTR should return 400
    const response = await request.post(`${BASE_URL}/api/admin/bank-redeem/${requestId}/manual-complete`, {
      data: {
        admin_id: ADMIN_UID,
        txn_reference: ''
      }
    });
    
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.detail.toLowerCase()).toContain('utr');
  });
});
