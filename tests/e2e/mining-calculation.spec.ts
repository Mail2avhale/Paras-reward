import { test, expect } from '@playwright/test';

/**
 * Mining Speed Calculation E2E Tests
 * 
 * Verifies the 5-level referral mining speed calculation is displayed correctly.
 * Test user: root_cb83@test.com (uid: root_cb83, PIN: 123456)
 * 
 * Expected referrals:
 *   - L1: 3 users (2 paid, 1 free)
 *   - L2: 6 users (6 paid)
 *   - L3: 6 users (3 paid, 3 free)
 *   - L4: 6 users (6 paid)
 *   - L5: 6 users (4 paid, 2 free)
 */

const TEST_USER = {
  email: 'root_cb83@test.com',
  pin: '123456',
  uid: 'root_cb83'
};

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://dmt-payment-gateway.preview.emergentagent.com';

test.describe('Mining Speed Calculation - API Tests', () => {

  test('API returns correct mining calculation (Base + L1-L5 = Total)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/mining/status/${TEST_USER.uid}`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Verify required fields exist
    expect(data.mining_rate_per_hour).toBeDefined();
    expect(data.base_rate).toBeDefined();
    expect(data.referral_breakdown).toBeDefined();
    
    // Calculate sum: Base + L1 + L2 + L3 + L4 + L5
    const baseRate = data.base_rate;
    const breakdown = data.referral_breakdown;
    
    let totalBonus = 0;
    for (const level of ['level_1', 'level_2', 'level_3', 'level_4', 'level_5']) {
      const bonus = breakdown[level]?.bonus || 0;
      totalBonus += bonus;
    }
    
    const calculatedTotal = baseRate + totalBonus;
    const apiTotal = data.mining_rate_per_hour;
    
    // Verify calculation matches (allow small floating point difference)
    expect(Math.abs(calculatedTotal - apiTotal)).toBeLessThan(0.001);
    
    console.log(`✓ Calculation verified: ${baseRate.toFixed(4)} + ${totalBonus.toFixed(4)} = ${calculatedTotal.toFixed(4)} (API: ${apiTotal.toFixed(4)})`);
  });

  test('API returns correct paid referral counts per level', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/mining/status/${TEST_USER.uid}`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    const breakdown = data.referral_breakdown;
    
    // Expected paid counts (free users don't count for bonus)
    const expectedPaidCounts = {
      level_1: 2,
      level_2: 6,
      level_3: 3,
      level_4: 6,
      level_5: 4
    };
    
    for (const [level, expectedCount] of Object.entries(expectedPaidCounts)) {
      const actualCount = breakdown[level]?.count || 0;
      expect(actualCount).toBe(expectedCount);
      console.log(`✓ ${level}: ${actualCount} paid (expected ${expectedCount})`);
    }
  });

  test('Referrals levels API matches mining API counts', async ({ request }) => {
    // Get mining API data
    const miningResponse = await request.get(`${BASE_URL}/api/mining/status/${TEST_USER.uid}`);
    expect(miningResponse.status()).toBe(200);
    const miningData = await miningResponse.json();
    
    // Get referrals levels API data
    const referralsResponse = await request.get(`${BASE_URL}/api/referrals/${TEST_USER.uid}/levels`);
    expect(referralsResponse.status()).toBe(200);
    const referralsData = await referralsResponse.json();
    
    // Count paid users from referrals API
    const paidCountsFromReferrals: Record<number, number> = {};
    for (const levelData of referralsData.levels) {
      const level = levelData.level;
      const users = levelData.users || [];
      const paidCount = users.filter((u: any) => 
        !['explorer', 'free', '', null].includes(u.subscription_plan)
      ).length;
      paidCountsFromReferrals[level] = paidCount;
    }
    
    // Compare with mining API
    const breakdown = miningData.referral_breakdown;
    for (let level = 1; level <= 5; level++) {
      const fromReferrals = paidCountsFromReferrals[level] || 0;
      const fromMining = breakdown[`level_${level}`]?.count || 0;
      
      expect(fromReferrals).toBe(fromMining);
      console.log(`✓ L${level}: referrals_api=${fromReferrals}, mining_api=${fromMining} - MATCH`);
    }
  });

  test('Hourly conversion formula is correct', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/mining/status/${TEST_USER.uid}`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    const baseRateRaw = data.base_rate_raw;
    const userMultiplier = data.user_multiplier;
    const dayMultiplier = data.day_multiplier;
    const baseRate = data.base_rate;
    
    // Calculate expected: (raw * multiplier * day) / 24
    const expectedBaseHourly = (baseRateRaw * userMultiplier * dayMultiplier) / 24;
    
    expect(Math.abs(expectedBaseHourly - baseRate)).toBeLessThan(0.001);
    console.log(`✓ Hourly formula: (${baseRateRaw} * ${userMultiplier} * ${dayMultiplier}) / 24 = ${expectedBaseHourly.toFixed(4)} (API: ${baseRate.toFixed(4)})`);
  });
});

test.describe('Mining Page Frontend - Login and View', () => {
  
  test.beforeEach(async ({ page }) => {
    // Remove emergent badge if present
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        const badge = document.querySelector('[class*="emergent"], [id*="emergent-badge"]');
        if (badge) badge.remove();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  });

  test('Login and navigate to mining page', async ({ page }) => {
    // Go to login page
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    
    // Find email input by placeholder
    const emailInput = page.getByPlaceholder(/email|mobile|uid/i).first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_USER.email);
    
    // Click Sign In
    const signInBtn = page.getByRole('button', { name: /sign in/i }).first();
    await signInBtn.click();
    
    // Wait for PIN input
    await page.waitForSelector('input[inputmode="numeric"]', { timeout: 10000 });
    
    // Enter PIN digits
    const pinInputs = page.locator('input[inputmode="numeric"]');
    const count = await pinInputs.count();
    
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await pinInputs.nth(i).fill(TEST_USER.pin[i]);
      }
    } else if (count === 1) {
      await pinInputs.first().fill(TEST_USER.pin);
    }
    
    // Wait for login to complete
    await expect(page).toHaveURL(/dashboard|home/i, { timeout: 20000 });
    
    // Navigate to mining page
    await page.goto('/mining', { waitUntil: 'domcontentloaded' });
    
    // Take screenshot of mining page
    await page.screenshot({ path: '/app/tests/e2e/mining-page-full.jpeg', quality: 20 });
    
    // Wait for Mining Speed Breakdown to appear
    await expect(page.getByText('Mining Speed Breakdown')).toBeVisible({ timeout: 15000 });
  });

  test('Mining page displays all level breakdowns', async ({ page }) => {
    // Login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    const emailInput = page.getByPlaceholder(/email|mobile|uid/i).first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_USER.email);
    
    const signInBtn = page.getByRole('button', { name: /sign in/i }).first();
    await signInBtn.click();
    
    await page.waitForSelector('input[inputmode="numeric"]', { timeout: 10000 });
    
    const pinInputs = page.locator('input[inputmode="numeric"]');
    const count = await pinInputs.count();
    
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await pinInputs.nth(i).fill(TEST_USER.pin[i]);
      }
    }
    
    await expect(page).toHaveURL(/dashboard|home/i, { timeout: 20000 });
    
    // Navigate to mining page
    await page.goto('/mining', { waitUntil: 'domcontentloaded' });
    
    // Wait for breakdown section
    await expect(page.getByText('Mining Speed Breakdown')).toBeVisible({ timeout: 15000 });
    
    // Verify all level labels are displayed
    await expect(page.getByText('Your Mining')).toBeVisible();
    await expect(page.getByText('Level 1 Referrals')).toBeVisible();
    await expect(page.getByText('Level 2 Referrals')).toBeVisible();
    await expect(page.getByText('Level 3 Referrals')).toBeVisible();
    await expect(page.getByText('Level 4 Referrals')).toBeVisible();
    await expect(page.getByText('Level 5 Referrals')).toBeVisible();
    await expect(page.getByText('TOTAL SPEED')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: '/app/tests/e2e/mining-breakdown-all-levels.jpeg', quality: 20 });
  });
});
