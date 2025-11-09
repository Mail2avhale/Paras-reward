# Manager Dashboard - Industry Standard Design & Features

## Overview
The Manager role serves as a middle-tier administrative position between regular users and super admins. Managers handle operational tasks, team oversight, and specific business functions without full system access.

## Industry-Standard Manager Features

### 1. **Dashboard Overview** (Home)
- **Key Metrics Cards**
  - Total Active Users (assigned territory/team)
  - Total Sales/Orders Today/Week/Month
  - Pending Approvals Count
  - Revenue Generated
  - Active Tasks/Issues

- **Quick Actions Panel**
  - Approve Pending KYC
  - Process Withdrawals
  - Add Product/Stock
  - Create Announcement
  - View Reports

- **Recent Activity Feed**
  - Latest orders
  - New user registrations
  - Pending approvals
  - System alerts

- **Performance Charts**
  - Sales trends (7-day, 30-day)
  - User growth
  - Order fulfillment rate
  - Revenue breakdown

---

### 2. **User Management**
**Capabilities:**
- View all users in assigned territory
- Search & filter users (by status, membership, location)
- View detailed user profiles
- Approve/Reject KYC documents
- Deactivate/Reactivate user accounts
- Add notes to user profiles
- View user activity history
- Export user list to CSV/Excel

**Limitations:**
- Cannot delete users permanently (admin only)
- Cannot modify user roles to admin
- Cannot access sensitive financial data beyond their scope

**UI Features:**
- Advanced search with multiple filters
- Bulk actions (approve multiple KYCs, send notifications)
- User detail modal/drawer
- Activity timeline
- Document viewer for KYC

---

### 3. **Order Management**
**Capabilities:**
- View all orders (pending, processing, completed, cancelled)
- Update order status (pending → processing → shipped → delivered)
- Assign orders to stockists/delivery
- Process refunds (with limits)
- Add internal notes to orders
- Generate invoice/packing slip
- Track order fulfillment metrics

**Workflow:**
1. Order Placed → Manager Reviews
2. Stock Check → Assign Stockist
3. Process Order → Mark Shipped
4. Delivery Tracking → Mark Delivered
5. Handle Issues → Refund/Replace

**UI Features:**
- Order status pipeline view
- Filters (date range, status, user, stockist)
- Quick status update buttons
- Order detail modal with full history
- Print invoice button
- Bulk order processing

---

### 4. **Product & Inventory Management**
**Capabilities:**
- Add new products (with approval workflow)
- Edit product details (price, description, images)
- Update stock quantities
- Set product visibility (active/inactive)
- Manage product categories
- Track stock movements
- Set low-stock alerts
- Bulk import products (CSV)

**Stock Management:**
- View current stock levels
- Add stock (with reason/source)
- Transfer stock between locations
- Stock adjustment history
- Low stock alerts

**UI Features:**
- Product list with stock indicators
- Quick edit modal
- Image upload with preview
- Category management
- Stock movement log
- Excel/CSV export

---

### 5. **Financial Management** (Limited)
**Capabilities:**
- View transaction reports (sales, commissions)
- Process pending withdrawals
- Approve cashback releases
- View revenue dashboards
- Generate financial reports (daily, weekly, monthly)
- Track commission distribution

**Limitations:**
- Cannot modify commission rates (admin only)
- Cannot access full financial audit logs
- Withdrawal approval limits (e.g., max ₹50,000/transaction)

**UI Features:**
- Transaction list with filters
- Withdrawal approval queue
- Financial summary cards
- Revenue charts (bar, line, pie)
- Export reports (PDF, Excel)

---

### 6. **Stockist Management**
**Capabilities:**
- View all stockists (Master, Sub-stockists)
- Monitor stockist performance
- Assign/reassign stockists to territories
- Track stock transfers
- View stockist wallet balances
- Process stockist commissions
- Handle stockist inquiries

**Performance Metrics:**
- Orders fulfilled
- Average delivery time
- Customer ratings
- Revenue generated
- Stock utilization

**UI Features:**
- Stockist list with performance indicators
- Territory map view
- Performance comparison table
- Stock transfer interface
- Communication tools

---

### 7. **Reports & Analytics**
**Available Reports:**
- Sales Report (daily, weekly, monthly, custom)
- User Growth Report
- Product Performance Report
- Stockist Performance Report
- Commission Report
- KYC Approval Rate Report
- Order Fulfillment Report
- Revenue Report

**Chart Types:**
- Line charts (trends over time)
- Bar charts (comparisons)
- Pie charts (distribution)
- Donut charts (category breakdown)
- Area charts (cumulative metrics)

**Export Options:**
- PDF (formatted report)
- Excel (raw data)
- CSV (for analysis)

**UI Features:**
- Date range selector
- Multiple chart views
- Print-friendly layout
- Scheduled reports (email daily/weekly)

---

### 8. **Communication Tools**
**Features:**
- Send announcements to users
- Push notifications (targeted)
- Email campaigns
- SMS alerts (for important updates)
- In-app messaging

**Targeting Options:**
- All users
- Specific user groups (VIP, Free, Stockists)
- Location-based
- Activity-based (inactive users, high spenders)

**UI Features:**
- Message composer with rich text
- Template library
- Schedule message delivery
- Track message delivery/read rates

---

### 9. **Support & Tickets**
**Capabilities:**
- View all support tickets
- Assign tickets to team members
- Respond to user queries
- Escalate to admin
- Mark tickets as resolved
- Track response time metrics

**Ticket Categories:**
- Technical issues
- Payment/Withdrawal issues
- Order issues
- KYC issues
- General inquiries

**UI Features:**
- Ticket list with status indicators
- Priority levels (low, medium, high, urgent)
- Quick reply templates
- Ticket detail panel
- Internal notes
- SLA tracking

---

### 10. **Task & Workflow Management**
**Features:**
- Daily task list
- Pending approvals dashboard
- Workflow automation rules
- Task assignment
- Deadline tracking
- Task completion metrics

**Common Tasks:**
- KYC approvals
- Withdrawal processing
- Order fulfillment
- Stock replenishment
- Report generation

**UI Features:**
- Kanban board
- Task filters (assigned to me, overdue, today)
- Calendar view
- Task priority indicators
- Bulk task completion

---

## Dashboard Layout & Design

### Navigation Structure
```
Manager Dashboard
├── Home (Overview)
├── Users
│   ├── All Users
│   ├── KYC Approvals
│   └── User Analytics
├── Orders
│   ├── All Orders
│   ├── Pending Orders
│   └── Order Reports
├── Products
│   ├── Product List
│   ├── Add Product
│   ├── Stock Management
│   └── Categories
├── Finance
│   ├── Transactions
│   ├── Withdrawals
│   ├── Commissions
│   └── Reports
├── Stockists
│   ├── All Stockists
│   ├── Performance
│   └── Stock Transfers
├── Reports
│   ├── Sales Reports
│   ├── User Reports
│   ├── Financial Reports
│   └── Custom Reports
├── Communication
│   ├── Announcements
│   ├── Notifications
│   └── Email Campaigns
├── Support
│   ├── Tickets
│   ├── FAQ Management
│   └── Help Center
└── Settings
    ├── Profile
    ├── Notifications
    └── Preferences
```

### Design Principles
1. **Clean & Professional**: Minimal clutter, focus on data
2. **Data-Driven**: Charts, metrics, KPIs front and center
3. **Action-Oriented**: Quick action buttons for common tasks
4. **Responsive**: Works on desktop, tablet, mobile
5. **Accessible**: WCAG 2.1 AA compliance
6. **Fast**: Optimized for performance

### Color Scheme
- **Primary**: Purple (#9333EA) - Manager brand color
- **Success**: Green (#10B981) - Approvals, positive metrics
- **Warning**: Orange (#F97316) - Pending, attention needed
- **Danger**: Red (#EF4444) - Rejections, critical alerts
- **Info**: Blue (#3B82F6) - Information, neutral actions
- **Neutral**: Gray (#6B7280) - Secondary elements

### Components
- **Cards**: For metrics, summaries
- **Tables**: For lists (users, orders, products)
- **Modals**: For details, forms
- **Dropdowns**: For actions, filters
- **Charts**: For analytics (Chart.js or Recharts)
- **Badges**: For status indicators
- **Buttons**: Primary, secondary, ghost styles
- **Form Elements**: Inputs, selects, checkboxes

---

## Permissions & Access Control

### Manager Permissions
✅ **Can Do:**
- View assigned users/orders/products
- Approve KYC documents
- Process withdrawals (up to limit)
- Add/edit products (with approval)
- Update order status
- View reports and analytics
- Send announcements
- Manage support tickets
- View stockist information
- Process commissions

❌ **Cannot Do:**
- Delete users permanently
- Modify commission rates
- Access full financial audit logs
- Change user roles to admin
- Modify system settings
- Access other managers' data (unless hierarchical)
- Approve withdrawals above limit
- Delete orders
- Modify platform fees

### Audit Logging
All manager actions are logged:
- User: Manager ID and name
- Action: What was done
- Timestamp: When it happened
- IP Address: Where it happened
- Details: Specific changes made
- Status: Success/failure

---

## Technical Implementation

### Backend (Python FastAPI)
**New Endpoints:**
- `GET /api/manager/dashboard` - Overview metrics
- `GET /api/manager/users` - User list with filters
- `PUT /api/manager/users/{uid}/kyc/approve` - Approve KYC
- `GET /api/manager/orders` - Order list
- `PUT /api/manager/orders/{order_id}/status` - Update order status
- `GET /api/manager/products` - Product list
- `POST /api/manager/products` - Add product
- `GET /api/manager/reports/{report_type}` - Generate report
- `POST /api/manager/announcements` - Send announcement

**Database Models:**
- `manager_actions` collection for audit logs
- Add `manager_id` field to relevant collections
- Add `approval_status` to products

### Frontend (React)
**New Pages:**
- `ManagerDashboard.js` - Main dashboard (already exists)
- `ManagerUsers.js` - User management
- `ManagerOrders.js` - Order management
- `ManagerProducts.js` - Product management
- `ManagerFinance.js` - Financial dashboard
- `ManagerReports.js` - Reports & analytics
- `ManagerStockists.js` - Stockist management
- `ManagerSupport.js` - Support tickets
- `ManagerCommunication.js` - Announcements & notifications

**Reusable Components:**
- `MetricCard.js` - KPI display
- `DataTable.js` - Sortable, filterable tables
- `ChartCard.js` - Chart wrapper
- `ActionMenu.js` - Dropdown actions
- `StatusBadge.js` - Status indicators
- `FilterPanel.js` - Advanced filters
- `ExportButton.js` - Export functionality

---

## Responsive Design
- **Desktop (1280px+)**: Full sidebar, multi-column layouts
- **Tablet (768px-1279px)**: Collapsible sidebar, 2-column layouts
- **Mobile (< 768px)**: Bottom nav, single-column, mobile-first

---

## Performance Considerations
- Paginate large lists (50-100 items per page)
- Lazy load charts and heavy components
- Cache frequently accessed data
- Debounce search inputs
- Use virtualized lists for very long tables
- Optimize images and assets
- Implement service worker for offline capability

---

## Security Measures
- JWT authentication with role check
- CSRF protection
- Rate limiting on sensitive endpoints
- Input validation and sanitization
- SQL injection prevention (using ORMs)
- XSS protection
- Secure file uploads
- Session timeout (30 minutes inactivity)

---

## Future Enhancements
- **AI-Powered Insights**: Predictive analytics
- **Mobile App**: Native iOS/Android manager app
- **Voice Commands**: "Show me today's sales"
- **Automated Workflows**: Auto-approve low-risk KYCs
- **Integration Hub**: Connect to external tools
- **Advanced Permissions**: Granular role-based access
- **Multi-language Support**: Dashboard in regional languages

---

## Implementation Priority

### Phase 1 (Core Features)
1. Dashboard Overview with metrics
2. User Management (view, KYC approval)
3. Order Management (view, update status)
4. Basic Reports

### Phase 2 (Extended Features)
5. Product Management
6. Financial Dashboard
7. Stockist Management
8. Communication Tools

### Phase 3 (Advanced Features)
9. Support & Tickets
10. Advanced Analytics
11. Workflow Automation
12. Custom Reports

---

This design follows industry best practices seen in platforms like Shopify Admin, WooCommerce Admin, Salesforce, and other enterprise management systems.
