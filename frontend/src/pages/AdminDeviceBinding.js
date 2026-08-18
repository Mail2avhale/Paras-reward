/**
 * AdminDeviceBinding — control panel for the 1-per-lifetime device binding
 * feature. Provides:
 *   • Master enforcement toggle (feature flag)
 *   • Retro-scan (dry-run) of multi-account devices
 *   • Retro-block execution (locks all but earliest account per device)
 *   • Recent collision log
 *   • Suspicious signup clusters (same IP + rapid multi-signup)
 *   • Manual admin unbind
 *
 * All requests carry the X-Admin-Pin header (ADMIN_OPERATION_PIN env value).
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { Shield, RefreshCw, AlertTriangle, Lock, Unlock, Users, Activity, Inbox, Check, X as XIcon } from 'lucide-react';
import { API } from '../lib/api';

const AdminDeviceBinding = ({ user }) => {
  const [pin, setPin] = useState('');
  const [enforcementOn, setEnforcementOn] = useState(false);
  const [flagLoaded, setFlagLoaded] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [collisions, setCollisions] = useState([]);
  const [suspicious, setSuspicious] = useState([]);
  const [unbindTarget, setUnbindTarget] = useState({ uid: '', device_id: '', identifier: '' });
  const [changeRequests, setChangeRequests] = useState([]);
  const [changeReqBusy, setChangeReqBusy] = useState(false);

  // Nuclear "Reset All" — unbind every device, unblock every user
  const [resetBusy, setResetBusy] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [showResetPanel, setShowResetPanel] = useState(false);

  const handleResetAll = async () => {
    if (resetConfirm.trim().toUpperCase() !== 'CONFIRM RESET ALL') {
      toast.error('Type exactly: CONFIRM RESET ALL');
      return;
    }
    if (!pin) { toast.error('Admin PIN required'); return; }
    setResetBusy(true);
    try {
      const r = await axios.post(
        `${API}/admin/device-binding/reset-all`,
        {
          admin_id: user?.uid || 'admin',
          reason: 'admin_global_reset_from_ui',
          confirmation: 'CONFIRM RESET ALL',
        },
        { headers: headers() },
      );
      toast.success(
        `Reset complete: ${r.data.bindings_deactivated} bindings unbound, ` +
        `${r.data.collisions_resolved} users unblocked, ` +
        `${r.data.change_requests_cancelled} change-requests cancelled.`,
        { duration: 8000 },
      );
      setResetConfirm('');
      setShowResetPanel(false);
      // Refresh the visible state
      loadFlag();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Reset failed');
    } finally {
      setResetBusy(false);
    }
  };

  const headers = useCallback(() => ({ 'X-Admin-Pin': pin }), [pin]);

  const loadFlag = useCallback(async () => {
    if (!pin || pin.length < 4) return;
    try {
      const r = await axios.get(`${API}/admin/device-binding/flag`, { headers: headers() });
      setEnforcementOn(!!r.data?.enabled);
      setFlagLoaded(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load flag');
    }
  }, [pin, headers]);

  const toggleFlag = async (checked) => {
    try {
      const r = await axios.post(
        `${API}/admin/device-binding/flag`,
        { admin_id: user?.uid || 'admin', enabled: checked },
        { headers: headers() },
      );
      setEnforcementOn(!!r.data?.enabled);
      toast.success(`Enforcement ${checked ? 'ENABLED' : 'DISABLED'}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update flag');
    }
  };

  const runRetroScan = async () => {
    setScanBusy(true);
    try {
      const r = await axios.get(
        `${API}/admin/device-binding/retro-scan?min_accounts=2&limit=200`,
        { headers: headers() },
      );
      setScanResults(r.data);
      toast.success(`Found ${r.data.trusted_clusters_found} colliding devices`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Retro-scan failed');
    } finally {
      setScanBusy(false);
    }
  };

  const runRetroBlock = async (dry_run = true) => {
    if (!dry_run && !window.confirm(
      'This will LOCK all but the earliest account per colliding device. Proceed?'
    )) return;
    setBlockBusy(true);
    try {
      const r = await axios.post(
        `${API}/admin/device-binding/retro-block`,
        { admin_id: user?.uid || 'admin', dry_run },
        { headers: headers() },
      );
      toast.success(r.data?.message || 'Complete');
      // Update panel
      setScanResults(prev => ({ ...(prev || {}), retro_block_result: r.data }));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Retro-block failed');
    } finally {
      setBlockBusy(false);
    }
  };

  const loadCollisions = async () => {
    try {
      const r = await axios.get(
        `${API}/admin/device-binding/collisions?limit=100`,
        { headers: headers() },
      );
      setCollisions(r.data?.collisions || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load collisions');
    }
  };

  const loadSuspicious = async () => {
    try {
      const r = await axios.get(
        `${API}/admin/device-binding/suspicious?window_hours=24&min_signups=3`,
        { headers: headers() },
      );
      setSuspicious(r.data?.clusters || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load suspicious clusters');
    }
  };

  const doUnbind = async () => {
    if (!unbindTarget.uid && !unbindTarget.device_id && !unbindTarget.identifier) {
      toast.error('Provide UID, mobile/email, or device_id');
      return;
    }
    try {
      const r = await axios.post(
        `${API}/admin/device-binding/unbind`,
        {
          admin_id: user?.uid || 'admin',
          uid: unbindTarget.uid || undefined,
          device_id: unbindTarget.device_id || undefined,
          identifier: unbindTarget.identifier || undefined,
          reason: 'admin_manual',
        },
        { headers: headers() },
      );
      const msg = r.data?.lock_cleared_only
        ? 'No active binding — but lock flag was cleared'
        : 'Unbound successfully';
      toast.success(msg);
      setUnbindTarget({ uid: '', device_id: '', identifier: '' });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Unbind failed');
    }
  };

  const loadChangeRequests = async () => {
    setChangeReqBusy(true);
    try {
      const r = await axios.get(
        `${API}/admin/device-binding/change-requests?status=pending&limit=50`,
        { headers: headers() },
      );
      setChangeRequests(r.data?.requests || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load requests');
    } finally {
      setChangeReqBusy(false);
    }
  };

  const decideRequest = async (request_id, approve, reject_reason = null) => {
    try {
      const path = approve ? 'approve' : 'reject';
      const r = await axios.post(
        `${API}/admin/device-binding/change-requests/${request_id}/${path}`,
        { admin_id: user?.uid || 'admin', reject_reason },
        { headers: headers() },
      );
      toast.success(r.data?.message || (approve ? 'Approved' : 'Rejected'));
      setChangeRequests(prev => prev.filter(x => x.request_id !== request_id));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update request');
    }
  };

  useEffect(() => { if (pin) loadFlag(); }, [pin, loadFlag]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-bold">Device Binding Control</h1>
          <p className="text-sm text-gray-500">
            1-account-per-device enforcement. Retro-scan & manage multi-account devices.
          </p>
        </div>
      </header>

      {/* Admin PIN gate */}
      <Card className="p-4">
        <label className="text-sm font-semibold text-gray-700">Admin Operation PIN</label>
        <Input
          type="password"
          data-testid="device-binding-pin-input"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter X-Admin-Pin"
          className="mt-2 max-w-xs"
        />
        {!pin && <p className="text-[12px] text-amber-600 mt-2">All actions below require the PIN.</p>}
      </Card>

      {/* Master switch */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Lock className="w-5 h-5" /> Master Enforcement
            </h2>
            <p className="text-sm text-gray-500">
              When ON, native device_id collisions BLOCK login/signup. When OFF, collisions
              are only audit-logged.
            </p>
          </div>
          <Switch
            data-testid="device-binding-enforcement-toggle"
            checked={enforcementOn}
            onCheckedChange={toggleFlag}
            disabled={!flagLoaded}
          />
        </div>
        <p className={`text-sm mt-3 font-semibold ${enforcementOn ? 'text-emerald-600' : 'text-gray-500'}`}>
          Current status: {enforcementOn ? '🟢 ENFORCING' : '⚪ Off (audit only)'}
        </p>
      </Card>

      {/* Max users per device config */}
      <MaxUsersCard pin={pin} headers={headers} />

      {/* ────────────────────────────────────────────────────────────── */}
      {/* NUCLEAR RESET — one-click unbind ALL devices + unblock ALL users */}
      {/* ────────────────────────────────────────────────────────────── */}
      <Card className="p-4 border-2 border-red-300 bg-red-50/50" data-testid="global-reset-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" /> Global Reset — Danger Zone
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              One click will <b>unbind every device</b>, <b>unblock every user</b>, and
              <b> cancel every pending change-request</b>. All users can then log in
              fresh on any device on their next attempt. This action is fully audit-logged
              but <b>cannot be reversed</b>.
            </p>
          </div>
          {!showResetPanel && (
            <Button
              onClick={() => setShowResetPanel(true)}
              disabled={!pin}
              className="bg-red-600 hover:bg-red-700 text-white shrink-0"
              data-testid="open-global-reset-btn"
            >
              <Unlock className="w-4 h-4 mr-1" /> Reset All Bindings
            </Button>
          )}
        </div>
        {showResetPanel && (
          <div className="mt-4 p-4 rounded-lg border border-red-400 bg-white space-y-3">
            <p className="text-sm text-red-700 font-semibold">
              To confirm, type exactly: <code className="px-2 py-0.5 bg-red-100 rounded">CONFIRM RESET ALL</code>
            </p>
            <Input
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="CONFIRM RESET ALL"
              className="max-w-md"
              data-testid="global-reset-confirm-input"
            />
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleResetAll}
                disabled={resetBusy || resetConfirm.trim().toUpperCase() !== 'CONFIRM RESET ALL'}
                className="bg-red-600 hover:bg-red-700 text-white"
                data-testid="confirm-global-reset-btn"
              >
                {resetBusy ? (
                  <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Resetting…</>
                ) : (
                  <><Unlock className="w-4 h-4 mr-1" /> Yes, Reset Everything</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowResetPanel(false); setResetConfirm(''); }}
                disabled={resetBusy}
                data-testid="cancel-global-reset-btn"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Blocked users (fresh Aug 2026) */}
      <BlockedUsersCard pin={pin} headers={headers} adminId={user?.uid || 'admin'} />

      {/* Devices with multiple users */}
      <DevicesCard pin={pin} headers={headers} adminId={user?.uid || 'admin'} />

      {/* Retro scan */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5" /> Retro-Scan Multi-Account Devices
          </h2>
          <Button
            data-testid="device-binding-scan-btn"
            onClick={runRetroScan}
            disabled={!pin || scanBusy}
          >
            {scanBusy ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
            Run Scan
          </Button>
        </div>
        {scanResults && (
          <div className="text-sm space-y-2">
            <p>
              Trusted colliding devices: <b>{scanResults.trusted_clusters_found}</b> of {scanResults.total_clusters_found} total.
            </p>
            {scanResults.trusted_clusters_found > 0 && (
              <div className="flex gap-2 my-2">
                <Button
                  variant="outline"
                  onClick={() => runRetroBlock(true)}
                  disabled={blockBusy}
                  data-testid="device-binding-block-dryrun-btn"
                >
                  Preview Block (Dry Run)
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => runRetroBlock(false)}
                  disabled={blockBusy}
                  data-testid="device-binding-block-apply-btn"
                >
                  Apply Block (KEEP earliest, LOCK rest)
                </Button>
              </div>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-indigo-600">Cluster details</summary>
              <div className="max-h-96 overflow-y-auto mt-2 space-y-2">
                {(scanResults.clusters || []).map((c) => (
                  <div key={c.device_id} className="p-2 bg-gray-50 rounded border">
                    <div className="text-[12px] font-mono text-gray-600">
                      {c.device_id} ({c.account_count} accounts)
                    </div>
                    <ul className="text-[12px] mt-1 ml-3 list-disc">
                      {(c.users || []).map((u) => (
                        <li key={u.uid}>
                          {u.name || u.uid} — {u.mobile} — plan={u.subscription_plan}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
            {scanResults.retro_block_result && (
              <div className="p-2 bg-amber-50 border border-amber-300 rounded text-[12px]">
                <p className="font-semibold">
                  {scanResults.retro_block_result.dry_run ? 'Dry-run result' : 'Apply result'}:
                </p>
                <p>
                  Kept: {scanResults.retro_block_result.kept_count},
                  &nbsp;Locked: {scanResults.retro_block_result.suspended_count}
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Collisions log */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Recent Collisions
          </h2>
          <Button
            data-testid="device-binding-collisions-btn"
            variant="outline"
            onClick={loadCollisions}
            disabled={!pin}
          >
            Load
          </Button>
        </div>
        {collisions.length > 0 && (
          <div className="max-h-80 overflow-y-auto text-[12px] space-y-1 font-mono">
            {collisions.map((c) => (
              <div key={c.collision_id} className="p-1 border-b">
                <b>{c.event}</b> {c.occurred_at?.slice(0, 19)} —
                attempted uid={c.attempted_uid?.slice(0, 8)}… vs bound={c.bound_uid?.slice(0, 8)}…
                {c.enforcement_on ? ' [BLOCKED]' : ' [audit only]'}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Suspicious signups */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" /> Suspicious Signup Clusters (24h)
          </h2>
          <Button
            data-testid="device-binding-suspicious-btn"
            variant="outline"
            onClick={loadSuspicious}
            disabled={!pin}
          >
            Scan
          </Button>
        </div>
        {suspicious.length > 0 && (
          <div className="text-[12px] space-y-2">
            {suspicious.map((c, idx) => (
              <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded">
                <div>IP: <b>{c._id?.ip}</b> — {c.signup_count} signups</div>
                <ul className="ml-4 list-disc">
                  {(c.users || []).slice(0, 5).map((u) => (
                    <li key={u.uid}>{u.name} — {u.mobile}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Change-Device Requests (admin-approval queue) */}
      <Card className="p-4 border-indigo-300/40" data-testid="device-binding-change-requests-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Inbox className="w-5 h-5 text-indigo-500" /> Change Device Requests
            {changeRequests.length > 0 && (
              <span className="ml-2 text-[11px] bg-indigo-500 text-white rounded-full px-2 py-0.5" data-testid="change-requests-badge">
                {changeRequests.length} pending
              </span>
            )}
          </h2>
          <Button
            data-testid="change-requests-load-btn"
            variant="outline"
            onClick={loadChangeRequests}
            disabled={!pin || changeReqBusy}
          >
            {changeReqBusy ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
            Load Pending
          </Button>
        </div>
        {changeRequests.length > 0 && (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {changeRequests.map((req) => (
              <div
                key={req.request_id}
                data-testid={`change-request-${req.request_id}`}
                className="p-3 rounded-lg border border-gray-200 bg-white space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-gray-900">
                      {req.user_name || '(no name)'} — {req.user_mobile || req.user_email || req.user_uid}
                    </p>
                    <p className="text-[11px] text-gray-500 font-mono truncate">
                      UID: {req.user_uid}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-500 shrink-0">
                    {(req.requested_at || '').slice(0, 19).replace('T', ' ')}
                  </span>
                </div>
                <div className="text-[12px] text-gray-700 space-y-0.5">
                  <p><b>Reason:</b> {req.reason || '—'}</p>
                  {req.old_device_model && <p><b>Old device:</b> {req.old_device_model}</p>}
                  {req.contact_notes && <p><b>Notes:</b> {req.contact_notes}</p>}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    data-testid={`approve-request-${req.request_id}`}
                    onClick={() => decideRequest(req.request_id, true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white flex-1"
                  >
                    <Check className="w-3 h-3 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    data-testid={`reject-request-${req.request_id}`}
                    variant="destructive"
                    onClick={() => {
                      const r = window.prompt('Reason for rejection (optional):') || 'not_specified';
                      decideRequest(req.request_id, false, r);
                    }}
                  >
                    <XIcon className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!changeReqBusy && changeRequests.length === 0 && (
          <p className="text-sm text-gray-500">Click &quot;Load Pending&quot; to see any pending device change requests.</p>
        )}
      </Card>

      {/* Manual unbind */}
      <Card className="p-4">
        <h2 className="font-bold text-lg flex items-center gap-2 mb-1">
          <Unlock className="w-5 h-5" /> Manual Unbind
        </h2>
        <p className="text-[12px] text-gray-500 mb-3">
          Fill ANY one field below. Use &quot;Mobile / Email / UID&quot; for the fastest lookup
          (works even if the account was retro-blocked without an active binding).
        </p>
        <div className="space-y-2 mb-3">
          <Input
            data-testid="device-binding-unbind-identifier"
            placeholder="Mobile / Email / UID (any one — recommended)"
            value={unbindTarget.identifier}
            onChange={(e) => setUnbindTarget({ ...unbindTarget, identifier: e.target.value })}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input
              data-testid="device-binding-unbind-uid"
              placeholder="OR exact User UID"
              value={unbindTarget.uid}
              onChange={(e) => setUnbindTarget({ ...unbindTarget, uid: e.target.value })}
            />
            <Input
              data-testid="device-binding-unbind-device-id"
              placeholder="OR Device ID (AND-...)"
              value={unbindTarget.device_id}
              onChange={(e) => setUnbindTarget({ ...unbindTarget, device_id: e.target.value })}
            />
          </div>
        </div>
        <Button
          data-testid="device-binding-unbind-btn"
          onClick={doUnbind}
          disabled={!pin || (!unbindTarget.uid && !unbindTarget.device_id && !unbindTarget.identifier)}
          variant="destructive"
        >
          Unbind
        </Button>
      </Card>
    </div>
  );
};

export default AdminDeviceBinding;

// ============================================================================
// NEW CARDS (Aug 2026) — Max users config + Blocked users + Devices list
// ============================================================================

const MaxUsersCard = ({ pin, headers }) => {
  const [maxUsers, setMaxUsers] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pin || pin.length < 4) return;
    axios.get(`${API}/admin/device-binding/max-users`, { headers: headers() })
      .then(r => setMaxUsers(r.data.max_users_per_device))
      .catch(() => {});
  }, [pin, headers]);

  const save = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/admin/device-binding/max-users`,
        { max_users_per_device: Number(maxUsers) },
        { headers: headers() },
      );
      toast.success(`Set to ${maxUsers} users per device`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card className="p-4" data-testid="max-users-card">
      <h2 className="font-bold text-lg flex items-center gap-2 mb-2">
        <Users className="w-5 h-5" /> Max Users Per Device
      </h2>
      <p className="text-sm text-gray-500 mb-3">
        Up to this many DISTINCT users may share one physical device. Login attempts by additional users are blocked.
        Recommended: <b>2</b>.
      </p>
      <div className="flex items-center gap-2 max-w-xs">
        <Input type="number" min={1} max={10} value={maxUsers ?? ''} onChange={(e) => setMaxUsers(Number(e.target.value))} data-testid="max-users-input" />
        <Button onClick={save} disabled={!pin || busy || !maxUsers} data-testid="max-users-save">Save</Button>
      </div>
    </Card>
  );
};

const BlockedUsersCard = ({ pin, headers, adminId }) => {
  const [rows, setRows] = useState([]);
  const [hours, setHours] = useState(168);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!pin || pin.length < 4) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/device-binding/blocked-users?hours=${hours}`, { headers: headers() });
      setRows(r.data.blocked || []);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  }, [pin, headers, hours]);

  useEffect(() => { load(); }, [load]);

  const unblock = async (row, action) => {
    if (!window.confirm(`${action === 'bind_to_device' ? 'Bind this user to the device (overrides cap)' : 'Clear collisions only'}?`)) return;
    try {
      await axios.post(`${API}/admin/device-binding/unblock-user`,
        { attempted_uid: row.attempted_uid, device_id: row.device_id, action, admin_id: adminId },
        { headers: headers() },
      );
      toast.success('Unblocked');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <Card className="p-4" data-testid="blocked-users-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" /> Blocked Users (last {hours}h)
        </h2>
        <div className="flex gap-2">
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="text-xs border rounded px-2 py-1" data-testid="blocked-window-filter">
            <option value={24}>Last 24h</option>
            <option value={72}>Last 3d</option>
            <option value={168}>Last 7d</option>
            <option value={720}>Last 30d</option>
          </select>
          <Button onClick={load} disabled={!pin || loading} variant="outline" size="sm" data-testid="blocked-refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">No blocked users in this window.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-2 text-left">When</th>
                <th className="px-2 py-2 text-left">User</th>
                <th className="px-2 py-2 text-left">Device</th>
                <th className="px-2 py-2 text-left">Bound to</th>
                <th className="px-2 py-2 text-right">Attempts</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.attempted_uid + r.device_id} className="border-b border-slate-100" data-testid={`blocked-row-${r.attempted_uid}`}>
                  <td className="px-2 py-1.5 text-slate-600">{(r.occurred_at || '').slice(0, 16)}</td>
                  <td className="px-2 py-1.5">
                    <p className="font-medium">{r.attempted_user?.name || '—'}</p>
                    <p className="text-[10px] text-slate-400">{r.attempted_user?.mobile || r.attempted_user?.email}</p>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{r.device_id?.slice(0, 20)}...<br/><span className="text-slate-400">{r.device_model}</span></td>
                  <td className="px-2 py-1.5 text-[10px]">
                    {(r.bound_uids || [r.bound_uid]).slice(0, 3).map(u => <div key={u} className="font-mono text-slate-500">{u?.slice(0, 10)}</div>)}
                  </td>
                  <td className="px-2 py-1.5 text-right">{r.attempts}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button onClick={() => unblock(r, 'bind_to_device')} className="text-xs text-emerald-600 hover:underline mr-2" data-testid={`unblock-bind-${r.attempted_uid}`}>
                      Bind
                    </button>
                    <button onClick={() => unblock(r, 'clear_only')} className="text-xs text-slate-500 hover:underline" data-testid={`unblock-clear-${r.attempted_uid}`}>
                      Clear
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-500 mt-2">
            <b>Bind</b> = force-add this user to the device (bypasses max cap once). <b>Clear</b> = just resolve the collision log; next attempt binds only if room.
          </p>
        </div>
      )}
    </Card>
  );
};

const DevicesCard = ({ pin, headers, adminId }) => {
  const [rows, setRows] = useState([]);
  const [onlyOverLimit, setOnlyOverLimit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [details, setDetails] = useState({});

  const load = useCallback(async () => {
    if (!pin || pin.length < 4) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/device-binding/devices?only_over_limit=${onlyOverLimit}&limit=300`, { headers: headers() });
      setRows(r.data.devices || []);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  }, [pin, headers, onlyOverLimit]);

  useEffect(() => { load(); }, [load]);

  const expand = async (dev) => {
    const wasOpen = expanded[dev.device_id];
    setExpanded(prev => ({ ...prev, [dev.device_id]: !wasOpen }));
    if (!wasOpen && !details[dev.device_id]) {
      try {
        const r = await axios.get(`${API}/admin/device-binding/devices/${encodeURIComponent(dev.device_id)}/users`, { headers: headers() });
        setDetails(prev => ({ ...prev, [dev.device_id]: r.data.bindings }));
      } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    }
  };

  const removeBinding = async (device_id, user_uid) => {
    if (!window.confirm('Remove this user from the device? (Frees a slot)')) return;
    try {
      await axios.post(`${API}/admin/device-binding/remove-binding`,
        { device_id, user_uid, admin_id: adminId, reason: 'admin_manual' },
        { headers: headers() },
      );
      toast.success('Binding removed');
      setDetails(prev => ({ ...prev, [device_id]: null }));
      setExpanded(prev => ({ ...prev, [device_id]: false }));
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <Card className="p-4" data-testid="devices-card">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Activity className="w-5 h-5" /> Bound Devices
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-xs flex items-center gap-1">
            <input type="checkbox" checked={onlyOverLimit} onChange={(e) => setOnlyOverLimit(e.target.checked)} data-testid="devices-over-limit-filter" />
            Only at capacity
          </label>
          <Button onClick={load} disabled={!pin || loading} variant="outline" size="sm" data-testid="devices-refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">{loading ? 'Loading...' : 'No devices to show.'}</p>
      ) : (
        <div className="space-y-1">
          {rows.map(dev => (
            <div key={dev.device_id} className={`border rounded-lg ${dev.at_capacity ? 'border-yellow-300 bg-yellow-50/40' : 'border-slate-200'}`} data-testid={`device-${dev.device_id}`}>
              <button onClick={() => expand(dev)} className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-2 py-0.5 rounded font-semibold ${dev.at_capacity ? 'bg-yellow-500 text-white' : 'bg-emerald-500 text-white'}`}>
                    {dev.users_count} user{dev.users_count > 1 ? 's' : ''}
                  </span>
                  <span className="font-mono text-slate-700 truncate">{dev.device_id.slice(0, 30)}</span>
                  <span className="text-slate-400 hidden sm:inline">
                    {dev.device_models?.[0]}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">Last: {(dev.last_seen_at || '').slice(0, 10)}</span>
              </button>
              {expanded[dev.device_id] && details[dev.device_id] && (
                <div className="border-t border-slate-200 p-2 space-y-1 bg-white">
                  {details[dev.device_id].map(b => (
                    <div key={b.binding_id} className="flex items-center justify-between text-[11px] px-2 py-1 hover:bg-slate-50">
                      <div>
                        <p className="font-medium">{b.user?.name || '—'} <span className="text-slate-400 font-mono">({b.user_uid?.slice(0, 10)})</span></p>
                        <p className="text-slate-500 text-[10px]">
                          Bound {(b.bound_at || '').slice(0, 10)} • {b.user?.mobile || b.user?.email || '—'}
                          {b.override_max_users && <span className="ml-1 text-amber-600">• override</span>}
                        </p>
                      </div>
                      <button onClick={() => removeBinding(dev.device_id, b.user_uid)} className="text-red-500 hover:underline text-xs" data-testid={`remove-${dev.device_id}-${b.user_uid}`}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
