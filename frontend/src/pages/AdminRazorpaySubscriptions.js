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

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.user_name?.toLowerCase().includes(query) ||
      order.user_email?.toLowerCase().includes(query) ||
      order.order_id?.toLowerCase().includes(query) ||
      order.payment_id?.toLowerCase().includes(query)
    );
  });

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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800 px-5 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-400">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Razorpay Subscriptions</h1>
            <p className="text-xs text-gray-500">Live payment gateway transactions</p>
          </div>
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

      {/* Fraud Cleanup Button */}
      {stats.paid_orders > 0 && (
        <div className="px-5 mt-4">
          <button
            onClick={previewFraudCleanup}
            disabled={cleanupLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
          >
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">
              {cleanupLoading ? 'Loading...' : `Cleanup Fraud Subscriptions (${stats.paid_orders} paid)`}
            </span>
          </button>
        </div>
      )}

      {/* Delete Buttons */}
      <div className="px-5 mt-3 flex gap-2">
        {stats.pending_orders > 0 && (
          <button
            onClick={deletePendingOrders}
            disabled={cleanupLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all text-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Pending ({stats.pending_orders})</span>
          </button>
        )}
        
        {stats.total_orders > 0 && (
          <button
            onClick={deleteAllOrders}
            disabled={cleanupLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 transition-all text-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete All ({stats.total_orders})</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="px-5 mt-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, email, order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'All', count: stats.total_orders },
            { id: 'paid', label: 'Paid', count: stats.paid_orders },
            { id: 'created', label: 'Pending', count: stats.pending_orders },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === filter.id
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {filter.label} ({filter.count || 0})
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
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No orders found</p>
          </div>
        ) : (
          filteredOrders.map((order, index) => (
            <motion.div
              key={order.order_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`p-4 rounded-2xl border ${
                order.status === 'paid'
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-gray-900/50 border-gray-800'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-white">{order.user_name}</p>
                  <p className="text-sm text-gray-400">{order.user_email || order.user_mobile}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                  order.status === 'paid'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {order.status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                </span>
              </div>
              
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
