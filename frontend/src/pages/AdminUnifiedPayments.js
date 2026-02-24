import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Building2, Clock, CheckCircle, XCircle, Search, RefreshCw,
  ChevronDown, ChevronUp, User, Copy, Calendar, FileSpreadsheet, Banknote,
  CheckSquare, Square, ArrowUpDown, Eye, RotateCcw, Download, AlertTriangle
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
  // Sort: pending = oldest first (asc), approved/rejected = newest first (desc)
  const [sortOrder, setSortOrder] = useState('asc'); // Will change based on statusFilter
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkTransactionRef, setBulkTransactionRef] = useState('');
  
  // Confirmation dialogs
  const [showBulkApproveConfirm, setShowBulkApproveConfirm] = useState(false);
  const [showBulkRejectConfirm, setShowBulkRejectConfirm] = useState(false);
  
  // Detail modal
  const [viewDetailRequest, setViewDetailRequest] = useState(null);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0, bank: 0, emi: 0, rd: 0,
    pending: { count: 0 },
    approved: { count: 0 },
    rejected: { count: 0 }
  });

  // Copy to clipboard
  const copyToClipboard = (e, text, label) => {
    e?.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`Copied: ${text}`, { duration: 1500 });
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

      const bankRequests = (bankRes.data?.requests || []).map(r => {
        // Extract bank details from nested object if present
        const bd = r.bank_details || {};
        return {
          ...r,
          _type: 'bank',
          _typeLabel: 'Bank',
          _id: r.request_id || r._id,
          request_id: r.request_id || r._id,
          prc_amount: r.total_prc_deducted || r.prc_amount || 0,
          amount_inr: r.amount_inr || 0,
          mobile: r.user_mobile || r.mobile || '',
          account_number: bd.account_number || r.account_number || '',
          ifsc_code: bd.ifsc_code || r.ifsc_code || '',
          bank_name: bd.bank_name || r.bank_name || '',
          account_holder_name: bd.account_holder_name || r.account_holder_name || r.user_name || '',
          created_at: r.created_at || r.timestamp
        };
      });

      const rdRequests = (rdRes.data?.requests || []).map(r => {
        const bd = r.bank_details || {};
        return {
          ...r,
          _type: 'rd',
          _typeLabel: 'Savings',
          _id: r.request_id || r._id,
          request_id: r.request_id || r._id || r.rd_id,
          prc_amount: r.net_amount || r.current_value || 0,
          amount_inr: r.amount_inr || 0,
          mobile: r.user_mobile || r.mobile || '',
          account_number: bd.account_number || r.account_number || '',
          ifsc_code: bd.ifsc_code || r.ifsc_code || '',
          bank_name: bd.bank_name || r.bank_name || '',
          account_holder_name: bd.account_holder_name || r.user_name || '',
          created_at: r.created_at || r.requested_at
        };
      });

      const emiData = Array.isArray(emiRes.data) ? emiRes.data : (emiRes.data?.requests || []);
      const emiRequests = emiData.filter(r => 
        r.payment_type?.toLowerCase() === 'emi' || r.payment_type?.toLowerCase() === 'loan_emi'
      ).map(r => {
        const bd = r.bank_details || {};
        return {
          ...r,
          _type: 'emi',
          _typeLabel: 'EMI',
          _id: r._id || r.request_id,
          request_id: r._id || r.request_id,
          prc_amount: r.total_prc_deducted || r.prc_amount || 0,
          amount_inr: r.amount_inr || r.emi_amount || 0,
          mobile: r.user_mobile || r.mobile || '',
          account_number: bd.account_number || r.loan_account_number || r.account_number || '',
          ifsc_code: bd.ifsc_code || r.ifsc_code || '',
          bank_name: bd.bank_name || r.bank_name || '',
          account_holder_name: bd.account_holder_name || r.user_name || '',
          created_at: r.created_at || r.timestamp
        };
      });

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
    const pendingReqs = requests.filter(r => r.status === 'pending');
    const approvedReqs = requests.filter(r => ['approved', 'completed'].includes(r.status));
    const rejectedReqs = requests.filter(r => r.status === 'rejected');
    
    setStats({
      total: requests.length,
      bank: requests.filter(r => r._type === 'bank').length,
      emi: requests.filter(r => r._type === 'emi').length,
      rd: requests.filter(r => r._type === 'rd').length,
      pending: { 
        count: pendingReqs.length,
        totalInr: pendingReqs.reduce((sum, r) => sum + (r.amount_inr || 0), 0)
      },
      approved: { 
        count: approvedReqs.length,
        totalInr: approvedReqs.reduce((sum, r) => sum + (r.amount_inr || 0), 0)
      },
      rejected: { 
        count: rejectedReqs.length,
        totalInr: rejectedReqs.reduce((sum, r) => sum + (r.amount_inr || 0), 0)
      }
    });
  };

  // Filter and sort
  const filteredRequests = useMemo(() => {
    let filtered = [...allRequests];

    if (statusFilter !== 'all') {
      if (statusFilter === 'approved') {
        filtered = filtered.filter(r => ['approved', 'completed'].includes(r.status));
      } else {
        filtered = filtered.filter(r => r.status === statusFilter);
      }
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r._type === typeFilter);
    }

    // Fast search - using pre-computed search index
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => {
        // Search in all relevant fields
        const searchFields = [
          r.user_name,
          r.user_email,
          r.mobile,
          r.account_number,
          r.ifsc_code,
          r.bank_name,
          r.request_id,
          r.account_holder_name,
          r.uid,
          r.transaction_ref
        ].filter(Boolean).join(' ').toLowerCase();
        
        return searchFields.includes(q);
      });
    }

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

    // Smart sorting: Pending = oldest first (asc), Approved/Rejected = newest first (desc)
    const effectiveSortOrder = statusFilter === 'pending' ? 'asc' : sortOrder;
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return effectiveSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [allRequests, statusFilter, typeFilter, searchQuery, dateFrom, dateTo, sortOrder]);

  // Selection
  const toggleSelect = (e, id) => {
    e?.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    const ids = filteredRequests.filter(r => r.status === 'pending').map(r => r._id);
    setSelectedIds(ids);
  };

  const clearSelection = () => setSelectedIds([]);

  // Individual approve
  const handleApprove = async (request) => {
    if (!transactionRef.trim()) {
      toast.error('UTR/Reference number टाका');
      return;
    }
    setProcessing(request._id);
    try {
      if (request._type === 'bank') {
        // Fixed: removed /requests/ from URL path to match backend route
        await axios.post(`${API}/admin/bank-redeem/${request._id}/approve`, {
          admin_uid: user.uid, transaction_ref: transactionRef, admin_name: user.name || user.email
        });
      } else if (request._type === 'rd') {
        // Fixed: changed /redeem/ to /redeem-requests/ to match backend route
        await axios.post(`${API}/rd/admin/redeem-requests/${request._id}/approve`, {
          admin_uid: user.uid, transaction_ref: transactionRef
        });
      } else if (request._type === 'emi') {
        await axios.post(`${API}/admin/bill-payment/requests/${request._id}/approve`, {
          admin_id: user.uid, transaction_ref: transactionRef
        });
      }
      toast.success('Approved!');
      setTransactionRef('');
      setExpandedRequest(null);
      fetchAllRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    } finally {
      setProcessing(null);
    }
  };

  // Individual reject
  const handleReject = async (request) => {
    if (!rejectReason.trim()) {
      toast.error('Rejection reason टाका');
      return;
    }
    setProcessing(request._id);
    try {
      if (request._type === 'bank') {
        // Fixed: removed /requests/ from URL path to match backend route
        await axios.post(`${API}/admin/bank-redeem/${request._id}/reject`, {
          admin_uid: user.uid, reason: rejectReason, admin_name: user.name || user.email
        });
      } else if (request._type === 'rd') {
        // Fixed: changed /redeem/ to /redeem-requests/ to match backend route
        await axios.post(`${API}/rd/admin/redeem-requests/${request._id}/reject`, {
          admin_uid: user.uid, reason: rejectReason
        });
      } else if (request._type === 'emi') {
        await axios.post(`${API}/admin/bill-payment/requests/${request._id}/reject`, {
          admin_id: user.uid, reason: rejectReason
        });
      }
      toast.success('Rejected');
      setRejectReason('');
      setExpandedRequest(null);
      fetchAllRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    } finally {
      setProcessing(null);
    }
  };

  // Revert status
  const handleRevertStatus = async (request) => {
    if (!window.confirm(`${request._typeLabel} request परत Pending करायचे का?`)) return;
    setProcessing(request._id);
    try {
      await axios.post(`${API}/admin/payment-request/revert-status`, {
        request_id: request._id, request_type: request._type,
        admin_uid: user.uid, admin_name: user.name || user.email
      });
      toast.success('Reverted to Pending');
      fetchAllRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    } finally {
      setProcessing(null);
    }
  };

  // Bulk approve with confirmation
  const handleBulkApprove = async () => {
    if (!bulkTransactionRef.trim()) {
      toast.error('UTR/Reference number टाका');
      return;
    }
    setBulkProcessing(true);
    let success = 0, failed = 0;

    for (const id of selectedIds) {
      const request = allRequests.find(r => r._id === id);
      if (!request || request.status !== 'pending') continue;
      try {
        if (request._type === 'bank') {
          // Fixed: removed /requests/ from URL path to match backend route
          await axios.post(`${API}/admin/bank-redeem/${id}/approve`, {
            admin_uid: user.uid, transaction_ref: bulkTransactionRef, admin_name: user.name || user.email
          });
        } else if (request._type === 'rd') {
          // Fixed: changed /redeem/ to /redeem-requests/ to match backend route
          await axios.post(`${API}/rd/admin/redeem-requests/${id}/approve`, {
            admin_uid: user.uid, transaction_ref: bulkTransactionRef
          });
        } else if (request._type === 'emi') {
          await axios.post(`${API}/admin/bill-payment/requests/${id}/approve`, {
            admin_id: user.uid, transaction_ref: bulkTransactionRef
          });
        }
        success++;
      } catch { failed++; }
    }

    toast.success(`${success} Approved, ${failed} Failed`);
    setBulkTransactionRef('');
    setSelectedIds([]);
    setShowBulkApproveConfirm(false);
    setBulkProcessing(false);
    fetchAllRequests();
  };

  // Bulk reject with confirmation
  const handleBulkReject = async () => {
    if (!bulkRejectReason.trim()) {
      toast.error('Rejection reason टाका');
      return;
    }
    setBulkProcessing(true);
    let success = 0, failed = 0;

    for (const id of selectedIds) {
      const request = allRequests.find(r => r._id === id);
      if (!request || request.status !== 'pending') continue;
      try {
        if (request._type === 'bank') {
          // Fixed: removed /requests/ from URL path to match backend route
          await axios.post(`${API}/admin/bank-redeem/${id}/reject`, {
            admin_uid: user.uid, reason: bulkRejectReason, admin_name: user.name || user.email
          });
        } else if (request._type === 'rd') {
          // Fixed: changed /redeem/ to /redeem-requests/ to match backend route
          await axios.post(`${API}/rd/admin/redeem-requests/${id}/reject`, {
            admin_uid: user.uid, reason: bulkRejectReason
          });
        } else if (request._type === 'emi') {
          await axios.post(`${API}/admin/bill-payment/requests/${id}/reject`, {
            admin_id: user.uid, reason: bulkRejectReason
          });
        }
        success++;
      } catch { failed++; }
    }

    toast.success(`${success} Rejected, ${failed} Failed`);
    setBulkRejectReason('');
    setSelectedIds([]);
    setShowBulkRejectConfirm(false);
    setBulkProcessing(false);
    fetchAllRequests();
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      toast.info('Downloading Excel...');
      const response = await axios.get(`${API}/admin/hdfc-export/combined`, {
        params: { status: statusFilter || 'pending' },
        responseType: 'blob'
      });
      
      // Check if response is actually an error JSON (not blob)
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        // Response is JSON error, not file
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        toast.error(errorData.detail || 'No data to export');
        return;
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Payment_Requests_${statusFilter}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel downloaded!');
    } catch (error) {
      // Handle 404 (no requests found) gracefully
      if (error.response?.status === 404) {
        toast.error('Export साठी requests सापडले नाहीत. फिल्टर बदलून बघा.');
      } else if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Download failed - कृपया पुन्हा प्रयत्न करा');
      }
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'numeric', year: 'numeric' });
  };

  const getStatusColor = (status) => {
    if (status === 'pending') return 'text-yellow-400';
    if (['approved', 'completed'].includes(status)) return 'text-green-400';
    return 'text-red-400';
  };

  const getTypeColor = (type) => {
    if (type === 'bank') return 'bg-blue-600';
    if (type === 'emi') return 'bg-orange-600';
    return 'bg-purple-600';
  };

  return (
    <div className="p-3 md:p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-500" />
            Unified Payment Dashboard
          </h1>
          <p className="text-gray-500 text-xs">Bank + EMI + Savings</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAllRequests} variant="outline" size="sm" className="h-8 px-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExportExcel} size="sm" className="h-8 px-3 bg-green-600 hover:bg-green-700 gap-1">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="p-3 bg-yellow-500/10 border-yellow-500/30">
          <p className="text-yellow-400 text-xs font-medium">Pending</p>
          <p className="text-2xl font-bold text-white">{stats.pending?.count || 0}</p>
          <p className="text-yellow-300 text-sm font-semibold">₹{(stats.pending?.totalInr || 0).toLocaleString()}</p>
        </Card>
        <Card className="p-3 bg-green-500/10 border-green-500/30">
          <p className="text-green-400 text-xs font-medium">Approved</p>
          <p className="text-2xl font-bold text-white">{stats.approved?.count || 0}</p>
          <p className="text-green-300 text-sm font-semibold">₹{(stats.approved?.totalInr || 0).toLocaleString()}</p>
        </Card>
        <Card className="p-3 bg-red-500/10 border-red-500/30">
          <p className="text-red-400 text-xs font-medium">Rejected</p>
          <p className="text-2xl font-bold text-white">{stats.rejected?.count || 0}</p>
          <p className="text-red-300 text-sm font-semibold">₹{(stats.rejected?.totalInr || 0).toLocaleString()}</p>
        </Card>
        <Card className="p-3 bg-gray-800/50 border-gray-700">
          <p className="text-gray-400 text-xs font-medium">Total</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-gray-400 text-xs">B:{stats.bank} E:{stats.emi} S:{stats.rd}</p>
        </Card>
      </div>

      {/* Selection Info */}
      {selectedIds.length > 0 && (
        <Card className="p-2 bg-cyan-500/10 border-cyan-500/30">
          <div className="flex items-center justify-between">
            <span className="text-cyan-400 text-sm font-medium">Selected: {selectedIds.length}</span>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="text-gray-400 text-xs h-6">Clear</Button>
          </div>
        </Card>
      )}

      {/* Filters Row 1: Status + Type */}
      <div className="flex flex-wrap gap-2">
        {['pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setSelectedIds([]); }}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              statusFilter === s 
                ? s === 'pending' ? 'bg-yellow-500 text-black' 
                  : s === 'approved' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'
                : 'bg-gray-800 text-gray-400'
            }`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="border-l border-gray-700 mx-1" />
        {[
          { v: 'all', l: 'All', c: 'cyan' },
          { v: 'bank', l: 'Bank', c: 'blue' },
          { v: 'emi', l: 'EMI', c: 'orange' },
          { v: 'rd', l: 'Savings', c: 'purple' }
        ].map(t => (
          <button key={t.v} onClick={() => setTypeFilter(t.v)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              typeFilter === t.v ? `bg-${t.c}-500 text-black` : 'bg-gray-800 text-gray-400'
            }`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Filters Row 2: Search + Date */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..." className="pl-8 h-8 text-sm bg-gray-800 border-gray-700" />
        </div>
        <div className="flex items-center gap-1">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="w-28 h-8 text-xs bg-gray-800 border-gray-700" />
          <span className="text-gray-500 text-xs">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="w-28 h-8 text-xs bg-gray-800 border-gray-700" />
        </div>
        <Button variant="outline" size="sm" 
          onClick={() => statusFilter !== 'pending' && setSortOrder(p => p === 'desc' ? 'asc' : 'desc')} 
          className={`h-8 px-2 text-xs ${statusFilter === 'pending' ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={statusFilter === 'pending' ? 'Pending: जुने आधी (Auto)' : 'Sort बदला'}>
          <ArrowUpDown className="w-3 h-3 mr-1" />
          {statusFilter === 'pending' ? 'Old→New' : (sortOrder === 'desc' ? 'New→Old' : 'Old→New')}
        </Button>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card className="p-2 bg-gray-800 border-gray-700">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={bulkTransactionRef} onChange={(e) => setBulkTransactionRef(e.target.value)}
              placeholder="UTR/Ref for all" className="flex-1 min-w-[120px] h-8 text-sm bg-gray-900 border-gray-700" />
            <Button onClick={() => setShowBulkApproveConfirm(true)} size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-xs gap-1">
              <CheckCircle className="w-3 h-3" />Approve
            </Button>
            <Button onClick={() => setShowBulkRejectConfirm(true)} size="sm" variant="destructive" className="h-8 text-xs gap-1">
              <XCircle className="w-3 h-3" />Reject
            </Button>
          </div>
        </Card>
      )}

      {/* Select All */}
      {statusFilter === 'pending' && filteredRequests.filter(r => r.status === 'pending').length > 0 && selectedIds.length === 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={selectAll} className="h-7 text-xs gap-1">
            <CheckSquare className="w-3 h-3" />Select All ({filteredRequests.filter(r => r.status === 'pending').length})
          </Button>
        </div>
      )}

      {/* Requests List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-purple-500" /></div>
        ) : filteredRequests.length === 0 ? (
          <Card className="p-8 text-center bg-gray-900 border-gray-800">
            <p className="text-gray-400">No requests found</p>
          </Card>
        ) : (
          filteredRequests.map((req) => (
            <Card key={req._id} className={`bg-gray-900 border-gray-800 ${expandedRequest === req._id ? 'ring-1 ring-purple-500' : ''}`}>
              {/* Main Row */}
              <div className="p-3 cursor-pointer" onClick={() => setExpandedRequest(expandedRequest === req._id ? null : req._id)}>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Checkbox */}
                  {req.status === 'pending' && (
                    <div onClick={(e) => toggleSelect(e, req._id)} className="flex-shrink-0">
                      {selectedIds.includes(req._id) 
                        ? <CheckSquare className="w-5 h-5 text-cyan-400" />
                        : <Square className="w-5 h-5 text-gray-600" />}
                    </div>
                  )}
                  
                  {/* Type Badge + Request ID */}
                  <div className="flex flex-col items-start">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium text-white ${getTypeColor(req._type)}`}>
                      {req._typeLabel}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-gray-500 text-[9px] font-mono">{req.request_id?.slice(-8) || '-'}</span>
                      <Copy className="w-3 h-3 text-gray-600 hover:text-cyan-400 cursor-pointer" 
                        onClick={(e) => copyToClipboard(e, req.request_id, 'Request ID')} />
                    </div>
                  </div>

                  {/* User Info with Copy */}
                  <div className="flex-1 min-w-[120px]">
                    <div className="flex items-center gap-1">
                      <p className="text-white text-sm font-medium truncate">{req.account_holder_name || req.user_name || 'Unknown'}</p>
                      <Copy className="w-3 h-3 text-gray-600 hover:text-cyan-400 cursor-pointer flex-shrink-0" 
                        onClick={(e) => copyToClipboard(e, req.account_holder_name || req.user_name, 'Name')} />
                    </div>
                    <p className="text-gray-500 text-xs truncate">{req.mobile || req.user_email || '-'}</p>
                  </div>

                  {/* Bank Details - Always Visible */}
                  <div className="hidden sm:flex flex-col min-w-[150px]">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-xs">A/C:</span>
                      <span className="text-white text-xs font-mono">{req.account_number || '-'}</span>
                      {req.account_number && (
                        <Copy className="w-3 h-3 text-gray-600 cursor-pointer" onClick={(e) => copyToClipboard(e, req.account_number, 'Account')} />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-xs">IFSC:</span>
                      <span className="text-cyan-400 text-xs font-mono">{req.ifsc_code || '-'}</span>
                      {req.ifsc_code && (
                        <Copy className="w-3 h-3 text-gray-600 cursor-pointer" onClick={(e) => copyToClipboard(e, req.ifsc_code, 'IFSC')} />
                      )}
                    </div>
                  </div>

                  {/* Bank Name */}
                  <div className="hidden md:block min-w-[100px]">
                    <p className="text-gray-400 text-xs">{req.bank_name || '-'}</p>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-green-400 font-bold text-sm">₹{(req.amount_inr || 0).toLocaleString()}</p>
                    <p className={`text-[10px] ${getStatusColor(req.status)}`}>{req.status}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); setViewDetailRequest(req); }}>
                      <Eye className="w-4 h-4 text-gray-400" />
                    </Button>
                    {expandedRequest === req._id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </div>

                {/* Mobile: Bank Details Row */}
                <div className="sm:hidden mt-2 pt-2 border-t border-gray-800 grid grid-cols-2 gap-2 text-xs">
                  <div className="col-span-2 flex items-center gap-1">
                    <span className="text-gray-500">ID: </span>
                    <span className="text-cyan-400 font-mono">{req.request_id?.slice(-12) || '-'}</span>
                    <Copy className="w-3 h-3 text-gray-600" onClick={(e) => copyToClipboard(e, req.request_id, 'Request ID')} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">A/C: </span>
                    <span className="text-white font-mono">{req.account_number || '-'}</span>
                    {req.account_number && <Copy className="w-3 h-3 text-gray-600" onClick={(e) => copyToClipboard(e, req.account_number, 'A/C')} />}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">IFSC: </span>
                    <span className="text-cyan-400 font-mono">{req.ifsc_code || '-'}</span>
                    {req.ifsc_code && <Copy className="w-3 h-3 text-gray-600" onClick={(e) => copyToClipboard(e, req.ifsc_code, 'IFSC')} />}
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Bank: </span>
                    <span className="text-white">{req.bank_name || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Expanded View */}
              {expandedRequest === req._id && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                  {/* PRC & Date Only (Bank details already shown above) */}
                  <div className="flex items-center justify-between mb-4 bg-gray-800/50 rounded-lg p-3">
                    <div>
                      <p className="text-gray-400 text-xs">PRC Amount</p>
                      <p className="text-purple-400 font-bold text-lg">{(req.prc_amount || 0).toLocaleString()} PRC</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-xs">Date</p>
                      <p className="text-gray-300 font-medium">{formatDate(req.created_at)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  {req.status === 'pending' ? (
                    <div className="space-y-3">
                      <div>
                        <Input value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)}
                          placeholder="UTR / Reference Number" className="h-10 text-base bg-gray-800 border-gray-700 mb-2" />
                        <Button onClick={() => handleApprove(req)} disabled={processing === req._id}
                          className="w-full h-10 bg-green-600 hover:bg-green-700 text-base font-semibold gap-2">
                          <CheckCircle className="w-5 h-5" />{processing === req._id ? 'Processing...' : 'Approve'}
                        </Button>
                      </div>
                      <div>
                        <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Rejection Reason" className="h-10 text-base bg-gray-800 border-gray-700 mb-2" />
                        <Button onClick={() => handleReject(req)} disabled={processing === req._id}
                          variant="destructive" className="w-full h-10 text-base font-semibold gap-2">
                          <XCircle className="w-5 h-5" />Reject
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className={`p-2 rounded text-sm ${req.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {req.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                        {req.transaction_ref && <span className="ml-2 text-gray-400">UTR: {req.transaction_ref}</span>}
                        {req.rejection_reason && <span className="ml-2 text-gray-400">Reason: {req.rejection_reason}</span>}
                      </div>
                      <Button onClick={() => handleRevertStatus(req)} disabled={processing === req._id}
                        variant="outline" className="w-full h-8 text-xs border-amber-500/50 text-amber-400 gap-1">
                        <RotateCcw className="w-3 h-3" />Revert to Pending
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Count */}
      <p className="text-center text-gray-500 text-xs py-2">
        Showing {filteredRequests.length} of {allRequests.length}
      </p>

      {/* Bulk Approve Confirmation Modal */}
      {showBulkApproveConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowBulkApproveConfirm(false)}>
          <Card className="w-full max-w-sm bg-gray-900 border-gray-700 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-bold text-white">Confirm Bulk Approve</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Are you sure you want to <span className="text-green-400 font-medium">APPROVE</span> {selectedIds.length} requests?
            </p>
            <Input value={bulkTransactionRef} onChange={(e) => setBulkTransactionRef(e.target.value)}
              placeholder="UTR / Reference Number" className="h-10 bg-gray-800 border-gray-700 mb-4" />
            <div className="flex gap-2">
              <Button onClick={() => setShowBulkApproveConfirm(false)} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={handleBulkApprove} disabled={bulkProcessing} className="flex-1 bg-green-600 hover:bg-green-700">
                {bulkProcessing ? 'Processing...' : 'Confirm Approve'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Bulk Reject Confirmation Modal */}
      {showBulkRejectConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowBulkRejectConfirm(false)}>
          <Card className="w-full max-w-sm bg-gray-900 border-gray-700 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-bold text-white">Confirm Bulk Reject</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Are you sure you want to <span className="text-red-400 font-medium">REJECT</span> {selectedIds.length} requests?
            </p>
            <Input value={bulkRejectReason} onChange={(e) => setBulkRejectReason(e.target.value)}
              placeholder="Rejection Reason" className="h-10 bg-gray-800 border-gray-700 mb-4" />
            <div className="flex gap-2">
              <Button onClick={() => setShowBulkRejectConfirm(false)} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={handleBulkReject} disabled={bulkProcessing} variant="destructive" className="flex-1">
                {bulkProcessing ? 'Processing...' : 'Confirm Reject'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* View Detail Modal */}
      {viewDetailRequest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setViewDetailRequest(null)}>
          <Card className="w-full max-w-md bg-gray-900 border-gray-700 p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Request Details</h3>
              <Button variant="ghost" size="sm" onClick={() => setViewDetailRequest(null)} className="h-8 w-8 p-0">
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-3 text-sm">
              {[
                { l: 'Request ID', v: viewDetailRequest.request_id, copy: true },
                { l: 'Type', v: viewDetailRequest._typeLabel },
                { l: 'User Name', v: viewDetailRequest.user_name },
                { l: 'Email', v: viewDetailRequest.user_email, copy: true },
                { l: 'Mobile', v: viewDetailRequest.mobile || viewDetailRequest.user_mobile, copy: true },
                { l: 'Account Holder', v: viewDetailRequest.account_holder_name },
                { l: 'Account Number', v: viewDetailRequest.account_number, copy: true },
                { l: 'IFSC Code', v: viewDetailRequest.ifsc_code, copy: true },
                { l: 'Bank Name', v: viewDetailRequest.bank_name },
                { l: 'PRC Amount', v: `${(viewDetailRequest.prc_amount || 0).toLocaleString()} PRC`, color: 'purple' },
                { l: 'INR Amount', v: `₹${(viewDetailRequest.amount_inr || 0).toLocaleString()}`, color: 'green' },
                { l: 'Status', v: viewDetailRequest.status, color: viewDetailRequest.status === 'approved' ? 'green' : viewDetailRequest.status === 'rejected' ? 'red' : 'yellow' },
                { l: 'Date', v: formatDate(viewDetailRequest.created_at) },
                { l: 'UTR/Reference', v: viewDetailRequest.transaction_ref, color: 'green' },
                { l: 'Rejection Reason', v: viewDetailRequest.rejection_reason, color: 'red' },
              ].filter(item => item.v).map((item, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-gray-800">
                  <span className="text-gray-400">{item.l}</span>
                  <div className="flex items-center gap-2">
                    <span className={item.color ? `text-${item.color}-400` : 'text-white'}>{item.v}</span>
                    {item.copy && (
                      <Copy className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" 
                        onClick={(e) => copyToClipboard(e, item.v, item.l)} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminUnifiedPayments;
