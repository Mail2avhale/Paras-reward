import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Shield, Save, RefreshCw, AlertTriangle, DollarSign, Clock,
  Users, CheckCircle, XCircle, Info, Settings, Lock
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminRedeemSettings = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    daily_limit_per_user: 5000,
    daily_limit_global: 100000,
    manual_approval_threshold: 1000,
    cool_off_period_hours: 24,
    min_kyc_status: 'verified',
    min_vip_days: 7,
    max_redemptions_per_day: 3,
    suspicious_amount_threshold: 2000,
    enabled: true
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchSettings();
  }, [user, navigate]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/admin/finance/redeem-settings`);
      if (response.data.settings) {
        setSettings(response.data.settings);
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/api/admin/finance/redeem-settings`, settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    // Handle empty values for number fields to prevent NaN
    if (typeof value === 'number' && isNaN(value)) {
      value = 0;
    }
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-800/50 min-h-screen" data-testid="admin-redeem-settings">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-purple-600" />
            Redemption Safety Settings
          </h1>
          <p className="text-gray-500 mt-1">Configure limits and safety rules for gift vouchers and bill payments</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchSettings}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
            data-testid="save-settings-btn"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.enabled ? (
              <CheckCircle className="h-8 w-8 text-green-500" />
            ) : (
              <XCircle className="h-8 w-8 text-red-500" />
            )}
            <div>
              <h3 className="text-lg font-semibold">Safety Rules {settings.enabled ? 'Enabled' : 'Disabled'}</h3>
              <p className="text-sm text-gray-500">
                {settings.enabled 
                  ? 'All redemption requests are subject to safety checks'
                  : 'Safety checks are bypassed (not recommended)'}
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => handleChange('enabled', e.target.checked)}
              className="sr-only peer"
              data-testid="toggle-enabled"
            />
            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-gray-900 after:border-gray-600 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Limits */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-purple-600" />
            Daily Limits
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Per User Daily Limit (INR)
              </label>
              <Input
                type="number"
                value={settings.daily_limit_per_user}
                onChange={(e) => handleChange('daily_limit_per_user', parseFloat(e.target.value))}
                placeholder="5000"
                data-testid="input-daily-limit-user"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum amount a single user can redeem per day</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Global Daily Limit (INR)
              </label>
              <Input
                type="number"
                value={settings.daily_limit_global}
                onChange={(e) => handleChange('daily_limit_global', parseFloat(e.target.value))}
                placeholder="100000"
                data-testid="input-daily-limit-global"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum total redemptions across all users per day</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Max Transactions Per User Per Day
              </label>
              <Input
                type="number"
                value={settings.max_redemptions_per_day}
                onChange={(e) => handleChange('max_redemptions_per_day', parseInt(e.target.value))}
                placeholder="3"
                data-testid="input-max-txns"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum number of redemption requests per user per day</p>
            </div>
          </div>
        </Card>

        {/* Approval Thresholds */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Approval Thresholds
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Manual Approval Threshold (INR)
              </label>
              <Input
                type="number"
                value={settings.manual_approval_threshold}
                onChange={(e) => handleChange('manual_approval_threshold', parseFloat(e.target.value))}
                placeholder="1000"
                data-testid="input-manual-threshold"
              />
              <p className="text-xs text-gray-500 mt-1">Requests above this amount require manual admin approval</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Suspicious Amount Threshold (INR)
              </label>
              <Input
                type="number"
                value={settings.suspicious_amount_threshold}
                onChange={(e) => handleChange('suspicious_amount_threshold', parseFloat(e.target.value))}
                placeholder="2000"
                data-testid="input-suspicious-threshold"
              />
              <p className="text-xs text-gray-500 mt-1">Requests above this amount are flagged for review</p>
            </div>
            
            <div className="p-3 bg-amber-500/10 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-400">
                  <strong>Auto-Approval Rule:</strong> Requests below ₹{settings.manual_approval_threshold} are automatically approved if all other checks pass.
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* User Requirements */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            User Requirements
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Minimum KYC Status
              </label>
              <select
                className="w-full p-2 border rounded-lg"
                value={settings.min_kyc_status}
                onChange={(e) => handleChange('min_kyc_status', e.target.value)}
                data-testid="select-min-kyc"
              >
                <option value="pending">Pending (Not Recommended)</option>
                <option value="submitted">Submitted</option>
                <option value="verified">Verified (Recommended)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Users must have at least this KYC status to redeem</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Minimum VIP Days
              </label>
              <Input
                type="number"
                value={settings.min_vip_days}
                onChange={(e) => handleChange('min_vip_days', parseInt(e.target.value))}
                placeholder="7"
                data-testid="input-min-vip-days"
              />
              <p className="text-xs text-gray-500 mt-1">User must be VIP for at least this many days to redeem</p>
            </div>
          </div>
        </Card>

        {/* Timing Controls */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            Timing Controls
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Cool-off Period (Hours)
              </label>
              <Input
                type="number"
                value={settings.cool_off_period_hours}
                onChange={(e) => handleChange('cool_off_period_hours', parseInt(e.target.value))}
                placeholder="24"
                data-testid="input-cooloff"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum hours between redemption requests from same user</p>
            </div>
            
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <Lock className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-400">
                  <strong>Security Note:</strong> These settings help prevent fraud and maintain platform stability. Changes take effect immediately.
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Current Rules Summary */}
      <Card className="mt-6 p-6 bg-gray-900 text-white">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Current Rules Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-gray-400">Max per user/day</p>
            <p className="text-xl font-bold">₹{settings.daily_limit_per_user?.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-gray-400">Auto-approve below</p>
            <p className="text-xl font-bold">₹{settings.manual_approval_threshold?.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-gray-400">Max transactions/day</p>
            <p className="text-xl font-bold">{settings.max_redemptions_per_day}</p>
          </div>
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-gray-400">Min VIP tenure</p>
            <p className="text-xl font-bold">{settings.min_vip_days} days</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminRedeemSettings;
