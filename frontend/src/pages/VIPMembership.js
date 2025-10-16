import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crown, Calendar, Clock, CreditCard, Upload } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VIPMembership = ({ user, onLogout }) => {
  const [userData, setUserData] = useState(null);
  const [paymentData, setPaymentData] = useState({
    amount: 1000,
    date: '',
    time: '',
    utr_number: '',
    screenshot_base64: ''
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/auth/user/${user.uid}`);
      setUserData(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentData({ ...paymentData, screenshot_base64: reader.result });
        toast.success('Screenshot uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  const submitPayment = async () => {
    if (!paymentData.date || !paymentData.time || !paymentData.utr_number) {
      toast.error('Please fill all payment details');
      return;
    }

    try {
      await axios.post(`${API}/membership/payment/${user.uid}`, paymentData);
      toast.success('Payment submitted for verification!');
      setPaymentData({
        amount: 1000,
        date: '',
        time: '',
        utr_number: '',
        screenshot_base64: ''
      });
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error('Failed to submit payment');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4">
            <Crown className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">VIP Membership</h1>
          <p className="text-lg text-gray-600">Unlock premium features and start redeeming products</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Current Status */}
          <Card data-testid="membership-status" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Current Status</h2>
            
            {userData?.membership_type === 'vip' ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4">
                  <Crown className="h-8 w-8 text-white" />
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-2">VIP Member</p>
                {userData.membership_expiry && (
                  <p className="text-gray-600">
                    Valid until: {new Date(userData.membership_expiry).toLocaleDateString()}
                  </p>
                )}
                <div className="mt-6 p-4 bg-green-50 rounded-xl">
                  <p className="text-green-700 font-semibold">All premium features unlocked!</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-xl font-semibold text-gray-600 mb-6">Free Member</p>
                <div className="space-y-3 text-left">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-red-600 text-sm">✕</span>
                    </div>
                    <span className="text-gray-600">Cannot redeem products</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-red-600 text-sm">✕</span>
                    </div>
                    <span className="text-gray-600">Coins expire in 24 hours</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="font-bold text-gray-900 mb-4">VIP Benefits</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <span className="text-gray-700">Redeem products from marketplace</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <span className="text-gray-700">Lifetime coin validity</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <span className="text-gray-700">25% cashback on redemptions</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <span className="text-gray-700">Wallet withdrawal access</span>
                </li>
              </ul>
            </div>
          </Card>

          {/* Payment Submission */}
          <Card data-testid="payment-form" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Purchase VIP Membership</h2>
            
            <div className="mb-8 p-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl">
              <p className="text-sm opacity-90 mb-1">Membership Fee</p>
              <p className="text-4xl font-bold">₹1,000</p>
              <p className="text-sm opacity-90 mt-1">Valid for 1 year</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    data-testid="payment-date"
                    type="date"
                    value={paymentData.date}
                    onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                    className="pl-10 py-6 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    data-testid="payment-time"
                    type="time"
                    value={paymentData.time}
                    onChange={(e) => setPaymentData({ ...paymentData, time: e.target.value })}
                    className="pl-10 py-6 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">UTR Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    data-testid="utr-input"
                    type="text"
                    placeholder="Enter UTR number"
                    value={paymentData.utr_number}
                    onChange={(e) => setPaymentData({ ...paymentData, utr_number: e.target.value })}
                    className="pl-10 py-6 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Screenshot</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-purple-400 transition-all cursor-pointer">
                  <input
                    data-testid="screenshot-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="screenshot-upload"
                  />
                  <label htmlFor="screenshot-upload" className="cursor-pointer">
                    <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to upload payment screenshot</p>
                    {paymentData.screenshot_base64 && (
                      <p className="text-xs text-green-600 mt-2">Screenshot uploaded ✓</p>
                    )}
                  </label>
                </div>
              </div>

              <Button
                data-testid="submit-payment-btn"
                onClick={submitPayment}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold shadow-lg transition-all"
              >
                Submit for Verification
              </Button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> After submission, admin will verify your payment. You'll receive VIP access once approved.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VIPMembership;