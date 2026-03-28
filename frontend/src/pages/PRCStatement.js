import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight, Filter, ArrowUpDown } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const TYPE_COLORS = {
  'Reward': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Recharge': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Bill Pay': { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  'Redeem': { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  'Bank Redeem': { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  'Voucher Redeem': { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  'Refund': { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  'Burn': { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  'Admin Credit': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'Admin Debit': { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  'Subscription': { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  'Other': { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30' },
};

const TypeBadge = ({ type }) => {
  const colors = TYPE_COLORS[type] || TYPE_COLORS['Other'];
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`} data-testid={`type-badge-${type}`}>
      {type}
    </span>
  );
};

const formatDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mon = months[d.getMonth()];
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${mon} ${h}:${m}`;
};

const formatPRC = (val) => {
  if (!val || val === 0) return '–';
  return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function PRCStatement({ user }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('All');
  const [sortOrder, setSortOrder] = useState('desc');
  const LIMIT = 20;

  const fetchStatement = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/prc-statement/${user.uid}?page=${page}&limit=${LIMIT}&filter_type=${filterType}&sort_order=${sortOrder}`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('Statement fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, page, filterType, sortOrder]);

  useEffect(() => { fetchStatement(); }, [fetchStatement]);

  const summary = data?.summary || {};
  const entries = data?.entries || [];
  const pagination = data?.pagination || {};
  const filters = data?.filters || [];

  return (
    <div className="min-h-screen bg-slate-950" data-testid="prc-statement-page">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 py-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 text-sm" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <h1 className="text-xl font-bold text-white mb-1">PRC Statement</h1>
        <p className="text-slate-400 text-xs">Your complete PRC passbook</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3" data-testid="summary-section">
          <Card className="bg-emerald-500/10 border-emerald-500/30 p-3 text-center">
            <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-slate-400 text-[10px] uppercase tracking-wider">Total Earned (CR)</p>
            <p className="text-emerald-400 font-bold text-sm mt-0.5" data-testid="total-earned">
              {formatPRC(summary.total_earned)} PRC
            </p>
          </Card>
          <Card className="bg-red-500/10 border-red-500/30 p-3 text-center">
            <TrendingDown className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className="text-slate-400 text-[10px] uppercase tracking-wider">Total Used (DR)</p>
            <p className="text-red-400 font-bold text-sm mt-0.5" data-testid="total-used">
              {formatPRC(summary.total_used)} PRC
            </p>
          </Card>
          <Card className="bg-blue-500/10 border-blue-500/30 p-3 text-center">
            <Wallet className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-slate-400 text-[10px] uppercase tracking-wider">Current Balance</p>
            <p className="text-blue-400 font-bold text-sm mt-0.5" data-testid="current-balance">
              {formatPRC(summary.current_balance)} PRC
            </p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide" data-testid="filter-section">
          <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
          {filters.map(f => (
            <button
              key={f}
              onClick={() => { setFilterType(f); setPage(1); }}
              data-testid={`filter-${f.replace(/\s+/g, '-')}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                filterType === f
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-400 hover:bg-slate-700 flex-shrink-0"
            data-testid="sort-toggle"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
          </button>
        </div>

        {/* Ledger Table — Desktop */}
        <div className="hidden md:block" data-testid="desktop-table">
          <Card className="bg-slate-900 border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Narration</th>
                  <th className="text-right p-3 text-emerald-400">CR</th>
                  <th className="text-right p-3 text-red-400">DR</th>
                  <th className="text-right p-3 text-blue-400">Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading...</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">No transactions found</td></tr>
                ) : entries.map((e, i) => (
                  <tr key={e.txn_id || i} className="border-t border-slate-800 hover:bg-slate-800/40 transition-colors" data-testid={`row-${i}`}>
                    <td className="p-3 text-slate-300 text-xs whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="p-3"><TypeBadge type={e.type} /></td>
                    <td className="p-3 text-slate-300 text-xs max-w-[200px] truncate">{e.narration}</td>
                    <td className="p-3 text-right text-emerald-400 font-mono text-xs">{e.credit > 0 ? formatPRC(e.credit) : '–'}</td>
                    <td className="p-3 text-right text-red-400 font-mono text-xs">{e.debit > 0 ? formatPRC(e.debit) : '–'}</td>
                    <td className="p-3 text-right text-blue-300 font-mono text-xs font-medium">{formatPRC(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Ledger Cards — Mobile */}
        <div className="md:hidden space-y-2" data-testid="mobile-cards">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No transactions found</div>
          ) : entries.map((e, i) => (
            <Card key={e.txn_id || i} className="bg-slate-900 border-slate-700/50 p-3" data-testid={`card-${i}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TypeBadge type={e.type} />
                  <span className="text-slate-500 text-[10px]">{formatDate(e.date)}</span>
                </div>
                <span className="text-blue-300 font-mono text-xs font-medium">{formatPRC(e.balance)}</span>
              </div>
              <p className="text-slate-300 text-xs mb-2 truncate">{e.narration}</p>
              <div className="flex gap-4">
                {e.credit > 0 && (
                  <span className="text-emerald-400 font-mono text-xs">+ {formatPRC(e.credit)} CR</span>
                )}
                {e.debit > 0 && (
                  <span className="text-red-400 font-mono text-xs">- {formatPRC(e.debit)} DR</span>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between pt-2" data-testid="pagination">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="border-slate-600 text-slate-300 disabled:opacity-30"
              data-testid="prev-page"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <span className="text-slate-500 text-xs">
              Page {page} of {pagination.total_pages} ({pagination.total_entries} entries)
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pagination.total_pages}
              onClick={() => setPage(p => p + 1)}
              className="border-slate-600 text-slate-300 disabled:opacity-30"
              data-testid="next-page"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
