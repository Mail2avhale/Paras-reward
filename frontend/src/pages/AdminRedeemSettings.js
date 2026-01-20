import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, Save, Shield, Calculator, Users, 
  TrendingUp, AlertTriangle, RefreshCw 
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminRedeemSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    multiplier_1: 5,
    multiplier_2: 10,
    referral_bonus: 20,
    double_limit_referrals: 5,
    enabled: true
  });
  
  // Example calculations for preview
  const [examples, setExamples] = useState({
    startup: { base: 0, withReferrals: 0, doubled: 0 },
    growth: { base: 0, withReferrals: 0, doubled: 0 },
    elite: { base: 0, withReferrals: 0, doubled: 0 }
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    calculateExamples();
  }, [settings]);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/settings/redeem-limits`);
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching redeem settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const calculateExamples = () => {
    const { multiplier_1, multiplier_2, referral_bonus, double_limit_referrals } = settings;
    
    const planPrices = {
      startup: 299,
      growth: 549,
      elite: 799
    };
    
    const newExamples = {};
    
    Object.entries(planPrices).forEach(([plan, price]) => {
      const base = price * multiplier_1 * multiplier_2;
      const withReferrals = base + (3 * referral_bonus); // 3 referrals example
      const doubled = (base + (double_limit_referrals * referral_bonus)) * 2; // With 5+ referrals
      
      newExamples[plan] = { base, withReferrals, doubled };
    });
    
    setExamples(newExamples);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/admin/settings/redeem-limits`, settings);
      toast.success('Redemption settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/settings-hub')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Redemption Limit Settings</h1>
              <p className="text-gray-400 text-sm">Configure monthly PRC redemption limits</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        </div>

        {/* Warning Banner */}
        <Card className="p-4 mb-6 bg-amber-500/10 border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-400">Important Notice</p>
              <p className="text-sm text-gray-300">
                These settings control how much PRC users can redeem per month. 
                Changes will affect all users immediately. Users will see "Service temporarily unavailable" 
                when they exceed their limit.
              </p>
            </div>
          </div>
        </Card>

        {/* Enable/Disable Toggle */}
        <Card className="p-6 mb-6 bg-gray-900 border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className={`h-6 w-6 ${settings.enabled ? 'text-green-500' : 'text-gray-500'}`} />
              <div>
                <p className="font-semibold text-white">System Status</p>
                <p className="text-sm text-gray-400">
                  {settings.enabled 
                    ? 'Redemption limits are active' 
                    : 'Limits disabled - unlimited redemption allowed'}
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => handleChange('enabled', checked)}
            />
          </div>
        </Card>

        {/* Formula Settings */}
        <Card className="p-6 mb-6 bg-gray-900 border-gray-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-purple-500" />
            Limit Formula Settings
          </h2>
          
          <div className="bg-gray-800/50 p-4 rounded-lg mb-6">
            <p className="text-sm text-gray-300 font-mono">
              Monthly Limit = (Plan Price × <span className="text-purple-400">M1</span> × <span className="text-blue-400">M2</span>) + (Referrals × <span className="text-green-400">Bonus</span>)
            </p>
            <p className="text-xs text-gray-500 mt-2">
              If referrals ≥ {settings.double_limit_referrals}, total limit is doubled
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Multiplier 1 (M1) <span className="text-purple-400">×{settings.multiplier_1}</span>
              </label>
              <Input
                type="number"
                value={settings.multiplier_1}
                onChange={(e) => handleChange('multiplier_1', parseFloat(e.target.value) || 0)}
                className="bg-gray-800 border-gray-700 text-white"
                min="0"
                step="0.5"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Multiplier 2 (M2) <span className="text-blue-400">×{settings.multiplier_2}</span>
              </label>
              <Input
                type="number"
                value={settings.multiplier_2}
                onChange={(e) => handleChange('multiplier_2', parseFloat(e.target.value) || 0)}
                className="bg-gray-800 border-gray-700 text-white"
                min="0"
                step="1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Referral Bonus (per referral) <span className="text-green-400">+{settings.referral_bonus} PRC</span>
              </label>
              <Input
                type="number"
                value={settings.referral_bonus}
                onChange={(e) => handleChange('referral_bonus', parseFloat(e.target.value) || 0)}
                className="bg-gray-800 border-gray-700 text-white"
                min="0"
                step="5"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Double Limit at Referrals <span className="text-amber-400">≥{settings.double_limit_referrals}</span>
              </label>
              <Input
                type="number"
                value={settings.double_limit_referrals}
                onChange={(e) => handleChange('double_limit_referrals', parseInt(e.target.value) || 1)}
                className="bg-gray-800 border-gray-700 text-white"
                min="1"
                step="1"
              />
            </div>
          </div>
        </Card>

        {/* Preview Calculations */}
        <Card className="p-6 bg-gray-900 border-gray-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Example Calculations
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Plan</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Price</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Base Limit</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">With 3 Refs</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">With {settings.double_limit_referrals}+ Refs (2×)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="py-3 px-4 text-white">Explorer (Free)</td>
                  <td className="py-3 px-4 text-gray-400">₹0</td>
                  <td className="py-3 px-4 text-right text-red-400">0 PRC</td>
                  <td className="py-3 px-4 text-right text-red-400">0 PRC</td>
                  <td className="py-3 px-4 text-right text-red-400">0 PRC</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-3 px-4 text-white">Startup</td>
                  <td className="py-3 px-4 text-gray-400">₹299</td>
                  <td className="py-3 px-4 text-right text-purple-400">{examples.startup.base.toLocaleString()} PRC</td>
                  <td className="py-3 px-4 text-right text-blue-400">{examples.startup.withReferrals.toLocaleString()} PRC</td>
                  <td className="py-3 px-4 text-right text-green-400">{examples.startup.doubled.toLocaleString()} PRC</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-3 px-4 text-white">Growth</td>
                  <td className="py-3 px-4 text-gray-400">₹549</td>
                  <td className="py-3 px-4 text-right text-purple-400">{examples.growth.base.toLocaleString()} PRC</td>
                  <td className="py-3 px-4 text-right text-blue-400">{examples.growth.withReferrals.toLocaleString()} PRC</td>
                  <td className="py-3 px-4 text-right text-green-400">{examples.growth.doubled.toLocaleString()} PRC</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-white">Elite</td>
                  <td className="py-3 px-4 text-gray-400">₹799</td>
                  <td className="py-3 px-4 text-right text-purple-400">{examples.elite.base.toLocaleString()} PRC</td>
                  <td className="py-3 px-4 text-right text-blue-400">{examples.elite.withReferrals.toLocaleString()} PRC</td>
                  <td className="py-3 px-4 text-right text-green-400">{examples.elite.doubled.toLocaleString()} PRC</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
            <p className="text-xs text-gray-400">
              <strong>Note:</strong> These limits apply to all redemption services combined (Bill Payments, Gift Vouchers, Marketplace, Loan EMI, Credit Cards). 
              The billing cycle resets every 30 days from the user's subscription start date.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminRedeemSettings;
