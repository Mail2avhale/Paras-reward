# PARAS APP - Complete User Guide

## 📱 Overview
PARAS APP is a mining-based reward platform where users earn PRC (PARAS Reward Coins) through daily mining, tap games, and referrals. Users can redeem products from the marketplace using their earned coins.

**Conversion Rate:** 10 PRC = ₹1 INR

---

## 🎯 User Roles & Access

### 1. **Regular User**
- Mine PRC coins daily
- Play tap game (100 taps/day)
- Refer friends
- View leaderboard
- Purchase VIP membership
- Complete KYC verification
- Redeem products (VIP + KYC required)
- Use cashback wallet

### 2. **Admin**
**Access:** https://parasadmin.preview.emergentagent.com/admin

**Capabilities:**
- View platform statistics (Total users, VIP users, Orders, etc.)
- Approve/Reject VIP payment requests
- Approve/Reject KYC verifications
- Monitor all platform activities

### 3. **Outlet**
**Access:** https://parasadmin.preview.emergentagent.com/outlet

**Capabilities:**
- Verify customer secret codes
- Mark orders as delivered
- Collect cash fees from customers

---

## 🚀 Getting Started

### Step 1: Create Account
1. Visit: https://parasadmin.preview.emergentagent.com
2. Click "Get Started"
3. Enter your email and name
4. Click "Sign In with Google"

### Step 2: Start Mining
1. Go to "Mining" page
2. Click "Start Mining"
3. Your coins will accumulate based on the formula:
   - `Mining Rate = (Current Date × Base Rate) + Referral Bonus + Game Bonus`
4. Click "Claim Coins" to collect your earnings

### Step 3: Earn More
**Tap Game:**
- Go to "Game" page
- Tap the button up to 100 times daily
- Each tap = 1 PRC

**Referrals:**
- Go to "Referrals" page
- Copy your referral code
- Share with friends
- Earn +10% mining bonus per active referral (max 200)

---

## 👑 VIP Membership

**Price:** ₹1,000/year

**Benefits:**
- ✅ Redeem products from marketplace
- ✅ Lifetime coin validity (vs 24hrs for free users)
- ✅ 25% cashback on redemptions
- ✅ Wallet withdrawal access

**How to Purchase:**
1. Go to "VIP Membership" page
2. Make payment via UPI/Bank transfer
3. Fill payment details (Date, Time, UTR Number)
4. Upload payment screenshot
5. Wait for admin approval

---

## 📄 KYC Verification

**Required for:** Product redemption & wallet withdrawals

**Documents Needed:**
- Aadhaar Card (Front + Back)
- PAN Card (Front)

**Steps:**
1. Go to "KYC Verification" page
2. Upload all 3 documents
3. Click "Submit KYC for Verification"
4. Wait for admin approval

---

## 🛒 Marketplace & Orders

### Redeem Products:
**Requirements:** VIP Membership + KYC Verified

1. Go to "Marketplace" page
2. Browse available products
3. Click "Redeem Now" on desired product
4. You'll receive a Secret Code (e.g., PRC-A1B2C3D4)
5. Show this code at outlet to collect product

### Fees:
- **PRC Deduction:** Product price in PRC
- **Cashback:** 25% back in wallet (in ₹)
- **Cash Fees:** 5% transaction + 10% delivery + GST (paid to outlet)

---

## 💰 Cashback Wallet

### How It Works:
1. Earn 25% cashback on every product redemption
2. Cashback credited in INR (₹) to your wallet
3. Withdraw to UPI/Bank account

### Withdrawal:
- **Minimum:** ₹100
- **Fee:** ₹5 per transaction
- **Requirements:** KYC verified + Active wallet

### Maintenance:
- **Monthly Fee:** ₹99 (auto-deducted)
- **Non-payment:** Wallet freezes after 7 days

---

## 🏆 Leaderboard

- View top miners of the month
- Rankings based on total PRC earned
- Top 3 get special badges
- VIP members highlighted

---

## 🔧 Setting Up Admin/Outlet Access

### Create Admin or Outlet User:

1. **First, create a regular user account**
   - Sign up normally with email/name

2. **Go to Setup Page:**
   - Visit: https://parasadmin.preview.emergentagent.com/setup

3. **Promote User:**
   - Enter user's email
   - Select role (Admin or Outlet)
   - Click "Promote User"

4. **Log out and log back in** to see the new dashboard

### Pre-created Test Accounts:
- **Admin:** admin@paras.com / Admin User
- **Outlet:** outlet@paras.com / Outlet Manager
- **Regular:** test@paras.com / Test User

---

## 📊 Admin Dashboard Guide

### Stats Overview:
- Total Users
- VIP Users
- Total Orders
- Pending KYC Verifications
- Pending VIP Payments

### VIP Payments Tab:
1. View pending payment requests
2. Check payment details (Amount, Date, UTR, Screenshot)
3. Click "Approve" to activate VIP membership
4. Click "Reject" if payment is invalid

### KYC Verifications Tab:
1. View pending KYC documents
2. Verify Aadhaar (Front + Back) and PAN
3. Click "Approve" if documents are valid
4. Click "Reject" if documents are invalid/unclear

---

## 🏪 Outlet Panel Guide

### Verify Orders:
1. Customer shows Secret Code
2. Enter code in "Enter Secret Code" field
3. Click "Verify Code"
4. Order details will appear

### Deliver Product:
1. After verification, give product to customer
2. Collect cash fees shown
3. Click "Mark as Delivered"
4. Order status updated

---

## 📱 Key URLs

- **Home:** https://parasadmin.preview.emergentagent.com
- **Setup (Promote Users):** https://parasadmin.preview.emergentagent.com/setup
- **Admin Dashboard:** https://parasadmin.preview.emergentagent.com/admin
- **Outlet Panel:** https://parasadmin.preview.emergentagent.com/outlet

---

## 🎮 Mining Formula Details

**Base Rate:** Starts at 50, decreases by 1 for every 100 new users (minimum 10)

**Per Minute Rate:** `(Base Rate × Current Date) ÷ 1440`

**Example:**
- Date: 10th
- Users: 100
- Base Rate: 50
- Active Referrals: 5
- Referral Bonus: 5 × 10% × 50 = 25
- Total Rate: (10 × 50) + 25 = 525 PRC/day
- Per Minute: 525 ÷ 1440 = 0.365 PRC/min

---

## ⚠️ Important Rules

1. **Free Users:** 
   - Cannot redeem products
   - Coins expire after 24 hours

2. **VIP Users:**
   - Must renew annually
   - 15-day grace period after expiry
   - Account deactivated if not renewed

3. **Referrals:**
   - Only active referrals count (logged in within 24h)
   - Maximum 200 referrals

4. **Wallet:**
   - Freezes if ₹99 maintenance not paid for 7 days
   - Withdrawals blocked when frozen

5. **Orders:**
   - Secret codes are one-time use
   - Cannot be reused after verification

---

## 🛠️ Technical Stack

- **Backend:** FastAPI + MongoDB
- **Frontend:** React + Shadcn UI + TailwindCSS
- **Database:** MongoDB (local)
- **Authentication:** Email-based (Google OAuth simulation)

---

## 📞 Support

For any issues or queries, contact your system administrator.

---

**Version:** 1.0  
**Last Updated:** January 2025
