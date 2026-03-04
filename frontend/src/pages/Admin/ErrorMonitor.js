import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Zap,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const ErrorMonitor = () => {
  const [dashboard, setDashboard] = useState(null);
  const [errors, setErrors] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeRange, setTimeRange] = useState(24);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/monitor/dashboard`);
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    }
  }, []);

  const fetchErrors = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/monitor/errors?hours=${timeRange}&limit=50`);
      setErrors(response.data.errors || []);
    } catch (error) {
      console.error('Failed to fetch errors:', error);
    }
  }, [timeRange]);

  const fetchPaymentSummary = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/monitor/payments/summary?hours=${timeRange}`);
      setPaymentSummary(response.data);
    } catch (error) {
      console.error('Failed to fetch payment summary:', error);
    }
  }, [timeRange]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchDashboard(), fetchErrors(), fetchPaymentSummary()]);
    setLoading(false);
    toast.success('Data refreshed');
  }, [fetchDashboard, fetchErrors, fetchPaymentSummary]);

  useEffect(() => {
    refreshAll();
    // Auto refresh every 60 seconds
    const interval = setInterval(refreshAll, 60000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const resolveError = async (errorId) => {
    try {
      await axios.post(`${API}/monitor/errors/${errorId}/resolve`, { notes: 'Resolved via admin panel' });
      toast.success('Error marked as resolved');
      fetchErrors();
      fetchDashboard();
    } catch (error) {
      toast.error('Failed to resolve error');
    }
  };

  const getHealthColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthBg = (status) => {
    if (status === 'healthy') return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
    if (status === 'warning') return 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
    return 'from-red-500/20 to-rose-500/20 border-red-500/30';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              System Monitor
            </h1>
            <p className="text-gray-400 mt-1">Real-time error & payment monitoring</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
            >
              <option value={1}>Last 1 hour</option>
              <option value={6}>Last 6 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={72}>Last 3 days</option>
              <option value={168}>Last 7 days</option>
            </select>
            <Button
              onClick={refreshAll}
              disabled={loading}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['dashboard', 'errors', 'payments'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            {/* Health Score */}
            <Card className={`bg-gradient-to-br ${getHealthBg(dashboard.health_status)} border`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">System Health</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`text-5xl font-bold ${getHealthColor(dashboard.health_score)}`}>
                        {dashboard.health_score}
                      </span>
                      <span className="text-2xl text-gray-400">/100</span>
                    </div>
                    <p className={`mt-2 font-medium ${getHealthColor(dashboard.health_score)}`}>
                      Status: {dashboard.health_status?.toUpperCase()}
                    </p>
                  </div>
                  <Activity className={`h-24 w-24 ${getHealthColor(dashboard.health_score)}`} />
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Errors */}
              <Card className="bg-gray-800/50 border border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-gray-300 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    Errors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last 24h:</span>
                      <span className="font-bold text-white">{dashboard.errors?.last_24h || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last 1h:</span>
                      <span className="font-bold text-yellow-400">{dashboard.errors?.last_1h || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Critical:</span>
                      <span className="font-bold text-red-400">{dashboard.errors?.critical_unresolved || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payments */}
              <Card className="bg-gray-800/50 border border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-gray-300 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-green-400" />
                    Payments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total 24h:</span>
                      <span className="font-bold text-white">{dashboard.payments?.total_24h || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Failed:</span>
                      <span className="font-bold text-red-400">{dashboard.payments?.failed_24h || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Success Rate:</span>
                      <span className={`font-bold ${dashboard.payments?.success_rate >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {dashboard.payments?.success_rate || 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API */}
              <Card className="bg-gray-800/50 border border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-gray-300 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-400" />
                    API Calls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total 24h:</span>
                      <span className="font-bold text-white">{dashboard.api?.calls_24h || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Errors:</span>
                      <span className="font-bold text-red-400">{dashboard.api?.errors_24h || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Error Rate:</span>
                      <span className={`font-bold ${dashboard.api?.error_rate <= 5 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {dashboard.api?.error_rate || 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Critical Errors */}
            {dashboard.recent_critical_errors?.length > 0 && (
              <Card className="bg-red-500/10 border border-red-500/30">
                <CardHeader>
                  <CardTitle className="text-lg text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Critical Errors (Unresolved)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboard.recent_critical_errors.map((error, idx) => (
                      <div key={idx} className="bg-gray-800/50 rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">{error.error_type}</p>
                          <p className="text-gray-400 text-sm mt-1">{error.error_message?.substring(0, 100)}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            <Clock className="inline h-3 w-3 mr-1" />
                            {new Date(error.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          onClick={() => resolveError(error._id)}
                          variant="outline"
                          className="border-green-500 text-green-400 hover:bg-green-500/20"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Resolve
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Errors Tab */}
        {activeTab === 'errors' && (
          <Card className="bg-gray-800/50 border border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-gray-300">Recent Errors ({errors.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {errors.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-400" />
                  <p>No errors in the selected time range</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {errors.map((error, idx) => (
                    <div 
                      key={idx} 
                      className={`rounded-lg p-4 border ${
                        error.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                        error.severity === 'error' ? 'bg-orange-500/10 border-orange-500/30' :
                        'bg-gray-700/50 border-gray-600'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              error.severity === 'critical' ? 'bg-red-500 text-white' :
                              error.severity === 'error' ? 'bg-orange-500 text-white' :
                              error.severity === 'warning' ? 'bg-yellow-500 text-black' :
                              'bg-gray-600 text-white'
                            }`}>
                              {error.severity?.toUpperCase()}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-gray-600 text-xs text-gray-300">
                              {error.category}
                            </span>
                            {error.resolved && (
                              <span className="px-2 py-0.5 rounded bg-green-500/20 text-xs text-green-400">
                                RESOLVED
                              </span>
                            )}
                          </div>
                          <p className="text-white font-medium mt-2">{error.error_type}</p>
                          <p className="text-gray-400 text-sm mt-1">{error.error_message}</p>
                          <p className="text-gray-500 text-xs mt-2">
                            Source: {error.source} | {new Date(error.timestamp).toLocaleString()}
                          </p>
                        </div>
                        {!error.resolved && (
                          <Button
                            onClick={() => resolveError(error._id)}
                            size="sm"
                            variant="outline"
                            className="border-green-500 text-green-400 hover:bg-green-500/20"
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && paymentSummary && (
          <div className="space-y-6">
            {/* Service Summary */}
            <Card className="bg-gray-800/50 border border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg text-gray-300">Payment Summary by Service</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700">
                        <th className="pb-3">Service</th>
                        <th className="pb-3">Success</th>
                        <th className="pb-3">Failed</th>
                        <th className="pb-3">Total Amount</th>
                        <th className="pb-3">Success Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(paymentSummary.by_service || {}).map(([service, data]) => (
                        <tr key={service} className="border-b border-gray-700/50">
                          <td className="py-3 text-white font-medium">{service}</td>
                          <td className="py-3 text-green-400">{data.success || 0}</td>
                          <td className="py-3 text-red-400">{data.failed || 0}</td>
                          <td className="py-3 text-white">₹{(data.total_amount || 0).toLocaleString()}</td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded text-sm ${
                              data.success_rate >= 90 ? 'bg-green-500/20 text-green-400' :
                              data.success_rate >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {data.success_rate || 0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Top Failures */}
            {paymentSummary.top_failures?.length > 0 && (
              <Card className="bg-gray-800/50 border border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-300 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-400" />
                    Top Failing Operators
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {paymentSummary.top_failures.map((failure, idx) => (
                      <div key={idx} className="bg-gray-700/50 rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">
                            {failure._id?.service} - Operator: {failure._id?.operator}
                          </p>
                          <p className="text-gray-400 text-sm mt-1">{failure.last_error}</p>
                        </div>
                        <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full font-bold">
                          {failure.count} failures
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorMonitor;
