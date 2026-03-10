#!/bin/bash
# ============================================
# MongoDB Supervisor Setup Script
# ============================================
# This script ensures MongoDB runs under supervisor
# with auto-restart capability.
#
# Usage: bash setup_mongodb_supervisor.sh
# ============================================

echo "=== MongoDB Supervisor Setup ==="

# Step 1: Kill any manual MongoDB process
echo "1. Stopping any manual MongoDB processes..."
pkill -f "mongod --fork" 2>/dev/null || true
pkill -f mongod 2>/dev/null || true
sleep 2

# Step 2: Clean up lock files
echo "2. Cleaning up lock files..."
rm -f /data/db/mongod.lock 2>/dev/null
rm -f /tmp/mongodb-*.sock 2>/dev/null

# Step 3: Create MongoDB supervisor config
echo "3. Creating supervisor config..."
cat > /etc/supervisor/conf.d/mongodb.conf << 'EOF'
[program:mongodb]
command=/usr/bin/mongod --dbpath /data/db --bind_ip_all --noauth --logpath /var/log/mongod.log
autostart=true
autorestart=true
priority=5
stderr_logfile=/var/log/supervisor/mongodb.err.log
stdout_logfile=/var/log/supervisor/mongodb.out.log
stopsignal=TERM
stopwaitsecs=60
startretries=5
startsecs=10
EOF

# Step 4: Reload supervisor
echo "4. Reloading supervisor..."
supervisorctl reread
supervisorctl update
sleep 5

# Step 5: Verify MongoDB is running
echo "5. Verifying MongoDB status..."
supervisorctl status mongodb

# Step 6: Test connection
echo "6. Testing MongoDB connection..."
mongosh --eval "db.adminCommand('ping')" 2>/dev/null && echo "✅ MongoDB is running!" || echo "❌ MongoDB connection failed"

# Step 7: Restart backend to reconnect
echo "7. Restarting backend..."
supervisorctl restart backend
sleep 3

echo ""
echo "=== Setup Complete ==="
echo "MongoDB is now managed by supervisor with auto-restart enabled."
echo ""
echo "Useful commands:"
echo "  supervisorctl status mongodb    - Check MongoDB status"
echo "  supervisorctl restart mongodb   - Restart MongoDB"
echo "  supervisorctl tail mongodb      - View MongoDB logs"
