import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Building2, Clock, CheckCircle, XCircle, Search, RefreshCw,
  ChevronDown, ChevronUp, User, Phone, Mail, CreditCard, AlertCircle,
  PiggyBank, Copy, Calendar, Filter, Download, FileSpreadsheet, Banknote,
  CheckSquare, Square, ArrowUpDown, Coins, IndianRupee
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminUnifiedPayments = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [allRequests, setAllRequests] = useState([]);
  const [expandedRequest, setExpandedRequest] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'bank', 'emi', 'rd'
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkReject, setShowBulkReject] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkTransactionRef, setBulkTransactionRef] = useState('');
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: { count: 0, prc: 0, inr: 0 },
    approved: { count: 0, prc: 0, inr: 0 },
    rejected: { count: 0, prc: 0, inr: 0 }
  });

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label}: ${text}`);
  };

  useEffect(() => {
    fetchAllRequests();
  }, []);

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      // Fetch all 3 types in parallel
      const [bankRes, rdRes, emiRes] = await Promise.all([
        axios.get(`${API}/admin/bank-redeem/requests`, { params: { limit: 500 } }).catch(() => ({ data: { requests: [] } })),
        axios.get(`${API}/rd/admin/redeem-requests`, { params: { limit: 500 } }).catch(() => ({ data: { requests: [] } })),
        axios.get(`${API}/admin/bill-payment/requests`, { params: { payment_type: 'emi', limit: 500 } }).catch(() => ({ data: [] }))
      ]);

      // Normalize and combine all requests
      const bankRequests = (bankRes.data?.requests || []).map(r => ({
        ...r,
        _type: 'bank',
        _typeLabel: 'Bank Redeem',
        _id: r.request_id || r._id,
        prc_amount: r.prc_amount || 0,
        amount_inr: r.amount_inr || 0,
        created_at: r.created_at || r.timestamp
      }));

      const rdRequests = (rdRes.data?.requests || []).map(r => ({
        ...r,
        _type: 'rd',
        _typeLabel: 'Savings Vault',
        _id: r.request_id || r._id,
        prc_amount: r.net_amount || r.current_value || 0,
        amount_inr: r.amount_inr || 0,
        created_at: r.created_at || r.requested_at
      }));

      const emiData = Array.isArray(emiRes.data) ? emiRes.data : (emiRes.data?.requests || []);
      const emiRequests = emiData.filter(r => 
        r.payment_type?.toLowerCase() === 'emi' || r.payment_type?.toLowerCase() === 'loan_emi'
      ).map(r => ({
        ...r,
        _type: 'emi',
        _typeLabel: 'EMI Pay',
        _id: r._id || r.request_id,
        prc_amount: r.total_prc_deducted || r.prc_amount || 0,
        amount_inr: r.amount_inr || r.emi_amount || 0,
        created_at: r.created_at || r.timestamp
      }));

      const combined = [...bankRequests, ...rdRequests, ...emiRequests];
      setAllRequests(combined);
      calculateStats(combined);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (requests) => {
    const pending = requests.filter(r => r.status === 'pending');
    const approved = requests.filter(r => ['approved', 'completed'].includes(r.status));
    const rejected = requests.filter(r => r.status === 'rejected');

    setStats({
      total: requests.length,
      pending: {
        count: pending.length,
        prc: pending.reduce((sum, r) => sum + (r.prc_amount || 0), 0),
        inr: pending.reduce((sum, r) => sum + (r.amount_inr || 0), 0)
      },
      approved: {
        count: approved.length,
        prc: approved.reduce((sum, r) => sum + (r.prc_amount || 0), 0),
        inr: approved.reduce((sum, r) => sum + (r.amount_inr || 0), 0)
      },
      rejected: {
        count: rejected.length,
        prc: rejected.reduce((sum, r) => sum + (r.prc_amount || 0), 0),
        inr: rejected.reduce((sum, r) => sum + (r.amount_inr || 0), 0)
      }
    });
  };

  // Filter and sort requests
  const filteredRequests = useMemo(() => {
    let filtered = [...allRequests];

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'approved') {
        filtered = filtered.filter(r => ['approved', 'completed'].includes(r.status));
      } else {
        filtered = filtered.filter(r => r.status === statusFilter);
      }
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r._type === typeFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.user_name?.toLowerCase().includes(q) ||
        r.user_email?.toLowerCase().includes(q) ||
        r.account_number?.includes(q) ||
        r.ifsc_code?.toLowerCase().includes(q) ||
        r._id?.toLowerCase().includes(q)
      );
    }

    // Date filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(r => new Date(r.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => new Date(r.created_at) <= to);
    }

    // Sort by date
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [allRequests, statusFilter, typeFilter, searchQuery, dateFrom, dateTo, sortOrder]);

  // Selection handlers
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const pendingIds = filteredRequests.filter(r => r.status === 'pending').map(r => r._id);
    setSelectedIds(pendingIds);
  };

  const clearSelection = () => setSelectedIds([]);

  // Individual approve/reject handlers
  const handleApprove = async (request) => {
    if (!transactionRef.trim()) {
      toast.error('Please enter UTR/Transaction reference');
      return;
    }

    setProcessing(request._id);
    try {
      if (request._type === 'bank') {
        await axios.post(`${API}/admin/bank-redeem/requests/${request._id}/approve`, {
          admin_uid: user.uid,
          transaction_ref: transactionRef,
          admin_name: user.name || user.email
        });
      } else if (request._type === 'rd') {
        await axios.post(`${API}/rd/admin/redeem/${request._id}/approve`, {
          admin_uid: user.uid,
          transaction_ref: transactionRef
        });
      } else if (request._type === 'emi') {
        await axios.post(`${API}/admin/bill-payment/requests/${request._id}/approve`, {
          admin_id: user.uid,
          transaction_ref: transactionRef
        });
      }
      
      toast.success(`${request._typeLabel} approved!`);
      setTransactionRef('');
      setExpandedRequest(null);
      fetchAllRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Approval failed');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request) => {
    if (!rejectReason.trim()) {
      toast.error('Please enter rejection reason');
      return;
    }

    setProcessing(request._id);
    try {
      if (request._type === 'bank') {
        await axios.post(`${API}/admin/bank-redeem/requests/${request._id}/reject`, {
          admin_uid: user.uid,
          reason: rejectReason,
          admin_name: user.name || user.email
        });
      } else if (request._type === 'rd') {
        await axios.post(`${API}/rd/admin/redeem/${request._id}/reject`, {
          admin_uid: user.uid,
          reason: rejectReason
        });
      } else if (request._type === 'emi') {
        await axios.post(`${API}/admin/bill-payment/requests/${request._id}/reject`, {
          admin_id: user.uid,
          reason: rejectReason
        });
      }
      
      toast.success(`${request._typeLabel} rejected`);
      setRejectReason('');
      setExpandedRequest(null);
      fetchAllRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Rejection failed');
    } finally {
      setProcessing(null);
    }
  };

  // Bulk approve
  const handleBulkApprove = async () => {
    if (!bulkTransactionRef.trim()) {
      toast.error('Please enter UTR/Transaction reference for bulk approval');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('No requests selected');
      return;
    }

    setBulkProcessing(true);
    let success = 0, failed = 0;

    for (const id of selectedIds) {
      const request = allRequests.find(r => r._id === id);
      if (!request || request.status !== 'pending') continue;

      try {
        if (request._type === 'bank') {
          await axios.post(`${API}/admin/bank-redeem/requests/${id}/approve`, {
            admin_uid: user.uid,
            transaction_ref: bulkTransactionRef,
            admin_name: user.name || user.email
          });
        } else if (request._type === 'rd') {
          await axios.post(`${API}/rd/admin/redeem/${id}/approve`, {
            admin_uid: user.uid,
            transaction_ref: bulkTransactionRef
          });
        } else if (request._type === 'emi') {
          await axios.post(`${API}/admin/bill-payment/requests/${id}/approve`, {
            admin_id: user.uid,
            transaction_ref: bulkTransactionRef
          });
        }
        success++;
      } catch (error) {
        failed++;
        console.error(`Failed to approve ${id}:`, error);
      }
    }

    toast.success(`Bulk Approve: ${success} approved, ${failed} failed`);
    setBulkTransactionRef('');
    setSelectedIds([]);
    setBulkProcessing(false);
    fetchAllRequests();
  };

  // Bulk reject
  const handleBulkReject = async () => {
    if (!bulkRejectReason.trim()) {
      toast.error('Please enter rejection reason');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('No requests selected');
      return;
    }

    setBulkProcessing(true);
    let success = 0, failed = 0;

    for (const id of selectedIds) {
      const request = allRequests.find(r => r._id === id);
      if (!request || request.status !== 'pending') continue;

      try {
        if (request._type === 'bank') {
          await axios.post(`${API}/admin/bank-redeem/requests/${id}/reject`, {
            admin_uid: user.uid,
            reason: bulkRejectReason,
            admin_name: user.name || user.email
          });
        } else if (request._type === 'rd') {
          await axios.post(`${API}/rd/admin/redeem/${id}/reject`, {
            admin_uid: user.uid,
            reason: bulkRejectReason
          });
        } else if (request._type === 'emi') {
          await axios.post(`${API}/admin/bill-payment/requests/${id}/reject`, {
            admin_id: user.uid,
            reason: bulkRejectReason
          });
        }
        success++;
      } catch (error) {
        failed++;
        console.error(`Failed to reject ${id}:`, error);
      }
    }

    toast.success(`Bulk Reject: ${success} rejected, ${failed} failed`);
    setBulkRejectReason('');
    setSelectedIds([]);
    setShowBulkReject(false);
    setBulkProcessing(false);
    fetchAllRequests();
  };

  // HDFC Export
  const handleHDFCExport = async () => {
    try {
      const response = await axios.get(`${API}/admin/export-hdfc-bulk-payment`, {
        params: { status: 'pending' },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `HDFC_Bulk_Payment_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('HDFC Export downloaded');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      approved: 'bg-green-500/20 text-green-400 border-green-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return styles[status] || styles.pending;
  };

  const getTypeBadge = (type) => {
    const styles = {
      bank: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      rd: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      emi: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    };
    return styles[type] || styles.bank;
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Banknote className="w-7 h-7 text-emerald-500" />
            Unified Payment Dashboard
          </h1>
          <p className="text-gray-400 text-sm mt-1">All payment requests in one place</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAllRequests} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleHDFCExport} variant="outline" size="sm" className="gap-2 text-green-400 border-green-500/30">
            <FileSpreadsheet className="w-4 h-4" />
            HDFC Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className={`p-4 cursor-pointer transition-all ${statusFilter === 'pending' ? 'ring-2 ring-yellow-500' : ''} bg-yellow-500/10 border-yellow-500/30`}
          onClick={() => setStatusFilter('pending')}
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-400 text-sm font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.pending?.count || 0}</p>
          <div className="flex justify-between text-xs mt-2">
            <span className="text-purple-400">{(stats.pending?.prc || 0).toLocaleString()} PRC</span>
            <span className="text-green-400">{(stats.pending?.inr || 0).toLocaleString()} INR</span>
          </div>
        </Card>

        <Card 
          className={`p-4 cursor-pointer transition-all ${statusFilter === 'approved' ? 'ring-2 ring-green-500' : ''} bg-green-500/10 border-green-500/30`}
          onClick={() => setStatusFilter('approved')}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400 text-sm font-medium">Approved</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.approved?.count || 0}</p>
          <div className="flex justify-between text-xs mt-2">
            <span className="text-purple-400">{(stats.approved?.prc || 0).toLocaleString()} PRC</span>
            <span className="text-green-400">{(stats.approved?.inr || 0).toLocaleString()} INR</span>
          </div>
        </Card>

        <Card 
          className={`p-4 cursor-pointer transition-all ${statusFilter === 'rejected' ? 'ring-2 ring-red-500' : ''} bg-red-500/10 border-red-500/30`}
          onClick={() => setStatusFilter('rejected')}
        >
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm font-medium">Rejected</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.rejected?.count || 0}</p>
          <div className="flex justify-between text-xs mt-2">
            <span className="text-purple-400">{(stats.rejected?.prc || 0).toLocaleString()} PRC</span>
            <span className="text-green-400">{(stats.rejected?.inr || 0).toLocaleString()} INR</span>
          </div>
        </Card>

        <Card 
          className={`p-4 cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-blue-500' : ''} bg-blue-500/10 border-blue-500/30`}
          onClick={() => setStatusFilter('all')}
        >
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="w-5 h-5 text-blue-400" />
            <span className="text-blue-400 text-sm font-medium">All Total</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total || 0}</p>
          <div className="flex justify-between text-xs mt-2">
            <span className="text-gray-400">All requests</span>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-gray-900 border-gray-800">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, account..."
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          >
            <option value="all">All Types</option>
            <option value="bank">Bank Redeem</option>
            <option value="emi">EMI Pay</option>
            <option value="rd">Savings Vault</option>
          </select>

          {/* Date From */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36 bg-gray-800 border-gray-700 text-white text-sm"
            />
          </div>

          {/* Date To */}
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36 bg-gray-800 border-gray-700 text-white text-sm"
          />

          {/* Sort Order */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="gap-2"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </Button>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card className="p-4 bg-purple-500/10 border-purple-500/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-purple-400" />
              <span className="text-purple-400 font-medium">{selectedIds.length} selected</span>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="text-gray-400">
                Clear
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-3 items-center">
              {!showBulkReject ? (
                <>
                  <Input
                    value={bulkTransactionRef}
                    onChange={(e) => setBulkTransactionRef(e.target.value)}
                    placeholder="UTR/Ref for all"
                    className="w-48 bg-gray-800 border-gray-700 text-white"
                  />
                  <Button
                    onClick={handleBulkApprove}
                    disabled={bulkProcessing}
                    className="bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {bulkProcessing ? 'Processing...' : 'Approve Selected'}
                  </Button>
                  <Button
                    onClick={() => setShowBulkReject(true)}
                    variant="destructive"
                    className="gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Selected
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    value={bulkRejectReason}
                    onChange={(e) => setBulkRejectReason(e.target.value)}
                    placeholder="Rejection reason"
                    className="w-64 bg-gray-800 border-gray-700 text-white"
                  />
                  <Button
                    onClick={handleBulkReject}
                    disabled={bulkProcessing}
                    variant="destructive"
                    className="gap-2"
                  >
                    {bulkProcessing ? 'Processing...' : 'Confirm Reject'}
                  </Button>
                  <Button
                    onClick={() => setShowBulkReject(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Select All Button */}
      {statusFilter === 'pending' && filteredRequests.filter(r => r.status === 'pending').length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={selectAll} className="gap-2">
            <CheckSquare className="w-4 h-4" />
            Select All Pending ({filteredRequests.filter(r => r.status === 'pending').length})
          </Button>
        </div>
      )}

      {/* Requests List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card className="p-12 text-center bg-gray-900 border-gray-800">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">No requests found</p>
          </Card>
        ) : (
          filteredRequests.map((req) => (
            <Card 
              key={req._id}
              className={`bg-gray-900 border-gray-800 overflow-hidden ${expandedRequest === req._id ? 'ring-2 ring-purple-500' : ''}`}
            >
              {/* Request Row */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                onClick={() => setExpandedRequest(expandedRequest === req._id ? null : req._id)}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox for pending */}
                  {req.status === 'pending' && (
                    <div onClick={(e) => { e.stopPropagation(); toggleSelect(req._id); }}>
                      {selectedIds.includes(req._id) ? (
                        <CheckSquare className="w-5 h-5 text-purple-400 cursor-pointer" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-400" />
                      )}
                    </div>
                  )}

                  {/* Type Badge */}
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getTypeBadge(req._type)}`}>
                    {req._typeLabel}
                  </span>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-white truncate">{req.user_name || 'Unknown'}</span>
                    </div>
                    <p className="text-gray-500 text-sm truncate">{req.user_email}</p>
                  </div>

                  {/* PRC Amount */}
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Coins className="w-4 h-4 text-purple-400" />
                      <span className="text-purple-400 font-bold">{(req.prc_amount || 0).toLocaleString()}</span>
                      <span className="text-purple-400 text-sm">PRC</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end text-sm">
                      <IndianRupee className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">{(req.amount_inr || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusBadge(req.status)}`}>
                    {req.status?.toUpperCase()}
                  </span>

                  {/* Date */}
                  <div className="text-right text-sm text-gray-500 hidden md:block">
                    {formatDate(req.created_at)}
                  </div>

                  {/* Expand Icon */}
                  {expandedRequest === req._id ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedRequest === req._id && (
                <div className="p-4 border-t border-gray-800 bg-gray-900/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left - Details */}
                    <div className="space-y-3 text-sm">
                      <h4 className="font-semibold text-white mb-3">{req._typeLabel} Details</h4>
                      
                      {/* Bank details */}
                      {req._type === 'bank' && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Account Holder</span>
                            <span className="text-white">{req.account_holder_name || '-'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Account Number</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono">{req.account_number}</span>
                              <Copy className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" onClick={() => copyToClipboard(req.account_number, 'Account')} />
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">IFSC Code</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono">{req.ifsc_code}</span>
                              <Copy className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" onClick={() => copyToClipboard(req.ifsc_code, 'IFSC')} />
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Bank Name</span>
                            <span className="text-white">{req.bank_name || '-'}</span>
                          </div>
                        </>
                      )}

                      {/* EMI details */}
                      {req._type === 'emi' && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Bank Name</span>
                            <span className="text-white">{req.bank_name || '-'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Loan Account</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono">{req.loan_account_number || req.account_number || '-'}</span>
                              <Copy className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" onClick={() => copyToClipboard(req.loan_account_number || req.account_number, 'Loan Account')} />
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">IFSC Code</span>
                            <span className="text-white font-mono">{req.ifsc_code || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">EMI Amount</span>
                            <span className="text-green-400">{(req.emi_amount || req.amount_inr || 0).toLocaleString()} INR</span>
                          </div>
                        </>
                      )}

                      {/* RD/Savings Vault details */}
                      {req._type === 'rd' && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">RD ID</span>
                            <span className="text-emerald-400 font-mono">{req.rd_id}</span>
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
                            <span className="text-gray-500">Net Amount</span>
                            <span className="text-amber-400 font-bold">{(req.net_amount || 0).toLocaleString()} PRC</span>
                          </div>
                        </>
                      )}

                      {/* Common - PRC and INR */}
                      <div className="pt-3 border-t border-gray-700">
                        <div className="flex justify-between">
                          <span className="text-purple-400">PRC Amount</span>
                          <span className="text-purple-400 font-bold">{(req.prc_amount || 0).toLocaleString()} PRC</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-400">INR Value</span>
                          <span className="text-green-400 font-bold">{(req.amount_inr || 0).toLocaleString()} INR</span>
                        </div>
                      </div>

                      {/* Status info */}
                      {req.status === 'approved' && req.transaction_ref && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">UTR/Reference</span>
                          <span className="text-green-400">{req.transaction_ref}</span>
                        </div>
                      )}
                      {req.status === 'rejected' && req.rejection_reason && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Rejection Reason</span>
                          <span className="text-red-400">{req.rejection_reason}</span>
                        </div>
                      )}
                    </div>

                    {/* Right - Actions */}
                    {req.status === 'pending' && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-white">Actions</h4>
                        
                        {/* Approve */}
                        <div className="space-y-2">
                          <label className="text-gray-400 text-xs">UTR/Transaction Reference</label>
                          <Input
                            value={transactionRef}
                            onChange={(e) => setTransactionRef(e.target.value)}
                            placeholder="Enter UTR/Ref after transfer"
                            className="bg-gray-800 border-gray-700 text-white"
                          />
                          <Button
                            onClick={() => handleApprove(req)}
                            disabled={processing === req._id}
                            className="w-full bg-green-600 hover:bg-green-700 gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {processing === req._id ? 'Processing...' : 'Approve & Mark Paid'}
                          </Button>
                        </div>

                        {/* Reject */}
                        <div className="space-y-2 pt-3 border-t border-gray-700">
                          <label className="text-gray-400 text-xs">Rejection Reason</label>
                          <Input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Enter rejection reason"
                            className="bg-gray-800 border-gray-700 text-white"
                          />
                          <Button
                            onClick={() => handleReject(req)}
                            disabled={processing === req._id}
                            variant="destructive"
                            className="w-full gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject & Refund PRC
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Results Count */}
      <div className="text-center text-gray-500 text-sm">
        Showing {filteredRequests.length} of {allRequests.length} requests
      </div>
    </div>
  );
};

export default AdminUnifiedPayments;
