import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  User, Lock, MapPin, CreditCard, Shield, Eye, EyeOff, Camera, 
  Upload, Save, X, Check, AlertCircle, Phone, Mail, Home, 
  Building, Key, Fingerprint, Smartphone, FileText, Calendar,
  ChevronRight, CheckCircle, Edit2, Trash2, RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ImageCropUpload from '@/components/ImageCropUpload';
import { locationData } from '@/data/locationData';

const API = process.env.REACT_APP_BACKEND_URL || '';

const ProfileAdvanced = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [activeSection, setActiveSection] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [showPasswordCurrent, setShowPasswordCurrent] = useState(false);
  const [showPasswordNew, setShowPasswordNew] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  
  // Profile Picture State
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture || null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(user?.profile_picture || null);
  
  // Personal Information State
  const [personalInfo, setPersonalInfo] = useState({
    first_name: user?.first_name || '',
    middle_name: user?.middle_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    mobile: user?.mobile || '',
    gender: user?.gender || '',
    date_of_birth: user?.date_of_birth || '',
    bio: user?.bio || ''
  });
  
  // Contact Details State
  const [contactDetails, setContactDetails] = useState({
    address_line1: user?.address_line1 || '',
    address_line2: user?.address_line2 || '',
    city: user?.city || '',
    state: user?.state || '',
    district: user?.district || '',
    tahsil: user?.tahsil || '',
    pincode: user?.pincode || '',
    alternate_mobile: user?.alternate_mobile || '',
    emergency_contact_name: user?.emergency_contact_name || '',
    emergency_contact_number: user?.emergency_contact_number || ''
  });
  
  // Bank Details State
  const [bankDetails, setBankDetails] = useState({
    bank_account_holder_name: user?.bank_account_holder_name || '',
    bank_account_number: user?.bank_account_number || '',
    confirm_account_number: '',
    bank_ifsc: user?.bank_ifsc || '',
    bank_name: user?.bank_name || '',
    bank_branch: user?.bank_branch || '',
    bank_account_type: user?.bank_account_type || 'savings',
    upi_id: user?.upi_id || '',
    phonepe_number: user?.phonepe_number || '',
    gpay_number: user?.gpay_number || '',
    paytm_number: user?.paytm_number || ''
  });
  
  // Security Options State
  const [securityOptions, setSecurityOptions] = useState({
    two_factor_enabled: user?.two_factor_enabled || false,
    email_notifications: user?.email_notifications || true,
    sms_notifications: user?.sms_notifications || true,
    login_alerts: user?.login_alerts || true,
    transaction_alerts: user?.transaction_alerts || true
  });
  
  // Advanced Password State
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    message: '',
    color: 'gray'
  });
  
  // Validation Errors
  const [errors, setErrors] = useState({});
  
  // Location cascade state
  const [availableStates, setAvailableStates] = useState([]);
  const [availableDistricts, setAvailableDistricts] = useState([]);
  const [availableTahsils, setAvailableTahsils] = useState([]);
  const [availablePincodes, setAvailablePincodes] = useState([]);
  
  // Check authentication
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);
  
  // Fetch user profile data
  useEffect(() => {
    if (user?.uid) {
      fetchUserProfile();
    }
  }, [user]);
  
  // Initialize states list
  useEffect(() => {
    const states = Object.keys(locationData).sort();
    setAvailableStates(states);
  }, []);
  
  // Handle state change - populate districts
  useEffect(() => {
    if (contactDetails.state && locationData[contactDetails.state]) {
      const districts = Object.keys(locationData[contactDetails.state].districts).sort();
      setAvailableDistricts(districts);
    } else {
      setAvailableDistricts([]);
      setAvailableTahsils([]);
      setAvailablePincodes([]);
    }
  }, [contactDetails.state]);
  
  // Handle district change - populate tahsils
  useEffect(() => {
    if (contactDetails.state && contactDetails.district && 
        locationData[contactDetails.state]?.districts[contactDetails.district]) {
      const tahsils = Object.keys(locationData[contactDetails.state].districts[contactDetails.district].tahsils).sort();
      setAvailableTahsils(tahsils);
    } else {
      setAvailableTahsils([]);
      setAvailablePincodes([]);
    }
  }, [contactDetails.state, contactDetails.district]);
  
  // Handle tahsil change - populate pincodes
  useEffect(() => {
    if (contactDetails.state && contactDetails.district && contactDetails.tahsil &&
        locationData[contactDetails.state]?.districts[contactDetails.district]?.tahsils[contactDetails.tahsil]) {
      const pincodes = locationData[contactDetails.state].districts[contactDetails.district].tahsils[contactDetails.tahsil].pins || [];
      setAvailablePincodes(pincodes);
    } else {
      setAvailablePincodes([]);
    }
  }, [contactDetails.state, contactDetails.district, contactDetails.tahsil]);
  
  const fetchUserProfile = async () => {
    try {
      const response = await axios.get(`${API}/api/users/${user.uid}`);
      const userData = response.data;
      
      // Update all states with fetched data
      setPersonalInfo({
        first_name: userData.first_name || '',
        middle_name: userData.middle_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        mobile: userData.mobile || '',
        gender: userData.gender || '',
        date_of_birth: userData.date_of_birth || '',
        bio: userData.bio || ''
      });
      
      setContactDetails({
        address_line1: userData.address_line1 || '',
        address_line2: userData.address_line2 || '',
        city: userData.city || '',
        state: userData.state || '',
        district: userData.district || '',
        tahsil: userData.tahsil || '',
        pincode: userData.pincode || '',
        alternate_mobile: userData.alternate_mobile || '',
        emergency_contact_name: userData.emergency_contact_name || '',
        emergency_contact_number: userData.emergency_contact_number || ''
      });
      
      setBankDetails({
        bank_account_holder_name: userData.bank_account_holder_name || '',
        bank_account_number: userData.bank_account_number || '',
        confirm_account_number: '',
        bank_ifsc: userData.bank_ifsc || '',
        bank_name: userData.bank_name || '',
        bank_branch: userData.bank_branch || '',
        bank_account_type: userData.bank_account_type || 'savings',
        upi_id: userData.upi_id || '',
        phonepe_number: userData.phonepe_number || '',
        gpay_number: userData.gpay_number || '',
        paytm_number: userData.paytm_number || ''
      });
      
      setSecurityOptions({
        two_factor_enabled: userData.two_factor_enabled || false,
        email_notifications: userData.email_notifications !== false,
        sms_notifications: userData.sms_notifications !== false,
        login_alerts: userData.login_alerts !== false,
        transaction_alerts: userData.transaction_alerts !== false
      });
      
      setProfilePicture(userData.profile_picture || null);
      setProfilePicturePreview(userData.profile_picture || null);
      
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile data');
    }
  };
  
  // Validation Functions
  const validatePersonalInfo = () => {
    const newErrors = {};
    
    if (!personalInfo.first_name?.trim()) {
      newErrors.first_name = 'First name is required';
    }
    
    if (!personalInfo.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(personalInfo.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!personalInfo.mobile?.trim()) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(personalInfo.mobile)) {
      newErrors.mobile = 'Invalid mobile number (must be 10 digits starting with 6-9)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const validateBankDetails = () => {
    const newErrors = {};
    
    if (bankDetails.bank_account_number && !bankDetails.confirm_account_number) {
      newErrors.confirm_account_number = 'Please confirm account number';
    } else if (bankDetails.bank_account_number !== bankDetails.confirm_account_number) {
      newErrors.confirm_account_number = 'Account numbers do not match';
    }
    
    if (bankDetails.bank_ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.bank_ifsc)) {
      newErrors.bank_ifsc = 'Invalid IFSC code format';
    }
    
    if (bankDetails.upi_id && !/^[\w.-]+@[\w.-]+$/.test(bankDetails.upi_id)) {
      newErrors.upi_id = 'Invalid UPI ID format';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const validatePassword = () => {
    const newErrors = {};
    
    if (!passwordData.current_password) {
      newErrors.current_password = 'Current password is required';
    }
    
    if (!passwordData.new_password) {
      newErrors.new_password = 'New password is required';
    } else if (passwordData.new_password.length < 8) {
      newErrors.new_password = 'Password must be at least 8 characters';
    }
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Calculate password strength
  const calculatePasswordStrength = (password) => {
    let score = 0;
    if (!password) {
      setPasswordStrength({ score: 0, message: '', color: 'gray' });
      return;
    }
    
    // Length
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    
    // Complexity
    if (/[a-z]/.test(password)) score += 15; // Lowercase
    if (/[A-Z]/.test(password)) score += 15; // Uppercase
    if (/\d/.test(password)) score += 15; // Numbers
    if (/[^a-zA-Z0-9]/.test(password)) score += 15; // Special chars
    
    let message = '';
    let color = 'gray';
    
    if (score < 40) {
      message = 'Weak';
      color = 'red';
    } else if (score < 60) {
      message = 'Fair';
      color = 'orange';
    } else if (score < 80) {
      message = 'Good';
      color = 'yellow';
    } else {
      message = 'Strong';
      color = 'green';
    }
    
    setPasswordStrength({ score, message, color });
  };
  
  useEffect(() => {
    calculatePasswordStrength(passwordData.new_password);
  }, [passwordData.new_password]);
  
  // Handle Profile Picture Upload
  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result);
        setProfilePicture(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleProfilePictureCrop = (croppedImage) => {
    setProfilePicture(croppedImage);
    setProfilePicturePreview(croppedImage);
    setShowImageUpload(false);
    toast.success('Profile picture updated! Click Save to apply changes.');
  };
  
  const removeProfilePicture = () => {
    setProfilePicture(null);
    setProfilePicturePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Save Handlers
  const handleSaveProfilePicture = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/api/users/${user.uid}/profile`, {
        profile_picture: profilePicture
      });
      toast.success('Profile picture updated successfully!');
    } catch (error) {
      console.error('Error updating profile picture:', error);
      toast.error(error.response?.data?.detail || 'Failed to update profile picture');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSavePersonalInfo = async () => {
    if (!validatePersonalInfo()) {
      toast.error('Please fix validation errors');
      return;
    }
    
    setLoading(true);
    try {
      await axios.put(`${API}/api/users/${user.uid}/profile`, personalInfo);
      toast.success('Personal information updated successfully!');
      setErrors({});
    } catch (error) {
      console.error('Error updating personal info:', error);
      toast.error(error.response?.data?.detail || 'Failed to update personal information');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveContactDetails = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/api/user/${user.uid}/profile`, contactDetails);
      toast.success('Contact details updated successfully!');
      setErrors({});
    } catch (error) {
      console.error('Error updating contact details:', error);
      toast.error(error.response?.data?.detail || 'Failed to update contact details');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveBankDetails = async () => {
    if (!validateBankDetails()) {
      toast.error('Please fix validation errors');
      return;
    }
    
    setLoading(true);
    try {
      const { confirm_account_number, ...bankData } = bankDetails;
      await axios.put(`${API}/api/user/${user.uid}/profile`, bankData);
      toast.success('Bank details updated successfully!');
      setErrors({});
    } catch (error) {
      console.error('Error updating bank details:', error);
      toast.error(error.response?.data?.detail || 'Failed to update bank details');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveSecurityOptions = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/api/user/${user.uid}/profile`, securityOptions);
      toast.success('Security options updated successfully!');
    } catch (error) {
      console.error('Error updating security options:', error);
      toast.error(error.response?.data?.detail || 'Failed to update security options');
    } finally {
      setLoading(false);
    }
  };
  
  const handleChangePassword = async () => {
    if (!validatePassword()) {
      toast.error('Please fix validation errors');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/api/user/${user.uid}/change-password`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      toast.success('Password changed successfully!');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setErrors({});
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };
  
  // Navigation items
  const sections = [
    { id: 'profile', label: 'Profile Image', icon: Camera, color: 'purple' },
    { id: 'personal', label: 'Personal Information', icon: User, color: 'blue' },
    { id: 'contact', label: 'Contact Details', icon: MapPin, color: 'green' },
    { id: 'bank', label: 'Bank Details', icon: CreditCard, color: 'yellow' },
    { id: 'security', label: 'Security Options', icon: Shield, color: 'red' },
    { id: 'password', label: 'Change Password', icon: Lock, color: 'indigo' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Profile Management</h1>
              <p className="text-sm text-gray-600 mt-1">Manage your account settings and preferences</p>
            </div>
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              className="hidden sm:flex"
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card className="p-4 sticky top-24">
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      activeSection === section.id
                        ? `bg-${section.color}-100 text-${section.color}-700 font-semibold shadow-sm`
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <section.icon className="w-5 h-5" />
                    <span className="text-sm">{section.label}</span>
                    <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${
                      activeSection === section.id ? 'rotate-90' : ''
                    }`} />
                  </button>
                ))}
              </nav>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            
            {/* 1. PROFILE IMAGE SECTION */}
            {activeSection === 'profile' && (
              <Card className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Camera className="w-6 h-6 text-purple-600" />
                      Profile Picture
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">Upload and manage your profile picture</p>
                  </div>
                </div>

                <div className="flex flex-col items-center space-y-6">
                  {/* Profile Picture Preview */}
                  <div className="relative">
                    <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-purple-200 shadow-xl bg-gradient-to-br from-purple-100 to-blue-100">
                      {profilePicturePreview ? (
                        <img
                          src={profilePicturePreview}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-20 h-20 text-gray-400" />
                        </div>
                      )}
                    </div>
                    {profilePicturePreview && (
                      <button
                        onClick={removeProfilePicture}
                        className="absolute top-0 right-0 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Upload Buttons */}
                  <div className="flex flex-wrap gap-3 justify-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Choose Image
                    </Button>
                    <Button
                      onClick={() => setShowImageUpload(true)}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      Take Photo
                    </Button>
                  </div>

                  {/* Guidelines */}
                  <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">Image Guidelines:</h3>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• Maximum file size: 5MB</li>
                      <li>• Supported formats: JPG, PNG, GIF</li>
                      <li>• Recommended: Square image (1:1 ratio)</li>
                      <li>• Clear face photo for better recognition</li>
                    </ul>
                  </div>

                  <Button
                    onClick={handleSaveProfilePicture}
                    disabled={loading || !profilePicture}
                    className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Profile Picture
                  </Button>
                </div>

                {/* Image Crop Upload Modal */}
                {showImageUpload && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Upload Profile Picture</h3>
                        <button
                          onClick={() => setShowImageUpload(false)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <ImageCropUpload
                        onImageCropped={handleProfilePictureCrop}
                        aspectRatio={1}
                        circularCrop={true}
                      />
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* 2. PERSONAL INFORMATION SECTION */}
            {activeSection === 'personal' && (
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <User className="w-6 h-6 text-blue-600" />
                    Personal Information
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Update your personal details</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* First Name */}
                  <div>
                    <Label htmlFor="first_name" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      First Name *
                    </Label>
                    <Input
                      id="first_name"
                      value={personalInfo.first_name}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, first_name: e.target.value })}
                      placeholder="Enter first name"
                      className={errors.first_name ? 'border-red-500' : ''}
                    />
                    {errors.first_name && (
                      <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>
                    )}
                  </div>

                  {/* Middle Name */}
                  <div>
                    <Label htmlFor="middle_name">Middle Name</Label>
                    <Input
                      id="middle_name"
                      value={personalInfo.middle_name}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, middle_name: e.target.value })}
                      placeholder="Enter middle name (optional)"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={personalInfo.last_name}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, last_name: e.target.value })}
                      placeholder="Enter last name"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={personalInfo.email}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                      placeholder="your.email@example.com"
                      className={errors.email ? 'border-red-500' : ''}
                      disabled
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  {/* Mobile */}
                  <div>
                    <Label htmlFor="mobile" className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Mobile Number *
                    </Label>
                    <Input
                      id="mobile"
                      value={personalInfo.mobile}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, mobile: e.target.value })}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      className={errors.mobile ? 'border-red-500' : ''}
                    />
                    {errors.mobile && (
                      <p className="text-xs text-red-500 mt-1">{errors.mobile}</p>
                    )}
                  </div>

                  {/* Gender */}
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <select
                      id="gender"
                      value={personalInfo.gender}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, gender: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <Label htmlFor="date_of_birth" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Date of Birth
                    </Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={personalInfo.date_of_birth}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, date_of_birth: e.target.value })}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  {/* Bio */}
                  <div className="md:col-span-2">
                    <Label htmlFor="bio">Bio / About Me</Label>
                    <textarea
                      id="bio"
                      value={personalInfo.bio}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, bio: e.target.value })}
                      placeholder="Tell us about yourself..."
                      rows={4}
                      maxLength={500}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {personalInfo.bio?.length || 0}/500 characters
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleSavePersonalInfo}
                  disabled={loading}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Personal Information
                </Button>
              </Card>
            )}

            {/* 3. CONTACT DETAILS SECTION */}
            {activeSection === 'contact' && (
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-green-600" />
                    Contact Details
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Manage your address and emergency contacts</p>
                </div>

                <div className="space-y-6">
                  {/* Address Section */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Home className="w-5 h-5" />
                      Residential Address
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="address_line1">Address Line 1</Label>
                        <Input
                          id="address_line1"
                          value={contactDetails.address_line1}
                          onChange={(e) => setContactDetails({ ...contactDetails, address_line1: e.target.value })}
                          placeholder="House/Flat number, Building name"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="address_line2">Address Line 2</Label>
                        <Input
                          id="address_line2"
                          value={contactDetails.address_line2}
                          onChange={(e) => setContactDetails({ ...contactDetails, address_line2: e.target.value })}
                          placeholder="Street, Area, Landmark"
                        />
                      </div>

                      <div>
                        <Label htmlFor="state">State *</Label>
                        <select
                          id="state"
                          value={contactDetails.state}
                          onChange={(e) => {
                            setContactDetails({ 
                              ...contactDetails, 
                              state: e.target.value,
                              district: '',
                              tahsil: '',
                              pincode: ''
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">Select State</option>
                          {availableStates.map(state => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="district">District *</Label>
                        <select
                          id="district"
                          value={contactDetails.district}
                          onChange={(e) => {
                            setContactDetails({ 
                              ...contactDetails, 
                              district: e.target.value,
                              tahsil: '',
                              pincode: ''
                            });
                          }}
                          disabled={!contactDetails.state}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Select District</option>
                          {availableDistricts.map(district => (
                            <option key={district} value={district}>{district}</option>
                          ))}
                        </select>
                        {!contactDetails.state && (
                          <p className="text-xs text-gray-500 mt-1">Please select a state first</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="tahsil">Tahsil / Taluka</Label>
                        <select
                          id="tahsil"
                          value={contactDetails.tahsil}
                          onChange={(e) => {
                            setContactDetails({ 
                              ...contactDetails, 
                              tahsil: e.target.value,
                              pincode: ''
                            });
                          }}
                          disabled={!contactDetails.district}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Select Tahsil</option>
                          {availableTahsils.map(tahsil => (
                            <option key={tahsil} value={tahsil}>{tahsil}</option>
                          ))}
                        </select>
                        {!contactDetails.district && (
                          <p className="text-xs text-gray-500 mt-1">Please select a district first</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="city">City / Town</Label>
                        <Input
                          id="city"
                          value={contactDetails.city}
                          onChange={(e) => setContactDetails({ ...contactDetails, city: e.target.value })}
                          placeholder="Enter city or town name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="pincode">PIN Code</Label>
                        <select
                          id="pincode"
                          value={contactDetails.pincode}
                          onChange={(e) => setContactDetails({ ...contactDetails, pincode: e.target.value })}
                          disabled={!contactDetails.tahsil}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Select PIN Code</option>
                          {availablePincodes.map(pin => (
                            <option key={pin} value={pin}>{pin}</option>
                          ))}
                        </select>
                        {!contactDetails.tahsil && (
                          <p className="text-xs text-gray-500 mt-1">Please select a tahsil first</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Numbers Section */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Phone className="w-5 h-5" />
                      Additional Contact
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="alternate_mobile">Alternate Mobile Number</Label>
                        <Input
                          id="alternate_mobile"
                          value={contactDetails.alternate_mobile}
                          onChange={(e) => setContactDetails({ ...contactDetails, alternate_mobile: e.target.value })}
                          placeholder="10-digit mobile number"
                          maxLength={10}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Emergency Contact Section */}
                  <div className="bg-red-50 rounded-lg p-4 space-y-4 border border-red-200">
                    <h3 className="font-semibold text-red-900 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      Emergency Contact
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                        <Input
                          id="emergency_contact_name"
                          value={contactDetails.emergency_contact_name}
                          onChange={(e) => setContactDetails({ ...contactDetails, emergency_contact_name: e.target.value })}
                          placeholder="Full name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="emergency_contact_number">Emergency Contact Number</Label>
                        <Input
                          id="emergency_contact_number"
                          value={contactDetails.emergency_contact_number}
                          onChange={(e) => setContactDetails({ ...contactDetails, emergency_contact_number: e.target.value })}
                          placeholder="10-digit mobile number"
                          maxLength={10}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSaveContactDetails}
                  disabled={loading}
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Contact Details
                </Button>
              </Card>
            )}

            {/* 4. BANK DETAILS SECTION */}
            {activeSection === 'bank' && (
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-yellow-600" />
                    Bank & Payment Details
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Manage your banking and payment information</p>
                </div>

                <div className="space-y-6">
                  {/* Bank Account Section */}
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 space-y-4 border border-yellow-200">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Building className="w-5 h-5" />
                      Bank Account Details
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="bank_account_holder_name">Account Holder Name *</Label>
                        <Input
                          id="bank_account_holder_name"
                          value={bankDetails.bank_account_holder_name}
                          onChange={(e) => setBankDetails({ ...bankDetails, bank_account_holder_name: e.target.value })}
                          placeholder="As per bank records"
                        />
                      </div>

                      <div>
                        <Label htmlFor="bank_account_number">Account Number *</Label>
                        <Input
                          id="bank_account_number"
                          value={bankDetails.bank_account_number}
                          onChange={(e) => setBankDetails({ ...bankDetails, bank_account_number: e.target.value })}
                          placeholder="Enter account number"
                          type="password"
                        />
                      </div>

                      <div>
                        <Label htmlFor="confirm_account_number">Confirm Account Number *</Label>
                        <Input
                          id="confirm_account_number"
                          value={bankDetails.confirm_account_number}
                          onChange={(e) => setBankDetails({ ...bankDetails, confirm_account_number: e.target.value })}
                          placeholder="Re-enter account number"
                          className={errors.confirm_account_number ? 'border-red-500' : ''}
                        />
                        {errors.confirm_account_number && (
                          <p className="text-xs text-red-500 mt-1">{errors.confirm_account_number}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="bank_ifsc">IFSC Code *</Label>
                        <Input
                          id="bank_ifsc"
                          value={bankDetails.bank_ifsc}
                          onChange={(e) => setBankDetails({ ...bankDetails, bank_ifsc: e.target.value.toUpperCase() })}
                          placeholder="e.g., SBIN0001234"
                          maxLength={11}
                          className={errors.bank_ifsc ? 'border-red-500' : ''}
                        />
                        {errors.bank_ifsc && (
                          <p className="text-xs text-red-500 mt-1">{errors.bank_ifsc}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="bank_account_type">Account Type</Label>
                        <select
                          id="bank_account_type"
                          value={bankDetails.bank_account_type}
                          onChange={(e) => setBankDetails({ ...bankDetails, bank_account_type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        >
                          <option value="savings">Savings Account</option>
                          <option value="current">Current Account</option>
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="bank_name">Bank Name</Label>
                        <Input
                          id="bank_name"
                          value={bankDetails.bank_name}
                          onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                          placeholder="e.g., State Bank of India"
                        />
                      </div>

                      <div>
                        <Label htmlFor="bank_branch">Branch Name</Label>
                        <Input
                          id="bank_branch"
                          value={bankDetails.bank_branch}
                          onChange={(e) => setBankDetails({ ...bankDetails, bank_branch: e.target.value })}
                          placeholder="e.g., Mumbai Main Branch"
                        />
                      </div>
                    </div>
                  </div>

                  {/* UPI & Digital Payment Section */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 space-y-4 border border-purple-200">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Smartphone className="w-5 h-5" />
                      Digital Payment IDs
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="upi_id">UPI ID</Label>
                        <Input
                          id="upi_id"
                          value={bankDetails.upi_id}
                          onChange={(e) => setBankDetails({ ...bankDetails, upi_id: e.target.value })}
                          placeholder="username@upi"
                          className={errors.upi_id ? 'border-red-500' : ''}
                        />
                        {errors.upi_id && (
                          <p className="text-xs text-red-500 mt-1">{errors.upi_id}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="phonepe_number">PhonePe Number</Label>
                        <Input
                          id="phonepe_number"
                          value={bankDetails.phonepe_number}
                          onChange={(e) => setBankDetails({ ...bankDetails, phonepe_number: e.target.value })}
                          placeholder="10-digit mobile number"
                          maxLength={10}
                        />
                      </div>

                      <div>
                        <Label htmlFor="gpay_number">Google Pay Number</Label>
                        <Input
                          id="gpay_number"
                          value={bankDetails.gpay_number}
                          onChange={(e) => setBankDetails({ ...bankDetails, gpay_number: e.target.value })}
                          placeholder="10-digit mobile number"
                          maxLength={10}
                        />
                      </div>

                      <div>
                        <Label htmlFor="paytm_number">Paytm Number</Label>
                        <Input
                          id="paytm_number"
                          value={bankDetails.paytm_number}
                          onChange={(e) => setBankDetails({ ...bankDetails, paytm_number: e.target.value })}
                          placeholder="10-digit mobile number"
                          maxLength={10}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Security Notice
                    </h3>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• Your bank details are encrypted and stored securely</li>
                      <li>• Never share your account credentials with anyone</li>
                      <li>• Double-check all details before saving</li>
                      <li>• These details will be used for withdrawal processing</li>
                    </ul>
                  </div>
                </div>

                <Button
                  onClick={handleSaveBankDetails}
                  disabled={loading}
                  className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Bank Details
                </Button>
              </Card>
            )}

            {/* 5. SECURITY OPTIONS SECTION */}
            {activeSection === 'security' && (
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-red-600" />
                    Security Options
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Manage your account security and notification preferences</p>
                </div>

                <div className="space-y-4">
                  {/* Two-Factor Authentication */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <Fingerprint className="w-6 h-6 text-red-600 mt-1" />
                      <div>
                        <h3 className="font-semibold text-gray-900">Two-Factor Authentication</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityOptions.two_factor_enabled}
                        onChange={(e) => setSecurityOptions({ ...securityOptions, two_factor_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  </div>

                  {/* Email Notifications */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <Mail className="w-6 h-6 text-blue-600 mt-1" />
                      <div>
                        <h3 className="font-semibold text-gray-900">Email Notifications</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Receive updates and alerts via email
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityOptions.email_notifications}
                        onChange={(e) => setSecurityOptions({ ...securityOptions, email_notifications: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* SMS Notifications */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <Smartphone className="w-6 h-6 text-green-600 mt-1" />
                      <div>
                        <h3 className="font-semibold text-gray-900">SMS Notifications</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Receive updates and alerts via SMS
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityOptions.sms_notifications}
                        onChange={(e) => setSecurityOptions({ ...securityOptions, sms_notifications: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>

                  {/* Login Alerts */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <Key className="w-6 h-6 text-purple-600 mt-1" />
                      <div>
                        <h3 className="font-semibold text-gray-900">Login Alerts</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Get notified when someone logs into your account
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityOptions.login_alerts}
                        onChange={(e) => setSecurityOptions({ ...securityOptions, login_alerts: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* Transaction Alerts */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <CreditCard className="w-6 h-6 text-yellow-600 mt-1" />
                      <div>
                        <h3 className="font-semibold text-gray-900">Transaction Alerts</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Get notified about wallet transactions and withdrawals
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityOptions.transaction_alerts}
                        onChange={(e) => setSecurityOptions({ ...securityOptions, transaction_alerts: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                    </label>
                  </div>
                </div>

                <Button
                  onClick={handleSaveSecurityOptions}
                  disabled={loading}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Security Settings
                </Button>
              </Card>
            )}

            {/* 6. CHANGE PASSWORD SECTION */}
            {activeSection === 'password' && (
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Lock className="w-6 h-6 text-indigo-600" />
                    Change Password
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Update your account password</p>
                </div>

                <div className="space-y-6">
                  {/* Current Password */}
                  <div>
                    <Label htmlFor="current_password" className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Current Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="current_password"
                        type={showPasswordCurrent ? 'text' : 'password'}
                        value={passwordData.current_password}
                        onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                        placeholder="Enter your current password"
                        className={errors.current_password ? 'border-red-500 pr-10' : 'pr-10'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordCurrent(!showPasswordCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPasswordCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.current_password && (
                      <p className="text-xs text-red-500 mt-1">{errors.current_password}</p>
                    )}
                  </div>

                  {/* New Password */}
                  <div>
                    <Label htmlFor="new_password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      New Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="new_password"
                        type={showPasswordNew ? 'text' : 'password'}
                        value={passwordData.new_password}
                        onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                        placeholder="Enter new password"
                        className={errors.new_password ? 'border-red-500 pr-10' : 'pr-10'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordNew(!showPasswordNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPasswordNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.new_password && (
                      <p className="text-xs text-red-500 mt-1">{errors.new_password}</p>
                    )}
                    
                    {/* Password Strength Indicator */}
                    {passwordData.new_password && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600">Password Strength:</span>
                          <span className={`text-xs font-semibold ${
                            passwordStrength.color === 'red' ? 'text-red-600' :
                            passwordStrength.color === 'orange' ? 'text-orange-600' :
                            passwordStrength.color === 'yellow' ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {passwordStrength.message}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              passwordStrength.color === 'red' ? 'bg-red-500' :
                              passwordStrength.color === 'orange' ? 'bg-orange-500' :
                              passwordStrength.color === 'yellow' ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${passwordStrength.score}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <Label htmlFor="confirm_password" className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Confirm New Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm_password"
                        type={showPasswordConfirm ? 'text' : 'password'}
                        value={passwordData.confirm_password}
                        onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                        placeholder="Re-enter new password"
                        className={errors.confirm_password ? 'border-red-500 pr-10' : 'pr-10'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.confirm_password && (
                      <p className="text-xs text-red-500 mt-1">{errors.confirm_password}</p>
                    )}
                  </div>

                  {/* Password Requirements */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">Password Requirements:</h3>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li className="flex items-center gap-2">
                        <Check className={`w-3 h-3 ${passwordData.new_password.length >= 8 ? 'text-green-600' : 'text-gray-400'}`} />
                        At least 8 characters long
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className={`w-3 h-3 ${/[a-z]/.test(passwordData.new_password) ? 'text-green-600' : 'text-gray-400'}`} />
                        Contains lowercase letters (a-z)
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className={`w-3 h-3 ${/[A-Z]/.test(passwordData.new_password) ? 'text-green-600' : 'text-gray-400'}`} />
                        Contains uppercase letters (A-Z)
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className={`w-3 h-3 ${/\d/.test(passwordData.new_password) ? 'text-green-600' : 'text-gray-400'}`} />
                        Contains numbers (0-9)
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className={`w-3 h-3 ${/[^a-zA-Z0-9]/.test(passwordData.new_password) ? 'text-green-600' : 'text-gray-400'}`} />
                        Contains special characters (!@#$%^&*)
                      </li>
                    </ul>
                  </div>
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={loading || !passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4 mr-2" />
                  )}
                  Change Password
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileAdvanced;
