import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  Settings, Pause, Play, Target, Bell, 
  Shield, Moon, Zap, ChevronRight, ToggleLeft, ToggleRight
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * User Control Settings Component
 * Allows users to control their mining and app preferences
 * Google Play Compliant - User control strongly recommended
 */
const UserControlSettings = ({ userId, userSettings = {}, onSettingsChange, translations = {} }) => {
  const [settings, setSettings] = useState({
    miningPaused: false,
    dailyPrcCap: 0, // 0 = unlimited
    utilityOnlyMode: false,
    notificationsEnabled: true,
    darkMode: false,
    ...userSettings
  });
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const t = (key) => translations[key] || defaultTranslations[key] || key;

  const defaultTranslations = {
    userControls: 'User Controls',
    pauseMining: 'Pause Mining',
    pauseMiningDesc: 'Temporarily stop PRC mining',
    dailyCap: 'Daily PRC Cap',
    dailyCapDesc: 'Set maximum PRC to earn per day',
    utilityMode: 'Utility Only Mode',
    utilityModeDesc: 'Focus on recharges & bills only',
    notifications: 'Notifications',
    notificationsDesc: 'Receive alerts and updates',
    saveSettings: 'Save Settings',
    unlimited: 'Unlimited',
    miningActive: 'Mining Active',
    miningPausedStatus: 'Mining Paused'
  };

  const capOptions = [
    { value: 0, label: t('unlimited') },
    { value: 100, label: '100 PRC' },
    { value: 500, label: '500 PRC' },
    { value: 1000, label: '1000 PRC' },
    { value: 2000, label: '2000 PRC' }
  ];

  const handleToggle = async (key) => {
    const newValue = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newValue }));
    
    // Save to backend
    try {
      await axios.put(`${API}/api/user/settings/${userId}`, {
        [key]: newValue
      });
      
      if (onSettingsChange) {
        onSettingsChange({ ...settings, [key]: newValue });
      }
      
      toast.success('Settings updated');
    } catch (error) {
      // Revert on error
      setSettings(prev => ({ ...prev, [key]: !newValue }));
      toast.error('Failed to update settings');
    }
  };

  const handleCapChange = async (value) => {
    setSettings(prev => ({ ...prev, dailyPrcCap: value }));
    
    try {
      await axios.put(`${API}/api/user/settings/${userId}`, {
        dailyPrcCap: value
      });
      toast.success('Daily cap updated');
    } catch (error) {
      toast.error('Failed to update cap');
    }
  };

  const ToggleSwitch = ({ enabled, onToggle, disabled = false }) => (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        enabled ? 'bg-purple-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <motion.div
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
        animate={{ left: enabled ? '28px' : '4px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );

  return (
    <div className="px-4 mb-4" data-testid="user-control-settings">
      <motion.div 
        className="bg-white rounded-2xl shadow-lg overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div 
          className="p-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">{t('userControls')}</h3>
                <p className="text-xs text-white/80">
                  {settings.miningPaused ? t('miningPausedStatus') : t('miningActive')}
                </p>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </div>
        </div>

        {/* Quick Toggle */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.miningPaused ? (
              <Pause className="w-5 h-5 text-orange-500" />
            ) : (
              <Play className="w-5 h-5 text-green-500" />
            )}
            <div>
              <p className="font-medium text-gray-800">{t('pauseMining')}</p>
              <p className="text-xs text-gray-500">{t('pauseMiningDesc')}</p>
            </div>
          </div>
          <ToggleSwitch 
            enabled={settings.miningPaused} 
            onToggle={() => handleToggle('miningPaused')} 
          />
        </div>

        {/* Expanded Settings */}
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="divide-y"
          >
            {/* Daily Cap */}
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Target className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium text-gray-800">{t('dailyCap')}</p>
                  <p className="text-xs text-gray-500">{t('dailyCapDesc')}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {capOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleCapChange(option.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      settings.dailyPrcCap === option.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Utility Only Mode */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="font-medium text-gray-800">{t('utilityMode')}</p>
                  <p className="text-xs text-gray-500">{t('utilityModeDesc')}</p>
                </div>
              </div>
              <ToggleSwitch 
                enabled={settings.utilityOnlyMode} 
                onToggle={() => handleToggle('utilityOnlyMode')} 
              />
            </div>

            {/* Notifications */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="font-medium text-gray-800">{t('notifications')}</p>
                  <p className="text-xs text-gray-500">{t('notificationsDesc')}</p>
                </div>
              </div>
              <ToggleSwitch 
                enabled={settings.notificationsEnabled} 
                onToggle={() => handleToggle('notificationsEnabled')} 
              />
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default UserControlSettings;
