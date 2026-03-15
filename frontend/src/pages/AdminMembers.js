import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  Users, UserCheck, UserX, TrendingUp, Crown, Search, Filter,
  Calendar, ChevronDown, Eye, ArrowUpRight, ArrowDownRight,
  RefreshCw, Download, Shield, Clock, MapPin, Award
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Subscription plan colors
const planColors = {
  explorer: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  startup: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  growth: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  elite: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' }
};

// KYC status colors
const kycColors = {
  pending: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  submitted: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  verified: { bg: 'bg-green-500/20', text: 'text-green-400' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400' }
};

const AdminMembers = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  
  // Filters
  const [period, setPeriod] = useState('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [subscriptionFilter, setSubscriptionFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const params = { period };
      if (period === 'custom' && dateFrom) params.date_from = dateFrom;
      if (period === 'custom' && dateTo) params.date_to = dateTo;
      
      const res = await axios.get(`${API}/api/admin/members/dashboard`, { params });
      setDashboard(res.data);
    } catch (error) {
      toast.error('Failed to load dashboard');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo]);

  // Fetch members list
  const fetchMembers = useCallback(async () => {
    try {
      setMembersLoading(true);
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (subscriptionFilter) params.subscription = subscriptionFilter;
      if (kycFilter) params.kyc_status = kycFilter;
      if (activeFilter !== '') params.is_active = activeFilter === 'active';
      
      const res = await axios.get(`${API}/api/admin/members/list`, { params });
      setMembers(res.data.members);
      setPagination(res.data.pagination);
    } catch (error) {
      toast.error('Failed to load members');
      console.error(error);
    } finally {
      setMembersLoading(false);
    }
  }, [page, search, subscriptionFilter, kycFilter, activeFilter]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Stats Card Component
  const StatsCard = ({ icon: Icon, title, value, subtitle, color, trend }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-5`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-white">{value?.toLocaleString() || 0}</p>
        <p className="text-gray-400 text-sm mt-1">{title}</p>
        {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
      </div>
    </motion.div>
  );

  // Period selector
  const PeriodSelector = () => (
    <div className="flex flex-wrap gap-2 items-center">
      {['today', 'week', 'month', 'year', 'custom'].map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            period === p
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          {p === 'today' ? 'Today' : 
           p === 'week' ? 'This Week' : 
           p === 'month' ? 'This Month' : 
           p === 'year' ? 'This Year' : 'Custom'}
        </button>
      ))}
      {period === 'custom' && (
        <div className="flex gap-2 ml-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          />
          <span className="text-gray-400 self-center">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Members Dashboard</h1>
            <p className="text-gray-400 mt-1">Comprehensive member analytics</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchDashboard}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="mb-6">
          <PeriodSelector />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatsCard
            icon={Users}
            title="Total Members"
            value={dashboard?.summary?.total_members}
            color="bg-blue-600"
          />
          <StatsCard
            icon={UserCheck}
            title="Active Members"
            value={dashboard?.summary?.active_members}
            subtitle={`${((dashboard?.summary?.active_members / dashboard?.summary?.total_members) * 100 || 0).toFixed(1)}% of total`}
            color="bg-green-600"
          />
          <StatsCard
            icon={TrendingUp}
            title="New This Month"
            value={dashboard?.new_joinings?.this_month}
            trend={dashboard?.new_joinings?.growth_rate}
            color="bg-purple-600"
          />
          <StatsCard
            icon={Clock}
            title="Expiring Soon"
            value={dashboard?.expiring_subscriptions?.next_7_days}
            subtitle="Next 7 days"
            color="bg-orange-600"
          />
        </div>

        {/* Subscription Plans Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="px-3 py-1 bg-gray-600/30 text-gray-300 rounded-full text-sm font-medium">EXPLORER</span>
            </div>
            <p className="text-3xl font-bold text-white">{dashboard?.subscription_breakdown?.explorer?.count || 0}</p>
            <p className="text-gray-500 text-sm mt-1">Free members</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-900/50 to-blue-950/50 border border-blue-700/50 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="px-3 py-1 bg-blue-600/30 text-blue-300 rounded-full text-sm font-medium">STARTUP (Discontinued)</span>
            </div>
            <p className="text-3xl font-bold text-white">{dashboard?.subscription_breakdown?.startup?.count || 0}</p>
            <p className="text-blue-400/70 text-sm mt-1">Legacy users</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-amber-900/50 to-amber-950/50 border border-amber-700/50 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="px-3 py-1 bg-amber-600/30 text-amber-300 rounded-full text-sm font-medium">ELITE</span>
            </div>
            <p className="text-3xl font-bold text-white">{dashboard?.subscription_breakdown?.elite?.count || 0}</p>
            <p className="text-amber-400/70 text-sm mt-1">₹799/month</p>
          </motion.div>
        </div>

        {/* New Joinings Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gradient-to-br from-emerald-900/50 to-emerald-950/50 border border-emerald-800/50 rounded-2xl p-5"
          >
            <h3 className="text-emerald-400 font-semibold mb-3">Today's Joinings</h3>
            <p className="text-4xl font-bold text-white">{dashboard?.new_joinings?.today || 0}</p>
            <p className="text-emerald-400/70 text-sm mt-2">New members today</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-900/50 to-blue-950/50 border border-blue-800/50 rounded-2xl p-5"
          >
            <h3 className="text-blue-400 font-semibold mb-3">This Week</h3>
            <p className="text-4xl font-bold text-white">{dashboard?.new_joinings?.this_week || 0}</p>
            <p className="text-blue-400/70 text-sm mt-2">New members this week</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-900/50 to-purple-950/50 border border-purple-800/50 rounded-2xl p-5"
          >
            <h3 className="text-purple-400 font-semibold mb-3">This Month</h3>
            <p className="text-4xl font-bold text-white">{dashboard?.new_joinings?.this_month || 0}</p>
            <div className="flex items-center gap-2 mt-2">
              {dashboard?.new_joinings?.growth_rate >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-400" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-400" />
              )}
              <span className={dashboard?.new_joinings?.growth_rate >= 0 ? 'text-green-400' : 'text-red-400'}>
                {Math.abs(dashboard?.new_joinings?.growth_rate || 0)}% vs last month
              </span>
            </div>
          </motion.div>
        </div>

        {/* Subscription & KYC Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Subscription Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5"
          >
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              Subscription Plans
            </h3>
            <div className="space-y-3">
              {Object.entries(dashboard?.subscription_breakdown || {}).map(([plan, data]) => {
                const colors = planColors[plan] || planColors.explorer;
                const percentage = ((data.count / dashboard?.summary?.total_members) * 100 || 0).toFixed(1);
                return (
                  <div key={plan} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                        {plan.charAt(0).toUpperCase() + plan.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 text-sm">{percentage}%</span>
                      <span className="text-white font-semibold w-16 text-right">{data.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* KYC Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5"
          >
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              KYC Status
            </h3>
            <div className="space-y-3">
              {Object.entries(dashboard?.kyc_breakdown || {}).map(([status, count]) => {
                const colors = kycColors[status] || kycColors.pending;
                const percentage = ((count / dashboard?.summary?.total_members) * 100 || 0).toFixed(1);
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 text-sm">{percentage}%</span>
                      <span className="text-white font-semibold w-16 text-right">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* State Distribution & Top Earners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* State Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5"
          >
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-400" />
              Top States
            </h3>
            <div className="space-y-2">
              {dashboard?.state_distribution?.slice(0, 8).map((state, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                  <span className="text-gray-300">{state.state || 'Unknown'}</span>
                  <span className="text-white font-semibold">{state.count}</span>
                </div>
              ))}
              {(!dashboard?.state_distribution || dashboard.state_distribution.length === 0) && (
                <p className="text-gray-500 text-center py-4">No state data available</p>
              )}
            </div>
          </motion.div>

          {/* Top Earners */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5"
          >
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Top Earners
            </h3>
            <div className="space-y-2">
              {dashboard?.top_earners?.slice(0, 8).map((user, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0 cursor-pointer hover:bg-gray-800/30 rounded-lg px-2 -mx-2 transition-colors"
                  onClick={() => navigate(`/admin/user-360?uid=${user.uid}`)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500 text-black' :
                      idx === 1 ? 'bg-gray-400 text-black' :
                      idx === 2 ? 'bg-orange-600 text-white' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-gray-300 text-sm">{user.name || 'Unknown'}</p>
                      <p className="text-gray-500 text-xs">{user.email}</p>
                    </div>
                  </div>
                  <span className="text-green-400 font-semibold">{(user.prc_balance || 0).toFixed(2)} PRC</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Members List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h3 className="text-white font-semibold text-lg">All Members</h3>
            
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm w-48 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  showFilters ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-3 mb-4 p-4 bg-gray-800/50 rounded-xl"
            >
              <select
                value={subscriptionFilter}
                onChange={(e) => { setSubscriptionFilter(e.target.value); setPage(1); }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">All Plans</option>
                <option value="explorer">Explorer</option>
                <option value="startup">Startup</option>
                <option value="elite">Elite</option>
              </select>
              
              <select
                value={kycFilter}
                onChange={(e) => { setKycFilter(e.target.value); setPage(1); }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">All KYC Status</option>
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
              
              <select
                value={activeFilter}
                onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              
              <button
                onClick={() => {
                  setSubscriptionFilter('');
                  setKycFilter('');
                  setActiveFilter('');
                  setSearch('');
                  setPage(1);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
              >
                Clear All
              </button>
            </motion.div>
          )}

          {/* Members Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Member</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">PRC Balance</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Redeem Limit</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Used</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Available</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Joined</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {membersLoading ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-gray-400">
                      No members found
                    </td>
                  </tr>
                ) : (
                  members.map((member) => {
                    const redeemLimit = member.redeem_limit || {};
                    const totalLimit = redeemLimit.total_limit || 0;
                    const usedLimit = redeemLimit.total_redeemed || 0;
                    const availableLimit = redeemLimit.remaining_limit || (totalLimit - usedLimit);
                    
                    return (
                      <tr 
                        key={member.uid} 
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div 
                            className="cursor-pointer hover:text-blue-400 transition-colors"
                            onClick={() => navigate(`/admin/user-360?uid=${member.uid}`)}
                          >
                            <p className="text-white font-medium hover:text-blue-400">{member.name || 'Unknown'}</p>
                            <p className="text-gray-500 text-sm">{member.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-green-400 font-medium">
                            {(member.prc_balance || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-white font-medium">
                            {totalLimit.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-yellow-400 font-medium">
                            {usedLimit.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`font-medium ${availableLimit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {availableLimit.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-sm">
                          {member.created_at ? new Date(member.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            member.is_active !== false 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {member.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
              <p className="text-gray-400 text-sm">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-400">
                  Page {page} of {pagination.total_pages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                  disabled={page >= pagination.total_pages}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminMembers;
