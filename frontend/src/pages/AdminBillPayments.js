import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  ArrowLeft, Clock, CheckCircle, XCircle, Search, 
  RefreshCw, Loader2, Phone, Zap, Tv, CreditCard, Wallet,
  Eye, User, Calendar, TrendingUp, IndianRupee, Building,
  ChevronDown, ChevronRight, AlertTriangle, FileText,
  Download, Filter, MoreVertical, CheckSquare, Square,
  ArrowUpDown, X, Receipt, Timer
} from 'lucide-react';
import { LiveTimer, SpeedBadge } from '../components/BillPaymentJourney';

const API = process.env.REACT_APP_BACKEND_URL || '';
const ITEMS_PER_PAGE = 10;

// Service Categories Configuration
const SERVICE_CATEGORIES = {
  mobile_recharge: { 
    name: 'Mobile Recharge', 
    icon: Phone, 
    color: 'blue',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400'
  },
  dish_recharge: { 
    name: 'DTH Recharge', 
    icon: Tv, 
    color: 'purple',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400'
  },
  electricity_bill: { 
    name: 'Electricity Bill', 
    icon: Zap, 
    color: 'amber',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400'
  },
  credit_card_payment: { 
    name: 'Credit Card', 
    icon: CreditCard, 
    color: 'emerald',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400'
  },
  loan_emi: { 
    name: 'EMI Payment', 
    icon: Building, 
    color: 'rose',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    textColor: 'text-rose-400'
  }
};

const AdminBillPayments = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [pendingRejectId, setPendingRejectId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [stats, setStats] = useState({
    today: { pending: 0, approved: 0, rejected: 0, pendingPRC: 0, approvedPRC: 0, rejectedPRC: 0, pendingINR: 0, approvedINR: 0, rejectedINR: 0 },
    allTime: { pending: 0, approved: 0, rejected: 0, pendingPRC: 0, approvedPRC: 0, rejectedPRC: 0, pendingINR: 0, approvedINR: 0, rejectedINR: 0 },
    byCategory: {}
  });

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/admin/bill-payment/requests`);
      const allRequests = response.data.requests || response.data || [];
      setRequests(allRequests);
      calculateStats(allRequests);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate comprehensive stats
  const calculateStats = (allRequests) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRequests = allRequests.filter(r => new Date(r.created_at) >= today);

    const calcStatusStats = (reqs) => ({
      pending: reqs.filter(r => r.status === 'pending').length,
      approved: reqs.filter(r => ['approved', 'processing', 'completed'].includes(r.status)).length,
      rejected: reqs.filter(r => r.status === 'rejected').length,
      pendingPRC: reqs.filter(r => r.status === 'pending').reduce((sum, r) => sum + (r.total_prc_deducted || 0), 0),
      approvedPRC: reqs.filter(r => ['approved', 'processing', 'completed'].includes(r.status)).reduce((sum, r) => sum + (r.total_prc_deducted || 0), 0),
      rejectedPRC: reqs.filter(r => r.status === 'rejected').reduce((sum, r) => sum + (r.total_prc_deducted || 0), 0),
      pendingINR: reqs.filter(r => r.status === 'pending').reduce((sum, r) => sum + (r.amount_inr || 0), 0),
      approvedINR: reqs.filter(r => ['approved', 'processing', 'completed'].includes(r.status)).reduce((sum, r) => sum + (r.amount_inr || 0), 0),
      rejectedINR: reqs.filter(r => r.status === 'rejected').reduce((sum, r) => sum + (r.amount_inr || 0), 0),
    });

    // Category-wise stats
    const byCategory = {};
    Object.keys(SERVICE_CATEGORIES).forEach(cat => {
      const catRequests = allRequests.filter(r => r.request_type === cat);
      byCategory[cat] = {
        total: catRequests.length,
        pending: catRequests.filter(r => r.status === 'pending').length,
        approved: catRequests.filter(r => ['approved', 'processing', 'completed'].includes(r.status)).length,
        rejected: catRequests.filter(r => r.status === 'rejected').length,
        totalINR: catRequests.reduce((sum, r) => sum + (r.amount_inr || 0), 0),
        totalPRC: catRequests.reduce((sum, r) => sum + (r.total_prc_deducted || 0), 0),
      };
    });

    setStats({
      today: calcStatusStats(todayRequests),
      allTime: calcStatusStats(allRequests),
      byCategory
    });
  };

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      navigate('/admin');
      return;
    }
    fetchRequests();
  }, [user, navigate, fetchRequests]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRequests([]);
  }, [activeCategory, statusFilter, searchTerm]);

  // Filter and sort requests (OLDEST FIRST for processing queue)
  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    // Filter by category
    if (activeCategory !== 'all') {
      filtered = filtered.filter(r => r.request_type === activeCategory);
    }

    // Filter by status
    if (statusFilter === 'pending') {
      filtered = filtered.filter(r => r.status === 'pending');
    } else if (statusFilter === 'approved') {
      filtered = filtered.filter(r => ['approved', 'processing', 'completed'].includes(r.status));
    } else if (statusFilter === 'rejected') {
      filtered = filtered.filter(r => r.status === 'rejected');
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        (r.user_name || '').toLowerCase().includes(search) ||
        (r.user_email || '').toLowerCase().includes(search) ||
        (r.request_id || '').toLowerCase().includes(search) ||
        (r.details?.phone_number || '').includes(search) ||
        (r.details?.account_number || '').includes(search)
      );
    }

    // Sort OLDEST FIRST (FIFO for processing)
    filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

    return filtered;
  }, [requests, activeCategory, statusFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Handle single request process
  const handleProcess = async (requestId, action) => {
    // If rejecting, show dialog to get reason
    if (action === 'reject') {
      setPendingRejectId(requestId);
      setShowRejectDialog(true);
      return;
    }
    
    await executeProcess(requestId, action);
  };

  // Execute the actual process after getting reject reason
  const executeProcess = async (requestId, action, reason = '') => {
    setProcessing(true);
    try {
      const payload = {
        request_id: requestId,
        action,
        admin_notes: adminNotes,
        admin_uid: user.uid
      };
      
      // Add reject reason if rejecting
      if (action === 'reject') {
        payload.reject_reason = reason || rejectReason;
      }
      
      await axios.post(`${API}/api/admin/bill-payment/process`, payload);
      toast.success(`Request ${action}ed successfully`);
      setSelectedRequest(null);
      setAdminNotes('');
      setRejectReason('');
      setShowRejectDialog(false);
      setPendingRejectId(null);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${action} request`);
    } finally {
      setProcessing(false);
    }
  };

  // Confirm reject with reason
  const confirmReject = () => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a reject reason');
      return;
    }
    executeProcess(pendingRejectId, 'reject', rejectReason);
  };

  // Handle bulk actions
  const handleBulkAction = async (action) => {
    if (selectedRequests.length === 0) {
      toast.error('No requests selected');
      return;
    }

    // If bulk rejecting, show dialog
    if (action === 'reject') {
      setPendingRejectId('bulk');
      setShowRejectDialog(true);
      return;
    }

    await executeBulkAction(action);
  };

  // Execute bulk action
  const executeBulkAction = async (action, reason = '') => {
    setProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const requestId of selectedRequests) {
      try {
        const payload = {
          request_id: requestId,
          action,
          admin_notes: `Bulk ${action}`,
          admin_uid: user.uid
        };
        
        if (action === 'reject') {
          payload.reject_reason = reason || rejectReason;
        }
        
        await axios.post(`${API}/api/admin/bill-payment/process`, payload);
        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    toast.success(`${successCount} requests ${action}ed, ${failCount} failed`);
    setSelectedRequests([]);
    setShowBulkActions(false);
    setRejectReason('');
    setShowRejectDialog(false);
    setPendingRejectId(null);
    fetchRequests();
    setProcessing(false);
  };

  // Confirm bulk reject
  const confirmBulkReject = () => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a reject reason');
      return;
    }
    executeBulkAction('reject', rejectReason);
  };

  // Toggle request selection
  const toggleRequestSelection = (requestId) => {
    setSelectedRequests(prev =>
      prev.includes(requestId)
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
  };

  // Select all visible requests
  const toggleSelectAll = () => {
    if (selectedRequests.length === paginatedRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(paginatedRequests.map(r => r.request_id));
    }
  };

  // Format currency
  const formatINR = (amount) => `₹${(amount || 0).toLocaleString('en-IN')}`;
  const formatPRC = (amount) => `${(amount || 0).toFixed(2)} PRC`;

  // Get time ago
  const getTimeAgo = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Check if request is urgent (older than 24 hours)
  const isUrgent = (date) => {
    return (new Date() - new Date(date)) > 24 * 60 * 60 * 1000;
  };

  // Check if high value request
  const isHighValue = (amount) => amount >= 5000;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="text-gray-400">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">Bill Payment Requests</h1>
            <p className="text-gray-500 text-xs">Process and manage all bill payments</p>
          </div>
        </div>
        <Button
          onClick={fetchRequests}
          disabled={loading}
          variant="outline"
          size="sm"
          className="text-gray-300 border-gray-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Overview - Today vs All Time */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Today's Stats */}
        <Card className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Today's Summary
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-amber-500/10 rounded-lg">
              <p className="text-lg font-bold text-amber-400">{stats.today.pending}</p>
              <p className="text-[10px] text-gray-400">Pending</p>
              <p className="text-xs text-amber-300">{formatINR(stats.today.pendingINR)}</p>
            </div>
            <div className="text-center p-2 bg-emerald-500/10 rounded-lg">
              <p className="text-lg font-bold text-emerald-400">{stats.today.approved}</p>
              <p className="text-[10px] text-gray-400">Approved</p>
              <p className="text-xs text-emerald-300">{formatINR(stats.today.approvedINR)}</p>
            </div>
            <div className="text-center p-2 bg-red-500/10 rounded-lg">
              <p className="text-lg font-bold text-red-400">{stats.today.rejected}</p>
              <p className="text-[10px] text-gray-400">Rejected</p>
              <p className="text-xs text-red-300">{formatINR(stats.today.rejectedINR)}</p>
            </div>
          </div>
        </Card>

        {/* All Time Stats */}
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
          <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> All Time Summary
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-amber-500/10 rounded-lg">
              <p className="text-lg font-bold text-amber-400">{stats.allTime.pending}</p>
              <p className="text-[10px] text-gray-400">Pending</p>
              <p className="text-xs text-amber-300">{formatINR(stats.allTime.pendingINR)}</p>
            </div>
            <div className="text-center p-2 bg-emerald-500/10 rounded-lg">
              <p className="text-lg font-bold text-emerald-400">{stats.allTime.approved}</p>
              <p className="text-[10px] text-gray-400">Approved</p>
              <p className="text-xs text-emerald-300">{formatINR(stats.allTime.approvedINR)}</p>
            </div>
            <div className="text-center p-2 bg-red-500/10 rounded-lg">
              <p className="text-lg font-bold text-red-400">{stats.allTime.rejected}</p>
              <p className="text-[10px] text-gray-400">Rejected</p>
              <p className="text-xs text-red-300">{formatINR(stats.allTime.rejectedINR)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Category Tabs */}
      <div className="mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === 'all'
                ? 'bg-white text-gray-900'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All Services
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-700 text-gray-300">
              {requests.filter(r => statusFilter === 'all' || 
                (statusFilter === 'pending' && r.status === 'pending') ||
                (statusFilter === 'approved' && ['approved', 'processing', 'completed'].includes(r.status)) ||
                (statusFilter === 'rejected' && r.status === 'rejected')
              ).length}
            </span>
          </button>
          
          {Object.entries(SERVICE_CATEGORIES).map(([key, config]) => {
            const Icon = config.icon;
            const count = stats.byCategory[key]?.[statusFilter === 'all' ? 'total' : statusFilter] || 0;
            const pendingCount = stats.byCategory[key]?.pending || 0;
            
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === key
                    ? `${config.bgColor} ${config.textColor} ${config.borderColor} border`
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {config.name}
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Status Pills */}
        <div className="flex gap-2">
          {[
            { id: 'pending', label: 'Pending', color: 'amber', count: activeCategory === 'all' ? stats.allTime.pending : (stats.byCategory[activeCategory]?.pending || 0) },
            { id: 'approved', label: 'Approved', color: 'emerald', count: activeCategory === 'all' ? stats.allTime.approved : (stats.byCategory[activeCategory]?.approved || 0) },
            { id: 'rejected', label: 'Rejected', color: 'red', count: activeCategory === 'all' ? stats.allTime.rejected : (stats.byCategory[activeCategory]?.rejected || 0) },
          ].map(status => (
            <button
              key={status.id}
              onClick={() => setStatusFilter(status.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                statusFilter === status.id
                  ? `bg-${status.color}-500/20 text-${status.color}-400 border border-${status.color}-500/50`
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {status.id === 'pending' && <Clock className="w-3 h-3" />}
              {status.id === 'approved' && <CheckCircle className="w-3 h-3" />}
              {status.id === 'rejected' && <XCircle className="w-3 h-3" />}
              {status.label} ({status.count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search by name, email, phone, UTR..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white"
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedRequests.length > 0 && statusFilter === 'pending' && (
        <Card className="p-3 mb-4 bg-blue-500/10 border-blue-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-blue-400" />
            <span className="text-blue-300 text-sm font-medium">
              {selectedRequests.length} request(s) selected
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleBulkAction('approve')}
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Approve All
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulkAction('reject')}
              disabled={processing}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject All
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedRequests([])}
              className="text-gray-400"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Requests List */}
      <Card className="bg-gray-900/50 border-gray-800 overflow-hidden">
        {/* List Header */}
        {statusFilter === 'pending' && paginatedRequests.length > 0 && (
          <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
            >
              {selectedRequests.length === paginatedRequests.length ? (
                <CheckSquare className="w-4 h-4 text-blue-400" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Select All
            </button>
            <span className="text-xs text-gray-500">
              Showing {filteredRequests.length} requests (Oldest First)
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : paginatedRequests.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No requests found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {paginatedRequests.map((request) => {
              const category = SERVICE_CATEGORIES[request.request_type] || SERVICE_CATEGORIES.mobile_recharge;
              const Icon = category.icon;
              const urgent = isUrgent(request.created_at) && request.status === 'pending';
              const highValue = isHighValue(request.amount_inr);

              return (
                <div
                  key={request.request_id}
                  className={`p-4 hover:bg-gray-800/30 transition-colors ${urgent ? 'bg-red-500/5' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox for pending */}
                    {statusFilter === 'pending' && (
                      <button
                        onClick={() => toggleRequestSelection(request.request_id)}
                        className="mt-1"
                      >
                        {selectedRequests.includes(request.request_id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-400" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                    )}

                    {/* Category Icon */}
                    <div className={`w-10 h-10 rounded-xl ${category.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${category.textColor}`} />
                    </div>

                    {/* Request Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white truncate">{request.user_name || 'Unknown'}</span>
                        {urgent && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Urgent
                          </span>
                        )}
                        {highValue && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded-full">
                            High Value
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-400 text-xs truncate">{request.user_email}</p>
                      
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className={`${category.textColor}`}>{category.name}</span>
                        <span className="text-gray-500">{request.details?.phone_number || request.details?.account_number || '-'}</span>
                        {/* Live Timer for pending/processing requests */}
                        {(request.status === 'pending' || request.status === 'processing') ? (
                          <LiveTimer createdAt={request.created_at} status={request.status} />
                        ) : (
                          <span className="text-gray-500">{getTimeAgo(request.created_at)}</span>
                        )}
                      </div>
                    </div>

                    {/* Amount & Actions */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-white">{formatINR(request.amount_inr)}</p>
                      <p className="text-xs text-gray-500">{formatPRC(request.total_prc_deducted)}</p>
                      
                      {request.status === 'pending' ? (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                            className="h-7 px-2 bg-gray-700 hover:bg-gray-600"
                          >
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleProcess(request.request_id, 'approve')}
                            disabled={processing}
                            className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700"
                          >
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleProcess(request.request_id, 'reject')}
                            disabled={processing}
                            className="h-7 px-2"
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : request.status === 'processing' ? (
                        <div className="flex flex-col items-end gap-1 mt-2">
                          <span className="inline-block px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
                            ⏳ Processing
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handleProcess(request.request_id, 'complete')}
                            disabled={processing}
                            className="h-6 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                          >
                            ✓ Mark Complete
                          </Button>
                          {request.processed_by && (
                            <span className="text-[10px] text-gray-600">
                              by {request.processed_by}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1 mt-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs ${
                            request.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {request.status === 'completed' ? '✅ Completed' :
                             request.status === 'rejected' ? '❌ Rejected' :
                             request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                          {/* Processing Time */}
                          {request.processing_time && (
                            <span className="text-[10px] text-gray-500">
                              ⏱️ {request.processing_time}
                            </span>
                          )}
                          {/* Show processed by */}
                          {request.processed_by && (
                            <span className="text-[10px] text-gray-600">
                              by {request.processed_by}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="border-gray-700"
              >
                Previous
              </Button>
              
              {/* Page numbers */}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded text-sm ${
                        currentPage === pageNum
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="border-gray-700"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-gray-900 border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-white">Request Details</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-white">{selectedRequest.user_name}</p>
                  <p className="text-xs text-gray-400">{selectedRequest.user_email}</p>
                </div>
              </div>

              {/* Request Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500">Service Type</p>
                  <p className="text-white font-medium">
                    {SERVICE_CATEGORIES[selectedRequest.request_type]?.name || selectedRequest.request_type}
                  </p>
                </div>
                <div className="p-3 bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="text-white font-medium">{formatINR(selectedRequest.amount_inr)}</p>
                </div>
                <div className="p-3 bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500">PRC Deducted</p>
                  <p className="text-white font-medium">{formatPRC(selectedRequest.total_prc_deducted)}</p>
                </div>
                <div className="p-3 bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500">Requested</p>
                  <p className="text-white font-medium">{getTimeAgo(selectedRequest.created_at)}</p>
                </div>
              </div>

              {/* Service Details */}
              <div className="p-3 bg-gray-800 rounded-xl">
                <p className="text-xs text-gray-500 mb-2">Service Details</p>
                {selectedRequest.details && Object.entries(selectedRequest.details).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-1 border-b border-gray-700 last:border-0">
                    <span className="text-gray-400 text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-white text-sm">{value || '-'}</span>
                  </div>
                ))}
              </div>

              {/* Admin Notes */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Admin Notes (Optional)</p>
                <Input
                  placeholder="Add notes for this action..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleProcess(selectedRequest.request_id, 'approve')}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleProcess(selectedRequest.request_id, 'reject')}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Reject
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Reject Reason Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-gray-900 border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                Reject Request{pendingRejectId === 'bulk' ? 's' : ''}
              </h3>
              <button 
                onClick={() => {
                  setShowRejectDialog(false);
                  setPendingRejectId(null);
                  setRejectReason('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-gray-400 text-sm mb-4">
              {pendingRejectId === 'bulk' 
                ? `Please provide a reason for rejecting ${selectedRequests.length} request(s).`
                : 'Please provide a reason for rejecting this request. The user will be notified and PRC will be refunded.'}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Reject Reason *</label>
                <Input
                  placeholder="e.g., Invalid bill details, Duplicate request, etc."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              
              {/* Quick Reasons */}
              <div className="flex flex-wrap gap-2">
                {['Invalid details', 'Duplicate request', 'Amount mismatch', 'Provider issue', 'User request'].map(reason => (
                  <button
                    key={reason}
                    onClick={() => setRejectReason(reason)}
                    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 border border-gray-700"
                  >
                    {reason}
                  </button>
                ))}
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700"
                  onClick={() => {
                    setShowRejectDialog(false);
                    setPendingRejectId(null);
                    setRejectReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={pendingRejectId === 'bulk' ? confirmBulkReject : confirmReject}
                  disabled={processing || !rejectReason.trim()}
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Confirm Reject
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminBillPayments;
