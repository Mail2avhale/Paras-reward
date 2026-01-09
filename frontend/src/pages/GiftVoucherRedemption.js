import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, Gift, Clock, CheckCircle, XCircle, AlertCircle,
  Sparkles, Award, TrendingUp, Wallet
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const GiftVoucherRedemption = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [currentUser, setCurrentUser] = useState(user);
  const [selectedDenomination, setSelectedDenomination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    if (user.membership_type !== 'vip') {
      toast.error('VIP membership required to redeem gift vouchers');
      setTimeout(() => navigate('/vip-membership'), 2000);
      return;
    }
    
    fetchUserData();
    fetchRequests();
  }, [user, navigate]);

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/api/auth/user/${user.uid}`);
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await axios.get(`${API}/api/gift-voucher/requests/${user.uid}`);
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const denominations = [
    { value: 10, prc: 100, icon: '🎁', popular: false },
    { value: 50, prc: 500, icon: '🎉', popular: false },
    { value: 100, prc: 1000, icon: '💝', popular: true },
    { value: 500, prc: 5000, icon: '🌟', popular: true },
    { value: 1000, prc: 10000, icon: '💎', popular: false },
    { value: 5000, prc: 50000, icon: '👑', popular: false }
  ];

  const selectedInfo = denominations.find(d => d.value === selectedDenomination);
  const estimatedServiceCharge = selectedInfo ? selectedInfo.prc * 0.05 : 0;
  const totalPRC = selectedInfo ? selectedInfo.prc + estimatedServiceCharge : 0;

  const handleRedeem = async () => {
    if (!selectedDenomination) {
      toast.error('Please select a denomination');
      return;
    }

    if (currentUser.prc_balance < totalPRC) {
      toast.error(`Insufficient PRC balance. Required: ${totalPRC.toFixed(2)} PRC`);
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/api/gift-voucher/request`, {
        user_id: user.uid,
        denomination: selectedDenomination
      });
      toast.success('Voucher redemption request submitted!');
      setSelectedDenomination(null);
      fetchUserData();
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to redeem voucher');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const configs = {
      pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: Clock },
      completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle },
      rejected: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle }
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-500" />
              Gift Vouchers
            </h1>
            <p className="text-gray-500 text-sm">Redeem PRC for PhonePe vouchers</p>
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <div className="px-5 mb-6">
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-2xl p-5 border border-amber-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Available PRC Balance</p>
              <p className="text-3xl font-bold text-amber-500">{currentUser?.prc_balance?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
              <Wallet className="w-7 h-7 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Denominations */}
      <div className="px-5 mb-6">
        <h2 className="text-white font-bold mb-4">Select Voucher Amount</h2>
        <div className="grid grid-cols-3 gap-3">
          {denominations.map((denom) => (
            <button
              key={denom.value}
              onClick={() => setSelectedDenomination(denom.value)}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                selectedDenomination === denom.value
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
              }`}
            >
              {denom.popular && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Popular
                </div>
              )}
              <div className="text-2xl mb-1">{denom.icon}</div>
              <div className={`text-lg font-bold ${selectedDenomination === denom.value ? 'text-amber-400' : 'text-white'}`}>
                ₹{denom.value}
              </div>
              <div className="text-xs text-gray-500">{denom.prc} PRC</div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Info */}
      {selectedInfo && (
        <div className="px-5 mb-6">
          <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800">
            <h3 className="text-white font-bold mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Voucher Value:</span>
                <span className="text-white font-semibold">₹{selectedInfo.value}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">PRC Required:</span>
                <span className="text-white">{selectedInfo.prc} PRC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Service Charge (~5%):</span>
                <span className="text-white">{estimatedServiceCharge.toFixed(2)} PRC</span>
              </div>
              <div className="border-t border-gray-800 pt-2 flex justify-between">
                <span className="text-white font-bold">Total:</span>
                <span className="text-amber-500 font-bold">{totalPRC.toFixed(2)} PRC</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Redeem Button */}
      <div className="px-5 mb-6">
        <button
          onClick={handleRedeem}
          disabled={loading || !selectedDenomination}
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-900 font-bold rounded-xl flex items-center justify-center gap-2 hover:from-amber-400 hover:to-amber-500 transition-all disabled:opacity-50"
        >
          <Gift className="w-5 h-5" />
          {loading ? 'Processing...' : 'Redeem Voucher'}
        </button>
      </div>

      {/* Benefits */}
      <div className="px-5 mb-6">
        <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Why PhonePe Vouchers?
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Award, text: 'Use anywhere' },
              { icon: TrendingUp, text: 'Multiple amounts' },
              { icon: CheckCircle, text: 'Fast processing' },
              { icon: Gift, text: 'Perfect for gifts' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-gray-400 text-sm">
                <item.icon className="w-4 h-4 text-amber-500" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="px-5">
        <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold">Voucher History</h2>
            <p className="text-gray-500 text-xs">Processing: 3-7 days</p>
          </div>
          
          {requests.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="w-12 h-12 mx-auto text-gray-700 mb-3" />
              <p className="text-gray-500">No voucher requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((req) => (
                <div key={req.request_id} className="bg-gray-800/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{denominations.find(d => d.value === req.denomination)?.icon || '🎁'}</span>
                      <div>
                        <p className="text-white font-semibold">₹{req.denomination} Voucher</p>
                        <p className="text-gray-500 text-xs">{new Date(req.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {getStatusBadge(req.status)}
                  </div>
                  
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-500">PRC Deducted:</span>
                    <span className="text-amber-500 font-semibold">{req.total_prc_deducted?.toFixed(2)} PRC</span>
                  </div>
                  
                  {req.voucher_code && (
                    <div className="mt-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                      <p className="text-emerald-400 text-xs mb-1">Voucher Code</p>
                      <p className="text-emerald-300 font-mono font-bold text-lg">{req.voucher_code}</p>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Pagination */}
              {requests.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                  <p className="text-gray-500 text-sm">
                    {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, requests.length)} of {requests.length}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1.5 bg-amber-500/20 text-amber-500 rounded-lg text-sm font-medium">
                      {currentPage}/{Math.ceil(requests.length / itemsPerPage)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(requests.length / itemsPerPage), p + 1))}
                      disabled={currentPage >= Math.ceil(requests.length / itemsPerPage)}
                      className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GiftVoucherRedemption;
