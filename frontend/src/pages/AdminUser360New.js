import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import ManagerPermissions from '../components/ManagerPermissions';
import {
  Search, User, Mail, Phone, MapPin, Calendar, Shield, Crown,
  Coins, TrendingUp, TrendingDown, Users, Gift, CreditCard, Clock,
  CheckCircle, XCircle, AlertTriangle, Activity, RefreshCw, FileText,
  Loader2, ArrowLeft, Copy, Ban, Wallet, Receipt, BadgeCheck, Zap,
  Plus, Minus, History, Send, Key, UserX, Trash2, Edit, ShoppingBag,
  Link, Unlink, X, Check, Eye, EyeOff, Settings, Lock, Network, Play, Pause
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ========== MODAL COMPONENT ==========
const Modal = ({ show, onClose, title, children, size = "md" }) => {
  if (!show) return null;
  
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl"
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-4">
      <div className={`bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full ${sizeClasses[size]} mx-4 shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-gray-900 pb-2">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ========== STAT CARD ==========
const StatCard = ({ icon: Icon, label, value, color = "amber", subtext }) => (
  <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-${color}-500/20`}>
        <Icon className={`h-5 w-5 text-${color}-400`} />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
        {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
      </div>
    </div>
  </div>
);

// ========== HELPER FUNCTIONS ==========
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
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
    success: 'bg-green-500/20 text-green-400 border-green-500/50',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/50',
    failed: 'bg-red-500/20 text-red-400 border-red-500/50',
    cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    verified: 'bg-green-500/20 text-green-400 border-green-500/50'
  };
  return badges[status?.toLowerCase()] || 'bg-gray-500/20 text-gray-400';
};

// ========== USER PROFILE CARD ==========
const UserProfileCard = ({ user, onEditClick }) => {
  if (!user) return null;
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };
  
  const planColors = {
    free: 'gray', explorer: 'gray',
    startup: 'blue',
    growth: 'purple',
    elite: 'amber'
  };
  
  const roleColors = {
    user: 'gray',
    admin: 'red',
    sub_admin: 'orange',
    manager: 'purple'
  };
  
  const planColor = planColors[user.subscription_plan] || 'gray';
  const roleColor = roleColors[user.role] || 'gray';
  
  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {user.name || 'Unknown User'}
              {user.is_banned && (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1">
                  <Ban className="h-3 w-3" /> BLOCKED
                </span>
              )}
              {user.kyc_status === 'verified' && (
                <BadgeCheck className="h-5 w-5 text-green-400" />
              )}
            </h2>
            <p className="text-sm text-gray-400 flex items-center gap-2">
              UID: {user.uid}
              <button onClick={() => copyToClipboard(user.uid)} className="hover:text-white transition-colors">
                <Copy className="h-3 w-3" />
              </button>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Role: <span className={`text-${roleColor}-400 font-medium uppercase`}>{user.role || 'user'}</span>
            </p>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 items-end">
          <div className={`px-3 py-1.5 rounded-full bg-${planColor}-500/20 border border-${planColor}-500/30`}>
            <span className={`text-${planColor}-400 font-semibold capitalize flex items-center gap-1`}>
              <Crown className="h-4 w-4" />
              {user.subscription_plan || 'Explorer'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm bg-amber-500/10 px-3 py-1 rounded-lg">
            <Wallet className="h-4 w-4 text-amber-500" />
            <span className="text-amber-400 font-bold">{formatNumber((user.prc_balance || 0).toFixed(2))} PRC</span>
          </div>
          <Button size="sm" variant="outline" onClick={onEditClick} className="border-gray-600 text-gray-300">
            <Edit className="h-3 w-3 mr-1" /> Edit Profile
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700/50">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-gray-500" />
          <span className="text-gray-300 truncate">{user.email || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 text-gray-500" />
          <span className="text-gray-300">{user.mobile || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="text-gray-300">
            {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link className="h-4 w-4 text-blue-500" />
          <span className="text-blue-400">
            Ref: {user.referral_code || 'N/A'}
          </span>
        </div>
      </div>
      
      {/* KYC Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-gray-700/50">
        <div className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-gray-500" />
          <span className="text-gray-400">KYC:</span>
          <span className={`px-2 py-0.5 rounded text-xs ${
            user.kyc_status === 'verified' ? 'bg-green-500/20 text-green-400' :
            user.kyc_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
            user.kyc_status === 'rejected' ? 'bg-red-500/20 text-red-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>{user.kyc_status || 'Not Submitted'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-gray-500" />
          <span className="text-gray-400">Mining:</span>
          <span className={`px-2 py-0.5 rounded text-xs ${user.mining_active !== false ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
            {user.mining_active !== false ? 'Active' : 'Paused'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className="text-gray-400">Expiry:</span>
          <span className="text-gray-300 text-xs">{formatDate(user.subscription_expiry || user.subscription_expires)}</span>
        </div>
        {user.referred_by && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-blue-400" />
            <span className="text-gray-400">By:</span>
            <span className="text-blue-400">{user.referred_by}</span>
          </div>
        )}
      </div>
    </Card>
  );
};

// ========== MAIN COMPONENT ==========
const AdminUser360New = ({ user: adminUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // State
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('transactions');
  
  // Browse Mode State
  const [viewMode, setViewMode] = useState('search');
  const [userList, setUserList] = useState([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const [userListPage, setUserListPage] = useState(1);
  const [userListTotal, setUserListTotal] = useState(0);
  const [filterRole, setFilterRole] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterKYC, setFilterKYC] = useState('');
  const [browseSearch, setBrowseSearch] = useState('');
  
  // Modals State
  const [showPinReset, setShowPinReset] = useState(false);
  const [showRoleChange, setShowRoleChange] = useState(false);
  const [showBalanceAdjust, setShowBalanceAdjust] = useState(false);
  const [showReferralChange, setShowReferralChange] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showDiagnose, setShowDiagnose] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showKYCAction, setShowKYCAction] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  
  // Form States
  const [selectedRole, setSelectedRole] = useState('user');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceOperation, setBalanceOperation] = useState('add');
  const [newReferrer, setNewReferrer] = useState('');
  const [newPin, setNewPin] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  
  // Edit Profile Form
  const [editForm, setEditForm] = useState({
    name: '', email: '', mobile: '', alternate_mobile: '',
    address: '', city: '', state: '', pincode: '',
    pan_number: '', aadhaar_number: '',
    bank_name: '', bank_account_number: '', bank_ifsc: '', upi_id: '',
    date_of_birth: '', gender: '',
    nominee_name: '', nominee_relation: '', nominee_mobile: ''
  });
  
  // Diagnosis State
  const [diagnoseData, setDiagnoseData] = useState(null);
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  
  // Subscription Form
  const [subscriptionForm, setSubscriptionForm] = useState({
    plan: 'explorer',
    duration: 28,  // Default 28 days
    expiryMode: 'auto',
    manualExpiry: '',
    isFree: true,
    notes: ''
  });
  
  // KYC Action
  const [kycAction, setKycAction] = useState('');
  const [kycReason, setKycReason] = useState('');

  // ========== API FUNCTIONS ==========
  
  // Search user
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }
    
    setLoading(true);
    setError(null);
    setUserData(null);
    
    try {
      // Try new endpoint first, fallback to old
      let response;
      try {
        response = await axios.get(`${API}/admin/user-360?query=${encodeURIComponent(searchQuery.trim())}`, {
          headers: { Authorization: `Bearer ${adminUser?.token}` }
        });
      } catch (e) {
        // Fallback to new modular endpoint
        const searchResp = await axios.get(`${API}/admin/user360/search?q=${encodeURIComponent(searchQuery.trim())}`, {
          headers: { Authorization: `Bearer ${adminUser?.token}` }
        });
        response = await axios.get(`${API}/admin/user360/full/${searchResp.data.user.uid}`, {
          headers: { Authorization: `Bearer ${adminUser?.token}` }
        });
      }
      
      setUserData(response.data);
      setAdminNotes(response.data.user?.admin_notes || '');
      toast.success(`Loaded: ${response.data.user?.name || response.data.user?.email}`);
      
    } catch (err) {
      console.error('Search error:', err);
      const message = err.response?.data?.detail || err.message || 'Search failed';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, adminUser?.token]);

  // Refresh user data silently
  const refreshUserData = async () => {
    if (!userData?.user?.uid) return;
    try {
      const response = await axios.get(`${API}/admin/user-360?query=${encodeURIComponent(userData.user.uid)}`, {
        headers: { Authorization: `Bearer ${adminUser?.token}` }
      });
      setUserData(response.data);
      setAdminNotes(response.data.user?.admin_notes || '');
    } catch (error) {
      console.error('Refresh error:', error);
    }
  };

  // Fetch user list for browse mode
  const fetchUserList = async () => {
    setUserListLoading(true);
    try {
      let url = `${API}/admin/users/all?page=${userListPage}&limit=20`;
      if (browseSearch) url += `&search=${encodeURIComponent(browseSearch)}`;
      if (filterRole) url += `&role=${filterRole}`;
      if (filterPlan) url += `&membership=${filterPlan}`;
      if (filterKYC) url += `&kyc_status=${filterKYC}`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${adminUser?.token}` }
      });
      setUserList(response.data.users || []);
      setUserListTotal(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setUserListLoading(false);
    }
  };

  // Handle admin action (new endpoint)
  const handleAction = async (action, params = {}) => {
    if (!userData?.user?.uid) return null;
    
    setActionLoading(true);
    try {
      // Try new endpoint first
      const response = await axios.post(`${API}/admin/user360/action/${userData.user.uid}`, {
        action, ...params, admin_id: adminUser?.uid
      }, {
        headers: { Authorization: `Bearer ${adminUser?.token}` }
      });
      
      toast.success(response.data?.message || `Action '${action}' completed`);
      await refreshUserData();
      return response.data;
      
    } catch (err) {
      console.error('Action error:', err.response?.data || err.message);
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Operation failed';
      toast.error(errorMsg);
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  // ========== ACTION HANDLERS ==========
  
  const handlePinReset = async () => {
    const result = await handleAction('reset_pin', {});
    if (result?.new_pin) {
      setNewPin(result.new_pin);
    }
  };
  
  const handleRoleChange = async () => {
    await handleAction('change_role', { new_role: selectedRole, value: selectedRole });
    setShowRoleChange(false);
  };
  
  const handleBalanceAdjust = async () => {
    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    const actionType = balanceOperation === 'add' ? 'add_prc' : 'deduct_prc';
    await handleAction(actionType, { value: amount, reason: balanceReason });
    setBalanceAmount('');
    setBalanceReason('');
    setShowBalanceAdjust(false);
  };
  
  const handleReferralChange = async () => {
    if (!newReferrer.trim()) {
      toast.error('Please enter referrer UID or "remove"');
      return;
    }
    await handleAction('change_referral', { new_referrer: newReferrer.trim() });
    setNewReferrer('');
    setShowReferralChange(false);
  };
  
  const handleDeleteUser = async () => {
    await handleAction('delete_user', {});
    setShowDeleteConfirm(false);
    setUserData(null);
    toast.success('User deleted successfully');
  };
  
  const handleBlockToggle = async () => {
    const action = userData?.user?.is_banned ? 'unblock_user' : 'block_user';
    await handleAction(action, {});
  };
  
  const handleMiningToggle = async () => {
    const action = userData?.user?.mining_active !== false ? 'pause_mining' : 'resume_mining';
    await handleAction(action, {});
  };
  
  const handleSaveNotes = async () => {
    await handleAction('save_notes', { notes: adminNotes });
  };
  
  // Edit Profile
  const openEditProfile = () => {
    if (!userData?.user) return;
    const u = userData.user;
    setEditForm({
      name: u.name || '', email: u.email || '', mobile: u.mobile || '',
      alternate_mobile: u.alternate_mobile || '',
      address: u.address || '', city: u.city || '', state: u.state || '', pincode: u.pincode || '',
      pan_number: u.pan_number || '', aadhaar_number: u.aadhaar_number || '',
      bank_name: u.bank_name || '', bank_account_number: u.bank_account_number || '',
      bank_ifsc: u.bank_ifsc || '', upi_id: u.upi_id || '',
      date_of_birth: u.date_of_birth || '', gender: u.gender || '',
      nominee_name: u.nominee_name || '', nominee_relation: u.nominee_relation || '',
      nominee_mobile: u.nominee_mobile || ''
    });
    setShowEditProfile(true);
  };
  
  const handleSaveProfile = async () => {
    const updates = {};
    const u = userData.user;
    Object.keys(editForm).forEach(key => {
      if (editForm[key] !== (u[key] || '')) {
        updates[key] = editForm[key];
      }
    });
    
    if (Object.keys(updates).length === 0) {
      toast.info('No changes to save');
      setShowEditProfile(false);
      return;
    }
    
    await handleAction('update_user_details', { updates });
    setShowEditProfile(false);
  };
  
  // Diagnosis
  const runDiagnosis = async () => {
    if (!userData?.user?.uid) return;
    setDiagnoseLoading(true);
    setShowDiagnose(true);
    try {
      const response = await axios.get(`${API}/admin/user/${userData.user.uid}/diagnose`, {
        headers: { Authorization: `Bearer ${adminUser?.token}` }
      });
      setDiagnoseData(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Diagnosis failed');
      setShowDiagnose(false);
    } finally {
      setDiagnoseLoading(false);
    }
  };
  
  const autoFixAll = async () => {
    if (!userData?.user?.uid) return;
    try {
      toast.loading('Auto-fixing issues...', { id: 'auto-fix' });
      const response = await axios.post(`${API}/admin/user/${userData.user.uid}/auto-fix-all`, {
        admin_pin: '123456'
      }, {
        headers: { Authorization: `Bearer ${adminUser?.token}` }
      });
      toast.dismiss('auto-fix');
      
      if (response.data.total_fixed > 0) {
        toast.success(`Fixed ${response.data.total_fixed} issues!`);
      } else {
        toast.info('No issues to fix');
      }
      runDiagnosis();
      refreshUserData();
    } catch (error) {
      toast.dismiss('auto-fix');
      toast.error(error.response?.data?.detail || 'Auto-fix failed');
    }
  };
  
  const fixSingleIssue = async (fixAction, suggestedBalance = 0) => {
    try {
      const response = await axios.post(`${API}/admin/user/${userData.user.uid}/fix-issue`, {
        fix_action: fixAction,
        suggested_balance: suggestedBalance
      }, {
        headers: { Authorization: `Bearer ${adminUser?.token}` }
      });
      toast.success(response.data.message);
      runDiagnosis();
      refreshUserData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fix failed');
    }
  };
  
  // Subscription Management
  const handleSubscriptionUpdate = async () => {
    const days = subscriptionForm.duration;
    const expiry = subscriptionForm.expiryMode === 'auto'
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : subscriptionForm.manualExpiry;
    
    try {
      await axios.post(`${API}/admin/user-360/action`, {
        user_id: userData.user.uid,
        action: 'update_subscription',
        admin_id: adminUser?.uid,
        plan: subscriptionForm.plan,
        expiry_date: expiry,
        is_free: subscriptionForm.isFree,
        admin_notes: subscriptionForm.notes
      }, {
        headers: { Authorization: `Bearer ${adminUser?.token}` }
      });
      toast.success('Subscription updated');
      setShowSubscription(false);
      refreshUserData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Update failed');
    }
  };
  
  // KYC Actions
  const handleKYCAction = async () => {
    if (!kycAction) return;
    await handleAction(kycAction === 'approve' ? 'approve_kyc' : 'reject_kyc', {
      reason: kycReason
    });
    setShowKYCAction(false);
    setKycAction('');
    setKycReason('');
  };
  
  // Calculate Risk Score
  const getRiskScore = () => {
    if (!userData) return { score: 0, level: 'low', color: 'green' };
    
    let score = 0;
    const u = userData.user;
    const stats = userData.stats || {};
    
    if (u.prc_balance < 0) score += 30;
    if (u.kyc_status !== 'verified') score += 20;
    if ((stats.total_redeemed || 0) > (stats.total_mined || 0) * 1.5) score += 25;
    
    const daysSinceJoin = (Date.now() - new Date(u.created_at)) / (1000 * 60 * 60 * 24);
    if (daysSinceJoin < 7 && (stats.total_redeemed || 0) > 1000) score += 25;
    
    if (score >= 50) return { score, level: 'high', color: 'red' };
    if (score >= 25) return { score, level: 'medium', color: 'yellow' };
    return { score, level: 'low', color: 'green' };
  };

  // Effects
  useEffect(() => {
    if (viewMode === 'browse') {
      fetchUserList();
    }
  }, [viewMode, userListPage, browseSearch, filterRole, filterPlan, filterKYC]);
  
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchQuery(q);
      setTimeout(() => handleSearch(), 100);
    }
  }, []);

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin')} className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Eye className="h-6 w-6 text-purple-400" />
              User 360° View
            </h1>
            <p className="text-sm text-gray-400">Complete user analysis & management</p>
          </div>
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'search' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('search')}
            className={viewMode === 'search' ? 'bg-purple-600' : 'border-gray-700'}
          >
            <Search className="h-4 w-4 mr-2" /> Search
          </Button>
          <Button
            variant={viewMode === 'browse' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('browse')}
            className={viewMode === 'browse' ? 'bg-purple-600' : 'border-gray-700'}
          >
            <Users className="h-4 w-4 mr-2" /> Browse All
          </Button>
        </div>
      </div>

      {/* Browse Mode */}
      {viewMode === 'browse' && (
        <Card className="p-6 mb-6 bg-gray-900 border-gray-800">
          <div className="flex flex-wrap gap-4 mb-4">
            <Input
              placeholder="Search users..."
              value={browseSearch}
              onChange={(e) => { setBrowseSearch(e.target.value); setUserListPage(1); }}
              className="flex-1 min-w-[200px] bg-gray-800 border-gray-700"
            />
            <select value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setUserListPage(1); }}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
            </select>
            <select value={filterPlan} onChange={(e) => { setFilterPlan(e.target.value); setUserListPage(1); }}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
              <option value="">All Plans</option>
              <option value="elite">Elite</option>
              <option value="explorer">Explorer</option>
            </select>
            <select value={filterKYC} onChange={(e) => { setFilterKYC(e.target.value); setUserListPage(1); }}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
              <option value="">All KYC</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          
          {userListLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-purple-400" /></div>
          ) : userList.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No users found</div>
          ) : (
            <>
              <div className="text-sm text-gray-400 mb-3">Showing {userList.length} of {userListTotal} users</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-3">User</th>
                      <th className="pb-3">Role</th>
                      <th className="pb-3">Plan</th>
                      <th className="pb-3">KYC</th>
                      <th className="pb-3">Balance</th>
                      <th className="pb-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userList.map((u) => (
                      <tr key={u.uid} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-semibold">
                              {u.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="text-white font-medium">{u.name || 'Unknown'}</div>
                              <div className="text-gray-500 text-xs">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3"><span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>{u.role || 'user'}</span></td>
                        <td className="py-3"><span className={`px-2 py-0.5 rounded text-xs ${u.subscription_plan === 'elite' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>{u.subscription_plan || 'explorer'}</span></td>
                        <td className="py-3"><span className={`px-2 py-0.5 rounded text-xs ${u.kyc_status === 'verified' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{u.kyc_status || 'none'}</span></td>
                        <td className="py-3 text-white font-mono">{formatNumber((u.prc_balance || 0).toFixed(0))}</td>
                        <td className="py-3">
                          <Button size="sm" onClick={() => { setSearchQuery(u.uid); setViewMode('search'); handleSearch(); }} className="bg-purple-600 hover:bg-purple-700">
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="flex justify-center gap-2 mt-4">
                <Button size="sm" variant="outline" disabled={userListPage === 1} onClick={() => setUserListPage(p => p - 1)}>Previous</Button>
                <span className="px-4 py-2 text-gray-400">Page {userListPage}</span>
                <Button size="sm" variant="outline" onClick={() => setUserListPage(p => p + 1)}>Next</Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Search Mode */}
      {viewMode === 'search' && (
        <>
          {/* Search Bar */}
          <Card className="bg-gray-900/50 border-gray-700 p-4 mb-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <Input
                  placeholder="Search by UID, email, mobile, PAN, Aadhaar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  data-testid="user360-search-input"
                />
              </div>
              <Button onClick={handleSearch} disabled={loading} className="bg-amber-600 hover:bg-amber-700 min-w-[120px]" data-testid="user360-search-button">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-2" />Search</>}
              </Button>
            </div>
          </Card>
          
          {/* Error */}
          {error && (
            <Card className="bg-red-500/10 border-red-500/30 p-4 mb-6">
              <div className="flex items-center gap-3 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </Card>
          )}
          
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <span className="ml-3 text-gray-400">Loading user data...</span>
            </div>
          )}
          
          {/* User Data */}
          {userData && !loading && (
            <div className="space-y-6">
              {/* Profile Card */}
              <UserProfileCard user={userData.user} onEditClick={openEditProfile} />
              
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard icon={Coins} label="Total Mined" value={`${formatNumber((userData.stats?.total_mined || 0).toFixed(2))} PRC`} color="green" />
                <StatCard icon={TrendingUp} label="Total Redeemed" value={`₹${formatNumber((userData.stats?.total_redeemed || 0).toFixed(0))}`} color="blue" />
                <StatCard icon={Gift} label="Referral Bonus" value={`${formatNumber((userData.stats?.total_referral_bonus || 0).toFixed(2))} PRC`} color="purple" />
                <StatCard icon={Users} label="Total Referrals" value={userData.referral?.total_referrals || 0} color="cyan" />
                {/* Risk Score */}
                {(() => {
                  const risk = getRiskScore();
                  return (
                    <div className={`bg-${risk.color}-500/10 border border-${risk.color}-500/30 rounded-xl p-4`}>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`h-5 w-5 text-${risk.color}-400`} />
                        <div>
                          <p className="text-xs text-gray-400">Risk Score</p>
                          <p className={`text-xl font-bold text-${risk.color}-400`}>{risk.score}/100</p>
                          <span className={`text-xs px-2 py-0.5 rounded bg-${risk.color}-500/20 text-${risk.color}-400 uppercase`}>{risk.level}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* Quick Actions Row */}
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-400" />
                  Admin Actions
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {/* Block/Unblock */}
                  <Button onClick={handleBlockToggle} disabled={actionLoading}
                    className={userData.user?.is_banned ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}>
                    {userData.user?.is_banned ? <><CheckCircle className="h-4 w-4 mr-1" />Unblock</> : <><Ban className="h-4 w-4 mr-1" />Block</>}
                  </Button>
                  
                  {/* Mining Toggle */}
                  <Button onClick={handleMiningToggle} disabled={actionLoading}
                    className={userData.user?.mining_active !== false ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}>
                    {userData.user?.mining_active !== false ? <><Pause className="h-4 w-4 mr-1" />Pause Mining</> : <><Play className="h-4 w-4 mr-1" />Resume Mining</>}
                  </Button>
                  
                  {/* PIN Reset */}
                  <Button onClick={() => setShowPinReset(true)} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700">
                    <Key className="h-4 w-4 mr-1" />Reset PIN
                  </Button>
                  
                  {/* Role Change */}
                  <Button onClick={() => { setSelectedRole(userData.user?.role || 'user'); setShowRoleChange(true); }} disabled={actionLoading} className="bg-purple-600 hover:bg-purple-700">
                    <Settings className="h-4 w-4 mr-1" />Change Role
                  </Button>
                  
                  {/* Balance Adjust */}
                  <Button onClick={() => setShowBalanceAdjust(true)} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700">
                    <Wallet className="h-4 w-4 mr-1" />Adjust Balance
                  </Button>
                  
                  {/* Referral Change */}
                  <Button onClick={() => setShowReferralChange(true)} disabled={actionLoading} className="bg-cyan-600 hover:bg-cyan-700">
                    <Link className="h-4 w-4 mr-1" />Change Referral
                  </Button>
                  
                  {/* Subscription */}
                  <Button onClick={() => setShowSubscription(true)} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700">
                    <Crown className="h-4 w-4 mr-1" />Subscription
                  </Button>
                  
                  {/* Diagnose */}
                  <Button onClick={runDiagnosis} disabled={actionLoading} className="bg-purple-600 hover:bg-purple-700">
                    <Zap className="h-4 w-4 mr-1" />Diagnose
                  </Button>
                  
                  {/* KYC Actions */}
                  {userData.user?.kyc_status === 'pending' && (
                    <>
                      <Button onClick={() => { setKycAction('approve'); setShowKYCAction(true); }} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="h-4 w-4 mr-1" />Approve KYC
                      </Button>
                      <Button onClick={() => { setKycAction('reject'); setShowKYCAction(true); }} className="bg-red-600 hover:bg-red-700">
                        <XCircle className="h-4 w-4 mr-1" />Reject KYC
                      </Button>
                    </>
                  )}
                  
                  {/* Manage Permissions - Only for Manager role */}
                  {userData.user?.role === 'manager' && (
                    <Button onClick={() => setShowPermissions(true)} disabled={actionLoading} className="bg-indigo-600 hover:bg-indigo-700">
                      <Lock className="h-4 w-4 mr-1" />Manage Permissions
                    </Button>
                  )}
                  
                  {/* Delete User */}
                  <Button onClick={() => setShowDeleteConfirm(true)} disabled={actionLoading} className="bg-red-700 hover:bg-red-800">
                    <Trash2 className="h-4 w-4 mr-1" />Delete User
                  </Button>
                </div>
              </Card>
              
              {/* Admin Notes */}
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Admin Notes</h3>
                <div className="flex gap-2">
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this user..."
                    className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white resize-none h-20"
                  />
                  <Button onClick={handleSaveNotes} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700">
                    Save
                  </Button>
                </div>
              </Card>
              
              {/* Tabs */}
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {[
                    { id: 'transactions', label: 'Transactions', icon: Coins, count: userData.transactions?.length || 0 },
                    { id: 'redeem', label: 'Redemptions', icon: Receipt, count: userData.redeem_requests?.length || 0 },
                    { id: 'referrals', label: 'Referrals', icon: Users, count: userData.referral?.total_referrals || 0 },
                    { id: 'subscriptions', label: 'Sub History', icon: Crown, count: userData.subscription_history?.length || 0 },
                    { id: 'logins', label: 'Logins', icon: Activity, count: userData.login_history?.length || 0 },
                    { id: 'kyc', label: 'KYC Data', icon: Shield }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                        activeTab === tab.id ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                      {tab.count !== undefined && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-700">{tab.count}</span>}
                    </button>
                  ))}
                </div>
                
                {/* Tab Content */}
                <div className="max-h-96 overflow-y-auto">
                  {activeTab === 'transactions' && (
                    <div className="space-y-2">
                      {!userData.transactions?.length ? (
                        <p className="text-gray-500 text-center py-8">No transactions found</p>
                      ) : (
                        userData.transactions.slice(0, 50).map((txn, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${(txn.amount || 0) >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                {(txn.amount || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
                              </div>
                              <div>
                                <p className="text-white font-medium text-sm">{txn.type || txn.description || 'Transaction'}</p>
                                <p className="text-gray-500 text-xs">{formatDate(txn.created_at)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${(txn.amount || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {(txn.amount || 0) >= 0 ? '+' : ''}{(txn.amount || 0).toFixed(2)} PRC
                              </p>
                              <p className="text-gray-500 text-xs">Bal: {(txn.balance_after || 0).toFixed(2)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'redeem' && (
                    <div className="space-y-2">
                      {!userData.redeem_requests?.length ? (
                        <p className="text-gray-500 text-center py-8">No redemptions found</p>
                      ) : (
                        userData.redeem_requests.slice(0, 30).map((req, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                            <div>
                              <p className="text-white font-medium">{req.service_type || req.request_type || 'Redemption'}</p>
                              <p className="text-gray-500 text-xs">{formatDate(req.created_at)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-amber-400 font-bold">₹{req.amount_inr || req.amount || 0}</p>
                              <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(req.status)}`}>{req.status}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'referrals' && (
                    <div>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                          <p className="text-2xl font-bold text-blue-400">{userData.referral?.total_referrals || 0}</p>
                          <p className="text-xs text-gray-400">Total</p>
                        </div>
                        <div className="text-center p-3 bg-green-500/10 rounded-lg">
                          <p className="text-2xl font-bold text-green-400">{userData.referral?.active_referrals || 0}</p>
                          <p className="text-xs text-gray-400">Active</p>
                        </div>
                        <div className="text-center p-3 bg-amber-500/10 rounded-lg">
                          <p className="text-2xl font-bold text-amber-400">{formatNumber(userData.referral?.total_earnings || 0)}</p>
                          <p className="text-xs text-gray-400">Earnings PRC</p>
                        </div>
                      </div>
                      {userData.referral?.referrals?.length > 0 && (
                        <div className="space-y-2">
                          {userData.referral.referrals.slice(0, 20).map((ref, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                              <span className="text-gray-300">{ref.name || ref.email}</span>
                              <span className="text-xs text-gray-500">{formatDate(ref.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'subscriptions' && (
                    <div className="space-y-2">
                      {!userData.subscription_history?.length ? (
                        <p className="text-gray-500 text-center py-8">No subscription history</p>
                      ) : (
                        userData.subscription_history.map((sub, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                            <div>
                              <p className="text-white font-medium capitalize">{sub.plan || sub.subscription_plan}</p>
                              <p className="text-gray-500 text-xs">{formatDate(sub.created_at || sub.start_date)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-gray-400 text-sm">Expires: {formatDate(sub.expiry || sub.end_date)}</p>
                              <span className={`px-2 py-0.5 rounded text-xs ${sub.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{sub.status || 'completed'}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'logins' && (
                    <div className="space-y-2">
                      {!userData.login_history?.length ? (
                        <p className="text-gray-500 text-center py-8">No login history</p>
                      ) : (
                        userData.login_history.slice(0, 30).map((login, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${login.success !== false ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                {login.success !== false ? <Eye className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                              </div>
                              <div>
                                <p className="text-white text-sm">{login.success !== false ? 'Login' : 'Failed'}</p>
                                <p className="text-gray-500 text-xs">{formatDate(login.timestamp || login.created_at)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-gray-400 text-xs">{login.ip_address || 'N/A'}</p>
                              <p className="text-gray-500 text-xs truncate max-w-32">{login.device || login.user_agent?.slice(0, 20) || 'Unknown'}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'kyc' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-800 rounded-lg">
                          <p className="text-gray-400 text-xs mb-1">PAN Number</p>
                          <p className="text-white font-mono">{userData.user?.pan_number || userData.kyc?.pan_number || 'Not Provided'}</p>
                        </div>
                        <div className="p-3 bg-gray-800 rounded-lg">
                          <p className="text-gray-400 text-xs mb-1">Aadhaar Number</p>
                          <p className="text-white font-mono">{userData.user?.aadhaar_number ? `XXXX-XXXX-${userData.user.aadhaar_number.slice(-4)}` : 'Not Provided'}</p>
                        </div>
                        <div className="p-3 bg-gray-800 rounded-lg">
                          <p className="text-gray-400 text-xs mb-1">Bank Account</p>
                          <p className="text-white">{userData.user?.bank_name || 'N/A'}</p>
                          <p className="text-gray-400 text-xs">{userData.user?.bank_account_number || ''}</p>
                        </div>
                        <div className="p-3 bg-gray-800 rounded-lg">
                          <p className="text-gray-400 text-xs mb-1">UPI ID</p>
                          <p className="text-white">{userData.user?.upi_id || 'Not Provided'}</p>
                        </div>
                      </div>
                      {userData.kyc && (
                        <div className="p-4 bg-gray-800 rounded-lg">
                          <p className="text-gray-400 text-xs mb-2">KYC Status</p>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded text-sm ${
                              userData.kyc.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                              userData.kyc.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>{userData.kyc.status || userData.user?.kyc_status || 'Not Submitted'}</span>
                            {userData.kyc.verified_at && <span className="text-gray-500 text-xs">Verified: {formatDate(userData.kyc.verified_at)}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
          
          {/* Empty State */}
          {!userData && !loading && !error && (
            <div className="text-center py-20">
              <User className="h-16 w-16 mx-auto text-gray-700 mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">Search for a User</h3>
              <p className="text-gray-500">Enter UID, email, mobile, PAN, or Aadhaar number</p>
            </div>
          )}
        </>
      )}

      {/* ========== MODALS ========== */}
      
      {/* PIN Reset Modal */}
      <Modal show={showPinReset} onClose={() => { setShowPinReset(false); setNewPin(null); }} title="Reset PIN">
        <div className="space-y-4">
          <p className="text-gray-400">Generate a new 6-digit PIN for this user.</p>
          {newPin && (
            <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg text-center">
              <p className="text-sm text-gray-400 mb-2">New PIN:</p>
              <div className="flex justify-center gap-2">
                {newPin.split('').map((digit, i) => (
                  <div key={i} className="w-10 h-12 bg-gray-800 border border-green-500/50 rounded flex items-center justify-center">
                    <span className="text-2xl font-bold text-green-400">{digit}</span>
                  </div>
                ))}
              </div>
              <Button onClick={() => { navigator.clipboard.writeText(newPin); toast.success('Copied!'); }} className="mt-3 bg-green-600">
                <Copy className="h-4 w-4 mr-2" />Copy PIN
              </Button>
            </div>
          )}
          {!newPin && (
            <div className="flex gap-3">
              <Button onClick={() => setShowPinReset(false)} variant="outline" className="flex-1 border-gray-600">Cancel</Button>
              <Button onClick={handlePinReset} disabled={actionLoading} className="flex-1 bg-amber-600 hover:bg-amber-700">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate New PIN'}
              </Button>
            </div>
          )}
        </div>
      </Modal>
      
      {/* Role Change Modal */}
      <Modal show={showRoleChange} onClose={() => setShowRoleChange(false)} title="Change User Role">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {['user', 'manager', 'sub_admin', 'admin'].map(role => (
              <button key={role} onClick={() => setSelectedRole(role)}
                className={`p-3 rounded-lg border text-center capitalize ${
                  selectedRole === role ? 'border-purple-500 bg-purple-500/20 text-purple-400' : 'border-gray-700 bg-gray-800 text-gray-400'
                }`}>{role.replace('_', ' ')}</button>
            ))}
          </div>
          {selectedRole === 'admin' && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />Admin role gives full system access!
            </div>
          )}
          {selectedRole === 'manager' && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm">
              <p className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4" />Manager has restricted admin access</p>
              <p className="text-xs text-gray-400">Role change केल्यानंतर, User 360 मधून "Manage Permissions" button वापरून permissions set करा</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={() => setShowRoleChange(false)} variant="outline" className="flex-1 border-gray-600">Cancel</Button>
            <Button onClick={handleRoleChange} disabled={actionLoading} className="flex-1 bg-purple-600 hover:bg-purple-700">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Role'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Balance Adjust Modal */}
      <Modal show={showBalanceAdjust} onClose={() => setShowBalanceAdjust(false)} title="Adjust PRC Balance">
        <div className="space-y-4">
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-400">Current Balance</p>
            <p className="text-2xl font-bold text-amber-400">{formatNumber((userData?.user?.prc_balance || 0).toFixed(2))} PRC</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setBalanceOperation('add')} className={`p-3 rounded-lg flex items-center justify-center gap-2 ${balanceOperation === 'add' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              <Plus className="h-4 w-4" />Add
            </button>
            <button onClick={() => setBalanceOperation('deduct')} className={`p-3 rounded-lg flex items-center justify-center gap-2 ${balanceOperation === 'deduct' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              <Minus className="h-4 w-4" />Deduct
            </button>
          </div>
          <div>
            <Label className="text-gray-400">Amount</Label>
            <Input type="number" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} placeholder="Enter amount" className="bg-gray-800 border-gray-700 mt-1" />
          </div>
          <div>
            <Label className="text-gray-400">Reason (optional)</Label>
            <Input value={balanceReason} onChange={(e) => setBalanceReason(e.target.value)} placeholder="Reason for adjustment" className="bg-gray-800 border-gray-700 mt-1" />
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowBalanceAdjust(false)} variant="outline" className="flex-1 border-gray-600">Cancel</Button>
            <Button onClick={handleBalanceAdjust} disabled={actionLoading} className={`flex-1 ${balanceOperation === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `${balanceOperation === 'add' ? 'Add' : 'Deduct'} PRC`}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Referral Change Modal */}
      <Modal show={showReferralChange} onClose={() => setShowReferralChange(false)} title="Change Referral">
        <div className="space-y-4">
          {userData?.user?.referred_by && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-gray-400">Current Referrer</p>
              <p className="text-lg font-medium text-blue-400">{userData.user.referred_by}</p>
            </div>
          )}
          <div>
            <Label className="text-gray-400">New Referrer UID</Label>
            <Input value={newReferrer} onChange={(e) => setNewReferrer(e.target.value)} placeholder="Enter UID or 'remove'" className="bg-gray-800 border-gray-700 mt-1" />
            <p className="text-xs text-gray-500 mt-1">Type "remove" to clear referral</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowReferralChange(false)} variant="outline" className="flex-1 border-gray-600">Cancel</Button>
            <Button onClick={handleReferralChange} disabled={actionLoading} className="flex-1 bg-cyan-600 hover:bg-cyan-700">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Referral'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete User">
        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-3 text-red-400 mb-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="font-semibold">Warning: This cannot be undone!</span>
            </div>
            <p className="text-gray-400 text-sm">This will permanently delete the user and all their data.</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowDeleteConfirm(false)} variant="outline" className="flex-1 border-gray-600">Cancel</Button>
            <Button onClick={handleDeleteUser} disabled={actionLoading} className="flex-1 bg-red-600 hover:bg-red-700">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Edit Profile Modal */}
      <Modal show={showEditProfile} onClose={() => setShowEditProfile(false)} title="Edit User Profile" size="3xl">
        <div className="space-y-6">
          {/* Personal Info */}
          <div>
            <h4 className="text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2"><User className="h-4 w-4" />Personal Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-gray-400 text-xs">Full Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
              <div><Label className="text-gray-400 text-xs">Date of Birth</Label><Input type="date" value={editForm.date_of_birth} onChange={(e) => setEditForm({...editForm, date_of_birth: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
              <div><Label className="text-gray-400 text-xs">Gender</Label>
                <select value={editForm.gender} onChange={(e) => setEditForm({...editForm, gender: e.target.value})} className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white mt-1">
                  <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2"><Phone className="h-4 w-4" />Contact Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-gray-400 text-xs">Email</Label><Input value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
              <div><Label className="text-gray-400 text-xs">Mobile</Label><Input value={editForm.mobile} onChange={(e) => setEditForm({...editForm, mobile: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
              <div><Label className="text-gray-400 text-xs">Alternate Mobile</Label><Input value={editForm.alternate_mobile} onChange={(e) => setEditForm({...editForm, alternate_mobile: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
            </div>
          </div>
          
          {/* Address */}
          <div>
            <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2"><MapPin className="h-4 w-4" />Address</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label className="text-gray-400 text-xs">Street Address</Label><Input value={editForm.address} onChange={(e) => setEditForm({...editForm, address: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
              <div><Label className="text-gray-400 text-xs">City</Label><Input value={editForm.city} onChange={(e) => setEditForm({...editForm, city: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
              <div><Label className="text-gray-400 text-xs">State</Label><Input value={editForm.state} onChange={(e) => setEditForm({...editForm, state: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
              <div><Label className="text-gray-400 text-xs">Pincode</Label><Input value={editForm.pincode} onChange={(e) => setEditForm({...editForm, pincode: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
            </div>
          </div>
          
          {/* KYC */}
          <div>
            <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2"><Shield className="h-4 w-4" />KYC Documents</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-gray-400 text-xs">PAN Number</Label><Input value={editForm.pan_number} onChange={(e) => setEditForm({...editForm, pan_number: e.target.value.toUpperCase()})} placeholder="ABCDE1234F" maxLength={10} className="bg-gray-800 border-gray-700 mt-1 uppercase" /></div>
              <div><Label className="text-gray-400 text-xs">Aadhaar Number</Label><Input value={editForm.aadhaar_number} onChange={(e) => setEditForm({...editForm, aadhaar_number: e.target.value.replace(/\D/g, '')})} placeholder="123456789012" maxLength={12} className="bg-gray-800 border-gray-700 mt-1" /></div>
            </div>
          </div>
          
          {/* Bank */}
          <div>
            <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4" />Bank Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-gray-400 text-xs">Bank Name</Label><Input value={editForm.bank_name} onChange={(e) => setEditForm({...editForm, bank_name: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
              <div><Label className="text-gray-400 text-xs">Account Number</Label><Input value={editForm.bank_account_number} onChange={(e) => setEditForm({...editForm, bank_account_number: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
              <div><Label className="text-gray-400 text-xs">IFSC Code</Label><Input value={editForm.bank_ifsc} onChange={(e) => setEditForm({...editForm, bank_ifsc: e.target.value.toUpperCase()})} className="bg-gray-800 border-gray-700 mt-1 uppercase" /></div>
              <div><Label className="text-gray-400 text-xs">UPI ID</Label><Input value={editForm.upi_id} onChange={(e) => setEditForm({...editForm, upi_id: e.target.value})} placeholder="name@upi" className="bg-gray-800 border-gray-700 mt-1" /></div>
            </div>
          </div>
          
          {/* Nominee */}
          <div>
            <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2"><Users className="h-4 w-4" />Nominee Details</h4>
            <div className="grid grid-cols-3 gap-4">
              <div><Label className="text-gray-400 text-xs">Nominee Name</Label><Input value={editForm.nominee_name} onChange={(e) => setEditForm({...editForm, nominee_name: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
              <div><Label className="text-gray-400 text-xs">Relation</Label>
                <select value={editForm.nominee_relation} onChange={(e) => setEditForm({...editForm, nominee_relation: e.target.value})} className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white mt-1">
                  <option value="">Select</option><option value="spouse">Spouse</option><option value="father">Father</option><option value="mother">Mother</option><option value="son">Son</option><option value="daughter">Daughter</option><option value="brother">Brother</option><option value="sister">Sister</option><option value="other">Other</option>
                </select>
              </div>
              <div><Label className="text-gray-400 text-xs">Nominee Mobile</Label><Input value={editForm.nominee_mobile} onChange={(e) => setEditForm({...editForm, nominee_mobile: e.target.value})} className="bg-gray-800 border-gray-700 mt-1" /></div>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <Button onClick={() => setShowEditProfile(false)} variant="outline" className="flex-1 border-gray-600">Cancel</Button>
            <Button onClick={handleSaveProfile} disabled={actionLoading} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Subscription Modal */}
      <Modal show={showSubscription} onClose={() => setShowSubscription(false)} title="Subscription Management" size="lg">
        <div className="space-y-4">
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-gray-400 text-sm">Current Plan: <span className="text-amber-400 font-semibold capitalize">{userData?.user?.subscription_plan || 'Explorer'}</span></p>
            <p className="text-gray-400 text-sm">Expiry: <span className="text-white">{formatDate(userData?.user?.subscription_expiry)}</span></p>
          </div>
          
          <div>
            <Label className="text-gray-400">Select Plan</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {['explorer', 'elite'].map(plan => (
                <button key={plan} onClick={() => setSubscriptionForm({...subscriptionForm, plan})}
                  className={`p-4 rounded-lg capitalize font-semibold ${
                    subscriptionForm.plan === plan 
                      ? plan === 'elite' ? 'bg-amber-600 text-white' : 'bg-purple-600 text-white' 
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}>
                  {plan === 'elite' && <Crown className="h-4 w-4 inline mr-2" />}
                  {plan}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <Label className="text-gray-400">Duration (Days)</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[28, 90, 180, 365].map(days => (
                <button key={days} onClick={() => setSubscriptionForm({...subscriptionForm, duration: days})}
                  className={`p-2 rounded-lg ${subscriptionForm.duration === days ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {days === 365 ? '1 Year' : `${days} Days`}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div>
              <p className="text-white font-medium">Free Subscription</p>
              <p className="text-gray-400 text-sm">Grant without payment</p>
            </div>
            <button onClick={() => setSubscriptionForm({...subscriptionForm, isFree: !subscriptionForm.isFree})}
              className={`w-12 h-6 rounded-full ${subscriptionForm.isFree ? 'bg-green-500' : 'bg-gray-700'}`}>
              <div className={`w-5 h-5 bg-white rounded-full transform transition-transform ${subscriptionForm.isFree ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          
          <div>
            <Label className="text-gray-400">Notes</Label>
            <textarea value={subscriptionForm.notes} onChange={(e) => setSubscriptionForm({...subscriptionForm, notes: e.target.value})}
              placeholder="Admin notes..." className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white resize-none h-20 mt-1" />
          </div>
          
          <div className="flex gap-3">
            <Button onClick={() => setShowSubscription(false)} variant="outline" className="flex-1 border-gray-600">Cancel</Button>
            <Button onClick={handleSubscriptionUpdate} disabled={actionLoading} className="flex-1 bg-purple-600 hover:bg-purple-700">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Subscription'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Diagnose Modal */}
      <Modal show={showDiagnose} onClose={() => { setShowDiagnose(false); setDiagnoseData(null); }} title="Auto Diagnosis Report" size="2xl">
        {diagnoseLoading ? (
          <div className="flex flex-col items-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-purple-500 mb-4" />
            <p className="text-gray-400">Running diagnostics...</p>
          </div>
        ) : diagnoseData ? (
          <div className="space-y-4">
            {/* Health Score */}
            <div className={`p-4 rounded-lg ${
              diagnoseData.health_score >= 80 ? 'bg-green-500/20 border border-green-500/50' :
              diagnoseData.health_score >= 50 ? 'bg-yellow-500/20 border border-yellow-500/50' :
              'bg-red-500/20 border border-red-500/50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Health Score</p>
                  <p className={`text-3xl font-bold ${diagnoseData.health_score >= 80 ? 'text-green-400' : diagnoseData.health_score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {diagnoseData.health_score}/100
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Issues Found</p>
                  <p className="text-2xl font-bold text-white">{diagnoseData.total_issues}</p>
                </div>
              </div>
            </div>
            
            {/* Issues */}
            {diagnoseData.issues?.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <p className="text-green-400 font-medium text-lg">All Good!</p>
                <p className="text-gray-400">No issues found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {diagnoseData.issues.map((issue, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${
                    issue.severity === 'critical' ? 'bg-red-500/10 border-red-500/50' :
                    issue.severity === 'high' ? 'bg-orange-500/10 border-orange-500/50' :
                    issue.severity === 'medium' ? 'bg-yellow-500/10 border-yellow-500/50' :
                    'bg-blue-500/10 border-blue-500/50'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          issue.severity === 'critical' ? 'bg-red-500/30 text-red-300' :
                          issue.severity === 'high' ? 'bg-orange-500/30 text-orange-300' : 'bg-yellow-500/30 text-yellow-300'
                        }`}>{issue.severity?.toUpperCase()}</span>
                        <p className="text-white font-medium mt-1">{issue.issue}</p>
                        <p className="text-gray-400 text-sm">{issue.description}</p>
                      </div>
                      {issue.can_auto_fix && (
                        <Button onClick={() => fixSingleIssue(issue.fix_action, issue.suggested_balance)} size="sm" className="bg-purple-600">Fix</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-3 justify-center">
              {diagnoseData.issues?.length > 0 && (
                <Button onClick={autoFixAll} className="bg-green-600 hover:bg-green-700">
                  <Zap className="h-4 w-4 mr-2" />Auto Fix All
                </Button>
              )}
              <Button onClick={runDiagnosis} variant="outline" className="border-purple-500/50 text-purple-400">
                <RefreshCw className="h-4 w-4 mr-2" />Re-run
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
      
      {/* KYC Action Modal */}
      <Modal show={showKYCAction} onClose={() => { setShowKYCAction(false); setKycAction(''); setKycReason(''); }} title={kycAction === 'approve' ? 'Approve KYC' : 'Reject KYC'}>
        <div className="space-y-4">
          <p className="text-gray-400">{kycAction === 'approve' ? 'Approve KYC verification for this user?' : 'Reject KYC verification. Please provide a reason.'}</p>
          {kycAction === 'reject' && (
            <div>
              <Label className="text-gray-400">Rejection Reason</Label>
              <textarea value={kycReason} onChange={(e) => setKycReason(e.target.value)}
                placeholder="Enter reason for rejection..." className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white resize-none h-20 mt-1" />
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={() => setShowKYCAction(false)} variant="outline" className="flex-1 border-gray-600">Cancel</Button>
            <Button onClick={handleKYCAction} disabled={actionLoading || (kycAction === 'reject' && !kycReason.trim())}
              className={`flex-1 ${kycAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : kycAction === 'approve' ? 'Approve KYC' : 'Reject KYC'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Manager Permissions Modal */}
      <Modal show={showPermissions} onClose={() => setShowPermissions(false)} title="Manager Permissions" size="2xl">
        {userData?.user?.uid && (
          <ManagerPermissions 
            userId={userData.user.uid}
            userName={userData.user.name || userData.user.email}
            onClose={() => setShowPermissions(false)}
            onSave={() => {
              setShowPermissions(false);
              toast.success('Permissions updated');
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default AdminUser360New;
