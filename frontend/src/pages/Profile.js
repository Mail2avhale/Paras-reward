import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Lock, MapPin, CreditCard, Save } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Profile = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    mobile: '',
    state: '',
    district: '',
    taluka: '',
    village: '',
    pincode: '',
    aadhaar_number: '',
    pan_number: '',
    upi_id: ''
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        first_name: user.first_name || '',
        middle_name: user.middle_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        mobile: user.mobile || '',
        state: user.state || '',
        district: user.district || '',
        taluka: user.taluka || '',
        village: user.village || '',
        pincode: user.pincode || '',
        aadhaar_number: user.aadhaar_number || '',
        pan_number: user.pan_number || '',
        upi_id: user.upi_id || ''
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.put(`${API}/user/${user.uid}/profile`, profileData);
      toast.success('Profile updated successfully!');
      
      // Update localStorage
      const updatedUser = { ...user, ...profileData };
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
    setLoading(true);

    try {
      // Validation
      if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
        toast.error('All fields are required');
        setLoading(false);
        return;
      }

      if (passwordData.new_password !== passwordData.confirm_password) {
        toast.error('New passwords do not match');
        setLoading(false);
        return;
      }

      if (passwordData.new_password.length < 6) {
        toast.error('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      await axios.post(`${API}/user/${user.uid}/change-password`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });

      toast.success('Password changed successfully! Please login again.');
      
      // Clear form
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });

      // Logout after 2 seconds
      setTimeout(() => {
        onLogout();
      }, 2000);
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
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">My Profile</h1>

        <Card className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="profile">Profile Information</TabsTrigger>
              <TabsTrigger value="password">Change Password</TabsTrigger>
            </TabsList>

            {/* PROFILE TAB */}
            <TabsContent value="profile">
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                {/* Personal Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <User className="h-5 w-5 mr-2 text-purple-600" />
                    Personal Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                      <Input
                        placeholder="First name"
                        value={profileData.first_name}
                        onChange={(e) => setProfileData({...profileData, first_name: e.target.value})}
                        className="py-5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Middle Name</label>
                      <Input
                        placeholder="Middle name"
                        value={profileData.middle_name}
                        onChange={(e) => setProfileData({...profileData, middle_name: e.target.value})}
                        className="py-5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                      <Input
                        placeholder="Last name"
                        value={profileData.last_name}
                        onChange={(e) => setProfileData({...profileData, last_name: e.target.value})}
                        className="py-5"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={profileData.email}
                        onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                        className="py-5"
                        disabled
                      />
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Mobile</label>
                      <Input
                        type="tel"
                        placeholder="10-digit mobile"
                        value={profileData.mobile}
                        onChange={(e) => setProfileData({...profileData, mobile: e.target.value})}
                        className="py-5"
                      />
                    </div>
                  </div>
                </div>

                {/* Address Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <MapPin className="h-5 w-5 mr-2 text-purple-600" />
                    Address Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                      <Input
                        placeholder="State"
                        value={profileData.state}
                        onChange={(e) => setProfileData({...profileData, state: e.target.value})}
                        className="py-5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">District</label>
                      <Input
                        placeholder="District"
                        value={profileData.district}
                        onChange={(e) => setProfileData({...profileData, district: e.target.value})}
                        className="py-5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Taluka</label>
                      <Input
                        placeholder="Taluka"
                        value={profileData.taluka}
                        onChange={(e) => setProfileData({...profileData, taluka: e.target.value})}
                        className="py-5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Village</label>
                      <Input
                        placeholder="Village"
                        value={profileData.village}
                        onChange={(e) => setProfileData({...profileData, village: e.target.value})}
                        className="py-5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pin Code</label>
                      <Input
                        placeholder="6-digit pincode"
                        value={profileData.pincode}
                        onChange={(e) => setProfileData({...profileData, pincode: e.target.value})}
                        className="py-5"
                      />
                    </div>
                  </div>
                </div>

                {/* KYC & Financial Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <CreditCard className="h-5 w-5 mr-2 text-purple-600" />
                    KYC & Financial Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Aadhaar Number</label>
                      <Input
                        placeholder="12-digit Aadhaar"
                        value={profileData.aadhaar_number}
                        onChange={(e) => setProfileData({...profileData, aadhaar_number: e.target.value})}
                        className="py-5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">PAN Number</label>
                      <Input
                        placeholder="10-character PAN"
                        value={profileData.pan_number}
                        onChange={(e) => setProfileData({...profileData, pan_number: e.target.value.toUpperCase()})}
                        className="py-5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
                      <Input
                        placeholder="yourname@upi"
                        value={profileData.upi_id}
                        onChange={(e) => setProfileData({...profileData, upi_id: e.target.value})}
                        className="py-5"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold"
                >
                  {loading ? 'Updating...' : (
                    <>
                      <Save className="h-5 w-5 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* PASSWORD TAB */}
            <TabsContent value="password">
              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Lock className="h-5 w-5 mr-2 text-purple-600" />
                    Change Password
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                      <Input
                        type="password"
                        placeholder="Enter current password"
                        value={passwordData.current_password}
                        onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                        className="py-5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                      <Input
                        type="password"
                        placeholder="Minimum 6 characters"
                        value={passwordData.new_password}
                        onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                        className="py-5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                      <Input
                        type="password"
                        placeholder="Re-enter new password"
                        value={passwordData.confirm_password}
                        onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                        className="py-5"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> After changing your password, you will be logged out and need to login again with your new password.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold"
                >
                  {loading ? 'Changing Password...' : (
                    <>
                      <Lock className="h-5 w-5 mr-2" />
                      Change Password
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
