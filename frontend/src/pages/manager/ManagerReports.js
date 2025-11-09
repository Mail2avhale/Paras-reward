import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BarChart3, TrendingUp, Users, ShoppingCart, Calendar,
  Download, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import notifications from '@/utils/notifications';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

const ManagerReports = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('sales');
  const [salesReport, setSalesReport] = useState(null);
  const [usersReport, setUsersReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    // Set default dates (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      if (activeTab === 'sales') {
        fetchSalesReport();
      } else {
        fetchUsersReport();
      }
    }
  }, [activeTab, startDate, endDate]);

  const fetchSalesReport = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/manager/reports/sales`, {
        params: {
          uid: user.uid,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString()
        }
      });
      setSalesReport(response.data);
    } catch (error) {
      console.error('Error fetching sales report:', error);
      notifications.error('Error', 'Failed to fetch sales report');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersReport = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/manager/reports/users`, {
        params: {
          uid: user.uid,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString()
        }
      });
      setUsersReport(response.data);
    } catch (error) {
      console.error('Error fetching users report:', error);
      notifications.error('Error', 'Failed to fetch users report');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'sales') {
      fetchSalesReport();
    } else {
      fetchUsersReport();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Reports & Analytics</h1>
          <p className="text-gray-600">View detailed reports and analytics</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <Button
            onClick={() => setActiveTab('sales')}
            variant={activeTab === 'sales' ? 'default' : 'outline'}
            className={activeTab === 'sales' ? 'bg-purple-600' : ''}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Sales Report
          </Button>
          <Button
            onClick={() => setActiveTab('users')}
            variant={activeTab === 'users' ? 'default' : 'outline'}
            className={activeTab === 'users' ? 'bg-purple-600' : ''}
          >
            <Users className="mr-2 h-4 w-4" />
            Users Report
          </Button>
        </div>

        {/* Date Range Filter */}
        <Card className="p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Date Range:</span>
            </div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-auto"
            />
            <span className="text-gray-500">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-auto"
            />
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            <span className="ml-3 text-gray-600">Loading report...</span>
          </div>
        ) : (
          <>
            {/* Sales Report */}
            {activeTab === 'sales' && salesReport && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Total Orders</span>
                      <ShoppingCart className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{salesReport.summary.total_orders}</p>
                  </Card>
                  
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Total Revenue</span>
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">₹{salesReport.summary.total_revenue.toLocaleString()}</p>
                  </Card>
                  
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Avg Order Value</span>
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">₹{salesReport.summary.average_order_value.toFixed(2)}</p>
                  </Card>
                </div>

                {/* Daily Sales Chart */}
                <Card className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Daily Sales Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={salesReport.daily_sales}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} name="Orders" />
                      <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue (₹)" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                {/* Status Breakdown */}
                <Card className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Orders by Status</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(salesReport.status_breakdown).map(([status, count]) => ({
                          name: status.charAt(0).toUpperCase() + status.slice(1),
                          value: count
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {Object.keys(salesReport.status_breakdown).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* Users Report */}
            {activeTab === 'users' && usersReport && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Total Users</span>
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{usersReport.summary.total_users}</p>
                  </Card>
                  
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">New Users</span>
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{usersReport.summary.new_users}</p>
                  </Card>
                  
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">VIP Users</span>
                      <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{usersReport.summary.vip_users}</p>
                  </Card>
                  
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Free Users</span>
                      <Users className="h-5 w-5 text-gray-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{usersReport.summary.free_users}</p>
                  </Card>
                </div>

                {/* User Growth Chart */}
                <Card className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">User Growth Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={usersReport.daily_growth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="new_users" fill="#8b5cf6" name="New Users" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* KYC Breakdown */}
                <Card className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">KYC Status Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Verified', value: usersReport.kyc_breakdown.verified },
                          { name: 'Pending', value: usersReport.kyc_breakdown.pending },
                          { name: 'Rejected', value: usersReport.kyc_breakdown.rejected },
                          { name: 'Not Submitted', value: usersReport.kyc_breakdown.not_submitted }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[0, 1, 2, 3].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ManagerReports;