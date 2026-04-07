import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import RewardLoader from '@/components/RewardLoader';
import { 
  User, Lock, ArrowLeft, Eye, EyeOff, Camera, 
  Save, Phone, Mail, Crown, ChevronRight, 
  LogOut, Trash2, Settings, CreditCard, Shield, FileText, Globe, Info,
  HelpCircle, CheckCircle, Receipt, KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import ImageCropUpload from '@/components/ImageCropUpload';
import { LanguageSelectorFull } from '@/components/LanguageSelector';
// ShareApp removed (April 2026)
import { InfoTooltip } from '@/components/InfoTooltip';
import { Label } from '@/components/ui/label';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Security PIN Card Component
const SecurityPinCard = ({ user }) => {
  const [hasPin, setHasPin] = useState(false);
  const [isDefault, setIsDefault] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    if (user?.uid) {
      axios.get(`${API}/auth/security-pin/check/${user.uid}`, { timeout: 4000 })
        .then(res => {
          setHasPin(res.data.has_security_pin);
          setIsDefault(res.data.is_default);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user]);

  const handleSave = async () => {
    if (!newPin || newPin.length !== 4) {
      toast.error('Security PIN must be 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }
    if (new Set(newPin).size === 1) {
      toast.error('PIN cannot be all same digits');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/auth/security-pin/change`, {
        user_id: user.uid,
        current_security_pin: currentPin || undefined,
        login_pin: !currentPin ? undefined : undefined,
        new_security_pin: newPin
      });
      toast.success('Security PIN changed successfully!');
      setHasPin(true);
      setIsDefault(false);
      setShowForm(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change Security PIN');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-1/2 mb-3"></div>
        <div className="h-4 bg-white/10 rounded w-3/4"></div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-rose-500/10 to-pink-500/10 rounded-2xl p-4 border border-rose-500/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Security PIN</h3>
            <p className="text-xs text-gray-400">For PIN reset verification</p>
          </div>
        </div>
        {hasPin && !isDefault && (
          <CheckCircle className="w-5 h-5 text-green-500" />
        )}
      </div>

      {!showForm ? (
        <>
          {isDefault ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3">
              <p className="text-sm text-amber-400">
                Your Security PIN is set to default. Change it for better security.
              </p>
            </div>
          ) : (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-3">
              <p className="text-sm text-green-400">
                Security PIN is set. Used for PIN reset verification.
              </p>
            </div>
          )}
          <Button
            onClick={() => setShowForm(true)}
            variant="outline"
            className="w-full border-rose-500/50 text-rose-400 hover:bg-rose-500/20"
            data-testid="change-security-pin-btn"
          >
            Change Security PIN
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <div>
            <Label className="text-gray-300 text-sm">Current Security PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter current 4-digit PIN"
              className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-gray-500 text-center tracking-[0.5em]"
              data-testid="current-security-pin-input"
            />
            <p className="text-xs text-gray-500 mt-1">Default: Last 4 digits of your mobile number</p>
          </div>

          <div>
            <Label className="text-gray-300 text-sm">New Security PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter new 4-digit PIN"
              className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-gray-500 text-center tracking-[0.5em]"
              data-testid="new-security-pin-input"
            />
          </div>

          <div>
            <Label className="text-gray-300 text-sm">Confirm New PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Confirm new 4-digit PIN"
              className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-gray-500 text-center tracking-[0.5em]"
              data-testid="confirm-security-pin-input"
            />
          </div>

          {newPin && confirmPin && newPin !== confirmPin && (
            <p className="text-red-400 text-xs">PINs do not match</p>
          )}
          {newPin && confirmPin && newPin === confirmPin && newPin.length === 4 && (
            <p className="text-green-400 text-xs">PINs match!</p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => { setShowForm(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }}
              variant="outline"
              className="flex-1 border-gray-500/50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || currentPin.length !== 4 || newPin.length !== 4 || newPin !== confirmPin}
              className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500"
              data-testid="save-security-pin-btn"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// Bank Details Card Component
// Bank Account section removed as per user request

const ProfileAdvanced = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);  // Separate state for profile picture
  // Auto-open edit mode if ?edit=true in URL
  const [editMode, setEditMode] = useState(searchParams.get('edit') === 'true');
  const [showImageUpload, setShowImageUpload] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    tahsil: '',
    district: '',
    state: '',
    pincode: '',
    birthday: ''
  });
  
  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  // PIN change
  const [showPinSection, setShowPinSection] = useState(false);
  const [pinData, setPinData] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showPinPassword, setShowPinPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [changingPin, setChangingPin] = useState(false);

  // Delete account
  const [showDeleteSection, setShowDeleteSection] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // Privacy settings removed (April 2026)

  // FAST LOAD: Fetch user data + profile picture in parallel on mount
  useEffect(() => {
    if (user?.uid) {
      Promise.allSettled([
        axios.get(`${API}/user/${user.uid}`, { timeout: 4000 }),
        axios.get(`${API}/users/${user.uid}/profile-picture`, { timeout: 4000 })
      ]).then(([userRes, picRes]) => {
        if (userRes.status === 'fulfilled') {
          const data = userRes.value.data;
          setUserData(data);
          setFormData({
            name: data.name || '',
            phone: data.mobile || data.phone || '',
            address: data.address_line1 || data.address || '',
            tahsil: data.tahsil || data.taluka || '',
            district: data.district || '',
            state: data.state || '',
            pincode: data.pincode || '',
            birthday: data.date_of_birth || data.birthday || ''
          });
        } else {
          setUserData(user);
          setFormData({
            name: user.name || '', phone: user.mobile || user.phone || '',
            address: user.address_line1 || user.address || '',
            tahsil: user.tahsil || user.taluka || '', district: user.district || '',
            state: user.state || '', pincode: user.pincode || '',
            birthday: user.date_of_birth || user.birthday || ''
          });
        }
        if (picRes.status === 'fulfilled' && picRes.value?.data?.profile_picture) {
          setProfilePicture(picRes.value.data.profile_picture);
        }
        setLoading(false);
      });
    }
  }, [user]);

  const t = {
    profile: language === 'mr' ? 'प्रोफाइल' : language === 'hi' ? 'प्रोफ़ाइल' : 'Profile',
    editProfile: language === 'mr' ? 'प्रोफाइल संपादित करा' : language === 'hi' ? 'प्रोफ़ाइल संपादित करें' : 'Edit Profile',
    save: language === 'mr' ? 'जतन करा' : language === 'hi' ? 'सहेजें' : 'Save',
    changePassword: language === 'mr' ? 'पासवर्ड बदला' : language === 'hi' ? 'पासवर्ड बदलें' : 'Change Password',
    changePin: language === 'mr' ? 'PIN बदला' : language === 'hi' ? 'PIN बदलें' : 'Change PIN',
    deleteAccount: language === 'mr' ? 'खाते हटवा' : language === 'hi' ? 'खाता हटाएं' : 'Delete Account',
    logout: language === 'mr' ? 'बाहेर पडा' : language === 'hi' ? 'लॉग आउट' : 'Logout',
    kycVerification: language === 'mr' ? 'KYC सत्यापन' : language === 'hi' ? 'KYC सत्यापन' : 'KYC Verification',
    eliteMembership: language === 'mr' ? 'Elite सदस्यत्व' : language === 'hi' ? 'Elite सदस्यता' : 'Elite Membership',
    security: language === 'mr' ? 'सुरक्षा' : language === 'hi' ? 'सुरक्षा' : 'Security',
  };

  // fetchUserData kept for profile update/save refresh
  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/user/${user.uid}`, { timeout: 4000 });
      const data = response.data;
      setUserData(data);
      setFormData({
        name: data.name || '',
        phone: data.mobile || data.phone || '',
        address: data.address_line1 || data.address || '',
        tahsil: data.tahsil || data.taluka || '',
        district: data.district || '',
        state: data.state || '',
        pincode: data.pincode || '',
        birthday: data.date_of_birth || data.birthday || ''
      });
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Map frontend field names to backend field names
      const profileData = {
        name: formData.name,
        mobile: formData.phone,  // Backend expects 'mobile' not 'phone'
        phone: formData.phone,   // Also send as phone for compatibility
        address_line1: formData.address,  // Backend expects 'address_line1'
        address: formData.address,  // Also send as address for compatibility
        tahsil: formData.tahsil,
        taluka: formData.tahsil,  // Backend also accepts taluka
        district: formData.district,
        state: formData.state,
        pincode: formData.pincode,
        date_of_birth: formData.birthday,  // Backend expects 'date_of_birth'
        birthday: formData.birthday,  // Also send as birthday for compatibility
        city: formData.district || formData.tahsil,  // Add city field
      };
      
      await axios.put(`${API}/user/${user.uid}/profile`, profileData);
      toast.success('Profile updated successfully!');
      setEditMode(false);
      fetchUserData();
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new !== passwordData.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordData.new.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    setSaving(true);
    try {
      await axios.post(`${API}/user/${user.uid}/change-password`, {
        current_password: passwordData.current,
        new_password: passwordData.new
      });
      toast.success('Password changed!');
      setShowPasswordSection(false);
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePin = async () => {
    if (pinData.new !== pinData.confirm) {
      toast.error('New PINs do not match');
      return;
    }
    if (pinData.new.length !== 6) {
      toast.error('PIN must be 6 digits');
      return;
    }
    if (pinData.current.length !== 6) {
      toast.error('Enter current PIN');
      return;
    }
    // Check for weak PINs
    if (new Set(pinData.new).size === 1) {
      toast.error('Weak PIN - all digits cannot be same');
      return;
    }
    
    setChangingPin(true);
    try {
      await axios.post(`${API}/user/${user.uid}/change-pin`, {
        current_pin: pinData.current,
        new_pin: pinData.new
      });
      toast.success('PIN changed successfully!');
      setShowPinSection(false);
      setPinData({ current: '', new: '', confirm: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change PIN');
    } finally {
      setChangingPin(false);
    }
  };

  // handlePrivacyToggle removed (April 2026)

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error('Please enter your password');
      return;
    }
    
    setDeleting(true);
    try {
      await axios.post(`${API}/user/${user.uid}/request-account-deletion`, {
        password: deletePassword,
        reason: 'User requested deletion'
      });
      toast.success('Account scheduled for deletion');
      setTimeout(() => onLogout(), 2000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const handleImageUpdate = async (imageData) => {
    try {
      // Use the correct profile picture upload endpoint
      const formData = new FormData();
      
      // Convert base64 to blob if needed
      if (imageData.startsWith('data:')) {
        const response = await fetch(imageData);
        const blob = await response.blob();
        formData.append('file', blob, 'profile.jpg');
      } else {
        formData.append('profile_picture_url', imageData);
      }
      
      await axios.post(`${API}/user/${user.uid}/upload-profile-picture`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Profile picture updated!');
      setShowImageUpload(false);
      fetchUserData();
    } catch (error) {
      console.error('Profile picture upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to update picture');
    }
  };

  // Auto-upload profile picture with compression
  const handleQuickImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    setSaving(true);
    toast.info('Uploading profile picture...');
    
    try {
      // Compress and resize image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 500,
        useWebWorker: true,
        fileType: 'image/jpeg'
      };
      
      const imageCompression = (await import('browser-image-compression')).default;
      const compressedFile = await imageCompression(file, options);
      
      // Upload compressed image
      const formData = new FormData();
      formData.append('file', compressedFile, 'profile.jpg');
      
      await axios.post(`${API}/user/${user.uid}/upload-profile-picture`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Profile picture updated!');
      fetchUserData();
      fetchProfilePicture();  // Refresh profile picture
    } catch (error) {
      console.error('Quick upload error:', error);
      toast.error('Failed to upload picture');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RewardLoader message="Loading profile..." />
      </div>
    );
  }

  // Get subscription plan info
  const subscriptionPlan = userData?.subscription_plan || 'explorer';
  const hasPaidPlan = ['startup', 'growth', 'elite'].includes(subscriptionPlan);
  
  // Helper function to get plan display name
  const getPlanDisplayName = (plan) => {
    const planNames = {
      'explorer': 'Explorer',
      'startup': 'Startup',
      'growth': 'Growth',
      'elite': 'Elite'
    };
    return planNames[plan] || 'Explorer';
  };
  
  // Get plan badge gradient
  const getPlanGradient = (plan) => {
    if (plan === 'elite') return 'from-amber-500 to-yellow-500';
    if (plan === 'growth') return 'from-emerald-500 to-green-500';
    if (plan === 'startup') return 'from-blue-500 to-cyan-500';
    return 'from-gray-500 to-gray-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header - with safe area padding */}
      <div className="px-5 pb-4 pt-20" style={{ paddingTop: 'max(5rem, calc(env(safe-area-inset-top, 0px) + 4rem))' }}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white text-xl font-bold">{t.profile}</h1>
        </div>
      </div>

      {/* AI Smart Tip for Profile */}
      <div className="px-5 mb-4">
      </div>

      {/* Profile Card */}
      <div className="px-5 mb-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-6 text-center"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
          }}
        >
          {/* Profile Picture */}
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 p-1">
              <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden">
                {profilePicture ? (
                  <img src={profilePicture} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-gray-400" />
                )}
              </div>
            </div>
            {/* Quick upload - hidden input */}
            <input
              type="file"
              id="quick-profile-upload"
              accept="image/*"
              onChange={handleQuickImageUpload}
              className="hidden"
            />
            <label 
              htmlFor="quick-profile-upload"
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center cursor-pointer hover:bg-amber-400 transition-colors"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-4 h-4 text-black" />
              )}
            </label>
          </div>

          <h2 className="text-white text-xl font-bold mb-1">
            {userData?.name || user?.email?.split('@')[0] || 'User'}
          </h2>
          <p className="text-gray-400 text-sm mb-3">{userData?.email || user?.email}</p>
          
          {hasPaidPlan && (
            <div className={`inline-flex items-center gap-1 bg-gradient-to-r ${getPlanGradient(subscriptionPlan)} px-4 py-1 rounded-full`}>
              <Crown className="w-4 h-4 text-black" />
              <span className="text-black font-bold text-sm">{getPlanDisplayName(subscriptionPlan)} Member</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Stats removed - PRC/Friends/Redeemed cards deprecated (April 2026) */}

      {/* Edit Profile Section */}
      {editMode ? (
        <div className="px-5 mb-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
            {/* Personal Info */}
            <div className="border-b border-gray-800 pb-3 mb-3">
              <h3 className="text-amber-400 font-semibold text-sm mb-3">Personal Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Full Name *</label>
                  <Input 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter your full name"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">Phone *</label>
                    <Input 
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                      placeholder="10-digit mobile"
                      className="bg-gray-800 border-gray-700 text-white"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">Birthday</label>
                    <Input 
                      type="date"
                      value={formData.birthday}
                      onChange={(e) => setFormData({...formData, birthday: e.target.value})}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Address Info */}
            <div>
              <h3 className="text-amber-400 font-semibold text-sm mb-3">Address Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Full Address</label>
                  <Input 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="House No, Street, Area"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">Tahsil / Taluka</label>
                    <Input 
                      value={formData.tahsil}
                      onChange={(e) => setFormData({...formData, tahsil: e.target.value})}
                      placeholder="Enter tahsil"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">District</label>
                    <Input 
                      value={formData.district}
                      onChange={(e) => setFormData({...formData, district: e.target.value})}
                      placeholder="Enter district"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">State</label>
                    <Input 
                      value={formData.state}
                      onChange={(e) => setFormData({...formData, state: e.target.value})}
                      placeholder="Enter state"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">PIN Code</label>
                    <Input 
                      value={formData.pincode}
                      onChange={(e) => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                      placeholder="6-digit PIN"
                      className="bg-gray-800 border-gray-700 text-white"
                      maxLength={6}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={() => setEditMode(false)}
                variant="outline"
                className="flex-1 bg-gray-800 border-gray-700 text-white"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-black"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : t.save}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 mb-6">
          <Button 
            onClick={() => setEditMode(true)}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white justify-between"
          >
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {t.editProfile}
            </span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Menu Options */}
      <div className="px-5 space-y-3">
        {/* Share & Earn card removed (April 2026) */}

        {/* KYC */}
        <button 
          onClick={() => navigate('/kyc')}
          className="w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex items-center justify-between"
        >
          <span className="flex items-center gap-3 text-white">
            <FileText className="w-5 h-5 text-blue-500" />
            {t.kycVerification}
            <InfoTooltip>
              <p>KYC verification is required for premium features. Complete it once for lifetime access</p>
            </InfoTooltip>
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              userData?.kyc_status === 'verified' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
            }`}>
              {userData?.kyc_status || 'Pending'}
            </span>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </div>
        </button>

        {/* Security PIN - Important for PIN Reset */}
        <SecurityPinCard user={user} />

        {/* Privacy Settings removed (April 2026) */}

        {/* Change PIN */}
        <button 
          onClick={() => setShowPinSection(!showPinSection)}
          className="w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex items-center justify-between"
        >
          <span className="flex items-center gap-3 text-white">
            <Shield className="w-5 h-5 text-green-500" />
            {t.changePin}
          </span>
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>

        {showPinSection && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
            <p className="text-gray-400 text-sm">
              Use 6-digit PIN to login
            </p>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">
                Current PIN
              </label>
              <div className="relative">
                <Input 
                  type={showPinPassword.current ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={6}
                  value={pinData.current}
                  onChange={(e) => setPinData({...pinData, current: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                  className="bg-gray-800 border-gray-700 text-white text-center text-xl tracking-widest pr-12"
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPinPassword({...showPinPassword, current: !showPinPassword.current})}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPinPassword.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">
                New PIN
              </label>
              <div className="relative">
                <Input 
                  type={showPinPassword.new ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={6}
                  value={pinData.new}
                  onChange={(e) => setPinData({...pinData, new: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                  className="bg-gray-800 border-gray-700 text-white text-center text-xl tracking-widest pr-12"
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPinPassword({...showPinPassword, new: !showPinPassword.new})}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPinPassword.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">
                Confirm New PIN
              </label>
              <div className="relative">
                <Input 
                  type={showPinPassword.confirm ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={6}
                  value={pinData.confirm}
                  onChange={(e) => setPinData({...pinData, confirm: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                  className="bg-gray-800 border-gray-700 text-white text-center text-xl tracking-widest pr-12"
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPinPassword({...showPinPassword, confirm: !showPinPassword.confirm})}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPinPassword.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <Button 
              onClick={handleChangePin}
              disabled={changingPin}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {changingPin ? 'Changing...' : 'Change PIN'}
            </Button>
          </div>
        )}

        {/* Delete Account */}
        <button 
          onClick={() => setShowDeleteSection(!showDeleteSection)}
          className="w-full bg-gray-900/50 border border-red-900/30 rounded-2xl p-4 flex items-center justify-between"
        >
          <span className="flex items-center gap-3 text-red-400">
            <Trash2 className="w-5 h-5" />
            {t.deleteAccount}
          </span>
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>

        {showDeleteSection && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-5 space-y-4">
            <p className="text-red-400 text-sm">
              ⚠️ This will delete your account and forfeit all PRC. You have 30 days to recover.
            </p>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Enter Password to Confirm</label>
              <Input 
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="bg-gray-800 border-red-800 text-white"
              />
            </div>
            <Button 
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleting ? 'Deleting...' : 'Delete My Account'}
            </Button>
          </div>
        )}

        {/* Logout */}
        <button 
          onClick={onLogout}
          className="w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex items-center justify-between"
        >
          <span className="flex items-center gap-3 text-white">
            <LogOut className="w-5 h-5 text-gray-400" />
            {t.logout}
          </span>
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>

        {/* Language Selector */}
        <div className="mt-6">
          <LanguageSelectorFull />
        </div>
      </div>

      {/* Image Upload Modal */}
      {showImageUpload && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-md">
            <h3 className="text-white font-bold text-lg mb-4">Update Profile Picture</h3>
            <ImageCropUpload 
              onImageCropped={handleImageUpdate}
              onCancel={() => setShowImageUpload(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileAdvanced;
