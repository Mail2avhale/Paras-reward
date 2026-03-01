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
  Eye, User, Calendar, TrendingUp, IndianRupee,
  ChevronDown, ChevronRight, AlertTriangle, FileText,
  Download, Filter, MoreVertical, CheckSquare, Square,
  ArrowUpDown, X, Receipt, Timer
} from 'lucide-react';
import { LiveTimer, SpeedBadge } from '../components/BillPaymentJourney';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
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
  }
  // loan_emi (EMI Payment) removed - handled in separate unified payment dashboard
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
  
  // Manual Complete Dialog
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [pendingCompleteId, setPendingCompleteId] = useState(null);
  const [pendingCompleteRequest, setPendingCompleteRequest] = useState(null);
  const [manualTxnRef, setManualTxnRef] = useState('');
  
  // Date Range Filter States
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // Sorting options
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Advanced Sorting & Filter States
  const [sortBy, setSortBy] = useState('created_at'); // created_at, approved_at, rejected_at, amount
  const [approvedByFilter, setApprovedByFilter] = useState(''); // Filter by who approved
  const [rejectedByFilter, setRejectedByFilter] = useState(''); // Filter by who rejected
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [manualOnlyFilter, setManualOnlyFilter] = useState(false); // Show only manually approved
  
  const [stats, setStats] = useState({
    today: { pending: 0, approved: 0, rejected: 0, pendingPRC: 0, approvedPRC: 0, rejectedPRC: 0, pendingINR: 0, approvedINR: 0, rejectedINR: 0 },
    allTime: { pending: 0, approved: 0, rejected: 0, pendingPRC: 0, approvedPRC: 0, rejectedPRC: 0, pendingINR: 0, approvedINR: 0, rejectedINR: 0 },
    byCategory: {}
  });

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/admin/bill-payment/requests`);
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

    // Exclude EMI requests from stats (handled in unified payment dashboard)
    const nonEmiRequests = allRequests.filter(r => r.request_type !== 'loan_emi' && r.payment_type !== 'emi');
    const todayRequests = nonEmiRequests.filter(r => new Date(r.created_at) >= today);

    const calcStatusStats = (reqs) => ({
      pending: reqs.filter(r => r.status === 'pending').length,
      ekoFailed: reqs.filter(r => r.status === 'eko_failed').length,
      approved: reqs.filter(r => ['approved', 'processing', 'completed'].includes(r.status)).length,
      rejected: reqs.filter(r => r.status === 'rejected').length,
      pendingPRC: reqs.filter(r => ['pending', 'eko_failed'].includes(r.status)).reduce((sum, r) => sum + (r.total_prc_deducted || 0), 0),
      approvedPRC: reqs.filter(r => ['approved', 'processing', 'completed'].includes(r.status)).reduce((sum, r) => sum + (r.total_prc_deducted || 0), 0),
      rejectedPRC: reqs.filter(r => r.status === 'rejected').reduce((sum, r) => sum + (r.total_prc_deducted || 0), 0),
      pendingINR: reqs.filter(r => ['pending', 'eko_failed'].includes(r.status)).reduce((sum, r) => sum + (r.amount_inr || 0), 0),
      approvedINR: reqs.filter(r => ['approved', 'processing', 'completed'].includes(r.status)).reduce((sum, r) => sum + (r.amount_inr || 0), 0),
      rejectedINR: reqs.filter(r => r.status === 'rejected').reduce((sum, r) => sum + (r.amount_inr || 0), 0),
    });

    // Category-wise stats
    const byCategory = {};
    Object.keys(SERVICE_CATEGORIES).forEach(cat => {
      const catRequests = nonEmiRequests.filter(r => r.request_type === cat);
      byCategory[cat] = {
        total: catRequests.length,
        pending: catRequests.filter(r => ['pending', 'eko_failed'].includes(r.status)).length,
        approved: catRequests.filter(r => ['approved', 'processing', 'completed'].includes(r.status)).length,
        rejected: catRequests.filter(r => r.status === 'rejected').length,
        totalINR: catRequests.reduce((sum, r) => sum + (r.amount_inr || 0), 0),
        totalPRC: catRequests.reduce((sum, r) => sum + (r.total_prc_deducted || 0), 0),
      };
    });

    setStats({
      today: calcStatusStats(todayRequests),
      allTime: calcStatusStats(nonEmiRequests),
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
  }, [activeCategory, statusFilter, searchTerm, dateFrom, dateTo, sortOrder]);

  // Filter and sort requests
  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    // Exclude EMI requests (handled in unified payment dashboard)
    filtered = filtered.filter(r => r.request_type !== 'loan_emi' && r.payment_type !== 'emi');

    // Filter by category
    if (activeCategory !== 'all') {
      filtered = filtered.filter(r => r.request_type === activeCategory);
    }

    // Filter by status
    if (statusFilter === 'pending') {
      filtered = filtered.filter(r => ['pending', 'eko_failed'].includes(r.status));
    } else if (statusFilter === 'approved') {
      filtered = filtered.filter(r => ['approved', 'processing', 'completed'].includes(r.status));
    } else if (statusFilter === 'rejected') {
      filtered = filtered.filter(r => r.status === 'rejected');
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(r => new Date(r.created_at) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => new Date(r.created_at) <= toDate);
    }

    // ========== NEW ADVANCED FILTERS ==========
    
    // Filter by Approved By (admin name)
    if (approvedByFilter && statusFilter === 'approved') {
      const search = approvedByFilter.toLowerCase();
      filtered = filtered.filter(r => 
        (r.processed_by || '').toLowerCase().includes(search) ||
        (r.processed_by_name || '').toLowerCase().includes(search) ||
        (r.approved_by || '').toLowerCase().includes(search)
      );
    }
    
    // Filter by Rejected By (admin name)
    if (rejectedByFilter && statusFilter === 'rejected') {
      const search = rejectedByFilter.toLowerCase();
      filtered = filtered.filter(r => 
        (r.processed_by || '').toLowerCase().includes(search) ||
        (r.processed_by_name || '').toLowerCase().includes(search) ||
        (r.rejected_by || '').toLowerCase().includes(search)
      );
    }
    
    // Filter by Amount Range
    if (amountMin) {
      filtered = filtered.filter(r => (r.amount_inr || 0) >= parseFloat(amountMin));
    }
    if (amountMax) {
      filtered = filtered.filter(r => (r.amount_inr || 0) <= parseFloat(amountMax));
    }
    
    // Filter only Manually Approved
    if (manualOnlyFilter) {
      filtered = filtered.filter(r => r.manually_approved === true);
    }

    // Advanced search filter - search across ALL fields
    if (searchTerm) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(r => {
        // Basic fields
        if ((r.user_name || '').toLowerCase().includes(search)) return true;
        if ((r.user_email || '').toLowerCase().includes(search)) return true;
        if ((r.request_id || '').toLowerCase().includes(search)) return true;
        if ((r.user_mobile || '').includes(search)) return true;
        
        // Amount search
        if ((r.amount_inr?.toString() || '').includes(search)) return true;
        if ((r.total_prc_deducted?.toString() || '').includes(search)) return true;
        
        // Details fields - search all nested fields
        const details = r.details || {};
        if ((details.phone_number || '').includes(search)) return true;
        if ((details.account_number || '').includes(search)) return true;
        if ((details.consumer_number || '').toLowerCase().includes(search)) return true;
        if ((details.operator || '').toLowerCase().includes(search)) return true;
        if ((details.biller_name || '').toLowerCase().includes(search)) return true;
        if ((details.utr_number || '').toLowerCase().includes(search)) return true;
        if ((details.transaction_id || '').toLowerCase().includes(search)) return true;
        if ((details.card_last4 || '').includes(search)) return true;
        if ((details.cardholder_name || '').toLowerCase().includes(search)) return true;
        if ((details.bank_name || '').toLowerCase().includes(search)) return true;
        if ((details.loan_account || '').toLowerCase().includes(search)) return true;
        if ((details.borrower_name || '').toLowerCase().includes(search)) return true;
        if ((details.ifsc_code || '').toLowerCase().includes(search)) return true;
        if ((details.linked_mobile || '').includes(search)) return true;
        if ((details.registered_mobile || '').includes(search)) return true;
        
        // Admin notes
        if ((r.admin_notes || '').toLowerCase().includes(search)) return true;
        if ((r.rejection_reason || '').toLowerCase().includes(search)) return true;
        
        return false;
      });
    }

    // ========== ADVANCED SORTING ==========
    filtered.sort((a, b) => {
      let dateA, dateB;
      
      // Determine which date field to sort by
      switch (sortBy) {
        case 'approved_at':
          dateA = a.completed_at || a.processed_at || a.approved_at || a.created_at;
          dateB = b.completed_at || b.processed_at || b.approved_at || b.created_at;
          break;
        case 'rejected_at':
          dateA = a.rejected_at || a.processed_at || a.created_at;
          dateB = b.rejected_at || b.processed_at || b.created_at;
          break;
        case 'amount':
          // Sort by amount
          const amtA = a.amount_inr || 0;
          const amtB = b.amount_inr || 0;
          return sortOrder === 'newest' ? amtB - amtA : amtA - amtB;
        case 'created_at':
        default:
          dateA = a.created_at;
          dateB = b.created_at;
      }
      
      // Sort by date
      if (sortOrder === 'newest') {
        return new Date(dateB) - new Date(dateA);
      }
      return new Date(dateA) - new Date(dateB);
    });

    return filtered;
  }, [requests, activeCategory, statusFilter, searchTerm, dateFrom, dateTo, sortOrder, sortBy, approvedByFilter, rejectedByFilter, amountMin, amountMax, manualOnlyFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Handle single request process
  const handleProcess = async (requestId, action) => {
    // Find the request for displaying details in dialog
    const request = requests.find(r => r.request_id === requestId);
    
    // Safety check - if request not found, show error
    if (!request) {
      toast.error('Request not found. Please refresh the page.');
      return;
    }
    
    // If rejecting, show dialog to get reason
    if (action === 'reject') {
      setPendingRejectId(requestId);
      setShowRejectDialog(true);
      return;
    }
    
    // If completing manually, show dialog to get UTR/Reference
    if (action === 'complete') {
      setPendingCompleteId(requestId);
      setPendingCompleteRequest(request);
      setShowCompleteDialog(true);
      return;
    }
    
    await executeProcess(requestId, action);
  };

  // Execute the actual process after getting reject reason
  const executeProcess = async (requestId, action, reason = '', txnRef = '') => {
    setProcessing(true);
    try {
      // For retry action, use approve action on backend
      const backendAction = action === 'retry' ? 'approve' : action;
      
      const payload = {
        request_id: requestId,
        action: backendAction,
        admin_notes: adminNotes,
        admin_uid: user?.uid || ''
      };
      
      // Add reject reason if rejecting
      if (action === 'reject') {
        payload.reject_reason = reason || rejectReason;
      }
      
      // Add txn reference for manual complete
      if (action === 'complete') {
        payload.txn_reference = txnRef || manualTxnRef;
      }
      
      const response = await axios.post(`${API}/admin/bill-payment/process`, payload);
      
      // Get actual status from API response (handles approved_manual, completed, etc.)
      const actualStatus = response.data?.status || (action === 'reject' ? 'rejected' : 'completed');
      const ekoFailReason = response.data?.eko_fail_reason;
      
      // Update local state with actual status from server
      setRequests(prev => prev.map(r => 
        r.request_id === requestId 
          ? { 
              ...r, 
              status: actualStatus,
              eko_fail_reason: ekoFailReason,
              reject_reason: action === 'reject' ? (reason || rejectReason) : undefined 
            }
          : r
      ));
      
      // Show appropriate message based on result
      if (actualStatus === 'approved_manual' || actualStatus === 'eko_failed') {
        toast.warning(`⚠️ Eko auto-pay failed: ${ekoFailReason || 'Unknown error'}. Manual processing required.`, {
          duration: 5000
        });
      } else if (actualStatus === 'completed') {
        toast.success(response.data?.message || `Request ${action}ed successfully`);
      } else {
        toast.success(response.data?.message || `Request ${action}ed successfully`);
      }
      
      setSelectedRequest(null);
      setAdminNotes('');
      setRejectReason('');
      setShowRejectDialog(false);
      setPendingRejectId(null);
      
      // Also refresh from server to ensure data consistency
      fetchRequests();
    } catch (error) {
      console.error('Process error:', error);
      const errorMsg = error.response?.data?.detail || error.message || `Failed to ${action} request`;
      toast.error(errorMsg);
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
        
        await axios.post(`${API}/admin/bill-payment/process`, payload);
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

        {/* Search & Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search name, email, phone, UTR, amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
              sortOrder === 'newest' 
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-gray-800 border-gray-700 text-gray-400'
            }`}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="text-sm whitespace-nowrap">{sortOrder === 'newest' ? 'Latest First' : 'Oldest First'}</span>
          </button>
          
          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
              showAdvancedFilters || dateFrom || dateTo || approvedByFilter || rejectedByFilter || amountMin || amountMax || manualOnlyFilter
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                : 'bg-gray-800 border-gray-700 text-gray-400'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Advanced Filters</span>
            {(dateFrom || dateTo || approvedByFilter || rejectedByFilter || amountMin || amountMax || manualOnlyFilter) && 
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            }
          </button>
        </div>

        {/* ========== ADVANCED FILTERS PANEL ========== */}
        {showAdvancedFilters && (
          <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
            
            {/* Row 1: Date Range */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs text-gray-400 mb-1.5">From Date</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white h-9"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs text-gray-400 mb-1.5">To Date</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white h-9"
                />
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setDateFrom(today); setDateTo(today);
                }} className="text-blue-400 hover:text-blue-300 h-9 px-2 text-xs">Today</Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                  setDateFrom(weekAgo.toISOString().split('T')[0]); setDateTo(today.toISOString().split('T')[0]);
                }} className="text-blue-400 hover:text-blue-300 h-9 px-2 text-xs">7 Days</Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  const today = new Date();
                  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                  setDateFrom(monthAgo.toISOString().split('T')[0]); setDateTo(today.toISOString().split('T')[0]);
                }} className="text-blue-400 hover:text-blue-300 h-9 px-2 text-xs">30 Days</Button>
              </div>
            </div>

            {/* Row 2: Sort By & Order */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-gray-400 mb-1.5">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm"
                >
                  <option value="created_at">Request Date</option>
                  <option value="approved_at">Approved Date</option>
                  <option value="rejected_at">Rejected Date</option>
                  <option value="amount">Amount (₹)</option>
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs text-gray-400 mb-1.5">Sort Order</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm"
                >
                  <option value="newest">Latest First ↓</option>
                  <option value="oldest">Oldest First ↑</option>
                </select>
              </div>
            </div>

            {/* Row 3: Amount Range */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-400 mb-1.5">Min Amount (₹)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white h-9"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-400 mb-1.5">Max Amount (₹)</label>
                <Input
                  type="number"
                  placeholder="100000"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white h-9"
                />
              </div>
            </div>

            {/* Row 4: Admin Filters (Show based on status) */}
            {statusFilter === 'approved' && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-400 mb-1.5">Approved By (Admin Name)</label>
                  <Input
                    placeholder="Search by admin name..."
                    value={approvedByFilter}
                    onChange={(e) => setApprovedByFilter(e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white h-9"
                  />
                </div>
                <label className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualOnlyFilter}
                    onChange={(e) => setManualOnlyFilter(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-800 border-gray-600"
                  />
                  <span className="text-amber-400 text-sm">🔧 Manual Only</span>
                </label>
              </div>
            )}
            
            {statusFilter === 'rejected' && (
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-400 mb-1.5">Rejected By (Admin Name)</label>
                <Input
                  placeholder="Search by admin name..."
                  value={rejectedByFilter}
                  onChange={(e) => setRejectedByFilter(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white h-9"
                />
              </div>
            )}

            {/* Clear All Filters */}
            {(dateFrom || dateTo || approvedByFilter || rejectedByFilter || amountMin || amountMax || manualOnlyFilter || sortBy !== 'created_at') && (
              <div className="pt-2 border-t border-gray-700">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDateFrom(''); setDateTo('');
                    setApprovedByFilter(''); setRejectedByFilter('');
                    setAmountMin(''); setAmountMax('');
                    setManualOnlyFilter(false);
                    setSortBy('created_at'); setSortOrder('newest');
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Filter Summary */}
        {(searchTerm || dateFrom || dateTo || activeCategory !== 'all') && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Filters:</span>
            {searchTerm && (
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full flex items-center gap-1">
                Search: "{searchTerm}"
                <button onClick={() => setSearchTerm('')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {dateFrom && (
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full flex items-center gap-1">
                From: {dateFrom}
                <button onClick={() => setDateFrom('')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {dateTo && (
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full flex items-center gap-1">
                To: {dateTo}
                <button onClick={() => setDateTo('')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {activeCategory !== 'all' && (
              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full flex items-center gap-1">
                {SERVICE_CATEGORIES[activeCategory]?.name || activeCategory}
                <button onClick={() => setActiveCategory('all')}><X className="w-3 h-3" /></button>
              </span>
            )}
            <span className="text-gray-400 ml-2">
              Showing {filteredRequests.length} of {requests.length} requests
            </span>
          </div>
        )}
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
              Showing {filteredRequests.length} requests ({sortOrder === 'newest' ? 'Latest First' : 'Oldest First'})
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
                        <span className="text-gray-500">
                          {request.details?.phone_number || request.details?.account_number || request.details?.consumer_number || '-'}
                          {request.request_type === 'mobile_recharge' && request.details?.operator && (
                            <> | {request.details.operator}</>
                          )}
                          {request.request_type === 'mobile_recharge' && request.details?.recharge_type && (
                            <> ({request.details.recharge_type})</>
                          )}
                        </span>
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
                        <div className="flex flex-col gap-2 mt-2">
                          {/* View Details Button */}
                          <Button
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                            className="h-7 w-full px-2 bg-gray-700 hover:bg-gray-600"
                          >
                            <Eye className="w-3 h-3 mr-1" /> View Details
                          </Button>
                          
                          {/* Action Buttons Row */}
                          <div className="flex gap-1">
                            {/* Eko Auto Approve */}
                            <Button
                              size="sm"
                              onClick={() => handleProcess(request.request_id, 'approve')}
                              disabled={processing}
                              className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 flex-1"
                              title="Approve via Eko API"
                            >
                              ⚡ Eko
                            </Button>
                            
                            {/* Manual Complete */}
                            <Button
                              size="sm"
                              onClick={() => handleProcess(request.request_id, 'complete')}
                              disabled={processing}
                              className="h-7 px-2 bg-amber-600 hover:bg-amber-700 flex-1"
                              title="Manual Complete (Without Eko)"
                            >
                              🔧 Manual
                            </Button>
                            
                            {/* Reject */}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleProcess(request.request_id, 'reject')}
                              disabled={processing}
                              className="h-7 px-2"
                              title="Reject + PRC Refund"
                            >
                              <XCircle className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ) : request.status === 'eko_failed' ? (
                        /* Eko Failed - Admin decides: Retry, Complete, or Reject */
                        <div className="flex flex-col items-end gap-1 mt-2">
                          <span className="inline-block px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-400">
                            ⚠️ Eko Failed
                          </span>
                          {request.eko_fail_reason && (
                            <span className="text-[10px] text-red-400 max-w-[150px] text-right truncate" title={request.eko_fail_reason}>
                              {request.eko_fail_reason}
                            </span>
                          )}
                          {request.retry_attempts && (
                            <span className="text-[10px] text-gray-500">
                              Attempts: {request.retry_attempts}
                            </span>
                          )}
                          <div className="flex gap-1 mt-1 flex-wrap justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleProcess(request.request_id, 'retry')}
                              disabled={processing}
                              className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                            >
                              🔄 Retry
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleProcess(request.request_id, 'complete')}
                              disabled={processing}
                              className="h-6 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                            >
                              ✅ Complete
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleProcess(request.request_id, 'reject')}
                              disabled={processing}
                              className="h-6 px-2 text-xs"
                            >
                              ❌ Reject
                            </Button>
                          </div>
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
                          {/* Manually Approved Badge */}
                          {request.manually_approved && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              🔧 Manually Approved
                            </span>
                          )}
                          {/* Show reject reason for rejected */}
                          {request.status === 'rejected' && request.reject_reason && (
                            <span className="text-[10px] text-red-400 max-w-[150px] text-right truncate" title={request.reject_reason}>
                              {request.reject_reason}
                            </span>
                          )}
                          {/* Show Manual TXN Reference */}
                          {request.manually_approved && request.manual_txn_reference && (
                            <span className="text-[10px] text-amber-400 font-mono">
                              Ref: {request.manual_txn_reference}
                            </span>
                          )}
                          {/* Show Eko TXN for completed (non-manual) */}
                          {request.status === 'completed' && request.txn_number && !request.manually_approved && (
                            <span className="text-[10px] text-emerald-400 font-mono">
                              {request.txn_number}
                            </span>
                          )}
                          {/* View Details Button for completed/rejected */}
                          <Button
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                            className="h-6 px-2 text-xs bg-gray-700 hover:bg-gray-600"
                          >
                            <Eye className="w-3 h-3 mr-1" /> Review
                          </Button>
                          {/* Speed Badge for completed */}
                          {request.status === 'completed' && request.processing_time && (
                            <SpeedBadge processingTime={request.processing_time} />
                          )}
                          {/* Processing Time if no badge */}
                          {request.processing_time && !['completed'].includes(request.status) && (
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
                  <p className="font-medium text-white">{selectedRequest.user_name || 'Unknown User'}</p>
                  <p className="text-xs text-gray-400">{selectedRequest.user_email || 'No email'}</p>
                </div>
              </div>

              {/* Request Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500">Service Type</p>
                  <p className="text-white font-medium">
                    {SERVICE_CATEGORIES[selectedRequest.request_type]?.name || selectedRequest.request_type || 'Unknown'}
                  </p>
                </div>
                <div className="p-3 bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="text-white font-medium">{formatINR(selectedRequest.amount_inr || 0)}</p>
                </div>
                <div className="p-3 bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500">PRC Deducted</p>
                  <p className="text-white font-medium">{formatPRC(selectedRequest.total_prc_deducted || selectedRequest.prc_required || 0)}</p>
                </div>
                <div className="p-3 bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500">Requested</p>
                  <p className="text-white font-medium">{selectedRequest.created_at ? getTimeAgo(selectedRequest.created_at) : '-'}</p>
                </div>
              </div>

              {/* Service Details */}
              <div className="p-3 bg-gray-800 rounded-xl">
                <p className="text-xs text-gray-500 mb-2">Service Details</p>
                {selectedRequest.details && typeof selectedRequest.details === 'object' && !Array.isArray(selectedRequest.details) ? (
                  Object.entries(selectedRequest.details).map(([key, value]) => {
                    // Custom labels for better readability
                    const labelMap = {
                      'phone_number': 'Mobile Number',
                      'mobile_number': 'Mobile Number',
                      'recharge_type': 'Recharge Type',
                      'operator': 'Operator',
                      'circle': 'Telecom Circle',
                      'consumer_number': 'Consumer Number',
                      'biller_name': 'Provider',
                      'card_last4': 'Card Last 4 Digits',
                      'cardholder_name': 'Cardholder Name',
                      'bank_name': 'Bank Name',
                      'loan_account': 'Loan Account',
                      'borrower_name': 'Borrower Name',
                      'loan_type': 'Loan Type',
                      'emi_amount': 'EMI Amount',
                      'emi_due_date': 'EMI Due Date'
                    };
                    const label = labelMap[key] || key.replace(/_/g, ' ');
                    // Handle nested objects or arrays safely
                    const displayValue = typeof value === 'object' ? JSON.stringify(value) : (value || '-');
                    return (
                      <div key={key} className="flex justify-between py-1 border-b border-gray-700 last:border-0">
                        <span className="text-gray-400 text-sm capitalize">{label}</span>
                        <span className="text-white text-sm">{displayValue}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-400 text-sm">No details available</p>
                )}
              </div>

              {/* Admin Notes */}
              {selectedRequest.status === 'pending' ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Admin Notes (Optional)</p>
                  <Input
                    placeholder="Add notes for this action..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
              ) : selectedRequest.status === 'eko_failed' ? (
                /* Eko Failed - Admin decides: Retry, Complete, or Reject */
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-amber-400">
                        ⚠️ Eko API Failed
                      </span>
                      {selectedRequest.retry_attempts && (
                        <span className="text-sm text-gray-400">
                          Attempts: {selectedRequest.retry_attempts}
                        </span>
                      )}
                    </div>
                    
                    {selectedRequest.eko_fail_reason && (
                      <div className="mt-2 pt-2 border-t border-amber-500/30">
                        <span className="text-xs text-gray-500">Error:</span>
                        <p className="text-red-400 text-sm mt-1">{selectedRequest.eko_fail_reason}</p>
                      </div>
                    )}
                    
                    <div className="mt-3 p-2 bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-400 mb-2">Admin Options:</p>
                      <ul className="text-xs text-gray-300 space-y-1">
                        <li>🔄 <strong>Retry:</strong> Try Eko API again</li>
                        <li>✅ <strong>Complete:</strong> Mark as done (processed manually)</li>
                        <li>❌ <strong>Reject:</strong> Reject request & refund PRC</li>
                      </ul>
                    </div>
                  </div>
                  
                  {/* Processing Info */}
                  <div className="grid grid-cols-2 gap-3">
                    {selectedRequest.approved_at && (
                      <div className="p-2 bg-gray-800 rounded-lg">
                        <p className="text-[10px] text-gray-500">First Attempt</p>
                        <p className="text-xs text-white">{new Date(selectedRequest.approved_at).toLocaleString()}</p>
                      </div>
                    )}
                    {selectedRequest.last_retry_at && (
                      <div className="p-2 bg-gray-800 rounded-lg">
                        <p className="text-[10px] text-gray-500">Last Retry</p>
                        <p className="text-xs text-white">{new Date(selectedRequest.last_retry_at).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Review Section for Completed/Rejected */
                <div className="space-y-3">
                  {/* Status Badge */}
                  <div className={`p-3 rounded-xl ${
                    selectedRequest.status === 'completed' 
                      ? 'bg-emerald-500/10 border border-emerald-500/30' 
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${
                        selectedRequest.status === 'completed' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {selectedRequest.status === 'completed' ? '✅ Completed' : '❌ Rejected'}
                      </span>
                      {selectedRequest.processing_time && (
                        <span className="text-sm text-gray-400">
                          ⏱️ {selectedRequest.processing_time}
                        </span>
                      )}
                    </div>
                    
                    {/* TXN Number for completed */}
                    {selectedRequest.txn_number && (
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <span className="text-xs text-gray-500">TXN Number:</span>
                        <span className="ml-2 text-emerald-400 font-mono text-sm">{selectedRequest.txn_number}</span>
                      </div>
                    )}
                    
                    {/* Reject Reason with PRC Refund info */}
                    {selectedRequest.reject_reason && (
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <span className="text-xs text-gray-500">Rejection Reason:</span>
                        <p className="text-red-300 text-sm mt-1">{selectedRequest.reject_reason}</p>
                        {selectedRequest.refund_details && (
                          <p className="text-amber-400 text-xs mt-1">
                            💰 PRC Refunded: {selectedRequest.refund_details.prc_refunded?.toFixed(2)} PRC
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Retry attempts info */}
                    {selectedRequest.retry_attempts && (
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <span className="text-xs text-gray-500">Eko API Attempts:</span>
                        <span className="ml-2 text-gray-400 text-sm">{selectedRequest.retry_attempts}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Processing Info */}
                  <div className="grid grid-cols-2 gap-3">
                    {selectedRequest.approved_at && (
                      <div className="p-2 bg-gray-800 rounded-lg">
                        <p className="text-[10px] text-gray-500">Approved At</p>
                        <p className="text-xs text-white">{new Date(selectedRequest.approved_at).toLocaleString()}</p>
                      </div>
                    )}
                    {selectedRequest.completed_at && (
                      <div className="p-2 bg-gray-800 rounded-lg">
                        <p className="text-[10px] text-gray-500">Completed At</p>
                        <p className="text-xs text-white">{new Date(selectedRequest.completed_at).toLocaleString()}</p>
                      </div>
                    )}
                    {selectedRequest.processed_by && (
                      <div className="p-2 bg-gray-800 rounded-lg">
                        <p className="text-[10px] text-gray-500">Processed By</p>
                        <p className="text-xs text-white">{selectedRequest.processed_by}</p>
                      </div>
                    )}
                    {selectedRequest.admin_notes && (
                      <div className="p-2 bg-gray-800 rounded-lg col-span-2">
                        <p className="text-[10px] text-gray-500">Admin Notes</p>
                        <p className="text-xs text-white">{selectedRequest.admin_notes}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Speed Badge */}
                  {selectedRequest.status === 'completed' && selectedRequest.processing_time && (
                    <div className="flex justify-center">
                      <SpeedBadge processingTime={selectedRequest.processing_time} />
                    </div>
                  )}
                </div>
              )}

              {/* Actions - Only for pending requests */}
              {selectedRequest.status === 'pending' && (
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
              )}
              
              {/* Actions for eko_failed - Retry, Complete, Reject */}
              {selectedRequest.status === 'eko_failed' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleProcess(selectedRequest.request_id, 'retry')}
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '🔄'}
                      Retry Eko
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleProcess(selectedRequest.request_id, 'complete')}
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Complete Manually
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleProcess(selectedRequest.request_id, 'reject')}
                    disabled={processing}
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                    Reject & Refund PRC
                  </Button>
                </div>
              )}
              
              {/* Close button for completed/rejected */}
              {(selectedRequest.status === 'completed' || selectedRequest.status === 'rejected') && (
                <Button
                  variant="outline"
                  className="w-full border-gray-700"
                  onClick={() => setSelectedRequest(null)}
                >
                  Close
                </Button>
              )}
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

      {/* Manual Complete Dialog */}
      {showCompleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg bg-gray-900 border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-amber-400" />
                Manual Complete (Without Eko)
              </h3>
              <button 
                onClick={() => {
                  setShowCompleteDialog(false);
                  setPendingCompleteId(null);
                  setPendingCompleteRequest(null);
                  setManualTxnRef('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Request Details */}
            {pendingCompleteRequest ? (
              <div className="bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-700">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Request Type</p>
                    <p className="text-white font-medium capitalize flex items-center gap-2">
                      {pendingCompleteRequest.request_type === 'mobile_recharge' && '📱'}
                      {pendingCompleteRequest.request_type === 'dish_recharge' && '📺'}
                      {pendingCompleteRequest.request_type === 'electricity_bill' && '⚡'}
                      {pendingCompleteRequest.request_type === 'credit_card_payment' && '💳'}
                      {pendingCompleteRequest.request_type === 'loan_emi' && '🏦'}
                      {(pendingCompleteRequest.request_type || 'Unknown')?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className="text-emerald-400 font-bold text-lg">₹{(pendingCompleteRequest.amount_inr || 0)?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">User</p>
                    <p className="text-white">{pendingCompleteRequest.user_name || pendingCompleteRequest.user_id || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Request ID</p>
                    <p className="text-gray-400 font-mono text-xs">{pendingCompleteRequest.request_id || 'N/A'}</p>
                  </div>
                  {(pendingCompleteRequest.phone_number || pendingCompleteRequest.details?.phone_number || pendingCompleteRequest.details?.mobile_number) && (
                    <div>
                      <p className="text-gray-500">Phone Number</p>
                      <p className="text-white">{pendingCompleteRequest.phone_number || pendingCompleteRequest.details?.phone_number || pendingCompleteRequest.details?.mobile_number}</p>
                    </div>
                  )}
                  {(pendingCompleteRequest.operator || pendingCompleteRequest.details?.operator) && (
                    <div>
                      <p className="text-gray-500">Operator</p>
                      <p className="text-white">{pendingCompleteRequest.operator || pendingCompleteRequest.details?.operator}</p>
                    </div>
                  )}
                  {(pendingCompleteRequest.consumer_number || pendingCompleteRequest.details?.consumer_number || pendingCompleteRequest.details?.subscriber_id || pendingCompleteRequest.details?.dth_number) && (
                    <div className="col-span-2">
                      <p className="text-gray-500">Consumer/Account Number</p>
                      <p className="text-white font-mono">{pendingCompleteRequest.consumer_number || pendingCompleteRequest.details?.consumer_number || pendingCompleteRequest.details?.subscriber_id || pendingCompleteRequest.details?.dth_number}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-700 text-center">
                <p className="text-gray-400">Loading request details...</p>
              </div>
            )}
            
            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3 mb-4">
              <p className="text-amber-300 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Use this when Eko API fails or you have processed the payment offline. Enter the UTR/Transaction Reference for records.</span>
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">UTR / Transaction Reference *</label>
                <Input
                  placeholder="e.g., UTR123456789, TXN-2024-0001"
                  value={manualTxnRef}
                  onChange={(e) => setManualTxnRef(e.target.value.toUpperCase())}
                  className="bg-gray-800 border-gray-700 text-white uppercase h-12"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Admin Notes (Optional)</label>
                <Input
                  placeholder="e.g., Processed via bank portal"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700"
                  onClick={() => {
                    setShowCompleteDialog(false);
                    setPendingCompleteId(null);
                    setPendingCompleteRequest(null);
                    setManualTxnRef('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                  onClick={async () => {
                    if (!manualTxnRef.trim()) {
                      toast.error('Please enter UTR/Reference number');
                      return;
                    }
                    try {
                      setShowCompleteDialog(false);
                      await executeProcess(pendingCompleteId, 'complete', '', manualTxnRef);
                    } catch (err) {
                      console.error('Manual complete error:', err);
                      toast.error('Failed to complete. Please try again.');
                    } finally {
                      setPendingCompleteId(null);
                      setPendingCompleteRequest(null);
                      setManualTxnRef('');
                    }
                  }}
                  disabled={processing || !manualTxnRef.trim()}
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  ✅ Complete Manually
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
