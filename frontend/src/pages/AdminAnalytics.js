import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, ShoppingCart, DollarSign, Download, Calendar } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { StatsSkeleton, ChartSkeleton } from '@/components/skeletons';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

function AdminAnalytics({ user, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [revenueTrends, setRevenueTrends] = useState([]);
  const [userGrowth, setUserGrowth] = useState([]);
  const [productPerformance, setProductPerformance] = useState([]);
  const [withdrawalPatterns, setWithdrawalPatterns] = useState([]);
  
  // Filters
  const [period, setPeriod] = useState('daily');
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchAllAnalytics();
  }, [period, days]);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch all analytics data in parallel
      const [overviewRes, revenueRes, userRes, productRes, withdrawalRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/admin/analytics/overview`),
        fetch(`${BACKEND_URL}/api/admin/analytics/revenue-trends?period=${period}&days=${days}`),
        fetch(`${BACKEND_URL}/api/admin/analytics/user-growth?days=${days}`),
        fetch(`${BACKEND_URL}/api/admin/analytics/product-performance?limit=10`),
        fetch(`${BACKEND_URL}/api/admin/analytics/withdrawal-patterns?days=${days}`)
      ]);

      const overviewData = await overviewRes.json();
      const revenueData = await revenueRes.json();
      const userData = await userRes.json();
      const productData = await productRes.json();
      const withdrawalData = await withdrawalRes.json();

      setOverview(overviewData);
      setRevenueTrends(revenueData.data || []);
      setUserGrowth(userData.data || []);
      setProductPerformance(productData.top_products || []);
      setWithdrawalPatterns(withdrawalData.data || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => row[header]).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={onLogout} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">Comprehensive insights and performance metrics</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
                <option value={180}>Last 6 Months</option>
                <option value={365}>Last Year</option>
              </select>
            </div>

            <button
              onClick={fetchAllAnalytics}
              className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Refresh Data
            </button>
          </div>
        </div>

        {/* Overview Cards */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{overview.users.total}</p>
              <p className="text-sm text-gray-500 mt-2">
                VIP: {overview.users.vip} | Free: {overview.users.free}
              </p>
              <p className="text-sm text-green-600 mt-1">
                +{overview.users.new_30d} new (30d)
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">₹{overview.revenue.total.toFixed(2)}</p>
              <p className="text-sm text-gray-500 mt-2">
                Last 30 days: ₹{overview.revenue.last_30d.toFixed(2)}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Total Orders</h3>
                <ShoppingCart className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{overview.orders.total}</p>
              <p className="text-sm text-gray-500 mt-2">
                Last 30 days: {overview.orders.last_30d}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Pending Withdrawals</h3>
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{overview.withdrawals.pending_count}</p>
              <p className="text-sm text-gray-500 mt-2">
                Amount: ₹{overview.withdrawals.pending_amount.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Revenue Trends Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Revenue Trends</h2>
            <button
              onClick={() => exportToCSV(revenueTrends, 'revenue-trends')}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={revenueTrends}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue (₹)" />
              <Area type="monotone" dataKey="orders" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Orders" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* User Growth Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">User Growth</h2>
              <button
                onClick={() => exportToCSV(userGrowth, 'user-growth')}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="vip" stroke="#8b5cf6" strokeWidth={2} name="VIP Users" />
                <Line type="monotone" dataKey="free" stroke="#ec4899" strokeWidth={2} name="Free Users" />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} name="Total" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Withdrawal Patterns */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Withdrawal Patterns</h2>
              <button
                onClick={() => exportToCSV(withdrawalPatterns, 'withdrawal-patterns')}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={withdrawalPatterns}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending" />
                <Bar dataKey="approved" stackId="a" fill="#3b82f6" name="Approved" />
                <Bar dataKey="completed" stackId="a" fill="#10b981" name="Completed" />
                <Bar dataKey="rejected" stackId="a" fill="#ef4444" name="Rejected" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Performance */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Top Performing Products</h2>
            <button
              onClick={() => exportToCSV(productPerformance, 'product-performance')}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Bar Chart */}
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={productPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="quantity_sold" fill="#8b5cf6" name="Quantity Sold" />
              </BarChart>
            </ResponsiveContainer>

            {/* Pie Chart */}
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={productPerformance}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.quantity_sold}`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="quantity_sold"
                >
                  {productPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Product Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productPerformance.map((product, index) => (
                  <tr key={product.product_id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-sm font-medium text-gray-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.quantity_sold}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{product.revenue.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminAnalytics;
