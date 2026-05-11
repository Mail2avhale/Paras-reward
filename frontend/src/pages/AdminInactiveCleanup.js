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
      const res = await axios.post(`${API}/admin/inactive-cleanup/execute`, {
        pin,
        admin_id: user?.uid,
        days_no_sub: daysNoSub,
        days_inactive: daysInactive,
      }, { timeout: 180000 });

      const d = res.data || {};
      toast.success(
        `✅ Deleted ${d.deleted_users} users · ${d.referral_orphans} downline cleaned`,
        { duration: 10000 }
      );
      fetchPreview();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Cleanup failed');
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
                  Deleting... (may take 1-2 min for 5000+ users)
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
      </div>
    </div>
  );
};

export default AdminInactiveCleanup;
