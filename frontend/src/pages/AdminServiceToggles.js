import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Smartphone, Tv, Zap, CreditCard, Building, Gift, ShoppingBag, 
  Banknote, RefreshCw, Loader2, AlertTriangle, CheckCircle, XCircle,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminServiceToggles = ({ user }) => {
  const [services, setServices] = useState({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const navigate = useNavigate();

  const serviceIcons = {
    mobile_recharge: Smartphone,
    dish_recharge: Tv,
    electricity_bill: Zap,
    credit_card_payment: CreditCard,
    loan_emi: Building,
    gift_voucher: Gift,
    shopping: ShoppingBag,
    bank_redeem: Banknote
  };

  const serviceColors = {
    mobile_recharge: 'blue',
    dish_recharge: 'purple',
    electricity_bill: 'yellow',
    credit_card_payment: 'green',
    loan_emi: 'red',
    gift_voucher: 'pink',
    shopping: 'orange',
    bank_redeem: 'emerald'
  };

  useEffect(() => {
    fetchServices();
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

  const toggleService = async (serviceKey, currentStatus) => {
    setToggling(serviceKey);
    try {
      const response = await axios.post(`${API}/admin/service-toggles/${serviceKey}`, {
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/admin')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Service Management</h1>
              <p className="text-gray-400 text-sm">Enable or disable services temporarily</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchServices}
            className="border-gray-700"
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
                className={`p-4 bg-gray-900 border-gray-800 ${!isEnabled ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${color}-500/20`}>
                      <Icon className={`w-5 h-5 text-${color}-400`} />
                    </div>
                    <div>
                      <p className="text-white font-medium">{service.name}</p>
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
          <p className="text-center text-gray-500 text-sm mt-6">
            Last updated: {new Date(updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminServiceToggles;
