# MongoDB Atlas Deployment Configuration

## Overview
This application has been configured to work seamlessly with MongoDB Atlas for production deployment on Kubernetes.

## Code Changes Made

### 1. Enhanced MongoDB Connection Settings
**File:** `/app/backend/server.py` (Lines 25-36)

Added Atlas-optimized connection parameters:
- `serverSelectionTimeoutMS=30000` - Allows time for Atlas cluster selection
- `connectTimeoutMS=20000` - Connection establishment timeout
- `socketTimeoutMS=20000` - Socket operation timeout
- `maxPoolSize=50` - Production-grade connection pool
- `minPoolSize=10` - Minimum connections maintained
- `retryWrites=True` - Automatic retry for failed writes
- `retryReads=True` - Automatic retry for failed reads
- `w='majority'` - Write concern for data durability

### 2. Startup Connection Verification
**File:** `/app/backend/server.py` (Lines 14655-14730)

Added:
- 3-attempt retry logic for initial connection
- 2-second delay between retries
- Explicit MongoDB ping verification
- Detailed error messages for troubleshooting
- Non-blocking error handling for optional initializations

### 3. Enhanced Health Check
**File:** `/app/backend/server.py` (Lines 14572-14595)

Added:
- 5-second timeout for health check operations
- Scheduler status reporting
- Timeout-specific error handling
- Better error messages for Kubernetes probes

## Required Environment Variables

### Backend (.env)
```env
MONGO_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
DB_NAME=paras_reward_prod
CORS_ORIGINS=https://your-domain.emergent.host
```

### Atlas MongoDB Connection String Format
```
mongodb+srv://<username>:<password>@<cluster-name>.<random-id>.mongodb.net/?retryWrites=true&w=majority
```

**Important:** 
- Use `mongodb+srv://` for Atlas (not `mongodb://`)
- Include `retryWrites=true&w=majority` in connection string
- Ensure username and password are URL-encoded if they contain special characters

## Atlas Configuration Checklist

### 1. Network Access
✅ Add Kubernetes cluster IP ranges to Atlas Network Access whitelist
- Or use `0.0.0.0/0` for testing (not recommended for production)

### 2. Database User
✅ Create a database user with appropriate permissions:
- Read/Write access to `paras_reward_prod` database
- Use strong password
- Enable "Built-in Role: Read and write to any database"

### 3. Cluster Configuration
✅ Recommended Atlas cluster settings:
- Tier: M10 or higher for production
- Region: Same as your Kubernetes cluster region (reduces latency)
- Enable Continuous Backup
- Configure alerts for connection issues

### 4. Connection Pooling
✅ Application is configured with:
- Max pool size: 50 connections
- Min pool size: 10 connections
- Adjust based on your traffic patterns

## Deployment Verification

### 1. Test Connection Locally First
```bash
# Set production Atlas URL
export MONGO_URL="mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority"
export DB_NAME="paras_reward_prod"

# Start backend
cd /app/backend
uvicorn server:app --host 0.0.0.0 --port 8001
```

### 2. Check Health Endpoint
```bash
curl https://your-app.emergent.host/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "paras-reward-backend",
  "database": "connected",
  "scheduler": "running"
}
```

### 3. Monitor Logs
Look for these startup messages:
```
✅ MongoDB connection successful (attempt 1/3)
✅ Database indexes initialized
✅ Treasure hunts initialized
✅ Database initialization complete!
✅ Scheduled tasks started
```

### 4. Atlas Monitoring
Monitor in Atlas dashboard:
- Connection count (should see 10-50 active connections)
- Operation execution times
- Network traffic
- Any connection errors

## Common Issues & Solutions

### Issue 1: "ServerSelectionTimeoutError"
**Cause:** Atlas cluster not accessible from Kubernetes
**Solution:** 
- Verify Network Access whitelist includes Kubernetes IPs
- Check if Atlas cluster is in same region
- Verify connection string format

### Issue 2: "Authentication failed"
**Cause:** Invalid credentials or database permissions
**Solution:**
- Verify username/password are correct and URL-encoded
- Check database user has read/write permissions
- Ensure user is enabled in Atlas

### Issue 3: "Connection timeout"
**Cause:** Network latency or firewall blocking
**Solution:**
- Increase timeouts in code (already set to 20-30s)
- Check Kubernetes network policies
- Verify Atlas M-series cluster (M0 free tier has limitations)

### Issue 4: "Too many connections"
**Cause:** Connection pool exhausted
**Solution:**
- Increase `maxPoolSize` in server.py
- Check for connection leaks
- Upgrade Atlas cluster tier

## Performance Optimization

### 1. Indexes
Application automatically creates indexes on startup:
- `mobile` field (sparse index)
- Additional indexes defined in `initialize_database_indexes()`

### 2. Connection Pooling
Already optimized with:
- Minimum 10 connections kept warm
- Maximum 50 connections for burst traffic
- Automatic connection recycling

### 3. Read/Write Concerns
- Write concern: `w='majority'` (data safety)
- Retryable reads/writes enabled (reliability)

## Monitoring & Alerts

### Key Metrics to Monitor
1. **Connection Count:** Should stay within pool limits
2. **Operation Latency:** Watch for slow queries
3. **Error Rate:** Monitor connection failures
4. **Scheduler Jobs:** Verify PRC burn tasks execute

### Recommended Atlas Alerts
- Connection count > 45 (approaching max pool)
- Query execution time > 1000ms
- Replication lag > 10 seconds
- Cluster CPU > 80%

## Security Best Practices

1. ✅ Use Atlas-managed encryption at rest
2. ✅ Enable TLS/SSL for connections (automatic with `mongodb+srv://`)
3. ✅ Use strong, unique passwords
4. ✅ Restrict network access to known IPs
5. ✅ Enable database audit logs in Atlas
6. ✅ Rotate database credentials periodically
7. ✅ Use separate database users for different environments

## Rollback Plan

If deployment fails:
1. Check deployment logs for specific errors
2. Verify Atlas connection string in environment variables
3. Test connection from a pod: `kubectl exec -it <pod> -- bash`
4. Revert to previous deployment if needed
5. Contact Atlas support if persistent issues

## Support Resources

- MongoDB Atlas Documentation: https://docs.atlas.mongodb.com/
- Motor (Async Python Driver): https://motor.readthedocs.io/
- Kubernetes MongoDB Integration: https://www.mongodb.com/kubernetes

---

## Summary

Your application is now Atlas-ready with:
✅ Robust connection handling with retries
✅ Production-grade connection pooling
✅ Enhanced health checks for Kubernetes
✅ Detailed error logging
✅ Optimized timeouts for cloud deployment

Simply provide the Atlas connection string in `MONGO_URL` environment variable and deploy!
