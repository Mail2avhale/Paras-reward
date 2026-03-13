import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, Package, CreditCard, FileText, BarChart3, TrendingUp, 
  Store, Award, ShoppingCart, Bell, Settings, DollarSign, Truck, Activity,
  Shield, Wallet, AlertTriangle, Crown, RefreshCw, ChevronRight,
  UserCheck, Clock, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight,
  Zap, Gift, Star, Target, Percent, BadgeCheck, UserCog
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminLoginAsUser from '@/components/AdminLoginAsUser';
import PaymentRetryQueueWidget from '@/components/admin/PaymentRetryQueueWidget';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Skeleton Loading Component
const SkeletonCard = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-800/50 rounded-xl p-4 ${className}`}>
    <div className="h-4 bg-gray-700 rounded w-1/3 mb-3"></div>
    <div className="h-8 bg-gray-700 rounded w-1/2 mb-2"></div>
    <div className="h-3 bg-gray-700 rounded w-2/3"></div>
  </div>
);

const AdminDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [deliveryStats, setDeliveryStats] = useState(null);
  // Orders removed - Marketplace deprecated
  const [pendingKYC, setPendingKYC] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLoginAsUser, setShowLoginAsUser] = useState(false);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      // Single combined API call + parallel secondary calls
      const [statsRes, deliveryRes, kycRes] = await Promise.all([
        axios.get(`${API}/admin/stats`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/delivery-partners/stats`).catch(() => ({ data: {} })),
        // Orders API removed - Marketplace deprecated
        axios.get(`${API}/kyc/list?limit=10&status=pending`).catch(() => ({ data: [] }))
      ]);
      
      setStats(statsRes.data);
      setDeliveryStats(deliveryRes.data);
      // Orders removed - Marketplace deprecated
      const allKyc = Array.isArray(kycRes.data) ? kycRes.data : (kycRes.data?.users || []);
      setPendingKYC(allKyc.filter(k => k.status === 'pending').slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      if (!isRefresh) toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 2 minutes
    const interval = setInterval(() => fetchDashboardData(true), 120000);
    return () => clearInterval(interval);
  }, []);

  // Memoize computed values
  const subscriptionStats = useMemo(() => ({
    explorer: stats?.subscription_stats?.explorer || 0,
    startup: stats?.subscription_stats?.startup || 0,
    growth: stats?.subscription_stats?.growth || 0,
    elite: stats?.subscription_stats?.elite || 0
  }), [stats]);

  const totalPaidUsers = subscriptionStats.startup + subscriptionStats.growth + subscriptionStats.elite;
  const totalUsers = stats?.users?.total || 0;
  const conversionRate = totalUsers > 0 ? ((totalPaidUsers / totalUsers) * 100).toFixed(1) : 0;

  // Skeleton Loading State
  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-6 pb-24 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-gray-800 rounded w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-800 rounded w-32 animate-pulse"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-800 rounded-full animate-pulse"></div>
            <div className="w-24 h-9 bg-gray-800 rounded animate-pulse"></div>
          </div>
        </div>
        
        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        
        {/* Subscription Overview Skeleton */}
        <div className="grid grid-cols-4 gap-3">
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
        </div>
        
        {/* KYC & PRC Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonCard className="h-40" />
          <SkeletonCard className="h-40" />
        </div>
        
        {/* Quick Actions Skeleton */}
        <SkeletonCard className="h-32" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-6 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">Welcome back, {user?.name || 'Admin'}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Login As User Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowLoginAsUser(true)}
            className="text-orange-400 border-orange-500/50 hover:bg-orange-500/10"
          >
            <UserCog className="w-4 h-4 mr-2" />
            Login As User
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="text-gray-300 border-gray-700 hover:bg-gray-800"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <div className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Admin
          </div>
        </div>
      </div>

      {/* Action Required Alert */}
      {(stats?.kyc?.pending > 0 || stats?.subscription_payments?.pending > 0 || stats?.vip_payments?.pending > 0) && (
        <Card className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-amber-500 animate-bounce" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-400 mb-2">⚡ Action Required</h3>
              <div className="flex flex-wrap gap-3">
                {stats?.kyc?.pending > 0 && (
                  <button onClick={() => navigate('/admin/kyc')} className="text-sm text-amber-300 hover:text-amber-200 flex items-center gap-1">
                    <UserCheck className="w-4 h-4" /> {stats.kyc.pending} KYC Pending <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {stats?.vip_payments?.pending > 0 && (
                  <button onClick={() => navigate('/admin/subscriptions')} className="text-sm text-amber-300 hover:text-amber-200 flex items-center gap-1">
                    <CreditCard className="w-4 h-4" /> {stats.vip_payments.pending} Payments Pending <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Hero Stats - Large Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroStatCard
          icon={Users}
          label="Total Users"
          value={stats?.users?.total || 0}
          subValue={`+${stats?.users?.new_today || 0} today`}
          color="blue"
          onClick={() => navigate('/admin/users')}
        />
        <HeroStatCard
          icon={Crown}
          label="Paid Subscribers"
          value={totalPaidUsers}
          subValue={`${conversionRate}% conversion`}
          color="purple"
          onClick={() => navigate('/admin/subscriptions')}
        />
        <HeroStatCard
          icon={DollarSign}
          label="Total PRC"
          value={(stats?.total_prc || 0).toLocaleString()}
          subValue={`₹${((stats?.total_prc || 0) / 10).toLocaleString()} value`}
          color="emerald"
          onClick={() => navigate('/admin/prc-analytics')}
        />
        {/* Orders card removed - Marketplace deprecated */}
      </div>

      {/* Subscription Breakdown - Beautiful Progress Bars */}
      <Card className="p-5 bg-gradient-to-br from-gray-900/80 to-gray-950 border-gray-800">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" />
            Subscription Overview
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/subscriptions')} className="text-purple-400 hover:text-purple-300">
            Manage <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SubscriptionCard 
            plan="Explorer" 
            count={subscriptionStats.explorer} 
            total={totalUsers}
            color="gray"
            icon="👤"
            price="Free"
            onClick={() => navigate('/admin/users?plan=explorer')}
          />
          <SubscriptionCard 
            plan="Startup" 
            count={subscriptionStats.startup} 
            total={totalUsers}
            color="blue"
            icon="🚀"
            price="₹199 - ₹1,799"
            onClick={() => navigate('/admin/subscriptions?plan=startup')}
          />
          <SubscriptionCard 
            plan="Growth" 
            count={subscriptionStats.growth} 
            total={totalUsers}
            color="purple"
            icon="📈"
            price="₹499 - ₹4,499"
            onClick={() => navigate('/admin/subscriptions?plan=growth')}
          />
          <SubscriptionCard 
            plan="Elite" 
            count={subscriptionStats.elite} 
            total={totalUsers}
            color="amber"
            icon="👑"
            price="₹799 - ₹7,191"
            onClick={() => navigate('/admin/subscriptions?plan=elite')}
          />
        </div>

        {/* Revenue Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
          <div 
            className="text-center p-2 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-all"
            onClick={() => navigate('/admin/finance')}
          >
            <p className="text-2xl font-bold text-emerald-400">₹{(stats?.revenue?.vip_fees || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500">Subscription Revenue</p>
          </div>
          <div 
            className="text-center p-2 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-all"
            onClick={() => navigate('/admin/ledger')}
          >
            <p className="text-2xl font-bold text-blue-400">📒</p>
            <p className="text-xs text-gray-500">Ledger View</p>
          </div>
          <div 
            className="text-center p-2 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-all"
            onClick={() => navigate('/admin/subscriptions?tab=approved')}
          >
            <p className="text-2xl font-bold text-purple-400">{stats?.vip_payments?.approved || 0}</p>
            <p className="text-xs text-gray-500">Approved Payments</p>
          </div>
          <div 
            className="text-center p-2 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-all"
            onClick={() => navigate('/admin/subscriptions?tab=pending')}
          >
            <p className="text-2xl font-bold text-amber-400">{stats?.vip_payments?.pending || 0}</p>
            <p className="text-xs text-gray-500">Pending Approval</p>
          </div>
        </div>
      </Card>

      {/* KYC & Verification Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border-cyan-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-cyan-400" />
              KYC Verification
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/kyc')} className="text-cyan-400 hover:text-cyan-300">
              Verify <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          <div className="grid grid-cols-4 gap-3">
            <MiniStatCard value={stats?.kyc?.total || 0} label="Total" color="gray" />
            <MiniStatCard value={stats?.kyc?.pending || 0} label="Pending" color="amber" highlight />
            <MiniStatCard value={stats?.kyc?.verified || 0} label="Verified" color="emerald" />
            <MiniStatCard value={stats?.kyc?.rejected || 0} label="Rejected" color="red" />
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-purple-400" />
              PRC Economy
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/prc-economy')} className="text-purple-400 hover:text-purple-300">
              Control <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <MiniStatCard value={(stats?.total_prc || 0).toFixed(0)} label="In Circulation" color="emerald" />
            <MiniStatCard value={(stats?.prc_redeemed || 0).toFixed(0)} label="Redeemed" color="blue" />
            <MiniStatCard value={stats?.withdrawals?.pending_count || 0} label="Pending W/D" color="amber" />
          </div>
        </Card>
      </div>

      {/* Quick Actions Grid */}
      <Card className="p-4 bg-gray-900/50 border-gray-800">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
          <QuickActionCard icon={Users} label="Users" color="blue" onClick={() => navigate('/admin/users')} />
          <QuickActionCard icon={Crown} label="Subs" badge={stats?.vip_payments?.pending} color="purple" onClick={() => navigate('/admin/subscriptions')} />
          <QuickActionCard icon={BadgeCheck} label="KYC" badge={stats?.kyc?.pending} color="cyan" onClick={() => navigate('/admin/kyc')} />
          {/* Orders QuickAction removed - Marketplace deprecated */}
          <QuickActionCard icon={Wallet} label="Wallets" color="teal" onClick={() => navigate('/admin/company-wallets')} />
          <QuickActionCard icon={Shield} label="Security" color="red" onClick={() => navigate('/admin/security')} />
          <QuickActionCard icon={AlertTriangle} label="PRC Ctrl" color="orange" onClick={() => navigate('/admin/prc-economy')} />
          <QuickActionCard icon={Settings} label="Settings" color="gray" onClick={() => navigate('/admin/settings/system')} />
        </div>
      </Card>

      {/* KYC & Activity Section - Orders section removed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending KYC Preview */}
        <Card className="p-4 bg-gray-900/50 border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-cyan-400" />
              Pending KYC Verifications
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/kyc')} className="text-cyan-400 hover:text-cyan-300">
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          {pendingKYC.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">All KYC verified!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingKYC.slice(0, 3).map((kyc) => (
                <div key={kyc.document_id || kyc._id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-cyan-400" />
                    </div>
                    <span className="text-white text-sm">{kyc.user_name || 'Unknown'}</span>
                  </div>
                  <span className="text-gray-500 text-xs px-2 py-1 bg-gray-800 rounded-full">{kyc.document_type || 'Document'}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Payment Retry Queue Widget */}
      <div className="mt-6">
        <PaymentRetryQueueWidget />
      </div>

      {/* Login As User Dialog */}
      <AdminLoginAsUser 
        adminUser={user}
        isOpen={showLoginAsUser}
        onClose={() => setShowLoginAsUser(false)}
      />
    </div>
  );
};

// Hero Stat Card Component
const HeroStatCard = ({ icon: Icon, label, value, subValue, color, onClick }) => {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/50',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:border-purple-400/50',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-400/50',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-400/50',
  };
  
  const iconColors = {
    blue: 'text-blue-400 bg-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/20',
  };

  const textColors = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
  };

  return (
    <Card 
      className={`p-4 bg-gradient-to-br ${colorClasses[color]} cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]`}
      onClick={onClick}
      data-testid={`hero-stat-${label.toLowerCase().replace(' ', '-')}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          <p className={`text-xs ${textColors[color]} mt-1`}>{subValue}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${iconColors[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
};

// Subscription Card Component
const SubscriptionCard = ({ plan, count, total, color, icon, onClick, price }) => {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  
  const colorClasses = {
    gray: { bg: 'bg-gray-500/20', bar: 'bg-gray-500', text: 'text-gray-400' },
    blue: { bg: 'bg-blue-500/20', bar: 'bg-blue-500', text: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/20', bar: 'bg-purple-500', text: 'text-purple-400' },
    amber: { bg: 'bg-amber-500/20', bar: 'bg-amber-500', text: 'text-amber-400' },
  };

  return (
    <div 
      className={`p-3 bg-gray-800/50 rounded-xl ${onClick ? 'cursor-pointer hover:bg-gray-800/80 transition-all' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
        <span className={`text-xs ${colorClasses[color].text}`}>{percentage}%</span>
      </div>
      <p className="text-xl font-bold text-white">{count.toLocaleString()}</p>
      <p className="text-xs text-gray-500">{plan}</p>
      {price && <p className={`text-xs ${colorClasses[color].text} mt-1`}>{price}</p>}
      <div className={`h-1.5 ${colorClasses[color].bg} rounded-full overflow-hidden mt-2`}>
        <div 
          className={`h-full ${colorClasses[color].bar} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Mini Stat Card Component
const MiniStatCard = ({ value, label, color, highlight }) => {
  const colorClasses = {
    gray: 'text-gray-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };

  return (
    <div className={`text-center p-3 rounded-xl ${highlight ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-gray-800/50'}`}>
      <p className={`text-xl font-bold ${colorClasses[color]}`}>{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
};

// Quick Action Card Component
const QuickActionCard = ({ icon: Icon, label, badge, color, onClick }) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20 text-purple-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-400',
    cyan: 'bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20 text-cyan-400',
    pink: 'bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20 text-pink-400',
    teal: 'bg-teal-500/10 border-teal-500/20 hover:bg-teal-500/20 text-teal-400',
    red: 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400',
    orange: 'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20 text-orange-400',
    gray: 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-400',
  };

  return (
    <button
      onClick={onClick}
      className={`relative p-2 rounded-xl border transition-all ${colorClasses[color]} text-center hover:scale-105 active:scale-95`}
      data-testid={`quick-action-${label.toLowerCase()}`}
    >
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <Icon className="w-5 h-5 mx-auto mb-1" />
      <p className="text-[10px] font-medium truncate">{label}</p>
    </button>
  );
};

export default AdminDashboard;
