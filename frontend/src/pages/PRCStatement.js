import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Download, Filter, RefreshCw, Receipt, Gift, Building2, ArrowUpRight, ArrowDownLeft, Send, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PRCStatement = ({ user }) => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  
  // Filters - Start from user's joining date (or 1 year ago if not available)
  const [startDate, setStartDate] = useState(() => {
    // Try to get user's joining date
    if (user?.created_at) {
      const joinDate = new Date(user.created_at);
      return joinDate.toISOString().split('T')[0];
    }
    // Fallback to 1 year ago
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const fetchStatement = useCallback(async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        filter_type: filterType,
        service_type: categoryFilter
      });
      
      const response = await fetch(
        `${API_URL}/api/user/prc-statement/${user.uid}?${params}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch statement');
      
      const data = await response.json();
      
      // Transform data for UI
      setStatement({
        transactions: data.transactions || [],
        totals: {
          total_redeemed: data.summary?.total_debits || 0,
          total_refunded: data.summary?.total_refunds || 0,
          total_credits: data.summary?.total_credits || 0,
          net_prc: data.summary?.net_balance || 0
        },
        pagination: {
          total: data.summary?.transaction_count || 0,
          page: 1,
          pages: 1
        }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, token, startDate, endDate, filterType, categoryFilter]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const handleDownload = async () => {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        filter_type: filterType,
        service_type: categoryFilter
      });
      
      const response = await fetch(
        `${API_URL}/api/user/prc-statement/${user.uid}/download?${params}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prc_statement_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'bill_payment': return <Receipt className="w-4 h-4" />;
      case 'gift_voucher': return <Gift className="w-4 h-4" />;
      case 'bank_redeem': return <Building2 className="w-4 h-4" />;
      case 'dmt': return <Send className="w-4 h-4" />;
      case 'mining': return <Gift className="w-4 h-4" />;
      case 'referral': return <Gift className="w-4 h-4" />;
      case 'subscription': return <Receipt className="w-4 h-4" />;
      case 'refund': return <RefreshCw className="w-4 h-4" />;
      case 'subscription_payment': return <Receipt className="w-4 h-4" />;
      case 'shop': return <ShoppingBag className="w-4 h-4" />;
      case 'utility': return <Receipt className="w-4 h-4" />;
      default: return <Receipt className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'bill_payment': return 'bg-blue-500/20 text-blue-400';
      case 'gift_voucher': return 'bg-purple-500/20 text-purple-400';
      case 'bank_redeem': return 'bg-green-500/20 text-green-400';
      case 'dmt': return 'bg-cyan-500/20 text-cyan-400';
      case 'mining': return 'bg-amber-500/20 text-amber-400';
      case 'referral': return 'bg-pink-500/20 text-pink-400';
      case 'subscription': return 'bg-violet-500/20 text-violet-400';
      case 'refund': return 'bg-yellow-500/20 text-yellow-400';
      case 'subscription_payment': return 'bg-violet-500/20 text-violet-400';
      case 'shop': return 'bg-orange-500/20 text-orange-400';
      case 'utility': return 'bg-teal-500/20 text-teal-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold">PRC Statement</h1>
              <p className="text-xs text-gray-400">Redeem & Refund History</p>
            </div>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Filters */}
        <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm border border-gray-600 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm border border-gray-600 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            {['all', 'redeemed', 'refunds', 'credits'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {type === 'all' ? 'All' : type === 'redeemed' ? 'Debits' : type === 'refunds' ? 'Refunds' : 'Credits'}
              </button>
            ))}
          </div>
          
          {/* Category Filter */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Service Type</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm border border-gray-600 focus:border-emerald-500 outline-none"
            >
              <option value="all">All Services</option>
              <option value="bill_payment">BBPS (Bill Payments)</option>
              <option value="dmt">Money Transfer (DMT)</option>
              <option value="bank_redeem">Bank Withdrawals</option>
              <option value="gift_voucher">Gift Vouchers</option>
              <option value="shop">Shopping / Orders</option>
              <option value="utility">Utility / Recharge</option>
              <option value="mining">Mining Rewards</option>
              <option value="referral">Referral Bonus</option>
              <option value="subscription">Subscription</option>
              <option value="refund">Refunds Only</option>
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        {statement?.totals && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 rounded-xl p-4 border border-red-800/30">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs">Total Debits</span>
              </div>
              <p className="text-xl font-bold text-red-300">
                {statement.totals.total_redeemed?.toLocaleString('en-IN') || 0}
              </p>
              <p className="text-xs text-gray-400">PRC</p>
            </div>
            
            <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-4 border border-green-800/30">
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <ArrowDownLeft className="w-4 h-4" />
                <span className="text-xs">Total Credits</span>
              </div>
              <p className="text-xl font-bold text-green-300">
                {statement.totals.total_credits?.toLocaleString('en-IN') || 0}
              </p>
              <p className="text-xs text-gray-400">PRC</p>
            </div>
            
            <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/20 rounded-xl p-4 border border-amber-800/30">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <RefreshCw className="w-4 h-4" />
                <span className="text-xs">Refunded</span>
              </div>
              <p className="text-xl font-bold text-amber-300">
                {statement.totals.total_refunded?.toLocaleString('en-IN') || 0}
              </p>
              <p className="text-xs text-gray-400">PRC</p>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 rounded-xl p-4 border border-emerald-800/30">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Receipt className="w-4 h-4" />
                <span className="text-xs">Net Balance</span>
              </div>
              <p className="text-xl font-bold text-emerald-300">
                {statement.totals.net_prc?.toLocaleString('en-IN') || 0}
              </p>
              <p className="text-xs text-gray-400">PRC</p>
            </div>
          </div>
        )}

        {/* Transaction List */}
        <div className="bg-gray-800/50 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-medium text-sm">Transactions</h3>
            {statement?.pagination && (
              <span className="text-xs text-gray-400">
                {statement.pagination.total} entries
              </span>
            )}
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-400">
              {error}
              <button 
                onClick={fetchStatement}
                className="block mx-auto mt-2 text-sm text-emerald-400 hover:underline"
              >
                Retry
              </button>
            </div>
          ) : statement?.transactions?.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No transactions found for this period
            </div>
          ) : (
            <div className="divide-y divide-gray-700/50">
              {statement?.transactions?.map((entry, idx) => (
                <div key={entry.id || idx} className="p-3 hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getCategoryColor(entry.category)}`}>
                      {getCategoryIcon(entry.category)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{formatDate(entry.date)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          entry.status === 'success' ? 'bg-green-500/20 text-green-400' :
                          entry.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          entry.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {entry.status}
                        </span>
                        {entry.reference && (
                          <span className="text-xs text-gray-500 truncate max-w-[100px]">
                            {entry.reference}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className={`text-sm font-bold ${
                        entry.type === 'credit' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {entry.type === 'credit' ? '+' : '-'}{entry.amount?.toLocaleString('en-IN')} PRC
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{entry.category}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {statement?.pagination && statement.pagination.pages > 1 && (
            <div className="p-3 border-t border-gray-700 flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-gray-700 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {page} of {statement.pagination.pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(statement.pagination.pages, p + 1))}
                disabled={page === statement.pagination.pages}
                className="px-3 py-1.5 rounded-lg bg-gray-700 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PRCStatement;
