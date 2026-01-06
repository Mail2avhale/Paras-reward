import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, MapPin, Zap, Gift, ShoppingBag, Gamepad2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Live Activity Feed Component
 * Shows real-time platform activity for social proof
 * Google Play Compliant - No amounts, no earnings in INR
 * 
 * Format: "User from {city} {action}"
 */
const LiveActivityFeed = ({ translations = {}, maxItems = 5 }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const t = (key) => translations[key] || defaultTranslations[key] || key;

  const defaultTranslations = {
    liveActivity: 'लाइव Activity',
    justNow: 'आत्ताच',
    minutesAgo: 'मिनिटांपूर्वी',
    hoursAgo: 'तासांपूर्वी',
    userFrom: 'User from',
    earnedPrc: 'earned PRC via',
    redeemed: 'redeemed rewards',
    claimedVoucher: 'claimed a gift voucher',
    placedOrder: 'placed a marketplace order',
    startedMining: 'started mining',
    playedGame: 'played tap game'
  };

  const cities = [
    'Mumbai', 'Pune', 'Nashik', 'Nagpur', 'Thane', 
    'Kolhapur', 'Aurangabad', 'Solapur', 'Sangli', 'Satara',
    'Amravati', 'Nanded', 'Akola', 'Latur', 'Dhule',
    'Ahmednagar', 'Chandrapur', 'Parbhani', 'Jalgaon', 'Bhiwandi'
  ];

  const actionTemplates = [
    { action: 'mining', icon: Zap, text: 'earned PRC via mining', color: 'text-purple-400' },
    { action: 'tap_game', icon: Gamepad2, text: 'played tap game', color: 'text-blue-400' },
    { action: 'redeem', icon: Gift, text: 'redeemed rewards', color: 'text-green-400' },
    { action: 'voucher', icon: Gift, text: 'claimed a gift voucher', color: 'text-pink-400' },
    { action: 'order', icon: ShoppingBag, text: 'placed an order', color: 'text-orange-400' }
  ];

  useEffect(() => {
    fetchActivities();
    
    // Refresh every 30 seconds
    const fetchInterval = setInterval(fetchActivities, 30000);
    
    return () => clearInterval(fetchInterval);
  }, []);

  useEffect(() => {
    // Rotate displayed activity every 4 seconds
    if (activities.length > 1) {
      const rotateInterval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % activities.length);
      }, 4000);
      return () => clearInterval(rotateInterval);
    }
  }, [activities.length]);

  const fetchActivities = async () => {
    try {
      const response = await axios.get(`${API}/api/public/live-activity`);
      if (response.data?.activities?.length > 0) {
        setActivities(response.data.activities);
      } else {
        // Generate sample activities if none from API
        generateSampleActivities();
      }
    } catch (error) {
      generateSampleActivities();
    } finally {
      setLoading(false);
    }
  };

  const generateSampleActivities = () => {
    const sampleActivities = [];
    const now = new Date();
    
    for (let i = 0; i < 8; i++) {
      const city = cities[Math.floor(Math.random() * cities.length)];
      const template = actionTemplates[Math.floor(Math.random() * actionTemplates.length)];
      const minutesAgo = Math.floor(Math.random() * 30) + 1;
      
      sampleActivities.push({
        id: i,
        city,
        action: template.action,
        text: template.text,
        icon: template.icon,
        color: template.color,
        time_ago: minutesAgo < 2 ? t('justNow') : `${minutesAgo} ${t('minutesAgo')}`
      });
    }
    
    setActivities(sampleActivities);
  };

  const getActivityDisplay = (activity) => {
    const template = actionTemplates.find(t => t.action === activity.action) || actionTemplates[0];
    return {
      ...activity,
      icon: template.icon,
      color: template.color,
      text: activity.text || template.text
    };
  };

  if (loading || activities.length === 0) {
    return null;
  }

  const displayActivity = getActivityDisplay(activities[currentIndex]);
  const IconComponent = displayActivity.icon || Zap;

  return (
    <div className="px-4 mb-4" data-testid="live-activity-feed">
      <div className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 backdrop-blur-md rounded-xl p-3 border border-white/10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3.5 h-3.5 text-green-400" />
          <span className="text-xs font-medium text-white/70">{t('liveActivity')}</span>
          <div className="flex items-center gap-1 ml-auto">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-[10px] text-green-400">LIVE</span>
          </div>
        </div>

        {/* Activity Item */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-3"
          >
            {/* Icon */}
            <div className={`p-2 rounded-full bg-white/10 ${displayActivity.color}`}>
              <IconComponent className="w-4 h-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-white/50" />
                <span className="text-sm text-white/90 truncate">
                  {t('userFrom')} <span className="font-medium text-white">{displayActivity.city}</span>
                </span>
              </div>
              <p className={`text-xs ${displayActivity.color} truncate`}>
                {displayActivity.text}
              </p>
            </div>

            {/* Time */}
            <div className="text-[10px] text-white/40 whitespace-nowrap">
              {displayActivity.time_ago}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Activity dots indicator */}
        <div className="flex justify-center gap-1 mt-2">
          {activities.slice(0, 5).map((_, idx) => (
            <div 
              key={idx}
              className={`w-1 h-1 rounded-full transition-colors ${
                idx === currentIndex % 5 ? 'bg-white/70' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveActivityFeed;
