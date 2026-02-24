import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Building2, Clock, CheckCircle, XCircle, Search, RefreshCw,
  ChevronDown, ChevronUp, User, Phone, Mail, CreditCard, AlertCircle,
  PiggyBank, Percent, Copy, Calendar, Filter, Download, FileSpreadsheet, Banknote
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminBankWithdrawals = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [rdRequests, setRdRequests] = useState([]);
  const [emiRequests, setEmiRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [rdStats, setRdStats] = useState({});
  const [emiStats, setEmiStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRequest, setExpandedRequest] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  
  // Request type tab - 'bank', 'rd', or 'emi'
  const [requestType, setRequestType] = useState('bank');
  
  // Date range filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const ITEMS_PER_PAGE = 15;

  // Copy to clipboard helper
  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label || 'Copied'}: ${text}`);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchRequests();
    fetchRdRequests();
    fetchEmiRequests();
  }, [statusFilter, page, debouncedSearch, dateFrom, dateTo, sortOrder]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/bank-redeem/requests`, {
        params: { 
          status: statusFilter === 'all' ? null : statusFilter,
          page: page,
          limit: ITEMS_PER_PAGE,
          search: debouncedSearch || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          sort_order: sortOrder
        }
      });
      setRequests(response.data.requests || []);
      setStats(response.data.stats || {});
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchRdRequests = async () => {
    try {
      const response = await axios.get(`${API}/rd/admin/redeem-requests`, {
        params: { 
          status: statusFilter === 'all' ? null : statusFilter,
          skip: (page - 1) * ITEMS_PER_PAGE,
          limit: ITEMS_PER_PAGE,
          search: debouncedSearch || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          sort_order: sortOrder
        }
      });
      setRdRequests(response.data.requests || []);
      setRdStats(response.data.stats || {});
    } catch (error) {
      console.error('Error fetching RD requests:', error);
    }
  };

  // Fetch EMI Pay requests
  const fetchEmiRequests = async () => {
    try {
      const response = await axios.get(`${API}/admin/bill-payment/requests`, {
        params: {
          status: statusFilter === 'all' ? undefined : statusFilter,
          payment_type: 'emi',
          skip: (page - 1) * ITEMS_PER_PAGE,
          limit: ITEMS_PER_PAGE,
          search: debouncedSearch || undefined
        }
      });
      
      // Filter only EMI type requests
      const emiData = (response.data?.requests || response.data || []).filter(
        r => r.payment_type?.toLowerCase() === 'emi' || r.payment_type?.toLowerCase() === 'loan_emi'
      );
      setEmiRequests(emiData);
      
      // Calculate stats
      const pending = emiData.filter(r => r.status === 'pending').length;
      const approved = emiData.filter(r => r.status === 'approved').length;
      const rejected = emiData.filter(r => r.status === 'rejected').length;
      setEmiStats({ pending, approved, rejected, total: emiData.length });
    } catch (error) {
      console.error('Error fetching EMI requests:', error);
    }
  };

  // Reset page when filter changes
  const handleFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // EMI Approve handler
  const handleEmiApprove = async (requestId) => {
    if (!transactionRef.trim()) {
      toast.error('Please enter transaction reference number');
      return;
    }
    
    setProcessing(requestId);
    try {
      await axios.post(`${API}/admin/bill-payment/requests/${requestId}/approve`, {
        admin_id: user.uid,
        transaction_ref: transactionRef
      });
      toast.success('EMI Payment approved!');
      setTransactionRef('');
      setExpandedRequest(null);
      fetchEmiRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve EMI');
    } finally {
      setProcessing(null);
    }
  };

  // EMI Reject handler
  const handleEmiReject = async (requestId) => {
    if (!rejectReason.trim()) {
      toast.error('Please enter rejection reason');
      return;
    }
    
    setProcessing(requestId);
    try {
      await axios.post(`${API}/admin/bill-payment/requests/${requestId}/reject`, {
        admin_id: user.uid,
        reason: rejectReason
      });
      toast.success('EMI Payment rejected');
      setRejectReason('');
      setExpandedRequest(null);
      fetchEmiRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject EMI');
    } finally {
      setProcessing(null);
    }
  };

  const handleApprove = async (requestId) => {
    if (!transactionRef.trim()) {
      toast.error('Please enter transaction reference number');
      return;
    }
    
    setProcessing(requestId);
    try {
      await axios.post(`${API}/admin/bank-redeem/${requestId}/approve`, {
        admin_id: user.uid,
        transaction_ref: transactionRef
      });
      toast.success('Redeem approved successfully!');
      setTransactionRef('');
      setExpandedRequest(null);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId) => {
    if (!rejectReason.trim()) {
      toast.error('Please enter rejection reason');
      return;
    }
    
    setProcessing(requestId);
    try {
      await axios.post(`${API}/admin/bank-redeem/${requestId}/reject`, {
        admin_id: user.uid,
        reason: rejectReason
      });
      toast.success('Redeem rejected & PRC refunded');
      setRejectReason('');
      setExpandedRequest(null);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  // Savings Vault Redeem handlers
  const handleRdApprove = async (requestId) => {
    if (!transactionRef.trim()) {
      toast.error('Please enter transaction reference number');
      return;
    }
    
    setProcessing(requestId);
    try {
      await axios.post(`${API}/rd/admin/redeem-requests/${requestId}/approve`, null, {
        params: {
          admin_id: user.uid,
          transaction_ref: transactionRef
        }
      });
      toast.success('Savings Vault Redeem approved successfully!');
      setTransactionRef('');
      setExpandedRequest(null);
      fetchRdRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleRdReject = async (requestId) => {
    if (!rejectReason.trim()) {
      toast.error('Please enter rejection reason');
      return;
    }
    
    setProcessing(requestId);
    try {
      await axios.post(`${API}/rd/admin/redeem-requests/${requestId}/reject`, null, {
        params: {
          admin_id: user.uid,
          reason: rejectReason
        }
      });
      toast.success('Savings Vault Redeem rejected');
      setRejectReason('');
      setExpandedRequest(null);
      fetchRdRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  // HDFC Bank Excel Export function
  const handleHDFCExport = async (exportType) => {
    try {
      toast.loading('Generating HDFC Excel file...');
      
      let endpoint = '';
      let filename = '';
      
      switch(exportType) {
        case 'bank_redeem':
          endpoint = `${API}/admin/hdfc-export/bank-redeem?status=approved`;
          filename = 'HDFC_BankRedeem_Approved.xlsx';
          break;
        case 'savings_vault':
          endpoint = `${API}/admin/hdfc-export/savings-vault?status=approved`;
          filename = 'HDFC_SavingsVault_Approved.xlsx';
          break;
        case 'emi':
          endpoint = `${API}/admin/hdfc-export/emi-payments?status=approved`;
          filename = 'HDFC_EMI_Approved.xlsx';
          break;
        case 'combined':
          endpoint = `${API}/admin/hdfc-export/combined?status=approved`;
          filename = 'HDFC_AllPayments_Approved.xlsx';
          break;
        default:
          toast.error('Invalid export type');
          return;
      }
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        const error = await response.json();
        toast.dismiss();
        toast.error(error.detail || 'No approved requests found');
        return;
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.dismiss();
      toast.success(`${filename} downloaded successfully!`);
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to export: ' + (error.message || 'Unknown error'));
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
      approved: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
      rejected: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle }
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${c.color}`}>
        <Icon className="h-3 w-3" />
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  // Current list based on request type
  const currentRequests = requestType === 'bank' ? requests : (requestType === 'rd' ? rdRequests : emiRequests);
  const currentStats = requestType === 'bank' ? stats : (requestType === 'rd' ? rdStats : emiStats);

  // Sorting for display (pending first, then by date)
  const filteredRequests = [...currentRequests].sort((a, b) => {
    if ((a.status === 'approved' || a.status === 'completed') && 
        (b.status === 'approved' || b.status === 'completed')) {
      return new Date(b.processed_at || b.created_at) - new Date(a.processed_at || a.created_at);
    }
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="h-7 w-7 text-green-400" />
            Payment Requests
          </h1>
          <p className="text-gray-400 text-sm mt-1">Manage Bank Redeem, EMI Pay & Savings Vault requests</p>
        </div>
        <Button onClick={() => { fetchRequests(); fetchRdRequests(); fetchEmiRequests(); }} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Request Type Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => { setRequestType('bank'); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            requestType === 'bank' 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Bank Redeem
          {stats.pending?.count > 0 && (
            <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">
              {stats.pending.count}
            </span>
          )}
        </button>
        <button
          onClick={() => { setRequestType('emi'); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            requestType === 'emi' 
              ? 'bg-purple-500 text-white' 
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <Banknote className="w-4 h-4" />
          EMI Pay
          {emiStats.pending > 0 && (
            <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">
              {emiStats.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => { setRequestType('rd'); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            requestType === 'rd' 
              ? 'bg-emerald-500 text-white' 
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <PiggyBank className="w-4 h-4" />
          Savings Vault
          {rdStats.pending > 0 && (
            <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">
              {rdStats.pending}
            </span>
          )}
        </button>
        
        {/* HDFC Export Dropdown */}
        <div className="relative ml-auto group">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            HDFC Export
            <ChevronDown className="w-4 h-4" />
          </button>
          <div className="absolute right-0 mt-1 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="p-2 text-xs text-gray-400 border-b border-gray-700">
              Download Approved Requests (HDFC Format)
            </div>
            <button
              onClick={() => handleHDFCExport('bank_redeem')}
              className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-white hover:bg-gray-700 rounded-t"
            >
              <Building2 className="w-4 h-4 text-green-400" />
              Bank Redeem
            </button>
            <button
              onClick={() => handleHDFCExport('savings_vault')}
              className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-white hover:bg-gray-700"
            >
              <PiggyBank className="w-4 h-4 text-emerald-400" />
              Savings Vault
            </button>
            <button
              onClick={() => handleHDFCExport('emi')}
              className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-white hover:bg-gray-700"
            >
              <CreditCard className="w-4 h-4 text-purple-400" />
              EMI Payments
            </button>
            <button
              onClick={() => handleHDFCExport('combined')}
              className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-white hover:bg-blue-600 rounded-b border-t border-gray-700"
            >
              <Download className="w-4 h-4 text-blue-400" />
              All Combined
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Pending</p>
          <p className="text-2xl font-bold text-white">
            {requestType === 'bank' ? (stats.pending?.count || 0) : 
             requestType === 'emi' ? (emiStats.pending || 0) : (rdStats.pending || 0)}
          </p>
          {requestType === 'bank' && (
            <p className="text-yellow-400/70 text-xs">₹{(stats.pending?.total || 0).toLocaleString()}</p>
          )}
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-green-400 text-sm">Approved</p>
          <p className="text-2xl font-bold text-white">
            {requestType === 'bank' ? (stats.approved?.count || 0) : 
             requestType === 'emi' ? (emiStats.approved || 0) : (rdStats.approved || 0)}
          </p>
          {requestType === 'bank' && (
            <p className="text-green-400/70 text-xs">₹{(stats.approved?.total || 0).toLocaleString()}</p>
          )}
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">Rejected</p>
          <p className="text-2xl font-bold text-white">
            {requestType === 'bank' ? (stats.rejected?.count || 0) : 
             requestType === 'emi' ? (emiStats.rejected || 0) : (rdStats.rejected || 0)}
          </p>
          {requestType === 'bank' && (
            <p className="text-red-400/70 text-xs">₹{(stats.rejected?.total || 0).toLocaleString()}</p>
          )}
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Total Requests</p>
          <p className="text-2xl font-bold text-white">
            {requestType === 'bank' ? requests.length : 
             requestType === 'emi' ? (emiStats.total || emiRequests.length) : rdRequests.length}
          </p>
          <p className="text-blue-400/70 text-xs">Current filter</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          {['pending', 'approved', 'rejected', 'all'].map(status => (
            <button
              key={status}
              onClick={() => handleFilterChange(status)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                statusFilter === status
                  ? 'bg-green-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        
        {/* Date Range & Sort Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              placeholder="From"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              placeholder="To"
            />
          </div>
          
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
          
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm"
            >
              Clear Dates
            </button>
          )}
        </div>
        
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, request ID..."
            className="pl-10 bg-gray-800 border-gray-700 text-white"
          />
        </div>
      </div>

      {/* Requests Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800">
          <Building2 className="h-16 w-16 mx-auto text-gray-700 mb-4" />
          <p className="text-gray-500">No {statusFilter !== 'all' ? statusFilter : ''} requests found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => (
            <div key={req.request_id || req._id} className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Request Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                onClick={() => setExpandedRequest(expandedRequest === (req.request_id || req._id) ? null : (req.request_id || req._id))}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      requestType === 'bank' ? 'bg-green-500/20' : 
                      requestType === 'emi' ? 'bg-purple-500/20' : 'bg-emerald-500/20'
                    }`}>
                      {requestType === 'bank' && <Building2 className="h-6 w-6 text-green-400" />}
                      {requestType === 'emi' && <Banknote className="h-6 w-6 text-purple-400" />}
                      {requestType === 'rd' && <PiggyBank className="h-6 w-6 text-emerald-400" />}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{req.user_name || 'Unknown'}</p>
                      <p className="text-gray-500 text-sm">{req.user_email || req.email}</p>
                      {requestType === 'emi' && req.emi_details && (
                        <p className="text-purple-400 text-xs">{req.emi_details.bank_name} - {req.emi_details.loan_account}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-400">₹{(req.amount_inr || req.amount || req.net_amount || 0).toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">{(req.total_prc_deducted || req.prc_amount || 0).toLocaleString()} PRC</p>
                    </div>
                    {getStatusBadge(req.status)}
                    {expandedRequest === (req.request_id || req._id) ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedRequest === (req.request_id || req._id) && (
                <div className="border-t border-gray-800 p-4 bg-gray-800/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: User & Request Info */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                          <User className="h-4 w-4" /> User Details
                        </h4>
                        <div className="bg-gray-900/50 rounded-xl p-3 space-y-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Name</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white">{req.user_name}</span>
                              <button onClick={() => copyToClipboard(req.user_name, 'Name')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Email</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white">{req.user_email || req.email}</span>
                              <button onClick={() => copyToClipboard(req.user_email || req.email, 'Email')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Mobile</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white">{req.user_mobile || req.mobile || 'N/A'}</span>
                              {(req.user_mobile || req.mobile) && <button onClick={() => copyToClipboard(req.user_mobile || req.mobile, 'Mobile')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>}
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Request ID</span>
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400 font-mono text-xs">{req.request_id || req._id}</span>
                              <button onClick={() => copyToClipboard(req.request_id || req._id, 'Request ID')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                          <CreditCard className="h-4 w-4" /> {requestType === 'emi' ? 'EMI Details' : 'Charge Breakdown'}
                        </h4>
                        <div className="bg-gray-900/50 rounded-xl p-3 space-y-2 text-sm">
                          {/* EMI specific details */}
                          {requestType === 'emi' && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Bank Name</span>
                                <span className="text-white">{req.emi_details?.bank_name || req.bank_details?.bank_name || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Loan Account</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-purple-400 font-mono">{req.emi_details?.loan_account || req.account_number || 'N/A'}</span>
                                  <button onClick={() => copyToClipboard(req.emi_details?.loan_account || req.account_number, 'Account')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                                </div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">EMI Amount</span>
                                <span className="text-amber-400 font-bold">₹{(req.amount_inr || req.amount || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">PRC Deducted</span>
                                <span className="text-white">{(req.prc_amount || req.total_prc_deducted || 0).toLocaleString()} PRC</span>
                              </div>
                              {req.emi_details?.ifsc_code && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">IFSC Code</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white">{req.emi_details.ifsc_code}</span>
                                    <button onClick={() => copyToClipboard(req.emi_details.ifsc_code, 'IFSC')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          {/* Show RD-specific details if it's an RD request */}
                          {(req.request_type === 'rd_redeem' || requestType === 'rd') && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-500">RD ID</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-emerald-400 font-mono">{req.rd_id}</span>
                                  <button onClick={() => copyToClipboard(req.rd_id, 'RD ID')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                                </div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Principal</span>
                                <span className="text-white">{(req.principal_amount || 0).toLocaleString()} PRC</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Bonus Earned</span>
                                <span className="text-green-400">+{(req.interest_earned || 0).toLocaleString()} PRC</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Current Value</span>
                                <span className="text-white">{(req.current_value || 0).toLocaleString()} PRC</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Early Penalty ({req.penalty_percent || 3}%)</span>
                                <span className="text-red-400">-{(req.penalty_amount || 0).toLocaleString()} PRC</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Service Fee ({req.admin_charge_percent || 20}%)</span>
                                <span className="text-red-400">-{(req.admin_charge || 0).toLocaleString()} PRC</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-gray-700">
                                <span className="text-amber-400 font-medium">Net Amount</span>
                                <span className="text-amber-400 font-bold">{(req.net_amount || 0).toLocaleString()} PRC</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-emerald-400 font-medium">Estimated Value</span>
                                <span className="text-emerald-400 font-bold">{(req.amount_inr || 0).toLocaleString()} PRC</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Withdrawal Amount</span>
                                <span className="text-white">₹{req.amount_inr?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Processing Fee</span>
                                <span className="text-orange-400">₹{req.processing_fee_inr?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Admin Charge (20%)</span>
                                <span className="text-orange-400">₹{req.admin_charge_inr?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-gray-700">
                                <span className="text-amber-400 font-medium">Total PRC Deducted</span>
                                <span className="text-amber-400 font-bold">{req.total_prc_deducted?.toLocaleString()} PRC</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Bank Details & Actions */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                          <Building2 className="h-4 w-4" /> Bank Details
                        </h4>
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 space-y-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Account Holder</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{req.bank_details?.account_holder_name}</span>
                              <button onClick={() => copyToClipboard(req.bank_details?.account_holder_name, 'Account Holder')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Account Number</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono">{req.bank_details?.account_number}</span>
                              <button onClick={() => copyToClipboard(req.bank_details?.account_number, 'Account Number')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">IFSC Code</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono">{req.bank_details?.ifsc_code}</span>
                              <button onClick={() => copyToClipboard(req.bank_details?.ifsc_code, 'IFSC Code')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Bank Name</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white">{req.bank_details?.bank_name}</span>
                              <button onClick={() => copyToClipboard(req.bank_details?.bank_name, 'Bank Name')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                            </div>
                          </div>
                          {/* Copy All Bank Details Button */}
                          <button
                            onClick={() => {
                              const details = `Account: ${req.bank_details?.account_number}\nIFSC: ${req.bank_details?.ifsc_code}\nName: ${req.bank_details?.account_holder_name}\nBank: ${req.bank_details?.bank_name}\nAmount: ₹${req.amount_inr || req.net_amount}`;
                              copyToClipboard(details, 'All Bank Details');
                            }}
                            className="w-full mt-2 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs font-medium flex items-center justify-center gap-2"
                          >
                            <Copy className="w-3 h-3" /> Copy All Details
                          </button>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-gray-400 text-sm mb-2">Request Info</h4>
                        <div className="bg-gray-900/50 rounded-xl p-3 space-y-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Request ID</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-xs">{req.request_id}</span>
                              <button onClick={() => copyToClipboard(req.request_id, 'Request ID')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Submitted</span>
                            <span className="text-white">{new Date(req.created_at).toLocaleString()}</span>
                          </div>
                          {(req.processed_by || req.approved_by_name || req.rejected_by_name) && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">
                                {req.status === 'approved' ? 'Approved By' : req.status === 'rejected' ? 'Rejected By' : 'Processed By'}
                              </span>
                              <span className="text-blue-400 font-medium">
                                {req.approved_by_name || req.rejected_by_name || req.processed_by}
                              </span>
                            </div>
                          )}
                          {req.processed_at && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Processed At</span>
                              <span className="text-white">{new Date(req.processed_at).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions for Pending - Different handlers for different request types */}
                      {req.status === 'pending' && (
                        <div className="space-y-3 pt-2">
                          <div>
                            <label className="text-gray-400 text-xs mb-1 block">Transaction Reference (for approval)</label>
                            <Input
                              value={transactionRef}
                              onChange={(e) => setTransactionRef(e.target.value)}
                              placeholder="Enter UTR/Ref number after transfer"
                              className="bg-gray-900 border-gray-700 text-white text-sm"
                            />
                          </div>
                          <div className="flex gap-3">
                            <Button
                              onClick={() => {
                                // Use different handlers based on request type
                                if (requestType === 'emi') {
                                  handleEmiApprove(req._id || req.request_id);
                                } else if (requestType === 'rd') {
                                  handleRdApprove(req.request_id || req._id);
                                } else {
                                  handleApprove(req.request_id);
                                }
                              }}
                              disabled={processing === (req.request_id || req._id)}
                              className="flex-1 bg-green-500 hover:bg-green-600 text-black"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {processing === (req.request_id || req._id) ? 'Processing...' : 'Approve & Mark Paid'}
                            </Button>
                          </div>
                          
                          <div className="pt-2 border-t border-gray-700">
                            <label className="text-gray-400 text-xs mb-1 block">Rejection Reason</label>
                            <Input
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Enter reason for rejection"
                              className="bg-gray-900 border-gray-700 text-white text-sm mb-2"
                            />
                            <Button
                              onClick={() => {
                                // Use different handlers based on request type
                                if (requestType === 'emi') {
                                  handleEmiReject(req._id || req.request_id);
                                } else if (requestType === 'rd') {
                                  handleRdReject(req.request_id || req._id);
                                } else {
                                  handleReject(req.request_id);
                                }
                              }}
                              disabled={processing === (req.request_id || req._id)}
                              variant="destructive"
                              className="w-full"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject & Refund PRC
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Show approval/rejection info */}
                      {req.status === 'approved' && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                          <p className="text-green-400 text-sm font-medium">Approved</p>
                          {req.transaction_ref && (
                            <p className="text-green-300 text-xs mt-1">Ref: {req.transaction_ref}</p>
                          )}
                          {(req.processed_by || req.approved_by_name) && (
                            <p className="text-blue-400 text-xs mt-1 font-medium">
                              Approved By: {req.approved_by_name || req.processed_by}
                            </p>
                          )}
                          <p className="text-gray-400 text-xs mt-1">
                            {new Date(req.processed_at || req.approved_at).toLocaleString()}
                          </p>
                        </div>
                      )}

                      {req.status === 'rejected' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                          <p className="text-red-400 text-sm font-medium">Rejected</p>
                          <p className="text-red-300 text-xs mt-1">{req.rejection_reason}</p>
                          {(req.processed_by || req.rejected_by_name) && (
                            <p className="text-blue-400 text-xs mt-1 font-medium">
                              Rejected By: {req.rejected_by_name || req.processed_by}
                            </p>
                          )}
                          <p className="text-gray-400 text-xs mt-1">PRC Refunded</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-gray-800">
              <p className="text-sm text-gray-400">
                Page {page} of {totalPages} ({total} total requests)
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  variant="outline"
                  size="sm"
                  className="border-gray-700"
                >
                  Previous
                </Button>
                
                {/* Page numbers */}
                <div className="flex gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                          page === pageNum
                            ? 'bg-green-500 text-black'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <Button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  variant="outline"
                  size="sm"
                  className="border-gray-700"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminBankWithdrawals;
