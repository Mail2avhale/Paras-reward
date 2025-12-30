# Priority 1 Implementation Plan

## Status: In Progress

### ✅ COMPLETED
- [x] Fix referral bonus calculation bug
- [x] Active referrals now showing correctly
- [x] Mining rate includes referral bonuses

### 🚀 IN PROGRESS

#### A. Cleanup (Remove Unused Features)
1. [ ] Remove Treasury Hunt references
   - File exists: /app/frontend/src/pages/TreasureHunt.js
   - Already removed from routes
   - Action: Backup file

2. [ ] Remove Withdrawal features
   - Files: WalletNew.js, WithdrawalManagementAdmin.js
   - Action: Remove from Admin menu, backup files

3. [ ] Remove Topper Cashback
   - Action: Search and remove from dashboard

#### B. Navigation Improvements
4. [ ] Bottom menu on ALL pages
   - Current: Only on Dashboard
   - Action: Move to App.js layout wrapper
   - Pages: Profile, Marketplace, Settings, etc.

5. [ ] Top menu auto-disappear
   - Add scroll listener
   - Hide on scroll down, show on scroll up
   - Keep logo visible

#### C. User Experience
6. [ ] Single-click selfie upload
   - Profile picture: Add direct camera button
   - Remove crop step for selfies
   - Quick capture flow

7. [ ] Show total redeemed PRC + value
   - Dashboard stats card
   - Backend: Calculate from completed orders
   - Show: Total PRC used + ₹ value

8. [ ] VIP transaction history
   - Add to Profile section
   - Show all VIP payments
   - Status, date, amount

#### D. Admin Features
9. [ ] Pagination for bills/vouchers (10 per page)
   - Backend: Add skip/limit parameters
   - Frontend: Add pagination component
   - Pages: AdminBillPayments, AdminGiftVouchers

10. [ ] Processing time message (3-7 days)
    - Add to submission confirmation
    - Show on pending requests
    - User-facing message

11. [ ] Admin edit policies
    - T&C, Privacy Policy, Refund Policy
    - New admin page: Policy Editor
    - Store in database
    - Rich text editor

### 📋 Implementation Order
1. Cleanup first (makes codebase cleaner)
2. Navigation (affects all pages)
3. Backend pagination (needed for admin)
4. Admin features
5. User features

### ⏱️ Estimated Time
- Cleanup: 15 min
- Navigation: 30 min
- Backend work: 45 min
- Frontend components: 60 min
- Total: ~2.5 hours

### 🎯 Success Criteria
- [ ] All unused features removed
- [ ] Bottom nav works on all pages
- [ ] Admin can paginate through records
- [ ] Users see processing time messages
- [ ] Total PRC usage displayed
- [ ] No console errors
- [ ] Mobile responsive
