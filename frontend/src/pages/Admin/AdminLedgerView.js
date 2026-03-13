import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { RefreshCw, Search, TrendingUp, TrendingDown, Activity, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminLedgerView = () => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [searchUserId, setSearchUserId] = useState('');
  const [selectedDays, setSelectedDays] = useState(7);
  const [filter, setFilter] = useState('all'); // all, credit, debit

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/ledger/summary?days=${selectedDays}`);
      const data = await res.json();
      if (data.success) {
        setSummary(data);
      }
    } catch (error) {
      console.error('Summary fetch error:', error);
    }
  }, [selectedDays]);

  const fetchRecentEntries = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/admin/ledger/recent?limit=50`;
      if (filter !== 'all') {
        url = `${API_URL}/api/admin/ledger/entries?entry_type=${filter}&days=${selectedDays}&limit=50`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries || []);
      }
    } catch (error) {
      console.error('Entries fetch error:', error);
      toast.error('Failed to load ledger entries');
    } finally {
      setLoading(false);
    }
  }, [filter, selectedDays]);

  const searchUser = async () => {
    if (!searchUserId.trim()) {
      toast.error('Please enter a User ID');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/ledger/user/${searchUserId.trim()}`);
      const data = await res.json();
      if (data.success) {
        setEntries(data.ledger?.entries || []);
        toast.success(`Found ${data.ledger?.count || 0} entries for ${data.user?.name || 'User'}`);
      } else {
        toast.error(data.detail || 'User not found');
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchRecentEntries();
  }, [fetchSummary, fetchRecentEntries]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount, type) => {
    const formatted = Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    if (type === 'credit') {
      return <span className="text-green-600 font-semibold">+{formatted}</span>;
    }
    return <span className="text-red-600 font-semibold">-{formatted}</span>;
  };

  return (
    <div className="space-y-6" data-testid="admin-ledger-view">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ledger View</h1>
          <p className="text-gray-500">Double-entry accounting ledger</p>
        </div>
        <Button 
          onClick={() => { fetchSummary(); fetchRecentEntries(); }} 
          disabled={loading}
          data-testid="refresh-ledger-btn"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Credits</p>
                  <p className="text-2xl font-bold text-green-600">
                    {summary.summary?.total_credits?.toLocaleString('en-IN')}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Debits</p>
                  <p className="text-2xl font-bold text-red-600">
                    {summary.summary?.total_debits?.toLocaleString('en-IN')}
                  </p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Net Flow</p>
                  <p className={`text-2xl font-bold ${summary.summary?.net_flow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.summary?.net_flow >= 0 ? '+' : ''}{summary.summary?.net_flow?.toLocaleString('en-IN')}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Entries</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {summary.summary?.total_entries?.toLocaleString('en-IN')}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-gray-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by User ID"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                className="w-64"
                data-testid="search-user-input"
              />
              <Button onClick={searchUser} variant="outline" data-testid="search-user-btn">
                <Search className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant={filter === 'all' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button 
                variant={filter === 'credit' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setFilter('credit')}
                className="text-green-600"
              >
                Credits
              </Button>
              <Button 
                variant={filter === 'debit' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setFilter('debit')}
                className="text-red-600"
              >
                Debits
              </Button>
            </div>
            
            <select
              value={selectedDays}
              onChange={(e) => setSelectedDays(Number(e.target.value))}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value={1}>Last 1 Day</option>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Ledger Entries ({entries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Balance After</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry, idx) => (
                  <tr key={entry.entry_id || idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{entry.user_name || entry.user_id?.slice(0, 8) || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.txn_type === 'mining' ? 'bg-yellow-100 text-yellow-800' :
                        entry.txn_type === 'withdrawal' ? 'bg-blue-100 text-blue-800' :
                        entry.txn_type === 'referral' ? 'bg-purple-100 text-purple-800' :
                        entry.txn_type === 'withdrawal_refund' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {entry.txn_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatAmount(entry.amount, entry.entry_type)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">
                      {entry.balance_after?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                      {entry.description}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {entry.reference || entry.txn_id?.slice(0, 12) || '-'}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No ledger entries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Types Summary */}
      {summary?.by_type && Object.keys(summary.by_type).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By Transaction Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(summary.by_type).map(([type, data]) => (
                <div key={type} className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-600 capitalize">{type.replace('_', ' ')}</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-green-600">+{data.credits?.toLocaleString('en-IN') || 0}</p>
                    <p className="text-red-600">-{data.debits?.toLocaleString('en-IN') || 0}</p>
                    <p className="text-xs text-gray-500">{data.count} entries</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminLedgerView;
