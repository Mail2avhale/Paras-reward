import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle, Zap } from 'lucide-react';

const PRCExpiryTimer = ({ miningHistory, isFreeUser }) => {
  const [expiringPRC, setExpiringPRC] = useState([]);
  const [urgentWarning, setUrgentWarning] = useState(false);

  useEffect(() => {
    if (!isFreeUser || !miningHistory || miningHistory.length === 0) {
      return;
    }

    const now = new Date();
    const expiring = [];
    let hasUrgent = false;

    miningHistory.forEach(entry => {
      if (entry.burned) return;

      try {
        const mineTime = new Date(entry.timestamp);
        const expiryTime = new Date(mineTime.getTime() + 48 * 60 * 60 * 1000); // 48 hours
        const timeLeft = expiryTime - now;

        if (timeLeft > 0 && timeLeft < 48 * 60 * 60 * 1000) {
          const hours = Math.floor(timeLeft / (60 * 60 * 1000));
          const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

          expiring.push({
            amount: entry.amount,
            hoursLeft: hours,
            minutesLeft: minutes,
            isUrgent: hours < 12 // Less than 12 hours
          });

          if (hours < 12) hasUrgent = true;
        }
      } catch (error) {
        console.error('Error parsing expiry:', error);
      }
    });

    // Sort by time left (most urgent first)
    expiring.sort((a, b) => a.hoursLeft - b.hoursLeft);

    setExpiringPRC(expiring);
    setUrgentWarning(hasUrgent);
  }, [miningHistory, isFreeUser]);

  if (!isFreeUser || expiringPRC.length === 0) {
    return null;
  }

  // Find the most urgent (first to expire)
  const mostUrgent = expiringPRC[0];
  const totalExpiring = expiringPRC.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className={`rounded-2xl p-4 shadow-lg mb-6 ${
      urgentWarning 
        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white' 
        : 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${urgentWarning ? 'bg-white/20' : 'bg-white/30'}`}>
          {urgentWarning ? (
            <AlertCircle className="w-6 h-6 animate-pulse" />
          ) : (
            <Clock className="w-6 h-6" />
          )}
        </div>
        
        <div className="flex-1">
          <h3 className="font-bold text-lg mb-1">
            {urgentWarning ? '⚠️ Urgent: PRC Expiring Soon!' : '⏰ PRC Expiry Notice'}
          </h3>
          
          <p className="text-sm opacity-90 mb-3">
            {urgentWarning 
              ? `${totalExpiring.toFixed(2)} PRC will be burned soon!` 
              : `${totalExpiring.toFixed(2)} PRC expires in the next 48 hours`
            }
          </p>

          {/* Most Urgent Entry */}
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Next to expire:</p>
                <p className="text-2xl font-bold">
                  {mostUrgent.amount.toFixed(2)} PRC
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-80">Time left:</p>
                <p className="text-xl font-bold">
                  {mostUrgent.hoursLeft}h {mostUrgent.minutesLeft}m
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => window.location.href = '/marketplace'}
              className="flex items-center gap-2 bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-opacity-90 transition-all"
            >
              🛒 Use Now in Marketplace
            </button>
            <button
              onClick={() => window.location.href = '/subscription'}
              className="flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-white/30 transition-all border border-white/30"
            >
              <Zap className="w-4 h-4" />
              Upgrade to VIP (Lifetime Validity)
            </button>
          </div>

          {/* Info */}
          <p className="text-xs mt-3 opacity-80">
            💡 Free users: PRC expires after 48 hours. Upgrade to VIP for lifetime validity!
          </p>
        </div>
      </div>
    </div>
  );
};

export default PRCExpiryTimer;
