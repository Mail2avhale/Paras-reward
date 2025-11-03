# How to Add New Fields to PARAS REWARD Application

## Complete Guide for Adding Custom Fields

This guide explains how to add ANY new field to your user profile or any other part of the application.

---

## Overview

Adding a new field requires updates in **3 places**:
1. **Backend Model** (models.py) - Define the field
2. **Backend API** (server.py) - Handle the field in endpoints
3. **Frontend Component** - Display and collect the field

---

## Step-by-Step Process

### Example: Adding "Alternate Mobile" field

Let's walk through adding a new field called `alternate_mobile` to user profiles.

---

## STEP 1: Update Backend Model

**File:** `/app/backend/models.py`

**Find the User model** (around line 110) and add your new field:

```python
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    uid: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password: str
    role: str = "user"
    
    # Existing fields
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    
    # ✅ ADD YOUR NEW FIELD HERE
    alternate_mobile: Optional[str] = None  # <-- NEW FIELD
    
    # Address fields
    state: Optional[str] = None
    district: Optional[str] = None
    tahsil: Optional[str] = None
    village: Optional[str] = None
    pincode: Optional[str] = None
    
    # Other fields...
```

**Field Types:**
- `Optional[str]` - Text field (can be empty)
- `Optional[int]` - Number field
- `Optional[float]` - Decimal number
- `Optional[bool]` - True/False
- `Optional[datetime]` - Date/Time
- `str` - Required text field (not optional)

---

## STEP 2: Update Backend API Endpoints

**File:** `/app/backend/server.py`

### 2A. Update Profile Update Endpoint

**Find** the `/user/{uid}/profile` endpoint (around line 757):

```python
@api_router.put("/user/{uid}/profile")
async def update_profile(uid: str, request: Request):
    """Update user profile"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    data = await request.json()
    
    # Fields that can be updated
    updatable_fields = [
        "first_name", "middle_name", "last_name", "mobile",
        "state", "district", "tahsil", "village", "pincode",
        "aadhaar_number", "pan_number", "upi_id",
        
        # ✅ ADD YOUR NEW FIELD HERE
        "alternate_mobile"  # <-- ADD THIS
    ]
    
    update_data = {}
    for field in updatable_fields:
        if field in data:
            update_data[field] = data[field]
    
    # ... rest of the code
```

### 2B. Update Complete Profile Endpoint

**Find** the `/user/{uid}/complete-profile` endpoint (around line 851):

```python
@api_router.put("/user/{uid}/complete-profile")
async def complete_profile(uid: str, request: Request):
    """Complete user profile with all additional fields"""
    user = await db.users.find_one({"uid": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    data = await request.json()
    
    # Build update data
    update_data = {
        "first_name": data.get("first_name"),
        "middle_name": data.get("middle_name"),
        "last_name": data.get("last_name"),
        "mobile": data.get("mobile"),
        
        # ✅ ADD YOUR NEW FIELD HERE
        "alternate_mobile": data.get("alternate_mobile"),  # <-- ADD THIS
        
        "gender": data.get("gender"),
        "date_of_birth": data.get("date_of_birth"),
        # ... rest of fields
    }
    
    # ... rest of the code
```

---

## STEP 3: Update Frontend Component

**File:** `/app/frontend/src/pages/ProfileEnhanced.js`

### 3A. Add to State

**Find** the `profileData` state (around line 21):

```javascript
const [profileData, setProfileData] = useState({
  first_name: '',
  middle_name: '',
  last_name: '',
  mobile: '',
  
  // ✅ ADD YOUR NEW FIELD HERE
  alternate_mobile: '',  // <-- ADD THIS
  
  gender: '',
  date_of_birth: '',
  // ... rest of fields
});
```

### 3B. Initialize from User Data

**Find** the `useEffect` hook (around line 52):

```javascript
useEffect(() => {
  if (user) {
    const userData = {
      first_name: user.first_name || '',
      middle_name: user.middle_name || '',
      last_name: user.last_name || '',
      mobile: user.mobile || '',
      
      // ✅ ADD YOUR NEW FIELD HERE
      alternate_mobile: user.alternate_mobile || '',  // <-- ADD THIS
      
      gender: user.gender || '',
      // ... rest of fields
    };
    
    setProfileData(userData);
  }
}, [user]);
```

### 3C. Add UI Input Field

**Find** the Contact & Address tab (around line 460) and add your input:

```jsx
{/* Contact & Address Tab */}
<TabsContent value="contact">
  <Card className="p-6">
    <div className="flex items-center gap-3 mb-6">
      <MapPin className="h-6 w-6 text-purple-600" />
      <h3 className="text-2xl font-bold">Contact & Address</h3>
    </div>

    <form onSubmit={handleCompleteProfile} className="space-y-4">
      <div>
        <Label>Mobile Number *</Label>
        <Input
          value={profileData.mobile}
          onChange={(e) => setProfileData({...profileData, mobile: e.target.value})}
          placeholder="10-digit mobile"
          maxLength={10}
          required
        />
      </div>

      {/* ✅ ADD YOUR NEW FIELD HERE */}
      <div>
        <Label>Alternate Mobile</Label>
        <Input
          value={profileData.alternate_mobile}
          onChange={(e) => setProfileData({...profileData, alternate_mobile: e.target.value})}
          placeholder="10-digit alternate mobile"
          maxLength={10}
        />
      </div>

      {/* ... rest of fields */}
    </form>
  </Card>
</TabsContent>
```

---

## STEP 4: Restart Services

After making all changes:

```bash
# Restart backend
sudo supervisorctl restart backend

# Frontend will auto-reload (hot reload enabled)
```

---

## Common Field Types Examples

### 1. Text Input (Single Line)

**Backend Model:**
```python
company_name: Optional[str] = None
```

**Frontend:**
```jsx
<div>
  <Label>Company Name</Label>
  <Input
    value={profileData.company_name}
    onChange={(e) => setProfileData({...profileData, company_name: e.target.value})}
    placeholder="Enter company name"
  />
</div>
```

### 2. Text Area (Multi-Line)

**Backend Model:**
```python
bio: Optional[str] = None
```

**Frontend:**
```jsx
<div>
  <Label>Bio</Label>
  <textarea
    value={profileData.bio}
    onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
    placeholder="Tell us about yourself"
    className="w-full border rounded p-2"
    rows="4"
  />
</div>
```

### 3. Dropdown Select

**Backend Model:**
```python
occupation: Optional[str] = None
```

**Frontend:**
```jsx
<div>
  <Label>Occupation</Label>
  <Select 
    value={profileData.occupation} 
    onValueChange={(value) => setProfileData({...profileData, occupation: value})}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select Occupation" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="student">Student</SelectItem>
      <SelectItem value="employed">Employed</SelectItem>
      <SelectItem value="self_employed">Self Employed</SelectItem>
      <SelectItem value="business">Business</SelectItem>
      <SelectItem value="retired">Retired</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### 4. Number Input

**Backend Model:**
```python
age: Optional[int] = None
```

**Frontend:**
```jsx
<div>
  <Label>Age</Label>
  <Input
    type="number"
    value={profileData.age}
    onChange={(e) => setProfileData({...profileData, age: parseInt(e.target.value) || 0})}
    placeholder="Enter age"
    min="18"
    max="100"
  />
</div>
```

### 5. Date Input

**Backend Model:**
```python
anniversary_date: Optional[str] = None
```

**Frontend:**
```jsx
<div>
  <Label>Anniversary Date</Label>
  <Input
    type="date"
    value={profileData.anniversary_date}
    onChange={(e) => setProfileData({...profileData, anniversary_date: e.target.value})}
  />
</div>
```

### 6. Checkbox

**Backend Model:**
```python
newsletter_subscribed: Optional[bool] = False
```

**Frontend:**
```jsx
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={profileData.newsletter_subscribed}
    onChange={(e) => setProfileData({...profileData, newsletter_subscribed: e.target.checked})}
    className="w-4 h-4"
  />
  <Label>Subscribe to Newsletter</Label>
</div>
```

### 7. Radio Buttons

**Backend Model:**
```python
marital_status: Optional[str] = None
```

**Frontend:**
```jsx
<div>
  <Label>Marital Status</Label>
  <div className="flex gap-4">
    <label className="flex items-center gap-2">
      <input
        type="radio"
        name="marital_status"
        value="single"
        checked={profileData.marital_status === 'single'}
        onChange={(e) => setProfileData({...profileData, marital_status: e.target.value})}
      />
      Single
    </label>
    <label className="flex items-center gap-2">
      <input
        type="radio"
        name="marital_status"
        value="married"
        checked={profileData.marital_status === 'married'}
        onChange={(e) => setProfileData({...profileData, marital_status: e.target.value})}
      />
      Married
    </label>
  </div>
</div>
```

---

## Adding Fields to Other Components

### Example: Adding Field to Admin Dashboard

**1. Backend Model** (if not in User model, create new model)

**2. Backend API**
```python
@api_router.post("/admin/custom-field")
async def add_custom_field(request: Request):
    data = await request.json()
    # Handle your custom field
    return {"success": True}
```

**3. Frontend Component**
```jsx
// In AdminDashboard.js
const [customField, setCustomField] = useState('');

const handleSave = async () => {
  await axios.post(`${API}/admin/custom-field`, {
    field_name: customField
  });
};
```

---

## Validation Examples

### Backend Validation

```python
# In server.py endpoint
data = await request.json()

# Check if field is provided
if not data.get("alternate_mobile"):
    raise HTTPException(status_code=400, detail="Alternate mobile is required")

# Validate format
if len(data.get("alternate_mobile")) != 10:
    raise HTTPException(status_code=400, detail="Mobile must be 10 digits")

# Check for duplicates
existing = await db.users.find_one({
    "alternate_mobile": data.get("alternate_mobile"),
    "uid": {"$ne": uid}
})
if existing:
    raise HTTPException(status_code=400, detail="Alternate mobile already in use")
```

### Frontend Validation

```jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Validate before submission
  if (profileData.alternate_mobile && profileData.alternate_mobile.length !== 10) {
    toast.error('Alternate mobile must be 10 digits');
    return;
  }
  
  // Submit data
  await updateProfile();
};
```

---

## Complex Field Examples

### Adding Cascading Dropdowns (like State → District)

Already implemented in location data! Check:
- `/app/frontend/src/data/locationData.js` - Data source
- `/app/frontend/src/pages/ProfileEnhanced.js` - Implementation

### Adding File Upload Field

```jsx
// Frontend
const [document, setDocument] = useState(null);

const handleFileUpload = async (e) => {
  const file = e.target.files[0];
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await axios.post(
    `${API}/user/${user.uid}/upload-document`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  
  toast.success('Document uploaded!');
};

return (
  <div>
    <Label>Upload Document</Label>
    <input
      type="file"
      onChange={handleFileUpload}
      accept=".pdf,.jpg,.png"
    />
  </div>
);
```

---

## Quick Reference Checklist

When adding ANY new field:

- [ ] **Step 1:** Add field to `models.py` (User model)
- [ ] **Step 2:** Add field to `updatable_fields` in `/user/{uid}/profile` endpoint
- [ ] **Step 3:** Add field to `update_data` in `/user/{uid}/complete-profile` endpoint
- [ ] **Step 4:** Add field to `profileData` state in frontend component
- [ ] **Step 5:** Initialize field in `useEffect` from user data
- [ ] **Step 6:** Add UI input in the appropriate tab/section
- [ ] **Step 7:** Restart backend: `sudo supervisorctl restart backend`
- [ ] **Step 8:** Test the field (create, update, display)

---

## Troubleshooting

**Field not saving?**
- Check if added to `updatable_fields` array
- Check backend logs: `tail -f /var/log/supervisor/backend.err.log`
- Verify field name matches exactly in backend and frontend

**Field not displaying?**
- Check if initialized in `useEffect`
- Check if added to state
- Verify user object has the field

**Validation errors?**
- Check backend endpoint for validation logic
- Check frontend console for errors
- Verify data types match (string, number, etc.)

---

## Need Help?

If you need to add a specific field and face issues:
1. Check this guide for examples
2. Verify all 3 steps completed (Model, API, Frontend)
3. Check backend/frontend logs for errors
4. Restart services after changes

---

**Author:** PARAS REWARD Development Team  
**Last Updated:** January 2025  
**Version:** 1.0
