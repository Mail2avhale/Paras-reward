import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Building2, Clock, CheckCircle, XCircle, Search, RefreshCw,
  ChevronDown, ChevronUp, User, Phone, Mail, CreditCard, AlertCircle,
  PiggyBank, Copy, Calendar, Filter, Download, FileSpreadsheet, Banknote,
  CheckSquare, Square, ArrowUpDown, Coins, IndianRupee, RotateCcw, Eye,
  Hash, Building, Landmark
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
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkReject, setShowBulkReject] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkTransactionRef, setBulkTransactionRef] = useState('');
  
  // Detail modal
  const [viewDetailRequest, setViewDetailRequest] = useState(null);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0, bank: 0, emi: 0, rd: 0,
    pending: { count: 0, prc: 0, inr: 0 },
    approved: { count: 0, prc: 0, inr: 0 },
    rejected: { count: 0, prc: 0, inr: 0 }
  });

  // Copy to clipboard with visual feedback
  const copyToClipboard = (e, text, label) => {
    e?.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}`, { duration: 1500 });
  };

  useEffect(() => {
    fetchAllRequests();
  }, []);

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      const [bankRes, rdRes, emiRes] = await Promise.all([
        axios.get(`${API}/admin/bank-redeem/requests`, { params: { limit: 1000 } }).catch(() => ({ data: { requests: [] } })),
        axios.get(`${API}/rd/admin/redeem-requests`, { params: { limit: 1000 } }).catch(() => ({ data: { requests: [] } })),
        axios.get(`${API}/admin/bill-payment/requests`, { params: { payment_type: 'emi', limit: 1000 } }).catch(() => ({ data: [] }))
      ]);

      const bankRequests = (bankRes.data?.requests || []).map(r => ({
        ...r,
        _type: 'bank',
        _typeLabel: 'Bank Redeem',
        _id: r.request_id || r._id,
        request_id: r.request_id || r._id,
        prc_amount: r.prc_amount || 0,
        amount_inr: r.amount_inr || 0,
        mobile: r.user_mobile || r.mobile || '',
        created_at: r.created_at || r.timestamp
      }));

      const rdRequests = (rdRes.data?.requests || []).map(r => ({
        ...r,
        _type: 'rd',
        _typeLabel: 'Savings',
        _id: r.request_id || r._id,
        request_id: r.request_id || r._id || r.rd_id,
        prc_amount: r.net_amount || r.current_value || 0,
        amount_inr: r.amount_inr || 0,
        mobile: r.user_mobile || r.mobile || '',
        created_at: r.created_at || r.requested_at
      }));

      const emiData = Array.isArray(emiRes.data) ? emiRes.data : (emiRes.data?.requests || []);
      const emiRequests = emiData.filter(r => 
        r.payment_type?.toLowerCase() === 'emi' || r.payment_type?.toLowerCase() === 'loan_emi'
      ).map(r => ({
        ...r,
        _type: 'emi',
        _typeLabel: 'EMI',
        _id: r._id || r.request_id,
        request_id: r._id || r.request_id,
        prc_amount: r.total_prc_deducted || r.prc_amount || 0,
        amount_inr: r.amount_inr || r.emi_amount || 0,
        mobile: r.user_mobile || r.mobile || '',
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
      bank: requests.filter(r => r._type === 'bank').length,
      emi: requests.filter(r => r._type === 'emi').length,
      rd: requests.filter(r => r._type === 'rd').length,
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

    // Advanced search - name, mobile, email, account, IFSC, request ID
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.user_name?.toLowerCase().includes(q) ||
        r.user_email?.toLowerCase().includes(q) ||
        r.mobile?.includes(q) ||
        r.user_mobile?.includes(q) ||
        r.account_number?.includes(q) ||
        r.ifsc_code?.toLowerCase().includes(q) ||
        r.request_id?.toLowerCase().includes(q) ||
        r._id?.toLowerCase().includes(q) ||
        r.bank_name?.toLowerCase().includes(q)
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
  const toggleSelect = (e, id) => {
    e?.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const pendingIds = filteredRequests.filter(r => r.status === 'pending').map(r => r._id);
    setSelectedIds(pendingIds);
  };

  const clearSelection = () => setSelectedIds([]);

  // Individual approve handler
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

  // Individual reject handler
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

  // Revert status - change approved/rejected back to pending
  const handleRevertStatus = async (request) => {
    if (!window.confirm(`Are you sure you want to revert this ${request._typeLabel} request to PENDING status? This will undo the previous action.`)) {
      return;
    }

    setProcessing(request._id);
    try {
      await axios.post(`${API}/admin/payment-request/revert-status`, {
        request_id: request._id,
        request_type: request._type,
        admin_uid: user.uid,
        admin_name: user.name || user.email
      });
      
      toast.success('Request reverted to pending!');
      fetchAllRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to revert status');
    } finally {
      setProcessing(null);
    }
  };

  // Bulk approve
  const handleBulkApprove = async () => {
    if (!bulkTransactionRef.trim()) {
      toast.error('Please enter UTR/Transaction reference');
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
      day: '2-digit', month: 'numeric', year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      approved: 'bg-green-500/20 text-green-400',
      completed: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400'
    };
    return styles[status] || styles.pending;
  };

  const getTypeBadge = (type) => {
    const styles = {
      bank: 'bg-blue-500/20 text-blue-400',
      rd: 'bg-purple-500/20 text-purple-400',
      emi: 'bg-orange-500/20 text-orange-400'
    };
    return styles[type] || styles.bank;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Banknote className="w-6 h-6 text-emerald-500" />
            Unified Payment Dashboard
          </h1>
          <p className="text-gray-500 text-sm">Bank Redeem + EMI + Savings Vault - All in One</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAllRequests} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleHDFCExport} size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
            <FileSpreadsheet className="w-4 h-4" />
            HDFC Export
          </Button>
        </div>
      </div>

      {/* Stats Cards - Top Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 bg-gray-800/50 border-gray-700">
          <p className="text-gray-400 text-xs">Total Requests</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </Card>
        <Card className="p-3 bg-blue-500/10 border-blue-500/30">
          <p className="text-blue-400 text-xs flex items-center gap-1"><Building2 className="w-3 h-3" /> Bank Redeem</p>
          <p className="text-2xl font-bold text-white">{stats.bank}</p>
        </Card>
        <Card className="p-3 bg-orange-500/10 border-orange-500/30">
          <p className="text-orange-400 text-xs flex items-center gap-1"><CreditCard className="w-3 h-3" /> EMI</p>
          <p className="text-2xl font-bold text-white">{stats.emi}</p>
        </Card>
        <Card className="p-3 bg-purple-500/10 border-purple-500/30">
          <p className="text-purple-400 text-xs flex items-center gap-1"><PiggyBank className="w-3 h-3" /> Savings</p>
          <p className="text-2xl font-bold text-white">{stats.rd}</p>
        </Card>
      </div>

      {/* Selected Count */}
      {selectedIds.length > 0 && (
        <Card className="p-3 bg-cyan-500/10 border-cyan-500/30">
          <div className="flex items-center justify-between">
            <span className="text-cyan-400">Selected: {selectedIds.length}</span>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="text-gray-400 text-xs">
              Clear
            </Button>
          </div>
        </Card>
      )}

      {/* Status Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {['pending', 'approved', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setSelectedIds([]); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === status 
                ? status === 'pending' ? 'bg-yellow-500 text-black' 
                  : status === 'approved' ? 'bg-green-500 text-black'
                  : 'bg-red-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
        
        <div className="border-l border-gray-700 mx-2" />
        
        {/* Type Filters */}
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 ${
            typeFilter === 'all' ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-gray-400'
          }`}
        >
          <Filter className="w-3 h-3" /> All
        </button>
        <button
          onClick={() => setTypeFilter('bank')}
          className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 ${
            typeFilter === 'bank' ? 'bg-blue-500 text-black' : 'bg-gray-800 text-gray-400'
          }`}
        >
          <Building2 className="w-3 h-3" /> Bank
        </button>
        <button
          onClick={() => setTypeFilter('emi')}
          className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 ${
            typeFilter === 'emi' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-400'
          }`}
        >
          <CreditCard className="w-3 h-3" /> EMI
        </button>
        <button
          onClick={() => setTypeFilter('rd')}
          className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 ${
            typeFilter === 'rd' ? 'bg-purple-500 text-black' : 'bg-gray-800 text-gray-400'
          }`}
        >
          <PiggyBank className="w-3 h-3" /> Savings
        </button>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, bank, request ID..."
              className="pl-9 bg-gray-800 border-gray-700 text-white h-10"
            />
          </div>
        </div>
      </div>

      {/* Date Range & Sort */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-32 bg-gray-800 border-gray-700 text-white text-sm h-9"
          />
          <span className="text-gray-500">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-32 bg-gray-800 border-gray-700 text-white text-sm h-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
          className="gap-1 h-9"
        >
          <ArrowUpDown className="w-3 h-3" />
          {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
        </Button>
        
        {statusFilter === 'pending' && filteredRequests.filter(r => r.status === 'pending').length > 0 && (
          <Button variant="outline" size="sm" onClick={selectAll} className="gap-1 ml-auto h-9">
            <CheckSquare className="w-3 h-3" />
            Select All ({filteredRequests.filter(r => r.status === 'pending').length})
          </Button>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card className="p-3 bg-purple-500/10 border-purple-500/30">
          <div className="flex flex-wrap items-center gap-3">
            {!showBulkReject ? (
              <>
                <Input
                  value={bulkTransactionRef}
                  onChange={(e) => setBulkTransactionRef(e.target.value)}
                  placeholder="UTR/Ref for all selected"
                  className="w-48 bg-gray-800 border-gray-700 text-white h-9"
                />
                <Button
                  onClick={handleBulkApprove}
                  disabled={bulkProcessing}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 gap-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  {bulkProcessing ? 'Processing...' : 'Approve Selected'}
                </Button>
                <Button
                  onClick={() => setShowBulkReject(true)}
                  size="sm"
                  variant="destructive"
                  className="gap-1"
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
                  className="w-64 bg-gray-800 border-gray-700 text-white h-9"
                />
                <Button onClick={handleBulkReject} disabled={bulkProcessing} size="sm" variant="destructive">
                  {bulkProcessing ? 'Processing...' : 'Confirm Reject'}
                </Button>
                <Button onClick={() => setShowBulkReject(false)} size="sm" variant="outline">
                  Cancel
                </Button>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Table Header */}
      <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-gray-800/50 rounded-lg text-xs text-gray-400 font-medium">
        <div className="col-span-1"></div>
        <div className="col-span-1">TYPE</div>
        <div className="col-span-1">REQUEST ID</div>
        <div className="col-span-2">USER</div>
        <div className="col-span-2">BANK A/C</div>
        <div className="col-span-1">IFSC</div>
        <div className="col-span-1">AMOUNT</div>
        <div className="col-span-1">STATUS</div>
        <div className="col-span-1">DATE</div>
        <div className="col-span-1">ACTIONS</div>
      </div>

      {/* Requests List */}
      <div className="space-y-2">
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
              className={`bg-gray-900 border-gray-800 overflow-hidden ${expandedRequest === req._id ? 'ring-1 ring-purple-500' : ''}`}
            >
              {/* Row */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm cursor-pointer hover:bg-gray-800/30"
                   onClick={() => setExpandedRequest(expandedRequest === req._id ? null : req._id)}>
                
                {/* Checkbox */}
                <div className="col-span-1 flex items-center gap-2">
                  {req.status === 'pending' && (
                    <div onClick={(e) => toggleSelect(e, req._id)}>
                      {selectedIds.includes(req._id) ? (
                        <CheckSquare className="w-5 h-5 text-cyan-400" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-600 hover:text-gray-400" />
                      )}
                    </div>
                  )}
                </div>

                {/* Type */}
                <div className="col-span-1">
                  <span className={`px-2 py-1 text-xs rounded ${getTypeBadge(req._type)}`}>
                    {req._typeLabel}
                  </span>
                </div>

                {/* Request ID */}
                <div className="col-span-1 flex items-center gap-1">
                  <span className="text-gray-400 font-mono text-xs truncate">{req.request_id?.slice(-8) || '-'}</span>
                  <Copy 
                    className="w-3 h-3 text-gray-600 hover:text-white cursor-pointer flex-shrink-0" 
                    onClick={(e) => copyToClipboard(e, req.request_id, 'Request ID')} 
                  />
                </div>

                {/* User */}
                <div className="col-span-2">
                  <p className="text-white font-medium truncate">{req.user_name || 'Unknown'}</p>
                  <p className="text-gray-500 text-xs truncate">{req.mobile || req.user_mobile || req.user_email || ''}</p>
                </div>

                {/* Bank Account */}
                <div className="col-span-2 flex items-center gap-1">
                  <span className="text-gray-300 font-mono text-xs truncate">{req.account_number || '-'}</span>
                  {req.account_number && (
                    <Copy 
                      className="w-3 h-3 text-gray-600 hover:text-white cursor-pointer flex-shrink-0" 
                      onClick={(e) => copyToClipboard(e, req.account_number, 'Account')} 
                    />
                  )}
                </div>

                {/* IFSC */}
                <div className="col-span-1 flex items-center gap-1">
                  <span className="text-gray-400 font-mono text-xs">{req.ifsc_code || '-'}</span>
                  {req.ifsc_code && (
                    <Copy 
                      className="w-3 h-3 text-gray-600 hover:text-white cursor-pointer flex-shrink-0" 
                      onClick={(e) => copyToClipboard(e, req.ifsc_code, 'IFSC')} 
                    />
                  )}
                </div>

                {/* Amount */}
                <div className="col-span-1 text-right">
                  <span className="text-green-400 font-bold">₹{(req.amount_inr || 0).toLocaleString()}</span>
                </div>

                {/* Status */}
                <div className="col-span-1">
                  <span className={`px-2 py-1 text-xs rounded ${getStatusBadge(req.status)}`}>
                    {req.status}
                  </span>
                </div>

                {/* Date */}
                <div className="col-span-1 text-gray-500 text-xs">
                  {formatDate(req.created_at)}
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 w-7 p-0"
                    onClick={(e) => { e.stopPropagation(); setViewDetailRequest(req); }}
                  >
                    <Eye className="w-4 h-4 text-gray-400" />
                  </Button>
                  {expandedRequest === req._id ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </div>

              {/* Expanded Actions */}
              {expandedRequest === req._id && (
                <div className="px-4 py-4 border-t border-gray-800 bg-gray-900/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Details */}
                    <div className="space-y-2 text-sm">
                      <h4 className="font-semibold text-white">{req._typeLabel} Details</h4>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-500">PRC Amount:</span>
                        <span className="text-purple-400 font-bold">{(req.prc_amount || 0).toLocaleString()} PRC</span>
                        
                        <span className="text-gray-500">INR Value:</span>
                        <span className="text-green-400 font-bold">₹{(req.amount_inr || 0).toLocaleString()}</span>
                        
                        {req.bank_name && (
                          <>
                            <span className="text-gray-500">Bank:</span>
                            <span className="text-white">{req.bank_name}</span>
                          </>
                        )}
                        
                        {req.transaction_ref && (
                          <>
                            <span className="text-gray-500">UTR/Ref:</span>
                            <span className="text-green-400">{req.transaction_ref}</span>
                          </>
                        )}
                        
                        {req.rejection_reason && (
                          <>
                            <span className="text-gray-500">Rejection:</span>
                            <span className="text-red-400">{req.rejection_reason}</span>
                          </>
                        )}
                        
                        {req.processed_by && (
                          <>
                            <span className="text-gray-500">Processed By:</span>
                            <span className="text-gray-300">{req.processed_by}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                      {req.status === 'pending' ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-gray-400 text-xs">UTR/Transaction Reference</label>
                            <Input
                              value={transactionRef}
                              onChange={(e) => setTransactionRef(e.target.value)}
                              placeholder="Enter UTR after payment"
                              className="bg-gray-800 border-gray-700 text-white h-9"
                            />
                            <Button
                              onClick={() => handleApprove(req)}
                              disabled={processing === req._id}
                              className="w-full bg-green-600 hover:bg-green-700 gap-1 h-9"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {processing === req._id ? 'Processing...' : 'Approve'}
                            </Button>
                          </div>
                          
                          <div className="space-y-2 pt-2 border-t border-gray-700">
                            <label className="text-gray-400 text-xs">Rejection Reason</label>
                            <Input
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Enter reason"
                              className="bg-gray-800 border-gray-700 text-white h-9"
                            />
                            <Button
                              onClick={() => handleReject(req)}
                              disabled={processing === req._id}
                              variant="destructive"
                              className="w-full gap-1 h-9"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <div className={`p-3 rounded-lg ${req.status === 'approved' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            <p className={`font-medium ${req.status === 'approved' ? 'text-green-400' : 'text-red-400'}`}>
                              {req.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                            </p>
                            {req.transaction_ref && (
                              <p className="text-gray-400 text-sm mt-1">UTR: {req.transaction_ref}</p>
                            )}
                            {req.rejection_reason && (
                              <p className="text-gray-400 text-sm mt-1">Reason: {req.rejection_reason}</p>
                            )}
                          </div>
                          
                          {/* Revert Status Button */}
                          <Button
                            onClick={() => handleRevertStatus(req)}
                            disabled={processing === req._id}
                            variant="outline"
                            className="w-full gap-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                          >
                            <RotateCcw className="w-4 h-4" />
                            {processing === req._id ? 'Reverting...' : 'Revert to Pending'}
                          </Button>
                          <p className="text-gray-500 text-xs text-center">
                            Use this to undo a mistaken approval/rejection
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Results Count */}
      <div className="text-center text-gray-500 text-sm py-2">
        Showing {filteredRequests.length} of {allRequests.length} requests
      </div>

      {/* View Detail Modal */}
      {viewDetailRequest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setViewDetailRequest(null)}>
          <Card className="w-full max-w-lg bg-gray-900 border-gray-700 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Request Details</h3>
              <Button variant="ghost" size="sm" onClick={() => setViewDetailRequest(null)}>
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Request ID</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono">{viewDetailRequest.request_id}</span>
                  <Copy className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" onClick={(e) => copyToClipboard(e, viewDetailRequest.request_id, 'Request ID')} />
                </div>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Type</span>
                <span className={`px-2 py-1 rounded text-xs ${getTypeBadge(viewDetailRequest._type)}`}>{viewDetailRequest._typeLabel}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">User</span>
                <span className="text-white">{viewDetailRequest.user_name}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Email</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300">{viewDetailRequest.user_email}</span>
                  <Copy className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" onClick={(e) => copyToClipboard(e, viewDetailRequest.user_email, 'Email')} />
                </div>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Mobile</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300">{viewDetailRequest.mobile || viewDetailRequest.user_mobile || '-'}</span>
                  {(viewDetailRequest.mobile || viewDetailRequest.user_mobile) && (
                    <Copy className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" onClick={(e) => copyToClipboard(e, viewDetailRequest.mobile || viewDetailRequest.user_mobile, 'Mobile')} />
                  )}
                </div>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono">{viewDetailRequest.account_number || '-'}</span>
                  {viewDetailRequest.account_number && (
                    <Copy className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" onClick={(e) => copyToClipboard(e, viewDetailRequest.account_number, 'Account')} />
                  )}
                </div>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">IFSC Code</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono">{viewDetailRequest.ifsc_code || '-'}</span>
                  {viewDetailRequest.ifsc_code && (
                    <Copy className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" onClick={(e) => copyToClipboard(e, viewDetailRequest.ifsc_code, 'IFSC')} />
                  )}
                </div>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Bank Name</span>
                <span className="text-white">{viewDetailRequest.bank_name || '-'}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">PRC Amount</span>
                <span className="text-purple-400 font-bold">{(viewDetailRequest.prc_amount || 0).toLocaleString()} PRC</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">INR Amount</span>
                <span className="text-green-400 font-bold">₹{(viewDetailRequest.amount_inr || 0).toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Status</span>
                <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(viewDetailRequest.status)}`}>{viewDetailRequest.status}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Date</span>
                <span className="text-gray-300">{formatDate(viewDetailRequest.created_at)}</span>
              </div>
              
              {viewDetailRequest.transaction_ref && (
                <div className="flex justify-between py-2 border-b border-gray-800">
                  <span className="text-gray-400">UTR/Reference</span>
                  <span className="text-green-400">{viewDetailRequest.transaction_ref}</span>
                </div>
              )}
              
              {viewDetailRequest.rejection_reason && (
                <div className="flex justify-between py-2 border-b border-gray-800">
                  <span className="text-gray-400">Rejection Reason</span>
                  <span className="text-red-400">{viewDetailRequest.rejection_reason}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminUnifiedPayments;
