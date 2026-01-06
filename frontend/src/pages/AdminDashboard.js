import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { 
  Users, Package, CreditCard, FileText, 
  Search, BarChart3, TrendingUp, TrendingDown,
  Store, Award, ShoppingCart, Bell, Settings, DollarSign,
  ArrowUpRight, ArrowDownRight, Truck, Activity,
  Shield, Wallet, BookOpen, AlertTriangle, Lock
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs">Total Users</p>
              <p className="text-2xl font-bold">{stats?.users?.total?.toLocaleString() || 0}</p>
            </div>
            <Users className="h-8 w-8 text-blue-200" />
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-xs">VIP Members</p>
              <p className="text-2xl font-bold">{stats?.users?.vip?.toLocaleString() || 0}</p>
            </div>
            <Award className="h-8 w-8 text-purple-200" />
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-xs">Total PRC</p>
              <p className="text-2xl font-bold">{stats?.total_prc?.toLocaleString() || 0}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-200" />
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-xs">KYC Verified</p>
              <p className="text-2xl font-bold">{stats?.kyc?.verified?.toLocaleString() || 0}</p>
            </div>
            <FileText className="h-8 w-8 text-orange-200" />
          </div>
        </Card>
      </div>

      {/* Quick Access Cards */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Access</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <a href="/admin/users" className="block">
          <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-semibold text-gray-900">Users</p>
                <p className="text-xs text-gray-500">Manage all users</p>
              </div>
            </div>
          </Card>
        </a>
        <a href="/admin/vip-plans" className="block">
          <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-purple-500">
            <div className="flex items-center gap-3">
              <Award className="h-6 w-6 text-purple-600" />
              <div>
                <p className="font-semibold text-gray-900">VIP Plans</p>
                <p className="text-xs text-gray-500">Manage VIP plans</p>
              </div>
            </div>
          </Card>
        </a>
        <a href="/admin/analytics" className="block">
          <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-gray-900">Analytics</p>
                <p className="text-xs text-gray-500">View reports</p>
              </div>
            </div>
          </Card>
        </a>
        <a href="/admin/settings" className="block">
          <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-gray-500">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-gray-600" />
              <div>
                <p className="font-semibold text-gray-900">Settings</p>
                <p className="text-xs text-gray-500">App settings</p>
              </div>
            </div>
          </Card>
        </a>
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent VIP Payments */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Recent VIP Payments</h3>
            <a href="/admin/vip-plans" className="text-sm text-blue-600 hover:underline">View All →</a>
          </div>
          <div className="space-y-3">
            {stats?.recent_activity?.vip_payments && stats.recent_activity.vip_payments.length > 0 ? (
              stats.recent_activity.vip_payments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{payment.user_name || 'User'}</p>
                    <p className="text-xs text-gray-500">₹{payment.amount} • {new Date(payment.submitted_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    payment.status === 'approved' ? 'bg-green-100 text-green-700' :
                    payment.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {payment.status?.toUpperCase()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">No recent payments</p>
            )}
          </div>
        </Card>

        {/* Recent KYC Submissions */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Recent KYC Submissions</h3>
            <a href="/admin/kyc" className="text-sm text-blue-600 hover:underline">View All →</a>
          </div>
          <div className="space-y-3">
            {stats?.recent_activity?.kyc_documents && stats.recent_activity.kyc_documents.length > 0 ? (
              stats.recent_activity.kyc_documents.map((kyc, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{kyc.user_name || 'User'}</p>
                    <p className="text-xs text-gray-500">{kyc.document_type} • {new Date(kyc.submitted_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    kyc.status === 'verified' ? 'bg-green-100 text-green-700' :
                    kyc.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {kyc.status?.toUpperCase()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">No recent KYC submissions</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;