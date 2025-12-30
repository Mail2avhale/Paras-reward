import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ImageUpload from '@/components/ImageUpload';
import { 
  Crown, CheckCircle, XCircle, Upload, Calendar, Clock, 
  CreditCard, Image, QrCode, Building, AlertCircle, Loader
} from 'lucide-react';
import { toast } from 'sonner';
import notifications from '@/utils/notifications';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VIPMembership = ({ user, onLogout }) => {
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vipPlans, setVipPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    utr_number: '',
    screenshot_url: '',
    payment_method: 'UPI',
    auto_renew: false
  });

  useEffect(() => {
    fetchVIPPlans();
    fetchPaymentConfig();
    fetchPaymentStatus();
  }, []);

  const fetchVIPPlans = async () => {
    try {
      const response = await axios.get(`${API}/vip/plans`);
      setVipPlans(response.data.plans || []);
      
      // Auto-select monthly plan by default if no plan selected
      if (response.data.plans && response.data.plans.length > 0 && !selectedPlan) {
        const monthlyPlan = response.data.plans.find(p => p.plan_type === 'monthly') || response.data.plans[0];
        setSelectedPlan(monthlyPlan);
        setFormData(prev => ({...prev, amount: monthlyPlan.final_price.toString()}));
      }
    } catch (error) {
      console.error('Error fetching VIP plans:', error);
    }
  };

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

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setFormData(prev => ({
      ...prev,
      amount: plan.final_price.toString()
    }));
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate fields
      if (!selectedPlan) {
        notifications.warning(
          'Select a Plan',
          'Please select a VIP membership plan before proceeding.'
        );
        setLoading(false);
        return;
      }

      if (!formData.utr_number) {
        notifications.warning(
          'UTR Number Required',
          'Please enter the UTR/Transaction Reference number from your payment confirmation.'
        );
        setLoading(false);
        return;
      }

      const loadingId = notifications.loading(
        'Submitting Payment',
        'Please wait while we verify your VIP membership payment...'
      );

      const response = await axios.post(`${API}/membership/submit-payment`, {
        user_id: user.uid,
        plan_type: selectedPlan.plan_type,
        duration_days: selectedPlan.duration_days,
        ...formData
      });

      toast.dismiss(loadingId);

      notifications.celebrate(
        '🎉 VIP Payment Submitted!',
        `Your ${selectedPlan.label} payment has been submitted successfully. Our team will verify and activate your VIP membership within 24 hours.`
      );
      
      fetchPaymentStatus();
      
      // Reset form
      setFormData({
        amount: selectedPlan.final_price.toString(),
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        utr_number: '',
        screenshot_url: ''
      });
    } catch (error) {
      console.error('Error submitting payment:', error);
      
      notifications.error(
        'Payment Submission Failed',
        error.response?.data?.detail || 'Failed to submit payment. Please check your details and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const isVIP = user.membership_type === 'vip';
  const hasPendingPayment = paymentStatus?.status === 'pending';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pt-20 pb-24">
      
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
                  ? user.membership_expiry 
                    ? `Valid until: ${new Date(user.membership_expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : 'Lifetime VIP Membership'
                  : 'Upgrade to VIP for unlimited benefits'
                }
              </p>
            </div>
            {isVIP && (
              <Crown className="h-12 w-12 text-white" />
            )}
          </div>
        </Card>

        {/* VIP Plans Selection */}
        {!isVIP && vipPlans.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Choose Your VIP Plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {vipPlans.map((plan) => {
                const isSelected = selectedPlan?.plan_type === plan.plan_type;
                const hasDiscount = plan.savings > 0;
                
                return (
                  <Card
                    key={plan.plan_type}
                    onClick={() => handlePlanSelect(plan)}
                    className={`p-6 cursor-pointer transition-all duration-200 hover:scale-105 ${
                      isSelected
                        ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-500 shadow-xl'
                        : 'bg-white hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-gray-900">{plan.label}</h3>
                      {isSelected && <Crown className="h-6 w-6 text-yellow-600" />}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4">{plan.duration_days} days access</p>
                    
                    {hasDiscount && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-500 line-through">₹{plan.base_price}</p>
                        <p className="text-xs text-green-600 font-medium">Save ₹{plan.savings}</p>
                      </div>
                    )}
                    
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-bold text-gray-900">₹{plan.final_price}</span>
                    </div>
                    
                    {isSelected ? (
                      <div className="bg-yellow-500 text-white text-center py-2 rounded-lg font-medium">
                        Selected
                      </div>
                    ) : (
                      <div className="bg-gray-100 text-gray-700 text-center py-2 rounded-lg font-medium hover:bg-gray-200">
                        Select Plan
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

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
                <span className="text-gray-700">Coins expire after 2 days</span>
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
              <h3 className="text-2xl font-bold text-gray-900">VIP Benefits</h3>
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
            <div className="text-lg text-gray-700">
              Choose from flexible plans above
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
                            Selected Plan & Amount (₹)
                          </label>
                          {selectedPlan && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
                              <p className="font-bold text-gray-900">{selectedPlan.label}</p>
                              <p className="text-sm text-gray-600">{selectedPlan.duration_days} days</p>
                            </div>
                          )}
                          <Input
                            type="number"
                            value={formData.amount}
                            readOnly
                            className="bg-gray-100 font-bold text-lg"
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
                          <ImageUpload
                            value={formData.screenshot_url}
                            onChange={(base64Image) => setFormData({...formData, screenshot_url: base64Image})}
                            label="Payment Screenshot"
                            aspectRatio="video"
                            maxSize={5}
                            required={true}
                          />
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

export default VIPMembership;