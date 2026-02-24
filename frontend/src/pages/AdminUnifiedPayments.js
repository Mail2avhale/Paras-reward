import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Building2, Clock, CheckCircle, XCircle, Search, RefreshCw,
  ChevronDown, User, CreditCard, PiggyBank, FileSpreadsheet,
  Download, CheckSquare, Square, Filter, AlertCircle, Send
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminUnifiedPayments = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ bank: 0, emi: 0, savings: 0, total: 0 });
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all'); // all, bank, emi, savings
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Bulk approve modal
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [transactionRefs, setTransactionRefs] = useState({});
  const [bulkProcessing, setBulkProcessing] = useState(false);
  
  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch all requests
  const fetchAllRequests = useCallback(async () => {
    setLoading(true);
    try {
      const allRequests = [];
      let bankCount = 0, emiCount = 0, savingsCount = 0;
      
      // Fetch Bank Redeem requests
      if (typeFilter === 'all' || typeFilter === 'bank') {
        try {
          const bankRes = await axios.get(`${API}/admin/bank-redeem/requests`, {
            params: { status: statusFilter, limit: 500 }
          });
          const bankData = bankRes.data?.requests || bankRes.data || [];
          bankData.forEach(req => {
            allRequests.push({
              ...req,
              request_type: 'bank',
              type_label: 'Bank Redeem',
              type_icon: 'building',
              unique_id: `bank_${req.request_id || req._id}`,
              display_amount: req.amount_inr || req.amount || 0,
              bank_details: req.bank_details || {}
            });
          });
          bankCount = bankData.length;
        } catch (e) {
          console.log('Bank redeem fetch error:', e);
        }
      }
      
      // Fetch EMI requests from bill_payment_requests
      if (typeFilter === 'all' || typeFilter === 'emi') {
        try {
          const emiRes = await axios.get(`${API}/admin/bill-payment/requests`, {
            params: { status: statusFilter, payment_type: 'emi', limit: 500 }
          });
          const emiData = emiRes.data?.requests || emiRes.data || [];
          emiData.filter(r => r.payment_type?.toLowerCase() === 'emi' || r.payment_type?.toLowerCase() === 'loan_emi').forEach(req => {
            allRequests.push({
              ...req,
              request_type: 'emi',
              type_label: 'EMI Payment',
              type_icon: 'credit-card',
              unique_id: `emi_${req.request_id || req._id}`,
              display_amount: req.amount_inr || req.amount || 0,
              bank_details: req.bank_details || req.emi_details || {}
            });
          });
          emiCount = emiData.filter(r => r.payment_type?.toLowerCase() === 'emi' || r.payment_type?.toLowerCase() === 'loan_emi').length;
        } catch (e) {
          console.log('EMI fetch error:', e);
        }
      }
      
      // Fetch Savings Vault redeem requests
      if (typeFilter === 'all' || typeFilter === 'savings') {
        try {
          const rdRes = await axios.get(`${API}/rd/admin/redeem-requests`, {
            params: { status: statusFilter, limit: 500 }
          });
          const rdData = rdRes.data?.requests || rdRes.data || [];
          rdData.forEach(req => {
            allRequests.push({
              ...req,
              request_type: 'savings',
              type_label: 'Savings Vault',
              type_icon: 'piggy-bank',
              unique_id: `savings_${req.request_id || req.rd_id || req._id}`,
              display_amount: req.amount_inr || req.net_amount || 0,
              bank_details: req.bank_details || {}
            });
          });
          savingsCount = rdData.length;
        } catch (e) {
          console.log('Savings fetch error:', e);
        }
      }
      
      // Sort by date (newest first)
      allRequests.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      
      setRequests(allRequests);
      setStats({
        bank: bankCount,
        emi: emiCount,
        savings: savingsCount,
        total: allRequests.length
      });
      setSelectedIds(new Set());
      setSelectAll(false);
      
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchAllRequests();
  }, [fetchAllRequests]);

  // Filter by search
  const filteredRequests = requests.filter(req => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      (req.user_name || '').toLowerCase().includes(search) ||
      (req.email || '').toLowerCase().includes(search) ||
      (req.request_id || '').toLowerCase().includes(search) ||
      (req.bank_details?.account_number || '').includes(search) ||
      (req.bank_details?.bank_name || '').toLowerCase().includes(search)
    );
  });

  // Selection handlers
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map(r => r.unique_id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectOne = (uniqueId) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(uniqueId)) {
      newSelected.delete(uniqueId);
    } else {
      newSelected.add(uniqueId);
    }
    setSelectedIds(newSelected);
    setSelectAll(newSelected.size === filteredRequests.length);
  };

  // Get selected requests
  const getSelectedRequests = () => {
    return filteredRequests.filter(r => selectedIds.has(r.unique_id));
  };

  // Bulk Approve Handler
  const handleBulkApprove = async () => {
    const selected = getSelectedRequests();
    if (selected.length === 0) {
      toast.error('No requests selected');
      return;
    }
    
    // Check if all have transaction refs
    const missingRefs = selected.filter(r => !transactionRefs[r.unique_id]?.trim());
    if (missingRefs.length > 0) {
      toast.error(`Please enter transaction reference for all ${missingRefs.length} requests`);
      return;
    }
    
    setBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const req of selected) {
      try {
        const txnRef = transactionRefs[req.unique_id];
        
        if (req.request_type === 'bank') {
          await axios.post(`${API}/admin/bank-redeem/requests/${req.request_id}/approve`, {
            admin_id: user.uid,
            transaction_ref: txnRef
          });
        } else if (req.request_type === 'emi') {
          await axios.post(`${API}/admin/bill-payment/requests/${req.request_id}/approve`, {
            admin_id: user.uid,
            transaction_ref: txnRef
          });
        } else if (req.request_type === 'savings') {
          await axios.post(`${API}/rd/admin/redeem-requests/${req.request_id || req.rd_id}/approve`, null, {
            params: { admin_id: user.uid, transaction_ref: txnRef }
          });
        }
        
        // Send notification
        try {
          await axios.post(`${API}/notifications/send`, {
            user_id: req.uid || req.user_id,
            title: `${req.type_label} Approved`,
            message: `Your ${req.type_label} request of ₹${req.display_amount?.toLocaleString()} has been approved. Ref: ${txnRef}`,
            type: 'payment_approved'
          });
        } catch (notifError) {
          console.log('Notification error:', notifError);
        }
        
        successCount++;
      } catch (error) {
        console.error(`Failed to approve ${req.unique_id}:`, error);
        failCount++;
      }
    }
    
    setBulkProcessing(false);
    setShowBulkApproveModal(false);
    setTransactionRefs({});
    
    if (successCount > 0) {
      toast.success(`Successfully approved ${successCount} requests`);
    }
    if (failCount > 0) {
      toast.error(`Failed to approve ${failCount} requests`);
    }
    
    fetchAllRequests();
  };

  // Bulk Reject Handler
  const handleBulkReject = async () => {
    const selected = getSelectedRequests();
    if (selected.length === 0) {
      toast.error('No requests selected');
      return;
    }
    
    if (!rejectReason.trim()) {
      toast.error('Please enter rejection reason');
      return;
    }
    
    setBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const req of selected) {
      try {
        if (req.request_type === 'bank') {
          await axios.post(`${API}/admin/bank-redeem/requests/${req.request_id}/reject`, {
            admin_id: user.uid,
            reason: rejectReason
          });
        } else if (req.request_type === 'emi') {
          await axios.post(`${API}/admin/bill-payment/requests/${req.request_id}/reject`, {
            admin_id: user.uid,
            reason: rejectReason
          });
        } else if (req.request_type === 'savings') {
          await axios.post(`${API}/rd/admin/redeem-requests/${req.request_id || req.rd_id}/reject`, null, {
            params: { admin_id: user.uid, reason: rejectReason }
          });
        }
        
        // Send notification
        try {
          await axios.post(`${API}/notifications/send`, {
            user_id: req.uid || req.user_id,
            title: `${req.type_label} Rejected`,
            message: `Your ${req.type_label} request of ₹${req.display_amount?.toLocaleString()} has been rejected. Reason: ${rejectReason}`,
            type: 'payment_rejected'
          });
        } catch (notifError) {
          console.log('Notification error:', notifError);
        }
        
        successCount++;
      } catch (error) {
        console.error(`Failed to reject ${req.unique_id}:`, error);
        failCount++;
      }
    }
    
    setBulkProcessing(false);
    setShowRejectModal(false);
    setRejectReason('');
    
    if (successCount > 0) {
      toast.success(`Successfully rejected ${successCount} requests`);
    }
    if (failCount > 0) {
      toast.error(`Failed to reject ${failCount} requests`);
    }
    
    fetchAllRequests();
  };

  // HDFC Export
  const handleHDFCExport = async () => {
    try {
      toast.loading('Generating HDFC Excel file...');
      
      const response = await fetch(`${API}/admin/hdfc-export/combined?status=approved`);
      
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
      a.download = `HDFC_AllPayments_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.dismiss();
      toast.success('HDFC Excel downloaded!');
    } catch (error) {
      toast.dismiss();
      toast.error('Export failed');
    }
  };

  // Type icon component
  const TypeIcon = ({ type }) => {
    switch(type) {
      case 'bank': return <Building2 className="w-4 h-4 text-green-400" />;
      case 'emi': return <CreditCard className="w-4 h-4 text-purple-400" />;
      case 'savings': return <PiggyBank className="w-4 h-4 text-emerald-400" />;
      default: return <CreditCard className="w-4 h-4 text-gray-400" />;
    }
  };

  // Status badge
  const StatusBadge = ({ status }) => {
    const config = {
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
      approved: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
      rejected: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
      completed: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: CheckCircle }
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${c.bg} ${c.text}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  const selectedCount = selectedIds.size;
  const totalAmount = getSelectedRequests().reduce((sum, r) => sum + (r.display_amount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-blue-400" />
            Unified Payment Dashboard
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Bank Redeem + EMI + Savings Vault - All in One
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchAllRequests}
            variant="outline"
            size="sm"
            className="border-gray-700"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            onClick={handleHDFCExport}
            className="bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            HDFC Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">Total Requests</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-green-400 text-xs mb-1 flex items-center gap-1">
            <Building2 className="w-3 h-3" /> Bank Redeem
          </p>
          <p className="text-2xl font-bold text-white">{stats.bank}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
          <p className="text-purple-400 text-xs mb-1 flex items-center gap-1">
            <CreditCard className="w-3 h-3" /> EMI
          </p>
          <p className="text-2xl font-bold text-white">{stats.emi}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <p className="text-emerald-400 text-xs mb-1 flex items-center gap-1">
            <PiggyBank className="w-3 h-3" /> Savings
          </p>
          <p className="text-2xl font-bold text-white">{stats.savings}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-400 text-xs mb-1">Selected</p>
          <p className="text-2xl font-bold text-white">{selectedCount}</p>
          <p className="text-blue-400/70 text-xs">₹{totalAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Status Filter */}
        <div className="flex bg-gray-900 rounded-lg p-1">
          {['pending', 'approved', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        
        {/* Type Filter */}
        <div className="flex bg-gray-900 rounded-lg p-1">
          {[
            { key: 'all', label: 'All', icon: Filter },
            { key: 'bank', label: 'Bank', icon: Building2 },
            { key: 'emi', label: 'EMI', icon: CreditCard },
            { key: 'savings', label: 'Savings', icon: PiggyBank }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                typeFilter === key
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search user, bank, request ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-900 border-gray-700"
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedCount > 0 && statusFilter === 'pending' && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-400" />
            <span className="text-white font-medium">{selectedCount} requests selected</span>
            <span className="text-blue-400">(₹{totalAmount.toLocaleString()})</span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowBulkApproveModal(true)}
              className="bg-green-600 hover:bg-green-700"
              size="sm"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Bulk Approve
            </Button>
            <Button
              onClick={() => setShowRejectModal(true)}
              variant="destructive"
              size="sm"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Bulk Reject
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={handleSelectAll}
                    className="text-gray-400 hover:text-white"
                  >
                    {selectAll ? (
                      <CheckSquare className="w-5 h-5 text-blue-400" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Request ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Bank A/C</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">IFSC</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-10 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading requests...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-10 text-center text-gray-500">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                    No requests found
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr
                    key={req.unique_id}
                    className={`hover:bg-gray-800/50 transition-colors ${
                      selectedIds.has(req.unique_id) ? 'bg-blue-500/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleSelectOne(req.unique_id)}
                        className="text-gray-400 hover:text-white"
                      >
                        {selectedIds.has(req.unique_id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-400" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon type={req.request_type} />
                        <span className="text-xs text-gray-400">{req.type_label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-white font-mono">
                        {(req.request_id || req.rd_id || '').slice(-10)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-white">{req.user_name || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{req.email || ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-white font-mono">
                        {req.bank_details?.account_number || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-400">
                        {req.bank_details?.ifsc_code || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold text-emerald-400">
                        ₹{(req.display_amount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Approve Modal */}
      {showBulkApproveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-400" />
              Bulk Approve - Enter Transaction References
            </h2>
            
            <p className="text-gray-400 text-sm mb-4">
              Enter transaction reference for each request ({selectedCount} selected, Total: ₹{totalAmount.toLocaleString()})
            </p>
            
            <div className="space-y-3 mb-6">
              {getSelectedRequests().map((req) => (
                <div key={req.unique_id} className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TypeIcon type={req.request_type} />
                      <span className="text-white text-sm">{req.user_name}</span>
                      <span className="text-emerald-400 font-bold">₹{req.display_amount?.toLocaleString()}</span>
                    </div>
                    <span className="text-xs text-gray-500">{req.bank_details?.bank_name}</span>
                  </div>
                  <Input
                    placeholder="Enter Transaction Reference (UTR/Ref No.)"
                    value={transactionRefs[req.unique_id] || ''}
                    onChange={(e) => setTransactionRefs({
                      ...transactionRefs,
                      [req.unique_id]: e.target.value
                    })}
                    className="bg-gray-900 border-gray-700"
                  />
                </div>
              ))}
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowBulkApproveModal(false);
                  setTransactionRefs({});
                }}
                variant="outline"
                className="flex-1 border-gray-700"
                disabled={bulkProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkApprove}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={bulkProcessing}
              >
                {bulkProcessing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {bulkProcessing ? 'Processing...' : `Approve ${selectedCount} Requests`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <XCircle className="w-6 h-6 text-red-400" />
              Bulk Reject - {selectedCount} Requests
            </h2>
            
            <p className="text-gray-400 text-sm mb-4">
              Total Amount: ₹{totalAmount.toLocaleString()}
            </p>
            
            <textarea
              placeholder="Enter rejection reason (will be sent to all selected users)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 mb-4"
            />
            
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                variant="outline"
                className="flex-1 border-gray-700"
                disabled={bulkProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkReject}
                variant="destructive"
                className="flex-1"
                disabled={bulkProcessing}
              >
                {bulkProcessing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                {bulkProcessing ? 'Processing...' : `Reject ${selectedCount} Requests`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUnifiedPayments;
