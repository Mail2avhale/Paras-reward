import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Banknote, CheckCircle, XCircle, Clock, Search, Filter, RefreshCw,
  ChevronLeft, ChevronRight, Eye, IndianRupee, Building2, User,
  Calendar, AlertCircle, Download, ArrowUpDown, Loader2, Copy
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Copy to clipboard helper
const copyToClipboard = (text, label) => {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied!`);
  }).catch(() => {
    toast.error('Copy failed');
  });
};

// Copyable Field Component
const CopyField = ({ label, value, className = "" }) => (
  <div className={`flex items-center justify-between gap-2 ${className}`}>
    <div className="flex-1 min-w-0">
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="text-white font-mono text-sm truncate">{value || '-'}</p>
    </div>
    {value && (
      <button
        onClick={() => copyToClipboard(value, label)}
        className="p-1.5 hover:bg-slate-600 rounded transition-colors"
        title={`Copy ${label}`}
      >
        <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-400" />
      </button>
    )}
  </div>
);

// Status badge
const StatusBadge = ({ status }) => {
  const config = {
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Pending' },
    paid: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Paid' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Failed' }
  };
  const c = config[status] || config.pending;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text} border ${c.border}`}>
      {c.label}
    </span>
  );
};

// Stats Card
const StatCard = ({ title, value, subValue, icon: Icon, color }) => (
  <Card className={`bg-slate-800/50 border-slate-700 p-4`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-slate-400 text-sm">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {subValue && <p className="text-slate-500 text-xs mt-1">{subValue}</p>}
      </div>
      <div className={`p-3 rounded-xl bg-slate-700/50`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
    </div>
  </Card>
);

const AdminBankTransfers = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: {}, paid: {}, failed: {} });
  
  // Filters - Default to pending tab
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' = oldest first
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 20;
  
  // Modal state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(''); // 'paid' or 'failed'
  const [actionRemark, setActionRemark] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [processing, setProcessing] = useState(false);

  // Load requests
  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        skip: ((page - 1) * limit).toString()
      });
      
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      
      const res = await axios.get(`${API}/bank-transfer/admin/requests?${params}`);
      
      let data = res.data.requests || [];
      
      // Client-side date filtering
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        data = data.filter(r => new Date(r.created_at) >= fromDate);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        data = data.filter(r => new Date(r.created_at) <= toDate);
      }
      
      // Sort by created_at - oldest first (asc) or newest first (desc)
      data.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
      
      setRequests(data);
      setStats(res.data.stats || { pending: {}, paid: {}, failed: {} });
      setTotalPages(res.data.pagination?.pages || 1);
      setTotalItems(res.data.pagination?.total || data.length);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery, dateFrom, dateTo, sortOrder]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Handle action (mark paid/failed)
  const handleAction = async () => {
    if (!selectedRequest) return;
    
    if (actionType === 'paid' && !utrNumber.trim()) {
      toast.error('Please enter UTR number');
      return;
    }
    
    setProcessing(true);
    try {
      const admin = JSON.parse(localStorage.getItem('user') || '{}');
      
      const endpoint = actionType === 'paid' 
        ? `${API}/bank-transfer/admin/mark-paid`
        : `${API}/bank-transfer/admin/mark-failed`;
      
      const res = await axios.post(endpoint, {
        request_id: selectedRequest.request_id,
        admin_id: admin.uid || 'admin',
        remark: actionRemark,
        utr_number: actionType === 'paid' ? utrNumber : undefined
      });
      
      if (res.data.success) {
        toast.success(res.data.message);
        setShowActionModal(false);
        setSelectedRequest(null);
        setActionRemark('');
        setUtrNumber('');
        loadRequests();
      }
    } catch (error) {
      const msg = error.response?.data?.detail || 'Action failed';
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  // Open action modal
  const openActionModal = (request, type) => {
    setSelectedRequest(request);
    setActionType(type);
    setShowActionModal(true);
    setActionRemark('');
    setUtrNumber('');
  };

  // Reset filters
  const resetFilters = () => {
    setStatusFilter('');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Banknote className="w-8 h-8 text-emerald-400" />
              Bank Transfer Requests
            </h1>
            <p className="text-slate-400 mt-1">Manage PRC to Bank transfer requests</p>
          </div>
          
          <Button
            onClick={loadRequests}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Bulk Actions */}
        {stats.pending?.count > 0 && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="text-white">
                <p className="font-semibold">Bulk Actions</p>
                <p className="text-sm text-slate-400">{stats.pending?.count} pending requests</p>
              </div>
              <Button
                onClick={async () => {
                  if (!window.confirm(`Are you sure you want to FAIL ALL ${stats.pending?.count} pending requests? PRC will be refunded.`)) return;
                  try {
                    setLoading(true);
                    const admin = JSON.parse(localStorage.getItem('user') || '{}');
                    const res = await axios.post(`${API}/bank-transfer/admin/bulk-mark-failed`, {
                      mark_all_pending: true,
                      admin_id: admin.uid || 'admin',
                      remark: 'Bulk failed - Service discontinued'
                    });
                    if (res.data.success) {
                      toast.success(`${res.data.failed_count} requests failed. ${res.data.total_refunded?.toLocaleString()} PRC refunded.`);
                      loadRequests();
                    }
                  } catch (err) {
                    toast.error(err.response?.data?.detail || 'Bulk action failed');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={loading}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Fail All Pending & Refund PRC
              </Button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Pending Requests"
            value={stats.pending?.count || 0}
            subValue={`₹${(stats.pending?.amount || 0).toLocaleString()}`}
            icon={Clock}
            color="text-yellow-400"
          />
          <StatCard
            title="Paid (Completed)"
            value={stats.paid?.count || 0}
            subValue={`₹${(stats.paid?.amount || 0).toLocaleString()}`}
            icon={CheckCircle}
            color="text-green-400"
          />
          <StatCard
            title="Failed"
            value={stats.failed?.count || 0}
            subValue={`₹${(stats.failed?.amount || 0).toLocaleString()}`}
            icon={XCircle}
            color="text-red-400"
          />
        </div>

        {/* Filters */}
        <Card data-testid="filters-card" className="bg-slate-800/50 border-slate-700 p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  data-testid="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, phone, account..."
                  className="pl-10 bg-slate-900 border-slate-600 text-white"
                />
              </div>
            </div>
            
            {/* Status Filter */}
            <select
              data-testid="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white min-w-[150px]"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
            
            {/* Date From */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <Input
                data-testid="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-slate-900 border-slate-600 text-white w-[150px]"
                placeholder="From"
              />
            </div>
            
            {/* Date To */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">to</span>
              <Input
                data-testid="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-900 border-slate-600 text-white w-[150px]"
              />
            </div>
            
            {/* Sort Order */}
            <Button
              variant="outline"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="border-slate-600 text-slate-300"
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
            </Button>
            
            {/* Reset */}
            <Button
              variant="outline"
              onClick={resetFilters}
              className="border-slate-600 text-slate-300"
            >
              Reset
            </Button>
          </div>
        </Card>

        {/* Requests Table */}
        <Card className="bg-slate-800/50 border-slate-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <Banknote className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No requests found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="text-left p-4 text-slate-400 font-medium text-sm">Request ID</th>
                      <th className="text-left p-4 text-slate-400 font-medium text-sm">User</th>
                      <th className="text-left p-4 text-slate-400 font-medium text-sm">Amount</th>
                      <th className="text-left p-4 text-slate-400 font-medium text-sm">Bank Details</th>
                      <th className="text-left p-4 text-slate-400 font-medium text-sm">Created / Processed</th>
                      <th className="text-left p-4 text-slate-400 font-medium text-sm">Status</th>
                      <th className="text-left p-4 text-slate-400 font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {requests.map((req) => (
                      <tr key={req.request_id} className="hover:bg-slate-700/30">
                        <td className="p-4">
                          <p className="text-white font-mono text-sm">{req.request_id}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-white font-medium">{req.user_name}</p>
                          <p className="text-slate-400 text-sm">{req.user_phone}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-emerald-400 font-bold">₹{req.withdrawal_amount?.toLocaleString()}</p>
                          <p className="text-slate-500 text-xs">{req.prc_deducted?.toLocaleString()} PRC</p>
                        </td>
                        <td className="p-4">
                          <div className="space-y-2 min-w-[280px]">
                            {/* Name with Copy */}
                            <div className="flex items-center justify-between gap-2 bg-slate-900/50 px-2 py-1 rounded">
                              <div>
                                <span className="text-slate-500 text-xs">Name: </span>
                                <span className="text-white text-sm font-medium">{req.account_holder_name || req.user_name}</span>
                              </div>
                              <button
                                onClick={() => copyToClipboard(req.account_holder_name || req.user_name, 'Name')}
                                className="p-1 hover:bg-slate-700 rounded"
                                title="Copy Name"
                              >
                                <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-400" />
                              </button>
                            </div>
                            {/* Account Number with Copy */}
                            <div className="flex items-center justify-between gap-2 bg-slate-900/50 px-2 py-1 rounded">
                              <div>
                                <span className="text-slate-500 text-xs">A/C: </span>
                                <span className="text-white text-sm font-mono">{req.account_number}</span>
                              </div>
                              <button
                                onClick={() => copyToClipboard(req.account_number, 'Account Number')}
                                className="p-1 hover:bg-slate-700 rounded"
                                title="Copy Account Number"
                              >
                                <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-400" />
                              </button>
                            </div>
                            {/* IFSC with Copy */}
                            <div className="flex items-center justify-between gap-2 bg-slate-900/50 px-2 py-1 rounded">
                              <div>
                                <span className="text-slate-500 text-xs">IFSC: </span>
                                <span className="text-white text-sm font-mono">{req.ifsc_code}</span>
                              </div>
                              <button
                                onClick={() => copyToClipboard(req.ifsc_code, 'IFSC')}
                                className="p-1 hover:bg-slate-700 rounded"
                                title="Copy IFSC"
                              >
                                <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-400" />
                              </button>
                            </div>
                            {/* Amount with Copy */}
                            <div className="flex items-center justify-between gap-2 bg-emerald-900/30 px-2 py-1 rounded border border-emerald-500/20">
                              <div>
                                <span className="text-slate-500 text-xs">Amount: </span>
                                <span className="text-emerald-400 text-sm font-bold">₹{req.withdrawal_amount?.toLocaleString()}</span>
                              </div>
                              <button
                                onClick={() => copyToClipboard(req.withdrawal_amount?.toString(), 'Amount')}
                                className="p-1 hover:bg-emerald-800/50 rounded"
                                title="Copy Amount"
                              >
                                <Copy className="w-3.5 h-3.5 text-emerald-400 hover:text-emerald-300" />
                              </button>
                            </div>
                            {/* Bank Name */}
                            <p className="text-slate-400 text-xs">{req.bank_name}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <div>
                              <p className="text-slate-500 text-xs">Created:</p>
                              <p className="text-slate-300 text-sm">
                                {new Date(req.created_at).toLocaleDateString('en-IN')}
                              </p>
                              <p className="text-slate-500 text-xs">
                                {new Date(req.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            {req.processed_at && (
                              <div className="mt-2 pt-2 border-t border-slate-700">
                                <p className={`text-xs ${req.status === 'paid' ? 'text-green-500' : 'text-red-500'}`}>
                                  {req.status === 'paid' ? 'Paid:' : 'Failed:'}
                                </p>
                                <p className="text-slate-300 text-sm">
                                  {new Date(req.processed_at).toLocaleDateString('en-IN')}
                                </p>
                                <p className="text-slate-500 text-xs">
                                  {new Date(req.processed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="p-4">
                          {req.status === 'pending' ? (
                            <div className="flex gap-2">
                              <Button
                                data-testid={`mark-paid-${req.request_id}`}
                                size="sm"
                                onClick={() => openActionModal(req, 'paid')}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Paid
                              </Button>
                              <Button
                                data-testid={`mark-failed-${req.request_id}`}
                                size="sm"
                                onClick={() => openActionModal(req, 'failed')}
                                variant="outline"
                                className="border-red-500 text-red-400 hover:bg-red-500/10"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Fail
                              </Button>
                            </div>
                          ) : (
                            <div className="text-sm">
                              {req.utr_number && (
                                <p className="text-emerald-400 font-mono text-xs">UTR: {req.utr_number}</p>
                              )}
                              {req.admin_remark && (
                                <p className="text-slate-400 text-xs mt-1">{req.admin_remark}</p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-700">
                {requests.map((req) => (
                  <div key={req.request_id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-medium">{req.user_name}</p>
                        <p className="text-slate-400 text-sm">{req.user_phone}</p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                    
                    {/* Bank Details with Copy Buttons */}
                    <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                      {/* Name */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-500 text-xs">Account Holder: </span>
                          <span className="text-white text-sm">{req.account_holder_name || req.user_name}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(req.account_holder_name || req.user_name, 'Name')}
                          className="p-1.5 hover:bg-slate-700 rounded"
                        >
                          <Copy className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                      {/* Account Number */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-500 text-xs">Account No: </span>
                          <span className="text-white text-sm font-mono">{req.account_number}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(req.account_number, 'Account Number')}
                          className="p-1.5 hover:bg-slate-700 rounded"
                        >
                          <Copy className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                      {/* IFSC */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-500 text-xs">IFSC: </span>
                          <span className="text-white text-sm font-mono">{req.ifsc_code}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(req.ifsc_code, 'IFSC')}
                          className="p-1.5 hover:bg-slate-700 rounded"
                        >
                          <Copy className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                      {/* Amount */}
                      <div className="flex items-center justify-between bg-emerald-900/30 -mx-3 px-3 py-2 rounded-b-lg border-t border-emerald-500/20">
                        <div>
                          <span className="text-slate-500 text-xs">Amount: </span>
                          <span className="text-emerald-400 font-bold">₹{req.withdrawal_amount?.toLocaleString()}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(req.withdrawal_amount?.toString(), 'Amount')}
                          className="p-1.5 hover:bg-emerald-800/50 rounded"
                        >
                          <Copy className="w-4 h-4 text-emerald-400" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-slate-500 text-xs">Bank</p>
                        <p className="text-white text-sm">{req.bank_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 text-xs">PRC Deducted</p>
                        <p className="text-slate-300 text-sm">{req.prc_deducted?.toLocaleString()} PRC</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>{req.request_id}</span>
                      <span>{new Date(req.created_at).toLocaleString('en-IN')}</span>
                    </div>
                    
                    {req.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => openActionModal(req, 'paid')}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Mark Paid
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openActionModal(req, 'failed')}
                          variant="outline"
                          className="flex-1 border-red-500 text-red-400"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Mark Failed
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-slate-700">
                <p className="text-slate-400 text-sm">
                  Showing {requests.length} of {totalItems} requests
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="border-slate-600 text-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-4 py-2 text-slate-300">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="border-slate-600 text-slate-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Action Modal */}
      {showActionModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-slate-800 border-slate-700 max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {actionType === 'paid' ? 'Mark as Paid' : 'Mark as Failed'}
              </h2>
              
              {/* Request Details with Copy Buttons */}
              <div className="bg-slate-900 rounded-lg p-4 mb-4 space-y-3">
                {/* User Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-xs">User</p>
                    <p className="text-white">{selectedRequest.user_name}</p>
                  </div>
                </div>
                
                {/* Account Holder Name */}
                <div className="flex items-center justify-between bg-slate-800 px-3 py-2 rounded">
                  <div>
                    <p className="text-slate-500 text-xs">Account Holder Name</p>
                    <p className="text-white font-medium">{selectedRequest.account_holder_name || selectedRequest.user_name}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedRequest.account_holder_name || selectedRequest.user_name, 'Name')}
                    className="p-2 hover:bg-slate-700 rounded"
                    title="Copy Name"
                  >
                    <Copy className="w-4 h-4 text-slate-400 hover:text-emerald-400" />
                  </button>
                </div>
                
                {/* Account Number */}
                <div className="flex items-center justify-between bg-slate-800 px-3 py-2 rounded">
                  <div>
                    <p className="text-slate-500 text-xs">Account Number</p>
                    <p className="text-white font-mono text-lg">{selectedRequest.account_number}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedRequest.account_number, 'Account Number')}
                    className="p-2 hover:bg-slate-700 rounded"
                    title="Copy Account Number"
                  >
                    <Copy className="w-4 h-4 text-slate-400 hover:text-emerald-400" />
                  </button>
                </div>
                
                {/* IFSC Code */}
                <div className="flex items-center justify-between bg-slate-800 px-3 py-2 rounded">
                  <div>
                    <p className="text-slate-500 text-xs">IFSC Code</p>
                    <p className="text-white font-mono text-lg">{selectedRequest.ifsc_code}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedRequest.ifsc_code, 'IFSC')}
                    className="p-2 hover:bg-slate-700 rounded"
                    title="Copy IFSC"
                  >
                    <Copy className="w-4 h-4 text-slate-400 hover:text-emerald-400" />
                  </button>
                </div>
                
                {/* Amount */}
                <div className="flex items-center justify-between bg-emerald-900/30 px-3 py-2 rounded border border-emerald-500/30">
                  <div>
                    <p className="text-slate-500 text-xs">Amount to Transfer</p>
                    <p className="text-emerald-400 font-bold text-xl">₹{selectedRequest.withdrawal_amount?.toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedRequest.withdrawal_amount?.toString(), 'Amount')}
                    className="p-2 hover:bg-emerald-800/50 rounded"
                    title="Copy Amount"
                  >
                    <Copy className="w-4 h-4 text-emerald-400 hover:text-emerald-300" />
                  </button>
                </div>
                
                {/* Bank Name */}
                <div className="text-center pt-2">
                  <p className="text-slate-400 text-sm">{selectedRequest.bank_name}</p>
                </div>
                
                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700">
                  <div className="bg-slate-800 px-3 py-2 rounded">
                    <p className="text-slate-500 text-xs flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Created
                    </p>
                    <p className="text-white text-sm">
                      {new Date(selectedRequest.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-slate-400 text-xs">
                      {new Date(selectedRequest.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>
                  {selectedRequest.processed_at ? (
                    <div className={`px-3 py-2 rounded ${selectedRequest.status === 'paid' ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                      <p className={`text-xs flex items-center gap-1 ${selectedRequest.status === 'paid' ? 'text-green-500' : 'text-red-500'}`}>
                        <Calendar className="w-3 h-3" /> {selectedRequest.status === 'paid' ? 'Paid' : 'Failed'}
                      </p>
                      <p className="text-white text-sm">
                        {new Date(selectedRequest.processed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {new Date(selectedRequest.processed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-yellow-900/30 px-3 py-2 rounded">
                      <p className="text-yellow-500 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Status
                      </p>
                      <p className="text-yellow-400 text-sm font-medium">Pending</p>
                      <p className="text-slate-400 text-xs">Awaiting action</p>
                    </div>
                  )}
                </div>
              </div>
              
              {actionType === 'paid' ? (
                <>
                  <div className="mb-4">
                    <label className="block text-slate-300 text-sm mb-2">UTR Number *</label>
                    <Input
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="Enter UTR/Transaction Reference"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-slate-300 text-sm mb-2">Remark (Optional)</label>
                    <Input
                      value={actionRemark}
                      onChange={(e) => setActionRemark(e.target.value)}
                      placeholder="Payment completed via NEFT/IMPS"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                      <div>
                        <p className="text-red-400 font-medium">PRC will be refunded</p>
                        <p className="text-red-400/80 text-sm">
                          {selectedRequest.prc_deducted?.toLocaleString()} PRC will be credited back to user's account.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-slate-300 text-sm mb-2">Reason for Failure *</label>
                    <Input
                      value={actionRemark}
                      onChange={(e) => setActionRemark(e.target.value)}
                      placeholder="e.g., Invalid account number, Bank rejected"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                </>
              )}
              
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowActionModal(false)}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300"
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAction}
                  disabled={processing || (actionType === 'paid' && !utrNumber.trim())}
                  className={`flex-1 ${
                    actionType === 'paid'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : actionType === 'paid' ? (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  {actionType === 'paid' ? 'Confirm Paid' : 'Confirm Failed'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminBankTransfers;
