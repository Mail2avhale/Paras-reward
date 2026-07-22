# Emergent Google Auth — Integration Playbook (SAVED FOR LATER)

Status: **PENDING** — user paused this task on Feb 21, 2026 to deploy the
cache/login-speed fixes first. Resume when user gives the go-ahead.

## Product decisions still needed (from ask_human)
1. Google button placement (Login only vs Login + Register vs +Profile-add)
2. Account linking behaviour when Google email matches existing PIN account
3. New-Google-user flow (auto-register vs onboarding vs referral-required)
4. Mobile field requirement post-Google-signup (optional/mandatory/skip)
5. Keep PIN login alongside Google (default: yes, keep both)

## Emergent-managed Google Auth Flow (from integration_playbook_expert_v2)

### Frontend Login Button
```javascript
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const redirectUrl = window.location.origin + '/dashboard';
window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
```

### After Google Auth — Callback URL Format
User lands at: `{redirect_url}#session_id={session_id}`

### Backend Session Exchange
```
GET https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data
Header: X-Session-ID: <session_id>

Response:
{
  "id": "string",
  "email": "string",
  "name": "string",
  "picture": "string",
  "session_token": "string"   // 7-day session token, store server-side
}
```

### Session Storage
- Store `session_token` in DB with `timezone-aware` expiry (7 days).
- Set httpOnly cookie: `path="/"`, `secure=True`, `samesite="none"`.

### Auth Middleware
Backend checks `session_token` from cookies first, Authorization header as fallback.
DO NOT use FastAPI's `HTTPAuthorizationCredentials` — breaks cookie auth.

### User Data Storage
- Save user to `users` collection keyed by our `uid` (custom UUID, NOT Mongo `_id`).
- If email already exists → do NOT create new user; log them into the existing account.
- Always query with `{"_id": 0}` projection.

### Session Verification (`/api/auth/me`)
Server-side verification — cookie → DB session doc → expiry check → return user or 401.

### CRITICAL Race-Condition Fix
- Detect `session_id` in `window.location.hash` SYNCHRONOUSLY during render (NOT in useEffect).
- AuthCallback uses `useRef` (not `useState`) for the "processed" flag.
- If AuthProvider exists, skip `/auth/me` check when `window.location.hash?.includes('session_id=')`.

## Testing Playbook

### Step 1: Create Test User & Session
```javascript
// mongosh
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  uid: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
```

### Step 2: Test Backend API
```bash
curl -X GET "https://bugzappers.emergent.host/api/auth/me" \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

### Step 3: Browser Testing
```javascript
await page.context.add_cookies([{
  "name": "session_token",
  "value": "$SESSION_TOKEN",
  "domain": "bugzappers.emergent.host",
  "path": "/",
  "httpOnly": true,
  "secure": true,
  "sameSite": "None"
}]);
```

### Success Indicators
✅ `/api/auth/me` returns user data
✅ Dashboard loads without redirect
✅ CRUD operations work

### Failure Indicators
❌ "User not found" errors
❌ 401 Unauthorized responses
❌ Redirect to login page

## Integration Points in Existing Codebase
- Frontend Login page: `/app/frontend/src/pages/Login.js` (approx)
- Frontend AuthProvider (if any): `/app/frontend/src/App.js` (auto-injects Bearer)
- Backend auth middleware: `/app/backend/middleware/auth.py`
- Existing user schema: `users` collection with `uid` primary key + `email`, `mobile`, `phone`, `pin_hash`, etc.
- Need to add `user_sessions` collection for Google session tokens (separate from PIN JWTs).
