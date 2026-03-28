import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Save, RefreshCw, Percent, Coins, Receipt, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminEconomySettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    redeem_percent: 70,
    burn_rate: 5,
    processing_fee_inr: 10,
    admin_charge_percent: 20,
    base_mining: 550,
    prc_rate: 2
  });
  const [prcRateInput, setPrcRateInput] = useState('');
  const [prcRateExpiry, setPrcRateExpiry] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/growth/economy-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSettings(response.data.data);
        setPrcRateInput(response.data.data.prc_rate?.toString() || '2');
      }
    } catch (error) {
      console.error('Fetch settings error:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      params.append('redeem_percent', settings.redeem_percent);
      params.append('burn_rate', settings.burn_rate);
      params.append('processing_fee_inr', settings.processing_fee_inr);
      params.append('admin_charge_percent', settings.admin_charge_percent);
      params.append('base_mining', settings.base_mining);

      const response = await axios.post(`${API}/growth/admin/economy-settings?${params.toString()}`, null, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success('Economy settings saved!');
        setSettings(response.data.data);
      }
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrcRate = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      params.append('rate', prcRateInput);
      if (prcRateExpiry) {
        params.append('expires_hours', prcRateExpiry);
      }

      const response = await axios.post(`${API}/growth/admin/set-prc-rate?${params.toString()}`, null, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success(`PRC Rate set to ${prcRateInput}`);
        fetchSettings();
      }
    } catch (error) {
      console.error('Set PRC rate error:', error);
      toast.error(error.response?.data?.detail || 'Failed to set PRC rate');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePrcOverride = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.delete(`${API}/growth/admin/prc-rate-override`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success('PRC rate override removed');
        fetchSettings();
      }
    } catch (error) {
      console.error('Remove override error:', error);
      toast.error('Failed to remove override');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-600" />
              <h1 className="text-lg font-semibold text-gray-800">Economy Settings</h1>
            </div>
          </div>
          <Button
            onClick={fetchSettings}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* PRC Rate Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-800">PRC Rate</h2>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-amber-800 font-medium">
              Current Rate: <span className="text-2xl">{settings.prc_rate}</span> PRC = ₹1
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New PRC Rate</label>
              <input
                type="number"
                value={prcRateInput}
                onChange={(e) => setPrcRateInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., 2"
                step="0.1"
                min="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expires In (hours)</label>
              <input
                type="number"
                value={prcRateExpiry}
                onChange={(e) => setPrcRateExpiry(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Leave empty for permanent"
                min="1"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleSetPrcRate} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
                Set Rate
              </Button>
              <Button onClick={handleRemovePrcOverride} disabled={saving} variant="outline">
                Auto
              </Button>
            </div>
          </div>
        </div>

        {/* Redeem Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Percent className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-800">Redeem Settings</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Redeem Percent */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Redeem Percent (Default: 70%)
              </label>
              <div className="flex gap-2 flex-wrap">
                {[50, 60, 70, 80, 100].map((percent) => (
                  <button
                    key={percent}
                    onClick={() => setSettings({ ...settings, redeem_percent: percent })}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      settings.redeem_percent === percent
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            </div>

            {/* Burn Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Burn Rate (%)
              </label>
              <input
                type="number"
                value={settings.burn_rate}
                onChange={(e) => setSettings({ ...settings, burn_rate: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="5"
                min="0"
                max="20"
                step="0.5"
              />
              <p className="text-xs text-gray-500 mt-1">Applied on every redeem</p>
            </div>
          </div>
        </div>

        {/* Charges Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Charges Settings</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Processing Fee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Processing Fee (₹)
              </label>
              <input
                type="number"
                value={settings.processing_fee_inr}
                onChange={(e) => setSettings({ ...settings, processing_fee_inr: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="10"
                min="0"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">Converted to PRC at dynamic rate</p>
            </div>

            {/* Admin Charge */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Charge (% of PRC)
              </label>
              <input
                type="number"
                value={settings.admin_charge_percent}
                onChange={(e) => setSettings({ ...settings, admin_charge_percent: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="20"
                min="0"
                max="50"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">% of redeem PRC value</p>
            </div>
          </div>
        </div>

        {/* Mining Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Mining Settings</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Base Mining (PRC/day)
            </label>
            <input
              type="number"
              value={settings.base_mining}
              onChange={(e) => setSettings({ ...settings, base_mining: parseInt(e.target.value) })}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="550"
              min="0"
              step="10"
            />
            <p className="text-xs text-gray-500 mt-1">Daily base mining reward for all users</p>
          </div>
        </div>

        {/* Formula Preview */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <h3 className="font-semibold text-purple-800 mb-3">Redeem Formula Preview</h3>
          <div className="bg-white rounded-lg p-4 font-mono text-sm">
            <p className="text-gray-700">Example: Redeem 1000 PRC (Rate: {settings.prc_rate} PRC = ₹1)</p>
            <div className="mt-2 space-y-1 text-gray-600">
              <p>Redeem Value: 1000 PRC</p>
              <p>Burn ({settings.burn_rate}%): {(1000 * settings.burn_rate / 100).toFixed(0)} PRC</p>
              <p>Processing (₹{settings.processing_fee_inr}): {(settings.processing_fee_inr * settings.prc_rate).toFixed(0)} PRC</p>
              <p>Admin ({settings.admin_charge_percent}%): {(1000 * settings.admin_charge_percent / 100).toFixed(0)} PRC</p>
              <hr className="my-2" />
              <p className="font-bold text-purple-700">
                Total Deducted: {(1000 + (1000 * settings.burn_rate / 100) + (settings.processing_fee_inr * settings.prc_rate) + (1000 * settings.admin_charge_percent / 100)).toFixed(0)} PRC
              </p>
              <p className="font-bold text-emerald-600">
                User Gets: ₹{(1000 / settings.prc_rate).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          className="w-full py-6 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-lg font-semibold rounded-xl shadow-lg"
        >
          {saving ? (
            <>
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              Save All Settings
            </>
          )}
        </Button>

      </div>
    </div>
  );
};

export default AdminEconomySettings;
