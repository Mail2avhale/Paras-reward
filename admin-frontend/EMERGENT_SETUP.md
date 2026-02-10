# PARAS REWARD - Admin Frontend Setup

## Project Type
React Admin Dashboard (Create React App with Craco)

## Backend API
```
https://parasreward.com
```

## Environment Variables (.env)
```
REACT_APP_BACKEND_URL=https://parasreward.com
REACT_APP_APP_NAME=PARAS REWARD ADMIN
DISABLE_ESLINT_PLUGIN=true
```

## Key Features
- Admin Login (admin & manager roles only)
- User Management & 360° View
- KYC Verification
- Order Management
- Withdrawal Approvals
- Subscription Management
- Bill Payments & Gift Vouchers
- Analytics & Reports
- Fraud Detection
- System Settings

## Tech Stack
- React 18
- Tailwind CSS
- Axios
- Recharts
- Lucide Icons
- Shadcn/UI Components

## Folder Structure
```
/app/frontend/
├── public/
│   └── index.html
├── src/
│   ├── App.js (main routes)
│   ├── index.js
│   ├── index.css
│   ├── components/
│   │   ├── AdminLayout.js
│   │   ├── ui/ (shadcn components)
│   │   └── ... (other components)
│   ├── pages/
│   │   ├── AdminDashboard.js
│   │   ├── AdminUsers.js
│   │   ├── AdminKYC.js
│   │   └── ... (40+ admin pages)
│   ├── lib/
│   │   └── utils.js
│   └── styles/
│       └── admin-theme.css
├── package.json
├── tailwind.config.js
├── craco.config.js
└── jsconfig.json
```

## Deploy URL
```
admin.parasreward.com
```

## Notes
- This is ADMIN ONLY app
- Users cannot access - redirects to login
- Only admin/manager roles can login
- Backend API is shared with main user app
