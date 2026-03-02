import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  ArrowLeft, Search, Filter, RefreshCw, CheckCircle, XCircle, Clock,
  Smartphone, Tv, Zap, Flame, Building, Banknote, ChevronLeft, ChevronRight,
  AlertCircle, Eye, Loader2, Calendar, IndianRupee, User, FileText,
  X, SlidersHorizontal, Wallet, Play
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Service Icons
const SERVICE_ICONS = {
  mobile_recharge: Smartphone,
  dth: Tv,
  electricity: Zap,
  gas: Flame,
  emi: Building,
  dmt: Banknote
};

// Tab configuration
const TABS = [
  { id: 'active', label: 'Active Requests', statuses: ['pending', 'approved', 'processing'], color: 'amber' },
  { id: 'completed', label: 'Completed', statuses: ['completed'], color: 'green' },
  { id: 'failed', label: 'Failed', statuses: ['failed'], color: 'red' },
  { id: 'rejected', label: 'Rejected', statuses: ['rejected'], color: 'orange' }
];

const AdminRedeemDashboard = ({ user }) => {
  const navigate = useNavigate();
  
  // States
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [ekoBalance, setEkoBalance] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, per_page: 20, total_pages: 0 });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // New: Active tab state
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    service_type: '',
    search: '',
    date_from: '',
    date_to: '',
    min_amount: '',
    max_amount: '',
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  
  // Rejection reason
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // Completion details
  const [completionData, setCompletionData] = useState({ eko_tid: '', utr_number: '', notes: '' });
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  
  // Fetch data
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('per_page', pagination.per_page.toString());
      
      // Tab-based status filtering
      const currentTab = TABS.find(t => t.id === activeTab);
      if (currentTab && currentTab.statuses.length > 0) {
        // For active tab, we fetch multiple statuses
        if (activeTab === 'active') {
          params.append('status', 'pending,approved,processing');
        } else {
          params.append('status', currentTab.statuses[0]);
        }
      }
      
      // Additional filters
      if (filters.service_type) params.append('service_type', filters.service_type);
      if (filters.search) params.append('search', filters.search);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.min_amount) params.append('min_amount', filters.min_amount);
      if (filters.max_amount) params.append('max_amount', filters.max_amount);
      params.append('sort_by', filters.sort_by);
      params.append('sort_order', filters.sort_order);
      
      const response = await axios.get(`${API}/redeem/admin/requests?${params.toString()}`);
      setRequests(response.data.requests || []);
      setPagination(response.data.pagination || pagination);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.per_page, activeTab]);
  
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/redeem/admin/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };
  
  const fetchEkoBalance = async () => {
    try {
      const response = await axios.get(`${API}/redeem/admin/eko-balance`);
      setEkoBalance(response.data);
    } catch (error) {
      console.error('Error fetching Eko balance:', error);
      setEkoBalance({ success: false, balance: 0, error: 'Failed to fetch' });
    }
  };
  
  useEffect(() => {
    fetchRequests();
    fetchStats();
    fetchEkoBalance();
  }, [fetchRequests]);
  
  // Handle tab change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setPagination(prev => ({ ...prev, page: 1 }));
  };
  
  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };
  
  const clearFilters = () => {
    setFilters({
      status: '',
      service_type: '',
      search: '',
      date_from: '',
      date_to: '',
      min_amount: '',
      max_amount: '',
      sort_by: 'created_at',
      sort_order: 'desc'
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };
  
  // Handle approve
  const handleApprove = async (requestId) => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/redeem/admin/approve`, {
        request_id: requestId,
        admin_id: user.uid,
        action: 'approve'
      });
      toast.success('Request approved successfully');
      fetchRequests();
      fetchStats();
      setSelectedRequest(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };
  
  // Handle reject
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please enter rejection reason');
      return;
    }
    
    setActionLoading(true);
    try {
      await axios.post(`${API}/redeem/admin/approve`, {
        request_id: selectedRequest.request_id,
        admin_id: user.uid,
        action: 'reject',
        rejection_reason: rejectionReason
      });
      toast.success('Request rejected. PRC refunded to user.');
      fetchRequests();
      fetchStats();
      setSelectedRequest(null);
      setShowRejectModal(false);
      setRejectionReason('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };
  
  // Handle complete - This actually executes Eko API
  const handleComplete = async () => {
    setActionLoading(true);
    try {
      const response = await axios.post(`${API}/redeem/admin/complete`, {
        request_id: selectedRequest.request_id,
        admin_id: user.uid,
        eko_tid: completionData.eko_tid,
        utr_number: completionData.utr_number,
        completion_notes: completionData.notes
      });
      
      if (response.data.success) {
        toast.success(response.data.message || 'Transaction completed successfully!');
        if (response.data.eko_tid) {
          toast.info(`Eko TID: ${response.data.eko_tid}`);
        }
      } else {
        toast.error(response.data.message || 'Transaction failed');
        if (response.data.refund_amount) {
          toast.info(`${response.data.refund_amount} PRC refunded to user`);
        }
      }
      
      fetchRequests();
      fetchStats();
      fetchEkoBalance(); // Refresh Eko balance after transaction
      setSelectedRequest(null);
      setShowCompleteModal(false);
      setCompletionData({ eko_tid: '', utr_number: '', notes: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Failed to process');
    } finally {
      setActionLoading(false);
    }
  };
  
  // Handle Check Status for processing transactions
  const handleCheckStatus = async (requestId) => {
    setActionLoading(true);
    try {
      const response = await axios.post(`${API}/redeem/admin/check-status/${requestId}?admin_id=${user.uid}`);
      
      if (response.data.success) {
        if (response.data.status === 'completed') {
          toast.success('Transaction completed successfully!');
        } else if (response.data.status === 'processing') {
          toast.info('Transaction still processing. Check again later.');
        }
      } else {
        toast.error(response.data.message || 'Status check failed');
        if (response.data.refund_amount) {
          toast.info(`${response.data.refund_amount} PRC refunded to user`);
        }
      }
      
      fetchRequests();
      fetchStats();
      fetchEkoBalance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to check status');
    } finally {
      setActionLoading(false);
    }
  };
  
  // Handle Manual Refund
  const handleManualRefund = async (requestId) => {
    if (!confirm('⚠️ Manual Refund?\n\nThis will refund PRC to user and mark request as failed.\n\nAre you sure?')) {
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await axios.post(
        `${API}/redeem/admin/manual-refund/${requestId}?admin_id=${user.uid}&reason=Manual refund by admin`
      );
      
      if (response.data.success) {
        toast.success(`${response.data.refund_amount} PRC refunded successfully`);
      } else {
        toast.error(response.data.message || 'Refund failed');
      }
      
      fetchRequests();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to refund');
    } finally {
      setActionLoading(false);
    }
  };
  
  // Status badge
  const getStatusBadge = (status) => {
    const config = {
      pending: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
      approved: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: CheckCircle },
      processing: { color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: RefreshCw },
      completed: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
      failed: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
      rejected: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle }
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.color}`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  // Active filters count
  const activeFiltersCount = Object.values(filters).filter(v => v && v !== 'created_at' && v !== 'desc').length;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 pb-24 pt-16">
      <div className="container mx-auto px-4 max-w-7xl pt-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/admin')}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 flex items-center justify-center hover:border-amber-500/50 transition-all"
          >
            <ArrowLeft className="h-5 w-5 text-gray-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-amber-100 to-amber-200 bg-clip-text text-transparent">
              Redeem Requests
            </h1>
            <p className="text-gray-400 text-sm">Manage all user redeem requests</p>
          </div>
          <Button
            onClick={() => { fetchRequests(); fetchStats(); fetchEkoBalance(); }}
            variant="outline"
            className="border-gray-700 text-gray-400 hover:text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        {/* Eko Balance Card */}
        <div className="mb-6 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-green-300/70 text-xs uppercase">Eko Wallet Balance</p>
                {ekoBalance ? (
                  ekoBalance.success ? (
                    <p className="text-2xl font-bold text-green-400">₹{(ekoBalance.balance || 0).toLocaleString()}</p>
                  ) : (
                    <p className="text-red-400 text-sm">{ekoBalance.error || 'Failed to fetch'}</p>
                  )
                ) : (
                  <Loader2 className="h-5 w-5 text-green-400 animate-spin" />
                )}
              </div>
            </div>
            {ekoBalance?.locked_amount > 0 && (
              <div className="text-right">
                <p className="text-gray-500 text-xs">Locked Amount</p>
                <p className="text-yellow-400 font-semibold">₹{ekoBalance.locked_amount.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Tabs Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {TABS.map((tab) => {
            // Calculate count for each tab
            let tabCount = 0;
            if (stats?.by_status) {
              tab.statuses.forEach(status => {
                tabCount += stats.by_status[status]?.count || 0;
              });
            }
            
            const isActive = activeTab === tab.id;
            const colorClasses = {
              amber: isActive ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'hover:border-amber-500/30',
              green: isActive ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'hover:border-green-500/30',
              red: isActive ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'hover:border-red-500/30',
              orange: isActive ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'hover:border-orange-500/30'
            };
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all whitespace-nowrap ${
                  isActive 
                    ? colorClasses[tab.color]
                    : `bg-gray-900/50 border-gray-800/50 text-gray-400 ${colorClasses[tab.color]}`
                }`}
              >
                <span className="font-medium">{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  isActive 
                    ? `bg-${tab.color}-500/30` 
                    : 'bg-gray-700/50'
                }`}>
                  {tabCount}
                </span>
              </button>
            );
          })}
        </div>
        
        {/* Quick Stats Row */}
        {stats && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
            {[
              { key: 'pending', label: 'Pending', color: 'yellow', icon: Clock },
              { key: 'approved', label: 'Approved', color: 'blue', icon: CheckCircle },
              { key: 'processing', label: 'Processing', color: 'cyan', icon: RefreshCw },
              { key: 'completed', label: 'Completed', color: 'green', icon: CheckCircle },
              { key: 'rejected', label: 'Rejected', color: 'orange', icon: XCircle },
              { key: 'failed', label: 'Failed', color: 'red', icon: XCircle }
            ].map(({ key, label, color, icon: Icon }) => (
              <div
                key={key}
                className="p-3 rounded-xl bg-gray-900/30 border border-gray-800/30"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 text-${color}-400`} />
                  <span className={`text-lg font-bold text-${color}-400`}>
                    {stats.by_status?.[key]?.count || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}
        
        {/* Filters Section */}
        <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-3xl p-6 border border-gray-800/50 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="bg-amber-500 text-black text-xs px-2 py-0.5 rounded-full font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
              
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear All
                </button>
              )}
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search ID, Name, Mobile..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10 w-64 h-10 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
              />
            </div>
          </div>
          
          {/* Expanded Filters */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4 border-t border-gray-800">
              {/* Service Type */}
              <div>
                <Label className="text-gray-400 text-xs mb-1.5 block">Service Type</Label>
                <select
                  value={filters.service_type}
                  onChange={(e) => handleFilterChange('service_type', e.target.value)}
                  className="w-full h-10 px-3 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl text-sm"
                >
                  <option value="">All Services</option>
                  <option value="mobile_recharge">Mobile Recharge</option>
                  <option value="dth">DTH</option>
                  <option value="electricity">Electricity</option>
                  <option value="gas">Gas</option>
                  <option value="emi">EMI</option>
                  <option value="dmt">Bank Transfer</option>
                </select>
              </div>
              
              {/* Date From */}
              <div>
                <Label className="text-gray-400 text-xs mb-1.5 block">Date From</Label>
                <Input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => handleFilterChange('date_from', e.target.value)}
                  className="h-10 bg-gray-800/50 border-gray-700/50 text-white rounded-xl text-sm"
                />
              </div>
              
              {/* Date To */}
              <div>
                <Label className="text-gray-400 text-xs mb-1.5 block">Date To</Label>
                <Input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => handleFilterChange('date_to', e.target.value)}
                  className="h-10 bg-gray-800/50 border-gray-700/50 text-white rounded-xl text-sm"
                />
              </div>
              
              {/* Min Amount */}
              <div>
                <Label className="text-gray-400 text-xs mb-1.5 block">Min Amount</Label>
                <Input
                  type="number"
                  placeholder="₹0"
                  value={filters.min_amount}
                  onChange={(e) => handleFilterChange('min_amount', e.target.value)}
                  className="h-10 bg-gray-800/50 border-gray-700/50 text-white rounded-xl text-sm"
                />
              </div>
              
              {/* Max Amount */}
              <div>
                <Label className="text-gray-400 text-xs mb-1.5 block">Max Amount</Label>
                <Input
                  type="number"
                  placeholder="₹99999"
                  value={filters.max_amount}
                  onChange={(e) => handleFilterChange('max_amount', e.target.value)}
                  className="h-10 bg-gray-800/50 border-gray-700/50 text-white rounded-xl text-sm"
                />
              </div>
              
              {/* Sort */}
              <div>
                <Label className="text-gray-400 text-xs mb-1.5 block">Sort By</Label>
                <select
                  value={`${filters.sort_by}-${filters.sort_order}`}
                  onChange={(e) => {
                    const [sortBy, sortOrder] = e.target.value.split('-');
                    setFilters(prev => ({ ...prev, sort_by: sortBy, sort_order: sortOrder }));
                  }}
                  className="w-full h-10 px-3 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl text-sm"
                >
                  <option value="created_at-desc">Newest First</option>
                  <option value="created_at-asc">Oldest First</option>
                  <option value="amount_inr-desc">Amount: High to Low</option>
                  <option value="amount_inr-asc">Amount: Low to High</option>
                </select>
              </div>
            </div>
          )}
        </div>
        
        {/* Requests Table */}
        <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-3xl border border-gray-800/50 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">No requests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr className="text-left text-xs text-gray-400 uppercase">
                    <th className="px-4 py-3">Request ID</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {requests.map(req => {
                    const ServiceIcon = SERVICE_ICONS[req.service_type] || Smartphone;
                    return (
                      <tr key={req.request_id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-amber-400 font-mono text-sm">{req.request_id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white text-sm font-medium">{req.user_name || 'Unknown'}</p>
                            <p className="text-gray-500 text-xs">{req.user_mobile}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ServiceIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-white text-sm">{req.service_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white font-semibold">₹{req.amount_inr}</p>
                            <p className="text-gray-500 text-xs">{req.total_prc_deducted} PRC</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(req.status)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-400 text-sm">
                            {new Date(req.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                          <p className="text-gray-600 text-xs">
                            {new Date(req.created_at).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedRequest(req)}
                              className="text-gray-400 hover:text-white"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {req.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(req.request_id)}
                                  className="bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                  disabled={actionLoading}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => { setSelectedRequest(req); setShowRejectModal(true); }}
                                  className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            
                            {req.status === 'approved' && (
                              <Button
                                size="sm"
                                onClick={() => { setSelectedRequest(req); setShowCompleteModal(true); }}
                                className="bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Execute
                              </Button>
                            )}
                            
                            {req.status === 'processing' && (
                              <Button
                                size="sm"
                                onClick={() => handleCheckStatus(req.request_id)}
                                className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                                disabled={actionLoading}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {(req.status === 'processing' || req.status === 'failed') && !req.prc_refunded && (
                              <Button
                                size="sm"
                                onClick={() => handleManualRefund(req.request_id)}
                                className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                                disabled={actionLoading}
                                title="Manual Refund"
                              >
                                <IndianRupee className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/50">
              <p className="text-gray-500 text-sm">
                Showing {((pagination.page - 1) * pagination.per_page) + 1} to {Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={!pagination.has_prev}
                  className="border-gray-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <span className="text-gray-400 text-sm px-3">
                  Page {pagination.page} of {pagination.total_pages}
                </span>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={!pagination.has_next}
                  className="border-gray-700"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Request Details Modal */}
      {selectedRequest && !showRejectModal && !showCompleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl border border-gray-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Request Details</h3>
              <button onClick={() => setSelectedRequest(null)} className="text-gray-400 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-xs uppercase">Request ID</p>
                  <p className="text-amber-400 font-mono">{selectedRequest.request_id}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase">Status</p>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase">User</p>
                  <p className="text-white">{selectedRequest.user_name}</p>
                  <p className="text-gray-500 text-sm">{selectedRequest.user_mobile}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase">Service</p>
                  <p className="text-white">{selectedRequest.service_name}</p>
                </div>
              </div>
              
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-500 text-xs uppercase mb-2">Charges Breakdown</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount</span>
                    <span className="text-white">₹{selectedRequest.amount_inr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Platform Fee</span>
                    <span className="text-orange-400">+₹{selectedRequest.charges?.platform_fee_inr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Admin Charges (20%)</span>
                    <span className="text-orange-400">+₹{selectedRequest.charges?.admin_charge_inr}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-700">
                    <span className="text-amber-400 font-bold">Total PRC Deducted</span>
                    <span className="text-amber-400 font-bold">{selectedRequest.total_prc_deducted} PRC</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-500 text-xs uppercase mb-2">Service Details</p>
                <div className="space-y-2 text-sm">
                  {Object.entries(selectedRequest.details || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {selectedRequest.rejection_reason && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-400 text-xs uppercase mb-1">Rejection Reason</p>
                  <p className="text-white">{selectedRequest.rejection_reason}</p>
                </div>
              )}
              
              {selectedRequest.eko_tid && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <p className="text-green-400 text-xs uppercase mb-1">Eko Transaction ID</p>
                  <p className="text-white font-mono">{selectedRequest.eko_tid}</p>
                  {selectedRequest.utr_number && (
                    <>
                      <p className="text-green-400 text-xs uppercase mt-2 mb-1">UTR Number</p>
                      <p className="text-white font-mono">{selectedRequest.utr_number}</p>
                    </>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
              {selectedRequest.status === 'pending' && (
                <>
                  <Button
                    onClick={() => setShowRejectModal(true)}
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleApprove(selectedRequest.request_id)}
                    disabled={actionLoading}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Approve
                  </Button>
                </>
              )}
              {selectedRequest.status === 'approved' && (
                <Button
                  onClick={() => setShowCompleteModal(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Mark as Completed
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl border border-gray-800 w-full max-w-md">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">Reject Request</h3>
              <p className="text-gray-500 text-sm">PRC will be refunded to user</p>
            </div>
            
            <div className="p-6">
              <Label className="text-gray-300 text-sm mb-2 block">Rejection Reason *</Label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={4}
                className="w-full p-3 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl resize-none"
              />
            </div>
            
            <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}
                className="border-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Reject & Refund
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Complete Modal - Execute Eko Transaction */}
      {showCompleteModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl border border-gray-800 w-full max-w-md">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Play className="h-5 w-5 text-green-400" />
                Execute Eko Transaction
              </h3>
              <p className="text-gray-500 text-sm">This will call Eko API to process the payment</p>
            </div>
            
            {/* Request Summary */}
            <div className="p-4 m-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <p className="text-amber-400 text-sm font-medium">{selectedRequest.service_name}</p>
              <p className="text-white text-xl font-bold">₹{selectedRequest.amount_inr}</p>
              <p className="text-gray-400 text-xs">{selectedRequest.request_id}</p>
            </div>
            
            <div className="px-6 pb-6 space-y-4">
              <div>
                <Label className="text-gray-300 text-sm mb-2 block">Notes (Optional)</Label>
                <textarea
                  value={completionData.notes}
                  onChange={(e) => setCompletionData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full p-3 bg-gray-800/50 border border-gray-700/50 text-white rounded-xl resize-none"
                />
              </div>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                <p className="text-blue-400 text-xs">
                  <AlertCircle className="inline h-3 w-3 mr-1" />
                  Eko API will be called. If failed, PRC will be auto-refunded.
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => { setShowCompleteModal(false); setCompletionData({ eko_tid: '', utr_number: '', notes: '' }); }}
                className="border-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleComplete}
                disabled={actionLoading}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Execute & Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRedeemDashboard;
