/**
 * Admin → Force Activate Elite Subscription via PRC
 * ---------------------------------------------------------------------------
 * Admin-PIN-protected override that activates an Elite subscription for a
 * target user using PRC, even if the user's PRC balance is insufficient.
 *
 * Rules (enforced by backend):
 *  - Admin PIN required (153759)
 *  - Dynamic Elite price (₹999 + 18% GST + Fees → PRC)
 *  - Consumes 1 of 3 lifetime PRC chances
 *  - 7-day subscription cooldown ENFORCED (not bypassed)
 *  - Allows PRC balance to go NEGATIVE (overdraft / debt)
 *  - Full audit trail: admin_audit_logs + user PRC statement
 *
 * 3-step UI flow:
 *   1. Search user (mobile / email / uid) → Preview summary
 *   2. Review summary → "Confirm & Enter PIN"
 *   3. Enter PIN → Activate → Success panel
 *
 * Mounted at /admin/force-activate-subscription (admin-gated).
 */
import React, { useState, useCallback } from 'react';
import axios from 'axios';
import {
  Search,
  Shield,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  User,
  Phone,
  Mail,
  Crown,
  KeyRound,
  ArrowRight,
  RotateCcw,
  Info,
  Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatPRC = (v) => (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const formatINR = (v) => `₹${(Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function AdminForceActivateSubscription() {
  // Step 1: search
  const [identifier, setIdentifier] = useState('');
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState(null);
  const [searchError, setSearchError] = useState(null);

  // Step 2: confirm → PIN
  const [showPinModal, setShowPinModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Step 3: result
  const [result, setResult] = useState(null);

  const authHeader = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!identifier.trim()) {
      toast.error('Please enter mobile / email / UID');
      return;
    }
    setSearching(true);
    setSearchError(null);
    setPreview(null);
    setResult(null);
    try {
      const { data } = await axios.get(
        `${API}/admin/subscription/force-activate-preview`,
        { params: { identifier: identifier.trim() }, headers: authHeader() }
      );
      setPreview(data);
    } catch (err) {
      setSearchError(err?.response?.data?.detail || err?.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [identifier]);

  const handleForceActivate = useCallback(async () => {
    if (!adminPin.trim()) {
      toast.error('Admin PIN required');
      return;
    }
    if (!preview?.user?.uid) return;
    setSubmitting(true);
    try {
      const adminUid = (() => {
        try {
          const stored = JSON.parse(localStorage.getItem('user') || '{}');
          return stored?.uid || 'unknown';
        } catch {
          return 'unknown';
        }
      })();
      const { data } = await axios.post(
        `${API}/admin/subscription/force-activate-elite-prc`,
        {
          admin_uid: adminUid,
          admin_pin: adminPin.trim(),
          target_identifier: identifier.trim(),
          admin_note: adminNote.trim() || undefined,
        },
        { headers: authHeader() }
      );
      setResult(data);
      setShowPinModal(false);
      setAdminPin('');
      setAdminNote('');
      toast.success('Elite subscription activated');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Activation failed');
    } finally {
      setSubmitting(false);
    }
  }, [adminPin, adminNote, preview, identifier]);

  const resetAll = () => {
    setIdentifier('');
    setPreview(null);
    setResult(null);
    setSearchError(null);
    setAdminPin('');
    setAdminNote('');
    setShowPinModal(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6" data-testid="admin-force-activate-page">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Force Activate Elite (PRC Override)</h1>
            <p className="text-sm text-slate-500">
              Admin-PIN-protected override: activate Elite plan using PRC, even with insufficient balance.
            </p>
          </div>
        </div>
      </div>

      {/* Rules banner */}
      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="force-activate-rules-banner">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">How this works</p>
            <ul className="list-disc pl-5 text-xs space-y-0.5">
              <li>Consumes 1 of the user&apos;s 3 lifetime PRC subscription chances.</li>
              <li>Enforces the 7-day subscription cooldown (NOT bypassed).</li>
              <li>Allows PRC balance to go negative — subsequent mining / rewards will pay off the debt.</li>
              <li>Full audit trail: admin_audit_logs + user PRC statement.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Step 1: Search */}
      {!result && (
        <form onSubmit={handleSearch} className="bg-white border border-slate-200 rounded-2xl p-5 mb-5" data-testid="search-panel">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Search user (mobile, email, or UID)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="9876543210 or user@example.com"
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                data-testid="search-input"
                disabled={searching}
              />
            </div>
            <Button
              type="submit"
              disabled={searching || !identifier.trim()}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              data-testid="search-btn"
            >
              {searching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</> : <>Lookup <ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>
          </div>
          {searchError && (
            <p className="mt-3 text-sm text-red-600" data-testid="search-error">{searchError}</p>
          )}
        </form>
      )}

      {/* Step 2: Preview */}
      {!result && preview && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5" data-testid="preview-panel">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">User Summary</h2>
          </div>

          {/* User info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <InfoRow label="Name" value={preview.user?.name} testid="preview-user-name" />
            <InfoRow label="UID" value={preview.user?.uid} testid="preview-user-uid" mono />
            <InfoRow icon={Phone} label="Mobile" value={preview.user?.mobile} testid="preview-user-mobile" />
            <InfoRow icon={Mail} label="Email" value={preview.user?.email} testid="preview-user-email" />
            <InfoRow label="Current Plan" value={(preview.user?.current_plan || '—').toUpperCase()} testid="preview-user-plan" />
            <InfoRow
              label="Current Expiry"
              value={preview.user?.current_expiry ? String(preview.user.current_expiry).slice(0, 10) : '—'}
              testid="preview-user-expiry"
            />
          </div>

          {/* Pricing */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-5">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Elite Pricing (dynamic)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Stat label="PRC Required" value={`${formatPRC(preview.pricing?.prc_required)} PRC`} testid="preview-prc-required" />
              <Stat label="INR Equivalent" value={formatINR(preview.pricing?.inr_equivalent)} testid="preview-inr" />
              <Stat label="PRC Rate" value={`${preview.pricing?.prc_rate_used ?? '—'}`} testid="preview-rate" />
              <Stat label="Duration" value="28 days" testid="preview-duration" />
            </div>
          </div>

          {/* Projection */}
          <div className={`rounded-xl border p-4 mb-5 ${preview.projection?.overdraft_will_apply ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`} data-testid="preview-projection">
            <div className="flex items-center gap-2 mb-2">
              {preview.projection?.overdraft_will_apply ? (
                <TrendingDown className="w-4 h-4 text-red-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              <p className={`text-sm font-semibold ${preview.projection?.overdraft_will_apply ? 'text-red-700' : 'text-emerald-700'}`}>
                {preview.projection?.overdraft_will_apply ? 'Overdraft will apply' : 'Sufficient balance'}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Stat label="Balance Before" value={`${formatPRC(preview.user?.prc_balance)} PRC`} testid="proj-before" />
              <Stat label="Balance After" value={`${formatPRC(preview.projection?.balance_after)} PRC`} tone={preview.projection?.overdraft_will_apply ? 'red' : 'emerald'} testid="proj-after" />
              {preview.projection?.overdraft_will_apply && (
                <Stat label="Debt (overdraft)" value={`${formatPRC(preview.projection?.debt_amount)} PRC`} tone="red" testid="proj-debt" />
              )}
              {!preview.projection?.overdraft_will_apply && (
                <Stat label="Activation Type" value={preview.projection?.is_upcoming ? 'Queued' : 'Immediate'} testid="proj-type" />
              )}
            </div>
            {preview.projection?.is_upcoming && (
              <p className="text-xs text-slate-600 mt-2">
                User already has an active plan — new Elite will be <strong>queued</strong> to start after expiry.
              </p>
            )}
          </div>

          {/* Eligibility */}
          <div className="rounded-xl border border-slate-200 p-4 mb-5" data-testid="preview-eligibility">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Eligibility</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Stat
                label="PRC Chances Used"
                value={`${preview.eligibility?.chances_used}/${preview.eligibility?.chances_max}`}
                tone={preview.eligibility?.chances_exhausted ? 'red' : 'slate'}
                testid="elig-chances"
              />
              <Stat
                label="Cooldown"
                value={preview.eligibility?.cooldown_blocked ? 'BLOCKED' : 'Clear'}
                tone={preview.eligibility?.cooldown_blocked ? 'red' : 'emerald'}
                testid="elig-cooldown"
              />
              <Stat
                label="Can Proceed"
                value={preview.eligibility?.can_proceed ? 'YES' : 'NO'}
                tone={preview.eligibility?.can_proceed ? 'emerald' : 'red'}
                testid="elig-can-proceed"
              />
            </div>
            {preview.eligibility?.blockers?.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-red-700" data-testid="elig-blockers">
                {preview.eligibility.blockers.map((b, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={resetAll} data-testid="reset-btn">
              <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </Button>
            <Button
              onClick={() => setShowPinModal(true)}
              disabled={!preview.eligibility?.can_proceed}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              data-testid="confirm-and-pin-btn"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Confirm & Enter PIN
            </Button>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" data-testid="pin-modal">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-bold text-slate-900">Admin PIN Required</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              You&apos;re about to force-activate Elite for{' '}
              <strong>{preview?.user?.name}</strong> ({preview?.user?.mobile || preview?.user?.email}).
              This will deduct <strong>{formatPRC(preview?.pricing?.prc_required)} PRC</strong>
              {preview?.projection?.overdraft_will_apply && (
                <> and create a <strong className="text-red-600">debt of {formatPRC(preview?.projection?.debt_amount)} PRC</strong></>
              )}.
            </p>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Admin PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="••••••"
              data-testid="admin-pin-input"
              autoFocus
            />
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Note (optional)</label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={2}
              placeholder="e.g. User requested activation; balance shortfall due to ..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-400"
              data-testid="admin-note-input"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowPinModal(false)} disabled={submitting} data-testid="pin-cancel-btn">
                Cancel
              </Button>
              <Button
                onClick={handleForceActivate}
                disabled={submitting || adminPin.length < 4}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                data-testid="pin-submit-btn"
              >
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activating…</> : 'Force Activate'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {result && (
        <div className="bg-white border border-emerald-200 rounded-2xl p-5" data-testid="result-panel">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <h2 className="text-lg font-bold text-emerald-700">Elite Subscription {result.is_upcoming ? 'Queued' : 'Activated'}</h2>
          </div>
          <p className="text-sm text-slate-700 mb-4" data-testid="result-message">{result.message}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">User</p>
              <InfoRow label="Name" value={result.user?.name} testid="result-user-name" />
              <InfoRow label="Mobile" value={result.user?.mobile} testid="result-user-mobile" />
              <InfoRow label="Email" value={result.user?.email} testid="result-user-email" />
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Subscription</p>
              <InfoRow label="Plan" value="ELITE" testid="result-sub-plan" />
              <InfoRow label={result.is_upcoming ? 'Scheduled End' : 'Expires On'} value={result.subscription?.expiry} testid="result-sub-expiry" />
              <InfoRow label="PRC Deducted" value={`${formatPRC(result.subscription?.prc_deducted)} PRC`} testid="result-prc-deducted" />
              <InfoRow label="INR Equivalent" value={formatINR(result.subscription?.inr_equivalent)} testid="result-inr-equiv" />
            </div>
            <div className={`rounded-xl border p-4 ${result.balance?.overdraft_applied ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">PRC Balance</p>
              <InfoRow label="Before" value={`${formatPRC(result.balance?.before)} PRC`} testid="result-bal-before" />
              <InfoRow
                label="After"
                value={`${formatPRC(result.balance?.after)} PRC`}
                testid="result-bal-after"
                tone={result.balance?.overdraft_applied ? 'red' : 'emerald'}
              />
              {result.balance?.overdraft_applied && (
                <InfoRow
                  label="Debt (overdraft)"
                  value={`${formatPRC(result.balance?.debt_amount)} PRC`}
                  testid="result-debt"
                  tone="red"
                />
              )}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Chances</p>
              <InfoRow label="Used Before" value={`${result.chances?.used_before}/3`} testid="result-chances-before" />
              <InfoRow label="Used Now" value={`${result.chances?.used_after}/3`} testid="result-chances-after" />
              <InfoRow label="Remaining" value={result.chances?.remaining} testid="result-chances-remaining" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={resetAll} data-testid="result-reset-btn">
              <RotateCcw className="w-4 h-4 mr-2" /> Activate Another User
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, testid, mono, tone }) {
  const toneCls = tone === 'red' ? 'text-red-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-slate-900';
  return (
    <div className="flex items-start gap-2 text-sm py-1">
      {Icon && <Icon className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />}
      <span className="text-slate-500 min-w-[90px]">{label}</span>
      <span className={`font-medium break-all ${toneCls} ${mono ? 'font-mono text-xs' : ''}`} data-testid={testid}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function Stat({ label, value, tone, testid }) {
  const toneCls = tone === 'red'
    ? 'text-red-700'
    : tone === 'emerald'
    ? 'text-emerald-700'
    : 'text-slate-900';
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-semibold ${toneCls}`} data-testid={testid}>{value}</p>
    </div>
  );
}
