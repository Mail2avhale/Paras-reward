import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Building2, Clock, CheckCircle, XCircle, Search, RefreshCw,
  ChevronDown, ChevronUp, User, Phone, Mail, CreditCard, AlertCircle,
  PiggyBank, Percent, Copy, Calendar, Filter
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminBankWithdrawals = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [rdRequests, setRdRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [rdStats, setRdStats] = useState({});
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRequest, setExpandedRequest] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  
  // Request type tab - 'bank' or 'rd'
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
  }, [statusFilter, page, debouncedSearch, dateFrom, dateTo, sortOrder]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/bank-redeem/requests`, {
        params: { 
          status: statusFilter === 'all' ? null : statusFilter,
          page: page,
          limit: ITEMS_PER_PAGE,
          search: debouncedSearch || undefined
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
          search: debouncedSearch || undefined
        }
      });
      setRdRequests(response.data.requests || []);
      setRdStats(response.data.stats || {});
    } catch (error) {
      console.error('Error fetching RD requests:', error);
    }
  };

  // Reset page when filter changes
  const handleFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

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

  // RD Redeem handlers
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
      toast.success('RD Redeem approved successfully!');
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
      toast.success('RD Redeem rejected');
      setRejectReason('');
      setExpandedRequest(null);
      fetchRdRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setProcessing(null);
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
  const currentRequests = requestType === 'bank' ? requests : rdRequests;
  const currentStats = requestType === 'bank' ? stats : rdStats;

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
            Redeem Requests
          </h1>
          <p className="text-gray-400 text-sm mt-1">Manage Bank Redeem & RD Redeem requests</p>
        </div>
        <Button onClick={() => { fetchRequests(); fetchRdRequests(); }} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Request Type Tabs */}
      <div className="flex gap-2 mb-6">
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
          onClick={() => { setRequestType('rd'); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            requestType === 'rd' 
              ? 'bg-emerald-500 text-white' 
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <PiggyBank className="w-4 h-4" />
          RD Redeem
          {rdStats.pending > 0 && (
            <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">
              {rdStats.pending}
            </span>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Pending</p>
          <p className="text-2xl font-bold text-white">
            {requestType === 'bank' ? (stats.pending?.count || 0) : (rdStats.pending || 0)}
          </p>
          {requestType === 'bank' && (
            <p className="text-yellow-400/70 text-xs">₹{(stats.pending?.total || 0).toLocaleString()}</p>
          )}
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-green-400 text-sm">Approved</p>
          <p className="text-2xl font-bold text-white">
            {requestType === 'bank' ? (stats.approved?.count || 0) : (rdStats.approved || 0)}
          </p>
          {requestType === 'bank' && (
            <p className="text-green-400/70 text-xs">₹{(stats.approved?.total || 0).toLocaleString()}</p>
          )}
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">Rejected</p>
          <p className="text-2xl font-bold text-white">{stats.rejected?.count || 0}</p>
          <p className="text-red-400/70 text-xs">₹{(stats.rejected?.total || 0).toLocaleString()}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Total Requests</p>
          <p className="text-2xl font-bold text-white">{requests.length}</p>
          <p className="text-blue-400/70 text-xs">All time</p>
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
            <div key={req.request_id} className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Request Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                onClick={() => setExpandedRequest(expandedRequest === req.request_id ? null : req.request_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">{req.user_name || 'Unknown'}</p>
                      <p className="text-gray-500 text-sm">{req.user_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-400">₹{req.amount_inr?.toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">{req.total_prc_deducted?.toLocaleString()} PRC</p>
                    </div>
                    {getStatusBadge(req.status)}
                    {expandedRequest === req.request_id ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedRequest === req.request_id && (
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
                              <span className="text-white">{req.user_email}</span>
                              <button onClick={() => copyToClipboard(req.user_email, 'Email')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Mobile</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white">{req.user_mobile || 'N/A'}</span>
                              {req.user_mobile && <button onClick={() => copyToClipboard(req.user_mobile, 'Mobile')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>}
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Request ID</span>
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400 font-mono text-xs">{req.request_id}</span>
                              <button onClick={() => copyToClipboard(req.request_id, 'Request ID')} className="p-1 hover:bg-gray-700 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                          <CreditCard className="h-4 w-4" /> Charge Breakdown
                        </h4>
                        <div className="bg-gray-900/50 rounded-xl p-3 space-y-2 text-sm">
                          {/* Show RD-specific details if it's an RD request */}
                          {req.request_type === 'rd_redeem' ? (
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
                                <span className="text-white">₹{(req.principal_amount || 0).toLocaleString()} PRC</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Interest Earned</span>
                                <span className="text-green-400">+₹{(req.interest_earned || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Current Value</span>
                                <span className="text-white">₹{(req.current_value || 0).toLocaleString()} PRC</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Early Penalty ({req.penalty_percent || 3}%)</span>
                                <span className="text-red-400">-₹{(req.penalty_amount || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Admin Charge ({req.admin_charge_percent || 20}%)</span>
                                <span className="text-red-400">-₹{(req.admin_charge || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-gray-700">
                                <span className="text-amber-400 font-medium">Net Amount (PRC)</span>
                                <span className="text-amber-400 font-bold">₹{(req.net_amount || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-emerald-400 font-medium">Bank Transfer (INR)</span>
                                <span className="text-emerald-400 font-bold">₹{(req.amount_inr || 0).toLocaleString()}</span>
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
                          {req.processed_by && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Processed By</span>
                              <span className="text-blue-400">{req.processed_by}</span>
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

                      {/* Actions for Pending */}
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
                              onClick={() => handleApprove(req.request_id)}
                              disabled={processing === req.request_id}
                              className="flex-1 bg-green-500 hover:bg-green-600 text-black"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {processing === req.request_id ? 'Processing...' : 'Approve & Mark Paid'}
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
                              onClick={() => handleReject(req.request_id)}
                              disabled={processing === req.request_id}
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
                          <p className="text-gray-400 text-xs mt-1">
                            {new Date(req.approved_at).toLocaleString()}
                          </p>
                        </div>
                      )}

                      {req.status === 'rejected' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                          <p className="text-red-400 text-sm font-medium">Rejected</p>
                          <p className="text-red-300 text-xs mt-1">{req.rejection_reason}</p>
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
