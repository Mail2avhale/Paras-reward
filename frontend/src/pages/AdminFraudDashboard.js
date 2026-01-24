import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  ArrowLeft, Shield, AlertTriangle, Ban, CheckCircle, Search,
  RefreshCw, Loader2, Eye, User, Globe, Smartphone, Clock,
  TrendingUp, Users, XCircle, AlertCircle, Activity, Lock,
  Fingerprint, MapPin, Link2, BarChart3
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminFraudDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    blocked_today: 0,
    blocked_this_week: 0,
    high_risk_users: 0,
    block_reasons: {},
    suspicious_ips: []
  });
  const [registrationAttempts, setRegistrationAttempts] = useState([]);
  const [fraudLogs, setFraudLogs] = useState([]);
  const [searchUid, setSearchUid] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/admin/fraud/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching fraud stats:', error);
    }
  }, []);

  const fetchRegistrationAttempts = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/admin/fraud/registration-attempts?limit=50`);
      setRegistrationAttempts(response.data.attempts || []);
    } catch (error) {
      console.error('Error fetching registration attempts:', error);
    }
  }, []);

  const fetchFraudLogs = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/admin/fraud/logs?limit=50`);
      setFraudLogs(response.data.logs || []);
    } catch (error) {
      console.error('Error fetching fraud logs:', error);
    }
  }, []);

  const fetchUserProfile = async (uid) => {
    if (!uid.trim()) {
      toast.error('Please enter a User ID');
      return;
    }
    
    setLoadingProfile(true);
    try {
      const response = await axios.get(`${API}/api/admin/fraud/user/${uid.trim()}`);
      setUserProfile(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'User not found');
      setUserProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin');
      return;
    }
    
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchRegistrationAttempts(), fetchFraudLogs()]);
      setLoading(false);
    };
    
    loadData();
  }, [user, navigate, fetchStats, fetchRegistrationAttempts, fetchFraudLogs]);

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchRegistrationAttempts(), fetchFraudLogs()]);
    setLoading(false);
    toast.success('Data refreshed');
  };

  const getRiskBadge = (level) => {
    const badges = {
      low: 'bg-green-500/20 text-green-400 border-green-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      blocked: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return badges[level] || badges.low;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-900/20 to-gray-950 border-b border-red-900/30 sticky top-0 z-10">
        <div className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-6 h-6 text-red-400" />
                  Fraud Detection Dashboard
                </h1>
                <p className="text-gray-500 text-xs">
                  Monitor and prevent fraudulent activities
                </p>
              </div>
            </div>
            <Button onClick={refreshAll} variant="outline" size="sm" disabled={loading} className="border-red-700/50 text-red-400 hover:bg-red-500/10">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-500/20">
                <Ban className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-red-400 text-xs font-medium">Blocked Today</p>
                <p className="text-3xl font-bold text-red-300">{stats.blocked_today}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-500/20">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <p className="text-orange-400 text-xs font-medium">Blocked This Week</p>
                <p className="text-3xl font-bold text-orange-300">{stats.blocked_this_week}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-yellow-500/20">
                <Users className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-yellow-400 text-xs font-medium">High Risk Users</p>
                <p className="text-3xl font-bold text-yellow-300">{stats.high_risk_users}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-500/20">
                <Globe className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-purple-400 text-xs font-medium">Suspicious IPs</p>
                <p className="text-3xl font-bold text-purple-300">{stats.suspicious_ips?.length || 0}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 bg-gray-900/50 border border-gray-800 p-1 rounded-xl">
            <TabsTrigger value="overview" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="attempts" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
              <Ban className="w-4 h-4 mr-2" />
              Blocked
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
              <Activity className="w-4 h-4 mr-2" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="lookup" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
              <Search className="w-4 h-4 mr-2" />
              Lookup
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Block Reasons Chart */}
              <Card className="p-4 bg-gray-900/50 border-gray-800">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  Block Reasons (This Week)
                </h3>
                {Object.keys(stats.block_reasons || {}).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(stats.block_reasons).map(([reason, count]) => (
                      <div key={reason} className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm truncate flex-1">{reason || 'Unknown'}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-red-500 rounded-full"
                              style={{ width: `${Math.min((count / Math.max(...Object.values(stats.block_reasons))) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-red-400 font-mono text-sm w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No blocked attempts this week 🎉</p>
                )}
              </Card>

              {/* Suspicious IPs */}
              <Card className="p-4 bg-gray-900/50 border-gray-800">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-purple-400" />
                  Suspicious IPs (3+ Attempts)
                </h3>
                {stats.suspicious_ips?.length > 0 ? (
                  <div className="space-y-2">
                    {stats.suspicious_ips.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-purple-500/20">
                            <MapPin className="w-4 h-4 text-purple-400" />
                          </div>
                          <span className="text-white font-mono text-sm">{item.ip}</span>
                        </div>
                        <span className="text-red-400 font-bold">{item.attempts} attempts</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No suspicious IPs detected</p>
                )}
              </Card>
            </div>

            {/* Protection Status */}
            <Card className="p-4 bg-gray-900/50 border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                Active Protections
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Globe, label: 'IP Rate Limiting', status: 'Active', desc: '3/day, 2/hour' },
                  { icon: Fingerprint, label: 'Device Fingerprint', status: 'Active', desc: '2 accounts/device' },
                  { icon: User, label: 'Document Duplicate', status: 'Active', desc: 'Aadhaar, PAN, Mobile' },
                  { icon: Clock, label: 'Velocity Check', status: 'Active', desc: '10 txns/day' },
                  { icon: TrendingUp, label: 'Daily Cap', status: 'Active', desc: '₹50,000/day' },
                  { icon: Link2, label: 'Referral Fraud', status: 'Active', desc: 'Self-ref blocked' },
                  { icon: Lock, label: 'New Account Limit', status: 'Active', desc: 'KYC for ₹5K+' },
                  { icon: AlertTriangle, label: 'Suspicious Time', status: 'Active', desc: '12AM-5AM flagged' },
                ].map((item, idx) => (
                  <div key={idx} className="p-3 bg-gray-800/50 rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon className="w-4 h-4 text-green-400" />
                      <span className="text-white text-sm font-medium">{item.label}</span>
                    </div>
                    <p className="text-gray-500 text-xs">{item.desc}</p>
                    <span className="text-green-400 text-xs">● {item.status}</span>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Blocked Attempts Tab */}
          <TabsContent value="attempts" className="mt-4">
            <Card className="p-4 bg-gray-900/50 border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-4">Registration Attempts</h3>
              {registrationAttempts.length > 0 ? (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {registrationAttempts.map((attempt, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg border ${
                        attempt.success 
                          ? 'bg-green-500/5 border-green-500/20' 
                          : 'bg-red-500/5 border-red-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {attempt.success ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                          <div>
                            <p className="text-white text-sm font-mono">{attempt.ip_address || 'Unknown IP'}</p>
                            <p className="text-gray-500 text-xs">{formatDate(attempt.timestamp)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            attempt.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {attempt.success ? 'Success' : 'Blocked'}
                          </span>
                          {attempt.reason && (
                            <p className="text-gray-500 text-xs mt-1 max-w-[200px] truncate">{attempt.reason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No registration attempts logged</p>
              )}
            </Card>
          </TabsContent>

          {/* Fraud Logs Tab */}
          <TabsContent value="logs" className="mt-4">
            <Card className="p-4 bg-gray-900/50 border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-4">Fraud Event Logs</h3>
              {fraudLogs.length > 0 ? (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {fraudLogs.map((log, idx) => (
                    <div key={idx} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-400" />
                          <span className="text-white font-medium">{log.event_type}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full border ${getRiskBadge(log.risk_level)}`}>
                          {log.risk_level}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">User: {log.user_id}</p>
                      <p className="text-gray-500 text-xs">{formatDate(log.timestamp)}</p>
                      {log.details && (
                        <pre className="text-gray-600 text-xs mt-2 bg-gray-900 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No fraud events logged</p>
              )}
            </Card>
          </TabsContent>

          {/* User Lookup Tab */}
          <TabsContent value="lookup" className="mt-4 space-y-4">
            <Card className="p-4 bg-gray-900/50 border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-purple-400" />
                User Fraud Profile Lookup
              </h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter User ID (UID)"
                  value={searchUid}
                  onChange={(e) => setSearchUid(e.target.value)}
                  className="flex-1 bg-gray-900 border-gray-700"
                  onKeyPress={(e) => e.key === 'Enter' && fetchUserProfile(searchUid)}
                />
                <Button 
                  onClick={() => fetchUserProfile(searchUid)}
                  disabled={loadingProfile}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {loadingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </Card>

            {userProfile && (
              <div className="space-y-4">
                {/* User Info */}
                <Card className="p-4 bg-gray-900/50 border-gray-800">
                  <h4 className="text-white font-semibold mb-3">User Information</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-gray-500 text-xs">Name</p>
                      <p className="text-white">{userProfile.user?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Email</p>
                      <p className="text-white">{userProfile.user?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Risk Score</p>
                      <p className="text-white font-mono">{userProfile.user?.risk_score || 0}/100</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Risk Level</p>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getRiskBadge(userProfile.user?.risk_level)}`}>
                        {userProfile.user?.risk_level || 'low'}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Registration IP</p>
                      <p className="text-white font-mono text-sm">{userProfile.user?.registration_ip || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Device Fingerprint</p>
                      <p className="text-white font-mono text-sm truncate">{userProfile.user?.device_fingerprint?.slice(0, 16) || 'N/A'}...</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Created At</p>
                      <p className="text-white">{formatDate(userProfile.user?.created_at)}</p>
                    </div>
                  </div>
                </Card>

                {/* Related Accounts */}
                {(userProfile.related_by_device?.length > 0 || userProfile.related_by_ip?.length > 0) && (
                  <Card className="p-4 bg-red-900/20 border-red-500/30">
                    <h4 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Related Accounts Found!
                    </h4>
                    
                    {userProfile.related_by_device?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-gray-400 text-sm mb-2">Same Device ({userProfile.related_by_device.length})</p>
                        <div className="space-y-1">
                          {userProfile.related_by_device.map((acc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                              <span className="text-white text-sm">{acc.email || acc.name}</span>
                              <span className="text-gray-500 text-xs">{formatDate(acc.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {userProfile.related_by_ip?.length > 0 && (
                      <div>
                        <p className="text-gray-400 text-sm mb-2">Same IP ({userProfile.related_by_ip.length})</p>
                        <div className="space-y-1">
                          {userProfile.related_by_ip.map((acc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                              <span className="text-white text-sm">{acc.email || acc.name}</span>
                              <span className="text-gray-500 text-xs">{formatDate(acc.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                )}

                {/* Referral Rings */}
                {userProfile.referral_rings?.length > 0 && (
                  <Card className="p-4 bg-orange-900/20 border-orange-500/30">
                    <h4 className="text-orange-400 font-semibold mb-3 flex items-center gap-2">
                      <Link2 className="w-5 h-5" />
                      Circular Referral Chains Detected!
                    </h4>
                    <div className="space-y-2">
                      {userProfile.referral_rings.map((ring, idx) => (
                        <div key={idx} className="p-2 bg-gray-900/50 rounded">
                          <p className="text-white text-sm font-mono">
                            {ring.join(' → ')} → (loop)
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Fraud Logs for User */}
                {userProfile.fraud_logs?.length > 0 && (
                  <Card className="p-4 bg-gray-900/50 border-gray-800">
                    <h4 className="text-white font-semibold mb-3">User Fraud History</h4>
                    <div className="space-y-2">
                      {userProfile.fraud_logs.map((log, idx) => (
                        <div key={idx} className="p-2 bg-gray-800/50 rounded flex items-center justify-between">
                          <div>
                            <span className="text-yellow-400 text-sm">{log.event_type}</span>
                            <p className="text-gray-500 text-xs">{formatDate(log.timestamp)}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full border ${getRiskBadge(log.risk_level)}`}>
                            {log.risk_level}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminFraudDashboard;
