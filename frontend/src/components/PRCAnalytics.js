import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Card } from './ui/card';
import { TrendingUp, TrendingDown, Coins, Users, Activity, PieChart as PieIcon } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const PRCAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/prc-analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching PRC analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center text-gray-500 py-8">
        Failed to load analytics data
      </div>
    );
  }

  // Prepare pie chart data
  const consumptionData = [
    { name: 'Marketplace', value: analytics.consumption_breakdown.marketplace, color: '#8b5cf6' },
    { name: 'Bill Payments', value: analytics.consumption_breakdown.bill_payments || 0, color: '#ec4899' },
    { name: 'Gift Vouchers', value: analytics.consumption_breakdown.gift_vouchers || 0, color: '#f59e0b' },
    { name: 'VIP Memberships', value: analytics.consumption_breakdown.vip_memberships, color: '#10b981' }
  ];

  // Format numbers
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Mined */}
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 mb-1">Total PRC Mined</p>
              <h3 className="text-3xl font-bold text-purple-900">{formatNumber(analytics.total_prc_mined)}</h3>
              <p className="text-xs text-purple-600 mt-2">All-time platform total</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-purple-200 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        {/* Total Consumed */}
        <Card className="p-6 bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-pink-600 mb-1">Total PRC Consumed</p>
              <h3 className="text-3xl font-bold text-pink-900">{formatNumber(analytics.total_prc_consumed)}</h3>
              <p className="text-xs text-pink-600 mt-2">Spent on platform</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-pink-200 flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-pink-600" />
            </div>
          </div>
        </Card>

        {/* In Circulation */}
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">PRC in Circulation</p>
              <h3 className="text-3xl font-bold text-blue-900">{formatNumber(analytics.total_prc_in_circulation)}</h3>
              <p className="text-xs text-blue-600 mt-2">Current user balances</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-200 flex items-center justify-center">
              <Coins className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Consumption Rate */}
        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 mb-1">Consumption Rate</p>
              <h3 className="text-3xl font-bold text-green-900">{analytics.consumption_rate}%</h3>
              <p className="text-xs text-green-600 mt-2">Of total mined PRC</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-200 flex items-center justify-center">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart: Mined vs Consumed Over Time */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            PRC Flow (Last 30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.timeline_data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="mined" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                dot={{ fill: '#8b5cf6', r: 4 }}
                activeDot={{ r: 6 }}
                name="PRC Mined"
              />
              <Line 
                type="monotone" 
                dataKey="consumed" 
                stroke="#ec4899" 
                strokeWidth={3}
                dot={{ fill: '#ec4899', r: 4 }}
                activeDot={{ r: 6 }}
                name="PRC Consumed"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie Chart: Consumption Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <PieIcon className="h-5 w-5 text-purple-600" />
            PRC Consumption Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={consumptionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {consumptionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => formatNumber(value) + ' PRC'}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {consumptionData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="h-3 w-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-600">{item.name}</span>
                <span className="text-sm font-bold text-gray-900 ml-auto">
                  {formatNumber(item.value)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bar Chart: Daily Comparison */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-purple-600" />
          Daily Mined vs Consumed (Last 7 Days)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.timeline_data.slice(-7)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              tick={{ fontSize: 12 }}
              tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
            />
            <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              labelFormatter={(date) => new Date(date).toLocaleDateString()}
            />
            <Legend />
            <Bar dataKey="mined" fill="#8b5cf6" name="PRC Mined" radius={[8, 8, 0, 0]} />
            <Bar dataKey="consumed" fill="#ec4899" name="PRC Consumed" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 text-center">
          <Users className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <h4 className="text-2xl font-bold text-gray-900">{analytics.total_users}</h4>
          <p className="text-sm text-gray-600">Total Users</p>
        </Card>
        
        <Card className="p-6 text-center">
          <Users className="h-8 w-8 text-pink-600 mx-auto mb-2" />
          <h4 className="text-2xl font-bold text-gray-900">{analytics.vip_users}</h4>
          <p className="text-sm text-gray-600">VIP Members</p>
        </Card>
        
        <Card className="p-6 text-center">
          <Coins className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <h4 className="text-2xl font-bold text-gray-900">{analytics.avg_prc_per_user}</h4>
          <p className="text-sm text-gray-600">Avg PRC per User</p>
        </Card>
      </div>
    </div>
  );
};

export default PRCAnalytics;
