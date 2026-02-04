import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crown, Search, Filter, CheckCircle, XCircle, Clock, 
  User, Mail, Calendar, Gift, AlertCircle, ChevronDown,
  Smartphone, Bike, Car, Eye, RefreshCw, TrendingUp
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const PRODUCT_ICONS = {
  mobile: Smartphone,
  bike: Bike,
  car: Car
};

const PRODUCT_COLORS = {
  mobile: 'blue',
  bike: 'purple',
  car: 'amber'
};

const AdminLuxuryClaims = () => {
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showForceRedeemModal, setShowForceRedeemModal] = useState(false);
  const [forceRedeemUser, setForceRedeemUser] = useState(null);

  const admin = JSON.parse(localStorage.getItem('paras_user') || '{}');

  const fetchClaims = useCallback(async () => {
    try {
      setLoading(true);
      const url = filter === 'all' 
        ? `${API}/api/admin/luxury-claims`
        : `${API}/api/admin/luxury-claims?status=${filter}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      setClaims(data.claims || []);
      setStats(data.stats || { total: 0, pending: 0, approved: 0, rejected: 0 });
    } catch (error) {
      console.error('Error fetching claims:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleApprove = async (claimId) => {
    if (!window.confirm('Are you sure you want to APPROVE this claim?')) return;
    
    try {
      setProcessing(true);
      const response = await fetch(`${API}/api/admin/luxury-claims/${claimId}/approve?admin_id=${admin.uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Approved by admin' })
      });
      
      const data = await response.json();
      if (data.success) {
        alert('✅ Claim approved successfully!');
        fetchClaims();
      } else {
        alert(data.detail || 'Failed to approve');
      }
    } catch (error) {
      alert('Error approving claim');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please enter a reject reason');
      return;
    }
    
    try {
      setProcessing(true);
      const response = await fetch(`${API}/api/admin/luxury-claims/${selectedClaim.claim_id}/reject?admin_id=${admin.uid}&reason=${encodeURIComponent(rejectReason)}`, {
        method: 'POST'
      });
      
      const data = await response.json();
      if (data.success) {
        alert('❌ Claim rejected');
        setShowRejectModal(false);
        setRejectReason('');
        setSelectedClaim(null);
        fetchClaims();
      } else {
        alert(data.detail || 'Failed to reject');
      }
    } catch (error) {
      alert('Error rejecting claim');
    } finally {
      setProcessing(false);
    }
  };

  const handleForceRedeem = async (userId, productKey) => {
    try {
      setProcessing(true);
      const response = await fetch(
        `${API}/api/admin/luxury-claims/force-redeem/${userId}/${productKey}?admin_id=${admin.uid}`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      if (data.success) {
        alert(`✅ Force redeemed at ${data.completion_percent}% completion!`);
        setShowForceRedeemModal(false);
        fetchClaims();
      } else {
        alert(data.detail || 'Failed to force redeem');
      }
    } catch (error) {
      alert('Error in force redeem');
    } finally {
      setProcessing(false);
    }
  };

  const filteredClaims = claims.filter(claim => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      claim.user_name?.toLowerCase().includes(search) ||
      claim.user_email?.toLowerCase().includes(search) ||
      claim.claim_id?.toLowerCase().includes(search) ||
      claim.product_name?.toLowerCase().includes(search)
    );
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Luxury Claims</h1>
            <p className="text-gray-400 text-sm">Manage luxury product redemption requests</p>
          </div>
        </div>
        <button
          onClick={fetchClaims}
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Total</span>
            <Gift className="w-5 h-5 text-gray-500" />
          </div>
          <p className="text-2xl font-bold mt-2">{stats.total}</p>
        </div>
        <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-500/30">
          <div className="flex items-center justify-between">
            <span className="text-yellow-400 text-sm">Pending</span>
            <Clock className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-yellow-400">{stats.pending}</p>
        </div>
        <div className="bg-green-900/20 rounded-xl p-4 border border-green-500/30">
          <div className="flex items-center justify-between">
            <span className="text-green-400 text-sm">Approved</span>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-green-400">{stats.approved}</p>
        </div>
        <div className="bg-red-900/20 rounded-xl p-4 border border-red-500/30">
          <div className="flex items-center justify-between">
            <span className="text-red-400 text-sm">Rejected</span>
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-red-400">{stats.rejected}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, email, claim ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:border-amber-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                filter === status
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Force Redeem Button */}
      <button
        onClick={() => setShowForceRedeemModal(true)}
        className="mb-6 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-medium hover:opacity-90 flex items-center gap-2"
      >
        <TrendingUp className="w-4 h-4" />
        Force Redeem (Admin Override)
      </button>

      {/* Claims List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Gift className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No claims found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredClaims.map((claim) => {
            const ProductIcon = PRODUCT_ICONS[claim.product_key] || Gift;
            const color = PRODUCT_COLORS[claim.product_key] || 'gray';
            
            return (
              <motion.div
                key={claim.claim_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-gray-900 rounded-xl border overflow-hidden ${
                  claim.status === 'pending' ? 'border-yellow-500/50' :
                  claim.status === 'approved' ? 'border-green-500/30' :
                  'border-red-500/30'
                }`}
              >
                {/* Header */}
                <div className={`p-4 flex items-center justify-between bg-gradient-to-r ${
                  color === 'blue' ? 'from-blue-900/30 to-blue-800/20' :
                  color === 'purple' ? 'from-purple-900/30 to-purple-800/20' :
                  'from-amber-900/30 to-amber-800/20'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      color === 'blue' ? 'bg-blue-500/30' :
                      color === 'purple' ? 'bg-purple-500/30' :
                      'bg-amber-500/30'
                    }`}>
                      <ProductIcon className={`w-5 h-5 ${
                        color === 'blue' ? 'text-blue-400' :
                        color === 'purple' ? 'text-purple-400' :
                        'text-amber-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-bold">{claim.product_name}</h3>
                      <p className="text-gray-400 text-xs">ID: {claim.claim_id}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    claim.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    claim.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {claim.status?.toUpperCase()}
                  </span>
                </div>

                {/* Body */}
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-gray-500 text-xs">User</p>
                    <p className="font-medium flex items-center gap-1">
                      <User className="w-4 h-4 text-gray-500" />
                      {claim.user_name}
                    </p>
                    <p className="text-gray-400 text-xs flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {claim.user_email}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Product Price</p>
                    <p className="font-bold text-lg">{formatCurrency(claim.product_price_inr)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Down Payment</p>
                    <p className="font-bold text-amber-400">{formatCurrency(claim.down_payment_inr)}</p>
                    <p className="text-gray-500 text-xs">{claim.down_payment_prc?.toLocaleString()} PRC</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Completion</p>
                    <p className={`font-bold text-lg ${
                      claim.completion_percent >= 100 ? 'text-green-400' :
                      claim.completion_percent >= 50 ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>
                      {claim.completion_percent?.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-gray-800/50 flex items-center justify-between">
                  <div className="text-gray-500 text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(claim.created_at)}
                  </div>
                  
                  {claim.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(claim.claim_id)}
                        disabled={processing}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => { setSelectedClaim(claim); setShowRejectModal(true); }}
                        disabled={processing}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                  
                  {claim.status === 'rejected' && claim.reject_reason && (
                    <div className="text-red-400 text-xs">
                      Reason: {claim.reject_reason}
                    </div>
                  )}
                  
                  {claim.txn_number && (
                    <div className="text-green-400 text-xs">
                      TXN: {claim.txn_number}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-500" />
                </div>
                <h2 className="text-xl font-bold">Reject Claim</h2>
              </div>
              
              <p className="text-gray-400 mb-4">
                Rejecting claim for <span className="text-white font-medium">{selectedClaim?.product_name}</span> by {selectedClaim?.user_name}
              </p>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Rejection Reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-red-500 outline-none resize-none"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 py-3 bg-gray-800 rounded-xl hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing || !rejectReason.trim()}
                  className="flex-1 py-3 bg-red-600 rounded-xl hover:bg-red-500 font-medium disabled:opacity-50"
                >
                  {processing ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Force Redeem Modal */}
      <AnimatePresence>
        {showForceRedeemModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowForceRedeemModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-purple-500/30"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
                <h2 className="text-xl font-bold">Force Redeem</h2>
              </div>
              
              <p className="text-gray-400 mb-4">
                Force approve a user&apos;s luxury claim even if below 50% completion. Enter user ID and select product.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">User ID *</label>
                <input
                  type="text"
                  value={forceRedeemUser?.userId || ''}
                  onChange={(e) => setForceRedeemUser({ ...forceRedeemUser, userId: e.target.value })}
                  placeholder="Enter user UID..."
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-purple-500 outline-none"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Product *</label>
                <div className="grid grid-cols-3 gap-2">
                  {['mobile', 'bike', 'car'].map((product) => {
                    const Icon = PRODUCT_ICONS[product];
                    return (
                      <button
                        key={product}
                        onClick={() => setForceRedeemUser({ ...forceRedeemUser, product })}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1 ${
                          forceRedeemUser?.product === product
                            ? 'border-purple-500 bg-purple-500/20'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs capitalize">{product}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowForceRedeemModal(false)}
                  className="flex-1 py-3 bg-gray-800 rounded-xl hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleForceRedeem(forceRedeemUser?.userId, forceRedeemUser?.product)}
                  disabled={processing || !forceRedeemUser?.userId || !forceRedeemUser?.product}
                  className="flex-1 py-3 bg-purple-600 rounded-xl hover:bg-purple-500 font-medium disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Force Redeem'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminLuxuryClaims;
