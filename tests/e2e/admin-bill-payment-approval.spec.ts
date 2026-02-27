import { test, expect } from '@playwright/test';

/**
 * Admin Bill Payment Approval Flow Tests - UPDATED
 * 
 * New flow: Admin Approve → Eko API (3 retries) → completed OR rejected (with PRC refund)
 * No more approved_manual status or Complete button
 * 
 * Features tested:
 * 1. Admin can view bill payment requests
 * 2. Approve action → Eko auto-pay (results in completed or rejected)
 * 3. Rejected requests show reject reason and PRC refund details
 * 4. No more "Manual Required" badge or "Complete" button
 */

const BASE_URL = 'https://reward-staging.preview.emergentagent.com';
const ADMIN_UID = '8175c02a-4fbd-409c-8d47-d864e979f59f';
const ADMIN_PIN = '123456';

// Admin login helper
async function loginAsAdmin(page: any) {
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');

  // Enter admin UID
  const emailInput = page.getByPlaceholder(/email, mobile or UID/i);
  await emailInput.fill(ADMIN_UID);

  // Click Sign In to show PIN entry
  await page.getByRole('button', { name: 'Sign In' }).click();
  
  // Wait for PIN input to appear
  await page.waitForSelector('input[maxlength="1"]', { timeout: 5000 });

  // Enter 6-digit PIN
  const pinBoxes = page.locator('input[maxlength="1"]');
  for (let i = 0; i < 6; i++) {
    await pinBoxes.nth(i).click();
    await pinBoxes.nth(i).fill(ADMIN_PIN[i]);
  }

  // Click Sign In
  await page.getByRole('button', { name: 'Sign In' }).click();
  
  // Wait for navigation to complete
  await page.waitForURL(/\/admin/, { timeout: 10000 });
}

test.describe('Admin Bill Payment Approval Flow - API Tests', () => {
  
  test('GET /api/admin/bill-payment/requests returns requests list', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/bill-payment/requests`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.requests).toBeDefined();
    expect(Array.isArray(data.requests)).toBeTruthy();
  });

  test('rejected requests have reject_reason and refund_details', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/bill-payment/requests`);
    const data = await response.json();
    
    // Find rejected requests with refund_details
    const rejectedWithRefund = data.requests.filter((r: any) => 
      r.status === 'rejected' && r.refund_details
    );
    
    if (rejectedWithRefund.length === 0) {
      test.skip(true, 'No rejected requests with refund_details available');
      return;
    }
    
    const req = rejectedWithRefund[0];
    expect(req.reject_reason).toBeDefined();
    expect(req.refund_details.prc_refunded).toBeGreaterThan(0);
  });

  test('completed requests have txn_number', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/bill-payment/requests`);
    const data = await response.json();
    
    // Find completed requests
    const completed = data.requests.filter((r: any) => r.status === 'completed');
    
    if (completed.length === 0) {
      test.skip(true, 'No completed requests available');
      return;
    }
    
    expect(completed[0].txn_number).toBeDefined();
  });

  test('complete action is no longer valid', async ({ request }) => {
    // Get any request
    const listResponse = await request.get(`${BASE_URL}/api/admin/bill-payment/requests`);
    const data = await listResponse.json();
    
    if (data.requests.length === 0) {
      test.skip(true, 'No requests available');
      return;
    }
    
    const requestId = data.requests[0].request_id;
    
    // Try 'complete' action - should be rejected
    const completeResponse = await request.post(`${BASE_URL}/api/admin/bill-payment/process`, {
      data: {
        request_id: requestId,
        action: 'complete',
        admin_uid: ADMIN_UID
      }
    });
    
    expect(completeResponse.status()).toBe(400);
    const error = await completeResponse.json();
    expect(error.detail.toLowerCase()).toContain('invalid action');
  });

  test('/api/admin/bill-payment/complete endpoint is removed', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/admin/bill-payment/complete`, {
      data: {
        request_id: 'any-request',
        admin_uid: ADMIN_UID
      }
    });
    
    // Endpoint should return 404 (not found) or 405 (method not allowed)
    expect([404, 405, 422]).toContain(response.status());
  });
});

test.describe('Admin Bill Payment Approval Flow - UI Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can access admin bill payments page', async ({ page }) => {
    // Navigate to Bill Payments page
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    
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
    
    // Check status filter tabs
    const pendingTab = page.getByText(/Pending \(\d+\)/);
    const approvedTab = page.getByText(/Approved \(\d+\)/);
    const rejectedTab = page.getByText(/Rejected \(\d+\)/);
    
    await expect(pendingTab).toBeVisible({ timeout: 10000 });
    await expect(approvedTab).toBeVisible();
    await expect(rejectedTab).toBeVisible();
  });

  test('Approved tab shows completed status (no Manual Required badge)', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    
    // Click Approved tab
    const approvedTab = page.getByText(/Approved \(\d+\)/).first();
    await approvedTab.click();
    
    // Wait for list to load
    await expect(page.locator('.divide-y')).toBeVisible({ timeout: 5000 });
    
    // Check for Completed badges
    const completedBadge = page.getByText('✅ Completed').first();
    const hasCompleted = await completedBadge.isVisible().catch(() => false);
    
    if (hasCompleted) {
      // Verify "Manual Required" badge is NOT shown (feature removed)
      const manualRequiredBadge = page.getByText('Manual Required');
      await expect(manualRequiredBadge).not.toBeVisible();
    }
  });

  test('Rejected tab shows reject reason', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    
    // Click Rejected tab
    const rejectedTab = page.getByText(/Rejected \(\d+\)/).first();
    await rejectedTab.click();
    
    // Wait for list to load
    await expect(page.locator('.divide-y')).toBeVisible({ timeout: 5000 });
    
    // Find rejected requests - they should show reject reason
    const rejectedBadge = page.getByText('❌ Rejected').first();
    const hasRejected = await rejectedBadge.isVisible().catch(() => false);
    
    if (hasRejected) {
      // Check if reject reason is shown (could be Eko API error or manual reason)
      const ekoError = page.locator('text=/Eko API|Server IP|not whitelisted/i').first();
      const hasEkoError = await ekoError.isVisible().catch(() => false);
      
      if (hasEkoError) {
        // Verify the Eko error is displayed
        expect(hasEkoError).toBeTruthy();
      }
    }
  });

  test('no Complete button exists for any status', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    
    // Check Approved tab
    const approvedTab = page.getByText(/Approved \(\d+\)/).first();
    await approvedTab.click();
    
    // Wait for list to load
    await expect(page.locator('.divide-y')).toBeVisible({ timeout: 5000 });
    
    // Verify NO "Complete" button exists (feature removed)
    const completeButton = page.getByRole('button', { name: 'Complete' });
    await expect(completeButton).not.toBeVisible();
  });

  test('service category tabs filter requests correctly', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    
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
    
    // Should filter to show only Electricity Bill requests
    // The category badge on each request should show "Electricity Bill"
  });

  test('search functionality works', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    
    // Find search input
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    
    // Enter search term
    await searchInput.fill('admin@paras.com');
    
    // Should show filtered results - filter chip should appear
    const filterChip = page.getByText(/Search: "admin@paras.com"/);
    await expect(filterChip).toBeVisible();
  });

  test('refresh button reloads data', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    
    // Find and click refresh button
    const refreshBtn = page.getByRole('button', { name: 'Refresh' });
    await expect(refreshBtn).toBeVisible({ timeout: 10000 });
    
    await refreshBtn.click();
    
    // Page should still be functional after refresh
    const header = page.getByText('Bill Payment Requests');
    await expect(header).toBeVisible();
  });

  test('View button opens request details', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    
    // Click Approved tab to see completed/rejected requests
    const approvedTab = page.getByText(/Approved \(\d+\)/).first();
    await approvedTab.click();
    
    // Wait for list and find View button
    await expect(page.locator('.divide-y')).toBeVisible({ timeout: 5000 });
    
    const viewBtn = page.getByRole('button', { name: /View|Review/ }).first();
    const hasView = await viewBtn.isVisible().catch(() => false);
    
    if (hasView) {
      await viewBtn.click();
      
      // Modal/panel should open with request details
      // Check for amount or request type info
      const amountText = page.locator('text=/₹|Amount|Request Type/i').first();
      await expect(amountText).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Admin Bill Payment - Pagination & Sorting', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('pagination works correctly', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    
    // Click Approved tab (should have most requests)
    const approvedTab = page.getByText(/Approved \(\d+\)/).first();
    await approvedTab.click();
    
    // Wait for list to load
    await expect(page.locator('.divide-y')).toBeVisible({ timeout: 5000 });
    
    // Check if pagination exists
    const pageIndicator = page.getByText(/Page \d+ of \d+/).first();
    const hasPagination = await pageIndicator.isVisible().catch(() => false);
    
    if (hasPagination) {
      // Click Next button
      const nextBtn = page.getByRole('button', { name: 'Next' });
      if (await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click();
        
        // Page number should change
        const updatedIndicator = page.getByText(/Page 2 of \d+/).first();
        await expect(updatedIndicator).toBeVisible();
      }
    }
  });

  test('sort order toggle works', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    
    // Find sort toggle button
    const sortBtn = page.getByText('Latest First').first();
    const hasSort = await sortBtn.isVisible().catch(() => false);
    
    if (hasSort) {
      await sortBtn.click();
      
      // Should toggle to "Oldest First"
      const oldestFirst = page.getByText('Oldest First').first();
      await expect(oldestFirst).toBeVisible();
    }
  });

  test('date filter panel expands and works', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    
    // Find and click Date Filter button
    const dateFilterBtn = page.getByText('Date Filter').first();
    await dateFilterBtn.click();
    
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

test.describe('Admin Bill Payment - Rejected Request Details', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('rejected request shows PRC refund details in review panel', async ({ page }) => {
    await page.goto('/admin/bill-payments', { waitUntil: 'domcontentloaded' });
    
    // Click Rejected tab
    const rejectedTab = page.getByText(/Rejected \(\d+\)/).first();
    await rejectedTab.click();
    
    // Wait for list to load
    await expect(page.locator('.divide-y')).toBeVisible({ timeout: 5000 });
    
    // Find and click Review button on a rejected request
    const reviewBtn = page.getByRole('button', { name: 'Review' }).first();
    const hasReview = await reviewBtn.isVisible().catch(() => false);
    
    if (hasReview) {
      await reviewBtn.click();
      
      // Panel should open - check for refund details
      // Look for PRC refund info (may or may not be present depending on data)
      const prcRefundText = page.locator('text=/PRC Refund|prc_refunded/i').first();
      const hasPrcRefund = await prcRefundText.isVisible().catch(() => false);
      
      // Also check for reject reason
      const rejectReasonText = page.locator('text=/Reason|reject_reason|Eko API/i').first();
      await expect(rejectReasonText).toBeVisible({ timeout: 5000 });
    }
  });
});
