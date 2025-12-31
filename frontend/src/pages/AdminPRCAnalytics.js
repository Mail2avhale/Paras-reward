import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import {
  TrendingUp, TrendingDown, Coins, Flame, ShoppingCart, Users,
  DollarSign, Activity, RefreshCw, Calendar, ArrowUpRight, ArrowDownRight,
  Zap, Target, PieChart as PieChartIcon, BarChart2, Wallet, Award
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#84cc16'];

const AdminPRCAnalytics = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/admin/prc-analytics/detailed?period=${period}`);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toFixed(2) || '0';
  };

  const StatCard = ({ title, value, change, icon: Icon, color, prefix = '', suffix = '' }) => (
    <Card className={`p-5 bg-gradient-to-br ${color} border-0 shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">
            {prefix}{formatNumber(value)}{suffix}
          </p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${change >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              <span>{Math.abs(change)}% vs prev period</span>
            </div>
          )}
        </div>
        <div className="p-3 bg-white/20 rounded-xl">
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </Card>
  );

  const periodLabels = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year'
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading PRC Analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No analytics data available</p>
          <Button onClick={fetchAnalytics} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </Card>
      </div>
    );
  }

  const { summary, users: userData, chart_data, usage_breakdown, source_breakdown, health_score } = data;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PRC Analytics Dashboard</h1>
          <p className="text-gray-500">Comprehensive PRC flow analysis and profit/loss tracking</p>
        </div>
        <div className="flex items-center gap-2">
          {['day', 'week', 'month', 'year'].map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              onClick={() => setPeriod(p)}
              size="sm"
              className={period === p ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
          <Button onClick={fetchAnalytics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Health Score */}
      <Card className="p-6 bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold opacity-90">Platform Health Score</h2>
            <p className="text-4xl font-bold mt-2">{health_score}/100</p>
            <p className="text-sm opacity-80 mt-1">
              {health_score >= 70 ? 'Excellent - PRC economy is healthy' :
               health_score >= 50 ? 'Good - Balanced PRC flow' :
               health_score >= 30 ? 'Fair - Monitor burn rate' : 'Critical - Review PRC creation'}
            </p>
          </div>
          <div className="relative w-32 h-32">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle cx="64" cy="64" r="56" stroke="rgba(255,255,255,0.2)" strokeWidth="12" fill="none" />
              <circle cx="64" cy="64" r="56" stroke="white" strokeWidth="12" fill="none"
                strokeDasharray={`${health_score * 3.52} 352`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Target className="h-10 w-10 opacity-80" />
            </div>
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={`PRC Created (${periodLabels[period]})`}
          value={summary.prc_created}
          change={summary.prc_created_change}
          icon={Coins}
          color="from-green-500 to-emerald-600"
        />
        <StatCard
          title={`PRC Used (${periodLabels[period]})`}
          value={summary.prc_used}
          change={summary.prc_used_change}
          icon={ShoppingCart}
          color="from-blue-500 to-indigo-600"
        />
        <StatCard
          title={`PRC Burned (${periodLabels[period]})`}
          value={summary.prc_burned}
          change={summary.prc_burned_change}
          icon={Flame}
          color="from-orange-500 to-red-600"
        />
        <StatCard
          title="Net PRC Flow"
          value={summary.net_prc_flow}
          icon={summary.net_prc_flow >= 0 ? TrendingUp : TrendingDown}
          color={summary.net_prc_flow >= 0 ? "from-teal-500 to-cyan-600" : "from-red-500 to-rose-600"}
          prefix={summary.net_prc_flow >= 0 ? '+' : ''}
        />
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="PRC In Circulation"
          value={summary.prc_in_circulation}
          icon={Wallet}
          color="from-violet-500 to-purple-600"
        />
        <StatCard
          title="Platform Profit/Loss"
          value={summary.profit_loss}
          change={summary.profit_loss_change}
          icon={summary.profit_loss >= 0 ? TrendingUp : TrendingDown}
          color={summary.profit_loss >= 0 ? "from-green-600 to-emerald-700" : "from-red-600 to-rose-700"}
          prefix={summary.profit_loss >= 0 ? '+' : ''}
        />
        <StatCard
          title="VIP Revenue"
          value={summary.vip_revenue}
          change={summary.vip_revenue_change}
          icon={DollarSign}
          color="from-amber-500 to-orange-600"
          prefix="₹"
        />
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <Users className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{userData.total}</p>
          <p className="text-sm text-gray-500">Total Users</p>
        </Card>
        <Card className="p-4 text-center">
          <Award className="h-8 w-8 text-amber-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{userData.vip}</p>
          <p className="text-sm text-gray-500">VIP Members</p>
        </Card>
        <Card className="p-4 text-center">
          <Users className="h-8 w-8 text-gray-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{userData.free}</p>
          <p className="text-sm text-gray-500">Free Users</p>
        </Card>
        <Card className="p-4 text-center">
          <Coins className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{formatNumber(userData.avg_balance)}</p>
          <p className="text-sm text-gray-500">Avg Balance/User</p>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PRC Flow Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-purple-600" />
            PRC Flow Over Time
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chart_data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                formatter={(value) => [value.toFixed(2) + ' PRC', '']}
              />
              <Legend />
              <Bar dataKey="created" name="Created" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="used" name="Used" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="burned" name="Burned" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* Cumulative Area Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Cumulative PRC Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chart_data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                formatter={(value) => [value.toFixed(2) + ' PRC', '']}
              />
              <Legend />
              <Area type="monotone" dataKey="created" name="Created" stroke="#10b981" fill="#10b98133" stackId="1" />
              <Area type="monotone" dataKey="used" name="Used" stroke="#3b82f6" fill="#3b82f633" stackId="2" />
              <Area type="monotone" dataKey="burned" name="Burned" stroke="#ef4444" fill="#ef444433" stackId="3" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PRC Usage Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-purple-600" />
            PRC Usage Breakdown
          </h3>
          {usage_breakdown.length > 0 ? (
            <div className="flex items-center">
              <ResponsiveContainer width="50%" height={250}>
                <PieChart>
                  <Pie
                    data={usage_breakdown}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {usage_breakdown.map((entry, index) => (
                      <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value.toFixed(2) + ' PRC', '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-1/2 space-y-2">
                {usage_breakdown.map((item, index) => (
                  <div key={item.category} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-gray-700">{item.category}</span>
                    </div>
                    <span className="font-semibold">{formatNumber(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <PieChartIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No usage data for this period</p>
            </div>
          )}
        </Card>

        {/* PRC Source Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            PRC Source Breakdown
          </h3>
          {source_breakdown.length > 0 ? (
            <div className="flex items-center">
              <ResponsiveContainer width="50%" height={250}>
                <PieChart>
                  <Pie
                    data={source_breakdown}
                    dataKey="amount"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {source_breakdown.map((entry, index) => (
                      <Cell key={entry.source} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value.toFixed(2) + ' PRC', '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-1/2 space-y-2">
                {source_breakdown.map((item, index) => (
                  <div key={item.source} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[(index + 3) % COLORS.length] }} />
                      <span className="text-gray-700">{item.source}</span>
                    </div>
                    <span className="font-semibold">{formatNumber(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Zap className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No source data for this period</p>
            </div>
          )}
        </Card>
      </div>

      {/* Summary Table */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Period Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Metric</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">{periodLabels[period]}</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Change</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-green-600" /> PRC Created
                </td>
                <td className="py-3 px-4 text-right font-semibold">{summary.prc_created.toLocaleString()}</td>
                <td className={`py-3 px-4 text-right ${summary.prc_created_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.prc_created_change >= 0 ? '+' : ''}{summary.prc_created_change}%
                </td>
              </tr>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-blue-600" /> PRC Used
                </td>
                <td className="py-3 px-4 text-right font-semibold">{summary.prc_used.toLocaleString()}</td>
                <td className={`py-3 px-4 text-right ${summary.prc_used_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.prc_used_change >= 0 ? '+' : ''}{summary.prc_used_change}%
                </td>
              </tr>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-600" /> PRC Burned
                </td>
                <td className="py-3 px-4 text-right font-semibold">{summary.prc_burned.toLocaleString()}</td>
                <td className={`py-3 px-4 text-right ${summary.prc_burned_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.prc_burned_change >= 0 ? '+' : ''}{summary.prc_burned_change}%
                </td>
              </tr>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-purple-600" /> In Circulation
                </td>
                <td className="py-3 px-4 text-right font-semibold">{summary.prc_in_circulation.toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-gray-400">-</td>
              </tr>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-amber-600" /> VIP Revenue
                </td>
                <td className="py-3 px-4 text-right font-semibold">₹{summary.vip_revenue.toLocaleString()}</td>
                <td className={`py-3 px-4 text-right ${summary.vip_revenue_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.vip_revenue_change >= 0 ? '+' : ''}{summary.vip_revenue_change}%
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="py-3 px-4 flex items-center gap-2 font-bold">
                  {summary.profit_loss >= 0 ? 
                    <TrendingUp className="h-4 w-4 text-green-600" /> : 
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  } 
                  Profit/Loss
                </td>
                <td className={`py-3 px-4 text-right font-bold ${summary.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.profit_loss >= 0 ? '+' : ''}{summary.profit_loss.toLocaleString()}
                </td>
                <td className={`py-3 px-4 text-right ${summary.profit_loss_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.profit_loss_change >= 0 ? '+' : ''}{summary.profit_loss_change}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminPRCAnalytics;
