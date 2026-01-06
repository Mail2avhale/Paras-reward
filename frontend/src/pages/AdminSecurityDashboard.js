import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Shield, ShieldAlert, ShieldCheck, Lock, Unlock, 
  Users, Activity, Globe, AlertTriangle, Clock,
  LogOut, Eye, Plus, Trash2, RefreshCw, History
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminSecurityDashboard = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [ipWhitelist, setIpWhitelist] = useState({ enabled: false, whitelist: [] });
  const [newIp, setNewIp] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [lockdownReason, setLockdownReason] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState(['withdrawals', 'registrations']);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/security/dashboard?admin_uid=${user.uid}`);
      setDashboard(response.data);
    } catch (error) {
      console.error('Error fetching security dashboard:', error);
    }
  }, [user.uid]);

  const fetchIpWhitelist = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/security/ip-whitelist?admin_uid=${user.uid}`);
      setIpWhitelist(response.data);
    } catch (error) {
      console.error('Error fetching IP whitelist:', error);
    }
  }, [user.uid]);

  const fetchAuditLogs = useCallback(async (page = 1) => {
    try {
      const response = await axios.get(`${API}/admin/security/audit-logs?admin_uid=${user.uid}&page=${page}&limit=20`);
      setAuditLogs(response.data.logs);
      setAuditTotal(response.data.total);
      setAuditPage(page);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  }, [user.uid]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchIpWhitelist(), fetchAuditLogs()]);
      setLoading(false);
    };
    loadData();
  }, [fetchDashboard, fetchIpWhitelist, fetchAuditLogs]);

  const handleAddIp = () => {
    if (!newIp.trim()) return;
    
    // Basic IP validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(newIp.trim())) {
      toast.error('Invalid IP format. Use: 192.168.1.1 or 192.168.1.0/24');
      return;
    }
    
    if (ipWhitelist.whitelist.includes(newIp.trim())) {
      toast.error('IP already in whitelist');
      return;
    }
    
    setIpWhitelist(prev => ({
      ...prev,
      whitelist: [...prev.whitelist, newIp.trim()]
    }));
    setNewIp('');
  };

  const handleRemoveIp = (ip) => {
    setIpWhitelist(prev => ({
      ...prev,
      whitelist: prev.whitelist.filter(i => i !== ip)
    }));
  };

  const handleSaveIpWhitelist = async () => {
    try {
      await axios.post(`${API}/admin/security/ip-whitelist`, null, {
        params: {
          admin_uid: user.uid,
          enabled: ipWhitelist.enabled,
          whitelist: ipWhitelist.whitelist
        },
        paramsSerializer: params => {
          const searchParams = new URLSearchParams();
          searchParams.append('admin_uid', params.admin_uid);
          searchParams.append('enabled', params.enabled);
          params.whitelist.forEach(ip => searchParams.append('whitelist', ip));
          return searchParams.toString();
        }
      });
      toast.success('IP Whitelist updated successfully');
      fetchDashboard();
    } catch (error) {
      toast.error('Failed to update IP whitelist');
    }
  };

  const handleActivateLockdown = async (type) => {
    if (!lockdownReason.trim()) {
      toast.error('Please provide a reason for lockdown');
      return;
    }

    try {
      await axios.post(`${API}/admin/security/lockdown`, null, {
        params: {
          admin_uid: user.uid,
          lockdown_type: type,
          reason: lockdownReason,
          locked_features: type === 'partial' ? selectedFeatures : undefined
        },
        paramsSerializer: params => {
          const searchParams = new URLSearchParams();
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
              if (Array.isArray(value)) {
                value.forEach(v => searchParams.append(key, v));
              } else {
                searchParams.append(key, value);
              }
            }
          });
          return searchParams.toString();
        }
      });
      toast.success(`${type === 'full' ? 'Full' : 'Partial'} lockdown activated`);
      fetchDashboard();
      setLockdownReason('');
    } catch (error) {
      toast.error('Failed to activate lockdown');
    }
  };

  const handleDeactivateLockdown = async () => {
    try {
      await axios.post(`${API}/admin/security/lockdown/deactivate?admin_uid=${user.uid}`);
      toast.success('Lockdown deactivated');
      fetchDashboard();
    } catch (error) {
      toast.error('Failed to deactivate lockdown');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionColor = (action) => {
    const colors = {
      login: 'bg-green-100 text-green-800',
      logout: 'bg-gray-100 text-gray-800',
      login_blocked_ip: 'bg-red-100 text-red-800',
      activate_lockdown: 'bg-red-100 text-red-800',
      deactivate_lockdown: 'bg-green-100 text-green-800',
      force_logout_all: 'bg-orange-100 text-orange-800',
      update_ip_whitelist: 'bg-blue-100 text-blue-800'
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-600" />
            Security Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Admin सुरक्षा व्यवस्थापन</p>
        </div>
        <Button onClick={() => { fetchDashboard(); fetchAuditLogs(); }} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'lockdown', label: 'Emergency Lockdown', icon: Lock },
          { id: 'ip-whitelist', label: 'IP Whitelist', icon: Globe },
          { id: 'audit-logs', label: 'Audit Logs', icon: History }
        ].map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? 'bg-purple-600' : ''}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboard && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Active Sessions</p>
                  <p className="text-3xl font-bold text-purple-900">{dashboard.active_admin_sessions}</p>
                </div>
                <Users className="w-10 h-10 text-purple-400" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Today's Logins</p>
                  <p className="text-3xl font-bold text-green-900">{dashboard.today_admin_logins}</p>
                </div>
                <Activity className="w-10 h-10 text-green-400" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">Failed Attempts</p>
                  <p className="text-3xl font-bold text-orange-900">{dashboard.failed_login_attempts_active}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-orange-400" />
              </div>
            </Card>

            <Card className={`p-4 ${dashboard.lockdown_status?.lockdown_active 
              ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' 
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${dashboard.lockdown_status?.lockdown_active ? 'text-red-600' : 'text-blue-600'}`}>
                    System Status
                  </p>
                  <p className={`text-xl font-bold ${dashboard.lockdown_status?.lockdown_active ? 'text-red-900' : 'text-blue-900'}`}>
                    {dashboard.lockdown_status?.lockdown_active ? '🔒 LOCKED' : '✅ Normal'}
                  </p>
                </div>
                {dashboard.lockdown_status?.lockdown_active 
                  ? <Lock className="w-10 h-10 text-red-400" />
                  : <ShieldCheck className="w-10 h-10 text-blue-400" />
                }
              </div>
            </Card>
          </div>

          {/* Security Settings Summary */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Security Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Session Timeout</p>
                <p className="text-lg font-bold">{dashboard.session_timeout_minutes} minutes</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Max Login Attempts</p>
                <p className="text-lg font-bold">{dashboard.rate_limit_login_attempts} per minute</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Token Expiry</p>
                <p className="text-lg font-bold">{dashboard.jwt_token_expiry_minutes} minutes</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">IP Whitelist</p>
                <p className={`text-lg font-bold ${dashboard.ip_whitelist_enabled ? 'text-green-600' : 'text-gray-500'}`}>
                  {dashboard.ip_whitelist_enabled ? `✅ Enabled (${dashboard.ip_whitelist_count} IPs)` : '❌ Disabled'}
                </p>
              </div>
            </div>
          </Card>

          {/* Recent Security Events */}
          {dashboard.recent_security_events?.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Recent Security Events
              </h2>
              <div className="space-y-2">
                {dashboard.recent_security_events.map((event, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(event.action)}`}>
                        {event.action}
                      </span>
                      <span className="ml-2 text-sm text-gray-600">{event.details?.reason || event.entity_type}</span>
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(event.timestamp)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Emergency Lockdown Tab */}
      {activeTab === 'lockdown' && (
        <div className="space-y-6">
          {/* Current Status */}
          <Card className={`p-6 ${dashboard?.lockdown_status?.lockdown_active 
            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' 
            : 'bg-gradient-to-r from-green-500 to-green-600 text-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  {dashboard?.lockdown_status?.lockdown_active ? (
                    <><ShieldAlert className="w-8 h-8" /> SYSTEM LOCKED</>
                  ) : (
                    <><ShieldCheck className="w-8 h-8" /> System Normal</>
                  )}
                </h2>
                {dashboard?.lockdown_status?.lockdown_active && (
                  <div className="mt-2 text-white/90">
                    <p>Type: {dashboard.lockdown_status.lockdown_type}</p>
                    <p>Reason: {dashboard.lockdown_status.lockdown_reason}</p>
                    <p>Since: {formatDate(dashboard.lockdown_status.lockdown_at)}</p>
                  </div>
                )}
              </div>
              {dashboard?.lockdown_status?.lockdown_active && (
                <Button 
                  onClick={handleDeactivateLockdown}
                  className="bg-white text-red-600 hover:bg-gray-100"
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Deactivate Lockdown
                </Button>
              )}
            </div>
          </Card>

          {/* Activate Lockdown */}
          {!dashboard?.lockdown_status?.lockdown_active && (
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-500" />
                Activate Emergency Lockdown
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Reason for Lockdown *</label>
                  <Input
                    placeholder="Enter reason (e.g., Security breach detected)"
                    value={lockdownReason}
                    onChange={(e) => setLockdownReason(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Features to Lock (Partial)</label>
                  <div className="flex flex-wrap gap-2">
                    {['withdrawals', 'registrations', 'mining', 'marketplace', 'gift_vouchers', 'bill_payments'].map(feature => (
                      <Button
                        key={feature}
                        variant={selectedFeatures.includes(feature) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setSelectedFeatures(prev => 
                            prev.includes(feature) 
                              ? prev.filter(f => f !== feature)
                              : [...prev, feature]
                          );
                        }}
                        className={selectedFeatures.includes(feature) ? 'bg-purple-600' : ''}
                      >
                        {feature.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button 
                    onClick={() => handleActivateLockdown('partial')}
                    className="bg-orange-500 hover:bg-orange-600"
                    disabled={!lockdownReason.trim() || selectedFeatures.length === 0}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Partial Lockdown
                  </Button>
                  <Button 
                    onClick={() => handleActivateLockdown('full')}
                    className="bg-red-500 hover:bg-red-600"
                    disabled={!lockdownReason.trim()}
                  >
                    <ShieldAlert className="w-4 h-4 mr-2" />
                    FULL Lockdown
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* IP Whitelist Tab */}
      {activeTab === 'ip-whitelist' && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            IP Whitelist Configuration
          </h2>

          <div className="space-y-4">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">Enable IP Whitelist</p>
                <p className="text-sm text-gray-600">Only allow admin access from whitelisted IPs</p>
              </div>
              <Button
                variant={ipWhitelist.enabled ? 'default' : 'outline'}
                onClick={() => setIpWhitelist(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={ipWhitelist.enabled ? 'bg-green-500 hover:bg-green-600' : ''}
              >
                {ipWhitelist.enabled ? '✅ Enabled' : 'Disabled'}
              </Button>
            </div>

            {/* Add IP */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter IP address (e.g., 192.168.1.1 or 192.168.1.0/24)"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddIp()}
              />
              <Button onClick={handleAddIp}>
                <Plus className="w-4 h-4 mr-2" />
                Add IP
              </Button>
            </div>

            {/* IP List */}
            <div className="border rounded-lg divide-y">
              {ipWhitelist.whitelist.length === 0 ? (
                <p className="p-4 text-center text-gray-500">No IPs whitelisted</p>
              ) : (
                ipWhitelist.whitelist.map((ip, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3">
                    <span className="font-mono">{ip}</span>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveIp(ip)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <Button onClick={handleSaveIpWhitelist} className="bg-purple-600 hover:bg-purple-700">
              Save IP Whitelist
            </Button>
          </div>
        </Card>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit-logs' && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-purple-500" />
            Admin Audit Logs
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Timestamp</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Entity</th>
                  <th className="px-4 py-3 text-left">IP Address</th>
                  <th className="px-4 py-3 text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {auditLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{formatDate(log.timestamp)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">{log.entity_type}</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.ip_address || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                      {JSON.stringify(log.details || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-600">Total: {auditTotal} logs</p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                disabled={auditPage <= 1}
                onClick={() => fetchAuditLogs(auditPage - 1)}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                disabled={auditPage * 20 >= auditTotal}
                onClick={() => fetchAuditLogs(auditPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminSecurityDashboard;
