# Database Deployment Guide

## 🗄️ Understanding Database Deployment

### The Key Concept

**Development Database ≠ Production Database**

```
┌─────────────────────┐         ┌─────────────────────┐
│  DEVELOPMENT        │         │  PRODUCTION         │
│  (Your Workspace)   │         │  (Live App)         │
├─────────────────────┤         ├─────────────────────┤
│  • Local MongoDB    │   ≠     │  • Separate MongoDB │
│  • Test data        │         │  • Live user data   │
│  • Your changes     │         │  • Isolated         │
└─────────────────────┘         └─────────────────────┘
```

**When you deploy:**
- ✅ Code changes go live
- ❌ Database does NOT automatically sync
- ❌ Development data does NOT transfer

---

## 🎯 Why This Happens

### Separate Databases Are GOOD:

1. **Security**: Production data stays isolated
2. **Safety**: Your test data doesn't affect live users
3. **Control**: You decide what data goes to production
4. **Flexibility**: Different environments for testing

### The Challenge:

When you add new features (like Video Ads), you need to ensure:
1. Database structure is created in production
2. Essential data is initialized
3. Collections and indexes exist

---

## ✅ Solution: Automatic Database Initialization

### What We've Implemented:

**File:** `/app/backend/server.py`

```python
@app.on_event("startup")
async def startup_db():
    """
    Runs EVERY TIME the backend starts
    Creates database structure automatically
    """
    # Create indexes for all collections
    await initialize_database_indexes()
    
    # Initialize treasure hunts
    await initialize_treasure_hunts()
    
    # Ready for video ads (admin creates via panel)
```

### What Happens on Deployment:

```
1. Backend starts in production
2. startup_db() function runs automatically
3. Creates all necessary indexes
4. Initializes treasure hunts
5. Database is ready!
```

---

## 📋 What Gets Initialized Automatically

### ✅ Automatic (No Action Needed):

1. **Database Indexes:**
   - Users (uid, email, mobile)
   - Video ads (video_ad_id, placement, is_active)
   - Treasure hunts (hunt_id)
   - Orders (order_id, user_id)
   - Products (product_id)

2. **Treasure Hunts:**
   - 3 default hunts created (Easy, Medium, Hard)
   - Multiple treasure locations
   - Randomization enabled

3. **Collections:**
   - All collections created on first use
   - MongoDB creates them automatically

### ⚠️ Manual (Admin Action Required):

1. **Video Ads:**
   - Admin creates via `/admin/video-ads`
   - No default videos (you choose what to show)

2. **Products:**
   - Import/add via admin panel
   - Your product catalog

3. **Users:**
   - Registered through signup
   - Or imported via admin tools

4. **Settings:**
   - Configure via admin panel

---

## 🚀 Deployment Workflow

### Step 1: Deploy Your Code
```
1. Click "Deploy" button in Emergent
2. Wait ~10 minutes for deployment
3. Backend starts automatically
```

### Step 2: Automatic Initialization
```
Backend startup_db() runs:
✅ Creates database indexes
✅ Initializes treasure hunts
✅ Prepares all collections
```

### Step 3: Admin Setup (First Time Only)
```
1. Login as admin to production site
2. Go to /admin/video-ads
3. Create your first video ad
4. Add products (if needed)
5. Configure settings
```

### Step 4: You're Live!
```
✅ All features work
✅ Users can register
✅ Treasure hunts work
✅ Video ads ready (when you add them)
```

---

## 🔄 Updating Production Database

### When You Add New Features:

**Example: You added Video Ads system**

#### What Happens Automatically:
```python
# In startup_db():
await db.video_ads.create_index("video_ad_id", unique=True)
# Index created automatically on first deployment
```

#### What You Do Manually:
```
1. Deploy code
2. Go to /admin/video-ads
3. Create your first video ad
4. It appears on selected pages
```

### If You Need to Migrate Data:

**Option 1: Export/Import (Manual)**
```bash
# Export from development
mongoexport --db=paras_reward --collection=products --out=products.json

# Import to production (via admin panel or API)
POST /api/admin/bulk-import
```

**Option 2: Seed Data Script (Automatic)**
```python
# Add to startup_db():
async def seed_initial_products():
    count = await db.products.count_documents({})
    if count == 0:
        # Insert default products
        await db.products.insert_many([...])

# Call in startup:
await seed_initial_products()
```

**Option 3: Admin Import Tool**
```
1. Create CSV/JSON with data
2. Use admin panel import feature
3. Bulk upload to production
```

---

## 🛠️ Best Practices

### DO ✅

1. **Use Startup Initialization:**
   ```python
   @app.on_event("startup")
   async def startup_db():
       # Create indexes
       # Initialize essential data
   ```

2. **Create Indexes:**
   ```python
   await db.users.create_index("email", unique=True)
   ```

3. **Check Before Creating:**
   ```python
   count = await db.treasure_hunts.count_documents({})
   if count == 0:
       # Create default hunts
   ```

4. **Use Environment Variables:**
   ```python
   MONGO_URL = os.environ.get('MONGO_URL')
   DB_NAME = os.environ.get('DB_NAME')
   ```

### DON'T ❌

1. **Don't hardcode database names:**
   ```python
   # Bad
   db = client.paras_reward_dev
   
   # Good
   db = client[os.environ.get('DB_NAME')]
   ```

2. **Don't assume development data exists:**
   ```python
   # Bad
   user = await db.users.find_one({"uid": "admin123"})
   # Might not exist in production!
   
   # Good
   user = await db.users.find_one({"uid": "admin123"})
   if not user:
       # Create or handle missing data
   ```

3. **Don't manually copy MongoDB files:**
   - Development and production databases are separate
   - Use proper data migration tools

---

## 📊 Current Database Structure

### Collections That Auto-Initialize:

1. **treasure_hunts** ✅
   - 3 default hunts created
   - Multiple locations per hunt
   - Randomization enabled

2. **treasure_progress** ✅
   - Created when users play
   - Tracks game progress

### Collections Created on First Use:

1. **users** - When first user registers
2. **products** - When admin adds products
3. **orders** - When first order placed
4. **video_ads** - When admin creates video ad
5. **video_ad_events** - When first video viewed
6. **transactions** - When first transaction
7. **support_tickets** - When first ticket created

---

## 🔍 Verifying Production Database

### After Deployment, Check:

1. **Backend Logs:**
   ```
   Look for:
   🚀 Starting database initialization...
   ✅ Database indexes created successfully
   ✅ Database initialization complete!
   ```

2. **Test Treasure Hunt:**
   - Login as user
   - Go to /treasure-hunt
   - Should see 3 hunts available
   - If yes, database is working!

3. **Test Video Ads:**
   - Login as admin
   - Go to /admin/video-ads
   - Should see empty list (ready to create)
   - Create test video ad
   - Check if it saves

4. **Test User Registration:**
   - Try registering a new user
   - Should work without errors
   - User saved to production database

---

## 🚨 Troubleshooting

### Issue: "Treasure hunts not showing"

**Solution:**
```python
# Check startup logs
# If initialization failed, manually trigger:
await initialize_treasure_hunts()
```

### Issue: "Video ads collection not found"

**Solution:**
```python
# Collection created automatically on first insert
# Just create a video ad via admin panel
```

### Issue: "Users from development not in production"

**Expected Behavior:**
- This is NORMAL and CORRECT
- Production database starts fresh
- Users register on production site
- Development users stay in development

**If you need test users in production:**
```python
# Add to startup_db() for testing only:
async def create_test_admin():
    admin = await db.users.find_one({"email": "admin@test.com"})
    if not admin:
        # Create test admin
        await db.users.insert_one({...})
```

### Issue: "Database seems empty after deployment"

**This is normal!**
- Production starts with empty database
- Startup script initializes structure
- Data added through:
  - User registrations
  - Admin panel
  - API calls

---

## 📝 Checklist: First Deployment

### Before Deployment:
- [x] Startup initialization code added
- [x] Database indexes configured
- [x] Treasure hunts auto-initialize
- [x] Environment variables set

### After Deployment:
- [ ] Check backend logs for initialization success
- [ ] Test user registration
- [ ] Test treasure hunt (should show 3 hunts)
- [ ] Login as admin
- [ ] Create first video ad
- [ ] Add products (if needed)
- [ ] Configure settings

### Verify Everything Works:
- [ ] Users can register
- [ ] Users can login
- [ ] Treasure hunt shows 3 options
- [ ] Video ads admin panel accessible
- [ ] Orders can be placed
- [ ] Transactions tracked

---

## 🎯 Summary

**What You Need to Know:**

1. **Development ≠ Production**
   - Separate databases by design
   - Keeps production data safe

2. **Automatic Initialization**
   - Startup script runs on every backend start
   - Creates database structure
   - Initializes essential data

3. **Manual Setup (First Time)**
   - Admin creates video ads
   - Admin adds products
   - Admin configures settings

4. **Future Updates**
   - Just deploy code
   - Startup script handles database
   - Admin adds new content as needed

**You're All Set! 🚀**

Your database will initialize automatically on deployment. Just deploy your code and the backend startup script will handle the rest!

---

## 📞 Need Help?

**Common Questions:**

Q: Will my development data be lost?
A: No! Development database is separate and stays intact.

Q: Do I need to manually create collections?
A: No! MongoDB creates them automatically on first use.

Q: What if I want to migrate data?
A: Use export/import tools or create seed data scripts.

Q: How do I backup production database?
A: Contact Emergent support for database backup options.

---

**Last Updated:** November 7, 2024
**Status:** ✅ Ready for Deployment
