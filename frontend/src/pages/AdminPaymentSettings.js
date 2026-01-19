import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, Save, CreditCard, Upload, Image, X, 
  Building, QrCode, Wallet, IndianRupee, FileText
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminPaymentSettings = ({ user }) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const qrInputRef = useRef(null);

  // Payment Config State
  const [paymentConfig, setPaymentConfig] = useState({
    upi_id: '',
    qr_code_url: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    account_holder: '',
    instructions: ''
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchPaymentConfig();
  }, [user, navigate]);

  const fetchPaymentConfig = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/payment-config`);
      if (response.data) {
        setPaymentConfig({
          upi_id: response.data.upi_id || '',
          qr_code_url: response.data.qr_code_url || '',
          bank_name: response.data.bank_name || '',
          account_number: response.data.account_number || '',
          ifsc_code: response.data.ifsc_code || '',
          account_holder: response.data.account_holder || '',
          instructions: response.data.instructions || ''
        });
      }
    } catch (error) {
      console.error('Error fetching payment config:', error);
    }
  };

  const handlePaymentConfigChange = (field, value) => {
    setPaymentConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSavePaymentConfig = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/api/admin/payment-config`, paymentConfig);
      toast.success('Payment settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save payment settings');
    } finally {
      setSaving(false);
    }
  };

  const handleQRUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploadingQR(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/api/upload/qr-code`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.url) {
        setPaymentConfig(prev => ({ ...prev, qr_code_url: response.data.url }));
        toast.success('QR code uploaded successfully!');
      }
    } catch (error) {
      toast.error('Failed to upload QR code');
    } finally {
      setUploadingQR(false);
      if (qrInputRef.current) {
        qrInputRef.current.value = '';
      }
    }
  };

  const removeQRCode = () => {
    setPaymentConfig(prev => ({ ...prev, qr_code_url: '' }));
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/settings-hub')}
              className="flex items-center gap-2 bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              All Settings
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-amber-500" />
                Payment Settings
              </h1>
              <p className="text-gray-500 text-sm">Configure payment methods for subscriptions</p>
            </div>
          </div>
        </div>

        {/* UPI Payment Settings */}
        <Card className="p-6 shadow-xl bg-gray-900/50 border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">UPI Payment</h2>
              <p className="text-gray-500 text-sm">Accept payments via UPI</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* UPI ID */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">UPI ID</label>
              <input
                type="text"
                placeholder="yourname@upi"
                value={paymentConfig.upi_id}
                onChange={(e) => handlePaymentConfigChange('upi_id', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* QR Code Upload */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Payment QR Code</label>
              {paymentConfig.qr_code_url ? (
                <div className="relative inline-block">
                  <img 
                    src={paymentConfig.qr_code_url} 
                    alt="Payment QR" 
                    className="h-32 w-32 object-contain bg-gray-900 rounded-xl p-2"
                  />
                  <button
                    onClick={removeQRCode}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500/10 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    ref={qrInputRef}
                    onChange={handleQRUpload}
                    accept="image/*"
                    className="hidden"
                    id="qr-upload"
                  />
                  <label
                    htmlFor="qr-upload"
                    className="flex items-center gap-2 px-4 py-3 bg-gray-800 border border-dashed border-gray-600 rounded-xl cursor-pointer hover:bg-gray-750 transition-colors"
                  >
                    {uploadingQR ? (
                      <span className="text-gray-400">Uploading...</span>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-400">Upload QR Code</span>
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Bank Transfer Settings */}
        <Card className="p-6 shadow-xl mt-6 bg-gray-900/50 border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Building className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">Bank Transfer</h2>
              <p className="text-gray-500 text-sm">Accept payments via bank transfer</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Account Holder Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={paymentConfig.account_holder}
                onChange={(e) => handlePaymentConfigChange('account_holder', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Bank Name</label>
              <input
                type="text"
                placeholder="State Bank of India"
                value={paymentConfig.bank_name}
                onChange={(e) => handlePaymentConfigChange('bank_name', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Account Number</label>
              <input
                type="text"
                placeholder="1234567890"
                value={paymentConfig.account_number}
                onChange={(e) => handlePaymentConfigChange('account_number', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">IFSC Code</label>
              <input
                type="text"
                placeholder="SBIN0001234"
                value={paymentConfig.ifsc_code}
                onChange={(e) => handlePaymentConfigChange('ifsc_code', e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </Card>

        {/* Payment Instructions */}
        <Card className="p-6 shadow-xl mt-6 bg-gray-900/50 border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">Payment Instructions</h2>
              <p className="text-gray-500 text-sm">Instructions shown to users during payment</p>
            </div>
          </div>

          <textarea
            placeholder="Enter payment instructions for users..."
            value={paymentConfig.instructions}
            onChange={(e) => handlePaymentConfigChange('instructions', e.target.value)}
            rows={4}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
          />
        </Card>

        {/* Preview Card */}
        {(paymentConfig.upi_id || paymentConfig.account_number) && (
          <Card className="p-6 shadow-xl mt-6 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
            <h3 className="text-lg font-bold text-amber-400 mb-4">Preview - Users will see:</h3>
            <div className="text-gray-300 space-y-2">
              {paymentConfig.upi_id && (
                <p className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-purple-400" />
                  <span className="text-gray-500">UPI:</span> {paymentConfig.upi_id}
                </p>
              )}
              {paymentConfig.account_number && (
                <>
                  <p className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-500">Bank:</span> {paymentConfig.bank_name}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-gray-500 ml-6">A/C:</span> {paymentConfig.account_number}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-gray-500 ml-6">IFSC:</span> {paymentConfig.ifsc_code}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-gray-500 ml-6">Name:</span> {paymentConfig.account_holder}
                  </p>
                </>
              )}
            </div>
          </Card>
        )}

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSavePaymentConfig}
            disabled={saving}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 py-3 text-lg rounded-xl"
          >
            <Save className="h-5 w-5 mr-2" />
            {saving ? 'Saving...' : 'Save Payment Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminPaymentSettings;
