import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  CloudRain, Save, RefreshCw, AlertTriangle, Power, PowerOff,
  Droplets, Clock, Target, TrendingUp, TrendingDown, Users,
  Settings, Zap, Shield, BarChart3
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminPRCRain = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({
    enabled: false,
    max_rain_events_per_day: 2,
    min_gap_between_rains_hours: 3,
    rain_duration_seconds: 30,
    max_taps_per_rain: 15,
    max_prc_gain_per_day: 50,
    max_prc_loss_per_day: 20,
    enable_negative_drops: true,
    emergency_stop: false,
    drop_types: {
      green: { name: 'Green Drop', color: '#22c55e', prc_min: 1, prc_max: 5, probability: 40, is_negative: false },
      blue: { name: 'Blue Drop', color: '#3b82f6', prc_min: 3, prc_max: 10, probability: 30, is_negative: false },
      gold: { name: 'Gold Drop', color: '#eab308', prc_min: 10, prc_max: 25, probability: 10, is_negative: false },
      red: { name: 'Red Drop', color: '#ef4444', prc_min: 2, prc_max: 8, probability: 15, is_negative: true },
      black: { name: 'Black Drop', color: '#1f2937', prc_min: 10, prc_max: 20, probability: 5, is_negative: true }
    }
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchSettings();
    fetchStats();
  }, [user, navigate]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/admin/prc-rain/settings`);
      if (response.data.prc_rain_settings) {
        setSettings(prev => ({ ...prev, ...response.data.prc_rain_settings }));
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/prc-rain/stats`);
      setStats(response.data.today);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.post(`${API}/api/admin/prc-rain/settings`, settings);
      toast.success('PRC Rain settings saved!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleEmergencyStop = async () => {
    if (!window.confirm('⚠️ Emergency Stop will disable PRC Rain and cancel all active sessions. Continue?')) {
      return;
    }
    try {
      await axios.post(`${API}/api/admin/prc-rain/emergency-stop`);
      toast.success('Emergency Stop activated!');
      fetchSettings();
    } catch (error) {
      toast.error('Failed to activate emergency stop');
    }
  };

  const updateDropType = (type, field, value) => {
    setSettings(prev => ({
      ...prev,
      drop_types: {
        ...prev.drop_types,
        [type]: {
          ...prev.drop_types[type],
          [field]: value
        }
      }
    }));
  };

  const getTotalProbability = () => {
    return Object.values(settings.drop_types).reduce((sum, drop) => sum + (drop.probability || 0), 0);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 min-h-screen" data-testid="admin-prc-rain">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CloudRain className="h-7 w-7 text-blue-400" />
            PRC Rain Drop Settings
          </h1>
          <p className="text-blue-200 mt-1">Configure the dopamine-inducing rain drop feature</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={handleEmergencyStop}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
            data-testid="emergency-stop-btn"
          >
            <PowerOff className="h-4 w-4" />
            Emergency STOP
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            data-testid="save-btn"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Today's Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20">
            <Droplets className="h-6 w-6 text-blue-400 mb-2" />
            <div className="text-2xl font-bold text-white">{stats.rain_events}</div>
            <div className="text-xs text-blue-200">Rain Events Today</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20">
            <TrendingUp className="h-6 w-6 text-green-400 mb-2" />
            <div className="text-2xl font-bold text-green-400">+{stats.total_prc_given?.toFixed(1)}</div>
            <div className="text-xs text-green-200">PRC Given</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20">
            <TrendingDown className="h-6 w-6 text-red-400 mb-2" />
            <div className="text-2xl font-bold text-red-400">-{stats.total_prc_taken?.toFixed(1)}</div>
            <div className="text-xs text-red-200">PRC Taken</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20">
            <Target className="h-6 w-6 text-yellow-400 mb-2" />
            <div className="text-2xl font-bold text-white">{stats.total_taps}</div>
            <div className="text-xs text-yellow-200">Total Taps</div>
          </Card>
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20">
            <Users className="h-6 w-6 text-purple-400 mb-2" />
            <div className="text-2xl font-bold text-white">{stats.unique_users}</div>
            <div className="text-xs text-purple-200">Users Participated</div>
          </Card>
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <Card className="p-6 mb-6 bg-white/10 backdrop-blur border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.enabled ? (
              <Power className="h-8 w-8 text-green-400" />
            ) : (
              <PowerOff className="h-8 w-8 text-red-400" />
            )}
            <div>
              <h3 className="text-lg font-semibold text-white">
                PRC Rain {settings.enabled ? 'Enabled' : 'Disabled'}
              </h3>
              <p className="text-sm text-gray-300">
                {settings.enabled 
                  ? 'Users will see random rain drops on their dashboard'
                  : 'Rain drops are currently disabled'}
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked, emergency_stop: false }))}
              className="sr-only peer"
              data-testid="toggle-enabled"
            />
            <div className="w-14 h-7 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
        
        {settings.emergency_stop && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <span className="text-red-300">Emergency Stop is active. Enable the feature to deactivate.</span>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Rain Frequency Settings */}
        <Card className="p-6 bg-white/10 backdrop-blur border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-400" />
            Rain Frequency
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Max Rain Events Per Day</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={settings.max_rain_events_per_day}
                onChange={(e) => setSettings(prev => ({ ...prev, max_rain_events_per_day: parseInt(e.target.value) || 1 }))}
                className="bg-white/10 border-white/20 text-white"
                data-testid="max-events-input"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Min Gap Between Rains (Hours)</label>
              <Input
                type="number"
                min="1"
                max="12"
                value={settings.min_gap_between_rains_hours}
                onChange={(e) => setSettings(prev => ({ ...prev, min_gap_between_rains_hours: parseInt(e.target.value) || 1 }))}
                className="bg-white/10 border-white/20 text-white"
                data-testid="min-gap-input"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Rain Duration (Seconds)</label>
              <Input
                type="number"
                min="10"
                max="120"
                value={settings.rain_duration_seconds}
                onChange={(e) => setSettings(prev => ({ ...prev, rain_duration_seconds: parseInt(e.target.value) || 30 }))}
                className="bg-white/10 border-white/20 text-white"
                data-testid="duration-input"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Max Taps Per Rain</label>
              <Input
                type="number"
                min="5"
                max="50"
                value={settings.max_taps_per_rain}
                onChange={(e) => setSettings(prev => ({ ...prev, max_taps_per_rain: parseInt(e.target.value) || 15 }))}
                className="bg-white/10 border-white/20 text-white"
                data-testid="max-taps-input"
              />
            </div>
          </div>
        </Card>

        {/* Safety Limits */}
        <Card className="p-6 bg-white/10 backdrop-blur border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-400" />
            Daily PRC Safety Limits
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Max PRC Gain Per Day (per user)</label>
              <Input
                type="number"
                min="0"
                value={settings.max_prc_gain_per_day}
                onChange={(e) => setSettings(prev => ({ ...prev, max_prc_gain_per_day: parseFloat(e.target.value) || 0 }))}
                className="bg-white/10 border-white/20 text-white"
                data-testid="max-gain-input"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Max PRC Loss Per Day (per user)</label>
              <Input
                type="number"
                min="0"
                value={settings.max_prc_loss_per_day}
                onChange={(e) => setSettings(prev => ({ ...prev, max_prc_loss_per_day: parseFloat(e.target.value) || 0 }))}
                className="bg-white/10 border-white/20 text-white"
                data-testid="max-loss-input"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
              <div>
                <div className="text-white font-medium">Enable Negative Drops</div>
                <div className="text-xs text-gray-400">Red & Black drops that reduce PRC</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enable_negative_drops}
                  onChange={(e) => setSettings(prev => ({ ...prev, enable_negative_drops: e.target.checked }))}
                  className="sr-only peer"
                  data-testid="toggle-negative"
                />
                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
          </div>
        </Card>
      </div>

      {/* Drop Types Configuration */}
      <Card className="p-6 bg-white/10 backdrop-blur border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Droplets className="h-5 w-5 text-blue-400" />
          Drop Types Configuration
          <span className={`ml-auto text-sm ${getTotalProbability() === 100 ? 'text-green-400' : 'text-yellow-400'}`}>
            Total Probability: {getTotalProbability()}%
          </span>
        </h3>
        
        {getTotalProbability() !== 100 && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg text-yellow-300 text-sm">
            ⚠️ Total probability should equal 100%. Current: {getTotalProbability()}%
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {Object.entries(settings.drop_types).map(([type, config]) => (
            <div
              key={type}
              className="p-4 rounded-xl border-2"
              style={{ 
                backgroundColor: `${config.color}20`,
                borderColor: config.color
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div 
                  className="w-8 h-8 rounded-full shadow-lg"
                  style={{ backgroundColor: config.color }}
                />
                <div>
                  <div className="font-semibold text-white">{config.name}</div>
                  <div className="text-xs" style={{ color: config.color }}>
                    {config.is_negative ? '📉 Negative' : '📈 Positive'}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <label className="text-gray-400 text-xs">PRC Range</label>
                  <div className="flex gap-1 items-center">
                    <Input
                      type="number"
                      min="0"
                      value={config.prc_min}
                      onChange={(e) => updateDropType(type, 'prc_min', parseFloat(e.target.value) || 0)}
                      className="h-8 bg-white/10 border-white/20 text-white text-center"
                    />
                    <span className="text-gray-400">-</span>
                    <Input
                      type="number"
                      min="0"
                      value={config.prc_max}
                      onChange={(e) => updateDropType(type, 'prc_max', parseFloat(e.target.value) || 0)}
                      className="h-8 bg-white/10 border-white/20 text-white text-center"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-gray-400 text-xs">Probability (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={config.probability}
                    onChange={(e) => updateDropType(type, 'probability', parseInt(e.target.value) || 0)}
                    className="h-8 bg-white/10 border-white/20 text-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-200 text-sm">
        <strong className="text-white">कसे काम करते:</strong> User dashboard वर random वेळी rain drops पडतात. 
        User drops वर tap करून PRC कमावू किंवा गमावू शकतो. सर्व settings real-time apply होतात - app update लागत नाही!
      </div>
    </div>
  );
};

export default AdminPRCRain;
