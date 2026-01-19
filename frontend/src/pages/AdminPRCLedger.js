import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins, ArrowUpRight, ArrowDownRight, RefreshCw, Download,
  Filter, Search, TrendingUp, TrendingDown, Flame, ChevronLeft,
  ChevronRight, IndianRupee, Wallet, BarChart3, Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminPRCLedger = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState(null);
  const [filter, setFilter] = useState('all'); // all, credit, debit
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchLedger();
  }, [user, navigate, page, filter]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/admin/accounting/prc-ledger`, {
        params: { page, limit: 50, filter_type: filter }
      });
      setLedgerData(response.data);
    } catch (error) {
      console.error('Error fetching PRC ledger:', error);
      toast.error('Failed to load PRC ledger');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToBooks = async () => {
    setSyncing(true);
    try {
      const response = await axios.post(`${API}/api/admin/accounting/sync-prc-to-books`, null, {
        params: { admin_id: user.uid }
      });
      toast.success(`Synced ${response.data.transactions_processed || 0} transactions to Cash Book`);
      fetchLedger();
    } catch (error) {
      toast.error('Failed to sync PRC to books');
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatPRC = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !ledgerData) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="prc-ledger-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const summary = ledgerData?.summary || {};

  return (
    <div className="min-h-screen bg-gray-800/50 p-4 md:p-6" data-testid="admin-prc-ledger">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Coins className="h-7 w-7 text-amber-500" />
            PRC Ledger
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track all PRC mining, consumption, and burning transactions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={fetchLedger} size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={handleSyncToBooks} 
            size="sm" 
            className="bg-amber-500/100 hover:bg-amber-600"
            disabled={syncing}
            data-testid="sync-prc-btn"
          >
            <Zap className={`h-4 w-4 mr-2 ${syncing ? 'animate-pulse' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync to Cash Book'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total Mined */}
        <Card className="p-5 bg-gradient-to-br from-green-500 to-emerald-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Total Mined (CR)</p>
              <h2 className="text-2xl font-bold mt-1">{formatPRC(summary.total_mined_prc)} PRC</h2>
              <p className="text-green-200 text-sm mt-1">≈ {formatCurrency(summary.total_mined_inr)}</p>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </Card>

        {/* Total Consumed */}
        <Card className="p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Consumed (DR)</p>
              <h2 className="text-2xl font-bold mt-1">{formatPRC(summary.total_consumed_prc)} PRC</h2>
              <p className="text-blue-200 text-sm mt-1">≈ {formatCurrency(summary.total_consumed_inr)}</p>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <TrendingDown className="h-6 w-6" />
            </div>
          </div>
        </Card>

        {/* Total Burned */}
        <Card className="p-5 bg-gradient-to-br from-orange-500 to-red-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Total Burned</p>
              <h2 className="text-2xl font-bold mt-1">{formatPRC(summary.total_burned_prc)} PRC</h2>
              <p className="text-orange-200 text-sm mt-1">≈ {formatCurrency(summary.total_burned_inr)}</p>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <Flame className="h-6 w-6" />
            </div>
          </div>
        </Card>

        {/* Net Circulation */}
        <Card className="p-5 bg-gradient-to-br from-purple-500 to-pink-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Net in Circulation</p>
              <h2 className="text-2xl font-bold mt-1">{formatPRC(summary.net_circulation_prc)} PRC</h2>
              <p className="text-purple-200 text-sm mt-1">{summary.conversion_rate}</p>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <Wallet className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'all', label: 'All Transactions' },
          { id: 'credit', label: 'Credits (CR)' },
          { id: 'debit', label: 'Debits (DR)' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.id
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            data-testid={`filter-${f.id}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Ledger Table */}
      <Card className="overflow-hidden">
        <div className="p-4 bg-amber-500/10 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-amber-600" />
            PRC Transaction Ledger
          </h3>
          <span className="text-sm text-gray-500">
            Showing {ledgerData?.entries?.length || 0} of {ledgerData?.pagination?.total || 0}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">PRC Amount</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">INR Value</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">DR/CR</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!ledgerData?.entries?.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    No PRC transactions found
                  </td>
                </tr>
              ) : (
                ledgerData.entries.map((entry, idx) => (
                  <tr key={entry.id || idx} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(entry.date)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                      {entry.user_id && (
                        <p className="text-xs text-gray-500">User: {entry.user_id.substring(0, 8)}...</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        entry.type === 'mining' ? 'bg-green-500/20 text-green-400' :
                        entry.type === 'tap_game' ? 'bg-blue-500/20 text-blue-400' :
                        entry.type === 'referral' ? 'bg-purple-500/20 text-purple-400' :
                        entry.type === 'prc_burn' ? 'bg-red-500/20 text-red-400' :
                        entry.type === 'order' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-gray-100 text-gray-300'
                      }`}>
                        {entry.type?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      <span className={entry.dr_cr === 'CR' ? 'text-green-600' : 'text-red-600'}>
                        {entry.dr_cr === 'CR' ? '+' : '-'}{formatPRC(entry.prc_amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-600">
                      {formatCurrency(entry.inr_value)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        entry.dr_cr === 'CR' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {entry.dr_cr}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {ledgerData?.pagination?.total_pages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {ledgerData.pagination.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= ledgerData.pagination.total_pages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </Card>

      {/* Info Box */}
      <Card className="mt-4 p-4 bg-amber-500/10 border-amber-200">
        <div className="flex gap-3">
          <Coins className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-400">
            <p className="font-medium mb-1">PRC Conversion Rate</p>
            <p>10 PRC = ₹1 INR | Use "Sync to Cash Book" to add PRC value entries to your accounting books.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminPRCLedger;
