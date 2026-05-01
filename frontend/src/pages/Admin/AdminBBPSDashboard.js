import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  RefreshCw, Search, Filter, Download, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, AlertCircle, Loader2,
  Smartphone, Tv, Zap, Flame, Building, Droplet, Wifi, PhoneCall,
  CreditCard, Shield, Car, GraduationCap, Monitor, Landmark, Cylinder,
  TrendingUp, TrendingDown, Activity, Eye, Copy, AlertTriangle
} from 'lucide-react';
import BBPSDetailModal from './components/BBPSDetailModal';
import BBPSReconcilePanel from './components/BBPSReconcilePanel';

import { API } from "../../lib/api";

// Service icons mapping
const SERVICE_ICONS = {
  mobile_recharge: Smartphone,
  mobile_postpaid: Smartphone,
  dish_recharge: Tv,
  dth: Tv,
  electricity: Zap,
  gas: Flame,
  water: Droplet,
  broadband: Wifi,
  landline: PhoneCall,
  cable_tv: Monitor,
  emi: Building,
  credit_card: CreditCard,
  insurance: Shield,
  fastag: Car,
  education: GraduationCap,
  municipal_tax: Landmark,
  lpg: Cylinder
};

// Status colors and icons
const STATUS_CONFIG = {
  pending: { color: 'yellow', icon: Clock, label: 'Pending' },
  processing: { color: 'blue', icon: Loader2, label: 'Processing' },
  completed: { color: 'green', icon: CheckCircle, label: 'Completed' },
  paid: { color: 'green', icon: CheckCircle, label: 'Paid/Success' },
  success: { color: 'green', icon: CheckCircle, label: 'Success' },
  SUCCESS: { color: 'green', icon: CheckCircle, label: 'Success' },
  COMPLETED: { color: 'green', icon: CheckCircle, label: 'Completed' },
  Paid: { color: 'green', icon: CheckCircle, label: 'Paid' },
  failed: { color: 'red', icon: XCircle, label: 'Failed' },
  rejected: { color: 'gray', icon: AlertCircle, label: 'Rejected' },
  refunded: { color: 'orange', icon: RefreshCw, label: 'Refunded' },
  refund_pending: { color: 'amber', icon: AlertTriangle, label: 'Refund Pending' },
  eko_failed: { color: 'red', icon: XCircle, label: 'Failed' },
  retry_failed: { color: 'red', icon: XCircle, label: 'Retry Failed' }
};

const AdminBBPSDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [ekoWallet, setEkoWallet] = useState({ balance: null, loading: true });
  
  // Reconciliation
  const [showReconcile, setShowReconcile] = useState(false);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileData, setReconcileData] = useState(null);
  const [reconcileFixLoading, setReconcileFixLoading] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    service_type: '',
    search: '',
    from_date: '',
    to_date: ''
  });
  const [searchInput, setSearchInput] = useState('');

  // Fetch EKO wallet balance
  const fetchEkoBalance = useCallback(async () => {
    setEkoWallet(prev => ({ ...prev, loading: true }));
    try {
      const response = await axios.get(`${API}/bbps/wallet-balance`);
      if (response.data.success) {
        setEkoWallet({ balance: response.data.balance, locked: response.data.locked, loading: false });
      } else {
        setEkoWallet({ balance: null, error: response.data.error, loading: false });
      }
    } catch (error) {
      setEkoWallet({ balance: null, error: 'Failed to fetch', loading: false });
    }
  }, []);

  // Fetch BBPS requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit
      });
      
      if (filters.status) params.append('status', filters.status);
      if (filters.service_type) params.append('service_type', filters.service_type);
      if (filters.search) params.append('search', filters.search);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      
      const response = await axios.get(`${API}/redeem/admin/bbps-requests?${params}`);
      
      if (response.data.success) {
        setRequests(response.data.requests || []);
        setStats(response.data.stats || {});
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0,
          pages: response.data.pagination?.pages || 1
        }));
      }
    } catch (error) {
      console.error('Error fetching BBPS requests:', error);
      toast.error('Failed to load BBPS requests');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchRequests();
    fetchEkoBalance();
  }, [fetchRequests, fetchEkoBalance]);

  // View request details
  const viewRequestDetails = async (requestId) => {
    try {
      const response = await axios.get(`${API}/redeem/admin/bbps-request/${requestId}`);
      if (response.data.success) {
        setSelectedRequest(response.data);
        setShowDetailModal(true);
        setEkoRefundStep(null);
        setEkoRefundOtp('');
        setEkoRefundResponse(null);
        setEkoRefundResult(null);
      }
    } catch (error) {
      toast.error('Failed to load request details');
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  // Refund PRC for stuck/pending request
  const [refundLoading, setRefundLoading] = useState(false);
  const [ekoCheckLoading, setEkoCheckLoading] = useState(false);
  const [ekoRefundResult, setEkoRefundResult] = useState(null);
  
  // EKO Wallet Refund (OTP flow)
  const [ekoRefundStep, setEkoRefundStep] = useState(null); // null | 'otp_sent' | 'verifying' | 'done'
  const [ekoRefundOtp, setEkoRefundOtp] = useState('');
  const [ekoRefundResponse, setEkoRefundResponse] = useState(null);
  const [ekoRefundLoading, setEkoRefundLoading] = useState(false);

  const handleResendRefundOtp = async (tid) => {
    setEkoRefundLoading(true);
    setEkoRefundResponse(null);
    try {
      const response = await axios.post(`${API}/bbps/refund/resend-otp/${tid}`);
      if (response.data.success) {
        setEkoRefundStep('otp_sent');
        toast.success('Refund OTP sent to customer!');
      } else {
        toast.error(response.data.message || 'Failed to send OTP');
      }
      setEkoRefundResponse(response.data);
    } catch (error) {
      toast.error('Failed to send refund OTP');
      setEkoRefundResponse({ success: false, error: error.response?.data?.detail || 'Failed' });
    } finally {
      setEkoRefundLoading(false);
    }
  };

  const handleVerifyRefundOtp = async (tid) => {
    if (!ekoRefundOtp.trim()) {
      toast.error('Please enter OTP');
      return;
    }
    setEkoRefundLoading(true);
    try {
      const response = await axios.post(`${API}/bbps/refund/verify/${tid}?otp=${ekoRefundOtp}&state=1`);
      setEkoRefundResponse(response.data);
      if (response.data.success) {
        setEkoRefundStep('done');
        toast.success(`Refund successful! ₹${response.data.refunded_amount} credited to EKO wallet`);
      } else {
        toast.error(response.data.message || 'Refund verification failed');
      }
    } catch (error) {
      toast.error('Refund verification failed');
      setEkoRefundResponse({ success: false, error: error.response?.data?.detail || 'Failed' });
    } finally {
      setEkoRefundLoading(false);
    }
  };
  
  const handleCheckEkoRefund = async (requestId) => {
    setEkoCheckLoading(true);
    setEkoRefundResult(null);
    try {
      const response = await axios.get(`${API}/bbps/admin/check-eko-refund/${requestId}`);
      setEkoRefundResult(response.data);
      if (response.data.eko_refunded) {
        toast.success('EKO has refunded this transaction to merchant wallet');
      } else if (response.data.eko_status === 'REFUND_PENDING') {
        toast.info('EKO refund is pending - check again later');
      } else {
        toast.info(`EKO status: ${response.data.eko_status || 'Not found'}`);
      }
    } catch (error) {
      toast.error('Failed to check EKO refund status');
      setEkoRefundResult({ success: false, error: error.response?.data?.detail || 'Check failed' });
    } finally {
      setEkoCheckLoading(false);
    }
  };

  const handleRefund = async (requestId, reason = "Stuck/Pending transaction - Admin refund") => {
    if (!window.confirm(`Confirm PRC refund for request ${requestId}?\nReason: ${reason}`)) return;
    
    setRefundLoading(true);
    try {
      // Try recharge refund endpoint first (for recharge_transactions)
      try {
        const res = await axios.post(`${API}/recharge/admin/refund/${requestId}`, { admin_note: reason });
        if (res.data.success) {
          toast.success(res.data.message || 'PRC refunded successfully!');
          fetchRequests();
          return;
        }
      } catch { /* fall through to unified refund */ }

      // Fall back to unified BBPS refund endpoint
      const response = await axios.post(`${API}/redeem/admin/manual-refund/${requestId}`, null, {
        params: { admin_id: "admin", reason }
      });
      if (response.data.success) {
        toast.success(`${response.data.refund_amount} PRC refunded successfully!`);
        viewRequestDetails(requestId);
        fetchRequests();
      } else {
        toast.error(response.data.message || 'Refund failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Refund failed. Please try again.');
    } finally {
      setRefundLoading(false);
    }
  };

  // Admin: Fetch live transaction status from Eko
  const [enquiryLoading, setEnquiryLoading] = useState(null);
  const handleFetchStatus = async (requestId) => {
    setEnquiryLoading(requestId);
    try {
      const res = await axios.get(`${API}/recharge/admin/enquiry/${requestId}`);
      if (res.data.success) {
        const { tx_status_label, old_status, new_status, status_changed } = res.data;
        if (status_changed) {
          toast.success(`Status updated: ${old_status} → ${new_status} (Eko: ${tx_status_label})`);
          fetchRequests();
        } else {
          toast.info(`Eko Status: ${tx_status_label} (no change)`);
        }
      } else {
        toast.error(res.data.error || 'Failed to fetch status');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to fetch status from Eko');
    } finally {
      setEnquiryLoading(null);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Reconciliation - Upload Excel and cross-reference
  const handleReconcileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setReconcileLoading(true);
    setReconcileData(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/bbps/reconcile/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      });
      
      if (response.data.success) {
        setReconcileData(response.data);
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message || 'Reconciliation failed');
      }
    } catch (error) {
      console.error('Reconcile error:', error);
      const msg = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to reconcile';
      toast.error(msg);
    } finally {
      setReconcileLoading(false);
      e.target.value = '';
    }
  };

  const handleApplyFixes = async (selectedActions) => {
    if (!selectedActions?.length) {
      toast.error('No fixes selected');
      return;
    }
    
    if (!window.confirm(`Apply ${selectedActions.length} fixes? This will update statuses and PRC balances.`)) return;
    
    setReconcileFixLoading(true);
    try {
      const response = await axios.post(`${API}/bbps/reconcile/fix`, { fixes: selectedActions });
      if (response.data.success) {
        toast.success(response.data.message);
        setReconcileData(null);
        fetchRequests();
        fetchEkoBalance();
      } else {
        toast.error('Fix failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fix failed');
    } finally {
      setReconcileFixLoading(false);
    }
  };

  // Format service name
  const formatServiceName = (type) => {
    const names = {
      mobile_recharge: 'Mobile Recharge',
      mobile_postpaid: 'Mobile Postpaid',
      dish_recharge: 'DTH Recharge',
      dth: 'DTH',
      electricity: 'Electricity',
      gas: 'Gas',
      water: 'Water',
      broadband: 'Broadband',
      landline: 'Landline',
      cable_tv: 'Cable TV',
      emi: 'EMI',
      credit_card: 'Credit Card',
      insurance: 'Insurance',
      fastag: 'FASTag',
      education: 'Education',
      municipal_tax: 'Municipal Tax',
      lpg: 'LPG',
      bank_transfer: 'Bank Transfer',
      bank_withdrawal: 'Bank Withdrawal'
    };
    return names[type] || type;
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="h-7 w-7 text-amber-400" />
            BBPS Instant Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">Monitor all instant BBPS transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={async () => {
              try {
                const today = new Date().toISOString().split('T')[0];
                const response = await axios.get(`${API}/bbps/admin/export-failed?date=${today}`, {
                  responseType: 'blob'
                });
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `failed_transactions_${today}.xlsx`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                toast.success('Excel downloaded!');
              } catch (error) {
                toast.error('Download failed');
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            data-testid="download-failed-btn"
          >
            <Download className="h-4 w-4 mr-2" />
            Failed Transactions Excel
          </Button>
          <Button
            onClick={fetchRequests}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={async () => {
              try {
                setLoading(true);
                const res = await axios.post(`${API}/recharge/admin/check-all-pending`);
                if (res.data.success) {
                  if (res.data.total_checked !== undefined) {
                    toast.success(`Checked ${res.data.total_checked} pending. Updated: ${res.data.updated}, Errors: ${res.data.errors}`);
                  } else {
                    toast.success(res.data.message || 'No pending transactions found');
                  }
                  fetchRequests();
                } else {
                  toast.error(res.data.error || 'Failed to check pending');
                }
              } catch (e) {
                toast.error('Failed to check pending transactions');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            data-testid="check-all-pending-btn"
          >
            <Clock className="h-4 w-4 mr-2" />
            Check All Pending
          </Button>
        </div>
      </div>

      {/* EKO Wallet Balance Banner */}
      <div className="mb-6 bg-white rounded-xl p-5 flex items-center justify-between border-2 border-emerald-200 shadow-sm" data-testid="eko-wallet-banner">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center shadow">
            <Landmark className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">EKO Wallet Balance</p>
            {ekoWallet.loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                <span className="text-slate-500 text-sm">Loading...</span>
              </div>
            ) : ekoWallet.balance !== null ? (
              <p className="text-3xl font-bold text-slate-800" data-testid="eko-wallet-balance">
                ₹{Number(ekoWallet.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            ) : (
              <p className="text-base font-semibold text-red-600" data-testid="eko-wallet-error">{ekoWallet.error || 'Unable to fetch balance'}</p>
            )}
          </div>
        </div>
        <Button
          onClick={fetchEkoBalance}
          disabled={ekoWallet.loading}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          data-testid="refresh-eko-balance-btn"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${ekoWallet.loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>


      {/* Eko Reconciliation Panel (extracted to BBPSReconcilePanel.js) */}
      <BBPSReconcilePanel
        showReconcile={showReconcile}
        setShowReconcile={setShowReconcile}
        reconcileLoading={reconcileLoading}
        reconcileData={reconcileData}
        reconcileFixLoading={reconcileFixLoading}
        handleReconcileUpload={handleReconcileUpload}
        handleApplyFixes={handleApplyFixes}
      />


      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {/* Total */}
        <Card className="bg-blue-50 border-blue-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-blue-700 text-xs font-medium">Total</p>
              <p className="text-xl font-bold text-slate-800">{pagination.total}</p>
            </div>
          </div>
        </Card>
        
        {/* Completed */}
        <Card className="bg-green-50 border-green-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-green-700 text-xs font-medium">Success</p>
              <p className="text-xl font-bold text-green-700">
                {stats.by_status?.completed?.count || 0}
              </p>
            </div>
          </div>
        </Card>
        
        {/* Failed */}
        <Card className="bg-red-50 border-red-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-red-700 text-xs font-medium">Failed</p>
              <p className="text-xl font-bold text-red-700">
                {stats.by_status?.failed?.count || 0}
              </p>
            </div>
          </div>
        </Card>
        
        {/* Pending / Response Awaited */}
        <Card className="bg-yellow-50 border-yellow-200 p-4 cursor-pointer hover:bg-yellow-100 transition-colors" onClick={() => { setFilters(prev => ({ ...prev, status: 'pending' })); setPagination(prev => ({ ...prev, page: 1 })); }} data-testid="response-awaited-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-yellow-700 text-xs font-medium">Pending</p>
              <p className="text-xl font-bold text-yellow-700">
                {stats.by_status?.pending?.count || 0}
              </p>
            </div>
          </div>
        </Card>

        {/* Refund Pending */}
        <Card className="bg-amber-50 border-amber-200 p-4 cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => { setFilters(prev => ({ ...prev, status: 'refund_pending' })); setPagination(prev => ({ ...prev, page: 1 })); }} data-testid="refund-pending-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-amber-700 text-xs font-medium">Refund Pending</p>
              <p className="text-xl font-bold text-amber-700">
                {stats.by_status?.refund_pending?.count || 0}
              </p>
            </div>
          </div>
        </Card>
        
        {/* Total Amount */}
        <Card className="bg-purple-50 border-purple-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-purple-700 text-xs font-medium">Total Amount</p>
              <p className="text-lg font-bold text-purple-700">
                ₹{(stats.total_amount || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white/50 border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setFilters(prev => ({ ...prev, search: searchInput })); }}
                className="h-10 w-64 pl-9 bg-white border-slate-200 text-slate-800"
                placeholder="Search mobile, TID, request ID..."
                data-testid="bbps-search-input"
              />
            </div>
            <Button
              onClick={() => setFilters(prev => ({ ...prev, search: searchInput }))}
              size="sm"
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
              data-testid="bbps-search-btn"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="h-10 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="paid">Paid/Success</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
            <option value="refund_pending">Refund Pending</option>
            <option value="refunded">Refunded</option>
          </select>
          
          {/* Service Type Filter */}
          <select
            value={filters.service_type}
            onChange={(e) => setFilters(prev => ({ ...prev, service_type: e.target.value }))}
            className="h-10 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm"
          >
            <option value="">All Services</option>
            <option value="mobile_recharge">Mobile Recharge</option>
            <option value="dish_recharge">DTH Recharge</option>
            <option value="dth">DTH</option>
            <option value="electricity">Electricity</option>
            <option value="gas">Gas</option>
            <option value="water">Water</option>
            <option value="broadband">Broadband</option>
            <option value="emi">EMI</option>
            <option value="credit_card">Credit Card</option>
            <option value="insurance">Insurance</option>
            <option value="fastag">FASTag</option>
            <option value="education">Education</option>
            <option value="lpg">LPG</option>
          </select>
          
          {/* Date Filters */}
          <Input
            type="date"
            value={filters.from_date}
            onChange={(e) => setFilters(prev => ({ ...prev, from_date: e.target.value }))}
            className="h-10 w-40 bg-white border-slate-200 text-slate-800"
            placeholder="From Date"
          />
          <Input
            type="date"
            value={filters.to_date}
            onChange={(e) => setFilters(prev => ({ ...prev, to_date: e.target.value }))}
            className="h-10 w-40 bg-white border-slate-200 text-slate-800"
            placeholder="To Date"
          />
          
          <Button
            onClick={() => {
              setPagination(prev => ({ ...prev, page: 1 }));
              fetchRequests();
            }}
            className="h-10 bg-blue-600 hover:bg-blue-700"
          >
            <Filter className="h-4 w-4 mr-2" />
            Apply
          </Button>
          
          <Button
            onClick={() => {
              setFilters({ status: '', service_type: '', search: '', from_date: '', to_date: '' });
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            variant="outline"
            className="h-10 border-slate-200 text-slate-500 hover:text-slate-800"
          >
            Clear
          </Button>
        </div>
      </Card>

      {/* Service-wise Stats */}
      <Card className="bg-white/50 border-slate-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-slate-500 mb-3">Service-wise Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Object.entries(stats.by_service || {}).map(([service, serviceStats]) => {
            const Icon = SERVICE_ICONS[service] || Activity;
            const successRate = serviceStats.success_rate || 0;
            
            return (
              <div
                key={service}
                className={`p-3 rounded-xl border ${
                  successRate > 50 ? 'border-green-500/30 bg-green-500/10' :
                  successRate > 0 ? 'border-yellow-500/30 bg-yellow-500/10' :
                  'border-red-500/30 bg-red-500/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {formatServiceName(service)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-slate-800">{serviceStats.total}</span>
                  <span className={`text-xs font-medium ${
                    successRate > 50 ? 'text-green-400' :
                    successRate > 0 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {successRate}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Requests Table */}
      <Card className="bg-white/50 border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-white/50">
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Request ID</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Service</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">User</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Amount</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Status</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Reason</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Eko TID</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Date</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-400" />
                    <p className="text-slate-500 mt-2">Loading...</p>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-500">
                    No requests found
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  const ServiceIcon = SERVICE_ICONS[req.service_type] || Activity;
                  
                  return (
                    <tr key={req.request_id} className="border-b border-slate-200/50 hover:bg-slate-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-slate-800">
                            {req.request_id?.slice(0, 12)}...
                          </span>
                          <button
                            onClick={() => copyToClipboard(req.request_id)}
                            className="text-slate-500 hover:text-slate-800"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <ServiceIcon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm text-slate-800">
                            {formatServiceName(req.service_type)}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div>
                          <span className="text-sm text-slate-800 block">{req.user_name || 'N/A'}</span>
                          <span className="text-xs text-slate-500">({req.user_mobile || req.user_email || req.user_id})</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-sm font-semibold text-amber-400">
                          ₹{(req.amount || req.details?.amount || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          req.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          req.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          req.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                          req.status === 'refund_pending' ? 'bg-amber-500/20 text-amber-400' :
                          req.status === 'refunded' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-gray-500/20 text-slate-500'
                        }`}>
                          <StatusIcon className={`h-3 w-3 ${req.status === 'processing' ? 'animate-spin' : ''}`} />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="p-3">
                        {(req.failure_reason || req.eko_error) ? (
                          <span className="text-xs text-red-400 max-w-[280px] block" title={req.failure_reason || req.eko_error} style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                            {req.failure_reason || req.eko_error}
                          </span>
                        ) : req.status?.toLowerCase() === 'success' || req.status?.toLowerCase() === 'completed' || req.status?.toLowerCase() === 'paid' ? (
                          <span className="text-xs text-green-500">-</span>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {req.eko_tid ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-green-400">{req.eko_tid}</span>
                            <button
                              onClick={() => copyToClipboard(req.eko_tid)}
                              className="text-slate-500 hover:text-slate-800"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        ) : req.client_ref_id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-blue-400" title="Client Ref ID">{req.client_ref_id}</span>
                            <button
                              onClick={() => copyToClipboard(req.client_ref_id)}
                              className="text-slate-500 hover:text-slate-800"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-slate-500">{formatDate(req.created_at)}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewRequestDetails(req.request_id)}
                            className="h-8 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                            data-testid={`view-btn-${req.request_id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {/* Fetch Status from Eko (for pending/failed/refund_pending) */}
                          {(req.status?.toLowerCase() === 'pending' || req.status?.toLowerCase() === 'failed' || req.status?.toLowerCase() === 'on_hold' || req.status?.toLowerCase() === 'refund_pending') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleFetchStatus(req.request_id)}
                              className="h-7 px-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 text-[10px]"
                              disabled={enquiryLoading === req.request_id}
                              data-testid={`fetch-status-btn-${req.request_id}`}
                              title="Fetch live status from Eko"
                            >
                              {enquiryLoading === req.request_id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          {/* Refund PRC (for failed/pending/refund_pending where PRC not yet refunded) */}
                          {(req.status === 'pending' || req.status === 'PENDING' || req.status === 'failed' || req.status === 'FAILED' || req.status === 'refund_pending') && !req.prc_refunded && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRefund(req.request_id, `Stuck ${req.status} transaction - No EKO TID`)}
                              className="h-7 px-1.5 text-orange-400 hover:text-orange-300 hover:bg-orange-500/20 text-[10px]"
                              disabled={refundLoading}
                              data-testid={`refund-btn-${req.request_id}`}
                              title="Refund PRC to user"
                            >
                              Refund
                            </Button>
                          )}
                          {req.prc_refunded && (
                            <span className="text-[10px] text-green-500 font-semibold px-1">Refunded</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200">
          <span className="text-sm text-slate-500">
            Showing {requests.length} of {pagination.total} requests
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page <= 1}
              className="border-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.pages || 1}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= pagination.pages}
              className="border-slate-200"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Detail Modal (extracted to BBPSDetailModal.js) */}
      {showDetailModal && (
        <BBPSDetailModal
          selectedRequest={selectedRequest}
          onClose={() => setShowDetailModal(false)}
          refundLoading={refundLoading}
          ekoCheckLoading={ekoCheckLoading}
          ekoRefundResult={ekoRefundResult}
          ekoRefundStep={ekoRefundStep}
          setEkoRefundStep={setEkoRefundStep}
          ekoRefundOtp={ekoRefundOtp}
          setEkoRefundOtp={setEkoRefundOtp}
          ekoRefundResponse={ekoRefundResponse}
          ekoRefundLoading={ekoRefundLoading}
          handleResendRefundOtp={handleResendRefundOtp}
          handleVerifyRefundOtp={handleVerifyRefundOtp}
          handleCheckEkoRefund={handleCheckEkoRefund}
          handleRefund={handleRefund}
          formatServiceName={formatServiceName}
        />
      )}
    </div>
  );
};

export default AdminBBPSDashboard;
