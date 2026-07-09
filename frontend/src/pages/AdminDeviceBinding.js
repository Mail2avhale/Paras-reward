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
  const [unbindTarget, setUnbindTarget] = useState({ uid: '', device_id: '' });
  const [changeRequests, setChangeRequests] = useState([]);
  const [changeReqBusy, setChangeReqBusy] = useState(false);

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
    if (!unbindTarget.uid && !unbindTarget.device_id) {
      toast.error('Provide uid or device_id');
      return;
    }
    try {
      const r = await axios.post(
        `${API}/admin/device-binding/unbind`,
        {
          admin_id: user?.uid || 'admin',
          uid: unbindTarget.uid || undefined,
          device_id: unbindTarget.device_id || undefined,
          reason: 'admin_manual',
        },
        { headers: headers() },
      );
      toast.success('Unbound successfully');
      setUnbindTarget({ uid: '', device_id: '' });
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
        <h2 className="font-bold text-lg flex items-center gap-2 mb-3">
          <Unlock className="w-5 h-5" /> Manual Unbind
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          <Input
            data-testid="device-binding-unbind-uid"
            placeholder="User UID"
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
        <Button
          data-testid="device-binding-unbind-btn"
          onClick={doUnbind}
          disabled={!pin || (!unbindTarget.uid && !unbindTarget.device_id)}
          variant="destructive"
        >
          Unbind
        </Button>
      </Card>
    </div>
  );
};

export default AdminDeviceBinding;
