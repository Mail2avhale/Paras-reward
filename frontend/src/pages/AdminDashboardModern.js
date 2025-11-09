import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import MetricCard from '@/components/manager/MetricCard';
import StatusBadge from '@/components/manager/StatusBadge';
import {
  Users, Package, DollarSign, TrendingUp, ShoppingCart, Award,
  CheckCircle, Clock, AlertCircle, ArrowRight, Activity, BarChart3,
  Shield, CreditCard, FileText, Zap, Crown, Store, Settings,
  Eye, UserCheck, PackageCheck, Truck, TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboardModern = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`)
      ]);
      
      setStats(statsRes.data);
      
      // Mock recent activity (you can replace with actual API)
      setRecentActivity([
        { type: 'kyc', user: 'User #1234', action: 'KYC Verified', time: '2 mins ago', icon: Shield, color: 'green' },
        { type: 'vip', user: 'User #5678', action: 'VIP Upgraded', time: '5 mins ago', icon: Crown, color: 'amber' },
        { type: 'withdrawal', user: 'User #9012', action: 'Withdrawal Approved', time: '10 mins ago', icon: DollarSign, color: 'blue' },
        { type: 'order', user: 'User #3456', action: 'Order Completed', time: '15 mins ago', icon: PackageCheck, color: 'purple' },
      ]);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
        <Navbar user={user} onLogout={onLogout} />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <Navbar user={user} onLogout={onLogout} />

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)'
        }}></div>
        
        <div className="container mx-auto px-4 py-12 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                Welcome back, {user.name}!
              </h1>
              <p className="text-blue-100 text-lg">
                Here's what's happening with PARAS REWARD today
              </p>
            </div>
            <div className="hidden md:block">
              <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 border border-white/30">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-green-400 flex items-center justify-center">
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-white">
                    <p className="text-sm opacity-90">System Status</p>
                    <p className="text-xl font-bold">All Systems Operational</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 -mt-8 mb-8">
          <MetricCard
            title="Total Users"
            value={stats?.users?.total?.toLocaleString() || '0'}
            icon={Users}
            color="purple"
            subtitle={`+${stats?.users?.new_today || 0} today`}
            trend={stats?.users?.new_today > 0 ? 'up' : 'neutral'}
          />
          
          <MetricCard
            title="Total Revenue"
            value={`₹${(stats?.financial?.total_revenue || 0).toLocaleString()}`}
            icon={DollarSign}
            color="green"
            subtitle="All time earnings"
            trend="up"
          />
          
          <MetricCard
            title="Active Orders"
            value={stats?.orders?.active?.toLocaleString() || '0'}
            icon={ShoppingCart}
            color="blue"
            subtitle={`${stats?.orders?.completed_today || 0} completed today`}
            trend="up"
          />
          
          <MetricCard
            title="VIP Members"
            value={stats?.users?.vip_count?.toLocaleString() || '0'}
            icon={Crown}
            color="amber"
            subtitle={`${((stats?.users?.vip_count / stats?.users?.total) * 100 || 0).toFixed(1)}% of users`}
            trend="neutral"
          />
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 mb-1">Pending KYC</p>
                <p className="text-3xl font-bold text-green-900">{stats?.kyc?.pending || 0}</p>
                <p className="text-xs text-green-600 mt-1">Requires approval</p>
              </div>
              <div className="h-16 w-16 rounded-full bg-green-600 flex items-center justify-center">
                <Shield className="h-8 w-8 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 mb-1">Pending Withdrawals</p>
                <p className="text-3xl font-bold text-blue-900">{stats?.withdrawals?.pending || 0}</p>
                <p className="text-xs text-blue-600 mt-1">₹{(stats?.withdrawals?.pending_amount || 0).toLocaleString()}</p>
              </div>
              <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center">
                <CreditCard className="h-8 w-8 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-700 mb-1">VIP Payments</p>
                <p className="text-3xl font-bold text-amber-900">{stats?.vip_payments?.pending || 0}</p>
                <p className="text-xs text-amber-600 mt-1">Awaiting verification</p>
              </div>
              <div className="h-16 w-16 rounded-full bg-amber-600 flex items-center justify-center">
                <Crown className="h-8 w-8 text-white" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Button
                onClick={() => navigate('/admin-old')}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-purple-50 hover:border-purple-300 transition-all"
              >
                <Users className="h-8 w-8 text-purple-600" />
                <span className="text-sm font-medium">Manage Users</span>
              </Button>

              <Button
                onClick={() => navigate('/admin-old')}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-blue-50 hover:border-blue-300 transition-all"
              >
                <ShoppingCart className="h-8 w-8 text-blue-600" />
                <span className="text-sm font-medium">Manage Orders</span>
              </Button>

              <Button
                onClick={() => navigate('/admin/analytics')}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-green-50 hover:border-green-300 transition-all"
              >
                <BarChart3 className="h-8 w-8 text-green-600" />
                <span className="text-sm font-medium">Analytics</span>
              </Button>

              <Button
                onClick={() => navigate('/admin-old')}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-amber-50 hover:border-amber-300 transition-all"
              >
                <DollarSign className="h-8 w-8 text-amber-600" />
                <span className="text-sm font-medium">Financials</span>
              </Button>

              <Button
                onClick={() => navigate('/admin-old')}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-indigo-50 hover:border-indigo-300 transition-all"
              >
                <Store className="h-8 w-8 text-indigo-600" />
                <span className="text-sm font-medium">Stockists</span>
              </Button>

              <Button
                onClick={() => navigate('/admin-old')}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-red-50 hover:border-red-300 transition-all"
              >
                <Activity className="h-8 w-8 text-red-600" />
                <span className="text-sm font-medium">Activity Logs</span>
              </Button>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin-activity-logs')}>
                <Eye className="h-4 w-4 mr-1" />
                View All
              </Button>
            </div>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => {
                const Icon = activity.icon;
                const colorClasses = {
                  green: { bg: 'bg-green-100', text: 'text-green-600' },
                  amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
                  blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
                  purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
                  red: { bg: 'bg-red-100', text: 'text-red-600' },
                };
                const colors = colorClasses[activity.color] || colorClasses.blue;
                
                return (
                  <div key={index} className="flex items-start space-x-3 pb-4 border-b last:border-b-0">
                    <div className={`h-10 w-10 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`h-5 w-5 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                      <p className="text-xs text-gray-500">{activity.user}</p>
                      <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Management Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => navigate('/admin-old')}>
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">User Management</h3>
            <p className="text-sm text-gray-600">Manage all users, roles, and permissions</p>
            <div className="mt-4 flex items-center space-x-4 text-xs">
              <span className="text-gray-500">Total: {stats?.users?.total || 0}</span>
              <span className="text-green-600">Active: {stats?.users?.active || 0}</span>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => navigate('/admin-old')}>
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Orders</h3>
            <p className="text-sm text-gray-600">Track and manage all marketplace orders</p>
            <div className="mt-4 flex items-center space-x-4 text-xs">
              <span className="text-gray-500">Total: {stats?.orders?.total || 0}</span>
              <span className="text-amber-600">Pending: {stats?.orders?.pending || 0}</span>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => navigate('/admin-old')}>
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                <Store className="h-6 w-6 text-indigo-600" />
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Stockists</h3>
            <p className="text-sm text-gray-600">Manage stockist network and inventory</p>
            <div className="mt-4 flex items-center space-x-4 text-xs">
              <span className="text-gray-500">Master: {stats?.stockists?.master || 0}</span>
              <span className="text-gray-500">Sub: {stats?.stockists?.sub || 0}</span>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => navigate('/admin-old')}>
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Financials</h3>
            <p className="text-sm text-gray-600">Monitor revenue, withdrawals, and profits</p>
            <div className="mt-4 flex items-center space-x-4 text-xs">
              <span className="text-green-600">₹{(stats?.financial?.total_revenue || 0).toLocaleString()}</span>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => navigate('/admin-old')}>
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <Settings className="h-6 w-6 text-gray-600" />
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Settings & More</h3>
            <p className="text-sm text-gray-600">Products, payments, contact details</p>
            <div className="mt-4 flex items-center space-x-4 text-xs">
              <span className="text-gray-500">Full Admin Panel</span>
            </div>
          </Card>
        </div>

        {/* System Overview */}
        <Card className="p-6 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">System Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{stats?.users?.total || 0}</div>
              <p className="text-sm text-gray-600 mt-1">Total Users</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{stats?.orders?.completed || 0}</div>
              <p className="text-sm text-gray-600 mt-1">Completed Orders</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats?.products?.active || 0}</div>
              <p className="text-sm text-gray-600 mt-1">Active Products</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">{stats?.users?.vip_count || 0}</div>
              <p className="text-sm text-gray-600 mt-1">VIP Members</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600">{((stats?.stockists?.master || 0) + (stats?.stockists?.sub || 0) + (stats?.stockists?.outlet || 0))}</div>
              <p className="text-sm text-gray-600 mt-1">Total Stockists</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{stats?.support_tickets?.open || 0}</div>
              <p className="text-sm text-gray-600 mt-1">Open Tickets</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboardModern;
