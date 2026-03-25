import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Smartphone, Tv, Zap, CreditCard, Building, Gift, ShoppingBag, 
  Banknote, RefreshCw, Loader2, AlertTriangle, CheckCircle, XCircle,
  ArrowLeft, Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminServiceToggles = ({ user }) => {
  const [services, setServices] = useState({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const navigate = useNavigate();
  
  // DMT Limits State
  const [dmtLimits, setDmtLimits] = useState({
    daily_limit: 25000,
    weekly_limit: 100000,
    monthly_limit: 200000,
    per_txn_limit: 25000,
    min_amount: 100
  });
  const [savingLimits, setSavingLimits] = useState(false);

  const serviceIcons = {
    mobile_recharge: Smartphone,
    dish_recharge: Tv,
    electricity_bill: Zap,
    credit_card_payment: CreditCard,
    loan_emi: Building,
    gift_voucher: Gift,
    shopping: ShoppingBag,
    bank_redeem: Banknote,
    dmt: Send
  };

  const serviceColors = {
    mobile_recharge: 'blue',
    dish_recharge: 'purple',
    electricity_bill: 'yellow',
    credit_card_payment: 'green',
    loan_emi: 'red',
    gift_voucher: 'pink',
    shopping: 'orange',
    bank_redeem: 'emerald',
    dmt: 'cyan'
  };

  useEffect(() => {
    fetchServices();
    fetchDmtLimits();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/admin/service-toggles`);
      setServices(response.data.services || {});
      setUpdatedAt(response.data.updated_at);
    } catch (error) {
      toast.error('Failed to load service status');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchDmtLimits = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/dmt-limits`);
      if (response.data.success && response.data.limits) {
        setDmtLimits(response.data.limits);
      }
    } catch (error) {
      console.error('Failed to load DMT limits');
    }
  };
  
  const saveDmtLimits = async () => {
    setSavingLimits(true);
    try {
      const response = await axios.put(`${API}/api/admin/dmt-limits`, {
        ...dmtLimits,
        admin_id: user?.uid
      });
      if (response.data.success) {
        toast.success('DMT limits saved successfully');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save DMT limits');
    } finally {
      setSavingLimits(false);
    }
  };

  const toggleService = async (serviceKey, currentStatus) => {
    setToggling(serviceKey);
    try {
      const response = await axios.post(`${API}/api/admin/service-toggles/${serviceKey}`, {
        enabled: !currentStatus,
        admin_id: user?.uid
      });
      
      // Update local state
      setServices(prev => ({
        ...prev,
        [serviceKey]: {
          ...prev[serviceKey],
          enabled: !currentStatus
        }
      }));
      
      const status = !currentStatus ? 'enabled' : 'disabled';
      toast.success(`✅ ${services[serviceKey]?.name} has been ${status}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to toggle service');
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/admin')}
              className="text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Service Management</h1>
              <p className="text-slate-500 text-sm">Enable or disable services temporarily</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchServices}
            className="border-slate-200"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Warning Card */}
        <Card className="p-4 mb-6 bg-amber-500/10 border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 font-medium">Important</p>
              <p className="text-amber-400/70 text-sm">
                Disabling a service will prevent users from creating new requests. Existing pending requests will still be processed.
              </p>
            </div>
          </div>
        </Card>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(services).map(([key, service]) => {
            const Icon = serviceIcons[key] || Smartphone;
            const color = serviceColors[key] || 'blue';
            const isEnabled = service.enabled;
            
            return (
              <Card 
                key={key} 
                className={`p-4 bg-white border-slate-200 ${!isEnabled ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${color}-500/20`}>
                      <Icon className={`w-5 h-5 text-${color}-400`} />
                    </div>
                    <div>
                      <p className="text-slate-800 font-medium">{service.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {isEnabled ? (
                          <span className="flex items-center text-xs text-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center text-xs text-red-400">
                            <XCircle className="w-3 h-3 mr-1" />
                            Disabled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {toggling === key ? (
                      <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                    ) : (
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleService(key, isEnabled)}
                        className="data-[state=checked]:bg-green-500"
                      />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Last Updated */}
        {updatedAt && (
          <p className="text-center text-slate-500 text-sm mt-6">
            Last updated: {new Date(updatedAt).toLocaleString()}
          </p>
        )}
        
        {/* DMT Limits Section */}
        <Card className="mt-8 p-6 bg-white border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Send className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">DMT Global Limits</h2>
              <p className="text-slate-500 text-sm">Set transfer limits for all users</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Daily Limit */}
            <div>
              <label className="block text-slate-500 text-sm mb-2">Daily Limit (₹)</label>
              <input
                type="number"
                value={dmtLimits.daily_limit}
                onChange={(e) => setDmtLimits(prev => ({...prev, daily_limit: parseInt(e.target.value) || 0}))}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            {/* Weekly Limit */}
            <div>
              <label className="block text-slate-500 text-sm mb-2">Weekly Limit (₹)</label>
              <input
                type="number"
                value={dmtLimits.weekly_limit}
                onChange={(e) => setDmtLimits(prev => ({...prev, weekly_limit: parseInt(e.target.value) || 0}))}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            {/* Monthly Limit */}
            <div>
              <label className="block text-slate-500 text-sm mb-2">Monthly Limit (₹)</label>
              <input
                type="number"
                value={dmtLimits.monthly_limit}
                onChange={(e) => setDmtLimits(prev => ({...prev, monthly_limit: parseInt(e.target.value) || 0}))}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            {/* Per Transaction Limit */}
            <div>
              <label className="block text-slate-500 text-sm mb-2">Per Transaction Limit (₹)</label>
              <input
                type="number"
                value={dmtLimits.per_txn_limit}
                onChange={(e) => setDmtLimits(prev => ({...prev, per_txn_limit: parseInt(e.target.value) || 0}))}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            {/* Min Amount */}
            <div>
              <label className="block text-slate-500 text-sm mb-2">Minimum Amount (₹)</label>
              <input
                type="number"
                value={dmtLimits.min_amount}
                onChange={(e) => setDmtLimits(prev => ({...prev, min_amount: parseInt(e.target.value) || 0}))}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button 
              onClick={saveDmtLimits}
              disabled={savingLimits}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {savingLimits ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save DMT Limits'
              )}
            </Button>
          </div>
          
          {dmtLimits.updated_at && (
            <p className="text-slate-500 text-xs mt-4">
              Last updated: {new Date(dmtLimits.updated_at).toLocaleString()}
              {dmtLimits.updated_by && ` by ${dmtLimits.updated_by}`}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminServiceToggles;
