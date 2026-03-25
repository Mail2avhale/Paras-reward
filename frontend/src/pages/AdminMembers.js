import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, UserCheck, UserX, TrendingUp, Crown, Search, Filter,
  Calendar, ChevronDown, ChevronUp, Eye, ArrowUpRight, ArrowDownRight,
  RefreshCw, Download, Shield, Clock, MapPin, Award, X, Phone, Mail,
  SlidersHorizontal, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Subscription plan colors
const planColors = {
  explorer: { bg: 'bg-gray-500/20', text: 'text-slate-500', border: 'border-gray-500/30' },
  startup: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  growth: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  elite: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' }
};

// KYC status colors
const kycColors = {
  pending: { bg: 'bg-gray-500/20', text: 'text-slate-500' },
  submitted: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  verified: { bg: 'bg-green-500/20', text: 'text-green-400' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400' }
};

// Debounce hook for search
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
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
  
  // Member list date filters
  const [memberDateFrom, setMemberDateFrom] = useState('');
  const [memberDateTo, setMemberDateTo] = useState('');
  
  // Sorting state
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Debounced search
  const debouncedSearch = useDebounce(search, 300);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (subscriptionFilter) count++;
    if (kycFilter) count++;
    if (activeFilter) count++;
    if (memberDateFrom) count++;
    if (memberDateTo) count++;
    return count;
  }, [subscriptionFilter, kycFilter, activeFilter, memberDateFrom, memberDateTo]);

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
      const params = { 
        page, 
        limit: 20,
        sort_by: sortField,
        sort_order: sortDirection
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (subscriptionFilter) params.subscription = subscriptionFilter;
      if (kycFilter) params.kyc_status = kycFilter;
      if (activeFilter !== '') params.is_active = activeFilter === 'active';
      if (memberDateFrom) params.date_from = memberDateFrom;
      if (memberDateTo) params.date_to = memberDateTo;
      
      const res = await axios.get(`${API}/api/admin/members/list`, { params });
      setMembers(res.data.members);
      setPagination(res.data.pagination);
    } catch (error) {
      toast.error('Failed to load members');
      console.error(error);
    } finally {
      setMembersLoading(false);
    }
  }, [page, debouncedSearch, subscriptionFilter, kycFilter, activeFilter, sortField, sortDirection, memberDateFrom, memberDateTo]);
  
  // Handle column sort
  const handleSort = (field) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortField('created_at');
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };
  
  // Clear all filters
  const clearAllFilters = () => {
    setSubscriptionFilter('');
    setKycFilter('');
    setActiveFilter('');
    setMemberDateFrom('');
    setMemberDateTo('');
    setSearch('');
    setSortField('created_at');
    setSortDirection('desc');
    setPage(1);
  };
  
  // Sort icon component
  const SortIcon = ({ field }) => {
    const isActive = sortField === field;
    if (!isActive) {
      return (
        <div className="flex flex-col items-center opacity-30 hover:opacity-60 transition-opacity">
          <ChevronUp className="w-3 h-3 -mb-1" />
          <ChevronDown className="w-3 h-3 -mt-1" />
        </div>
      );
    }
    return (
      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isActive ? 'bg-blue-500/20' : ''}`}>
        {sortDirection === 'asc' ? (
          <ArrowUpRight className="w-4 h-4 text-blue-400" />
        ) : (
          <ArrowDownRight className="w-4 h-4 text-blue-400" />
        )}
      </div>
    );
  };
  
  // Sortable column header component
  const SortableHeader = ({ field, children, testId }) => (
    <th 
      className={`text-left py-3 px-2 md:px-4 font-medium text-xs md:text-sm cursor-pointer transition-colors whitespace-nowrap ${
        sortField === field 
          ? 'text-blue-400 bg-blue-500/5' 
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
      }`}
      onClick={() => handleSort(field)}
      data-testid={testId}
    >
      <div className="flex items-center gap-1 md:gap-2">
        {children}
        <SortIcon field={field} />
      </div>
    </th>
  );

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
      className={`bg-white backdrop-blur-sm border border-slate-200 rounded-2xl p-4 md:p-5`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2 md:p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 md:w-6 md:h-6 text-slate-800" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs md:text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4" /> : <ArrowDownRight className="w-3 h-3 md:w-4 md:h-4" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-3 md:mt-4">
        <p className="text-2xl md:text-3xl font-bold text-slate-800">{value?.toLocaleString() || 0}</p>
        <p className="text-slate-500 text-xs md:text-sm mt-1">{title}</p>
        {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
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
          className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
            period === p
              ? 'bg-purple-600 text-slate-800'
              : 'bg-white text-slate-500 hover:bg-slate-100'
          }`}
        >
          {p === 'today' ? 'Today' : 
           p === 'week' ? 'Week' : 
           p === 'month' ? 'Month' : 
           p === 'year' ? 'Year' : 'Custom'}
        </button>
      ))}
      {period === 'custom' && (
        <div className="flex gap-2 mt-2 md:mt-0 md:ml-2 w-full md:w-auto">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-slate-800 text-xs md:text-sm flex-1 md:flex-none"
          />
          <span className="text-slate-500 self-center text-xs md:text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-slate-800 text-xs md:text-sm flex-1 md:flex-none"
          />
        </div>
      )}
    </div>
  );

  // Filter Chip Component
  const FilterChip = ({ label, value, onClear }) => (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">
      {label}: {value}
      <button onClick={onClear} className="hover:text-slate-800">
        <X className="w-3 h-3" />
      </button>
    </span>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-3 md:p-6" data-testid="admin-members-page">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 md:mb-6">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-slate-800">Members Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">Comprehensive member analytics</p>
          </div>
          <div className="flex gap-2 md:gap-3">
            <button
              onClick={fetchDashboard}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white hover:bg-slate-100 rounded-lg text-slate-800 text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden md:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="mb-4 md:mb-6">
          <PeriodSelector />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
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

        {/* State Distribution & Top Earners - Collapsible on Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
          {/* State Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5"
          >
            <h3 className="text-slate-800 font-semibold mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base">
              <MapPin className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
              Top States
            </h3>
            <div className="space-y-2">
              {dashboard?.state_distribution?.slice(0, 6).map((state, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 md:py-2 border-b border-slate-200/50 last:border-0">
                  <span className="text-slate-600 text-sm">{state.state || 'Unknown'}</span>
                  <span className="text-slate-800 font-semibold text-sm">{state.count}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Top Earners */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5"
          >
            <h3 className="text-slate-800 font-semibold mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base">
              <Award className="w-4 h-4 md:w-5 md:h-5 text-amber-400" />
              Top Earners
            </h3>
            <div className="space-y-2">
              {dashboard?.top_earners?.slice(0, 8).map((user, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between py-1.5 md:py-2 border-b border-slate-200/50 last:border-0 cursor-pointer hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors"
                  onClick={() => navigate(`/admin/user-360?uid=${user.uid}`)}
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <span className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500 text-black' :
                      idx === 1 ? 'bg-gray-400 text-black' :
                      idx === 2 ? 'bg-orange-600 text-slate-800' :
                      'bg-gray-700 text-slate-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-slate-600 text-xs md:text-sm truncate max-w-[120px] md:max-w-none">{user.name || 'Unknown'}</p>
                      <p className="text-slate-500 text-xs hidden md:block">{user.email}</p>
                    </div>
                  </div>
                  <span className="text-green-400 font-semibold text-xs md:text-sm">{(user.prc_balance || 0).toFixed(0)} PRC</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Members List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white border border-slate-200 rounded-2xl p-3 md:p-5"
        >
          {/* Header & Search */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-slate-800 font-semibold text-base md:text-lg">All Members</h3>
              <span className="text-slate-500 text-xs md:text-sm">
                {pagination?.total?.toLocaleString() || 0} members
              </span>
            </div>
            
            {/* Search Bar - Full Width on Mobile */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name, email, mobile..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
                data-testid="member-search-input"
              />
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-purple-600 text-slate-800' 
                    : 'bg-white text-slate-500 hover:bg-slate-100'
                }`}
                data-testid="toggle-filters-btn"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs">{activeFiltersCount}</span>
                )}
              </button>
              
              {/* Active Filter Chips */}
              {subscriptionFilter && (
                <FilterChip 
                  label="Plan" 
                  value={subscriptionFilter} 
                  onClear={() => setSubscriptionFilter('')} 
                />
              )}
              {kycFilter && (
                <FilterChip 
                  label="KYC" 
                  value={kycFilter} 
                  onClear={() => setKycFilter('')} 
                />
              )}
              {activeFilter && (
                <FilterChip 
                  label="Status" 
                  value={activeFilter} 
                  onClear={() => setActiveFilter('')} 
                />
              )}
              {(memberDateFrom || memberDateTo) && (
                <FilterChip 
                  label="Date" 
                  value={`${memberDateFrom || 'Start'} - ${memberDateTo || 'End'}`} 
                  onClear={() => { setMemberDateFrom(''); setMemberDateTo(''); }} 
                />
              )}
              
              {/* Reset All Button */}
              {(activeFiltersCount > 0 || sortField !== 'created_at' || search) && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-slate-800 text-xs"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Expanded Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 mb-4 p-3 md:p-4 bg-slate-50 rounded-xl">
                  <select
                    value={subscriptionFilter}
                    onChange={(e) => { setSubscriptionFilter(e.target.value); setPage(1); }}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm"
                    data-testid="filter-subscription"
                  >
                    <option value="">All Plans</option>
                    <option value="explorer">Explorer</option>
                    <option value="startup">Startup</option>
                    <option value="growth">Growth</option>
                    <option value="elite">Elite</option>
                  </select>
                  
                  <select
                    value={kycFilter}
                    onChange={(e) => { setKycFilter(e.target.value); setPage(1); }}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm"
                    data-testid="filter-kyc"
                  >
                    <option value="">All KYC</option>
                    <option value="pending">Pending</option>
                    <option value="submitted">Submitted</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  
                  <select
                    value={activeFilter}
                    onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm"
                    data-testid="filter-status"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  
                  <input
                    type="date"
                    value={memberDateFrom}
                    onChange={(e) => { setMemberDateFrom(e.target.value); setPage(1); }}
                    placeholder="From Date"
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm"
                    data-testid="filter-date-from"
                  />
                  
                  <input
                    type="date"
                    value={memberDateTo}
                    onChange={(e) => { setMemberDateTo(e.target.value); setPage(1); }}
                    placeholder="To Date"
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm"
                    data-testid="filter-date-to"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sort Indicator */}
          {sortField !== 'created_at' && (
            <div className="mb-3 flex items-center gap-2 text-xs md:text-sm">
              <span className="text-slate-500">Sorted by:</span>
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg font-medium">
                {sortField === 'prc_balance' ? 'PRC Balance' :
                 sortField === 'redeem_limit' ? 'Redeem Limit' :
                 sortField === 'used_limit' ? 'Used' :
                 sortField === 'available_limit' ? 'Available' :
                 sortField}
                {sortDirection === 'asc' ? ' ↑' : ' ↓'}
              </span>
              <button
                onClick={() => { setSortField('created_at'); setSortDirection('desc'); }}
                className="text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Members Table */}
          <div className="overflow-x-auto -mx-3 md:mx-0">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-2 md:px-4 text-slate-500 font-medium text-xs md:text-sm" data-testid="header-member">Member</th>
                  <SortableHeader field="prc_balance" testId="header-prc-balance">
                    PRC
                  </SortableHeader>
                  <SortableHeader field="redeem_limit" testId="header-redeem-limit">
                    Limit
                  </SortableHeader>
                  <SortableHeader field="used_limit" testId="header-used-limit">
                    Used
                  </SortableHeader>
                  <SortableHeader field="available_limit" testId="header-available-limit">
                    Avail
                  </SortableHeader>
                  <SortableHeader field="created_at" testId="header-joined-date">
                    Joined
                  </SortableHeader>
                  <th className="text-left py-3 px-2 md:px-4 text-slate-500 font-medium text-xs md:text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {membersLoading ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500">
                      {search || activeFiltersCount > 0 ? (
                        <div>
                          <p>No members found matching your filters</p>
                          <button 
                            onClick={clearAllFilters}
                            className="text-purple-400 hover:text-purple-300 text-sm mt-2"
                          >
                            Clear all filters
                          </button>
                        </div>
                      ) : (
                        'No members found'
                      )}
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
                        className="border-b border-slate-200/50 hover:bg-slate-50 transition-colors"
                        data-testid={`member-row-${member.uid}`}
                      >
                        <td className="py-2 md:py-3 px-2 md:px-4">
                          <div 
                            className="cursor-pointer hover:text-blue-400 transition-colors"
                            onClick={() => navigate(`/admin/user-360?uid=${member.uid}`)}
                          >
                            <p className="text-slate-800 font-medium text-sm hover:text-blue-400 truncate max-w-[140px] md:max-w-none">
                              {member.name || 'Unknown'}
                            </p>
                            <p className="text-slate-500 text-xs truncate max-w-[140px] md:max-w-none">{member.email}</p>
                            <p className="text-gray-600 text-xs md:hidden">{member.mobile}</p>
                          </div>
                        </td>
                        <td className="py-2 md:py-3 px-2 md:px-4">
                          <span className="text-green-400 font-medium text-xs md:text-sm" data-testid={`prc-balance-${member.uid}`}>
                            {(member.prc_balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </td>
                        <td className="py-2 md:py-3 px-2 md:px-4">
                          <span className="text-slate-800 font-medium text-xs md:text-sm" data-testid={`redeem-limit-${member.uid}`}>
                            {totalLimit.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2 md:py-3 px-2 md:px-4">
                          <span className="text-yellow-400 font-medium text-xs md:text-sm" data-testid={`used-limit-${member.uid}`}>
                            {usedLimit.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2 md:py-3 px-2 md:px-4">
                          <span className={`font-medium text-xs md:text-sm ${availableLimit > 0 ? 'text-emerald-400' : 'text-red-400'}`} data-testid={`available-limit-${member.uid}`}>
                            {availableLimit.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2 md:py-3 px-2 md:px-4 text-slate-500 text-xs md:text-sm">
                          {member.created_at ? new Date(member.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}
                        </td>
                        <td className="py-2 md:py-3 px-2 md:px-4">
                          <span className={`px-2 py-0.5 md:py-1 rounded-full text-xs font-medium ${
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
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-200">
              <p className="text-slate-500 text-xs md:text-sm">
                {((page - 1) * 20) + 1} - {Math.min(page * 20, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 md:px-3 py-1.5 md:py-2 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-800 text-xs md:text-sm"
                >
                  First
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 md:px-4 py-1.5 md:py-2 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-800 text-xs md:text-sm"
                >
                  Prev
                </button>
                <span className="px-3 md:px-4 py-1.5 md:py-2 text-slate-500 text-xs md:text-sm">
                  {page}/{pagination.total_pages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                  disabled={page >= pagination.total_pages}
                  className="px-3 md:px-4 py-1.5 md:py-2 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-800 text-xs md:text-sm"
                >
                  Next
                </button>
                <button
                  onClick={() => setPage(pagination.total_pages)}
                  disabled={page >= pagination.total_pages}
                  className="px-2 md:px-3 py-1.5 md:py-2 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-800 text-xs md:text-sm"
                >
                  Last
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
