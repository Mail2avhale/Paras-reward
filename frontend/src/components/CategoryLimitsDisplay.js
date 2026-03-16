import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Zap, ShoppingBag, Landmark, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Single Category Limit Card
 * Shows only the specified category's limit (Total, Used, Remaining)
 * 
 * @param {string} userId - User's UID
 * @param {string} category - 'utility' | 'shopping' | 'bank'
 */
const CategoryLimitsDisplay = ({ userId, category = 'utility' }) => {
  const [catData, setCatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prcRate, setPrcRate] = useState(10);

  useEffect(() => {
    if (userId) {
      fetchLimits();
      fetchPrcRate();
    }
  }, [userId, category]);

  const fetchLimits = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API}/redeem-categories/user/${userId}`);
      if (response.data.success && response.data.categories) {
        setCatData(response.data.categories[category] || null);
      }
    } catch (err) {
      console.error('Error fetching category limits:', err);
      setError('Failed to load limits');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrcRate = async () => {
    try {
      const res = await axios.get(`${API}/admin/prc-rate/current`);
      if (res.data?.success && res.data?.current_rate) {
        setPrcRate(res.data.current_rate);
      }
    } catch (err) {
      console.error('Error fetching PRC rate:', err);
    }
  };

  const getCategoryIcon = () => {
    switch (category) {
      case 'utility':
        return <Zap className="w-5 h-5" />;
      case 'shopping':
        return <ShoppingBag className="w-5 h-5" />;
      case 'bank':
        return <Landmark className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const getCategoryStyle = () => {
    switch (category) {
      case 'utility':
        return {
          gradient: 'from-blue-500/20 via-cyan-500/10 to-blue-600/20',
          border: 'border-blue-500/30',
          text: 'text-blue-400',
          bar: 'from-blue-400 to-cyan-400'
        };
      case 'shopping':
        return {
          gradient: 'from-green-500/20 via-emerald-500/10 to-green-600/20',
          border: 'border-green-500/30',
          text: 'text-green-400',
          bar: 'from-green-400 to-emerald-400'
        };
      case 'bank':
        return {
          gradient: 'from-orange-500/20 via-amber-500/10 to-orange-600/20',
          border: 'border-orange-500/30',
          text: 'text-orange-400',
          bar: 'from-orange-400 to-amber-400'
        };
      default:
        return {
          gradient: 'from-purple-500/20 via-violet-500/10 to-purple-600/20',
          border: 'border-purple-500/30',
          text: 'text-purple-400',
          bar: 'from-purple-400 to-violet-400'
        };
    }
  };

  const getCategoryName = () => {
    switch (category) {
      case 'utility': return 'Utility';
      case 'shopping': return 'Shopping';
      case 'bank': return 'Bank';
      default: return category;
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-800/50 rounded-2xl p-5 h-32">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-3"></div>
        <div className="h-2 bg-gray-700 rounded w-full mb-4"></div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-10 bg-gray-700 rounded"></div>
          <div className="h-10 bg-gray-700 rounded"></div>
          <div className="h-10 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !catData) {
    return null;
  }

  const style = getCategoryStyle();
  const usagePercent = catData.usage_percent || 0;
  const total = catData.total_limit || 0;
  const used = catData.used || 0;
  const remaining = catData.remaining || 0;

  return (
    <div className={`bg-gradient-to-br ${style.gradient} rounded-2xl p-5 border ${style.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={style.text}>{getCategoryIcon()}</span>
          <h3 className={`${style.text} font-semibold text-sm`}>
            {getCategoryName()} Limit
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">{Math.round(usagePercent)}% used</span>
          <button 
            onClick={fetchLimits}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <RefreshCw className={`w-3 h-3 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-700/50 rounded-full h-2 mb-4">
        <div 
          className={`bg-gradient-to-r ${style.bar} h-2 rounded-full transition-all`}
          style={{ width: `${Math.min(100, usagePercent)}%` }}
        />
      </div>

      {/* Limit Values - Total, Used, Available */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-white/80 text-[10px] uppercase font-medium">Total</p>
          <p className="text-white font-bold text-sm">{total.toLocaleString()}</p>
          <p className="text-white/60 text-[10px]">≈ ₹{Math.floor(total / prcRate).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-yellow-300 text-[10px] uppercase font-medium">Used</p>
          <p className="text-yellow-300 font-bold text-sm">{used.toLocaleString()}</p>
          <p className="text-yellow-300/70 text-[10px]">≈ ₹{Math.floor(used / prcRate).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-white/80 text-[10px] uppercase font-medium">Available</p>
          <p className={`${style.text} font-bold text-sm`}>{remaining.toLocaleString()}</p>
          <p className="text-white/60 text-[10px]">≈ ₹{Math.floor(remaining / prcRate).toLocaleString()}</p>
        </div>
      </div>

      {/* Carry Forward Badge */}
      {catData.carry_forward > 0 && (
        <div className="mt-3 pt-2 border-t border-white/10">
          <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
            +{catData.carry_forward?.toLocaleString()} PRC carry forward
          </span>
        </div>
      )}
    </div>
  );
};

export default CategoryLimitsDisplay;
