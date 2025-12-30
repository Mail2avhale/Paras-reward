import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  ArrowLeft, Gift, Clock, CheckCircle, XCircle, AlertCircle,
  Sparkles, Award, TrendingUp
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
    
    // Check VIP membership
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
    { value: 10, prc: 100, icon: '🎁', color: 'blue', popular: false },
    { value: 50, prc: 500, icon: '🎉', color: 'green', popular: false },
    { value: 100, prc: 1000, icon: '💝', color: 'purple', popular: true },
    { value: 500, prc: 5000, icon: '🌟', color: 'yellow', popular: true },
    { value: 1000, prc: 10000, icon: '💎', color: 'pink', popular: false },
    { value: 5000, prc: 50000, icon: '👑', color: 'red', popular: false }
  ];

  const selectedInfo = denominations.find(d => d.value === selectedDenomination);
  const estimatedServiceCharge = selectedInfo ? selectedInfo.prc * 0.05 : 0; // Default 5%
  const totalPRC = selectedInfo ? selectedInfo.prc + estimatedServiceCharge : 0;

  const handleRedeem = async () => {
    if (!selectedDenomination) {
      toast.error('Please select a denomination');
      return;
    }

    // Check PRC balance
    if (currentUser.prc_balance < totalPRC) {
      toast.error(`Insufficient PRC balance. Required: ${totalPRC.toFixed(2)} PRC, Available: ${currentUser.prc_balance?.toFixed(2) || 0} PRC`);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/gift-voucher/request`, {
        user_id: user.uid,
        denomination: selectedDenomination
      });

      toast.success('Voucher request submitted!', {
        description: 'Admin will process and provide your voucher code shortly',
        duration: 5000
      });

      setSelectedDenomination(null);
      fetchRequests();
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
                <Gift className="h-8 w-8 text-purple-600" />
                PhonePe Gift Vouchers
              </h1>
              <p className="text-gray-600 text-sm mt-1">Redeem your PRC for PhonePe gift vouchers</p>
            </div>
          </div>
          <Button
            onClick={() => {
              if (window.confirm('Are you sure you want to logout?')) {
                onLogout();
                navigate('/login');
              }
            }}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Denominations */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Select Denomination</h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {denominations.map((denom) => (
                  <button
                    key={denom.value}
                    onClick={() => setSelectedDenomination(denom.value)}
                    className={`relative p-6 rounded-xl border-2 transition-all hover:scale-105 ${
                      selectedDenomination === denom.value
                        ? `border-${denom.color}-500 bg-${denom.color}-50 shadow-lg`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {denom.popular && (
                      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        Popular
                      </div>
                    )}
                    <div className="text-4xl mb-2">{denom.icon}</div>
                    <div className="text-2xl font-bold text-gray-900">₹{denom.value}</div>
                    <div className="text-xs text-gray-600 mt-1">{denom.prc} PRC</div>
                  </button>
                ))}
              </div>

              {/* Selected Info */}
              {selectedInfo && (
                <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-6 mb-4">
                  <h3 className="font-bold text-gray-900 mb-3">Selected Voucher</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Voucher Value:</span>
                      <span className="font-bold text-gray-900">₹{selectedInfo.value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">PRC Required:</span>
                      <span className="font-semibold text-gray-900">{selectedInfo.prc} PRC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Service Charge (~5%):</span>
                      <span className="font-semibold text-gray-900">{estimatedServiceCharge.toFixed(2)} PRC</span>
                    </div>
                    <div className="border-t border-purple-300 pt-2 flex justify-between">
                      <span className="font-bold text-gray-900">Total PRC:</span>
                      <span className="font-bold text-purple-700">{totalPRC.toFixed(2)} PRC</span>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleRedeem}
                disabled={loading || !selectedDenomination}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg py-6"
              >
                <Gift className="h-5 w-5 mr-2" />
                {loading ? 'Processing...' : 'Redeem Voucher'}
              </Button>
            </Card>
          </div>

          {/* Right: Balance & Info */}
          <div className="space-y-6">
            {/* PRC Balance */}
            <Card className="p-6 bg-gradient-to-br from-purple-500 to-pink-600 text-white">
              <p className="text-sm opacity-90 mb-2">Available PRC Balance</p>
              <p className="text-4xl font-bold">{currentUser?.prc_balance?.toFixed(2) || '0.00'}</p>
              <p className="text-xs opacity-75 mt-2">Redeem for PhonePe vouchers</p>
            </Card>

            {/* Benefits */}
            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Why PhonePe Vouchers?
              </h3>
              <ul className="text-sm text-gray-700 space-y-2">
                <li className="flex items-start gap-2">
                  <Award className="h-4 w-4 text-purple-600 mt-0.5" />
                  <span>Use anywhere PhonePe accepted</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-600 mt-0.5" />
                  <span>Multiple denominations available</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600 mt-0.5" />
                  <span>Instant processing by admin</span>
                </li>
                <li className="flex items-start gap-2">
                  <Gift className="h-4 w-4 text-purple-600 mt-0.5" />
                  <span>Perfect for gifting</span>
                </li>
              </ul>
            </Card>

            {/* How it Works */}
            <Card className="p-6 bg-blue-50">
              <h3 className="font-bold text-gray-900 mb-3">How It Works</h3>
              <ol className="text-sm text-gray-700 space-y-2">
                <li>1. Select denomination</li>
                <li>2. PRC deducted immediately</li>
                <li>3. Admin approves request</li>
                <li>4. Get voucher code</li>
                <li>5. Use on PhonePe app</li>
              </ol>
            </Card>
          </div>
        </div>

        {/* Request History */}
        <Card className="p-6 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Voucher History</h2>
          
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No voucher requests yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => (
                <div
                  key={req.request_id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {denominations.find(d => d.value === req.denomination)?.icon || '🎁'}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">₹{req.denomination} Voucher</p>
                        <p className="text-xs text-gray-600">
                          {new Date(req.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(req.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                    <div>
                      <p className="text-gray-600">PRC Deducted</p>
                      <p className="font-semibold text-gray-900">{req.total_prc_deducted.toFixed(2)} PRC</p>
                    </div>
                    {req.voucher_code && (
                      <div>
                        <p className="text-gray-600">Voucher Code</p>
                        <p className="font-mono font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
                          {req.voucher_code}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {req.admin_notes && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded text-xs text-gray-700">
                      <strong>Note:</strong> {req.admin_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default GiftVoucherRedemption;
