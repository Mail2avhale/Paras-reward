import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { 
  Send, 
  Settings, 
  History, 
  Search,
  Filter,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  Wallet,
  Eye,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Calendar,
  ArrowUpDown,
  UserCog,
  Trash2,
  Plus,
  Save
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminDMTDashboard = ({ user }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  
  // Settings State
  const [settings, setSettings] = useState({
    dmt_enabled: true,
    min_transfer: 100,
    max_daily_limit: 5000,
    max_monthly_limit: 50000,
    max_daily_transactions: 10,
    max_monthly_transactions: 100,
    prc_rate: 100,
    imps_enabled: true,
    neft_enabled: true
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  
  // User Limits State
  const [userLimits, setUserLimits] = useState([]);
  const [userLimitsLoading, setUserLimitsLoading] = useState(false);
  const [showAddLimitDialog, setShowAddLimitDialog] = useState(false);
  const [newUserLimit, setNewUserLimit] = useState({
    user_id: '',
    daily_limit: 5000,
    monthly_limit: 50000,
    daily_transaction_limit: 10,
    monthly_transaction_limit: 100
  });
  const [searchUserId, setSearchUserId] = useState('');
  
  // Transactions State
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  
  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    dateFrom: '',
    dateTo: '',
    search: '',
    minAmount: '',
    maxAmount: '',
    provider: 'all'
  });
  
  // Stats
  const [stats, setStats] = useState({
    total_transactions: 0,
    total_amount: 0,
    successful: 0,
    failed: 0,
    pending: 0,
    total_prc_used: 0,
    total_refunded: 0,
    today_transactions: 0,
    today_amount: 0
  });

  // Load data on mount
  useEffect(() => {
    fetchSettings();
    fetchStats();
    fetchTransactions();
    fetchUserLimits();
  }, []);

  // Fetch DMT settings
  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/dmt/settings`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Settings fetch error:', error);
    }
  };

  // Save DMT settings
  const saveSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/dmt/settings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('DMT settings saved successfully');
      } else {
        toast.error(data.message || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  // Toggle DMT service
  const toggleDMT = async () => {
    const newState = !settings.dmt_enabled;
    setSettings({ ...settings, dmt_enabled: newState });
    
    try {
      const res = await fetch(`${API_URL}/api/admin/dmt/toggle`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ enabled: newState })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`DMT Service ${newState ? 'Enabled' : 'Disabled'}`);
      }
    } catch (error) {
      setSettings({ ...settings, dmt_enabled: !newState });
      toast.error('Failed to toggle DMT service');
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/dmt/stats`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Stats fetch error:', error);
    }
  };

  // Fetch user limits
  const fetchUserLimits = async () => {
    setUserLimitsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/dmt/user-limits`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setUserLimits(data.data.users || []);
      }
    } catch (error) {
      console.error('User limits fetch error:', error);
    } finally {
      setUserLimitsLoading(false);
    }
  };

  // Save user limit
  const saveUserLimit = async () => {
    if (!newUserLimit.user_id) {
      toast.error('Please enter User ID');
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/admin/dmt/user-limits`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...newUserLimit,
          admin_id: user?.uid
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('User limit saved successfully');
        setShowAddLimitDialog(false);
        setNewUserLimit({
          user_id: '',
          daily_limit: 5000,
          monthly_limit: 50000,
          daily_transaction_limit: 10,
          monthly_transaction_limit: 100
        });
        fetchUserLimits();
      } else {
        toast.error(data.message || 'Failed to save limit');
      }
    } catch (error) {
      toast.error('Failed to save user limit');
    }
  };

  // Delete user limit
  const deleteUserLimit = async (userId) => {
    if (!confirm('Remove custom limits for this user?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/admin/dmt/user-limits/${userId}?admin_id=${user?.uid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Custom limits removed');
        fetchUserLimits();
      } else {
        toast.error(data.message || 'Failed to remove limits');
      }
    } catch (error) {
      toast.error('Failed to remove limits');
    }
  };

  // Fetch transactions with filters
  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: pageSize,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v && v !== 'all')
        )
      });
      
      const res = await fetch(`${API_URL}/api/admin/dmt/transactions?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      
      if (data.success) {
        setTransactions(data.data.transactions || []);
        setTotalTransactions(data.data.total || 0);
      }
    } catch (error) {
      console.error('Transactions fetch error:', error);
    } finally {
      setTransactionsLoading(false);
    }
  }, [currentPage, filters]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Apply filters
  const applyFilters = () => {
    setCurrentPage(1);
    fetchTransactions();
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      status: 'all',
      dateFrom: '',
      dateTo: '',
      search: '',
      minAmount: '',
      maxAmount: '',
      provider: 'all'
    });
    setCurrentPage(1);
  };

  // Export transactions
  const exportTransactions = async () => {
    try {
      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v && v !== 'all')
        )
      );
      
      const res = await fetch(`${API_URL}/api/admin/dmt/export?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dmt_transactions_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      
      toast.success('Export downloaded');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const config = {
      completed: { color: 'bg-green-500', icon: CheckCircle, text: 'Success' },
      failed: { color: 'bg-red-500', icon: XCircle, text: 'Failed' },
      pending: { color: 'bg-yellow-500', icon: Clock, text: 'Pending' },
      processing: { color: 'bg-blue-500', icon: Loader2, text: 'Processing' },
      refunded: { color: 'bg-purple-500', icon: RefreshCw, text: 'Refunded' },
      refund_pending: { color: 'bg-orange-500', icon: Clock, text: 'Refund Pending' }
    };
    
    const c = config[status] || config.pending;
    const Icon = c.icon;
    
    return (
      <Badge className={`${c.color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {c.text}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Send className="w-7 h-7 text-amber-500" />
            DMT Management
          </h1>
          <p className="text-gray-400 mt-1">Manage bank transfers and monitor transactions</p>
        </div>
        
        {/* Quick Toggle */}
        <Card className={`${settings.dmt_enabled ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              {settings.dmt_enabled ? (
                <ToggleRight className="w-8 h-8 text-green-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-red-500" />
              )}
              <div>
                <p className={`font-semibold ${settings.dmt_enabled ? 'text-green-400' : 'text-red-400'}`}>
                  DMT Service {settings.dmt_enabled ? 'ON' : 'OFF'}
                </p>
                <p className="text-gray-500 text-xs">Click to toggle</p>
              </div>
            </div>
            <Switch
              checked={settings.dmt_enabled}
              onCheckedChange={toggleDMT}
              data-testid="dmt-toggle"
            />
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <History className="w-4 h-4" />
              Total Transactions
            </div>
            <p className="text-2xl font-bold text-white mt-1">{stats.total_transactions?.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Wallet className="w-4 h-4" />
              Total Amount
            </div>
            <p className="text-2xl font-bold text-white mt-1">₹{stats.total_amount?.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              Successful
            </div>
            <p className="text-2xl font-bold text-green-400 mt-1">{stats.successful?.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <XCircle className="w-4 h-4" />
              Failed
            </div>
            <p className="text-2xl font-bold text-red-400 mt-1">{stats.failed?.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <Clock className="w-4 h-4" />
              Pending
            </div>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending?.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-400 text-sm">
              <RefreshCw className="w-4 h-4" />
              Refunded PRC
            </div>
            <p className="text-2xl font-bold text-purple-400 mt-1">{stats.total_refunded?.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-800/50">
          <TabsTrigger value="overview" className="data-[state=active]:bg-amber-500">
            <History className="w-4 h-4 mr-2" /> Transactions
          </TabsTrigger>
          <TabsTrigger value="limits" className="data-[state=active]:bg-amber-500">
            <UserCog className="w-4 h-4 mr-2" /> User Limits
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-amber-500">
            <Settings className="w-4 h-4 mr-2" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="overview" className="mt-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="text-white">All DMT Transactions</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { fetchStats(); fetchTransactions(); }}
                    className="border-gray-600"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportTransactions}
                    className="border-gray-600"
                  >
                    <Download className="w-4 h-4 mr-1" /> Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6 p-4 bg-gray-900/50 rounded-lg">
                <div>
                  <Label className="text-gray-400 text-xs">Status</Label>
                  <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-gray-400 text-xs">From Date</Label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-400 text-xs">To Date</Label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-400 text-xs">Search (Mobile/TID)</Label>
                  <Input
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    placeholder="Search..."
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-400 text-xs">Min Amount</Label>
                  <Input
                    type="number"
                    value={filters.minAmount}
                    onChange={(e) => setFilters({...filters, minAmount: e.target.value})}
                    placeholder="₹0"
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-400 text-xs">Max Amount</Label>
                  <Input
                    type="number"
                    value={filters.maxAmount}
                    onChange={(e) => setFilters({...filters, maxAmount: e.target.value})}
                    placeholder="₹10000"
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                  />
                </div>
                
                <div className="col-span-2 md:col-span-4 lg:col-span-6 flex gap-2 justify-end mt-2">
                  <Button variant="outline" size="sm" onClick={resetFilters} className="border-gray-600">
                    Reset
                  </Button>
                  <Button size="sm" onClick={applyFilters} className="bg-amber-500 hover:bg-amber-600">
                    <Filter className="w-4 h-4 mr-1" /> Apply Filters
                  </Button>
                </div>
              </div>

              {/* Transactions Table */}
              {transactionsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-gray-400 text-xs font-medium p-3">TXN ID</th>
                        <th className="text-left text-gray-400 text-xs font-medium p-3">User</th>
                        <th className="text-left text-gray-400 text-xs font-medium p-3">Amount</th>
                        <th className="text-left text-gray-400 text-xs font-medium p-3">PRC Used</th>
                        <th className="text-left text-gray-400 text-xs font-medium p-3">Status</th>
                        <th className="text-left text-gray-400 text-xs font-medium p-3">EKO TID</th>
                        <th className="text-left text-gray-400 text-xs font-medium p-3">Date</th>
                        <th className="text-left text-gray-400 text-xs font-medium p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((txn) => (
                        <tr key={txn.transaction_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="p-3">
                            <span className="text-white font-mono text-sm">{txn.transaction_id?.slice(0, 12)}...</span>
                          </td>
                          <td className="p-3">
                            <p className="text-white text-sm">{txn.mobile}</p>
                            <p className="text-gray-500 text-xs">{txn.user_id?.slice(0, 8)}...</p>
                          </td>
                          <td className="p-3">
                            <span className="text-white font-semibold">₹{txn.amount_inr?.toLocaleString()}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-amber-400">{txn.prc_amount?.toLocaleString()} PRC</span>
                            {txn.prc_refunded && (
                              <p className="text-purple-400 text-xs">↩ {txn.prc_refunded} refunded</p>
                            )}
                          </td>
                          <td className="p-3">{getStatusBadge(txn.status)}</td>
                          <td className="p-3">
                            <span className="text-gray-400 font-mono text-xs">{txn.eko_tid || '-'}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-gray-400 text-sm">
                              {new Date(txn.created_at).toLocaleDateString()}
                            </span>
                            <p className="text-gray-500 text-xs">
                              {new Date(txn.created_at).toLocaleTimeString()}
                            </p>
                          </td>
                          <td className="p-3">
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {transactions.length === 0 && (
                    <div className="text-center py-12">
                      <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">No transactions found</p>
                    </div>
                  )}
                </div>
              )}

              {/* Pagination */}
              {totalTransactions > pageSize && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
                  <p className="text-gray-400 text-sm">
                    Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalTransactions)} of {totalTransactions}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      className="border-gray-600"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage * pageSize >= totalTransactions}
                      onClick={() => setCurrentPage(p => p + 1)}
                      className="border-gray-600"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Limits Tab */}
        <TabsContent value="limits" className="mt-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <UserCog className="w-5 h-5 text-amber-500" />
                    Per-User DMT Limits
                  </CardTitle>
                  <CardDescription>Set custom daily/monthly limits for specific users</CardDescription>
                </div>
                <Dialog open={showAddLimitDialog} onOpenChange={setShowAddLimitDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-amber-500 hover:bg-amber-600">
                      <Plus className="w-4 h-4 mr-2" /> Add User Limit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-800 border-gray-700 text-white">
                    <DialogHeader>
                      <DialogTitle>Set Custom DMT Limits</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label className="text-gray-300">User ID</Label>
                        <Input
                          value={newUserLimit.user_id}
                          onChange={(e) => setNewUserLimit({...newUserLimit, user_id: e.target.value})}
                          placeholder="Enter User UID"
                          className="bg-gray-900/50 border-gray-700 text-white mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-gray-300">Daily Limit (₹)</Label>
                          <Input
                            type="number"
                            value={newUserLimit.daily_limit}
                            onChange={(e) => setNewUserLimit({...newUserLimit, daily_limit: parseInt(e.target.value)})}
                            className="bg-gray-900/50 border-gray-700 text-white mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-300">Monthly Limit (₹)</Label>
                          <Input
                            type="number"
                            value={newUserLimit.monthly_limit}
                            onChange={(e) => setNewUserLimit({...newUserLimit, monthly_limit: parseInt(e.target.value)})}
                            className="bg-gray-900/50 border-gray-700 text-white mt-1"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-gray-300">Daily Transactions</Label>
                          <Input
                            type="number"
                            value={newUserLimit.daily_transaction_limit}
                            onChange={(e) => setNewUserLimit({...newUserLimit, daily_transaction_limit: parseInt(e.target.value)})}
                            className="bg-gray-900/50 border-gray-700 text-white mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-300">Monthly Transactions</Label>
                          <Input
                            type="number"
                            value={newUserLimit.monthly_transaction_limit}
                            onChange={(e) => setNewUserLimit({...newUserLimit, monthly_transaction_limit: parseInt(e.target.value)})}
                            className="bg-gray-900/50 border-gray-700 text-white mt-1"
                          />
                        </div>
                      </div>
                      <Button onClick={saveUserLimit} className="w-full bg-amber-500 hover:bg-amber-600">
                        <Save className="w-4 h-4 mr-2" /> Save Limits
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Global Limits Info */}
              <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
                <p className="text-gray-400 text-sm mb-2">Default Global Limits:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Daily:</span>
                    <span className="text-white ml-2">₹{settings.max_daily_limit?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Monthly:</span>
                    <span className="text-white ml-2">₹{settings.max_monthly_limit?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Daily Txns:</span>
                    <span className="text-white ml-2">{settings.max_daily_transactions}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Monthly Txns:</span>
                    <span className="text-white ml-2">{settings.max_monthly_transactions}</span>
                  </div>
                </div>
              </div>

              {/* User Limits Table */}
              {userLimitsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : userLimits.length === 0 ? (
                <div className="text-center py-12">
                  <UserCog className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No custom user limits set</p>
                  <p className="text-gray-500 text-sm">All users are using global default limits</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-gray-400 text-xs font-medium p-3">User</th>
                        <th className="text-left text-gray-400 text-xs font-medium p-3">Daily Limit</th>
                        <th className="text-left text-gray-400 text-xs font-medium p-3">Monthly Limit</th>
                        <th className="text-left text-gray-400 text-xs font-medium p-3">Daily Txns</th>
                        <th className="text-left text-gray-400 text-xs font-medium p-3">Monthly Txns</th>
                        <th className="text-left text-gray-400 text-xs font-medium p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userLimits.map((u) => (
                        <tr key={u.uid} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="p-3">
                            <p className="text-white font-medium">{u.name || 'N/A'}</p>
                            <p className="text-gray-500 text-xs">{u.email || u.mobile}</p>
                            <p className="text-gray-600 text-xs font-mono">{u.uid?.slice(0, 12)}...</p>
                          </td>
                          <td className="p-3">
                            <span className="text-amber-400 font-semibold">
                              ₹{u.custom_dmt_limits?.daily_limit?.toLocaleString() || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-amber-400 font-semibold">
                              ₹{u.custom_dmt_limits?.monthly_limit?.toLocaleString() || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-white">
                              {u.custom_dmt_limits?.daily_transaction_limit || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-white">
                              {u.custom_dmt_limits?.monthly_transaction_limit || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteUserLimit(u.uid)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Service Control */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <ToggleRight className="w-5 h-5 text-amber-500" />
                  Service Control
                </CardTitle>
                <CardDescription>Enable or disable DMT services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">DMT Service</p>
                    <p className="text-gray-400 text-sm">Master switch for all bank transfers</p>
                  </div>
                  <Switch
                    checked={settings.dmt_enabled}
                    onCheckedChange={(v) => setSettings({...settings, dmt_enabled: v})}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">IMPS Transfers</p>
                    <p className="text-gray-400 text-sm">Instant transfers (24x7)</p>
                  </div>
                  <Switch
                    checked={settings.imps_enabled}
                    onCheckedChange={(v) => setSettings({...settings, imps_enabled: v})}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">NEFT Transfers</p>
                    <p className="text-gray-400 text-sm">Batch transfers (banking hours)</p>
                  </div>
                  <Switch
                    checked={settings.neft_enabled}
                    onCheckedChange={(v) => setSettings({...settings, neft_enabled: v})}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Limits */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-amber-500" />
                  Transfer Limits
                </CardTitle>
                <CardDescription>Configure transfer limits and rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-300">Minimum Transfer (₹)</Label>
                  <Input
                    type="number"
                    value={settings.min_transfer}
                    onChange={(e) => setSettings({...settings, min_transfer: parseInt(e.target.value)})}
                    className="bg-gray-900/50 border-gray-700 text-white mt-1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Daily Limit (₹)</Label>
                    <Input
                      type="number"
                      value={settings.max_daily_limit}
                      onChange={(e) => setSettings({...settings, max_daily_limit: parseInt(e.target.value)})}
                      className="bg-gray-900/50 border-gray-700 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Monthly Limit (₹)</Label>
                    <Input
                      type="number"
                      value={settings.max_monthly_limit}
                      onChange={(e) => setSettings({...settings, max_monthly_limit: parseInt(e.target.value)})}
                      className="bg-gray-900/50 border-gray-700 text-white mt-1"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Daily Transactions</Label>
                    <Input
                      type="number"
                      value={settings.max_daily_transactions}
                      onChange={(e) => setSettings({...settings, max_daily_transactions: parseInt(e.target.value)})}
                      className="bg-gray-900/50 border-gray-700 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Monthly Transactions</Label>
                    <Input
                      type="number"
                      value={settings.max_monthly_transactions}
                      onChange={(e) => setSettings({...settings, max_monthly_transactions: parseInt(e.target.value)})}
                      className="bg-gray-900/50 border-gray-700 text-white mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-gray-300">PRC to INR Rate (PRC per ₹1)</Label>
                  <Input
                    type="number"
                    value={settings.prc_rate}
                    onChange={(e) => setSettings({...settings, prc_rate: parseInt(e.target.value)})}
                    className="bg-gray-900/50 border-gray-700 text-white mt-1"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    Current: {settings.prc_rate} PRC = ₹1
                  </p>
                </div>
                
                <Button
                  onClick={saveSettings}
                  disabled={settingsLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 mt-4"
                >
                  {settingsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDMTDashboard;
