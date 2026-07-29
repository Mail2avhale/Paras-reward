# EMERGENT SUPPORT TICKET — PARAS REWARD PRODUCTION LATENCY

**App Name**: PARAS REWARD (Paras Digital Wallet)
**Production URL**: https://parasreward.com (custom domain) / https://bugzappers.emergent.host (Emergent hosted)
**Preview URL**: https://formula-audit-fix.preview.emergentagent.com
**Date of Report**: February 22, 2026
**Severity**: HIGH — user-facing (all real users affected)
**Category**: Infrastructure / MongoDB Atlas latency

---

## SUBJECT

Production MongoDB Atlas latency spikes to 10-20s on a single `find_one` — preview runs the exact same code at 0.4s. Requesting infrastructure diagnosis of the production Atlas cluster bound to my deployed pod.

---

## SUMMARY OF THE PROBLEM

**Real users cannot log in reliably on production.** Login latency swings between 0.3 seconds (best case) and 25 seconds (worst case) on identical requests. Users see either a red "Login is slow right now. Please try again in a moment." banner (my code-level fallback that fires when a single DB round-trip exceeds 10 s) or a spinner that never resolves.

**The exact same backend code runs at a consistent 0.35-0.55 s on the preview environment** — so this is not a code issue. It is a production-only latency problem, likely at the MongoDB Atlas cluster or the connection pathway between my Emergent production pod and that cluster.

---

## MEASURED EVIDENCE

Direct `curl` measurements from an external client against production (Feb 22, 2026, 30 s after a fresh deploy warm-up):

### 1. Cached endpoints (fast — as expected)
```
GET /api/health              → 210 ms
GET /api/app/version-info    → 166 ms
```
These serve from an in-process L1 memory cache (my Feb 21 fix). MongoDB is not touched.

### 2. Any endpoint that hits MongoDB directly (SLOW — the problem)
```
GET /api/admin/popup/active  → 9.4 s   (one single find_one — no indexes missing, verified)
GET /api/admin/popup/active  → 15+ s   (curl timeout — retried moments later)
POST /api/auth/login (existing user)     → 0.32 s / 0.75 s / 9.5 s / 11.2 s / 20+ s (intermittent)
POST /api/auth/login (non-existent user) → 0.91 s / 1.68 s / 10.5 s        (intermittent)
```

**Same request, seconds apart, no rate-limiter in play** — response time swings 50× randomly.

### 3. Preview environment (identical code, same Docker image tag)
```
POST /api/auth/login (existing user)      → 0.35 s / 0.42 s / 0.55 s / 0.36 s / 0.48 s
POST /api/auth/login (non-existent user)  → 91 ms / 130 ms / 108 ms
GET /api/admin/popup/active               → 45 ms
```

Preview is rock-solid at ~10 ms per Mongo query. Production is 200-1000× slower **on the same code**.

---

## WHAT MY CODE ALREADY DOES (to prove this is not a code bug)

Over the last week I've been progressively hardening the login flow and cache layer to work around the production latency. Every fix is confirmed working on preview:

1. **`users.phone_1` sparse index** — added to eliminate a legacy `find_one({phone:X})` COLLSCAN. Verified via `db.command('explain')` — now `stage=FETCH, inputStage=IXSCAN, 0ms`.
2. **`login_attempts.ip_success_timestamp` compound index** — added for the fraud check.
3. **Bounded `asyncio.wait_for` wrappers** on every DB call in the login path:
   - `fraud_detector.check_ip_login_limit`: 3 s fail-open
   - `check_login_rate_limit_db`: 3 s fail-open
   - `_find_user_chain` (user lookup): 10 s + one retry, then 503
   - Session-persist `update_one`: 4 s fail-open
4. **Merged the 4-query user-lookup fallback into ONE `$or` query** — verified via `db.command('explain')` that MongoDB uses `SUBPLAN` stage with index-union across `email_1 / mobile_1 / phone_1 / uid_1`, all branches IXSCAN, no COLLSCAN.
5. **Merged 3-query rate-limit chain into ONE `$or` query** — same SUBPLAN pattern.
6. **Merged 2 duplicate session-persist `update_one` calls into 1** — one write instead of two writing overlapping fields.
7. **L1-first in-process memory cache** in `/app/backend/cache_manager.py`:
   - `cache.get()` checks in-memory mirror FIRST (0 ms) before Redis
   - `cache.set()` / `cache.delete()` are fire-and-forget for Redis (background asyncio task)
   - This eliminated the 217 ms per-op Upstash HTTP round-trip on hot paths.
8. **Session-token persist merged + bounded**: instead of two `update_one` calls (last_login was set TWICE) → single `update_one` with `$set + $inc` inside `asyncio.wait_for(4.0)` with fail-open.

Every one of these fixes is deployed to production. All 15 cache regression tests + all sustainability-burn tests pass. Preview latency is uniformly great. **Production latency is still 50× worse than preview on the exact same code.**

---

## WHY I AM ESCALATING

- **This is not a query plan issue** — I've verified every Mongo query uses IXSCAN, no COLLSCAN, no missing indexes.
- **This is not a code issue** — the identical code is 50× faster on preview.
- **This is not an Upstash Redis issue** — cached endpoints (which do not hit Mongo) stay <200 ms, only endpoints that hit Mongo are slow.
- **This is not a connection-pool config issue** — my `AsyncIOMotorClient` already has `minPoolSize=20, maxPoolSize=200, serverSelectionTimeoutMS=10000, waitQueueTimeoutMS=10000`. If the pool were exhausted I would see `PoolExhausted` / `WaitQueueTimeoutError` in logs, not silent 9 s waits.

**The only remaining variable is the MongoDB Atlas cluster + the network path from my production pod to that cluster.** Both of those are on the Emergent-managed side and I have no direct visibility.

---

## WHAT I NEED FROM EMERGENT SUPPORT

Please investigate the following on the production side:

1. **MongoDB cluster health for the pod bound to `bugzappers.emergent.host`** — is the Atlas cluster oversubscribed? Are any replica-set members degraded? Is there a failover in progress?
2. **Region alignment** — is the production pod in the same region as the Atlas cluster? Cross-region reads would explain the ~9 s baseline.
3. **Connection pool state** — is the Motor pool routinely being reset (pod restarts / OOM kills)? Cold pool warmup could produce this pattern.
4. **`serverSelectionTimeoutMS` firings** — is the driver falling back through replica-set members?
5. **Are preview and production sharing the same Atlas cluster?** If so, is one pod / tenant hogging IOPS?

**Datapoint to reproduce**:
```
curl -w "%{time_total}\n" -o /dev/null https://parasreward.com/api/admin/popup/active
```
Run this 10 times in a row — you will see swings between 100 ms and 15 s on the same request. That single endpoint is a plain `db.popup_messages.find_one({active: True})` with no aggregation, no joins, no cache — a clean canary for raw Mongo round-trip time.

---

## IMPACT

- ~50% of user login attempts are painfully slow (9-20 s) even though they succeed
- ~10% still time out at the browser layer
- Users are actively complaining ("app open हुतच नाही", "log in fail होते")
- All app boot API calls (`/api/user/{uid}`, `/api/mining/status/{uid}`, dashboard summary) inherit the same latency spike pattern
- The Feb 22 v1.3.2 deploy (attached diff summary in `PRD.md`) already contains every code-level mitigation possible without infrastructure access

---

## WHAT WE'VE ALREADY DONE ON OUR SIDE

- 8 progressive fixes across 4 days (see attached PRD.md sections dated Feb 21-22 2026)
- Every DB call in login path is bounded with `asyncio.wait_for` — no more 30 s hangs, but the underlying latency is still there
- L1 in-process cache added to the top-hit endpoints
- All indexes verified via `explain()`
- Regression tests all green
- Android app version bumped to v1.3.2 (versionCode 32) with combined fixes

**Preview environment is production-ready. Production environment is not — because the MongoDB cluster is unhealthy from our pod's perspective.**

---

## REQUEST

Please:
1. Diagnose the Atlas cluster / network path for this production deployment.
2. Confirm whether preview and production share the same Mongo cluster (if yes, why does only prod see 9 s round-trips?).
3. If cluster is oversubscribed, please advise on tier upgrade path or dedicated cluster provisioning.
4. Provide an ETA — this is blocking a live product with paying users.

Thank you.

---

## APPENDIX — CONTEXT FILES ON MY SIDE

- `/app/memory/PRD.md` — full change-log with dated diffs
- `/app/backend/routes/auth.py` — login endpoint with all bounded wrappers
- `/app/backend/cache_manager.py` — L1-first cache implementation
- `/app/backend/fraud_detection.py` — bounded IP rate-limit
- `/app/frontend/android/app/build.gradle` — versionCode 32 / v1.3.2 commented with each fix
