import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, Info, Calculator, AlertTriangle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Base rate for comparison (old rate)
const BASE_RATE = 10;

/**
 * PRC Rate Display Component
 * Shows current PRC rate with breakdown calculator
 * 
 * @param {number} amount - Amount in INR
 * @param {number} processingFee - Processing fee in INR (default 10)
 * @param {number} adminChargePercent - Admin charge percentage (default 20)
 * @param {boolean} showBreakdown - Show detailed breakdown
 * @param {boolean} showRateAlert - Show rate change alert
 * @param {string} serviceType - Type of service (bbps, gift, subscription, bank)
 */
const PRCRateDisplay = ({ 
  amount = 0, 
  processingFee = 10, 
  adminChargePercent = 20,
  showBreakdown = true,
  showRateAlert = true,
  serviceType = 'general'
}) => {
  const [currentRate, setCurrentRate] = useState(10);
  const [rateSource, setRateSource] = useState('default');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentRate();
  }, []);

  const fetchCurrentRate = async () => {
    try {
      const response = await axios.get(`${API}/admin/prc-rate/current`);
      if (response.data.success) {
        setCurrentRate(response.data.current_rate || 10);
        setRateSource(response.data.source || 'default');
      }
    } catch (error) {
      console.error('Error fetching PRC rate:', error);
      setCurrentRate(10);
    } finally {
      setLoading(false);
    }
  };

  // Calculate PRC values
  const amountInPRC = Math.round(amount * currentRate);
  const processingFeeInPRC = Math.round(processingFee * currentRate);
  const adminChargeINR = Math.round(amount * adminChargePercent / 100);
  const adminChargeInPRC = Math.round(adminChargeINR * currentRate);
  const totalPRC = amountInPRC + processingFeeInPRC + adminChargeInPRC;

  // Old rate calculation for comparison
  const oldTotalPRC = Math.round(amount * BASE_RATE) + Math.round(processingFee * BASE_RATE) + Math.round(adminChargeINR * BASE_RATE);
  const rateDifference = currentRate - BASE_RATE;
  const isRateHigher = rateDifference > 0;
  const isRateLower = rateDifference < 0;

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-800/50 rounded-xl p-4 h-32"></div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Rate Alert Banner */}
      {showRateAlert && rateDifference !== 0 && (
        <div className={`rounded-xl p-3 border ${
          isRateHigher 
            ? 'bg-amber-500/10 border-amber-500/30' 
            : 'bg-green-500/10 border-green-500/30'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${isRateHigher ? 'text-amber-400' : 'text-green-400'}`} />
            <span className={`text-sm font-medium ${isRateHigher ? 'text-amber-400' : 'text-green-400'}`}>
              PRC Rate Changed!
            </span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-gray-400">Before:</span>
              <span className="text-gray-300 font-mono">{BASE_RATE} PRC = ₹1</span>
            </div>
            <div className="flex items-center gap-1">
              {isRateHigher ? (
                <TrendingUp className="w-3 h-3 text-amber-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-green-400" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">Now:</span>
              <span className={`font-mono font-bold ${isRateHigher ? 'text-amber-400' : 'text-green-400'}`}>
                {currentRate} PRC = ₹1
              </span>
            </div>
          </div>
        </div>
      )}

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
                  ₹{adminChargeINR} × {currentRate} = <span className="text-yellow-400">+{adminChargeInPRC.toLocaleString()} PRC</span>
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

            {/* Comparison with old rate */}
            {rateDifference !== 0 && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Old rate (10 PRC = ₹1)</span>
                  <span className="text-gray-500 font-mono">{oldTotalPRC.toLocaleString()} PRC</span>
                </div>
                <div className="flex justify-between items-center text-xs mt-1">
                  <span className="text-gray-500">Difference</span>
                  <span className={`font-mono ${isRateHigher ? 'text-amber-400' : 'text-green-400'}`}>
                    {isRateHigher ? '+' : ''}{(totalPRC - oldTotalPRC).toLocaleString()} PRC
                  </span>
                </div>
              </div>
            )}
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
  const [currentRate, setCurrentRate] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const response = await axios.get(`${API}/admin/prc-rate/current`);
        if (response.data.success) {
          setCurrentRate(response.data.current_rate || 10);
        }
      } catch (error) {
        console.error('Error fetching rate:', error);
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
