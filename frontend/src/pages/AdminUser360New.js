import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Search, User, Mail, Phone, Calendar, Shield, Crown,
  Coins, TrendingUp, Users, Gift, CreditCard, Clock,
  CheckCircle, XCircle, AlertTriangle, Activity, RefreshCw, 
  Loader2, ArrowLeft, Copy, Ban, Wallet, Receipt, BadgeCheck,
  Plus, Minus, History, Send
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ========== SUB-COMPONENTS ==========

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

const UserProfileCard = ({ user }) => {
  if (!user) return null;
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };
  
  const planColors = {
    free: 'gray',
    startup: 'blue',
    growth: 'purple',
    elite: 'amber'
  };
  
  const planColor = planColors[user.subscription_plan] || 'gray';
  
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
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                  BANNED
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-400 flex items-center gap-2">
              UID: {user.uid}
              <button 
                onClick={() => copyToClipboard(user.uid)}
                className="hover:text-white transition-colors"
              >
                <Copy className="h-3 w-3" />
              </button>
            </p>
          </div>
        </div>
        
        <div className={`px-3 py-1.5 rounded-full bg-${planColor}-500/20 border border-${planColor}-500/30`}>
          <span className={`text-${planColor}-400 font-semibold capitalize flex items-center gap-1`}>
            <Crown className="h-4 w-4" />
            {user.subscription_plan || 'Free'}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
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
          <Wallet className="h-4 w-4 text-amber-500" />
          <span className="text-amber-400 font-bold">
            {(user.prc_balance || 0).toFixed(2)} PRC
          </span>
        </div>
      </div>
    </Card>
  );
};

const TransactionsTable = ({ transactions, title = "Recent Transactions" }) => {
  if (!transactions?.length) {
    return (
      <Card className="bg-gray-900/50 border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <p className="text-gray-500 text-center py-8">No transactions found</p>
      </Card>
    );
  }
  
  return (
    <Card className="bg-gray-900/50 border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Amount</th>
              <th className="pb-2 pr-4">Balance</th>
              <th className="pb-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.slice(0, 20).map((txn, idx) => (
              <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    txn.type === 'mining' ? 'bg-green-500/20 text-green-400' :
                    txn.type === 'referral' ? 'bg-blue-500/20 text-blue-400' :
                    txn.type === 'redeem' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {txn.type}
                  </span>
                </td>
                <td className={`py-2 pr-4 font-medium ${
                  (txn.amount || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {(txn.amount || 0) >= 0 ? '+' : ''}{(txn.amount || 0).toFixed(2)}
                </td>
                <td className="py-2 pr-4 text-gray-300">
                  {(txn.balance_after || 0).toFixed(2)}
                </td>
                <td className="py-2 text-gray-500 text-xs">
                  {txn.created_at ? new Date(txn.created_at).toLocaleString() : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const ReferralSection = ({ referral }) => {
  if (!referral) return null;
  
  return (
    <Card className="bg-gray-900/50 border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-blue-400" />
        Referral Network
      </h3>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-blue-500/10 rounded-lg">
          <p className="text-2xl font-bold text-blue-400">{referral.l1_count || 0}</p>
          <p className="text-xs text-gray-400">Level 1</p>
        </div>
        <div className="text-center p-3 bg-purple-500/10 rounded-lg">
          <p className="text-2xl font-bold text-purple-400">{referral.l2_count || 0}</p>
          <p className="text-xs text-gray-400">Level 2</p>
        </div>
        <div className="text-center p-3 bg-amber-500/10 rounded-lg">
          <p className="text-2xl font-bold text-amber-400">{referral.total_network || 0}</p>
          <p className="text-xs text-gray-400">Total</p>
        </div>
      </div>
      
      {referral.l1_users?.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-400 mb-2">Recent Referrals:</p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {referral.l1_users.slice(0, 5).map((user, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                <span className="text-sm text-gray-300">{user.name || user.email}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  user.subscription_plan === 'elite' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {user.subscription_plan || 'free'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

const RedeemRequestsTable = ({ requests }) => {
  if (!requests?.length) {
    return (
      <Card className="bg-gray-900/50 border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Redeem Requests</h3>
        <p className="text-gray-500 text-center py-8">No redeem requests found</p>
      </Card>
    );
  }
  
  const statusColors = {
    completed: 'green',
    COMPLETED: 'green',
    success: 'green',
    SUCCESS: 'green',
    pending: 'yellow',
    PENDING: 'yellow',
    failed: 'red',
    FAILED: 'red',
    rejected: 'red'
  };
  
  return (
    <Card className="bg-gray-900/50 border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Receipt className="h-5 w-5 text-green-400" />
        Redeem Requests
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="pb-2 pr-4">Service</th>
              <th className="pb-2 pr-4">Amount</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {requests.slice(0, 15).map((req, idx) => {
              const color = statusColors[req.status] || 'gray';
              return (
                <tr key={idx} className="border-b border-gray-800">
                  <td className="py-2 pr-4 text-gray-300">{req.service_type || 'N/A'}</td>
                  <td className="py-2 pr-4 text-amber-400 font-medium">₹{req.amount_inr || 0}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs bg-${color}-500/20 text-${color}-400`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500 text-xs">
                    {req.created_at ? new Date(req.created_at).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const AdminActions = ({ user, onAction, loading }) => {
  const [actionValue, setActionValue] = useState('');
  const [actionReason, setActionReason] = useState('');
  
  const handleAction = (action) => {
    onAction(action, actionValue, actionReason);
    setActionValue('');
    setActionReason('');
  };
  
  return (
    <Card className="bg-gray-900/50 border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-red-400" />
        Admin Actions
      </h3>
      
      <div className="space-y-4">
        {/* Ban/Unban */}
        <div className="flex gap-2">
          {user?.is_banned ? (
            <Button 
              onClick={() => handleAction('unban')}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Unban User
            </Button>
          ) : (
            <Button 
              onClick={() => handleAction('ban')}
              disabled={loading}
              variant="destructive"
              className="flex-1"
            >
              <Ban className="h-4 w-4 mr-2" />
              Ban User
            </Button>
          )}
        </div>
        
        {/* PRC Actions */}
        <div className="p-3 bg-gray-800/50 rounded-lg space-y-2">
          <p className="text-sm text-gray-400">PRC Balance Adjustment</p>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Amount"
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
              className="flex-1 bg-gray-700 border-gray-600"
            />
            <Button 
              onClick={() => handleAction('add_prc')}
              disabled={loading || !actionValue}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => handleAction('deduct_prc')}
              disabled={loading || !actionValue}
              variant="destructive"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Reason */}
        <Input
          placeholder="Reason for action (optional)"
          value={actionReason}
          onChange={(e) => setActionReason(e.target.value)}
          className="bg-gray-700 border-gray-600"
        />
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
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
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
      // Step 1: Search user
      const searchResponse = await axios.get(
        `${API}/admin/user360/search?q=${encodeURIComponent(searchQuery.trim())}`,
        { headers: { Authorization: `Bearer ${adminUser?.token}` } }
      );
      
      const foundUser = searchResponse.data.user;
      
      // Step 2: Load full data
      const fullResponse = await axios.get(
        `${API}/admin/user360/full/${foundUser.uid}`,
        { headers: { Authorization: `Bearer ${adminUser?.token}` } }
      );
      
      setUserData(fullResponse.data);
      toast.success(`Loaded data for ${foundUser.name || foundUser.email}`);
      
    } catch (err) {
      console.error('Search error:', err);
      const message = err.response?.data?.detail || err.message || 'Search failed';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, adminUser?.token]);
  
  // Handle admin action
  const handleAction = async (action, value, reason) => {
    if (!userData?.user?.uid) return;
    
    setActionLoading(true);
    try {
      await axios.post(
        `${API}/admin/user360/action/${userData.user.uid}`,
        { action, value, reason, admin_id: adminUser?.uid },
        { headers: { Authorization: `Bearer ${adminUser?.token}` } }
      );
      
      toast.success(`Action '${action}' completed successfully`);
      
      // Reload user data
      handleSearch();
      
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };
  
  // Auto-search on mount if query param exists
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchQuery(q);
      // Delay to ensure state is set
      setTimeout(() => handleSearch(), 100);
    }
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin')}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">User 360° View</h1>
          <p className="text-sm text-gray-400">Complete user profile and activity</p>
        </div>
      </div>
      
      {/* Search Bar */}
      <Card className="bg-gray-900/50 border-gray-700 p-4 mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <Input
              placeholder="Search by UID, email, mobile, or referral code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
              data-testid="user360-search-input"
            />
          </div>
          <Button 
            onClick={handleSearch}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 min-w-[120px]"
            data-testid="user360-search-button"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>
      </Card>
      
      {/* Error Message */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30 p-4 mb-6">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </Card>
      )}
      
      {/* Loading State */}
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
          <UserProfileCard user={userData.user} />
          
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              icon={Coins} 
              label="Total Mined" 
              value={`${(userData.stats?.total_mined || 0).toFixed(2)} PRC`}
              color="green"
            />
            <StatCard 
              icon={TrendingUp} 
              label="Total Redeemed" 
              value={`₹${(userData.stats?.total_redeemed || 0).toFixed(0)}`}
              color="blue"
            />
            <StatCard 
              icon={Gift} 
              label="Referral Bonus" 
              value={`${(userData.stats?.total_referral_bonus || 0).toFixed(2)} PRC`}
              color="purple"
            />
            <StatCard 
              icon={Users} 
              label="Network Size" 
              value={userData.referral?.total_network || 0}
              color="cyan"
            />
          </div>
          
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - 2/3 width */}
            <div className="lg:col-span-2 space-y-6">
              <TransactionsTable transactions={userData.transactions} />
              <RedeemRequestsTable requests={userData.redeem_requests} />
            </div>
            
            {/* Right Column - 1/3 width */}
            <div className="space-y-6">
              <ReferralSection referral={userData.referral} />
              <AdminActions 
                user={userData.user} 
                onAction={handleAction}
                loading={actionLoading}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {!userData && !loading && !error && (
        <div className="text-center py-20">
          <User className="h-16 w-16 mx-auto text-gray-700 mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">Search for a User</h3>
          <p className="text-gray-500">Enter UID, email, mobile number, or referral code</p>
        </div>
      )}
    </div>
  );
};

export default AdminUser360New;
