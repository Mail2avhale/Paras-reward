import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { 
  Brain, Sparkles, TrendingUp, TrendingDown, Target, 
  Lightbulb, AlertTriangle, Gift, Zap, ChevronRight,
  RefreshCw, ArrowUpRight, Clock, Shield, Star
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Insight types with styling
const INSIGHT_TYPES = {
  opportunity: {
    icon: Lightbulb,
    gradient: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-50 to-orange-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700'
  },
  warning: {
    icon: AlertTriangle,
    gradient: 'from-red-500 to-rose-500',
    bgGradient: 'from-red-50 to-rose-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700'
  },
  achievement: {
    icon: Star,
    gradient: 'from-purple-500 to-indigo-500',
    bgGradient: 'from-purple-50 to-indigo-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700'
  },
  tip: {
    icon: Target,
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-50 to-cyan-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700'
  },
  growth: {
    icon: TrendingUp,
    gradient: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700'
  }
};

const AIInsightsWidget = ({ userId, userStats, onActionClick }) => {
  const [insights, setInsights] = useState([]);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);

  useEffect(() => {
    generateInsights();
  }, [userStats]);

  const generateInsights = () => {
    const newInsights = [];
    
    // Balance-based insights
    if (userStats.prc_balance < 50) {
      newInsights.push({
        type: 'warning',
        title: 'Low Points Alert',
        message: 'Your PRC balance is running low. Start collecting daily rewards!',
        action: 'Collect Rewards',
        actionPath: '/daily-rewards'
      });
    } else if (userStats.prc_balance > 500) {
      newInsights.push({
        type: 'opportunity',
        title: 'Great Balance!',
        message: 'You have enough PRC for shopping! Check the marketplace for deals.',
        action: 'Shop Now',
        actionPath: '/marketplace'
      });
    }

    // Daily Rewards insights
    if (!userStats.is_mining_active) {
      newInsights.push({
        type: 'tip',
        title: 'Daily Rewards Available',
        message: 'Start a 24-hour session to collect bonus PRC points.',
        action: 'Start Session',
        actionPath: '/daily-rewards'
      });
    } else {
      newInsights.push({
        type: 'growth',
        title: 'Points Collecting! ⭐',
        message: 'You\'re earning PRC right now. Keep it going!',
        action: 'View Progress',
        actionPath: '/daily-rewards'
      });
    }

    // Referral insights
    if (userStats.referral_count === 0) {
      newInsights.push({
        type: 'opportunity',
        title: 'Invite Friends',
        message: 'Invite friends and earn bonus PRC when they join!',
        action: 'Invite Friends',
        actionPath: '/referrals'
      });
    } else if (userStats.referral_count >= 5) {
      newInsights.push({
        type: 'achievement',
        title: 'Great Network! 🏆',
        message: `You have ${userStats.referral_count} friends earning you bonus PRC!`,
        action: 'View Friends',
        actionPath: '/referrals'
      });
    }

    // VIP insights
    if (!userStats.is_vip) {
      newInsights.push({
        type: 'tip',
        title: 'Unlock VIP Benefits',
        message: 'Get lifetime PRC validity, higher cashback & marketplace access!',
        action: 'Upgrade Now',
        actionPath: '/vip'
      });
    }

    // Today's performance
    if (userStats.today_earned > 0) {
      newInsights.push({
        type: 'growth',
        title: `+${userStats.today_earned.toFixed(1)} PRC Today!`,
        message: 'Great job! You\'re making progress on your earnings.',
        action: 'Keep Mining',
        actionPath: '/mining'
      });
    }

    setInsights(newInsights.slice(0, 5));
    setLoading(false);
  };

  const fetchAISuggestion = async () => {
    setAiLoading(true);
    try {
      const response = await axios.get(`${API}/api/ai/contextual-help/dashboard?use_ai=true&uid=${userId}`);
      setAiSuggestion(response.data.ai_response);
    } catch (error) {
      console.error('Error fetching AI suggestion:', error);
      setAiSuggestion('Keep up your great progress! Focus on daily mining and growing your referral network for maximum earnings.');
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-rotate insights
  useEffect(() => {
    if (insights.length > 1) {
      const interval = setInterval(() => {
        setActiveInsight(prev => (prev + 1) % insights.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [insights.length]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">AI Insights</h3>
            <p className="text-xs text-gray-500">Analyzing your activity...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-gray-100 rounded-xl"></div>
          <div className="h-16 bg-gray-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const currentInsight = insights[activeInsight];
  const InsightIcon = currentInsight ? INSIGHT_TYPES[currentInsight.type]?.icon : Sparkles;
  const insightStyle = currentInsight ? INSIGHT_TYPES[currentInsight.type] : INSIGHT_TYPES.tip;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <motion.div 
            className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200"
            whileHover={{ scale: 1.05 }}
          >
            <Brain className="w-6 h-6 text-white" />
          </motion.div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">AI Insights</h3>
            <p className="text-xs text-gray-500">Personalized for you</p>
          </div>
        </div>
        <motion.div 
          className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <Sparkles className="w-3 h-3" />
          <span>AI Powered</span>
        </motion.div>
      </div>

      {/* Current Insight Card */}
      {currentInsight && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeInsight}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`relative overflow-hidden bg-gradient-to-br ${insightStyle.bgGradient} rounded-2xl p-4 border ${insightStyle.borderColor} mb-4`}
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="relative flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${insightStyle.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                <InsightIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`font-bold ${insightStyle.textColor} text-sm mb-1`}>
                  {currentInsight.title}
                </h4>
                <p className="text-gray-600 text-xs leading-relaxed mb-3">
                  {currentInsight.message}
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onActionClick && onActionClick(currentInsight.actionPath)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${insightStyle.gradient} text-white text-xs font-semibold rounded-lg shadow-md`}
                >
                  {currentInsight.action}
                  <ChevronRight className="w-3 h-3" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Insight Dots */}
      {insights.length > 1 && (
        <div className="flex justify-center gap-1.5 mb-4">
          {insights.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveInsight(idx)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                idx === activeInsight 
                  ? 'bg-purple-600 w-6' 
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      )}

      {/* AI Suggestion Section */}
      <div className="pt-4 border-t border-gray-100">
        {aiSuggestion ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-purple-700 mb-1">AI Recommendation</p>
                <p className="text-xs text-gray-600 leading-relaxed">{aiSuggestion}</p>
              </div>
            </div>
            <button
              onClick={fetchAISuggestion}
              disabled={aiLoading}
              className="mt-3 w-full flex items-center justify-center gap-2 text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              <RefreshCw className={`w-3 h-3 ${aiLoading ? 'animate-spin' : ''}`} />
              Get New Suggestion
            </button>
          </motion.div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={fetchAISuggestion}
            disabled={aiLoading}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-200 hover:shadow-xl transition-shadow"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Getting AI Suggestions...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Get AI Suggestions
              </>
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

export default AIInsightsWidget;
