import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Crown, CheckCircle, Upload, ArrowLeft, Star, Zap, ShoppingBag, 
  Gift, Clock, Shield, CreditCard, ChevronRight, Calendar,
  AlertCircle, Check, Rocket, TrendingUp, Award, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import ImageUpload from '@/components/ImageUpload';

const API = process.env.REACT_APP_BACKEND_URL;

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
  
  // Steps: 1=Select Plan, 2=Select Duration, 3=Payment Info, 4=Upload Proof
  const [currentStep, setCurrentStep] = useState(1);
  
  const [formData, setFormData] = useState({
    utr_number: '',
    screenshot_url: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
  });

  const planIcons = {
    explorer: Users,
    startup: Rocket,
    growth: TrendingUp,
    elite: Crown
  };

  const planColors = {
    explorer: 'from-gray-500 to-gray-600',
    startup: 'from-blue-500 to-blue-600',
    growth: 'from-emerald-500 to-emerald-600',
    elite: 'from-amber-500 to-amber-600'
  };

  const durationLabels = {
    monthly: { label: t('monthly'), days: 30 },
    quarterly: { label: t('quarterly'), days: 90, discount: '10% off' },
    half_yearly: { label: t('halfYearly'), days: 180, discount: '15% off' },
    yearly: { label: t('yearly'), days: 365, discount: '25% off' }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch user data
      const userRes = await axios.get(`${API}/api/user/${user.uid}`);
      setUserData(userRes.data);
      
      // Fetch current subscription
      const subRes = await axios.get(`${API}/api/subscription/user/${user.uid}`);
      setCurrentSubscription(subRes.data.subscription);
      
      // Fetch plans
      const plansRes = await axios.get(`${API}/api/subscription/plans`);
      setPlans(plansRes.data.plans || []);
      
      // Fetch payment config
      const configRes = await axios.get(`${API}/api/settings/public`);
      setPaymentConfig(configRes.data);
      
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

  const getPrice = () => {
    if (!selectedPlan || !selectedPlan.pricing) return 0;
    return selectedPlan.pricing[selectedDuration] || selectedPlan.pricing.monthly;
  };

  const handleSubmit = async () => {
    if (!formData.utr_number || !formData.screenshot_url) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      
      await axios.post(`${API}/api/subscription/payment/${user.uid}`, {
        plan: selectedPlan.id,
        duration: selectedDuration,
        amount: getPrice(),
        utr_number: formData.utr_number,
        screenshot_base64: formData.screenshot_url,
        date: formData.date,
        time: formData.time
      });
      
      toast.success('Payment submitted! We will verify and activate your subscription.');
      setCurrentStep(5);
      
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit payment');
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

      {/* Step 1: Select Plan */}
      {currentStep === 1 && (
        <div className="px-5 mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-white mb-4">{t('chooseYourPlan')}</h2>
          
          {plans.map((plan, index) => {
            const IconComponent = planIcons[plan.id] || Star;
            const isCurrentPlan = currentSubscription?.plan === plan.id;
            
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleSelectPlan(plan)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  isCurrentPlan
                    ? 'bg-amber-500/10 border-amber-500/50'
                    : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                }`}
                data-testid={`plan-${plan.id}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${planColors[plan.id]} flex items-center justify-center`}>
                    <IconComponent className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-bold text-lg">{plan.name}</h3>
                      {isCurrentPlan && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">{t('current')}</span>
                      )}
                      {plan.id === 'elite' && (
                        <span className="px-2 py-0.5 bg-amber-500 text-black text-xs rounded-full font-bold">{t('best')}</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                      {plan.multiplier}x {t('rewardRate')} • {plan.tap_limit} {t('dailyTapsLimit')}
                    </p>
                    
                    {/* Benefits */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="px-2 py-1 bg-gray-800 rounded-lg text-xs text-gray-300 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500" /> {plan.multiplier}x {t('rewards')}
                      </span>
                      <span className="px-2 py-1 bg-gray-800 rounded-lg text-xs text-gray-300 flex items-center gap-1">
                        <Users className="w-3 h-3 text-blue-500" /> {plan.referral_weight}x {t('referralWeight')}
                      </span>
                      {plan.can_redeem && (
                        <span className="px-2 py-1 bg-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {t('canRedeem')}
                        </span>
                      )}
                    </div>
                    
                    {/* Price */}
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        {plan.is_free ? (
                          <span className="text-2xl font-bold text-white">FREE</span>
                        ) : (
                          <>
                            <span className="text-2xl font-bold text-white">₹{plan.pricing?.monthly}</span>
                            <span className="text-gray-500 text-sm">/month</span>
                          </>
                        )}
                      </div>
                      {!plan.is_free && (
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

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
                    <th className="text-center py-2">Growth</th>
                    <th className="text-center py-2 text-amber-500">Elite</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2">{t('rewardRate')}</td>
                    <td className="text-center">1.0x</td>
                    <td className="text-center">1.5x</td>
                    <td className="text-center">2.0x</td>
                    <td className="text-center text-amber-400">3.0x</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2">{t('dailyTapsLimit')}</td>
                    <td className="text-center">100</td>
                    <td className="text-center">200</td>
                    <td className="text-center">300</td>
                    <td className="text-center text-amber-400">400</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2">{t('referralWeight')}</td>
                    <td className="text-center">1.0x</td>
                    <td className="text-center">1.2x</td>
                    <td className="text-center">1.5x</td>
                    <td className="text-center text-amber-400">2.0x</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-2">{t('canRedeem')}</td>
                    <td className="text-center text-red-400">✗</td>
                    <td className="text-center text-emerald-400">✓</td>
                    <td className="text-center text-emerald-400">✓</td>
                    <td className="text-center text-emerald-400">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2">{t('prcExpires')}</td>
                    <td className="text-center text-red-400">2 {t('days')}</td>
                    <td className="text-center text-emerald-400">{t('never')}</td>
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
          
          {Object.entries(durationLabels).map(([key, duration], index) => (
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
                  <p className="text-xl font-bold text-white">₹{selectedPlan.pricing?.[key] || selectedPlan.pricing?.monthly}</p>
                  {duration.discount && (
                    <span className="text-emerald-400 text-xs">{duration.discount}</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
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

          {/* UPI Payment Info */}
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
              <label className="block text-gray-400 text-sm mb-2">{t('utrNumber')} *</label>
              <input
                type="text"
                value={formData.utr_number}
                onChange={(e) => setFormData({...formData, utr_number: e.target.value})}
                placeholder="Enter UTR number"
                className="w-full p-4 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-amber-500 outline-none"
                data-testid="utr-input"
              />
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
        </div>
      )}

      {/* Step 5: Success */}
      {currentStep === 5 && (
        <div className="px-5 mt-20 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-12 h-12 text-emerald-500" />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('paymentSubmitted')}</h2>
          <p className="text-gray-400 mb-8">
            {t('verifyAndActivate').replace('{plan}', selectedPlan?.name)}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-xl"
          >
            {t('backToDashboard')}
          </button>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlans;
