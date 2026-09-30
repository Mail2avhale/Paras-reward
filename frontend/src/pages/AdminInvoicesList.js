/**
 * Admin — GST Invoices Search & Download (Sep 17 2026)
 *
 * Detailed invoice-by-invoice explorer that complements /admin/gst-report:
 *   • Text search (invoice#, name, phone, payment_id)
 *   • Date range picker
 *   • Type filter (All / VIP Subscription / Redemption Service Charge)
 *   • Per-row PDF download
 *   • Server-side pagination
 *
 * Consumes:
 *   GET  /api/invoice/admin/all
 *          ?from_date=&to_date=&search=&invoice_type=&page=&limit=
 *   GET  /api/invoice/{invoice_id}/pdf
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Search, Calendar, Download, FileText, Loader2, ChevronLeft, ChevronRight,
  Filter, Receipt, RefreshCw,
} from 'lucide-react';

import { API } from '../lib/api';

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'vip', label: 'VIP Subscription' },
  { value: 'service_charge', label: 'Service Charge (20%)' },
];

const AdminInvoicesList = () => {
  // Filters
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(monthAgo);
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState('');
  const [invoiceType, setInvoiceType] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  // Data
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 });
  const [summary, setSummary] = useState({ total_amount: 0, total_gst: 0, total_base_amount: 0 });
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (search.trim()) params.search = search.trim();
      if (invoiceType) params.invoice_type = invoiceType;

      const res = await axios.get(`${API}/invoice/admin/all`, { params });
      if (res.data.success) {
        setInvoices(res.data.invoices || []);
        setPagination(res.data.pagination || { total: 0, total_pages: 1 });
        setSummary(res.data.gst_summary || {});
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [page, fromDate, toDate, search, invoiceType]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  };

  const downloadPdf = async (invoiceId, invoiceNumber) => {
    setDownloadingId(invoiceId);
    try {
      const res = await axios.get(`${API}/invoice/${invoiceId}/pdf`);
      if (res.data.success && res.data.pdf_base64) {
        const byteChars = atob(res.data.pdf_base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${invoiceNumber || invoiceId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        toast.error('PDF not available for this invoice');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  const typeLabel = (inv) => {
    if (inv.invoice_type === 'redemption_service_charge') return 'Service Charge';
    return 'VIP Subscription';
  };

  const typeBadgeClass = (inv) => {
    if (inv.invoice_type === 'redemption_service_charge') {
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    }
    return 'bg-sky-100 text-sky-700 border border-sky-200';
  };

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="admin-invoices-list">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ color: '#14532D' }}>
            <Receipt className="w-7 h-7" style={{ color: '#3B82F6' }} />
            GST Invoices
          </h1>
          <p className="text-sm mt-1" style={{ color: '#4B5563' }}>
            Search, filter and download individual GST invoices — VIP subscriptions & service-charge fees.
          </p>
        </div>
        <button
          onClick={fetchInvoices}
          data-testid="invoices-refresh-btn"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#3B82F6', color: '#fff' }}
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Invoices Matched" value={pagination.total || 0} accent="#3B82F6" />
        <SummaryCard label="Base Amount" value={`₹${(summary.total_base_amount || 0).toLocaleString('en-IN')}`} accent="#22C55E" />
        <SummaryCard label="Total GST" value={`₹${(summary.total_gst || 0).toLocaleString('en-IN')}`} accent="#F59E0B" />
        <SummaryCard label="Gross Amount" value={`₹${(summary.total_amount || 0).toLocaleString('en-IN')}`} accent="#0EA5E9" />
      </div>

      {/* Filters bar */}
      <form onSubmit={onSearchSubmit} className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Search */}
          <div className="md:col-span-4">
            <label className="text-xs font-medium mb-1 block" style={{ color: '#4B5563' }}>
              <Search className="w-3 h-3 inline-block mr-1" />
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Invoice#, Payment ID (pay_...), name, phone, email..."
              data-testid="invoices-search-input"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
              style={{ color: '#14532D' }}
            />
          </div>

          {/* Date range */}
          <div className="md:col-span-2">
            <label className="text-xs font-medium mb-1 block" style={{ color: '#4B5563' }}>
              <Calendar className="w-3 h-3 inline-block mr-1" />
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              data-testid="invoices-from-date"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              style={{ color: '#14532D' }}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium mb-1 block" style={{ color: '#4B5563' }}>To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              data-testid="invoices-to-date"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              style={{ color: '#14532D' }}
            />
          </div>

          {/* Type */}
          <div className="md:col-span-2">
            <label className="text-xs font-medium mb-1 block" style={{ color: '#4B5563' }}>
              <Filter className="w-3 h-3 inline-block mr-1" />
              Type
            </label>
            <select
              value={invoiceType}
              onChange={(e) => { setInvoiceType(e.target.value); setPage(1); }}
              data-testid="invoices-type-filter"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
              style={{ color: '#14532D' }}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Search btn */}
          <div className="md:col-span-2">
            <button
              type="submit"
              data-testid="invoices-apply-filters-btn"
              className="w-full px-3 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: '#3B82F6', color: '#fff' }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </form>

      {/* Results table */}
      <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16" data-testid="invoices-loading">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3B82F6' }} />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16" data-testid="invoices-empty-state">
            <FileText className="w-12 h-12 mx-auto text-slate-300" />
            <p className="mt-3 text-sm" style={{ color: '#4B5563' }}>
              No invoices match your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="invoices-table">
              <thead style={{ backgroundColor: '#F0FDF4' }}>
                <tr className="text-xs uppercase" style={{ color: '#14532D' }}>
                  <th className="text-left p-3 font-semibold">Invoice #</th>
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">Customer</th>
                  <th className="text-left p-3 font-semibold">Type</th>
                  <th className="text-right p-3 font-semibold">Base ₹</th>
                  <th className="text-right p-3 font-semibold">GST ₹</th>
                  <th className="text-right p-3 font-semibold">Total ₹</th>
                  <th className="text-center p-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, idx) => (
                  <tr
                    key={inv.invoice_id}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/30'}
                    data-testid={`invoice-row-${inv.invoice_number}`}
                  >
                    <td className="p-3 font-medium" style={{ color: '#14532D' }}>
                      {inv.invoice_number}
                    </td>
                    <td className="p-3" style={{ color: '#4B5563' }}>{inv.date}</td>
                    <td className="p-3">
                      <div className="font-medium" style={{ color: '#14532D' }}>{inv.customer_name || 'Customer'}</div>
                      <div className="text-xs" style={{ color: '#4B5563' }}>
                        {inv.customer_phone || inv.customer_email || inv.user_id?.slice(0, 8)}
                      </div>
                      {inv.payment_id && (
                        <div
                          className="text-xs mt-1 font-mono truncate"
                          style={{ color: '#3B82F6', maxWidth: '200px' }}
                          title={inv.payment_id}
                          data-testid={`invoice-payment-id-${inv.invoice_number}`}
                        >
                          {inv.payment_id}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeClass(inv)}`}>
                        {typeLabel(inv)}
                      </span>
                    </td>
                    <td className="p-3 text-right" style={{ color: '#4B5563' }}>
                      {(inv.gst_breakdown?.base_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right" style={{ color: '#4B5563' }}>
                      {(inv.gst_breakdown?.gst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-semibold" style={{ color: '#14532D' }}>
                      ₹{(inv.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => downloadPdf(inv.invoice_id, inv.invoice_number)}
                        disabled={downloadingId === inv.invoice_id}
                        data-testid={`invoice-download-${inv.invoice_number}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                        style={{ backgroundColor: '#3B82F6', color: '#fff' }}
                      >
                        {downloadingId === inv.invoice_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t border-emerald-100"
            data-testid="invoices-pagination"
          >
            <div className="text-sm" style={{ color: '#4B5563' }}>
              Page {page} of {pagination.total_pages} · {pagination.total} invoices
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                data-testid="invoices-prev-page"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-slate-200 disabled:opacity-40"
                style={{ color: '#14532D' }}
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={page >= pagination.total_pages}
                data-testid="invoices-next-page"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-slate-200 disabled:opacity-40"
                style={{ color: '#14532D' }}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, accent }) => (
  <div
    className="rounded-xl p-4 border shadow-sm"
    style={{ backgroundColor: '#FFFFFF', borderColor: '#D1FAE5' }}
    data-testid={`invoices-summary-${label.replace(/\s+/g, '-').toLowerCase()}`}
  >
    <div className="text-xs font-medium" style={{ color: '#4B5563' }}>{label}</div>
    <div className="text-xl font-bold mt-1" style={{ color: accent }}>{value}</div>
  </div>
);

export default AdminInvoicesList;
