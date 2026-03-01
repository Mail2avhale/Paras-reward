import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Building2, Clock, CheckCircle, XCircle, Search, RefreshCw,
  ChevronDown, ChevronUp, User, Copy, Calendar, FileSpreadsheet, Banknote,
  CheckSquare, Square, ArrowUpDown, Eye, RotateCcw, Download, AlertTriangle,
  ChevronLeft, ChevronRight, Filter, SlidersHorizontal
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ITEMS_PER_PAGE = 15;

const AdminUnifiedPayments = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [allRequests, setAllRequests] = useState([]);
  const [expandedRequest, setExpandedRequest] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [ekoBalance, setEkoBalance] = useState(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  // Sort: pending = oldest first (asc), approved/rejected = newest first (desc)
  const [sortOrder, setSortOrder] = useState('asc'); // Will change based on statusFilter
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkTransactionRef, setBulkTransactionRef] = useState('');
  
  // Confirmation dialogs
  const [showBulkApproveConfirm, setShowBulkApproveConfirm] = useState(false);
  const [showBulkRejectConfirm, setShowBulkRejectConfirm] = useState(false);
  const [showManualCompleteDialog, setShowManualCompleteDialog] = useState(false);
  const [manualCompleteId, setManualCompleteId] = useState(null);
  const [manualTxnRef, setManualTxnRef] = useState('');
  
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
    fetchEkoBalance();
  }, []);

  const fetchEkoBalance = async () => {
    try {
      const response = await axios.get(`${API}/admin/bank-redeem/eko-balance`);
      setEkoBalance(response.data);
    } catch (error) {
      console.error('Error fetching Eko balance:', error);
    }
  };

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      const [bankRes, rdRes, billRes] = await Promise.all([
        axios.get(`${API}/admin/bank-redeem/requests`, { params: { limit: 2000 } }).catch(() => ({ data: { requests: [] } })),
        axios.get(`${API}/rd/admin/redeem-requests`, { params: { limit: 2000 } }).catch(() => ({ data: { requests: [] } })),
        // Get ALL bill payments (including EMI, recharge, etc.)
        axios.get(`${API}/admin/bill-payment/requests`, { params: { limit: 2000 } }).catch(() => ({ data: { requests: [] } }))
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

      // Process ALL bill payment requests
      const billData = billRes.data?.requests || (Array.isArray(billRes.data) ? billRes.data : []);
      
      // Separate EMI from other bill payments
      const emiRequests = billData.filter(r => 
        r.payment_type?.toLowerCase()?.includes('emi') || 
        r.request_type?.toLowerCase()?.includes('emi') ||
        r.request_type === 'loan_emi'
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
          r.user_mobile,
          r.phone,
          r.account_number,
          r.ifsc_code,
          r.bank_name,
          r.request_id,
          r.account_holder_name,
          r.uid,
          r.user_id,
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

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequests, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, searchQuery, dateFrom, dateTo]);

  // Selection
  const toggleSelect = (e, id) => {
    e?.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    const ids = paginatedRequests.filter(r => r.status === 'pending').map(r => r._id);
    setSelectedIds(ids);
  };

  const clearSelection = () => setSelectedIds([]);

  // Individual approve
  const handleApprove = async (request) => {
    // For Eko DMT transfers, UTR is optional (will be auto-generated)
    const isEkoTransfer = request._type === 'bank';
    
    if (!isEkoTransfer && !transactionRef.trim()) {
      toast.error('UTR/Reference number टाका');
      return;
    }
    setProcessing(request._id);
    try {
      if (request._type === 'bank') {
        // Bank redeem - Uses Eko DMT for instant transfer
        const response = await axios.post(`${API}/admin/bank-redeem/${request._id}/approve`, {
          admin_id: user.uid,
          admin_uid: user.uid,
          transaction_ref: transactionRef || 'EKO-AUTO',
          admin_name: user.name || user.email,
          use_eko_transfer: true  // Enable Eko DMT auto-transfer
        });
        
        // Show appropriate message based on transfer status
        if (response.data.eko_transfer_success) {
          toast.success(`✅ Approved & Transferred via Eko DMT! TXN: ${response.data.eko_txn_id || 'Processing'}`);
        } else {
          toast.success('✅ Approved! Manual transfer required.');
        }
      } else if (request._type === 'rd') {
        await axios.post(`${API}/rd/admin/redeem-requests/${request._id}/approve`, {
          admin_uid: user.uid, transaction_ref: transactionRef
        });
        toast.success('Approved!');
      } else if (request._type === 'emi') {
        await axios.post(`${API}/admin/bill-payment/requests/${request._id}/approve`, {
          admin_id: user.uid, transaction_ref: transactionRef
        });
        toast.success('Approved!');
      }
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

  // Manual Complete - complete without Eko API
  const handleManualComplete = async (request) => {
    if (!manualTxnRef.trim()) {
      toast.error('UTR/Reference number required');
      return;
    }
    setProcessing(request._id);
    try {
      if (request._type === 'bank') {
        await axios.post(`${API}/admin/bank-redeem/${request._id}/manual-complete`, {
          admin_id: user.uid,
          txn_reference: manualTxnRef,
          admin_notes: `Manually completed by ${user.name || user.email}`
        });
      } else if (request._type === 'rd') {
        await axios.post(`${API}/rd/admin/redeem-requests/${request._id}/manual-complete`, {
          admin_uid: user.uid,
          txn_reference: manualTxnRef
        });
      }
      toast.success('✅ Manually completed successfully');
      setManualTxnRef('');
      setShowManualCompleteDialog(false);
      setManualCompleteId(null);
      setExpandedRequest(null);
      fetchAllRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete');
    } finally {
      setProcessing(null);
    }
  };

  // Revert status
  const handleRevertStatus = async (request) => {
    if (!window.confirm(`Revert ${request._typeLabel} request back to Pending?`)) return;
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
        toast.error('No requests found for export. Try changing the filter.');
      } else if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Download failed - Please try again');
      }
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + 
           ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
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
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <Banknote className="w-6 h-6 text-green-500" />
            Unified Payment Dashboard
          </h1>
          <p className="text-gray-400 text-sm">Bank + EMI + Savings</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAllRequests} variant="outline" size="sm" className="h-10 px-3">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExportExcel} size="sm" className="h-10 px-4 bg-green-600 hover:bg-green-700 gap-2 text-base font-semibold">
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4 bg-yellow-500/10 border-yellow-500/30">
          <p className="text-yellow-400 text-sm font-medium">Pending</p>
          <p className="text-3xl font-bold text-white">{stats.pending?.count || 0}</p>
          <p className="text-yellow-300 text-lg font-bold">₹{(stats.pending?.totalInr || 0).toLocaleString()}</p>
        </Card>
        <Card className="p-4 bg-green-500/10 border-green-500/30">
          <p className="text-green-400 text-sm font-medium">Approved</p>
          <p className="text-3xl font-bold text-white">{stats.approved?.count || 0}</p>
          <p className="text-green-300 text-lg font-bold">₹{(stats.approved?.totalInr || 0).toLocaleString()}</p>
        </Card>
        <Card className="p-4 bg-red-500/10 border-red-500/30">
          <p className="text-red-400 text-sm font-medium">Rejected</p>
          <p className="text-3xl font-bold text-white">{stats.rejected?.count || 0}</p>
          <p className="text-red-300 text-lg font-bold">₹{(stats.rejected?.totalInr || 0).toLocaleString()}</p>
        </Card>
        <Card className="p-4 bg-gray-800/50 border-gray-700">
          <p className="text-gray-400 text-sm font-medium">Total</p>
          <p className="text-3xl font-bold text-white">{stats.total}</p>
          <p className="text-gray-400 text-sm">Bank:{stats.bank} EMI:{stats.emi} RD:{stats.rd}</p>
        </Card>
        {/* Eko DMT Balance Card */}
        <Card className={`p-4 ${ekoBalance?.configured ? 'bg-blue-500/10 border-blue-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
          <p className="text-blue-400 text-sm font-medium flex items-center gap-1">
            <Banknote className="w-4 h-4" />
            Eko DMT
          </p>
          {ekoBalance?.configured ? (
            <>
              <p className="text-2xl font-bold text-white">₹{(ekoBalance?.balance || 0).toLocaleString()}</p>
              <p className="text-blue-300 text-xs">Auto-Transfer Balance</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-gray-500">Not Configured</p>
              <p className="text-gray-500 text-xs">Manual transfers only</p>
            </>
          )}
        </Card>
      </div>

      {/* Advanced Filters & Sorting - TOP */}
      <Card className="p-4 bg-gray-900/80 border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-purple-400" />
            Filters & Sorting
          </h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-gray-400"
          >
            {showAdvancedFilters ? 'Hide' : 'Show More'}
            <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Status Filter - Always Visible */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-gray-400 text-sm self-center mr-2">Status:</span>
          {['pending', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setSelectedIds([]); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                statusFilter === s 
                  ? s === 'pending' ? 'bg-yellow-500 text-black' 
                    : s === 'approved' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Type Filter & Search - Always Visible */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-2">
            <span className="text-gray-400 text-sm self-center">Type:</span>
            {[
              { value: 'all', label: 'All', color: 'bg-gray-600' },
              { value: 'bank', label: 'Bank', color: 'bg-blue-600' },
              { value: 'emi', label: 'EMI', color: 'bg-orange-600' },
              { value: 'rd', label: 'Savings', color: 'bg-purple-600' }
            ].map(t => (
              <button key={t.value} onClick={() => setTypeFilter(t.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  typeFilter === t.value ? `${t.color} text-white` : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <Input 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, mobile, A/C, IFSC..." 
              className="pl-10 h-10 text-base bg-gray-800 border-gray-700" 
            />
          </div>

          {/* Sort Button */}
          <Button variant="outline" size="sm" 
            onClick={() => statusFilter !== 'pending' && setSortOrder(p => p === 'desc' ? 'asc' : 'desc')} 
            className={`h-10 px-4 text-sm font-medium ${statusFilter === 'pending' ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={statusFilter === 'pending' ? 'Pending: Oldest First (Auto)' : 'Change Sort Order'}>
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {statusFilter === 'pending' ? 'Oldest First' : (sortOrder === 'desc' ? 'Newest First' : 'Oldest First')}
          </Button>
        </div>

        {/* Advanced Filters - Collapsible */}
        {showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <span className="text-gray-400 text-sm">Date Range:</span>
              </div>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 w-40 bg-gray-800 border-gray-700 text-base" />
              <span className="text-gray-500">to</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="h-10 w-40 bg-gray-800 border-gray-700 text-base" />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-red-400">
                  Clear Dates
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Selection Info */}
      {selectedIds.length > 0 && (
        <Card className="p-3 bg-cyan-500/10 border-cyan-500/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-cyan-400 text-base font-semibold">Selected: {selectedIds.length} requests</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={clearSelection} className="text-gray-400 h-8">Clear</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card className="p-4 bg-gray-800 border-gray-700">
          <div className="flex flex-wrap items-center gap-3">
            <Input value={bulkTransactionRef} onChange={(e) => setBulkTransactionRef(e.target.value)}
              placeholder="UTR/Ref for all selected" className="flex-1 min-w-[150px] h-10 text-base bg-gray-900 border-gray-700" />
            <Button onClick={() => setShowBulkApproveConfirm(true)} size="sm" className="h-10 px-4 bg-green-600 hover:bg-green-700 text-base font-semibold gap-2">
              <CheckCircle className="w-5 h-5" />Approve All
            </Button>
            <Button onClick={() => setShowBulkRejectConfirm(true)} size="sm" variant="destructive" className="h-10 px-4 text-base font-semibold gap-2">
              <XCircle className="w-5 h-5" />Reject All
            </Button>
          </div>
        </Card>
      )}

      {/* Results Info & Select All */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          Showing {paginatedRequests.length} of {filteredRequests.length} requests
          {totalPages > 1 && ` (Page ${currentPage}/${totalPages})`}
        </p>
        {statusFilter === 'pending' && paginatedRequests.filter(r => r.status === 'pending').length > 0 && selectedIds.length === 0 && (
          <Button variant="outline" size="sm" onClick={selectAll} className="h-9 text-sm gap-2">
            <CheckSquare className="w-4 h-4" />Select All on Page ({paginatedRequests.filter(r => r.status === 'pending').length})
          </Button>
        )}
      </div>

      {/* Requests List - Vertical Layout */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-purple-500" /></div>
        ) : paginatedRequests.length === 0 ? (
          <Card className="p-12 text-center bg-gray-900 border-gray-800">
            <p className="text-gray-400 text-lg">No requests found</p>
          </Card>
        ) : (
          paginatedRequests.map((req) => (
            <Card key={req._id} className={`bg-gray-900 border-gray-800 overflow-hidden ${expandedRequest === req._id ? 'ring-2 ring-purple-500' : ''}`}>
              {/* Main Content - Vertical Layout */}
              <div className="p-4 cursor-pointer" onClick={() => setExpandedRequest(expandedRequest === req._id ? null : req._id)}>
                {/* Row 1: Checkbox + Type + Name + Amount */}
                <div className="flex items-center gap-3 mb-3">
                  {/* Checkbox */}
                  {req.status === 'pending' && (
                    <div onClick={(e) => toggleSelect(e, req._id)} className="flex-shrink-0">
                      {selectedIds.includes(req._id) 
                        ? <CheckSquare className="w-6 h-6 text-cyan-400" />
                        : <Square className="w-6 h-6 text-gray-600 hover:text-gray-400" />}
                    </div>
                  )}
                  
                  {/* Type Badge */}
                  <span className={`px-3 py-1 rounded-lg text-sm font-semibold text-white ${getTypeColor(req._type)}`}>
                    {req._typeLabel}
                  </span>

                  {/* Name */}
                  <div className="flex-1 flex items-center gap-2">
                    <p className="text-white text-lg font-bold truncate">{req.account_holder_name || req.user_name || 'Unknown'}</p>
                    <Copy className="w-4 h-4 text-gray-500 hover:text-cyan-400 cursor-pointer flex-shrink-0" 
                      onClick={(e) => copyToClipboard(e, req.account_holder_name || req.user_name, 'Name')} />
                  </div>

                  {/* Amount & Status */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-green-400 font-bold text-xl">₹{(req.amount_inr || 0).toLocaleString()}</p>
                    <p className={`text-sm font-semibold ${getStatusColor(req.status)}`}>{req.status}</p>
                  </div>

                  {/* Expand Icon */}
                  <div className="flex-shrink-0">
                    {expandedRequest === req._id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {/* Row 2: Request ID + Mobile + Processed By */}
                <div className="flex items-center gap-4 mb-2 pl-9 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">ID:</span>
                    <span className="text-cyan-400 font-mono text-sm">{req.request_id?.slice(-10) || '-'}</span>
                    <Copy className="w-3.5 h-3.5 text-gray-600 hover:text-cyan-400 cursor-pointer" 
                      onClick={(e) => copyToClipboard(e, req.request_id, 'Request ID')} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">Mobile:</span>
                    <span className="text-gray-300 text-sm">{req.mobile || req.user_email || '-'}</span>
                  </div>
                  
                  {/* Approved/Rejected By Tag */}
                  {req.status === 'approved' && (req.approved_by_name || req.processed_by_name || req.approved_by) && (
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                      ✓ by {req.approved_by_name || req.processed_by_name || req.approved_by}
                    </span>
                  )}
                  {req.status === 'rejected' && (req.rejected_by_name || req.processed_by_name || req.rejected_by) && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                      ✗ by {req.rejected_by_name || req.processed_by_name || req.rejected_by}
                    </span>
                  )}
                </div>

                {/* Row 3: Bank Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-9 py-2 bg-gray-800/30 rounded-lg">
                  <div>
                    <p className="text-gray-500 text-sm">Account Number</p>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-mono text-base font-semibold">{req.account_number || '-'}</p>
                      {req.account_number && (
                        <Copy className="w-4 h-4 text-gray-500 hover:text-cyan-400 cursor-pointer" 
                          onClick={(e) => copyToClipboard(e, req.account_number, 'Account')} />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">IFSC Code</p>
                    <div className="flex items-center gap-2">
                      <p className="text-cyan-400 font-mono text-base font-semibold">{req.ifsc_code || '-'}</p>
                      {req.ifsc_code && (
                        <Copy className="w-4 h-4 text-gray-500 hover:text-cyan-400 cursor-pointer" 
                          onClick={(e) => copyToClipboard(e, req.ifsc_code, 'IFSC')} />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Bank Name</p>
                    <p className="text-gray-200 text-base font-medium">{req.bank_name || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Expanded View */}
              {expandedRequest === req._id && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                  {/* PRC Amount & Timestamps */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 bg-gray-800/50 rounded-lg p-4">
                    <div>
                      <p className="text-gray-400 text-sm">PRC Amount</p>
                      <p className="text-purple-400 font-bold text-xl">{(req.prc_amount || 0).toLocaleString()} PRC</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">📅 Request Date</p>
                      <p className="text-gray-200 font-medium text-base">{formatDateTime(req.created_at)}</p>
                    </div>
                    {req.status !== 'pending' && (
                      <div>
                        <p className={`text-sm ${req.status === 'approved' ? 'text-green-400' : 'text-red-400'}`}>
                          {req.status === 'approved' ? '✓ Approved On' : '✗ Rejected On'}
                        </p>
                        <p className="text-gray-200 font-medium text-base">
                          {formatDateTime(req.approved_at || req.rejected_at || req.processed_at)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {req.status === 'pending' ? (
                    <div className="space-y-3">
                      <div>
                        <Input value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)}
                          placeholder="UTR / Reference Number" className="h-10 text-base bg-gray-800 border-gray-700 mb-2" />
                        <Button onClick={() => handleApprove(req)} disabled={processing === req._id}
                          className="w-full h-10 bg-green-600 hover:bg-green-700 text-base font-semibold gap-2">
                          <CheckCircle className="w-5 h-5" />{processing === req._id ? 'Processing...' : 'Approve (Eko Auto)'}
                        </Button>
                      </div>
                      
                      {/* Manual Complete Button */}
                      {req._type === 'bank' && (
                        <Button 
                          onClick={() => {
                            setManualCompleteId(req._id);
                            setShowManualCompleteDialog(true);
                          }} 
                          disabled={processing === req._id}
                          className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-base font-semibold gap-2"
                        >
                          <CheckCircle className="w-5 h-5" />Manual Complete (Without Eko)
                        </Button>
                      )}
                      
                      <div>
                        <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Rejection Reason" className="h-10 text-base bg-gray-800 border-gray-700 mb-2" />
                        <Button onClick={() => handleReject(req)} disabled={processing === req._id}
                          variant="destructive" className="w-full h-10 text-base font-semibold gap-2">
                          <XCircle className="w-5 h-5" />Reject + PRC Refund
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className={`p-4 rounded-lg ${req.status === 'approved' || req.status === 'completed' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <div className={`text-lg font-semibold mb-2 ${req.status === 'approved' || req.status === 'completed' ? 'text-green-400' : 'text-red-400'}`}>
                          {req.status === 'approved' || req.status === 'completed' ? '✓ Payment Approved' : '✗ Payment Rejected'}
                        </div>
                        
                        {/* Manually Approved Badge */}
                        {req.manually_approved && (
                          <div className="inline-block px-3 py-1 mb-2 rounded-lg bg-amber-500/20 text-amber-400 text-sm border border-amber-500/30">
                            🔧 Manually Approved
                          </div>
                        )}
                        
                        {/* Approved/Rejected By */}
                        {(req.approved_by || req.approved_by_name || req.processed_by || req.processed_by_name) && (req.status === 'approved' || req.status === 'completed') && (
                          <p className="text-green-300 text-sm mb-2">
                            <span className="text-gray-500">Approved by:</span>{' '}
                            <span className="font-semibold">{req.approved_by_name || req.processed_by_name || req.approved_by || req.processed_by}</span>
                          </p>
                        )}
                        {(req.rejected_by || req.rejected_by_name || req.processed_by || req.processed_by_name) && req.status === 'rejected' && (
                          <p className="text-red-300 text-sm mb-2">
                            <span className="text-gray-500">Rejected by:</span>{' '}
                            <span className="font-semibold">{req.rejected_by_name || req.processed_by_name || req.rejected_by || req.processed_by}</span>
                          </p>
                        )}
                        
                        {/* Manual TXN Reference */}
                        {req.manually_approved && req.manual_txn_reference && (
                          <p className="text-amber-300 text-base mb-1">
                            <span className="text-gray-500">Manual Ref:</span> {req.manual_txn_reference}
                          </p>
                        )}
                        
                        {req.transaction_ref && !req.manually_approved && (
                          <p className="text-gray-300 text-base">
                            <span className="text-gray-500">UTR:</span> {req.transaction_ref}
                          </p>
                        )}
                        {req.rejection_reason && (
                          <p className="text-gray-300 text-base">
                            <span className="text-gray-500">Reason:</span> {req.rejection_reason}
                          </p>
                        )}
                      </div>
                      <Button onClick={() => handleRevertStatus(req)} disabled={processing === req._id}
                        variant="outline" className="w-full h-10 text-sm font-medium border-amber-500/50 text-amber-400 gap-2">
                        <RotateCcw className="w-4 h-4" />Revert to Pending
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-10 px-4 text-white"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Prev
          </Button>
          
          <div className="flex items-center gap-1">
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
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`h-10 w-10 text-base font-bold ${currentPage === pageNum ? 'bg-purple-600 text-white' : 'text-white border-gray-600'}`}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="h-10 px-4 text-white"
          >
            Next
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      )}

      {/* Total Count */}
      <p className="text-center text-gray-400 text-base font-medium py-2">
        Total: {filteredRequests.length} requests | Page {currentPage} of {totalPages || 1}
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

      {/* Manual Complete Dialog */}
      {showManualCompleteDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-gray-900 border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-amber-400" />
                Manual Complete (Without Eko)
              </h3>
              <button 
                onClick={() => {
                  setShowManualCompleteDialog(false);
                  setManualCompleteId(null);
                  setManualTxnRef('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3 mb-4">
              <p className="text-amber-300 text-sm">
                ⚠️ Use when Eko API fails or you have processed the payment offline (NEFT/IMPS manually). 
                Enter the UTR/Transaction Reference for records.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">UTR / Transaction Reference *</label>
                <Input
                  placeholder="e.g., UTR123456789, IMPS/12345/..."
                  value={manualTxnRef}
                  onChange={(e) => setManualTxnRef(e.target.value.toUpperCase())}
                  className="bg-gray-800 border-gray-700 text-white uppercase h-12 text-base"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700 h-11"
                  onClick={() => {
                    setShowManualCompleteDialog(false);
                    setManualCompleteId(null);
                    setManualTxnRef('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700 h-11"
                  onClick={() => {
                    const request = allRequests.find(r => r._id === manualCompleteId);
                    if (request) handleManualComplete(request);
                  }}
                  disabled={processing || !manualTxnRef.trim()}
                >
                  {processing ? 'Processing...' : '✅ Complete Manually'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminUnifiedPayments;
