import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight, Filter, ArrowUpDown, ChevronDown, ChevronUp, CalendarDays, ListChecks } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const TYPE_COLORS = {
  'Reward': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Referral Reward': { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },
  'Recharge': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Bill Pay': { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  'Redeem': { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  'Bank Redeem': { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  'Voucher Redeem': { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  'Refund': { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  'Burn': { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' },
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

// Feb 17 2026 — Day-level bucket key so that a single mining collect event
// spawning 10 commission rows (one per level) rolls up neatly.
const dayKey = (iso) => {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const humanDay = (key) => {
  if (!key || key === 'unknown') return 'Unknown';
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameYMD = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const base = `${String(d).padStart(2,'0')} ${months[m - 1]} ${y}`;
  if (sameYMD(date, today)) return `Today · ${base}`;
  if (sameYMD(date, yest))  return `Yesterday · ${base}`;
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${weekdays[date.getDay()]} · ${base}`;
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
  // Feb 17 2026 — Daily-summary vs detailed view. Default: 'daily' so a user
  // with 100+ downlines earning 10-level commission every day doesn't get
  // buried in thousands of rows. Detailed remains one tap away.
  const [viewMode, setViewMode] = useState('daily');
  const [expandedDays, setExpandedDays] = useState({}); // { 'YYYY-MM-DD': true }
  const LIMIT = viewMode === 'daily' ? 200 : 20;

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
  }, [user?.uid, page, filterType, sortOrder, LIMIT]);

  useEffect(() => { fetchStatement(); }, [fetchStatement]);

  const summary = data?.summary || {};
  const entries = data?.entries || [];
  const pagination = data?.pagination || {};
  const filters = data?.filters || [];

  // Client-side day-grouping for the Daily Summary view. Preserves the
  // fetched sort order (desc/asc).
  const dailyGroups = useMemo(() => {
    const bucket = new Map();
    for (const e of entries) {
      const key = dayKey(e.date);
      if (!bucket.has(key)) {
        bucket.set(key, { key, entries: [], credit: 0, debit: 0, community_bonus_count: 0, community_bonus_prc: 0 });
      }
      const g = bucket.get(key);
      g.entries.push(e);
      g.credit += Number(e.credit) || 0;
      g.debit += Number(e.debit) || 0;
      // Detect community mining commission rows — narration hint or type.
      const isCommunityBonus = (e.type === 'Referral Reward') || /community|referral|mining[- ]reward|level [0-9]|L[0-9]{1,2}/i.test(e.narration || '');
      if (isCommunityBonus) {
        g.community_bonus_count += 1;
        g.community_bonus_prc += Number(e.credit) || 0;
      }
    }
    return Array.from(bucket.values());
  }, [entries]);

  const toggleDay = (key) => setExpandedDays(prev => ({ ...prev, [key]: !prev[key] }));

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

        {/* View Mode Toggle — Daily Summary | Detailed (Feb 17 2026) */}
        <div className="flex items-center gap-2" data-testid="view-mode-toggle">
          <button
            onClick={() => { setViewMode('daily'); setPage(1); }}
            data-testid="view-mode-daily"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'daily'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> Daily Summary
          </button>
          <button
            onClick={() => { setViewMode('detailed'); setPage(1); }}
            data-testid="view-mode-detailed"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'detailed'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" /> Detailed
          </button>
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

        {/* ============ DAILY SUMMARY VIEW (Feb 17 2026) ============ */}
        {viewMode === 'daily' && (
          <div className="space-y-2" data-testid="daily-summary-view">
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : dailyGroups.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No transactions found</div>
            ) : dailyGroups.map((g) => {
              const net = g.credit - g.debit;
              const isOpen = !!expandedDays[g.key];
              return (
                <Card key={g.key} className="bg-slate-900 border-slate-700/50 overflow-hidden" data-testid={`daily-row-${g.key}`}>
                  {/* Day header (tap to expand) */}
                  <button
                    onClick={() => toggleDay(g.key)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-800/50 transition"
                    data-testid={`daily-toggle-${g.key}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                      <div className="text-left min-w-0">
                        <p className="text-white font-semibold text-sm leading-tight truncate">{humanDay(g.key)}</p>
                        <p className="text-slate-500 text-[10px] leading-tight mt-0.5">
                          <span className="tabular-nums">{g.entries.length}</span> txn{g.entries.length === 1 ? '' : 's'}
                          {g.community_bonus_count > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30 text-[9px] font-semibold">
                              🎯 {g.community_bonus_count} community
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-2">
                      <p className={`font-mono font-bold text-sm tabular-nums leading-tight ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`} data-testid={`daily-net-${g.key}`}>
                        {net >= 0 ? '+' : ''}{formatPRC(Math.abs(net))} PRC
                      </p>
                      <p className="text-[10px] text-slate-500 leading-tight tabular-nums">
                        <span className="text-emerald-500">+{formatPRC(g.credit)}</span>
                        {g.debit > 0 && <> · <span className="text-red-500">-{formatPRC(g.debit)}</span></>}
                      </p>
                    </div>
                  </button>
                  {/* Expanded detail rows */}
                  {isOpen && (
                    <div className="border-t border-slate-800 divide-y divide-slate-800/60" data-testid={`daily-expand-${g.key}`}>
                      {g.entries.map((e, i) => (
                        <div key={e.txn_id || i} className="px-3 py-2 hover:bg-slate-800/40" data-testid={`daily-entry-${g.key}-${i}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <TypeBadge type={e.type} />
                              <span className="text-slate-500 text-[10px] whitespace-nowrap">{formatDate(e.date)}</span>
                            </div>
                            <span className="text-blue-300 font-mono text-[10px] font-medium shrink-0 ml-2">{formatPRC(e.balance)}</span>
                          </div>
                          <p className="text-slate-300 text-[11px] mb-1 truncate">{e.narration}</p>
                          <div className="flex gap-3 text-[11px] font-mono">
                            {e.credit > 0 && <span className="text-emerald-400">+ {formatPRC(e.credit)} CR</span>}
                            {e.debit  > 0 && <span className="text-red-400">- {formatPRC(e.debit)} DR</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
            {/* Info hint */}
            {!loading && dailyGroups.length > 0 && (
              <p className="text-center text-[10px] text-slate-500 pt-2" data-testid="daily-hint">
                Showing {entries.length} recent txns grouped by day. Tap a day to see individual rows. Switch to <b>Detailed</b> for full pagination.
              </p>
            )}
          </div>
        )}

        {/* Ledger Table — Desktop (Detailed view only) */}
        {viewMode === 'detailed' && (
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
        )}

        {/* Ledger Cards — Mobile (Detailed view only) */}
        {viewMode === 'detailed' && (
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
        )}

        {/* Pagination (Detailed view only — Daily view fetches larger batches) */}
        {viewMode === 'detailed' && pagination.total_pages > 1 && (
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
