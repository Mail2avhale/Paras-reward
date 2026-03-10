import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Flame, Settings, TrendingDown, Users, AlertTriangle,
  RefreshCw, CheckCircle, ArrowLeft, Percent, Info, ShieldCheck, Zap,
  History, XCircle, Clock, RotateCcw
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminPRCBurnControl = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [smartBurning, setSmartBurning] = useState(false);
  const [smartBurnResult, setSmartBurnResult] = useState(null);
  
  // Burn History state
  const [burnHistory, setBurnHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [retrying, setRetrying] = useState(null);
  
  // Settings state
  const [burnEnabled, setBurnEnabled] = useState(false);
  const [burnPercentage, setBurnPercentage] = useState(1);
  const [minBalance, setMinBalance] = useState(100);
  const [targetType, setTargetType] = useState('all_users');
  
  // Stats
  const [prcStats, setPrcStats] = useState({
    total_prc_circulation: 0,
    total_users: 0,
    eligible_users: 0,
    estimated_burn: 0
  });

  // Check access - only admin/manager
  useEffect(() => {
    if (!user || !['admin', 'manager'].includes(user.role)) {
      navigate('/admin');
      toast.error('Access denied. Manager or Admin access required.');
    }
  }, [user, navigate]);

  // Scheduler status state
  const [schedulerStatus, setSchedulerStatus] = useState(null);

  useEffect(() => {
    fetchSettings();
    fetchPRCStats();
    fetchBurnHistory();
    fetchSchedulerStatus();
  }, []);

  // Fetch scheduler status
  const fetchSchedulerStatus = async () => {
    try {
      const response = await axios.get(`${API}/admin/scheduler/status`);
      setSchedulerStatus(response.data);
    } catch (error) {
      console.error('Error fetching scheduler status:', error);
      setSchedulerStatus({ scheduler_running: false, error: 'Failed to fetch' });
    }
  };

  // Fetch burn history
  const fetchBurnHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${API}/admin/prc-burn-control/history?limit=20`);
      setBurnHistory(response.data.history || []);
    } catch (error) {
      console.error('Error fetching burn history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Retry failed burn
  const handleRetryBurn = async (burnId) => {
    setRetrying(burnId);
    try {
      const response = await axios.post(`${API}/admin/prc-burn-control/retry`, {
        admin_id: user?.uid,
        burn_id: burnId
      });
      
      if (response.data.success) {
        toast.success('Burn retry successful!');
        fetchBurnHistory();
        fetchPRCStats();
      }
    } catch (error) {
      toast.error('Retry failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setRetrying(null);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/admin/prc-burn-control/settings`);
      if (response.data) {
        setBurnEnabled(response.data.enabled || false);
        setBurnPercentage(response.data.burn_percentage || 1);
        setMinBalance(response.data.min_balance || 100);
        setTargetType(response.data.target_type || 'all_users');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPRCStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/prc-burn-control/stats`);
      setPrcStats(response.data);
    } catch (error) {
      console.error('Error fetching PRC stats:', error);
    }
  };

  const handleSaveSettings = async () => {
    if (burnPercentage < 0.1 || burnPercentage > 50) {
      toast.error('Burn percentage must be between 0.1% and 50%');
      return;
    }
    
    setSaving(true);
    try {
      await axios.post(`${API}/admin/prc-burn-control/settings`, {
        enabled: burnEnabled,
        burn_percentage: parseFloat(burnPercentage),
        min_balance: parseInt(minBalance),
        target_type: targetType,
        updated_by: user?.uid
      });
      toast.success('Settings saved successfully!');
      fetchPRCStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleExecuteBurn = async () => {
    if (!burnEnabled) {
      toast.error('Please enable burn first before executing');
      return;
    }
    
    const confirmMsg = `Are you sure you want to burn ${burnPercentage}% PRC from all eligible users? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;
    
    setExecuting(true);
    try {
      const response = await axios.post(`${API}/admin/prc-burn-control/execute`, {
        admin_id: user?.uid
      });
      
      toast.success(`Burn completed! ${response.data.total_burned?.toLocaleString()} PRC burned from ${response.data.users_affected} users`);
      fetchPRCStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Burn execution failed');
    } finally {
      setExecuting(false);
    }
  };

  // Smart Auto Burn - Checks if today's scheduled burn ran, if not runs it
  const handleSmartBurn = async (force = false) => {
    setSmartBurning(true);
    setSmartBurnResult(null);
    try {
      const response = await axios.post(`${API}/admin/smart-burn`, {
        admin_id: user?.uid,
        force: force
      });
      
      setSmartBurnResult(response.data);
      
      if (response.data.burn_executed) {
        const burned = response.data.burn_result?.summary?.total_prc_burned || 0;
        const users = response.data.burn_result?.summary?.total_users_affected || 0;
        toast.success(`Smart Burn executed! ${burned.toLocaleString()} PRC burned from ${users} users`);
      } else {
        toast.info(response.data.message || 'Burn already completed today');
      }
      fetchPRCStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Smart burn failed');
    } finally {
      setSmartBurning(false);
    }
  };

  // Calculate estimated burn
  const estimatedBurn = (prcStats.total_prc_circulation * burnPercentage / 100).toFixed(2);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Flame className="w-7 h-7 text-orange-500" />
            PRC Burn Control
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Control PRC circulation by burning a percentage from all users
          </p>
        </div>
        <Button onClick={fetchPRCStats} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Current PRC Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 bg-purple-500/10 border-purple-500/30">
          <p className="text-purple-400 text-xs font-medium">Total PRC in Circulation</p>
          <p className="text-2xl font-bold text-white mt-1">
            {prcStats.total_prc_circulation?.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4 bg-blue-500/10 border-blue-500/30">
          <p className="text-blue-400 text-xs font-medium">Total Users</p>
          <p className="text-2xl font-bold text-white mt-1">
            {prcStats.total_users?.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4 bg-amber-500/10 border-amber-500/30">
          <p className="text-amber-400 text-xs font-medium">Eligible for Burn</p>
          <p className="text-2xl font-bold text-white mt-1">
            {prcStats.eligible_users?.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4 bg-red-500/10 border-red-500/30">
          <p className="text-red-400 text-xs font-medium">Estimated Burn</p>
          <p className="text-2xl font-bold text-white mt-1">
            {estimatedBurn} PRC
          </p>
        </Card>
      </div>

      {/* Settings Card */}
      <Card className="p-6 bg-gray-900 border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-gray-400" />
          <h2 className="text-xl font-bold text-white">Burn Settings</h2>
        </div>

        <div className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${burnEnabled ? 'bg-green-500/20' : 'bg-gray-700'}`}>
                {burnEnabled ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <Flame className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <div>
                <p className="text-white font-medium">PRC Burn</p>
                <p className="text-gray-400 text-sm">
                  {burnEnabled ? 'Burn is ENABLED' : 'Burn is DISABLED'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setBurnEnabled(!burnEnabled)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                burnEnabled ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  burnEnabled ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Burn Percentage */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 block">
              Burn Percentage (%)
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                value={burnPercentage}
                onChange={(e) => setBurnPercentage(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white max-w-[150px]"
              />
              <Percent className="w-5 h-5 text-gray-500" />
              <span className="text-gray-400 text-sm">
                (0.1% - 50%)
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              Example: 1% burn on 1000 PRC = 10 PRC burned
            </p>
          </div>

          {/* Minimum Balance */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 block">
              Minimum Balance to Burn (PRC)
            </label>
            <Input
              type="number"
              min="1"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white max-w-[200px]"
            />
            <p className="text-gray-500 text-xs mt-2">
              Users with balance below this will NOT be affected
            </p>
          </div>

          {/* Target User Type */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 block">
              Target Users
            </label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="w-full max-w-[300px] px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="all_users">All Users (Everyone)</option>
              <option value="free_only">Free Users Only (Explorer plan)</option>
              <option value="inactive">Inactive Users (30+ days no activity)</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4 border-t border-gray-700">
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
            
            <Button
              onClick={handleExecuteBurn}
              disabled={executing || !burnEnabled}
              className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
            >
              {executing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Burning...
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4 mr-2" />
                  Execute Burn Now
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Scheduler Status Card */}
      {schedulerStatus && (
        <Card className={`mt-6 p-4 ${schedulerStatus.scheduler_running ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${schedulerStatus.scheduler_running ? 'bg-blue-500/20' : 'bg-red-500/20'}`}>
                <Clock className={`w-5 h-5 ${schedulerStatus.scheduler_running ? 'text-blue-400' : 'text-red-400'}`} />
              </div>
              <div>
                <h3 className={`font-semibold ${schedulerStatus.scheduler_running ? 'text-blue-400' : 'text-red-400'}`}>
                  Scheduler: {schedulerStatus.scheduler_running ? 'Running' : 'Not Running'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {schedulerStatus.total_jobs || 0} jobs configured
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSchedulerStatus}
              className="border-gray-600"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          {schedulerStatus.recommendation && (
            <p className="text-amber-400 text-xs mt-3 p-2 bg-amber-500/10 rounded-lg">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              {schedulerStatus.recommendation}
            </p>
          )}
        </Card>
      )}

      {/* Smart Auto Burn Section */}
      <Card className="mt-6 p-5 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Zap className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-green-400 font-bold text-lg">Smart Auto Burn</h3>
              <p className="text-green-200/70 text-sm mt-1">
                Automatically checks if today's scheduled 0.5% burn ran. If not, executes it.
              </p>
              <p className="text-green-200/50 text-xs mt-1">
                Scheduled: 11 AM & 11 PM IST daily
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleSmartBurn(false)}
              disabled={smartBurning}
              className="bg-green-600 hover:bg-green-700"
            >
              {smartBurning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Run Smart Burn
                </>
              )}
            </Button>
            <Button
              onClick={() => handleSmartBurn(true)}
              disabled={smartBurning}
              variant="outline"
              className="border-green-500/50 text-green-400 hover:bg-green-500/10"
            >
              Force Run
            </Button>
          </div>
        </div>
        
        {/* Smart Burn Result */}
        {smartBurnResult && (
          <div className="mt-4 p-3 bg-gray-900/50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Today (IST)</p>
                <p className="text-white font-medium">{smartBurnResult.today_date_ist}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Last Burn</p>
                <p className="text-white font-medium">
                  {smartBurnResult.last_burn?.last_burn_time_ist || 'Never'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Burn Needed?</p>
                <p className={`font-medium ${smartBurnResult.burn_needed ? 'text-yellow-400' : 'text-green-400'}`}>
                  {smartBurnResult.burn_needed ? 'Yes' : 'No (Already done)'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Executed?</p>
                <p className={`font-medium ${smartBurnResult.burn_executed ? 'text-green-400' : 'text-gray-400'}`}>
                  {smartBurnResult.burn_executed ? '✅ Yes' : '⏭ Skipped'}
                </p>
              </div>
            </div>
            {smartBurnResult.burn_executed && smartBurnResult.burn_result?.summary && (
              <div className="mt-3 pt-3 border-t border-gray-700 flex items-center gap-4">
                <span className="text-green-400 font-bold">
                  Burned: {smartBurnResult.burn_result.summary.total_prc_burned?.toLocaleString()} PRC
                </span>
                <span className="text-gray-400">
                  from {smartBurnResult.burn_result.summary.total_users_affected} users
                </span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Warning Card - Original */}
      <Card className="mt-6 p-4 bg-amber-500/10 border-amber-500/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-amber-400 font-medium">Important Notes</h3>
            <ul className="text-amber-200/70 text-sm mt-2 space-y-1">
              <li>• Burn will deduct {burnPercentage}% from each eligible user's PRC balance</li>
              <li>• Users with balance below {minBalance} PRC will NOT be affected</li>
              <li>• This action is irreversible - burned PRC cannot be recovered</li>
              <li>• Use this carefully to control excessive PRC circulation</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Info Card */}
      <Card className="mt-4 p-4 bg-blue-500/10 border-blue-500/30">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-blue-400 font-medium">When to use PRC Burn?</h3>
            <p className="text-blue-200/70 text-sm mt-1">
              Use this feature when there's too much PRC in circulation and you need to 
              reduce the supply to maintain PRC value. A small percentage (1-5%) burn 
              periodically can help balance the economy.
            </p>
          </div>
        </div>
      </Card>

      {/* Burn Schedule History */}
      <Card className="mt-6 p-4 bg-gray-800/50 border-gray-700" data-testid="burn-history-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            <h3 className="text-white font-semibold">Burn Schedule History</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBurnHistory}
            disabled={historyLoading}
            className="border-gray-600"
          >
            {historyLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        ) : burnHistory.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500">No burn history found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {burnHistory.map((burn, index) => (
              <div
                key={burn.id || index}
                className={`p-3 rounded-lg border ${
                  burn.status === 'success' 
                    ? 'bg-green-900/20 border-green-500/30' 
                    : burn.status === 'failed'
                    ? 'bg-red-900/20 border-red-500/30'
                    : 'bg-gray-900/50 border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Status Icon */}
                    {burn.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : burn.status === 'failed' ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-400" />
                    )}
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">
                          {burn.burn_date_ist || 'Unknown time'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          burn.type === 'scheduled' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {burn.type === 'scheduled' ? 'Scheduled' : 'Manual'}
                        </span>
                        {burn.forced && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                            Forced
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">
                        By: {burn.executed_by || 'System'} 
                        {burn.status === 'success' && burn.total_burned > 0 && (
                          <span className="ml-2 text-green-400">
                            • Burned: {burn.total_burned?.toLocaleString()} PRC from {burn.users_affected} users
                          </span>
                        )}
                        {burn.status === 'failed' && burn.error && (
                          <span className="ml-2 text-red-400">
                            • Error: {burn.error}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {/* Retry Button for failed burns */}
                  {burn.can_retry && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetryBurn(burn.id)}
                      disabled={retrying === burn.id}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      {retrying === burn.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Retry
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-700 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-400" />
            <span className="text-gray-400">Success</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-400" />
            <span className="text-gray-400">Failed (can retry)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500/50"></span>
            <span className="text-gray-400">Scheduled (11 AM/PM)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-purple-500/50"></span>
            <span className="text-gray-400">Manual</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminPRCBurnControl;
