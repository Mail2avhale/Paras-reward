# PARAS REWARD - Production Deployment Guide

## 🚀 Deployment Options

### Option 1: Emergent Platform Deploy (Recommended)
1. Click **"Save to Github"** button in chat input
2. Your code will be pushed to your GitHub repository
3. Connect your hosting provider to GitHub for auto-deploy

### Option 2: Manual Deploy to Indian VPS (For Eko API)

#### Step 1: Create DigitalOcean Droplet
```
Region: Bangalore (BLR1)
OS: Ubuntu 22.04 LTS
Plan: $6/month (1GB RAM)
```

#### Step 2: SSH into Server
```bash
ssh root@your-droplet-ip
```

#### Step 3: Install Dependencies
```bash
# Update system
apt update && apt upgrade -y

# Install Python 3.11
apt install python3.11 python3.11-venv python3-pip -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install nodejs -y

# Install MongoDB
apt install mongodb -y
systemctl start mongodb
systemctl enable mongodb

# Install Nginx
apt install nginx -y

# Install PM2 for process management
npm install -g pm2
```

#### Step 4: Clone Repository
```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/paras-reward.git
cd paras-reward
```

#### Step 5: Setup Backend
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env file with production values
nano .env
```

**Backend .env:**
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=paras_reward_prod
JWT_SECRET=your-super-secret-key-here
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
EKO_DEVELOPER_KEY=7c179a397b4710e71b2248d1f5892d19
EKO_AUTHENTICATOR_KEY=7a2529f5-3587-4add-a2df-3d0606d62460
EKO_INITIATOR_ID=9936606966
EKO_BASE_URL=https://api.eko.in:25002/ekoicici
```

#### Step 6: Setup Frontend
```bash
cd ../frontend
npm install
npm run build
```

#### Step 7: Configure Nginx
```bash
nano /etc/nginx/sites-available/parasreward
```

```nginx
server {
    listen 80;
    server_name parasreward.com www.parasreward.com;

    # Frontend
    location / {
        root /var/www/paras-reward/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/parasreward /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### Step 8: Start Backend with PM2
```bash
cd /var/www/paras-reward/backend
pm2 start "uvicorn server:app --host 0.0.0.0 --port 8001" --name backend
pm2 save
pm2 startup
```

#### Step 9: Setup SSL (Let's Encrypt)
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d parasreward.com -d www.parasreward.com
```

---

## 📱 Android AAB File Generation (PWA Builder)

### Step 1: Go to PWA Builder
https://www.pwabuilder.com/

### Step 2: Enter Your Website URL
```
https://parasreward.com
```

### Step 3: Click "Start"
- PWA Builder will analyze your site
- Fix any warnings shown

### Step 4: Generate Android Package
1. Click "Package for stores"
2. Select "Android"
3. Choose "Google Play Store" (AAB format)
4. Configure:
   - Package name: `com.parasreward.app`
   - App name: `PARAS REWARD`
   - Version: `1.0.0`
5. Download AAB file

### Step 5: Upload to Google Play Console
1. Go to https://play.google.com/console
2. Create new app
3. Upload AAB file
4. Fill app details
5. Submit for review

---

## 🔐 Production Checklist

### Security
- [ ] Change all default passwords
- [ ] Use strong JWT_SECRET
- [ ] Enable HTTPS
- [ ] Set up firewall (ufw)

### Environment
- [ ] Switch Razorpay to LIVE keys
- [ ] Verify Eko LIVE credentials
- [ ] Update CORS origins
- [ ] Set production MongoDB URL

### Monitoring
- [ ] Set up PM2 monitoring
- [ ] Configure log rotation
- [ ] Set up uptime monitoring (UptimeRobot)

### Backup
- [ ] MongoDB backup script
- [ ] Daily automated backups

---

## 📞 Support Contacts

- **Eko Support:** sales.engineer@eko.co.in
- **Razorpay:** https://razorpay.com/support/
- **DigitalOcean:** https://www.digitalocean.com/support/
