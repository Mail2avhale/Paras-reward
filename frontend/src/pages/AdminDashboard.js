import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, Package, CreditCard, FileText, Search, BarChart3, TrendingUp, 
  Store, Award, ShoppingCart, Bell, Settings, DollarSign, Truck, Activity,
  Shield, Wallet, AlertTriangle, Crown, RefreshCw, ChevronRight,
  UserCheck, Clock, CheckCircle, XCircle, Eye, ArrowUpRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [deliveryStats, setDeliveryStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [pendingKYC, setPendingKYC] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, deliveryRes, ordersRes, kycRes] = await Promise.all([
        axios.get(`${API}/api/admin/stats`).catch(() => ({ data: {} })),
        axios.get(`${API}/api/admin/delivery-partners/stats`).catch(() => ({ data: {} })),
        axios.get(`${API}/api/admin/orders?limit=5`).catch(() => ({ data: { orders: [] } })),
        axios.get(`${API}/api/admin/kyc?status=pending&limit=5`).catch(() => ({ data: { documents: [] } }))
      ]);
      
      setStats(statsRes.data);
      setDeliveryStats(deliveryRes.data);
      setRecentOrders(ordersRes.data.orders || []);
      setPendingKYC(kycRes.data.documents || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate subscription stats from users
  const subscriptionStats = {
    explorer: stats?.subscription_stats?.explorer || 0,
    startup: stats?.subscription_stats?.startup || 0,
    growth: stats?.subscription_stats?.growth || 0,
    elite: stats?.subscription_stats?.elite || 0
  };

  const totalPaidUsers = subscriptionStats.startup + subscriptionStats.growth + subscriptionStats.elite;

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm">Platform overview and quick actions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchAllData}
            className="text-gray-300 border-gray-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            System Online
          </div>
        </div>
      </div>

      {/* Action Required Alert */}
      {(stats?.kyc?.pending > 0 || deliveryStats?.pending_assignment > 0 || stats?.subscription_payments?.pending > 0) && (
        <Card className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-amber-500 animate-bounce" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-400 mb-2">⚡ Action Required</h3>
              <div className="flex flex-wrap gap-3">
                {stats?.kyc?.pending > 0 && (
                  <button 
                    onClick={() => navigate('/admin/kyc')}
                    className="text-sm text-amber-300 hover:text-amber-200 flex items-center gap-1"
                  >
                    <UserCheck className="w-4 h-4" />
                    {stats.kyc.pending} KYC Pending
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {deliveryStats?.pending_assignment > 0 && (
                  <button 
                    onClick={() => navigate('/admin/delivery-partners')}
                    className="text-sm text-amber-300 hover:text-amber-200 flex items-center gap-1"
                  >
                    <Truck className="w-4 h-4" />
                    {deliveryStats.pending_assignment} Orders Need Delivery Partner
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {stats?.subscription_payments?.pending > 0 && (
                  <button 
                    onClick={() => navigate('/admin/subscriptions')}
                    className="text-sm text-amber-300 hover:text-amber-200 flex items-center gap-1"
                  >
                    <CreditCard className="w-4 h-4" />
                    {stats.subscription_payments.pending} Payments to Verify
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/50 transition-colors cursor-pointer"
              onClick={() => navigate('/admin/users')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs mb-1">Total Users</p>
              <p className="text-2xl font-bold text-white">{stats?.users?.total?.toLocaleString() || 0}</p>
              <p className="text-xs text-blue-400 mt-1">+{stats?.users?.new_today || 0} today</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:border-purple-400/50 transition-colors cursor-pointer"
              onClick={() => navigate('/admin/subscriptions')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs mb-1">Paid Subscribers</p>
              <p className="text-2xl font-bold text-white">{totalPaidUsers.toLocaleString()}</p>
              <p className="text-xs text-purple-400 mt-1">
                {subscriptionStats.elite} Elite • {subscriptionStats.growth} Growth
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Crown className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-400/50 transition-colors cursor-pointer"
              onClick={() => navigate('/admin/prc-analytics')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs mb-1">Total PRC</p>
              <p className="text-2xl font-bold text-white">{(stats?.total_prc || 0).toLocaleString()}</p>
              <p className="text-xs text-emerald-400 mt-1">₹{((stats?.total_prc || 0) / 10).toLocaleString()} value</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-400/50 transition-colors cursor-pointer"
              onClick={() => navigate('/admin/orders')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-white">{stats?.orders?.total?.toLocaleString() || 0}</p>
              <p className="text-xs text-amber-400 mt-1">{stats?.orders?.pending || 0} pending</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-amber-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <QuickActionCard 
            icon={Users} 
            label="Users" 
            color="blue"
            onClick={() => navigate('/admin/users')}
          />
          <QuickActionCard 
            icon={Crown} 
            label="Subscriptions" 
            color="purple"
            onClick={() => navigate('/admin/subscriptions')}
          />
          <QuickActionCard 
            icon={FileText} 
            label="KYC" 
            badge={stats?.kyc?.pending}
            color="cyan"
            onClick={() => navigate('/admin/kyc')}
          />
          <QuickActionCard 
            icon={ShoppingCart} 
            label="Orders" 
            badge={stats?.orders?.pending}
            color="amber"
            onClick={() => navigate('/admin/orders')}
          />
          <QuickActionCard 
            icon={Truck} 
            label="Delivery" 
            badge={deliveryStats?.pending_assignment}
            color="emerald"
            onClick={() => navigate('/admin/delivery-partners')}
          />
          <QuickActionCard 
            icon={Store} 
            label="Marketplace" 
            color="pink"
            onClick={() => navigate('/admin/marketplace')}
          />
          <QuickActionCard 
            icon={BarChart3} 
            label="Analytics" 
            color="indigo"
            onClick={() => navigate('/admin/analytics')}
          />
          <QuickActionCard 
            icon={Wallet} 
            label="Wallets" 
            color="teal"
            onClick={() => navigate('/admin/company-wallets')}
          />
          <QuickActionCard 
            icon={Shield} 
            label="Security" 
            color="red"
            onClick={() => navigate('/admin/security')}
          />
          <QuickActionCard 
            icon={AlertTriangle} 
            label="PRC Controls" 
            color="orange"
            onClick={() => navigate('/admin/prc-economy')}
          />
          <QuickActionCard 
            icon={Activity} 
            label="Accounting" 
            color="lime"
            onClick={() => navigate('/admin/accounting')}
          />
          <QuickActionCard 
            icon={Settings} 
            label="Settings" 
            color="gray"
            onClick={() => navigate('/admin/settings/system')}
          />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Recent Orders</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/admin/orders')}
              className="text-blue-400 hover:text-blue-300"
            >
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.slice(0, 5).map((order) => (
                <div key={order.order_id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      order.status === 'delivered' ? 'bg-emerald-500/20' :
                      order.status === 'out_for_delivery' ? 'bg-blue-500/20' :
                      order.status === 'cancelled' ? 'bg-red-500/20' : 'bg-amber-500/20'
                    }`}>
                      {order.status === 'delivered' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> :
                       order.status === 'out_for_delivery' ? <Truck className="w-5 h-5 text-blue-400" /> :
                       order.status === 'cancelled' ? <XCircle className="w-5 h-5 text-red-400" /> :
                       <Clock className="w-5 h-5 text-amber-400" />}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">#{order.order_id?.slice(0, 8)}</p>
                      <p className="text-gray-400 text-xs">{order.items?.length || 0} items</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm font-medium">{order.total_prc?.toLocaleString()} PRC</p>
                    <p className={`text-xs ${
                      order.status === 'delivered' ? 'text-emerald-400' :
                      order.status === 'cancelled' ? 'text-red-400' : 'text-amber-400'
                    }`}>{order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Pending KYC */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Pending KYC</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/admin/kyc')}
              className="text-blue-400 hover:text-blue-300"
            >
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          {pendingKYC.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No pending KYC</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingKYC.slice(0, 5).map((kyc) => (
                <div key={kyc.document_id || kyc._id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{kyc.user_name || 'Unknown'}</p>
                      <p className="text-gray-400 text-xs">{kyc.document_type || 'Document'}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/admin/kyc')}
                    className="text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Review
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Subscription Distribution */}
      <Card className="p-4">
        <h3 className="font-semibold text-white mb-4">Subscription Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SubscriptionCard 
            plan="Explorer" 
            count={subscriptionStats.explorer} 
            color="gray" 
            price="Free"
          />
          <SubscriptionCard 
            plan="Startup" 
            count={subscriptionStats.startup} 
            color="blue" 
            price="₹299/mo"
          />
          <SubscriptionCard 
            plan="Growth" 
            count={subscriptionStats.growth} 
            color="purple" 
            price="₹549/mo"
          />
          <SubscriptionCard 
            plan="Elite" 
            count={subscriptionStats.elite} 
            color="amber" 
            price="₹799/mo"
          />
        </div>
      </Card>

      {/* Delivery Stats */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Delivery Overview</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/admin/delivery-partners')}
            className="text-blue-400 hover:text-blue-300"
          >
            Manage Partners <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-gray-800/50 rounded-lg">
            <p className="text-2xl font-bold text-white">{deliveryStats?.total_partners || 0}</p>
            <p className="text-xs text-gray-400">Partners</p>
          </div>
          <div className="text-center p-3 bg-gray-800/50 rounded-lg">
            <p className="text-2xl font-bold text-emerald-400">{deliveryStats?.active_partners || 0}</p>
            <p className="text-xs text-gray-400">Active</p>
          </div>
          <div className="text-center p-3 bg-gray-800/50 rounded-lg">
            <p className="text-2xl font-bold text-purple-400">{deliveryStats?.verified_partners || 0}</p>
            <p className="text-xs text-gray-400">Verified</p>
          </div>
          <div className="text-center p-3 bg-gray-800/50 rounded-lg">
            <p className="text-2xl font-bold text-amber-400">{deliveryStats?.pending_assignment || 0}</p>
            <p className="text-xs text-gray-400">Pending</p>
          </div>
          <div className="text-center p-3 bg-gray-800/50 rounded-lg">
            <p className="text-2xl font-bold text-blue-400">{deliveryStats?.out_for_delivery || 0}</p>
            <p className="text-xs text-gray-400">In Transit</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Quick Action Card Component
const QuickActionCard = ({ icon: Icon, label, badge, color, onClick }) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-400',
    cyan: 'bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400',
    pink: 'bg-pink-500/10 border-pink-500/30 hover:bg-pink-500/20 text-pink-400',
    indigo: 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400',
    teal: 'bg-teal-500/10 border-teal-500/30 hover:bg-teal-500/20 text-teal-400',
    red: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20 text-red-400',
    orange: 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 text-orange-400',
    lime: 'bg-lime-500/10 border-lime-500/30 hover:bg-lime-500/20 text-lime-400',
    gray: 'bg-gray-500/10 border-gray-500/30 hover:bg-gray-500/20 text-gray-400',
  };

  return (
    <button
      onClick={onClick}
      className={`relative p-4 rounded-xl border transition-all ${colorClasses[color]} text-center`}
      data-testid={`quick-action-${label.toLowerCase().replace(' ', '-')}`}
    >
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <Icon className="w-6 h-6 mx-auto mb-2" />
      <p className="text-xs font-medium">{label}</p>
    </button>
  );
};

// Subscription Card Component
const SubscriptionCard = ({ plan, count, color, price }) => {
  const colorClasses = {
    gray: 'border-gray-500/30 bg-gray-500/10',
    blue: 'border-blue-500/30 bg-blue-500/10',
    purple: 'border-purple-500/30 bg-purple-500/10',
    amber: 'border-amber-500/30 bg-amber-500/10',
  };

  const textColors = {
    gray: 'text-gray-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${textColors[color]}`}>{plan}</span>
        <span className="text-xs text-gray-500">{price}</span>
      </div>
      <p className="text-2xl font-bold text-white">{count.toLocaleString()}</p>
      <p className="text-xs text-gray-500">users</p>
    </div>
  );
};

export default AdminDashboard;
