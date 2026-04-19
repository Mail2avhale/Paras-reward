# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build and maintain a comprehensive digital reward platform (PRC ecosystem) with mining, subscription management, network referrals, bank redeem, bill payments (Eko BBPS), and admin controls.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB (Motor)
- **3rd Party**: OpenAI GPT-4o-mini (Chatbot via Emergent LLM Key), Razorpay (Payments), Eko (BBPS/Recharge)

## What's Been Implemented

### Community Help Page (DONE - April 19, 2026)
- Posts with text + 1 image, 6 categories
- Like/React, Comment (nested replies), Bookmark, Report
- Mark as Helpful, Pin posts
- Moderation: Add/Remove moderators, Block/Unblock users, Resolve reports
- Announcements (mod/admin only)
- Search, Filter by category, Sort (latest/popular/helpful)
- User reputation tracking (post count, helpful count, likes)
- Backend: `/app/backend/routes/community.py` - 20+ endpoints
- Frontend: `/app/frontend/src/pages/CommunityPage.js`
- Route: `/community` (user-facing, bottom nav)

### Employee Management System (DONE - April 18, 2026)
- Full CRUD with DOB, Gender, Father Name, Blood Group, Employment Type, Probation
- Documents: Aadhar, PAN, Bank, IFSC, UAN, ESIC, PF/ESI eligibility
- Leave Management: CL(12)/SL(12)/EL(15), auto-attendance marking
- Salary Slip: Indian standard + Employer PF/ESI/Gratuity + Net Pay in Words + CTC
- Employee Pool Wallet: 20% from mining, salary-proportional, daily cron
- Attendance, Photo Upload, Digital ID Card, Emergency Contact, Address

### Mining Formula v2.0 (DONE - April 18, 2026)
- Subscription position-based network (not join order)
- 1822 positions migrated on production

### Previous Features (DONE)
- Eko Refund, Subscription Fixes, Core Team Pool Wallet
- Admin Bank Transfer (edit amount + redeem limit)
- PRC Analytics (aggregation-based), Admin PRC Add/Deduct

## Upcoming Tasks
- P1: Invoice PDF Download
- P2: WhatsApp Share Receipt

## Future/Backlog
- P2: server.py monolith refactor
- P3: MongoDB -> PostgreSQL migration
