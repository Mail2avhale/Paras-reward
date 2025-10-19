import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Package, CreditCard, FileText, CheckCircle, XCircle, Search, Shield, UserCog, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [vipPayments, setVipPayments] = useState([]);
  const [kycDocuments, setKycDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    fetchStats();
    fetchVIPPayments();
    fetchKYCDocuments();
    fetchUsers();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchVIPPayments = async () => {
    try {
      const response = await axios.get(`${API}/membership/payments`);
      setVipPayments(response.data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchKYCDocuments = async () => {
    try {
      const response = await axios.get(`${API}/kyc/list`);
      setKycDocuments(response.data);
    } catch (error) {
      console.error('Error fetching KYC:', error);
    }
  };

  const handlePaymentAction = async (paymentId, action) => {
    try {
      await axios.post(`${API}/membership/payment/${paymentId}/action`, { action });
      toast.success(`Payment ${action}d successfully!`);
      fetchVIPPayments();
      fetchStats();
    } catch (error) {
      console.error('Error handling payment:', error);
      toast.error('Action failed');
    }
  };

  const handleKYCAction = async (kycId, action) => {
    try {
      await axios.post(`${API}/kyc/${kycId}/verify`, { action });
      toast.success(`KYC ${action}d successfully!`);
      fetchKYCDocuments();
      fetchStats();
    } catch (error) {
      console.error('Error handling KYC:', error);
      toast.error('Action failed');
    }
  };

  const fetchUsers = async () => {
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (roleFilter) params.role = roleFilter;
      
      const response = await axios.get(`${API}/admin/users`, { params });
      setUsers(response.data.users);
      setUsersTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleRoleChange = async (uid, newRole) => {
    try {
      await axios.put(`${API}/admin/users/${uid}/role`, { role: newRole });
      toast.success(`User role updated to ${newRole}`);
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleStatusChange = async (uid, isActive) => {
    try {
      await axios.put(`${API}/admin/users/${uid}/status`, { is_active: isActive });
      toast.success(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(error.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleDeleteUser = async (uid, userName) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/admin/users/${uid}`);
      toast.success('User deleted successfully');
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delaySearch);
  }, [searchQuery, roleFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card data-testid="total-users-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <Users className="h-8 w-8 text-purple-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">Total Users</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.total_users || 0}</p>
          </Card>

          <Card data-testid="vip-users-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <Users className="h-8 w-8 text-yellow-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">VIP Users</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.vip_users || 0}</p>
          </Card>

          <Card data-testid="total-orders-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <Package className="h-8 w-8 text-blue-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">Total Orders</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.total_orders || 0}</p>
          </Card>

          <Card data-testid="pending-payments-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <CreditCard className="h-8 w-8 text-green-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">Pending Payments</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.pending_payments || 0}</p>
          </Card>

          <Card data-testid="pending-kyc-stat" className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <FileText className="h-8 w-8 text-orange-600 mb-3" />
            <p className="text-sm text-gray-600 mb-1">Pending KYC</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.pending_kyc || 0}</p>
          </Card>
        </div>

        {/* Tabs */}
        <Card className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger data-testid="payments-tab" value="payments">VIP Payments</TabsTrigger>
              <TabsTrigger data-testid="kyc-tab" value="kyc">KYC Verifications</TabsTrigger>
            </TabsList>

            {/* USER MANAGEMENT TAB */}
            <TabsContent value="users" className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                <div className="flex gap-3 w-full md:w-auto">
                  <Input
                    placeholder="Search by name, email, or mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full md:w-64"
                    icon={<Search className="h-4 w-4" />}
                  />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All Roles</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="outlet">Outlet</option>
                    <option value="master_stockist">Master Stockist</option>
                    <option value="sub_stockist">Sub Stockist</option>
                  </select>
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-4">
                Total Users: <strong>{usersTotal}</strong>
              </div>

              {users.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Mobile</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">PRC Balance</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.uid} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{u.name || 'N/A'}</p>
                              <p className="text-xs text-gray-500">{u.uid}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-gray-700">{u.email || 'N/A'}</td>
                          <td className="py-4 px-4 text-gray-700">{u.mobile || 'N/A'}</td>
                          <td className="py-4 px-4">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                              className="px-3 py-1 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                              <option value="outlet">Outlet</option>
                              <option value="master_stockist">Master Stockist</option>
                              <option value="sub_stockist">Sub Stockist</option>
                            </select>
                          </td>
                          <td className="py-4 px-4">
                            <button
                              onClick={() => handleStatusChange(u.uid, !u.is_active)}
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                u.is_active
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                              }`}
                            >
                              {u.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="py-4 px-4">
                            <p className="font-medium text-purple-600">
                              {u.prc_balance?.toFixed(2) || '0.00'} PRC
                            </p>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex justify-center gap-2">
                              <Button
                                onClick={() => handleDeleteUser(u.uid, u.name)}
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">VIP Payment Requests</h2>
              {vipPayments.filter(p => p.status === 'pending').length === 0 ? (
                <p className="text-center py-8 text-gray-500">No pending payments</p>
              ) : (
                vipPayments.filter(p => p.status === 'pending').map((payment, index) => (
                  <Card key={payment.payment_id} data-testid={`payment-${index}`} className="p-6 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">User ID</p>
                        <p className="font-semibold text-gray-900">{payment.user_id.substring(0, 12)}...</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Amount</p>
                        <p className="font-semibold text-gray-900">₹{payment.amount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Date & Time</p>
                        <p className="font-semibold text-gray-900">{payment.date} {payment.time}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">UTR Number</p>
                        <p className="font-semibold text-gray-900">{payment.utr_number}</p>
                      </div>
                    </div>
                    {payment.screenshot_url && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">Screenshot</p>
                        <img src={payment.screenshot_url} alt="Payment screenshot" className="max-w-xs rounded-lg" />
                      </div>
                    )}
                    <div className="flex gap-3">
                      <Button
                        data-testid={`approve-payment-${index}`}
                        onClick={() => handlePaymentAction(payment.payment_id, 'approve')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        data-testid={`reject-payment-${index}`}
                        onClick={() => handlePaymentAction(payment.payment_id, 'reject')}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="kyc" className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">KYC Verification Requests</h2>
              {kycDocuments.filter(k => k.status === 'pending').length === 0 ? (
                <p className="text-center py-8 text-gray-500">No pending KYC verifications</p>
              ) : (
                kycDocuments.filter(k => k.status === 'pending').map((kyc, index) => (
                  <Card key={kyc.kyc_id} data-testid={`kyc-${index}`} className="p-6 bg-gray-50">
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">User ID</p>
                      <p className="font-semibold text-gray-900 mb-4">{kyc.user_id.substring(0, 12)}...</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Aadhaar Front</p>
                          {kyc.aadhaar_front && (
                            <img src={kyc.aadhaar_front} alt="Aadhaar front" className="w-full rounded-lg" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Aadhaar Back</p>
                          {kyc.aadhaar_back && (
                            <img src={kyc.aadhaar_back} alt="Aadhaar back" className="w-full rounded-lg" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-2">PAN Card</p>
                          {kyc.pan_front && (
                            <img src={kyc.pan_front} alt="PAN card" className="w-full rounded-lg" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        data-testid={`approve-kyc-${index}`}
                        onClick={() => handleKYCAction(kyc.kyc_id, 'approve')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        data-testid={`reject-kyc-${index}`}
                        onClick={() => handleKYCAction(kyc.kyc_id, 'reject')}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;