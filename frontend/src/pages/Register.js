import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { UserPlus, Store, Mail, Phone, Lock, MapPin, CreditCard, FileText } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('user');
  
  // User Registration Form
  const [userForm, setUserForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    mobile: '',
    password: '',
    confirm_password: '',
    state: '',
    district: '',
    taluka: '',
    village: '',
    pincode: '',
    aadhaar_number: '',
    pan_number: '',
    upi_id: '',
    referral_code: ''
  });

  // Stockist Registration Form
  const [stockistForm, setStockistForm] = useState({
    business_name: '',
    owner_full_name: '',
    business_type: 'outlet', // master, sub, outlet
    contact_number: '',
    email: '',
    state: '',
    district: '',
    taluka: '',
    village: '',
    pincode: '',
    full_address: '',
    pan_number: '',
    aadhaar_number: '',
    gst_number: '',
    user_email: '' // Link to user account
  });

  const handleUserRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!userForm.first_name || !userForm.last_name || !userForm.email || !userForm.mobile) {
        toast.error('Please fill all required fields');
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API}/auth/register`, userForm);
      
      toast.success('Registration successful! Please login.');
      navigate('/login');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStockistRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // First create user account if user_email provided
      let userId;
      
      if (stockistForm.user_email) {
        // Check if user exists
        try {
          const loginResponse = await axios.post(`${API}/auth/login?email=${stockistForm.user_email}`);
          userId = loginResponse.data.uid;
        } catch (err) {
          toast.error('User account not found. Please create user account first.');
          setLoading(false);
          return;
        }
      } else {
        toast.error('Please provide user email to link stockist account');
        setLoading(false);
        return;
      }

      // Register stockist
      const stockistData = {
        ...stockistForm,
        user_id: userId
      };

      await axios.post(`${API}/v2/stockist/register`, null, {
        params: stockistData
      });
      
      toast.success('Stockist registration submitted for approval!');
      navigate('/login');
    } catch (error) {
      console.error('Stockist registration error:', error);
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-600">Join PARAS REWARD and start earning today</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="user" data-testid="user-tab" className="text-lg py-3">
              <UserPlus className="h-5 w-5 mr-2" />
              User Registration
            </TabsTrigger>
            <TabsTrigger value="stockist" data-testid="stockist-tab" className="text-lg py-3">
              <Store className="h-5 w-5 mr-2" />
              Stockist/Outlet
            </TabsTrigger>
          </TabsList>

          {/* USER REGISTRATION */}
          <TabsContent value="user">
            <form onSubmit={handleUserRegister} className="space-y-6">
              {/* Personal Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <UserPlus className="h-5 w-5 mr-2 text-purple-600" />
                  Personal Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                    <Input
                      data-testid="reg-first-name"
                      placeholder="First name"
                      value={userForm.first_name}
                      onChange={(e) => setUserForm({...userForm, first_name: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Middle Name</label>
                    <Input
                      placeholder="Middle name"
                      value={userForm.middle_name}
                      onChange={(e) => setUserForm({...userForm, middle_name: e.target.value})}
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                    <Input
                      data-testid="reg-last-name"
                      placeholder="Last name"
                      value={userForm.last_name}
                      onChange={(e) => setUserForm({...userForm, last_name: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Phone className="h-5 w-5 mr-2 text-purple-600" />
                  Contact Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <Input
                      data-testid="reg-email"
                      type="email"
                      placeholder="your@email.com"
                      value={userForm.email}
                      onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mobile *</label>
                    <Input
                      data-testid="reg-mobile"
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={userForm.mobile}
                      onChange={(e) => setUserForm({...userForm, mobile: e.target.value})}
                      required
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
                    <Input
                      data-testid="reg-state"
                      placeholder="State"
                      value={userForm.state}
                      onChange={(e) => setUserForm({...userForm, state: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">District *</label>
                    <Input
                      placeholder="District"
                      value={userForm.district}
                      onChange={(e) => setUserForm({...userForm, district: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Taluka</label>
                    <Input
                      placeholder="Taluka"
                      value={userForm.taluka}
                      onChange={(e) => setUserForm({...userForm, taluka: e.target.value})}
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Village</label>
                    <Input
                      placeholder="Village"
                      value={userForm.village}
                      onChange={(e) => setUserForm({...userForm, village: e.target.value})}
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pin Code *</label>
                    <Input
                      data-testid="reg-pincode"
                      placeholder="6-digit pincode"
                      value={userForm.pincode}
                      onChange={(e) => setUserForm({...userForm, pincode: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                </div>
              </div>

              {/* KYC Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-purple-600" />
                  KYC Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Aadhaar Number *</label>
                    <Input
                      data-testid="reg-aadhaar"
                      placeholder="12-digit Aadhaar"
                      value={userForm.aadhaar_number}
                      onChange={(e) => setUserForm({...userForm, aadhaar_number: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">PAN Number *</label>
                    <Input
                      data-testid="reg-pan"
                      placeholder="10-character PAN"
                      value={userForm.pan_number}
                      onChange={(e) => setUserForm({...userForm, pan_number: e.target.value.toUpperCase()})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
                    <Input
                      data-testid="reg-upi"
                      placeholder="yourname@upi"
                      value={userForm.upi_id}
                      onChange={(e) => setUserForm({...userForm, upi_id: e.target.value})}
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Referral Code (Optional)</label>
                    <Input
                      data-testid="reg-referral"
                      placeholder="Enter referral code"
                      value={userForm.referral_code}
                      onChange={(e) => setUserForm({...userForm, referral_code: e.target.value.toUpperCase()})}
                      className="py-5"
                    />
                  </div>
                </div>
              </div>

              <Button
                data-testid="register-user-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold"
              >
                {loading ? 'Registering...' : 'Register as User'}
              </Button>
            </form>
          </TabsContent>

          {/* STOCKIST REGISTRATION */}
          <TabsContent value="stockist">
            <form onSubmit={handleStockistRegister} className="space-y-6">
              {/* Business Type Selection */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Business Type</h3>
                <div className="grid grid-cols-3 gap-4">
                  {['master', 'sub', 'outlet'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      data-testid={`business-type-${type}`}
                      onClick={() => setStockistForm({...stockistForm, business_type: type})}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        stockistForm.business_type === type
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <Store className={`h-8 w-8 mx-auto mb-2 ${stockistForm.business_type === type ? 'text-purple-600' : 'text-gray-400'}`} />
                      <p className={`font-semibold capitalize ${stockistForm.business_type === type ? 'text-purple-600' : 'text-gray-600'}`}>
                        {type === 'master' ? 'Master Stockist' : type === 'sub' ? 'Sub Stockist' : 'Outlet'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Business Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Business Name *</label>
                    <Input
                      data-testid="stockist-business-name"
                      placeholder="Business name"
                      value={stockistForm.business_name}
                      onChange={(e) => setStockistForm({...stockistForm, business_name: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Owner Full Name *</label>
                    <Input
                      placeholder="Owner name"
                      value={stockistForm.owner_full_name}
                      onChange={(e) => setStockistForm({...stockistForm, owner_full_name: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number *</label>
                    <Input
                      data-testid="stockist-contact"
                      type="tel"
                      placeholder="Contact number"
                      value={stockistForm.contact_number}
                      onChange={(e) => setStockistForm({...stockistForm, contact_number: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <Input
                      data-testid="stockist-email"
                      type="email"
                      placeholder="Business email"
                      value={stockistForm.email}
                      onChange={(e) => setStockistForm({...stockistForm, email: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">GST Number</label>
                    <Input
                      placeholder="GST Number (if applicable)"
                      value={stockistForm.gst_number}
                      onChange={(e) => setStockistForm({...stockistForm, gst_number: e.target.value.toUpperCase()})}
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">User Account Email *</label>
                    <Input
                      data-testid="stockist-user-email"
                      type="email"
                      placeholder="Linked user account email"
                      value={stockistForm.user_email}
                      onChange={(e) => setStockistForm({...stockistForm, user_email: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
                    <Input
                      placeholder="State"
                      value={stockistForm.state}
                      onChange={(e) => setStockistForm({...stockistForm, state: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">District *</label>
                    <Input
                      placeholder="District"
                      value={stockistForm.district}
                      onChange={(e) => setStockistForm({...stockistForm, district: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Taluka *</label>
                    <Input
                      placeholder="Taluka"
                      value={stockistForm.taluka}
                      onChange={(e) => setStockistForm({...stockistForm, taluka: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Village *</label>
                    <Input
                      placeholder="Village"
                      value={stockistForm.village}
                      onChange={(e) => setStockistForm({...stockistForm, village: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pin Code *</label>
                    <Input
                      placeholder="Pin code"
                      value={stockistForm.pincode}
                      onChange={(e) => setStockistForm({...stockistForm, pincode: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">PAN Number *</label>
                    <Input
                      placeholder="PAN Number"
                      value={stockistForm.pan_number}
                      onChange={(e) => setStockistForm({...stockistForm, pan_number: e.target.value.toUpperCase()})}
                      required
                      className="py-5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Aadhaar Number *</label>
                    <Input
                      placeholder="Aadhaar Number"
                      value={stockistForm.aadhaar_number}
                      onChange={(e) => setStockistForm({...stockistForm, aadhaar_number: e.target.value})}
                      required
                      className="py-5"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Address *</label>
                  <textarea
                    placeholder="Complete business address"
                    value={stockistForm.full_address}
                    onChange={(e) => setStockistForm({...stockistForm, full_address: e.target.value})}
                    required
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Your registration will be reviewed by our admin team. You'll receive a notification once approved.
                </p>
              </div>

              <Button
                data-testid="register-stockist-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold"
              >
                {loading ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-6">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-purple-600 hover:text-purple-700 font-semibold">
              Login here
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Register;