import { test, expect } from '@playwright/test';

/**
 * Bill Payments Feature Tests
 * Tests for the Eko Bill Payments frontend UI
 * 
 * Note: This app requires login to access Bill Payments page
 * Test user: testmember@paras.com / PIN: 123456
 */

const BASE_URL = 'https://reward-bills.preview.emergentagent.com';

test.describe('Bill Payments Page - Authenticated User', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login flow for test user
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Wait for login page to load
    await page.waitForLoadState('networkidle');
    
    // Find and fill email input
    const emailInput = page.getByPlaceholder(/email|enter your email/i)
      .or(page.locator('input[type="email"]'))
      .first();
    
    if (await emailInput.isVisible({ timeout: 5000 })) {
      await emailInput.fill('testmember@paras.com');
      
      // Click continue/next
      const continueBtn = page.getByRole('button', { name: /continue|next|submit/i }).first();
      if (await continueBtn.isVisible({ timeout: 3000 })) {
        await continueBtn.click();
      }
      
      // Wait for PIN input
      await page.waitForSelector('input[type="password"], input[inputmode="numeric"]', { timeout: 10000 });
      
      // Enter PIN
      const pinInputs = page.locator('input[type="password"], input[inputmode="numeric"]');
      const count = await pinInputs.count();
      
      if (count >= 6) {
        const pin = '123456';
        for (let i = 0; i < 6; i++) {
          await pinInputs.nth(i).fill(pin[i]);
        }
      } else if (count === 1) {
        await pinInputs.first().fill('123456');
      }
      
      // Submit login
      const loginBtn = page.getByRole('button', { name: /login|sign in|verify/i }).first();
      if (await loginBtn.isVisible({ timeout: 3000 })) {
        await loginBtn.click();
      }
      
      // Wait for redirect to dashboard
      await page.waitForURL(/dashboard|home/i, { timeout: 15000 });
    }
  });

  test('can navigate to Bill Payments page', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Verify page loaded - check for title or header
    const header = page.getByRole('heading', { name: /bill payment|recharge/i }).first();
    await expect(header).toBeVisible({ timeout: 10000 });
  });

  test('displays service type selection buttons', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Check for service selection buttons using data-testid
    const mobileRechargeBtn = page.getByTestId('service-mobile_recharge');
    const dthRechargeBtn = page.getByTestId('service-dish_recharge');
    const electricityBtn = page.getByTestId('service-electricity_bill');
    const creditCardBtn = page.getByTestId('service-credit_card_payment');
    const loanEmiBtn = page.getByTestId('service-loan_emi');
    
    await expect(mobileRechargeBtn).toBeVisible({ timeout: 10000 });
    await expect(dthRechargeBtn).toBeVisible();
    await expect(electricityBtn).toBeVisible();
    await expect(creditCardBtn).toBeVisible();
    await expect(loanEmiBtn).toBeVisible();
  });

  test('mobile recharge is selected by default', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Mobile recharge should be selected (has different styling)
    const mobileRechargeBtn = page.getByTestId('service-mobile_recharge');
    await expect(mobileRechargeBtn).toBeVisible({ timeout: 10000 });
    
    // Check if it has active/selected class
    const classes = await mobileRechargeBtn.getAttribute('class');
    expect(classes).toContain('border-blue');
  });

  test('can switch between service types', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Click on DTH Recharge
    const dthBtn = page.getByTestId('service-dish_recharge');
    await expect(dthBtn).toBeVisible({ timeout: 10000 });
    await dthBtn.click();
    
    // Click on Electricity
    const electricityBtn = page.getByTestId('service-electricity_bill');
    await electricityBtn.click();
    
    // Verify electricity is now selected
    const classes = await electricityBtn.getAttribute('class');
    expect(classes).toContain('border-yellow');
  });

  test('displays payment mode tabs for supported services', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Payment mode tabs should be visible (Instant Pay vs Request Based)
    const instantPayTab = page.getByText('Instant Pay').first();
    const requestBasedTab = page.getByText('Request Based').first();
    
    await expect(instantPayTab).toBeVisible({ timeout: 10000 });
    await expect(requestBasedTab).toBeVisible();
  });

  test('Instant Pay mode shows provider selection', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Click Instant Pay tab (should be default)
    const instantPayTab = page.getByText('Instant Pay').first();
    await expect(instantPayTab).toBeVisible({ timeout: 10000 });
    
    // Provider selection should be visible
    const providerSection = page.getByText('Select Provider').first();
    await expect(providerSection).toBeVisible({ timeout: 10000 });
  });

  test('Request Based mode shows manual form', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Click Request Based tab
    const requestBasedTab = page.getByText('Request Based').first();
    await expect(requestBasedTab).toBeVisible({ timeout: 10000 });
    await requestBasedTab.click();
    
    // Manual form should show
    const amountLabel = page.getByText('Amount (₹)').first();
    await expect(amountLabel).toBeVisible({ timeout: 5000 });
  });

  test('displays PRC balance', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // PRC balance should be displayed somewhere on page
    const prcBalance = page.getByText(/PRC/i).first();
    await expect(prcBalance).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Bill Payments - Instant Pay Provider Selection', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login flow
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.getByPlaceholder(/email/i)
      .or(page.locator('input[type="email"]'))
      .first();
    
    if (await emailInput.isVisible({ timeout: 5000 })) {
      await emailInput.fill('testmember@paras.com');
      
      const continueBtn = page.getByRole('button', { name: /continue|next/i }).first();
      if (await continueBtn.isVisible({ timeout: 3000 })) {
        await continueBtn.click();
      }
      
      await page.waitForSelector('input[type="password"], input[inputmode="numeric"]', { timeout: 10000 });
      
      const pinInputs = page.locator('input[type="password"], input[inputmode="numeric"]');
      const count = await pinInputs.count();
      
      if (count >= 6) {
        for (let i = 0; i < 6; i++) {
          await pinInputs.nth(i).fill(String(i + 1));
        }
      } else if (count === 1) {
        await pinInputs.first().fill('123456');
      }
      
      const loginBtn = page.getByRole('button', { name: /login|sign in|verify/i }).first();
      if (await loginBtn.isVisible({ timeout: 3000 })) {
        await loginBtn.click();
      }
      
      await page.waitForURL(/dashboard|home/i, { timeout: 15000 });
    }
  });

  test('shows static fallback billers for mobile recharge', async ({ page }) => {
    await page.goto('/bill-payments?type=mobile_recharge', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Wait for provider section to load
    const providerSection = page.getByText('Select Provider').first();
    await expect(providerSection).toBeVisible({ timeout: 15000 });
    
    // Should show fallback providers (Jio, Airtel, etc.)
    const jioProvider = page.getByText('Jio Prepaid').first();
    await expect(jioProvider).toBeVisible({ timeout: 10000 });
  });

  test('shows static fallback billers for DTH recharge', async ({ page }) => {
    await page.goto('/bill-payments?type=dish_recharge', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Select DTH service
    const dthBtn = page.getByTestId('service-dish_recharge');
    await expect(dthBtn).toBeVisible({ timeout: 10000 });
    await dthBtn.click();
    
    // Wait for provider section
    const providerSection = page.getByText('Select Provider').first();
    await expect(providerSection).toBeVisible({ timeout: 15000 });
    
    // Should show DTH providers
    const tataPlay = page.getByText(/Tata Play|Tata Sky/i).first();
    await expect(tataPlay).toBeVisible({ timeout: 10000 });
  });

  test('shows static fallback billers for electricity', async ({ page }) => {
    await page.goto('/bill-payments?type=electricity_bill', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Select Electricity service
    const electricityBtn = page.getByTestId('service-electricity_bill');
    await expect(electricityBtn).toBeVisible({ timeout: 10000 });
    await electricityBtn.click();
    
    // Wait for provider section
    const providerSection = page.getByText('Select Provider').first();
    await expect(providerSection).toBeVisible({ timeout: 15000 });
    
    // Should show electricity billers (MSEDCL, Tata Power, etc.)
    const msedcl = page.getByText(/MSEDCL|Maharashtra/i).first();
    await expect(msedcl).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Bill Payments - Payment Form', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login flow
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.getByPlaceholder(/email/i)
      .or(page.locator('input[type="email"]'))
      .first();
    
    if (await emailInput.isVisible({ timeout: 5000 })) {
      await emailInput.fill('testmember@paras.com');
      
      const continueBtn = page.getByRole('button', { name: /continue|next/i }).first();
      if (await continueBtn.isVisible({ timeout: 3000 })) {
        await continueBtn.click();
      }
      
      await page.waitForSelector('input[type="password"], input[inputmode="numeric"]', { timeout: 10000 });
      
      const pinInputs = page.locator('input[type="password"], input[inputmode="numeric"]');
      const count = await pinInputs.count();
      
      if (count >= 6) {
        for (let i = 0; i < 6; i++) {
          await pinInputs.nth(i).fill(String(i + 1));
        }
      } else if (count === 1) {
        await pinInputs.first().fill('123456');
      }
      
      const loginBtn = page.getByRole('button', { name: /login|sign in|verify/i }).first();
      if (await loginBtn.isVisible({ timeout: 3000 })) {
        await loginBtn.click();
      }
      
      await page.waitForURL(/dashboard|home/i, { timeout: 15000 });
    }
  });

  test('shows payment form after selecting provider', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Wait for providers to load
    const providerSection = page.getByText('Select Provider').first();
    await expect(providerSection).toBeVisible({ timeout: 15000 });
    
    // Click on a provider (e.g., Jio)
    const jioProvider = page.getByText('Jio Prepaid').first();
    await expect(jioProvider).toBeVisible({ timeout: 10000 });
    await jioProvider.click();
    
    // Payment details form should appear
    const paymentDetails = page.getByText('Payment Details').first();
    await expect(paymentDetails).toBeVisible({ timeout: 5000 });
    
    // Mobile number input should be visible
    const mobileInput = page.getByPlaceholder(/mobile number|10-digit/i).first();
    await expect(mobileInput).toBeVisible();
  });

  test('shows charge breakdown when amount entered', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Select a provider
    const providerSection = page.getByText('Select Provider').first();
    await expect(providerSection).toBeVisible({ timeout: 15000 });
    
    const jioProvider = page.getByText('Jio Prepaid').first();
    await expect(jioProvider).toBeVisible({ timeout: 10000 });
    await jioProvider.click();
    
    // Enter mobile number
    const mobileInput = page.getByPlaceholder(/mobile number|10-digit/i).first();
    await expect(mobileInput).toBeVisible({ timeout: 5000 });
    await mobileInput.fill('9876543210');
    
    // Enter amount
    const amountInput = page.getByPlaceholder(/0.00|amount/i).first();
    await amountInput.fill('100');
    
    // Charge breakdown should appear
    const chargeBreakdown = page.getByText('Charge Breakdown').first();
    await expect(chargeBreakdown).toBeVisible({ timeout: 5000 });
    
    // Should show processing fee
    const processingFee = page.getByText('Processing Fee').first();
    await expect(processingFee).toBeVisible();
    
    // Should show admin charges
    const adminCharges = page.getByText(/Admin Charges|20%/i).first();
    await expect(adminCharges).toBeVisible();
  });

  test('Pay button shows PRC amount', async ({ page }) => {
    await page.goto('/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Select provider
    const jioProvider = page.getByText('Jio Prepaid').first();
    await expect(jioProvider).toBeVisible({ timeout: 15000 });
    await jioProvider.click();
    
    // Fill form
    const mobileInput = page.getByPlaceholder(/mobile number|10-digit/i).first();
    await mobileInput.fill('9876543210');
    
    const amountInput = page.getByPlaceholder(/0.00/i).first();
    await amountInput.fill('100');
    
    // Pay button should show PRC amount
    // 100 + 10 (processing) + 20 (20% admin) = 130 INR = 1300 PRC
    const payButton = page.getByRole('button', { name: /Pay.*PRC/i }).first();
    await expect(payButton).toBeVisible({ timeout: 5000 });
  });
});
