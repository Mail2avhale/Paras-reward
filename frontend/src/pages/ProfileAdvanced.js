import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  User, Lock, ArrowLeft, Eye, EyeOff, Camera, 
  Save, Phone, Mail, Crown, ChevronRight, 
  LogOut, Trash2, Settings, CreditCard, Shield, FileText, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import ImageCropUpload from '@/components/ImageCropUpload';
import { LanguageSelectorFull } from '@/components/LanguageSelector';
import ShareApp from '@/components/ShareApp';

const API = process.env.REACT_APP_BACKEND_URL || '';

const ProfileAdvanced = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
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

  // Delete account
  const [showDeleteSection, setShowDeleteSection] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // Privacy settings
  const [isProfilePublic, setIsProfilePublic] = useState(true);
  const [allowMessages, setAllowMessages] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const t = {
    profile: language === 'mr' ? 'प्रोफाइल' : language === 'hi' ? 'प्रोफ़ाइल' : 'Profile',
    editProfile: language === 'mr' ? 'प्रोफाइल संपादित करा' : language === 'hi' ? 'प्रोफ़ाइल संपादित करें' : 'Edit Profile',
    save: language === 'mr' ? 'जतन करा' : language === 'hi' ? 'सहेजें' : 'Save',
    changePassword: language === 'mr' ? 'पासवर्ड बदला' : language === 'hi' ? 'पासवर्ड बदलें' : 'Change Password',
    deleteAccount: language === 'mr' ? 'खाते हटवा' : language === 'hi' ? 'खाता हटाएं' : 'Delete Account',
    logout: language === 'mr' ? 'बाहेर पडा' : language === 'hi' ? 'लॉग आउट' : 'Logout',
    kycVerification: language === 'mr' ? 'KYC सत्यापन' : language === 'hi' ? 'KYC सत्यापन' : 'KYC Verification',
    vipMembership: language === 'mr' ? 'VIP सदस्यत्व' : language === 'hi' ? 'VIP सदस्यता' : 'VIP Membership',
    security: language === 'mr' ? 'सुरक्षा' : language === 'hi' ? 'सुरक्षा' : 'Security',
  };

  useEffect(() => {
    if (user?.uid) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/api/user/${user.uid}`);
      const data = response.data;
      setUserData(data);
      setFormData({
        name: data.name || '',
        phone: data.phone || data.mobile || '',
        address: data.address || '',
        tahsil: data.tahsil || data.taluka || '',
        district: data.district || '',
        state: data.state || '',
        pincode: data.pincode || '',
        birthday: data.birthday || ''
      });
      // Set privacy settings
      setIsProfilePublic(data.is_public !== false);
      setAllowMessages(data.allow_messages !== false);
    } catch (error) {
      console.error('Error fetching user:', error);
      setUserData(user);
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || '',
        tahsil: user.tahsil || '',
        district: user.district || '',
        state: user.state || '',
        pincode: user.pincode || '',
        birthday: user.birthday || ''
      });
    } finally {
      setLoading(false);
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
      
      await axios.put(`${API}/api/user/${user.uid}/profile`, profileData);
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
      await axios.post(`${API}/api/user/${user.uid}/change-password`, {
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

  const handlePrivacyToggle = async (field, value) => {
    setSavingPrivacy(true);
    try {
      await axios.put(`${API}/api/users/${user.uid}/privacy-settings`, {
        [field]: value
      });
      
      if (field === 'is_public') {
        setIsProfilePublic(value);
        toast.success(value ? 'Profile is now public' : 'Profile is now private');
      } else if (field === 'allow_messages') {
        setAllowMessages(value);
        toast.success(value ? 'Messages enabled' : 'Messages disabled');
      }
    } catch (error) {
      toast.error('Failed to update privacy settings');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error('Please enter your password');
      return;
    }
    
    setDeleting(true);
    try {
      await axios.post(`${API}/api/user/${user.uid}/request-account-deletion`, {
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
      
      await axios.post(`${API}/api/user/${user.uid}/upload-profile-picture`, formData, {
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
      
      await axios.post(`${API}/api/user/${user.uid}/upload-profile-picture`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Profile picture updated!');
      fetchUserData();
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
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
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
                {userData?.profile_picture ? (
                  <img src={userData.profile_picture} alt="" className="w-full h-full object-cover" />
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

      {/* Quick Stats */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{(userData?.prc_balance || 0).toFixed(0)}</p>
            <p className="text-gray-500 text-xs">PRC</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{userData?.referral_count || 0}</p>
            <p className="text-gray-500 text-xs">Friends</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{(userData?.total_mined || 0).toFixed(0)}</p>
            <p className="text-gray-500 text-xs">Earned</p>
          </div>
        </div>
      </div>

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
        {/* Subscription Upgrade */}
        {!hasPaidPlan && (
          <button 
            onClick={() => navigate('/subscription')}
            className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 rounded-2xl p-4 flex items-center justify-between"
          >
            <span className="flex items-center gap-3 text-black font-semibold">
              <Crown className="w-5 h-5" />
              Upgrade Your Plan
            </span>
            <ChevronRight className="w-5 h-5 text-black" />
          </button>
        )}

        {/* Share App Card */}
        <ShareApp user={userData || user} variant="card" />

        {/* KYC */}
        <button 
          onClick={() => navigate('/kyc')}
          className="w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex items-center justify-between"
        >
          <span className="flex items-center gap-3 text-white">
            <FileText className="w-5 h-5 text-blue-500" />
            {t.kycVerification}
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

        {/* Privacy Settings */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-cyan-500" />
            <span className="text-white font-medium">Privacy Settings</span>
          </div>
          
          {/* Public Profile Toggle */}
          <div className="flex items-center justify-between py-3 border-b border-gray-800">
            <div>
              <p className="text-white text-sm">Public Profile</p>
              <p className="text-gray-500 text-xs">Others can see your profile and activity</p>
            </div>
            <button
              onClick={() => handlePrivacyToggle('is_public', !isProfilePublic)}
              disabled={savingPrivacy}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isProfilePublic ? 'bg-purple-500' : 'bg-gray-700'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                isProfilePublic ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>
          
          {/* Allow Messages Toggle */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-white text-sm">Allow Messages</p>
              <p className="text-gray-500 text-xs">Others can send you direct messages</p>
            </div>
            <button
              onClick={() => handlePrivacyToggle('allow_messages', !allowMessages)}
              disabled={savingPrivacy}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                allowMessages ? 'bg-purple-500' : 'bg-gray-700'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                allowMessages ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>
        </div>

        {/* Change Password */}
        <button 
          onClick={() => setShowPasswordSection(!showPasswordSection)}
          className="w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex items-center justify-between"
        >
          <span className="flex items-center gap-3 text-white">
            <Lock className="w-5 h-5 text-purple-500" />
            {t.changePassword}
          </span>
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>

        {showPasswordSection && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Current Password</label>
              <div className="relative">
                <Input 
                  type={showPassword ? 'text' : 'password'}
                  value={passwordData.current}
                  onChange={(e) => setPasswordData({...passwordData, current: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white pr-10"
                />
                <button 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">New Password</label>
              <Input 
                type="password"
                value={passwordData.new}
                onChange={(e) => setPasswordData({...passwordData, new: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Confirm Password</label>
              <Input 
                type="password"
                value={passwordData.confirm}
                onChange={(e) => setPasswordData({...passwordData, confirm: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <Button 
              onClick={handleChangePassword}
              disabled={saving}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {saving ? 'Changing...' : 'Change Password'}
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
