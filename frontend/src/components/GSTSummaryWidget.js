import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Receipt, TrendingUp, Calendar, IndianRupee, 
  ArrowUpRight, ArrowDownRight, RefreshCw,
  Wallet, CreditCard, Coins, Wrench, AlertTriangle, X, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

import { API } from "../lib/api";

const GSTSummaryWidget = ({ token, adminId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showRepair, setShowRepair] = useState(false);
  const [repairPreview, setRepairPreview] = useState(null);
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairDone, setRepairDone] = useState(null);

  useEffect(() => {
    fetchGSTSummary();
  }, []);

  const fetchGSTSummary = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get(`${API}/admin/gst-summary`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setData(response.data);
    } catch (error) {
      console.error('GST Summary fetch error:', error);
      toast.error('Failed to load GST summary');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openRepair = async () => {
    setShowRepair(true);
    setRepairDone(null);
    setRepairPreview(null);
    setRepairLoading(true);
    try {
      const res = await axios.post(
        `${API}/admin/company-wallets/repair-prc-units`,
        { admin_id: adminId, dry_run: true },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setRepairPreview(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to preview repair');
      setShowRepair(false);
    } finally {
      setRepairLoading(false);
    }
  };

  const applyRepair = async () => {
    setRepairLoading(true);
    try {
      const res = await axios.post(
        `${API}/admin/company-wallets/repair-prc-units`,
        { admin_id: adminId },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setRepairDone(res.data);
      toast.success(`Repaired ${res.data.repaired} entries to INR`);
      await fetchGSTSummary();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Repair failed');
    } finally {
      setRepairLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, source_breakdown, trend, recent_transactions } = data;

  // Calculate week-over-week growth
  const weekGrowth = summary?.this_week > 0 ? 
    ((summary.this_week - (summary.this_month / 4)) / (summary.this_month / 4) * 100).toFixed(1) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-testid="gst-summary-widget">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">GST Collection Summary</h3>
              <p className="text-xs text-gray-500">18% GST on all subscriptions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {adminId && (
              <button
                onClick={openRepair}
                title="Run one-time repair for old PRC-unit entries"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-200 hover:bg-amber-50 text-amber-700 text-xs font-medium transition-colors"
                data-testid="gst-repair-btn"
              >
                <Wrench className="w-3.5 h-3.5" />
                Repair
              </button>
            )}
            <button 
              onClick={fetchGSTSummary}
              disabled={refreshing}
              className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-600 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Repair Modal */}
      {showRepair && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !repairLoading && setShowRepair(false)}
          data-testid="gst-repair-modal"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 bg-amber-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-gray-900">Repair PRC-Unit GST Entries</h3>
              </div>
              <button
                onClick={() => !repairLoading && setShowRepair(false)}
                className="p-1 hover:bg-amber-100 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {repairLoading && !repairPreview && !repairDone && (
                <p className="text-sm text-gray-500">Scanning…</p>
              )}

              {repairPreview && !repairDone && (
                <>
                  <p className="text-sm text-gray-700">
                    Found <b>{repairPreview.to_repair}</b> legacy PRC-unit entries
                    (out of {repairPreview.scanned} scanned).
                  </p>
                  {repairPreview.balance_deltas_to_subtract && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
                      <p className="font-semibold text-amber-800 mb-1">Wallet balance will be reduced by:</p>
                      {Object.entries(repairPreview.balance_deltas_to_subtract).map(([w, v]) => (
                        <div key={w} className="flex justify-between">
                          <span className="text-gray-700">{w.replace(/_/g, ' ')}</span>
                          <span className="font-semibold text-red-600">-₹{Number(v).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {repairPreview.sample?.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-1">
                      <p className="font-semibold text-gray-700 mb-1">Sample conversions:</p>
                      {repairPreview.sample.map((s, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-gray-600">{s.wallet}</span>
                          <span>
                            <span className="line-through text-gray-400">₹{s.old_prc}</span>
                            {' → '}
                            <span className="font-semibold text-emerald-600">₹{s.new_inr}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {repairPreview.to_repair === 0 ? (
                    <p className="text-emerald-700 text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> All entries already in INR. Nothing to repair.
                    </p>
                  ) : (
                    <button
                      onClick={applyRepair}
                      disabled={repairLoading}
                      className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm disabled:opacity-60"
                      data-testid="gst-repair-confirm-btn"
                    >
                      {repairLoading ? 'Repairing…' : `Apply Repair (${repairPreview.to_repair} entries)`}
                    </button>
                  )}
                </>
              )}

              {repairDone && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <p className="font-semibold">Repair Complete</p>
                  </div>
                  <p className="text-sm text-gray-700">
                    {repairDone.repaired} entries converted to INR. Wallet balances reset.
                  </p>
                  <button
                    onClick={() => setShowRepair(false)}
                    className="w-full py-2 rounded-lg bg-slate-900 text-white text-sm"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Total GST */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee className="w-4 h-4 opacity-80" />
              <span className="text-xs font-medium opacity-80">Total Collected</span>
            </div>
            <p className="text-2xl font-bold">₹{summary?.total_gst_collected?.toLocaleString('en-IN') || 0}</p>
          </div>

          {/* Today */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Today</span>
            </div>
            <p className="text-xl font-bold text-gray-900">₹{summary?.today?.toLocaleString('en-IN') || 0}</p>
          </div>

          {/* This Week */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">This Week</span>
              </div>
              {parseFloat(weekGrowth) > 0 && (
                <span className="text-xs text-emerald-600 flex items-center">
                  <ArrowUpRight className="w-3 h-3" />
                  {weekGrowth}%
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-gray-900">₹{summary?.this_week?.toLocaleString('en-IN') || 0}</p>
          </div>

          {/* This Month */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">This Month</span>
            </div>
            <p className="text-xl font-bold text-gray-900">₹{summary?.this_month?.toLocaleString('en-IN') || 0}</p>
          </div>
        </div>

        {/* Source Breakdown */}
        {source_breakdown && Object.keys(source_breakdown).length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">GST by Source</h4>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(source_breakdown).map(([source, data]) => (
                <div key={source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2">
                    {source.includes('PRC') ? (
                      <Coins className="w-4 h-4 text-purple-500" />
                    ) : (
                      <CreditCard className="w-4 h-4 text-amber-500" />
                    )}
                    <span className="text-sm text-gray-700">{source}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">₹{data.amount?.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-gray-500">{data.count} txns</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 30-Day Trend Chart (Simple Bar) */}
        {trend?.daily?.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">30-Day Trend</h4>
            <div className="h-24 flex items-end gap-1">
              {trend.daily.slice(-30).map((day, idx) => {
                const maxAmount = Math.max(...trend.daily.map(d => d.amount)) || 1;
                const height = (day.amount / maxAmount) * 100;
                return (
                  <div 
                    key={idx}
                    className="flex-1 bg-emerald-500 rounded-t hover:bg-emerald-600 transition-colors cursor-pointer group relative"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${day.date}: ₹${day.amount.toLocaleString('en-IN')}`}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {day.date.slice(5)}: ₹{day.amount}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        {recent_transactions?.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent GST Credits</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recent_transactions.slice(0, 5).map((txn, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-700">{txn.description || 'GST Credit'}</p>
                      <p className="text-xs text-gray-400">
                        {txn.timestamp ? new Date(txn.timestamp).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        }) : '-'}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">+₹{txn.amount?.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!recent_transactions || recent_transactions.length === 0) && summary?.total_gst_collected === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No GST collected yet</p>
            <p className="text-xs mt-1">GST will appear here when subscriptions are activated</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          GST @ 18% • Formula: Base Price × 0.18 • Auto-routed to GST Collection Wallet
        </p>
      </div>
    </div>
  );
};

export default GSTSummaryWidget;
