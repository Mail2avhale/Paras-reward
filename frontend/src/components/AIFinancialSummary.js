import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { 
  Brain, TrendingUp, TrendingDown, Wallet, 
  ArrowUpRight, ArrowDownRight, Sparkles,
  RefreshCw, PiggyBank, Target, Coins
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AIFinancialSummary = ({ userId, stats, todayStats }) => {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);

  // Calculate daily average and predictions
  const dailyAverage = stats.totalMined > 0 ? (stats.totalMined / 30).toFixed(1) : 0;
  const weeklyPrediction = (parseFloat(dailyAverage) * 7).toFixed(1);
  const monthlyPrediction = (parseFloat(dailyAverage) * 30).toFixed(1);

  // Calculate today's performance percentage
  const todayPerformance = dailyAverage > 0 
    ? ((todayStats.today_prc_earned / dailyAverage - 1) * 100).toFixed(0)
    : 0;

  const isAboveAverage = todayStats.today_prc_earned > parseFloat(dailyAverage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden"
    >
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">AI Financial Summary</h3>
              <p className="text-xs text-white/70">Smart analysis of your earnings</p>
            </div>
          </div>
          <motion.div 
            className="flex items-center gap-1 text-xs bg-white/20 px-3 py-1.5 rounded-full"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Sparkles className="w-3 h-3" />
            <span>Live</span>
          </motion.div>
        </div>

        {/* Main Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Today's Earnings */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-green-300" />
              <span className="text-xs text-white/70">Today Earned</span>
            </div>
            <p className="text-2xl font-bold">+{todayStats.today_prc_earned.toFixed(1)}</p>
            <p className="text-xs text-white/60">PRC</p>
          </div>

          {/* Today's Spending */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight className="w-4 h-4 text-red-300" />
              <span className="text-xs text-white/70">Today Spent</span>
            </div>
            <p className="text-2xl font-bold">-{todayStats.today_prc_spent.toFixed(1)}</p>
            <p className="text-xs text-white/60">PRC</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Performance Indicator */}
        <div className={`flex items-center justify-between p-4 rounded-2xl mb-4 ${
          isAboveAverage ? 'bg-green-50 border border-green-100' : 'bg-amber-50 border border-amber-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isAboveAverage ? 'bg-green-500' : 'bg-amber-500'
            }`}>
              {isAboveAverage ? (
                <TrendingUp className="w-5 h-5 text-white" />
              ) : (
                <TrendingDown className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <p className={`font-semibold text-sm ${isAboveAverage ? 'text-green-700' : 'text-amber-700'}`}>
                {isAboveAverage ? 'Above Average!' : 'Below Average'}
              </p>
              <p className="text-xs text-gray-500">
                {isAboveAverage 
                  ? `You're earning ${Math.abs(todayPerformance)}% more than usual` 
                  : `Earning ${Math.abs(todayPerformance)}% less than usual`}
              </p>
            </div>
          </div>
          <div className={`text-lg font-bold ${isAboveAverage ? 'text-green-600' : 'text-amber-600'}`}>
            {isAboveAverage ? '+' : ''}{todayPerformance}%
          </div>
        </div>

        {/* Predictions Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Daily Average */}
          <motion.div 
            className="bg-gray-50 rounded-xl p-3 text-center"
            whileHover={{ scale: 1.02 }}
          >
            <Target className="w-5 h-5 text-gray-400 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">{dailyAverage}</p>
            <p className="text-xs text-gray-500">Daily Avg</p>
          </motion.div>

          {/* Weekly Prediction */}
          <motion.div 
            className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100"
            whileHover={{ scale: 1.02 }}
          >
            <PiggyBank className="w-5 h-5 text-blue-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-blue-700">{weeklyPrediction}</p>
            <p className="text-xs text-blue-600">This Week</p>
          </motion.div>

          {/* Monthly Prediction */}
          <motion.div 
            className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100"
            whileHover={{ scale: 1.02 }}
          >
            <Coins className="w-5 h-5 text-purple-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-purple-700">{monthlyPrediction}</p>
            <p className="text-xs text-purple-600">This Month</p>
          </motion.div>
        </div>

        {/* AI Tip */}
        <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-purple-700 mb-1">AI Tip</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                {isAboveAverage 
                  ? "Great progress! Keep mining consistently to maintain this momentum. Consider growing your referral network for bonus earnings."
                  : "Start a mining session now to boost your daily earnings. Consistent mining is key to reaching your goals!"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AIFinancialSummary;
