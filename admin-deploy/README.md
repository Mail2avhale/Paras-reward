# PARAS REWARD - Admin Portal

Separate admin panel for PARAS REWARD platform.

## Setup Instructions

### 1. Update MongoDB URL
Edit `/backend/.env` and replace with your production MongoDB URL:
```
MONGO_URL="mongodb+srv://your-production-url..."
DB_NAME="your_database_name"
```

### 2. Deploy on Emergent
- Import this repo to a new Emergent project
- Update the backend .env with correct MongoDB URL
- Deploy

### 3. Link Custom Domain
After deployment, link your admin subdomain:
- `admin.parasreward.com`

## Structure
```
/app/
├── frontend/     # Admin React App
│   ├── src/
│   │   ├── App.js          # Admin routes
│   │   └── pages/          # Admin pages
│   └── public/
└── backend/      # Shared API
    ├── server.py
    └── .env                # UPDATE THIS!
```

## Features
- Admin Dashboard
- User Management (360° View)
- KYC Verification
- Bill Payment Approvals
- Analytics & Reports
- PRC Management
- Security & Fraud Detection
- Accounting & Finance

## Access
Only users with `role: admin` or `role: manager` can login.
