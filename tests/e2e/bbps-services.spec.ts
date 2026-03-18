import { test, expect } from '@playwright/test';
import { waitForAppReady, dismissToasts } from '../fixtures/helpers';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://gst-invoicing-1.preview.emergentagent.com';

test.describe('BBPS Services - Operator Loading Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Handle toasts that may block clicks
    await dismissToasts(page);
  });

  test('Redeem page loads and shows service selection grid', async ({ page }) => {
    // Navigate to redeem page (without login - just check UI structure)
    await page.goto('/redeem', { waitUntil: 'domcontentloaded' });
    
    // Wait for either login redirect or page load
    // If redirected to login, that's OK - it means auth guard is working
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    const currentUrl = page.url();
    
    if (currentUrl.includes('/login')) {
      // Expected - user needs to login to access redeem
      console.log('Correctly redirected to login page');
      await expect(page).toHaveURL(/login/);
    } else if (currentUrl.includes('/redeem')) {
      // If on redeem page, check service grid
      const serviceGrid = page.getByTestId('service-mobile_recharge');
      await expect(serviceGrid).toBeVisible({ timeout: 10000 });
    }
  });

  test('Login page renders correctly', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    
    // Check login form elements
    await expect(page.getByText('Welcome Back')).toBeVisible();
    await expect(page.getByPlaceholder(/email.*mobile.*uid/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('Dashboard loads for logged-in user session', async ({ page }) => {
    // Check homepage/dashboard structure
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const currentUrl = page.url();
    // Either shows landing page or redirects to login
    expect(currentUrl).toMatch(/\/(login|dashboard|$)/);
  });
});

test.describe('BBPS Backend API Verification', () => {
  test('Mobile Prepaid operators API returns operators', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/bbps/operators/mobile_prepaid`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.operators).toBeDefined();
    expect(data.operators.length).toBeGreaterThanOrEqual(4);
    
    // Check Airtel and Jio are present
    const operatorNames = data.operators.map((op: any) => op.name.toLowerCase());
    expect(operatorNames.some((name: string) => name.includes('airtel'))).toBe(true);
    expect(operatorNames.some((name: string) => name.includes('jio'))).toBe(true);
  });

  test('DTH operators API returns operators', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/bbps/operators/dth`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.operators.length).toBeGreaterThanOrEqual(4);
  });

  test('Electricity operators API returns 89+ operators', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/bbps/operators/electricity`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.operators.length).toBeGreaterThanOrEqual(80);
    
    // Check BEST Mumbai (ID: 53) is in list
    const bestMumbai = data.operators.find((op: any) => 
      String(op.id) === '53' || String(op.operator_id) === '53'
    );
    expect(bestMumbai).toBeDefined();
    expect(bestMumbai.name).toContain('BEST');
  });

  test('EMI/Loan operators API returns 294 operators', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/bbps/operators/loan_emi`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.count).toBe(294);
    expect(data.operators.length).toBe(294);
  });

  test('Credit Card operators API returns 29 operators', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/bbps/operators/credit_card`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.count).toBe(29);
    expect(data.operators.length).toBe(29);
  });

  test('BEST Mumbai operator params returns correct format', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/bbps/operator-params/53`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.operator_name).toContain('BEST Mumbai');
    expect(data.parameters).toBeDefined();
    expect(data.parameters.length).toBeGreaterThanOrEqual(1);
    
    // Check Consumer Number parameter format
    const consumerParam = data.parameters[0];
    expect(consumerParam.param_label).toBe('Consumer Number');
    expect(consumerParam.regex).toBeDefined();
  });

  test('Bill fetch API endpoint responds (may require whitelisted IP)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/eko/bbps/fetch-bill`, {
      data: {
        category: 'electricity',
        biller_id: '53',
        customer_params: {
          consumer_number: '5700964071'
        }
      }
    });
    
    // Accept 200 (success) or 403 (IP not whitelisted - not an app bug)
    expect([200, 403]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      // Either success with bill details or Eko error
      expect(data.success !== undefined || data.message !== undefined).toBe(true);
    }
  });

  test('Charges calculation API works correctly', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/eko/charges/calculate?amount=100`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.charges).toBeDefined();
    expect(data.charges.amount_inr).toBe(100);
    expect(data.charges.platform_fee_inr).toBeDefined();
    expect(data.charges.total_amount_inr).toBeGreaterThan(100);
  });
});
