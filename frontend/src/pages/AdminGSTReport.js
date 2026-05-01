import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import {
  Receipt, FileText, MapPin, Calendar, Download, RefreshCw,
  Building2, TrendingUp, Layers,
} from 'lucide-react';

import { API } from "../lib/api";

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const AdminGSTReport = () => {
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [yearlyData, setYearlyData] = useState(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const [monthlyRes, yearlyRes] = await Promise.all([
        axios.get(`${API}/invoice/admin/state-wise-report`, { params: { month, year } }),
        axios.get(`${API}/invoice/admin/yearly-gst-summary`, { params: { year } }),
      ]);
      setReportData(monthlyRes.data);
      setYearlyData(yearlyRes.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load GST report');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const exportCSV = () => {
    if (!reportData?.states?.length) {
      toast.info('No data to export');
      return;
    }
    const rows = [
      ['State', 'GST Type', 'Invoices', 'Base (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Total GST (₹)', 'Total Amount (₹)'],
      ...reportData.states.map((s) => [
        s.state, s.gst_type, s.invoice_count,
        s.total_base.toFixed(2), s.cgst.toFixed(2), s.sgst.toFixed(2),
        s.igst.toFixed(2), s.total_gst.toFixed(2), s.total_amount.toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST-StateWise-${MONTHS[month - 1]}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const summary = reportData?.summary || {};
  const states = reportData?.states || [];

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="admin-gst-report">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-purple-600" />
            State-wise GST Report
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monthly GST collected, grouped by customer state. Company state:{' '}
            <span className="font-semibold text-slate-700">{reportData?.company_state || 'Maharashtra'}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            data-testid="gst-report-month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
          >
            {MONTHS.map((m, i) => (<option key={m} value={i + 1}>{m}</option>))}
          </select>
          <select
            data-testid="gst-report-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={fetchReport} data-testid="gst-report-refresh">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={exportCSV}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="gst-report-export-csv"
          >
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-600 font-medium">Total GST Collected</div>
              <div className="text-2xl font-bold text-purple-700 mt-1" data-testid="gst-total">
                ₹{(summary.total_gst || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <Receipt className="w-8 h-8 text-purple-400" />
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {summary.total_invoices || 0} invoices in {reportData?.period_label}
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-600 font-medium">CGST + SGST (Intra-state)</div>
              <div className="text-xl font-bold text-blue-700 mt-1">
                ₹{((summary.total_cgst || 0) + (summary.total_sgst || 0)).toLocaleString('en-IN')}
              </div>
            </div>
            <Building2 className="w-8 h-8 text-blue-400" />
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {summary.intra_state_count || 0} invoices · CGST ₹{(summary.total_cgst || 0).toFixed(0)} + SGST ₹{(summary.total_sgst || 0).toFixed(0)}
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-600 font-medium">IGST (Inter-state)</div>
              <div className="text-xl font-bold text-orange-700 mt-1">
                ₹{(summary.total_igst || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <Layers className="w-8 h-8 text-orange-400" />
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {summary.inter_state_count || 0} invoices across {Math.max(0, (reportData?.total_states || 0) - 1)} states
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-600 font-medium">Total Revenue (incl. GST)</div>
              <div className="text-xl font-bold text-slate-700 mt-1">
                ₹{(summary.total_amount || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <TrendingUp className="w-8 h-8 text-slate-400" />
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Base: ₹{(summary.total_base || 0).toLocaleString('en-IN')}
          </div>
        </Card>
      </div>

      {/* State-wise Table */}
      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-600" />
            State-wise Breakdown · {reportData?.period_label}
          </h2>
          <span className="text-sm text-slate-500">{reportData?.total_states || 0} states</span>
        </div>

        {states.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto text-slate-300" />
            <p className="mt-3 text-slate-500">No GST invoices found for {reportData?.period_label}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase">
                  <th className="text-left p-3 font-semibold">State</th>
                  <th className="text-center p-3 font-semibold">GST Type</th>
                  <th className="text-right p-3 font-semibold">Invoices</th>
                  <th className="text-right p-3 font-semibold">Base (₹)</th>
                  <th className="text-right p-3 font-semibold">CGST (₹)</th>
                  <th className="text-right p-3 font-semibold">SGST (₹)</th>
                  <th className="text-right p-3 font-semibold">IGST (₹)</th>
                  <th className="text-right p-3 font-semibold bg-purple-50">Total GST (₹)</th>
                  <th className="text-right p-3 font-semibold">Gross (₹)</th>
                </tr>
              </thead>
              <tbody data-testid="gst-states-tbody">
                {states.map((s, idx) => (
                  <tr key={s.state} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="p-3 font-medium text-slate-800">
                      {s.state}
                      {s.is_intra_state && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Home State</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.gst_type === 'CGST+SGST' ? 'bg-blue-100 text-blue-700'
                          : s.gst_type === 'IGST' ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {s.gst_type}
                      </span>
                    </td>
                    <td className="p-3 text-right text-slate-700">{s.invoice_count}</td>
                    <td className="p-3 text-right text-slate-700">{s.total_base.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right text-slate-700">{s.cgst > 0 ? s.cgst.toLocaleString('en-IN') : '—'}</td>
                    <td className="p-3 text-right text-slate-700">{s.sgst > 0 ? s.sgst.toLocaleString('en-IN') : '—'}</td>
                    <td className="p-3 text-right text-slate-700">{s.igst > 0 ? s.igst.toLocaleString('en-IN') : '—'}</td>
                    <td className="p-3 text-right font-bold text-purple-700 bg-purple-50/40">
                      ₹{s.total_gst.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-right text-slate-700">{s.total_amount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-800">
                  <td className="p-3" colSpan="2">Total</td>
                  <td className="p-3 text-right">{summary.total_invoices || 0}</td>
                  <td className="p-3 text-right">{(summary.total_base || 0).toLocaleString('en-IN')}</td>
                  <td className="p-3 text-right">{(summary.total_cgst || 0).toLocaleString('en-IN')}</td>
                  <td className="p-3 text-right">{(summary.total_sgst || 0).toLocaleString('en-IN')}</td>
                  <td className="p-3 text-right">{(summary.total_igst || 0).toLocaleString('en-IN')}</td>
                  <td className="p-3 text-right text-purple-700 bg-purple-50">
                    ₹{(summary.total_gst || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-right">{(summary.total_amount || 0).toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {summary.unknown_state_count > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <strong>Note:</strong> {summary.unknown_state_count} invoice{summary.unknown_state_count > 1 ? 's' : ''} ha{summary.unknown_state_count > 1 ? 've' : 's'} no customer state (user hasn&apos;t completed address / KYC). These are shown under &quot;Unknown&quot;. Please ensure new users enter their state during signup or KYC.
          </div>
        )}
      </Card>

      {/* State-wise chart */}
      {states.length > 0 && states.some((s) => s.total_gst > 0) && (
        <Card className="p-4 md:p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">GST by State (₹)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={states.slice(0, 12)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="state" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `₹${(v || 0).toLocaleString('en-IN')}`} />
              <Legend />
              <Bar dataKey="cgst" name="CGST" stackId="a" fill="#3b82f6" />
              <Bar dataKey="sgst" name="SGST" stackId="a" fill="#06b6d4" />
              <Bar dataKey="igst" name="IGST" stackId="a" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Yearly Trend */}
      {yearlyData?.months && (
        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              {yearlyData.year} — Monthly GST Trend
            </h2>
            <div className="text-right">
              <div className="text-xs text-slate-500">YTD GST</div>
              <div className="text-xl font-bold text-purple-700">
                ₹{(yearlyData.total_gst || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={yearlyData.months}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month_label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `₹${(v || 0).toLocaleString('en-IN')}`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="total_gst"
                name="GST Collected"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
};

export default AdminGSTReport;
