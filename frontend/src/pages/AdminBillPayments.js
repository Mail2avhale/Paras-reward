import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import Pagination from '@/components/Pagination';
import { 
  ArrowLeft, Clock, CheckCircle, XCircle, Search, Filter, 
  RefreshCw, Loader2, Phone, Zap, Tv, Droplet, CreditCard,
  Eye, User, Calendar, TrendingUp, IndianRupee, Building,
  ChevronDown, Download, MoreVertical, AlertTriangle
} from 'lucide-react';
import RequestTimeline, { SLABadge } from '../components/RequestTimeline';

const API = process.env.REACT_APP_BACKEND_URL || '';
const ITEMS_PER_PAGE = 15;
const AUTO_REFRESH_INTERVAL = 30000;

const AdminBillPayments = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, completed: 0, rejected: 0, processing: 0 });
  const [activeTab, setActiveTab] = useState('pending');
  const [timeFilter, setTimeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [sortBy, setSortBy] = useState('newest'); // Sort option

  // Sort options
  const sortOptions = [
    { id: 'newest', label: 'Newest First' },
    { id: 'oldest', label: 'Oldest First' },
    { id: 'amount_high', label: 'Amount: High to Low' },
    { id: 'amount_low', label: 'Amount: Low to High' },
  ];

  // Time filter options
  const timeFilters = [
    { id: 'today', label: 'Today', icon: '📅' },
    { id: 'week', label: 'This Week', icon: '📆' },
    { id: 'month', label: 'This Month', icon: '🗓️' },
    { id: 'all', label: 'All Time', icon: '♾️' }
  ];

  // Status tabs configuration
  const statusTabs = [
    { id: 'pending', label: 'Pending', color: 'yellow', icon: Clock },
    { id: 'processing', label: 'Approved', color: 'blue', icon: RefreshCw },
    { id: 'completed', label: 'Completed', color: 'green', icon: CheckCircle },
    { id: 'rejected', label: 'Rejected', color: 'red', icon: XCircle },
  ];

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/admin/bill-payment/requests`);
      setRequests(response.data.requests || response.data || []);
      
      // Calculate stats
      const allReqs = response.data.requests || response.data || [];
      const newStats = {
        pending: allReqs.filter(r => r.status === 'pending').length,
        processing: allReqs.filter(r => r.status === 'processing' || r.status === 'approved').length,
        completed: allReqs.filter(r => r.status === 'completed').length,
        rejected: allReqs.filter(r => r.status === 'rejected').length,
      };
      setStats(newStats);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin');
      return;
    }
    fetchRequests();
  }, [user, navigate, fetchRequests]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchRequests, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchRequests]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, timeFilter, searchTerm]);

  // Filter and sort requests
  const filteredRequests = useMemo(() => {
    let filtered = [...requests];
    
    // Filter by status tab
    if (activeTab === 'processing') {
      filtered = filtered.filter(r => r.status === 'processing' || r.status === 'approved');
    } else {
      filtered = filtered.filter(r => r.status === activeTab);
    }
    
    // Filter by time
    const now = new Date();
    if (timeFilter === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(r => new Date(r.created_at) >= todayStart);
    } else if (timeFilter === 'week') {
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(r => new Date(r.created_at) >= weekStart);
    } else if (timeFilter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter(r => new Date(r.created_at) >= monthStart);
    }
    
    // Filter by search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        (r.user_name || '').toLowerCase().includes(search) ||
        (r.user_email || '').toLowerCase().includes(search) ||
        (r.request_id || '').toLowerCase().includes(search) ||
        (r.details?.phone_number || '').includes(search)
      );
    }
    
    // Sort based on sortBy option
    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (sortBy === 'amount_high') {
      filtered.sort((a, b) => (b.amount_inr || 0) - (a.amount_inr || 0));
    } else if (sortBy === 'amount_low') {
      filtered.sort((a, b) => (a.amount_inr || 0) - (b.amount_inr || 0));
    }
    
    return filtered;
  }, [requests, activeTab, timeFilter, searchTerm, sortBy]);

  // Calculate time-filtered stats
  const timeFilteredStats = useMemo(() => {
    let filtered = [...requests];
    const now = new Date();
    
    if (timeFilter === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(r => new Date(r.created_at) >= todayStart);
    } else if (timeFilter === 'week') {
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(r => new Date(r.created_at) >= weekStart);
    } else if (timeFilter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter(r => new Date(r.created_at) >= monthStart);
    }
    
    return {
      pending: filtered.filter(r => r.status === 'pending').length,
      pendingAmount: filtered.filter(r => r.status === 'pending').reduce((sum, r) => sum + (r.amount_inr || 0), 0),
      processing: filtered.filter(r => r.status === 'processing' || r.status === 'approved').length,
      processingAmount: filtered.filter(r => r.status === 'processing' || r.status === 'approved').reduce((sum, r) => sum + (r.amount_inr || 0), 0),
      completed: filtered.filter(r => r.status === 'completed').length,
      completedAmount: filtered.filter(r => r.status === 'completed').reduce((sum, r) => sum + (r.amount_inr || 0), 0),
      rejected: filtered.filter(r => r.status === 'rejected').length,
      totalAmount: filtered.reduce((sum, r) => sum + (r.amount_inr || 0), 0)
    };
  }, [requests, timeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleProcess = async (requestId, action) => {
    setProcessing(true);
    try {
      await axios.post(`${API}/api/admin/bill-payment/process`, {
        request_id: requestId,
        action,
        admin_notes: adminNotes,
        admin_uid: user.uid
      });

      const actionText = action === 'reject' ? 'rejected' : action === 'approve' ? 'approved' : 'completed';
      toast.success(`Request ${actionText} successfully!`);
      setSelectedRequest(null);
      setAdminNotes('');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process request');
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickApprove = async (req, e) => {
    e.stopPropagation();
    if (!window.confirm(`Approve bill payment of ₹${req.amount_inr} for ${req.user_name || req.user_id}?`)) return;
    
    try {
      setProcessing(true);
      await axios.post(`${API}/api/admin/bill-payment/process`, {
        request_id: req.request_id,
        action: 'approve',
        admin_uid: user.uid
      });
      toast.success('Request approved!');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickReject = async (req, e) => {
    e.stopPropagation();
    const reason = window.prompt('Rejection reason:');
    if (reason === null) return;
    
    try {
      setProcessing(true);
      await axios.post(`${API}/api/admin/bill-payment/process`, {
        request_id: req.request_id,
        action: 'reject',
        admin_notes: reason,
        admin_uid: user.uid
      });
      toast.success('Request rejected');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkComplete = async (req, e) => {
    e.stopPropagation();
    if (!window.confirm(`Mark request as completed for ${req.user_name}?`)) return;
    
    try {
      setProcessing(true);
      await axios.post(`${API}/api/admin/bill-payment/process`, {
        request_id: req.request_id,
        action: 'complete',
        admin_uid: user.uid
      });
      toast.success('Marked as completed!');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete');
    } finally {
      setProcessing(false);
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      mobile_recharge: <Phone className="w-4 h-4 text-blue-400" />,
      dish_recharge: <Tv className="w-4 h-4 text-purple-400" />,
      electricity_bill: <Zap className="w-4 h-4 text-yellow-400" />,
      credit_card_payment: <CreditCard className="w-4 h-4 text-orange-400" />,
      loan_emi: <Building className="w-4 h-4 text-cyan-400" />,
    };
    return icons[type] || <CreditCard className="w-4 h-4 text-gray-400" />;
  };

  const getTypeLabel = (type) => {
    const labels = {
      mobile_recharge: 'Mobile Recharge',
      dish_recharge: 'DTH Recharge',
      electricity_bill: 'Electricity',
      credit_card_payment: 'Credit Card',
      loan_emi: 'Loan EMI',
    };
    return labels[type] || type;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // If less than 24 hours, show relative time
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours < 1) {
        const mins = Math.floor(diff / (60 * 1000));
        return `${mins}m ago`;
      }
      return `${hours}h ago`;
    }
    
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTabCount = (tabId) => {
    if (tabId === 'processing') return timeFilteredStats.processing;
    return timeFilteredStats[tabId] || 0;
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-950 border-b border-gray-800 sticky top-0 z-10">
        <div className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-green-400" />
                  Bill Payment Requests
                </h1>
                <p className="text-gray-500 text-xs">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={fetchRequests} variant="outline" size="sm" disabled={loading} className="border-gray-700 text-gray-300">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-600 w-3 h-3"
                />
                Auto
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Summary Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-3 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-yellow-400 text-xs font-medium">Pending</p>
                <p className="text-2xl font-bold text-yellow-300">{timeFilteredStats.pending}</p>
                <p className="text-yellow-500 text-xs">₹{timeFilteredStats.pendingAmount.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <RefreshCw className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-blue-400 text-xs font-medium">Approved</p>
                <p className="text-2xl font-bold text-blue-300">{timeFilteredStats.processing}</p>
                <p className="text-blue-500 text-xs">₹{timeFilteredStats.processingAmount.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-green-400 text-xs font-medium">Completed</p>
                <p className="text-2xl font-bold text-green-300">{timeFilteredStats.completed}</p>
                <p className="text-green-500 text-xs">₹{timeFilteredStats.completedAmount.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-red-400 text-xs font-medium">Rejected</p>
                <p className="text-2xl font-bold text-red-300">{timeFilteredStats.rejected}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 col-span-2 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <IndianRupee className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-purple-400 text-xs font-medium">Total Value</p>
                <p className="text-2xl font-bold text-purple-300">₹{timeFilteredStats.totalAmount.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* Time Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {timeFilters.map(tf => (
              <button
                key={tf.id}
                onClick={() => setTimeFilter(tf.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  timeFilter === tf.id
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="mr-2">{tf.icon}</span>
                {tf.label}
              </button>
            ))}
          </div>
          
          {/* Search and Sort */}
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search by name, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-900/50 border-gray-800 text-white placeholder:text-gray-500"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
            >
              {sortOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 bg-gray-900/50 border border-gray-800 p-1 rounded-xl">
            {statusTabs.map(tab => {
              const Icon = tab.icon;
              const count = getTabCount(tab.id);
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`flex items-center gap-2 py-3 rounded-lg data-[state=active]:shadow-lg transition-all
                    ${tab.id === 'pending' ? 'data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400' : ''}
                    ${tab.id === 'processing' ? 'data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400' : ''}
                    ${tab.id === 'completed' ? 'data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400' : ''}
                    ${tab.id === 'rejected' ? 'data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400' : ''}
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    activeTab === tab.id 
                      ? `bg-${tab.color}-500/30` 
                      : 'bg-gray-800'
                  }`}>
                    {count}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Requests List - Same content for all tabs, filtered by state */}
          <div className="mt-4">
            {loading && paginatedRequests.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : paginatedRequests.length === 0 ? (
              <Card className="p-12 bg-gray-900/30 border-gray-800 text-center">
                <div className="text-gray-500">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No {activeTab} requests</p>
                  <p className="text-sm mt-1">
                    {timeFilter !== 'all' && `for ${timeFilters.find(t => t.id === timeFilter)?.label.toLowerCase()}`}
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {paginatedRequests.map((req) => (
                  <Card 
                    key={req.request_id}
                    className={`p-4 bg-gray-900/50 border-gray-800 hover:bg-gray-900/80 transition-all cursor-pointer ${
                      selectedRequest?.request_id === req.request_id ? 'ring-2 ring-purple-500' : ''
                    }`}
                    onClick={() => setSelectedRequest(selectedRequest?.request_id === req.request_id ? null : req)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Type & User Info */}
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`p-3 rounded-xl ${
                          req.status === 'pending' ? 'bg-yellow-500/10' :
                          req.status === 'processing' || req.status === 'approved' ? 'bg-blue-500/10' :
                          req.status === 'completed' ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}>
                          {getTypeIcon(req.request_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white truncate">{req.user_name || 'Unknown User'}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${
                              req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                              req.status === 'processing' || req.status === 'approved' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                              req.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 
                              'bg-red-500/10 text-red-400 border-red-500/30'
                            }`}>
                              {req.status === 'processing' ? 'Approved' : req.status}
                            </span>
                          </div>
                          <p className="text-gray-500 text-sm truncate">{getTypeLabel(req.request_type)}</p>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right">
                        <p className="text-xl font-bold text-white">₹{(req.amount_inr || 0).toLocaleString()}</p>
                        <p className="text-gray-500 text-xs">{formatDate(req.created_at)}</p>
                      </div>

                      {/* Quick Actions */}
                      {req.status === 'pending' && (
                        <div className="flex gap-2 md:ml-4">
                          <Button
                            size="sm"
                            onClick={(e) => handleQuickApprove(req, e)}
                            disabled={processing}
                            className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleQuickReject(req, e)}
                            disabled={processing}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      
                      {(req.status === 'processing' || req.status === 'approved') && (
                        <Button
                          size="sm"
                          onClick={(e) => handleMarkComplete(req, e)}
                          disabled={processing}
                          className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30 md:ml-4"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Complete
                        </Button>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {selectedRequest?.request_id === req.request_id && (
                      <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Email</p>
                          <p className="text-white">{req.user_email || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Phone</p>
                          <p className="text-white">{req.details?.phone_number || req.details?.mobile_number || req.details?.registered_mobile || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">PRC Used</p>
                          <p className="text-white">{req.prc_amount?.toFixed(2) || req.total_prc_deducted?.toFixed(2) || 'N/A'} PRC</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Subscription</p>
                          <p className="text-white capitalize">{req.user_subscription_plan || 'N/A'}</p>
                        </div>
                        
                        {/* Mobile/DTH Recharge Details */}
                        {req.details?.operator && (
                          <div>
                            <p className="text-gray-500 text-xs">Operator</p>
                            <p className="text-white">{req.details.operator}</p>
                          </div>
                        )}
                        {req.details?.circle && (
                          <div>
                            <p className="text-gray-500 text-xs">Circle</p>
                            <p className="text-white">{req.details.circle}</p>
                          </div>
                        )}
                        {req.details?.plan_name && (
                          <div>
                            <p className="text-gray-500 text-xs">Plan</p>
                            <p className="text-white">{req.details.plan_name}</p>
                          </div>
                        )}
                        
                        {/* Service Provider Details */}
                        {req.details?.service_provider && (
                          <div>
                            <p className="text-gray-500 text-xs">Service Provider</p>
                            <p className="text-white">{req.details.service_provider}</p>
                          </div>
                        )}
                        {req.details?.consumer_number && (
                          <div>
                            <p className="text-gray-500 text-xs">Consumer Number</p>
                            <p className="text-white font-mono">{req.details.consumer_number}</p>
                          </div>
                        )}
                        {req.details?.customer_id && (
                          <div>
                            <p className="text-gray-500 text-xs">Customer ID</p>
                            <p className="text-white font-mono">{req.details.customer_id}</p>
                          </div>
                        )}
                        
                        {/* Bank Account Details */}
                        {req.details?.account_number && (
                          <div>
                            <p className="text-gray-500 text-xs">Account Number</p>
                            <p className="text-white font-mono">{req.details.account_number}</p>
                          </div>
                        )}
                        {req.details?.account_holder_name && (
                          <div>
                            <p className="text-gray-500 text-xs">Account Holder</p>
                            <p className="text-white">{req.details.account_holder_name}</p>
                          </div>
                        )}
                        {req.details?.bank_name && (
                          <div>
                            <p className="text-gray-500 text-xs">Bank Name</p>
                            <p className="text-white">{req.details.bank_name}</p>
                          </div>
                        )}
                        
                        {/* Loan Details */}
                        {(req.details?.loan_account_number || req.details?.loan_account) && (
                          <div>
                            <p className="text-gray-500 text-xs">Loan Account Number</p>
                            <p className="text-white font-mono">{req.details.loan_account_number || req.details.loan_account}</p>
                          </div>
                        )}
                        {req.details?.borrower_name && (
                          <div>
                            <p className="text-gray-500 text-xs">Borrower Name</p>
                            <p className="text-white">{req.details.borrower_name}</p>
                          </div>
                        )}
                        {req.details?.lender_name && (
                          <div>
                            <p className="text-gray-500 text-xs">Lender Name</p>
                            <p className="text-white">{req.details.lender_name}</p>
                          </div>
                        )}
                        {req.details?.loan_type && (
                          <div>
                            <p className="text-gray-500 text-xs">Loan Type</p>
                            <p className="text-white">{req.details.loan_type}</p>
                          </div>
                        )}
                        {req.details?.loan_tenure && (
                          <div>
                            <p className="text-gray-500 text-xs">Loan Tenure</p>
                            <p className="text-white">{req.details.loan_tenure}</p>
                          </div>
                        )}
                        {req.details?.emi_amount && (
                          <div>
                            <p className="text-gray-500 text-xs">EMI Amount</p>
                            <p className="text-white">₹{req.details.emi_amount}</p>
                          </div>
                        )}
                        {req.details?.emi_due_date && (
                          <div>
                            <p className="text-gray-500 text-xs">EMI Due Date</p>
                            <p className="text-white">{req.details.emi_due_date}</p>
                          </div>
                        )}
                        {req.details?.registered_mobile && (
                          <div>
                            <p className="text-gray-500 text-xs">Registered Mobile</p>
                            <p className="text-white">{req.details.registered_mobile}</p>
                          </div>
                        )}
                        
                        {/* Payment Details */}
                        {req.details?.ifsc_code && (
                          <div>
                            <p className="text-gray-500 text-xs">IFSC Code</p>
                            <p className="text-white font-mono">{req.details.ifsc_code}</p>
                          </div>
                        )}
                        {req.details?.upi_id && (
                          <div>
                            <p className="text-gray-500 text-xs">UPI ID</p>
                            <p className="text-white">{req.details.upi_id}</p>
                          </div>
                        )}
                        {req.details?.bill_number && (
                          <div>
                            <p className="text-gray-500 text-xs">Bill Number</p>
                            <p className="text-white font-mono">{req.details.bill_number}</p>
                          </div>
                        )}
                        {req.details?.due_date && (
                          <div>
                            <p className="text-gray-500 text-xs">Due Date</p>
                            <p className="text-white">{new Date(req.details.due_date).toLocaleDateString()}</p>
                          </div>
                        )}
                        
                        {/* Additional Service Details */}
                        {req.details?.provider && (
                          <div>
                            <p className="text-gray-500 text-xs">Provider</p>
                            <p className="text-white">{req.details.provider}</p>
                          </div>
                        )}
                        {req.details?.subscriber_id && (
                          <div>
                            <p className="text-gray-500 text-xs">Subscriber ID</p>
                            <p className="text-white font-mono">{req.details.subscriber_id}</p>
                          </div>
                        )}
                        {req.details?.billing_unit && (
                          <div>
                            <p className="text-gray-500 text-xs">Billing Unit</p>
                            <p className="text-white">{req.details.billing_unit}</p>
                          </div>
                        )}
                        {req.details?.customer_name && (
                          <div>
                            <p className="text-gray-500 text-xs">Customer Name</p>
                            <p className="text-white">{req.details.customer_name}</p>
                          </div>
                        )}
                        
                        {/* Card Details */}
                        {req.details?.cardholder_name && (
                          <div>
                            <p className="text-gray-500 text-xs">Cardholder Name</p>
                            <p className="text-white">{req.details.cardholder_name}</p>
                          </div>
                        )}
                        {req.details?.card_last_4_digits && (
                          <div>
                            <p className="text-gray-500 text-xs">Card (Last 4)</p>
                            <p className="text-white font-mono">****{req.details.card_last_4_digits}</p>
                          </div>
                        )}
                        
                        {/* Admin Notes */}
                        {req.admin_notes && (
                          <div className="col-span-2 md:col-span-4">
                            <p className="text-gray-500 text-xs">Admin Notes</p>
                            <p className="text-white">{req.admin_notes}</p>
                          </div>
                        )}
                        
                        {/* Additional Notes from User */}
                        {req.details?.notes && (
                          <div className="col-span-2 md:col-span-4">
                            <p className="text-gray-500 text-xs">User Notes</p>
                            <p className="text-white">{req.details.notes}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Request Timeline */}
                      <RequestTimeline
                        createdAt={req.created_at}
                        processedAt={req.processed_at}
                        processedBy={req.processed_by}
                        status={req.status}
                      />
                    </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}

            {/* Results Count */}
            <div className="text-center text-gray-500 text-sm mt-4">
              Showing {paginatedRequests.length} of {filteredRequests.length} requests
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminBillPayments;
