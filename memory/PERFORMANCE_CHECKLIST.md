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
