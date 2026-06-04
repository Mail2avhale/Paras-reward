/**
 * Admin Redeem Limits Dashboard (June 2026)
 *
 * Features
 *  - List all users with: Name, Mobile, Total PRC, Redeem Limit, Used,
 *    Balance Redeemable.
 *  - Filter: Active (Elite) / Inactive / All.
 *  - Sort: by Name, Mobile, Total PRC, Redeem Limit, Used, Balance.
 *  - Search by name or mobile.
 *  - Excel download.
 *  - Direct Redeem modal: two-step preview → confirm. Admin enters real UTR.
 *    On commit: debits PRC, creates "paid" bank_transfer_request, posts
 *    Community success story, raises progressive min.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Search, Download, ArrowUpDown, Banknote, Loader2, CheckCircle2, XCircle,
  IndianRupee, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API } from '@/lib/api';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'active', label: 'Active Elite' },
  { value: 'inactive', label: 'Inactive / Explorer' },
];

const SORT_FIELDS = [
  { value: 'balance_redeemable', label: 'Balance Redeemable' },
  { value: 'total_prc', label: 'Total PRC' },
  { value: 'redeem_limit', label: 'Redeem Limit' },
  { value: 'used', label: 'Used PRC' },
  { value: 'name', label: 'Name' },
  { value: 'mobile', label: 'Mobile' },
];

function n(v) {
  const x = Number(v || 0);
  return x.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function AdminRedeemLimits() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState('balance_redeemable');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [downloading, setDownloading] = useState(false);

  // Direct Redeem modal state
  const [directOpen, setDirectOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemUtr, setRedeemUtr] = useState('');
  const [redeemRemark, setRedeemRemark] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [committing, setCommitting] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/redeem-limits/users`, {
        params: { search: search.trim() || undefined, status, sort_by: sortBy, sort_order: sortOrder, page, page_size: pageSize },
      });
      setRows(res.data.rows || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (e) {
      toast.error('Failed to load redeem limits — please retry.');
    } finally {
      setLoading(false);
    }
  }, [search, status, sortBy, sortOrder, page, pageSize]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const onToggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const downloadExcel = async () => {
    setDownloading(true);
    try {
      const res = await axios.get(`${API}/admin/redeem-limits/users/export-excel`, {
        params: { search: search.trim() || undefined, status, sort_by: sortBy, sort_order: sortOrder },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:T.]/g, '-').slice(0, 19);
      a.download = `redeem-limits-${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch (e) {
      toast.error('Failed to download Excel');
    } finally {
      setDownloading(false);
    }
  };

  const openDirectRedeem = (user) => {
    setSelectedUser(user);
    setRedeemAmount('');
    setRedeemUtr('');
    setRedeemRemark('');
    setPreview(null);
    setDirectOpen(true);
  };

  const closeDirectRedeem = () => {
    setDirectOpen(false);
    setSelectedUser(null);
    setPreview(null);
  };

  const adminId = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return u.uid || u.id || 'admin';
    } catch { return 'admin'; }
  }, []);

  const runPreview = async () => {
    if (!selectedUser) return;
    const amt = parseInt(redeemAmount, 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid amount in INR');
      return;
    }
    setPreviewing(true);
    try {
      const res = await axios.post(`${API}/admin/redeem-limits/direct-redeem`, {
        admin_id: adminId,
        user_id: selectedUser.uid,
        amount_inr: amt,
        utr_number: redeemUtr || 'PREVIEW',
        remark: redeemRemark || undefined,
        confirm: false,
      });
      setPreview(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const commitRedeem = async () => {
    if (!preview || !preview.can_proceed) return;
    if (!redeemUtr || redeemUtr.length < 4) {
      toast.error('UTR / transaction reference is mandatory (min 4 chars).');
      return;
    }
    setCommitting(true);
    try {
      const res = await axios.post(`${API}/admin/redeem-limits/direct-redeem`, {
        admin_id: adminId,
        user_id: selectedUser.uid,
        amount_inr: parseInt(redeemAmount, 10),
        utr_number: redeemUtr,
        remark: redeemRemark || undefined,
        confirm: true,
      });
      toast.success(`Redeem committed — Request ${res.data.request_id}`);
      closeDirectRedeem();
      fetchRows();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8" data-testid="admin-redeem-limits-page">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Redeem Limits</h1>
            <p className="text-slate-400 text-sm mt-1">
              {total.toLocaleString('en-IN')} user{total === 1 ? '' : 's'} · {status === 'all' ? 'All' : status === 'active' ? 'Active Elite only' : 'Inactive / Explorer only'}
            </p>
          </div>
          <Button
            onClick={downloadExcel}
            disabled={downloading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            data-testid="excel-download-btn"
          >
            {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Excel Download
          </Button>
        </header>

        {/* Filters */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="filters-bar">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              data-testid="search-input"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or mobile"
              className="pl-9 bg-slate-900 border-slate-600"
            />
          </div>
          <select
            data-testid="status-filter"
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm"
          >
            {FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            data-testid="sort-by-select"
            value={`${sortBy}__${sortOrder}`}
            onChange={(e) => {
              const [f, o] = e.target.value.split('__');
              setSortBy(f); setSortOrder(o); setPage(1);
            }}
            className="bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm"
          >
            {SORT_FIELDS.flatMap(f => [
              <option key={`${f.value}__desc`} value={`${f.value}__desc`}>{f.label} ↓ High to Low</option>,
              <option key={`${f.value}__asc`} value={`${f.value}__asc`}>{f.label} ↑ Low to High</option>,
            ])}
          </select>
        </div>

        {/* Table */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden" data-testid="users-table-wrapper">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No users match the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="users-table">
                <thead className="bg-slate-900/80 text-slate-300">
                  <tr>
                    <th className="text-left p-3 cursor-pointer" onClick={() => onToggleSort('name')}>
                      <span className="inline-flex items-center gap-1">User <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className="text-left p-3 cursor-pointer" onClick={() => onToggleSort('mobile')}>Mobile</th>
                    <th className="text-left p-3">Plan</th>
                    <th className="text-right p-3 cursor-pointer" onClick={() => onToggleSort('total_prc')}>
                      <span className="inline-flex items-center gap-1">Total PRC <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className="text-right p-3 cursor-pointer" onClick={() => onToggleSort('redeem_limit')}>
                      <span className="inline-flex items-center gap-1">Redeem Limit <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className="text-right p-3 cursor-pointer" onClick={() => onToggleSort('used')}>
                      <span className="inline-flex items-center gap-1">Used <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className="text-right p-3 cursor-pointer" onClick={() => onToggleSort('balance_redeemable')}>
                      <span className="inline-flex items-center gap-1">Balance Redeemable <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className="text-center p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.uid} className="border-t border-slate-700 hover:bg-slate-900/40" data-testid={`user-row-${r.uid}`}>
                      <td className="p-3">
                        <p className="font-medium text-white">{r.name}</p>
                        <p className="text-xs text-slate-400">{r.uid.slice(0, 8)}</p>
                      </td>
                      <td className="p-3 font-mono text-xs">{r.mobile}</td>
                      <td className="p-3">
                        {r.is_active_elite
                          ? <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-xs">Active Elite</span>
                          : <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs">{r.subscription_plan}</span>}
                      </td>
                      <td className="p-3 text-right font-mono">{n(r.total_prc)}</td>
                      <td className="p-3 text-right font-mono text-amber-300">{n(r.redeem_limit_prc)}</td>
                      <td className="p-3 text-right font-mono text-rose-300">{n(r.used_prc)}</td>
                      <td className="p-3 text-right font-mono text-emerald-300 font-bold">{n(r.balance_redeemable_prc)}</td>
                      <td className="p-3 text-center">
                        <Button
                          data-testid={`direct-redeem-btn-${r.uid}`}
                          onClick={() => openDirectRedeem(r)}
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Banknote className="w-3.5 h-3.5 mr-1" /> Direct
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-slate-700 bg-slate-900/40">
              <Button size="sm" variant="outline" disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))} data-testid="pagination-prev">Prev</Button>
              <p className="text-sm text-slate-400">Page {page} of {pages}</p>
              <Button size="sm" variant="outline" disabled={page >= pages || loading}
                onClick={() => setPage(p => Math.min(pages, p + 1))} data-testid="pagination-next">Next</Button>
            </div>
          )}
        </div>
      </div>

      {/* Direct Redeem Modal */}
      {directOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" data-testid="direct-redeem-modal">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Banknote className="w-5 h-5 text-purple-400" /> Direct Redeem
              </h2>
              <button onClick={closeDirectRedeem} className="text-slate-400 hover:text-white" data-testid="modal-close-btn">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-slate-800/60 rounded-lg p-3 text-sm">
                <p className="font-bold text-white">{selectedUser.name}</p>
                <p className="text-slate-400">{selectedUser.mobile} · Bal Redeemable: <span className="font-mono text-emerald-300">{n(selectedUser.balance_redeemable_prc)} PRC</span></p>
                <div className="mt-2 text-xs text-slate-400 grid grid-cols-2 gap-1">
                  <p>A/C: <span className="font-mono text-slate-200">{selectedUser.bank?.account_number || '—'}</span></p>
                  <p>IFSC: <span className="font-mono text-slate-200">{selectedUser.bank?.ifsc_code || '—'}</span></p>
                  <p>Bank: <span className="text-slate-200">{selectedUser.bank?.bank_name || '—'}</span></p>
                  <p>UPI: <span className="text-slate-200">{selectedUser.bank?.upi_id || '—'}</span></p>
                  <p>PhonePe/GPay: <span className="font-mono text-slate-200">{selectedUser.bank?.phonepe_gpay_number || '—'}</span></p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Amount (INR)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    data-testid="direct-redeem-amount"
                    type="number"
                    value={redeemAmount}
                    onChange={e => { setRedeemAmount(e.target.value); setPreview(null); }}
                    placeholder="Enter amount"
                    className="pl-9 bg-slate-800 border-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">UTR / Transaction Reference *</Label>
                <Input
                  data-testid="direct-redeem-utr"
                  value={redeemUtr}
                  onChange={e => setRedeemUtr(e.target.value)}
                  placeholder="UTR123456..."
                  className="bg-slate-800 border-slate-600 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Remark (optional)</Label>
                <Input
                  data-testid="direct-redeem-remark"
                  value={redeemRemark}
                  onChange={e => setRedeemRemark(e.target.value)}
                  placeholder="Notes for audit trail"
                  className="bg-slate-800 border-slate-600"
                />
              </div>

              {/* Preview block */}
              {preview && (
                <div data-testid="direct-redeem-preview" className={`rounded-lg p-3 text-sm border ${preview.can_proceed ? 'border-emerald-700 bg-emerald-500/5' : 'border-rose-700 bg-rose-500/5'}`}>
                  <p className="font-semibold mb-2">{preview.can_proceed ? '✓ Ready to commit' : '✗ Cannot proceed'}</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <p>Withdraw: <span className="font-mono">₹{n(preview.fees.withdrawal_inr)}</span></p>
                    <p>Admin Fee: <span className="font-mono">₹{n(preview.fees.admin_fee_inr)}</span></p>
                    <p>Txn Fee: <span className="font-mono">₹{n(preview.fees.transaction_fee_inr)}</span></p>
                    <p>Total Debit: <span className="font-mono text-amber-300">{n(preview.fees.total_prc_debited)} PRC</span></p>
                    <p>Next Min after: <span className="font-mono">₹{n(preview.progressive_min_after)}</span></p>
                  </div>
                  {(preview.blockers || []).length > 0 && (
                    <ul className="mt-2 text-rose-300 text-xs list-disc pl-4">
                      {preview.blockers.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
              {!preview ? (
                <Button onClick={runPreview} disabled={previewing} className="bg-amber-600 hover:bg-amber-700" data-testid="preview-btn">
                  {previewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Preview
                </Button>
              ) : preview.can_proceed ? (
                <>
                  <Button variant="outline" onClick={() => setPreview(null)} data-testid="edit-btn">Edit</Button>
                  <Button onClick={commitRedeem} disabled={committing} className="bg-emerald-600 hover:bg-emerald-700" data-testid="commit-btn">
                    {committing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Confirm &amp; Pay
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setPreview(null)} data-testid="edit-btn">Edit</Button>
                  <Button onClick={closeDirectRedeem} className="bg-rose-600 hover:bg-rose-700" data-testid="cancel-btn">
                    <XCircle className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
