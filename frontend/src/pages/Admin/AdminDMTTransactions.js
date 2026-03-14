import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight,
  Calendar, ArrowUpDown, CheckCircle, XCircle, Clock, Banknote,
  User, Phone, Hash, IndianRupee
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminDMTTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    dmt_type: 'all',
    mobile: '',
    txn_id: '',
    start_date: '',
    end_date: '',
    min_amount: '',
    max_amount: ''
  });
  
  // Pagination
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    skip: 0,
    pages: 0,
    current_page: 1
  });
  
  const [summary, setSummary] = useState({ total_amount: 0, total_prc: 0 });
  const [showFilters, setShowFilters] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.dmt_type !== 'all') params.append('dmt_type', filters.dmt_type);
      if (filters.mobile) params.append('mobile', filters.mobile);
      if (filters.txn_id) params.append('txn_id', filters.txn_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.min_amount) params.append('min_amount', filters.min_amount);
      if (filters.max_amount) params.append('max_amount', filters.max_amount);
      
      params.append('limit', pagination.limit);
      params.append('skip', pagination.skip);
      
      const response = await axios.get(`${API}/api/dmt-v1/admin/transactions?${params.toString()}`);
      
      if (response.data.success) {
        setTransactions(response.data.transactions || []);
        setPagination(response.data.pagination || pagination);
        setSummary(response.data.summary || { total_amount: 0, total_prc: 0 });
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit, pagination.skip]);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/api/dmt-v1/admin/stats`);
      if (response.data.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [fetchTransactions]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, skip: 0, current_page: 1 }));
  };

  const handlePageChange = (newPage) => {
    const newSkip = (newPage - 1) * pagination.limit;
    setPagination(prev => ({ ...prev, skip: newSkip, current_page: newPage }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      dmt_type: 'all',
      mobile: '',
      txn_id: '',
      start_date: '',
      end_date: '',
      min_amount: '',
      max_amount: ''
    });
  };

  const exportToCSV = () => {
    if (transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    
    const headers = ['Date', 'Txn ID', 'User', 'Mobile', 'Beneficiary', 'Account', 'Bank', 'Amount', 'PRC', 'Status', 'Type'];
    const rows = transactions.map(txn => [
      new Date(txn.created_at).toLocaleString('en-IN'),
      txn.txn_id || txn.eko_tid || '-',
      txn.user_id || '-',
      txn.customer_mobile || txn.sender_mobile || '-',
      txn.beneficiary_name || txn.recipient_name || '-',
      txn.account_number || txn.recipient_account || '-',
      txn.bank_name || '-',
      txn.amount || 0,
      txn.prc_amount || 0,
      txn.status || '-',
      txn.dmt_type || 'v1'
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dmt_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Exported successfully');
  };

  const getStatusBadge = (status) => {
    const styles = {
      success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
      pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      refunded: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    };
    const icons = {
      success: <CheckCircle className="w-3 h-3" />,
      failed: <XCircle className="w-3 h-3" />,
      pending: <Clock className="w-3 h-3" />,
      refunded: <RefreshCw className="w-3 h-3" />
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${styles[status] || styles.pending}`}>
        {icons[status] || icons.pending}
        {status?.toUpperCase() || 'PENDING'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">DMT Transactions</h1>
            <p className="text-gray-400 text-sm">View and manage all money transfer transactions</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)}
              className="border-gray-700 text-gray-300"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToCSV}
              className="border-gray-700 text-gray-300"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => { fetchTransactions(); fetchStats(); }}
              className="border-gray-700 text-gray-300"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gray-900/50 border-gray-800 p-4">
              <p className="text-gray-400 text-xs mb-1">Today Success</p>
              <p className="text-xl font-bold text-emerald-400">
                {stats.today?.success?.count || 0}
              </p>
              <p className="text-xs text-gray-500">
                ₹{(stats.today?.success?.amount || 0).toLocaleString()}
              </p>
            </Card>
            <Card className="bg-gray-900/50 border-gray-800 p-4">
              <p className="text-gray-400 text-xs mb-1">Today Failed</p>
              <p className="text-xl font-bold text-red-400">
                {stats.today?.failed?.count || 0}
              </p>
              <p className="text-xs text-gray-500">
                ₹{(stats.today?.failed?.amount || 0).toLocaleString()}
              </p>
            </Card>
            <Card className="bg-gray-900/50 border-gray-800 p-4">
              <p className="text-gray-400 text-xs mb-1">Total Success</p>
              <p className="text-xl font-bold text-emerald-400">
                {stats.total?.success?.count || 0}
              </p>
              <p className="text-xs text-gray-500">
                ₹{(stats.total?.success?.amount || 0).toLocaleString()}
              </p>
            </Card>
            <Card className="bg-gray-900/50 border-gray-800 p-4">
              <p className="text-gray-400 text-xs mb-1">Total Failed</p>
              <p className="text-xl font-bold text-red-400">
                {stats.total?.failed?.count || 0}
              </p>
              <p className="text-xs text-gray-500">
                ₹{(stats.total?.failed?.amount || 0).toLocaleString()}
              </p>
            </Card>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <Card className="bg-gray-900/50 border-gray-800 p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              {/* DMT Type Filter */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">DMT Type</label>
                <select
                  value={filters.dmt_type}
                  onChange={(e) => handleFilterChange('dmt_type', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="levin">Levin V3</option>
                  <option value="v1">Legacy V1</option>
                </select>
              </div>

              {/* Mobile Search */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Mobile Number</label>
                <Input
                  placeholder="Search mobile..."
                  value={filters.mobile}
                  onChange={(e) => handleFilterChange('mobile', e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              {/* Transaction ID Search */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Transaction ID</label>
                <Input
                  placeholder="Search txn ID..."
                  value={filters.txn_id}
                  onChange={(e) => handleFilterChange('txn_id', e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              {/* Date Range */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              {/* Amount Range */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Min Amount (₹)</label>
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.min_amount}
                  onChange={(e) => handleFilterChange('min_amount', e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Max Amount (₹)</label>
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.max_amount}
                  onChange={(e) => handleFilterChange('max_amount', e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters} className="border-gray-700 text-gray-300">
                Clear All
              </Button>
              <Button size="sm" onClick={fetchTransactions} className="bg-violet-600 hover:bg-violet-700">
                Apply Filters
              </Button>
            </div>
          </Card>
        )}

        {/* Summary */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-400">
            Showing {transactions.length} of {pagination.total} transactions
            {summary.total_amount > 0 && (
              <span className="ml-2">
                | Total: <span className="text-emerald-400">₹{summary.total_amount.toLocaleString()}</span>
                {summary.total_prc > 0 && <span className="text-violet-400 ml-2">({summary.total_prc.toLocaleString()} PRC)</span>}
              </span>
            )}
          </p>
        </div>

        {/* Transactions Table */}
        <Card className="bg-gray-900/50 border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="text-left p-3 text-xs text-gray-400 font-medium">Date & Time</th>
                  <th className="text-left p-3 text-xs text-gray-400 font-medium">Txn ID</th>
                  <th className="text-left p-3 text-xs text-gray-400 font-medium">Customer</th>
                  <th className="text-left p-3 text-xs text-gray-400 font-medium">Beneficiary</th>
                  <th className="text-left p-3 text-xs text-gray-400 font-medium">Bank</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-medium">Amount</th>
                  <th className="text-center p-3 text-xs text-gray-400 font-medium">Status</th>
                  <th className="text-center p-3 text-xs text-gray-400 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-gray-400">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn, idx) => (
                    <tr key={txn.txn_id || idx} className="border-t border-gray-800 hover:bg-gray-800/30">
                      <td className="p-3">
                        <p className="text-white text-sm">
                          {new Date(txn.created_at).toLocaleDateString('en-IN')}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {new Date(txn.created_at).toLocaleTimeString('en-IN')}
                        </p>
                      </td>
                      <td className="p-3">
                        <p className="text-white text-sm font-mono">
                          {(txn.txn_id || txn.eko_tid || '-').substring(0, 12)}...
                        </p>
                        {txn.bank_ref_num && (
                          <p className="text-gray-500 text-xs">Ref: {txn.bank_ref_num}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <p className="text-white text-sm">{txn.customer_mobile || txn.sender_mobile || '-'}</p>
                        <p className="text-gray-500 text-xs">User: {txn.user_id?.substring(0, 8) || '-'}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-white text-sm">{txn.beneficiary_name || txn.recipient_name || '-'}</p>
                        <p className="text-gray-500 text-xs font-mono">
                          {txn.account_number || txn.recipient_account || '-'}
                        </p>
                      </td>
                      <td className="p-3">
                        <p className="text-white text-sm">{txn.bank_name || '-'}</p>
                        <p className="text-gray-500 text-xs">{txn.ifsc || '-'}</p>
                      </td>
                      <td className="p-3 text-right">
                        <p className="text-white text-sm font-semibold">
                          ₹{(txn.amount || 0).toLocaleString()}
                        </p>
                        {txn.prc_amount && (
                          <p className="text-violet-400 text-xs">{txn.prc_amount.toLocaleString()} PRC</p>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {getStatusBadge(txn.status)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded ${
                          txn.dmt_type === 'levin' ? 'bg-violet-500/20 text-violet-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {txn.dmt_type === 'levin' ? 'Levin' : 'V1'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-800">
              <p className="text-sm text-gray-400">
                Page {pagination.current_page} of {pagination.pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page <= 1}
                  className="border-gray-700 text-gray-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page >= pagination.pages}
                  className="border-gray-700 text-gray-300"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminDMTTransactions;
