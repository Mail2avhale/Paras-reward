import React, { useState } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  RefreshCw, Send, CheckCircle2, XCircle, FileSpreadsheet,
  AlertTriangle, Copy, Download,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminBulkRefundOTP = ({ user }) => {
  const [tidText, setTidText] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);

  const parseTIDs = () => {
    // Accepts: one per line, comma-separated, tab-separated, space-separated
    return tidText
      .split(/[\s,;\n\r\t]+/)
      .map((t) => t.trim())
      .filter((t) => t && t.length >= 6 && t.length <= 50); // basic sanity
  };

  const tidCount = parseTIDs().length;

  const handleBulkSend = async () => {
    const tids = parseTIDs();
    if (!tids.length) {
      toast.error('Please paste at least one Eko TID');
      return;
    }
    if (tids.length > 500) {
      toast.error('Max 500 TIDs per batch. Please split into smaller batches.');
      return;
    }
    if (!window.confirm(`Send OTP to ${tids.length} customers via Eko? This will trigger Eko API ${tids.length} times.`)) {
      return;
    }
    setSending(true);
    setResults(null);
    try {
      const res = await axios.post(
        `${API}/admin/failed-transactions/refund/bulk-send-otp`,
        { admin_id: user?.uid, eko_tids: tids },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );
      setResults(res.data);
      toast.success(`OTP sent to ${res.data.sent} of ${res.data.total} transactions`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Bulk send failed');
    } finally {
      setSending(false);
    }
  };

  const downloadResultsCSV = () => {
    if (!results?.results?.length) return;
    const rows = [
      ['Eko TID', 'Success', 'HTTP Status', 'Eko Status', 'Message'],
      ...results.results.map((r) => [
        r.eko_tid || r.label,
        r.success ? 'YES' : 'NO',
        r.http_status || '',
        r.eko_status ?? '',
        (r.message || r.error || '').replace(/,/g, ';'),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-refund-otp-${new Date().toISOString().slice(0, 16)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const failedResults = (results?.results || []).filter((r) => !r.success);
  const sentResults = (results?.results || []).filter((r) => r.success);

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="admin-bulk-refund-otp">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
          <Send className="w-7 h-7 text-amber-600" />
          Bulk Eko Refund OTP
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Paste Eko transaction IDs (TIDs) from Eko Connect portal or Excel export — we&apos;ll call{' '}
          <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">POST /transactions/&#123;tid&#125;/refund/otp</code>{' '}
          for each one. Eko will SMS the OTP to each customer&apos;s registered mobile.
        </p>
      </div>

      {/* How to use hint */}
      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="text-sm text-amber-900 space-y-1">
            <div className="font-semibold">How to get Eko TIDs:</div>
            <div>
              1. Open <a href="https://connect.eko.in/#!/history" target="_blank" rel="noreferrer" className="underline">connect.eko.in/#!/history</a>, filter by <strong>Refund Pending</strong>.
            </div>
            <div>2. Download the transaction report / export to Excel.</div>
            <div>
              3. Copy the <strong>Client Ref ID</strong> or <strong>TID</strong> column and paste below (one per line, or comma-separated).
            </div>
            <div>4. Click &quot;Send OTP in Bulk&quot;. Collect OTPs from each customer, then call the individual refund endpoint.</div>
          </div>
        </div>
      </Card>

      {/* Input */}
      <Card className="p-4 md:p-6">
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          Paste Eko TIDs ({tidCount} detected)
        </label>
        <Textarea
          value={tidText}
          onChange={(e) => setTidText(e.target.value)}
          placeholder="Paste TIDs here — one per line, or separated by commas / spaces / tabs&#10;Example:&#10;DMT1E6F098CA229&#10;PAY1775482130303&#10;1775481945055"
          rows={10}
          className="font-mono text-sm"
          data-testid="bulk-otp-tid-textarea"
        />
        <div className="flex flex-wrap gap-2 mt-4 items-center">
          <Button
            onClick={handleBulkSend}
            disabled={sending || tidCount === 0}
            className="bg-amber-600 hover:bg-amber-700 text-white"
            data-testid="bulk-otp-send-btn"
          >
            {sending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Sending... ({tidCount} TIDs)</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Send OTP in Bulk ({tidCount})</>
            )}
          </Button>
          <Button variant="outline" onClick={() => { setTidText(''); setResults(null); }}>
            Clear
          </Button>
          {tidCount > 500 && (
            <span className="text-xs text-red-600">Max 500 per batch — please split.</span>
          )}
        </div>
      </Card>

      {/* Results */}
      {results && (
        <Card className="p-4 md:p-6" data-testid="bulk-otp-results">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-slate-600" />
              Bulk Results
            </h2>
            <Button size="sm" variant="outline" onClick={downloadResultsCSV}>
              <Download className="w-4 h-4 mr-1" /> Download CSV
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Total</div>
              <div className="text-2xl font-bold text-slate-800">{results.total}</div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Sent
              </div>
              <div className="text-2xl font-bold text-emerald-700">{results.sent}</div>
            </div>
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="text-xs text-red-600 font-medium flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Failed
              </div>
              <div className="text-2xl font-bold text-red-700">{results.failed}</div>
            </div>
          </div>

          {/* Tables */}
          {failedResults.length > 0 && (
            <details open className="mb-4">
              <summary className="font-semibold text-red-700 cursor-pointer">
                Failed ({failedResults.length}) — click to expand
              </summary>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-red-50 text-red-700">
                    <tr>
                      <th className="text-left p-2">TID</th>
                      <th className="text-left p-2">HTTP</th>
                      <th className="text-left p-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedResults.map((r, i) => (
                      <tr key={i} className="border-b border-red-100">
                        <td className="p-2 font-mono">{r.eko_tid || r.label}</td>
                        <td className="p-2">{r.http_status || '—'}</td>
                        <td className="p-2 text-red-700">{r.message || r.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {sentResults.length > 0 && (
            <details>
              <summary className="font-semibold text-emerald-700 cursor-pointer">
                Sent ({sentResults.length}) — click to expand
              </summary>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-emerald-50 text-emerald-700">
                    <tr>
                      <th className="text-left p-2">TID</th>
                      <th className="text-left p-2">Message</th>
                      <th className="text-left p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentResults.map((r, i) => (
                      <tr key={i} className="border-b border-emerald-100">
                        <td className="p-2 font-mono">{r.eko_tid || r.label}</td>
                        <td className="p-2 text-slate-600">{r.message}</td>
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => { navigator.clipboard.writeText(r.eko_tid || r.label); toast.success('TID copied'); }}
                            className="text-slate-500 hover:text-slate-800"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </Card>
      )}
    </div>
  );
};

export default AdminBulkRefundOTP;
