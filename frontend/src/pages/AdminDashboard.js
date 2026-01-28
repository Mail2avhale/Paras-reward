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
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import NotificationBell from '@/components/NotificationBell';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [deliveryStats, setDeliveryStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [pendingKYC, setPendingKYC] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Chart data states
  const [userGrowthData, setUserGrowthData] = useState([]);
  const [prcData, setPrcData] = useState([]);
  const [ordersData, setOrdersData] = useState([]);
  const [subscriptionData, setSubscriptionData] = useState({ distribution: [], trend: [] });
  const [chartsLoading, setChartsLoading] = useState(true);

  // OPTIMIZED: Single API call for all dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    setChartsLoading(true);
    try {
      // Try combined API first (faster - single request)
      const combinedRes = await axios.get(`${API}/api/admin/dashboard-all`).catch(() => null);
      
      if (combinedRes?.data?.stats) {
        // Use combined data
        setStats(combinedRes.data.stats);
        setRecentOrders(combinedRes.data.recent_orders || []);
        setUserGrowthData(combinedRes.data.charts?.user_growth || []);
        // Set delivery stats from combined
        setDeliveryStats({ total_partners: combinedRes.data.delivery_partners_count || 0 });
        setPendingKYC([]); // Will be fetched separately if needed
      } else {
        // Fallback to individual calls
        await fetchAllDataLegacy();
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      // Fallback
      await fetchAllDataLegacy();
    } finally {
      setLoading(false);
      setChartsLoading(false);
    }
  };

  // Legacy fetch (fallback)
  const fetchAllDataLegacy = async () => {
    try {
      const [statsRes, deliveryRes, ordersRes, kycRes] = await Promise.all([
        axios.get(`${API}/api/admin/stats`).catch(() => ({ data: {} })),
        axios.get(`${API}/api/admin/delivery-partners/stats`).catch(() => ({ data: {} })),
        axios.get(`${API}/api/admin/orders/all?limit=5`).catch(() => ({ data: { orders: [] } })),
        axios.get(`${API}/api/kyc/list`).catch(() => ({ data: [] }))
      ]);
      
      setStats(statsRes.data);
      setDeliveryStats(deliveryRes.data);
      setRecentOrders(ordersRes.data.orders || []);
      const allKyc = Array.isArray(kycRes.data) ? kycRes.data : [];
      const pendingKycDocs = allKyc.filter(k => k.status === 'pending').slice(0, 5);
      setPendingKYC(pendingKycDocs);
    } catch (error) {
      console.error('Error in legacy fetch:', error);
    }
  };

  const fetchChartData = async () => {
    // Charts are now included in combined API, this is fallback only
    if (userGrowthData.length > 0) return; // Skip if already loaded
    
    setChartsLoading(true);
    try {
      const [userGrowth, prc, orders, subs] = await Promise.all([
        axios.get(`${API}/api/admin/charts/user-growth`).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/api/admin/charts/prc-circulation`).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/api/admin/charts/orders`).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/api/admin/charts/subscriptions`).catch(() => ({ data: { distribution: [], trend: [] } }))
      ]);
      
      setUserGrowthData(userGrowth.data.data || []);
      setPrcData(prc.data.data || []);
      setOrdersData(orders.data.data || []);
      setSubscriptionData(subs.data);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setChartsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 2 minutes (increased for better performance)
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 120000);
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

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-gray-400 text-xs mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm">Platform overview and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell user={user} />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { fetchAllData(); fetchChartData(); }}
            className="text-gray-300 border-gray-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading || chartsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Live Data
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
                  <button onClick={() => navigate('/admin/kyc')} className="text-sm text-amber-300 hover:text-amber-200 flex items-center gap-1">
                    <UserCheck className="w-4 h-4" /> {stats.kyc.pending} KYC Pending <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {deliveryStats?.pending_assignment > 0 && (
                  <button onClick={() => navigate('/admin/delivery-partners')} className="text-sm text-amber-300 hover:text-amber-200 flex items-center gap-1">
                    <Truck className="w-4 h-4" /> {deliveryStats.pending_assignment} Orders Need Partner <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {stats?.subscription_payments?.pending > 0 && (
                  <button onClick={() => navigate('/admin/subscriptions')} className="text-sm text-amber-300 hover:text-amber-200 flex items-center gap-1">
                    <CreditCard className="w-4 h-4" /> {stats.subscription_payments.pending} Payments Pending <ChevronRight className="w-4 h-4" />
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
              <p className="text-xs text-purple-400 mt-1">{subscriptionStats.elite} Elite • {subscriptionStats.growth} Growth</p>
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

      {/* Charts Row 1 - User Growth & PRC Circulation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              User Growth (30 Days)
            </h3>
          </div>
          <div className="h-64">
            {chartsLoading ? (
              <div className="h-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowthData}>
                  <defs>
                    <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="users" name="New Users" stroke="#3b82f6" fill="url(#userGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* PRC Circulation Chart */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              PRC Flow (30 Days)
            </h3>
          </div>
          <div className="h-64">
            {chartsLoading ? (
              <div className="h-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={prcData}>
                  <defs>
                    <linearGradient id="earnedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="spentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="earned" name="Earned" stroke="#10b981" fill="url(#earnedGradient)" strokeWidth={2} />
                  <Area type="monotone" dataKey="spent" name="Spent" stroke="#ef4444" fill="url(#spentGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Charts Row 2 - Orders & Subscription Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders Chart */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-400" />
              Orders (30 Days)
            </h3>
          </div>
          <div className="h-64">
            {chartsLoading ? (
              <div className="h-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="orders" name="Total Orders" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delivered" name="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Subscription Distribution */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-400" />
              Subscription Distribution
            </h3>
          </div>
          <div className="h-64 flex items-center">
            {chartsLoading ? (
              <div className="w-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
              </div>
            ) : (
              <div className="flex w-full">
                <div className="w-1/2">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={subscriptionData.distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {subscriptionData.distribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 flex flex-col justify-center space-y-2">
                  {subscriptionData.distribution.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                        <span className="text-gray-400 text-sm">{item.name}</span>
                      </div>
                      <span className="text-white font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
          <QuickActionCard icon={Users} label="Users" color="blue" onClick={() => navigate('/admin/users')} />
          <QuickActionCard icon={Crown} label="Subs" color="purple" onClick={() => navigate('/admin/subscriptions')} />
          <QuickActionCard icon={FileText} label="KYC" badge={stats?.kyc?.pending} color="cyan" onClick={() => navigate('/admin/kyc')} />
          <QuickActionCard icon={ShoppingCart} label="Orders" badge={stats?.orders?.pending} color="amber" onClick={() => navigate('/admin/orders')} />
          <QuickActionCard icon={Truck} label="Delivery" badge={deliveryStats?.pending_assignment} color="emerald" onClick={() => navigate('/admin/delivery-partners')} />
          <QuickActionCard icon={Store} label="Market" color="pink" onClick={() => navigate('/admin/marketplace')} />
          <QuickActionCard icon={BarChart3} label="Analytics" color="indigo" onClick={() => navigate('/admin/analytics')} />
          <QuickActionCard icon={Wallet} label="Wallets" color="teal" onClick={() => navigate('/admin/company-wallets')} />
          <QuickActionCard icon={Shield} label="Security" color="red" onClick={() => navigate('/admin/security')} />
          <QuickActionCard icon={AlertTriangle} label="PRC Ctrl" color="orange" onClick={() => navigate('/admin/prc-economy')} />
          <QuickActionCard icon={Activity} label="Account" color="lime" onClick={() => navigate('/admin/accounting')} />
          <QuickActionCard icon={Settings} label="Settings" color="gray" onClick={() => navigate('/admin/settings/system')} />
        </div>
      </div>

      {/* Recent Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Recent Orders</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/orders')} className="text-blue-400 hover:text-blue-300">
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No orders yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.slice(0, 5).map((order) => (
                <div key={order.order_id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      order.status === 'delivered' ? 'bg-emerald-500/20' :
                      order.status === 'out_for_delivery' ? 'bg-blue-500/20' :
                      order.status === 'cancelled' ? 'bg-red-500/20' : 'bg-amber-500/20'
                    }`}>
                      {order.status === 'delivered' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
                       order.status === 'out_for_delivery' ? <Truck className="w-4 h-4 text-blue-400" /> :
                       order.status === 'cancelled' ? <XCircle className="w-4 h-4 text-red-400" /> :
                       <Clock className="w-4 h-4 text-amber-400" />}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">#{order.order_id?.slice(0, 8)}</p>
                      <p className="text-gray-500 text-xs">{order.items?.length || 0} items</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm">{order.total_prc?.toLocaleString()} PRC</p>
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

        {/* Delivery Overview */}
        <Card className="p-4 bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-400" />
              Delivery Partners
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/delivery-partners')} className="text-emerald-400 hover:text-emerald-300">
              Manage <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div className="text-center p-3 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-lg border border-blue-500/20">
              <p className="text-xl font-bold text-blue-400">{deliveryStats?.total_partners || 0}</p>
              <p className="text-xs text-blue-300/70">Partners</p>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-lg border border-emerald-500/20">
              <p className="text-xl font-bold text-emerald-400">{deliveryStats?.active_partners || 0}</p>
              <p className="text-xs text-emerald-300/70">Active</p>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-lg border border-purple-500/20">
              <p className="text-xl font-bold text-purple-400">{deliveryStats?.verified_partners || 0}</p>
              <p className="text-xs text-purple-300/70">Verified</p>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-lg border border-amber-500/20">
              <p className="text-xl font-bold text-amber-400">{deliveryStats?.pending_assignment || 0}</p>
              <p className="text-xs text-amber-300/70">Pending</p>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 rounded-lg border border-cyan-500/20">
              <p className="text-xl font-bold text-cyan-400">{deliveryStats?.out_for_delivery || 0}</p>
              <p className="text-xs text-cyan-300/70">In Transit</p>
            </div>
          </div>
          
          {/* Pending KYC Preview */}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-400">Pending KYC</h4>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/kyc')} className="text-cyan-400 hover:text-cyan-300 text-xs">
                View All
              </Button>
            </div>
            {pendingKYC.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No pending KYC</p>
            ) : (
              <div className="space-y-2">
                {pendingKYC.slice(0, 3).map((kyc) => (
                  <div key={kyc.document_id || kyc._id} className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-cyan-400" />
                      <span className="text-white text-sm">{kyc.user_name || 'Unknown'}</span>
                    </div>
                    <span className="text-gray-500 text-xs">{kyc.document_type || 'Document'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

// Quick Action Card Component
const QuickActionCard = ({ icon: Icon, label, badge, color, onClick }) => {
  const colorClasses = {
    blue: 'bg-blue-500/10/10 border-blue-500/20 hover:bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/10/10 border-purple-500/20 hover:bg-purple-500/20 text-purple-400',
    emerald: 'bg-emerald-500/10/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/10/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-400',
    cyan: 'bg-cyan-500/10/10 border-cyan-500/20 hover:bg-cyan-500/20 text-cyan-400',
    pink: 'bg-pink-500/10/10 border-pink-500/20 hover:bg-pink-500/20 text-pink-400',
    indigo: 'bg-indigo-500/10/10 border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400',
    teal: 'bg-teal-500/10/10 border-teal-500/20 hover:bg-teal-500/20 text-teal-400',
    red: 'bg-red-500/10/10 border-red-500/20 hover:bg-red-500/20 text-red-400',
    orange: 'bg-orange-500/10/10 border-orange-500/20 hover:bg-orange-500/20 text-orange-400',
    lime: 'bg-lime-500/10 border-lime-500/20 hover:bg-lime-500/20 text-lime-400',
    gray: 'bg-gray-800/500/10 border-gray-500/20 hover:bg-gray-800/500/20 text-gray-400',
  };

  return (
    <button
      onClick={onClick}
      className={`relative p-2 rounded-lg border transition-all ${colorClasses[color]} text-center`}
      data-testid={`quick-action-${label.toLowerCase()}`}
    >
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500/10 text-white text-[10px] rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <Icon className="w-5 h-5 mx-auto mb-1" />
      <p className="text-[10px] font-medium truncate">{label}</p>
    </button>
  );
};

export default AdminDashboard;
