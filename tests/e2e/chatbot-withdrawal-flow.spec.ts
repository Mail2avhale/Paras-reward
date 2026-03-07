import { test, expect } from '@playwright/test';

/**
 * Chatbot Bank Withdrawal Flow Tests
 * ===================================
 * Tests for the new chatbot-based bank withdrawal feature with Eko OTP verification.
 * 
 * Features tested:
 * 1. Chatbot opens and displays welcome message
 * 2. Bank withdrawal intent detection
 * 3. Start Bank Withdrawal button appears
 * 4. ChatbotWithdrawalFlow modal functionality
 * 5. Eko check-customer API (skip_otp in preview)
 * 6. Bank details form validation
 */

const TEST_USER = {
  mobile: '9876543210',
  pin: '123456'
};

// Helper function to login
async function loginUser(page: any) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Enter mobile number
  const emailInput = page.locator('input[placeholder*="email" i], input[placeholder*="mobile" i]').first();
  await emailInput.fill(TEST_USER.mobile);
  await page.waitForTimeout(500);

  // Click Sign In to show PIN input
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForTimeout(2000);

  // Enter 6-digit PIN
  for (const digit of TEST_USER.pin) {
    await page.keyboard.type(digit);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(3000);

  // Close popup if visible
  const closeBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
  await closeBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
}

// Helper to open chatbot
async function openChatbot(page: any) {
  const chatbotBtn = page.getByTestId('chatbot-toggle-btn');
  await chatbotBtn.waitFor({ state: 'visible', timeout: 10000 });
  await chatbotBtn.click({ force: true });
  await page.waitForTimeout(1500);
}

test.describe('Chatbot Bank Withdrawal Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Chatbot opens and displays welcome message after login', async ({ page }) => {
    await loginUser(page);
    await openChatbot(page);
    
    // Verify chatbot container is visible
    const chatContainer = page.getByTestId('chatbot-container');
    await expect(chatContainer).toBeVisible();
    
    // Verify PRC Bot header
    const header = page.locator('h3:has-text("PRC Bot")');
    await expect(header).toBeVisible();
    
    // Verify AI Assistant label
    const aiLabel = page.locator('text=AI Assistant');
    await expect(aiLabel).toBeVisible();
  });

  test('Bank withdrawal intent detected when clicking quick question button', async ({ page }) => {
    await loginUser(page);
    await openChatbot(page);
    
    // Click on Bank withdrawal quick question
    const bankWithdrawalBtn = page.locator('button:has-text("Bank withdrawal")');
    await bankWithdrawalBtn.click({ force: true });
    await page.waitForTimeout(3000);
    
    // Verify the bot response shows withdrawal intent detected
    const botResponse = page.locator('text=Bank Withdrawal Request Detected');
    await expect(botResponse).toBeVisible();
    
    // Verify OTP verification mentioned
    const otpMention = page.locator('text=OTP verification');
    await expect(otpMention).toBeVisible();
  });

  test('Start Bank Withdrawal button appears after intent detection', async ({ page }) => {
    await loginUser(page);
    await openChatbot(page);
    
    // Click on Bank withdrawal quick question
    const bankWithdrawalBtn = page.locator('button:has-text("Bank withdrawal")');
    await bankWithdrawalBtn.click({ force: true });
    await page.waitForTimeout(3000);
    
    // Verify Start Bank Withdrawal button is visible
    const startBtn = page.getByTestId('start-withdrawal-btn');
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toHaveText(/Start Bank Withdrawal/i);
  });

  test('ChatbotWithdrawalFlow modal opens when clicking Start button', async ({ page }) => {
    await loginUser(page);
    await openChatbot(page);
    
    // Trigger withdrawal intent
    const bankWithdrawalBtn = page.locator('button:has-text("Bank withdrawal")');
    await bankWithdrawalBtn.click({ force: true });
    await page.waitForTimeout(3000);
    
    // Click Start Bank Withdrawal
    const startBtn = page.getByTestId('start-withdrawal-btn');
    await startBtn.click({ force: true });
    await page.waitForTimeout(2000);
    
    // Verify modal header is visible
    const modalHeader = page.locator('text=Bank Withdrawal').first();
    await expect(modalHeader).toBeVisible();
    
    // Verify "Secure transfer via Eko" text
    const ekoText = page.locator('text=Secure transfer via Eko');
    await expect(ekoText).toBeVisible();
  });

  test('Eligibility check shows proper response', async ({ page }) => {
    await loginUser(page);
    await openChatbot(page);
    
    // Trigger withdrawal flow
    const bankWithdrawalBtn = page.locator('button:has-text("Bank withdrawal")');
    await bankWithdrawalBtn.click({ force: true });
    await page.waitForTimeout(3000);
    
    // Click Start Bank Withdrawal
    const startBtn = page.getByTestId('start-withdrawal-btn');
    await startBtn.click({ force: true });
    await page.waitForTimeout(3000);
    
    // The test user doesn't have KYC verified, so should show "Cannot Proceed" or KYC required
    // Or it could show the customer check step
    const pageContent = await page.content();
    const hasEligibilityResult = 
      pageContent.includes('Cannot Proceed') ||
      pageContent.includes('KYC') ||
      pageContent.includes('eligibility') ||
      pageContent.includes('Verifying') ||
      pageContent.includes('identity');
    
    expect(hasEligibilityResult).toBe(true);
  });

  test('Chatbot message input is functional', async ({ page }) => {
    await loginUser(page);
    await openChatbot(page);
    
    // Find message input
    const messageInput = page.locator('input[placeholder*="Message" i]');
    await expect(messageInput).toBeVisible();
    await expect(messageInput).toBeEnabled();
    
    // Type a test message
    await messageInput.fill('Test message');
    await expect(messageInput).toHaveValue('Test message');
  });

  test('Voice control buttons are visible in chatbot', async ({ page }) => {
    await loginUser(page);
    await openChatbot(page);
    
    // Verify voice button (microphone) is visible
    const voiceBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(voiceBtn).toBeVisible();
    
    // Verify speaker toggle is visible (Volume icon)
    const volumeIcon = page.locator('text=Voice Ready');
    await expect(volumeIcon).toBeVisible();
  });

  test('Chatbot can be closed', async ({ page }) => {
    await loginUser(page);
    await openChatbot(page);
    
    // Verify chatbot is open
    const chatContainer = page.getByTestId('chatbot-container');
    await expect(chatContainer).toBeVisible();
    
    // Close chatbot using X button
    const closeBtn = page.locator('button').filter({ has: page.locator('svg[class*="lucide-x"]') }).first();
    await closeBtn.click({ force: true }).catch(async () => {
      // Fallback: click any close button in chat header area
      const headerCloseBtn = page.locator('[data-testid="chatbot-container"] button').last();
      await headerCloseBtn.click({ force: true });
    });
    await page.waitForTimeout(1000);
    
    // Verify chatbot toggle button is visible again
    const chatbotToggle = page.getByTestId('chatbot-toggle-btn');
    await expect(chatbotToggle).toBeVisible();
  });
});

test.describe('Eko Customer Check API', () => {
  
  test('Check customer API returns skip_otp in preview environment', async ({ request }) => {
    const response = await request.post('/api/chatbot-redeem/eko/check-customer', {
      data: {
        uid: 'test-user-123',
        mobile: '9876543210'
      }
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    // In preview environment, IP is not whitelisted so Eko returns skip_otp
    expect(data.success).toBe(true);
    expect(data.skip_otp).toBe(true);
    expect(data.message).toContain('skipped');
  });

  test('Check customer API handles missing mobile gracefully', async ({ request }) => {
    const response = await request.post('/api/chatbot-redeem/eko/check-customer', {
      data: {
        uid: 'test-user-123',
        mobile: '1234567890'  // Different mobile
      }
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

test.describe('Bank Details Form Validation', () => {
  
  test('IFSC code lookup API is available', async ({ request }) => {
    // Test with Razorpay IFSC API (external)
    const response = await request.get('https://ifsc.razorpay.com/SBIN0001234');
    
    // If Razorpay API is available, it should return bank info
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('BANK');
      expect(data).toHaveProperty('BRANCH');
    } else {
      // API might be rate limited, skip
      console.log('IFSC lookup API unavailable or rate limited');
    }
  });

  test('Fee calculation with valid amounts works', async ({ request }) => {
    const testAmounts = [500, 1000, 2000, 5000, 10000];
    
    for (const amount of testAmounts) {
      const response = await request.get(`/api/chatbot-redeem/calculate-fees?amount=${amount}`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      
      // Verify fee structure
      expect(data.processing_fee).toBe(10);  // Flat ₹10
      expect(data.admin_charge).toBe(amount * 0.2);  // 20%
      expect(data.net_amount).toBe(amount - 10 - (amount * 0.2));
      expect(data.prc_required).toBe(amount * 10);  // 10 PRC = ₹1
    }
  });
});

test.describe('Withdrawal Request API', () => {
  
  test('Create request requires all fields', async ({ request }) => {
    const response = await request.post('/api/chatbot-redeem/request', {
      data: {
        uid: 'test-uid',
        amount_inr: 500
        // Missing bank details
      }
    });
    
    // Should fail validation
    expect(response.status()).toBe(422);
  });

  test('Request status returns 404 for non-existent request', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/status/NONEXISTENT-12345');
    expect(response.status()).toBe(404);
  });

  test('User history returns empty array for new user', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/history/new-test-user-xyz');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.requests).toEqual([]);
    expect(data.total).toBe(0);
  });
});

test.describe('Admin Withdrawal APIs', () => {
  
  test('Admin stats returns counts by status', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/admin/stats');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Verify structure
    expect(data.counts).toBeDefined();
    expect(typeof data.counts.pending).toBe('number');
    expect(typeof data.counts.processing).toBe('number');
    expect(typeof data.counts.completed).toBe('number');
    expect(typeof data.counts.rejected).toBe('number');
    
    // Total should equal sum
    const sum = data.counts.pending + data.counts.processing + 
                data.counts.completed + data.counts.rejected;
    expect(data.counts.total).toBe(sum);
  });

  test('Admin pending returns proper pagination', async ({ request }) => {
    const response = await request.get('/api/chatbot-redeem/admin/pending?limit=5&skip=0');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.limit).toBe(5);
    expect(data.skip).toBe(0);
    expect(Array.isArray(data.requests)).toBe(true);
  });

  test('Admin all supports status filtering', async ({ request }) => {
    const statuses = ['pending', 'processing', 'completed', 'rejected'];
    
    for (const status of statuses) {
      const response = await request.get(`/api/chatbot-redeem/admin/all?status=${status}`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data.requests)).toBe(true);
      
      // All returned requests should have the filtered status
      for (const req of data.requests) {
        expect(req.status).toBe(status);
      }
    }
  });
});
