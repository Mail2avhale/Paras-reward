# PARAS REWARD - Development Guidelines
## App Stability & Performance Rules
**Last Updated:** March 10, 2026

---

## 🚨 CRITICAL RULES (MUST FOLLOW)

### 1. NEVER USE BLOCKING CODE IN ASYNC FUNCTIONS

```python
# ❌ WRONG - This will BLOCK the entire app
import requests
async def my_api():
    response = requests.get("https://api.example.com")  # BLOCKING!
    return response.json()

# ✅ CORRECT - Use async HTTP client
import httpx
async def my_api():
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.example.com")  # NON-BLOCKING
    return response.json()
```

### 2. NEVER USE $regex FOR USER LOOKUPS

```python
# ❌ WRONG - Full collection scan (SLOW)
user = await db.users.find_one({
    "$or": [
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"mobile": mobile}
    ]
})

# ✅ CORRECT - Use indexed equality queries
user = await db.users.find_one({"email": email.lower()})
if not user:
    user = await db.users.find_one({"mobile": mobile})
```

### 3. ALWAYS ADD INDEXES FOR NEW COLLECTIONS

```javascript
// When creating new collection, ALWAYS add indexes
db.new_collection.createIndex({"user_id": 1}, {background: true});
db.new_collection.createIndex({"created_at": -1}, {background: true});
```

---

## 📋 PRE-DEPLOYMENT CHECKLIST

Before every deployment, verify:

```bash
# 1. Syntax Check
python3 -m py_compile server.py
python3 -m py_compile routes/*.py

# 2. No blocking imports in async files
grep -r "^import requests$" routes/ --include="*.py"
# Should return NOTHING

# 3. No $regex in user queries
grep -r "\$regex" server.py routes/
# Review any matches carefully

# 4. Backend starts without errors
sudo supervisorctl restart backend
tail -20 /var/log/supervisor/backend.err.log

# 5. Quick API test
curl -s "https://www.parasreward.com/api/health"
```

---

## 🔧 PERFORMANCE PATTERNS

### Database Queries

```python
# ✅ GOOD - Use projection to limit data
user = await db.users.find_one(
    {"uid": uid},
    {"_id": 0, "password": 0, "profile_picture": 0}  # Exclude large fields
)

# ✅ GOOD - Add timeout to prevent hanging
user = await db.users.find_one(
    {"uid": uid},
    max_time_ms=5000  # 5 second timeout
)

# ✅ GOOD - Use parallel queries
import asyncio
user, orders, transactions = await asyncio.gather(
    db.users.find_one({"uid": uid}),
    db.orders.find({"user_id": uid}).to_list(10),
    db.transactions.find({"user_id": uid}).to_list(10)
)
```

### External API Calls

```python
# ✅ GOOD - Reuse HTTP client (connection pooling)
_http_client = None

def get_http_client():
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=60.0)
    return _http_client

async def call_external_api():
    client = get_http_client()
    response = await client.get("https://api.example.com")
    return response.json()
```

---

## 🚫 PATTERNS TO AVOID

| ❌ DON'T | ✅ DO INSTEAD |
|----------|---------------|
| `import requests` in async code | `import httpx` with AsyncClient |
| `time.sleep()` in async | `await asyncio.sleep()` |
| `$regex` for email/mobile lookup | Direct equality query |
| Unlimited `find().to_list()` | `find().to_list(100)` with limit |
| No timeout on DB queries | `max_time_ms=5000` |
| Sequential API calls | `asyncio.gather()` parallel |
| Large base64 in responses | Exclude with projection |

---

## 📊 MONITORING

### Quick Health Checks

```bash
# Check API response times
time curl -s "https://www.parasreward.com/api/health"
# Should be < 1 second

# Check login speed
time curl -s "https://www.parasreward.com/api/auth/check-auth-type?identifier=test@test.com"
# Should be < 2 seconds

# Check user API
time curl -s "https://www.parasreward.com/api/user/{uid}"
# Should be < 3 seconds
```

### If App Gets Slow

1. **Check backend logs:**
   ```bash
   tail -100 /var/log/supervisor/backend.err.log
   ```

2. **Check for blocking code:**
   ```bash
   grep -r "import requests" routes/ --include="*.py"
   grep -r "time.sleep" routes/ --include="*.py"
   ```

3. **Check MongoDB slow queries:**
   ```javascript
   db.setProfilingLevel(1, {slowms: 100})
   db.system.profile.find().sort({ts: -1}).limit(10)
   ```

---

## 🆕 ADDING NEW FEATURES - TEMPLATE

### New API Endpoint Template

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from typing import Optional

router = APIRouter(prefix="/new-feature", tags=["New Feature"])

# Reusable async HTTP client
_client: Optional[httpx.AsyncClient] = None

def get_client():
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client

class RequestModel(BaseModel):
    user_id: str
    data: str

@router.post("/action")
async def new_action(req: RequestModel):
    """
    New feature action
    """
    try:
        # Database query with timeout
        user = await db.users.find_one(
            {"uid": req.user_id},
            {"_id": 0},
            max_time_ms=3000
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # External API call (async)
        client = get_client()
        response = await client.post(
            "https://external-api.com/endpoint",
            json={"data": req.data}
        )
        
        return {"success": True, "result": response.json()}
        
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="External API timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 📁 FILES REFERENCE

| File | Purpose | Critical Points |
|------|---------|-----------------|
| `server.py` | Main API | MongoDB connection, routes |
| `routes/auth.py` | Login/Register | No $regex, fast queries |
| `routes/eko_dmt_service.py` | DMT APIs | Must use httpx async |
| `routes/bbps_services.py` | Bill Pay | Must use httpx async |
| `routes/chatbot_withdrawal.py` | Withdrawals | Must use httpx async |
| `scripts/create_indexes.js` | DB Indexes | Run after new collections |

---

## ✅ SUMMARY - GOLDEN RULES

1. **Async code = Async HTTP** (httpx, not requests)
2. **User lookup = Equality query** (not $regex)
3. **New collection = Add indexes**
4. **DB query = Add timeout**
5. **Multiple queries = Use asyncio.gather()**
6. **Before deploy = Run checklist**

---

**Follow these rules and app will NEVER get stuck!** 🚀
