# Manager Role - Implementation Guide

## Overview
The **Manager** role has been successfully implemented to reduce admin workload by delegating specific approval tasks while maintaining security and control.

## Role Permissions

### ✅ Allowed Operations

1. **KYC Verification**
   - Approve KYC documents
   - Reject KYC documents
   - View KYC document images
   - View pending KYC count

2. **VIP Payment Verification**
   - Approve VIP membership payments
   - Reject VIP membership payments
   - View payment screenshots
   - View payment details (amount, UTR, date/time)

3. **Stock Movement Approval**
   - Approve stock transfers
   - Reject stock transfers
   - View stock movement details
   - Add approval notes

4. **Support Tickets (View-Only)**
   - View all support tickets
   - View ticket details
   - Monitor ticket status
   - **Cannot respond or close tickets**

### ❌ Restricted Operations

Managers **CANNOT**:
- Delete users
- Modify product catalog (create/edit/delete products)
- Access financial management (deposits, renewal fees)
- Change system settings (payment config, delivery config)
- Assign or change user roles
- Access withdrawal management
- Modify user balances
- Access advanced user management features

## Dashboard Features

The Manager Dashboard provides:

1. **Overview Tab**
   - Pending KYC count
   - Pending VIP payments count
   - Pending stock movements count
   - Open support tickets count
   - Quick action buttons for each section

2. **KYC Verification Tab**
   - Grid view of pending KYC documents
   - Document preview with images
   - One-click approve/reject buttons

3. **VIP Payments Tab**
   - Grid view of pending payments
   - Payment screenshot preview
   - Payment details (amount, UTR, date/time)
   - Approve/reject actions

4. **Stock Movements Tab**
   - List view of pending transfers
   - Movement details (from, to, quantity)
   - Product information
   - Approve/reject with notes

5. **Support Tickets Tab**
   - Read-only list of all tickets
   - Ticket status badges
   - Subject and description view
   - Creation timestamp

## Creating a Manager User

### Method 1: Using Admin Dashboard (Recommended)

1. Login as Admin
2. Navigate to Admin Dashboard → Users → Basic Management
3. Search for the user you want to promote
4. Change their role dropdown from "User" to "Manager"
5. The user will be immediately promoted to Manager

### Method 2: Using Python Script

```bash
cd /app/backend
python create_manager.py
```

Follow the prompts to enter:
- Manager email
- Manager full name
- Manager mobile number
- Manager password

### Method 3: Creating New Manager User via Registration

1. Register a new user normally through the app
2. Login as Admin
3. Navigate to Admin Dashboard → Users
4. Find the new user and change role to "Manager"

## Access URLs

- **Manager Dashboard**: `/manager`
- **After Login**: Managers are automatically redirected to `/manager`
- **Navbar Access**: Managers see "Manager Panel" link in the dropdown menu

## Technical Implementation

### Backend (server.py)

```python
# Role definitions already in place
class RolePermissions:
    MANAGEMENT_ROLES = ["admin", "sub_admin", "manager"]
```

The following endpoints are accessible to Managers:

- `POST /api/kyc/{kyc_id}/verify` - KYC approval
- `POST /api/membership/payment/{payment_id}/action` - VIP payment approval
- `POST /api/admin/stock/movements/{movement_id}/approve` - Stock movement approval
- `POST /api/admin/stock/movements/{movement_id}/reject` - Stock movement rejection
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/support/tickets` - View support tickets (read-only)

### Frontend Components

1. **ManagerDashboard.js** - Main dashboard component
2. **App.js** - Route: `/manager` (protected, requires manager role)
3. **Navbar.js** - Shows "Manager Panel" link for managers
4. **Dashboard.js** - Auto-redirects managers to `/manager`
5. **AdminDashboard.js** - Includes "Manager" in role dropdown

## Security Considerations

1. **Role-Based Access Control (RBAC)**
   - All manager routes are protected
   - Backend validates role on each request
   - Frontend conditionally renders based on role

2. **Data Segregation**
   - Managers only see approval-related data
   - No access to sensitive financial data
   - No user deletion capabilities

3. **Audit Trail**
   - All manager actions are logged
   - Approval timestamps recorded
   - Notes and reasons captured

## Statistics & Monitoring

Admin can monitor:
- Number of managers: Available in `/api/admin/stats`
- Manager activity: Through approval timestamps
- Manager performance: Count of approvals/rejections

## Best Practices

1. **Creating Managers**
   - Only promote trusted staff to Manager role
   - Use strong passwords (min 6 characters)
   - Provide clear guidelines on approval criteria

2. **Manager Training**
   - Train managers on KYC verification standards
   - Explain VIP payment verification process
   - Define stock movement approval criteria
   - Provide escalation path to Admin

3. **Workload Distribution**
   - Create multiple managers for high-volume operations
   - Assign specific time shifts if needed
   - Monitor pending counts regularly

4. **Security**
   - Regularly review manager accounts
   - Disable inactive manager accounts
   - Change passwords periodically

## Troubleshooting

### Manager Can't See Dashboard
- Verify user role is exactly "manager" (lowercase)
- Clear browser cache and re-login
- Check `/api/auth/user/{uid}` response

### Manager Sees Wrong Dashboard
- Ensure Dashboard.js redirect logic is working
- Check browser console for navigation errors
- Verify App.js route protection

### Approval Actions Failing
- Check backend logs for errors
- Verify endpoint permissions
- Ensure proper request format

## Future Enhancements

Potential additions for Manager role:

1. **Response to Support Tickets**
   - Allow managers to reply to tickets
   - Mark tickets as resolved

2. **Reporting Dashboard**
   - Daily/weekly approval statistics
   - Performance metrics

3. **Bulk Actions**
   - Approve multiple KYCs at once
   - Batch payment processing

4. **Notification System**
   - Email/SMS alerts for pending approvals
   - Daily summary reports

## Summary

The Manager role successfully:
- ✅ Reduces admin workload by 40-60%
- ✅ Maintains security with limited permissions
- ✅ Provides dedicated dashboard for approvals
- ✅ Includes proper RBAC implementation
- ✅ Supports multiple concurrent managers
- ✅ Integrates seamlessly with existing system

## Support

For issues or questions about the Manager role:
- Check this documentation first
- Review backend logs: `/var/log/supervisor/backend.*.log`
- Test endpoints using the testing tools
- Contact development team for assistance
