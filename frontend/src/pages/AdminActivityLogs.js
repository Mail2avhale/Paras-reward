import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Pagination from '@/components/Pagination';
import { TableSkeleton } from '@/components/skeletons';
import { 
  Activity, Filter, Search, Download, RefreshCw,
  LogIn, ShoppingCart, CreditCard, Shield, User, Settings
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ACTION_ICONS = {
  login: LogIn,
  order_placed: ShoppingCart,
  withdrawal_requested: CreditCard,
  withdrawal_approved: CreditCard,
  kyc_submitted: Shield,
  kyc_approved: Shield,
  profile_updated: User,
  user_role_changed: Settings
};

const ACTION_COLORS = {
  login: 'bg-blue-500/100/20 text-blue-400',
  order_placed: 'bg-green-500/100/20 text-green-400',
  withdrawal_requested: 'bg-yellow-500/100/20 text-yellow-400',
  withdrawal_approved: 'bg-emerald-500/100/20 text-emerald-400',
  withdrawal_rejected: 'bg-red-500/100/20 text-red-400',
  kyc_submitted: 'bg-purple-500/100/20 text-purple-400',
  kyc_approved: 'bg-indigo-500/100/20 text-indigo-400',
  kyc_rejected: 'bg-red-500/100/20 text-red-400',
  profile_updated: 'bg-gray-700 text-gray-300',
  user_role_changed: 'bg-orange-500/100/20 text-orange-400',
  mining_started: 'bg-teal-500/100/20 text-teal-400',
  mining_claimed: 'bg-cyan-500/100/20 text-cyan-400'
};

const AdminActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [currentPage, actionTypeFilter, startDate, endDate]);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (currentPage === 1) {
        fetchLogs();
      } else {
        setCurrentPage(1);
      }
    }, 500);
    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit
      };
      
      if (actionTypeFilter) params.action_type = actionTypeFilter;
      if (startDate) params.start_date = new Date(startDate).toISOString();
      if (endDate) params.end_date = new Date(endDate).toISOString();
      
      const response = await axios.get(`${API}/activity-logs`, { params });
      let filteredLogs = response.data.logs;
      
      // Client-side search filtering
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredLogs = filteredLogs.filter(log =>
          log.user_name?.toLowerCase().includes(query) ||
          log.user_email?.toLowerCase().includes(query) ||
          log.description?.toLowerCase().includes(query)
        );
      }
      
      setLogs(filteredLogs);
      setTotal(response.data.total);
      setTotalPages(response.data.total_pages);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/activity-logs/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleRefresh = () => {
    fetchLogs();
    fetchStats();
    toast.success('Activity logs refreshed');
  };

  const handleExport = () => {
    // Convert logs to CSV
    const headers = ['Time', 'User', 'Email', 'Action', 'Description', 'IP Address'];
    const rows = logs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.user_name,
      log.user_email,
      log.action_type,
      log.description,
      log.ip_address || 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Activity logs exported');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-gray-600 mt-1">Monitor all user activities and system events</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleRefresh} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleExport} className="gap-2 bg-green-600 hover:bg-green-700">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-400">Total Logs</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{stats.total_logs}</p>
              </div>
              <Activity className="h-10 w-10 text-blue-600" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-400">Last 24 Hours</p>
                <p className="text-3xl font-bold text-green-900 mt-1">{stats.recent_logs_24h}</p>
              </div>
              <RefreshCw className="h-10 w-10 text-green-600" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-400">Action Types</p>
                <p className="text-3xl font-bold text-purple-900 mt-1">
                  {stats.action_type_stats?.length || 0}
                </p>
              </div>
              <Filter className="h-10 w-10 text-purple-600" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-400">Active Users</p>
                <p className="text-3xl font-bold text-orange-900 mt-1">
                  {stats.most_active_users?.length || 0}
                </p>
              </div>
              <User className="h-10 w-10 text-orange-600" />
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-6 bg-gray-900">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search user, email, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={actionTypeFilter}
            onChange={(e) => setActionTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Actions</option>
            <option value="login">Login</option>
            <option value="order_placed">Order Placed</option>
            <option value="withdrawal_requested">Withdrawal Requested</option>
            <option value="withdrawal_approved">Withdrawal Approved</option>
            <option value="kyc_submitted">KYC Submitted</option>
            <option value="kyc_approved">KYC Approved</option>
            <option value="profile_updated">Profile Updated</option>
            <option value="mining_started">Mining Started</option>
            <option value="mining_claimed">Mining Claimed</option>
          </select>

          <Input
            type="date"
            placeholder="Start Date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            type="date"
            placeholder="End Date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="p-6 bg-gray-900">
        {loading ? (
          <TableSkeleton rows={10} columns={5} />
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No activity logs found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-4 px-4 font-semibold text-gray-300">Time</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-300">User</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-300">Action</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-300">Description</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-300">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const Icon = ACTION_ICONS[log.action_type] || Activity;
                    const colorClass = ACTION_COLORS[log.action_type] || 'bg-gray-700 text-gray-300';
                    
                    return (
                      <tr key={log.log_id} className="border-b border-gray-100 hover:bg-gray-800/50">
                        <td className="py-4 px-4 text-sm text-gray-600">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{log.user_name}</p>
                            <p className="text-sm text-gray-500">{log.user_email}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                            <Icon className="h-3 w-3" />
                            {log.action_type.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-300 max-w-md truncate">
                          {log.description}
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-600">
                          {log.ip_address || 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, total)} of {total} logs
              </p>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default AdminActivityLogs;
