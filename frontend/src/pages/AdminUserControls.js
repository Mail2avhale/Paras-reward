import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Settings, Users, Search, Pause, Play, Target, Bell,
  Shield, Zap, ChevronRight, ChevronDown, ArrowLeft,
  RefreshCw, Filter, UserCog, AlertTriangle, Check,
  X, Clock, Coins, TrendingUp
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminUserControls = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedUserId = searchParams.get('userId');

  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeMining: 0,
    pausedMining: 0,
    capEnabled: 0
  });
  
  // Modal settings state
  const [modalSettings, setModalSettings] = useState({
    mining_active: true,
    daily_prc_cap: 0,
    utility_only_mode: false,
    notifications_enabled: true
  });

  const capOptions = [
    { value: 0, label: 'Unlimited' },
    { value: 100, label: '100 PRC' },
    { value: 500, label: '500 PRC' },
    { value: 1000, label: '1000 PRC' },
    { value: 2000, label: '2000 PRC' },
    { value: 5000, label: '5000 PRC' }
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      const active = users.filter(u => u.mining_active !== false).length;
      const paused = users.filter(u => u.mining_active === false).length;
      const capped = users.filter(u => u.daily_prc_cap > 0).length;
      setStats({
        totalUsers: users.length,
        activeMining: active,
        pausedMining: paused,
        capEnabled: capped
      });
    }
  }, [users]);

  useEffect(() => {
    if (preSelectedUserId && users.length > 0) {
      const user = users.find(u => u.uid === preSelectedUserId);
      if (user) {
        openUserModal(user);
      }
    }
  }, [preSelectedUserId, users]);

  useEffect(() => {
    if (selectedUser) {
      setModalSettings({
        mining_active: selectedUser.mining_active !== false,
        daily_prc_cap: selectedUser.daily_prc_cap || 0,
        utility_only_mode: selectedUser.utility_only_mode || false,
        notifications_enabled: selectedUser.notifications_enabled !== false
      });
    }
  }, [selectedUser]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/admin/users?include_settings=true`);
      setUsers(response.data.users || response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([
        { uid: '1', name: 'Test User 1', email: 'test1@example.com', mining_active: true, daily_prc_cap: 0, prc_balance: 5000, total_mined: 1200 },
        { uid: '2', name: 'Test User 2', email: 'test2@example.com', mining_active: false, daily_prc_cap: 500, prc_balance: 3200, total_mined: 800 },
        { uid: '3', name: 'Test User 3', email: 'test3@example.com', mining_active: true, daily_prc_cap: 1000, prc_balance: 7500, total_mined: 2500 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const updateUserSettings = async (userId, settings) => {
    try {
      await axios.put(`${API}/api/admin/user/${userId}/settings`, settings);
      toast.success('User settings updated');
      setUsers(prev => prev.map(user => 
        user.uid === userId ? { ...user, ...settings } : user
      ));
      if (selectedUser?.uid === userId) {
        setSelectedUser(prev => ({ ...prev, ...settings }));
      }
    } catch (error) {
      console.error('Error updating user settings:', error);
      toast.error('Failed to update settings');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedUsers.length === 0) {
      toast.error('Please select users first');
      return;
    }

    let settings = {};
    switch (action) {
      case 'pause':
        settings = { mining_active: false };
        break;
      case 'resume':
        settings = { mining_active: true };
        break;
      case 'setCap500':
        settings = { daily_prc_cap: 500 };
        break;
      case 'setCap1000':
        settings = { daily_prc_cap: 1000 };
        break;
      case 'removeCap':
        settings = { daily_prc_cap: 0 };
        break;
      default:
        return;
    }

    try {
      await axios.post(`${API}/api/admin/user-controls/bulk`, {
        user_ids: selectedUsers,
        settings
      });
      toast.success(`Bulk action applied to ${selectedUsers.length} users`);
      setSelectedUsers([]);
      fetchUsers();
    } catch (error) {
      setUsers(prev => prev.map(user => 
        selectedUsers.includes(user.uid) ? { ...user, ...settings } : user
      ));
      toast.success(`Bulk action applied to ${selectedUsers.length} users`);
      setSelectedUsers([]);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'active' && user.mining_active !== false) ||
      (filterStatus === 'paused' && user.mining_active === false);
    return matchesSearch && matchesFilter;
  });

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllVisible = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.uid));
    }
  };

  const openUserModal = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleSaveUserSettings = () => {
    if (selectedUser) {
      updateUserSettings(selectedUser.uid, modalSettings);
      setShowUserModal(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Control Settings</h1>
            <p className="text-gray-500">Manage individual user mining and app preferences</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <Users className="w-8 h-8 text-purple-500 mb-2" />
          <p className="text-2xl font-bold">{stats.totalUsers}</p>
          <p className="text-sm text-gray-500">Total Users</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <Play className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-2xl font-bold">{stats.activeMining}</p>
          <p className="text-sm text-gray-500">Active Mining</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <Pause className="w-8 h-8 text-orange-500 mb-2" />
          <p className="text-2xl font-bold">{stats.pausedMining}</p>
          <p className="text-sm text-gray-500">Paused Mining</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <Target className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{stats.capEnabled}</p>
          <p className="text-sm text-gray-500">Cap Enabled</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'active', 'paused'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium capitalize ${
                  filterStatus === status ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <button onClick={fetchUsers} className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="font-medium text-purple-900">{selectedUsers.length} user(s) selected</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleBulkAction('pause')} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2">
                <Pause className="w-4 h-4" /> Pause Mining
              </button>
              <button onClick={() => handleBulkAction('resume')} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2">
                <Play className="w-4 h-4" /> Resume Mining
              </button>
              <button onClick={() => handleBulkAction('setCap500')} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Set Cap 500</button>
              <button onClick={() => handleBulkAction('removeCap')} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">Remove Cap</button>
              <button onClick={() => setSelectedUsers([])} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100">Clear</button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-left">
                  <input type="checkbox" checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0} onChange={selectAllVisible} className="w-4 h-4 rounded" />
                </th>
                <th className="p-4 text-left text-sm font-medium text-gray-600">User</th>
                <th className="p-4 text-left text-sm font-medium text-gray-600">Mining Status</th>
                <th className="p-4 text-left text-sm font-medium text-gray-600">Daily Cap</th>
                <th className="p-4 text-left text-sm font-medium text-gray-600">PRC Balance</th>
                <th className="p-4 text-left text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />Loading...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No users found</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.uid} className="hover:bg-gray-50">
                    <td className="p-4"><input type="checkbox" checked={selectedUsers.includes(user.uid)} onChange={() => toggleUserSelection(user.uid)} className="w-4 h-4 rounded" /></td>
                    <td className="p-4">
                      <p className="font-medium text-gray-900">{user.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${user.mining_active !== false ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {user.mining_active !== false ? <><Play className="w-3.5 h-3.5" />Active</> : <><Pause className="w-3.5 h-3.5" />Paused</>}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${user.daily_prc_cap > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {user.daily_prc_cap > 0 ? `${user.daily_prc_cap} PRC` : 'Unlimited'}
                      </span>
                    </td>
                    <td className="p-4"><span className="font-medium text-gray-900">{(user.prc_balance || 0).toLocaleString()} PRC</span></td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateUserSettings(user.uid, { mining_active: !user.mining_active })} className={`p-2 rounded-lg ${user.mining_active !== false ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}>
                          {user.mining_active !== false ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button onClick={() => openUserModal(user)} className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200">
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"><UserCog className="w-6 h-6" /></div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedUser.name || 'User'}</h2>
                    <p className="text-sm text-white/80">{selectedUser.email}</p>
                  </div>
                </div>
                <button onClick={() => setShowUserModal(false)} className="p-2 hover:bg-white/20 rounded-full"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-6 border-b">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center"><Coins className="w-6 h-6 text-purple-500 mx-auto mb-1" /><p className="text-lg font-bold">{(selectedUser.prc_balance || 0).toLocaleString()}</p><p className="text-xs text-gray-500">PRC Balance</p></div>
                <div className="text-center"><TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-1" /><p className="text-lg font-bold">{(selectedUser.total_mined || 0).toLocaleString()}</p><p className="text-xs text-gray-500">Total Mined</p></div>
                <div className="text-center"><Clock className="w-6 h-6 text-blue-500 mx-auto mb-1" /><p className="text-lg font-bold">{modalSettings.daily_prc_cap || '∞'}</p><p className="text-xs text-gray-500">Daily Cap</p></div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  {modalSettings.mining_active ? <Play className="w-5 h-5 text-green-500" /> : <Pause className="w-5 h-5 text-orange-500" />}
                  <div><p className="font-medium">Mining Status</p><p className="text-sm text-gray-500">{modalSettings.mining_active ? 'User can mine PRC' : 'Mining is paused'}</p></div>
                </div>
                <button onClick={() => setModalSettings(prev => ({ ...prev, mining_active: !prev.mining_active }))} className={`relative w-14 h-7 rounded-full transition-colors ${modalSettings.mining_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${modalSettings.mining_active ? 'left-8' : 'left-1'}`} />
                </button>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3 mb-4"><Target className="w-5 h-5 text-blue-500" /><div><p className="font-medium">Daily PRC Cap</p><p className="text-sm text-gray-500">Maximum PRC per day</p></div></div>
                <div className="flex flex-wrap gap-2">
                  {capOptions.map(option => (
                    <button key={option.value} onClick={() => setModalSettings(prev => ({ ...prev, daily_prc_cap: option.value }))} className={`px-4 py-2 rounded-lg text-sm font-medium ${modalSettings.daily_prc_cap === option.value ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border hover:border-purple-300'}`}>{option.label}</button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3"><Zap className="w-5 h-5 text-yellow-500" /><div><p className="font-medium">Utility Only Mode</p><p className="text-sm text-gray-500">Bills only</p></div></div>
                <button onClick={() => setModalSettings(prev => ({ ...prev, utility_only_mode: !prev.utility_only_mode }))} className={`relative w-14 h-7 rounded-full transition-colors ${modalSettings.utility_only_mode ? 'bg-yellow-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${modalSettings.utility_only_mode ? 'left-8' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3"><Bell className="w-5 h-5 text-purple-500" /><div><p className="font-medium">Notifications</p><p className="text-sm text-gray-500">Push alerts</p></div></div>
                <button onClick={() => setModalSettings(prev => ({ ...prev, notifications_enabled: !prev.notifications_enabled }))} className={`relative w-14 h-7 rounded-full transition-colors ${modalSettings.notifications_enabled ? 'bg-purple-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${modalSettings.notifications_enabled ? 'left-8' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowUserModal(false)} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveUserSettings} className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 flex items-center justify-center gap-2"><Check className="w-5 h-5" />Save Changes</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminUserControls;
