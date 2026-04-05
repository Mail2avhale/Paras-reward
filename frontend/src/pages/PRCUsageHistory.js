import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingDown, Calendar, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API = process.env.REACT_APP_BACKEND_URL;

const TYPE_COLORS = {
  'Subscription': '#818cf8',
  'Burn': '#ef4444',
  'Bank Redeem': '#f59e0b',
  'Voucher Redeem': '#ec4899',
  'Recharge': '#3b82f6',
  'Bill Pay': '#8b5cf6',
  'Redeem': '#f97316',
  'Admin Debit': '#f43f5e',
  'Other': '#64748b',
};

const BAR_COLORS = ['#ef4444', '#f59e0b', '#818cf8', '#ec4899', '#3b82f6', '#8b5cf6', '#f97316'];

const formatPRC = (v) => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v.toFixed(1);
const formatMonth = (m) => {
  const [y, mo] = m.split('-');
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(mo)]} '${y.slice(2)}`;
};
const formatDay = (d) => {
  const dt = new Date(d);
  const day = dt.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[dt.getMonth()]}`;
};
const formatFullDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-slate-300 text-xs font-medium mb-1">{formatMonth(label)}</p>
      <p className="text-red-400 font-mono text-sm font-bold">{payload[0].value.toLocaleString('en-IN', { minimumFractionDigits: 2 })} PRC</p>
      <p className="text-slate-500 text-[10px]">{payload[0].payload.count} transactions</p>
    </div>
  );
};

const TypeBreakdownBar = ({ types, total }) => {
  if (!types || total === 0) return null;
  const sorted = Object.entries(types).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
      {sorted.map(([type, amount], i) => (
        <div
          key={type}
          style={{ width: `${(amount / total) * 100}%`, backgroundColor: TYPE_COLORS[type] || TYPE_COLORS['Other'] }}
          title={`${type}: ${amount.toFixed(2)} PRC`}
        />
      ))}
    </div>
  );
};

export default function PRCUsageHistory({ user }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState(null);

  const fetchUsage = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/prc-statement/usage-history/${user.uid}`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('Usage fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const summary = data?.summary || {};
  const graphData = data?.graph_data || [];
  const dailyBreakdown = data?.daily_breakdown || [];
  const byType = summary.by_type || {};

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950" data-testid="prc-usage-history">
      {/* Header */}
      <div className="bg-gradient-to-br from-red-950/40 via-slate-900 to-slate-900 border-b border-red-900/30 px-4 py-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 text-sm" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">PRC Usage History</h1>
            <p className="text-slate-400 text-xs">
              {data?.join_date ? `Since ${formatDay(data.join_date)}` : 'All time usage'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3" data-testid="usage-summary">
          <Card className="bg-red-500/10 border-red-500/30 p-3 text-center">
            <p className="text-slate-400 text-[10px] uppercase tracking-wider">Total Used</p>
            <p className="text-red-400 font-bold text-lg font-mono mt-1" data-testid="total-used-value">
              {summary.total_used?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-red-400/60 text-[10px]">PRC</p>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50 p-3 text-center">
            <p className="text-slate-400 text-[10px] uppercase tracking-wider">Transactions</p>
            <p className="text-white font-bold text-lg font-mono mt-1" data-testid="total-txns">
              {summary.total_transactions}
            </p>
            <p className="text-slate-500 text-[10px]">All time</p>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50 p-3 text-center">
            <p className="text-slate-400 text-[10px] uppercase tracking-wider">Months</p>
            <p className="text-white font-bold text-lg font-mono mt-1" data-testid="months-active">
              {summary.months_active}
            </p>
            <p className="text-slate-500 text-[10px]">Active</p>
          </Card>
        </div>

        {/* Type Breakdown */}
        {Object.keys(byType).length > 0 && (
          <Card className="bg-slate-900 border-slate-700/50 p-4" data-testid="type-breakdown">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Usage by Category</h3>
            <TypeBreakdownBar types={byType} total={summary.total_used} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, amount]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] || TYPE_COLORS['Other'] }} />
                    <span className="text-slate-400 text-xs">{type}</span>
                  </div>
                  <span className="text-slate-300 text-xs font-mono">{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} PRC</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Monthly Usage Chart */}
        {graphData.length > 0 && (
          <Card className="bg-slate-900 border-slate-700/50 p-4" data-testid="usage-chart">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-medium text-slate-300">Monthly Usage</h3>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatPRC} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {graphData.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Date-wise Breakdown */}
        <div data-testid="daily-breakdown">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-medium text-slate-300">Date-wise Usage</h3>
          </div>
          
          {dailyBreakdown.length === 0 ? (
            <Card className="bg-slate-900 border-slate-700/50 p-8 text-center">
              <p className="text-slate-500">No PRC usage recorded yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {dailyBreakdown.map((day) => {
                const isExpanded = expandedDay === day.date;
                return (
                  <Card key={day.date} className="bg-slate-900 border-slate-700/50 overflow-hidden" data-testid={`day-${day.date}`}>
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-800/50 transition-colors"
                      data-testid={`day-toggle-${day.date}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex flex-col items-center justify-center">
                          <span className="text-white font-bold text-sm leading-none">{new Date(day.date).getDate()}</span>
                          <span className="text-slate-500 text-[9px]">{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date(day.date).getMonth()]}</span>
                        </div>
                        <div className="text-left">
                          <p className="text-red-400 font-mono font-semibold text-sm">-{day.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} PRC</p>
                          <p className="text-slate-500 text-[10px]">{day.entries.length} transaction{day.entries.length > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </button>
                    
                    {isExpanded && (
                      <div className="border-t border-slate-800 px-3 pb-3" data-testid={`day-entries-${day.date}`}>
                        {day.entries.map((e, i) => (
                          <div key={e.txn_id || i} className="flex items-center justify-between py-2.5 border-b border-slate-800/50 last:border-0">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ color: TYPE_COLORS[e.type] || TYPE_COLORS['Other'], backgroundColor: `${TYPE_COLORS[e.type] || TYPE_COLORS['Other']}15` }}>
                                  {e.type}
                                </span>
                                <span className="text-slate-600 text-[10px]">{formatFullDate(e.time)}</span>
                              </div>
                              <p className="text-slate-400 text-xs mt-1 truncate pr-4">{e.narration}</p>
                            </div>
                            <span className="text-red-400 font-mono text-xs font-medium whitespace-nowrap">-{e.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
