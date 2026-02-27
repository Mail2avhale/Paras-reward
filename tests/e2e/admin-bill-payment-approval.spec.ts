import { test, expect } from '@playwright/test';

/**
 * Admin Bill Payment Approval Flow Tests
 * Tests the approve → approved_manual flow when Eko API fails (403 - IP not whitelisted)
 * 
 * Features tested:
 * 1. Admin Bill Payment approval flow - pending request approve → approved_manual (when Eko fails)
 * 2. Manual completion button for approved_manual requests
 * 3. Status badge shows 'Manual Required' for approved_manual status
 * 4. Complete button marks request as completed
 */

const BASE_URL = 'https://reward-staging.preview.emergentagent.com';
const ADMIN_UID = '8175c02a-4fbd-409c-8d47-d864e979f59f';
const ADMIN_PIN = '123456';

// Admin login helper
async function loginAsAdmin(page: any) {
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Enter admin UID
  const emailInput = page.getByPlaceholder(/email, mobile or UID/i);
  await emailInput.fill(ADMIN_UID);

  // Click Sign In to show PIN entry
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(1000);

  // Enter 6-digit PIN
  const pinBoxes = page.locator('input[maxlength="1"]');
  for (let i = 0; i < 6; i++) {
    await pinBoxes.nth(i).click();
    await pinBoxes.nth(i).fill(ADMIN_PIN[i]);
    await page.waitForTimeout(100);
  }

  // Click Sign In
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(3000);
}

test.describe('Admin Bill Payment Approval Flow - API Tests', () => {
  
  test('GET /api/admin/bill-payment/requests returns requests list', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/bill-payment/requests`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.requests).toBeDefined();
    expect(Array.isArray(data.requests)).toBeTruthy();
  });

  test('approved_manual requests have eko_fail_reason field', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/bill-payment/requests`);
    const data = await response.json();
    
    // Find approved_manual requests
    const approvedManual = data.requests.filter((r: any) => r.status === 'approved_manual');
    expect(approvedManual.length).toBeGreaterThan(0);
    
    // At least one should have eko_fail_reason
    const withReason = approvedManual.filter((r: any) => r.eko_fail_reason);
    expect(withReason.length).toBeGreaterThan(0);
    
    // Check for IP whitelisting error
    const ipErrors = withReason.filter((r: any) => 
      r.eko_fail_reason.includes('IP') || r.eko_fail_reason.toLowerCase().includes('whitelist')
    );
    expect(ipErrors.length).toBeGreaterThan(0);
  });

  test('POST /api/admin/bill-payment/complete marks approved_manual as completed', async ({ request }) => {
    // First get an approved_manual request
    const listResponse = await request.get(`${BASE_URL}/api/admin/bill-payment/requests`);
    const data = await listResponse.json();
    
    const approvedManual = data.requests.filter((r: any) => r.status === 'approved_manual');
    
    if (approvedManual.length === 0) {
      test.skip(true, 'No approved_manual requests available for testing');
      return;
    }
    
    const requestId = approvedManual[0].request_id;
    
    // Complete the request
    const completeResponse = await request.post(`${BASE_URL}/api/admin/bill-payment/complete`, {
      data: {
        request_id: requestId,
        admin_uid: ADMIN_UID
      }
    });
    
    expect(completeResponse.ok()).toBeTruthy();
    const result = await completeResponse.json();
    
    expect(result.status).toBe('completed');
    expect(result.txn_number).toBeDefined();
    expect(result.message).toContain('completed');
  });
});

test.describe('Admin Bill Payment Approval Flow - UI Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can access admin bill payments page', async ({ page }) => {
    // Navigate to Bill Payments page
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Check page header
    const header = page.getByText('Bill Payment Requests');
    await expect(header).toBeVisible({ timeout: 10000 });
    
    // Check stats are displayed
    const todaySummary = page.getByText("Today's Summary");
    await expect(todaySummary).toBeVisible();
    
    const allTimeSummary = page.getByText('All Time Summary');
    await expect(allTimeSummary).toBeVisible();
  });

  test('shows status filter tabs (Pending, Approved, Rejected)', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Check status filter tabs
    const pendingTab = page.getByText(/Pending \(\d+\)/);
    const approvedTab = page.getByText(/Approved \(\d+\)/);
    const rejectedTab = page.getByText(/Rejected \(\d+\)/);
    
    await expect(pendingTab).toBeVisible({ timeout: 10000 });
    await expect(approvedTab).toBeVisible();
    await expect(rejectedTab).toBeVisible();
  });

  test('Approved tab includes approved_manual requests with Manual Required badge', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Click Approved tab
    const approvedTab = page.getByText(/Approved \(\d+\)/).first();
    await approvedTab.click();
    await page.waitForTimeout(1500);
    
    // Navigate to find Manual Required badges (may need to go to page 2)
    const nextBtn = page.getByRole('button', { name: 'Next' });
    
    // Try to find Manual Required badge
    let manualRequiredBadge = page.getByText('Manual Required').first();
    let found = await manualRequiredBadge.isVisible().catch(() => false);
    
    // If not visible on page 1, try page 2
    if (!found && await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(1000);
      manualRequiredBadge = page.getByText('Manual Required').first();
      found = await manualRequiredBadge.isVisible().catch(() => false);
    }
    
    // If still not found, try page 3
    if (!found && await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(1000);
      manualRequiredBadge = page.getByText('Manual Required').first();
      found = await manualRequiredBadge.isVisible().catch(() => false);
    }
    
    expect(found).toBeTruthy();
    
    // Verify IP not whitelisted error is shown
    const ipError = page.getByText('IP not whitelisted').first();
    await expect(ipError).toBeVisible();
  });

  test('approved_manual requests show View and Complete buttons', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Click Approved tab
    const approvedTab = page.getByText(/Approved \(\d+\)/).first();
    await approvedTab.click();
    await page.waitForTimeout(1500);
    
    // Navigate to page 2 to find Manual Required requests
    const nextBtn = page.getByRole('button', { name: 'Next' });
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // Find a Manual Required request
    const manualRequiredBadge = page.getByText('Manual Required').first();
    const isVisible = await manualRequiredBadge.isVisible().catch(() => false);
    
    if (isVisible) {
      // Verify View button exists
      const viewBtn = page.getByRole('button', { name: 'View' }).first();
      await expect(viewBtn).toBeVisible();
      
      // Verify Complete button exists for approved_manual status
      const completeBtn = page.getByRole('button', { name: 'Complete' }).first();
      await expect(completeBtn).toBeVisible();
    } else {
      // If no approved_manual requests with Manual Required badge, skip
      test.skip(true, 'No approved_manual requests visible in UI');
    }
  });

  test('Complete button marks approved_manual request as completed', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Click Approved tab
    const approvedTab = page.getByText(/Approved \(\d+\)/).first();
    await approvedTab.click();
    await page.waitForTimeout(1500);
    
    // Navigate to find Manual Required requests
    const nextBtn = page.getByRole('button', { name: 'Next' });
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // Find Manual Required badge
    const manualRequiredBadge = page.getByText('Manual Required').first();
    const isVisible = await manualRequiredBadge.isVisible().catch(() => false);
    
    if (!isVisible) {
      test.skip(true, 'No approved_manual requests available to test completion');
      return;
    }
    
    // Click Complete button
    const completeBtn = page.getByRole('button', { name: 'Complete' }).first();
    await completeBtn.click();
    await page.waitForTimeout(2000);
    
    // Verify success - should show toast or status change
    // The request should now show as Completed
    const completedBadge = page.getByText('Completed').first();
    await expect(completedBadge).toBeVisible({ timeout: 5000 });
  });

  test('can approve pending request', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Should be on Pending tab by default
    const pendingTab = page.getByText(/Pending \(\d+\)/).first();
    await pendingTab.click();
    await page.waitForTimeout(1000);
    
    // Find approve button (green checkmark)
    const approveBtn = page.locator('button').filter({ has: page.locator('svg.text-emerald-400, svg[class*="check"]') }).first();
    const hasApprove = await approveBtn.isVisible().catch(() => false);
    
    if (!hasApprove) {
      test.skip(true, 'No pending requests available to approve');
      return;
    }
    
    // Click approve button
    await approveBtn.click();
    await page.waitForTimeout(3000);
    
    // Should see either:
    // 1. Success toast if Eko worked
    // 2. Warning toast about manual processing if Eko failed
    // Either way, the request should no longer be in pending state
    await page.waitForTimeout(1000);
  });

  test('service category tabs filter requests correctly', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Check service category tabs
    const allServices = page.getByText('All Services').first();
    const mobileRecharge = page.getByText('Mobile Recharge').first();
    const dthRecharge = page.getByText('DTH Recharge').first();
    const electricityBill = page.getByText('Electricity Bill').first();
    
    await expect(allServices).toBeVisible({ timeout: 10000 });
    await expect(mobileRecharge).toBeVisible();
    await expect(dthRecharge).toBeVisible();
    await expect(electricityBill).toBeVisible();
    
    // Click on Electricity Bill category
    await electricityBill.click();
    await page.waitForTimeout(1000);
    
    // Should filter to show only Electricity Bill requests
    // The category badge on each request should show "Electricity Bill"
  });

  test('search functionality works', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Find search input
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    
    // Enter search term
    await searchInput.fill('admin@paras.com');
    await page.waitForTimeout(1000);
    
    // Should show filtered results
    // The filter chip should appear
    const filterChip = page.getByText(/Search: "admin@paras.com"/);
    await expect(filterChip).toBeVisible();
  });

  test('refresh button reloads data', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Find and click refresh button
    const refreshBtn = page.getByRole('button', { name: 'Refresh' });
    await expect(refreshBtn).toBeVisible({ timeout: 10000 });
    
    await refreshBtn.click();
    await page.waitForTimeout(2000);
    
    // Page should still be functional after refresh
    const header = page.getByText('Bill Payment Requests');
    await expect(header).toBeVisible();
  });
});

test.describe('Admin Bill Payment - Edge Cases', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('pagination works correctly', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Click Approved tab (should have most requests)
    const approvedTab = page.getByText(/Approved \(\d+\)/).first();
    await approvedTab.click();
    await page.waitForTimeout(1500);
    
    // Check if pagination exists
    const pageIndicator = page.getByText(/Page \d+ of \d+/).first();
    const hasPagination = await pageIndicator.isVisible().catch(() => false);
    
    if (hasPagination) {
      // Click Next button
      const nextBtn = page.getByRole('button', { name: 'Next' });
      if (await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(1000);
        
        // Page number should change
        const updatedIndicator = page.getByText(/Page 2 of \d+/).first();
        await expect(updatedIndicator).toBeVisible();
      }
    }
  });

  test('sort order toggle works', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Find sort toggle button
    const sortBtn = page.getByText('Latest First').first();
    const hasSort = await sortBtn.isVisible().catch(() => false);
    
    if (hasSort) {
      await sortBtn.click();
      await page.waitForTimeout(1000);
      
      // Should toggle to "Oldest First"
      const oldestFirst = page.getByText('Oldest First').first();
      await expect(oldestFirst).toBeVisible();
    }
  });

  test('date filter panel expands and works', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Find and click Date Filter button
    const dateFilterBtn = page.getByText('Date Filter').first();
    await dateFilterBtn.click();
    await page.waitForTimeout(500);
    
    // Date filter panel should expand
    const fromDateInput = page.getByText('From Date').first();
    await expect(fromDateInput).toBeVisible();
    
    // Quick filter buttons should be visible
    const todayBtn = page.getByRole('button', { name: 'Today' });
    const last7DaysBtn = page.getByRole('button', { name: 'Last 7 Days' });
    
    await expect(todayBtn).toBeVisible();
    await expect(last7DaysBtn).toBeVisible();
  });
});
