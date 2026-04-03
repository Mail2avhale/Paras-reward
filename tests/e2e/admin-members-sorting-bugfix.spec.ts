import { test, expect } from '@playwright/test';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://prc-economy-fix.preview.emergentagent.com';

test.describe('Admin Members List - Sorting Bug Fix Verification', () => {
  /**
   * Bug Fixed: Frontend was sending sort_field/sort_direction but backend expected sort_by/sort_order
   * After fix: AdminMembers.js now correctly sends sort_by and sort_order params
   * 
   * Tests verify the API responses match expected behavior since the frontend 
   * displays data directly from these API responses.
   */

  test.describe('Sorting Functionality', () => {
    test('Sort by redeem_limit DESC - Elite (39950) should come first', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/members/list`, {
        params: {
          sort_by: 'redeem_limit',
          sort_order: 'desc',
          limit: 10
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.members).toBeDefined();
      expect(data.members.length).toBeGreaterThan(0);
      
      // Extract limits and verify descending order
      const limits = data.members.map((m: any) => m.redeem_limit?.total_limit || 0);
      
      for (let i = 0; i < limits.length - 1; i++) {
        expect(limits[i]).toBeGreaterThanOrEqual(limits[i + 1]);
      }
      
      // Verify Elite (39950) comes before Growth (24950)
      const eliteUser = data.members.find((m: any) => m.subscription_plan === 'elite');
      const growthUser = data.members.find((m: any) => m.subscription_plan === 'growth');
      
      if (eliteUser && growthUser) {
        const eliteLimit = eliteUser.redeem_limit?.total_limit || 0;
        const growthLimit = growthUser.redeem_limit?.total_limit || 0;
        expect(eliteLimit).toBeGreaterThan(growthLimit);
      }
    });

    test('Sort by prc_balance DESC - highest balance first', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/members/list`, {
        params: {
          sort_by: 'prc_balance',
          sort_order: 'desc',
          limit: 10
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      const balances = data.members.map((m: any) => m.prc_balance || 0);
      
      for (let i = 0; i < balances.length - 1; i++) {
        expect(balances[i]).toBeGreaterThanOrEqual(balances[i + 1]);
      }
    });

    test('Sort by used_limit DESC works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/members/list`, {
        params: {
          sort_by: 'used_limit',
          sort_order: 'desc',
          limit: 10
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      const used = data.members.map((m: any) => m.redeem_limit?.total_redeemed || 0);
      
      for (let i = 0; i < used.length - 1; i++) {
        expect(used[i]).toBeGreaterThanOrEqual(used[i + 1]);
      }
    });

    test('Sort by available_limit DESC works', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/members/list`, {
        params: {
          sort_by: 'available_limit',
          sort_order: 'desc',
          limit: 10
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      const available = data.members.map((m: any) => m.redeem_limit?.remaining_limit || 0);
      
      for (let i = 0; i < available.length - 1; i++) {
        expect(available[i]).toBeGreaterThanOrEqual(available[i + 1]);
      }
    });
  });

  test.describe('PRC Balance Display (Bug Fix: Was showing 0)', () => {
    test('PRC Balance field exists and contains actual values', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/members/list`, {
        params: { limit: 20 }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      // Verify prc_balance field exists for all members
      for (const member of data.members) {
        expect(member).toHaveProperty('prc_balance');
      }
      
      // At least one paid user should have non-zero balance
      const paidUsers = data.members.filter((m: any) => 
        ['elite', 'growth', 'startup'].includes(m.subscription_plan)
      );
      
      if (paidUsers.length > 0) {
        const hasNonZeroBalance = paidUsers.some((m: any) => (m.prc_balance || 0) > 0);
        expect(hasNonZeroBalance).toBeTruthy();
      }
    });

    test('Test User DMT has significant PRC balance (not 0)', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/members/list`, {
        params: { 
          search: 'Test User DMT',
          limit: 5 
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      const testUser = data.members.find((m: any) => m.name?.includes('Test User DMT'));
      if (testUser) {
        // This user is known to have ~97,000 PRC balance
        expect(testUser.prc_balance).toBeGreaterThan(1000);
      }
    });
  });

  test.describe('Redeem Limit Formula Validation', () => {
    /**
     * Formula: Total Limit = Plan Price × 5 × 10 × months_active × (1 + 0.20 × active_referrals)
     * Elite = 799 × 5 × 10 = 39,950 PRC base/month
     * Growth = 499 × 5 × 10 = 24,950 PRC base/month
     * Explorer = 0 PRC
     */

    test('Elite user has correct limit: 799 × 5 × 10 = 39,950', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/members/list`, {
        params: { 
          subscription: 'elite',
          limit: 5 
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      if (data.members.length === 0) {
        test.skip();
        return;
      }
      
      const eliteUser = data.members[0];
      const redeem = eliteUser.redeem_limit;
      
      const monthsActive = redeem.months_active || 1;
      const activeReferrals = redeem.active_referrals || 0;
      const expected = 39950 * monthsActive * (1 + 0.2 * activeReferrals);
      
      expect(redeem.total_limit).toBe(expected);
    });

    test('Growth user has correct limit: 499 × 5 × 10 = 24,950', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/members/list`, {
        params: { 
          subscription: 'growth',
          limit: 5 
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      if (data.members.length === 0) {
        test.skip();
        return;
      }
      
      const growthUser = data.members[0];
      const redeem = growthUser.redeem_limit;
      
      const monthsActive = redeem.months_active || 1;
      const activeReferrals = redeem.active_referrals || 0;
      const expected = 24950 * monthsActive * (1 + 0.2 * activeReferrals);
      
      expect(redeem.total_limit).toBe(expected);
    });

    test('remaining_limit = total_limit - total_redeemed', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/members/list`, {
        params: { limit: 10 }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      for (const member of data.members) {
        const redeem = member.redeem_limit;
        const expectedRemaining = Math.max(0, redeem.total_limit - redeem.total_redeemed);
        expect(redeem.remaining_limit).toBe(expectedRemaining);
      }
    });
  });

  test.describe('API Data Structure', () => {
    test('Members list returns redeem_limit object with required fields', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/members/list`, {
        params: { limit: 5 }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      for (const member of data.members) {
        expect(member).toHaveProperty('redeem_limit');
        expect(member.redeem_limit).toHaveProperty('total_limit');
        expect(member.redeem_limit).toHaveProperty('total_redeemed');
        expect(member.redeem_limit).toHaveProperty('remaining_limit');
      }
    });

    test('Pagination structure is correct', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/members/list`, {
        params: { 
          page: 1,
          limit: 5 
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data).toHaveProperty('members');
      expect(data).toHaveProperty('pagination');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('total_pages');
    });
  });
});
