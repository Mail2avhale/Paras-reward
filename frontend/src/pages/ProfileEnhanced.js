import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Lock, MapPin, CreditCard, Save, Camera, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { getStates, getDistricts, getTahsils, getPinCodes } from '@/data/locationData';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProfileEnhanced = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture || null);
  const fileInputRef = useRef(null);
  
  // Location cascade state
  const [availableDistricts, setAvailableDistricts] = useState([]);
  const [availableTahsils, setAvailableTahsils] = useState([]);
  const [availablePins, setAvailablePins] = useState([]);
  
  // Validation errors state
  const [validationErrors, setValidationErrors] = useState({
    mobile: '',
    aadhaar_number: '',
    pan_number: '',
    upi_id: '',
    phonepe_number: '',
    gpay_number: '',
    paytm_number: '',
    bank_account_number: '',
    bank_ifsc: ''
  });
  
  const [profileData, setProfileData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    mobile: '',
    gender: '',
    date_of_birth: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    district: '',
    tahsil: '',
    pincode: '',
    aadhaar_number: '',
    pan_number: '',
    
    // Banking & Payment Details
    bank_account_holder_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_name: '',
    bank_branch: '',
    bank_account_type: '',
    upi_id: '',
    phonepe_number: '',
    gpay_number: '',
    paytm_number: ''
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // Validation patterns
  const validationPatterns = {
    mobile: /^[6-9]\d{9}$/,
    aadhaar: /^\d{12}$/,
    pan: /^[A-Z]{5}\d{4}[A-Z]{1}$/,
    upi: /^[\w.-]+@[\w.-]+$/
  };

  // Validation functions
  const validateMobile = (value) => {
    if (!value) return '';
    if (!/^\d+$/.test(value)) return 'Mobile number must contain only digits';
    if (value.length !== 10) return 'Mobile number must be exactly 10 digits';
    if (!/^[6-9]/.test(value)) return 'Mobile number must start with 6, 7, 8, or 9';
    return '';
  };

  const validateAadhaar = (value) => {
    if (!value) return '';
    if (!/^\d+$/.test(value)) return 'Aadhaar must contain only digits';
    if (value.length !== 12) return 'Aadhaar must be exactly 12 digits';
    return '';
  };

  const validatePAN = (value) => {
    if (!value) return '';
    if (value.length !== 10) return 'PAN must be exactly 10 characters';
    if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(value)) return 'Invalid PAN format (e.g., ABCDE1234F)';
    return '';
  };

  const validateUPI = (value) => {
    if (!value) return '';
    if (!/^[\w.-]+@[\w.-]+$/.test(value)) return 'Invalid UPI format (e.g., name@bank)';
    return '';
  };

  const validatePaymentNumber = (value) => {
    if (!value) return '';
    if (!/^\d+$/.test(value)) return 'Must contain only digits';
    if (value.length !== 10) return 'Must be exactly 10 digits';
    if (!/^[6-9]/.test(value)) return 'Must start with 6, 7, 8, or 9';
    return '';
  };

  const validateBankAccount = (value) => {
    if (!value) return '';
    if (!/^\d+$/.test(value)) return 'Account number must contain only digits';
    if (value.length < 9 || value.length > 18) return 'Account number must be 9-18 digits';
    return '';
  };

  const validateIFSC = (value) => {
    if (!value) return '';
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value)) return 'Invalid IFSC format (e.g., SBIN0001234)';
    return '';
  };

  useEffect(() => {
    if (user) {
      const userData = {
        first_name: user.first_name || '',
        middle_name: user.middle_name || '',
        last_name: user.last_name || '',
        mobile: user.mobile || '',
        gender: user.gender || '',
        date_of_birth: user.date_of_birth || '',
        address_line1: user.address_line1 || '',
        address_line2: user.address_line2 || '',
        city: user.city || '',
        state: user.state || '',
        district: user.district || '',
        tahsil: user.tahsil || '',
        pincode: user.pincode || '',
        aadhaar_number: user.aadhaar_number || '',
        pan_number: user.pan_number || '',
        upi_id: user.upi_id || ''
      };
      
      setProfileData(userData);
      
      // Initialize cascading dropdowns if user has location data
      if (userData.state) {
        const districts = getDistricts(userData.state);
        setAvailableDistricts(districts);
        
        if (userData.district) {
          const tahsils = getTahsils(userData.state, userData.district);
          setAvailableTahsils(tahsils);
          
          if (userData.tahsil) {
            const pins = getPinCodes(userData.state, userData.district, userData.tahsil);
            setAvailablePins(pins);
          }
        }
      }
      
      setProfilePicture(user.profile_picture || null);
    }
  }, [user]);


  // Cascading dropdown handlers
  const handleStateChange = (newState) => {
    setProfileData({
      ...profileData,
      state: newState,
      district: '',
      tahsil: '',
      pincode: ''
    });
    
    // Update available districts
    const districts = getDistricts(newState);
    setAvailableDistricts(districts);
    setAvailableTahsils([]);
    setAvailablePins([]);
  };

  const handleDistrictChange = (newDistrict) => {
    setProfileData({
      ...profileData,
      district: newDistrict,
      tahsil: '',
      pincode: ''
    });
    
    // Update available tahsils
    const tahsils = getTahsils(profileData.state, newDistrict);
    setAvailableTahsils(tahsils);
    setAvailablePins([]);
  };

  const handleTahsilChange = (newTahsil) => {
    setProfileData({
      ...profileData,
      tahsil: newTahsil,
      pincode: ''
    });
    
    // Update available PIN codes
    const pins = getPinCodes(profileData.state, profileData.district, newTahsil);
    setAvailablePins(pins);
  };

  const handlePinChange = (newPin) => {
    setProfileData({
      ...profileData,
      pincode: newPin
    });
  };

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${API}/user/${user.uid}/upload-profile-picture`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success('Profile picture uploaded successfully!');
      
      // Update local state
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result);
        // Update localStorage
        const updatedUser = { ...user, profile_picture: reader.result };
        localStorage.setItem('paras_user', JSON.stringify(updatedUser));
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload profile picture');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfilePicture = async () => {
    setLoading(true);

    try {
      await axios.delete(`${API}/user/${user.uid}/profile-picture`);
      toast.success('Profile picture deleted successfully!');
      
      setProfilePicture(null);
      
      // Update localStorage
      const updatedUser = { ...user, profile_picture: null };
      localStorage.setItem('paras_user', JSON.stringify(updatedUser));
      
    } catch (error) {
      console.error('Error deleting profile picture:', error);
      toast.error('Failed to delete profile picture');
    } finally {
      setLoading(false);
    }
  };

  // Field change handlers with validation
  const handleMobileChange = (value) => {
    // Allow only digits
    const filtered = value.replace(/\D/g, '');
    if (filtered.length <= 10) {
      setProfileData({...profileData, mobile: filtered});
      setValidationErrors({...validationErrors, mobile: validateMobile(filtered)});
    }
  };

  const handleAadhaarChange = (value) => {
    // Allow only digits
    const filtered = value.replace(/\D/g, '');
    if (filtered.length <= 12) {
      setProfileData({...profileData, aadhaar_number: filtered});
      setValidationErrors({...validationErrors, aadhaar_number: validateAadhaar(filtered)});
    }
  };

  const handlePANChange = (value) => {
    // Convert to uppercase and allow only alphanumeric
    const filtered = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (filtered.length <= 10) {
      setProfileData({...profileData, pan_number: filtered});
      setValidationErrors({...validationErrors, pan_number: validatePAN(filtered)});
    }
  };

  const handleUPIChange = (value) => {
    setProfileData({...profileData, upi_id: value});
    setValidationErrors({...validationErrors, upi_id: validateUPI(value)});
  };

  const handlePhonePeChange = (value) => {
    const filtered = value.replace(/\D/g, '');
    if (filtered.length <= 10) {
      setProfileData({...profileData, phonepe_number: filtered});
      setValidationErrors({...validationErrors, phonepe_number: validatePaymentNumber(filtered)});
    }
  };

  const handleGPayChange = (value) => {
    const filtered = value.replace(/\D/g, '');
    if (filtered.length <= 10) {
      setProfileData({...profileData, gpay_number: filtered});
      setValidationErrors({...validationErrors, gpay_number: validatePaymentNumber(filtered)});
    }
  };

  const handlePaytmChange = (value) => {
    const filtered = value.replace(/\D/g, '');
    if (filtered.length <= 10) {
      setProfileData({...profileData, paytm_number: filtered});
      setValidationErrors({...validationErrors, paytm_number: validatePaymentNumber(filtered)});
    }
  };

  const handleBankAccountChange = (value) => {
    const filtered = value.replace(/\D/g, '');
    if (filtered.length <= 18) {
      setProfileData({...profileData, bank_account_number: filtered});
      setValidationErrors({...validationErrors, bank_account_number: validateBankAccount(filtered)});
    }
  };

  const handleIFSCChange = (value) => {
    const filtered = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (filtered.length <= 11) {
      setProfileData({...profileData, bank_ifsc: filtered});
      setValidationErrors({...validationErrors, bank_ifsc: validateIFSC(filtered)});
    }
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    
    // Validate all fields before submission
    const errors = {
      mobile: validateMobile(profileData.mobile),
      aadhaar_number: validateAadhaar(profileData.aadhaar_number),
      pan_number: validatePAN(profileData.pan_number),
      upi_id: validateUPI(profileData.upi_id),
      phonepe_number: validatePaymentNumber(profileData.phonepe_number),
      gpay_number: validatePaymentNumber(profileData.gpay_number),
      paytm_number: validatePaymentNumber(profileData.paytm_number),
      bank_account_number: validateBankAccount(profileData.bank_account_number),
      bank_ifsc: validateIFSC(profileData.bank_ifsc)
    };
    
    setValidationErrors(errors);
    
    // Check if there are any validation errors
    const hasErrors = Object.values(errors).some(error => error !== '');
    if (hasErrors) {
      toast.error('Please fix all validation errors before submitting');
      return;
    }

    // Check if at least one payment method is provided
    const hasUPIDetails = profileData.upi_id || profileData.phonepe_number || profileData.gpay_number || profileData.paytm_number;
    const hasBankDetails = profileData.bank_account_number && profileData.bank_ifsc && profileData.bank_name;
    
    if (!hasUPIDetails && !hasBankDetails) {
      toast.error('Please provide either UPI details OR Bank details for withdrawals');
      return;
    }

    setLoading(true);

    try {
      await axios.put(`${API}/user/${user.uid}/complete-profile`, profileData);
      toast.success('Profile updated successfully!');
      
      // Update localStorage
      const updatedUser = { ...user, ...profileData, profile_complete: true };
      localStorage.setItem('paras_user', JSON.stringify(updatedUser));
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    // Validation
    if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
      toast.error('All fields are required');
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/user/${user.uid}/change-password`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });

      toast.success('Password changed successfully!');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">My Profile</h1>

        {/* Profile Picture Section */}
        <Card className="p-8 mb-8 bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-purple-200">
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                    <User className="h-16 w-16 text-white" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-2 shadow-lg"
              >
                <Camera className="h-5 w-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePictureChange}
                className="hidden"
              />
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {user?.name || 'Complete Your Profile'}
              </h2>
              <p className="text-gray-600 mb-4">{user?.email}</p>
              <div className="flex gap-3 justify-center md:justify-start">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload Photo
                </Button>
                {profilePicture && (
                  <Button
                    onClick={handleDeleteProfilePicture}
                    variant="destructive"
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Profile Tabs */}
        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto">
            <TabsTrigger value="personal">Personal Info</TabsTrigger>
            <TabsTrigger value="contact">Contact & Address</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* Personal Information */}
          <TabsContent value="personal">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <User className="h-6 w-6 text-purple-600" />
                <h3 className="text-2xl font-bold">Personal Information</h3>
              </div>

              <form onSubmit={handleCompleteProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>First Name *</Label>
                    <Input
                      value={profileData.first_name}
                      onChange={(e) => setProfileData({...profileData, first_name: e.target.value})}
                      placeholder="First name"
                      required
                    />
                  </div>
                  <div>
                    <Label>Middle Name</Label>
                    <Input
                      value={profileData.middle_name}
                      onChange={(e) => setProfileData({...profileData, middle_name: e.target.value})}
                      placeholder="Middle name"
                    />
                  </div>
                  <div>
                    <Label>Last Name *</Label>
                    <Input
                      value={profileData.last_name}
                      onChange={(e) => setProfileData({...profileData, last_name: e.target.value})}
                      placeholder="Last name"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Gender</Label>
                    <Select
                      value={profileData.gender}
                      onValueChange={(value) => setProfileData({...profileData, gender: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={profileData.date_of_birth}
                      onChange={(e) => setProfileData({...profileData, date_of_birth: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Aadhaar Number</Label>
                    <Input
                      value={profileData.aadhaar_number}
                      onChange={(e) => handleAadhaarChange(e.target.value)}
                      placeholder="12-digit Aadhaar"
                      maxLength={12}
                      className={validationErrors.aadhaar_number ? 'border-red-500' : ''}
                    />
                    {validationErrors.aadhaar_number && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.aadhaar_number}</p>
                    )}
                  </div>
                  <div>
                    <Label>PAN Number</Label>
                    <Input
                      value={profileData.pan_number}
                      onChange={(e) => handlePANChange(e.target.value)}
                      placeholder="10-character PAN (e.g., ABCDE1234F)"
                      maxLength={10}
                      className={validationErrors.pan_number ? 'border-red-500' : ''}
                    />
                    {validationErrors.pan_number && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.pan_number}</p>
                    )}
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full md:w-auto bg-purple-600 hover:bg-purple-700">
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? 'Saving...' : 'Save Personal Info'}
                </Button>
              </form>
            </Card>
          </TabsContent>

          {/* Contact & Address */}
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
                    onChange={(e) => handleMobileChange(e.target.value)}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    required
                    className={validationErrors.mobile ? 'border-red-500' : ''}
                  />
                  {validationErrors.mobile && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.mobile}</p>
                  )}
                </div>

                <div>
                  <Label>Address Line 1 *</Label>
                  <Input
                    value={profileData.address_line1}
                    onChange={(e) => setProfileData({...profileData, address_line1: e.target.value})}
                    placeholder="House/Flat No, Building Name"
                    required
                  />
                </div>

                <div>
                  <Label>Address Line 2</Label>
                  <Input
                    value={profileData.address_line2}
                    onChange={(e) => setProfileData({...profileData, address_line2: e.target.value})}
                    placeholder="Street, Area, Landmark"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>City *</Label>
                    <Input
                      value={profileData.city}
                      onChange={(e) => setProfileData({...profileData, city: e.target.value})}
                      placeholder="City"
                      required
                    />
                  </div>
                  <div>
                    <Label>State *</Label>
                    <Select 
                      value={profileData.state} 
                      onValueChange={handleStateChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>
                      <SelectContent>
                        {getStates().map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>District *</Label>
                    <Select 
                      value={profileData.district} 
                      onValueChange={handleDistrictChange}
                      disabled={!profileData.state}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={profileData.state ? "Select District" : "Select State First"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDistricts.map(district => (
                          <SelectItem key={district} value={district}>{district}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tahsil *</Label>
                    <Select 
                      value={profileData.tahsil} 
                      onValueChange={handleTahsilChange}
                      disabled={!profileData.district}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={profileData.district ? "Select Tahsil" : "Select District First"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTahsils.map(tahsil => (
                          <SelectItem key={tahsil} value={tahsil}>{tahsil}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>PIN Code *</Label>
                    <Select 
                      value={profileData.pincode} 
                      onValueChange={handlePinChange}
                      disabled={!profileData.tahsil}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={profileData.tahsil ? "Select PIN Code" : "Select Tahsil First"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePins.map(pin => (
                          <SelectItem key={pin} value={pin}>{pin}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>UPI ID</Label>
                    <Input
                      value={profileData.upi_id}
                      onChange={(e) => handleUPIChange(e.target.value)}
                      placeholder="yourname@bank"
                      className={validationErrors.upi_id ? 'border-red-500' : ''}
                    />
                    {validationErrors.upi_id && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.upi_id}</p>
                    )}
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full md:w-auto bg-purple-600 hover:bg-purple-700">
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? 'Saving...' : 'Save Contact Info'}
                </Button>
              </form>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Lock className="h-6 w-6 text-purple-600" />
                <h3 className="text-2xl font-bold">Change Password</h3>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <div>
                  <Label>Current Password</Label>
                  <Input
                    type="password"
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                    placeholder="Enter new password (min 6 characters)"
                  />
                </div>

                <div>
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                    placeholder="Re-enter new password"
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full md:w-auto bg-purple-600 hover:bg-purple-700">
                  <Lock className="mr-2 h-4 w-4" />
                  {loading ? 'Changing...' : 'Change Password'}
                </Button>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProfileEnhanced;
