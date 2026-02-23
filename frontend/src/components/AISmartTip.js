import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ChevronRight, Lightbulb, TrendingUp, AlertCircle, Gift, Users, Shield, Wallet, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Smart tips based on user's current page and status
const getSmartTipsForPage = (pageName, user, userStats) => {
  const tips = [];
  const prcBalance = user?.prc_balance || userStats?.prcBalance || 0;
  const kycStatus = user?.kyc_status || userStats?.kyc_status || 'not_submitted';
  const plan = user?.subscription_plan || userStats?.membershipType || 'explorer';
  const miningActive = user?.mining_active || userStats?.mining_active;
  const referralCount = userStats?.referralCount || 0;
  
  // Common tips for all pages
  const commonTips = {
    mining_inactive: {
      icon: Clock,
      title: 'Session बंद आहे!',
      message: 'Mining session सुरू करा आणि PRC कमवायला सुरुवात करा. दर तासाला automatic earning!',
      action: 'Start Session',
      route: '/dashboard',
      priority: 1,
      color: 'amber'
    },
    kyc_pending: {
      icon: Shield,
      title: 'KYC पूर्ण करा',
      message: 'Bank Redeem साठी KYC आवश्यक. Aadhaar + PAN upload करा, 24-48 तासात verification.',
      action: 'Verify KYC',
      route: '/kyc',
      priority: 2,
      color: 'blue'
    },
    low_referrals: {
      icon: Users,
      title: 'Referral Network वाढवा',
      message: `5 Level deep network बनवा! Direct referral वर 10%, Level 2 वर 5%... Total 21% passive income!`,
      action: 'Invite Friends',
      route: '/referrals',
      priority: 3,
      color: 'purple'
    },
    upgrade_plan: {
      icon: TrendingUp,
      title: 'VIP Plan घ्या',
      message: 'VIP members ला Gift Vouchers, Bill Payments, Shopping आणि higher mining rate मिळतो!',
      action: 'Upgrade Now',
      route: '/subscription',
      priority: 4,
      color: 'gradient'
    },
    redeem_available: {
      icon: Gift,
      title: 'Redeem करा!',
      message: `तुमच्याकडे ${prcBalance.toFixed(0)} PRC (≈₹${(prcBalance/10).toFixed(0)}) आहेत. Gift Voucher किंवा Bill Payment करा!`,
      action: 'Redeem Now',
      route: '/gift-vouchers',
      priority: 5,
      color: 'green'
    }
  };

  // Page-specific tips
  const pageTips = {
    dashboard: [
      {
        icon: Lightbulb,
        title: 'Daily Check-in Bonus',
        message: 'रोज login करून Daily Bonus claim करा. Streak bonus साठी सलग दिवस login करा!',
        action: 'Claim Bonus',
        route: '/daily-rewards',
        color: 'amber'
      }
    ],
    referrals: [
      {
        icon: Users,
        title: 'Referral Tips',
        message: 'WhatsApp groups, Family members, Friends ला invite करा. प्रत्येक referral वर lifetime earning!',
        action: 'Copy Code',
        route: null,
        color: 'purple'
      }
    ],
    'gift-vouchers': [
      {
        icon: Gift,
        title: 'Voucher Tip',
        message: 'Amazon, Flipkart vouchers instant मिळतात! Email वर code येतो 24-48 तासात.',
        action: null,
        route: null,
        color: 'green'
      }
    ],
    'bill-payments': [
      {
        icon: Wallet,
        title: 'Bill Payment Tip',
        message: 'Mobile Recharge, DTH, Electricity सगळे bills PRC ने pay करा आणि पैसे वाचवा!',
        action: null,
        route: null,
        color: 'blue'
      }
    ],
    subscription: [
      {
        icon: TrendingUp,
        title: 'Plan Comparison',
        message: 'Growth plan ला 0.3 PRC/hr, Professional ला 0.5 PRC/hr मिळतो. Higher plan = More earning!',
        action: null,
        route: null,
        color: 'gradient'
      }
    ],
    profile: [
      {
        icon: Shield,
        title: 'Security Tip',
        message: 'Security Question set करा. PIN विसरल्यास reset करणे सोपे होईल!',
        action: 'Set Question',
        route: '/profile/security',
        color: 'blue'
      }
    ],
    kyc: [
      {
        icon: AlertCircle,
        title: 'KYC Tips',
        message: 'Clear photos घ्या, Name match करा (Aadhaar, PAN, App सगळीकडे same spelling).',
        action: null,
        route: null,
        color: 'amber'
      }
    ],
    'prc-vault': [
      {
        icon: Wallet,
        title: 'Savings Tip',
        message: 'PRC Vault मध्ये save करा, 5-10% annual interest मिळवा. Long-term savings साठी best!',
        action: null,
        route: null,
        color: 'green'
      }
    ],
    shopping: [
      {
        icon: Gift,
        title: 'Shopping Tip',
        message: 'PRC ने shopping करा - Electronics, Fashion, Home items सगळे available!',
        action: null,
        route: null,
        color: 'purple'
      }
    ]
  };

  // Add common tips based on user status
  if (!miningActive) {
    tips.push(commonTips.mining_inactive);
  }
  
  if (kycStatus !== 'approved' && kycStatus !== 'verified') {
    tips.push(commonTips.kyc_pending);
  }
  
  if (referralCount < 5) {
    tips.push(commonTips.low_referrals);
  }
  
  if (plan === 'explorer' || plan === 'free') {
    tips.push(commonTips.upgrade_plan);
  }
  
  if (prcBalance >= 100 && (plan !== 'explorer' && plan !== 'free')) {
    tips.push(commonTips.redeem_available);
  }

  // Add page-specific tips
  const pageSpecificTips = pageTips[pageName] || [];
  tips.push(...pageSpecificTips);

  // Sort by priority and return top 3
  return tips.sort((a, b) => (a.priority || 10) - (b.priority || 10)).slice(0, 3);
};

const AISmartTip = ({ pageName = 'dashboard', customTips = null, variant = 'card', user = null, userStats = null }) => {
  const navigate = useNavigate();
  const [tips, setTips] = useState([]);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [dismissed, setDismissed] = useState([]);

  useEffect(() => {
    if (customTips) {
      setTips(customTips);
    } else {
      const smartTips = getSmartTipsForPage(pageName, user, userStats);
      setTips(smartTips.filter(tip => !dismissed.includes(tip.title)));
    }
  }, [pageName, user, userStats, customTips, dismissed]);

  const handleDismiss = (tipTitle) => {
    setDismissed(prev => [...prev, tipTitle]);
  };

  const handleAction = (tip) => {
    if (tip.route) {
      navigate(tip.route);
    }
  };

  const nextTip = () => {
    setCurrentTipIndex((prev) => (prev + 1) % tips.length);
  };

  if (!isVisible || tips.length === 0) return null;

  const currentTip = tips[currentTipIndex];
  const IconComponent = currentTip?.icon || Lightbulb;

  const colorClasses = {
    amber: 'from-amber-500 to-orange-500 bg-amber-50 border-amber-200 text-amber-800',
    blue: 'from-blue-500 to-indigo-500 bg-blue-50 border-blue-200 text-blue-800',
    purple: 'from-purple-500 to-pink-500 bg-purple-50 border-purple-200 text-purple-800',
    green: 'from-green-500 to-emerald-500 bg-green-50 border-green-200 text-green-800',
    gradient: 'from-purple-600 via-pink-500 to-orange-500 bg-gradient-to-r bg-purple-50 border-purple-200 text-purple-800'
  };

  const tipColor = currentTip?.color || 'amber';

  // Compact variant for inline display
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-3 p-3 rounded-xl border ${colorClasses[tipColor].split(' ').slice(2).join(' ')}`}
      >
        <div className={`p-2 rounded-lg bg-gradient-to-r ${colorClasses[tipColor].split(' ').slice(0, 2).join(' ')}`}>
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{currentTip?.title}</p>
          <p className="text-xs opacity-75 truncate">{currentTip?.message}</p>
        </div>
        {currentTip?.action && (
          <button
            onClick={() => handleAction(currentTip)}
            className={`text-xs font-medium px-3 py-1 rounded-full bg-gradient-to-r ${colorClasses[tipColor].split(' ').slice(0, 2).join(' ')} text-white whitespace-nowrap`}
          >
            {currentTip.action}
          </button>
        )}
        {tips.length > 1 && (
          <button onClick={nextTip} className="p-1 hover:bg-white/50 rounded-full">
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    );
  }

  // Banner variant for page top
  if (variant === 'banner') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl border ${colorClasses[tipColor].split(' ').slice(2).join(' ')} p-4`}
      >
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl bg-gradient-to-r ${colorClasses[tipColor].split(' ').slice(0, 2).join(' ')} shadow-lg`}>
            <IconComponent className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider opacity-75">AI Smart Tip</span>
            </div>
            <h4 className="font-bold text-base mb-1">{currentTip?.title}</h4>
            <p className="text-sm opacity-80">{currentTip?.message}</p>
            {currentTip?.action && (
              <button
                onClick={() => handleAction(currentTip)}
                className={`mt-3 inline-flex items-center gap-1 text-sm font-semibold px-4 py-2 rounded-full bg-gradient-to-r ${colorClasses[tipColor].split(' ').slice(0, 2).join(' ')} text-white shadow-md hover:shadow-lg transition-shadow`}
              >
                {currentTip.action}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleDismiss(currentTip?.title)}
              className="p-1 hover:bg-white/50 rounded-full transition-colors"
            >
              <X className="w-4 h-4 opacity-50" />
            </button>
            {tips.length > 1 && (
              <div className="flex gap-1">
                {tips.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === currentTipIndex ? 'bg-current' : 'bg-current/30'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        {tips.length > 1 && (
          <button
            onClick={nextTip}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/30 rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </motion.div>
    );
  }

  // Default card variant
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative overflow-hidden rounded-2xl border shadow-lg ${colorClasses[tipColor].split(' ').slice(2).join(' ')}`}
    >
      {/* Header */}
      <div className={`px-4 py-2 bg-gradient-to-r ${colorClasses[tipColor].split(' ').slice(0, 2).join(' ')}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-semibold">AI Smart Tip</span>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTipIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-start gap-3"
          >
            <div className={`p-2 rounded-lg bg-gradient-to-r ${colorClasses[tipColor].split(' ').slice(0, 2).join(' ')}`}>
              <IconComponent className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm mb-1">{currentTip?.title}</h4>
              <p className="text-xs opacity-80 leading-relaxed">{currentTip?.message}</p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-current/10">
          {currentTip?.action ? (
            <button
              onClick={() => handleAction(currentTip)}
              className={`inline-flex items-center gap-1 text-xs font-semibold px-4 py-2 rounded-full bg-gradient-to-r ${colorClasses[tipColor].split(' ').slice(0, 2).join(' ')} text-white`}
            >
              {currentTip.action}
              <ChevronRight className="w-3 h-3" />
            </button>
          ) : (
            <div />
          )}
          
          {tips.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-50">{currentTipIndex + 1}/{tips.length}</span>
              <button
                onClick={nextTip}
                className="p-1.5 hover:bg-white/50 rounded-full transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AISmartTip;
export { getSmartTipsForPage };
