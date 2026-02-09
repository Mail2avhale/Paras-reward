import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, ArrowLeft, Crown, TrendingUp, ChevronRight, ChevronDown,
  User, Circle, Search, Activity, Filter, X, Download, BarChart3,
  UserCheck, UserX, RefreshCw, Eye, Calendar, Zap, Gift, Star,
  ChevronUp, Target, Award, Clock, Mail, Phone
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

// Format date helper
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Get plan info
const getPlanInfo = (plan) => {
  switch(plan?.toLowerCase()) {
    case 'elite':
      return { label: 'Elite', color: 'purple', icon: '👑', bgColor: 'bg-purple-500/20', textColor: 'text-purple-400', borderColor: 'border-purple-500/30' };
    case 'growth':
      return { label: 'Growth', color: 'blue', icon: '🚀', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' };
    case 'startup':
      return { label: 'Startup', color: 'amber', icon: '⭐', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/30' };
    default:
      return { label: 'Free', color: 'gray', icon: '🆓', bgColor: 'bg-gray-500/20', textColor: 'text-gray-400', borderColor: 'border-gray-500/30' };
  }
};

// Level colors
const getLevelColor = (level) => {
  const colors = [
    'from-amber-500 to-orange-500',   // L1
    'from-blue-500 to-cyan-500',      // L2
    'from-emerald-500 to-green-500',  // L3
    'from-purple-500 to-pink-500',    // L4
    'from-rose-500 to-red-500'        // L5
  ];
  return colors[level - 1] || colors[0];
};

const getLevelBadgeColor = (level) => {
  const colors = [
    'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'bg-rose-500/20 text-rose-400 border-rose-500/30'
  ];
  return colors[level - 1] || colors[0];
};

const NetworkTreeAdvanced = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [networkData, setNetworkData] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedPlan, setSelectedPlan] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // View mode
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'list'
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Fetch network data
  const fetchNetworkData = useCallback(async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      // Fetch tree structure
      const treeResponse = await axios.get(`${API}/api/referrals/network-tree/${user.uid}`);
      setNetworkData(treeResponse.data);
      
      // Flatten tree to get all users list
      const flattenTree = (node, level = 1, result = []) => {
        if (node?.children) {
          node.children.forEach(child => {
            result.push({
              ...child,
              level,
              parentName: node.name || user?.name,
              parentId: node.id || user?.uid
            });
            flattenTree(child, level + 1, result);
          });
        }
        return result;
      };
      
      const flatUsers = flattenTree(treeResponse.data);
      setAllUsers(flatUsers);
      
      // Auto-expand first 2 levels
      const initialExpanded = new Set();
      flatUsers.filter(u => u.level <= 2).forEach(u => initialExpanded.add(u.id));
      setExpandedNodes(initialExpanded);
      
    } catch (error) {
      console.error('Error fetching network:', error);
      toast.error('Failed to load network data');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, user?.name]);

  useEffect(() => {
    fetchNetworkData();
  }, [fetchNetworkData]);

  // Calculate analytics
  const analytics = useMemo(() => {
    if (!allUsers.length) return null;
    
    const total = allUsers.length;
    const byLevel = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const byPlan = { free: 0, startup: 0, growth: 0, elite: 0 };
    const activeUsers = [];
    const inactiveUsers = [];
    const recentJoins = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    allUsers.forEach(u => {
      // By level
      if (u.level >= 1 && u.level <= 5) byLevel[u.level]++;
      
      // By plan
      const plan = u.subscription_plan?.toLowerCase() || 'free';
      if (plan === 'explorer' || !u.subscription_plan) byPlan.free++;
      else if (byPlan[plan] !== undefined) byPlan[plan]++;
      
      // Active vs Inactive
      const isPaid = ['startup', 'growth', 'elite'].includes(plan);
      if (isPaid) {
        activeUsers.push(u);
      } else {
        inactiveUsers.push(u);
      }
      
      // Recent joins (last 7 days)
      if (u.joined_at && new Date(u.joined_at) >= sevenDaysAgo) {
        recentJoins.push(u);
      }
    });
    
    const conversionRate = total > 0 ? ((activeUsers.length / total) * 100).toFixed(1) : 0;
    
    return {
      total,
      byLevel,
      byPlan,
      active: activeUsers.length,
      inactive: inactiveUsers.length,
      conversionRate,
      recentJoins: recentJoins.length,
      topPerformers: allUsers
        .filter(u => u.referral_count > 0)
        .sort((a, b) => (b.referral_count || 0) - (a.referral_count || 0))
        .slice(0, 5),
      inactiveList: inactiveUsers.slice(0, 10)
    };
  }, [allUsers]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    let filtered = [...allUsers];
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        (u.name || '').toLowerCase().includes(search) ||
        (u.email || '').toLowerCase().includes(search) ||
        (u.mobile || '').includes(search)
      );
    }
    
    // Level filter
    if (selectedLevel !== 'all') {
      filtered = filtered.filter(u => u.level === parseInt(selectedLevel));
    }
    
    // Plan filter
    if (selectedPlan !== 'all') {
      filtered = filtered.filter(u => {
        const plan = u.subscription_plan?.toLowerCase() || 'free';
        if (selectedPlan === 'free') return plan === 'explorer' || plan === 'free' || !u.subscription_plan;
        return plan === selectedPlan;
      });
    }
    
    // Activity filter
    if (activityFilter !== 'all') {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      filtered = filtered.filter(u => {
        const lastActive = u.last_active ? new Date(u.last_active) : null;
        const isPaid = ['startup', 'growth', 'elite'].includes(u.subscription_plan?.toLowerCase());
        
        switch(activityFilter) {
          case 'active_7d':
            return lastActive && lastActive >= sevenDaysAgo;
          case 'active_30d':
            return lastActive && lastActive >= thirtyDaysAgo;
          case 'paid':
            return isPaid;
          case 'inactive':
            return !isPaid;
          default:
            return true;
        }
      });
    }
    
    return filtered;
  }, [allUsers, searchTerm, selectedLevel, selectedPlan, activityFilter]);

  // Toggle node expansion
  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) newSet.delete(nodeId);
      else newSet.add(nodeId);
      return newSet;
    });
  };

  // Expand/Collapse all
  const expandAll = () => {
    const allIds = new Set(allUsers.map(u => u.id));
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Mobile', 'Level', 'Plan', 'Referrals', 'Join Date'];
    const rows = filteredUsers.map(u => [
      u.name || 'N/A',
      u.email || 'N/A',
      u.mobile || 'N/A',
      `L${u.level}`,
      u.subscription_plan || 'Free',
      u.referral_count || 0,
      formatDate(u.joined_at)
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Network data exported!');
  };

  // Render tree node
  const renderTreeNode = (node, level = 1) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const planInfo = getPlanInfo(node.subscription_plan);
    const isPaid = ['startup', 'growth', 'elite'].includes(node.subscription_plan?.toLowerCase());
    
    return (
      <div key={node.id} className="ml-4">
        <div 
          className={`flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer transition-all hover:bg-gray-800/50 ${
            selectedUser?.id === node.id ? 'bg-purple-500/20 border border-purple-500/30' : ''
          }`}
          onClick={() => setSelectedUser(node)}
        >
          {/* Connector */}
          {level > 1 && (
            <div className="w-4 h-px bg-gradient-to-r from-gray-600 to-transparent"></div>
          )}
          
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button 
              onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
              className="p-1 hover:bg-gray-700 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>
          ) : (
            <Circle className="w-2 h-2 text-gray-600 mx-2" />
          )}
          
          {/* Avatar */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
            isPaid 
              ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 text-green-400 ring-2 ring-green-500/50' 
              : 'bg-gray-700 text-gray-400'
          }`}>
            {node.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium truncate">{node.name || 'User'}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${planInfo.bgColor} ${planInfo.textColor}`}>
                {planInfo.icon} {planInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {hasChildren && <span>{node.children.length} referrals</span>}
              {node.joined_at && <span>• Joined {formatDate(node.joined_at)}</span>}
            </div>
          </div>
          
          {/* Level Badge */}
          <span className={`px-2 py-1 text-xs font-bold rounded-lg border ${getLevelBadgeColor(level)}`}>
            L{level}
          </span>
          
          {/* View Details */}
          <button 
            onClick={(e) => { e.stopPropagation(); setSelectedUser(node); }}
            className="p-2 hover:bg-gray-700 rounded-lg"
          >
            <Eye className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-l-2 border-gray-700/50 ml-6">
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading network...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 pb-24" data-testid="network-tree-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-800 rounded-xl transition-colors"
              data-testid="back-button"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Network Tree View</h1>
              <p className="text-xs text-gray-400">Advanced network management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchNetworkData}
              className="p-2 hover:bg-gray-800 rounded-xl"
              data-testid="refresh-button"
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={exportToCSV}
              className="p-2 hover:bg-gray-800 rounded-xl"
              data-testid="export-csv-button"
            >
              <Download className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Dashboard */}
      {analytics && (
        <div className="p-4 space-y-4" data-testid="analytics-dashboard">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="p-3 bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30" data-testid="stat-total">
              <p className="text-2xl font-bold text-white">{analytics.total}</p>
              <p className="text-xs text-purple-300">Total Network</p>
            </Card>
            <Card className="p-3 bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30" data-testid="stat-active">
              <p className="text-2xl font-bold text-green-400">{analytics.active}</p>
              <p className="text-xs text-green-300">Active (Paid)</p>
            </Card>
            <Card className="p-3 bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
              <p className="text-2xl font-bold text-amber-400">{analytics.conversionRate}%</p>
              <p className="text-xs text-amber-300">Conversion</p>
            </Card>
            <Card className="p-3 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
              <p className="text-2xl font-bold text-blue-400">{analytics.recentJoins}</p>
              <p className="text-xs text-blue-300">New (7d)</p>
            </Card>
          </div>

          {/* Level Distribution */}
          <Card className="p-4 bg-gray-900/50 border-gray-800">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              Level Distribution
            </h3>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(level => {
                const count = analytics.byLevel[level] || 0;
                const percentage = analytics.total > 0 ? (count / analytics.total) * 100 : 0;
                return (
                  <div key={level} className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${getLevelBadgeColor(level)}`}>L{level}</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${getLevelColor(level)} rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-400 w-12 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Top Performers */}
          {analytics.topPerformers.length > 0 && (
            <Card className="p-4 bg-gray-900/50 border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Top Performers
              </h3>
              <div className="space-y-2">
                {analytics.topPerformers.map((u, idx) => (
                  <div key={u.id} className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500 text-black' :
                      idx === 1 ? 'bg-gray-400 text-black' :
                      idx === 2 ? 'bg-amber-700 text-white' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{u.name || 'User'}</p>
                      <p className="text-gray-500 text-xs">L{u.level}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-400 font-bold">{u.referral_count || 0}</p>
                      <p className="text-gray-500 text-xs">referrals</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Inactive Users (for re-engagement) */}
          {analytics.inactiveList.length > 0 && (
            <Card className="p-4 bg-gray-900/50 border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <UserX className="w-4 h-4 text-red-400" />
                Inactive Users (Free Plan)
                <span className="ml-auto text-xs text-gray-500">{analytics.inactive} total</span>
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {analytics.inactiveList.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-2 bg-gray-800/30 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                      {u.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-sm truncate">{u.name || 'User'}</p>
                      <p className="text-gray-600 text-xs">L{u.level} • Joined {formatDate(u.joined_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <div className="px-4 mb-4">
        <Card className="p-3 bg-gray-900/50 border-gray-800" data-testid="search-filters-card">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search by name, email, mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
              data-testid="search-input"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                data-testid="clear-search-button"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Filter Toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Level Filter */}
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              data-testid="level-filter"
            >
              <option value="all">All Levels</option>
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
              <option value="3">Level 3</option>
              <option value="4">Level 4</option>
              <option value="5">Level 5</option>
            </select>

            {/* Plan Filter */}
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              data-testid="plan-filter"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="startup">Startup</option>
              <option value="growth">Growth</option>
              <option value="elite">Elite</option>
            </select>

            {/* Activity Filter */}
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              data-testid="activity-filter"
            >
              <option value="all">All Activity</option>
              <option value="active_7d">Active (7 days)</option>
              <option value="active_30d">Active (30 days)</option>
              <option value="paid">Paid Only</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Clear Filters */}
            {(searchTerm || selectedLevel !== 'all' || selectedPlan !== 'all' || activityFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedLevel('all');
                  setSelectedPlan('all');
                  setActivityFilter('all');
                }}
                className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm"
                data-testid="clear-filters-button"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Filter Summary */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
            <p className="text-xs text-gray-400" data-testid="filter-summary">
              Showing {filteredUsers.length} of {allUsers.length} users
            </p>
            <div className="flex items-center gap-2">
              <button onClick={expandAll} className="text-xs text-blue-400 hover:underline" data-testid="expand-all-button">Expand All</button>
              <span className="text-gray-600">|</span>
              <button onClick={collapseAll} className="text-xs text-blue-400 hover:underline" data-testid="collapse-all-button">Collapse All</button>
            </div>
          </div>
        </Card>
      </div>

      {/* Tree View */}
      <div className="px-4">
        <Card className="p-4 bg-gray-900/50 border-gray-800">
          {/* Root User */}
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/10 rounded-2xl border border-amber-500/30 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-lg">{user?.name || 'You'}</p>
              <p className="text-amber-400 text-sm">Network Owner</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-400">{allUsers.length}</p>
              <p className="text-xs text-gray-400">Total Members</p>
            </div>
          </div>

          {/* Tree or List */}
          {viewMode === 'tree' ? (
            <div className="space-y-1">
              {networkData?.children?.length > 0 ? (
                networkData.children
                  .filter(node => {
                    if (!searchTerm && selectedLevel === 'all' && selectedPlan === 'all' && activityFilter === 'all') return true;
                    return filteredUsers.some(u => u.id === node.id);
                  })
                  .map(node => renderTreeNode(node, 1))
              ) : (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">No referrals yet</p>
                  <p className="text-gray-500 text-sm">Start inviting friends to build your network!</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map(u => (
                <div 
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl hover:bg-gray-800 cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    ['startup', 'growth', 'elite'].includes(u.subscription_plan?.toLowerCase())
                      ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/50'
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {u.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{u.name || 'User'}</p>
                    <p className="text-gray-500 text-xs">{u.email || 'No email'}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-lg border ${getLevelBadgeColor(u.level)}`}>
                    L{u.level}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-gray-900 rounded-t-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-gray-900 p-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">User Details</h2>
                <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Profile */}
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                    ['startup', 'growth', 'elite'].includes(selectedUser.subscription_plan?.toLowerCase())
                      ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 text-green-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {selectedUser.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedUser.name || 'User'}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getPlanInfo(selectedUser.subscription_plan).bgColor} ${getPlanInfo(selectedUser.subscription_plan).textColor}`}>
                        {getPlanInfo(selectedUser.subscription_plan).icon} {getPlanInfo(selectedUser.subscription_plan).label}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded border ${getLevelBadgeColor(selectedUser.level)}`}>
                        Level {selectedUser.level}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-800/50 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Mail className="w-3 h-3" /> Email
                    </div>
                    <p className="text-white text-sm truncate">{selectedUser.email || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Phone className="w-3 h-3" /> Mobile
                    </div>
                    <p className="text-white text-sm">{selectedUser.mobile || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Calendar className="w-3 h-3" /> Joined
                    </div>
                    <p className="text-white text-sm">{formatDate(selectedUser.joined_at)}</p>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Users className="w-3 h-3" /> Referrals
                    </div>
                    <p className="text-white text-sm">{selectedUser.referral_count || 0}</p>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Zap className="w-3 h-3" /> PRC Balance
                    </div>
                    <p className="text-amber-400 text-sm font-bold">{selectedUser.prc_balance?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Gift className="w-3 h-3" /> Earned From
                    </div>
                    <p className="text-green-400 text-sm font-bold">+{selectedUser.earnings_generated?.toFixed(2) || '0.00'} PRC</p>
                  </div>
                </div>

                {/* Referred By */}
                {selectedUser.parentName && (
                  <div className="p-3 bg-gray-800/50 rounded-xl">
                    <p className="text-gray-400 text-xs mb-1">Referred By</p>
                    <p className="text-white">{selectedUser.parentName}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NetworkTreeAdvanced;
