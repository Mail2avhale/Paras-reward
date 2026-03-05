import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Smartphone, Tv, Zap, Flame, Cylinder, CreditCard, Building, 
  Search, Filter, ChevronLeft, ChevronRight, RefreshCw, Check, X,
  Clock, AlertCircle, CheckCircle, XCircle, Loader2, Eye, Play,
  Calendar, DollarSign, User, FileText
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Service tabs
const SERVICE_TABS = [
  { id: 'all', name: 'All', icon: FileText },
  { id: 'mobile_recharge', name: 'Mobile', icon: Smartphone },
  { id: 'dth', name: 'DTH', icon: Tv },
  { id: 'electricity', name: 'Electricity', icon: Zap },
  { id: 'gas', name: 'Gas', icon: Flame },
  { id: 'lpg', name: 'LPG', icon: Cylinder },
  { id: 'emi', name: 'EMI', icon: Building },
  { id: 'credit_card', name: 'Credit Card', icon: CreditCard },
  { id: 'dmt', name: 'Bank Transfer', icon: Building },
];

// Status badges
const STATUS_CONFIG = {
  pending: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock, label: 'Pending' },
  processing: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Loader2, label: 'Processing' },
  completed: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle, label: 'Failed' },
  rejected: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: X, label: 'Rejected' },
};

export default function AdminRedeemPage() {
  // Get user from localStorage
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const storedUser = localStorage.getItem('paras_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);
  
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  
  // Filters
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Selected request for detail view
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  // PIN modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState(null); // { type: 'process' | 'reject', requestId: '' }
  const [pin, setPin] = useState('');
  const [rejectReason, setRejectReason] = useState('BY ADMIN');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      
      if (activeTab !== 'all') params.append('service_type', activeTab);
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      if (minAmount) params.append('min_amount', minAmount);
      if (maxAmount) params.append('max_amount', maxAmount);
      
      const res = await axios.get(`${API}/redeem/admin/requests?${params.toString()}`);
      
      if (res.data.success) {
        setRequests(res.data.requests || []);
        setStats(res.data.stats);
        setTotalPages(res.data.pagination?.pages || 1);
        setTotal(res.data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, statusFilter, searchQuery, minAmount, maxAmount]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleProcess = async () => {
    if (pin !== '123456') {
      toast.error('Invalid PIN');
      return;
    }
    
    setProcessing(pinAction.requestId);
    setShowPinModal(false);
    
    try {
      const res = await axios.post(`${API}/redeem/admin/process/${pinAction.requestId}`, null, {
        params: { admin_uid: user.uid, admin_pin: pin }
      });
      
      if (res.data.success) {
        toast.success(`Request ${res.data.status === 'completed' ? 'completed' : 'processing'}`);
        fetchRequests();
      } else {
        toast.error(res.data.error || 'Processing failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Processing failed');
    } finally {
      setProcessing(null);
      setPin('');
    }
  };

  const handleReject = async () => {
    if (pin !== '123456') {
      toast.error('Invalid PIN');
      return;
    }
    
    setProcessing(pinAction.requestId);
    setShowPinModal(false);
    
    try {
      const res = await axios.post(`${API}/redeem/admin/reject/${pinAction.requestId}`, null, {
        params: { admin_uid: user.uid, admin_pin: pin, reason: rejectReason }
      });
      
      if (res.data.success) {
        toast.success(`Rejected. PRC ₹${res.data.prc_refunded} refunded.`);
        fetchRequests();
      } else {
        toast.error('Rejection failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Rejection failed');
    } finally {
      setProcessing(null);
      setPin('');
      setRejectReason('BY ADMIN');
    }
  };

  const openProcessModal = (requestId) => {
    setPinAction({ type: 'process', requestId });
    setShowPinModal(true);
  };

  const openRejectModal = (requestId) => {
    setPinAction({ type: 'reject', requestId });
    setShowPinModal(true);
  };

  const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        <Icon className={`w-3.5 h-3.5 ${status === 'processing' ? 'animate-spin' : ''}`} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Redeem Requests</h1>
        <p className="text-white/50 mt-1">Manage all user redeem requests</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.by_status?.pending || 0}</p>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <Loader2 className="w-4 h-4" />
              <span className="text-xs font-medium">Processing</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.by_status?.processing || 0}</p>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Completed</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.by_status?.completed || 0}</p>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Failed</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.by_status?.failed || 0}</p>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <X className="w-4 h-4" />
              <span className="text-xs font-medium">Rejected</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.by_status?.rejected || 0}</p>
          </div>
        </div>
      )}

      {/* Service Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {SERVICE_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                isActive 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, mobile, ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Amount Range */}
          <div className="flex gap-2">
            <input
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="Min ₹"
              className="w-1/2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
            />
            <input
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="Max ₹"
              className="w-1/2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 rounded-lg text-white font-medium transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-white/5 border-b border-white/10 text-sm font-medium text-white/60">
          <div className="col-span-2">Request ID</div>
          <div className="col-span-2">User</div>
          <div className="col-span-2">Service</div>
          <div className="col-span-2">Details</div>
          <div className="col-span-1">Amount</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2">Actions</div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!loading && requests.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/50">No requests found</p>
          </div>
        )}

        {/* Request Rows */}
        {!loading && requests.map(req => (
          <div 
            key={req.request_id} 
            className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-4 border-b border-white/5 hover:bg-white/5 transition"
          >
            {/* Request ID */}
            <div className="col-span-2">
              <span className="text-xs text-white/40 md:hidden">ID: </span>
              <span className="text-white/80 text-sm font-mono">{req.request_id.slice(-12)}</span>
              <p className="text-xs text-white/40 mt-0.5">
                {new Date(req.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* User */}
            <div className="col-span-2">
              <p className="text-white text-sm font-medium">{req.user_name}</p>
              <p className="text-white/50 text-xs">{req.user_mobile}</p>
            </div>

            {/* Service */}
            <div className="col-span-2">
              <p className="text-white text-sm">{req.service_name}</p>
              <p className="text-white/50 text-xs">{req.operator_name}</p>
            </div>

            {/* Details */}
            <div className="col-span-2">
              <p className="text-white/80 text-sm font-mono">{req.utility_acc_no}</p>
            </div>

            {/* Amount */}
            <div className="col-span-1">
              <p className="text-white font-bold">₹{req.service_amount}</p>
              <p className="text-white/40 text-xs">PRC: {req.total_prc_deducted?.toFixed(0)}</p>
            </div>

            {/* Status */}
            <div className="col-span-1">
              <StatusBadge status={req.status} />
            </div>

            {/* Actions */}
            <div className="col-span-2 flex items-center gap-2">
              {(req.status === 'pending' || req.status === 'failed') && (
                <>
                  <button
                    onClick={() => openProcessModal(req.request_id)}
                    disabled={processing === req.request_id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs font-medium transition disabled:opacity-50"
                    data-testid={`process-btn-${req.request_id}`}
                  >
                    {processing === req.request_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    Process
                  </button>
                  <button
                    onClick={() => openRejectModal(req.request_id)}
                    disabled={processing === req.request_id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium transition disabled:opacity-50"
                    data-testid={`reject-btn-${req.request_id}`}
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </>
              )}
              {req.status === 'completed' && req.eko_tid && (
                <span className="text-green-400 text-xs font-mono">TID: {req.eko_tid}</span>
              )}
              {req.status === 'rejected' && (
                <span className="text-red-400 text-xs">{req.reject_reason}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-white/50 text-sm">
            Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-white transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-white px-4">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-white transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm mx-4 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">
              {pinAction?.type === 'process' ? 'Process Request' : 'Reject Request'}
            </h3>
            
            {pinAction?.type === 'reject' && (
              <div className="mb-4">
                <label className="text-white/70 text-sm mb-2 block">Reject Reason</label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            )}
            
            <div className="mb-6">
              <label className="text-white/70 text-sm mb-2 block">Enter Admin PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="******"
                maxLength={6}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center text-2xl tracking-widest focus:outline-none focus:border-purple-500"
                autoFocus
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => { setShowPinModal(false); setPin(''); }}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={pinAction?.type === 'process' ? handleProcess : handleReject}
                className={`flex-1 py-3 rounded-xl text-white font-medium transition ${
                  pinAction?.type === 'process' 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {pinAction?.type === 'process' ? 'Process' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
