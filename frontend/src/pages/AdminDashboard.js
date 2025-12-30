import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { 
  Users, Package, CreditCard, FileText, 
  Search, BarChart3, TrendingUp, TrendingDown,
  Store, Award, ShoppingCart, Bell, Settings, DollarSign,
  ArrowUpRight, ArrowDownRight, Truck, Activity
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      {/* Dashboard Content - No sidebar, AdminLayout handles navigation */}
      {/* Hero Section with Search */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl mb-6 shadow-lg">
                <div className="absolute inset-0 bg-black opacity-10"></div>
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)'
                }}></div>
                
                <div className="relative z-10 p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <h1 className="text-2xl md:text-4xl font-bold text-white mb-1">
                        Welcome back, Admin!
                      </h1>
                      <p className="text-blue-100 text-sm md:text-lg">
                        Fast access dashboard - Everything you need at your fingertips
                      </p>
                    </div>
                    <div className="hidden md:block">
                      <div className="bg-white/20 backdrop-blur-lg rounded-xl p-4 border border-white/30">
                        <div className="flex items-center space-x-2">
                          <div className="h-10 w-10 rounded-full bg-green-400 flex items-center justify-center animate-pulse">
                            <Activity className="h-5 w-5 text-white" />
                          </div>
                          <div className="text-white">
                            <p className="text-xs opacity-90">System Status</p>
                            <p className="text-sm font-bold">Operational</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Quick Search Bar */}
                  <div className="max-w-2xl">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Quick search users, orders, transactions..."
                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/90 backdrop-blur-sm border-2 border-white/30 focus:border-white focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Approvals Alert Section */}
              {(stats?.vip_payments?.pending > 0 || stats?.kyc?.pending > 0 || stats?.stock_requests?.pending > 0) && (
                <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-amber-600 mt-0.5 animate-bounce" />
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-amber-900 mb-1">⚡ Action Required</h3>
                      <div className="flex flex-wrap gap-3 text-sm text-amber-800">
                        {stats?.vip_payments?.pending > 0 && (
                          <a href="/admin/vip-payments" className="hover:underline font-medium">
                            {stats.vip_payments.pending} VIP Payment{stats.vip_payments.pending > 1 ? 's' : ''} pending →
                          </a>
                        )}
                        {stats?.kyc?.pending > 0 && (
                          <a href="/admin/kyc" className="hover:underline font-medium">
                            {stats.kyc.pending} KYC pending →
                          </a>
                        )}
                        {stats?.stock_requests?.pending > 0 && (
                          <a href="/admin/stock-requests" className="hover:underline font-medium">
                            {stats.stock_requests.pending} Stock Request{stats.stock_requests.pending > 1 ? 's' : ''} pending →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Access Cards */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">⚡ Quick Access</h2>
                  <span className="text-sm text-gray-500">Click any card for instant access</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <a href="/admin/users" className="block">
                    <div className="p-4 bg-white hover:bg-purple-50 border-2 border-transparent hover:border-purple-300 rounded-xl shadow-sm transition-all group">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
                          <Users className="h-6 w-6 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Users</span>
                      </div>
                    </div>
                  </a>

                  <a href="/admin/marketplace" className="block">
                    <div className="p-4 bg-white hover:bg-blue-50 border-2 border-transparent hover:border-blue-300 rounded-xl shadow-sm transition-all group">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                          <Package className="h-6 w-6 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Products</span>
                      </div>
                    </div>
                  </a>

                  <a href="/admin/orders" className="block">
                    <div className="p-4 bg-white hover:bg-green-50 border-2 border-transparent hover:border-green-300 rounded-xl shadow-sm transition-all group">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-green-100 group-hover:bg-green-200 flex items-center justify-center transition-colors">
                          <ShoppingCart className="h-6 w-6 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Orders</span>
                      </div>
                    </div>
                  </a>

                  <a href="/admin/financial-management" className="block">
                    <div className="p-4 bg-white hover:bg-amber-50 border-2 border-transparent hover:border-amber-300 rounded-xl shadow-sm transition-all group">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                          <DollarSign className="h-6 w-6 text-amber-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Finance</span>
                      </div>
                    </div>
                  </a>

                  <a href="/admin/stockists" className="block">
                    <div className="p-4 bg-white hover:bg-indigo-50 border-2 border-transparent hover:border-indigo-300 rounded-xl shadow-sm transition-all group">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center transition-colors">
                          <Store className="h-6 w-6 text-indigo-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Stockists</span>
                      </div>
                    </div>
                  </a>

                  <a href="/admin/vip-payments" className="block">
                    <div className="p-4 bg-white hover:bg-pink-50 border-2 border-transparent hover:border-pink-300 rounded-xl shadow-sm transition-all group relative">
                      {stats?.vip_payments?.pending > 0 && (
                        <span className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce">
                          {stats.vip_payments.pending}
                        </span>
                      )}
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-pink-100 group-hover:bg-pink-200 flex items-center justify-center transition-colors">
                          <CreditCard className="h-6 w-6 text-pink-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">VIP Payments</span>
                      </div>
                    </div>
                  </a>

                  <a href="/admin/kyc" className="block">
                    <div className="p-4 bg-white hover:bg-orange-50 border-2 border-transparent hover:border-orange-300 rounded-xl shadow-sm transition-all group relative">
                      {stats?.kyc?.pending > 0 && (
                        <span className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce">
                          {stats.kyc.pending}
                        </span>
                      )}
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center transition-colors">
                          <FileText className="h-6 w-6 text-orange-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">KYC</span>
                      </div>
                    </div>
                  </a>

                  <a href="/admin/stock-requests" className="block">
                    <div className="p-4 bg-white hover:bg-teal-50 border-2 border-transparent hover:border-teal-300 rounded-xl shadow-sm transition-all group relative">
                      {stats?.stock_requests?.pending > 0 && (
                        <span className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce">
                          {stats.stock_requests.pending}
                        </span>
                      )}
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-teal-100 group-hover:bg-teal-200 flex items-center justify-center transition-colors">
                          <Truck className="h-6 w-6 text-teal-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Stock Requests</span>
                      </div>
                    </div>
                  </a>

                  <a href="/admin/bill-payments" className="block">
                    <div className="p-4 bg-white hover:bg-cyan-50 border-2 border-transparent hover:border-cyan-300 rounded-xl shadow-sm transition-all group">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-cyan-100 group-hover:bg-cyan-200 flex items-center justify-center transition-colors">
                          <CreditCard className="h-6 w-6 text-cyan-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Bill Payments</span>
                      </div>
                    </div>
                  </a>

                  <a href="/admin/gift-vouchers" className="block">
                    <div className="p-4 bg-white hover:bg-rose-50 border-2 border-transparent hover:border-rose-300 rounded-xl shadow-sm transition-all group">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-rose-100 group-hover:bg-rose-200 flex items-center justify-center transition-colors">
                          <Award className="h-6 w-6 text-rose-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Gift Vouchers</span>
                      </div>
                    </div>
                  </a>

                  <a href="/admin/analytics" className="block">
                    <div className="p-4 bg-white hover:bg-violet-50 border-2 border-transparent hover:border-violet-300 rounded-xl shadow-sm transition-all group">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center transition-colors">
                          <TrendingUp className="h-6 w-6 text-violet-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Analytics</span>
                      </div>
                    </div>
                  </a>

                  <a href="/admin/activity-logs" className="block">
                    <div className="p-4 bg-white hover:bg-slate-50 border-2 border-transparent hover:border-slate-300 rounded-xl shadow-sm transition-all group">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition-colors">
                          <Activity className="h-6 w-6 text-slate-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Activity Logs</span>
                      </div>
                    </div>
                  </a>
                </div>
              </div>

              {/* Key Metrics Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">📊 Key Metrics</h2>
                  <span className="text-sm text-gray-500">Real-time platform statistics</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm font-medium">Total Users</span>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stats?.users?.total?.toLocaleString() || '0'}
                  </div>
                  <div className="flex items-center text-sm text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span>VIP: {stats?.users?.vip || 0}</span>
                  </div>
                </Card>

                <Card className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm font-medium">VIP Users</span>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stats?.users?.vip?.toLocaleString() || '0'}
                  </div>
                  <div className="flex items-center text-sm text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span>Free: {stats?.users?.free || 0}</span>
                  </div>
                </Card>

                <Card className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm font-medium">KYC Pending</span>
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stats?.kyc?.pending?.toLocaleString() || '0'}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span>Verified: {stats?.kyc?.verified || 0}</span>
                  </div>
                </Card>

                <Card className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm font-medium">Total Orders</span>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stats?.orders?.total?.toLocaleString() || '0'}
                  </div>
                  <div className="flex items-center text-sm text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span>Delivered: {stats?.orders?.delivered || 0}</span>
                  </div>
                </Card>
              </div>

              {/* Additional Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
                <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100">
                  <div className="text-sm font-medium text-purple-600 mb-1">Master Stockists</div>
                  <div className="text-2xl font-bold text-purple-900">{stats?.users?.master_stockists || 0}</div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
                  <div className="text-sm font-medium text-blue-600 mb-1">Sub Stockists</div>
                  <div className="text-2xl font-bold text-blue-900">{stats?.users?.sub_stockists || 0}</div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100">
                  <div className="text-sm font-medium text-green-600 mb-1">Outlets</div>
                  <div className="text-2xl font-bold text-green-900">{stats?.users?.outlets || 0}</div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100">
                  <div className="text-sm font-medium text-yellow-600 mb-1">VIP Pending</div>
                  <div className="text-2xl font-bold text-yellow-900">{stats?.vip_payments?.pending || 0}</div>
                </Card>
              </div>

              {/* Comprehensive Financial KPIs */}
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Financial Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Total Security Deposits */}
                  <Card className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100">
                    <div className="flex items-center justify-between mb-2">
                      <DollarSign className="h-8 w-8 text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-200 px-2 py-1 rounded-full">
                        DEPOSITS
                      </span>
                    </div>
                    <div className="text-sm font-medium text-indigo-600 mb-1">Total Security Deposits</div>
                    <div className="text-2xl font-bold text-indigo-900">
                      ₹{((stats?.financial?.total_security_deposits || 0) / 100000).toFixed(2)}L
                    </div>
                    <div className="text-xs text-indigo-700 mt-2">
                      Approved: {stats?.security_deposits?.approved || 0}
                    </div>
                  </Card>

                  {/* Total Renewal Fees */}
                  <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100">
                    <div className="flex items-center justify-between mb-2">
                      <TrendingUp className="h-8 w-8 text-purple-600" />
                      <span className="text-xs font-semibold text-purple-600 bg-purple-200 px-2 py-1 rounded-full">
                        RENEWALS
                      </span>
                    </div>
                    <div className="text-sm font-medium text-purple-600 mb-1">Total Renewal Fees</div>
                    <div className="text-2xl font-bold text-purple-900">
                      ₹{((stats?.financial?.total_renewal_fees || 0) / 100000).toFixed(2)}L
                    </div>
                    <div className="text-xs text-purple-700 mt-2">
                      Active: {stats?.renewals?.active || 0} | Overdue: {stats?.renewals?.overdue || 0}
                    </div>
                  </Card>

                  {/* Total VIP Membership Fees */}
                  <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100">
                    <div className="flex items-center justify-between mb-2">
                      <Users className="h-8 w-8 text-amber-600" />
                      <span className="text-xs font-semibold text-amber-600 bg-amber-200 px-2 py-1 rounded-full">
                        VIP FEES
                      </span>
                    </div>
                    <div className="text-sm font-medium text-amber-600 mb-1">VIP Membership Fees</div>
                    <div className="text-2xl font-bold text-amber-900">
                      ₹{(stats?.financial?.total_vip_membership_fees || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-amber-700 mt-2">
                      VIP Users: {stats?.users?.vip || 0}
                    </div>
                  </Card>

                  {/* Total Redeem Value (PRC) */}
                  <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <Package className="h-8 w-8 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-600 bg-blue-200 px-2 py-1 rounded-full">
                        REDEEMS
                      </span>
                    </div>
                    <div className="text-sm font-medium text-blue-600 mb-1">Total Redeem Value</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {(stats?.financial?.total_revenue_prc || 0).toLocaleString()} PRC
                    </div>
                    <div className="text-xs text-blue-700 mt-2">
                      ≈ ₹{((stats?.financial?.total_prc_value_in_inr || 0)).toLocaleString()} INR
                    </div>
                  </Card>

                  {/* Total Revenue (INR) */}
                  <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <BarChart3 className="h-8 w-8 text-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-200 px-2 py-1 rounded-full">
                        REVENUE
                      </span>
                    </div>
                    <div className="text-sm font-medium text-emerald-600 mb-1">Total Revenue (Cash)</div>
                    <div className="text-2xl font-bold text-emerald-900">
                      ₹{((stats?.financial?.total_revenue_inr || 0) / 100000).toFixed(2)}L
                    </div>
                    <div className="text-xs text-emerald-700 mt-2">
                      From {stats?.orders?.delivered || 0} delivered orders
                    </div>
                  </Card>

                  {/* Total Lien */}
                  <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100">
                    <div className="flex items-center justify-between mb-2">
                      <Shield className="h-8 w-8 text-orange-600" />
                      <span className="text-xs font-semibold text-orange-600 bg-orange-200 px-2 py-1 rounded-full">
                        LIEN
                      </span>
                    </div>
                    <div className="text-sm font-medium text-orange-600 mb-1">Total Pending Lien</div>
                    <div className="text-2xl font-bold text-orange-900">
                      ₹{(stats?.financial?.total_lien || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-orange-700 mt-2">
                      Pending maintenance fees
                    </div>
                  </Card>

                  {/* Stock Movement Status */}
                  <Card className="p-6 bg-gradient-to-br from-teal-50 to-teal-100">
                    <div className="flex items-center justify-between mb-2">
                      <Truck className="h-8 w-8 text-teal-600" />
                      <span className="text-xs font-semibold text-teal-600 bg-teal-200 px-2 py-1 rounded-full">
                        STOCK
                      </span>
                    </div>
                    <div className="text-sm font-medium text-teal-600 mb-1">Stock Movements</div>
                    <div className="text-2xl font-bold text-teal-900">
                      {(stats?.stock_movements?.pending || 0) + (stats?.stock_movements?.approved || 0) + (stats?.stock_movements?.completed || 0)}
                    </div>
                    <div className="text-xs text-teal-700 mt-2">
                      Pending: {stats?.stock_movements?.pending || 0} | Completed: {stats?.stock_movements?.completed || 0}
                    </div>
                  </Card>
                </div>
              </div>

              {/* Chart and Fee Summary Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Summary Chart */}
                <Card className="p-6 bg-white lg:col-span-2">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Summary</h3>
                  <div className="h-64 flex items-end justify-around gap-2">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, idx) => (
                      <div key={month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end justify-center gap-1 h-48">
                          <div 
                            className="w-1/3 bg-indigo-600 rounded-t" 
                            style={{ height: `${40 + idx * 10}%` }}
                          ></div>
                          <div 
                            className="w-1/3 bg-indigo-400 rounded-t" 
                            style={{ height: `${30 + idx * 8}%` }}
                          ></div>
                          <div 
                            className="w-1/3 bg-pink-400 rounded-t" 
                            style={{ height: `${25 + idx * 7}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600 mt-2">{month}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-6">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-indigo-600 rounded"></div>
                      <span className="text-sm text-gray-600">Transactions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-indigo-400 rounded"></div>
                      <span className="text-sm text-gray-600">Redeems</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-pink-400 rounded"></div>
                      <span className="text-sm text-gray-600">Earnings</span>
                    </div>
                  </div>
                </Card>

                {/* Fee Summary */}
                <Card className="p-6 bg-white">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Fee Summary</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Membership Fees</span>
                      <span className="font-bold text-gray-900">
                        ₹{stats?.financial?.total_vip_membership_fees?.toLocaleString('en-IN') || '0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Wallet Maintenance Fees</span>
                      <span className="font-bold text-gray-900">
                        ₹{stats?.financial?.total_wallet_fees?.toLocaleString('en-IN') || '0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-gray-600">Delivery Charges</span>
                      <span className="font-bold text-gray-900">
                        ₹{stats?.financial?.total_marketplace_charges?.toLocaleString('en-IN') || '0'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Recently Paid VIP</h4>
                    <div className="space-y-3">
                      {stats?.recent_activity?.vip_payments && stats.recent_activity.vip_payments.length > 0 ? (
                        stats.recent_activity.vip_payments.map((payment, index) => (
                          <div key={index} className="flex items-center justify-between py-2">
                            <span className="text-gray-700">{payment.user_name}</span>
                            <span className="font-semibold text-gray-900">
                              ₹{payment.amount?.toLocaleString('en-IN') || '0'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm text-center py-4">No recent VIP payments</p>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  export default AdminDashboard;
