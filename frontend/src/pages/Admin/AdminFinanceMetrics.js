/**
 * AdminFinanceMetrics — mandatory daily finance metrics for the finance team.
 *
 * Shows 11 metrics per calendar day + totals row:
 *   1) PRC Issued            (mining, tap, referral, cashback etc.)
 *   2) PRC Collected         (user spend on any service)
 *   3) PRC Redeemed          (bank cash-out)
 *   4) PRC Outstanding       (net PRC in circulation — snapshot)
 *   5) Redemption Value      (INR)
 *   6) Service Charges       (20% cash fee collected)
 *   7) GST Collected         (18% of subscription revenue)
 *   8) Merchant Contribution (from partner store + mall)
 *   9) Shopping Revenue      (partner store + mall spend)
 *  10) Redemption Cost       (Redemption Value + 10% overhead)
 *  11) Net Contribution      (Service + GST + Merchant + Shopping − Cost)
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  BarChart3, Coins, TrendingUp, TrendingDown, IndianRupee, RefreshCw,
  Store, ShoppingBag, Download, Calendar,
} from 'lucide-react';
import { API } from '../../lib/api';

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtPRC = (n) => `${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} PRC`;

const KpiTile = ({ icon: Icon, label, value, sub, color = 'text-slate-900', testid }) => (
  <Card className="p-4 bg-white border-slate-200" data-testid={testid}>
    <div className="flex items-center gap-2 text-xs text-slate-500 uppercase font-semibold">
      <Icon className="w-3.5 h-3.5" /> {label}
    </div>
    <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
    {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
  </Card>
);

const AdminFinanceMetrics = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState({ series: [], totals: {} });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await axios.get(`${API}/admin/finance/daily-metrics?days=${days}`);
      setData(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load metrics');
    } finally {
      setBusy(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const totals = data.totals || {};

  const exportCsv = () => {
    if (!data.series?.length) return toast.error('No data to export');
    const cols = [
      'date', 'prc_issued', 'prc_collected', 'prc_redeemed', 'prc_outstanding',
      'redemption_value_inr', 'service_charges_inr', 'gst_collected_inr',
      'merchant_contribution_inr', 'shopping_revenue_inr',
      'redemption_cost_inr', 'net_contribution_inr',
    ];
    const header = cols.join(',');
    const rows = data.series.map((r) => cols.map((c) => r[c] ?? 0).join(','));
    const csv = [header, ...rows, cols.map((c) => totals[c] ?? '').join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-metrics-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4" data-testid="admin-finance-metrics-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-500" />
            Daily Finance Metrics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            11 mandatory operational metrics per calendar day (UTC) · totals across the window
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
            data-testid="days-filter"
          >
            {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>Last {d}d</option>)}
          </select>
          <Button onClick={load} disabled={busy} variant="outline" size="sm" data-testid="refresh-metrics-btn">
            {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span className="ml-1">Refresh</span>
          </Button>
          <Button onClick={exportCsv} size="sm" data-testid="export-csv-btn">
            <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Totals — 11 KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile icon={TrendingUp}    label="PRC Issued"           value={fmtPRC(totals.prc_issued)}           color="text-emerald-600" testid="kpi-prc-issued" />
        <KpiTile icon={Coins}         label="PRC Collected"        value={fmtPRC(totals.prc_collected)}        color="text-amber-600"   testid="kpi-prc-collected" />
        <KpiTile icon={TrendingDown}  label="PRC Redeemed"         value={fmtPRC(totals.prc_redeemed)}         color="text-red-600"     testid="kpi-prc-redeemed" />
        <KpiTile icon={Coins}         label="PRC Outstanding"      value={fmtPRC(totals.prc_outstanding)}      color="text-indigo-700"  testid="kpi-prc-outstanding" sub="Live snapshot" />
        <KpiTile icon={IndianRupee}   label="Redemption Value"     value={fmtINR(totals.redemption_value_inr)} testid="kpi-redemption-value" />
        <KpiTile icon={IndianRupee}   label="Service Charges"      value={fmtINR(totals.service_charges_inr)}  color="text-emerald-700" testid="kpi-service-charges" />
        <KpiTile icon={IndianRupee}   label="GST Collected"        value={fmtINR(totals.gst_collected_inr)}    testid="kpi-gst" />
        <KpiTile icon={Store}         label="Merchant Contrib."    value={fmtINR(totals.merchant_contribution_inr)} testid="kpi-merchant" />
        <KpiTile icon={ShoppingBag}   label="Shopping Revenue"     value={fmtINR(totals.shopping_revenue_inr)} testid="kpi-shopping" />
        <KpiTile icon={IndianRupee}   label="Redemption Cost"      value={fmtINR(totals.redemption_cost_inr)}  color="text-red-600"     testid="kpi-redemption-cost" />
        <KpiTile
          icon={IndianRupee}
          label="Net Contribution"
          value={fmtINR(totals.net_contribution_inr)}
          color={Number(totals.net_contribution_inr) >= 0 ? 'text-emerald-700' : 'text-red-700'}
          sub={Number(totals.net_contribution_inr) >= 0 ? 'PROFIT' : 'LOSS'}
          testid="kpi-net-contribution"
        />
        <KpiTile icon={Calendar}      label="Window"               value={totals.date || '—'} sub={`${days} days`} testid="kpi-window" />
      </div>

      {/* Day-wise table */}
      <Card className="overflow-x-auto bg-white border-slate-200" data-testid="metrics-table">
        <table className="w-full text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-2 py-2 text-left font-semibold sticky left-0 bg-slate-100">Date</th>
              <th className="px-2 py-2 text-right font-semibold">PRC Issued</th>
              <th className="px-2 py-2 text-right font-semibold">PRC Collected</th>
              <th className="px-2 py-2 text-right font-semibold">PRC Redeemed</th>
              <th className="px-2 py-2 text-right font-semibold">PRC Outstd.</th>
              <th className="px-2 py-2 text-right font-semibold">Redem. Value</th>
              <th className="px-2 py-2 text-right font-semibold">Svc Charges</th>
              <th className="px-2 py-2 text-right font-semibold">GST</th>
              <th className="px-2 py-2 text-right font-semibold">Merchant</th>
              <th className="px-2 py-2 text-right font-semibold">Shopping</th>
              <th className="px-2 py-2 text-right font-semibold">Redem. Cost</th>
              <th className="px-2 py-2 text-right font-semibold">Net Contrib.</th>
            </tr>
          </thead>
          <tbody>
            {(data.series || []).map((r) => (
              <tr key={r.date} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-2 py-1.5 sticky left-0 bg-white font-medium">{r.date}</td>
                <td className="px-2 py-1.5 text-right text-emerald-600">{fmtPRC(r.prc_issued)}</td>
                <td className="px-2 py-1.5 text-right text-amber-600">{fmtPRC(r.prc_collected)}</td>
                <td className="px-2 py-1.5 text-right text-red-600">{fmtPRC(r.prc_redeemed)}</td>
                <td className="px-2 py-1.5 text-right text-indigo-700 font-semibold">{fmtPRC(r.prc_outstanding)}</td>
                <td className="px-2 py-1.5 text-right">{fmtINR(r.redemption_value_inr)}</td>
                <td className="px-2 py-1.5 text-right text-emerald-700">{fmtINR(r.service_charges_inr)}</td>
                <td className="px-2 py-1.5 text-right">{fmtINR(r.gst_collected_inr)}</td>
                <td className="px-2 py-1.5 text-right">{fmtINR(r.merchant_contribution_inr)}</td>
                <td className="px-2 py-1.5 text-right">{fmtINR(r.shopping_revenue_inr)}</td>
                <td className="px-2 py-1.5 text-right text-red-600">{fmtINR(r.redemption_cost_inr)}</td>
                <td className={`px-2 py-1.5 text-right font-bold ${Number(r.net_contribution_inr) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {fmtINR(r.net_contribution_inr)}
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr className="bg-indigo-50 border-t-2 border-indigo-300 font-bold">
              <td className="px-2 py-2 sticky left-0 bg-indigo-50">TOTALS</td>
              <td className="px-2 py-2 text-right">{fmtPRC(totals.prc_issued)}</td>
              <td className="px-2 py-2 text-right">{fmtPRC(totals.prc_collected)}</td>
              <td className="px-2 py-2 text-right">{fmtPRC(totals.prc_redeemed)}</td>
              <td className="px-2 py-2 text-right">{fmtPRC(totals.prc_outstanding)}</td>
              <td className="px-2 py-2 text-right">{fmtINR(totals.redemption_value_inr)}</td>
              <td className="px-2 py-2 text-right">{fmtINR(totals.service_charges_inr)}</td>
              <td className="px-2 py-2 text-right">{fmtINR(totals.gst_collected_inr)}</td>
              <td className="px-2 py-2 text-right">{fmtINR(totals.merchant_contribution_inr)}</td>
              <td className="px-2 py-2 text-right">{fmtINR(totals.shopping_revenue_inr)}</td>
              <td className="px-2 py-2 text-right">{fmtINR(totals.redemption_cost_inr)}</td>
              <td className={`px-2 py-2 text-right ${Number(totals.net_contribution_inr) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {fmtINR(totals.net_contribution_inr)}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <p className="text-[10px] text-slate-400">
        Metrics computed live from the transactions ledger, bank_transfer_requests,
        redemption_service_charges, subscription_payments, partner_store_transactions
        and mall_bookings collections. PRC ↔ INR rate: 1 INR = {(data.series?.[0]?.prc_per_inr) || 10} PRC.
      </p>
    </div>
  );
};

export default AdminFinanceMetrics;
