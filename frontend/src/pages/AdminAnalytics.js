import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar, LineChart, Line
} from 'recharts';
import { 
  Users, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight,
  RefreshCw, Calendar, Download, Filter, ChevronRight,
  UserCheck, UserX, Crown, Zap, Star, Activity,
  IndianRupee, Coins, ShoppingCart, Gift, CreditCard,
  Clock, CheckCircle, Target, Award, BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfWeek, startOfMonth, startOfYear } from 'date-fns';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminAnalytics = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dateRange, setDateRange] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAnalytics = async (startDate = null, endDate = null, silent = false) => {
    if (!silent) setLoading(true);
    try {
      let url = `${API}/api/admin/analytics/comprehensive`;
      if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
      }
      const res = await axios.get(url);
      setData(res.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching analytics:', error);
      if (!silent) toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    const now = new Date();
    let start, end = now.toISOString();
    
    switch(range) {
      case 'today':
        start = new Date(now.setHours(0,0,0,0)).toISOString();
        break;
      case 'week':
        start = startOfWeek(now).toISOString();
        break;
      case 'month':
        start = startOfMonth(now).toISOString();
        break;
      case 'year':
        start = startOfYear(now).toISOString();
        break;
      case 'custom':
        if (customStart && customEnd) {
          fetchAnalytics(customStart, customEnd);
        }
        return;
      default:
        start = subDays(now, 30).toISOString();
    }
    fetchAnalytics(start, end);
  };

  const formatINR = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPRC = (value) => {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value) + ' PRC';
  };

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#6b7280'];

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading Analytics...</p>
        </div>
      </div>
    );
  }

  const redemption = data?.redemption || {};
  const users = data?.users || {};
  const prc = data?.prc_circulation || {};
  const charts = data?.charts || {};

  // Prepare chart data
  const userGrowthData = (charts.user_growth || []).map(item => ({
    date: item._id?.substring(5) || item._id,
    users: item.count
  }));

  const redemptionTrendData = (charts.redemption_trend || []).map(item => ({
    date: item._id?.substring(5) || item._id,
    prc: item.total_prc,
    inr: item.total_inr,
    count: item.count
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-purple-500" />
            Analytics Dashboard
          </h1>
          <p className="text-gray-400 text-sm mt-1">Comprehensive system analytics</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Range Buttons */}
          {['today', 'week', 'month', 'year'].map(range => (
            <Button
              key={range}
              size="sm"
              variant={dateRange === range ? 'default' : 'outline'}
              onClick={() => handleDateRangeChange(range)}
              className={dateRange === range ? 'bg-purple-600' : 'border-gray-700'}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Button>
          ))}
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchAnalytics()}
            className="border-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Custom Date Range */}
      <Card className="bg-gray-900/50 border-gray-800 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Calendar className="w-5 h-5 text-purple-400" />
          <span className="text-gray-400 text-sm">Custom Range:</span>
          <Input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="w-40 bg-gray-800 border-gray-700 text-white"
          />
          <span className="text-gray-500">to</span>
          <Input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="w-40 bg-gray-800 border-gray-700 text-white"
          />
          <Button
            size="sm"
            onClick={() => customStart && customEnd && fetchAnalytics(customStart, customEnd)}
            className="bg-purple-600 hover:bg-purple-700"
            disabled={!customStart || !customEnd}
          >
            Apply
          </Button>
        </div>
      </Card>

      {/* ===== PRC CIRCULATION SECTION ===== */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Coins className="w-5 h-5 text-amber-500" />
          PRC Circulation Overview
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total PRC in Wallets */}
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <Wallet className="w-8 h-8 text-amber-500" />
              <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded-full">Live</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatPRC(prc.total_in_wallets || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">Total in User Wallets</p>
            <p className="text-sm text-amber-400 mt-2 font-medium">{formatINR(prc.inr_value || 0)}</p>
          </Card>

          {/* Total Mined */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-white">{formatPRC(prc.total_mined || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">Total PRC Mined</p>
            <p className="text-sm text-blue-400 mt-2 font-medium">{formatINR((prc.total_mined || 0) * (prc.prc_rate || 2))}</p>
          </Card>

          {/* Total Circulated */}
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-white">{formatPRC(prc.total_circulated || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">Total Circulated</p>
            <p className="text-sm text-purple-400 mt-2 font-medium">{formatINR((prc.total_circulated || 0) * (prc.prc_rate || 2))}</p>
          </Card>

          {/* PRC Rate */}
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <IndianRupee className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-white">₹{prc.prc_rate || 2}</p>
            <p className="text-xs text-gray-400 mt-1">1 PRC = INR</p>
            <p className="text-sm text-emerald-400 mt-2 font-medium">Current Rate</p>
          </Card>
        </div>
      </div>

      {/* ===== PRC REDEMPTION SECTION ===== */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-emerald-500" />
          PRC Redemption Stats
        </h2>
        
        {/* Time Period Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Today', key: 'today', color: 'emerald' },
            { label: 'This Week', key: 'this_week', color: 'blue' },
            { label: 'This Month', key: 'this_month', color: 'purple' },
            { label: 'This Year', key: 'this_year', color: 'amber' },
            { label: 'All Time', key: 'all_time', color: 'gray' }
          ].map(period => {
            const stats = redemption[period.key] || {};
            return (
              <Card key={period.key} className="bg-gray-900/50 border-gray-700 p-4">
                <p className={`text-xs text-${period.color}-400 mb-2 font-medium`}>{period.label}</p>
                <p className="text-xl font-bold text-white">{formatPRC(stats.total_prc || 0)}</p>
                <p className="text-sm text-gray-400 mt-1">{formatINR(stats.prc_value_inr || 0)}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                  <span className="text-xs text-gray-500">{stats.total_count || 0} redemptions</span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Redemption Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Orders */}
          <Card className="bg-gray-900/50 border-gray-800 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-medium">Shopping Orders</p>
                <p className="text-xs text-gray-500">Product redemptions</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{formatPRC(redemption.all_time?.breakdown?.orders?.prc || 0)}</p>
            <p className="text-sm text-gray-400 mt-1">{redemption.all_time?.breakdown?.orders?.count || 0} orders</p>
          </Card>

          {/* Bill Payments */}
          <Card className="bg-gray-900/50 border-gray-800 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <CreditCard className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-medium">Bill Payments</p>
                <p className="text-xs text-gray-500">Recharges & bills</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{formatPRC(redemption.all_time?.breakdown?.bill_payments?.prc || 0)}</p>
            <p className="text-sm text-emerald-400 mt-1">{formatINR(redemption.all_time?.breakdown?.bill_payments?.inr || 0)} INR Value</p>
            <p className="text-sm text-gray-400">{redemption.all_time?.breakdown?.bill_payments?.count || 0} payments</p>
          </Card>

          {/* Gift Vouchers */}
          <Card className="bg-gray-900/50 border-gray-800 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Gift className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-white font-medium">Gift Vouchers</p>
                <p className="text-xs text-gray-500">Voucher redemptions</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{formatPRC(redemption.all_time?.breakdown?.gift_vouchers?.prc || 0)}</p>
            <p className="text-sm text-purple-400 mt-1">{formatINR(redemption.all_time?.breakdown?.gift_vouchers?.inr || 0)} INR Value</p>
            <p className="text-sm text-gray-400">{redemption.all_time?.breakdown?.gift_vouchers?.count || 0} vouchers</p>
          </Card>
        </div>
      </div>

      {/* ===== USER STATISTICS SECTION ===== */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          User Statistics
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Total Users */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-white">{users.total || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Total Users</p>
            <div className="flex items-center gap-1 mt-2 text-emerald-400 text-sm">
              <ArrowUpRight className="w-4 h-4" />
              <span>+{users.new_users?.today || 0} today</span>
            </div>
          </Card>

          {/* Active Users */}
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <UserCheck className="w-8 h-8 text-emerald-500" />
              <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-full">
                {users.active_percentage || 0}%
              </span>
            </div>
            <p className="text-3xl font-bold text-white">{users.active || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Active Users</p>
            <p className="text-xs text-emerald-400 mt-2">Last 7 days activity</p>
          </Card>

          {/* Inactive Users */}
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <UserX className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-white">{users.inactive || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Inactive Users</p>
            <p className="text-xs text-red-400 mt-2">No recent activity</p>
          </Card>

          {/* Paid Users */}
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <Crown className="w-8 h-8 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-white">{users.paid_users || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Paid Subscribers</p>
            <p className="text-xs text-amber-400 mt-2">{users.free_users || 0} free users</p>
          </Card>
        </div>

        {/* Plan Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pie Chart - Plan Distribution */}
          <Card className="bg-gray-900/50 border-gray-800 p-4">
            <h3 className="text-white font-medium mb-4">Plan Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.plan_distribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({name, value}) => `${value}`}
                    labelLine={false}
                  >
                    {(charts.plan_distribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Pie Chart - Active vs Inactive */}
          <Card className="bg-gray-900/50 border-gray-800 p-4">
            <h3 className="text-white font-medium mb-4">User Activity Status</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.activity_distribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({name, value, percent}) => `${value} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {(charts.activity_distribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Plan Breakdown Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          {[
            { name: 'Explorer', value: users.by_plan?.explorer || 0, color: 'gray', icon: Users },
            { name: 'Startup', value: users.by_plan?.startup || 0, color: 'blue', icon: Zap },
            { name: 'Growth', value: users.by_plan?.growth || 0, color: 'purple', icon: Star },
            { name: 'Elite', value: users.by_plan?.elite || 0, color: 'amber', icon: Crown }
          ].map(plan => {
            const Icon = plan.icon;
            return (
              <Card key={plan.name} className="bg-gray-800/50 border-gray-700 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 text-${plan.color}-400`} />
                  <span className="text-sm text-gray-400">{plan.name}</span>
                </div>
                <p className="text-2xl font-bold text-white">{plan.value}</p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ===== CHARTS SECTION ===== */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-500" />
          Trends & Analytics
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Growth Chart */}
          <Card className="bg-gray-900/50 border-gray-800 p-4">
            <h3 className="text-white font-medium mb-4">User Growth (Last 30 Days)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowthData}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="users" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUsers)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Redemption Trend Chart */}
          <Card className="bg-gray-900/50 border-gray-800 p-4">
            <h3 className="text-white font-medium mb-4">Redemption Trend (Last 30 Days)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={redemptionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value, name) => [name === 'prc' ? `${value} PRC` : `₹${value}`, name === 'prc' ? 'PRC Redeemed' : 'INR Value']}
                  />
                  <Bar dataKey="prc" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="inr" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* ===== TOP USERS SECTION ===== */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          Top Users by PRC Balance
        </h2>
        
        <Card className="bg-gray-900/50 border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">#</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Plan</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Balance</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">INR Value</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">KYC</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {(data?.top_users || []).map((topUser, index) => (
                  <tr key={topUser.uid} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-3 px-4">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-amber-500 text-black' :
                        index === 1 ? 'bg-gray-400 text-black' :
                        index === 2 ? 'bg-amber-700 text-white' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-white font-medium">{topUser.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{topUser.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        topUser.subscription_plan === 'elite' ? 'bg-amber-500/20 text-amber-400' :
                        topUser.subscription_plan === 'growth' ? 'bg-purple-500/20 text-purple-400' :
                        topUser.subscription_plan === 'startup' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {topUser.subscription_plan || 'Explorer'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-emerald-400 font-bold">{formatPRC(topUser.prc_balance || 0)}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-white">{formatINR((topUser.prc_balance || 0) * (prc.prc_rate || 2))}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        topUser.kyc_status === 'verified' ? 'bg-emerald-500/20 text-emerald-400' :
                        topUser.kyc_status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {topUser.kyc_status || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-700 h-7"
                        onClick={() => navigate(`/admin/user360/${topUser.uid}`)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Generated At */}
      <div className="text-center text-gray-500 text-xs">
        Last updated: {data?.generated_at ? new Date(data.generated_at).toLocaleString() : 'N/A'}
      </div>
    </div>
  );
};

export default AdminAnalytics;
