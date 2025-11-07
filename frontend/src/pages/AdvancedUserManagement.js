import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Users, Search, Edit, Trash2, DollarSign, Award, 
  ChevronLeft, ChevronRight, X, Plus, Minus, Settings
} from 'lucide-react';

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
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    mobile: '',
    role: '',
    membership_type: '',
    kyc_status: ''
  });
  
  const [balanceForm, setBalanceForm] = useState({
    balance_type: 'prc_balance',
    amount: '',
    operation: 'add',
    notes: ''
  });

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
      membership_type: user.membership_type || 'free',
      kyc_status: user.kyc_status || 'pending'
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
    if (!window.confirm('Are you sure you want to deactivate this user?')) {
      return;
    }
    
    try {
      await axios.delete(`${API}/admin/users/${uid}/delete`);
      toast.success('User deactivated successfully!');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.detail || 'Failed to deactivate user');
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
      verified: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return colors[status] || colors.pending;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Advanced User Management</h2>
          <p className="text-gray-600">Manage all users, roles, and balances</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Name, email, mobile, UID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              className="w-full border rounded p-2"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Membership</label>
            <select
              className="w-full border rounded p-2"
              value={filterMembership}
              onChange={(e) => {
                setFilterMembership(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Types</option>
              <option value="free">Free</option>
              <option value="vip">VIP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">KYC Status</label>
            <select
              className="w-full border rounded p-2"
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
            </select>
          </div>
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          Showing {users.length} of {total} users
        </div>
      </Card>

      {/* Users Table */}
      {loading ? (
        <Card className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </Card>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Users Found</h3>
          <p className="text-gray-600">Try adjusting your filters</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.uid} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getRoleBadge(user.role)}`}>
                      {user.role?.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getMembershipBadge(user.membership_type)}`}>
                      {user.membership_type?.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getKYCBadge(user.kyc_status)}`}>
                      KYC: {user.kyc_status?.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><strong>Email:</strong> {user.email}</div>
                    <div><strong>Mobile:</strong> {user.mobile || 'N/A'}</div>
                    <div><strong>PRC:</strong> {(user.prc_balance || 0).toFixed(2)}</div>
                    <div><strong>Cashback:</strong> ₹{(user.cashback_wallet_balance || 0).toFixed(2)}</div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    UID: {user.uid} | Created: {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(user)}
                    title="Edit User"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openBalanceModal(user)}
                    title="Adjust Balance"
                  >
                    <DollarSign className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteUser(user.uid)}
                    title="Deactivate User"
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
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <Button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            variant="outline"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Edit User</h2>
              <Button onClick={() => setShowEditModal(false)} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <Input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                  <Input
                    type="text"
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({...editForm, mobile: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    className="w-full border rounded p-2"
                    value={editForm.role}
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="master_stockist">Master Stockist</option>
                    <option value="sub_stockist">Sub Stockist</option>
                    <option value="outlet">Outlet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Membership</label>
                  <select
                    className="w-full border rounded p-2"
                    value={editForm.membership_type}
                    onChange={(e) => setEditForm({...editForm, membership_type: e.target.value})}
                  >
                    <option value="free">Free</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">KYC Status</label>
                  <select
                    className="w-full border rounded p-2"
                    value={editForm.kyc_status}
                    onChange={(e) => setEditForm({...editForm, kyc_status: e.target.value})}
                  >
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Adjust Balance</h2>
              <Button onClick={() => setShowBalanceModal(false)} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">User: <strong>{selectedUser.name}</strong></p>
              <p className="text-sm text-gray-600">Current PRC: <strong>{(selectedUser.prc_balance || 0).toFixed(2)}</strong></p>
              <p className="text-sm text-gray-600">Current Cashback: <strong>₹{(selectedUser.cashback_wallet_balance || 0).toFixed(2)}</strong></p>
            </div>
            
            <form onSubmit={handleAdjustBalance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Balance Type</label>
                <select
                  className="w-full border rounded p-2"
                  value={balanceForm.balance_type}
                  onChange={(e) => setBalanceForm({...balanceForm, balance_type: e.target.value})}
                >
                  <option value="prc_balance">PRC Balance</option>
                  <option value="cashback_wallet_balance">Cashback Wallet</option>
                  <option value="profit_wallet_balance">Profit Wallet</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Operation</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={balanceForm.operation === 'add' ? 'default' : 'outline'}
                    onClick={() => setBalanceForm({...balanceForm, operation: 'add'})}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant={balanceForm.operation === 'deduct' ? 'default' : 'outline'}
                    onClick={() => setBalanceForm({...balanceForm, operation: 'deduct'})}
                    className="w-full"
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    Deduct
                  </Button>
                  <Button
                    type="button"
                    variant={balanceForm.operation === 'set' ? 'default' : 'outline'}
                    onClick={() => setBalanceForm({...balanceForm, operation: 'set'})}
                    className="w-full"
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Set
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={balanceForm.amount}
                  onChange={(e) => setBalanceForm({...balanceForm, amount: e.target.value})}
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  className="w-full border rounded p-2"
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
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'Adjusting...' : 'Adjust Balance'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdvancedUserManagement;
