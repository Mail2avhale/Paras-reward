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
  TrendingUp, AlertTriangle, RefreshCw, Percent
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminRedeemSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    multiplier_1: 5,
    multiplier_2: 10,
    referral_bonus_percent: 20,  // 20% per referral
    enabled: true
  });
  
  // Example calculations for preview
  const [examples, setExamples] = useState({
    startup: [],
    growth: [],
    elite: []
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
    const { multiplier_1, multiplier_2, referral_bonus_percent } = settings;
    
    const planPrices = {
      startup: 299,
      growth: 549,
      elite: 799
    };
    
    const referralCounts = [0, 1, 2, 3, 5, 10];
    const newExamples = {};
    
    Object.entries(planPrices).forEach(([plan, price]) => {
      const base = price * multiplier_1 * multiplier_2;
      newExamples[plan] = referralCounts.map(refs => {
        const multiplier = 1 + (refs * referral_bonus_percent / 100);
        const limit = base * multiplier;
        return { refs, multiplier, limit };
      });
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
      <div className="max-w-5xl mx-auto">
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
              <h1 className="text-2xl font-bold">Monthly Redemption Limits</h1>
              <p className="text-gray-400 text-sm">Control how much PRC users can redeem per month</p>
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
                Users will see <strong>"Service temporarily unavailable"</strong> when they exceed their limit.
                They will NOT know about the limit system.
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
                    ? 'Redemption limits are ACTIVE' 
                    : 'Limits DISABLED - unlimited redemption allowed'}
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
            Limit Formula
          </h2>
          
          <div className="bg-gray-800/50 p-4 rounded-lg mb-6">
            <p className="text-sm text-gray-300 font-mono text-center">
              Monthly Limit = <span className="text-amber-400">(Plan Price × M1 × M2)</span> × <span className="text-green-400">(1 + Referrals × {settings.referral_bonus_percent}%)</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Multiplier 1 (M1)
              </label>
              <Input
                type="number"
                value={settings.multiplier_1}
                onChange={(e) => handleChange('multiplier_1', parseFloat(e.target.value) || 0)}
                className="bg-gray-800 border-gray-700 text-white text-lg"
                min="0"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">Base multiplier</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Multiplier 2 (M2)
              </label>
              <Input
                type="number"
                value={settings.multiplier_2}
                onChange={(e) => handleChange('multiplier_2', parseFloat(e.target.value) || 0)}
                className="bg-gray-800 border-gray-700 text-white text-lg"
                min="0"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">Secondary multiplier</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1">
                <Percent className="h-4 w-4 text-green-400" />
                Referral Bonus (per referral)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={settings.referral_bonus_percent}
                  onChange={(e) => handleChange('referral_bonus_percent', parseFloat(e.target.value) || 0)}
                  className="bg-gray-800 border-gray-700 text-white text-lg pr-8"
                  min="0"
                  max="100"
                  step="5"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 font-bold">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Extra limit per referral</p>
            </div>
          </div>
        </Card>

        {/* Referral Bonus Explanation */}
        <Card className="p-6 mb-6 bg-green-500/10 border-green-500/30">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-green-500" />
            Referral Bonus System
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[0, 1, 2, 3, 5, 10].map(refs => {
              const multiplier = 1 + (refs * settings.referral_bonus_percent / 100);
              const bonusPercent = refs * settings.referral_bonus_percent;
              return (
                <div key={refs} className="text-center p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-white">{refs}</p>
                  <p className="text-xs text-gray-400">referrals</p>
                  <p className="text-lg font-semibold text-green-400 mt-2">{multiplier.toFixed(1)}×</p>
                  <p className="text-xs text-gray-500">+{bonusPercent}% limit</p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Example Calculations Table */}
        <Card className="p-6 bg-gray-900 border-gray-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Example Monthly Limits (PRC)
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Plan</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Price</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">0 Refs (Base)</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">1 Ref (+{settings.referral_bonus_percent}%)</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">3 Refs (+{settings.referral_bonus_percent * 3}%)</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">5 Refs (+{settings.referral_bonus_percent * 5}%)</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">10 Refs (+{settings.referral_bonus_percent * 10}%)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="py-3 px-4 text-white">Explorer (Free)</td>
                  <td className="py-3 px-4 text-gray-400">₹0</td>
                  <td colSpan={5} className="py-3 px-4 text-center text-red-400 font-semibold">
                    Cannot Redeem (0 PRC limit)
                  </td>
                </tr>
                {['startup', 'growth', 'elite'].map((plan) => (
                  <tr key={plan} className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white capitalize">{plan}</td>
                    <td className="py-3 px-4 text-gray-400">
                      ₹{plan === 'startup' ? 299 : plan === 'growth' ? 549 : 799}
                    </td>
                    {examples[plan]?.filter(e => [0, 1, 3, 5, 10].includes(e.refs)).map((ex, idx) => (
                      <td key={idx} className={`py-3 px-4 text-right font-mono ${
                        ex.refs === 0 ? 'text-purple-400' : 
                        ex.refs >= 5 ? 'text-green-400 font-bold' : 'text-blue-400'
                      }`}>
                        {Math.round(ex.limit).toLocaleString()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
            <p className="text-xs text-gray-400">
              <strong>Services Covered:</strong> Bill Payments, Gift Vouchers, Marketplace, Loan EMI, Credit Card Bills - ALL count towards the monthly limit.
              <br/>
              <strong>Billing Cycle:</strong> Resets every 30 days from user's subscription start date.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminRedeemSettings;
