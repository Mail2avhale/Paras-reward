/**
 * DMT New User Registration OTP Flow - E2E Tests
 * ===============================================
 * Tests for the complete DMT new user registration flow:
 * 1. Backend API tests for customer search, register, OTP send, OTP verify
 * 2. Frontend UI tests for DMT form, registration, OTP flow
 * 3. Existing customer flow verification
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'https://dmt-fix.preview.emergentagent.com';

const TEST_CREDENTIALS = {
  email: 'mail2avhale@gmail.com',
  pin: '153759',
  customerMobile: '9970100782'
};

// Generate random 10-digit mobile starting with 5 (for new user testing)
function generateTestMobile(): string {
  return `5${Math.floor(100000000 + Math.random() * 900000000)}`;
}

// Helper: Login to the app
async function loginAndSetup(page: any) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 60000 });
  
  const emailInput = page.getByPlaceholder('Enter email, mobile or UID');
  await expect(emailInput).toBeVisible({ timeout: 30000 });
  await emailInput.fill(TEST_CREDENTIALS.email);
  
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.locator('input[inputmode="numeric"]').first()).toBeVisible({ timeout: 30000 });
  
  const pinInputs = page.locator('input[inputmode="numeric"]');
  for (let i = 0; i < 6; i++) {
    await pinInputs.nth(i).fill(TEST_CREDENTIALS.pin[i]);
  }
  
  await page.waitForURL(/dashboard|home/i, { timeout: 60000 });
}

// Helper: Close popup and select DMT service
async function closePopupAndSelectDMT(page: any) {
  await page.goto('/redeem', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  
  // Close popup if present
  const closeBtn = page.getByTestId('popup-close-btn');
  if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }
  
  // Select DMT service
  await page.getByTestId('service-dmt').click();
  await page.waitForTimeout(1000);
}

// ========================================
// BACKEND API TESTS
// ========================================

test.describe('DMT Backend API Tests', () => {
  
  test('Customer Search returns customer_exists=false for new mobile', async ({ request }) => {
    const testMobile = generateTestMobile();
    const response = await request.post(`${BASE_URL}/api/eko/dmt/customer/search`, {
      data: {
        mobile: testMobile,
        user_id: 'playwright_test'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.data.customer_exists).toBe(false);
    expect(data.data.mobile).toBe(testMobile);
  });

  test('Customer Registration works for new users', async ({ request }) => {
    const testMobile = generateTestMobile();
    const response = await request.post(`${BASE_URL}/api/eko/dmt/customer/register`, {
      data: {
        mobile: testMobile,
        first_name: 'Playwright',
        last_name: 'Test',
        user_id: 'playwright_test'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.data.registered).toBe(true);
  });

  test('OTP Resend works after registration', async ({ request }) => {
    const testMobile = generateTestMobile();
    
    // Register first
    await request.post(`${BASE_URL}/api/eko/dmt/customer/register`, {
      data: {
        mobile: testMobile,
        first_name: 'OTPSend',
        last_name: 'Test',
        user_id: 'playwright_test'
      }
    });
    
    // Send OTP
    const response = await request.post(`${BASE_URL}/api/eko/dmt/customer/resend-otp`, {
      data: {
        mobile: testMobile,
        user_id: 'playwright_test'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.data.otp_sent).toBe(true);
  });

  test('OTP Verification rejects invalid OTP', async ({ request }) => {
    const testMobile = generateTestMobile();
    
    // Register and send OTP
    await request.post(`${BASE_URL}/api/eko/dmt/customer/register`, {
      data: {
        mobile: testMobile,
        first_name: 'OTPVerify',
        last_name: 'Test',
        user_id: 'playwright_test'
      }
    });
    await request.post(`${BASE_URL}/api/eko/dmt/customer/resend-otp`, {
      data: { mobile: testMobile, user_id: 'playwright_test' }
    });
    
    // Verify with wrong OTP
    const response = await request.post(`${BASE_URL}/api/eko/dmt/customer/verify-otp`, {
      data: {
        mobile: testMobile,
        user_id: 'playwright_test',
        otp: '000000'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Invalid OTP should fail
    expect(data.success).toBe(false);
  });
});

// ========================================
// FRONTEND UI TESTS
// ========================================

test.describe('DMT UI Tests', () => {

  test('DMT Step 1 shows mobile input', async ({ page }) => {
    await loginAndSetup(page);
    await closePopupAndSelectDMT(page);
    
    // Verify Step 1 UI
    await expect(page.getByText('Bank Transfer Details')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('Enter 10-digit mobile number')).toBeVisible();
    
    // Verify step indicators
    await expect(page.getByText('Mobile', { exact: true })).toBeVisible();
    await expect(page.getByText('Verify', { exact: true })).toBeVisible();
    await expect(page.getByText('Bank Details', { exact: true })).toBeVisible();
    await expect(page.getByText('Amount', { exact: true })).toBeVisible();
  });

  test('DMT submit button shows "Transfer to Bank"', async ({ page }) => {
    await loginAndSetup(page);
    await closePopupAndSelectDMT(page);
    
    // Scroll to see submit button
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Verify submit button text
    const submitBtn = page.getByTestId('submit-redeem-btn');
    await expect(submitBtn).toBeVisible({ timeout: 10000 });
    await expect(submitBtn).toContainText('Transfer to Bank');
  });

  test('DMT shows "Direct instant transfer via IMPS" (not admin approval)', async ({ page }) => {
    await loginAndSetup(page);
    await closePopupAndSelectDMT(page);
    
    // Scroll to see bottom text
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Should show IMPS message
    await expect(page.getByText(/Direct instant transfer via IMPS/i)).toBeVisible({ timeout: 10000 });
    
    // Should NOT show admin approval message
    const adminMsg = await page.getByText('Admin will process').isVisible({ timeout: 2000 }).catch(() => false);
    expect(adminMsg).toBe(false);
  });

  test('DMT does NOT have Admin badge', async ({ page }) => {
    await loginAndSetup(page);
    await page.goto('/redeem', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Close popup if present
    const closeBtn = page.getByTestId('popup-close-btn');
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Find DMT button
    const dmtBtn = page.getByTestId('service-dmt');
    await expect(dmtBtn).toBeVisible({ timeout: 30000 });
    
    // Check for Admin badge - should NOT have it
    const adminBadge = dmtBtn.locator(':text("Admin")');
    const hasAdminBadge = await adminBadge.count() > 0;
    expect(hasAdminBadge).toBe(false);
  });
});

test.describe('DMT New User Registration Flow', () => {

  test('New user: Enter mobile -> Shows registration form', async ({ page }) => {
    await loginAndSetup(page);
    await closePopupAndSelectDMT(page);
    
    // Enter new mobile
    const testMobile = generateTestMobile();
    await page.getByPlaceholder('Enter 10-digit mobile number').fill(testMobile);
    
    // Click Continue
    await page.getByRole('button', { name: /Continue/i }).click();
    
    // Wait for API response
    await page.waitForTimeout(3000);
    
    // For new users, should show registration form
    const registrationVisible = await page.getByPlaceholder('First Name').isVisible({ timeout: 10000 }).catch(() => false);
    const newCustomerText = await page.getByText(/New customer/i).isVisible({ timeout: 3000 }).catch(() => false);
    
    expect(registrationVisible || newCustomerText).toBe(true);
  });

  test('New user: Register -> Shows OTP input', async ({ page }) => {
    await loginAndSetup(page);
    await closePopupAndSelectDMT(page);
    
    // Enter new mobile
    const testMobile = generateTestMobile();
    await page.getByPlaceholder('Enter 10-digit mobile number').fill(testMobile);
    await page.getByRole('button', { name: /Continue/i }).click();
    
    await page.waitForTimeout(3000);
    
    // If registration form is visible, fill and submit
    const firstNameInput = page.getByPlaceholder('First Name');
    if (await firstNameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstNameInput.fill('AutoTest');
      await page.getByPlaceholder('Last Name').fill('User');
      
      // Click Register
      await page.getByRole('button', { name: /Register.*OTP/i }).click();
      
      await page.waitForTimeout(5000);
      
      // Should show OTP input
      const otpInput = page.getByPlaceholder(/Enter.*OTP/i);
      const otpVisible = await otpInput.isVisible({ timeout: 10000 }).catch(() => false);
      
      expect(otpVisible).toBe(true);
    }
  });
});

test.describe('DMT Existing User Flow', () => {

  test('Existing user: Shows bank details step', async ({ page }) => {
    await loginAndSetup(page);
    await closePopupAndSelectDMT(page);
    
    // Enter existing customer mobile
    await page.getByPlaceholder('Enter 10-digit mobile number').fill(TEST_CREDENTIALS.customerMobile);
    
    // Click Continue
    await page.getByRole('button', { name: /Continue/i }).click();
    
    // Wait for customer verification
    await page.waitForTimeout(5000);
    
    // For existing customers, should show bank details or saved accounts
    const step3Visible = await page.getByText(/Your Saved Bank Accounts|Select Bank/i).isVisible({ timeout: 15000 }).catch(() => false);
    const customerVerified = await page.getByText(TEST_CREDENTIALS.customerMobile).isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(step3Visible || customerVerified).toBe(true);
  });
});
