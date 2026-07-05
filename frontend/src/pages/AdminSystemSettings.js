import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Settings, Save, RefreshCw, Coins, Calculator, 
  TrendingUp, Users, Percent, Clock, Shield,
  DollarSign, Zap, Target, AlertTriangle, ArrowLeft, Gift
} from 'lucide-react';

import { API } from "../lib/api";

const AdminSystemSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  
  // PRC Rate is now FIXED at 10 PRC = ₹1 (June 2026 cleanup) — no settings.
  
  // Redeem Limit Settings
  const [redeemSettings, setRedeemSettings] = useState({
    multiplier_1: 5,
    multiplier_2: 10,
    referral_bonus_percent: 20,
    enabled: true
  });

  // Global Redeem-Limit Formula Toggle (Jul 2026)
  //   enabled=true  → network-based unlock% formula (existing behaviour)
  //   enabled=false → flat unlock % for every user regardless of network
  const [globalRedeem, setGlobalRedeem] = useState({
    enabled: true,
    flat_unlock_percent: 80,
  });

  // Mining Commission Tiers (Jul 2026 — Live admin config for 3-tier Elite
  // referral reward system distributed on every mining collect)
  const [commissionCfg, setCommissionCfg] = useState({
    enabled: true,
    tiers: [
      { tier: 1, percent: 1.0 },
      { tier: 2, percent: 1.0 },
      { tier: 3, percent: 1.0 },
    ],
    elite_only: true,
    roll_up: true,
  });
  const MAX_COMMISSION_TIERS = 10;
  
  // Mining Rate Settings
  const [miningSettings, setMiningSettings] = useState({
    explorer: { base_rate: 30, tap_bonus: 5 },
    startup: { base_rate: 55, tap_bonus: 10 },
    growth: { base_rate: 90, tap_bonus: 15 },
    elite: { base_rate: 100, tap_bonus: 20 }
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [redeemRes, miningRes, globalRes, commissionRes] = await Promise.all([
        axios.get(`${API}/admin/settings/redeem-limit`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/settings/mining-rates`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/settings/redeem-limit-global`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/settings/mining-commission-tiers`).catch(() => ({ data: {} })),
      ]);
      
      if (redeemRes.data) setRedeemSettings(prev => ({ ...prev, ...redeemRes.data }));
      if (miningRes.data?.rates) setMiningSettings(miningRes.data.rates);
      if (globalRes.data && typeof globalRes.data.enabled === 'boolean') {
        setGlobalRedeem({
          enabled: globalRes.data.enabled,
          flat_unlock_percent: Number(globalRes.data.flat_unlock_percent ?? 80),
        });
      }
      if (commissionRes.data && Array.isArray(commissionRes.data.tiers)) {
        setCommissionCfg({
          enabled: Boolean(commissionRes.data.enabled),
          tiers: commissionRes.data.tiers.map((t) => ({
            tier: Number(t.tier),
            percent: Number(t.percent),
          })),
          elite_only: Boolean(commissionRes.data.elite_only),
          roll_up: Boolean(commissionRes.data.roll_up),
        });
      }
      
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveGlobalRedeem = async () => {
    setSaving(prev => ({ ...prev, globalRedeem: true }));
    try {
      const pct = Number(globalRedeem.flat_unlock_percent);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        toast.error('Flat unlock % must be between 0 and 100');
        setSaving(prev => ({ ...prev, globalRedeem: false }));
        return;
      }
      await axios.post(`${API}/admin/settings/redeem-limit-global`, {
        enabled: globalRedeem.enabled,
        flat_unlock_percent: pct,
      });
      toast.success(
        globalRedeem.enabled
          ? 'Network-based unlock formula ENABLED'
          : `Flat unlock (${pct}%) ACTIVE for all users`,
        { duration: 4000 }
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save global toggle');
    } finally {
      setSaving(prev => ({ ...prev, globalRedeem: false }));
    }
  };

  // ── Mining Commission Tier helpers ─────────────────────────────────
  const addCommissionTier = () => {
    setCommissionCfg((prev) => {
      if (prev.tiers.length >= MAX_COMMISSION_TIERS) {
        toast.error(`Maximum ${MAX_COMMISSION_TIERS} tiers allowed`);
        return prev;
      }
      const nextTier = prev.tiers.length + 1;
      return {
        ...prev,
        tiers: [...prev.tiers, { tier: nextTier, percent: 1.0 }],
      };
    });
  };

  const removeCommissionTier = (idx) => {
    setCommissionCfg((prev) => {
      if (prev.tiers.length <= 1) {
        toast.error('At least one tier is required');
        return prev;
      }
      const next = prev.tiers.filter((_, i) => i !== idx).map((t, i) => ({
        tier: i + 1,
        percent: t.percent,
      }));
      return { ...prev, tiers: next };
    });
  };

  const updateCommissionTierPercent = (idx, val) => {
    setCommissionCfg((prev) => {
      const next = [...prev.tiers];
      next[idx] = { ...next[idx], percent: val === '' ? '' : Number(val) };
      return { ...prev, tiers: next };
    });
  };

  const saveCommissionCfg = async () => {
    setSaving((p) => ({ ...p, commission: true }));
    try {
      // Client-side validation
      for (const t of commissionCfg.tiers) {
        const p = Number(t.percent);
        if (isNaN(p) || p < 0 || p > 100) {
          toast.error(`Tier ${t.tier}: percent must be 0-100`);
          setSaving((p) => ({ ...p, commission: false }));
          return;
        }
      }
      const total = commissionCfg.tiers.reduce((s, t) => s + Number(t.percent || 0), 0);
      if (total > 100) {
        toast.error(`Sum of all tier percentages must be ≤ 100 (got ${total.toFixed(2)})`);
        setSaving((p) => ({ ...p, commission: false }));
        return;
      }
      const res = await axios.post(`${API}/admin/settings/mining-commission-tiers`, {
        enabled: commissionCfg.enabled,
        tiers: commissionCfg.tiers.map((t) => ({
          tier: t.tier,
          percent: Number(t.percent),
        })),
        elite_only: commissionCfg.elite_only,
        roll_up: commissionCfg.roll_up,
      });
      toast.success(
        `Commission tiers saved (${res.data.tiers.length} tiers, total ${res.data.total_percent}%)`,
        { duration: 4000 }
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save commission tiers');
    } finally {
      setSaving((p) => ({ ...p, commission: false }));
    }
  };

  const saveRedeemLimit = async () => {
    setSaving(prev => ({ ...prev, redeem: true }));
    try {
      await axios.post(`${API}/admin/settings/redeem-limit`, redeemSettings);
      toast.success('Redeem Limit settings saved!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(prev => ({ ...prev, redeem: false }));
    }
  };

  const saveMiningRates = async () => {
    setSaving(prev => ({ ...prev, mining: true }));
    try {
      await axios.post(`${API}/admin/settings/mining-rates`, { rates: miningSettings });
      toast.success('Mining Rate settings saved!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(prev => ({ ...prev, mining: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Settings className="w-8 h-8 text-purple-500" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">System Settings</h1>
              <p className="text-slate-500 text-sm">Configure PRC rates, limits & mining</p>
            </div>
          </div>
          <Button onClick={fetchSettings} variant="outline" className="border-slate-200">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* PRC Rate Info (FIXED 10:1) */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-slate-800">PRC Rate</h2>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-900 font-bold text-2xl">10 PRC = ₹1</p>
              <p className="text-amber-700 text-xs mt-1">
                Fixed conversion (June 2026 cleanup). Dynamic-rate engine and admin
                overrides have been removed.
              </p>
            </div>
          </div>

          {/* Global Redeem Limit Formula Toggle (Jul 2026) */}
          <div
            className="bg-white rounded-xl p-5 border border-slate-200 lg:col-span-2"
            data-testid="global-redeem-limit-card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className={`w-5 h-5 ${globalRedeem.enabled ? 'text-emerald-500' : 'text-amber-500'}`} />
              <h2 className="text-lg font-semibold text-slate-800">
                Global Redeem-Limit Formula
              </h2>
              <span
                className={`ml-auto text-[10px] font-bold px-2 py-1 rounded-full ${
                  globalRedeem.enabled
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
                data-testid="global-redeem-status-badge"
              >
                {globalRedeem.enabled
                  ? 'NETWORK-BASED (default)'
                  : `FLAT ${globalRedeem.flat_unlock_percent}% UNLOCK`}
              </span>
            </div>

            <p className="text-slate-500 text-xs mb-4 leading-relaxed">
              When <b>enabled</b> (default), a user&apos;s Redeem Limit unlock % is derived
              from their active Single-Leg-Tree network size. When <b>disabled</b>, the
              network formula is bypassed and every user gets a flat unlock percentage
              (e.g. 80%) of their total mined PRC. Per-user admin overrides are still
              respected on top (user gets <code>max(flat, override)</code>).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div>
                  <label className="text-slate-700 font-medium text-sm">
                    Network-based Formula
                  </label>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    ON = original logic • OFF = flat unlock below
                  </p>
                </div>
                <button
                  data-testid="global-redeem-enabled-toggle"
                  onClick={() =>
                    setGlobalRedeem((prev) => ({ ...prev, enabled: !prev.enabled }))
                  }
                  className={`w-12 h-6 rounded-full transition-colors ${
                    globalRedeem.enabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform shadow ${
                      globalRedeem.enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <label className="text-slate-700 font-medium text-sm">
                  Flat Unlock % (when disabled)
                </label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    data-testid="global-redeem-flat-percent-input"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={globalRedeem.flat_unlock_percent}
                    onChange={(e) =>
                      setGlobalRedeem((prev) => ({
                        ...prev,
                        flat_unlock_percent: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    disabled={globalRedeem.enabled}
                    className="bg-white border-slate-200 text-slate-800"
                  />
                  <span className="text-slate-500 text-sm">%</span>
                </div>
                <p className="text-slate-500 text-[11px] mt-1">
                  Applied only when the toggle above is OFF.
                </p>
              </div>
            </div>

            {!globalRedeem.enabled && (
              <div
                className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2"
                data-testid="global-redeem-warning-banner"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 leading-relaxed">
                  <b>Heads-up:</b> With the network formula OFF, every eligible user
                  will instantly see up to{' '}
                  <b>{globalRedeem.flat_unlock_percent}%</b> of their total mined PRC as
                  redeemable — regardless of their referral / network size. Bank redeem
                  &amp; bill-pay flows will approve larger amounts. Consider toggling back
                  ON once your temporary campaign / issue is resolved.
                </div>
              </div>
            )}

            <Button
              onClick={saveGlobalRedeem}
              disabled={saving.globalRedeem}
              className="w-full bg-purple-600 hover:bg-purple-700"
              data-testid="save-global-redeem-btn"
            >
              {saving.globalRedeem ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Global Toggle
            </Button>
          </div>

          {/* Mining Commission Tiers (Jul 2026) */}
          <div
            className="bg-white rounded-xl p-5 border border-slate-200 lg:col-span-2"
            data-testid="mining-commission-tiers-card"
          >
            <div className="flex items-center gap-2 mb-3">
              <Gift className={`w-5 h-5 ${commissionCfg.enabled ? 'text-fuchsia-500' : 'text-slate-400'}`} />
              <h2 className="text-lg font-semibold text-slate-800">
                Mining Commission Tiers
              </h2>
              <span
                className={`ml-auto text-[10px] font-bold px-2 py-1 rounded-full ${
                  commissionCfg.enabled
                    ? 'bg-fuchsia-100 text-fuchsia-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
                data-testid="commission-status-badge"
              >
                {commissionCfg.enabled ? `ACTIVE — ${commissionCfg.tiers.length} TIER${commissionCfg.tiers.length > 1 ? 'S' : ''}` : 'DISABLED'}
              </span>
            </div>

            <p className="text-slate-500 text-xs mb-4 leading-relaxed">
              Configure up to {MAX_COMMISSION_TIERS} referral tiers that share PRC when a downline Elite user
              collects mining rewards. Each tier percentage is applied to the collected PRC and
              credited to the nth Elite upline in the chain. Roll-up rule: non-Elite ancestors are
              skipped so the tier slot passes to the next Elite user. Changes take effect on the
              very next mining collect — no code deploy required.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div>
                  <label className="text-slate-700 font-medium text-sm">Feature Enabled</label>
                  <p className="text-slate-500 text-[11px] mt-0.5">Master ON/OFF</p>
                </div>
                <button
                  data-testid="commission-enabled-toggle"
                  onClick={() =>
                    setCommissionCfg((p) => ({ ...p, enabled: !p.enabled }))
                  }
                  className={`w-12 h-6 rounded-full transition-colors ${
                    commissionCfg.enabled ? 'bg-fuchsia-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform shadow ${
                      commissionCfg.enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div>
                  <label className="text-slate-700 font-medium text-sm">Elite-Only Recipients</label>
                  <p className="text-slate-500 text-[11px] mt-0.5">Basic uplines skipped</p>
                </div>
                <button
                  data-testid="commission-elite-only-toggle"
                  onClick={() =>
                    setCommissionCfg((p) => ({ ...p, elite_only: !p.elite_only }))
                  }
                  className={`w-12 h-6 rounded-full transition-colors ${
                    commissionCfg.elite_only ? 'bg-fuchsia-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform shadow ${
                      commissionCfg.elite_only ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div>
                  <label className="text-slate-700 font-medium text-sm">Roll-Up Skip</label>
                  <p className="text-slate-500 text-[11px] mt-0.5">Advance past non-Elite</p>
                </div>
                <button
                  data-testid="commission-roll-up-toggle"
                  onClick={() =>
                    setCommissionCfg((p) => ({ ...p, roll_up: !p.roll_up }))
                  }
                  className={`w-12 h-6 rounded-full transition-colors ${
                    commissionCfg.roll_up ? 'bg-fuchsia-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform shadow ${
                      commissionCfg.roll_up ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              {commissionCfg.tiers.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200"
                  data-testid={`commission-tier-row-${idx + 1}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-fuchsia-100 text-fuchsia-700 font-bold flex items-center justify-center shrink-0">
                    T{idx + 1}
                  </div>
                  <div className="flex-1">
                    <label className="text-slate-500 text-[10px] uppercase tracking-wider">
                      Tier {idx + 1} Percent
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.05"
                        value={t.percent}
                        onChange={(e) => updateCommissionTierPercent(idx, e.target.value)}
                        className="bg-white border-slate-200 text-slate-800 h-9"
                        data-testid={`commission-tier-${idx + 1}-percent-input`}
                      />
                      <span className="text-slate-500 text-sm shrink-0">%</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => removeCommissionTier(idx)}
                    disabled={commissionCfg.tiers.length <= 1}
                    className="h-9 border-rose-200 text-rose-600 hover:bg-rose-50"
                    data-testid={`commission-tier-${idx + 1}-remove-btn`}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                onClick={addCommissionTier}
                disabled={commissionCfg.tiers.length >= MAX_COMMISSION_TIERS}
                className="border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-50"
                data-testid="commission-add-tier-btn"
              >
                + Add Tier ({commissionCfg.tiers.length}/{MAX_COMMISSION_TIERS})
              </Button>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Distribution</p>
                <p
                  className="text-fuchsia-600 font-bold tabular-nums"
                  data-testid="commission-total-preview"
                >
                  {commissionCfg.tiers
                    .reduce((s, t) => s + Number(t.percent || 0), 0)
                    .toFixed(2)}
                  %
                </p>
              </div>
            </div>

            <Button
              onClick={saveCommissionCfg}
              disabled={saving.commission}
              className="w-full bg-fuchsia-600 hover:bg-fuchsia-700"
              data-testid="save-commission-tiers-btn"
            >
              {saving.commission ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Commission Tiers
            </Button>
          </div>

          {/* Redeem Limit Settings */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-semibold text-slate-800">Monthly Redeem Limit</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-3">
                <p className="text-slate-500 text-sm">Formula</p>
                <p className="text-slate-800 text-sm font-mono">
                  Plan Price × {redeemSettings.multiplier_1} × {redeemSettings.multiplier_2} × (1 + Referrals × {redeemSettings.referral_bonus_percent}%)
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-slate-600">Enabled</label>
                <button
                  onClick={() => setRedeemSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    redeemSettings.enabled ? 'bg-green-600' : 'bg-slate-100'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    redeemSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-500 text-xs mb-1 block">Multiplier 1</label>
                  <Input
                    type="number"
                    value={redeemSettings.multiplier_1}
                    onChange={(e) => setRedeemSettings(prev => ({ ...prev, multiplier_1: parseInt(e.target.value) }))}
                    className="bg-white border-slate-200 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-slate-500 text-xs mb-1 block">Multiplier 2</label>
                  <Input
                    type="number"
                    value={redeemSettings.multiplier_2}
                    onChange={(e) => setRedeemSettings(prev => ({ ...prev, multiplier_2: parseInt(e.target.value) }))}
                    className="bg-white border-slate-200 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-slate-500 text-xs mb-1 block">Referral %</label>
                  <Input
                    type="number"
                    value={redeemSettings.referral_bonus_percent}
                    onChange={(e) => setRedeemSettings(prev => ({ ...prev, referral_bonus_percent: parseInt(e.target.value) }))}
                    className="bg-white border-slate-200 text-slate-800"
                  />
                </div>
              </div>
              
              <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-3">
                <p className="text-blue-400 text-xs font-medium mb-1">Example: Elite Plan (₹799)</p>
                <p className="text-slate-800 text-sm">
                  ₹799 × {redeemSettings.multiplier_1} × {redeemSettings.multiplier_2} = <span className="text-green-400 font-bold">{(799 * redeemSettings.multiplier_1 * redeemSettings.multiplier_2).toLocaleString()} PRC</span>/month
                </p>
              </div>
              
              <Button onClick={saveRedeemLimit} disabled={saving.redeem} className="w-full bg-green-600 hover:bg-green-700">
                {saving.redeem ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Redeem Limits
              </Button>
            </div>
          </div>

          {/* Mining Rate Settings */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-slate-800">Mining Rates by Plan</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {Object.entries(miningSettings).map(([plan, settings]) => (
                <div key={plan} className={`rounded-lg p-4 border ${
                  plan === 'elite' ? 'bg-amber-900/20 border-amber-700' :
                  plan === 'growth' ? 'bg-green-900/20 border-green-700' :
                  plan === 'startup' ? 'bg-blue-900/20 border-blue-700' :
                  'bg-white border-slate-200'
                }`}>
                  <p className={`text-sm font-semibold mb-3 ${
                    plan === 'elite' ? 'text-amber-400' :
                    plan === 'growth' ? 'text-green-400' :
                    plan === 'startup' ? 'text-blue-400' :
                    'text-slate-500'
                  }`}>
                    {plan.toUpperCase()}
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-slate-500 text-xs">Base Rate (PRC/hr)</label>
                      <Input
                        type="number"
                        value={settings.base_rate}
                        onChange={(e) => setMiningSettings(prev => ({
                          ...prev,
                          [plan]: { ...prev[plan], base_rate: parseInt(e.target.value) }
                        }))}
                        className="bg-white border-slate-200 text-slate-800 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-xs">Tap Bonus (PRC)</label>
                      <Input
                        type="number"
                        value={settings.tap_bonus}
                        onChange={(e) => setMiningSettings(prev => ({
                          ...prev,
                          [plan]: { ...prev[plan], tap_bonus: parseInt(e.target.value) }
                        }))}
                        className="bg-white border-slate-200 text-slate-800 h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <Button onClick={saveMiningRates} disabled={saving.mining} className="w-full bg-purple-600 hover:bg-purple-700">
              {saving.mining ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Mining Rates
            </Button>
          </div>

        </div>

        {/* Info Box */}
        <div className="mt-6 bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium">Important Notes</p>
              <ul className="text-yellow-200/80 text-sm mt-1 space-y-1">
                <li>• PRC Rate changes affect all new transactions immediately</li>
                <li>• Redeem Limit changes apply from next month</li>
                <li>• Mining Rate changes affect active sessions instantly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSystemSettings;
