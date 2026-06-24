/**
 * BenefitCapCleanupButton.js
 * ──────────────────────────────────────────────────────────────────
 * Admin-only one-click utility for the Feb 2026 ₹2,500 lifetime
 * benefits cap. Flow:
 *
 *   1. Click button → GET /admin/benefit-cap-cleanup/preview (dry-run)
 *   2. Modal shows affected users + total pending + PRC to refund
 *   3. Admin clicks "Execute Cleanup" → POST .../execute
 *   4. Backend cancels pending requests, refunds PRC, blocks users,
 *      appends audit log entries.
 *
 * Idempotent — already-blocked users are skipped on subsequent runs.
 */
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const BenefitCapCleanupButton = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [executed, setExecuted] = useState(null);

  const authHeader = () => {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const adminId = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}').email || 'admin';
    } catch { return 'admin'; }
  })();

  const openPreview = async () => {
    setOpen(true);
    setLoading(true);
    setExecuted(null);
    setPreview(null);
    try {
      const res = await axios.get(
        `${API}/bank-transfer/admin/benefit-cap-cleanup/preview`,
        { headers: authHeader() }
      );
      setPreview(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Preview failed');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const runCleanup = async () => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/bank-transfer/admin/benefit-cap-cleanup/execute`,
        { admin_id: adminId, dry_run: false },
        { headers: authHeader() }
      );
      setExecuted(res.data);
      toast.success(`Cleanup done — ${res.data.users_blocked} users blocked`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Cleanup execute failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={openPreview}
        variant="outline"
        className="border-amber-500 text-amber-700 hover:bg-amber-50"
        data-testid="benefit-cap-cleanup-open-btn"
      >
        <ShieldCheck className="w-4 h-4 mr-2" />
        Benefit Cap Cleanup
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              ₹2,500 Benefit Cap Cleanup
            </DialogTitle>
          </DialogHeader>

          {loading && !preview && (
            <div className="py-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Scanning users…
            </div>
          )}

          {preview && !executed && (
            <div className="space-y-4" data-testid="benefit-cap-preview">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                <AlertTriangle className="w-4 h-4 inline mr-1.5" />
                Dry-run preview — no writes have happened yet.
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Stat label="Users to block" value={preview.users_to_block} />
                <Stat label="Pending to cancel" value={preview.total_pending_to_cancel} />
                <Stat label="PRC to refund" value={preview.total_prc_to_refund.toFixed(2)} />
              </div>

              {preview.affected_users.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider">
                        <tr>
                          <th className="text-left p-2">User</th>
                          <th className="text-right p-2">Lifetime ₹</th>
                          <th className="text-right p-2">Pending</th>
                          <th className="text-right p-2">PRC Refund</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preview.affected_users.map((u) => (
                          <tr key={u.user_id} className="hover:bg-slate-50">
                            <td className="p-2">
                              <div className="font-medium text-slate-900">{u.name}</div>
                              <div className="text-slate-500">{u.mobile}</div>
                            </td>
                            <td className="p-2 text-right tabular-nums">₹{u.lifetime_redeemed_inr.toLocaleString('en-IN')}</td>
                            <td className="p-2 text-right tabular-nums">{u.pending_count}</td>
                            <td className="p-2 text-right tabular-nums text-amber-700">{u.pending_prc_to_refund.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.truncated && (
                    <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
                      Showing first 200 of {preview.users_to_block} users.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200">
                  ✅ No users need cleanup. Everyone is already either under the cap or already blocked.
                </div>
              )}
            </div>
          )}

          {executed && (
            <div className="space-y-4 text-center py-6" data-testid="benefit-cap-executed">
              <div className="w-14 h-14 bg-emerald-100 rounded-full grid place-items-center mx-auto">
                <ShieldCheck className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Cleanup Complete</h3>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Users blocked" value={executed.users_blocked} />
                <Stat label="Pending cancelled" value={executed.pending_cancelled} />
                <Stat label="PRC refunded" value={executed.prc_refunded.toFixed(2)} />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              onClick={() => setOpen(false)}
              variant="outline"
              data-testid="benefit-cap-cleanup-close-btn"
            >
              Close
            </Button>
            {preview && !executed && preview.users_to_block > 0 && (
              <Button
                onClick={runCleanup}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="benefit-cap-cleanup-execute-btn"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running…</>
                ) : (
                  <>Execute Cleanup ({preview.users_to_block} users)</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const Stat = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
    <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
    <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">{value}</div>
  </div>
);

export default BenefitCapCleanupButton;
