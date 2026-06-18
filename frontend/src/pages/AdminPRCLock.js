/**
 * AdminPRCLock — Admin one-click 25k PRC Lock execute + per-user % unlock.
 * Mount at /admin/prc-lock
 * Jun 9, 2026
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Unlock, Loader2, AlertTriangle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminPRCLock = () => {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Manual unlock form
  const [unlockUid, setUnlockUid] = useState('');
  const [unlockPercent, setUnlockPercent] = useState(50);
  const [unlocking, setUnlocking] = useState(false);

  const admin = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const r = await axios.get(`${API}/admin/prc-lock/stats`, { timeout: 30000 });
      setStats(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const executeLock = async () => {
    if (!window.confirm(
      '⚠ This will LOCK the excess-over-25k PRC of every eligible user for 365 days.\n\n' +
      '• Pending bank-redeems for these users will be cancelled + refunded first.\n' +
      '• Idempotent — already-locked users are skipped.\n' +
      '• Auto-loops in chunks of 500.\n\nContinue?'
    )) return;
    const pin = window.prompt('Admin PIN required:');
    if (!pin) return;

    try {
      setExecuting(true);
      let totalLocked = 0;
      let totalUsers = 0;
      let totalRedeemsRefunded = 0;
      let totalPRCRefunded = 0;
      let iteration = 0;
      const MAX_ITER = 50;

      while (iteration < MAX_ITER) {
        iteration++;
        const r = await axios.post(`${API}/admin/prc-lock/execute-25k-lock`, {
          pin, admin_id: admin.uid || 'admin', max_users: 500,
        }, { timeout: 120000 });
        const d = r.data || {};
        totalLocked += d.total_prc_locked || 0;
        totalUsers += d.users_locked || 0;
        totalRedeemsRefunded += d.pending_redeems_refunded || 0;
        totalPRCRefunded += d.pending_prc_refunded || 0;

        toast.info(
          `Chunk ${iteration}: locked ${d.users_locked} users (${(d.remaining_estimate ?? 0)} pending)`,
          { duration: 3000 }
        );
        if (!d.more_to_do) break;
        await new Promise(r2 => setTimeout(r2, 600));
      }

      toast.success(
        `✅ TOTAL locked: ${totalUsers} users · ${Math.round(totalLocked).toLocaleString()} PRC · ` +
        `Refunded ${totalRedeemsRefunded} pending redeems (${Math.round(totalPRCRefunded).toLocaleString()} PRC)`,
        { duration: 20000 }
      );
      fetchStats();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || 'Execute failed');
    } finally {
      setExecuting(false);
    }
  };

  const manualUnlock = async () => {
    if (!unlockUid.trim()) { toast.error('Enter a UID'); return; }
    if (!unlockPercent || unlockPercent < 1 || unlockPercent > 100) {
      toast.error('Percent must be 1–100');
      return;
    }
    if (!window.confirm(
      `Release ${unlockPercent}% of UID ${unlockUid.trim()}'s currently locked PRC?\n\nThis is reversible only by manual admin re-lock.`
    )) return;
    const pin = window.prompt('Admin PIN required:');
    if (!pin) return;

    try {
      setUnlocking(true);
      const r = await axios.post(`${API}/admin/prc-lock/unlock-percent`, {
        pin, admin_id: admin.uid || 'admin',
        uid: unlockUid.trim(),
        percent: parseFloat(unlockPercent),
        reason: 'admin_manual_unlock_percent',
      }, { timeout: 30000 });
      const d = r.data || {};
      toast.success(
        `✅ ${d.user_name || d.uid}: released ${Math.round(d.amount_unlocked).toLocaleString()} PRC ` +
        `(${Math.round(d.locked_before).toLocaleString()} → ${Math.round(d.locked_after).toLocaleString()})` +
        (d.fully_unlocked ? ' · FULLY UNLOCKED 🎉' : ''),
        { duration: 15000 }
      );
      setUnlockUid('');
      setUnlockPercent(50);
      fetchStats();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Unlock failed');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-700" />
          <h1 className="text-xl font-bold text-slate-900">PRC Lock Vault (25k)</h1>
        </div>

        {/* Stats */}
        <Card className="p-4 border-amber-200 bg-amber-50/40">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
              Current Lock Stats
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStats}
              disabled={statsLoading}
              data-testid="prc-lock-refresh-stats"
            >
              {statsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <p className="text-[10px] text-slate-500 uppercase">Users locked</p>
              <p className="text-2xl font-bold text-amber-800 tabular-nums" data-testid="lock-user-count">
                {stats?.user_count ?? '—'}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <p className="text-[10px] text-slate-500 uppercase">Total locked</p>
              <p className="text-2xl font-bold text-rose-700 tabular-nums" data-testid="lock-total-locked">
                {stats?.total_locked
                  ? `${Math.round(stats.total_locked).toLocaleString()} PRC`
                  : '—'}
              </p>
            </div>
          </div>
          {stats?.total_unlocked_so_far > 0 && (
            <p className="text-[11px] text-emerald-700 mt-1">
              Released so far: {Math.round(stats.total_unlocked_so_far).toLocaleString()} PRC
            </p>
          )}
        </Card>

        {/* Execute Lock */}
        <Card className="p-4 border-rose-200 bg-rose-50/40">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-700" />
            <h3 className="text-sm font-bold text-rose-900">
              Execute 25k Lock (One-Time)
            </h3>
          </div>
          <p className="text-[11px] text-rose-800 mb-3 leading-relaxed">
            Locks the <strong>excess over ₹25,000</strong> for every user whose
            balance is above the threshold. Existing pending bank-redeems are
            cancelled + refunded BEFORE the lock applies. Auto-unlocks after
            365 days. Admin/staff users are skipped.
          </p>
          <Button
            onClick={executeLock}
            disabled={executing}
            className="w-full bg-rose-700 hover:bg-rose-800 text-white"
            data-testid="prc-lock-execute-btn"
          >
            {executing
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
              : <Lock className="w-4 h-4 mr-2" />}
            Execute 25k Lock Now
          </Button>
        </Card>

        {/* Manual Unlock */}
        <Card className="p-4 border-emerald-200 bg-emerald-50/40">
          <div className="flex items-center gap-2 mb-3">
            <Unlock className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-emerald-900">
              Manual % Unlock for a User
            </h3>
          </div>
          <p className="text-[11px] text-emerald-800 mb-3">
            Releases X% of a specific user's CURRENTLY locked PRC (i.e. 30% of remaining locked).
          </p>
          <div className="space-y-2 mb-3">
            <Input
              placeholder="User UID (e.g. usr_abc123)"
              value={unlockUid}
              onChange={(e) => setUnlockUid(e.target.value)}
              data-testid="unlock-uid-input"
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1} max={100}
                value={unlockPercent}
                onChange={(e) => setUnlockPercent(e.target.value)}
                data-testid="unlock-percent-input"
              />
              <span className="text-sm font-semibold text-emerald-800">%</span>
            </div>
          </div>
          <Button
            onClick={manualUnlock}
            disabled={unlocking}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white"
            data-testid="prc-unlock-execute-btn"
          >
            {unlocking
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
              : <Unlock className="w-4 h-4 mr-2" />}
            Release {unlockPercent || 0}% Now
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default AdminPRCLock;
