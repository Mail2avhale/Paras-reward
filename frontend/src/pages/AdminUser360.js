import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Search, User, Mail, Phone, MapPin, Calendar, Shield, Crown,
  Coins, TrendingUp, TrendingDown, Users, Gift, ShoppingBag,
  CreditCard, FileText, Clock, CheckCircle, XCircle, AlertTriangle,
  Activity, Eye, Download, Bell, MessageSquare, RefreshCw, Loader2,
  ChevronRight, ArrowLeft, Copy, ExternalLink, Ban, Play, Pause,
  Wallet, Receipt, BadgeCheck, AlertCircle, Info, Star, Zap,
  BarChart3, PieChart, Network, History, Settings, Send, Key
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminUser360 = ({ user: adminUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('orders');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // User List Browse Mode State
  const [viewMode, setViewMode] = useState('search'); // 'search' or 'browse'
  const [userList, setUserList] = useState([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const [userListPage, setUserListPage] = useState(1);
  const [userListTotal, setUserListTotal] = useState(0);
  const [userListTotalPages, setUserListTotalPages] = useState(1);
  const [filterRole, setFilterRole] = useState('');
  const [filterMembership, setFilterMembership] = useState('');
  const [filterKYC, setFilterKYC] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [browseSearchTerm, setBrowseSearchTerm] = useState('');

  // Fetch user list for browse mode
  const fetchUserList = async () => {
    setUserListLoading(true);
    try {
      let url = `${API}/api/admin/users/all?page=${userListPage}&limit=20`;
      if (browseSearchTerm) url += `&search=${encodeURIComponent(browseSearchTerm)}`;
      if (filterRole) url += `&role=${filterRole}`;
      if (filterMembership) url += `&membership=${filterMembership}`;
      if (filterKYC) url += `&kyc_status=${filterKYC}`;
      if (showDeleted) url += `&show_deleted=true`;
      
      const response = await axios.get(url);
      setUserList(response.data.users || []);
      setUserListTotal(response.data.total || 0);
      setUserListTotalPages(response.data.pages || 1);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setUserListLoading(false);
    }
  };

  // Load user list when browse mode is active
  useEffect(() => {
    if (viewMode === 'browse') {
      fetchUserList();
    }
  }, [viewMode, userListPage, browseSearchTerm, filterRole, filterMembership, filterKYC, showDeleted]);

  // Select user from list to view 360°
  const selectUserFromList = (user) => {
    setSearchQuery(user.uid);
    setViewMode('search');
    // Trigger search
    handleSearchByUid(user.uid);
  };

  // Search by UID directly
  const handleSearchByUid = async (uid) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/admin/user-360?query=${encodeURIComponent(uid)}`);
      setUserData(response.data);
      setAdminNotes(response.data.user?.admin_notes || '');
      toast.success('User found!');
    } catch (error) {
      console.error('Search error:', error);
      toast.error(error.response?.data?.detail || 'Failed to search user');
      setUserData(null);
    } finally {
      setLoading(false);
    }
  };

  // Search user
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter search query');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/admin/user-360?query=${encodeURIComponent(searchQuery.trim())}`);
      setUserData(response.data);
      setAdminNotes(response.data.user?.admin_notes || '');
      toast.success('User found!');
    } catch (error) {
      console.error('Search error:', error);
      if (error.response?.status === 404) {
        toast.error('User not found');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to search user');
      }
      setUserData(null);
    } finally {
      setLoading(false);
    }
  };

  // Quick Actions
  const [passwordModal, setPasswordModal] = useState({ show: false, password: '' });
  const [pinModal, setPinModal] = useState({ show: false, pin: '' });
  const [editModal, setEditModal] = useState({ show: false });
  const [successModal, setSuccessModal] = useState({ show: false, title: '', message: '', type: 'success' });
  const [editForm, setEditForm] = useState({
    name: '', email: '', mobile: '', alternate_mobile: '',
    address: '', city: '', state: '', pincode: '',
    pan_number: '', aadhaar_number: '',
    bank_name: '', bank_account_number: '', bank_ifsc: '', upi_id: '',
    date_of_birth: '', gender: '',
    nominee_name: '', nominee_relation: '', nominee_mobile: ''
  });
  
  // Open edit modal with current user data
  const openEditModal = () => {
    if (!userData?.user) return;
    const user = userData.user;
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      mobile: user.mobile || '',
      alternate_mobile: user.alternate_mobile || '',
      address: user.address || '',
      city: user.city || '',
      state: user.state || '',
      pincode: user.pincode || '',
      pan_number: user.pan_number || '',
      aadhaar_number: user.aadhaar_number || '',
      bank_name: user.bank_name || '',
      bank_account_number: user.bank_account_number || '',
      bank_ifsc: user.bank_ifsc || '',
      upi_id: user.upi_id || '',
      date_of_birth: user.date_of_birth || '',
      gender: user.gender || '',
      nominee_name: user.nominee_name || '',
      nominee_relation: user.nominee_relation || '',
      nominee_mobile: user.nominee_mobile || ''
    });
    setEditModal({ show: true });
  };
  
  // Handle edit form submission
  const handleSaveUserDetails = async () => {
    setProcessing(true);
    try {
      // Only send changed fields
      const updates = {};
      const user = userData.user;
      Object.keys(editForm).forEach(key => {
        if (editForm[key] !== (user[key] || '')) {
          updates[key] = editForm[key];
        }
      });
      
      if (Object.keys(updates).length === 0) {
        toast.info('No changes to save');
        setEditModal({ show: false });
        return;
      }
      
      await handleQuickAction('update_user_details', { updates });
      setEditModal({ show: false });
    } catch (error) {
      // Error handled in handleQuickAction
    } finally {
      setProcessing(false);
    }
  };
  
  const handleQuickAction = async (action, params = {}) => {
    if (!userData?.user?.uid) return;
    
    setProcessing(true);
    try {
      const response = await axios.post(`${API}/api/admin/user-360/action`, {
        user_id: userData.user.uid,
        action,
        admin_id: adminUser?.uid,
        ...params
      });
      
      const message = response.data?.message || '';
      
      // Special handling for password reset - show in center modal
      if (action === 'reset_password' && message) {
        // Match both old and new format
        const credentialMatch = message.match(/Temporary (?:password|credential): (\w+)/);
        if (credentialMatch) {
          const tempCredential = credentialMatch[1];
          setPasswordModal({ show: true, password: tempCredential, isPinUser: message.includes('PIN') });
        } else {
          setSuccessModal({ show: true, title: 'Password Reset', message: message, type: 'success' });
        }
      } 
      // Special handling for PIN reset - show in center modal
      else if (action === 'reset_pin' && message) {
        const pinMatch = message.match(/New temporary PIN: (\d{6})/);
        if (pinMatch) {
          const tempPin = pinMatch[1];
          setPinModal({ show: true, pin: tempPin });
        } else {
          setSuccessModal({ show: true, title: 'PIN Reset', message: message, type: 'success' });
        }
      }
      // All other actions - show in center modal
      else {
        const actionTitles = {
          'pause_mining': 'Mining Paused',
          'resume_mining': 'Mining Resumed',
          'adjust_balance': 'Balance Adjusted',
          'set_cap': 'Daily Cap Set',
          'send_notification': 'Notification Sent',
          'block_user': 'User Blocked',
          'unblock_user': 'User Unblocked',
          'clear_lockout': 'Lockout Cleared',
          'update_user_details': 'Details Updated',
          'save_notes': 'Notes Saved'
        };
        
        const title = actionTitles[action] || 'Action Completed';
        setSuccessModal({ 
          show: true, 
          title: title, 
          message: message || `${action} completed successfully`,
          type: action === 'block_user' ? 'warning' : 'success'
        });
      }
      
      // Silently refresh data without showing loading state
      refreshUserData();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Action failed';
      setSuccessModal({ show: true, title: 'Error', message: errorMsg, type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  // Silent refresh without loading state
  const refreshUserData = async () => {
    if (!userData?.user?.uid) return;
    try {
      const response = await axios.get(`${API}/api/admin/user-360?query=${encodeURIComponent(userData.user.uid)}`);
      setUserData(response.data);
      setAdminNotes(response.data.user?.admin_notes || '');
    } catch (error) {
      console.error('Silent refresh error:', error);
      // Don't clear userData on refresh error - keep existing data
    }
  };

  const saveAdminNotes = async () => {
    await handleQuickAction('save_notes', { notes: adminNotes });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toLocaleString('en-IN');
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      approved: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      completed: 'bg-green-500/20 text-green-400 border-green-500/50',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/50',
      cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
      verified: 'bg-green-500/20 text-green-400 border-green-500/50',
      delivered: 'bg-green-500/20 text-green-400 border-green-500/50'
    };
    return badges[status] || 'bg-gray-500/20 text-gray-400';
  };

  const getMembershipBadge = (plan) => {
    const badges = {
      elite: { color: 'bg-amber-500/20 text-amber-400 border-amber-500', icon: Crown, label: 'Elite' },
      growth: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500', icon: TrendingUp, label: 'Growth' },
      startup: { color: 'bg-blue-500/20 text-blue-400 border-blue-500', icon: Zap, label: 'Startup' },
      explorer: { color: 'bg-gray-500/20 text-gray-400 border-gray-500', icon: User, label: 'Explorer' }
    };
    return badges[plan] || badges.explorer;
  };

  // Calculate risk score
  const getRiskScore = () => {
    if (!userData) return { score: 0, level: 'low', color: 'green' };
    
    let score = 0;
    const u = userData.user;
    const stats = userData.stats;
    
    // Negative balance
    if (u.prc_balance < 0) score += 30;
    // No KYC
    if (u.kyc_status !== 'verified') score += 20;
    // High redemption vs mining ratio
    if (stats.total_redeemed > stats.total_mined * 1.5) score += 25;
    // Recent account
    const daysSinceJoin = (Date.now() - new Date(u.created_at)) / (1000 * 60 * 60 * 24);
    if (daysSinceJoin < 7 && stats.total_redeemed > 1000) score += 25;
    
    if (score >= 50) return { score, level: 'high', color: 'red' };
    if (score >= 25) return { score, level: 'medium', color: 'yellow' };
    return { score, level: 'low', color: 'green' };
  };

  return (
    <div className="p-4 md:p-6 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="text-gray-400">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Eye className="w-7 h-7 text-purple-400" />
              User 360° View
            </h1>
            <p className="text-gray-400 text-sm">Complete user analysis and management</p>
          </div>
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'search' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('search')}
            className={viewMode === 'search' ? 'bg-purple-600' : 'border-gray-700 text-gray-400'}
          >
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          <Button
            variant={viewMode === 'browse' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('browse')}
            className={viewMode === 'browse' ? 'bg-purple-600' : 'border-gray-700 text-gray-400'}
          >
            <Users className="w-4 h-4 mr-2" />
            Browse All
          </Button>
        </div>
      </div>

      {/* Browse Mode - User List */}
      {viewMode === 'browse' && (
        <Card className="p-6 mb-6 bg-gray-900 border-gray-800">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search users..."
                value={browseSearchTerm}
                onChange={(e) => { setBrowseSearchTerm(e.target.value); setUserListPage(1); }}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => { setFilterRole(e.target.value); setUserListPage(1); }}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
            </select>
            <select
              value={filterMembership}
              onChange={(e) => { setFilterMembership(e.target.value); setUserListPage(1); }}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="">All Plans</option>
              <option value="elite">Elite</option>
              <option value="growth">Growth</option>
              <option value="startup">Startup</option>
              <option value="explorer">Explorer</option>
            </select>
            <select
              value={filterKYC}
              onChange={(e) => { setFilterKYC(e.target.value); setUserListPage(1); }}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="">All KYC</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="none">Not Submitted</option>
            </select>
            <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => { setShowDeleted(e.target.checked); setUserListPage(1); }}
                className="rounded bg-gray-800 border-gray-700"
              />
              Show Deleted
            </label>
          </div>
          
          {/* User List */}
          {userListLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : userList.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-400 mb-4">
                Showing {userList.length} of {userListTotal} users
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm border-b border-gray-800">
                      <th className="pb-3 pr-4">User</th>
                      <th className="pb-3 pr-4">Role</th>
                      <th className="pb-3 pr-4">Plan</th>
                      <th className="pb-3 pr-4">KYC</th>
                      <th className="pb-3 pr-4">Balance</th>
                      <th className="pb-3 pr-4">Joined</th>
                      <th className="pb-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userList.map((u) => (
                      <tr key={u.uid} className={`border-b border-gray-800/50 hover:bg-gray-800/50 ${u.deleted_at ? 'opacity-50' : ''}`}>
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                              {u.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="font-medium text-white">{u.name || 'Unknown'}</div>
                              <div className="text-xs text-gray-500">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            u.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                            u.role === 'manager' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {u.role || 'user'}
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            u.subscription_plan === 'elite' ? 'bg-amber-500/20 text-amber-400' :
                            u.subscription_plan === 'growth' ? 'bg-emerald-500/20 text-emerald-400' :
                            u.subscription_plan === 'startup' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {u.subscription_plan || 'explorer'}
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            u.kyc_status === 'verified' ? 'bg-green-500/20 text-green-400' :
                            u.kyc_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            u.kyc_status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {u.kyc_status || 'none'}
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <span className="text-white font-mono">{(u.prc_balance || 0).toLocaleString()}</span>
                          <span className="text-gray-500 text-xs ml-1">PRC</span>
                        </td>
                        <td className="py-4 pr-4 text-gray-400 text-sm">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-4">
                          <Button
                            size="sm"
                            onClick={() => selectUserFromList(u)}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {userListTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={userListPage === 1}
                    onClick={() => setUserListPage(p => p - 1)}
                    className="border-gray-700"
                  >
                    Previous
                  </Button>
                  <span className="px-4 py-2 text-gray-400">
                    Page {userListPage} of {userListTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={userListPage === userListTotalPages}
                    onClick={() => setUserListPage(p => p + 1)}
                    className="border-gray-700"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Search Mode - Search Section */}
      {viewMode === 'search' && (
        <>
          <Card className="p-6 mb-6 bg-gray-900 border-gray-800">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                  placeholder="Search by Email, Mobile, Aadhaar, PAN, UID, or Referral Code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-12 bg-gray-800 border-gray-700 text-white text-lg h-12"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 h-12 px-8"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Search className="w-5 h-5 mr-2" />}
                Search User
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="px-2 py-1 bg-gray-800 rounded">Email</span>
              <span className="px-2 py-1 bg-gray-800 rounded">Mobile</span>
              <span className="px-2 py-1 bg-gray-800 rounded">Aadhaar (last 4 digits)</span>
              <span className="px-2 py-1 bg-gray-800 rounded">PAN</span>
              <span className="px-2 py-1 bg-gray-800 rounded">User ID</span>
              <span className="px-2 py-1 bg-gray-800 rounded">Referral Code</span>
            </div>
          </Card>

      {/* User Data */}
      {userData && (
        <div className="space-y-6">
          {/* Top Row - Profile & Financial Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Card */}
            <Card className="p-6 bg-gray-900 border-gray-800 lg:col-span-1">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-400" />
                  Profile
                </h2>
                {(() => {
                  const badge = getMembershipBadge(userData.user.subscription_plan || userData.user.membership_type);
                  const Icon = badge.icon;
                  return (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${badge.color} flex items-center gap-1`}>
                      <Icon className="w-3 h-3" />
                      {badge.label}
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                  {userData.user.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{userData.user.name || 'Unknown'}</h3>
                  <p className="text-gray-400 text-sm flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {userData.user.email}
                    <button onClick={() => copyToClipboard(userData.user.email)} className="ml-1 text-gray-500 hover:text-white">
                      <Copy className="w-3 h-3" />
                    </button>
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-2"><Phone className="w-4 h-4" /> Mobile</span>
                  <span className="text-white">{userData.user.mobile || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-2"><MapPin className="w-4 h-4" /> Location</span>
                  <span className="text-white">{userData.user.city ? `${userData.user.city}, ${userData.user.state}` : 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-2"><Calendar className="w-4 h-4" /> Joined</span>
                  <span className="text-white">{formatDate(userData.user.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-2"><Shield className="w-4 h-4" /> KYC Status</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${userData.user.kyc_status === 'verified' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {userData.user.kyc_status || 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-2"><FileText className="w-4 h-4" /> Aadhaar</span>
                  <span className="text-white font-mono">{userData.user.aadhaar_number ? `•••• ${userData.user.aadhaar_number.slice(-4)}` : 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-2"><CreditCard className="w-4 h-4" /> PAN</span>
                  <span className="text-white font-mono">{userData.user.pan_number || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-2"><Activity className="w-4 h-4" /> Last Login</span>
                  <span className="text-white">{formatDate(userData.user.last_login)}</span>
                </div>
              </div>

              {/* User ID */}
              <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">User ID</p>
                <div className="flex items-center justify-between">
                  <code className="text-xs text-purple-400 font-mono truncate">{userData.user.uid}</code>
                  <button onClick={() => copyToClipboard(userData.user.uid)} className="text-gray-500 hover:text-white">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>

            {/* Financial Summary */}
            <Card className="p-6 bg-gray-900 border-gray-800 lg:col-span-2">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Wallet className="w-5 h-5 text-green-400" />
                Financial Summary
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl border border-green-500/30">
                  <p className="text-green-400 text-xs font-medium mb-1">PRC Balance</p>
                  <p className="text-2xl font-bold text-white">{formatNumber(userData.user.prc_balance)}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-xl border border-blue-500/30">
                  <p className="text-blue-400 text-xs font-medium mb-1">Total Mined</p>
                  <p className="text-2xl font-bold text-white">{formatNumber(userData.stats.total_mined)}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/10 rounded-xl border border-purple-500/30">
                  <p className="text-purple-400 text-xs font-medium mb-1">Total Redeemed</p>
                  <p className="text-2xl font-bold text-white">{formatNumber(userData.stats.total_redeemed)}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-xl border border-amber-500/30">
                  <p className="text-amber-400 text-xs font-medium mb-1">Cashback Wallet</p>
                  <p className="text-2xl font-bold text-white">₹{formatNumber(userData.user.cashback_wallet_balance || 0)}</p>
                </div>
              </div>

              {/* Mining Status */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-gray-800 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Mining Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${userData.user.mining_active ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      {userData.user.mining_active ? '✅ Active' : '⏸ Paused'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Daily Cap</span>
                    <span className="text-white">{userData.user.daily_prc_cap > 0 ? `${userData.user.daily_prc_cap} PRC` : 'Unlimited'}</span>
                  </div>
                </div>
                <div className="p-4 bg-gray-800 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Subscription</span>
                    <span className="text-white capitalize">{userData.user.subscription_plan || 'Explorer'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Expiry</span>
                    <span className="text-white">{formatDate(userData.user.subscription_expiry)}</span>
                  </div>
                </div>
              </div>

              {/* Risk Score */}
              {(() => {
                const risk = getRiskScore();
                return (
                  <div className={`p-4 rounded-xl border ${
                    risk.color === 'red' ? 'bg-red-500/10 border-red-500/50' :
                    risk.color === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/50' :
                    'bg-green-500/10 border-green-500/50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-5 h-5 ${
                          risk.color === 'red' ? 'text-red-400' :
                          risk.color === 'yellow' ? 'text-yellow-400' :
                          'text-green-400'
                        }`} />
                        <span className="font-medium text-white">Risk Score</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl font-bold ${
                          risk.color === 'red' ? 'text-red-400' :
                          risk.color === 'yellow' ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>{risk.score}/100</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium uppercase ${
                          risk.color === 'red' ? 'bg-red-500/20 text-red-400' :
                          risk.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>{risk.level}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>

          {/* Second Row - Referral Network */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Network className="w-5 h-5 text-cyan-400" />
              Referral Network
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-gray-800 rounded-xl text-center">
                <p className="text-gray-400 text-xs mb-1">Referral Code</p>
                <p className="text-lg font-bold text-purple-400 font-mono">{userData.user.referral_code || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-xl text-center">
                <p className="text-gray-400 text-xs mb-1">Referred By</p>
                <p className="text-lg font-bold text-white">{userData.referral.referred_by_name || 'Direct'}</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-xl text-center">
                <p className="text-gray-400 text-xs mb-1">Total Referrals</p>
                <p className="text-2xl font-bold text-cyan-400">{userData.referral.total_referrals}</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-xl text-center">
                <p className="text-gray-400 text-xs mb-1">Active Referrals</p>
                <p className="text-2xl font-bold text-green-400">{userData.referral.active_referrals}</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-xl text-center">
                <p className="text-gray-400 text-xs mb-1">Referral Earnings</p>
                <p className="text-2xl font-bold text-amber-400">{formatNumber(userData.referral.total_earnings)} PRC</p>
              </div>
            </div>

            {/* Referral List */}
            {userData.referral.referrals?.length > 0 && (
              <div className="mt-4">
                <p className="text-gray-400 text-sm mb-2">Recent Referrals:</p>
                <div className="flex flex-wrap gap-2">
                  {userData.referral.referrals.slice(0, 10).map((ref, idx) => (
                    <span key={idx} className="px-3 py-1 bg-gray-800 rounded-full text-sm text-white">
                      {ref.name || ref.email?.split('@')[0]}
                    </span>
                  ))}
                  {userData.referral.referrals.length > 10 && (
                    <span className="px-3 py-1 bg-gray-700 rounded-full text-sm text-gray-400">
                      +{userData.referral.referrals.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Third Row - Orders/Bills/Vouchers Tabs */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            {/* Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {[
                { id: 'orders', label: 'Orders', icon: ShoppingBag, count: userData.transactions.orders?.length || 0 },
                { id: 'bills', label: 'Bill Payments', icon: Receipt, count: userData.transactions.bill_payments?.length || 0 },
                { id: 'redemptions', label: 'Redemptions', icon: Wallet, count: userData.transactions.redemptions?.length || 0 },
                { id: 'mining', label: 'Mining', icon: Zap, count: userData.transactions.mining_history?.length || 0 },
                { id: 'vouchers', label: 'Vouchers', icon: Gift, count: userData.transactions.gift_vouchers?.length || 0 },
                { id: 'subscriptions', label: 'Plans', icon: Crown, count: userData.transactions.subscriptions?.length || 0 },
                { id: 'prc_ledger', label: 'PRC Ledger', icon: FileText, count: userData.transactions.prc_ledger?.length || 0 },
                { id: 'login_history', label: 'Logins', icon: Activity, count: userData.login_history?.length || 0 }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                    activeTab === tab.id 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-gray-700'
                  }`}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {activeTab === 'orders' && (
                <div className="space-y-2">
                  {userData.transactions.orders?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No orders found</p>
                  ) : (
                    userData.transactions.orders?.map((order, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div>
                          <p className="text-white font-medium">Order #{order.order_id?.slice(0, 8)}</p>
                          <p className="text-gray-400 text-sm">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white">{order.total_prc || order.prc_amount} PRC</p>
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'bills' && (
                <div className="space-y-2">
                  {userData.transactions.bill_payments?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No bill payments found</p>
                  ) : (
                    userData.transactions.bill_payments?.map((bill, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div>
                          <p className="text-white font-medium capitalize">{bill.request_type?.replace('_', ' ')}</p>
                          <p className="text-gray-400 text-xs">{formatDate(bill.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white">₹{bill.amount_inr}</p>
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(bill.status)}`}>{bill.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'redemptions' && (
                <div className="space-y-2">
                  {userData.transactions.redemptions?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No redemption requests found</p>
                  ) : (
                    userData.transactions.redemptions?.map((redeem, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div>
                          <p className="text-white font-medium">{redeem.type || 'Bank Transfer'}</p>
                          <p className="text-gray-400 text-xs">
                            {redeem.account_number ? `A/C: ****${redeem.account_number.slice(-4)}` : ''}
                            {' • '}{formatDate(redeem.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-amber-400 font-bold">{redeem.prc_amount || redeem.amount} PRC</p>
                          <p className="text-green-400 text-sm">₹{redeem.inr_amount || (redeem.amount / 10)}</p>
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(redeem.status)}`}>{redeem.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'mining' && (
                <div className="space-y-2">
                  {userData.transactions.mining_history?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No mining history found</p>
                  ) : (
                    userData.transactions.mining_history?.slice(0, 50).map((mine, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div>
                          <p className="text-white font-medium flex items-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-400" />
                            Mining Session
                          </p>
                          <p className="text-gray-400 text-xs">{formatDate(mine.created_at || mine.timestamp)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-green-400 font-bold">+{mine.prc_earned || mine.amount} PRC</p>
                          <p className="text-gray-400 text-xs">{mine.session_duration || mine.duration || '0'} min</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'vouchers' && (
                <div className="space-y-2">
                  {userData.transactions.gift_vouchers?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No gift vouchers found</p>
                  ) : (
                    userData.transactions.gift_vouchers?.map((voucher, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div>
                          <p className="text-white font-medium">₹{voucher.denomination} Voucher</p>
                          <p className="text-gray-400 text-sm">{formatDate(voucher.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white">{voucher.total_prc_deducted} PRC</p>
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(voucher.status)}`}>
                            {voucher.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'subscriptions' && (
                <div className="space-y-4">
                  {/* Current Active Plan */}
                  {userData.user?.subscription_plan && userData.user?.subscription_plan !== 'explorer' && (
                    <div className="p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                            <Crown className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-purple-300 uppercase tracking-wider">Current Plan</p>
                            <p className="text-xl font-bold text-white capitalize">{userData.user?.subscription_plan || 'Explorer'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Expires</p>
                          <p className="text-white font-medium">
                            {userData.user?.subscription_expiry 
                              ? formatDate(userData.user.subscription_expiry)
                              : 'Never (Lifetime)'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Subscription History */}
                  <p className="text-gray-400 text-sm font-medium">Payment History</p>
                  {userData.transactions.subscriptions?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No subscription payments found</p>
                  ) : (
                    userData.transactions.subscriptions?.map((sub, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-gray-800 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            sub.status === 'approved' ? 'bg-green-500/20' : 
                            sub.status === 'pending' ? 'bg-yellow-500/20' : 'bg-red-500/20'
                          }`}>
                            <Crown className={`w-5 h-5 ${
                              sub.status === 'approved' ? 'text-green-400' : 
                              sub.status === 'pending' ? 'text-yellow-400' : 'text-red-400'
                            }`} />
                          </div>
                          <div>
                            <p className="text-white font-medium capitalize">
                              {sub.subscription_plan || sub.plan_name || 'Plan'} 
                              {sub.plan_type && ` - ${sub.plan_type}`}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {sub.duration ? `${sub.duration} months` : ''} • {formatDate(sub.submitted_at || sub.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">₹{sub.amount || sub.amount_paid || 0}</p>
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(sub.status)}`}>
                            {sub.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'prc_ledger' && (
                <div className="space-y-2">
                  {userData.transactions.prc_ledger?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No PRC transactions found</p>
                  ) : (
                    userData.transactions.prc_ledger?.slice(0, 100).map((txn, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            txn.type === 'credit' ? 'bg-green-500/20' : 'bg-red-500/20'
                          }`}>
                            {txn.type === 'credit' ? (
                              <TrendingUp className="w-4 h-4 text-green-400" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{txn.description || txn.reason || 'Transaction'}</p>
                            <p className="text-gray-400 text-xs">{formatDate(txn.created_at || txn.timestamp)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${txn.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                            {txn.type === 'credit' ? '+' : '-'}{txn.amount} PRC
                          </p>
                          <p className="text-gray-500 text-xs">Bal: {txn.balance_after || 'N/A'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'login_history' && (
                <div className="space-y-2">
                  {userData.login_history?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No login history found</p>
                  ) : (
                    userData.login_history?.slice(0, 50).map((login, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            login.success !== false ? 'bg-green-500/20' : 'bg-red-500/20'
                          }`}>
                            {login.success !== false ? (
                              <Eye className="w-4 h-4 text-green-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">
                              {login.success !== false ? 'Successful Login' : 'Failed Attempt'}
                            </p>
                            <p className="text-gray-400 text-xs">{formatDate(login.timestamp || login.created_at)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400 text-xs truncate max-w-32" title={login.ip_address}>
                            IP: {login.ip_address || 'N/A'}
                          </p>
                          <p className="text-gray-500 text-xs truncate max-w-40" title={login.user_agent || login.device}>
                            {login.device || login.user_agent?.slice(0, 30) || 'Unknown device'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Fourth Row - Quick Actions & Admin Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card className="p-6 bg-gray-900 border-gray-800">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-orange-400" />
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleQuickAction(userData.user.mining_active ? 'pause_mining' : 'resume_mining')}
                  disabled={processing}
                  variant="outline"
                  className={`h-auto py-3 ${userData.user.mining_active ? 'border-orange-500/50 text-orange-400' : 'border-green-500/50 text-green-400'}`}
                >
                  {userData.user.mining_active ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {userData.user.mining_active ? 'Pause Mining' : 'Resume Mining'}
                </Button>
                <Button
                  onClick={() => {
                    const amount = prompt('Enter PRC amount to add/subtract (use negative for deduction):');
                    if (amount) handleQuickAction('adjust_balance', { amount: parseFloat(amount) });
                  }}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-blue-500/50 text-blue-400"
                >
                  <Coins className="w-4 h-4 mr-2" />
                  Adjust Balance
                </Button>
                <Button
                  onClick={() => {
                    const cap = prompt('Enter daily PRC cap (0 for unlimited):');
                    if (cap !== null) handleQuickAction('set_cap', { cap: parseInt(cap) });
                  }}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-purple-500/50 text-purple-400"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Set Daily Cap
                </Button>
                <Button
                  onClick={() => {
                    if (confirm('Generate a new 6-digit PIN for this user?')) handleQuickAction('reset_pin');
                  }}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-teal-500/50 text-teal-400"
                  data-testid="reset-pin-button"
                >
                  <Key className="w-4 h-4 mr-2" />
                  Reset PIN
                </Button>
                <Button
                  onClick={() => {
                    if (confirm('Clear login lockout for this user? They will be able to login immediately.')) handleQuickAction('clear_lockout');
                  }}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-orange-500/50 text-orange-400"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Clear Lockout
                </Button>
                <Button
                  onClick={() => {
                    const message = prompt('Enter notification message:');
                    if (message) handleQuickAction('send_notification', { message });
                  }}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-amber-500/50 text-amber-400"
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Send Notification
                </Button>
                <Button
                  onClick={openEditModal}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-indigo-500/50 text-indigo-400"
                  data-testid="edit-user-details-button"
                >
                  <User className="w-4 h-4 mr-2" />
                  Edit Details
                </Button>
                <Button
                  onClick={() => {
                    if (confirm('⚠️ Are you sure you want to block this user?')) handleQuickAction('block_user');
                  }}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-red-500/50 text-red-400"
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Block User
                </Button>
              </div>
            </Card>

            {/* Admin Notes */}
            <Card className="p-6 bg-gray-900 border-gray-800">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-pink-400" />
                Admin Notes
              </h2>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about this user..."
                className="w-full h-32 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <Button
                onClick={saveAdminNotes}
                disabled={processing}
                className="mt-3 w-full bg-pink-600 hover:bg-pink-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Save Notes
              </Button>
            </Card>
          </div>

          {/* Activity Timeline */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-indigo-400" />
              Recent Activity
            </h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {userData.activity?.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent activity</p>
              ) : (
                userData.activity?.slice(0, 20).map((act, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{act.description || act.action_type}</p>
                      <p className="text-gray-500 text-xs">{formatDate(act.created_at || act.timestamp)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* No User Selected */}
      {!userData && !loading && (
        <Card className="p-12 text-center bg-gray-900 border-gray-800">
          <Search className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-medium text-gray-400 mb-2">Search for a User</h3>
          <p className="text-gray-500">Enter email, mobile, Aadhaar, PAN, or UID to view complete user details</p>
        </Card>
      )}

      {/* PIN Reset Modal */}
      {pinModal.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" data-testid="pin-reset-modal">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              {/* Success Icon */}
              <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Key className="w-10 h-10 text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">PIN Reset Successful!</h2>
              <p className="text-gray-400 mb-6">New 6-digit PIN has been generated</p>
              
              {/* PIN Display */}
              <div className="bg-gray-800 border-2 border-teal-500/30 rounded-2xl p-6 mb-6">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">New Temporary PIN</p>
                <div className="flex justify-center gap-2">
                  {pinModal.pin.split('').map((digit, index) => (
                    <div 
                      key={index}
                      className="w-12 h-14 bg-gray-700 border border-teal-500/50 rounded-xl flex items-center justify-center"
                    >
                      <span className="text-2xl font-bold text-teal-400">{digit}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(pinModal.pin);
                    toast.success('PIN copied to clipboard!');
                  }}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white"
                  data-testid="copy-pin-button"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy PIN
                </Button>
                <Button
                  onClick={() => setPinModal({ show: false, pin: '' })}
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                  data-testid="close-pin-modal-button"
                >
                  Close
                </Button>
              </div>
              
              <p className="text-xs text-gray-500 mt-4">
                Please share this PIN securely with the user. They can use it to login immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* General Success/Error Modal - Centered */}
      {successModal.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" data-testid="success-modal">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              {/* Icon based on type */}
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                successModal.type === 'error' 
                  ? 'bg-gradient-to-br from-red-500 to-red-600' 
                  : successModal.type === 'warning'
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                    : 'bg-gradient-to-br from-green-500 to-emerald-600'
              }`}>
                {successModal.type === 'error' ? (
                  <XCircle className="w-10 h-10 text-white" />
                ) : successModal.type === 'warning' ? (
                  <AlertTriangle className="w-10 h-10 text-white" />
                ) : (
                  <CheckCircle className="w-10 h-10 text-white" />
                )}
              </div>
              
              <h2 className={`text-2xl font-bold mb-4 ${
                successModal.type === 'error' ? 'text-red-400' 
                  : successModal.type === 'warning' ? 'text-amber-400' 
                  : 'text-green-400'
              }`}>
                {successModal.title}
              </h2>
              
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 mb-6">
                <p className="text-white text-lg">
                  {successModal.message}
                </p>
              </div>
              
              <Button
                onClick={() => setSuccessModal({ show: false, title: '', message: '', type: 'success' })}
                className={`w-full ${
                  successModal.type === 'error' 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700' 
                    : successModal.type === 'warning'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                } text-white`}
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Details Modal */}
      {editModal.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto" data-testid="edit-user-modal">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-6 max-w-3xl w-full mx-4 my-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <User className="w-6 h-6 text-indigo-400" />
                Edit User Details
              </h2>
              <button
                onClick={() => setEditModal({ show: false })}
                className="p-2 hover:bg-gray-700 rounded-lg"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" /> Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Full Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      data-testid="edit-name-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Date of Birth</label>
                    <input
                      type="date"
                      value={editForm.date_of_birth}
                      onChange={(e) => setEditForm({...editForm, date_of_birth: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Gender</label>
                    <select
                      value={editForm.gender}
                      onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Contact Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      data-testid="edit-email-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Mobile Number</label>
                    <input
                      type="tel"
                      value={editForm.mobile}
                      onChange={(e) => setEditForm({...editForm, mobile: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      data-testid="edit-mobile-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Alternate Mobile</label>
                    <input
                      type="tel"
                      value={editForm.alternate_mobile}
                      onChange={(e) => setEditForm({...editForm, alternate_mobile: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Address
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-400 mb-1 block">Street Address</label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      data-testid="edit-address-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">City</label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">State</label>
                    <input
                      type="text"
                      value={editForm.state}
                      onChange={(e) => setEditForm({...editForm, state: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Pincode</label>
                    <input
                      type="text"
                      value={editForm.pincode}
                      onChange={(e) => setEditForm({...editForm, pincode: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* KYC Documents */}
              <div>
                <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> KYC Documents
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">PAN Number</label>
                    <input
                      type="text"
                      value={editForm.pan_number}
                      onChange={(e) => setEditForm({...editForm, pan_number: e.target.value.toUpperCase()})}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white uppercase focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      data-testid="edit-pan-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Aadhaar Number</label>
                    <input
                      type="text"
                      value={editForm.aadhaar_number}
                      onChange={(e) => setEditForm({...editForm, aadhaar_number: e.target.value.replace(/\D/g, '')})}
                      placeholder="123456789012"
                      maxLength={12}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      data-testid="edit-aadhaar-input"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div>
                <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Bank Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Bank Name</label>
                    <input
                      type="text"
                      value={editForm.bank_name}
                      onChange={(e) => setEditForm({...editForm, bank_name: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Account Number</label>
                    <input
                      type="text"
                      value={editForm.bank_account_number}
                      onChange={(e) => setEditForm({...editForm, bank_account_number: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">IFSC Code</label>
                    <input
                      type="text"
                      value={editForm.bank_ifsc}
                      onChange={(e) => setEditForm({...editForm, bank_ifsc: e.target.value.toUpperCase()})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white uppercase focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">UPI ID</label>
                    <input
                      type="text"
                      value={editForm.upi_id}
                      onChange={(e) => setEditForm({...editForm, upi_id: e.target.value})}
                      placeholder="name@upi"
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Nominee Details */}
              <div>
                <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Nominee Details
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Nominee Name</label>
                    <input
                      type="text"
                      value={editForm.nominee_name}
                      onChange={(e) => setEditForm({...editForm, nominee_name: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Relation</label>
                    <select
                      value={editForm.nominee_relation}
                      onChange={(e) => setEditForm({...editForm, nominee_relation: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select Relation</option>
                      <option value="spouse">Spouse</option>
                      <option value="father">Father</option>
                      <option value="mother">Mother</option>
                      <option value="son">Son</option>
                      <option value="daughter">Daughter</option>
                      <option value="brother">Brother</option>
                      <option value="sister">Sister</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Nominee Mobile</label>
                    <input
                      type="tel"
                      value={editForm.nominee_mobile}
                      onChange={(e) => setEditForm({...editForm, nominee_mobile: e.target.value})}
                      className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-700">
              <Button
                onClick={handleSaveUserDetails}
                disabled={processing}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                data-testid="save-user-details-button"
              >
                {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
              <Button
                onClick={() => setEditModal({ show: false })}
                variant="outline"
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUser360;
