import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import MetricCard from '@/components/manager/MetricCard';
import StatusBadge from '@/components/manager/StatusBadge';
import { 
  Users, ShoppingCart, FileCheck, DollarSign, 
  TrendingUp, AlertCircle, Clock, CheckCircle,
  ArrowRight, BarChart3, Package
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ManagerDashboardNew = ({ user, onLogout }) => {
  const location = useLocation();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Determine active tab from URL path
  const getActiveTabFromPath = () => {
    const path = location.pathname;
    if (path.includes('/users')) return 'users';
    if (path.includes('/orders')) return 'orders';
    if (path.includes('/kyc')) return 'kyc';
    if (path.includes('/stockists')) return 'stockists';
    if (path.includes('/finance')) return 'finance';
    if (path.includes('/reports')) return 'reports';
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  
  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [location.pathname]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/manager/dashboard`, {
        params: { uid: user?.uid }
      });
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const metrics = dashboardData?.metrics || {};
  const salesTrend = dashboardData?.sales_trend || [];
  const recentActivities = dashboardData?.recent_activities || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Manager Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.name}! Here's what's happening today.</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Active Users"
            value={metrics.total_users || 0}
            icon={Users}
            color="blue"
            subtitle={`+${metrics.new_users_week || 0} this week`}
          />
          
          <MetricCard
            title="Total Orders"
            value={metrics.total_orders || 0}
            icon={ShoppingCart}
            color="green"
            subtitle={`${metrics.orders_today || 0} today`}
          />
          
          <MetricCard
            title="Pending KYC"
            value={metrics.pending_kyc || 0}
            icon={FileCheck}
            color="orange"
            subtitle="Needs approval"
          />
          
          <MetricCard
            title="Total Revenue"
            value={`₹${metrics.total_revenue?.toLocaleString() || 0}`}
            icon={DollarSign}
            color="purple"
            subtitle="From delivered orders"
          />
        </div>

        {/* Quick Actions */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/manager/users">
              <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                <Users className="mr-2 h-4 w-4" />
                Manage Users
              </Button>
            </Link>
            
            <Link to="/manager/orders">
              <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                <Package className="mr-2 h-4 w-4" />
                Manage Orders
              </Button>
            </Link>
            
            <Link to="/manager/users?kyc=pending">
              <Button className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700">
                <FileCheck className="mr-2 h-4 w-4" />
                Approve KYC ({metrics.pending_kyc || 0})
              </Button>
            </Link>
            
            <Link to="/manager/reports">
              <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <BarChart3 className="mr-2 h-4 w-4" />
                View Reports
              </Button>
            </Link>
            
            <Link to="/manager/products">
              <Button className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
                <Package className="mr-2 h-4 w-4" />
                Manage Products
              </Button>
            </Link>
            
            <Link to="/manager/finance">
              <Button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                <DollarSign className="mr-2 h-4 w-4" />
                Financial Dashboard
              </Button>
            </Link>
            
            <Link to="/manager/communication">
              <Button className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700">
                <AlertCircle className="mr-2 h-4 w-4" />
                Send Announcements
              </Button>
            </Link>
            
            <Link to="/manager/support">
              <Button className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700">
                <AlertCircle className="mr-2 h-4 w-4" />
                Support Tickets
              </Button>
            </Link>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sales Trend Chart */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Sales Trend (Last 7 Days)</h2>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            
            {salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                    formatter={(value) => [`${value} orders`, 'Orders']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', r: 5 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                <p>No sales data available</p>
              </div>
            )}
          </Card>

          {/* Pending Tasks */}
          <Card className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Pending Tasks</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <FileCheck className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">KYC Approvals</p>
                    <p className="text-sm text-gray-600">{metrics.pending_kyc || 0} pending</p>
                  </div>
                </div>
                <Link to="/manager/users?kyc=pending">
                  <Button size="sm" variant="ghost">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Withdrawals</p>
                    <p className="text-sm text-gray-600">{metrics.pending_withdrawals || 0} pending</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Orders Today</p>
                    <p className="text-sm text-gray-600">{metrics.orders_today || 0} orders</p>
                  </div>
                </div>
                <Link to="/manager/orders">
                  <Button size="sm" variant="ghost">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Activities */}
        <Card className="p-6 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activities</h2>
          <div className="space-y-3">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      activity.type === 'order' ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      {activity.type === 'order' ? (
                        <ShoppingCart className={`h-5 w-5 ${activity.type === 'order' ? 'text-green-600' : 'text-blue-600'}`} />
                      ) : (
                        <Users className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{activity.message}</p>
                      <p className="text-sm text-gray-500">
                        {activity.time ? new Date(activity.time).toLocaleString() : 'Just now'}
                      </p>
                    </div>
                  </div>
                  {activity.type === 'order' && activity.status && (
                    <StatusBadge status={activity.status} type="order" />
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Clock className="h-12 w-12 mx-auto mb-2" />
                <p>No recent activities</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ManagerDashboardNew;
