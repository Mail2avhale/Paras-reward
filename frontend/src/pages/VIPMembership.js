import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Crown, CheckCircle, XCircle, Upload, Calendar, Clock, 
  CreditCard, Image, QrCode, Building, AlertCircle, Loader
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VIPMembership = ({ user, onLogout }) => {
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: '1000',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    utr_number: '',
    screenshot_url: ''
  });

  useEffect(() => {
    fetchPaymentConfig();
    fetchPaymentStatus();
  }, []);

  const fetchPaymentConfig = async () => {
    try {
      const response = await axios.get(`${API}/admin/payment-config`);
      setPaymentConfig(response.data);
    } catch (error) {
      console.error('Error fetching payment config:', error);
    }
  };

  const fetchPaymentStatus = async () => {
    try {
      const response = await axios.get(`${API}/membership/payment/${user.uid}`);
      setPaymentStatus(response.data);
    } catch (error) {
      console.error('Error fetching payment status:', error);
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate fields
      if (!formData.utr_number) {
        toast.error('UTR number is required');
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API}/membership/submit-payment`, {
        user_id: user.uid,
        ...formData
      });

      toast.success(response.data.message);
      fetchPaymentStatus();
      
      // Reset form
      setFormData({
        amount: '1000',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        utr_number: '',
        screenshot_url: ''
      });
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit payment');
    } finally {
      setLoading(false);
    }
  };

  const isVIP = user.membership_type === 'vip';
  const hasPendingPayment = paymentStatus?.status === 'pending';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <Crown className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">VIP Membership</h1>
          <p className="text-xl text-gray-600">Unlock unlimited earning potential</p>
        </div>

        {/* Current Status */}
        <Card className={`p-6 mb-8 ${isVIP ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-white'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-2xl font-bold ${isVIP ? 'text-white' : 'text-gray-900'}`}>
                {isVIP ? '👑 VIP Member' : '📦 Free Member'}
              </h3>
              <p className={`${isVIP ? 'text-white/90' : 'text-gray-600'}`}>
                {isVIP 
                  ? `Valid until: ${new Date(user.membership_expiry).toLocaleDateString()}`
                  : 'Upgrade to VIP for unlimited benefits'
                }
              </p>
            </div>
            {isVIP && (
              <Crown className="h-12 w-12 text-white" />
            )}
          </div>
        </Card>

        {/* Benefits Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Free Plan */}
          <Card className="p-6 bg-white">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Free Plan</h3>
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <span className="text-gray-700">Daily mining access</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <span className="text-gray-700">Tap game (100 taps/day)</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <span className="text-gray-700">Referral system</span>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <span className="text-gray-700">Coins expire after 24 hours</span>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <span className="text-gray-700">No marketplace access</span>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <span className="text-gray-700">No withdrawals</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">₹0</div>
          </Card>

          {/* VIP Plan */}
          <Card className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">VIP Plan</h3>
              <Crown className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <span className="text-gray-700 font-medium">All free features</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <span className="text-gray-700 font-medium">Unlimited coin validity</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <span className="text-gray-700 font-medium">Marketplace access</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <span className="text-gray-700 font-medium">Cashback wallet withdrawals</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <span className="text-gray-700 font-medium">Priority support</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <span className="text-gray-700 font-medium">Exclusive rewards</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-900">₹1,000</span>
              <span className="text-gray-600">/year</span>
            </div>
          </Card>
        </div>

        {/* Payment Section */}
        {!isVIP && (
          <Card className="p-8 bg-white">
            {hasPendingPayment ? (
              /* Pending Payment Status */
              <div className="text-center py-12">
                <Loader className="h-16 w-16 text-yellow-500 mx-auto mb-4 animate-spin" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Payment Under Review</h3>
                <p className="text-gray-600 mb-6">
                  Your payment is being verified by our admin team. This usually takes 24-48 hours.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 max-w-md mx-auto">
                  <div className="grid grid-cols-2 gap-4 text-left">
                    <div>
                      <p className="text-sm text-gray-600">Amount</p>
                      <p className="font-bold text-gray-900">₹{paymentStatus.amount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">UTR</p>
                      <p className="font-bold text-gray-900">{paymentStatus.utr_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Date</p>
                      <p className="font-bold text-gray-900">{paymentStatus.date}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                        Pending
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Payment Form */
              <>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Complete VIP Payment</h3>

                {/* Payment Details */}
                {paymentConfig && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Payment Methods */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-gray-900 flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-purple-600" />
                        Payment Options
                      </h4>

                      {paymentConfig.upi_id && (
                        <Card className="p-4 bg-gray-50">
                          <p className="text-sm text-gray-600 mb-1">UPI ID</p>
                          <p className="font-bold text-gray-900">{paymentConfig.upi_id}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => {
                              navigator.clipboard.writeText(paymentConfig.upi_id);
                              toast.success('UPI ID copied!');
                            }}
                          >
                            Copy UPI ID
                          </Button>
                        </Card>
                      )}

                      {paymentConfig.qr_code_url && (
                        <Card className="p-4 bg-gray-50">
                          <p className="text-sm text-gray-600 mb-2">QR Code</p>
                          <img 
                            src={paymentConfig.qr_code_url} 
                            alt="Payment QR" 
                            className="w-48 h-48 object-contain mx-auto border rounded"
                          />
                        </Card>
                      )}

                      {paymentConfig.bank_name && (
                        <Card className="p-4 bg-gray-50">
                          <p className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            Bank Details
                          </p>
                          <div className="space-y-1 text-sm">
                            <p><strong>Bank:</strong> {paymentConfig.bank_name}</p>
                            <p><strong>Account:</strong> {paymentConfig.account_number}</p>
                            <p><strong>IFSC:</strong> {paymentConfig.ifsc_code}</p>
                            <p><strong>Name:</strong> {paymentConfig.account_holder}</p>
                          </div>
                        </Card>
                      )}
                    </div>

                    {/* Upload Form */}
                    <div>
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Upload className="h-5 w-5 text-purple-600" />
                        Upload Payment Proof
                      </h4>

                      <form onSubmit={handleSubmitPayment} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Amount (₹)
                          </label>
                          <Input
                            type="number"
                            value={formData.amount}
                            readOnly
                            className="bg-gray-100"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Payment Date
                            </label>
                            <Input
                              type="date"
                              value={formData.date}
                              onChange={(e) => setFormData({...formData, date: e.target.value})}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Payment Time
                            </label>
                            <Input
                              type="time"
                              value={formData.time}
                              onChange={(e) => setFormData({...formData, time: e.target.value})}
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            UTR / Transaction ID *
                          </label>
                          <Input
                            type="text"
                            placeholder="Enter UTR number"
                            value={formData.utr_number}
                            onChange={(e) => setFormData({...formData, utr_number: e.target.value})}
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <Image className="h-4 w-4" />
                            Screenshot URL (Optional)
                          </label>
                          <Input
                            type="url"
                            placeholder="https://..."
                            value={formData.screenshot_url}
                            onChange={(e) => setFormData({...formData, screenshot_url: e.target.value})}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Upload screenshot to an image hosting service and paste URL
                          </p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <p className="text-sm text-blue-900">
                            <strong>Instructions:</strong><br />
                            {paymentConfig?.instructions || 'Please make payment and upload proof.'}
                          </p>
                        </div>

                        <Button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 text-lg"
                        >
                          {loading ? 'Submitting...' : 'Submit Payment Proof'}
                        </Button>
                      </form>
                    </div>
                  </div>
                )}

                {!paymentConfig && (
                  <div className="text-center py-12">
                    <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Payment configuration not set by admin</p>
                  </div>
                )}
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};
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