import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  TrendingUp, TrendingDown, Activity, AlertTriangle, Shield,
  Flame, Users, Coins, RefreshCw, Loader2, ChevronRight,
  Gauge, Wallet, AlertCircle, CheckCircle, XCircle,
  ArrowUpRight, ArrowDownRight, DollarSign, BarChart3,
  Zap, Target, Clock, Scale
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * PRC Token Economy Dashboard
 * Implements complete Token Economy Control System
 */
const AdminPRCEconomyDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) setRefreshing(true);
      else setLoading(true);
      
      const response = await axios.get(`${API}/admin/prc-economy/dashboard`);
      setDashboard(response.data);
      setError(null);
      
      if (showRefreshToast) toast.success('Dashboard refreshed');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load dashboard');
      toast.error('Failed to load economy dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => fetchDashboard(false), 300000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-red-500/10 border-red-500/30">
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle className="w-6 h-6" />
          <span>{error}</span>
        </div>
        <Button onClick={() => fetchDashboard()} className="mt-4">
          Retry
        </Button>
      </Card>
    );
  }

  const { prc_rate, supply, redeem_pressure, emergency_status, stability, whale_wallets, settings } = dashboard || {};

  // Stability score color
  const getStabilityColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getStabilityBg = (score) => {
    if (score >= 80) return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
    if (score >= 60) return 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
    if (score >= 40) return 'from-orange-500/20 to-red-500/20 border-orange-500/30';
    return 'from-red-500/20 to-rose-500/20 border-red-500/30';
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Coins className="w-7 h-7 text-amber-500" />
            PRC Token Economy
          </h1>
          <p className="text-gray-400 text-sm mt-1">Real-time economy monitoring & control</p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchDashboard(true)}
          disabled={refreshing}
          className="border-gray-700 text-gray-300"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Emergency Alert Banner */}
      {emergency_status?.is_emergency && (
        <Card className="p-4 bg-red-500/20 border-red-500/50 animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <p className="text-red-400 font-semibold">EMERGENCY: Abnormal Activity Detected!</p>
              <p className="text-red-300 text-sm">Redeem spike ratio: {emergency_status.spike_ratio}x (threshold: {emergency_status.emergency_threshold}x)</p>
            </div>
          </div>
        </Card>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Current PRC Rate */}
        <Card className="p-4 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border-amber-500/30">
          <div className="flex items-center justify-between">
            <DollarSign className="w-8 h-8 text-amber-400" />
            <span className="text-xs text-amber-300 bg-amber-500/20 px-2 py-1 rounded">LIVE</span>
          </div>
          <p className="text-3xl font-bold text-white mt-2">{prc_rate?.current || 10}</p>
          <p className="text-amber-300 text-sm">PRC = ₹1</p>
          <p className="text-gray-400 text-xs mt-1">
            ₹{prc_rate?.inr_value?.toFixed(4) || '0.10'} per PRC
          </p>
        </Card>

        {/* Stability Score */}
        <Card className={`p-4 bg-gradient-to-br ${getStabilityBg(stability?.stability_score || 50)} border`}>
          <div className="flex items-center justify-between">
            <Gauge className="w-8 h-8 text-white" />
            <span className={`text-xs ${getStabilityColor(stability?.stability_score || 50)} bg-black/30 px-2 py-1 rounded`}>
              {stability?.health_status?.toUpperCase() || 'UNKNOWN'}
            </span>
          </div>
          <p className={`text-3xl font-bold ${getStabilityColor(stability?.stability_score || 50)} mt-2`}>
            {stability?.stability_score || 0}
          </p>
          <p className="text-gray-300 text-sm">Stability Score</p>
        </Card>

        {/* Circulating Supply */}
        <Card className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30">
          <div className="flex items-center justify-between">
            <Coins className="w-8 h-8 text-blue-400" />
            <BarChart3 className="w-5 h-5 text-blue-300" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">
            {(supply?.circulating / 1000000)?.toFixed(2) || '0'}M
          </p>
          <p className="text-blue-300 text-sm">Circulating PRC</p>
        </Card>

        {/* Whale Wallets */}
        <Card className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30">
          <div className="flex items-center justify-between">
            <Wallet className="w-8 h-8 text-purple-400" />
            <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-1 rounded">
              &gt;{(settings?.whale_threshold / 1000)}K
            </span>
          </div>
          <p className="text-3xl font-bold text-white mt-2">{whale_wallets?.count || 0}</p>
          <p className="text-purple-300 text-sm">Whale Wallets</p>
          <p className="text-gray-400 text-xs mt-1">{settings?.whale_burn_rate}% burn rate</p>
        </Card>
      </div>

      {/* Rate Factors */}
      <Card className="p-5 bg-gray-800/50 border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-400" />
          Dynamic Rate Factors
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(prc_rate?.factors || {}).map(([key, value]) => {
            const isPositive = value < 1;
            const label = key.replace('_factor', '').replace('_', ' ');
            return (
              <div key={key} className="bg-gray-900/50 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs capitalize mb-1">{label}</p>
                <p className={`text-xl font-bold ${isPositive ? 'text-green-400' : value > 1 ? 'text-red-400' : 'text-gray-300'}`}>
                  {value?.toFixed(2) || '1.00'}
                </p>
                <p className="text-xs text-gray-500">
                  {isPositive ? '↑ Value Up' : value > 1 ? '↓ Value Down' : 'Neutral'}
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-3 bg-gray-900/50 rounded-lg flex items-center justify-between">
          <span className="text-gray-400">Rate Calculation:</span>
          <span className="text-amber-400 font-mono text-sm">
            Base({prc_rate?.base || 10}) × Factors = <span className="text-white font-bold">{prc_rate?.current || 10} PRC/₹1</span>
          </span>
        </div>
      </Card>

      {/* Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Redeem Pressure */}
        <Card className="p-5 bg-gray-800/50 border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Redeem Pressure Monitor
          </h3>
          
          <div className="space-y-4">
            {/* Pressure Gauge */}
            <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  (redeem_pressure?.redeem_pressure || 0) > 0.15 
                    ? 'bg-red-500' 
                    : (redeem_pressure?.redeem_pressure || 0) > 0.10 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                }`}
                style={{ 
                  width: `${Math.min((redeem_pressure?.redeem_pressure || 0) * 100 / 0.30, 100)}%` 
                }}
              />
              {/* Safe threshold marker */}
              <div 
                className="absolute top-0 h-full w-0.5 bg-white/50"
                style={{ left: `${(redeem_pressure?.safe_threshold || 0.15) * 100 / 0.30}%` }}
              />
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Current: {((redeem_pressure?.redeem_pressure || 0) * 100).toFixed(2)}%</span>
              <span className="text-gray-500">Safe: {((redeem_pressure?.safe_threshold || 0.15) * 100)}%</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-gray-400 text-xs">Today's Redeems</p>
                <p className="text-xl font-bold text-white">
                  {redeem_pressure?.total_redeemed_today?.toLocaleString() || 0}
                </p>
                <p className="text-gray-500 text-xs">PRC</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-gray-400 text-xs">Active Users</p>
                <p className="text-xl font-bold text-white">
                  {redeem_pressure?.active_users?.toLocaleString() || 0}
                </p>
                <p className="text-gray-500 text-xs">30-day active</p>
              </div>
            </div>

            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              redeem_pressure?.status === 'normal' 
                ? 'bg-green-500/10 text-green-400' 
                : redeem_pressure?.status === 'high'
                  ? 'bg-yellow-500/10 text-yellow-400'
                  : 'bg-red-500/10 text-red-400'
            }`}>
              {redeem_pressure?.status === 'normal' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="text-sm">{redeem_pressure?.message || 'Status unknown'}</span>
            </div>
          </div>
        </Card>

        {/* Stability Components */}
        <Card className="p-5 bg-gray-800/50 border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            Stability Components
          </h3>
          
          <div className="space-y-3">
            {Object.entries(stability?.components || {}).map(([key, value]) => {
              const label = key.replace(/_/g, ' ').replace('contribution', '').replace('penalty', '');
              const isPositive = value > 0;
              const isPenalty = key.includes('penalty');
              
              return (
                <div key={key} className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                  <span className="text-gray-400 text-sm capitalize">{label}</span>
                  <span className={`font-mono font-bold ${
                    isPenalty ? 'text-red-400' : isPositive ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {isPositive && !isPenalty ? '+' : ''}{value}
                  </span>
                </div>
              );
            })}
            
            <div className="border-t border-gray-700 pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold">Total Score</span>
                <span className={`text-2xl font-bold ${getStabilityColor(stability?.stability_score || 0)}`}>
                  {stability?.stability_score || 0}/100
                </span>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {stability?.recommendations?.length > 0 && (
            <div className="mt-4 p-3 bg-gray-900/50 rounded-lg">
              <p className="text-gray-400 text-xs mb-2">Recommendations:</p>
              {stability.recommendations.map((rec, i) => (
                <p key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  {rec}
                </p>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Whale Wallets */}
      {whale_wallets?.top_whales?.length > 0 && (
        <Card className="p-5 bg-gray-800/50 border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-400" />
            Top Whale Wallets
            <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-1 rounded ml-2">
              {settings?.whale_burn_rate}% Burn Rate
            </span>
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-gray-700">
                  <th className="text-left py-2 px-3">User</th>
                  <th className="text-right py-2 px-3">Balance</th>
                  <th className="text-right py-2 px-3">Daily Burn</th>
                </tr>
              </thead>
              <tbody>
                {whale_wallets.top_whales.map((whale, i) => (
                  <tr key={whale.uid || i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-3">
                      <p className="text-white font-medium">{whale.name || 'Unknown'}</p>
                      <p className="text-gray-500 text-xs">{whale.email || whale.uid}</p>
                    </td>
                    <td className="text-right py-3 px-3">
                      <p className="text-amber-400 font-mono font-bold">
                        {whale.prc_balance?.toLocaleString() || 0}
                      </p>
                      <p className="text-gray-500 text-xs">PRC</p>
                    </td>
                    <td className="text-right py-3 px-3">
                      <p className="text-red-400 font-mono">
                        -{((whale.prc_balance || 0) * 0.02).toFixed(2)}
                      </p>
                      <p className="text-gray-500 text-xs">PRC/day</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Settings Summary */}
      <Card className="p-5 bg-gray-800/50 border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-gray-400" />
          Economy Settings
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-gray-400">Normal Burn</p>
            <p className="text-white font-bold">{settings?.normal_burn_rate || 1}%/day</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-gray-400">Whale Burn</p>
            <p className="text-purple-400 font-bold">{settings?.whale_burn_rate || 2}%/day</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-gray-400">Whale Threshold</p>
            <p className="text-white font-bold">{(settings?.whale_threshold || 500000).toLocaleString()} PRC</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-gray-400">Rate Limits</p>
            <p className="text-white font-bold">{settings?.rate_limits?.min || 6} - {settings?.rate_limits?.max || 20} PRC/₹1</p>
          </div>
        </div>
      </Card>

      {/* Timestamp */}
      <p className="text-gray-500 text-xs text-center">
        Last updated: {dashboard?.generated_at ? new Date(dashboard.generated_at).toLocaleString('en-IN') : 'Unknown'}
      </p>
    </div>
  );
};

export default AdminPRCEconomyDashboard;
