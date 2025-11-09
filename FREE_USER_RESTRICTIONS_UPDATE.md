# Free User Restrictions Implementation Plan

## Summary of Changes

### 1. PRC Validity System
- Free users: PRC expires after 2 days from mining
- VIP users: PRC never expires (lifetime validity)
- Track expiry date for each PRC transaction
- Auto-expire old PRC

### 2. PRC Usage Restrictions
- Free users: Can ONLY use PRC for Treasure Hunt
- Cannot use for marketplace purchases
- Show upgrade prompt when attempting to shop

### 3. Treasure Hunt Cashback Rates
- Free users: 10% cashback (was 50%)
- Free top player: 20% cashback (was 100%)
- VIP users: 50% cashback (no change)
- VIP top player: 100% cashback (no change)

### 4. Withdrawal Limits
- Free users: Minimum ₹1000 withdrawal
- VIP users: Minimum ₹100 withdrawal (current)

### 5. KYC Document Selection
- Choose ONE document: Aadhaar OR PAN
- Not both (simplified process)

## Database Schema Updates

### Users Collection:
```javascript
{
  // Existing fields...
  prc_balance: 1000,
  valid_prc: 850,        // NEW: PRC that hasn't expired
  expired_prc: 150,      // NEW: PRC that expired
  prc_transactions: [    // Track each PRC earning with expiry
    {
      amount: 100,
      date: "2024-11-07",
      expires_at: "2024-11-09",  // 2 days later
      type: "mining",
      expired: false
    }
  ]
}
```

### Implementation Files to Update:
1. `/app/backend/server.py` - Mining, treasure hunt, withdrawal endpoints
2. `/app/frontend/src/pages/Mining.js` - Show expiry warnings
3. `/app/frontend/src/pages/TreasureHunt.js` - Show different cashback rates
4. `/app/frontend/src/pages/Marketplace.js` - Restrict free users
5. `/app/frontend/src/pages/WalletNew.js` - Show withdrawal limits
6. `/app/frontend/src/pages/KYCVerification.js` - Single document selection

## Next Steps:
Implementation will be done in the code files directly.
