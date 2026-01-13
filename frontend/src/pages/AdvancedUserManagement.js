import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Users, Search, Edit, Trash2, DollarSign, Award, 
  ChevronLeft, ChevronRight, X, Plus, Minus, Settings, Shield,
  Calendar, Edit2
} from 'lucide-react';
import ManagerPermissions from '@/components/ManagerPermissions';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdvancedUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterMembership, setFilterMembership] = useState('');
  const [filterKYC, setFilterKYC] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    mobile: '',
    role: 'user',
    kyc_status: 'not_submitted'
  });
  
  const [balanceForm, setBalanceForm] = useState({
    balance_type: 'prc_balance',
    amount: '',
    operation: 'add',
    notes: ''
  });

  // Subscription editing
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState({
    plan: 'explorer',
    days: 30,
    use_manual_expiry: false,
    manual_expiry_date: '',
    payment_method: 'admin_free',
    amount_paid: 0,
    is_free: true,
    notes: ''
  });
  const [processingSubscription, setProcessingSubscription] = useState(false);
  
  // Subscription history
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryTab, setShowHistoryTab] = useState(false);

  const calculateExpiryDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const fetchSubscriptionHistory = async (uid) => {
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${API}/admin/users/${uid}/subscription-history`);
      setSubscriptionHistory(response.data.history || []);
    } catch (error) {
      console.error('Error fetching history:', error);
      setSubscriptionHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, searchTerm, filterRole, filterMembership, filterKYC, showDeleted]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let url = `${API}/admin/users/all?page=${page}&limit=20`;
      if (searchTerm) url += `&search=${searchTerm}`;
      if (filterRole) url += `&role=${filterRole}`;
      if (filterMembership) url += `&membership=${filterMembership}`;
      if (filterKYC) url += `&kyc_status=${filterKYC}`;
      if (showDeleted) url += `&show_deleted=true`;
      
      const response = await axios.get(url);
      setUsers(response.data.users || []);
      setTotal(response.data.total || 0);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      mobile: user.mobile || '',
      role: user.role || 'user',
      kyc_status: user.kyc_status || 'not_submitted'
    });
    setShowEditModal(true);
  };

  const openBalanceModal = (user) => {
    setSelectedUser(user);
    setBalanceForm({
      balance_type: 'prc_balance',
      amount: '',
      operation: 'add',
      notes: ''
    });
    setShowBalanceModal(true);
  };

  const openSubscriptionModal = (user) => {
    // Calculate remaining days if user has active subscription
    let remainingDays = 30;
    if (user.subscription_expiry || user.membership_expiry) {
      const expiry = new Date(user.subscription_expiry || user.membership_expiry);
      const now = new Date();
      remainingDays = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));
    }
    
    setSelectedUser(user);
    setSubscriptionForm({
      plan: user.subscription_plan || 'explorer',
      days: remainingDays > 0 ? remainingDays : 30,
      use_manual_expiry: false,
      manual_expiry_date: user.subscription_expiry ? user.subscription_expiry.split('T')[0] : calculateExpiryDate(30),
      payment_method: 'admin_free',
      amount_paid: 0,
      is_free: true,
      notes: ''
    });
    setShowSubscriptionModal(true);
  };

  const handleUpdateSubscription = async () => {
    if (!selectedUser) return;
    
    try {
      setProcessingSubscription(true);
      
      const expiryDate = subscriptionForm.use_manual_expiry 
        ? subscriptionForm.manual_expiry_date 
        : calculateExpiryDate(subscriptionForm.days);
      
      await axios.post(`${API}/admin/users/${selectedUser.uid}/subscription`, {
        plan: subscriptionForm.plan,
        days: subscriptionForm.days,
        expiry_date: expiryDate,
        use_manual_expiry: subscriptionForm.use_manual_expiry,
        payment_method: subscriptionForm.is_free ? 'admin_free' : subscriptionForm.payment_method,
        amount_paid: subscriptionForm.is_free ? 0 : subscriptionForm.amount_paid,
        notes: subscriptionForm.notes
      });
      
      toast.success(`Subscription updated for ${selectedUser.name || selectedUser.email}!`);
      setShowSubscriptionModal(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update subscription');
    } finally {
      setProcessingSubscription(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.put(`${API}/admin/users/${selectedUser.uid}/update`, editForm);
      toast.success('User updated successfully!');
      setShowEditModal(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(error.response?.data?.detail || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustBalance = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/admin/users/${selectedUser.uid}/adjust-balance`, {
        balance_type: balanceForm.balance_type,
        amount: parseFloat(balanceForm.amount),
        operation: balanceForm.operation,
        notes: balanceForm.notes
      });
      
      toast.success('Balance adjusted successfully!');
      setShowBalanceModal(false);
      fetchUsers();
    } catch (error) {
      console.error('Error adjusting balance:', error);
      toast.error(error.response?.data?.detail || 'Failed to adjust balance');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (uid) => {
    if (!window.confirm('Are you sure you want to delete this user? This will deactivate their account permanently.')) {
      return;
    }
    
    try {
      await axios.delete(`${API}/admin/users/${uid}/delete`);
      toast.success('User deleted successfully!');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-700',
      master_stockist: 'bg-purple-100 text-purple-700',
      sub_stockist: 'bg-blue-100 text-blue-700',
      outlet: 'bg-green-100 text-green-700',
      user: 'bg-gray-100 text-gray-700'
    };
    return colors[role] || colors.user;
  };

  const getMembershipBadge = (type) => {
    return type === 'vip' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700';
  };

  const getKYCBadge = (status) => {
    const colors = {
      verified: 'bg-green-500/20 text-green-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      rejected: 'bg-red-500/20 text-red-400',
      not_submitted: 'bg-gray-500/20 text-gray-400'
    };
    return colors[status?.toLowerCase()] || colors.pending;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Advanced User Management</h2>
          <p className="text-gray-400">Manage all users, roles, and balances</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-gray-900/50 border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Name, email, mobile, UID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
            <select
              className="w-full border border-gray-700 rounded p-2 bg-gray-800 text-white"
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="master_stockist">Master Stockist</option>
              <option value="sub_stockist">Sub Stockist</option>
              <option value="outlet">Outlet</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Membership</label>
            <select
              className="w-full border border-gray-700 rounded p-2 bg-gray-800 text-white"
              value={filterMembership}
              onChange={(e) => {
                setFilterMembership(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Types</option>
              <option value="explorer">Explorer</option>
              <option value="startup">Startup</option>
              <option value="growth">Growth</option>
              <option value="elite">Elite</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">KYC Status</label>
            <select
              className="w-full border border-gray-700 rounded p-2 bg-gray-800 text-white"
              value={filterKYC}
              onChange={(e) => {
                setFilterKYC(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="not_submitted">Not Submitted</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showDeleted"
              checked={showDeleted}
              onChange={(e) => {
                setShowDeleted(e.target.checked);
                setPage(1);
              }}
              className="w-4 h-4 text-purple-600 border-gray-600 rounded focus:ring-purple-500 bg-gray-800"
            />
            <label htmlFor="showDeleted" className="text-sm font-medium text-gray-400 cursor-pointer">
              Show Deleted Users
            </label>
          </div>
          <div className="text-sm text-gray-400">
            Showing {users.length} of {total} users
          </div>
        </div>
      </Card>

      {/* Users Table */}
      {loading ? (
        <Card className="p-12 text-center bg-gray-900/50 border-gray-800">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading users...</p>
        </Card>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center bg-gray-900/50 border-gray-800">
          <Users className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Users Found</h3>
          <p className="text-gray-400">Try adjusting your filters</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.uid} className="p-4 bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-white">{user.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getRoleBadge(user.role)}`}>
                      {user.role?.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getMembershipBadge(user.membership_type)}`}>
                      {user.subscription_plan?.toUpperCase() || user.membership_type?.toUpperCase() || 'EXPLORER'}
                      {(user.membership_type === 'vip' || user.subscription_plan) && user.membership_expiry && (
                        <span className="ml-1 font-normal">
                          (→ {new Date(user.membership_expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})
                        </span>
                      )}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getKYCBadge(user.kyc_status)}`}>
                      KYC: {(user.kyc_status || 'NOT_SUBMITTED').toUpperCase().replace('_', ' ')}
                    </span>
                    {user.is_active === false && (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400">
                        DELETED
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-300">
                    <div><span className="text-gray-500">Email:</span> {user.email}</div>
                    <div><span className="text-gray-500">Mobile:</span> {user.mobile || 'N/A'}</div>
                    <div><span className="text-gray-500">PRC:</span> <span className="text-emerald-400 font-medium">{(user.prc_balance || 0).toFixed(2)}</span></div>
                    <div><span className="text-gray-500">Plan:</span> <span className="text-purple-400">{user.subscription_plan || 'Explorer'}</span></div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-600">
                    UID: {user.uid} | Created: {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(user)}
                    title="Edit User"
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {user.role === 'manager' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setSelectedUser(user); setShowPermissionsModal(true); }}
                      className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      title="Manage Permissions"
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openSubscriptionModal(user)}
                    title="Edit Subscription"
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  >
                    <Award className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openBalanceModal(user)}
                    title="Adjust Balance"
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <DollarSign className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteUser(user.uid)}
                    title="Delete User"
                    disabled={user.is_active === false}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4">
          <Button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <Button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-gray-900 border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">Edit User</h2>
              <Button onClick={() => setShowEditModal(false)} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                  <Input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Mobile</label>
                  <Input
                    type="text"
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({...editForm, mobile: e.target.value})}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                  <select
                    className="w-full border border-gray-700 rounded p-2 bg-gray-800 text-white"
                    value={editForm.role}
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                  >
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">KYC Status</label>
                  <select
                    className="w-full border border-gray-700 rounded p-2 bg-gray-800 text-white"
                    value={editForm.kyc_status}
                    onChange={(e) => setEditForm({...editForm, kyc_status: e.target.value})}
                  >
                    <option value="not_submitted">Not Submitted</option>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Note: Subscription management moved to separate modal */}
              <p className="text-xs text-gray-500 mt-2">
                To update subscription, use the <Award className="w-3 h-3 inline" /> subscription button in the user list.
              </p>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? 'Updating...' : 'Update User'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Balance Adjustment Modal */}
      {showBalanceModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 bg-gray-900 border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">Adjust Balance</h2>
              <Button onClick={() => setShowBalanceModal(false)} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mb-4 p-3 bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-300">User: <strong className="text-white">{selectedUser.name}</strong></p>
              <p className="text-sm text-gray-300">Current PRC: <strong className="text-emerald-400">{(selectedUser.prc_balance || 0).toFixed(2)}</strong></p>
              <p className="text-sm text-gray-300">Plan: <strong className="text-purple-400">{selectedUser.subscription_plan || 'Explorer'}</strong></p>
            </div>
            
            <form onSubmit={handleAdjustBalance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Balance Type</label>
                <select
                  className="w-full border border-gray-700 rounded p-2 bg-gray-800 text-white"
                  value={balanceForm.balance_type}
                  onChange={(e) => setBalanceForm({...balanceForm, balance_type: e.target.value})}
                >
                  <option value="prc_balance">PRC Balance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Operation</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={balanceForm.operation === 'add' ? 'default' : 'outline'}
                    onClick={() => setBalanceForm({...balanceForm, operation: 'add'})}
                    className={`w-full ${balanceForm.operation === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}`}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant={balanceForm.operation === 'deduct' ? 'default' : 'outline'}
                    onClick={() => setBalanceForm({...balanceForm, operation: 'deduct'})}
                    className={`w-full ${balanceForm.operation === 'deduct' ? 'bg-red-600 hover:bg-red-700' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}`}
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    Deduct
                  </Button>
                  <Button
                    type="button"
                    variant={balanceForm.operation === 'set' ? 'default' : 'outline'}
                    onClick={() => setBalanceForm({...balanceForm, operation: 'set'})}
                    className={`w-full ${balanceForm.operation === 'set' ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}`}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Set
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={balanceForm.amount}
                  onChange={(e) => setBalanceForm({...balanceForm, amount: e.target.value})}
                  placeholder="Enter amount"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notes (Optional)</label>
                <textarea
                  className="w-full border border-gray-700 rounded p-2 bg-gray-800 text-white placeholder-gray-500"
                  rows="3"
                  value={balanceForm.notes}
                  onChange={(e) => setBalanceForm({...balanceForm, notes: e.target.value})}
                  placeholder="Reason for adjustment..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setShowBalanceModal(false)}
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading ? 'Adjusting...' : 'Adjust Balance'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Manager Permissions Modal */}
      {showPermissionsModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-gray-900 border-gray-800">
            <ManagerPermissions
              userId={selectedUser.uid}
              userName={selectedUser.name || selectedUser.email}
              onClose={() => setShowPermissionsModal(false)}
              onSave={() => {
                setShowPermissionsModal(false);
                toast.success('Manager permissions updated!');
              }}
            />
          </Card>
        </div>
      )}

      {/* Subscription Edit Modal */}
      {showSubscriptionModal && selectedUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg p-6 bg-gray-900 border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Update Subscription</h3>
              <button onClick={() => setShowSubscriptionModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* User Info */}
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <p className="text-white font-medium">{selectedUser.name || 'User'}</p>
              <p className="text-gray-400 text-sm">{selectedUser.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-500 text-xs">Current Plan:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  selectedUser.subscription_plan === 'elite' ? 'bg-amber-500/20 text-amber-400' :
                  selectedUser.subscription_plan === 'growth' ? 'bg-emerald-500/20 text-emerald-400' :
                  selectedUser.subscription_plan === 'startup' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {(selectedUser.subscription_plan || 'explorer').charAt(0).toUpperCase() + (selectedUser.subscription_plan || 'explorer').slice(1)}
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Step 1: Select Plan */}
              <div>
                <label className="text-gray-400 text-sm block mb-2">Step 1: Select Plan</label>
                <div className="grid grid-cols-4 gap-2">
                  {['explorer', 'startup', 'growth', 'elite'].map(plan => (
                    <button
                      key={plan}
                      onClick={() => setSubscriptionForm({...subscriptionForm, plan})}
                      className={`p-3 rounded-lg border text-xs font-medium transition-colors ${
                        subscriptionForm.plan === plan 
                          ? plan === 'elite' ? 'bg-amber-500/20 border-amber-500 text-amber-400' :
                            plan === 'growth' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                            plan === 'startup' ? 'bg-blue-500/20 border-blue-500 text-blue-400' :
                            'bg-gray-700 border-gray-600 text-gray-300'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Step 2: Set Duration */}
              <div>
                <label className="text-gray-400 text-sm block mb-2">Step 2: Set Duration (Days)</label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { days: 30, label: '30 Days' },
                    { days: 90, label: '90 Days' },
                    { days: 180, label: '180 Days' },
                    { days: 365, label: '1 Year' }
                  ].map(({ days, label }) => (
                    <button
                      key={days}
                      onClick={() => setSubscriptionForm({
                        ...subscriptionForm, 
                        days, 
                        use_manual_expiry: false,
                        manual_expiry_date: calculateExpiryDate(days)
                      })}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        subscriptionForm.days === days && !subscriptionForm.use_manual_expiry
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                
                <div className="flex gap-2 items-center">
                  <span className="text-gray-500 text-sm">Custom:</span>
                  <Input
                    type="number"
                    min="1"
                    max="3650"
                    value={subscriptionForm.days}
                    onChange={(e) => {
                      const days = parseInt(e.target.value) || 30;
                      setSubscriptionForm({
                        ...subscriptionForm, 
                        days,
                        use_manual_expiry: false,
                        manual_expiry_date: calculateExpiryDate(days)
                      });
                    }}
                    className="w-20 bg-gray-800 border-gray-700 text-white text-center h-8"
                  />
                  <span className="text-gray-500 text-sm">days</span>
                </div>
              </div>
              
              {/* Step 3: Expiry Date */}
              <div>
                <label className="text-gray-400 text-sm block mb-2">Step 3: Expiry Date</label>
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => setSubscriptionForm({...subscriptionForm, use_manual_expiry: false})}
                    className={`flex-1 p-3 rounded-lg border text-sm transition-colors ${
                      !subscriptionForm.use_manual_expiry
                        ? 'bg-green-500/20 border-green-500 text-green-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Auto: {calculateExpiryDate(subscriptionForm.days)}</span>
                    </div>
                    <p className="text-xs opacity-70 mt-1">Today + {subscriptionForm.days} days</p>
                  </button>
                  
                  <button
                    onClick={() => setSubscriptionForm({...subscriptionForm, use_manual_expiry: true})}
                    className={`flex-1 p-3 rounded-lg border text-sm transition-colors ${
                      subscriptionForm.use_manual_expiry
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Edit2 className="w-4 h-4" />
                      <span>Manual Date</span>
                    </div>
                    <p className="text-xs opacity-70 mt-1">Set specific date</p>
                  </button>
                </div>
                
                {subscriptionForm.use_manual_expiry && (
                  <Input
                    type="date"
                    value={subscriptionForm.manual_expiry_date}
                    onChange={(e) => setSubscriptionForm({...subscriptionForm, manual_expiry_date: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-gray-800 border-gray-700 text-white"
                  />
                )}
              </div>
              
              {/* Free Subscription Toggle */}
              <div className="flex items-center justify-between bg-gray-800 p-3 rounded-lg">
                <div>
                  <p className="text-white text-sm">Free Subscription</p>
                  <p className="text-gray-500 text-xs">Grant without payment</p>
                </div>
                <button
                  onClick={() => setSubscriptionForm({...subscriptionForm, is_free: !subscriptionForm.is_free, amount_paid: 0})}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    subscriptionForm.is_free ? 'bg-green-500' : 'bg-gray-700'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    subscriptionForm.is_free ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
              
              {/* Payment Details (only if not free) */}
              {!subscriptionForm.is_free && (
                <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-500 text-xs block mb-1">Method</label>
                      <select
                        value={subscriptionForm.payment_method}
                        onChange={(e) => setSubscriptionForm({...subscriptionForm, payment_method: e.target.value})}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs block mb-1">Amount (₹)</label>
                      <Input
                        type="number"
                        value={subscriptionForm.amount_paid}
                        onChange={(e) => setSubscriptionForm({...subscriptionForm, amount_paid: parseFloat(e.target.value) || 0})}
                        className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Notes */}
              <div>
                <label className="text-gray-400 text-sm block mb-1">Admin Notes</label>
                <textarea
                  value={subscriptionForm.notes}
                  onChange={(e) => setSubscriptionForm({...subscriptionForm, notes: e.target.value})}
                  placeholder="Notes about this update..."
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm resize-none"
                />
              </div>
              
              {/* Summary */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h4 className="text-purple-400 font-medium mb-2">Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Plan</p>
                    <p className="text-white font-medium">{subscriptionForm.plan.charAt(0).toUpperCase() + subscriptionForm.plan.slice(1)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Duration</p>
                    <p className="text-white font-medium">{subscriptionForm.days} days</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Expiry Date</p>
                    <p className="text-white font-medium">
                      {subscriptionForm.use_manual_expiry 
                        ? new Date(subscriptionForm.manual_expiry_date).toLocaleDateString('en-IN')
                        : new Date(calculateExpiryDate(subscriptionForm.days)).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className={`font-medium ${subscriptionForm.is_free ? 'text-green-400' : 'text-amber-400'}`}>
                      {subscriptionForm.is_free ? 'FREE' : `₹${subscriptionForm.amount_paid}`}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setShowSubscriptionModal(false)}
                  variant="outline"
                  className="flex-1 bg-gray-800 border-gray-700 text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateSubscription}
                  disabled={processingSubscription}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {processingSubscription ? 'Updating...' : 'Update Subscription'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdvancedUserManagement;
