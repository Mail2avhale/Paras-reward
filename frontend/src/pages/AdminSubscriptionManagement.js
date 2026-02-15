import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, Users, TrendingUp, Rocket, Clock, CheckCircle, XCircle,
  Search, RefreshCw, Eye, ChevronRight, AlertCircle, Edit, Trash2, X,
  Calendar, CreditCard
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminSubscriptionManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [approvedPayments, setApprovedPayments] = useState([]);
  const [rejectedPayments, setRejectedPayments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // pending, approved, rejected
  const [editModal, setEditModal] = useState({ show: false, payment: null });
  const [viewModal, setViewModal] = useState({ show: false, payment: null });
  const [fullImageModal, setFullImageModal] = useState({ show: false, url: null, userName: '', amount: '' });
  const [rejectModal, setRejectModal] = useState({ show: false, payment: null });
  
  // Pagination states
  const [pendingPage, setPendingPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [approvedTotal, setApprovedTotal] = useState(0);
  const [rejectedTotal, setRejectedTotal] = useState(0);
  const ITEMS_PER_PAGE = 10;

  // NEW: Filter states
  const [timeFilter, setTimeFilter] = useState('all'); // today, week, month, all
  const [planFilter, setPlanFilter] = useState('all'); // all, startup, growth, elite
  const [durationFilter, setDurationFilter] = useState('all'); // all, monthly, quarterly, half_yearly, yearly

  // Fetch data on mount and filter change
  useEffect(() => {
    fetchData();
  }, [pendingPage, approvedPage, rejectedPage, timeFilter, planFilter, durationFilter]);

  // Build filter query string
  const buildFilterQuery = () => {
    let query = '';
    if (timeFilter !== 'all') query += `&time_filter=${timeFilter}`;
    if (planFilter !== 'all') query += `&plan=${planFilter}`;
    if (durationFilter !== 'all') query += `&duration=${durationFilter}`;
    return query;
  };

  // Retry helper for API calls
  const fetchWithRetry = async (url, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
      try {
        return await axios.get(url);
      } catch (error) {
        if (i === retries || error.response?.status !== 503) {
          throw error;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const filterQuery = buildFilterQuery();
      
      // Fetch data with individual error handling and retry - include rejected
      const [statsRes, pendingRes, approvedRes, rejectedRes] = await Promise.allSettled([
        fetchWithRetry(`${API}/api/admin/subscription-stats`),
        fetchWithRetry(`${API}/api/admin/vip-payments?status=pending&page=${pendingPage}&limit=${ITEMS_PER_PAGE}${filterQuery}`),
        fetchWithRetry(`${API}/api/admin/vip-payments?status=approved&page=${approvedPage}&limit=${ITEMS_PER_PAGE}${filterQuery}`),
        fetchWithRetry(`${API}/api/admin/vip-payments?status=rejected&page=${rejectedPage}&limit=${ITEMS_PER_PAGE}${filterQuery}`)
      ]);
      
      // Handle stats - may fail on some deployments
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
      } else {
        console.warn('Stats API not available:', statsRes.reason?.response?.status);
      }
      
      // Handle pending payments
      if (pendingRes.status === 'fulfilled') {
        setPendingPayments(pendingRes.value.data?.payments || []);
        setPendingTotal(pendingRes.value.data?.total || 0);
      } else if (pendingRes.reason?.response?.status === 503) {
        toast.error('Database busy - Please refresh');
      }
      
      // Handle approved payments
      if (approvedRes.status === 'fulfilled') {
        setApprovedPayments(approvedRes.value.data?.payments || []);
        setApprovedTotal(approvedRes.value.data?.total || 0);
      } else if (approvedRes.reason?.response?.status === 503) {
        toast.error('Database busy - Please refresh');
      }
      
      // Handle rejected payments
      if (rejectedRes.status === 'fulfilled') {
        setRejectedPayments(rejectedRes.value.data?.payments || []);
        setRejectedTotal(rejectedRes.value.data?.total || 0);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data - Please refresh');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (paymentId) => {
    setProcessing(paymentId);
    try {
      await axios.post(`${API}/api/admin/vip-payment/${paymentId}/approve`, {});
      toast.success('Payment approved!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (paymentId) => {
    if (!confirm('Reject this payment?')) return;
    setProcessing(paymentId);
    try {
      await axios.post(`${API}/api/admin/vip-payment/${paymentId}/reject`, {
        reason: 'Payment verification failed'
      });
      toast.success('Payment rejected');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (paymentId) => {
    if (!confirm('Are you sure you want to delete this subscription? This action cannot be undone.')) return;
    setProcessing(paymentId);
    try {
      await axios.delete(`${API}/api/admin/vip-payments/${paymentId}`);
      toast.success('Subscription deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    } finally {
      setProcessing(null);
    }
  };

  const handleEdit = async (paymentId, updates) => {
    setProcessing(paymentId);
    try {
      // Add admin_id for audit logging
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      await axios.put(`${API}/api/admin/vip-payments/${paymentId}`, {
        ...updates,
        admin_id: user.uid || user.id
      });
      toast.success('Subscription updated successfully!');
      setEditModal({ show: false, payment: null });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update subscription');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const planCounts = stats?.plan_counts || {};

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
          <p className="text-gray-400 text-sm">Manage user subscriptions</p>
        </div>
        <Button 
          onClick={fetchData} 
          variant="outline" 
          size="sm"
          className="border-gray-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards - Simple Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Explorer"
          value={planCounts.explorer || 0}
          color="gray"
          subtitle="Free Plan"
          onClick={() => navigate('/admin/users?plan=explorer')}
        />
        <StatCard
          icon={<Rocket className="w-5 h-5" />}
          label="Startup"
          value={planCounts.startup || 0}
          color="blue"
          subtitle="₹299/month"
          onClick={() => setActiveTab('approved')}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Growth"
          value={planCounts.growth || 0}
          color="emerald"
          subtitle="₹549/month"
          onClick={() => setActiveTab('approved')}
        />
        <StatCard
          icon={<Crown className="w-5 h-5" />}
          label="Elite"
          value={planCounts.elite || 0}
          color="amber"
          subtitle="₹799/month"
          onClick={() => setActiveTab('approved')}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-black'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Pending ({pendingTotal})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'approved'
              ? 'bg-green-500 text-black'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <CheckCircle className="w-4 h-4 inline mr-2" />
          Approved ({approvedTotal})
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'rejected'
              ? 'bg-red-500 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <XCircle className="w-4 h-4 inline mr-2" />
          Rejected ({rejectedTotal})
        </button>
      </div>

      {/* Filter Section */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 mb-4">
        <div className="flex flex-wrap gap-4">
          {/* Time Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 mb-1 block">Time Period</label>
            <div className="flex gap-1 flex-wrap">
              {[
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' },
                { value: 'all', label: 'All Time' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTimeFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    timeFilter === opt.value
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plan Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 mb-1 block">Subscription Plan</label>
            <div className="flex gap-1 flex-wrap">
              {[
                { value: 'all', label: 'All Plans' },
                { value: 'startup', label: 'Startup' },
                { value: 'growth', label: 'Growth' },
                { value: 'elite', label: 'Elite' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPlanFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    planFilter === opt.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 mb-1 block">Duration</label>
            <div className="flex gap-1 flex-wrap">
              {[
                { value: 'all', label: 'All' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'half_yearly', label: '6 Months' },
                { value: 'yearly', label: 'Yearly' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDurationFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    durationFilter === opt.value
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active Filters Summary */}
        {(timeFilter !== 'all' || planFilter !== 'all' || durationFilter !== 'all') && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {timeFilter !== 'all' && (
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                  {timeFilter === 'today' ? 'Today' : timeFilter === 'week' ? 'This Week' : 'This Month'}
                </span>
              )}
              {planFilter !== 'all' && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full capitalize">
                  {planFilter}
                </span>
              )}
              {durationFilter !== 'all' && (
                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full capitalize">
                  {durationFilter.replace('_', ' ')}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setTimeFilter('all');
                setPlanFilter('all');
                setDurationFilter('all');
              }}
              className="text-xs text-gray-500 hover:text-white"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Pending Payments Section */}
      {activeTab === 'pending' && (
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-white">
              Pending Approvals
            </h2>
            {pendingPayments.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                {pendingPayments.length}
              </span>
            )}
          </div>
          
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search by name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-800 border-gray-700 text-white text-sm h-9"
            />
          </div>
        </div>

        {/* Payments List */}
        <div className="divide-y divide-gray-800">
          {pendingPayments.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-400">No pending payments</p>
              <p className="text-gray-500 text-sm">All caught up!</p>
            </div>
          ) : (
            pendingPayments
              .filter(p => 
                !searchQuery || 
                p.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.utr_number?.includes(searchQuery)
              )
              .map((payment) => (
                <PaymentRow
                  key={payment.payment_id}
                  payment={payment}
                  onApprove={() => handleApprove(payment.payment_id)}
                  onReject={() => handleReject(payment.payment_id)}
                  processing={processing === payment.payment_id}
                  type="pending"
                />
              ))
          )}
        </div>
        
        {/* Pending Pagination */}
        {pendingTotal > ITEMS_PER_PAGE && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Showing {((pendingPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(pendingPage * ITEMS_PER_PAGE, pendingTotal)} of {pendingTotal}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                disabled={pendingPage === 1}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300"
              >
                Previous
              </Button>
              <span className="px-3 py-1.5 bg-gray-800 rounded text-white text-sm">
                {pendingPage} / {Math.ceil(pendingTotal / ITEMS_PER_PAGE)}
              </span>
              <Button
                onClick={() => setPendingPage(p => p + 1)}
                disabled={pendingPage >= Math.ceil(pendingTotal / ITEMS_PER_PAGE)}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Approved Subscriptions Section */}
      {activeTab === 'approved' && (
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold text-white">
              Approved Subscriptions
            </h2>
          </div>
          
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search subscriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-800 border-gray-700 text-white text-sm h-9"
            />
          </div>
        </div>

        {/* Approved List */}
        <div className="divide-y divide-gray-800">
          {approvedPayments.length === 0 ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">No approved subscriptions</p>
            </div>
          ) : (
            approvedPayments
              .filter(p => 
                !searchQuery || 
                p.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.utr_number?.includes(searchQuery)
              )
              .map((payment) => (
                <ApprovedRow
                  key={payment.payment_id}
                  payment={payment}
                  onView={() => setViewModal({ show: true, payment })}
                  onEdit={() => setEditModal({ show: true, payment })}
                  onDelete={() => handleDelete(payment.payment_id)}
                  processing={processing === payment.payment_id}
                />
              ))
          )}
        </div>
        
        {/* Approved Pagination */}
        {approvedTotal > ITEMS_PER_PAGE && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Showing {((approvedPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(approvedPage * ITEMS_PER_PAGE, approvedTotal)} of {approvedTotal}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setApprovedPage(p => Math.max(1, p - 1))}
                disabled={approvedPage === 1}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300"
              >
                Previous
              </Button>
              <span className="px-3 py-1.5 bg-gray-800 rounded text-white text-sm">
                {approvedPage} / {Math.ceil(approvedTotal / ITEMS_PER_PAGE)}
              </span>
              <Button
                onClick={() => setApprovedPage(p => p + 1)}
                disabled={approvedPage >= Math.ceil(approvedTotal / ITEMS_PER_PAGE)}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Rejected Subscriptions Section */}
      {activeTab === 'rejected' && (
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-white">
              Rejected Subscriptions
            </h2>
            {rejectedTotal > 0 && (
              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                {rejectedTotal}
              </span>
            )}
          </div>
          
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search rejections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-800 border-gray-700 text-white text-sm h-9"
            />
          </div>
        </div>

        {/* Rejected List */}
        <div className="divide-y divide-gray-800">
          {rejectedPayments.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-400">No rejected subscriptions</p>
            </div>
          ) : (
            rejectedPayments
              .filter(p => 
                !searchQuery || 
                p.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.utr_number?.includes(searchQuery)
              )
              .map((payment) => (
                <RejectedRow
                  key={payment.payment_id}
                  payment={payment}
                  onView={() => setViewModal({ show: true, payment })}
                  onDelete={() => handleDelete(payment.payment_id)}
                  onReapprove={() => handleApprove(payment.payment_id)}
                  processing={processing === payment.payment_id}
                />
              ))
          )}
        </div>
        
        {/* Rejected Pagination */}
        {rejectedTotal > ITEMS_PER_PAGE && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Showing {((rejectedPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(rejectedPage * ITEMS_PER_PAGE, rejectedTotal)} of {rejectedTotal}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setRejectedPage(p => Math.max(1, p - 1))}
                disabled={rejectedPage === 1}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300"
              >
                Previous
              </Button>
              <span className="px-3 py-1.5 bg-gray-800 rounded text-white text-sm">
                {rejectedPage} / {Math.ceil(rejectedTotal / ITEMS_PER_PAGE)}
              </span>
              <Button
                onClick={() => setRejectedPage(p => p + 1)}
                disabled={rejectedPage >= Math.ceil(rejectedTotal / ITEMS_PER_PAGE)}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Quick Stats Footer */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <QuickStat 
          label="Total Users" 
          value={stats?.total_users || 0} 
        />
        <QuickStat 
          label="VIP Users" 
          value={stats?.vip_users || 0} 
        />
        <QuickStat 
          label="Monthly Revenue" 
          value={`₹${(stats?.monthly_revenue || 0).toLocaleString()}`} 
        />
      </div>

      {/* View Modal */}
      {viewModal.show && viewModal.payment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Subscription Details</h3>
              <button 
                onClick={() => setViewModal({ show: false, payment: null })}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-sm">User</p>
                  <p className="text-white font-medium">{viewModal.payment.user_name}</p>
                  <p className="text-gray-400 text-sm">{viewModal.payment.user_email}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Plan</p>
                  <p className="text-white font-medium capitalize">{viewModal.payment.plan}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Amount</p>
                  <p className="text-white font-medium">₹{viewModal.payment.amount}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Duration</p>
                  <p className="text-white font-medium capitalize">{viewModal.payment.duration}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">UTR Number</p>
                  <p className="text-white font-mono">{viewModal.payment.utr_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Approved At</p>
                  <p className="text-white">{viewModal.payment.approved_at ? new Date(viewModal.payment.approved_at).toLocaleString() : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Expires At</p>
                  <p className="text-white">{viewModal.payment.expires_at ? new Date(viewModal.payment.expires_at).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
              
              {viewModal.payment.screenshot_url && (
                <div>
                  <p className="text-gray-500 text-sm mb-2">Payment Screenshot</p>
                  <button 
                    onClick={() => setFullImageModal({ 
                      show: true, 
                      url: viewModal.payment.screenshot_url,
                      userName: viewModal.payment.user_name,
                      amount: viewModal.payment.amount,
                      plan: viewModal.payment.plan
                    })}
                    className="relative group inline-block cursor-pointer"
                  >
                    <img 
                      src={viewModal.payment.screenshot_url} 
                      alt="Payment Screenshot" 
                      className="max-w-full max-h-48 object-contain rounded-lg border border-gray-700 group-hover:border-purple-500 transition-all"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-all">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                  </button>
                  <p className="text-xs text-gray-500 mt-1">Click to view full size</p>
                </div>
              )}
            </div>
            
            <Button 
              onClick={() => setViewModal({ show: false, payment: null })}
              className="w-full mt-6 bg-gray-800 hover:bg-gray-700"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.show && editModal.payment && (
        <EditSubscriptionModal
          payment={editModal.payment}
          onClose={() => setEditModal({ show: false, payment: null })}
          onSave={(updates) => handleEdit(editModal.payment.payment_id, updates)}
          processing={processing === editModal.payment.payment_id}
        />
      )}
      
      {/* Full Image Preview Modal */}
      {fullImageModal.show && fullImageModal.url && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={() => setFullImageModal({ show: false, url: null, userName: '', amount: '', plan: '' })}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            {/* Close Button */}
            <button
              onClick={() => setFullImageModal({ show: false, url: null, userName: '', amount: '', plan: '' })}
              className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* Image */}
            <img 
              src={fullImageModal.url} 
              alt="Payment Screenshot" 
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* User Info Footer */}
            <div className="mt-4 bg-gray-900/80 rounded-lg px-6 py-3 text-center">
              <p className="text-white font-bold">{fullImageModal.userName || 'Unknown User'}</p>
              <p className="text-green-400 font-medium">₹{fullImageModal.amount} • {fullImageModal.plan?.toUpperCase()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Edit Modal Component
const EditSubscriptionModal = ({ payment, onClose, onSave, processing }) => {
  // Get expiry date from various possible fields
  const getExpiryDate = () => {
    const expiry = payment.new_expiry || payment.expires_at || payment.subscription_expiry || '';
    if (expiry) {
      return expiry.split('T')[0];
    }
    return '';
  };

  const [formData, setFormData] = useState({
    plan: payment.subscription_plan || payment.plan || payment.actual_plan_approved || 'startup',
    duration: payment.plan_type || payment.duration || payment.actual_duration_approved || 'monthly',
    amount: payment.amount || 0,
    expires_at: getExpiryDate()
  });

  const planName = payment.subscription_plan || payment.plan || 'N/A';
  const userName = payment.user_name || 'Unknown User';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Edit Subscription</h3>
            <p className="text-gray-400 text-sm">Correct subscription details</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* User Info Header */}
        <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-medium">{userName}</p>
              <p className="text-gray-400 text-xs">{payment.user_email || payment.user_id}</p>
            </div>
            <div className="ml-auto text-right">
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-lg capitalize">{planName}</span>
              <p className="text-gray-500 text-xs mt-1">Current Plan</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          {/* Plan Selection */}
          <div>
            <label className="text-gray-400 text-sm block mb-1">
              <Crown className="w-3 h-3 inline mr-1" />
              Subscription Plan
            </label>
            <select
              value={formData.plan}
              onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              data-testid="edit-plan-select"
            >
              <option value="startup">Startup</option>
              <option value="growth">Growth</option>
              <option value="elite">Elite</option>
            </select>
          </div>
          
          {/* Duration Selection */}
          <div>
            <label className="text-gray-400 text-sm block mb-1">
              <Clock className="w-3 h-3 inline mr-1" />
              Duration
            </label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              data-testid="edit-duration-select"
            >
              <option value="monthly">Monthly (30 days)</option>
              <option value="quarterly">Quarterly (90 days)</option>
              <option value="half_yearly">Half Yearly (180 days)</option>
              <option value="yearly">Yearly (365 days)</option>
            </select>
          </div>
          
          {/* Amount */}
          <div>
            <label className="text-gray-400 text-sm block mb-1">
              <CreditCard className="w-3 h-3 inline mr-1" />
              Amount (₹)
            </label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
              className="bg-gray-800 border-gray-700 text-white focus:border-purple-500"
              data-testid="edit-amount-input"
            />
          </div>
          
          {/* Expiry Date - Key Correction Feature */}
          <div>
            <label className="text-gray-400 text-sm block mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              Subscription Expiry Date
            </label>
            <Input
              type="date"
              value={formData.expires_at}
              onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white focus:border-purple-500"
              data-testid="edit-expiry-input"
            />
            <p className="text-xs text-gray-500 mt-1">
              User's subscription will be valid until this date
            </p>
          </div>
        </div>
        
        {/* Warning Notice */}
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-amber-400 text-xs flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Changes will immediately update user's subscription status
          </p>
        </div>
        
        <div className="flex gap-3 mt-6">
          <Button 
            onClick={onClose}
            variant="outline"
            className="flex-1 border-gray-700 text-gray-300"
            data-testid="edit-cancel-btn"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => onSave(formData)}
            disabled={processing}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            data-testid="edit-save-btn"
          >
            {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Simple Stat Card Component
const StatCard = ({ icon, label, value, color, subtitle, onClick }) => {
  const colors = {
    gray: 'from-gray-600 to-gray-700 text-gray-400',
    blue: 'from-blue-500 to-indigo-600 text-blue-400',
    emerald: 'from-emerald-500 to-teal-600 text-emerald-400',
    amber: 'from-amber-500 to-orange-600 text-amber-400'
  };

  return (
    <div 
      className={`bg-gray-900 rounded-xl border border-gray-800 p-4 ${onClick ? 'cursor-pointer hover:bg-gray-800 transition-all' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color].split(' ')[0]} ${colors[color].split(' ')[1]} flex items-center justify-center text-white`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className={`text-sm ${colors[color].split(' ')[2]}`}>{label}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

// Payment Row Component - Enhanced with Screenshot & Details
const PaymentRow = ({ payment, onApprove, onReject, processing, type = 'pending' }) => {
  const [showImageModal, setShowImageModal] = useState(false);
  
  const planColors = {
    startup: 'text-blue-400 bg-blue-500/10',
    growth: 'text-emerald-400 bg-emerald-500/10',
    elite: 'text-amber-400 bg-amber-500/10'
  };

  return (
    <>
      {/* Image Preview Modal */}
      {showImageModal && payment.screenshot_url && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            {/* Close Button */}
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* Image */}
            <img 
              src={payment.screenshot_url} 
              alt="Payment Screenshot" 
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* User Info Footer */}
            <div className="mt-4 bg-gray-900/80 rounded-lg px-6 py-3 text-center">
              <p className="text-white font-bold">{payment.user_name || 'Unknown User'}</p>
              <p className="text-green-400 font-medium">₹{payment.amount} • {payment.plan?.toUpperCase()}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="p-4 hover:bg-gray-800/50 transition-colors">
        {/* Two Column Layout: Screenshot | Details */}
        <div className="flex flex-col md:flex-row gap-4">
          
          {/* LEFT: Payment Screenshot */}
          <div className="md:w-40 flex-shrink-0">
            {payment.screenshot_url ? (
              <button 
                onClick={() => setShowImageModal(true)}
                className="block relative group w-full cursor-pointer"
              >
                <img 
                  src={payment.screenshot_url} 
                  alt="Payment Screenshot" 
                  className="w-full h-40 md:h-48 object-cover rounded-lg border-2 border-gray-700 group-hover:border-amber-500 transition-all"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-all">
                  <Eye className="w-6 h-6 text-white" />
                </div>
              </button>
            ) : (
              <div className="w-full h-40 md:h-48 bg-gray-800 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center">
                <p className="text-gray-500 text-xs text-center">No Screenshot</p>
              </div>
            )}
          </div>

        {/* RIGHT: All Details */}
        <div className="flex-1 flex flex-col">
          {/* User Name & Plan */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-white font-bold text-lg">{payment.user_name || 'Unknown User'}</h3>
              <p className="text-gray-400 text-sm">{payment.user_email}</p>
              {payment.user_phone && <p className="text-gray-500 text-xs">📱 {payment.user_phone}</p>}
            </div>
            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${planColors[payment.plan] || 'text-gray-400 bg-gray-700'}`}>
              {payment.plan?.toUpperCase() || 'VIP'}
            </span>
          </div>

          {/* Key Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="bg-gray-800/50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">Amount</p>
              <p className="text-green-400 font-bold text-lg">₹{payment.amount}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">Duration</p>
              <p className="text-white font-medium capitalize">{payment.duration || 'Monthly'}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">UTR Number</p>
              <p className="text-white font-mono text-sm truncate">{payment.utr_number || 'N/A'}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">Submitted</p>
              <p className="text-white text-sm">
                {new Date(payment.submitted_at).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-auto">
            <Button
              onClick={onApprove}
              disabled={processing}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white h-10"
            >
              {processing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
            <Button
              onClick={onReject}
              disabled={processing}
              variant="outline"
              className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 h-10"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

// Approved Row Component
const ApprovedRow = ({ payment, onView, onEdit, onDelete, processing }) => {
  const planColors = {
    startup: 'text-blue-400 bg-blue-500/10',
    growth: 'text-emerald-400 bg-emerald-500/10',
    elite: 'text-amber-400 bg-amber-500/10'
  };

  // Get plan from subscription_plan or plan field
  const planName = payment.subscription_plan || payment.plan || payment.current_plan;
  const isExpired = payment.expires_at && new Date(payment.expires_at) < new Date();

  return (
    <div className="p-4 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center justify-between">
        {/* User Info */}
        <div className="flex items-center gap-4 flex-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
            {payment.user_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">
              {payment.user_name || 'Unknown User'}
            </p>
            <p className="text-gray-500 text-sm truncate">
              {payment.user_email || payment.user_id}
            </p>
          </div>
        </div>

        {/* Plan Badge */}
        <div className="px-3">
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${planColors[planName] || 'text-gray-400 bg-gray-700'}`}>
            {planName?.toUpperCase() || 'N/A'}
          </span>
        </div>

        {/* Amount */}
        <div className="px-4 text-right">
          <p className="text-white font-bold">₹{payment.amount || 0}</p>
          <p className="text-gray-500 text-xs">{payment.plan_type || payment.duration || 'monthly'}</p>
        </div>

        {/* Status */}
        <div className="px-4 w-32">
          {isExpired ? (
            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg">
              Expired
            </span>
          ) : (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-lg">
              Active
            </span>
          )}
          <p className="text-gray-500 text-xs mt-1">
            {payment.approved_at ? new Date(payment.approved_at).toLocaleDateString() : '-'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={onView}
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700 h-9 px-3"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            onClick={onEdit}
            size="sm"
            variant="outline"
            className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 h-9 px-3"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            onClick={onDelete}
            disabled={processing}
            size="sm"
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-9 px-3"
          >
            {processing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Rejected Row Component
const RejectedRow = ({ payment, onView, onDelete, onReapprove, processing }) => {
  const planColors = {
    startup: 'text-blue-400 bg-blue-500/10',
    growth: 'text-emerald-400 bg-emerald-500/10',
    elite: 'text-amber-400 bg-amber-500/10'
  };

  const planName = payment.subscription_plan || payment.plan || payment.current_plan;

  return (
    <div className="p-4 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center justify-between">
        {/* User Info */}
        <div className="flex items-center gap-4 flex-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center text-white font-bold">
            {payment.user_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">
              {payment.user_name || 'Unknown User'}
            </p>
            <p className="text-gray-500 text-sm truncate">
              {payment.user_email || payment.user_id}
            </p>
          </div>
        </div>

        {/* Plan Badge */}
        <div className="px-3">
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${planColors[planName] || 'text-gray-400 bg-gray-700'}`}>
            {planName?.toUpperCase() || 'N/A'}
          </span>
        </div>

        {/* Amount */}
        <div className="px-4 text-right">
          <p className="text-white font-bold">₹{payment.amount || 0}</p>
          <p className="text-gray-500 text-xs">{payment.plan_type || payment.duration || 'monthly'}</p>
        </div>

        {/* Rejection Details */}
        <div className="px-4 w-40">
          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg">
            Rejected
          </span>
          <p className="text-gray-500 text-xs mt-1 truncate" title={payment.rejection_reason}>
            {payment.rejection_reason?.substring(0, 20) || 'No reason'}...
          </p>
          <p className="text-gray-600 text-xs mt-0.5">
            {payment.rejected_at ? new Date(payment.rejected_at).toLocaleDateString() : '-'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {/* Re-approve Button */}
          <Button
            onClick={onReapprove}
            disabled={processing}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white h-9 px-3"
          >
            {processing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-1" />
                Re-approve
              </>
            )}
          </Button>
          <Button
            onClick={onView}
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700 h-9 px-3"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            onClick={onDelete}
            disabled={processing}
            size="sm"
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-9 px-3"
          >
            {processing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Quick Stat Component
const QuickStat = ({ label, value }) => (
  <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-3 text-center">
    <p className="text-xl font-bold text-white">{value}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>
);

export default AdminSubscriptionManagement;
