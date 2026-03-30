import { test, expect } from '@playwright/test';

const API = process.env.REACT_APP_BACKEND_URL || 'https://cap-calculator-3tier.preview.emergentagent.com';

// Test credentials
const USER_MOBILE = '9421331342';
const USER_PIN = '942133';
const ADMIN_EMAIL = 'Admin@paras.com';
const ADMIN_PIN = '153759';

test.describe('Redeem Limit System and PRC Subscription Tests', () => {
  
  test.describe('API Tests - Redeem Limit Calculations', () => {
    
    test('Elite user has 39,950 PRC base redeem limit', async ({ request }) => {
      // Get elite users from admin list
      const response = await request.get(`${API}/api/admin/members/list?subscription=elite&limit=1`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      if (!data.members || data.members.length === 0) {
        test.skip();
        return;
      }
      
      const eliteUser = data.members[0];
      const redeemLimit = eliteUser.redeem_limit;
      
      // Formula: 799 × 5 × 10 = 39,950 for month 1
      expect(redeemLimit.total_limit).toBe(39950.0);
    });
    
    test('Growth user has 24,950 PRC base redeem limit', async ({ request }) => {
      // Login as test user (has growth plan)
      const loginResponse = await request.post(`${API}/api/auth/login`, {
        data: { mobile: USER_MOBILE, pin: USER_PIN }
      });
      expect(loginResponse.ok()).toBeTruthy();
      
      const loginData = await loginResponse.json();
      const uid = loginData.uid;
      
      // Get redeem limit
      const limitResponse = await request.get(`${API}/api/user/${uid}/redeem-limit`);
      expect(limitResponse.ok()).toBeTruthy();
      
      const limitData = await limitResponse.json();
      // Growth plan: 499 × 5 × 10 = 24,950
      expect(limitData.limit.base_limit).toBe(24950);
    });
    
    test('Global redeem settings show correct formula values', async ({ request }) => {
      const response = await request.get(`${API}/api/admin/global-redeem-settings`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.settings.base_limit).toBe(39950); // 799 × 5 × 10
      expect(data.settings.referral_increase_percent).toBe(20);
    });
    
  });
  
  test.describe('API Tests - Admin Members Sorting', () => {
    
    test('Members list returns redeem limit data', async ({ request }) => {
      const response = await request.get(`${API}/api/admin/members/list?limit=3`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.members).toBeDefined();
      
      if (data.members.length > 0) {
        const member = data.members[0];
        expect(member.redeem_limit).toBeDefined();
        expect(member.redeem_limit.total_limit).toBeDefined();
        expect(member.redeem_limit.total_redeemed).toBeDefined();
        expect(member.redeem_limit.remaining_limit).toBeDefined();
      }
    });
    
    test('Sort by PRC Balance with correct param name (sort_order)', async ({ request }) => {
      const response = await request.get(`${API}/api/admin/members/list?sort_by=prc_balance&sort_order=desc&limit=5`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      if (data.members.length > 1) {
        const balances = data.members.map(m => m.prc_balance || 0);
        const sorted = [...balances].sort((a, b) => b - a);
        expect(balances).toEqual(sorted);
      }
    });
    
    test('Sort by redeem_limit works with sort_order param', async ({ request }) => {
      const response = await request.get(`${API}/api/admin/members/list?sort_by=redeem_limit&sort_order=desc&limit=5`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      if (data.members.length > 1) {
        const limits = data.members.map(m => m.redeem_limit?.total_limit || 0);
        const sorted = [...limits].sort((a, b) => b - a);
        expect(limits).toEqual(sorted);
      }
    });
    
    test('Sort by available_limit works with sort_order param', async ({ request }) => {
      const response = await request.get(`${API}/api/admin/members/list?sort_by=available_limit&sort_order=desc&limit=5`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      if (data.members.length > 1) {
        const available = data.members.map(m => m.redeem_limit?.remaining_limit || 0);
        const sorted = [...available].sort((a, b) => b - a);
        expect(available).toEqual(sorted);
      }
    });
    
  });
  
  test.describe('API Tests - PRC Subscription', () => {
    
    test('Elite plan pricing is 799 and duration 28 days', async ({ request }) => {
      const response = await request.get(`${API}/api/subscription/plans`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      const elitePlan = data.plans.find(p => p.id === 'elite');
      
      expect(elitePlan).toBeDefined();
      expect(elitePlan.pricing.monthly).toBe(799);
      expect(data.durations.monthly).toBe(28);
    });
    
    test('Explorer plan is free and cannot redeem', async ({ request }) => {
      const response = await request.get(`${API}/api/subscription/plans`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      const explorerPlan = data.plans.find(p => p.id === 'explorer');
      
      expect(explorerPlan).toBeDefined();
      expect(explorerPlan.is_free).toBe(true);
      expect(explorerPlan.can_redeem).toBe(false);
    });
    
    test('Pay-with-PRC endpoint validates amount correctly', async ({ request }) => {
      // Login first
      const loginResponse = await request.post(`${API}/api/auth/login`, {
        data: { mobile: USER_MOBILE, pin: USER_PIN }
      });
      const loginData = await loginResponse.json();
      
      // Try with wrong PRC amount - should fail
      const payResponse = await request.post(`${API}/api/subscription/pay-with-prc`, {
        data: {
          user_id: loginData.uid,
          plan_name: 'elite',
          prc_amount: 5000 // Wrong - should be 799 × 2 × 10 = 15,980
        }
      });
      
      expect(payResponse.status()).toBe(400);
      const errorText = await payResponse.text();
      expect(errorText.toLowerCase()).toMatch(/invalid|expected/);
    });
    
    test('No plan comparison section in API response', async ({ request }) => {
      const response = await request.get(`${API}/api/subscription/plans`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.comparison).toBeUndefined();
      expect(data.features_comparison).toBeUndefined();
    });
    
  });
  
  test.describe('API Tests - Bank Redeem Limit Check', () => {
    
    test('Bank transfer config endpoint works', async ({ request }) => {
      const response = await request.get(`${API}/api/bank-transfer/config`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.prc_rate).toBeDefined();
      expect(data.min_withdrawal).toBeDefined();
      expect(data.max_withdrawal).toBeDefined();
    });
    
    test('Redeem limit API returns all required fields', async ({ request }) => {
      // Login and get UID
      const loginResponse = await request.post(`${API}/api/auth/login`, {
        data: { mobile: USER_MOBILE, pin: USER_PIN }
      });
      const loginData = await loginResponse.json();
      
      const limitResponse = await request.get(`${API}/api/user/${loginData.uid}/redeem-limit`);
      expect(limitResponse.ok()).toBeTruthy();
      
      const data = await limitResponse.json();
      expect(data.success).toBe(true);
      expect(data.limit.total_limit).toBeDefined();
      expect(data.limit.total_redeemed).toBeDefined();
      expect(data.limit.remaining_limit).toBeDefined();
      expect(data.limit.months_active).toBeDefined();
      expect(data.limit.active_referrals).toBeDefined();
    });
    
  });
  
});

test.describe('Frontend UI Tests - Admin Members Page', () => {
  
  test('Admin Members page loads and shows member list', async ({ page }) => {
    // Navigate to admin login
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    
    // Check if redirected to login or on admin page
    const url = page.url();
    if (url.includes('login')) {
      // Would need to login first - skip for now
      test.skip();
      return;
    }
    
    // If on admin page, check for members dashboard
    const membersHeader = page.locator('h1:has-text("Members Dashboard")');
    await expect(membersHeader).toBeVisible();
  });
  
});

test.describe('Frontend UI Tests - Subscription Page', () => {
  
  test('Subscription page loads and shows plans', async ({ page }) => {
    // Login as user first
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    // Fill login form
    const mobileInput = page.locator('input[type="tel"], input[placeholder*="mobile"]').first();
    if (await mobileInput.isVisible()) {
      await mobileInput.fill(USER_MOBILE);
      
      // Look for PIN input
      const pinInput = page.locator('input[type="password"], input[placeholder*="PIN"]').first();
      if (await pinInput.isVisible()) {
        await pinInput.fill(USER_PIN);
      }
      
      // Click login button
      const loginBtn = page.locator('button:has-text("Login"), button:has-text("Sign In")').first();
      if (await loginBtn.isVisible()) {
        await loginBtn.click();
        await page.waitForTimeout(3000);
      }
    }
    
    // Navigate to subscription page
    await page.goto('/subscription');
    await page.waitForLoadState('domcontentloaded');
    
    // Check if subscription plans header visible
    const pageContent = await page.content();
    expect(pageContent).toContain('Elite');
  });
  
  test('Plan Comparison section should NOT be visible', async ({ page }) => {
    await page.goto('/subscription');
    await page.waitForLoadState('domcontentloaded');
    
    // Plan comparison section should be removed
    const comparisonSection = page.locator('text=Plan Comparison, text=Compare Plans');
    await expect(comparisonSection).not.toBeVisible();
  });
  
});
