import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Crown, CheckCircle, Upload, ArrowLeft, Star, Zap, ShoppingBag, 
  Gift, Clock, Shield, QrCode, CreditCard, ChevronRight, Calendar,
  AlertCircle, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [submitting, setSubmitting] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  
  // Step-by-step flow: 1=Select Plan, 2=Payment Info, 3=Upload Proof, 4=Submit, 5=Success
  const [currentStep, setCurrentStep] = useState(1);
  
  const [formData, setFormData] = useState({
    utr_number: '',
    screenshot_url: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
  });

  const t = {
    title: language === 'mr' ? 'VIP सदस्यत्व' : language === 'hi' ? 'VIP सदस्यता' : 'VIP Membership',
    step1: language === 'mr' ? 'प्लॅन निवडा' : language === 'hi' ? 'प्लान चुनें' : 'Select Plan',
    step2: language === 'mr' ? 'पेमेंट करा' : language === 'hi' ? 'भुगतान करें' : 'Make Payment',
    step3: language === 'mr' ? 'पुरावा अपलोड करा' : language === 'hi' ? 'प्रमाण अपलोड करें' : 'Upload Proof',
    step4: language === 'mr' ? 'सबमिट करा' : language === 'hi' ? 'जमा करें' : 'Submit',
    next: language === 'mr' ? 'पुढे' : language === 'hi' ? 'आगे' : 'Next',
    back: language === 'mr' ? 'मागे' : language === 'hi' ? 'पीछे' : 'Back',
    alreadyVip: language === 'mr' ? 'तुम्ही VIP आहात!' : language === 'hi' ? 'आप VIP हैं!' : 'You are VIP!',
    expiresOn: language === 'mr' ? 'समाप्ती तारीख' : language === 'hi' ? 'समाप्ति तिथि' : 'Expires On',
    daysLeft: language === 'mr' ? 'दिवस बाकी' : language === 'hi' ? 'दिन बाकी' : 'days left',
  };

  const benefits = [
    { icon: Zap, text: '2x Reward Rate', desc: 'Double PRC on daily rewards' },
    { icon: Clock, text: 'No PRC Expiry', desc: 'Your PRC never expires' },
    { icon: ShoppingBag, text: 'Marketplace', desc: 'Shop exclusive products' },
    { icon: Gift, text: 'Gift Vouchers', desc: 'Amazon, Flipkart vouchers' },
    { icon: CreditCard, text: 'Bill Payments', desc: 'Pay bills with PRC' },
    { icon: Shield, text: 'Priority Support', desc: '24/7 dedicated support' },
  ];

  const steps = [
    { num: 1, title: t.step1 },
    { num: 2, title: t.step2 },
    { num: 3, title: t.step3 },
    { num: 4, title: t.step4 },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const userRes = await axios.get(`${API}/api/user/${user.uid}`);
      setUserData(userRes.data);
      
      const plansRes = await axios.get(`${API}/api/vip/plans`);
      const plans = (plansRes.data.plans || []).map((plan, idx) => ({
        ...plan,
        id: plan.id || plan.plan_type || idx,
        discount: plan.discount_percentage || 0
      }));
      setVipPlans(plans);
      
      try {
        const configRes = await axios.get(`${API}/api/vip/payment-config`);
        setPaymentConfig(configRes.data);
      } catch (e) {
        // Payment config might not exist, use defaults
        setPaymentConfig({
          upi_id: 'paras@upi',
          qr_code_url: null
        });
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!formData.utr_number) {
      toast.error('Please enter UTR / Transaction ID');
      return;
    }
    if (!formData.screenshot_url) {
      toast.error('Please upload payment screenshot');
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
      
      toast.success('Payment submitted successfully!');
      setCurrentStep(5); // Success step
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit payment');
    } finally {
      setSubmitting(false);
    }
  };

  const isVip = userData?.membership_type === 'vip';
  const vipExpiry = userData?.membership_expiry || userData?.vip_expiry;
  
  // Calculate days left
  let daysLeft = 0;
  if (vipExpiry) {
    const expiryDate = new Date(vipExpiry);
    const today = new Date();
    daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => currentStep > 1 && !isVip ? setCurrentStep(currentStep - 1) : navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">{t.title}</h1>
            <p className="text-gray-500 text-sm">Unlock premium features</p>
          </div>
        </div>
      </div>

      {/* Already VIP - Show Expiry */}
      {isVip && (
        <div className="px-5 mb-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-3xl p-6"
            style={{
              background: 'linear-gradient(135deg, #92400e 0%, #78350f 50%, #451a03 100%)',
            }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-400/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Crown className="w-8 h-8 text-black" />
              </div>
              
              <h2 className="text-white text-2xl font-bold mb-2">{t.alreadyVip}</h2>
              
              <div className="flex items-center justify-center gap-2 mb-4">
                <Star className="w-5 h-5 text-yellow-400" />
                <Star className="w-5 h-5 text-yellow-400" />
                <Star className="w-5 h-5 text-yellow-400" />
              </div>

              {/* Expiry Info */}
              <div className="bg-black/30 rounded-2xl p-4 mt-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-amber-400" />
                  <span className="text-amber-300 font-medium">{t.expiresOn}</span>
                </div>
                
                <p className="text-white text-2xl font-bold mb-2">
                  {vipExpiry ? new Date(vipExpiry).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  }) : 'Lifetime'}
                </p>
                
                {daysLeft > 0 && (
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                    daysLeft <= 7 ? 'bg-red-500/30 text-red-300' : 
                    daysLeft <= 30 ? 'bg-amber-500/30 text-amber-300' : 
                    'bg-emerald-500/30 text-emerald-300'
                  }`}>
                    <Clock className="w-4 h-4" />
                    <span className="font-bold">{daysLeft} {t.daysLeft}</span>
                  </div>
                )}
                
                {daysLeft <= 0 && vipExpiry && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/30 text-red-300">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-bold">Expired - Renew Now!</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          
          {/* Renew Button for expiring soon */}
          {(daysLeft <= 7 || daysLeft <= 0) && (
            <button 
              onClick={() => setCurrentStep(1)}
              className="w-full mt-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-xl"
            >
              {daysLeft <= 0 ? 'Renew Now' : 'Extend Membership'}
            </button>
          )}
        </div>
      )}

      {/* Step Progress (Non-VIP) */}
      {!isVip && currentStep < 5 && (
        <div className="px-5 mb-6">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.num} className="flex items-center">
                <div className={`flex flex-col items-center`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                    currentStep > step.num 
                      ? 'bg-emerald-500 text-white' 
                      : currentStep === step.num 
                        ? 'bg-amber-500 text-black' 
                        : 'bg-gray-800 text-gray-500'
                  }`}>
                    {currentStep > step.num ? <Check className="w-5 h-5" /> : step.num}
                  </div>
                  <span className={`text-[10px] mt-1 ${
                    currentStep >= step.num ? 'text-amber-400' : 'text-gray-600'
                  }`}>
                    {step.title}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 ${
                    currentStep > step.num ? 'bg-emerald-500' : 'bg-gray-800'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Select Plan */}
      {!isVip && currentStep === 1 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          {/* VIP Card Preview */}
          <div className="px-5 mb-6">
            <div className="relative overflow-hidden rounded-3xl p-5"
              style={{
                background: 'linear-gradient(135deg, #92400e 0%, #78350f 50%, #451a03 100%)',
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/20 rounded-full blur-3xl"></div>
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-black" />
                </div>
                <div>
                  <p className="text-amber-200 text-xs font-semibold tracking-wider">PARAS REWARD</p>
                  <p className="text-white text-lg font-bold">VIP MEMBER CARD</p>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits Grid */}
          <div className="px-5 mb-6">
            <h2 className="text-white font-bold mb-3">VIP Benefits</h2>
            <div className="grid grid-cols-3 gap-2">
              {benefits.map((benefit, index) => (
                <div key={index} className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 text-center">
                  <benefit.icon className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                  <p className="text-white text-xs font-medium">{benefit.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Plan Selection */}
          <div className="px-5 mb-6">
            <h2 className="text-white font-bold mb-3">{t.step1}</h2>
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
                      <p className="text-gray-400 text-sm">{plan.duration_days} days validity</p>
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

          {/* Next Button */}
          <div className="px-5">
            <button
              onClick={() => selectedPlan && setCurrentStep(2)}
              disabled={!selectedPlan}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {t.next}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 2: Payment Info */}
      {!isVip && currentStep === 2 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="px-5"
        >
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 mb-6">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-500" />
              {t.step2}
            </h3>
            
            {/* Amount to Pay */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
              <p className="text-amber-400 text-sm">Amount to Pay</p>
              <p className="text-white text-3xl font-bold">₹{selectedPlan?.final_price}</p>
              <p className="text-gray-500 text-sm">{selectedPlan?.plan_type} Plan - {selectedPlan?.duration_days} days</p>
            </div>

            {/* Check if payment details are configured */}
            {(!paymentConfig?.upi_id && !paymentConfig?.bank_name) ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                <p className="text-red-400 font-semibold mb-1">Payment Details Not Available</p>
                <p className="text-gray-400 text-sm">Please contact admin to get payment details.</p>
              </div>
            ) : (
              <>
                {/* UPI Payment Section */}
                {paymentConfig?.upi_id && (
                  <div className="mb-4">
                    <h4 className="text-emerald-400 font-semibold mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4" /> UPI Payment
                    </h4>
                    
                    {paymentConfig?.qr_code_url && (
                      <div className="bg-white p-4 rounded-xl text-center mb-3">
                        <img 
                          src={paymentConfig.qr_code_url} 
                          alt="Payment QR"
                          className="w-40 h-40 mx-auto"
                        />
                      </div>
                    )}
                    
                    <div className="bg-gray-800/50 rounded-xl p-3">
                      <p className="text-gray-500 text-xs mb-1">UPI ID</p>
                      <p className="text-white font-mono text-lg">{paymentConfig.upi_id}</p>
                    </div>
                  </div>
                )}

                {/* Bank Transfer Section */}
                {paymentConfig?.bank_name && (
                  <div className="mb-4">
                    <h4 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Bank Transfer
                    </h4>
                    <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">Bank Name</span>
                        <span className="text-white font-medium">{paymentConfig.bank_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">Account Holder</span>
                        <span className="text-white font-medium">{paymentConfig.account_holder}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">Account Number</span>
                        <span className="text-white font-mono">{paymentConfig.account_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">IFSC Code</span>
                        <span className="text-white font-mono">{paymentConfig.ifsc_code}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Payment Instructions */}
            {paymentConfig?.instructions && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <h4 className="text-blue-400 font-semibold mb-2">Instructions</h4>
                <p className="text-gray-400 text-sm">{paymentConfig.instructions}</p>
              </div>
            )}
            
            {/* Default Instructions */}
            {!paymentConfig?.instructions && (paymentConfig?.upi_id || paymentConfig?.bank_name) && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <h4 className="text-blue-400 font-semibold mb-2">Payment Instructions</h4>
                <ol className="text-gray-400 text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0">1</span>
                    <span>Pay ₹{selectedPlan?.final_price} using UPI or Bank Transfer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0">2</span>
                    <span>Note down UTR/Transaction ID</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0">3</span>
                    <span>Take screenshot of payment confirmation</span>
                  </li>
                </ol>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep(1)}
              className="flex-1 py-3 bg-gray-800 text-white font-medium rounded-xl"
            >
              {t.back}
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-xl flex items-center justify-center gap-2"
            >
              {t.next}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Upload Proof */}
      {!isVip && currentStep === 3 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="px-5"
        >
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 mb-6 space-y-4">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-500" />
              {t.step3}
            </h3>

            {/* UTR Number */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">UTR / Transaction ID *</label>
              <input
                value={formData.utr_number}
                onChange={(e) => setFormData({...formData, utr_number: e.target.value})}
                placeholder="Enter 12-digit UTR number"
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
              />
              <p className="text-gray-600 text-xs mt-1">Find this in your UPI app transaction history</p>
            </div>

            {/* Screenshot Upload */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Payment Screenshot *</label>
              <ImageUpload
                value={formData.screenshot_url}
                onChange={(url) => setFormData({...formData, screenshot_url: url})}
                placeholder="Upload payment proof"
              />
            </div>

            {/* Payment Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Payment Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Payment Time</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep(2)}
              className="flex-1 py-3 bg-gray-800 text-white font-medium rounded-xl"
            >
              {t.back}
            </button>
            <button
              onClick={() => {
                if (!formData.utr_number || !formData.screenshot_url) {
                  toast.error('Please fill all required fields');
                  return;
                }
                setCurrentStep(4);
              }}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-xl flex items-center justify-center gap-2"
            >
              {t.next}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 4: Review & Submit */}
      {!isVip && currentStep === 4 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="px-5"
        >
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 mb-6">
            <h3 className="text-white font-bold text-lg mb-4">Review Details</h3>
            
            {/* Plan Summary */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-400 text-sm">Selected Plan</p>
                  <p className="text-white font-bold text-lg capitalize">{selectedPlan?.plan_type} - {selectedPlan?.duration_days} days</p>
                </div>
                <p className="text-amber-400 text-2xl font-bold">₹{selectedPlan?.final_price}</p>
              </div>
            </div>

            {/* Payment Details */}
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">UTR Number</span>
                <span className="text-white font-mono">{formData.utr_number}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Payment Date</span>
                <span className="text-white">{formData.date}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Payment Time</span>
                <span className="text-white">{formData.time}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">Screenshot</span>
                <span className="text-emerald-400">✓ Uploaded</span>
              </div>
            </div>

            {/* Warning */}
            <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <p className="text-amber-300 text-xs">
                ⚠️ Verification takes 24-48 hours. Your VIP membership will be activated after verification.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep(3)}
              className="flex-1 py-3 bg-gray-800 text-white font-medium rounded-xl"
            >
              {t.back}
            </button>
            <button
              onClick={handlePaymentSubmit}
              disabled={submitting}
              className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Crown className="w-5 h-5" />
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 5: Success */}
      {currentStep === 5 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="px-5"
        >
          <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            
            <h2 className="text-white text-2xl font-bold mb-2">Application Submitted!</h2>
            <p className="text-gray-400 mb-6">
              Your VIP membership application has been submitted successfully. 
              Our team will verify your payment within 24-48 hours.
            </p>
            
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
              <p className="text-amber-400 text-sm">Expected Activation</p>
              <p className="text-white font-bold text-lg">
                {new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-xl"
            >
              Go to Dashboard
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default VIPMembership;
