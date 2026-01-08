import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, Target, Zap, Award, Clock, 
  Sparkles, ChevronRight, Gift, Flame
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Smart User Insights Component
 * Shows personalized AI-like insights based on user activity
 * Google Play Compliant - No income predictions or money advice
 * 
 * Examples:
 * - "आज तुम्ही कालपेक्षा जास्त PRC कमावले"
 * - "Recharge goal साठी फक्त 120 PRC बाकी"
 */
const SmartUserInsights = ({ userId, userStats = {}, translations = {} }) => {
  const [insights, setInsights] = useState([]);
  const [currentInsight, setCurrentInsight] = useState(0);
  const [loading, setLoading] = useState(true);

  const t = (key) => translations[key] || defaultTranslations[key] || key;

  const defaultTranslations = {
    // Marathi translations
    moreToday: 'आज तुम्ही कालपेक्षा जास्त PRC कमावले! 🎉',
    lessToday: 'आज rewards collect करा, काल पेक्षा कमी PRC आहे',
    goalRemaining: 'Recharge goal साठी फक्त {amount} PRC बाकी! 🎯',
    streakActive: '{days} दिवस सतत rewards! Keep going! 🔥',
    vipBenefit: 'VIP म्हणून तुम्ही 2x PRC कमावत आहात! 👑',
    referralTip: 'आणखी 1 referral = Bonus rewards! 👥',
    closeToRedeem: 'अजून {amount} PRC = ₹100 voucher! 💰',
    topMiner: 'तुम्ही आज top 10% earners मध्ये आहात! ⭐',
    dailyGoal: 'आजचे goal: {target} PRC - {progress}% complete',
    newAchievement: 'नवीन achievement unlock होणार! 🏆',
    // English fallbacks
    moreToday_en: 'You earned more PRC than yesterday! 🎉',
    lessToday_en: 'Start collecting today, you have less PRC than yesterday',
    goalRemaining_en: 'Only {amount} PRC left for recharge goal! 🎯',
  };

  useEffect(() => {
    generateInsights();
  }, [userId, userStats]);

  useEffect(() => {
    // Rotate insights every 5 seconds
    if (insights.length > 1) {
      const interval = setInterval(() => {
        setCurrentInsight(prev => (prev + 1) % insights.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [insights.length]);

  const generateInsights = async () => {
    try {
      // Fetch user insights from backend
      const response = await axios.get(`${API}/api/user/insights/${userId}`);
      if (response.data?.insights) {
        setInsights(response.data.insights);
      } else {
        // Generate client-side insights based on available stats
        generateClientInsights();
      }
    } catch (error) {
      // Fallback to client-side insights
      generateClientInsights();
    } finally {
      setLoading(false);
    }
  };

  const generateClientInsights = () => {
    const generatedInsights = [];
    const {
      prc_balance = 0,
      today_earned = 0,
      yesterday_earned = 0,
      mining_streak = 0,
      is_vip = false,
      referral_count = 0,
      total_mined = 0
    } = userStats;

    // Comparison insight
    if (today_earned > yesterday_earned && today_earned > 0) {
      generatedInsights.push({
        type: 'positive',
        icon: 'trending',
        message: t('moreToday'),
        color: 'green'
      });
    } else if (yesterday_earned > today_earned) {
      generatedInsights.push({
        type: 'motivational',
        icon: 'zap',
        message: t('lessToday'),
        color: 'orange'
      });
    }

    // Goal progress insight
    const rechargeGoal = 500; // PRC needed for basic recharge
    if (prc_balance > 0 && prc_balance < rechargeGoal) {
      const remaining = rechargeGoal - prc_balance;
      generatedInsights.push({
        type: 'goal',
        icon: 'target',
        message: t('goalRemaining').replace('{amount}', remaining.toFixed(0)),
        color: 'blue'
      });
    }

    // Streak insight
    if (mining_streak >= 3) {
      generatedInsights.push({
        type: 'streak',
        icon: 'flame',
        message: t('streakActive').replace('{days}', mining_streak),
        color: 'orange'
      });
    }

    // VIP insight
    if (is_vip) {
      generatedInsights.push({
        type: 'vip',
        icon: 'award',
        message: t('vipBenefit'),
        color: 'yellow'
      });
    }

    // Referral tip
    if (referral_count < 5) {
      generatedInsights.push({
        type: 'tip',
        icon: 'sparkles',
        message: t('referralTip'),
        color: 'purple'
      });
    }

    // Close to redeem
    const voucherThreshold = 1000;
    if (prc_balance >= voucherThreshold - 200 && prc_balance < voucherThreshold) {
      const remaining = voucherThreshold - prc_balance;
      generatedInsights.push({
        type: 'redeem',
        icon: 'gift',
        message: t('closeToRedeem').replace('{amount}', remaining.toFixed(0)),
        color: 'pink'
      });
    }

    // Default insight if none generated
    if (generatedInsights.length === 0) {
      generatedInsights.push({
        type: 'default',
        icon: 'zap',
        message: 'Mining सुरू करा आणि rewards मिळवा! ⚡',
        color: 'purple'
      });
    }

    setInsights(generatedInsights);
  };

  const getIcon = (iconName) => {
    const icons = {
      trending: TrendingUp,
      target: Target,
      zap: Zap,
      award: Award,
      clock: Clock,
      sparkles: Sparkles,
      gift: Gift,
      flame: Flame
    };
    const IconComponent = icons[iconName] || Sparkles;
    return <IconComponent className="w-4 h-4" />;
  };

  const getColorClasses = (color) => {
    const colors = {
      green: 'from-green-500/30 to-emerald-500/30 border-green-400/50 text-green-900',
      orange: 'from-orange-500/30 to-amber-500/30 border-orange-400/50 text-orange-900',
      blue: 'from-blue-500/30 to-cyan-500/30 border-blue-400/50 text-blue-900',
      yellow: 'from-yellow-500/30 to-amber-500/30 border-yellow-400/50 text-yellow-900',
      purple: 'from-purple-500/30 to-indigo-500/30 border-purple-400/50 text-purple-900',
      pink: 'from-pink-500/30 to-rose-500/30 border-pink-400/50 text-pink-900'
    };
    return colors[color] || colors.purple;
  };

  if (loading || insights.length === 0) {
    return null;
  }

  const insight = insights[currentInsight];

  return (
    <div className="px-4 mb-4" data-testid="smart-insights">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentInsight}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className={`bg-gradient-to-r ${getColorClasses(insight.color)} backdrop-blur-md rounded-xl p-3 border flex items-center gap-3`}
        >
          {/* Icon */}
          <div className={`p-2 rounded-full bg-white/10`}>
            {getIcon(insight.icon)}
          </div>
          
          {/* Message */}
          <div className="flex-1">
            <p className="text-sm font-medium">{insight.message}</p>
          </div>
          
          {/* Indicator dots */}
          {insights.length > 1 && (
            <div className="flex gap-1">
              {insights.map((_, idx) => (
                <div 
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    idx === currentInsight ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SmartUserInsights;
