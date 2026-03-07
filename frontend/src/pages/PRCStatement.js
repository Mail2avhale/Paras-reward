import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Download, Filter, RefreshCw, Receipt, Gift, Building2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PRCStatement = ({ user }) => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('all');

  const fetchStatement = useCallback(async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        page: page.toString(),
        limit: '20'
      });
      if (filterType !== 'all') {
        params.append('transaction_type', filterType);
      }
      
      const response = await fetch(
        `${API_URL}/api/user/prc-statement/${user.uid}?${params}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch statement');
      
      const data = await response.json();
      setStatement(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, token, startDate, endDate, page, filterType]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const handleDownload = async () => {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        format: 'csv'
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
      case 'bank_transfer': return <Building2 className="w-4 h-4" />;
      default: return <RefreshCw className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'bill_payment': return 'bg-blue-500/20 text-blue-400';
      case 'gift_voucher': return 'bg-purple-500/20 text-purple-400';
      case 'bank_transfer': return 'bg-green-500/20 text-green-400';
      case 'refund': return 'bg-yellow-500/20 text-yellow-400';
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
            {['all', 'redeem', 'refund'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {type === 'all' ? 'All' : type === 'redeem' ? 'Redeemed' : 'Refunds'}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        {statement?.summary && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 rounded-xl p-4 border border-red-800/30">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs">Redeemed</span>
              </div>
              <p className="text-xl font-bold text-red-300">
                {statement.summary.total_redeemed_prc.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-400">PRC</p>
            </div>
            
            <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-4 border border-green-800/30">
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <ArrowDownLeft className="w-4 h-4" />
                <span className="text-xs">Refunded</span>
              </div>
              <p className="text-xl font-bold text-green-300">
                {statement.summary.total_refunded_prc.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-400">PRC</p>
            </div>
            
            <div className="col-span-2 bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 rounded-xl p-4 border border-emerald-800/30">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-400">Net Redeemed</p>
                  <p className="text-2xl font-bold text-emerald-300">
                    {statement.summary.net_redeemed_prc.toLocaleString('en-IN')} PRC
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">INR Value</p>
                  <p className="text-lg font-semibold text-white">
                    ₹{statement.summary.total_inr_value.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
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
          ) : statement?.entries?.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No transactions found for this period
            </div>
          ) : (
            <div className="divide-y divide-gray-700/50">
              {statement?.entries?.map((entry, idx) => (
                <div key={entry.id || idx} className="p-3 hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getCategoryColor(entry.category)}`}>
                      {getCategoryIcon(entry.category)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.narration}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{formatDate(entry.date)}</span>
                        {entry.reference && (
                          <span className="text-xs text-gray-500 truncate max-w-[120px]">
                            Ref: {entry.reference}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className={`text-sm font-bold ${
                        entry.type === 'refund' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {entry.type === 'refund' ? '+' : ''}{entry.prc_amount.toLocaleString('en-IN')} PRC
                      </p>
                      {entry.inr_value > 0 && (
                        <p className="text-xs text-gray-400">₹{entry.inr_value}</p>
                      )}
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
