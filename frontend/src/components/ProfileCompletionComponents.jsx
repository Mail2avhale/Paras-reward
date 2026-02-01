import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  User, Phone, Mail, MapPin, Camera, Shield, 
  ChevronRight, Gift, X, Clock, Sparkles, CheckCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

// ============================================
// 1. PROFILE COMPLETION PROGRESS RING
// ============================================
export const ProfileCompletionRing = ({ user, userData, onComplete }) => {
  const navigate = useNavigate();
  
  // Calculate profile completion percentage
  const getCompletionData = () => {
    const checks = [
      { id: 'name', label: 'Full Name', done: !!(userData?.name || user?.name), points: 5, icon: User },
      { id: 'email', label: 'Email', done: !!(userData?.email || user?.email), points: 5, icon: Mail },
      { id: 'mobile', label: 'Mobile Number', done: !!(userData?.mobile || user?.mobile), points: 10, icon: Phone },
      { id: 'city', label: 'City/Location', done: !!(userData?.city || user?.city), points: 5, icon: MapPin },
      { id: 'photo', label: 'Profile Photo', done: !!(userData?.profile_picture || user?.profile_picture), points: 5, icon: Camera },
      { id: 'kyc', label: 'KYC Verified', done: userData?.kyc_status === 'verified' || user?.kyc_status === 'verified', points: 20, icon: Shield },
    ];
    
    const completed = checks.filter(c => c.done);
    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const earnedPoints = completed.reduce((sum, c) => sum + c.points, 0);
    const percentage = Math.round((earnedPoints / totalPoints) * 100);
    
    return { checks, percentage, earnedPoints, totalPoints, bonusPRC: 50 - (earnedPoints) };
  };
  
  const { checks, percentage, bonusPRC } = getCompletionData();
  const isComplete = percentage === 100;
  
  // SVG Circle parameters
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  // Get color based on percentage
  const getColor = () => {
    if (percentage >= 100) return '#10b981'; // emerald
    if (percentage >= 70) return '#8b5cf6'; // purple
    if (percentage >= 40) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  if (isComplete) return null; // Don't show if profile is complete

  return (
    <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 mb-4">
      <div className="flex items-center gap-4">
        {/* Progress Ring */}
        <div className="relative flex-shrink-0">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#374151"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={getColor()}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          {/* Percentage text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{percentage}%</span>
            <span className="text-[10px] text-gray-400">Complete</span>
          </div>
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Complete Your Profile
          </h3>
          <p className="text-xs text-gray-400 mb-2">
            Unlock {bonusPRC} PRC bonus & faster redemptions!
          </p>
          
          {/* Incomplete items */}
          <div className="flex flex-wrap gap-1 mb-2">
            {checks.filter(c => !c.done).slice(0, 3).map(check => (
              <span 
                key={check.id}
                className="px-2 py-0.5 bg-gray-800 text-gray-400 text-[10px] rounded-full flex items-center gap-1"
              >
                <check.icon className="w-3 h-3" />
                {check.label}
              </span>
            ))}
          </div>
          
          <Button 
            size="sm" 
            onClick={() => navigate('/profile?edit=true')}
            className="h-8 bg-purple-600 hover:bg-purple-700"
          >
            Complete Now
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
      
      {/* Bonus indicator */}
      <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-amber-400">
          <Gift className="w-4 h-4" />
          <span>Earn up to <strong>50 PRC</strong> bonus!</span>
        </div>
        <div className="flex gap-1">
          {checks.map(check => (
            <div 
              key={check.id}
              className={`w-2 h-2 rounded-full ${check.done ? 'bg-emerald-500' : 'bg-gray-600'}`}
              title={check.label}
            />
          ))}
        </div>
      </div>
    </Card>
  );
};


// ============================================
// 2. GENTLE FLOATING REMINDER
// ============================================
export const ProfileFloatingReminder = ({ user, userData, onDismiss }) => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  // Check if should show reminder
  useEffect(() => {
    const lastDismissed = localStorage.getItem('profile_reminder_dismissed');
    const dismissCount = parseInt(localStorage.getItem('profile_reminder_dismiss_count') || '0');
    
    // If dismissed 3+ times, wait 7 days
    if (dismissCount >= 3) {
      const lastTime = new Date(lastDismissed || 0);
      const daysSince = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        setDismissed(true);
        return;
      }
    }
    // If dismissed less than 3 times, wait 24 hours
    else if (lastDismissed) {
      const lastTime = new Date(lastDismissed);
      const hoursSince = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        setDismissed(true);
        return;
      }
    }
    
    // Check if profile is incomplete
    const isIncomplete = !(
      (userData?.name || user?.name) &&
      (userData?.mobile || user?.mobile) &&
      (userData?.kyc_status === 'verified' || user?.kyc_status === 'verified')
    );
    
    if (isIncomplete) {
      // Show after 3 seconds
      const timer = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [user, userData]);
  
  const handleDismiss = () => {
    const currentCount = parseInt(localStorage.getItem('profile_reminder_dismiss_count') || '0');
    localStorage.setItem('profile_reminder_dismissed', new Date().toISOString());
    localStorage.setItem('profile_reminder_dismiss_count', String(currentCount + 1));
    setVisible(false);
    onDismiss?.();
  };
  
  const handleComplete = () => {
    setVisible(false);
    navigate('/profile?edit=true');
  };
  
  const userName = userData?.name || user?.name || user?.email?.split('@')[0] || 'there';
  const firstName = userName.split(' ')[0];

  if (dismissed || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className="fixed bottom-24 left-4 right-4 z-40"
      >
        <Card className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 border-purple-500/30 shadow-xl shadow-purple-500/10">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">👋</span>
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white mb-1">
                Hey {firstName}!
              </h4>
              <p className="text-sm text-gray-400 mb-3">
                Complete your profile for faster redemptions & earn <span className="text-amber-400 font-semibold">50 PRC</span> bonus!
              </p>
              
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  onClick={handleComplete}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Complete Now
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button 
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  className="text-gray-400 hover:text-white"
                >
                  Later
                </Button>
              </div>
            </div>
            
            {/* Close button */}
            <button 
              onClick={handleDismiss}
              className="text-gray-500 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};


// ============================================
// 3. CONTEXTUAL PROMPT FOR REDEMPTION
// ============================================
export const RedemptionProfilePrompt = ({ user, userData, onContinue, onComplete }) => {
  const navigate = useNavigate();
  const [show, setShow] = useState(true);
  
  // Check what's missing
  const getMissingItems = () => {
    const missing = [];
    if (!userData?.kyc_status || userData?.kyc_status !== 'verified') {
      missing.push({ id: 'kyc', label: 'KYC Verification', icon: Shield, benefit: '2x faster processing' });
    }
    if (!userData?.mobile && !user?.mobile) {
      missing.push({ id: 'mobile', label: 'Mobile Number', icon: Phone, benefit: 'SMS updates' });
    }
    if (!userData?.name && !user?.name) {
      missing.push({ id: 'name', label: 'Full Name', icon: User, benefit: 'Personalized service' });
    }
    return missing;
  };
  
  const missingItems = getMissingItems();
  
  // Don't show if profile is complete
  if (missingItems.length === 0 || !show) return null;
  
  const handleContinue = () => {
    setShow(false);
    onContinue?.();
  };
  
  const handleComplete = () => {
    navigate('/profile?edit=true');
    onComplete?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <Card className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          
          <div className="flex-1">
            <h4 className="font-semibold text-amber-300 mb-1 text-sm">
              Complete Profile for Faster Processing!
            </h4>
            <p className="text-xs text-gray-400 mb-3">
              {missingItems[0]?.id === 'kyc' 
                ? 'KYC verified users get 2x faster request processing!'
                : 'Complete your profile to unlock all benefits.'}
            </p>
            
            {/* Missing items */}
            <div className="flex flex-wrap gap-2 mb-3">
              {missingItems.slice(0, 2).map(item => (
                <span 
                  key={item.id}
                  className="px-2 py-1 bg-gray-800 rounded-lg text-xs flex items-center gap-1"
                >
                  <item.icon className="w-3 h-3 text-amber-400" />
                  <span className="text-gray-300">{item.label}</span>
                </span>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Button 
                size="sm"
                onClick={handleComplete}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Complete Profile
              </Button>
              <Button 
                size="sm"
                variant="ghost"
                onClick={handleContinue}
                className="text-gray-400 hover:text-white"
              >
                Continue Anyway
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default ProfileCompletionRing;
