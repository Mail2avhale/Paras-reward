import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  User, Lock, ArrowLeft, Eye, EyeOff, Camera, 
  Save, Phone, Mail, Crown, ChevronRight, 
  LogOut, Trash2, Settings, CreditCard, Shield, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import ImageCropUpload from '@/components/ImageCropUpload';

const API = process.env.REACT_APP_BACKEND_URL || '';

const ProfileAdvanced = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [editMode, setEditMode] = useState(false);
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
      await axios.put(`${API}/api/user/${user.uid}`, formData);
      toast.success('Profile updated!');
      setEditMode(false);
      fetchUserData();
    } catch (error) {
      toast.error('Failed to update profile');
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
      await axios.put(`${API}/api/user/${user.uid}`, {
        profile_picture: imageData
      });
      toast.success('Profile picture updated!');
      setShowImageUpload(false);
      fetchUserData();
    } catch (error) {
      toast.error('Failed to update picture');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isVip = userData?.membership_type === 'vip';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
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
            <button 
              onClick={() => setShowImageUpload(true)}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center"
            >
              <Camera className="w-4 h-4 text-black" />
            </button>
          </div>

          <h2 className="text-white text-xl font-bold mb-1">
            {userData?.name || user?.email?.split('@')[0] || 'User'}
          </h2>
          <p className="text-gray-400 text-sm mb-3">{userData?.email || user?.email}</p>
          
          {isVip && (
            <div className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-1 rounded-full">
              <Crown className="w-4 h-4 text-black" />
              <span className="text-black font-bold text-sm">VIP Member</span>
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
        {/* VIP Membership */}
        {!isVip && (
          <button 
            onClick={() => navigate('/vip')}
            className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 rounded-2xl p-4 flex items-center justify-between"
          >
            <span className="flex items-center gap-3 text-black font-semibold">
              <Crown className="w-5 h-5" />
              Upgrade to VIP
            </span>
            <ChevronRight className="w-5 h-5 text-black" />
          </button>
        )}

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
