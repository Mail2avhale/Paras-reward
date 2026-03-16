import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Zap, ShoppingBag, Landmark, ChevronDown, ChevronUp, Info, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Category Limits Display Component
 * Shows user's redeem limits by category: Utility, Shopping, Bank
 */
const CategoryLimitsDisplay = ({ userId, compact = false, showRefresh = true }) => {
  const [limits, setLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userId) {
      fetchLimits();
    }
  }, [userId]);

  const fetchLimits = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API}/redeem-categories/user/${userId}`);
      if (response.data.success) {
        setLimits(response.data);
      }
    } catch (err) {
      console.error('Error fetching category limits:', err);
      setError('Failed to load limits');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'utility':
        return <Zap className="w-4 h-4" />;
      case 'shopping':
        return <ShoppingBag className="w-4 h-4" />;
      case 'bank':
        return <Landmark className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'utility':
        return { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', bar: 'bg-blue-500' };
      case 'shopping':
        return { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', bar: 'bg-green-500' };
      case 'bank':
        return { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', bar: 'bg-orange-500' };
      default:
        return { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400', bar: 'bg-gray-500' };
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-800/50 rounded-xl p-4">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-3"></div>
        <div className="space-y-2">
          <div className="h-8 bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
        {error}
        <button onClick={fetchLimits} className="ml-2 underline">Retry</button>
      </div>
    );
  }

  if (!limits || !limits.categories) {
    return null;
  }

  const categories = limits.categories;

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-700/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">Monthly Redeem Limits</span>
          <span className="text-xs text-gray-500">
            (Total: {limits.total_limit?.toLocaleString()} PRC)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showRefresh && (
            <button 
              onClick={(e) => { e.stopPropagation(); fetchLimits(); }}
              className="p-1 hover:bg-gray-600 rounded transition-colors"
            >
              <RefreshCw className={`w-3 h-3 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Category Limits */}
      {expanded && (
        <div className="p-3 pt-0 space-y-3">
          {Object.entries(categories).map(([key, cat]) => {
            const colors = getCategoryColor(key);
            const usagePercent = cat.usage_percent || 0;
            
            return (
              <div 
                key={key} 
                className={`${colors.bg} ${colors.border} border rounded-lg p-3`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`${colors.text}`}>
                      {getCategoryIcon(key)}
                    </div>
                    <div>
                      <span className={`text-sm font-medium ${colors.text}`}>{cat.name}</span>
                      <span className="text-xs text-gray-500 ml-1">({cat.percentage}%)</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${colors.text}`}>
                      {cat.remaining?.toLocaleString()} PRC
                    </span>
                    <span className="text-xs text-gray-500 block">
                      remaining
                    </span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`h-full ${colors.bar} transition-all duration-500`}
                    style={{ width: `${Math.min(100, usagePercent)}%` }}
                  />
                </div>
                
                {/* Details */}
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Used: {cat.used?.toLocaleString()} PRC</span>
                  <span>Limit: {cat.total_limit?.toLocaleString()} PRC</span>
                </div>
                
                {/* Carry Forward Badge */}
                {cat.carry_forward > 0 && (
                  <div className="mt-2 text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded inline-block">
                    +{cat.carry_forward?.toLocaleString()} PRC carry forward
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Description */}
          <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-900/50 rounded">
            <p><strong>Utility:</strong> Gift Vouchers, BBPS, Subscription & Others</p>
            <p><strong>Shopping:</strong> E-commerce Products (Coming Soon)</p>
            <p><strong>Bank:</strong> Bank Transfer & Withdrawal</p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact Category Badge - Shows just remaining limit for a specific category
 */
export const CategoryLimitBadge = ({ userId, category, showLabel = true }) => {
  const [remaining, setRemaining] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchLimit();
    }
  }, [userId, category]);

  const fetchLimit = async () => {
    try {
      const response = await axios.get(`${API}/redeem-categories/user/${userId}`);
      if (response.data.success && response.data.categories) {
        const catData = response.data.categories[category];
        setRemaining(catData?.remaining || 0);
      }
    } catch (err) {
      console.error('Error fetching limit:', err);
    } finally {
      setLoading(false);
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

  const getColor = () => {
    switch (category) {
      case 'utility': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'shopping': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'bank': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  if (loading) {
    return <div className="animate-pulse h-6 w-24 bg-gray-700 rounded-full"></div>;
  }

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getColor()}`}>
      {showLabel && <span>{getCategoryName()}:</span>}
      <span className="font-bold">{remaining?.toLocaleString()} PRC</span>
    </div>
  );
};

export default CategoryLimitsDisplay;
