# Auth Testing Notes (Emergent Google Sign-In)
- Flow: Login/Register "Continue with Google" -> https://auth.emergentagent.com/?redirect=<origin>/login -> back to /login#session_id=... -> GoogleAuthGate (App.js) -> GoogleAuthCallback -> POST /api/auth/google/session {session_id, device_id}.
- Backend verifies session_id via Emergent session-data (server side), finds user by email (case-insensitive).
  - Found (non admin/sub_admin/super_admin/manager) -> same payload as PIN login (token, session_token, user) + status "ok".
  - Not found -> {status: "register_required", email, name} -> frontend sends to /register with name+email prefilled (email read-only). Referral code auto-fills from localStorage paras_ref_code / ?ref=.
  - Admin/manager -> 403 "Google sign-in is for member accounts only".
- App auth remains JWT (localStorage token + paras_session_token); the Emergent session token is used only for identity verification.
- Real Google OAuth cannot be automated; test by mocking: intercept POST /api/auth/google/session in Playwright, or curl with invalid session_id (expect 401).
- PIN login must keep working (regression).
