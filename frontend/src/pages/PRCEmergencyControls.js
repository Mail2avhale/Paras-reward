import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, Power, Flame, Shield, RefreshCw,
  Users, Coins, Bell, BellOff, Settings, CheckCircle,
  XCircle, Loader2, TrendingDown, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * PRC Economy Emergency Controls
 * Admin panel for managing PRC economy health
 */
const PRCEmergencyControls = () => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    globalMiningEnabled: true,
    totalPrcInSystem: 0,
    totalUsers: 0,
    dailyMintRate: 0,
    circuitBreakerActive: false
  });
  
  // Burn settings
  const [burnSettings, setBurnSettings] = useState({
    method: 'progressive', // flat, progressive, cap
    flatPercentage: 5,
    progressiveRates: [
      { minBalance: 50000, percentage: 15 },
      { minBalance: 20000, percentage: 10 },
      { minBalance: 10000, percentage: 7 },
      { minBalance: 5000, percentage: 5 },
      { minBalance: 0, percentage: 2 }
    ],
    minProtectedBalance: 5000,
    customMinBalance: 5000,
    useCustomMin: false,
    sendNotification: true
  });
  
  const [burnPreview, setBurnPreview] = useState(null);
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/prc-economy/status`);
      setSystemStatus(response.data);
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyStop = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/api/admin/prc-economy/emergency-stop`, {
        sendNotification: burnSettings.sendNotification
      });
      toast.success('Mining stopped for all users');
      setShowStopConfirm(false);
      fetchSystemStatus();
    } catch (error) {
      toast.error('Failed to stop mining');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeMining = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/api/admin/prc-economy/resume-mining`, {
        sendNotification: burnSettings.sendNotification
      });
      toast.success('Mining resumed for all users');
      fetchSystemStatus();
    } catch (error) {
      toast.error('Failed to resume mining');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreviewBurn = async () => {
    setActionLoading(true);
    try {
      const response = await axios.post(`${API}/api/admin/prc-economy/burn-preview`, {
        method: burnSettings.method,
        flatPercentage: burnSettings.flatPercentage,
        progressiveRates: burnSettings.progressiveRates,
        minProtectedBalance: burnSettings.useCustomMin 
          ? burnSettings.customMinBalance 
          : burnSettings.minProtectedBalance
      });
      setBurnPreview(response.data);
    } catch (error) {
      toast.error('Failed to generate preview');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteBurn = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/api/admin/prc-economy/execute-burn`, {
        method: burnSettings.method,
        flatPercentage: burnSettings.flatPercentage,
        progressiveRates: burnSettings.progressiveRates,
        minProtectedBalance: burnSettings.useCustomMin 
          ? burnSettings.customMinBalance 
          : burnSettings.minProtectedBalance,
        sendNotification: burnSettings.sendNotification
      });
      toast.success('PRC burn executed successfully');
      setShowBurnConfirm(false);
      setBurnPreview(null);
      fetchSystemStatus();
    } catch (error) {
      toast.error('Failed to execute burn');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-600" />
            PRC Economy Controls
          </h1>
          <p className="text-sm text-gray-500">Emergency controls for PRC sustainability</p>
        </div>
        <Button variant="outline" onClick={fetchSystemStatus}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Circuit Breaker Alert */}
      {systemStatus.circuitBreakerActive && (
        <div className="bg-red-100 border border-red-300 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <div>
            <p className="font-bold text-red-800">Circuit Breaker Active</p>
            <p className="text-sm text-red-600">Mining auto-paused due to high mint rate</p>
          </div>
        </div>
      )}

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${systemStatus.globalMiningEnabled ? 'bg-green-100' : 'bg-red-100'}`}>
              <Power className={`w-5 h-5 ${systemStatus.globalMiningEnabled ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Mining Status</p>
              <p className={`font-bold ${systemStatus.globalMiningEnabled ? 'text-green-600' : 'text-red-600'}`}>
                {systemStatus.globalMiningEnabled ? 'ACTIVE' : 'STOPPED'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-purple-100">
              <Coins className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total PRC</p>
              <p className="font-bold text-purple-600">
                {systemStatus.totalPrcInSystem?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="font-bold text-blue-600">{systemStatus.totalUsers || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-orange-100">
              <TrendingDown className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daily Mint Rate</p>
              <p className="font-bold text-orange-600">
                {systemStatus.dailyMintRate?.toLocaleString() || 0} PRC
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Emergency Mining Control */}
      <Card className="p-6 border-2 border-red-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Emergency Mining Control
        </h2>

        <div className="flex flex-wrap gap-4">
          {systemStatus.globalMiningEnabled ? (
            <Button 
              variant="destructive" 
              size="lg"
              onClick={() => setShowStopConfirm(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              <Power className="w-5 h-5 mr-2" />
              🛑 EMERGENCY STOP ALL MINING
            </Button>
          ) : (
            <Button 
              size="lg"
              onClick={handleResumeMining}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Power className="w-5 h-5 mr-2" />
              )}
              ▶️ Resume Mining for All
            </Button>
          )}

          {/* Notification Toggle */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600">Notify Users:</span>
            <button
              onClick={() => setBurnSettings(prev => ({ ...prev, sendNotification: !prev.sendNotification }))}
              className={`p-2 rounded-lg ${burnSettings.sendNotification ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
            >
              {burnSettings.sendNotification ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Stop Confirmation */}
        {showStopConfirm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200"
          >
            <p className="font-bold text-red-800 mb-2">⚠️ Confirm Emergency Stop</p>
            <p className="text-sm text-red-600 mb-4">
              This will immediately stop mining for ALL {systemStatus.totalUsers} users. 
              {burnSettings.sendNotification && ' Users will be notified.'}
            </p>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleEmergencyStop} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Stop All Mining'}
              </Button>
              <Button variant="outline" onClick={() => setShowStopConfirm(false)}>Cancel</Button>
            </div>
          </motion.div>
        )}
      </Card>

      {/* PRC Burn Tool */}
      <Card className="p-6 border-2 border-orange-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-600" />
          Progressive PRC Burn Tool
        </h2>

        {/* Burn Method */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Burn Method</label>
          <div className="flex gap-2">
            {['progressive', 'flat', 'cap'].map(method => (
              <button
                key={method}
                onClick={() => setBurnSettings(prev => ({ ...prev, method }))}
                className={`px-4 py-2 rounded-lg font-medium capitalize ${
                  burnSettings.method === method
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {/* Progressive Rates */}
        {burnSettings.method === 'progressive' && (
          <div className="mb-6 bg-orange-50 p-4 rounded-xl">
            <p className="text-sm font-medium text-orange-800 mb-3">Progressive Burn Rates:</p>
            <div className="space-y-2">
              {burnSettings.progressiveRates.map((rate, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Balance ≥ {rate.minBalance.toLocaleString()} PRC:</span>
                  <span className="font-bold text-orange-600">{rate.percentage}% burn</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flat Percentage */}
        {burnSettings.method === 'flat' && (
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Burn Percentage</label>
            <input
              type="number"
              value={burnSettings.flatPercentage}
              onChange={(e) => setBurnSettings(prev => ({ ...prev, flatPercentage: Number(e.target.value) }))}
              className="w-32 px-3 py-2 border rounded-lg"
              min="1"
              max="50"
            />
            <span className="ml-2 text-gray-500">%</span>
          </div>
        )}

        {/* Minimum Protected Balance */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Minimum Protected Balance</label>
          <div className="flex flex-wrap gap-2">
            {[1000, 5000, 10000].map(amount => (
              <button
                key={amount}
                onClick={() => setBurnSettings(prev => ({ 
                  ...prev, 
                  minProtectedBalance: amount,
                  useCustomMin: false 
                }))}
                className={`px-4 py-2 rounded-lg font-medium ${
                  !burnSettings.useCustomMin && burnSettings.minProtectedBalance === amount
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {amount.toLocaleString()} PRC
              </button>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={burnSettings.customMinBalance}
                onChange={(e) => setBurnSettings(prev => ({ 
                  ...prev, 
                  customMinBalance: Number(e.target.value),
                  useCustomMin: true 
                }))}
                className={`w-32 px-3 py-2 border rounded-lg ${burnSettings.useCustomMin ? 'border-purple-500' : ''}`}
                placeholder="Custom"
              />
              <span className="text-gray-500">PRC</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Users below this balance will not be affected</p>
        </div>

        {/* Preview & Execute */}
        <div className="flex flex-wrap gap-4">
          <Button 
            variant="outline" 
            onClick={handlePreviewBurn}
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            📊 Preview Burn Impact
          </Button>
          
          {burnPreview && (
            <Button 
              variant="destructive"
              onClick={() => setShowBurnConfirm(true)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Flame className="w-4 h-4 mr-2" />
              Execute Burn
            </Button>
          )}
        </div>

        {/* Burn Preview */}
        {burnPreview && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-orange-50 rounded-xl border border-orange-200"
          >
            <p className="font-bold text-orange-800 mb-3">📊 Burn Preview</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Users Affected</p>
                <p className="font-bold text-orange-600">{burnPreview.usersAffected}</p>
              </div>
              <div>
                <p className="text-gray-600">Total PRC to Burn</p>
                <p className="font-bold text-orange-600">{burnPreview.totalBurn?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Users Protected</p>
                <p className="font-bold text-green-600">{burnPreview.usersProtected}</p>
              </div>
              <div>
                <p className="text-gray-600">New Total PRC</p>
                <p className="font-bold text-purple-600">{burnPreview.newTotalPrc?.toLocaleString()}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Burn Confirmation */}
        {showBurnConfirm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200"
          >
            <p className="font-bold text-red-800 mb-2">⚠️ Confirm PRC Burn</p>
            <p className="text-sm text-red-600 mb-4">
              This will burn {burnPreview?.totalBurn?.toLocaleString()} PRC from {burnPreview?.usersAffected} users.
              This action cannot be undone!
              {burnSettings.sendNotification && ' Users will be notified.'}
            </p>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleExecuteBurn} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '🔥 Execute Burn'}
              </Button>
              <Button variant="outline" onClick={() => setShowBurnConfirm(false)}>Cancel</Button>
            </div>
          </motion.div>
        )}
      </Card>

      {/* Auto Circuit Breakers */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          Auto Circuit Breakers
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Automatic safeguards that trigger when PRC economy metrics exceed thresholds
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-800">Daily Mint Limit</p>
              <p className="text-xs text-gray-500">Auto-pause if daily mint exceeds threshold</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={100000}
                className="w-32 px-3 py-1 border rounded text-sm"
              />
              <span className="text-sm text-gray-500">PRC/day</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-800">Total PRC Cap</p>
              <p className="text-xs text-gray-500">Alert when total PRC exceeds this</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={10000000}
                className="w-32 px-3 py-1 border rounded text-sm"
              />
              <span className="text-sm text-gray-500">PRC</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-800">Per-User Daily Limit</p>
              <p className="text-xs text-gray-500">Max PRC any user can mine per day</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={1000}
                className="w-32 px-3 py-1 border rounded text-sm"
              />
              <span className="text-sm text-gray-500">PRC/user</span>
            </div>
          </div>
        </div>

        <Button className="mt-4" variant="outline">
          <CheckCircle className="w-4 h-4 mr-2" />
          Save Circuit Breaker Settings
        </Button>
      </Card>
    </div>
  );
};

export default PRCEmergencyControls;
