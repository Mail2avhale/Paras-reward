import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Trash2, AlertTriangle, Eye, Users, Clock, Shield,
  Loader2, CheckCircle, RefreshCw, Settings, Play, Power
} from 'lucide-react';
import { API } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * AdminInactiveCleanup
 * --------------------
 * Two-rule auto-purge of inactive users (admin tool).
 *   Rule 1: Never subscribed + registered > 7 days ago
 *   Rule 2: Last activity > 60 days ago
 * Always-protected: admin role, KYC verified (RBI), pending refunds /
 * withdrawals / bank-redeems.
 */
const AdminInactiveCleanup = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [settings, setSettings] = useState(null);
  const [daysNoSub, setDaysNoSub] = useState(7);
  const [daysInactive, setDaysInactive] = useState(60);
  const [executing, setExecuting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // ============ CUSTOM PURGE (Jun 2026 — Reg-date-range based) ============
  const [customStart, setCustomStart] = useState('2026-01-01');
  const [customEnd, setCustomEnd] = useState('2026-04-30');
  const [customInactiveDays, setCustomInactiveDays] = useState(10);
  const [customPreview, setCustomPreview] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customExecuting, setCustomExecuting] = useState(false);

  const fetchCustomPreview = async () => {
    try {
      setCustomLoading(true);
      const res = await axios.get(
        `${API}/admin/inactive-cleanup/custom-dry-run?start_date=${customStart}&end_date=${customEnd}&inactive_days=${customInactiveDays}&sample_size=50`
      );
      setCustomPreview(res.data);
      toast.success(`Found ${res.data.total_to_delete} users matching criteria`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Custom preview failed');
    } finally {
      setCustomLoading(false);
    }
  };

  const executeCustomPurge = async () => {
    const total = customPreview?.total_to_delete || 0;
    if (total === 0) {
      toast.info('No users match — run Preview first');
      return;
    }
    const breakdown = Object.entries(customPreview.month_breakdown || {})
      .map(([m, c]) => `   ${m}: ${c}`)
      .join('\n');
    if (!window.confirm(
      `⚠️ HARD DELETE ${total} users PERMANENTLY?\n\n` +
      `Registration: ${customStart} → ${customEnd}\n` +
      `Inactive: ${customInactiveDays}+ days · No active sub · No mining\n` +
      `KYC-verified, admin & is_protected users are SKIPPED.\n\n` +
      `Month breakdown:\n${breakdown}\n\n` +
      `Plus pending bank-redeems for these users will be deleted.\n\n` +
      `THIS CANNOT BE UNDONE. Continue?`
    )) return;

    const pin = window.prompt('Admin PIN required:');
    if (!pin) return;

    try {
      setCustomExecuting(true);
      let totalDeleted = 0;
      let totalRedeems = 0;
      let totalOrphans = 0;
      let totalErrors = 0;
      let iteration = 0;
      const MAX_ITERATIONS = 50;

      while (iteration < MAX_ITERATIONS) {
        iteration++;
        const res = await axios.post(`${API}/admin/inactive-cleanup/custom-execute`, {
          pin,
          admin_id: user?.uid,
          start_date: customStart,
          end_date: customEnd,
          inactive_days: customInactiveDays,
          max_users: 250,
        }, { timeout: 120000 });

        const d = res.data || {};
        totalDeleted += d.deleted_users || 0;
        totalRedeems += d.pending_redeems_deleted || 0;
        totalOrphans += d.referral_orphans || 0;
        totalErrors += d.error_count || 0;

        toast.info(
          `Chunk ${iteration}: ${d.deleted_users} deleted · ${d.remaining} remaining`,
          { duration: 3000 }
        );

        if (!d.more_to_do || (d.deleted_users === 0 && d.remaining === 0)) {
          break;
        }
        await new Promise(r => setTimeout(r, 800));
      }

      const errSuffix = totalErrors > 0 ? ` · ⚠ ${totalErrors} cascade timeouts (re-run)` : '';
      toast.success(
        `✅ TOTAL: ${totalDeleted} users · ${totalRedeems} pending redeems · ${totalOrphans} downline${errSuffix}`,
        { duration: 20000 }
      );
      setCustomPreview(null);
      fetchPreview();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || 'Custom purge failed');
    } finally {
      setCustomExecuting(false);
    }
  };

  // ============ EMERGENCY RESTORE (Jun 9 incident recovery) ============
  const [restoreHours, setRestoreHours] = useState(72);
  const [restoreMinBalance, setRestoreMinBalance] = useState(0);
  const [restoreOnlySubscribed, setRestoreOnlySubscribed] = useState(false);
  const [restoreOnlyKyc, setRestoreOnlyKyc] = useState(false);
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const fetchRestorePreview = async () => {
    try {
      setRestoreLoading(true);
      const params = new URLSearchParams({
        hours: restoreHours,
        min_prc_balance: restoreMinBalance,
        only_subscribed: restoreOnlySubscribed,
        only_kyc_verified: restoreOnlyKyc,
      });
      const r = await axios.get(
        `${API}/admin/inactive-cleanup/restore-deleted/preview?${params}`,
        { timeout: 60000 }
      );
      setRestorePreview(r.data);
      toast.success(`Found ${r.data.restorable} restorable users`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Preview failed');
    } finally {
      setRestoreLoading(false);
    }
  };

  const executeRestore = async () => {
    if (!restorePreview || restorePreview.restorable === 0) {
      toast.info('Run Preview first');
      return;
    }
    if (!window.confirm(
      `Restore ${restorePreview.restorable} deleted users?\n\n` +
      `⚠ Cascade data (transactions, kyc docs, prc_ledger) is NOT recoverable. ` +
      `Only user profile + PRC balance will be restored.\n\nContinue?`
    )) return;
    const pin = window.prompt('Admin PIN required:');
    if (!pin) return;

    try {
      setRestoring(true);
      let totalRestored = 0;
      let totalErrors = 0;
      let lastErrors = [];
      let iter = 0;
      while (iter < 30) {
        iter++;
        const r = await axios.post(`${API}/admin/inactive-cleanup/restore-deleted/execute`, {
          pin,
          admin_id: user?.uid,
          hours: restoreHours,
          min_prc_balance: restoreMinBalance,
          only_subscribed: restoreOnlySubscribed,
          only_kyc_verified: restoreOnlyKyc,
          max_users: 250,
        }, { timeout: 120000 });
        const d = r.data || {};
        totalRestored += d.restored || 0;
        totalErrors += d.error_count || 0;
        if (d.errors && d.errors.length) lastErrors = d.errors;
        toast.info(
          `Chunk ${iter}: restored ${d.restored} · ${d.remaining} remaining` +
          (d.candidates_available !== undefined ? ` (${d.candidates_available} candidates)` : '') +
          (d.error_count > 0 ? ` · ⚠ ${d.error_count} errors` : ''),
          { duration: 3500 }
        );
        if (!d.more_to_do) break;
        await new Promise(res => setTimeout(res, 700));
      }
      if (totalErrors > 0) {
        console.warn('[RESTORE errors]', lastErrors);
        toast.warning(
          `Restored ${totalRestored} · ⚠ ${totalErrors} skipped. Open browser console for details.`,
          { duration: 30000 }
        );
      } else {
        toast.success(`✅ TOTAL Restored: ${totalRestored} users`, { duration: 15000 });
      }
      setRestorePreview(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const fetchPreview = useCallback(async (override) => {
    try {
      setLoading(true);
      const dns = override?.daysNoSub ?? daysNoSub;
      const din = override?.daysInactive ?? daysInactive;
      const res = await axios.get(
        `${API}/admin/inactive-cleanup/dry-run?days_no_sub=${dns}&days_inactive=${din}&sample_size=20`
      );
      setPreview(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [daysNoSub, daysInactive]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/inactive-cleanup/settings`);
      const s = res.data?.settings || {};
      setSettings(s);
      if (s.days_no_sub) setDaysNoSub(s.days_no_sub);
      if (s.days_inactive) setDaysInactive(s.days_inactive);
    } catch (e) {
      console.warn('settings fetch failed', e);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchPreview();
  }, [fetchSettings, fetchPreview]);

  const executeCleanup = async () => {
    const total = preview?.total_to_delete || 0;
    if (total === 0) {
      toast.info('No users match cleanup criteria right now');
      return;
    }
    if (!window.confirm(
      `⚠️ DELETE ${total} users PERMANENTLY?\n\n` +
      `Rule 1 (never subscribed): ${preview.rule1_count}\n` +
      `Rule 2 (>60d inactive): ${preview.rule2_count}\n\n` +
      `Audit snapshot kept in deleted_users_audit collection.\n` +
      `Continue?`
    )) return;

    const pin = window.prompt('Admin PIN required:');
    if (!pin) return;

    try {
      setExecuting(true);
      let totalDeleted = 0;
      let totalOrphans = 0;
      let totalErrors = 0;
      let iteration = 0;
      const MAX_ITERATIONS = 30;  // safety cap

      while (iteration < MAX_ITERATIONS) {
        iteration++;
        const res = await axios.post(`${API}/admin/inactive-cleanup/execute`, {
          pin,
          admin_id: user?.uid,
          days_no_sub: daysNoSub,
          days_inactive: daysInactive,
          max_users: 100,
        }, { timeout: 90000 });  // 90s per chunk (under proxy 60s default but with retry buffer)

        const d = res.data || {};
        totalDeleted += d.deleted_users || 0;
        totalOrphans += d.referral_orphans || 0;
        totalErrors += d.error_count || 0;

        toast.info(
          `Chunk ${iteration}: ${d.deleted_users} deleted · ${d.remaining} remaining`,
          { duration: 3000 }
        );

        if (!d.more_to_do || (d.deleted_users === 0 && d.remaining === 0)) {
          break;
        }
        // brief pause so backend connection settles
        await new Promise(r => setTimeout(r, 800));
      }

      const errSuffix = totalErrors > 0 ? ` · ⚠ ${totalErrors} cascade timeouts (re-run)` : '';
      toast.success(
        `✅ TOTAL: Deleted ${totalDeleted} users · ${totalOrphans} downline${errSuffix}`,
        { duration: 20000 }
      );
      fetchPreview();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || 'Cleanup failed');
    } finally {
      setExecuting(false);
    }
  };

  const toggleAutoRun = async () => {
    const newState = !settings?.auto_run_enabled;
    if (newState && !window.confirm(
      `Enable DAILY auto-cleanup?\n\nWill delete inactive users every 24 hours automatically.\nContinue?`
    )) return;

    const pin = window.prompt('Admin PIN required:');
    if (!pin) return;

    try {
      setSavingSettings(true);
      await axios.post(`${API}/admin/inactive-cleanup/settings`, {
        pin,
        admin_id: user?.uid,
        auto_run_enabled: newState,
        days_no_sub: daysNoSub,
        days_inactive: daysInactive,
        rules: ['rule1', 'rule2'],
      });
      toast.success(`Auto-cleanup ${newState ? 'ENABLED' : 'DISABLED'}`);
      fetchSettings();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Settings update failed');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20" data-testid="admin-inactive-cleanup">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-800">Inactive User Cleanup</h1>
            <p className="text-xs text-slate-500">Auto-purge dormant accounts</p>
          </div>
          <Button onClick={() => fetchPreview()} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 🚑 EMERGENCY RESTORE CARD (Jun 9 incident) */}
        <Card className="p-4 border-emerald-300 bg-emerald-50/70" data-testid="restore-card">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-emerald-900">
              🚑 Emergency Restore — Recover Deleted Users
            </h3>
          </div>
          <p className="text-[11px] text-emerald-800 mb-3 leading-relaxed">
            Restore users from <code>deleted_users_audit</code> snapshots back into
            the system. Filter by recency / PRC balance / subscription / KYC.
            <strong> Cascade data (transactions, kyc docs) is NOT recoverable</strong> —
            only user account + PRC balance is restored.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[11px] font-medium text-emerald-900 mb-1">Hours back</label>
              <Input type="number" min={1} max={2160} value={restoreHours}
                     onChange={(e) => setRestoreHours(parseInt(e.target.value) || 72)}
                     data-testid="restore-hours" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-emerald-900 mb-1">Min PRC balance</label>
              <Input type="number" min={0} value={restoreMinBalance}
                     onChange={(e) => setRestoreMinBalance(parseFloat(e.target.value) || 0)}
                     data-testid="restore-min-balance" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mb-3">
            <label className="flex items-center gap-1.5 text-[11px] text-emerald-900">
              <input type="checkbox" checked={restoreOnlySubscribed}
                     onChange={(e) => setRestoreOnlySubscribed(e.target.checked)}
                     data-testid="restore-only-subscribed" />
              Only had Elite subscription
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-emerald-900">
              <input type="checkbox" checked={restoreOnlyKyc}
                     onChange={(e) => setRestoreOnlyKyc(e.target.checked)}
                     data-testid="restore-only-kyc" />
              Only had KYC verified
            </label>
          </div>

          <div className="flex gap-2 mb-3">
            <Button onClick={fetchRestorePreview} disabled={restoreLoading}
                    className="flex-1 bg-slate-700 hover:bg-slate-800 text-white"
                    data-testid="restore-preview-btn">
              {restoreLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Preview'}
            </Button>
            <Button onClick={executeRestore}
                    disabled={restoring || !restorePreview || restorePreview.restorable === 0}
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                    data-testid="restore-execute-btn">
              {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Restore'}
            </Button>
          </div>

          {restorePreview && (
            <div className="rounded-lg bg-white border border-emerald-200 p-3" data-testid="restore-preview-result">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">Restorable</span>
                <span className="text-2xl font-bold text-emerald-700">
                  {restorePreview.restorable}
                </span>
              </div>
              {restorePreview.already_restored > 0 && (
                <p className="text-[11px] text-slate-500 mb-1">
                  Already back in system: {restorePreview.already_restored}
                </p>
              )}
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="bg-slate-50 rounded p-1.5">
                  <p className="text-[10px] text-slate-500">Had Elite</p>
                  <p className="text-sm font-bold text-slate-800">
                    {restorePreview.stats?.had_active_elite ?? 0}
                  </p>
                </div>
                <div className="bg-slate-50 rounded p-1.5">
                  <p className="text-[10px] text-slate-500">KYC verified</p>
                  <p className="text-sm font-bold text-slate-800">
                    {restorePreview.stats?.had_kyc_verified ?? 0}
                  </p>
                </div>
                <div className="bg-slate-50 rounded p-1.5">
                  <p className="text-[10px] text-slate-500">Had PRC</p>
                  <p className="text-sm font-bold text-slate-800">
                    {restorePreview.stats?.had_prc_balance ?? 0}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* ✅ Execute re-enabled with hardened protections (Jun 9, 2026 v2) */}
        <Card className="p-3 border-emerald-300 bg-emerald-50">
          <p className="text-[11px] text-emerald-800">
            <strong>✅ Execute re-enabled with hardened protections:</strong> KYC verified,
            active mining, active Elite subscription, and <strong>prc_balance ≥ ₹5,000</strong> users
            are ALWAYS protected. Rule 2 now requires BOTH last_login_at AND last_activity_at to be stale.
            Custom Purge remains locked.
          </p>
        </Card>


        {/* Warning banner */}
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 leading-relaxed">
              <strong>Irreversible action.</strong> Users matching criteria will be
              permanently deleted. Always-protected: <em>KYC verified, admin role,
              pending refunds/withdrawals</em>. Snapshot kept in audit log for 1 year.
            </div>
          </div>
        </Card>

        {/* Criteria inputs */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-800">Cleanup Criteria</h3>
          </div>

          <label className="block text-xs font-medium text-slate-700 mb-1 mt-3">
            Rule 1: Never Subscribed (days threshold)
          </label>
          <Input
            type="number"
            min={1}
            max={90}
            value={daysNoSub}
            onChange={(e) => setDaysNoSub(parseInt(e.target.value) || 7)}
            onBlur={() => fetchPreview()}
            data-testid="days-no-sub-input"
            className="mb-2"
          />
          <p className="text-[11px] text-slate-500 mb-3">
            Delete Explorer users who never paid and registered more than
            <strong> {daysNoSub} days </strong>ago.
          </p>

          <label className="block text-xs font-medium text-slate-700 mb-1">
            Rule 2: Long Inactivity (days threshold)
          </label>
          <Input
            type="number"
            min={30}
            max={365}
            value={daysInactive}
            onChange={(e) => setDaysInactive(parseInt(e.target.value) || 60)}
            onBlur={() => fetchPreview()}
            data-testid="days-inactive-input"
            className="mb-2"
          />
          <p className="text-[11px] text-slate-500">
            Delete users whose last login / activity is older than
            <strong> {daysInactive} days</strong>.
          </p>
        </Card>

        {/* Preview counts */}
        {loading ? (
          <Card className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 bg-orange-50 border-orange-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3 h-3 text-orange-600" />
                  <p className="text-[10px] uppercase tracking-wider text-orange-700 font-semibold">Rule 1</p>
                </div>
                <p className="text-2xl font-bold text-orange-900" data-testid="rule1-count">
                  {preview?.rule1_count || 0}
                </p>
                <p className="text-[10px] text-orange-700 mt-1">No subscription</p>
              </Card>
              <Card className="p-3 bg-red-50 border-red-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3 h-3 text-red-600" />
                  <p className="text-[10px] uppercase tracking-wider text-red-700 font-semibold">Rule 2</p>
                </div>
                <p className="text-2xl font-bold text-red-900" data-testid="rule2-count">
                  {preview?.rule2_count || 0}
                </p>
                <p className="text-[10px] text-red-700 mt-1">Long inactive</p>
              </Card>
              <Card className="p-3 bg-green-50 border-green-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="w-3 h-3 text-green-600" />
                  <p className="text-[10px] uppercase tracking-wider text-green-700 font-semibold">Skipped</p>
                </div>
                <p className="text-2xl font-bold text-green-900" data-testid="skipped-count">
                  {preview?.protected_skipped_count || 0}
                </p>
                <p className="text-[10px] text-green-700 mt-1">Protected</p>
              </Card>
            </div>

            {/* Execute button */}
            <Button
              onClick={executeCleanup}
              disabled={executing || (preview?.total_to_delete || 0) === 0}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6"
              data-testid="execute-cleanup-btn"
            >
              {executing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Deleting... (auto-loops 100/chunk)
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5 mr-2" />
                  Delete {preview?.total_to_delete || 0} Inactive Users Now
                </>
              )}
            </Button>

            {/* Auto-run scheduler */}
            <Card className="p-4 border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Power className={`w-4 h-4 ${settings?.auto_run_enabled ? 'text-green-600' : 'text-slate-400'}`} />
                  <h3 className="text-sm font-semibold text-slate-800">Daily Auto-Cleanup</h3>
                </div>
                <Button
                  onClick={toggleAutoRun}
                  disabled={savingSettings}
                  size="sm"
                  className={settings?.auto_run_enabled
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'}
                  data-testid="auto-run-toggle"
                >
                  {savingSettings ? <Loader2 className="w-3 h-3 animate-spin" /> :
                    settings?.auto_run_enabled ? 'Disable' : 'Enable'}
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">
                {settings?.auto_run_enabled
                  ? '🟢 Runs automatically every 24 hours'
                  : '⏸ Manual mode — use "Delete Now" above'}
              </p>
              {settings?.last_run_at && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Last run: {new Date(settings.last_run_at).toLocaleString()} ·
                  Deleted: {settings.last_run_deleted || 0}
                </p>
              )}
            </Card>

            {/* Sample preview */}
            {preview?.rule1_sample?.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-800">
                    Sample — Rule 1 ({preview.rule1_sample.length} of {preview.rule1_count})
                  </h3>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {preview.rule1_sample.map((u) => (
                    <div key={u.uid} className="flex items-center justify-between p-2 bg-slate-50 rounded text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 truncate">{u.name || 'No name'}</p>
                        <p className="text-slate-500 truncate">{u.mobile || u.email || u.uid}</p>
                      </div>
                      {u.prc_balance > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-2">
                          {Math.round(u.prc_balance)} PRC
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {preview?.rule2_sample?.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-800">
                    Sample — Rule 2 ({preview.rule2_sample.length} of {preview.rule2_count})
                  </h3>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {preview.rule2_sample.map((u) => (
                    <div key={u.uid} className="flex items-center justify-between p-2 bg-slate-50 rounded text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 truncate">{u.name || 'No name'}</p>
                        <p className="text-slate-500 truncate">{u.mobile || u.email || u.uid}</p>
                      </div>
                      {u.prc_balance > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-2">
                          {Math.round(u.prc_balance)} PRC
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {/* ============ CUSTOM PURGE — Registration Date Window ============ */}
        <Card className="p-4 border-rose-200 bg-rose-50/40 mt-6" data-testid="custom-purge-card">
          <div className="flex items-center gap-2 mb-3">
            <Trash2 className="w-4 h-4 text-rose-700" />
            <h3 className="text-sm font-bold text-rose-900">
              Custom Purge — by Registration Window
            </h3>
          </div>
          <p className="text-[11px] text-rose-800 mb-3 leading-relaxed">
            Delete users registered in a specific date window <strong>who have no
            active subscription, no active mining, and have not logged in for N
            days</strong>. <em>Pending bank-redeems for these users will also be
            deleted.</em> KYC-verified / admin / is_protected accounts are
            always skipped (RBI compliance).
          </p>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[11px] font-medium text-rose-900 mb-1">From</label>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                data-testid="custom-start-date"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-rose-900 mb-1">To</label>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                data-testid="custom-end-date"
              />
            </div>
          </div>
          <label className="block text-[11px] font-medium text-rose-900 mb-1">
            Inactive Days (no login since)
          </label>
          <Input
            type="number"
            min={1}
            max={365}
            value={customInactiveDays}
            onChange={(e) => setCustomInactiveDays(parseInt(e.target.value) || 10)}
            data-testid="custom-inactive-days"
            className="mb-3"
          />

          <div className="flex gap-2 mb-3">
            <Button
              onClick={fetchCustomPreview}
              disabled={customLoading}
              className="flex-1 bg-slate-700 hover:bg-slate-800 text-white"
              data-testid="custom-preview-btn"
            >
              {customLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><Eye className="w-4 h-4 mr-1" /> Preview</>}
            </Button>
            <Button
              onClick={executeCustomPurge}
              disabled={customExecuting || !customPreview || customPreview.total_to_delete === 0}
              className="flex-1 bg-rose-700 hover:bg-rose-800 text-white"
              data-testid="custom-execute-btn"
            >
              {customExecuting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><Trash2 className="w-4 h-4 mr-1" /> Delete</>}
            </Button>
          </div>

          {customPreview && (
            <div className="rounded-lg bg-white border border-rose-200 p-3" data-testid="custom-preview-result">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">Total to delete</span>
                <span className="text-2xl font-bold text-rose-700">
                  {customPreview.total_to_delete}
                </span>
              </div>
              {customPreview.pending_redeems_will_delete_for > 0 && (
                <p className="text-[11px] text-amber-700 mb-2">
                  ⚠ {customPreview.pending_redeems_will_delete_for} users have pending bank-redeem
                  requests that will also be deleted.
                </p>
              )}
              {Object.keys(customPreview.month_breakdown || {}).length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {Object.entries(customPreview.month_breakdown).sort().map(([m, c]) => (
                    <div key={m} className="text-center bg-slate-50 rounded p-1.5">
                      <p className="text-[10px] text-slate-500">{m}</p>
                      <p className="text-sm font-bold text-slate-800">{c}</p>
                    </div>
                  ))}
                </div>
              )}
              {customPreview.sample?.length > 0 && (
                <div className="mt-2">
                  <p className="text-[11px] font-medium text-slate-600 mb-1">
                    Sample (first {customPreview.sample.length}):
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {customPreview.sample.map((u) => (
                      <div key={u.uid} className="flex items-center justify-between p-1.5 bg-slate-50 rounded text-[11px]">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-700 truncate">{u.name || 'No name'}</p>
                          <p className="text-slate-500 truncate">
                            {u.mobile || u.email || u.uid} · reg {u.created_at?.slice(0, 10)}
                          </p>
                        </div>
                        {u.prc_balance > 0 && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-2">
                            {Math.round(u.prc_balance)} PRC
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminInactiveCleanup;
