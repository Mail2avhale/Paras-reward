import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, Save, Settings, Award, Cpu, ToggleLeft,
  DollarSign, Users, CheckCircle, XCircle, AlertCircle,
  TrendingUp, Percent, Clock
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminSystemSettings = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('vip-plans');
  
  // Registration Control State
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationMessage, setRegistrationMessage] = useState('New user registrations are currently closed.');
  const [loadingRegistration, setLoadingRegistration] = useState(false);

  // VIP Plans State
  const [vipPlans, setVipPlans] = useState({
    monthly: { price: 299, duration: 30, discount: 0 },
    quarterly: { price: 897, duration: 90, discount: 0 },
    half_yearly: { price: 1794, duration: 180, discount: 0 },
    yearly: { price: 3588, duration: 365, discount: 0 }
  });

  // Mining Formula State
  const [miningSettings, setMiningSettings] = useState({
    base_rate: 0.5,
    referral_bonus_percent: 10,
    vip_multiplier: 2,
    max_daily_mining_hours: 24,
    prc_to_inr_ratio: 10
  });

  // Service Charges State
  const [serviceCharges, setServiceCharges] = useState({
    bill_payment_charge_type: 'percentage',
    bill_payment_charge_percentage: 2,
    bill_payment_charge_fixed: 20,
    gift_voucher_charge_type: 'percentage',
    gift_voucher_charge_percentage: 5,
    gift_voucher_charge_fixed: 50,
    withdrawal_charge_percentage: 0,
    delivery_charge_vip: 50,
    delivery_charge_free: 100
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchAllSettings();
  }, [user, navigate]);

  const fetchAllSettings = async () => {
    setLoading(true);
    try {
      // Fetch registration status
      const regResponse = await axios.get(`${API}/api/admin/registration-status`);
      setRegistrationEnabled(regResponse.data.registration_enabled || false);
      setRegistrationMessage(regResponse.data.registration_message || '');

      // Fetch VIP plans
      try {
        const vipResponse = await axios.get(`${API}/api/admin/vip-plans`);
        if (vipResponse.data) {
          setVipPlans(prev => ({ ...prev, ...vipResponse.data }));
        }
      } catch (e) { console.log('VIP plans not found, using defaults'); }

      // Fetch service charges
      try {
        const chargesResponse = await axios.get(`${API}/api/admin/service-charges-settings`);
        if (chargesResponse.data) {
          setServiceCharges(prev => ({ ...prev, ...chargesResponse.data }));
        }
      } catch (e) { console.log('Service charges not found, using defaults'); }

    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRegistration = async () => {
    setLoadingRegistration(true);
    try {
      await axios.post(`${API}/api/admin/toggle-registration`, {
        enabled: !registrationEnabled,
        message: registrationMessage
      });
      setRegistrationEnabled(!registrationEnabled);
      toast.success(`Registration ${!registrationEnabled ? 'enabled' : 'disabled'} successfully!`);
    } catch (error) {
      toast.error('Failed to update registration status');
    } finally {
      setLoadingRegistration(false);
    }
  };

  const handleSaveVIPPlans = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/admin/vip-plans/update`, vipPlans);
      toast.success('VIP Plans updated successfully!');
    } catch (error) {
      toast.error('Failed to save VIP plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServiceCharges = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/admin/service-charges/update`, serviceCharges);
      toast.success('Service charges updated successfully!');
    } catch (error) {
      toast.error('Failed to save service charges');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'vip-plans', label: 'VIP Plans', icon: Award },
    { id: 'mining', label: 'Mining Formula', icon: Cpu },
    { id: 'registration', label: 'Registration Control', icon: Users },
    { id: 'service-charges', label: 'Service Charges', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate('/admin')} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="h-6 w-6 text-purple-600" />
              System Settings
            </h1>
            <p className="text-sm text-gray-500">Manage VIP plans, mining formula, registration & service charges</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-lg shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* VIP Plans Tab */}
        {activeTab === 'vip-plans' && (
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-600" />
              VIP Membership Plans
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(vipPlans).map(([key, plan]) => (
                <div key={key} className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold capitalize mb-3">{key.replace('_', ' ')} Plan</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600">Price (₹)</label>
                      <input
                        type="number"
                        value={plan.price}
                        onChange={(e) => setVipPlans(prev => ({
                          ...prev,
                          [key]: { ...prev[key], price: Number(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Duration (days)</label>
                      <input
                        type="number"
                        value={plan.duration}
                        onChange={(e) => setVipPlans(prev => ({
                          ...prev,
                          [key]: { ...prev[key], duration: Number(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Discount (%)</label>
                      <input
                        type="number"
                        value={plan.discount}
                        onChange={(e) => setVipPlans(prev => ({
                          ...prev,
                          [key]: { ...prev[key], discount: Number(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveVIPPlans} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save VIP Plans
              </Button>
            </div>
          </Card>
        )}

        {/* Mining Formula Tab */}
        {activeTab === 'mining' && (
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-blue-600" />
              Mining Formula Settings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Base Mining Rate (PRC/hour)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={miningSettings.base_rate}
                  onChange={(e) => setMiningSettings(prev => ({ ...prev, base_rate: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Referral Bonus (%)
                </label>
                <input
                  type="number"
                  value={miningSettings.referral_bonus_percent}
                  onChange={(e) => setMiningSettings(prev => ({ ...prev, referral_bonus_percent: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  VIP Multiplier
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={miningSettings.vip_multiplier}
                  onChange={(e) => setMiningSettings(prev => ({ ...prev, vip_multiplier: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Max Daily Mining Hours
                </label>
                <input
                  type="number"
                  value={miningSettings.max_daily_mining_hours}
                  onChange={(e) => setMiningSettings(prev => ({ ...prev, max_daily_mining_hours: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  PRC to INR Ratio (PRC per ₹1)
                </label>
                <input
                  type="number"
                  value={miningSettings.prc_to_inr_ratio}
                  onChange={(e) => setMiningSettings(prev => ({ ...prev, prc_to_inr_ratio: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg mt-1"
                />
              </div>
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Mining Formula:</strong> Rate = Base Rate × (1 + Referral Bonus × Active Referrals) × VIP Multiplier
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => toast.success('Mining settings saved!')} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Mining Settings
              </Button>
            </div>
          </Card>
        )}

        {/* Registration Control Tab */}
        {activeTab === 'registration' && (
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              Registration Control
            </h2>
            
            {/* Status Card */}
            <div className={`p-4 rounded-lg border-2 mb-6 ${
              registrationEnabled ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-3">
                {registrationEnabled ? (
                  <>
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <div>
                      <span className="font-semibold text-green-900">Registration ENABLED</span>
                      <p className="text-sm text-green-700">New users can register on the platform.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-6 w-6 text-red-600" />
                    <div>
                      <span className="font-semibold text-red-900">Registration DISABLED</span>
                      <p className="text-sm text-red-700">New registrations are blocked.</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Button
              onClick={handleToggleRegistration}
              disabled={loadingRegistration}
              className={registrationEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
            >
              {registrationEnabled ? (
                <><XCircle className="h-4 w-4 mr-2" /> Disable Registration</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" /> Enable Registration</>
              )}
            </Button>

            <div className="mt-6">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4" />
                Custom Message (shown when disabled)
              </label>
              <textarea
                value={registrationMessage}
                onChange={(e) => setRegistrationMessage(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Message to show when registration is disabled..."
              />
            </div>
          </Card>
        )}

        {/* Service Charges Tab */}
        {activeTab === 'service-charges' && (
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-yellow-600" />
              Service Charges
            </h2>
            
            <div className="space-y-6">
              {/* Bill Payment Charges */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Bill Payment Charges</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Charge Type</label>
                    <select
                      value={serviceCharges.bill_payment_charge_type}
                      onChange={(e) => setServiceCharges(prev => ({ ...prev, bill_payment_charge_type: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Percentage (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={serviceCharges.bill_payment_charge_percentage}
                      onChange={(e) => setServiceCharges(prev => ({ ...prev, bill_payment_charge_percentage: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Fixed Amount (PRC)</label>
                    <input
                      type="number"
                      value={serviceCharges.bill_payment_charge_fixed}
                      onChange={(e) => setServiceCharges(prev => ({ ...prev, bill_payment_charge_fixed: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Gift Voucher Charges */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Gift Voucher Charges</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Charge Type</label>
                    <select
                      value={serviceCharges.gift_voucher_charge_type}
                      onChange={(e) => setServiceCharges(prev => ({ ...prev, gift_voucher_charge_type: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Percentage (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={serviceCharges.gift_voucher_charge_percentage}
                      onChange={(e) => setServiceCharges(prev => ({ ...prev, gift_voucher_charge_percentage: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Fixed Amount (PRC)</label>
                    <input
                      type="number"
                      value={serviceCharges.gift_voucher_charge_fixed}
                      onChange={(e) => setServiceCharges(prev => ({ ...prev, gift_voucher_charge_fixed: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Charges */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Delivery Charges</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">VIP Users (₹)</label>
                    <input
                      type="number"
                      value={serviceCharges.delivery_charge_vip}
                      onChange={(e) => setServiceCharges(prev => ({ ...prev, delivery_charge_vip: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Free Users (₹)</label>
                    <input
                      type="number"
                      value={serviceCharges.delivery_charge_free}
                      onChange={(e) => setServiceCharges(prev => ({ ...prev, delivery_charge_free: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveServiceCharges} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Service Charges
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminSystemSettings;
