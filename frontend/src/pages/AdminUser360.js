import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import ManagerPermissions from '../components/ManagerPermissions';
import {
  Search, User, Mail, Phone, MapPin, Calendar, Shield, Crown,
  Coins, TrendingUp, TrendingDown, Users, Gift, ShoppingBag,
  CreditCard, FileText, Clock, CheckCircle, XCircle, AlertTriangle,
  Activity, Eye, Download, Bell, MessageSquare, RefreshCw, Loader2,
  ChevronRight, ArrowLeft, Copy, ExternalLink, Ban, Play, Pause,
  Wallet, Receipt, BadgeCheck, AlertCircle, Info, Star, Zap,
  BarChart3, PieChart, Network, History, Settings, Send, Key,
  Plus, Minus, Edit, Lock, Trash2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminUser360 = ({ user: adminUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('orders');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Request action states
  const [actionRequestId, setActionRequestId] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' or 'reject'
  const [actionUTR, setActionUTR] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
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
  
  // Advanced Search - Auto Suggestions
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Debounced search for suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        fetchSearchSuggestions(searchQuery.trim());
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch search suggestions
  const fetchSearchSuggestions = async (query) => {
    setSuggestionsLoading(true);
    try {
      const response = await axios.get(`${API}/admin/users/search-suggestions?q=${encodeURIComponent(query)}&limit=10`);
      setSearchSuggestions(response.data.suggestions || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSearchSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Select suggestion
  const selectSuggestion = (suggestion) => {
    setSearchQuery(suggestion.uid);
    setShowSuggestions(false);
    handleSearchByUid(suggestion.uid);
  };

  // Fetch user list for browse mode
  const fetchUserList = async () => {
    setUserListLoading(true);
    try {
      let url = `${API}/admin/users/all?page=${userListPage}&limit=20`;
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
      const response = await axios.get(`${API}/admin/user-360?query=${encodeURIComponent(uid)}`);
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
      const response = await axios.get(`${API}/admin/user-360?query=${encodeURIComponent(searchQuery.trim())}`);
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
  
  // Role Change Modal State
  const [roleModal, setRoleModal] = useState({ show: false });
  const [selectedRole, setSelectedRole] = useState('user');
  
  // Permissions Modal State
  const [permissionsModal, setPermissionsModal] = useState({ show: false });
  
  // Adjust Balance Modal State
  const [balanceModal, setBalanceModal] = useState({ show: false });
  const [balanceForm, setBalanceForm] = useState({
    balanceType: 'prc_balance',
    operation: 'add',
    amount: '',
    notes: ''
  });
  
  // Diagnose Modal State
  const [diagnoseModal, setDiagnoseModal] = useState({ show: false, loading: false, data: null });
  
  // Subscription Management Modal State
  const [subscriptionModal, setSubscriptionModal] = useState({ show: false });
  const [subscriptionTab, setSubscriptionTab] = useState('update'); // 'update' or 'history'
  const [subscriptionForm, setSubscriptionForm] = useState({
    plan: 'explorer',
    duration: 30,
    customDuration: 30,
    expiryMode: 'auto', // 'auto' or 'manual'
    manualExpiry: '',
    isFree: true,
    adminNotes: ''
  });

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
      const response = await axios.post(`${API}/admin/user-360/action`, {
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
          'save_notes': 'Notes Saved',
          'approve_kyc': '✅ KYC Approved',
          'reject_kyc': '❌ KYC Rejected'
        };
        
        const title = actionTitles[action] || 'Action Completed';
        setSuccessModal({ 
          show: true, 
          title: title, 
          message: message || `${action} completed successfully`,
          type: action === 'block_user' || action === 'reject_kyc' ? 'warning' : 'success'
        });
        
        // Refresh user data after block/unblock
        if (action === 'block_user' || action === 'unblock_user') {
          fetchUserData(userData.user.uid);
        }
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
      const response = await axios.get(`${API}/admin/user-360?query=${encodeURIComponent(userData.user.uid)}`);
      setUserData(response.data);
      setAdminNotes(response.data.user?.admin_notes || '');
    } catch (error) {
      console.error('Silent refresh error:', error);
      // Don't clear userData on refresh error - keep existing data
    }
  };

  // Handle Bill Payment Approve/Reject
  const handleBillAction = async (requestId, action) => {
    if (action === 'approve' && !actionUTR.trim()) {
      toast.error('Please enter UTR/Reference number');
      return;
    }
    if (action === 'reject' && !actionReason.trim()) {
      toast.error('Please enter rejection reason');
      return;
    }
    
    setActionLoading(true);
    try {
      await axios.put(`${API}/admin/bill-payment/action/${requestId}`, {
        action: action,
        admin_id: adminUser?.uid,
        transaction_ref: action === 'approve' ? actionUTR : undefined,
        reason: action === 'reject' ? actionReason : undefined
      });
      
      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setActionRequestId(null);
      setActionType(null);
      setActionUTR('');
      setActionReason('');
      refreshUserData();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${action} request`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Bank Redeem Approve/Reject
  const handleRedeemAction = async (requestId, requestType, action) => {
    if (action === 'approve' && !actionUTR.trim()) {
      toast.error('Please enter UTR/Reference number');
      return;
    }
    if (action === 'reject' && !actionReason.trim()) {
      toast.error('Please enter rejection reason');
      return;
    }
    
    setActionLoading(true);
    try {
      // Determine correct API based on request type
      let apiUrl = '';
      if (requestType === 'rd' || requestType === 'savings') {
        apiUrl = `${API}/rd/admin/process-redeem/${requestId}`;
      } else {
        apiUrl = `${API}/admin/bank-redeem/${action}/${requestId}`;
      }
      
      await axios.post(apiUrl, {
        admin_id: adminUser?.uid,
        transaction_ref: action === 'approve' ? actionUTR : undefined,
        reason: action === 'reject' ? actionReason : undefined
      });
      
      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setActionRequestId(null);
      setActionType(null);
      setActionUTR('');
      setActionReason('');
      refreshUserData();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${action} request`);
    } finally {
      setActionLoading(false);
    }
  };

  // Auto Diagnose Function
  const runDiagnosis = async () => {
    if (!userData?.user?.uid) return;
    setDiagnoseModal({ show: true, loading: true, data: null });
    try {
      const response = await axios.get(`${API}/admin/user/${userData.user.uid}/diagnose`);
      setDiagnoseModal({ show: true, loading: false, data: response.data });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Diagnosis failed');
      setDiagnoseModal({ show: false, loading: false, data: null });
    }
  };

  // Auto Fix ALL Issues
  const autoFixAll = async () => {
    if (!userData?.user?.uid) return;
    try {
      toast.loading('Auto-fixing all issues...', { id: 'auto-fix' });
      const response = await axios.post(`${API}/admin/user/${userData.user.uid}/auto-fix-all`, {
        admin_pin: '123456'
      });
      toast.dismiss('auto-fix');
      
      if (response.data.total_fixed > 0) {
        toast.success(`✅ Fixed ${response.data.total_fixed} issues!`);
      } else {
        toast.info('No issues to fix');
      }
      
      // Re-run diagnosis to see updated status
      runDiagnosis();
      // Refresh user data
      refreshUserData();
    } catch (error) {
      toast.dismiss('auto-fix');
      toast.error(error.response?.data?.detail || 'Auto-fix failed');
    }
  };

  // Fix Issue Function
  const fixIssue = async (fixAction, suggestedBalance = 0) => {
    if (!userData?.user?.uid) return;
    try {
      const response = await axios.post(`${API}/admin/user/${userData.user.uid}/fix-issue`, {
        fix_action: fixAction,
        suggested_balance: suggestedBalance
      });
      toast.success(response.data.message);
      // Re-run diagnosis
      runDiagnosis();
      // Refresh user data
      refreshUserData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fix failed');
    }
  };

  // Open Role Change Modal
  const openRoleModal = () => {
    if (!userData?.user) return;
    setSelectedRole(userData.user.role || 'user');
    setRoleModal({ show: true });
  };

  // Handle Role Change
  const handleRoleChange = async () => {
    if (!userData?.user?.uid) return;
    
    setProcessing(true);
    try {
      const response = await axios.put(`${API}/admin/users/${userData.user.uid}/role`, {
        role: selectedRole
      });
      
      setRoleModal({ show: false });
      setSuccessModal({ 
        show: true, 
        title: 'Role Updated', 
        message: `User role changed to ${selectedRole.toUpperCase()}`,
        type: 'success'
      });
      refreshUserData();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to update role';
      setSuccessModal({ show: true, title: 'Error', message: errorMsg, type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  // Open Balance Modal
  const openBalanceModal = () => {
    setBalanceForm({
      balanceType: 'prc_balance',
      operation: 'add',
      amount: '',
      notes: ''
    });
    setBalanceModal({ show: true });
  };

  // Handle Balance Adjustment
  const handleBalanceAdjust = async () => {
    if (!balanceForm.amount || isNaN(parseFloat(balanceForm.amount))) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    let finalAmount = parseFloat(balanceForm.amount);
    if (balanceForm.operation === 'deduct') {
      finalAmount = -finalAmount;
    } else if (balanceForm.operation === 'set') {
      // For 'set' operation, calculate the difference
      const currentBalance = userData?.user?.prc_balance || 0;
      finalAmount = finalAmount - currentBalance;
    }
    
    setProcessing(true);
    try {
      await handleQuickAction('adjust_balance', { 
        amount: finalAmount, 
        notes: balanceForm.notes,
        balance_type: balanceForm.balanceType
      });
      setBalanceModal({ show: false });
    } finally {
      setProcessing(false);
    }
  };

  // Open Subscription Modal
  const openSubscriptionModal = () => {
    const currentPlan = userData?.user?.subscription_plan || 'explorer';
    const today = new Date();
    const defaultExpiry = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    setSubscriptionForm({
      plan: currentPlan,
      duration: 30,
      customDuration: 30,
      expiryMode: 'auto',
      manualExpiry: defaultExpiry.toISOString().split('T')[0],
      isFree: true,
      adminNotes: ''
    });
    setSubscriptionTab('update');
    setSubscriptionModal({ show: true });
  };

  // Calculate auto expiry date
  const getAutoExpiryDate = () => {
    const days = subscriptionForm.duration === 'custom' ? subscriptionForm.customDuration : subscriptionForm.duration;
    const today = new Date();
    const expiry = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    return expiry.toISOString().split('T')[0];
  };

  // Handle Subscription Update
  const handleSubscriptionUpdate = async () => {
    setProcessing(true);
    try {
      const expiryDate = subscriptionForm.expiryMode === 'auto' 
        ? getAutoExpiryDate() 
        : subscriptionForm.manualExpiry;
      
      const response = await axios.post(`${API}/admin/user-360/action`, {
        user_id: userData.user.uid,
        action: 'update_subscription',
        admin_id: adminUser?.uid,
        plan: subscriptionForm.plan,
        expiry_date: expiryDate,
        is_free: subscriptionForm.isFree,
        admin_notes: subscriptionForm.adminNotes
      });
      
      toast.success(response.data?.message || 'Subscription updated successfully');
      setSubscriptionModal({ show: false });
      refreshUserData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update subscription');
    } finally {
      setProcessing(false);
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 z-10" />
                <Input
                  placeholder="Search by Name, Email, Mobile, UID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  onFocus={() => searchSuggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="pl-12 bg-gray-800 border-gray-700 text-white text-lg h-12"
                />
                
                {/* Search Suggestions Dropdown */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
                    <div className="p-2 border-b border-gray-700 text-xs text-gray-400 flex items-center gap-2">
                      <Users className="w-3 h-3" />
                      {searchSuggestions.length} matching users found
                    </div>
                    {searchSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.uid || index}
                        className="p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700/50 last:border-0 transition-colors"
                        onClick={() => selectSuggestion(suggestion)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                              {suggestion.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="text-white font-medium">{suggestion.name}</p>
                              <p className="text-gray-400 text-xs">{suggestion.email} • {suggestion.phone}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              suggestion.subscription_plan === 'elite' ? 'bg-amber-500/20 text-amber-400' :
                              suggestion.subscription_plan === 'growth' ? 'bg-purple-500/20 text-purple-400' :
                              suggestion.subscription_plan === 'startup' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-gray-600/20 text-gray-400'
                            }`}>
                              {suggestion.subscription_plan || 'free'}
                            </span>
                            <p className="text-gray-500 text-xs mt-1">{suggestion.uid}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Loading indicator */}
                {suggestionsLoading && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl p-4 z-50">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </div>
                  </div>
                )}
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
              <span className="px-2 py-1 bg-gray-800 rounded">👤 Name</span>
              <span className="px-2 py-1 bg-gray-800 rounded">📧 Email</span>
              <span className="px-2 py-1 bg-gray-800 rounded">📱 Mobile</span>
              <span className="px-2 py-1 bg-gray-800 rounded">🆔 User ID</span>
              <span className="px-2 py-1 bg-gray-800 rounded">🔗 Referral Code</span>
            </div>
            <p className="text-xs text-amber-400 mt-2">💡 Tip: Start typing name - matching users will appear automatically</p>
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
                <div className="space-y-3">
                  {userData.transactions.bill_payments?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No bill payments found</p>
                  ) : (
                    userData.transactions.bill_payments?.map((bill, idx) => (
                      <div key={idx} className="bg-gray-800 rounded-lg overflow-hidden">
                        {/* Header Row */}
                        <div className="p-4 border-b border-gray-700">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                bill.payment_type?.toLowerCase().includes('emi') ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'
                              }`}>
                                {bill.payment_type?.toUpperCase() || bill.request_type?.replace('_', ' ').toUpperCase()}
                              </span>
                              <div>
                                <p className="text-white font-semibold capitalize">{bill.request_type?.replace('_', ' ')}</p>
                                <p className="text-gray-400 text-xs">ID: {bill.request_id?.slice(-10) || bill._id?.slice(-10)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-green-400 font-bold text-lg">₹{(bill.amount_inr || 0).toLocaleString()}</p>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                bill.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                bill.status === 'approved' || bill.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>{bill.status}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Details Grid */}
                        <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                          {/* Bank Details if EMI/Loan */}
                          {(bill.loan_account_number || bill.bank_details?.account_number) && (
                            <>
                              <div>
                                <p className="text-gray-500 text-xs">Loan A/C Number</p>
                                <p className="text-white font-mono">{bill.loan_account_number || bill.bank_details?.account_number}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Bank / IFSC</p>
                                <p className="text-cyan-400">{bill.bank_name || bill.bank_details?.bank_name || '-'}</p>
                              </div>
                            </>
                          )}
                          
                          {/* Mobile Recharge Details */}
                          {bill.details?.phone_number && (
                            <>
                              <div>
                                <p className="text-gray-500 text-xs">Mobile Number</p>
                                <p className="text-white">{bill.details.phone_number}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Operator</p>
                                <p className="text-white">{bill.details.operator} - {bill.details.circle}</p>
                              </div>
                            </>
                          )}
                          
                          {/* PRC Details */}
                          <div>
                            <p className="text-gray-500 text-xs">PRC Deducted</p>
                            <p className="text-purple-400 font-semibold">{(bill.total_prc_deducted || bill.prc_amount || 0).toLocaleString()} PRC</p>
                          </div>
                          
                          {/* Timestamps */}
                          <div>
                            <p className="text-gray-500 text-xs">📅 Request Date</p>
                            <p className="text-gray-300">{formatDate(bill.created_at)}</p>
                          </div>
                          
                          {/* Approved/Rejected Info */}
                          {bill.status === 'approved' || bill.status === 'completed' ? (
                            <div className="col-span-2 mt-2 p-2 bg-green-500/10 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-green-400 text-xs font-semibold">✓ Approved</p>
                                  <p className="text-green-300 text-xs">{formatDate(bill.approved_at || bill.processed_at)}</p>
                                </div>
                                {(bill.approved_by_name || bill.processed_by_name || bill.approved_by) && (
                                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                                    by {bill.approved_by_name || bill.processed_by_name || bill.approved_by}
                                  </span>
                                )}
                              </div>
                              {bill.transaction_ref && (
                                <p className="text-gray-400 text-xs mt-1">UTR: {bill.transaction_ref}</p>
                              )}
                            </div>
                          ) : bill.status === 'rejected' ? (
                            <div className="col-span-2 mt-2 p-2 bg-red-500/10 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-red-400 text-xs font-semibold">✗ Rejected</p>
                                  <p className="text-red-300 text-xs">{formatDate(bill.rejected_at || bill.processed_at)}</p>
                                </div>
                                {(bill.rejected_by_name || bill.processed_by_name || bill.rejected_by) && (
                                  <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                                    by {bill.rejected_by_name || bill.processed_by_name || bill.rejected_by}
                                  </span>
                                )}
                              </div>
                              {bill.rejection_reason && (
                                <p className="text-gray-400 text-xs mt-1">Reason: {bill.rejection_reason}</p>
                              )}
                            </div>
                          ) : bill.status === 'pending' ? (
                            /* Action Buttons for Pending */
                            <div className="col-span-2 mt-3 pt-3 border-t border-gray-700">
                              {actionRequestId === bill.request_id ? (
                                <div className="space-y-2">
                                  {actionType === 'approve' ? (
                                    <>
                                      <Input
                                        value={actionUTR}
                                        onChange={(e) => setActionUTR(e.target.value)}
                                        placeholder="Enter UTR/Reference Number"
                                        className="h-9 text-sm bg-gray-900 border-gray-600"
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => handleBillAction(bill.request_id, 'approve')}
                                          disabled={actionLoading}
                                          className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-sm"
                                        >
                                          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                          Confirm Approve
                                        </Button>
                                        <Button
                                          onClick={() => { setActionRequestId(null); setActionType(null); }}
                                          variant="outline"
                                          className="h-9 text-sm"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <Input
                                        value={actionReason}
                                        onChange={(e) => setActionReason(e.target.value)}
                                        placeholder="Enter rejection reason"
                                        className="h-9 text-sm bg-gray-900 border-gray-600"
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => handleBillAction(bill.request_id, 'reject')}
                                          disabled={actionLoading}
                                          variant="destructive"
                                          className="flex-1 h-9 text-sm"
                                        >
                                          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                                          Confirm Reject
                                        </Button>
                                        <Button
                                          onClick={() => { setActionRequestId(null); setActionType(null); }}
                                          variant="outline"
                                          className="h-9 text-sm"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => { setActionRequestId(bill.request_id); setActionType('approve'); }}
                                    className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-sm gap-1"
                                  >
                                    <CheckCircle className="w-4 h-4" /> Approve
                                  </Button>
                                  <Button
                                    onClick={() => { setActionRequestId(bill.request_id); setActionType('reject'); }}
                                    variant="destructive"
                                    className="flex-1 h-9 text-sm gap-1"
                                  >
                                    <XCircle className="w-4 h-4" /> Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'redemptions' && (
                <div className="space-y-3">
                  {userData.transactions.redemptions?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No redemption requests found</p>
                  ) : (
                    userData.transactions.redemptions?.map((redeem, idx) => (
                      <div key={idx} className="bg-gray-800 rounded-lg overflow-hidden">
                        {/* Header Row */}
                        <div className="p-4 border-b border-gray-700">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-600 text-white">
                                BANK
                              </span>
                              <div>
                                <p className="text-white font-semibold">{redeem.bank_details?.account_holder_name || redeem.user_name || 'Bank Transfer'}</p>
                                <p className="text-gray-400 text-xs">ID: {redeem.request_id?.slice(-10) || redeem._id?.slice(-10)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-green-400 font-bold text-lg">₹{(redeem.amount_inr || redeem.inr_amount || (redeem.amount / 10)).toLocaleString()}</p>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                redeem.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                redeem.status === 'approved' || redeem.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>{redeem.status}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Details Grid */}
                        <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs">Account Number</p>
                            <p className="text-white font-mono">{redeem.bank_details?.account_number || redeem.account_number || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">IFSC Code</p>
                            <p className="text-cyan-400 font-mono">{redeem.bank_details?.ifsc_code || redeem.ifsc_code || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Bank Name</p>
                            <p className="text-white">{redeem.bank_details?.bank_name || redeem.bank_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">PRC Deducted</p>
                            <p className="text-purple-400 font-semibold">{(redeem.total_prc_deducted || redeem.prc_amount || redeem.amount || 0).toLocaleString()} PRC</p>
                          </div>
                          
                          {/* Timestamps */}
                          <div>
                            <p className="text-gray-500 text-xs">📅 Request Date</p>
                            <p className="text-gray-300">{formatDate(redeem.created_at)}</p>
                          </div>
                          
                          {/* Approved/Rejected Info */}
                          {redeem.status === 'approved' || redeem.status === 'completed' ? (
                            <div className="col-span-2 mt-2 p-2 bg-green-500/10 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-green-400 text-xs font-semibold">✓ Approved</p>
                                  <p className="text-green-300 text-xs">{formatDate(redeem.approved_at || redeem.processed_at)}</p>
                                </div>
                                {(redeem.approved_by_name || redeem.processed_by_name || redeem.approved_by) && (
                                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                                    by {redeem.approved_by_name || redeem.processed_by_name || redeem.approved_by}
                                  </span>
                                )}
                              </div>
                              {redeem.transaction_ref && (
                                <p className="text-gray-400 text-xs mt-1">UTR: {redeem.transaction_ref}</p>
                              )}
                            </div>
                          ) : redeem.status === 'rejected' ? (
                            <div className="col-span-2 mt-2 p-2 bg-red-500/10 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-red-400 text-xs font-semibold">✗ Rejected</p>
                                  <p className="text-red-300 text-xs">{formatDate(redeem.rejected_at || redeem.processed_at)}</p>
                                </div>
                                {(redeem.rejected_by_name || redeem.processed_by_name || redeem.rejected_by) && (
                                  <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                                    by {redeem.rejected_by_name || redeem.processed_by_name || redeem.rejected_by}
                                  </span>
                                )}
                              </div>
                              {redeem.rejection_reason && (
                                <p className="text-gray-400 text-xs mt-1">Reason: {redeem.rejection_reason}</p>
                              )}
                            </div>
                          ) : redeem.status === 'pending' ? (
                            /* Action Buttons for Pending Redemptions */
                            <div className="col-span-2 mt-3 pt-3 border-t border-gray-700">
                              {actionRequestId === redeem.request_id ? (
                                <div className="space-y-2">
                                  {actionType === 'approve' ? (
                                    <>
                                      <Input
                                        value={actionUTR}
                                        onChange={(e) => setActionUTR(e.target.value)}
                                        placeholder="Enter UTR/Reference Number"
                                        className="h-9 text-sm bg-gray-900 border-gray-600"
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => handleRedeemAction(redeem.request_id, redeem._type, 'approve')}
                                          disabled={actionLoading}
                                          className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-sm"
                                        >
                                          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                          Confirm Approve
                                        </Button>
                                        <Button
                                          onClick={() => { setActionRequestId(null); setActionType(null); }}
                                          variant="outline"
                                          className="h-9 text-sm"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <Input
                                        value={actionReason}
                                        onChange={(e) => setActionReason(e.target.value)}
                                        placeholder="Enter rejection reason"
                                        className="h-9 text-sm bg-gray-900 border-gray-600"
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => handleRedeemAction(redeem.request_id, redeem._type, 'reject')}
                                          disabled={actionLoading}
                                          variant="destructive"
                                          className="flex-1 h-9 text-sm"
                                        >
                                          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                                          Confirm Reject
                                        </Button>
                                        <Button
                                          onClick={() => { setActionRequestId(null); setActionType(null); }}
                                          variant="outline"
                                          className="h-9 text-sm"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => { setActionRequestId(redeem.request_id); setActionType('approve'); }}
                                    className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-sm gap-1"
                                  >
                                    <CheckCircle className="w-4 h-4" /> Approve
                                  </Button>
                                  <Button
                                    onClick={() => { setActionRequestId(redeem.request_id); setActionType('reject'); }}
                                    variant="destructive"
                                    className="flex-1 h-9 text-sm gap-1"
                                  >
                                    <XCircle className="w-4 h-4" /> Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : null}
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
                  {/* Current Subscription Status Card */}
                  <div className={`p-5 rounded-xl border ${
                    userData.user?.subscription_plan === 'elite' 
                      ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/30'
                      : userData.user?.subscription_plan === 'growth'
                        ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/30'
                        : userData.user?.subscription_plan === 'startup'
                          ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30'
                          : 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 border-gray-500/30'
                  }`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                          userData.user?.subscription_plan === 'elite' 
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                            : userData.user?.subscription_plan === 'growth'
                              ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                              : userData.user?.subscription_plan === 'startup'
                                ? 'bg-gradient-to-br from-blue-500 to-cyan-600'
                                : 'bg-gradient-to-br from-gray-500 to-slate-600'
                        }`}>
                          <Crown className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Plan</p>
                          <p className="text-2xl font-bold text-white capitalize">
                            {userData.user?.subscription_plan || 'Explorer'}
                          </p>
                        </div>
                      </div>
                      {/* Status Badge */}
                      {(() => {
                        const expiry = userData.user?.subscription_expiry || userData.user?.membership_expiry;
                        if (!expiry || userData.user?.subscription_plan === 'explorer') {
                          return (
                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-500/30 text-gray-300">
                              Free Plan
                            </span>
                          );
                        }
                        const expiryDate = new Date(expiry);
                        const today = new Date();
                        const isExpired = expiryDate < today;
                        return (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            isExpired 
                              ? 'bg-red-500/30 text-red-400' 
                              : 'bg-green-500/30 text-green-400'
                          }`}>
                            {isExpired ? '❌ Expired' : '✅ Active'}
                          </span>
                        );
                      })()}
                    </div>
                    
                    {/* Expiry & Remaining Days */}
                    {userData.user?.subscription_plan && userData.user?.subscription_plan !== 'explorer' && (
                      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/10">
                        <div className="bg-black/20 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <p className="text-xs text-gray-400">Expiry Date</p>
                          </div>
                          <p className="text-lg font-semibold text-white">
                            {userData.user?.subscription_expiry || userData.user?.membership_expiry
                              ? new Date(userData.user?.subscription_expiry || userData.user?.membership_expiry).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : 'Not Set'}
                          </p>
                        </div>
                        <div className="bg-black/20 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <p className="text-xs text-gray-400">Remaining</p>
                          </div>
                          {(() => {
                            const expiry = userData.user?.subscription_expiry || userData.user?.membership_expiry;
                            if (!expiry) return <p className="text-lg font-semibold text-gray-500">N/A</p>;
                            
                            const expiryDate = new Date(expiry);
                            const today = new Date();
                            const diffTime = expiryDate - today;
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            
                            if (diffDays < 0) {
                              return (
                                <p className="text-lg font-semibold text-red-400">
                                  Expired {Math.abs(diffDays)} days ago
                                </p>
                              );
                            } else if (diffDays === 0) {
                              return <p className="text-lg font-semibold text-yellow-400">Expires Today!</p>;
                            } else if (diffDays <= 7) {
                              return (
                                <p className="text-lg font-semibold text-yellow-400">
                                  {diffDays} day{diffDays !== 1 ? 's' : ''} left
                                </p>
                              );
                            } else {
                              return (
                                <p className="text-lg font-semibold text-green-400">
                                  {diffDays} days left
                                </p>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {/* Manage Button */}
                    <div className="mt-4">
                      <Button
                        onClick={openSubscriptionModal}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        Manage Subscription
                      </Button>
                    </div>
                  </div>
                  
                  {/* Subscription History */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Subscription History ({userData.transactions.subscriptions?.length || 0})
                    </h4>
                  {userData.transactions.subscriptions?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No subscription payments found</p>
                  ) : (
                    <div className="space-y-2">
                    {userData.transactions.subscriptions?.map((sub, idx) => (
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
                    ))}
                    </div>
                  )}
                  </div>
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
                {/* Auto Diagnose Button - FIRST */}
                <Button
                  onClick={runDiagnosis}
                  disabled={processing}
                  className="h-auto py-3 col-span-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold"
                  data-testid="diagnose-button"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  🔍 Auto Diagnose Issues
                </Button>
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
                  onClick={openBalanceModal}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-blue-500/50 text-blue-400"
                  data-testid="adjust-balance-button"
                >
                  <Coins className="w-4 h-4 mr-2" />
                  Adjust Balance
                </Button>
                <Button
                  onClick={openSubscriptionModal}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-purple-500/50 text-purple-400"
                  data-testid="manage-subscription-button"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Manage Plan
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
                    const cap = prompt('Enter daily PRC cap (0 for unlimited):');
                    if (cap !== null) handleQuickAction('set_cap', { cap: parseInt(cap) });
                  }}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-cyan-500/50 text-cyan-400"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Set Daily Cap
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
                  onClick={openRoleModal}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-yellow-500/50 text-yellow-400"
                  data-testid="change-role-button"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Change Role
                </Button>
                {/* Show Manage Permissions only for Manager role users */}
                {userData?.user?.role === 'manager' && (
                  <Button
                    onClick={() => setPermissionsModal({ show: true })}
                    disabled={processing}
                    variant="outline"
                    className="h-auto py-3 border-emerald-500/50 text-emerald-400"
                    data-testid="manage-permissions-button"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Manage Permissions
                  </Button>
                )}
                {/* KYC Approve - Show only if KYC is NOT verified */}
                {userData?.user?.kyc_status !== 'verified' && (
                  <Button
                    onClick={() => {
                      if (confirm('✅ Approve KYC for this user? They will be able to make withdrawals.')) {
                        handleQuickAction('approve_kyc');
                      }
                    }}
                    disabled={processing}
                    variant="outline"
                    className="h-auto py-3 border-green-500/50 text-green-400"
                    data-testid="approve-kyc-button"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve KYC
                  </Button>
                )}
                {/* KYC Reject - Show only if KYC is pending or needs re-review */}
                {userData?.user?.kyc_status !== 'rejected' && userData?.user?.kyc_status !== 'verified' && (
                  <Button
                    onClick={() => {
                      const reason = prompt('Enter rejection reason:', 'Documents not valid or incomplete');
                      if (reason !== null) {
                        handleQuickAction('reject_kyc', { reason });
                      }
                    }}
                    disabled={processing}
                    variant="outline"
                    className="h-auto py-3 border-orange-500/50 text-orange-400"
                    data-testid="reject-kyc-button"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject KYC
                  </Button>
                )}
                {/* Restore PRC - for users affected by balance reset bug */}
                {userData?.user?.subscription_plan && ['startup', 'growth', 'elite', 'vip'].includes(userData.user.subscription_plan) && userData?.user?.prc_balance === 0 && (
                  <Button
                    onClick={async () => {
                      if (confirm('🔄 Restore PRC balance from transaction history? This will calculate the expected balance and restore it.')) {
                        setProcessing(true);
                        try {
                          const response = await axios.post(`${API}/admin/restore-prc/${userData.user.uid}`);
                          toast.success(response.data.message);
                          refreshUserData();
                        } catch (error) {
                          toast.error(error.response?.data?.detail || 'Failed to restore PRC');
                        } finally {
                          setProcessing(false);
                        }
                      }
                    }}
                    disabled={processing}
                    variant="outline"
                    className="h-auto py-3 border-amber-500/50 text-amber-400 col-span-2"
                    data-testid="restore-prc-button"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    🔄 Restore Lost PRC
                  </Button>
                )}
                <Button
                  onClick={() => {
                    const isBlocked = userData?.user?.is_blocked || userData?.user?.status === 'blocked';
                    const action = isBlocked ? 'unblock_user' : 'block_user';
                    const message = isBlocked 
                      ? '✅ Are you sure you want to unblock this user?' 
                      : '⚠️ Are you sure you want to block this user?';
                    if (confirm(message)) handleQuickAction(action);
                  }}
                  disabled={processing}
                  variant="outline"
                  className={`h-auto py-3 ${userData?.user?.is_blocked || userData?.user?.status === 'blocked' ? 'border-green-500/50 text-green-400' : 'border-red-500/50 text-red-400'}`}
                >
                  {userData?.user?.is_blocked || userData?.user?.status === 'blocked' ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Unblock User
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4 mr-2" />
                      Block User
                    </>
                  )}
                </Button>
                <Button
                  onClick={async () => {
                    const userEmail = userData?.user?.email || 'this user';
                    const confirmation = prompt(`⚠️ DANGER: This will permanently delete ${userEmail} and ALL their data.\n\nType "DELETE" to confirm:`);
                    if (confirmation === 'DELETE') {
                      setProcessing(true);
                      try {
                        await axios.delete(`${API}/admin/users/${userData.user.uid}/delete?permanent=true`);
                        toast.success('User permanently deleted');
                        setUserData(null);
                        setSearchQuery('');
                      } catch (error) {
                        toast.error(error.response?.data?.detail || 'Failed to delete user');
                      } finally {
                        setProcessing(false);
                      }
                    } else if (confirmation !== null) {
                      toast.error('Deletion cancelled - confirmation text did not match');
                    }
                  }}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-red-600/50 text-red-500 hover:bg-red-500/10"
                  data-testid="delete-user-button"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete User
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

      {/* Role Change Modal */}
      {roleModal.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" data-testid="role-change-modal">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              {/* Icon */}
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">Change User Role</h2>
              <p className="text-gray-400 mb-6">
                {userData?.user?.name || 'User'} - Current Role: <span className="text-yellow-400 font-semibold capitalize">{userData?.user?.role || 'user'}</span>
              </p>
              
              {/* Role Selection */}
              <div className="space-y-3 mb-6">
                {[
                  { value: 'user', label: 'User', desc: 'Regular user with standard access', color: 'blue' },
                  { value: 'manager', label: 'Manager', desc: 'Can access admin panel with limited permissions', color: 'purple' },
                  { value: 'admin', label: 'Admin', desc: 'Full admin access to all features', color: 'red' }
                ].map((role) => (
                  <button
                    key={role.value}
                    onClick={() => setSelectedRole(role.value)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedRole === role.value 
                        ? `border-${role.color}-500 bg-${role.color}-500/10` 
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-semibold ${selectedRole === role.value ? `text-${role.color}-400` : 'text-white'}`}>
                          {role.label}
                        </p>
                        <p className="text-xs text-gray-500">{role.desc}</p>
                      </div>
                      {selectedRole === role.value && (
                        <CheckCircle className={`w-6 h-6 text-${role.color}-400`} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Warning for admin role */}
              {selectedRole === 'admin' && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                  <p className="text-xs text-red-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Admin role gives full system access. Use with caution.
                  </p>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleRoleChange}
                  disabled={processing || selectedRole === userData?.user?.role}
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-black font-semibold"
                  data-testid="confirm-role-change-button"
                >
                  {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                  {processing ? 'Updating...' : 'Update Role'}
                </Button>
                <Button
                  onClick={() => setRoleModal({ show: false })}
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manager Permissions Modal */}
      {permissionsModal.show && userData?.user?.role === 'manager' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" data-testid="permissions-modal">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <ManagerPermissions
              userId={userData.user.uid}
              userName={userData.user.name || userData.user.email}
              onClose={() => setPermissionsModal({ show: false })}
              onSave={() => {
                setPermissionsModal({ show: false });
                refreshUserData();
              }}
            />
          </div>
        </div>
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

      {/* Adjust Balance Modal */}
      {balanceModal.show && userData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white">Adjust Balance</h3>
              <button onClick={() => setBalanceModal({ show: false })} className="text-gray-400 hover:text-white">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            {/* User Info */}
            <div className="p-4 mx-6 mt-4 bg-gray-800/50 rounded-xl">
              <p className="text-gray-400">User: <span className="text-white font-medium">{userData.user.name}</span></p>
              <p className="text-gray-400">Current PRC: <span className="text-green-400 font-bold">{(userData.user.prc_balance || 0).toLocaleString()}</span></p>
              <p className="text-gray-400">Plan: <span className="text-purple-400 capitalize">{userData.user.subscription_plan || 'Explorer'}</span></p>
            </div>
            
            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Balance Type */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Balance Type</label>
                <select
                  value={balanceForm.balanceType}
                  onChange={(e) => setBalanceForm({...balanceForm, balanceType: e.target.value})}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="prc_balance">PRC Balance</option>
                  <option value="cashback_wallet_balance">Cashback Wallet</option>
                </select>
              </div>
              
              {/* Operation */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Operation</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setBalanceForm({...balanceForm, operation: 'add'})}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-all ${
                      balanceForm.operation === 'add' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-green-500'
                    }`}
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                  <button
                    onClick={() => setBalanceForm({...balanceForm, operation: 'deduct'})}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-all ${
                      balanceForm.operation === 'deduct' 
                        ? 'bg-red-500 text-white' 
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-red-500'
                    }`}
                  >
                    <Minus className="w-4 h-4" /> Deduct
                  </button>
                  <button
                    onClick={() => setBalanceForm({...balanceForm, operation: 'set'})}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-all ${
                      balanceForm.operation === 'set' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-blue-500'
                    }`}
                  >
                    <Settings className="w-4 h-4" /> Set
                  </button>
                </div>
              </div>
              
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Amount</label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={balanceForm.amount}
                  onChange={(e) => setBalanceForm({...balanceForm, amount: e.target.value})}
                  className="w-full bg-gray-800 border-gray-700 text-white"
                />
              </div>
              
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Notes (Optional)</label>
                <textarea
                  placeholder="Reason for adjustment..."
                  value={balanceForm.notes}
                  onChange={(e) => setBalanceForm({...balanceForm, notes: e.target.value})}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white resize-none h-20 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 p-6 pt-0">
              <Button
                onClick={() => setBalanceModal({ show: false })}
                variant="outline"
                className="flex-1 border-gray-600 text-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBalanceAdjust}
                disabled={processing || !balanceForm.amount}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Adjust Balance
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Management Modal */}
      {subscriptionModal.show && userData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg border border-gray-700 shadow-2xl my-8">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white">Subscription Management</h3>
              <button onClick={() => setSubscriptionModal({ show: false })} className="text-gray-400 hover:text-white">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            {/* User Info */}
            <div className="p-4 mx-6 mt-4 bg-gray-800/50 rounded-xl">
              <p className="text-white font-semibold text-lg">{userData.user.name}</p>
              <p className="text-gray-400 text-sm">{userData.user.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-gray-400 text-sm">Current Plan:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  userData.user.subscription_plan === 'elite' ? 'bg-amber-500/20 text-amber-400' :
                  userData.user.subscription_plan === 'growth' ? 'bg-emerald-500/20 text-emerald-400' :
                  userData.user.subscription_plan === 'startup' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {(userData.user.subscription_plan || 'Explorer').charAt(0).toUpperCase() + (userData.user.subscription_plan || 'explorer').slice(1)}
                </span>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 px-6 mt-4">
              <button
                onClick={() => setSubscriptionTab('update')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  subscriptionTab === 'update' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                <Edit className="w-4 h-4" /> Update Plan
              </button>
              <button
                onClick={() => setSubscriptionTab('history')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  subscriptionTab === 'history' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                <Clock className="w-4 h-4" /> History ({userData.transactions.subscriptions?.length || 0})
              </button>
            </div>
            
            {subscriptionTab === 'update' ? (
              <div className="p-6 space-y-5">
                {/* Step 1: Select Plan */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">Step 1: Select Plan</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['explorer', 'startup', 'growth', 'elite'].map(plan => (
                      <button
                        key={plan}
                        onClick={() => setSubscriptionForm({...subscriptionForm, plan})}
                        className={`p-3 rounded-xl font-medium capitalize transition-all ${
                          subscriptionForm.plan === plan 
                            ? 'bg-purple-600 text-white border-2 border-purple-400' 
                            : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-purple-500'
                        }`}
                      >
                        {plan}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Step 2: Set Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">Step 2: Set Duration (Days)</label>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[30, 90, 180, 365].map(days => (
                      <button
                        key={days}
                        onClick={() => setSubscriptionForm({...subscriptionForm, duration: days})}
                        className={`p-3 rounded-xl font-medium transition-all ${
                          subscriptionForm.duration === days 
                            ? 'bg-purple-600 text-white border-2 border-purple-400' 
                            : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-purple-500'
                        }`}
                      >
                        {days === 365 ? '1 Year' : `${days} Days`}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">Custom:</span>
                    <Input
                      type="number"
                      value={subscriptionForm.customDuration}
                      onChange={(e) => setSubscriptionForm({...subscriptionForm, customDuration: parseInt(e.target.value) || 30, duration: 'custom'})}
                      className="w-24 bg-gray-800 border-gray-700 text-white"
                    />
                    <span className="text-gray-400">days</span>
                  </div>
                </div>
                
                {/* Step 3: Expiry Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">Step 3: Expiry Date</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSubscriptionForm({...subscriptionForm, expiryMode: 'auto'})}
                      className={`p-4 rounded-xl transition-all text-left ${
                        subscriptionForm.expiryMode === 'auto' 
                          ? 'bg-green-600/20 border-2 border-green-500 text-green-400' 
                          : 'bg-gray-800 border border-gray-700 text-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="font-medium">Auto: {getAutoExpiryDate()}</span>
                      </div>
                      <p className="text-xs opacity-75">Today + {subscriptionForm.duration === 'custom' ? subscriptionForm.customDuration : subscriptionForm.duration} days</p>
                    </button>
                    <button
                      onClick={() => setSubscriptionForm({...subscriptionForm, expiryMode: 'manual'})}
                      className={`p-4 rounded-xl transition-all text-left ${
                        subscriptionForm.expiryMode === 'manual' 
                          ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400' 
                          : 'bg-gray-800 border border-gray-700 text-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Edit className="w-4 h-4" />
                        <span className="font-medium">Manual Date</span>
                      </div>
                      <p className="text-xs opacity-75">Set specific date</p>
                    </button>
                  </div>
                  {subscriptionForm.expiryMode === 'manual' && (
                    <Input
                      type="date"
                      value={subscriptionForm.manualExpiry}
                      onChange={(e) => setSubscriptionForm({...subscriptionForm, manualExpiry: e.target.value})}
                      className="mt-3 w-full bg-gray-800 border-gray-700 text-white"
                    />
                  )}
                </div>
                
                {/* Free Subscription Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
                  <div>
                    <p className="text-white font-medium">Free Subscription</p>
                    <p className="text-gray-400 text-sm">Grant without payment</p>
                  </div>
                  <button
                    onClick={() => setSubscriptionForm({...subscriptionForm, isFree: !subscriptionForm.isFree})}
                    className={`w-14 h-8 rounded-full transition-all ${subscriptionForm.isFree ? 'bg-green-500' : 'bg-gray-700'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow transform transition-transform ${subscriptionForm.isFree ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>
                
                {/* Admin Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Admin Notes</label>
                  <textarea
                    placeholder="Notes about this update..."
                    value={subscriptionForm.adminNotes}
                    onChange={(e) => setSubscriptionForm({...subscriptionForm, adminNotes: e.target.value})}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white resize-none h-20"
                  />
                </div>
              </div>
            ) : (
              <div className="p-6">
                {/* Delete All Button */}
                {userData.transactions.subscriptions?.length > 0 && (
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={async () => {
                        if (!confirm(`Delete ALL ${userData.transactions.subscriptions.length} subscription records? This will also reset user to Explorer plan.`)) return;
                        try {
                          await axios.delete(`${API}/admin/user/${userData.user.uid}/subscriptions/all`);
                          toast.success('All subscription records deleted');
                          fetchUserData(userData.user.uid);
                        } catch (error) {
                          toast.error(error.response?.data?.detail || 'Failed to delete');
                        }
                      }}
                      variant="destructive"
                      size="sm"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Delete All Plans
                    </Button>
                  </div>
                )}
                
                <div className="max-h-64 overflow-y-auto">
                  {userData.transactions.subscriptions?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No subscription history</p>
                  ) : (
                    <div className="space-y-2">
                      {userData.transactions.subscriptions?.map((sub, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                          <div className="flex-1">
                            <p className="text-white font-medium capitalize">{sub.plan || sub.subscription_plan}</p>
                            <p className="text-gray-400 text-xs">{formatDate(sub.created_at || sub.start_date)}</p>
                          </div>
                          <div className="text-right mr-3">
                            <p className="text-gray-400 text-sm">Expires: {formatDate(sub.expiry || sub.end_date)}</p>
                            <span className={`px-2 py-0.5 rounded text-xs ${sub.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                              {sub.status || 'completed'}
                            </span>
                          </div>
                          <button
                            onClick={async () => {
                              if (!confirm('Delete this subscription record?')) return;
                              try {
                                await axios.delete(`${API}/admin/user/${userData.user.uid}/subscription/${sub.payment_id}`);
                                toast.success('Subscription record deleted');
                                fetchUserData(userData.user.uid);
                              } catch (error) {
                                toast.error(error.response?.data?.detail || 'Failed to delete');
                              }
                            }}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Delete this plan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Actions */}
            {subscriptionTab === 'update' && (
              <div className="flex gap-3 p-6 pt-0">
                <Button
                  onClick={() => setSubscriptionModal({ show: false })}
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubscriptionUpdate}
                  disabled={processing}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crown className="w-4 h-4 mr-2" />}
                  Update Subscription
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auto Diagnose Modal */}
      {diagnoseModal.show && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setDiagnoseModal({ show: false, loading: false, data: null })}>
          <Card className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-gray-900 border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Zap className="w-6 h-6 text-purple-500" />
                  Auto Diagnosis Report
                </h2>
                <button onClick={() => setDiagnoseModal({ show: false, loading: false, data: null })} className="text-gray-400 hover:text-white">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {diagnoseModal.loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 animate-spin text-purple-500 mb-4" />
                  <p className="text-gray-400">Running diagnostics...</p>
                </div>
              ) : diagnoseModal.data ? (
                <>
                  {/* Health Score */}
                  <div className={`p-4 rounded-xl mb-6 ${
                    diagnoseModal.data.health_score >= 80 ? 'bg-green-500/20 border border-green-500/50' :
                    diagnoseModal.data.health_score >= 50 ? 'bg-yellow-500/20 border border-yellow-500/50' :
                    'bg-red-500/20 border border-red-500/50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Health Score</p>
                        <p className={`text-3xl font-bold ${
                          diagnoseModal.data.health_score >= 80 ? 'text-green-400' :
                          diagnoseModal.data.health_score >= 50 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {diagnoseModal.data.health_score}/100
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-sm">Issues Found</p>
                        <p className="text-2xl font-bold text-white">{diagnoseModal.data.total_issues}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-3 text-sm">
                      {diagnoseModal.data.summary.critical > 0 && <span className="text-red-400">🔴 {diagnoseModal.data.summary.critical} Critical</span>}
                      {diagnoseModal.data.summary.high > 0 && <span className="text-orange-400">🟠 {diagnoseModal.data.summary.high} High</span>}
                      {diagnoseModal.data.summary.medium > 0 && <span className="text-yellow-400">🟡 {diagnoseModal.data.summary.medium} Medium</span>}
                      {diagnoseModal.data.summary.low > 0 && <span className="text-blue-400">🔵 {diagnoseModal.data.summary.low} Low</span>}
                    </div>
                  </div>

                  {/* Auto-Fixed Items */}
                  {diagnoseModal.data.auto_fixed?.length > 0 && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                      <p className="text-green-400 font-medium mb-2">✅ Auto-Fixed:</p>
                      <ul className="text-sm text-gray-300 space-y-1">
                        {diagnoseModal.data.auto_fixed.map((item, idx) => (
                          <li key={idx}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Issues List */}
                  {diagnoseModal.data.issues?.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                      <p className="text-green-400 font-medium text-lg">All Good!</p>
                      <p className="text-gray-400">No issues found for this user.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {diagnoseModal.data.issues.map((issue, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border ${
                          issue.severity === 'critical' ? 'bg-red-500/10 border-red-500/50' :
                          issue.severity === 'high' ? 'bg-orange-500/10 border-orange-500/50' :
                          issue.severity === 'medium' ? 'bg-yellow-500/10 border-yellow-500/50' :
                          'bg-blue-500/10 border-blue-500/50'
                        }`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  issue.severity === 'critical' ? 'bg-red-500/30 text-red-300' :
                                  issue.severity === 'high' ? 'bg-orange-500/30 text-orange-300' :
                                  issue.severity === 'medium' ? 'bg-yellow-500/30 text-yellow-300' :
                                  'bg-blue-500/30 text-blue-300'
                                }`}>
                                  {issue.severity.toUpperCase()}
                                </span>
                                <span className="text-gray-500 text-xs">{issue.category}</span>
                              </div>
                              <p className="text-white font-medium">{issue.issue}</p>
                              <p className="text-gray-400 text-sm mt-1">{issue.description}</p>
                              {issue.suggested_balance && (
                                <p className="text-green-400 text-sm mt-1">Suggested Balance: {issue.suggested_balance} PRC</p>
                              )}
                            </div>
                            {issue.can_auto_fix && (
                              <Button
                                onClick={() => fixIssue(issue.fix_action, issue.suggested_balance)}
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                              >
                                Fix
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Re-run Button */}
                  <div className="mt-6 flex justify-center">
                    <Button onClick={runDiagnosis} variant="outline" className="border-purple-500/50 text-purple-400">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Re-run Diagnosis
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </Card>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default AdminUser360;
