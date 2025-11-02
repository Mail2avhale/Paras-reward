# Critical Fixes Implementation Plan

## Issues to Fix:

### 1. VIP PRC Expiry (CRITICAL)
- **Issue**: PRC expires after 24 hours for ALL users
- **Fix**: Exempt VIP users from 24-hour PRC expiry
- **Files**: backend/server.py (mining expiry logic)

### 2. Wallet Withdrawal Logic (ALREADY FIXED ✅)
- **Status**: Both cashback and profit withdrawals already deduct immediately and refund on rejection
- **No action needed**

### 3. Wallet Transaction History (HIGH PRIORITY)
- **Issue**: No transaction history visible to users
- **Fix**: Create transaction history API and frontend display
- **Files**: backend/server.py, frontend WalletNew.js

### 4. Delivery Charges on Order Delivery (CRITICAL)
- **Issue**: Delivery charges not deducted from user's cashback wallet
- **Fix**: Calculate and deduct delivery charges during checkout from cashback wallet
- **Files**: backend/server.py (checkout endpoint)

### 5. User Dashboard Quick Access Menu (MEDIUM PRIORITY)
- **Issue**: No quick access menu on user dashboard
- **Fix**: Add navigation similar to stockist panels
- **Files**: frontend/src/pages/Dashboard.js

### 6. Admin Wallet Management Real-time Updates (CRITICAL)
- **Issue**: Manual wallet adjustments by admin not showing on user dashboard
- **Fix**: Ensure wallet balance updates are immediate and visible
- **Files**: backend/server.py, frontend wallet pages

## Implementation Order:

### Phase 1: Critical Backend Fixes
1. Fix VIP PRC expiry exemption
2. Fix delivery charges deduction from cashback wallet
3. Add wallet transaction history API
4. Verify admin wallet management endpoints

### Phase 2: Frontend Updates
1. Display wallet transaction history
2. Add user dashboard quick access menu
3. Verify real-time wallet balance updates

## Testing Requirements:
- Test VIP user PRC doesn't expire after 24 hours
- Test free user PRC expires after 24 hours
- Test delivery charges are deducted on order delivery
- Test transaction history displays all operations
- Test admin wallet adjustments reflect immediately
