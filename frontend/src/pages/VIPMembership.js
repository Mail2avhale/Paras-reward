import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Crown, CheckCircle, Upload, ArrowLeft, Star, Zap, ShoppingBag, 
  Gift, Clock, Shield, QrCode, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import ImageUpload from '@/components/ImageUpload';

const API = process.env.REACT_APP_BACKEND_URL;

const VIPMembership = ({ user }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [vipPlans, setVipPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    utr_number: '',
    screenshot_url: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
  });

  const t = {
    title: language === 'mr' ? 'VIP सदस्यत्व' : language === 'hi' ? 'VIP सदस्यता' : 'VIP Membership',
    upgrade: language === 'mr' ? 'VIP बना' : language === 'hi' ? 'VIP बनें' : 'Become VIP',
    benefits: language === 'mr' ? 'फायदे' : language === 'hi' ? 'लाभ' : 'Benefits',
    selectPlan: language === 'mr' ? 'प्लॅन निवडा' : language === 'hi' ? 'प्लान चुनें' : 'Select Plan',
    pay: language === 'mr' ? 'पेमेंट करा' : language === 'hi' ? 'भुगतान करें' : 'Pay Now',
    alreadyVip: language === 'mr' ? 'तुम्ही आधीच VIP आहात!' : language === 'hi' ? 'आप पहले से VIP हैं!' : 'You are already VIP!',
  };

  const benefits = [
    { icon: Zap, text: '2x Reward Rate', desc: 'Earn double PRC on daily rewards' },
    { icon: Clock, text: 'No PRC Expiry', desc: 'Your PRC never expires' },
    { icon: ShoppingBag, text: 'Marketplace Access', desc: 'Shop exclusive products' },
    { icon: Gift, text: 'Gift Vouchers', desc: 'Redeem Amazon, Flipkart vouchers' },
    { icon: CreditCard, text: 'Bill Payments', desc: 'Pay bills with PRC' },
    { icon: Shield, text: 'Priority Support', desc: '24/7 dedicated support' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch user data
      const userRes = await axios.get(`${API}/api/user/${user.uid}`);
      setUserData(userRes.data);
      
      // Fetch VIP plans
      const plansRes = await axios.get(`${API}/api/vip/plans`);
      const plans = plansRes.data.plans || [];
      setVipPlans(plans);
      
      // Auto-select monthly plan
      const monthlyPlan = plans.find(p => p.plan_type === 'monthly') || plans[0];
      if (monthlyPlan) {
        setSelectedPlan(monthlyPlan);
      }
      
      // Fetch payment config
      const configRes = await axios.get(`${API}/api/vip/payment-config`);
      setPaymentConfig(configRes.data);
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!formData.utr_number || !formData.screenshot_url) {
      toast.error('Please enter UTR and upload screenshot');
      return;
    }
    
    setSubmitting(true);
    try {
      await axios.post(`${API}/api/vip/payment/submit`, {
        uid: user.uid,
        plan_id: selectedPlan.id,
        plan_type: selectedPlan.plan_type,
        amount: selectedPlan.final_price,
        utr_number: formData.utr_number,
        screenshot_url: formData.screenshot_url,
        payment_date: formData.date,
        payment_time: formData.time,
        payment_method: 'UPI'
      });
      
      toast.success('Payment submitted! Verification in 24-48 hours.');
      setShowPayment(false);
      navigate('/dashboard');
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit payment');
    } finally {
      setSubmitting(false);
    }
  };

  const isVip = userData?.membership_type === 'vip';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

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
          <div>
            <h1 className="text-white text-xl font-bold">{t.title}</h1>
            <p className="text-gray-400 text-sm">Unlock premium features</p>
          </div>
        </div>
      </div>

      {/* Already VIP Banner */}
      {isVip && (
        <div className="px-5 mb-6">
          <div className="bg-gradient-to-r from-amber-500 to-yellow-500 rounded-2xl p-5 text-center">
            <Crown className="w-12 h-12 text-black mx-auto mb-2" />
            <h2 className="text-black text-xl font-bold">{t.alreadyVip}</h2>
            <p className="text-black/70 text-sm mt-1">
              Valid until: {userData?.vip_expiry ? new Date(userData.vip_expiry).toLocaleDateString() : 'Forever'}
            </p>
          </div>
        </div>
      )}

      {/* VIP Card Preview */}
      {!isVip && (
        <div className="px-5 mb-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl p-6"
            style={{
              background: 'linear-gradient(135deg, #92400e 0%, #78350f 50%, #451a03 100%)',
            }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-400/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-black" />
                </div>
                <div>
                  <p className="text-amber-200 text-xs font-semibold tracking-wider">PARAS REWARD</p>
                  <p className="text-white text-xl font-bold">VIP MEMBER</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-6">
                <Star className="w-5 h-5 text-yellow-400" />
                <Star className="w-5 h-5 text-yellow-400" />
                <Star className="w-5 h-5 text-yellow-400" />
              </div>
              <p className="text-amber-100/80 text-sm">
                Unlock premium features and maximize your earnings
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Benefits */}
      <div className="px-5 mb-6">
        <h2 className="text-white font-bold text-lg mb-4">{t.benefits}</h2>
        <div className="grid grid-cols-2 gap-3">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4"
            >
              <benefit.icon className="w-8 h-8 text-amber-500 mb-2" />
              <p className="text-white font-medium text-sm">{benefit.text}</p>
              <p className="text-gray-500 text-xs mt-1">{benefit.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Plans */}
      {!isVip && (
        <div className="px-5 mb-6">
          <h2 className="text-white font-bold text-lg mb-4">{t.selectPlan}</h2>
          <div className="space-y-3">
            {vipPlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className={`w-full p-4 rounded-2xl border-2 transition-all ${
                  selectedPlan?.id === plan.id
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-800 bg-gray-900/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-white font-bold capitalize">{plan.plan_type} Plan</p>
                    <p className="text-gray-400 text-sm">{plan.duration_days} days</p>
                  </div>
                  <div className="text-right">
                    {plan.discount > 0 && (
                      <p className="text-gray-500 text-sm line-through">₹{plan.base_price}</p>
                    )}
                    <p className="text-amber-400 text-2xl font-bold">₹{plan.final_price}</p>
                  </div>
                </div>
                {plan.discount > 0 && (
                  <div className="mt-2 bg-green-500/20 px-3 py-1 rounded-full inline-block">
                    <span className="text-green-400 text-xs font-semibold">Save {plan.discount}%</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payment Section */}
      {!isVip && selectedPlan && (
        <>
          {!showPayment ? (
            <div className="px-5">
              <Button
                onClick={() => setShowPayment(true)}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold py-4 rounded-2xl text-lg"
              >
                <Crown className="w-5 h-5 mr-2" />
                {t.pay} - ₹{selectedPlan.final_price}
              </Button>
            </div>
          ) : (
            <div className="px-5">
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-white font-bold text-lg">Complete Payment</h3>
                
                {/* QR Code */}
                {paymentConfig?.qr_code_url && (
                  <div className="bg-white p-4 rounded-xl text-center">
                    <img 
                      src={paymentConfig.qr_code_url} 
                      alt="Payment QR"
                      className="w-48 h-48 mx-auto"
                    />
                    <p className="text-gray-900 text-sm mt-2 font-mono">{paymentConfig.upi_id}</p>
                  </div>
                )}
                
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                  <p className="text-amber-400 text-sm font-medium">Amount to Pay</p>
                  <p className="text-white text-2xl font-bold">₹{selectedPlan.final_price}</p>
                </div>

                {/* UTR Number */}
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">UTR / Transaction ID *</label>
                  <Input
                    value={formData.utr_number}
                    onChange={(e) => setFormData({...formData, utr_number: e.target.value})}
                    placeholder="Enter 12-digit UTR number"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                {/* Screenshot Upload */}
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Payment Screenshot *</label>
                  <ImageUpload
                    onImageUploaded={(url) => setFormData({...formData, screenshot_url: url})}
                    existingImage={formData.screenshot_url}
                    userId={user.uid}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowPayment(false)}
                    variant="outline"
                    className="flex-1 bg-gray-800 border-gray-700 text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePaymentSubmit}
                    disabled={submitting || !formData.utr_number || !formData.screenshot_url}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold"
                  >
                    {submitting ? 'Submitting...' : 'Submit Payment'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VIPMembership;
