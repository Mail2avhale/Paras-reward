import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Shield, ShieldAlert, ShieldCheck, Lock, Unlock, 
  Users, Activity, Globe, AlertTriangle, Clock,
  LogOut, Eye, Plus, Trash2, RefreshCw, History,
  Bell, BellRing, CheckCircle, XCircle, AlertOctagon
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
  const [activeTab, setActiveTab] = useState('alerts');
  
  // Security Alerts State
  const [alerts, setAlerts] = useState([]);
  const [alertsPage, setAlertsPage] = useState(1);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertFilter, setAlertFilter] = useState('all'); // all, unread, critical, high

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

  const fetchAlerts = useCallback(async (page = 1) => {
    try {
      let url = `${API}/admin/security/alerts?admin_uid=${user.uid}&page=${page}&limit=15`;
      if (alertFilter === 'unread') url += '&unread_only=true';
      if (alertFilter === 'critical') url += '&severity=critical';
      if (alertFilter === 'high') url += '&severity=high';
      
      const response = await axios.get(url);
      setAlerts(response.data.alerts);
      setAlertsTotal(response.data.total);
      setUnreadCount(response.data.unread_count);
      setAlertsPage(page);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, [user.uid, alertFilter]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/security/alerts/unread-count?admin_uid=${user.uid}`);
      setUnreadCount(response.data.unread_count);
      
      // Show toast for critical alerts
      if (response.data.critical_count > 0) {
        toast.error(`🚨 ${response.data.critical_count} Critical Security Alert(s)!`, {
          duration: 5000
        });
      } else if (response.data.high_count > 0) {
        toast.warning(`⚠️ ${response.data.high_count} High Priority Alert(s)`, {
          duration: 4000
        });
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [user.uid]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchIpWhitelist(), fetchAuditLogs(), fetchAlerts()]);
      setLoading(false);
    };
    loadData();
    
    // Poll for new alerts every 30 seconds
    const alertInterval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(alertInterval);
  }, [fetchDashboard, fetchIpWhitelist, fetchAuditLogs, fetchAlerts, fetchUnreadCount]);

  useEffect(() => {
    fetchAlerts(1);
  }, [alertFilter, fetchAlerts]);

  const handleMarkAlertsRead = async (alertIds = null, markAll = false) => {
    try {
      const params = new URLSearchParams();
      params.append('admin_uid', user.uid);
      if (markAll) params.append('mark_all', 'true');
      if (alertIds) alertIds.forEach(id => params.append('alert_ids', id));
      
      await axios.post(`${API}/admin/security/alerts/mark-read?${params.toString()}`);
      toast.success(markAll ? 'All alerts marked as read' : 'Alerts marked as read');
      fetchAlerts(alertsPage);
    } catch (error) {
      toast.error('Failed to mark alerts as read');
    }
  };

  const handleAddIp = () => {
    if (!newIp.trim()) return;
    
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
      fetchAlerts();
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

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getSeverityConfig = (severity) => {
    const configs = {
      critical: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-400', icon: AlertOctagon, label: '🔴 CRITICAL' },
      high: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-400', icon: AlertTriangle, label: '🟠 HIGH' },
      medium: { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-400', icon: AlertTriangle, label: '🟡 MEDIUM' },
      low: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-400', icon: Shield, label: '🔵 LOW' }
    };
    return configs[severity] || configs.low;
  };

  const getAlertTypeIcon = (type) => {
    const icons = {
      failed_login: '🔐',
      brute_force: '🚨',
      ip_blocked: '🚫',
      lockdown_activated: '🔒',
      suspicious_activity: '👀'
    };
    return icons[type] || '⚠️';
  };

  const getActionColor = (action) => {
    const colors = {
      login: 'bg-green-100 text-green-400',
      logout: 'bg-gray-800 text-gray-100',
      login_blocked_ip: 'bg-red-100 text-red-400',
      activate_lockdown: 'bg-red-100 text-red-400',
      deactivate_lockdown: 'bg-green-100 text-green-400',
      force_logout_all: 'bg-orange-100 text-orange-400',
      update_ip_whitelist: 'bg-blue-100 text-blue-400'
    };
    return colors[action] || 'bg-gray-800 text-gray-100';
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
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-600" />
            Security Dashboard
          </h1>
          <p className="text-gray-400 mt-1">Admin सुरक्षा व्यवस्थापन</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Alert Badge */}
          {unreadCount > 0 && (
            <div className="relative">
              <Button 
                variant="outline" 
                className="border-red-300 text-red-600"
                onClick={() => setActiveTab('alerts')}
              >
                <BellRing className="w-5 h-5 mr-2 animate-pulse" />
                {unreadCount} Unread
              </Button>
            </div>
          )}
          <Button onClick={() => { fetchDashboard(); fetchAlerts(); fetchAuditLogs(); }} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2 flex-wrap">
        {[
          { id: 'alerts', label: `🔔 Alerts ${unreadCount > 0 ? `(${unreadCount})` : ''}`, icon: Bell },
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'lockdown', label: 'Emergency Lockdown', icon: Lock },
          { id: 'ip-whitelist', label: 'IP Whitelist', icon: Globe },
          { id: 'audit-logs', label: 'Audit Logs', icon: History }
        ].map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            onClick={() => setActiveTab(tab.id)}
            className={`${activeTab === tab.id ? 'bg-purple-600' : ''} ${tab.id === 'alerts' && unreadCount > 0 ? 'animate-pulse' : ''}`}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Alert Filters */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'All Alerts' },
                { id: 'unread', label: 'Unread' },
                { id: 'critical', label: '🔴 Critical' },
                { id: 'high', label: '🟠 High' }
              ].map(filter => (
                <Button
                  key={filter.id}
                  variant={alertFilter === filter.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAlertFilter(filter.id)}
                  className={alertFilter === filter.id ? 'bg-purple-600' : ''}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => handleMarkAlertsRead(null, true)}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark All Read
              </Button>
            )}
          </div>

          {/* Alert List */}
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <Card className="p-8 text-center">
                <ShieldCheck className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-400">No security alerts</p>
                <p className="text-sm text-gray-400">System is secure ✓</p>
              </Card>
            ) : (
              alerts.map(alert => {
                const config = getSeverityConfig(alert.severity);
                return (
                  <Card 
                    key={alert.alert_id} 
                    className={`p-4 border-l-4 ${config.border} ${!alert.is_read ? config.bg : 'bg-gray-900'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{getAlertTypeIcon(alert.alert_type)}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${config.bg} ${config.text}`}>
                            {config.label}
                          </span>
                          {!alert.is_read && (
                            <span className="text-xs bg-purple-100 text-purple-400 px-2 py-0.5 rounded font-medium">
                              NEW
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-white">{alert.title}</h3>
                        <p className="text-sm text-gray-400 mt-1">{alert.message}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>📍 IP: {alert.ip_address || 'N/A'}</span>
                          <span>⏰ {getTimeAgo(alert.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs text-gray-400">{formatDate(alert.created_at)}</span>
                        {!alert.is_read && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleMarkAlertsRead([alert.alert_id])}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {alertsTotal > 15 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Total: {alertsTotal} alerts</p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={alertsPage <= 1}
                  onClick={() => fetchAlerts(alertsPage - 1)}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={alertsPage * 15 >= alertsTotal}
                  onClick={() => fetchAlerts(alertsPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboard && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Active Sessions</p>
                  <p className="text-3xl font-bold text-purple-900">{dashboard.active_admin_sessions}</p>
                </div>
                <Users className="w-10 h-10 text-purple-400" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Today's Logins</p>
                  <p className="text-3xl font-bold text-green-900">{dashboard.today_admin_logins}</p>
                </div>
                <Activity className="w-10 h-10 text-green-400" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">Unread Alerts</p>
                  <p className="text-3xl font-bold text-orange-900">{unreadCount}</p>
                </div>
                <Bell className="w-10 h-10 text-orange-400" />
              </div>
            </Card>

            <Card className={`p-4 ${dashboard.lockdown_status?.lockdown_active 
              ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-500/30' 
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-500/30'}`}>
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
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <p className="text-sm text-gray-400">Session Timeout</p>
                <p className="text-lg font-bold">{dashboard.session_timeout_minutes} minutes</p>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <p className="text-sm text-gray-400">Max Login Attempts</p>
                <p className="text-lg font-bold">{dashboard.rate_limit_login_attempts} per minute</p>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <p className="text-sm text-gray-400">Token Expiry</p>
                <p className="text-lg font-bold">{dashboard.jwt_token_expiry_minutes} minutes</p>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <p className="text-sm text-gray-400">IP Whitelist</p>
                <p className={`text-lg font-bold ${dashboard.ip_whitelist_enabled ? 'text-green-600' : 'text-gray-500'}`}>
                  {dashboard.ip_whitelist_enabled ? `✅ Enabled (${dashboard.ip_whitelist_count} IPs)` : '❌ Disabled'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Emergency Lockdown Tab */}
      {activeTab === 'lockdown' && (
        <div className="space-y-6">
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
                  className="bg-gray-900 text-red-600 hover:bg-gray-800"
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Deactivate Lockdown
                </Button>
              )}
            </div>
          </Card>

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
                    className="bg-orange-500/100 hover:bg-orange-600"
                    disabled={!lockdownReason.trim() || selectedFeatures.length === 0}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Partial Lockdown
                  </Button>
                  <Button 
                    onClick={() => handleActivateLockdown('full')}
                    className="bg-red-500/100 hover:bg-red-600"
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
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
              <div>
                <p className="font-medium">Enable IP Whitelist</p>
                <p className="text-sm text-gray-400">Only allow admin access from whitelisted IPs</p>
              </div>
              <Button
                variant={ipWhitelist.enabled ? 'default' : 'outline'}
                onClick={() => setIpWhitelist(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={ipWhitelist.enabled ? 'bg-green-500/100 hover:bg-green-600' : ''}
              >
                {ipWhitelist.enabled ? '✅ Enabled' : 'Disabled'}
              </Button>
            </div>

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
              <thead className="bg-gray-800/50">
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
                  <tr key={idx} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-400">{formatDate(log.timestamp)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">{log.entity_type}</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.ip_address || '-'}</td>
                    <td className="px-4 py-3 text-gray-400 max-w-xs truncate">
                      {JSON.stringify(log.details || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-400">Total: {auditTotal} logs</p>
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
