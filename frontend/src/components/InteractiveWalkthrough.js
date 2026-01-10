import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  X, ChevronRight, ChevronLeft, Play, CheckCircle, 
  Zap, Users, Gift, Crown, ShoppingBag, Target, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Interactive walkthrough steps with animations
const walkthroughSteps = [
  {
    id: 'welcome',
    title: 'Welcome to PARAS REWARD! 🎉',
    subtitle: 'India\'s No.1 Loyalty Rewards Platform',
    description: 'Let\'s take a quick tour to help you get started earning PRC points and rewards!',
    icon: Sparkles,
    color: 'from-purple-500 to-indigo-600',
    animation: 'welcome',
    duration: 3000
  },
  {
    id: 'daily-rewards',
    title: 'Start Daily Sessions',
    subtitle: 'Earn PRC Points Every Day',
    description: 'Tap "Start Session" to begin earning PRC points. Your session runs for 24 hours - come back daily to collect your rewards!',
    icon: Zap,
    color: 'from-amber-500 to-orange-600',
    animation: 'mining',
    highlight: '/daily-rewards',
    tip: '💡 Pro tip: Keep sessions active for maximum earnings!'
  },
  {
    id: 'referrals',
    title: 'Invite Friends & Earn More',
    subtitle: '5-Level Referral System',
    description: 'Share your referral code with friends. Earn 10% from Level 1, 5% from Level 2, and more! Up to 21% total bonus.',
    icon: Users,
    color: 'from-emerald-500 to-green-600',
    animation: 'referral',
    highlight: '/referrals',
    tip: '🚀 Invite 5 friends to unlock Level 2 bonuses!'
  },
  {
    id: 'vip',
    title: 'Upgrade to VIP',
    subtitle: 'Unlock Premium Features',
    description: 'VIP members get access to Marketplace, Bill Payments, Gift Vouchers, and exclusive rewards. Points never expire!',
    icon: Crown,
    color: 'from-yellow-500 to-amber-600',
    animation: 'vip',
    highlight: '/vip',
    tip: '👑 VIP = Lifetime points + Shopping access!'
  },
  {
    id: 'marketplace',
    title: 'Shop with PRC Points',
    subtitle: 'Redeem for Real Products',
    description: 'Browse 5000+ products and redeem your PRC points for real rewards - electronics, fashion, home goods and more!',
    icon: ShoppingBag,
    color: 'from-pink-500 to-rose-600',
    animation: 'shopping',
    highlight: '/marketplace',
    tip: '🛒 VIP members can shop with PRC points!'
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🎊',
    subtitle: 'Start Earning Now',
    description: 'You\'re ready to start earning PRC points! Remember: Daily sessions + Referrals = Maximum earnings!',
    icon: CheckCircle,
    color: 'from-green-500 to-emerald-600',
    animation: 'complete',
    actions: [
      { label: 'Start Session', route: '/daily-rewards', primary: true },
      { label: 'Invite Friends', route: '/referrals', primary: false }
    ]
  }
];

// Animated Icon Component
const AnimatedIcon = ({ step, isActive }) => {
  const Icon = step.icon;
  
  return (
    <motion.div
      className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-2xl`}
      animate={isActive ? {
        scale: [1, 1.1, 1],
        rotate: [0, 5, -5, 0],
      } : {}}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <Icon className="w-12 h-12 text-white" />
    </motion.div>
  );
};

// Progress Dots
const ProgressDots = ({ currentStep, totalSteps, onDotClick }) => (
  <div className="flex items-center justify-center gap-2 mt-6">
    {Array.from({ length: totalSteps }).map((_, index) => (
      <motion.button
        key={index}
        onClick={() => onDotClick(index)}
        className={`rounded-full transition-all ${
          index === currentStep 
            ? 'w-8 h-2 bg-white' 
            : index < currentStep 
            ? 'w-2 h-2 bg-white/60' 
            : 'w-2 h-2 bg-white/30'
        }`}
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
      />
    ))}
  </div>
);

// Floating particles animation - pre-computed positions
const particlePositions = Array.from({ length: 20 }, (_, i) => ({
  x: (i * 20) % 400,
  y: (i * 30) % 600,
  duration: 3 + (i % 3),
  delay: (i % 5) * 0.4
}));

const FloatingParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {particlePositions.map((pos, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 rounded-full bg-white/20"
        initial={{ 
          x: pos.x, 
          y: pos.y,
          opacity: 0 
        }}
        animate={{ 
          y: [null, -100],
          opacity: [0, 0.5, 0],
        }}
        transition={{ 
          duration: pos.duration,
          repeat: Infinity,
          delay: pos.delay
        }}
      />
    ))}
  </div>
);

const InteractiveWalkthrough = ({ user, onComplete, onSkip }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = walkthroughSteps[currentStep];
  const isLastStep = currentStep === walkthroughSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('walkthrough_completed', 'true');
    setIsVisible(false);
    setTimeout(() => onComplete?.(), 300);
  };

  const handleSkip = () => {
    localStorage.setItem('walkthrough_completed', 'true');
    setIsVisible(false);
    setTimeout(() => onSkip?.(), 300);
  };

  const handleAction = (route) => {
    handleComplete();
    navigate(route);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.9)' }}
      >
        {/* Background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-20`} />
        
        {/* Floating particles */}
        <FloatingParticles />

        {/* Main card */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative w-full max-w-md bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-800"
        >
          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="p-8 pt-12 text-center">
            {/* Animated Icon */}
            <div className="flex justify-center mb-6">
              <AnimatedIcon step={step} isActive={true} />
            </div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl font-bold text-white mb-2"
            >
              {step.title}
            </motion.h2>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`text-sm font-medium bg-gradient-to-r ${step.color} bg-clip-text text-transparent mb-4`}
            >
              {step.subtitle}
            </motion.p>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-gray-300 text-sm leading-relaxed mb-4"
            >
              {step.description}
            </motion.p>

            {/* Tip */}
            {step.tip && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-gray-800/50 rounded-xl p-3 mb-4 border border-gray-700"
              >
                <p className="text-xs text-amber-400">{step.tip}</p>
              </motion.div>
            )}

            {/* Action buttons for last step */}
            {step.actions && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col gap-3 mt-6"
              >
                {step.actions.map((action, i) => (
                  <Button
                    key={i}
                    onClick={() => handleAction(action.route)}
                    className={`w-full py-3 rounded-xl font-bold ${
                      action.primary
                        ? `bg-gradient-to-r ${step.color} text-white shadow-lg`
                        : 'bg-gray-800 text-white hover:bg-gray-700'
                    }`}
                  >
                    {action.label}
                  </Button>
                ))}
              </motion.div>
            )}

            {/* Progress dots */}
            <ProgressDots 
              currentStep={currentStep} 
              totalSteps={walkthroughSteps.length}
              onDotClick={setCurrentStep}
            />
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between p-4 bg-gray-800/50 border-t border-gray-800">
            <button
              onClick={handlePrev}
              disabled={isFirstStep}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                isFirstStep 
                  ? 'text-gray-600 cursor-not-allowed' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            <button
              onClick={handleNext}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold bg-gradient-to-r ${step.color} text-white shadow-lg hover:shadow-xl transition-all`}
            >
              {isLastStep ? 'Get Started' : 'Next'}
              {!isLastStep && <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Hook to check if walkthrough should be shown
export const useWalkthrough = () => {
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('walkthrough_completed');
    if (!completed) {
      // Show walkthrough after a short delay
      const timer = setTimeout(() => setShowWalkthrough(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const startWalkthrough = () => setShowWalkthrough(true);
  const hideWalkthrough = () => setShowWalkthrough(false);
  const resetWalkthrough = () => {
    localStorage.removeItem('walkthrough_completed');
    setShowWalkthrough(true);
  };

  return { showWalkthrough, startWalkthrough, hideWalkthrough, resetWalkthrough };
};

export default InteractiveWalkthrough;
