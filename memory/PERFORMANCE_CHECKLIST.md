# PARAS REWARD - Performance Optimization Checklist

## 🔒 LOCKED CONFIGURATIONS (DO NOT MODIFY)

### Backend .env Critical Settings
```
MONGO_URL - Must use environment variable, NO maxPoolSize or timeoutMS params
DB_NAME - Must match production database name
CACHE_ENV_PREFIX - "preview" for preview, "prod" for production
```

### Supervisor Configuration
```
# CORRECT (Production):
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1

# NEVER USE:
--reload flag (causes 10-15x slowdown)
--workers 4 with --reload (crashes)
```

### System Keys (Emergent Platform)
```
DB_NAME = "bugzappers-test_database"
MONGO_URL = mongodb+srv://... (NO maxPoolSize, NO timeoutMS)
REACT_APP_BACKEND_URL = "https://parasreward.com"
CACHE_ENV_PREFIX = "prod"  # MUST ADD THIS
```

---

## ✅ Performance Optimizations Applied

### 1. Login Endpoint (auth.py)
- ✅ asyncio.gather for parallel DB operations
- ✅ ThreadPoolExecutor for bcrypt (non-blocking)
- ✅ Token generation before DB writes
- ✅ All post-login operations parallelized

### 2. Stats API (server.py - Line ~15441)
- ✅ 6 queries run in parallel using asyncio.gather
- ✅ 5-minute cache (TTL 300 seconds)
- ✅ Fallback values on error

### 3. Mining APIs (mining_economy.py)
- ✅ Redis caching for expensive calculations
- ✅ MongoDB aggregation pipelines (no Python loops)
- ✅ Single-leg count optimized

### 4. Admin KPIs (server.py)
- ✅ All count queries parallelized
- ✅ Aggregation pipelines for totals

### 5. Cache Isolation (cache_manager.py)
- ✅ CACHE_ENV_PREFIX prevents cross-environment pollution
- ✅ Preview uses "preview:" prefix
- ✅ Production uses "prod:" prefix

### 6. Session Validation (App.js)
- ✅ 5-second delay before first validation
- ✅ Prevents race condition logout
- ✅ 30-second interval for ongoing validation

### 7. Auto-Retry on Transient Failures (App.js, Apr 30 2026)
- ✅ Axios global response interceptor retries GET/HEAD once on 502/503/504/timeout (800ms back-off)
- ✅ Eliminates "refresh 3-4 times for admin pages to load" pattern
- ✅ Admin endpoint timeout bumped from 30s → 60s for cold-cache aggregations

### 8. Index Coverage on Heavy Admin Collections (Apr 30 2026)
- ✅ `admin_audit_logs` — admin_uid, action, entity_type, entity_id, timestamp, created_at + compound (action+timestamp), (entity_id+timestamp). Was 772 docs with only `_id_` index → full scan.
- ✅ `community_posts` — post_id, user_id, service_type, created_at, deleted+created_at compound, service_type+created_at compound.

### 9. Admin Endpoint Redis Cache (Phase-2, Apr 30 2026)
Each cached with payload-identical guard test
(`/app/backend/tests/test_admin_endpoints_cache.py`).
| Endpoint | TTL | Cache key |
|---|---|---|
| `GET /admin/dashboard/kpis` | 60s | `admin:dashboard:kpis:v1` |
| `GET /admin/dashboard/growth?period=` | 180s | `admin:dashboard:growth:{period}:v1` |
| `GET /admin/subscription-stats` | 60s | `admin:subscription_stats:v1` |
| `GET /admin/members/dashboard` | 90s | `admin:members_dashboard:p=…:f=…:t=…:v1` |
| `GET /admin/paid-users-wallet-summary` | 120s | `admin:paid_users_wallet_summary:v1` |
| `GET /admin/prc-subscription-stats` | 90s | `admin:prc_subscription_stats:v1` |
| `GET /admin/reports/financial?start_date=&end_date=` | 180s | `admin:reports:financial:{start}:{end}:v1` |
- Production verified Apr 30: KPIs 1.49s cold → 0.42s warm; Members 1.19s → 0.45s.
- Stale window deliberately small (60-180s); admin staleness is acceptable given the tradeoff.

### 10. User-360 Endpoint — Cache NOT applied (intentional)
Tested Apr 30 2026: caching the 600+ KB payload via Upstash REST made warm requests SLOWER than cold (7.6s vs 5.6s) due to round-trip overhead and JSON deserialization on a large blob. The endpoint relies instead on:
- Internal parallelization via `asyncio.gather` (already done; ~5-6s on prod)
- Frontend axios auto-retry (handles transient 503/504)
- Existing per-section indexes on transactions, redeem_requests, subscription_payments
If User-360 latency becomes a problem again, the right fix is **payload reduction** (lazy-load tabs like login_history & failed_transactions) rather than blob caching.

---

## ⚠️ Production Deploy Settings (Verify Before Each Deploy)

The PREVIEW supervisor here uses `--reload` (causes 10-15× slowdown) which is
fine for dev but **MUST NOT** be used in production. Verify in your deploy
config (Emergent platform):
```
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1
# (No --reload. Workers can be increased to 2 or 3 only after Mongo
#  connection pool can absorb it — review under load.)
```

---

## 🚨 Common Issues & Solutions

### Issue 1: App Stuck / Infinite Loading
**Cause:** --reload flag in supervisor or connection pool limits
**Solution:** 
- Remove --reload from uvicorn command
- Remove maxPoolSize and timeoutMS from MONGO_URL

### Issue 2: Cross-Environment Data Pollution
**Cause:** Shared Redis cache between preview and production
**Solution:**
- Add CACHE_ENV_PREFIX to System Keys
- Preview: "preview", Production: "prod"

### Issue 3: Login Causes Logout
**Cause:** Session validation runs before login completes
**Solution:**
- 5-second delay in validateSession useEffect

### Issue 4: Slow API Responses (>5 seconds)
**Cause:** Sequential database queries
**Solution:**
- Use asyncio.gather for parallel queries
- Add Redis caching for expensive operations

---

## 📋 Pre-Deployment Checklist

Before EVERY deployment, verify:

- [ ] All .env values are quoted
- [ ] No hardcoded localhost URLs
- [ ] No --reload in supervisor config
- [ ] CACHE_ENV_PREFIX is set
- [ ] Backend compiles without errors
- [ ] Frontend compiles without errors

---

## 🔐 Files That Should NOT Be Modified

1. `/app/backend/cache_manager.py` - Cache prefix logic
2. `/app/backend/routes/auth.py` - Login optimization (lines 600-750)
3. `/app/backend/server.py` - Stats API (lines 15441-15530)
4. `/app/frontend/src/App.js` - Session validation (lines 532-565)

---

## 📞 Emergency Contacts

**Emergent Support:** support@emergent.sh
**Common Issues:** https://help.emergent.sh

---

Last Updated: March 9, 2026
Performance Fixes Applied By: Emergent AI Agent
