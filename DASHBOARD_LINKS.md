# DASHBOARD ACCESS GUIDE - PARAS REWARD

## 🎯 Quick Access Links

### For Testing & Development:
```
Base URL: https://paras-reward.preview.emergentagent.com
```

---

## 📊 All Dashboard URLs

### 1. **User Dashboard**
**URL:** `https://paras-reward.preview.emergentagent.com/dashboard`
**Role Required:** `user` (default)
**Access:** All registered users

**Features:**
- Mining status
- PRC balance
- Quick actions (Mining, Game, Referrals, Marketplace)
- Profile summary
- VIP status

---

### 2. **Admin Dashboard** ⭐
**URL:** `https://paras-reward.preview.emergentagent.com/admin`
**Role Required:** `admin`
**Access:** Admin users only

**Features:**
- User Management (view, edit roles, activate/deactivate, delete)
- VIP Payment Approvals
- KYC Verification
- System statistics
- Search & filter users

**How to Access:**
1. Create admin using: `cd /app/backend && python make_admin.py`
2. Or use setup page: `/setup`
3. Login with admin credentials
4. Auto-redirected to `/admin`

---

### 3. **Master Stockist Dashboard** 🏢
**URL:** `https://paras-reward.preview.emergentagent.com/master-stockist`
**Role Required:** `master_stockist`
**Access:** Master Stockist users only

**Features:**
- Stock inventory management
- Sub-stockist network overview
- Order management
- Profit wallet tracking
- Security deposit info (3% monthly return)
- Business reports

**Tabs:**
- Inventory
- Sub Stockists
- Orders
- Reports

**Stats Displayed:**
- Total Stock Units
- Total Sales
- Profit Wallet
- Active Sub Stockists
- Pending Orders

---

### 4. **Sub Stockist Dashboard** 🏪
**URL:** `https://paras-reward.preview.emergentagent.com/sub-stockist`
**Role Required:** `sub_stockist`
**Access:** Sub Stockist users only

**Features:**
- Stock inventory management
- Outlet network overview
- Order management
- Profit wallet tracking
- Security deposit info (3% monthly return)
- Business reports

**Tabs:**
- Inventory
- Outlets
- Orders
- Reports

**Stats Displayed:**
- Total Stock Units
- Total Sales
- Profit Wallet
- Active Outlets
- Pending Orders

---

### 5. **Outlet Panel** 🛒
**URL:** `https://paras-reward.preview.emergentagent.com/outlet`
**Role Required:** `outlet`
**Access:** Outlet users only

**Features:**
- Order verification
- Secret code verification
- Local delivery management
- Sales tracking
- Profit wallet

---

## 🔐 Role Assignment

### Available Roles:
1. `user` - Default for all registrations
2. `admin` - Full system access
3. `master_stockist` - Manages sub-stockists and inventory
4. `sub_stockist` - Manages outlets and inventory
5. `outlet` - Handles local deliveries and verifications

### How to Change Roles:

#### Method 1: Admin Dashboard (Recommended)
1. Login as admin
2. Go to `/admin`
3. Click "User Management" tab
4. Find user and select new role from dropdown
5. Changes apply immediately

#### Method 2: Python Script
```bash
cd /app/backend
python make_admin.py
# Select user and assign role
```

#### Method 3: Direct Database (Advanced)
```python
# Update user role in MongoDB
db.users.update_one(
    {"email": "user@example.com"},
    {"$set": {"role": "master_stockist"}}
)
```

---

## 🚀 Login Auto-Redirect

After login, users are automatically redirected based on their role:

```
admin → /admin
master_stockist → /master-stockist
sub_stockist → /sub-stockist
outlet → /outlet
user → /dashboard
```

---

## 📱 Navigation Access

### Desktop Menu:
- Dropdown menu (top right) shows role-specific dashboard links

### Mobile Menu:
- Hamburger menu includes dashboard access

### Direct URLs:
- Users can also directly visit dashboard URLs
- Unauthorized access redirects to appropriate dashboard

---

## 🛠️ Testing Dashboard Access

### Test User Creation:
1. Register a test account
2. Use make_admin.py to assign role
3. Logout and login again
4. Check auto-redirect works

### Test Each Dashboard:
```bash
# 1. Create test users
# 2. Assign different roles
# 3. Login with each user
# 4. Verify dashboard features
```

---

## 📋 Dashboard Comparison

| Feature | User | Admin | Master | Sub | Outlet |
|---------|------|-------|--------|-----|--------|
| Mining | ✅ | ❌ | ❌ | ❌ | ❌ |
| User Management | ❌ | ✅ | ❌ | ❌ | ❌ |
| Stock Management | ❌ | ❌ | ✅ | ✅ | ❌ |
| Network Overview | ❌ | ✅ | ✅ | ✅ | ❌ |
| Order Verification | ❌ | ❌ | ❌ | ❌ | ✅ |
| Profit Wallet | ❌ | ❌ | ✅ | ✅ | ✅ |
| VIP Approval | ❌ | ✅ | ❌ | ❌ | ❌ |
| KYC Verification | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## 🔗 Quick Links Summary

**Main Dashboards:**
- User: `/dashboard`
- Admin: `/admin`
- Master Stockist: `/master-stockist`
- Sub Stockist: `/sub-stockist`
- Outlet: `/outlet`

**Other Pages:**
- Profile: `/profile`
- Mining: `/mining`
- Tap Game: `/game`
- Referrals: `/referrals`
- Marketplace: `/marketplace`
- VIP: `/vip`
- KYC: `/kyc`
- Wallet: `/wallet`
- Orders: `/orders`
- Leaderboard: `/leaderboard`

**Auth Pages:**
- Login: `/login`
- Register: `/register`
- Forgot Password: `/forgot-password`
- Setup (First Admin): `/setup`

**Static Pages:**
- About: `/about`
- Contact: `/contact`
- Terms: `/terms`
- Privacy: `/privacy`

---

## 💡 Tips

1. **First Time Setup**: Use `/setup` to create first admin
2. **Role Changes**: Always logout/login after role change
3. **Testing**: Create multiple test accounts with different roles
4. **Security**: Only admins can change roles
5. **Direct Access**: Bookmark dashboard URLs for quick access

---

**Last Updated:** $(date)
**Version:** 2.0
