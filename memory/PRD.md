# PARAS REWARD - Product Requirements Document

## Original Problem Statement
Build and maintain a comprehensive digital reward platform (PRC ecosystem) with mining, subscription management, network referrals, bank redeem, bill payments (Eko BBPS), and admin controls.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB (Motor)
- **3rd Party**: OpenAI GPT-4o-mini (Chatbot via Emergent LLM Key), Razorpay (Payments), Eko (BBPS/Recharge)

## What's Been Implemented

### Employee Management System (DONE - April 18, 2026)
- **Employee CRUD**: Add from existing users, Edit, Resign/Terminate with EMP-XXXX IDs
- **Employee Pool Wallet**: Separate 20% from mining (total 40% = 20% core + 20% employee)
- **Salary-Based Distribution**: Proportional to monthly salary, capped at salary value in PRC
- **Attendance**: Present/Absent/Half-day/Leave/Holiday with bulk marking
- **Salary Slip**: Indian standard (Basic 40%, HRA 20%, Conveyance, Special Allowance, Medical + PF, ESI, PT, TDS, LOP deductions)
- **ID Card**: Digital with company details (Paras Reward Technologies Pvt Ltd)
- **Photo Upload**: Employee photos for ID cards
- **Daily Auto Distribution**: Cron at midnight IST (18:35 UTC)
- **Monthly Post Salary**: Admin action to distribute + reset cycle
- **Dynamic PRC-INR Rate**: Admin configurable
- Backend: `/app/backend/routes/employee_management.py`
- Frontend: `/app/frontend/src/pages/Admin/AdminEmployees.js`
- Route: `/admin/employees`

### Mining Formula v2.0 - Subscription Position Based (DONE - April 18, 2026)
- Mining network based on subscription purchase/renewal ORDER
- Each renewal = new position. Network = active subs after your position
- Referrals & Redeem Limit: UNCHANGED
- Migration API: `POST /admin/migrate-subscription-positions` (1822 positions assigned on prod)

### Previous Features (DONE)
- Eko Refund Flow, Subscription Fixes, Core Team Pool Wallet
- Admin Bank Transfer (edit amount + redeem limit display)
- PRC Analytics (aggregation-based for production scale)
- Admin PRC Add/Deduct from User 360

## Upcoming Tasks
- P1: Invoice PDF Download
- P1: Community Help Page (paused)

## Future/Backlog
- P2: WhatsApp Share Receipt
- P2: server.py monolith refactor
- P3: MongoDB -> PostgreSQL migration
