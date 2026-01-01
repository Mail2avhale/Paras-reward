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
  Settings, Zap, Shield, Palette, Percent
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Default colors for drops
const DEFAULT_COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const AdminPRCRain = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({
    enabled: false,
    max_rain_events_per_day: 5,
    min_gap_between_rains_minutes: 60,
    rain_duration_seconds: 30,
    max_taps_per_rain: 15,
    max_prc_gain_per_day: 50,
    max_prc_loss_per_day: 20,
    enable_negative_drops: true,
    negative_drop_probability: 20,
    emergency_stop: false,
    prc_range: { min: 1, max: 25 },
    drop_colors: DEFAULT_COLORS
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

  const addColor = () => {
    const newColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    setSettings(prev => ({
      ...prev,
      drop_colors: [...(prev.drop_colors || []), newColor]
    }));
  };

  const removeColor = (index) => {
    setSettings(prev => ({
      ...prev,
      drop_colors: prev.drop_colors.filter((_, i) => i !== index)
    }));
  };

  const updateColor = (index, color) => {
    setSettings(prev => ({
      ...prev,
      drop_colors: prev.drop_colors.map((c, i) => i === index ? color : c)
    }));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen bg-gray-900">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
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
          <p className="text-blue-200 mt-1">Random drops, random PRC - pure surprise!</p>
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
              <label className="text-sm text-gray-300 mb-1 block">Max Rain Events Per Day (2-100)</label>
              <Input
                type="number"
                min="2"
                max="100"
                value={settings.max_rain_events_per_day}
                onChange={(e) => setSettings(prev => ({ ...prev, max_rain_events_per_day: Math.max(2, Math.min(100, parseInt(e.target.value) || 2)) }))}
                className="bg-white/10 border-white/20 text-white"
                data-testid="max-events-input"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Min Gap Between Rains (Minutes)</label>
              <Input
                type="number"
                min="1"
                value={settings.min_gap_between_rains_minutes}
                onChange={(e) => setSettings(prev => ({ ...prev, min_gap_between_rains_minutes: Math.max(1, parseInt(e.target.value) || 1) }))}
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
              <label className="text-sm text-gray-300 mb-1 block">Max Taps Per Rain (1-50)</label>
              <Input
                type="number"
                min="1"
                max="50"
                value={settings.max_taps_per_rain}
                onChange={(e) => setSettings(prev => ({ ...prev, max_taps_per_rain: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) }))}
                className="bg-white/10 border-white/20 text-white"
                data-testid="max-taps-input"
              />
            </div>
          </div>
        </Card>

        {/* PRC & Negative Settings */}
        <Card className="p-6 bg-white/10 backdrop-blur border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            PRC Settings (Random!)
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-300 mb-1 block">Min PRC per Drop</label>
                <Input
                  type="number"
                  min="1"
                  value={settings.prc_range?.min || 1}
                  onChange={(e) => setSettings(prev => ({ ...prev, prc_range: { ...prev.prc_range, min: parseFloat(e.target.value) || 1 } }))}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-gray-300 mb-1 block">Max PRC per Drop</label>
                <Input
                  type="number"
                  min="1"
                  value={settings.prc_range?.max || 25}
                  onChange={(e) => setSettings(prev => ({ ...prev, prc_range: { ...prev.prc_range, max: parseFloat(e.target.value) || 25 } }))}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Max PRC Gain Per Day (per user)</label>
              <Input
                type="number"
                min="0"
                value={settings.max_prc_gain_per_day}
                onChange={(e) => setSettings(prev => ({ ...prev, max_prc_gain_per_day: parseFloat(e.target.value) || 0 }))}
                className="bg-white/10 border-white/20 text-white"
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
              />
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Enable Negative Drops</div>
                  <div className="text-xs text-gray-400">Some drops will reduce PRC</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enable_negative_drops}
                    onChange={(e) => setSettings(prev => ({ ...prev, enable_negative_drops: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>
              {settings.enable_negative_drops && (
                <div>
                  <label className="text-sm text-gray-300 mb-1 block flex items-center gap-1">
                    <Percent className="h-4 w-4" />
                    Negative Drop Probability (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.negative_drop_probability}
                    onChange={(e) => setSettings(prev => ({ ...prev, negative_drop_probability: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))}
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Drop Colors */}
      <Card className="p-6 bg-white/10 backdrop-blur border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Palette className="h-5 w-5 text-pink-400" />
          Drop Colors (Random Selection)
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          User ला कळणार नाही कोणत्या color मध्ये किती PRC आहे - सर्व random आहे! 🎲
        </p>
        
        <div className="flex flex-wrap gap-3 mb-4">
          {(settings.drop_colors || DEFAULT_COLORS).map((color, index) => (
            <div key={index} className="flex items-center gap-2 bg-white/5 p-2 rounded-lg">
              <input
                type="color"
                value={color}
                onChange={(e) => updateColor(index, e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeColor(index)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 w-8 p-0"
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={addColor}
            className="border-dashed border-white/30 text-white hover:bg-white/10"
          >
            + Add Color
          </Button>
        </div>
        
        {/* Preview */}
        <div className="p-4 bg-black/30 rounded-lg">
          <div className="text-xs text-gray-400 mb-2">Preview - Random colors will look like:</div>
          <div className="flex gap-2">
            {(settings.drop_colors || DEFAULT_COLORS).slice(0, 8).map((color, i) => (
              <div
                key={i}
                className="w-8 h-10 rounded-full"
                style={{
                  background: `radial-gradient(ellipse at 30% 30%, ${color}dd, ${color})`,
                  clipPath: 'polygon(50% 0%, 100% 55%, 85% 100%, 15% 100%, 0% 55%)',
                }}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-200 text-sm">
        <strong className="text-white">🎮 Gameplay:</strong> User ला फक्त colorful drops दिसतील. 
        प्रत्येक tap वर random PRC (+/-) मिळेल. कोणताही drop positive किंवा negative असू शकतो - 
        user ला माहिती नसेल! Pure dopamine experience! 🎯
      </div>
    </div>
  );
};

export default AdminPRCRain;
