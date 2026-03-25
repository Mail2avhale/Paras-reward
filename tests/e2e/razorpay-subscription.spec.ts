import { test, expect } from '@playwright/test';
import { dismissToasts } from '../fixtures/helpers';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://codebase-purge.preview.emergentagent.com';

test.describe('Razorpay Integration & Subscription Plans', () => {
  
  test.describe('Backend API Tests', () => {
    
    test('Razorpay config returns live key (rzp_live_*)', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/razorpay/config`);
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      
      // Verify live key format
      expect(data.key_id).toBeDefined();
      expect(data.key_id).toMatch(/^rzp_live_/);
      expect(data.currency).toBe('INR');
      expect(data.company_name).toBeDefined();
    });
    
    test('Order creation API works correctly', async ({ request }) => {
      const orderData = {
        user_id: `test-playwright-${Date.now()}`,
        plan_type: 'monthly',
        plan_name: 'startup',
        amount: 299
      };
      
      const response = await request.post(`${API_BASE}/api/razorpay/create-order`, {
        data: orderData
      });
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      
      expect(data.order_id).toBeDefined();
      expect(data.order_id).toMatch(/^order_/);
      expect(data.amount).toBe(29900); // 299 * 100 paise
      expect(data.currency).toBe('INR');
      expect(data.key_id).toMatch(/^rzp_live_/);
    });
    
    test('Subscription plans API returns valid plans', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/subscription/plans`);
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      
      expect(data.plans).toBeDefined();
      expect(data.plans.length).toBeGreaterThanOrEqual(2);
      
      // Verify plan structure - at least Explorer and one paid plan
      const planIds = data.plans.map((p: any) => p.id);
      expect(planIds).toContain('explorer');
      
      // At least one paid plan
      const paidPlans = data.plans.filter((p: any) => !p.is_free);
      expect(paidPlans.length).toBeGreaterThanOrEqual(1);
    });
    
  });
  
  test.describe('Subscription Page UI Tests', () => {
    
    test.beforeEach(async ({ page }) => {
      await dismissToasts(page);
    });
    
    // Helper to login
    async function loginUser(page: any) {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      const emailInput = page.locator('input').first();
      await emailInput.fill('testmember@paras.com');
      await page.getByRole('button', { name: /Sign In/i }).click();
      await page.waitForTimeout(2000);
      
      const pinInputs = page.locator('input[type="password"], input[inputmode="numeric"]');
      const pin = '123456';
      for (let i = 0; i < 6; i++) {
        await pinInputs.nth(i).fill(pin[i]);
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(5000);
    }
    
    test('Subscription plans display correctly', async ({ page }) => {
      await loginUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      // Verify page content shows subscription plans
      const pageContent = await page.content();
      expect(pageContent).toContain('Explorer');
      expect(pageContent).toContain('Startup');
    });
    
    test('Frontend shows 2 payment options: Razorpay and Manual UPI', async ({ page }) => {
      await loginUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      // Select a paid plan
      await page.getByTestId('plan-startup').click({ force: true });
      await page.waitForTimeout(2000);
      
      // Select monthly duration
      await page.getByTestId('duration-monthly').click({ force: true });
      await page.waitForTimeout(2000);
      
      // Check for 2 payment options
      const pageContent = await page.content();
      
      // Razorpay/Online payment option
      expect(pageContent).toContain('Online Payment');
      expect(pageContent).toContain('Instant');
      
      // Manual UPI option
      expect(pageContent).toContain('Manual UPI/Bank Transfer');
      expect(pageContent).toContain('24hr');
    });
    
    test('Razorpay option shows Pay Now button with Instant label', async ({ page }) => {
      await loginUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      await page.getByTestId('plan-startup').click({ force: true });
      await page.waitForTimeout(2000);
      await page.getByTestId('duration-monthly').click({ force: true });
      await page.waitForTimeout(2000);
      
      // Razorpay is selected by default
      // Look for "Pay Now" button with price
      const payNowButton = page.getByRole('button', { name: /Pay.*299.*Now/i });
      await expect(payNowButton).toBeVisible({ timeout: 5000 });
      
      // Verify Instant label
      const pageContent = await page.content();
      expect(pageContent).toContain('Instant');
    });
    
    test('Manual payment shows UTR input and screenshot upload', async ({ page }) => {
      await loginUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      await page.getByTestId('plan-startup').click({ force: true });
      await page.waitForTimeout(2000);
      await page.getByTestId('duration-monthly').click({ force: true });
      await page.waitForTimeout(2000);
      
      // Click on Manual UPI/Bank Transfer option
      await page.getByText('Manual UPI/Bank Transfer').click({ force: true });
      await page.waitForTimeout(2000);
      
      // Scroll to see form
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      
      // Check for UTR input
      const pageContent = await page.content();
      expect(pageContent).toContain('UTR');
      expect(pageContent).toContain('Submit Payment');
      expect(pageContent).toContain('Screenshot');
    });
    
  });
  
});
