import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Info, Calculator, TrendingUp } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Base rate for reference (old rate) - kept for change indicator only
const BASE_RATE = 10;

/**
 * PRC Rate Display Component
 * Shows current PRC rate with breakdown calculator
 * 
 * @param {number} amount - Amount in INR
 * @param {number} processingFee - Processing fee in INR (default 10)
 * @param {number} adminChargePercent - Admin charge percentage (default 20)
 * @param {number} burnRate - Burn rate percentage (0 = no burn, 5 = PRC plan burn)
 * @param {boolean} showBreakdown - Show detailed breakdown
 * @param {string} serviceType - Type of service (bbps, gift, subscription, bank)
 */
const PRCRateDisplay = ({ 
  amount = 0, 
  processingFee = 10, 
  adminChargePercent = 20,
  burnRate = 0,
  showBreakdown = true,
  serviceType = 'general'
}) => {
  const [currentRate, setCurrentRate] = useState(null);
  const [rateSource, setRateSource] = useState('default');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentRate();
  }, []);

  const fetchCurrentRate = async () => {
    try {
      // Try public economy endpoint first (always accessible)
      const econRes = await axios.get(`${API}/prc-economy/current-rate`);
      if (econRes.data?.success && econRes.data?.rate?.final_rate) {
        setCurrentRate(econRes.data.rate.final_rate);
        setRateSource('dynamic_economy');
        setLoading(false);
        return;
      }
    } catch (err) {
      // Continue to next fallback
    }
    
    try {
      // Fallback to elite-pricing
      const priceRes = await axios.get(`${API}/subscription/elite-pricing`);
      if (priceRes.data?.pricing?.prc_rate) {
        setCurrentRate(priceRes.data.pricing.prc_rate);
        setRateSource('elite_pricing');
        setLoading(false);
        return;
      }
    } catch (err2) {
      // Continue to next fallback
    }
    
    try {
      // Final fallback: admin endpoint (may need auth)
      const response = await axios.get(`${API}/admin/prc-rate/current`);
      if (response.data.success) {
        setCurrentRate(response.data.current_rate);
        setRateSource(response.data.source || 'default');
      }
    } catch (err3) {
      console.error('All PRC rate endpoints failed');
    }
    
    setLoading(false);
  };

  // Calculate PRC values - admin charge on amount only (matches backend formula)
  const amountInPRC = Math.round(amount * currentRate);
  const processingFeeInPRC = Math.round(processingFee * currentRate);
  const adminChargeInPRC = Math.round(amount * adminChargePercent / 100 * currentRate);
  const totalBeforeBurn = amountInPRC + processingFeeInPRC + adminChargeInPRC;
  const burnPRC = Math.round(totalBeforeBurn * burnRate / 100);
  const totalPRC = totalBeforeBurn + burnPRC;

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-800/50 rounded-xl p-4 h-32"></div>
    );
  }

  return (
    <div className="space-y-3">
      {/* REMOVED: Rate Alert Banner ("PRC Rate Changed!") - per user request */}

      {/* Current Rate Display */}
      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Calculator className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Current PRC Rate</p>
              <p className="text-lg font-bold text-purple-400">{currentRate} PRC = ₹1</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">
              {rateSource === 'manual_override' ? '(Manual)' : '(Dynamic)'}
            </p>
          </div>
        </div>
      </div>

      {/* Breakdown Calculator */}
      {showBreakdown && amount > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">PRC Calculation Breakdown</span>
          </div>
          
          <div className="space-y-2 text-sm">
            {/* Amount Row */}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Amount (₹{amount})</span>
              <span className="text-gray-300 font-mono">
                ₹{amount} × {currentRate} = <span className="text-white font-bold">{amountInPRC.toLocaleString()} PRC</span>
              </span>
            </div>
            
            {/* Processing Fee Row */}
            {processingFee > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Processing Fee (₹{processingFee})</span>
                <span className="text-gray-300 font-mono">
                  ₹{processingFee} × {currentRate} = <span className="text-orange-400">+{processingFeeInPRC.toLocaleString()} PRC</span>
                </span>
              </div>
            )}
            
            {/* Admin Charge Row */}
            {adminChargePercent > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Admin Charge ({adminChargePercent}%)</span>
                <span className="text-gray-300 font-mono">
                  <span className="text-yellow-400">+{adminChargeInPRC.toLocaleString()} PRC</span>
                </span>
              </div>
            )}

            {/* Burning Row */}
            {burnRate > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Burning ({burnRate}%)</span>
                <span className="text-gray-300 font-mono">
                  <span className="text-red-400">+{burnPRC.toLocaleString()} PRC</span>
                </span>
              </div>
            )}
            
            {/* Divider */}
            <div className="border-t border-gray-600 my-2"></div>
            
            {/* Total Row */}
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">Total PRC</span>
              <span className="text-xl font-bold text-green-400">{totalPRC.toLocaleString()} PRC</span>
            </div>

            {/* REMOVED: Comparison with old rate - per user request */}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact PRC Rate Badge - For showing just the current rate
 */
export const PRCRateBadge = () => {
  const [currentRate, setCurrentRate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const response = await axios.get(`${API}/prc-economy/current-rate`);
        if (response.data?.success && response.data?.rate?.final_rate) {
          setCurrentRate(response.data.rate.final_rate);
        }
      } catch (error) {
        try {
          const res2 = await axios.get(`${API}/subscription/elite-pricing`);
          if (res2.data?.pricing?.prc_rate) setCurrentRate(res2.data.pricing.prc_rate);
        } catch (err2) {
          console.error('PRC rate fetch failed');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchRate();
  }, []);

  if (loading) return null;

  const isChanged = currentRate !== BASE_RATE;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      isChanged 
        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
        : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
    }`}>
      <Calculator className="w-3 h-3" />
      <span>{currentRate} PRC = ₹1</span>
      {isChanged && currentRate > BASE_RATE && <TrendingUp className="w-3 h-3" />}
      {isChanged && currentRate < BASE_RATE && <TrendingDown className="w-3 h-3" />}
    </div>
  );
};

export default PRCRateDisplay;
