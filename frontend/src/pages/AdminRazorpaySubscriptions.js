import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, CreditCard, CheckCircle, Clock, XCircle, 
  TrendingUp, Users, IndianRupee, RefreshCw, Search,
  Filter, Calendar, ChevronDown, AlertTriangle, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminRazorpaySubscriptions = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFraudModal, setShowFraudModal] = useState(false);
  const [fraudPreview, setFraudPreview] = useState(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [razorpayEnabled, setRazorpayEnabled] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  
  // Advanced filters
  const [sortBy, setSortBy] = useState('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchData();
    fetchRazorpayConfig();
  }, [statusFilter]);

  const fetchRazorpayConfig = async () => {
    try {
      const res = await axios.get(`${API}/razorpay/config`);
      setRazorpayEnabled(res.data.enabled !== false);
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const toggleRazorpay = async () => {
    try {
      setToggleLoading(true);
      const newState = !razorpayEnabled;
      await axios.post(`${API}/razorpay/toggle`, {
        enabled: newState,
        admin_pin: '123456'
      });
      setRazorpayEnabled(newState);
      toast.success(`Razorpay gateway ${newState ? 'ENABLED' : 'DISABLED'}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to toggle gateway');
    } finally {
      setToggleLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await axios.get(`${API}/admin/razorpay-subscriptions${params}`);
      setOrders(res.data.orders || []);
      setStats(res.data.stats || {});
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Fraud cleanup functions
  const previewFraudCleanup = async () => {
    try {
      setCleanupLoading(true);
      const res = await axios.get(`${API}/admin/razorpay-fraud-preview`);
      setFraudPreview(res.data);
      setShowFraudModal(true);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load fraud preview');
    } finally {
      setCleanupLoading(false);
    }
  };

  const executeFraudCleanup = async () => {
    if (!window.confirm('Are you sure? This will reset all fraudulent subscriptions to FREE plan.')) {
      return;
    }
    
    try {
      setCleanupLoading(true);
      const res = await axios.post(`${API}/admin/razorpay-cleanup-fraudulent`, {
        admin_pin: '123456'
      });
      
      toast.success(`Cleanup complete! Reset ${res.data.reset_count} users, Skipped ${res.data.skipped_count} legitimate users`);
      setShowFraudModal(false);
      setFraudPreview(null);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Failed to cleanup');
    } finally {
      setCleanupLoading(false);
    }
  };

  const deletePendingOrders = async () => {
    if (!window.confirm('Are you sure you want to delete all PENDING orders?')) {
      return;
    }
    
    try {
      setCleanupLoading(true);
      const res = await axios.post(`${API}/admin/razorpay-delete-pending`, {
        admin_pin: '123456'
      });
      
      toast.success(`Deleted ${res.data.deleted_count} pending orders`);
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete');
    } finally {
      setCleanupLoading(false);
    }
  };

  const deleteAllOrders = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL orders (paid + pending). Are you absolutely sure?')) {
      return;
    }
    if (!window.confirm('This action is IRREVERSIBLE. Type OK to proceed.')) {
      return;
    }
    
    try {
      setCleanupLoading(true);
      const res = await axios.post(`${API}/admin/razorpay-delete-all`, {
        admin_pin: '123456',
        confirm: true
      });
      
      toast.success(`Deleted ALL ${res.data.deleted_count} orders`);
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete');
    } finally {
      setCleanupLoading(false);
    }
  };

  // SYNC payments from Razorpay API
  const syncPayments = async () => {
    try {
      setCleanupLoading(true);
      toast.loading('Syncing with Razorpay...', { id: 'sync' });
      
      const res = await axios.post(`${API}/admin/razorpay/sync-pending`);
      
      toast.dismiss('sync');
      
      if (res.data.synced > 0) {
        toast.success(`✅ Activated ${res.data.synced} subscriptions!`, { duration: 5000 });
      } else {
        toast.info(`No payments to activate (${res.data.total_pending} pending orders checked)`);
      }
      
      if (res.data.errors && res.data.errors.length > 0) {
        toast.error(`${res.data.errors.length} orders had errors`);
      }
      
      fetchData();
    } catch (error) {
      toast.dismiss('sync');
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Sync failed');
    } finally {
      setCleanupLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // Apply sorting
  const sortedOrders = [...orders].sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    
    switch (sortBy) {
      case 'latest':
        return dateB - dateA;
      case 'oldest':
        return dateA - dateB;
      case 'status':
        return (a.status || '').localeCompare(b.status || '');
      case 'amount_high':
        return (b.amount || 0) - (a.amount || 0);
      case 'amount_low':
        return (a.amount || 0) - (b.amount || 0);
      default:
        return dateB - dateA;
    }
  });

  // Apply search filter
  const filteredOrders = sortedOrders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.user_name?.toLowerCase().includes(query) ||
      order.user_email?.toLowerCase().includes(query) ||
      order.order_id?.toLowerCase().includes(query) ||
      order.payment_id?.toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800 px-5 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-400">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Razorpay Subscriptions</h1>
            <p className="text-xs text-gray-500">Live payment gateway transactions</p>
          </div>
        </div>
      </div>

      {/* Gateway Toggle */}
      <div className="px-5 mt-4">
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
          razorpayEnabled 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            <CreditCard className={`w-6 h-6 ${razorpayEnabled ? 'text-emerald-400' : 'text-red-400'}`} />
            <div>
              <p className="font-medium text-white">
                Online Payment Gateway
              </p>
              <p className={`text-xs ${razorpayEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
                {razorpayEnabled ? '✅ ENABLED - Users can pay online' : '❌ DISABLED - Only manual payment available'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleRazorpay}
            disabled={toggleLoading}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              razorpayEnabled
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
            }`}
          >
            {toggleLoading ? '...' : razorpayEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="w-5 h-5 text-emerald-400" />
            <span className="text-gray-400 text-sm">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">₹{stats.total_revenue?.toLocaleString() || 0}</p>
        </div>
        
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-blue-400" />
            <span className="text-gray-400 text-sm">Paid Orders</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{stats.paid_orders || 0}</p>
        </div>
        
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <span className="text-gray-400 text-sm">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{stats.pending_orders || 0}</p>
        </div>
        
        <div className="p-4 rounded-2xl bg-gray-800/50 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-gray-400" />
            <span className="text-gray-400 text-sm">Total Orders</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total_orders || 0}</p>
        </div>
      </div>

      {/* SYNC Button - Most Important */}
      {stats.pending_orders > 0 && (
        <div className="px-5 mt-4">
          <button
            onClick={syncPayments}
            disabled={cleanupLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-all"
          >
            <RefreshCw className={`w-5 h-5 ${cleanupLoading ? 'animate-spin' : ''}`} />
            <span>
              {cleanupLoading ? 'Syncing...' : `🔄 Sync Payments from Razorpay (${stats.pending_orders} pending)`}
            </span>
          </button>
          <p className="text-center text-xs text-gray-500 mt-2">
            This will check Razorpay API and auto-activate captured payments
          </p>
        </div>
      )}

      {/* REMOVED: Fraud Cleanup, Delete Pending, Delete All buttons
          These are dangerous and can cause data loss.
          Use API directly if needed:
          - POST /api/admin/razorpay-cleanup-fraudulent
          - POST /api/admin/razorpay-delete-pending
          - POST /api/admin/razorpay-delete-all
      */}

      {/* Filters */}
      <div className="px-5 mt-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, email, order ID..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="flex gap-2 items-center">
          <span className="text-gray-400 text-sm">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="latest">Latest First</option>
            <option value="oldest">Oldest First</option>
            <option value="status">By Status</option>
            <option value="amount_high">Amount (High to Low)</option>
            <option value="amount_low">Amount (Low to High)</option>
          </select>
          <span className="text-gray-500 text-sm ml-auto">
            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredOrders.length)} of {filteredOrders.length}
          </span>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'All', count: stats.total_orders },
            { id: 'paid', label: 'Paid', count: stats.paid_orders, color: 'emerald' },
            { id: 'created', label: 'Pending', count: stats.pending_orders, color: 'amber' },
            { id: 'failed', label: 'Failed', color: 'red' },
            { id: 'cancelled', label: 'Cancelled', color: 'gray' },
            { id: 'error', label: 'Error', color: 'orange' },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => { setStatusFilter(filter.id); setCurrentPage(1); }}
              onClick={() => setStatusFilter(filter.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === filter.id
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {filter.label} {filter.count !== undefined ? `(${filter.count})` : ''}
            </button>
          ))}
          
          <button
            onClick={fetchData}
            className="px-3 py-2 rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="px-5 mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No orders found</p>
          </div>
        ) : (
          paginatedOrders.map((order, index) => (
            <motion.div
              key={order.order_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`p-4 rounded-2xl border ${
                order.status === 'paid' ? 'bg-emerald-500/5 border-emerald-500/20' :
                order.status === 'failed' ? 'bg-red-500/5 border-red-500/20' :
                order.status === 'cancelled' ? 'bg-gray-800/50 border-gray-700' :
                order.status === 'error' ? 'bg-orange-500/5 border-orange-500/20' :
                'bg-gray-900/50 border-gray-800'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-white">{order.user_name}</p>
                  <p className="text-sm text-gray-400">{order.user_email || order.user_mobile}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                  order.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                  order.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  order.status === 'cancelled' ? 'bg-gray-700 text-gray-400' :
                  order.status === 'error' ? 'bg-orange-500/20 text-orange-400' :
                  order.status === 'fraudulent' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {order.status === 'paid' ? '✅ Paid' : 
                   order.status === 'failed' ? '❌ Failed' :
                   order.status === 'cancelled' ? '🚫 Cancelled' :
                   order.status === 'error' ? '⚠️ Error' :
                   order.status === 'fraudulent' ? '🚨 Fraudulent' :
                   '⏳ Pending'}
                </span>
              </div>
              
              {/* Show failure reason if exists */}
              {order.failure_reason && (
                <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-xs">Reason: {order.failure_reason}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Plan</p>
                  <p className={`font-medium ${
                    order.plan_name?.toLowerCase().includes('elite') ? 'text-amber-400' :
                    order.plan_name?.toLowerCase().includes('startup') ? 'text-blue-400' :
                    'text-white'
                  }`}>
                    {order.plan_name} ({order.plan_type})
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Amount</p>
                  <p className="font-bold text-emerald-400">₹{order.amount}</p>
                </div>
                <div>
                  <p className="text-gray-500">Order ID</p>
                  <p className="text-gray-300 font-mono text-xs truncate">{order.order_id}</p>
                </div>
                <div>
                  <p className="text-gray-500">Created</p>
                  <p className="text-gray-300 text-xs">{formatDate(order.created_at)}</p>
                </div>
              </div>
              
              {order.payment_id && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-gray-500 text-xs">Payment ID</p>
                  <p className="text-emerald-400 font-mono text-xs">{order.payment_id}</p>
                  {order.paid_at && (
                    <p className="text-gray-500 text-xs mt-1">Paid: {formatDate(order.paid_at)}</p>
                  )}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 bg-gray-800 rounded-lg text-white disabled:opacity-50"
          >
            Previous
          </button>
          
          <div className="flex gap-1">
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let page;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 h-10 rounded-lg font-medium ${
                    currentPage === page
                      ? 'bg-amber-500 text-black'
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 bg-gray-800 rounded-lg text-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Fraud Cleanup Modal */}
      {showFraudModal && fraudPreview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-5 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <h2 className="text-lg font-bold text-white">Fraud Cleanup Preview</h2>
              </div>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[50vh]">
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                <p className="text-red-400 font-medium">
                  {fraudPreview.total_will_reset} users will be reset to FREE
                </p>
                <p className="text-green-400 text-sm mt-1">
                  {fraudPreview.total_will_skip} legitimate users will be SKIPPED
                </p>
              </div>
              
              {fraudPreview.users_to_reset?.length > 0 && (
                <div className="mb-4">
                  <p className="text-white font-medium mb-2">Users to Reset:</p>
                  <div className="space-y-2">
                    {fraudPreview.users_to_reset.slice(0, 10).map((u, i) => (
                      <div key={i} className="p-2 rounded-lg bg-red-500/5 border border-red-500/20 text-sm">
                        <p className="text-white">{u.name}</p>
                        <p className="text-gray-400 text-xs">{u.email || u.mobile}</p>
                        <p className="text-red-400 text-xs">{u.current_plan} → explorer</p>
                      </div>
                    ))}
                    {fraudPreview.users_to_reset.length > 10 && (
                      <p className="text-gray-400 text-sm">
                        +{fraudPreview.users_to_reset.length - 10} more...
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {fraudPreview.users_to_skip?.length > 0 && (
                <div>
                  <p className="text-white font-medium mb-2">Users to SKIP (have legitimate payments):</p>
                  <div className="space-y-2">
                    {fraudPreview.users_to_skip.slice(0, 5).map((u, i) => (
                      <div key={i} className="p-2 rounded-lg bg-green-500/5 border border-green-500/20 text-sm">
                        <p className="text-white">{u.name}</p>
                        <p className="text-green-400 text-xs">Will keep: {u.current_plan}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => setShowFraudModal(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={executeFraudCleanup}
                disabled={cleanupLoading}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {cleanupLoading ? 'Processing...' : 'Execute Cleanup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRazorpaySubscriptions;
