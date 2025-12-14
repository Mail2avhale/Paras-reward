import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, Settings, Percent, DollarSign, Save } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminServiceCharges = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [billPaymentConfig, setBillPaymentConfig] = useState({
    charge_type: 'percentage',
    charge_percentage: 2.0,
    charge_fixed: 20.0
  });
  const [giftVoucherConfig, setGiftVoucherConfig] = useState({
    charge_type: 'percentage',
    charge_percentage: 5.0,
    charge_fixed: 50.0
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin');
      return;
    }
    fetchConfig();
  }, [user, navigate]);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/service-charges`);
      setBillPaymentConfig(response.data.bill_payment);
      setGiftVoucherConfig(response.data.gift_voucher);
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const handleSave = async (serviceType) => {
    setLoading(true);
    try {
      const config = serviceType === 'bill_payment' ? billPaymentConfig : giftVoucherConfig;
      
      await axios.post(`${API}/api/admin/service-charges`, {
        service_type: serviceType,
        charge_type: config.charge_type,
        charge_percentage: parseFloat(config.charge_percentage),
        charge_fixed: parseFloat(config.charge_fixed)
      });

      toast.success(`${serviceType === 'bill_payment' ? 'Bill Payment' : 'Gift Voucher'} service charge updated!`);
      fetchConfig();
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Failed to update service charge');
    } finally {
      setLoading(false);
    }
  };

  const calculateExample = (baseAmount, config) => {
    if (config.charge_type === 'percentage') {
      return (baseAmount * config.charge_percentage) / 100;
    }
    return config.charge_fixed;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="h-8 w-8" />
              Service Charges Configuration
            </h1>
            <p className="text-sm text-gray-600 mt-1">Configure service charges for bill payments and gift vouchers</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Bill Payment Service Charge */}
          <Card className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Bill Payment & Recharge</h2>
            
            <div className="space-y-4">
              {/* Charge Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Charge Type</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setBillPaymentConfig({ ...billPaymentConfig, charge_type: 'percentage' })}
                    className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                      billPaymentConfig.charge_type === 'percentage'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Percent className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                    <p className="font-semibold">Percentage</p>
                    <p className="text-xs text-gray-600">% of PRC amount</p>
                  </button>
                  <button
                    onClick={() => setBillPaymentConfig({ ...billPaymentConfig, charge_type: 'fixed' })}
                    className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                      billPaymentConfig.charge_type === 'fixed'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-600" />
                    <p className="font-semibold">Fixed</p>
                    <p className="text-xs text-gray-600">Fixed PRC amount</p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Percentage (%)
                  </label>
                  <Input
                    type="number"
                    value={billPaymentConfig.charge_percentage}
                    onChange={(e) => setBillPaymentConfig({ ...billPaymentConfig, charge_percentage: e.target.value })}
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={billPaymentConfig.charge_type !== 'percentage'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fixed Amount (PRC)
                  </label>
                  <Input
                    type="number"
                    value={billPaymentConfig.charge_fixed}
                    onChange={(e) => setBillPaymentConfig({ ...billPaymentConfig, charge_fixed: e.target.value })}
                    min="0"
                    step="1"
                    disabled={billPaymentConfig.charge_type !== 'fixed'}
                  />
                </div>
              </div>

              {/* Example Calculation */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-900 mb-2">Example Calculation</p>
                <p className="text-sm text-gray-700">
                  For a ₹100 recharge (1000 PRC):
                </p>
                <p className="text-lg font-bold text-blue-700 mt-1">
                  Service Charge = {calculateExample(1000, billPaymentConfig).toFixed(2)} PRC
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Total = {(1000 + calculateExample(1000, billPaymentConfig)).toFixed(2)} PRC
                </p>
              </div>

              <Button
                onClick={() => handleSave('bill_payment')}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Bill Payment Config
              </Button>
            </div>
          </Card>

          {/* Gift Voucher Service Charge */}
          <Card className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Gift Voucher Redemption</h2>
            
            <div className="space-y-4">
              {/* Charge Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Charge Type</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setGiftVoucherConfig({ ...giftVoucherConfig, charge_type: 'percentage' })}
                    className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                      giftVoucherConfig.charge_type === 'percentage'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Percent className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                    <p className="font-semibold">Percentage</p>
                    <p className="text-xs text-gray-600">% of PRC amount</p>
                  </button>
                  <button
                    onClick={() => setGiftVoucherConfig({ ...giftVoucherConfig, charge_type: 'fixed' })}
                    className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                      giftVoucherConfig.charge_type === 'fixed'
                        ? 'border-pink-500 bg-pink-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <DollarSign className="h-6 w-6 mx-auto mb-2 text-pink-600" />
                    <p className="font-semibold">Fixed</p>
                    <p className="text-xs text-gray-600">Fixed PRC amount</p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Percentage (%)
                  </label>
                  <Input
                    type="number"
                    value={giftVoucherConfig.charge_percentage}
                    onChange={(e) => setGiftVoucherConfig({ ...giftVoucherConfig, charge_percentage: e.target.value })}
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={giftVoucherConfig.charge_type !== 'percentage'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fixed Amount (PRC)
                  </label>
                  <Input
                    type="number"
                    value={giftVoucherConfig.charge_fixed}
                    onChange={(e) => setGiftVoucherConfig({ ...giftVoucherConfig, charge_fixed: e.target.value })}
                    min="0"
                    step="1"
                    disabled={giftVoucherConfig.charge_type !== 'fixed'}
                  />
                </div>
              </div>

              {/* Example Calculation */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-900 mb-2">Example Calculation</p>
                <p className="text-sm text-gray-700">
                  For a ₹100 voucher (1000 PRC):
                </p>
                <p className="text-lg font-bold text-purple-700 mt-1">
                  Service Charge = {calculateExample(1000, giftVoucherConfig).toFixed(2)} PRC
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Total = {(1000 + calculateExample(1000, giftVoucherConfig)).toFixed(2)} PRC
                </p>
              </div>

              <Button
                onClick={() => handleSave('gift_voucher')}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Gift Voucher Config
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminServiceCharges;
