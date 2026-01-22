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
  BarChart3, PieChart, Network, History, Settings, Send
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
  const handleQuickAction = async (action, params = {}) => {
    if (!userData?.user?.uid) return;
    
    setProcessing(true);
    try {
      await axios.post(`${API}/api/admin/user-360/action`, {
        user_id: userData.user.uid,
        action,
        admin_id: adminUser?.uid,
        ...params
      });
      toast.success(`Action "${action}" completed successfully`);
      handleSearch(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Action failed');
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
      <div className="flex items-center gap-4 mb-6">
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

      {/* Search Section */}
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
                { id: 'vouchers', label: 'Gift Vouchers', icon: Gift, count: userData.transactions.gift_vouchers?.length || 0 },
                { id: 'subscriptions', label: 'Subscriptions', icon: Crown, count: userData.transactions.subscriptions?.length || 0 }
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
                          <p className="text-gray-400 text-sm">₹{bill.amount_inr} • {formatDate(bill.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white">{bill.total_prc_deducted} PRC</p>
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(bill.status)}`}>
                            {bill.status}
                          </span>
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
                <div className="space-y-2">
                  {userData.transactions.subscriptions?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No subscriptions found</p>
                  ) : (
                    userData.transactions.subscriptions?.map((sub, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div>
                          <p className="text-white font-medium capitalize">{sub.subscription_plan} - {sub.plan_type}</p>
                          <p className="text-gray-400 text-sm">₹{sub.amount} • {formatDate(sub.submitted_at)}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(sub.status)}`}>
                            {sub.status}
                          </span>
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
                    if (confirm('Send password reset email?')) handleQuickAction('reset_password');
                  }}
                  disabled={processing}
                  variant="outline"
                  className="h-auto py-3 border-cyan-500/50 text-cyan-400"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset Password
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
    </div>
  );
};

export default AdminUser360;
