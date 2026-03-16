import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Settings, Save, RefreshCw, Coins, Calculator, 
  TrendingUp, Users, Percent, Clock, Shield,
  DollarSign, Zap, Target, AlertTriangle, ArrowLeft
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AdminSystemSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  
  // PRC Rate Settings
  const [prcRateSettings, setPrcRateSettings] = useState({
    manual_override: false,
    manual_rate: 50,
    current_rate: 50
  });
  
  // Redeem Limit Settings
  const [redeemSettings, setRedeemSettings] = useState({
    multiplier_1: 5,
    multiplier_2: 10,
    referral_bonus_percent: 20,
    enabled: true
  });
  
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
      // Fetch all settings
      const [prcRes, redeemRes, miningRes] = await Promise.all([
        axios.get(`${API}/admin/settings/prc-rate`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/settings/redeem-limit`).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/settings/mining-rates`).catch(() => ({ data: {} }))
      ]);
      
      if (prcRes.data) setPrcRateSettings(prev => ({ ...prev, ...prcRes.data }));
      if (redeemRes.data) setRedeemSettings(prev => ({ ...prev, ...redeemRes.data }));
      if (miningRes.data?.rates) setMiningSettings(miningRes.data.rates);
      
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const savePrcRate = async () => {
    setSaving(prev => ({ ...prev, prc: true }));
    try {
      await axios.post(`${API}/admin/settings/prc-rate`, prcRateSettings);
      toast.success('PRC Rate settings saved!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(prev => ({ ...prev, prc: false }));
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Settings className="w-8 h-8 text-purple-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">System Settings</h1>
              <p className="text-gray-400 text-sm">Configure PRC rates, limits & mining</p>
            </div>
          </div>
          <Button onClick={fetchSettings} variant="outline" className="border-gray-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* PRC Rate Settings */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">PRC Rate Control</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Current Dynamic Rate</p>
                <p className="text-2xl font-bold text-amber-400">{prcRateSettings.current_rate || 50} PRC/₹</p>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-gray-300">Manual Override</label>
                <button
                  onClick={() => setPrcRateSettings(prev => ({ ...prev, manual_override: !prev.manual_override }))}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    prcRateSettings.manual_override ? 'bg-purple-600' : 'bg-gray-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    prcRateSettings.manual_override ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              
              {prcRateSettings.manual_override && (
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Manual Rate (PRC per ₹1)</label>
                  <Input
                    type="number"
                    value={prcRateSettings.manual_rate}
                    onChange={(e) => setPrcRateSettings(prev => ({ ...prev, manual_rate: parseFloat(e.target.value) }))}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              )}
              
              <Button onClick={savePrcRate} disabled={saving.prc} className="w-full bg-amber-600 hover:bg-amber-700">
                {saving.prc ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save PRC Rate
              </Button>
            </div>
          </div>

          {/* Redeem Limit Settings */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-semibold text-white">Monthly Redeem Limit</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Formula</p>
                <p className="text-white text-sm font-mono">
                  Plan Price × {redeemSettings.multiplier_1} × {redeemSettings.multiplier_2} × (1 + Referrals × {redeemSettings.referral_bonus_percent}%)
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-gray-300">Enabled</label>
                <button
                  onClick={() => setRedeemSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    redeemSettings.enabled ? 'bg-green-600' : 'bg-gray-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    redeemSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Multiplier 1</label>
                  <Input
                    type="number"
                    value={redeemSettings.multiplier_1}
                    onChange={(e) => setRedeemSettings(prev => ({ ...prev, multiplier_1: parseInt(e.target.value) }))}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Multiplier 2</label>
                  <Input
                    type="number"
                    value={redeemSettings.multiplier_2}
                    onChange={(e) => setRedeemSettings(prev => ({ ...prev, multiplier_2: parseInt(e.target.value) }))}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Referral %</label>
                  <Input
                    type="number"
                    value={redeemSettings.referral_bonus_percent}
                    onChange={(e) => setRedeemSettings(prev => ({ ...prev, referral_bonus_percent: parseInt(e.target.value) }))}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>
              
              <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-3">
                <p className="text-blue-400 text-xs font-medium mb-1">Example: Elite Plan (₹799)</p>
                <p className="text-white text-sm">
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
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Mining Rates by Plan</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {Object.entries(miningSettings).map(([plan, settings]) => (
                <div key={plan} className={`rounded-lg p-4 border ${
                  plan === 'elite' ? 'bg-amber-900/20 border-amber-700' :
                  plan === 'growth' ? 'bg-green-900/20 border-green-700' :
                  plan === 'startup' ? 'bg-blue-900/20 border-blue-700' :
                  'bg-gray-800 border-gray-700'
                }`}>
                  <p className={`text-sm font-semibold mb-3 ${
                    plan === 'elite' ? 'text-amber-400' :
                    plan === 'growth' ? 'text-green-400' :
                    plan === 'startup' ? 'text-blue-400' :
                    'text-gray-400'
                  }`}>
                    {plan.toUpperCase()}
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-gray-500 text-xs">Base Rate (PRC/hr)</label>
                      <Input
                        type="number"
                        value={settings.base_rate}
                        onChange={(e) => setMiningSettings(prev => ({
                          ...prev,
                          [plan]: { ...prev[plan], base_rate: parseInt(e.target.value) }
                        }))}
                        className="bg-gray-900 border-gray-700 text-white h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs">Tap Bonus (PRC)</label>
                      <Input
                        type="number"
                        value={settings.tap_bonus}
                        onChange={(e) => setMiningSettings(prev => ({
                          ...prev,
                          [plan]: { ...prev[plan], tap_bonus: parseInt(e.target.value) }
                        }))}
                        className="bg-gray-900 border-gray-700 text-white h-8 text-sm"
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
