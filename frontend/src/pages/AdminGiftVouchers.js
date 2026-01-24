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
  ArrowLeft, Gift, Clock, CheckCircle, XCircle, Search, 
  RefreshCw, Loader2, Eye, User, CreditCard, Calendar,
  IndianRupee, Tag, ShoppingBag, ChevronDown
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';
const ITEMS_PER_PAGE = 15;
const AUTO_REFRESH_INTERVAL = 30000;

const AdminGiftVouchers = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [timeFilter, setTimeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

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
    { id: 'completed', label: 'Completed', color: 'green', icon: CheckCircle },
    { id: 'rejected', label: 'Rejected', color: 'red', icon: XCircle },
  ];

  // Voucher brand configurations
  const voucherBrands = {
    amazon: { name: 'Amazon', color: 'orange', icon: '🛒' },
    flipkart: { name: 'Flipkart', color: 'blue', icon: '🛍️' },
    myntra: { name: 'Myntra', color: 'pink', icon: '👗' },
    swiggy: { name: 'Swiggy', color: 'orange', icon: '🍔' },
    zomato: { name: 'Zomato', color: 'red', icon: '🍕' },
    bigbasket: { name: 'BigBasket', color: 'green', icon: '🥬' },
    bookmyshow: { name: 'BookMyShow', color: 'red', icon: '🎬' },
    makemytrip: { name: 'MakeMyTrip', color: 'blue', icon: '✈️' },
    default: { name: 'Gift Card', color: 'purple', icon: '🎁' }
  };

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch all statuses to calculate stats correctly
      const response = await axios.get(`${API}/api/admin/gift-voucher/requests`);
      setRequests(response.data.requests || []);
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
    filtered = filtered.filter(r => r.status === activeTab);
    
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
        (r.voucher_type || '').toLowerCase().includes(search)
      );
    }
    
    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    
    return filtered;
  }, [requests, activeTab, timeFilter, searchTerm]);

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
      pendingValue: filtered.filter(r => r.status === 'pending').reduce((sum, r) => sum + (r.denomination || 0), 0),
      completed: filtered.filter(r => r.status === 'completed').length,
      completedValue: filtered.filter(r => r.status === 'completed').reduce((sum, r) => sum + (r.denomination || 0), 0),
      rejected: filtered.filter(r => r.status === 'rejected').length,
      totalValue: filtered.reduce((sum, r) => sum + (r.denomination || 0), 0)
    };
  }, [requests, timeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleProcess = async (requestId, action) => {
    if (action === 'approve' && !voucherCode.trim()) {
      toast.error('Please enter voucher code');
      return;
    }
    
    setProcessing(true);
    try {
      await axios.post(`${API}/api/admin/gift-voucher/process`, {
        request_id: requestId,
        action,
        voucher_code: voucherCode,
        admin_notes: adminNotes,
        admin_uid: user.uid
      });
      
      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setSelectedRequest(null);
      setVoucherCode('');
      setAdminNotes('');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process request');
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
      await axios.post(`${API}/api/admin/gift-voucher/process`, {
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

  const getBrandConfig = (voucherType) => {
    const type = (voucherType || '').toLowerCase();
    return voucherBrands[type] || voucherBrands.default;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
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
                  <Gift className="w-6 h-6 text-purple-400" />
                  Gift Voucher Requests
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-yellow-400 text-xs font-medium">Pending</p>
                <p className="text-2xl font-bold text-yellow-300">{timeFilteredStats.pending}</p>
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
          <Card className="p-3 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <IndianRupee className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-purple-400 text-xs font-medium">Total Value</p>
                <p className="text-2xl font-bold text-purple-300">₹{timeFilteredStats.totalValue.toLocaleString()}</p>
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
          
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search by name, email, brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900/50 border-gray-800 text-white placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Status Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-gray-900/50 border border-gray-800 p-1 rounded-xl">
            {statusTabs.map(tab => {
              const Icon = tab.icon;
              const count = getTabCount(tab.id);
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`flex items-center gap-2 py-3 rounded-lg data-[state=active]:shadow-lg transition-all
                    ${tab.id === 'pending' ? 'data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400' : ''}
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

          {/* Requests List */}
          <div className="mt-4">
            {loading && paginatedRequests.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : paginatedRequests.length === 0 ? (
              <Card className="p-12 bg-gray-900/30 border-gray-800 text-center">
                <div className="text-gray-500">
                  <Gift className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No {activeTab} requests</p>
                  <p className="text-sm mt-1">
                    {timeFilter !== 'all' && `for ${timeFilters.find(t => t.id === timeFilter)?.label.toLowerCase()}`}
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {paginatedRequests.map((req) => {
                  const brand = getBrandConfig(req.voucher_type);
                  
                  return (
                    <Card 
                      key={req.request_id}
                      className={`p-4 bg-gray-900/50 border-gray-800 hover:bg-gray-900/80 transition-all cursor-pointer ${
                        selectedRequest?.request_id === req.request_id ? 'ring-2 ring-purple-500' : ''
                      }`}
                      onClick={() => setSelectedRequest(selectedRequest?.request_id === req.request_id ? null : req)}
                    >
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        {/* Brand Icon & User Info */}
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`p-3 rounded-xl text-2xl ${
                            req.status === 'pending' ? 'bg-yellow-500/10' :
                            req.status === 'completed' ? 'bg-green-500/10' : 'bg-red-500/10'
                          }`}>
                            {brand.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-white truncate">{req.user_name || 'Unknown User'}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                                req.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 
                                'bg-red-500/10 text-red-400 border-red-500/30'
                              }`}>
                                {req.status}
                              </span>
                            </div>
                            <p className="text-purple-400 text-sm font-medium">{brand.name}</p>
                            <p className="text-gray-500 text-sm truncate">{req.user_email}</p>
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right">
                          <p className="text-xl font-bold text-white">₹{(req.denomination || 0).toLocaleString()}</p>
                          <p className="text-gray-500 text-xs">{formatDate(req.created_at)}</p>
                          <p className="text-purple-400 text-xs">{(req.prc_amount || 0).toFixed(2)} PRC</p>
                        </div>

                        {/* Quick Actions */}
                        {req.status === 'pending' && (
                          <div className="flex gap-2 md:ml-4">
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRequest(req);
                              }}
                              className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Process
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
                      </div>

                      {/* Expanded Details */}
                      {selectedRequest?.request_id === req.request_id && (
                        <div className="mt-4 pt-4 border-t border-gray-800">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                            <div>
                              <p className="text-gray-500 text-xs">Email</p>
                              <p className="text-white">{req.user_email || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Subscription</p>
                              <p className="text-white capitalize">{req.user_subscription_plan || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">PRC Balance</p>
                              <p className="text-white">{req.user_prc_balance?.toFixed(2) || '0.00'} PRC</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Request ID</p>
                              <p className="text-white font-mono text-xs">{req.request_id?.slice(0, 12)}...</p>
                            </div>
                          </div>

                          {/* Voucher Code Input for Pending */}
                          {req.status === 'pending' && (
                            <div className="space-y-3 bg-gray-800/50 p-4 rounded-lg">
                              <div>
                                <label className="text-gray-400 text-xs block mb-1">Voucher Code *</label>
                                <Input
                                  placeholder="Enter voucher code to send to user"
                                  value={voucherCode}
                                  onChange={(e) => setVoucherCode(e.target.value)}
                                  className="bg-gray-900 border-gray-700"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div>
                                <label className="text-gray-400 text-xs block mb-1">Admin Notes (Optional)</label>
                                <Input
                                  placeholder="Add notes for this approval"
                                  value={adminNotes}
                                  onChange={(e) => setAdminNotes(e.target.value)}
                                  className="bg-gray-900 border-gray-700"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleProcess(req.request_id, 'approve');
                                  }}
                                  disabled={processing || !voucherCode.trim()}
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve & Send Code
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleProcess(req.request_id, 'reject');
                                  }}
                                  disabled={processing}
                                  variant="destructive"
                                  className="flex-1"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Show voucher code for completed */}
                          {req.status === 'completed' && req.voucher_code && (
                            <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg">
                              <p className="text-green-400 text-xs">Voucher Code Sent:</p>
                              <p className="text-white font-mono">{req.voucher_code}</p>
                            </div>
                          )}

                          {/* Show rejection reason */}
                          {req.status === 'rejected' && req.admin_notes && (
                            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
                              <p className="text-red-400 text-xs">Rejection Reason:</p>
                              <p className="text-white">{req.admin_notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
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

export default AdminGiftVouchers;
