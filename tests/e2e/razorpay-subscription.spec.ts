import { test, expect } from '@playwright/test';
import { waitForAppReady, dismissToasts, loginAsTestUser } from '../fixtures/helpers';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://reward-staging.preview.emergentagent.com';

test.describe('Razorpay Integration & Subscription Plans', () => {
  
  test.describe('Backend API Tests via Frontend', () => {
    
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
      
      // Verify plan structure
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
    
    test('User can login and navigate to subscription page', async ({ page }) => {
      // Login as test user
      await loginAsTestUser(page);
      
      // Wait for dashboard to load
      await page.waitForLoadState('domcontentloaded');
      
      // Navigate to subscription page
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      
      // Take screenshot
      await page.screenshot({ path: 'subscription-page-loaded.jpeg', quality: 20 });
      
      // Verify page loaded (should show subscription title or plans)
      const pageContent = await page.content();
      const hasSubscriptionContent = pageContent.includes('Subscription') || 
                                     pageContent.includes('Plan') ||
                                     pageContent.includes('Explorer') ||
                                     pageContent.includes('Startup') ||
                                     pageContent.includes('Elite');
      
      expect(hasSubscriptionContent).toBe(true);
    });
    
    test('Subscription plans display correctly', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      
      // Wait for plans to load
      await page.waitForTimeout(2000);
      
      // Check for plan cards
      const explorerPlan = page.getByTestId('plan-explorer').or(page.getByText('Explorer'));
      const startupPlan = page.getByTestId('plan-startup').or(page.getByText('Startup'));
      const elitePlan = page.getByTestId('plan-elite').or(page.getByText('Elite'));
      
      // At least 2 plans should be visible
      const explorerVisible = await explorerPlan.first().isVisible().catch(() => false);
      const startupVisible = await startupPlan.first().isVisible().catch(() => false);
      const eliteVisible = await elitePlan.first().isVisible().catch(() => false);
      
      await page.screenshot({ path: 'subscription-plans-display.jpeg', quality: 20 });
      
      // At least two plans should be visible
      const visibleCount = [explorerVisible, startupVisible, eliteVisible].filter(Boolean).length;
      expect(visibleCount).toBeGreaterThanOrEqual(2);
    });
    
    test('Selecting a paid plan shows duration selection', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      // Click on a paid plan (Startup or Elite)
      const startupPlan = page.getByTestId('plan-startup');
      const elitePlan = page.getByTestId('plan-elite');
      
      if (await startupPlan.isVisible()) {
        await startupPlan.click();
      } else if (await elitePlan.isVisible()) {
        await elitePlan.click();
      } else {
        // Try clicking by text if data-testid not found
        await page.getByText('Startup', { exact: true }).first().click().catch(async () => {
          await page.getByText('Elite', { exact: true }).first().click();
        });
      }
      
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'subscription-duration-selection.jpeg', quality: 20 });
      
      // Should show duration selection (Monthly option)
      const monthlyDuration = page.getByTestId('duration-monthly').or(page.getByText(/monthly/i));
      await expect(monthlyDuration.first()).toBeVisible({ timeout: 5000 });
    });
    
    test('Frontend shows 2 payment options: Razorpay and Manual UPI', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      // Select a paid plan
      const startupPlan = page.getByTestId('plan-startup');
      if (await startupPlan.isVisible()) {
        await startupPlan.click();
      } else {
        await page.getByText('Startup', { exact: true }).first().click();
      }
      
      await page.waitForTimeout(1000);
      
      // Select monthly duration
      const monthlyDuration = page.getByTestId('duration-monthly');
      if (await monthlyDuration.isVisible()) {
        await monthlyDuration.click();
      } else {
        await page.getByText(/monthly/i).first().click();
      }
      
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'subscription-payment-options.jpeg', quality: 20 });
      
      // Check for 2 payment options
      const pageContent = await page.content();
      
      // Look for Razorpay/Online payment option
      const hasRazorpayOption = pageContent.includes('Online Payment') || 
                                pageContent.includes('Razorpay') ||
                                pageContent.includes('Instant');
      
      // Look for Manual UPI option
      const hasManualOption = pageContent.includes('Manual') || 
                              pageContent.includes('UPI') ||
                              pageContent.includes('Bank Transfer');
      
      expect(hasRazorpayOption).toBe(true);
      expect(hasManualOption).toBe(true);
    });
    
    test('Razorpay option shows instant activation label', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      // Select a paid plan
      const startupPlan = page.getByTestId('plan-startup');
      if (await startupPlan.isVisible()) {
        await startupPlan.click();
      } else {
        await page.getByText('Startup', { exact: true }).first().click();
      }
      
      await page.waitForTimeout(1000);
      
      // Select monthly duration
      const monthlyDuration = page.getByTestId('duration-monthly');
      if (await monthlyDuration.isVisible()) {
        await monthlyDuration.click();
      } else {
        await page.getByText(/monthly/i).first().click();
      }
      
      await page.waitForTimeout(1000);
      
      // Verify "Instant" label is visible for Razorpay option
      const instantLabel = page.getByText(/⚡.*Instant|Instant/);
      await expect(instantLabel.first()).toBeVisible({ timeout: 5000 });
      
      await page.screenshot({ path: 'subscription-razorpay-instant.jpeg', quality: 20 });
    });
    
    test('Manual payment option shows 24hr activation notice', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      // Navigate to payment method selection
      const startupPlan = page.getByTestId('plan-startup');
      if (await startupPlan.isVisible()) {
        await startupPlan.click();
      } else {
        await page.getByText('Startup', { exact: true }).first().click();
      }
      
      await page.waitForTimeout(1000);
      
      const monthlyDuration = page.getByTestId('duration-monthly');
      if (await monthlyDuration.isVisible()) {
        await monthlyDuration.click();
      } else {
        await page.getByText(/monthly/i).first().click();
      }
      
      await page.waitForTimeout(1000);
      
      // Look for Manual UPI option with 24hr notice
      const pageContent = await page.content();
      const has24hrNotice = pageContent.includes('24hr') || 
                            pageContent.includes('24 hour') ||
                            pageContent.includes('24-hour');
      
      expect(has24hrNotice).toBe(true);
    });
    
    test('Selecting Razorpay payment shows Pay Now button', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      // Navigate to payment selection
      const startupPlan = page.getByTestId('plan-startup');
      if (await startupPlan.isVisible()) {
        await startupPlan.click();
      } else {
        await page.getByText('Startup', { exact: true }).first().click();
      }
      
      await page.waitForTimeout(1000);
      
      const monthlyDuration = page.getByTestId('duration-monthly');
      if (await monthlyDuration.isVisible()) {
        await monthlyDuration.click();
      } else {
        await page.getByText(/monthly/i).first().click();
      }
      
      await page.waitForTimeout(1000);
      
      // Razorpay should be the default selected option
      // Look for "Pay Now" button
      const payNowButton = page.getByRole('button', { name: /Pay.*Now|₹.*Now/i });
      
      await page.screenshot({ path: 'subscription-pay-now-button.jpeg', quality: 20 });
      
      await expect(payNowButton.first()).toBeVisible({ timeout: 5000 });
    });
    
    test('Selecting Manual payment shows UTR input and upload', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      // Navigate to payment selection
      const startupPlan = page.getByTestId('plan-startup');
      if (await startupPlan.isVisible()) {
        await startupPlan.click();
      } else {
        await page.getByText('Startup', { exact: true }).first().click();
      }
      
      await page.waitForTimeout(1000);
      
      const monthlyDuration = page.getByTestId('duration-monthly');
      if (await monthlyDuration.isVisible()) {
        await monthlyDuration.click();
      } else {
        await page.getByText(/monthly/i).first().click();
      }
      
      await page.waitForTimeout(1000);
      
      // Click on Manual UPI/Bank Transfer option
      const manualOption = page.getByText(/Manual.*UPI|Bank.*Transfer/i);
      await manualOption.first().click();
      
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'subscription-manual-payment.jpeg', quality: 20 });
      
      // Check for UTR input field
      const utrInput = page.getByTestId('utr-input').or(page.getByPlaceholder(/123456789012|UTR/));
      await expect(utrInput.first()).toBeVisible({ timeout: 5000 });
      
      // Check for screenshot upload (payment proof)
      const pageContent = await page.content();
      const hasUpload = pageContent.includes('Upload') || pageContent.includes('Screenshot');
      expect(hasUpload).toBe(true);
    });
    
  });
  
  test.describe('Plan Features Display', () => {
    
    test.beforeEach(async ({ page }) => {
      await dismissToasts(page);
    });
    
    test('Plan comparison table is visible', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: 'subscription-comparison.jpeg', quality: 20 });
      
      // Check for plan comparison content
      const pageContent = await page.content();
      const hasComparison = pageContent.includes('Comparison') || 
                            pageContent.includes('Feature') ||
                            (pageContent.includes('Explorer') && 
                             pageContent.includes('Startup') && 
                             pageContent.includes('Elite'));
      
      expect(hasComparison).toBe(true);
    });
    
    test('Special offer banner is displayed', async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      // Check for special offer/discount content
      const pageContent = await page.content();
      const hasOffer = pageContent.includes('OFF') || 
                       pageContent.includes('Offer') ||
                       pageContent.includes('Discount') ||
                       pageContent.includes('Save');
      
      expect(hasOffer).toBe(true);
    });
    
  });
  
});
