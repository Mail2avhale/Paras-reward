import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, Users, CheckCircle, Activity, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Real-Time Transparency Panel
 * Shows live platform statistics - Google Play Compliant
 * 
 * Displays:
 * - Today PRC Earned (platform-wide)
 * - Today PRC Burned (platform-wide)
 * - Redeems Completed Today (count only)
 * - Active Users (approximate)
 * 
 * Does NOT show:
 * - Exact company revenue
 * - INR profit claims
 */
const LiveTransparencyPanel = ({ translations = {} }) => {
  const [stats, setStats] = useState({
    todayPrcEarned: 0,
    todayPrcBurned: 0,
    redeemsToday: 0,
    activeUsers: 0,
    lastUpdated: null
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const t = (key) => translations[key] || defaultTranslations[key] || key;

  const defaultTranslations = {
    liveStats: 'Live Platform Stats',
    todayPrcEarned: 'Today PRC Earned',
    todayPrcBurned: 'Today PRC Burned',
    redeemsToday: 'Redeems Today',
    activeUsers: 'Active Users',
    lastUpdated: 'Updated',
    justNow: 'just now'
  };

  const fetchLiveStats = async () => {
    try {
      const response = await axios.get(`${API}/api/public/live-stats`);
      if (response.data) {
        setStats({
          todayPrcEarned: response.data.today_prc_earned || 0,
          todayPrcBurned: response.data.today_prc_burned || 0,
          redeemsToday: response.data.redeems_today || 0,
          activeUsers: response.data.active_users || 0,
          lastUpdated: new Date()
        });
      }
    } catch (error) {
      console.error('Error fetching live stats:', error);
      // Use fallback data on error
      setStats(prev => ({
        ...prev,
        lastUpdated: new Date()
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchLiveStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLiveStats();
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getTimeAgo = () => {
    if (!stats.lastUpdated) return '';
    const seconds = Math.floor((new Date() - stats.lastUpdated) / 1000);
    if (seconds < 60) return t('justNow');
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 backdrop-blur-md rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-5 h-5 text-white/50 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 backdrop-blur-md rounded-2xl p-4 border border-white/10"
      data-testid="live-transparency-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-300" />
          <span className="text-sm font-semibold text-white/90">{t('liveStats')}</span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-xs text-green-300">LIVE</span>
          </div>
        </div>
        <button 
          onClick={handleRefresh}
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          disabled={refreshing}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-white/50 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Today PRC Earned */}
        <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-green-300/80">{t('todayPrcEarned')}</span>
          </div>
          <div className="text-lg font-bold text-green-300">
            +{formatNumber(stats.todayPrcEarned)}
          </div>
        </div>

        {/* Today PRC Burned */}
        <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs text-red-300/80">{t('todayPrcBurned')}</span>
          </div>
          <div className="text-lg font-bold text-red-300">
            -{formatNumber(stats.todayPrcBurned)}
          </div>
        </div>

        {/* Redeems Today */}
        <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-blue-300/80">{t('redeemsToday')}</span>
          </div>
          <div className="text-lg font-bold text-blue-300">
            {stats.redeemsToday}
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-purple-300/80">{t('activeUsers')}</span>
          </div>
          <div className="text-lg font-bold text-purple-300">
            {formatNumber(stats.activeUsers)}+
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-3 text-center">
        <span className="text-xs text-white/40">
          {t('lastUpdated')}: {getTimeAgo()}
        </span>
      </div>

      {/* Disclaimer */}
      <div className="mt-2 text-center">
        <span className="text-[10px] text-white/30">
          PRC are reward points, not financial investment
        </span>
      </div>
    </div>
  );
};

export default LiveTransparencyPanel;
