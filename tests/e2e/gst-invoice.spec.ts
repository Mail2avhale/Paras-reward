/**
 * GST Invoice System E2E Tests - Simplified
 * ==========================================
 * Tests for the GST Invoice APIs and MyInvoices page
 */

import { test, expect } from '@playwright/test';

// Test user credentials
const TEST_USER = {
  mobile: '9970100782',
  pin: '997010',
  uid: 'cbdf46d7-7d66-4d43-8495-e1432a2ab071'
};

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://prc-economy-fix.preview.emergentagent.com';

test.describe('GST Invoice API Tests', () => {
  test('User invoices API returns correct structure', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/invoice/user/${TEST_USER.uid}`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('invoices');
    expect(data).toHaveProperty('count');
    expect(Array.isArray(data.invoices)).toBe(true);
    expect(data.invoices.length).toBeGreaterThan(0);
    
    // Verify first invoice structure
    const invoice = data.invoices[0];
    expect(invoice).toHaveProperty('invoice_id');
    expect(invoice).toHaveProperty('invoice_number');
    expect(invoice).toHaveProperty('amount');
    expect(invoice).toHaveProperty('gst_breakdown');
    expect(invoice).toHaveProperty('plan_name');
    expect(invoice).toHaveProperty('plan_type');
  });

  test('Invoice number follows PRC-YYYY-XXXXX format', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/invoice/user/${TEST_USER.uid}`);
    const data = await response.json();
    
    const invoiceNumber = data.invoices[0].invoice_number;
    const pattern = /^PRC-\d{4}-\d{5}$/;
    expect(invoiceNumber).toMatch(pattern);
  });

  test('GST breakdown shows correct 9% CGST + 9% SGST split', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/invoice/user/${TEST_USER.uid}`);
    const data = await response.json();
    
    const gst = data.invoices[0].gst_breakdown;
    
    // Verify GST rates
    expect(gst.cgst_rate).toBe(9);
    expect(gst.sgst_rate).toBe(9);
    
    // Verify CGST = SGST (equal split)
    expect(Math.abs(gst.cgst - gst.sgst)).toBeLessThan(0.01);
    
    // Verify base + gst = total
    expect(Math.abs(gst.base_amount + gst.gst_amount - gst.total_amount)).toBeLessThan(0.01);
  });

  test('Invoice PDF download returns valid PDF base64', async ({ request }) => {
    const listResponse = await request.get(`${BASE_URL}/api/invoice/user/${TEST_USER.uid}`);
    const listData = await listResponse.json();
    
    const invoiceId = listData.invoices[0].invoice_id;
    
    const pdfResponse = await request.get(`${BASE_URL}/api/invoice/${invoiceId}/pdf`);
    expect(pdfResponse.ok()).toBeTruthy();
    
    const pdfData = await pdfResponse.json();
    expect(pdfData.success).toBe(true);
    expect(pdfData).toHaveProperty('pdf_base64');
    expect(pdfData.content_type).toBe('application/pdf');
    expect(pdfData.filename).toMatch(/\.pdf$/);
    
    // Verify PDF starts with %PDF
    const decodedStart = atob(pdfData.pdf_base64.slice(0, 20));
    expect(decodedStart).toContain('%PDF');
  });

  test('Admin invoice list returns GST summary for reporting', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/invoice/admin/all?limit=10`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('invoices');
    expect(data).toHaveProperty('pagination');
    expect(data).toHaveProperty('gst_summary');
    
    // Verify GST summary has all fields needed for tax reporting
    const gstSummary = data.gst_summary;
    expect(gstSummary).toHaveProperty('total_base_amount');
    expect(gstSummary).toHaveProperty('total_gst');
    expect(gstSummary).toHaveProperty('total_cgst');
    expect(gstSummary).toHaveProperty('total_sgst');
    expect(gstSummary).toHaveProperty('total_amount');
  });

  test('Invoice generation with correct GST calculation', async ({ request }) => {
    const testPaymentId = `pay_test_e2e_${Date.now()}`;
    const testAmount = 999;
    
    const response = await request.post(`${BASE_URL}/api/invoice/generate`, {
      data: {
        user_id: TEST_USER.uid,
        amount: testAmount,
        payment_id: testPaymentId,
        plan_name: 'growth',
        plan_type: 'monthly'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('invoice_id');
    expect(data).toHaveProperty('invoice_number');
    expect(data).toHaveProperty('gst_breakdown');
    expect(data).toHaveProperty('pdf_base64');
    
    // Verify GST calculation
    const gst = data.gst_breakdown;
    expect(gst.total_amount).toBe(testAmount);
    expect(Math.abs(gst.base_amount + gst.gst_amount - gst.total_amount)).toBeLessThan(0.01);
    expect(Math.abs(gst.cgst + gst.sgst - gst.gst_amount)).toBeLessThan(0.01);
    expect(gst.cgst_rate).toBe(9);
    expect(gst.sgst_rate).toBe(9);
  });

  test('Duplicate payment_id returns existing invoice', async ({ request }) => {
    const testPaymentId = `pay_test_dup_e2e_${Date.now()}`;
    
    // First request
    const response1 = await request.post(`${BASE_URL}/api/invoice/generate`, {
      data: {
        user_id: TEST_USER.uid,
        amount: 599,
        payment_id: testPaymentId,
        plan_name: 'startup',
        plan_type: 'monthly'
      }
    });
    
    const data1 = await response1.json();
    expect(data1.success).toBe(true);
    
    // Second request with same payment_id
    const response2 = await request.post(`${BASE_URL}/api/invoice/generate`, {
      data: {
        user_id: TEST_USER.uid,
        amount: 599,
        payment_id: testPaymentId,
        plan_name: 'startup',
        plan_type: 'monthly'
      }
    });
    
    const data2 = await response2.json();
    expect(data2.success).toBe(true);
    expect(data2.invoice_id).toBe(data1.invoice_id);
    expect(data2.invoice_number).toBe(data1.invoice_number);
    expect(data2.message).toContain('already exists');
  });

  test('Get single invoice returns full details with company info', async ({ request }) => {
    const listResponse = await request.get(`${BASE_URL}/api/invoice/user/${TEST_USER.uid}`);
    const listData = await listResponse.json();
    
    const invoiceId = listData.invoices[0].invoice_id;
    
    const response = await request.get(`${BASE_URL}/api/invoice/${invoiceId}`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.invoice.company.name).toBe('PARAS REWARD TECHNOLOGIES PRIVATE LIMITED');
    expect(data.invoice.company.gstin).toBe('27AAQCP6686E1ZR');
    expect(data.invoice.company.address).toBe('Maharashtra, India');
  });

  test('Invalid user returns 404', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/invoice/generate`, {
      data: {
        user_id: 'invalid-user-id-xyz',
        amount: 499,
        payment_id: `pay_test_invalid_${Date.now()}`,
        plan_name: 'startup',
        plan_type: 'monthly'
      }
    });
    
    expect(response.status()).toBe(404);
  });
});

test.describe('MyInvoices Page UI', () => {
  test('Page loads correctly after login', async ({ page }) => {
    // Navigate to login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Enter mobile number
    await page.getByPlaceholder(/email, mobile or uid/i).fill(TEST_USER.mobile);
    await page.getByRole('button', { name: /sign in/i }).click();
    
    await page.waitForTimeout(2000);
    
    // Enter PIN
    const inputs = page.locator('input');
    for (let i = 1; i <= 6; i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        await input.fill(TEST_USER.pin[i-1]);
      }
    }
    
    await page.waitForTimeout(2000);
    
    // Navigate to my-invoices
    await page.goto('/my-invoices', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Verify page elements
    await expect(page.getByTestId('my-invoices-page')).toBeVisible();
    await expect(page.getByTestId('invoices-page-title')).toHaveText('My Invoices');
    
    // Verify invoices are loaded
    await expect(page.getByTestId('invoices-list')).toBeVisible();
    
    // Verify first invoice card
    await expect(page.getByTestId('invoice-card-0')).toBeVisible();
    await expect(page.getByTestId('invoice-number-0')).toBeVisible();
    
    // Verify invoice number format
    const invoiceNumber = await page.getByTestId('invoice-number-0').textContent();
    expect(invoiceNumber).toMatch(/^PRC-\d{4}-\d{5}$/);
  });

  test('Invoice cards show GST breakdown', async ({ page }) => {
    // Login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await page.getByPlaceholder(/email, mobile or uid/i).fill(TEST_USER.mobile);
    await page.getByRole('button', { name: /sign in/i }).click();
    
    await page.waitForTimeout(2000);
    
    const inputs = page.locator('input');
    for (let i = 1; i <= 6; i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        await input.fill(TEST_USER.pin[i-1]);
      }
    }
    
    await page.waitForTimeout(2000);
    
    await page.goto('/my-invoices', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Verify GST breakdown elements
    await expect(page.getByTestId('invoice-amount-0')).toBeVisible();
    await expect(page.getByTestId('invoice-base-amount-0')).toBeVisible();
    await expect(page.getByTestId('invoice-gst-amount-0')).toBeVisible();
    await expect(page.getByTestId('invoice-plan-0')).toBeVisible();
    
    // Verify download button exists
    await expect(page.getByTestId('download-invoice-btn-0')).toBeVisible();
    await expect(page.getByTestId('download-invoice-btn-0')).toContainText('Download Invoice PDF');
  });

  test('Page shows company GSTIN in footer', async ({ page }) => {
    await page.goto('/my-invoices', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const pageContent = await page.content();
    expect(pageContent).toContain('27AAQCP6686E1ZR');
    expect(pageContent).toContain('PARAS REWARD TECHNOLOGIES PRIVATE LIMITED');
  });
});
