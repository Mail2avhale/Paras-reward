# PARAS REWARD - Dashboard Access Guide

## 🎯 Quick Start

### Option 1: Use the Script to Make Yourself Admin (FASTEST)

1. **Run the admin script:**
```bash
cd /app/backend
python make_admin.py
```

2. **Follow the prompts:**
   - The script will list all registered users
   - Enter the number of the user you want to make admin
   - Type 'YES' to confirm

3. **Login again:**
   - Logout from the app
   - Login with your credentials
   - You'll now be redirected to `/admin` dashboard

---

### Option 2: Use First-Time Setup Page

1. **Visit the setup page:**
   ```
   https://role-manager-merge.preview.emergentagent.com/setup
   ```

2. **Create first admin:**
   - Fill in admin details (name, email, mobile, password)
   - Click "Create Admin Account"
   - Login with the new admin credentials

3. **Access admin dashboard:**
   - After login, you'll be automatically redirected to `/admin`

---

## 📊 Available Dashboards

### 1. User Dashboard (`/dashboard`)
- **Access:** Any logged-in user with role "user"
- **Features:**
  - Mining status
  - Tap game
  - Referrals
  - Marketplace
  - Wallet
  - VIP membership
  - KYC verification

### 2. Admin Dashboard (`/admin`)
- **Access:** Users with role "admin"
- **Features:**
  - **User Management Tab:**
    - View all users
    - Search by name/email/mobile
    - Filter by role
    - Change user roles
    - Activate/deactivate users
    - Delete users
  - **VIP Payments Tab:**
    - Approve/reject VIP membership payments
  - **KYC Verification Tab:**
    - Approve/reject KYC documents

### 3. Outlet Panel (`/outlet`)
- **Access:** Users with role "outlet"
- **Features:**
  - Order verification
  - Secret code verification
  - Stock management

### 4. Master Stockist Dashboard
- **Status:** Role defined, dashboard pending implementation
- **Role:** "master_stockist"

### 5. Sub Stockist Dashboard
- **Status:** Role defined, dashboard pending implementation
- **Role:** "sub_stockist"

---

## 🔐 User Roles

| Role | Access | URL |
|------|--------|-----|
| `user` | Standard user dashboard | `/dashboard` |
| `admin` | Full admin dashboard | `/admin` |
| `outlet` | Outlet panel | `/outlet` |
| `master_stockist` | (Pending implementation) | TBD |
| `sub_stockist` | (Pending implementation) | TBD |

---

## 🛠️ Admin Features

### User Management
- **View all users** with pagination
- **Search** by name, email, or mobile
- **Filter** by role
- **Change roles** via dropdown
- **Toggle status** (activate/deactivate)
- **Delete users** (with confirmation)
- **View balances** (PRC, cash wallet)

### Role Assignment
You can change any user's role from the admin dashboard:
1. Go to `/admin`
2. Click "User Management" tab
3. Find the user
4. Select new role from dropdown
5. Role updates automatically

---

## 🚀 API Endpoints Added

### Admin Management
- `GET /api/admin/check-admin-exists` - Check if admin exists
- `POST /api/admin/create-first-admin` - Create first admin
- `GET /api/admin/users` - Get all users (with search/filter)
- `PUT /api/admin/users/{uid}/role` - Update user role
- `PUT /api/admin/users/{uid}/status` - Activate/deactivate user
- `DELETE /api/admin/users/{uid}` - Delete user
- `GET /api/admin/users/{uid}` - Get user details

---

## 💡 Tips

### Making Your First Admin
1. Register a regular user account first
2. Run `python make_admin.py` from backend directory
3. Select your user from the list
4. Confirm the promotion
5. Logout and login again

### Changing Roles via Admin Panel
- Login as admin
- Go to User Management tab
- Select user and change role from dropdown
- User needs to logout/login to see new dashboard

### Security
- Only admins can access `/admin` routes
- Only outlets can access `/outlet` routes
- Prevents deleting the last admin
- Role changes are instant

---

## 🔧 Troubleshooting

### Can't Access Admin Dashboard
1. Check your user role: Must be "admin"
2. Logout and login again
3. Verify you're going to `/admin` not `/dashboard`

### Script Not Working
```bash
# Make sure you're in backend directory
cd /app/backend

# Check if MongoDB is accessible
echo $MONGO_URL

# Run script
python make_admin.py
```

### Admin Already Exists Error
- An admin user already exists in the system
- Use the admin script to check which user is admin
- Or login with existing admin credentials

---

## 📝 Summary

**You now have 3 ways to create/manage admins:**
1. ✅ Python script (`make_admin.py`) - Quickest
2. ✅ First-time setup page (`/setup`) - User-friendly
3. ✅ Admin dashboard (`/admin`) - After you're admin

**All dashboards are role-based and automatically redirect users to their appropriate dashboard after login.**

---

Generated: $(date)
Version: 1.0
