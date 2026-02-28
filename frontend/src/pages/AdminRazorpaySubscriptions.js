import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, CreditCard, CheckCircle, Clock, XCircle, 
  TrendingUp, Users, IndianRupee, RefreshCw, Search,
  Filter, Calendar, ChevronDown
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

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

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
    </div>
  );
};

export default AdminRazorpaySubscriptions;
