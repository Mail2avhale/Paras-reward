# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build and maintain a comprehensive digital reward platform (PRC ecosystem) with mining, subscription management, network referrals, bank redeem, bill payments (Eko BBPS), and admin controls.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB (Motor)
- **3rd Party**: Razorpay (Payments), Eko (BBPS/Recharge)

## What's Been Implemented

### Admin Management Panels for Public Pages (DONE - April 19, 2026)
- **Admin Community Forum** (`/admin/community`, top-level sidebar)
  - Posts: list/search/filter by category/sort, Pin/Unpin, Delete, View with comments, Delete comments, Block author
  - Reports: pending/resolved tabs, actions (Dismiss / Delete Post / Delete + Block)
  - Blocked Users: list + Unblock
  - Moderators: Add (by UID) / Remove
  - Stats: Total Posts, Pending Reports, Blocked, Moderators
  - Backend: 26/26 pytest PASSED
- **Admin Careers** (`/admin/careers`, top-level sidebar)
  - Jobs: CRUD (title/dept/type/exp/salary/description/requirements), Activate/Deactivate, Filter by state, Search
  - Applications: List, filter by status/job, Status update inline or in detail modal (6 statuses), Download resume, Add admin notes
  - Stats: global count pills (fixed un-filtered fetch after testing)
  - Backend: 27/27 pytest PASSED
- **Admin Investors** (`/admin/investors`, top-level sidebar)
  - FAQ: Add/Edit/Delete (order-based sort)
  - Team: Add/Edit/Delete with photo, role, bio, LinkedIn
  - Press: Add/Delete press releases with source/URL/date
  - Documents: Multipart upload (PDF/DOC, 20MB), password-protect, Delete (removes file from disk), download count shown
  - Inquiries: List, filter by status, detail modal with Update status (5 statuses), Delete, Email Reply, Admin note
  - Metrics preview: Total users, Active subscribers, MAU, Growth%
  - Backend: 32/32 pytest PASSED (incl. NEW DELETE endpoints for FAQ/Team/Press + PUT for inquiry status)

### "We're Hiring" Badge (DONE - April 19, 2026)
- Animated ribbon on Careers hero (shimmer + pulse + pop)
- Floating dismissable pill on Investors page linking to /careers
- Auto-shows live job count, hides when no active jobs

### Careers Page (DONE - April 19, 2026) - PUBLIC
- Dynamic job postings (Admin CRUD): title, dept, location, type, experience, salary, description
- Application with resume upload (PDF 5MB), duplicate prevention
- Application status tracking: New → Reviewed → Shortlisted → Interview → Hired → Rejected
- Application status check by email (public)
- Admin notes on applications
- Company values, benefits, search/filter jobs

### Investors Page (DONE - April 19, 2026) - PUBLIC
- Real platform metrics from production DB (users, subscribers, transactions, growth)
- Revenue streams, competitive advantages, milestones timeline
- FAQ section (auto-seeds defaults, admin editable)
- Leadership team section (admin managed)
- Press/News section
- Password-protected document download
- Investor contact inquiry form with investment range
- Admin: view inquiries, manage docs/team/FAQ/press

### Community Help Page (DONE - April 19, 2026)
- Posts with text + image, 6 categories, Like/Comment/Bookmark/Report
- Edit post, Comment like, Nested replies, Share link
- Trending, My Posts, Saved tabs, Time filters, View count
- User community profile with reputation
- Moderation: Moderators, Block users, Pin posts, Resolve reports

### Employee Management System (DONE - April 18, 2026)
- Full CRUD with DOB, Gender, Father Name, Blood Group, Employment Type
- Documents: Aadhar, PAN, Bank, IFSC, UAN, ESIC
- Leave Management: CL/SL/EL, Attendance, Salary Slip (Indian standard)
- Employee Pool Wallet: 20% from mining, salary-proportional distribution

### Mining Formula v2.0 (DONE - April 18, 2026)
- Subscription position-based network (1822 positions migrated on prod)

### Previous Features (DONE)
- Eko Refund, Subscription Fixes, Core Team Pool Wallet
- Admin Bank Transfer, PRC Analytics, Chatbot Removed

## Upcoming Tasks
- P1: Invoice PDF Download
- P2: WhatsApp Share Receipt

## Future/Backlog
- P2: server.py monolith refactor
- P3: MongoDB -> PostgreSQL migration
