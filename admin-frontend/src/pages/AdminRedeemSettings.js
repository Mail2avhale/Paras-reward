import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, Save, Shield, Clock, Users, Coins, 
  AlertTriangle, CheckCircle, Settings, Calendar
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminRedeemSettings = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Monthly Limit Settings
  const [monthlySettings, setMonthlySettings] = useState({
    multiplier_1: 5,
    multiplier_2: 10,
    referral_bonus_percent: 20,
    enabled: true
  });
  
  // Strict Rules
  const [strictRules, setStrictRules] = useState({
    kyc_required: true,
    min_account_age_days: 3,
    min_redemption_prc: 100,
    max_daily_redemptions: 3,
    cooldown_minutes: 5,
    subscription_required: true,
    allowed_plans: ['startup', 'growth', 'elite']
  });

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      navigate('/dashboard');
      return;
    }
    fetchSettings();
  }, [user, navigate]);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/settings/redemption-rules`);
      const data = response.data;
      
      if (data.monthly_limit_settings) {
        setMonthlySettings(data.monthly_limit_settings);
      }
      if (data.strict_rules) {
        setStrictRules(data.strict_rules);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Save monthly limit settings
      await axios.put(`${API}/api/admin/settings/redeem-limits`, monthlySettings);
      
      // Save strict rules
      await axios.put(`${API}/api/admin/settings/redemption-rules`, strictRules);
      
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Calculate example limits
  const calculateLimit = (planPrice) => {
    const base = planPrice * monthlySettings.multiplier_1 * monthlySettings.multiplier_2;
    return base;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate('/admin/settings-hub')}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-400" />
            Redeem Safety Settings
          </h1>
          <p className="text-gray-400 text-sm">Configure withdrawal limits and security rules</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Limit Formula */}
        <Card className="bg-gray-900 border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            Monthly Limit Formula
          </h2>
          
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <p className="text-gray-300 text-sm mb-2">Formula:</p>
            <p className="text-amber-400 font-mono">
              Base = Price × {monthlySettings.multiplier_1} × {monthlySettings.multiplier_2}
            </p>
            <p className="text-emerald-400 font-mono mt-1">
              Final = Base × (1 + Referrals × {monthlySettings.referral_bonus_percent}%)
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Multiplier 1</label>
              <input
                type="number"
                value={monthlySettings.multiplier_1}
                onChange={(e) => setMonthlySettings({...monthlySettings, multiplier_1: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-amber-500 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Multiplier 2</label>
              <input
                type="number"
                value={monthlySettings.multiplier_2}
                onChange={(e) => setMonthlySettings({...monthlySettings, multiplier_2: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-amber-500 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Referral Bonus (%)</label>
              <input
                type="number"
                value={monthlySettings.referral_bonus_percent}
                onChange={(e) => setMonthlySettings({...monthlySettings, referral_bonus_percent: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-amber-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <span className="text-gray-300">System Enabled</span>
              <button
                onClick={() => setMonthlySettings({...monthlySettings, enabled: !monthlySettings.enabled})}
                className={`w-12 h-6 rounded-full transition-colors ${monthlySettings.enabled ? 'bg-emerald-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${monthlySettings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-4 p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-lg">
            <h3 className="text-sm font-semibold text-emerald-400 mb-2">Preview Limits</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-800/50 p-2 rounded">
                <p className="text-xs text-gray-400">Startup (₹299)</p>
                <p className="text-emerald-400 font-bold">{calculateLimit(299).toLocaleString()} PRC</p>
              </div>
              <div className="bg-gray-800/50 p-2 rounded">
                <p className="text-xs text-gray-400">Growth (₹549)</p>
                <p className="text-emerald-400 font-bold">{calculateLimit(549).toLocaleString()} PRC</p>
              </div>
              <div className="bg-gray-800/50 p-2 rounded">
                <p className="text-xs text-gray-400">Elite (₹799)</p>
                <p className="text-emerald-400 font-bold">{calculateLimit(799).toLocaleString()} PRC</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Strict Security Rules */}
        <Card className="bg-gray-900 border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Security Rules
          </h2>

          <div className="space-y-4">
            {/* KYC Required */}
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300">KYC Required</span>
              </div>
              <button
                onClick={() => setStrictRules({...strictRules, kyc_required: !strictRules.kyc_required})}
                className={`w-12 h-6 rounded-full transition-colors ${strictRules.kyc_required ? 'bg-emerald-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${strictRules.kyc_required ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Subscription Required */}
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="text-gray-300">Paid Subscription Required</span>
              </div>
              <button
                onClick={() => setStrictRules({...strictRules, subscription_required: !strictRules.subscription_required})}
                className={`w-12 h-6 rounded-full transition-colors ${strictRules.subscription_required ? 'bg-emerald-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${strictRules.subscription_required ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Min Account Age */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                <Calendar className="w-4 h-4" />
                Minimum Account Age (Days)
              </label>
              <input
                type="number"
                value={strictRules.min_account_age_days}
                onChange={(e) => setStrictRules({...strictRules, min_account_age_days: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-amber-500 outline-none"
              />
            </div>

            {/* Min Redemption */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                <Coins className="w-4 h-4" />
                Minimum Redemption (PRC)
              </label>
              <input
                type="number"
                value={strictRules.min_redemption_prc}
                onChange={(e) => setStrictRules({...strictRules, min_redemption_prc: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-amber-500 outline-none"
              />
            </div>

            {/* Max Daily Redemptions */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                <Settings className="w-4 h-4" />
                Max Daily Redemptions
              </label>
              <input
                type="number"
                value={strictRules.max_daily_redemptions}
                onChange={(e) => setStrictRules({...strictRules, max_daily_redemptions: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-amber-500 outline-none"
              />
            </div>

            {/* Cooldown */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                <Clock className="w-4 h-4" />
                Cooldown Between Redemptions (Minutes)
              </label>
              <input
                type="number"
                value={strictRules.cooldown_minutes}
                onChange={(e) => setStrictRules({...strictRules, cooldown_minutes: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-amber-500 outline-none"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Save Button */}
      <div className="mt-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-8 py-3 font-semibold"
        >
          {saving ? (
            'Saving...'
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              Save All Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AdminRedeemSettings;
