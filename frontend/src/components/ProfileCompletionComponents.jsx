import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  User, Phone, Mail, MapPin, Camera, Shield, 
  ChevronRight, X, Sparkles, CheckCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

// ============================================
// 1. PROFILE COMPLETION PROGRESS RING
// ============================================
export const ProfileCompletionRing = ({ user, userData, onComplete }) => {
  const navigate = useNavigate();
  
  // Merge user and userData for checking
  const data = { ...user, ...userData };
  
  // Calculate profile completion percentage
  const getCompletionData = () => {
    const checks = [
      { id: 'name', label: 'Full Name', done: !!(data?.name && data.name.trim() !== ''), points: 20, icon: User },
      { id: 'mobile', label: 'Mobile Number', done: !!(data?.mobile && data.mobile.trim() !== ''), points: 25, icon: Phone },
      { id: 'location', label: 'Location', done: !!(data?.city || data?.district || data?.state), points: 15, icon: MapPin },
      { id: 'kyc', label: 'KYC Verified', done: data?.kyc_status === 'verified', points: 40, icon: Shield },
    ];
    
    const completed = checks.filter(c => c.done);
    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const earnedPoints = completed.reduce((sum, c) => sum + c.points, 0);
    const percentage = Math.round((earnedPoints / totalPoints) * 100);
    
    return { checks, percentage, earnedPoints, totalPoints, incompleteChecks: checks.filter(c => !c.done) };
  };
  
  const { checks, percentage, incompleteChecks } = getCompletionData();
  const isComplete = percentage === 100;
  
  // SVG Circle parameters
  const size = 100;
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

  // Don't show if profile is complete (100%)
  if (isComplete) return null;

  return (
    <Card className="p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 mb-4">
      <div className="flex items-center gap-3">
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
              key={percentage} // Re-animate when percentage changes
            />
          </svg>
          {/* Percentage text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-white">{percentage}%</span>
          </div>
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Incomplete items */}
          <div className="flex flex-wrap gap-1 mb-2">
            {incompleteChecks.slice(0, 3).map(check => (
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
            className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
          >
            Complete
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        
        {/* Progress dots */}
        <div className="flex flex-col gap-1">
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
  
  // Merge user and userData
  const data = { ...user, ...userData };
  
  // Check if profile is complete
  const isProfileComplete = !!(
    data?.name && data.name.trim() !== '' &&
    data?.mobile && data.mobile.trim() !== '' &&
    (data?.city || data?.district || data?.state) &&
    data?.kyc_status === 'verified'
  );
  
  // Check if should show reminder
  useEffect(() => {
    // Don't show if profile is complete
    if (isProfileComplete) {
      setDismissed(true);
      return;
    }
    
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
    
    // Show after 3 seconds
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [user, userData, isProfileComplete]);
  
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
  
  const userName = data?.name || user?.email?.split('@')[0] || 'there';
  const firstName = userName.split(' ')[0];

  // Don't show if profile complete or dismissed
  if (isProfileComplete || dismissed || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className="fixed bottom-24 left-4 right-4 z-40"
      >
        <Card className="p-3 bg-gradient-to-r from-gray-900 to-gray-800 border-purple-500/30 shadow-xl shadow-purple-500/10">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300">
                {firstName}, complete your profile
              </p>
            </div>
            
            {/* Actions */}
            <Button 
              size="sm"
              onClick={handleComplete}
              className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
            >
              Complete
            </Button>
            
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
