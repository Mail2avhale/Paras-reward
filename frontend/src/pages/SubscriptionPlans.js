import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Crown, CheckCircle, Upload, ArrowLeft, Star, Zap, ShoppingBag, 
  Gift, Clock, Shield, CreditCard, ChevronRight, Calendar,
  AlertCircle, Check, Rocket, TrendingUp, Award, Users, Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import ImageUpload from '@/components/ImageUpload';
import { validateUTR, formatUTR } from '@/utils/indianValidation';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Load Razorpay script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const SubscriptionPlans = ({ user }) => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState('monthly');
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  
  // UTR validation state
  const [utrValidating, setUtrValidating] = useState(false);
  const [utrValidationResult, setUtrValidationResult] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('razorpay'); // 'razorpay' or 'manual'
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false); // true = instant activation, false = pending verification
  const [razorpayEnabled, setRazorpayEnabled] = useState(true); // Gateway enabled status
  
  // Steps: 1=Select Plan, 2=Select Duration, 3=Payment Info, 4=Upload Proof
  const [currentStep, setCurrentStep] = useState(1);
  
  const [formData, setFormData] = useState({
    utr_number: '',
    screenshot_url: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
  });
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Special Offer Prices
  const specialOffers = {
    startup: { original: 500, offer: 299, discount: 40 },
    // growth discontinued
    elite: { original: 2000, offer: 799, discount: 60 }
  };

  const planIcons = {
    explorer: Users,
    startup: Rocket,
    elite: Crown
  };

  const planColors = {
    explorer: 'from-gray-500 to-gray-600',
    startup: 'from-blue-500 to-indigo-600',
    elite: 'from-amber-500 to-orange-600'
  };

  const durationLabels = {
    monthly: { label: t('monthly'), days: 30 }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch user data
      const userRes = await axios.get(`${API}/user/${user.uid}`);
      setUserData(userRes.data);
      
      // Fetch current subscription
      const subRes = await axios.get(`${API}/subscription/user/${user.uid}`);
      setCurrentSubscription(subRes.data.subscription);
      
      // Fetch plans
      const plansRes = await axios.get(`${API}/subscription/plans`);
      setPlans(plansRes.data.plans || []);
      
      // Fetch payment config
      const configRes = await axios.get(`${API}/settings/public`);
      setPaymentConfig(configRes.data);
      
      // Fetch Razorpay config to check if enabled
      try {
        const razorpayConfigRes = await axios.get(`${API}/razorpay/config`);
        const isEnabled = razorpayConfigRes.data.enabled !== false;
        setRazorpayEnabled(isEnabled);
        if (!isEnabled) {
          setPaymentMethod('manual'); // Default to manual if Razorpay disabled
        }
      } catch (err) {
        console.log('Could not fetch Razorpay config');
        setRazorpayEnabled(false);
        setPaymentMethod('manual');
      }
      
      // Fetch subscription history
      try {
        const historyRes = await axios.get(`${API}/subscription/history/${user.uid}`);
        setSubscriptionHistory(historyRes.data.history || []);
      } catch (err) {
        console.log('No subscription history');
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan) => {
    if (plan.is_free) {
      toast.info('Explorer is the free plan - no payment needed!');
      return;
    }
    setSelectedPlan(plan);
    setCurrentStep(2);
  };

  const handleSelectDuration = (duration) => {
    setSelectedDuration(duration);
    setCurrentStep(3);
  };

  // Razorpay Online Payment - Instant Activation
  const handleRazorpayPayment = async () => {
    try {
      setRazorpayLoading(true);
      
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load payment gateway. Please try again.');
        return;
      }
      
      // Get Razorpay config
      const configRes = await axios.get(`${API}/razorpay/config`);
      const { key_id, enabled } = configRes.data;
      
      // Check if gateway is enabled
      if (enabled === false) {
        toast.error('Online payment is currently disabled. Please use manual payment option.');
        setRazorpayLoading(false);
        setPaymentMethod('manual');
        return;
      }
      
      // Create order
      const orderRes = await axios.post(`${API}/razorpay/create-order`, {
        user_id: user.uid,
        plan_type: selectedDuration,
        plan_name: selectedPlan.id,
        amount: getPrice()
      });
      
      const { order_id, amount, currency } = orderRes.data;
      
      // Razorpay options
      const options = {
        key: key_id,
        amount: amount,
        currency: currency,
        name: 'PARAS REWARD',
        description: `${selectedPlan.name} - ${selectedDuration} Subscription`,
        order_id: order_id,
        handler: async function (response) {
          try {
            // Only proceed if we have all required response fields
            if (!response.razorpay_order_id || !response.razorpay_payment_id || !response.razorpay_signature) {
              toast.error('Payment incomplete. Please try again.');
              setRazorpayLoading(false);
              return;
            }
            
            // Show processing message
            toast.loading('Verifying payment...', { id: 'verify-payment' });
            
            // Verify payment with backend
            const verifyRes = await axios.post(`${API}/razorpay/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              user_id: user.uid
            });
            
            toast.dismiss('verify-payment');
            
            if (verifyRes.data.success === true) {
              toast.success('🎉 Payment Successful! Your subscription is now ACTIVE!', {
                duration: 5000,
              });
              setPaymentSuccess(true); // Instant activation
              setCurrentStep(5);
              // Refresh user data
              fetchData();
            } else {
              toast.error(verifyRes.data.message || 'Payment verification failed. Please contact support.');
              setRazorpayLoading(false);
            }
          } catch (error) {
            toast.dismiss('verify-payment');
            console.error('Payment verification failed:', error);
            
            // Show specific error from backend
            const errorMsg = error.response?.data?.detail || 'Payment verification failed';
            toast.error(errorMsg + '. If amount was deducted, please contact support.', {
              duration: 8000
            });
            setRazorpayLoading(false);
            
            // Update order status to error
            try {
              await axios.post(`${API}/razorpay/update-order-status`, {
                order_id: response.razorpay_order_id,
                status: 'error',
                reason: errorMsg,
                payment_id: response.razorpay_payment_id || ''
              });
            } catch (e) {
              console.log('Could not update order status');
            }
          }
        },
        prefill: {
          name: userData?.full_name || userData?.name || '',
          email: userData?.email || '',
          contact: userData?.mobile || ''
        },
        theme: {
          color: '#F59E0B'
        },
        modal: {
          ondismiss: async function() {
            setRazorpayLoading(false);
            toast.info('Payment cancelled');
            // Update order status to cancelled
            try {
              await axios.post(`${API}/razorpay/update-order-status`, {
                order_id: order_id,
                status: 'cancelled',
                reason: 'User closed payment modal'
              });
            } catch (e) {
              console.log('Could not update order status');
            }
          }
        }
      };
      
      const razorpay = new window.Razorpay(options);
      
      // Handle payment failures from Razorpay
      razorpay.on('payment.failed', async function (response) {
        console.error('Razorpay payment failed:', response.error);
        toast.error(`Payment failed: ${response.error.description || 'Please try again'}`, {
          duration: 5000,
        });
        setRazorpayLoading(false);
        
        // Update order status to failed
        try {
          await axios.post(`${API}/razorpay/update-order-status`, {
            order_id: order_id,
            status: 'failed',
            reason: response.error.description || 'Payment failed',
            error_code: response.error.code || '',
            payment_id: response.error.metadata?.payment_id || ''
          });
        } catch (e) {
          console.log('Could not update order status');
        }
      });
      
      razorpay.open();
      
    } catch (error) {
      console.error('Razorpay error:', error);
      toast.error(error.response?.data?.detail || 'Failed to initiate payment');
    } finally {
      setRazorpayLoading(false);
    }
  };

  const getPrice = () => {
    if (!selectedPlan || !selectedPlan.pricing) return 0;
    return selectedPlan.pricing[selectedDuration] || selectedPlan.pricing.monthly;
  };

  // Real-time UTR validation with debounce
  const validateUTROnServer = async (utrNumber) => {
    const cleaned = utrNumber.replace(/[^0-9]/g, '');
    
    // Only validate if we have 12 digits
    if (cleaned.length !== 12) {
      setUtrValidationResult(null);
      return;
    }
    
    setUtrValidating(true);
    try {
      const response = await axios.get(`${API}/utr/validate/${cleaned}`);
      setUtrValidationResult(response.data);
      
      if (!response.data.valid && response.data.error === 'UTR_ALREADY_USED') {
        toast.error('⚠️ UTR ALREADY IN USE - This UTR has already been used!');
      }
    } catch (error) {
      console.error('UTR validation error:', error);
      setUtrValidationResult(null);
    } finally {
      setUtrValidating(false);
    }
  };

  // Handle UTR input change with validation
  const handleUTRChange = (e) => {
    const formatted = formatUTR(e.target.value);
    setFormData({...formData, utr_number: formatted});
    setUtrValidationResult(null); // Reset validation
    
    // Validate when 12 digits entered
    if (formatted.length === 12) {
      validateUTROnServer(formatted);
    }
  };

  const handleSubmit = async () => {
    if (!formData.utr_number || !formData.screenshot_url) {
      toast.error('Please fill all required fields');
      return;
    }

    // Validate UTR format (must be exactly 12 digits)
    const utrValidation = validateUTR(formData.utr_number);
    if (!utrValidation.isValid) {
      toast.error(utrValidation.error || 'UTR number फक्त 12 अंकी असावा');
      return;
    }

    // Check if UTR validation failed (duplicate)
    if (utrValidationResult && !utrValidationResult.valid) {
      toast.error('⚠️ UTR ALREADY IN USE - कृपया योग्य UTR number टाका');
      return;
    }

    try {
      setSubmitting(true);
      
      await axios.post(`${API}/subscription/payment/${user.uid}`, {
        plan: selectedPlan.id,
        duration: selectedDuration,
        amount: getPrice(),
        utr_number: utrValidation.cleaned, // Use cleaned UTR
        utr_type: utrValidation.utrType,   // Send detected type
        screenshot_base64: formData.screenshot_url,
        date: formData.date,
        time: formData.time
      });
      
      toast.success('✅ Payment Submitted Successfully!\n\nYour subscription will be activated within 24 hours after verification. You will receive a notification once approved.', {
        duration: 6000,
      });
      setCurrentStep(5);
      
    } catch (error) {
      console.error('Submit error:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to submit payment';
      // Show specific message for UTR duplicate
      if (errorMsg.includes('UTR') || errorMsg.includes('already')) {
        toast.error('⚠️ UTR ALREADY IN USE - ' + errorMsg);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800 px-5 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate(-1)} className="text-gray-400">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-white">{t('subscriptionPlans')}</h1>
        </div>
      </div>

      {/* Current Plan Banner */}
      {currentSubscription && (
        <div className="mx-5 mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              {(() => {
                const IconComponent = planIcons[currentSubscription.plan] || Users;
                return <IconComponent className="w-6 h-6 text-amber-500" />;
              })()}
            </div>
            <div>
              <p className="text-amber-400 font-semibold">{t('current')} {t('plan')}: {currentSubscription.plan_name}</p>
              <p className="text-gray-400 text-sm">
                {currentSubscription.is_expired ? (
                  <span className="text-red-400">{t('expiredRenew')}</span>
                ) : currentSubscription.days_remaining > 0 ? (
                  <span>{t('daysRemaining').replace('{count}', currentSubscription.days_remaining)}</span>
                ) : (
                  <span>{t('freePlanUpgrade')}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Subscription History Button */}
      {currentStep === 1 && subscriptionHistory.length > 0 && (
        <div className="mx-5 mt-4">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-3 rounded-xl bg-gray-900/50 border border-gray-800 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <span className="text-gray-300">Subscription History</span>
              <span className="px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-400">
                {subscriptionHistory.length}
              </span>
            </div>
            <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
          </button>
          
          {/* History List */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-3">
                  {subscriptionHistory.map((item, index) => (
                    <motion.div
                      key={item.id || index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-4 rounded-xl border ${
                        item.status === 'completed' || item.status === 'approved'
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : item.status === 'pending'
                          ? 'bg-amber-500/5 border-amber-500/20'
                          : 'bg-gray-900/50 border-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-semibold ${
                              item.plan_name?.toLowerCase().includes('elite') ? 'text-amber-400' :
                              item.plan_name?.toLowerCase().includes('startup') ? 'text-blue-400' :
                              'text-white'
                            }`}>
                              {item.plan_name || 'Unknown Plan'}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({item.plan_type || 'monthly'})
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span>₹{item.amount}</span>
                            <span>•</span>
                            <span>{item.payment_method}</span>
                            {item.instant_activation && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-400 text-xs">⚡ Instant</span>
                              </>
                            )}
                          </div>
                          
                          {item.created_at && (
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(item.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            item.status === 'completed' || item.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : item.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-400'
                              : item.status === 'rejected'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-gray-800 text-gray-400'
                          }`}>
                            {item.status === 'completed' ? '✅ Completed' :
                             item.status === 'approved' ? '✅ Approved' :
                             item.status === 'pending' ? '⏳ Pending' :
                             item.status === 'rejected' ? '❌ Rejected' :
                             item.status}
                          </span>
                        </div>
                      </div>
                      
                      {item.payment_id && (
                        <p className="text-[10px] text-gray-600 mt-2 font-mono">
                          ID: {item.payment_id}
                        </p>
                      )}
                      {item.utr_number && (
                        <p className="text-[10px] text-gray-600 mt-1 font-mono">
                          UTR: {item.utr_number}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Step 1: Select Plan */}
      {currentStep === 1 && (
        <div className="px-5 mt-6 space-y-6">
          {/* AI Smart Tip for Subscription */}
          
          {/* Limited Time Offer Banner */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 rounded-2xl p-4 text-center"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-30"></div>
            <div className="relative">
              <span className="inline-block px-3 py-1 bg-yellow-400 text-black text-xs font-bold rounded-full mb-2 animate-pulse">
                LIMITED TIME OFFER
              </span>
              <h2 className="text-white text-lg font-bold">Up to 60% OFF on All Plans!</h2>
              <p className="text-white/80 text-sm">Hurry! Offer ends soon</p>
            </div>
          </motion.div>

          <h2 className="text-lg font-semibold text-white">{t('chooseYourPlan')}</h2>
          
          {/* Pricing Cards Grid */}
          <div className="grid gap-4">
            {plans.map((plan, index) => {
              const IconComponent = planIcons[plan.id] || Star;
              const isCurrentPlan = currentSubscription?.plan === plan.id;
              const offer = specialOffers[plan.id];
              const isPopular = plan.id === 'elite';  // Elite is now the most popular
              const isBest = plan.id === 'elite';
              
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleSelectPlan(plan)}
                  className={`relative p-5 rounded-2xl border cursor-pointer transition-all transform hover:scale-[1.02] ${
                    isCurrentPlan
                      ? 'bg-amber-500/10 border-amber-500/50'
                      : isBest
                      ? 'bg-gradient-to-br from-amber-900/30 to-orange-900/30 border-amber-500/50 shadow-lg shadow-amber-500/20'
                      : isPopular
                      ? 'bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-500/50'
                      : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                  }`}
                  data-testid={`plan-${plan.id}`}
                >
                  {/* Discount Badge */}
                  {offer && (
                    <div className="absolute -top-3 -right-2 z-10">
                      <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full shadow-lg ${
                        isBest ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-black' :
                        isPopular ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-black' :
                        'bg-gradient-to-r from-blue-400 to-indigo-500 text-white'
                      }`}>
                        {offer.discount}% OFF
                      </span>
                    </div>
                  )}

                  {/* Popular/Best Tags */}
                  {isPopular && !isCurrentPlan && (
                    <div className="absolute top-4 left-4">
                      <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full font-bold flex items-center gap-1">
                        <Star className="w-3 h-3" /> POPULAR
                      </span>
                    </div>
                  )}
                  {isBest && !isCurrentPlan && (
                    <div className="absolute top-4 left-4">
                      <span className="px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs rounded-full font-bold flex items-center gap-1">
                        <Crown className="w-3 h-3" /> BEST VALUE
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-4 mt-4">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${planColors[plan.id]} flex items-center justify-center shadow-lg`}>
                      <IconComponent className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-bold text-xl">{plan.name}</h3>
                        {isCurrentPlan && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">{t('current')}</span>
                        )}
                      </div>
                      
                      {/* Features */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-2 py-1 bg-gray-800/80 rounded-lg text-xs text-gray-300 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500" /> {plan.multiplier}x Rewards
                        </span>
                        <span className="px-2 py-1 bg-gray-800/80 rounded-lg text-xs text-gray-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-500" /> {plan.tap_limit} Taps/Day
                        </span>
                      </div>
                      
                      {/* Price Section */}
                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          {plan.is_free ? (
                            <span className="text-3xl font-bold text-white">FREE</span>
                          ) : offer ? (
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-bold text-white">₹{offer.offer}</span>
                              <span className="text-lg text-gray-500 line-through">₹{offer.original}</span>
                              <span className="text-sm text-gray-400">/month</span>
                            </div>
                          ) : (
                            <>
                              <span className="text-3xl font-bold text-white">₹{plan.pricing?.monthly}</span>
                              <span className="text-gray-500 text-sm">/month</span>
                            </>
                          )}
                          
                          {/* Savings Message */}
                          {offer && (
                            <p className={`text-sm mt-1 font-medium ${
                              isBest ? 'text-amber-400' : isPopular ? 'text-emerald-400' : 'text-blue-400'
                            }`}>
                              You save ₹{offer.original - offer.offer}!
                            </p>
                          )}
                        </div>
                        
                        {!plan.is_free && (
                          <div className={`px-4 py-2 rounded-xl font-semibold text-sm ${
                            isBest ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black' :
                            isPopular ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' :
                            'bg-blue-500 text-white'
                          }`}>
                            Subscribe
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Features for Premium Plans */}
                  {!plan.is_free && (
                    <div className="mt-4 pt-4 border-t border-gray-800/50 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <CheckCircle className="w-4 h-4 text-green-500 mx-auto mb-1" />
                        <span className="text-xs text-gray-400">Withdrawals</span>
                      </div>
                      <div>
                        <Gift className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                        <span className="text-xs text-gray-400">Referral Bonus</span>
                      </div>
                      <div>
                        <Shield className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                        <span className="text-xs text-gray-400">Priority Support</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Plan Comparison */}
          <div className="mt-8 p-4 bg-gray-900/50 rounded-2xl border border-gray-800">
            <h3 className="text-white font-semibold mb-3">{t('planComparison')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="text-left py-2">{t('feature')}</th>
                    <th className="text-center py-2">Explorer</th>
                    <th className="text-center py-2">Startup</th>
                    <th className="text-center py-2 text-amber-500">Elite</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2">{t('rewardRate')}</td>
                    <td className="text-center">1.0x</td>
                    <td className="text-center">1.5x</td>
                    <td className="text-center text-amber-400">3.0x</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2">{t('dailyTapsLimit')}</td>
                    <td className="text-center">100</td>
                    <td className="text-center">200</td>
                    <td className="text-center text-amber-400">400</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2">{t('referralWeight')}</td>
                    <td className="text-center">1.0x</td>
                    <td className="text-center">1.2x</td>
                    <td className="text-center text-amber-400">2.0x</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2">{t('canRedeem')}</td>
                    <td className="text-center text-red-400">✗</td>
                    <td className="text-center text-emerald-400">✓</td>
                    <td className="text-center text-emerald-400">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2">{t('prcExpires')}</td>
                    <td className="text-center text-red-400">2 {t('days')}</td>
                    <td className="text-center text-emerald-400">{t('never')}</td>
                    <td className="text-center text-emerald-400">{t('never')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Select Duration */}
      {currentStep === 2 && selectedPlan && (
        <div className="px-5 mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-white mb-4">{t('selectDuration')} - {selectedPlan.name}</h2>
          
          {Object.entries(durationLabels).map(([key, duration], index) => {
            const actualPrice = selectedPlan.pricing?.[key] || selectedPlan.pricing?.monthly;
            const monthlyPrice = selectedPlan.pricing?.monthly || 0;
            
            // Calculate original price (monthly only now)
            const months = 1;
            const originalPrice = monthlyPrice * months;
            const savings = originalPrice - actualPrice;
            const hasDiscount = false;
            
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleSelectDuration(key)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedDuration === key
                    ? 'bg-amber-500/10 border-amber-500/50'
                    : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                }`}
                data-testid={`duration-${key}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-semibold">{duration.label}</h3>
                    <p className="text-gray-400 text-sm">{duration.days} days</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      {hasDiscount && (
                        <span className="text-gray-500 line-through text-sm">₹{originalPrice.toLocaleString()}</span>
                      )}
                      <p className="text-xl font-bold text-white">₹{actualPrice?.toLocaleString()}</p>
                    </div>
                    {hasDiscount && (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-emerald-400 text-xs font-medium">{duration.discount}</span>
                        <span className="text-emerald-400 text-xs">(Save ₹{savings.toLocaleString()})</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Step 3: Payment Info */}
      {currentStep === 3 && (
        <div className="px-5 mt-6 space-y-6">
          <div className="p-4 bg-gray-900/50 rounded-2xl border border-gray-800">
            <h2 className="text-white font-semibold mb-2">{t('paymentDetails')}</h2>
            <div className="flex justify-between text-gray-400">
              <span>{t('plan')}:</span>
              <span className="text-white">{selectedPlan?.name}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>{t('duration')}:</span>
              <span className="text-white">{durationLabels[selectedDuration]?.label}</span>
            </div>
            <div className="flex justify-between text-amber-400 font-bold mt-2 pt-2 border-t border-gray-800">
              <span>{t('amount')}:</span>
              <span>₹{getPrice()}</span>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <h3 className="text-white font-semibold">Choose Payment Method</h3>
            
            {/* Razorpay - Instant Activation (Recommended) */}
            <button
              onClick={() => razorpayEnabled && setPaymentMethod('razorpay')}
              disabled={!razorpayEnabled}
              className={`w-full p-4 rounded-2xl border-2 transition-all ${
                !razorpayEnabled
                  ? 'border-gray-800 bg-gray-900/30 opacity-50 cursor-not-allowed'
                  : paymentMethod === 'razorpay'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  paymentMethod === 'razorpay' && razorpayEnabled ? 'bg-emerald-500/20' : 'bg-gray-800'
                }`}>
                  {/* Razorpay Icon */}
                  <svg className={`w-6 h-6 ${paymentMethod === 'razorpay' && razorpayEnabled ? 'text-emerald-400' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4zm0 10.99h6c-.53 4.12-3.28 7.79-6 8.94V12H6V7.07l6-3.07v8.99z"/>
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold ${paymentMethod === 'razorpay' && razorpayEnabled ? 'text-emerald-400' : 'text-white'}`}>
                      Online Payment
                    </p>
                    {razorpayEnabled ? (
                      <>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                          ⚡ Instant
                        </span>
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          </svg>
                          Secure
                        </span>
                      </>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                        ❌ Temporarily Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm">
                    {razorpayEnabled ? 'UPI, Cards, Net Banking via Razorpay' : 'Online payment is currently unavailable'}
                  </p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === 'razorpay' && razorpayEnabled ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'
                }`}>
                  {paymentMethod === 'razorpay' && razorpayEnabled && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
            </button>

            {/* Manual UPI/Bank - 24hr Activation */}
            <button
              onClick={() => setPaymentMethod('manual')}
              className={`w-full p-4 rounded-2xl border-2 transition-all ${
                paymentMethod === 'manual'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  paymentMethod === 'manual' ? 'bg-amber-500/20' : 'bg-gray-800'
                }`}>
                  <Wallet className={`w-6 h-6 ${paymentMethod === 'manual' ? 'text-amber-400' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold ${paymentMethod === 'manual' ? 'text-amber-400' : 'text-white'}`}>
                      Manual UPI/Bank Transfer
                    </p>
                  </div>
                  <p className="text-gray-400 text-sm">Pay & upload screenshot - 24hr activation</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === 'manual' ? 'border-amber-500 bg-amber-500' : 'border-gray-600'
                }`}>
                  {paymentMethod === 'manual' && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
            </button>
          </div>

          {/* Razorpay Pay Now Button */}
          {paymentMethod === 'razorpay' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <p className="text-emerald-400 font-semibold">Instant Activation Benefits</p>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    Subscription activates immediately after payment
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    All payment methods: UPI, Cards, Net Banking, Wallets
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    Secure payment via Razorpay
                  </li>
                </ul>
              </div>

              {/* Razorpay Trust Badge */}
              <div className="flex flex-col items-center gap-3 py-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span className="text-sm text-gray-400">100% Secure Payments</span>
                </div>
                
                {/* Razorpay Logo */}
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-gray-700">
                  <span className="text-xs text-gray-500">Powered by</span>
                  <svg className="h-5" viewBox="0 0 120 28" fill="none">
                    <path d="M16.5 0L0 28h8.5l4-7h12l-4-7H12l4.5-7.5L16.5 0z" fill="#3395FF"/>
                    <path d="M24.5 0L20.5 7h8.5l4 7h-12l-4 7H25l8.5-14L24.5 0z" fill="#072654"/>
                    <text x="42" y="20" fill="#ffffff" fontSize="14" fontWeight="600">Razorpay</text>
                  </svg>
                </div>

                {/* Payment Methods Icons */}
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className="w-8 h-5 bg-white/10 rounded flex items-center justify-center text-[10px] font-bold text-white">VISA</div>
                    <div className="w-8 h-5 bg-white/10 rounded flex items-center justify-center">
                      <div className="flex">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full -mr-1"></div>
                        <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></div>
                      </div>
                    </div>
                    <div className="w-8 h-5 bg-white/10 rounded flex items-center justify-center text-[10px] font-bold text-green-400">UPI</div>
                    <div className="w-8 h-5 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold text-blue-400">NET</div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleRazorpayPayment}
                disabled={razorpayLoading}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/30 disabled:opacity-50"
              >
                {razorpayLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Pay ₹{getPrice()} Now
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-lg">⚡ Instant</span>
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* Manual Payment Info (existing UPI/Bank) */}
          {paymentMethod === 'manual' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
          <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/30">
            <h3 className="text-amber-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 0 0-.794.68l-.04.22-.63 4.073-.032.17a.804.804 0 0 1-.794.68H7.72a.483.483 0 0 1-.477-.558L7.418 21h1.518l.95-6.02h1.385c4.678 0 7.75-2.203 8.796-6.502Z"/>
              </svg>
              {t('payViaUpi')}
            </h3>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* QR Code */}
              {paymentConfig?.qr_code_url && (
                <div className="flex-shrink-0">
                  <img 
                    src={paymentConfig.qr_code_url} 
                    alt="Payment QR" 
                    className="w-32 h-32 rounded-xl bg-white p-2 shadow-lg"
                  />
                  <p className="text-center text-xs text-gray-500 mt-1">Scan to Pay</p>
                </div>
              )}
              
              {/* UPI ID with copy button */}
              <div className="flex-1 w-full">
                <p className="text-gray-400 text-xs mb-1">UPI ID</p>
                <div className="bg-gray-900/50 rounded-xl p-3 flex items-center gap-2">
                  <p className="text-amber-400 font-mono text-sm break-all flex-1">
                    {paymentConfig?.payment_upi_id || 'paras@upi'}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(paymentConfig?.payment_upi_id || 'paras@upi');
                      toast.success('UPI ID copied!');
                    }}
                    className="flex-shrink-0 p-2 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <p className="text-gray-500 text-xs mt-2">{t('orScanQR')}</p>
              </div>
            </div>
          </div>

          {/* Bank Transfer Info */}
          {paymentConfig?.bank_details?.account_number && (
            <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/30">
              <h3 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m16-11v11M8 14v3m4-3v3m4-3v3" />
                </svg>
                Bank Transfer
              </h3>
              
              <div className="space-y-3">
                <div className="bg-gray-900/50 rounded-xl p-3">
                  <p className="text-gray-500 text-xs mb-1">Bank Name</p>
                  <p className="text-white font-medium">{paymentConfig.bank_details.bank_name}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900/50 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-1">Account No.</p>
                    <p className="text-white font-mono text-sm">{paymentConfig.bank_details.account_number}</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-1">IFSC Code</p>
                    <p className="text-white font-mono text-sm">{paymentConfig.bank_details.ifsc_code}</p>
                  </div>
                </div>
                
                <div className="bg-gray-900/50 rounded-xl p-3">
                  <p className="text-gray-500 text-xs mb-1">Account Holder</p>
                  <p className="text-white font-medium">{paymentConfig.bank_details.account_holder}</p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Instructions */}
          {paymentConfig?.payment_instructions && (
            <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/30">
              <h3 className="text-emerald-400 font-semibold mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Instructions
              </h3>
              <p className="text-gray-300 text-sm">{paymentConfig.payment_instructions}</p>
            </div>
          )}

          {/* Payment Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">{t('utrNumber')} * (फक्त 12 अंक)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.utr_number}
                  onChange={handleUTRChange}
                  placeholder="123456789012"
                  maxLength={12}
                  className={`w-full p-4 bg-gray-900 border rounded-xl text-white focus:outline-none font-mono tracking-widest text-lg ${
                    utrValidationResult?.valid === false 
                      ? 'border-red-500 focus:border-red-500' 
                      : utrValidationResult?.valid === true 
                        ? 'border-green-500 focus:border-green-500'
                        : 'border-gray-700 focus:border-amber-500'
                  }`}
                  data-testid="utr-input"
                />
                {utrValidating && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                {!utrValidating && utrValidationResult?.valid === true && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                )}
                {!utrValidating && utrValidationResult?.valid === false && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  </div>
                )}
              </div>
              
              {/* UTR Validation Feedback */}
              <div className="mt-2">
                {formData.utr_number.length > 0 && formData.utr_number.length < 12 && (
                  <p className="text-amber-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {formData.utr_number.length}/12 अंक - {12 - formData.utr_number.length} remaining
                  </p>
                )}
                
                {utrValidationResult?.valid === true && (
                  <p className="text-green-400 text-sm flex items-center gap-1 font-medium">
                    <CheckCircle className="w-4 h-4" />
                    ✓ UTR number is valid
                  </p>
                )}
                
                {utrValidationResult?.valid === false && utrValidationResult?.error === 'UTR_ALREADY_USED' && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-2">
                    <p className="text-red-400 text-sm font-bold flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      ⚠️ UTR ALREADY IN USE
                    </p>
                    <p className="text-red-300 text-xs mt-1">
                      This UTR has already been used! Please enter a valid UTR number.
                    </p>
                    {utrValidationResult?.details && (
                      <p className="text-red-300/70 text-xs mt-1">
                        Used in: {utrValidationResult.details.type} (Status: {utrValidationResult.details.status})
                      </p>
                    )}
                  </div>
                )}
                
                {utrValidationResult?.valid === false && utrValidationResult?.error === 'UTR_FORMAT_INVALID' && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {utrValidationResult.message}
                  </p>
                )}
              </div>
              
              {/* Helper text */}
              <p className="text-gray-500 text-xs mt-2">
                UPI/IMPS payment चा 12 अंकी UTR number टाका
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('paymentDate')}</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full p-4 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('paymentTime')}</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="w-full p-4 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">{t('paymentScreenshot')} *</label>
              <ImageUpload
                value={formData.screenshot_url}
                onChange={(url) => setFormData({...formData, screenshot_url: url})}
                label="Upload payment screenshot"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !formData.utr_number || !formData.screenshot_url}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            data-testid="submit-payment"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Upload className="w-5 h-5" />
                {t('submitPayment')}
              </>
            )}
          </button>
            </motion.div>
          )}
        </div>
      )}

      {/* Step 5: Success */}
      {currentStep === 5 && (
        <div className="px-5 mt-20 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`w-24 h-24 ${paymentSuccess ? 'bg-emerald-500/20' : 'bg-amber-500/20'} rounded-full flex items-center justify-center mx-auto mb-6`}
          >
            <CheckCircle className={`w-12 h-12 ${paymentSuccess ? 'text-emerald-500' : 'text-amber-500'}`} />
          </motion.div>
          
          {paymentSuccess ? (
            <>
              {/* Razorpay Success - Instant Activation */}
              <h2 className="text-2xl font-bold text-emerald-400 mb-2">🎉 Payment Successful!</h2>
              <p className="text-white text-lg mb-2">Your subscription is now <span className="text-emerald-400 font-bold">ACTIVE!</span></p>
              <p className="text-gray-400 mb-8">
                {selectedPlan?.name} Plan activated. Enjoy all premium benefits!
              </p>
            </>
          ) : (
            <>
              {/* Manual Payment - Pending Verification */}
              <h2 className="text-2xl font-bold text-white mb-2">{t('paymentSubmitted')}</h2>
              <p className="text-gray-400 mb-8">
                {t('verifyAndActivate').replace('{plan}', selectedPlan?.name)}
              </p>
              <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 mb-6">
                <p className="text-amber-400 text-sm">
                  ⏳ तुमचे payment verification साठी pending आहे. 24 तासात activate होईल.
                </p>
              </div>
            </>
          )}
          
          <button
            onClick={() => navigate('/dashboard')}
            className={`px-8 py-3 ${paymentSuccess ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-amber-500 to-amber-600'} text-black font-bold rounded-xl`}
          >
            {t('backToDashboard')}
          </button>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlans;
