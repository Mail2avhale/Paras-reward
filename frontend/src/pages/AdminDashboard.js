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
  Zap, Gift, Star, Target, Percent, BadgeCheck, UserCog, Trophy, Flame
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminLoginAsUser from '@/components/AdminLoginAsUser';
import PaymentRetryQueueWidget from '@/components/admin/PaymentRetryQueueWidget';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Skeleton Loading Component - BULKPE STYLE
const SkeletonCard = ({ className = "" }) => (
  <div className={`animate-pulse bg-white rounded-2xl p-5 border border-slate-100 shadow-sm ${className}`}>
    <div className="h-4 bg-slate-200 rounded w-1/3 mb-3"></div>
    <div className="h-8 bg-slate-200 rounded w-1/2 mb-2"></div>
    <div className="h-3 bg-slate-200 rounded w-2/3"></div>
  </div>
);

const AdminDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [deliveryStats, setDeliveryStats] = useState(null);
  const [pendingKYC, setPendingKYC] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLoginAsUser, setShowLoginAsUser] = useState(false);
  const [bulkFixing, setBulkFixing] = useState(false);
  const [bulkFixResult, setBulkFixResult] = useState(null);
  const [bulkFixJob, setBulkFixJob] = useState(null);

  // Check for running bulk fix job on load
  useEffect(() => {
    const checkBulkFixJob = async () => {
      try {
        const res = await axios.get(`${API}/admin/bulk-fix-latest`);
        if (res.data.job && res.data.job.status === 'running') {
          setBulkFixJob(res.data.job);
          pollJobStatus(res.data.job.job_id);
        }
      } catch (err) {
        console.error('Failed to check bulk fix job:', err);
      }
    };
    checkBulkFixJob();
  }, []);

  // Poll job status
  const pollJobStatus = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/admin/bulk-fix-status/${jobId}`);
        setBulkFixJob(res.data.job);
        
        if (res.data.job.status === 'completed') {
          clearInterval(interval);
          toast.success(`✅ Bulk fix completed! Fixed ${res.data.job.issues_fixed} issues`);
          fetchDashboardData(true);
        } else if (res.data.job.status === 'failed') {
          clearInterval(interval);
          toast.error('Bulk fix job failed');
        }
      } catch (err) {
        clearInterval(interval);
      }
    }, 2000); // Poll every 2 seconds
  };

  // Start background bulk fix
  const startBulkFixJob = async () => {
    setBulkFixing(true);
    try {
      const res = await axios.post(`${API}/admin/bulk-fix-start`);
      if (res.data.success) {
        toast.info(`🚀 Bulk fix started for ${res.data.total_users} users`);
        setBulkFixJob({ job_id: res.data.job_id, status: 'running', progress: 0, total_users: res.data.total_users });
        pollJobStatus(res.data.job_id);
      } else {
        toast.warning(res.data.message);
        if (res.data.existing_job_id) {
          pollJobStatus(res.data.existing_job_id);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start bulk fix');
    } finally {
      setBulkFixing(false);
    }
  };

  // Bulk Fix All Users function (old - for preview)
  const runBulkFix = async (dryRun = true) => {
    setBulkFixing(true);
    try {
      const response = await axios.post(`${API}/admin/bulk-diagnose-all?dry_run=${dryRun}&limit=100`, {}, {
        timeout: 60000 // 60 second timeout
      });
      setBulkFixResult(response.data);
      if (dryRun) {
        toast.info(`Found ${response.data.summary?.total_issues_found || 0} issues in ${response.data.summary?.users_with_issues || 0} users`);
      } else {
        toast.success(`Fixed ${response.data.summary?.total_issues_fixed || 0} issues!`);
        fetchDashboardData(true); // Refresh stats
      }
    } catch (error) {
      console.error('Bulk fix error:', error);
      if (error.code === 'ECONNABORTED') {
        toast.error('Request timed out. Try with fewer users or run again.');
      } else {
        toast.error(error.response?.data?.detail || error.message || 'Bulk fix failed');
      }
    } finally {
      setBulkFixing(false);
    }
  };

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      // Single combined API call + parallel secondary calls
      const [statsRes, deliveryRes, kycRes] = await Promise.all([
        axios.get(`${API}/admin/stats`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/delivery-partners/stats`).catch(() => ({ data: {} })),
        axios.get(`${API}/kyc/list?limit=10&status=pending`).catch(() => ({ data: [] }))
      ]);
      
      setStats(statsRes.data);
      setDeliveryStats(deliveryRes.data);
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

  // Skeleton Loading State - BULKPE STYLE
  if (loading && !stats) {
    return (
      <div className="space-y-6" data-testid="admin-dashboard-loading">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-slate-200 rounded w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-slate-200 rounded w-32 animate-pulse"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse"></div>
            <div className="w-24 h-9 bg-slate-200 rounded-xl animate-pulse"></div>
          </div>
        </div>
        
        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        
        {/* Subscription Overview Skeleton */}
        <div className="grid grid-cols-4 gap-4">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
        
        {/* KYC & PRC Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SkeletonCard className="h-44" />
          <SkeletonCard className="h-44" />
        </div>
        
        {/* Quick Actions Skeleton */}
        <SkeletonCard className="h-36" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      {/* Header - BULKPE STYLE */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm">Welcome back, {user?.name || 'Admin'}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Bulk Fix All Users Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              if (bulkFixJob && bulkFixJob.status === 'running') {
                toast.info(`Job running: ${bulkFixJob.progress}% complete`);
              } else if (confirm('Start bulk fix for ALL users? This runs in background.')) {
                startBulkFixJob();
              }
            }}
            disabled={bulkFixing || (bulkFixJob && bulkFixJob.status === 'running')}
            className={`rounded-xl ${bulkFixJob && bulkFixJob.status === 'running' ? 'text-blue-600 border-blue-200 bg-blue-50 animate-pulse' : 'text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100'}`}
          >
            <Zap className={`w-4 h-4 mr-2 ${bulkFixing || (bulkFixJob && bulkFixJob.status === 'running') ? 'animate-spin' : ''}`} />
            {bulkFixJob && bulkFixJob.status === 'running' 
              ? `Fixing... ${bulkFixJob.progress || 0}%` 
              : 'Auto Fix All'}
          </Button>
          {/* Login As User Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowLoginAsUser(true)}
            className="text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100 rounded-xl"
          >
            <UserCog className="w-4 h-4 mr-2" />
            Login As User
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="text-slate-600 border-slate-200 bg-white hover:bg-slate-50 rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <div className="px-4 py-2 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-emerald-100">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Admin
          </div>
        </div>
      </div>

      {/* Action Required Alert - BULKPE STYLE */}
      {(stats?.kyc?.pending > 0 || stats?.subscription_payments?.pending > 0 || stats?.vip_payments?.pending > 0) && (
        <Card className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-700 mb-2">Action Required</h3>
              <div className="flex flex-wrap gap-4">
                {stats?.kyc?.pending > 0 && (
                  <button onClick={() => navigate('/admin/kyc')} className="text-sm text-amber-600 hover:text-amber-800 flex items-center gap-1 font-medium">
                    <UserCheck className="w-4 h-4" /> {stats.kyc.pending} KYC Pending <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {stats?.vip_payments?.pending > 0 && (
                  <button onClick={() => navigate('/admin/subscriptions')} className="text-sm text-amber-600 hover:text-amber-800 flex items-center gap-1 font-medium">
                    <CreditCard className="w-4 h-4" /> {stats.vip_payments.pending} Payments Pending <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Bulk Fix Results Panel - BULKPE STYLE */}
      {(bulkFixJob || bulkFixResult) && (
        <Card className={`p-5 rounded-2xl shadow-sm ${
          bulkFixJob?.status === 'running' ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200' :
          bulkFixJob?.status === 'completed' ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' :
          bulkFixResult?.dry_run ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200' : 
          'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2 rounded-xl ${
                bulkFixJob?.status === 'running' ? 'bg-blue-100' :
                bulkFixJob?.status === 'completed' ? 'bg-green-100' :
                bulkFixResult?.dry_run ? 'bg-purple-100' : 'bg-green-100'
              }`}>
                <Zap className={`w-5 h-5 ${
                  bulkFixJob?.status === 'running' ? 'text-blue-600 animate-pulse' :
                  bulkFixJob?.status === 'completed' ? 'text-green-600' :
                  bulkFixResult?.dry_run ? 'text-purple-600' : 'text-green-600'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className={`text-sm font-bold mb-2 ${
                  bulkFixJob?.status === 'running' ? 'text-blue-700' :
                  bulkFixJob?.status === 'completed' ? 'text-green-700' :
                  bulkFixResult?.dry_run ? 'text-purple-700' : 'text-green-700'
                }`}>
                  {bulkFixJob?.status === 'running' ? 'Bulk Fix Running...' :
                   bulkFixJob?.status === 'completed' ? 'Bulk Fix Completed' :
                   bulkFixResult?.dry_run ? 'Issues Found (Preview)' : 'Issues Fixed'}
                </h3>
                
                {/* Progress Bar for Running Job */}
                {bulkFixJob?.status === 'running' && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Processing {bulkFixJob.processed || 0} of {bulkFixJob.total_users} users</span>
                      <span>{bulkFixJob.progress || 0}%</span>
                    </div>
                    <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                        style={{ width: `${bulkFixJob.progress || 0}%` }}
                      />
                    </div>
                    <p className="text-slate-500 text-xs mt-1">Fixed: {bulkFixJob.issues_fixed || 0} issues | PRC Refunded: {bulkFixJob.prc_refunded || 0}</p>
                  </div>
                )}
                
                {/* Completed Job Results */}
                {bulkFixJob?.status === 'completed' && bulkFixJob.results && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Users Processed</p>
                      <p className="text-slate-800 font-bold">{bulkFixJob.results.processed || 0}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Users Fixed</p>
                      <p className="text-slate-800 font-bold">{bulkFixJob.results.users_with_issues || 0}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Issues Fixed</p>
                      <p className="text-slate-800 font-bold">{bulkFixJob.results.issues_fixed || 0}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">PRC Refunded</p>
                      <p className="text-green-600 font-bold">{bulkFixJob.results.prc_refunded || 0} PRC</p>
                    </div>
                  </div>
                )}
                
                {/* Preview Results (old system) */}
                {bulkFixResult && !bulkFixJob && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Users Scanned</p>
                        <p className="text-slate-800 font-bold">{bulkFixResult.summary?.total_users_scanned || 0}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Users with Issues</p>
                        <p className="text-slate-800 font-bold">{bulkFixResult.summary?.users_with_issues || 0}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Total Issues</p>
                        <p className="text-slate-800 font-bold">{bulkFixResult.summary?.total_issues_found || 0}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">PRC Refunded</p>
                        <p className="text-green-600 font-bold">{bulkFixResult.summary?.total_prc_refunded || 0} PRC</p>
                      </div>
                    </div>
                    {bulkFixResult.affected_users?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-slate-500 text-xs mb-2">Affected Users:</p>
                        <div className="flex flex-wrap gap-2">
                          {bulkFixResult.affected_users.slice(0, 5).map((u, idx) => (
                            <span key={idx} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-600">
                              {u.name || u.email?.split('@')[0]}
                            </span>
                          ))}
                          {bulkFixResult.affected_users.length > 5 && (
                            <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs text-slate-500">
                              +{bulkFixResult.affected_users.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <button 
              onClick={() => { setBulkFixResult(null); setBulkFixJob(null); }} 
              className="text-slate-400 hover:text-slate-600"
              disabled={bulkFixJob?.status === 'running'}
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </Card>
      )}

      {/* Hero Stats - Large Cards - BULKPE STYLE */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
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
      </div>

      {/* Subscription Breakdown - BULKPE STYLE */}
      <Card className="p-6 bg-white border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            Subscription Overview
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/subscriptions')} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-xl">
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
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div 
            className="text-center p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors duration-200"
            onClick={() => navigate('/admin/finance')}
          >
            <p className="text-2xl font-bold text-emerald-600">₹{(stats?.revenue?.vip_fees || 0).toLocaleString()}</p>
            <p className="text-xs text-slate-500 font-medium">Subscription Revenue</p>
          </div>
          <div 
            className="text-center p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors duration-200"
            onClick={() => navigate('/admin/ledger')}
          >
            <p className="text-2xl font-bold text-blue-600">📒</p>
            <p className="text-xs text-slate-500 font-medium">Ledger View</p>
          </div>
          <div 
            className="text-center p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors duration-200"
            onClick={() => navigate('/admin/subscriptions?tab=approved')}
          >
            <p className="text-2xl font-bold text-purple-600">{stats?.vip_payments?.approved || 0}</p>
            <p className="text-xs text-slate-500 font-medium">Approved Payments</p>
          </div>
          <div 
            className="text-center p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors duration-200"
            onClick={() => navigate('/admin/subscriptions?tab=pending')}
          >
            <p className="text-2xl font-bold text-amber-600">{stats?.vip_payments?.pending || 0}</p>
            <p className="text-xs text-slate-500 font-medium">Pending Approval</p>
          </div>
        </div>
      </Card>

      {/* KYC & Verification Stats - BULKPE STYLE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="p-6 bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <div className="p-2 bg-cyan-100 rounded-xl">
                <BadgeCheck className="w-5 h-5 text-cyan-600" />
              </div>
              KYC Verification
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/kyc')} className="text-cyan-600 hover:text-cyan-700 hover:bg-cyan-100 rounded-xl">
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

        <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-xl">
                <Wallet className="w-5 h-5 text-purple-600" />
              </div>
              PRC Economy
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/prc-economy')} className="text-purple-600 hover:text-purple-700 hover:bg-purple-100 rounded-xl">
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

      {/* Quick Actions Grid - BULKPE STYLE */}
      <Card className="p-5 bg-white border-slate-200 rounded-2xl shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <div className="p-2 bg-yellow-100 rounded-xl">
            <Zap className="w-5 h-5 text-yellow-600" />
          </div>
          Quick Actions
        </h3>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
          <QuickActionCard icon={Users} label="Users" color="blue" onClick={() => navigate('/admin/users')} />
          <QuickActionCard icon={Crown} label="Subs" badge={stats?.vip_payments?.pending} color="purple" onClick={() => navigate('/admin/subscriptions')} />
          <QuickActionCard icon={BadgeCheck} label="KYC" badge={stats?.kyc?.pending} color="cyan" onClick={() => navigate('/admin/kyc')} />
          <QuickActionCard icon={Wallet} label="Wallets" color="teal" onClick={() => navigate('/admin/company-wallets')} />
          <QuickActionCard icon={Shield} label="Security" color="red" onClick={() => navigate('/admin/security')} />
          <QuickActionCard icon={AlertTriangle} label="PRC Ctrl" color="orange" onClick={() => navigate('/admin/prc-economy')} />
          <QuickActionCard icon={Settings} label="Settings" color="gray" onClick={() => navigate('/admin/settings/system')} />
        </div>
      </Card>

      {/* KYC & Activity Section - BULKPE STYLE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending KYC Preview */}
        <Card className="p-5 bg-white border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <div className="p-2 bg-cyan-100 rounded-xl">
                <BadgeCheck className="w-5 h-5 text-cyan-600" />
              </div>
              Pending KYC Verifications
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/kyc')} className="text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-xl">
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          {pendingKYC.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-slate-500 text-sm font-medium">All KYC verified!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingKYC.slice(0, 3).map((kyc) => (
                <div key={kyc.document_id || kyc._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-cyan-600" />
                    </div>
                    <span className="text-slate-800 text-sm font-medium">{kyc.user_name || 'Unknown'}</span>
                  </div>
                  <span className="text-slate-500 text-xs px-3 py-1 bg-white border border-slate-200 rounded-lg">{kyc.document_type || 'Document'}</span>
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
// Hero Stat Card Component - BULKPE STYLE
const HeroStatCard = ({ icon: Icon, label, value, subValue, color, onClick }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50',
    purple: 'bg-purple-50 border-purple-100 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-100/50',
    emerald: 'bg-emerald-50 border-emerald-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50',
    amber: 'bg-orange-50 border-orange-100 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-100/50',
  };
  
  const iconColors = {
    blue: 'text-blue-600 bg-blue-100',
    purple: 'text-purple-600 bg-purple-100',
    emerald: 'text-emerald-600 bg-emerald-100',
    amber: 'text-orange-600 bg-orange-100',
  };

  const textColors = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    emerald: 'text-emerald-600',
    amber: 'text-orange-600',
  };

  return (
    <Card 
      className={`p-5 ${colorClasses[color]} rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-1`}
      onClick={onClick}
      data-testid={`hero-stat-${label.toLowerCase().replace(' ', '-')}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs font-medium mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-800">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          <p className={`text-xs ${textColors[color]} mt-1 font-medium`}>{subValue}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${iconColors[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
};

// Subscription Card Component - BULKPE STYLE
const SubscriptionCard = ({ plan, count, total, color, icon, onClick, price }) => {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  
  const colorClasses = {
    gray: { bg: 'bg-slate-100', bar: 'bg-slate-400', text: 'text-slate-500', border: 'border-slate-200' },
    blue: { bg: 'bg-blue-100', bar: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-200' },
    purple: { bg: 'bg-purple-100', bar: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-200' },
    amber: { bg: 'bg-orange-100', bar: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-200' },
  };

  return (
    <div 
      className={`p-4 bg-white rounded-xl border ${colorClasses[color].border} ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
        <span className={`text-xs font-semibold ${colorClasses[color].text}`}>{percentage}%</span>
      </div>
      <p className="text-xl font-bold text-slate-800">{count.toLocaleString()}</p>
      <p className="text-xs text-slate-500 font-medium">{plan}</p>
      {price && <p className={`text-xs ${colorClasses[color].text} mt-1`}>{price}</p>}
      <div className={`h-1.5 ${colorClasses[color].bg} rounded-full overflow-hidden mt-3`}>
        <div 
          className={`h-full ${colorClasses[color].bar} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Mini Stat Card Component - BULKPE STYLE
const MiniStatCard = ({ value, label, color, highlight }) => {
  const colorClasses = {
    gray: 'text-slate-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  };

  return (
    <div className={`text-center p-3 rounded-xl ${highlight ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
      <p className={`text-xl font-bold ${colorClasses[color]}`}>{value}</p>
      <p className="text-[10px] text-slate-500 font-medium">{label}</p>
    </div>
  );
};

// Quick Action Card Component - BULKPE STYLE
const QuickActionCard = ({ icon: Icon, label, badge, color, onClick }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-100 hover:bg-blue-100 text-blue-600',
    purple: 'bg-purple-50 border-purple-100 hover:bg-purple-100 text-purple-600',
    emerald: 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-50 border-amber-100 hover:bg-amber-100 text-amber-600',
    cyan: 'bg-cyan-50 border-cyan-100 hover:bg-cyan-100 text-cyan-600',
    pink: 'bg-pink-50 border-pink-100 hover:bg-pink-100 text-pink-600',
    teal: 'bg-teal-50 border-teal-100 hover:bg-teal-100 text-teal-600',
    red: 'bg-red-50 border-red-100 hover:bg-red-100 text-red-600',
    orange: 'bg-orange-50 border-orange-100 hover:bg-orange-100 text-orange-600',
    gray: 'bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-600',
  };

  return (
    <button
      onClick={onClick}
      className={`relative p-3 rounded-xl border transition-all duration-200 ${colorClasses[color]} text-center hover:scale-105 active:scale-95`}
      data-testid={`quick-action-${label.toLowerCase()}`}
    >
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-slate-800 text-[10px] rounded-full flex items-center justify-center font-bold shadow-sm">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <Icon className="w-5 h-5 mx-auto mb-1" />
      <p className="text-[10px] font-semibold truncate">{label}</p>
    </button>
  );
};

export default AdminDashboard;
