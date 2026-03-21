import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  RefreshCw, Clock, CheckCircle, XCircle, 
  AlertTriangle, Play, RotateCcw, Zap,
  TrendingUp, Activity
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PaymentRetryQueueWidget = () => {
  const [stats, setStats] = useState(null);
  const [pendingRetries, setPendingRetries] = useState([]);
  const [retrySettings, setRetrySettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    // DEPRECATED: Task retry system removed
    // This widget should be hidden or removed from AdminDashboard
    setLoading(false);
    setRefreshing(false);
    return;
    
    /* OLD CODE - DISABLED
    if (isRefresh) setRefreshing(true);
    try {
      const [statsRes, retriesRes, settingsRes] = await Promise.all([
        axios.get(`${API}/admin/tasks/stats`),
        axios.get(`${API}/admin/tasks/pending-retries`),
        axios.get(`${API}/admin/tasks/retry-settings`)
      ]);
      
      setStats(statsRes.data.stats);
      setPendingRetries(retriesRes.data.pending_retries || []);
      setRetrySettings(settingsRes.data.settings);
    } catch (error) {
      console.error('Error fetching retry queue data:', error);
      if (!isRefresh) toast.error('Failed to load retry queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    */
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleManualRetry = async (taskId) => {
    try {
      await axios.post(`${API}/admin/tasks/retry/${taskId}`);
      toast.success('Task scheduled for retry');
      fetchData(true);
    } catch (error) {
      toast.error('Failed to retry task');
    }
  };

  // Calculate success rate
  const totalProcessed = (stats?.completed || 0) + (stats?.failed || 0);
  const successRate = totalProcessed > 0 
    ? Math.round((stats?.completed / totalProcessed) * 100) 
    : 100;

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 p-6" data-testid="retry-queue-loading">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-20 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 p-6" data-testid="payment-retry-queue-widget">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <RotateCcw className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Payment Retry Queue</h3>
            <p className="text-xs text-gray-400">Auto-retry for failed BBPS transactions</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="text-gray-400 hover:text-white"
          data-testid="refresh-retry-queue-btn"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Pending */}
        <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20" data-testid="pending-count">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-yellow-400">Pending</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.pending || 0}</p>
          <p className="text-xs text-gray-400">+ {stats?.retry_scheduled || 0} scheduled</p>
        </div>

        {/* Success */}
        <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20" data-testid="completed-count">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400">Completed</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.completed || 0}</p>
          <p className="text-xs text-gray-400">processed successfully</p>
        </div>

        {/* Failed */}
        <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20" data-testid="failed-count">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400">Failed</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.failed || 0}</p>
          <p className="text-xs text-gray-400">max retries exceeded</p>
        </div>

        {/* Success Rate */}
        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20" data-testid="success-rate">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-blue-400">Success Rate</span>
          </div>
          <p className="text-2xl font-bold text-white">{successRate}%</p>
          <p className="text-xs text-gray-400">{totalProcessed} total tasks</p>
        </div>
      </div>

      {/* Retry Settings Info */}
      {retrySettings && (
        <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-white">Auto-Retry Configuration</span>
            <span className={`ml-auto px-2 py-0.5 text-xs rounded-full ${
              retrySettings.auto_retry_enabled 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {retrySettings.auto_retry_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Max Retries</p>
              <p className="text-white font-medium">{retrySettings.max_retries}x</p>
            </div>
            <div>
              <p className="text-gray-400">Initial Delay</p>
              <p className="text-white font-medium">{retrySettings.retry_delay_seconds}s</p>
            </div>
            <div>
              <p className="text-gray-400">Backoff</p>
              <p className="text-white font-medium">1m → 5m → 30m</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {retrySettings.eligible_services?.map((service, idx) => (
              <span key={idx} className="px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded">
                {service}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pending Retries List */}
      {pendingRetries.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Pending Retry Tasks ({pendingRetries.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {pendingRetries.slice(0, 5).map((task) => (
              <div 
                key={task.task_id}
                className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 flex items-center justify-between"
                data-testid={`retry-task-${task.task_id}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{task.task_id}</span>
                    <span className={`px-1.5 py-0.5 text-xs rounded ${
                      task.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="text-sm text-white mt-1">
                    {task.payload?.service_type || 'Unknown'} - ₹{task.payload?.amount || 0}
                  </p>
                  <p className="text-xs text-gray-500">
                    Attempt {task.retry_count + 1}/{task.max_retries}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleManualRetry(task.task_id)}
                  className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                  data-testid={`retry-btn-${task.task_id}`}
                >
                  <Play className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500" data-testid="no-pending-retries">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500/50" />
          <p className="text-sm">No pending retry tasks</p>
          <p className="text-xs text-gray-600">All payments processed successfully</p>
        </div>
      )}
    </Card>
  );
};

export default PaymentRetryQueueWidget;
