import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import Pagination from '../components/Pagination';
import {
  Book, Search, Download, RefreshCw, User, ArrowUpRight, ArrowDownLeft,
  Filter, Calendar, Wallet, TrendingUp, TrendingDown, FileText
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const TRANSACTION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'mining', label: 'Mining' },
  { value: 'tap_game', label: 'Tap Game' },
  { value: 'referral', label: 'Referral' },
  { value: 'cashback', label: 'Cashback' },
  { value: 'order', label: 'Order' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'prc_burn', label: 'PRC Burn' },
  { value: 'admin_credit', label: 'Admin Credit' },
  { value: 'admin_debit', label: 'Admin Debit' },
  { value: 'bill_payment_request', label: 'Bill Payment' },
  { value: 'gift_voucher_request', label: 'Gift Voucher' },
];

const WALLET_TYPES = [
  { value: '', label: 'All Wallets' },
  { value: 'prc', label: 'PRC Wallet' },
  { value: 'cash_wallet', label: 'Cash Wallet' },
];

const AdminUserLedger = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState({
    user_id: '',
    wallet_type: '',
    transaction_type: '',
    date_from: '',
    date_to: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchLedger();
  }, [user, navigate, page]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 50 });
      
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.wallet_type) params.append('wallet_type', filters.wallet_type);
      if (filters.transaction_type) params.append('transaction_type', filters.transaction_type);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      
      const response = await axios.get(`${API}/api/admin/finance/user-ledger?${params}`);
      setTransactions(response.data.transactions || []);
      setSummary(response.data.summary || {});
      setTotal(response.data.total || 0);
      setTotalPages(response.data.total_pages || 1);
    } catch (error) {
      toast.error('Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setPage(1);
    fetchLedger();
  };

  const clearFilters = () => {
    setFilters({
      user_id: '',
      wallet_type: '',
      transaction_type: '',
      date_from: '',
      date_to: ''
    });
    setPage(1);
    setTimeout(fetchLedger, 100);
  };

  const exportCSV = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/finance/export/user-ledger/all`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `user_ledger_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export downloaded');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getTypeColor = (type) => {
    const creditTypes = ['mining', 'tap_game', 'referral', 'cashback', 'withdrawal_rejected', 'admin_credit', 'profit_share'];
    return creditTypes.includes(type) ? 'text-green-600' : 'text-red-600';
  };

  const getTypeIcon = (type) => {
    const creditTypes = ['mining', 'tap_game', 'referral', 'cashback', 'withdrawal_rejected', 'admin_credit', 'profit_share'];
    return creditTypes.includes(type) ? ArrowUpRight : ArrowDownLeft;
  };

  return (
    <div className="p-6 bg-gray-800/50 min-h-screen" data-testid="admin-user-ledger">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Book className="h-6 w-6 text-purple-600" />
            User Wallet Ledger
          </h1>
          <p className="text-gray-500 mt-1">Comprehensive view of all user transactions (Read-only)</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
            data-testid="toggle-filters-btn"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button
            variant="outline"
            onClick={fetchLedger}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Credits</p>
              <p className="text-2xl font-bold">
                {Object.entries(summary)
                  .filter(([type]) => ['mining', 'tap_game', 'referral', 'cashback', 'admin_credit'].includes(type))
                  .reduce((sum, [, data]) => sum + (data?.amount || 0), 0)
                  .toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingUp className="h-10 w-10 text-green-200" />
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Total Debits</p>
              <p className="text-2xl font-bold">
                {Object.entries(summary)
                  .filter(([type]) => ['order', 'withdrawal', 'admin_debit', 'prc_burn'].includes(type))
                  .reduce((sum, [, data]) => sum + (data?.amount || 0), 0)
                  .toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingDown className="h-10 w-10 text-red-200" />
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Total Transactions</p>
              <p className="text-2xl font-bold">{total.toLocaleString()}</p>
            </div>
            <FileText className="h-10 w-10 text-purple-200" />
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Unique Users</p>
              <p className="text-2xl font-bold">
                {new Set(transactions.map(t => t.user_id)).size}
              </p>
            </div>
            <User className="h-10 w-10 text-blue-200" />
          </div>
        </Card>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-4 mb-6" data-testid="filters-panel">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filter Transactions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">User ID</label>
              <Input
                placeholder="Enter User ID"
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                data-testid="filter-user-id"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Wallet Type</label>
              <select
                className="w-full p-2 border rounded-lg"
                value={filters.wallet_type}
                onChange={(e) => setFilters({ ...filters, wallet_type: e.target.value })}
                data-testid="filter-wallet-type"
              >
                {WALLET_TYPES.map(w => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Transaction Type</label>
              <select
                className="w-full p-2 border rounded-lg"
                value={filters.transaction_type}
                onChange={(e) => setFilters({ ...filters, transaction_type: e.target.value })}
                data-testid="filter-txn-type"
              >
                {TRANSACTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">From Date</label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                data-testid="filter-date-from"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">To Date</label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                data-testid="filter-date-to"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={applyFilters} data-testid="apply-filters-btn">
              Apply Filters
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        </Card>
      )}

      {/* Transactions Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="ledger-table">
            <thead className="bg-gray-800/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance After</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => {
                  const Icon = getTypeIcon(txn.type);
                  return (
                    <tr key={txn.transaction_id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-400">
                        {txn.transaction_id?.slice(0, 15)}...
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">{txn.user_name}</div>
                        <div className="text-xs text-gray-500">{txn.user_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(txn.type)} bg-gray-800`}>
                          <Icon className="h-3 w-3" />
                          {txn.type?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 capitalize">
                        {txn.wallet_type?.replace(/_/g, ' ')}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium text-right ${getTypeColor(txn.type)}`}>
                        {['mining', 'tap_game', 'referral', 'cashback', 'admin_credit'].includes(txn.type) ? '+' : '-'}
                        {txn.amount?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 text-right">
                        {txn.balance_after?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">
                        {txn.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(txn.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {/* Note */}
      <div className="mt-4 p-4 bg-amber-500/10 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-400">
          <strong>Note:</strong> This ledger is read-only and append-only. All transactions are permanently recorded and cannot be modified or deleted. Use the Export feature to download records for accounting purposes.
        </p>
      </div>
    </div>
  );
};

export default AdminUserLedger;
