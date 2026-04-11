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
  TrendingUp, TrendingDown, Activity, Eye, Copy, Upload, FileSpreadsheet,
  ChevronDown, ChevronUp, Wrench, AlertTriangle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

      {/* Eko Reconciliation Panel */}
      <div className="mb-6">
        <button
          onClick={() => setShowReconcile(!showReconcile)}
          className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors"
          data-testid="reconcile-toggle-btn"
        >
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-amber-600" />
            <span className="font-semibold text-amber-800">Eko Reconciliation Tool</span>
            <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Upload Eko Excel</span>
          </div>
          {showReconcile ? <ChevronUp className="h-5 w-5 text-amber-600" /> : <ChevronDown className="h-5 w-5 text-amber-600" />}
        </button>
        
        {showReconcile && (
          <div className="border border-amber-200 border-t-0 rounded-b-xl bg-white p-4 space-y-4">
            {/* Upload Section */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg cursor-pointer transition-colors font-semibold">
                <Upload className="h-4 w-4" />
                {reconcileLoading ? 'Analyzing...' : 'Upload Eko Excel'}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleReconcileUpload}
                  className="hidden"
                  disabled={reconcileLoading}
                  data-testid="reconcile-upload-input"
                />
              </label>
              {reconcileLoading && <Loader2 className="h-5 w-5 animate-spin text-amber-600" />}
              <p className="text-xs text-slate-500">Upload the Excel downloaded from Eko portal</p>
            </div>
            
            {/* Results */}
            {reconcileData && (
              <div className="space-y-4">
                {/* Stats Summary */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3" data-testid="reconcile-stats">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{reconcileData.stats.total_excel}</p>
                    <p className="text-xs text-blue-600 font-medium">Total Entries</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{reconcileData.stats.eko_success_count || 0}</p>
                    <p className="text-xs text-green-600 font-medium">Eko Success</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{reconcileData.stats.eko_fail_count || 0}</p>
                    <p className="text-xs text-red-600 font-medium">Eko Fail</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-700">{reconcileData.stats.eko_refunded_count || 0}</p>
                    <p className="text-xs text-orange-600 font-medium">Eko Refunded</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-purple-700">{reconcileData.stats.matched}</p>
                    <p className="text-xs text-purple-600 font-medium">DB Matched</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-slate-700">₹{(reconcileData.stats.total_amount || 0).toLocaleString()}</p>
                    <p className="text-xs text-slate-600 font-medium">Total Amount</p>
                  </div>
                </div>

                {/* Action Items Alert */}
                {reconcileData.stats.eko_success_internal_failed > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span className="text-red-700 font-semibold">
                        {reconcileData.stats.eko_success_internal_failed} Eko Success transactions need fixing
                        {reconcileData.stats.needs_prc_reclaim > 0 && ` | PRC Reclaim: ₹${reconcileData.stats.total_prc_to_reclaim?.toLocaleString()}`}
                      </span>
                    </div>
                    <Button
                      onClick={() => {
                        const fixes = reconcileData.results
                          .filter(r => r.action !== 'OK' && r.action !== 'UNMATCHED' && r.action !== 'REVIEW')
                          .map(r => ({
                            request_id: r.request_id,
                            action: r.action,
                            eko_tid: r.eko_tid,
                            match_source: r.match_source,
                            eko_amount: r.eko_amount,
                            customer_id: r.customer_id,
                            client_ref_id: r.client_ref_id,
                            date: r.date
                          }));
                        handleApplyFixes(fixes);
                      }}
                      disabled={reconcileFixLoading}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                      data-testid="apply-all-fixes-btn"
                    >
                      {reconcileFixLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}
                      Fix All
                    </Button>
                  </div>
                )}
                
                {/* Full Excel Data Table */}
                <div>
                  <h3 className="font-semibold text-slate-800 mb-2">
                    All Eko Transactions ({reconcileData.results?.length || 0})
                  </h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 text-white sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-xs font-semibold">#</th>
                          <th className="text-left p-2 text-xs font-semibold">Date</th>
                          <th className="text-left p-2 text-xs font-semibold">Eko TID</th>
                          <th className="text-left p-2 text-xs font-semibold">Client Ref ID</th>
                          <th className="text-left p-2 text-xs font-semibold">Mobile</th>
                          <th className="text-right p-2 text-xs font-semibold">Amount</th>
                          <th className="text-left p-2 text-xs font-semibold">Type</th>
                          <th className="text-left p-2 text-xs font-semibold">Eko Status</th>
                          <th className="text-left p-2 text-xs font-semibold">DB Match</th>
                          <th className="text-left p-2 text-xs font-semibold">Internal Status</th>
                          <th className="text-left p-2 text-xs font-semibold">PRC Refunded</th>
                          <th className="text-right p-2 text-xs font-semibold">Fee</th>
                          <th className="text-right p-2 text-xs font-semibold">Commission</th>
                          <th className="text-left p-2 text-xs font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconcileData.results?.map((r, idx) => (
                          <tr key={idx} className={`border-t border-slate-100 hover:bg-slate-50 ${
                            r.action === 'FIX_STATUS_RECLAIM_PRC' ? 'bg-red-50' :
                            r.action === 'FIX_STATUS' ? 'bg-amber-50' :
                            r.action === 'NEEDS_REFUND' ? 'bg-blue-50' : ''
                          }`}>
                            <td className="p-2 text-xs text-slate-400">{idx + 1}</td>
                            <td className="p-2 text-xs text-slate-600 whitespace-nowrap">{r.date ? r.date.split('.')[0] : '-'}</td>
                            <td className="p-2 font-mono text-xs text-slate-800">{r.eko_tid || '-'}</td>
                            <td className="p-2 font-mono text-xs text-slate-600">{r.client_ref_id || '-'}</td>
                            <td className="p-2 text-xs text-slate-700">{r.customer_id || '-'}</td>
                            <td className="p-2 text-xs font-semibold text-slate-800 text-right">₹{r.eko_amount}</td>
                            <td className="p-2 text-xs text-slate-500">{r.debit_credit || '-'}</td>
                            <td className="p-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                r.eko_status?.toLowerCase() === 'success' ? 'bg-green-100 text-green-700' : 
                                r.eko_status?.toLowerCase() === 'fail' ? 'bg-red-100 text-red-700' : 
                                r.eko_status?.toLowerCase() === 'refunded' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>{r.eko_status}</span>
                            </td>
                            <td className="p-2">
                              {r.matched ? (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">Yes</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs text-slate-400">No</span>
                              )}
                            </td>
                            <td className="p-2">
                              {r.internal_status ? (
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  r.internal_status === 'completed' ? 'bg-green-100 text-green-700' : 
                                  r.internal_status === 'failed' ? 'bg-red-100 text-red-700' : 
                                  'bg-yellow-100 text-yellow-700'
                                }`}>{r.internal_status}</span>
                              ) : <span className="text-xs text-slate-300">-</span>}
                            </td>
                            <td className="p-2">
                              {r.prc_refunded === true ? (
                                <span className="text-orange-600 font-semibold text-xs">Yes ({r.prc_amount})</span>
                              ) : r.prc_refunded === false ? (
                                <span className="text-slate-400 text-xs">No</span>
                              ) : <span className="text-xs text-slate-300">-</span>}
                            </td>
                            <td className="p-2 text-xs text-right text-slate-500">{r.fee && r.fee !== 'N/A' ? `₹${r.fee}` : '-'}</td>
                            <td className="p-2 text-xs text-right text-slate-500">{r.commission && r.commission !== 'N/A' ? `₹${r.commission}` : '-'}</td>
                            <td className="p-2">
                              {r.action && r.action !== 'OK' && r.action !== 'UNMATCHED' ? (
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  r.action === 'FIX_STATUS_RECLAIM_PRC' ? 'bg-red-100 text-red-700' :
                                  r.action === 'CREATE_COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                  r.action === 'FIX_STATUS' ? 'bg-amber-100 text-amber-700' :
                                  r.action === 'NEEDS_REFUND' ? 'bg-blue-100 text-blue-700' :
                                  r.action === 'REVIEW' ? 'bg-purple-100 text-purple-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {r.action === 'FIX_STATUS_RECLAIM_PRC' ? 'Fix+Reclaim' :
                                   r.action === 'CREATE_COMPLETED' ? 'Create Record' :
                                   r.action === 'FIX_STATUS' ? 'Fix Status' :
                                   r.action === 'NEEDS_REFUND' ? 'Refund PRC' :
                                   r.action}
                                </span>
                              ) : r.action === 'OK' ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : <span className="text-xs text-slate-300">-</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Summary line */}
                <div className="flex items-center gap-4 text-sm">
                  {reconcileData.results?.filter(r => r.action === 'OK').length > 0 && (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      {reconcileData.results.filter(r => r.action === 'OK').length} matched correctly
                    </span>
                  )}
                  {reconcileData.results?.filter(r => r.action === 'UNMATCHED').length > 0 && (
                    <span className="text-slate-500 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {reconcileData.results.filter(r => r.action === 'UNMATCHED').length} not found in DB
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
                          <span className="text-xs text-red-400 max-w-[180px] block truncate" title={req.failure_reason || req.eko_error}>
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

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">Request Details</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowDetailModal(false)}
                  className="text-slate-500 hover:text-slate-800"
                >
                  ✕
                </Button>
              </div>
              
              {/* Request Info */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">Request ID</p>
                    <p className="text-sm font-mono text-slate-800">{selectedRequest.request?.request_id}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">Service</p>
                    <p className="text-sm text-slate-800">{formatServiceName(selectedRequest.request?.service_type)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">Amount</p>
                    <p className="text-lg font-bold text-amber-400">₹{selectedRequest.request?.amount?.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">Status</p>
                    <p className={`text-sm font-medium ${
                      selectedRequest.request?.status === 'completed' ? 'text-green-400' :
                      selectedRequest.request?.status === 'failed' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>{selectedRequest.request?.status?.toUpperCase()}</p>
                  </div>
                </div>
                
                {/* User Info */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">User</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">Name:</span> <span className="text-slate-800">{selectedRequest.user?.name || 'N/A'}</span></div>
                    <div><span className="text-slate-500">Email:</span> <span className="text-slate-800">{selectedRequest.user?.email || 'N/A'}</span></div>
                    <div><span className="text-slate-500">Mobile:</span> <span className="text-slate-800">{selectedRequest.user?.mobile || 'N/A'}</span></div>
                    <div><span className="text-slate-500">Plan:</span> <span className="text-slate-800">{selectedRequest.user?.subscription_plan || 'N/A'}</span></div>
                  </div>
                </div>
                
                {/* Eko Details */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Eko Transaction Details</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">TID:</span>
                      <span className="text-green-600 font-mono">{selectedRequest.eko_details?.tid || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Client Ref ID:</span>
                      <span className="text-blue-600 font-mono">{selectedRequest.eko_details?.client_ref_id || selectedRequest.request?.client_ref_id || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">UTR:</span>
                      <span className="text-slate-800 font-mono">{selectedRequest.eko_details?.utr || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className="text-slate-800">{selectedRequest.eko_details?.status || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Message:</span>
                      <span className="text-slate-800">{selectedRequest.eko_details?.message || 'N/A'}</span>
                    </div>
                  </div>
                  
                  {/* Copy for EKO Support */}
                  <Button
                    onClick={() => {
                      const tid = selectedRequest.eko_details?.tid || 'N/A';
                      const clientRef = selectedRequest.eko_details?.client_ref_id || selectedRequest.request?.client_ref_id || 'N/A';
                      const amount = selectedRequest.request?.amount || 'N/A';
                      const date = selectedRequest.request?.created_at ? new Date(selectedRequest.request.created_at).toLocaleString('en-IN') : 'N/A';
                      const status = selectedRequest.request?.status || 'N/A';
                      const reqId = selectedRequest.request?.request_id || 'N/A';
                      const consumer = selectedRequest.request?.details?.consumer_number || selectedRequest.request?.details?.mobile_number || 'N/A';
                      const operator = selectedRequest.request?.details?.operator_id || selectedRequest.request?.details?.operator || 'N/A';
                      const text = `EKO Support Details:\nTID: ${tid}\nClient Ref ID: ${clientRef}\nRequest ID: ${reqId}\nAmount: ₹${amount}\nDate: ${date}\nStatus: ${status}\nConsumer/Mobile: ${consumer}\nOperator ID: ${operator}`;
                      navigator.clipboard.writeText(text);
                      toast.success('EKO Support details copied!');
                    }}
                    size="sm"
                    className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                    data-testid="copy-eko-support-btn"
                  >
                    <Copy className="h-4 w-4 mr-2" /> Copy for EKO Support
                  </Button>
                </div>
                
                {/* Refund Info */}
                {selectedRequest.refund_info?.refunded && (
                  <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4">
                    <p className="text-xs text-orange-400 mb-2">Refund Info</p>
                    <p className="text-lg font-bold text-orange-400">
                      {selectedRequest.refund_info.amount} PRC Refunded
                    </p>
                  </div>
                )}
                
                {/* Check EKO Wallet Refund Status */}
                {(selectedRequest.request?.status === 'failed' || selectedRequest.request?.status === 'FAILED' || selectedRequest.request?.status === 'refund_pending') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs text-blue-600 mb-3 font-semibold">EKO Wallet Refund Check</p>
                    <p className="text-sm text-slate-600 mb-3">
                      Check if EKO has refunded the amount to merchant wallet for this failed transaction.
                    </p>
                    <Button
                      onClick={() => handleCheckEkoRefund(selectedRequest.request?.request_id)}
                      disabled={ekoCheckLoading}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold mb-3"
                      data-testid="check-eko-refund-btn"
                    >
                      {ekoCheckLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking EKO...</>
                      ) : (
                        <><Search className="h-4 w-4 mr-2" /> Check EKO Wallet Refund Status</>
                      )}
                    </Button>
                    
                    {ekoRefundResult && (
                      <div className={`mt-2 p-3 rounded-lg text-sm ${
                        ekoRefundResult.eko_refunded ? 'bg-green-50 text-green-700 border border-green-200' :
                        ekoRefundResult.eko_status === 'REFUND_PENDING' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                        'bg-slate-50 text-slate-700 border border-slate-200'
                      }`}>
                        <p className="font-semibold mb-1">
                          EKO Status: {ekoRefundResult.eko_status || 'Not Found'}
                        </p>
                        {ekoRefundResult.eko_refunded && <p>EKO wallet refunded</p>}
                        {ekoRefundResult.eko_status === 'REFUND_PENDING' && <p>EKO refund is pending - will be auto-refunded</p>}
                        {ekoRefundResult.wallet_debited === false && <p>EKO wallet was NOT debited for this transaction</p>}
                        {ekoRefundResult.error && <p className="text-red-600">{ekoRefundResult.error}</p>}
                        {ekoRefundResult.eko_message && <p>Message: {ekoRefundResult.eko_message}</p>}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Refund Button for non-completed, non-refunded requests */}
                
                {/* EKO Wallet Refund via OTP */}
                {(selectedRequest.request?.status === 'failed' || selectedRequest.request?.status === 'FAILED' || selectedRequest.request?.status === 'refund_pending') && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4" data-testid="eko-wallet-refund-section">
                    <p className="text-xs text-amber-700 mb-2 font-semibold">EKO Wallet Refund (OTP Flow)</p>
                    
                    {/* If no TID, allow manual entry */}
                    {(!selectedRequest.eko_details?.tid || selectedRequest.eko_details?.tid === 'N/A') && ekoRefundStep !== 'manual_tid' && ekoRefundStep !== 'otp_sent' && ekoRefundStep !== 'done' ? (
                      <div>
                        <p className="text-sm text-slate-600 mb-3">
                          TID not available. Get TID from EKO Dashboard and enter manually.
                        </p>
                        <Button
                          onClick={() => setEkoRefundStep('manual_tid')}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold"
                        >
                          Enter TID Manually
                        </Button>
                      </div>
                    ) : ekoRefundStep === 'manual_tid' ? (
                      <div className="space-y-3">
                        <p className="text-sm text-amber-700">Enter EKO Transaction ID:</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={ekoRefundOtp}
                            onChange={(e) => setEkoRefundOtp(e.target.value)}
                            placeholder="Enter EKO TID"
                            className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm font-mono"
                            data-testid="eko-manual-tid-input"
                          />
                          <Button
                            onClick={() => {
                              if (!ekoRefundOtp.trim()) { toast.error('Please enter TID'); return; }
                              handleResendRefundOtp(ekoRefundOtp.trim());
                              setEkoRefundOtp('');
                            }}
                            disabled={ekoRefundLoading}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
                          >
                            {ekoRefundLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
                          </Button>
                        </div>
                      </div>
                    ) : ekoRefundStep === 'done' ? (
                      <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                        <p className="text-green-700 font-semibold">Refund Successful!</p>
                        {ekoRefundResponse?.refunded_amount && (
                          <p className="text-sm text-green-600">Amount: ₹{ekoRefundResponse.refunded_amount}</p>
                        )}
                        {ekoRefundResponse?.new_balance && (
                          <p className="text-sm text-green-600">New Balance: ₹{ekoRefundResponse.new_balance}</p>
                        )}
                      </div>
                    ) : ekoRefundStep === 'otp_sent' ? (
                      <div className="space-y-3">
                        <p className="text-sm text-amber-700">OTP sent to customer. Enter OTP below:</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={ekoRefundOtp}
                            onChange={(e) => setEkoRefundOtp(e.target.value)}
                            placeholder="Enter OTP"
                            className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm font-mono"
                            data-testid="eko-refund-otp-input"
                          />
                          <Button
                            onClick={() => handleVerifyRefundOtp(ekoRefundResponse?.tid || selectedRequest.eko_details?.tid)}
                            disabled={ekoRefundLoading}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold"
                            data-testid="eko-verify-otp-btn"
                          >
                            {ekoRefundLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Refund'}
                          </Button>
                        </div>
                        <Button
                          onClick={() => handleResendRefundOtp(ekoRefundResponse?.tid || selectedRequest.eko_details?.tid)}
                          disabled={ekoRefundLoading}
                          size="sm"
                          variant="outline"
                          className="text-amber-700 border-amber-400"
                        >
                          Resend OTP
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-slate-600 mb-3">
                          EKO TID: <strong className="font-mono">{selectedRequest.eko_details?.tid}</strong> — 
                          Send OTP to customer, verify it, and wallet refund will be processed.
                        </p>
                        <Button
                          onClick={() => handleResendRefundOtp(selectedRequest.eko_details?.tid)}
                          disabled={ekoRefundLoading}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold"
                          data-testid="eko-send-refund-otp-btn"
                        >
                          {ekoRefundLoading ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending OTP...</>
                          ) : (
                            'Send Refund OTP to Customer'
                          )}
                        </Button>
                      </div>
                    )}
                    
                    {ekoRefundResponse?.message && ekoRefundStep !== 'done' && (
                      <p className="text-xs text-slate-500 mt-2">EKO: {ekoRefundResponse.message}</p>
                    )}
                  </div>
                )}

                {selectedRequest.request?.status !== 'completed' && 
                 selectedRequest.request?.status !== 'COMPLETED' &&
                 !selectedRequest.refund_info?.refunded &&
                 !selectedRequest.request?.prc_refunded && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-xs text-red-600 mb-3 font-semibold">Admin Action: Refund PRC</p>
                    <p className="text-sm text-slate-600 mb-3">
                      This request is <strong>{selectedRequest.request?.status?.toUpperCase()}</strong> with no EKO transaction. 
                      PRC ({selectedRequest.request?.total_prc_deducted?.toLocaleString() || 'N/A'} PRC) was deducted but service was not delivered.
                    </p>
                    <Button
                      onClick={() => handleRefund(
                        selectedRequest.request?.request_id, 
                        `Stuck ${selectedRequest.request?.status} - EKO TID: ${selectedRequest.eko_details?.tid || 'None'}`
                      )}
                      disabled={refundLoading}
                      className="w-full bg-red-500 hover:bg-red-600 text-white font-bold"
                      data-testid="modal-refund-btn"
                    >
                      {refundLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing Refund...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-2" /> Refund {selectedRequest.request?.total_prc_deducted?.toLocaleString() || ''} PRC</>
                      )}
                    </Button>
                  </div>
                )}
                
                {/* Error Message */}
                {selectedRequest.request?.error_message && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                    <p className="text-xs text-red-400 mb-2">Error</p>
                    <p className="text-sm text-red-300">{selectedRequest.request.error_message}</p>
                  </div>
                )}
                
                {/* Request Details */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Service Details</p>
                  <pre className="text-xs text-slate-600 overflow-x-auto">
                    {JSON.stringify(selectedRequest.request?.details, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBBPSDashboard;
