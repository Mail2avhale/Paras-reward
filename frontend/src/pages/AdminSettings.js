import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Facebook, Twitter, Instagram, Linkedin, Youtube, Send, MessageCircle, Save, ArrowLeft, Users, CheckCircle, XCircle, AlertCircle, Upload, Image, ShoppingCart, IndianRupee, Coins, Truck } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminSettings = ({ user }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [socialMedia, setSocialMedia] = useState({
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    youtube: '',
    telegram: '',
    whatsapp: ''
  });
  
  // Registration Control State
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationMessage, setRegistrationMessage] = useState('New user registrations are currently closed. Please check back later.');
  const [loadingRegistration, setLoadingRegistration] = useState(false);

  // VIP Payment Settings
  const [paymentConfig, setPaymentConfig] = useState({
    upi_id: '',
    qr_code_url: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    account_holder: '',
    instructions: ''
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const qrInputRef = useRef(null);

  // Marketplace Settings State
  const [marketplaceSettings, setMarketplaceSettings] = useState({
    prc_to_inr_rate: 0.1,
    min_order_prc: 100,
    max_order_prc: 100000,
    free_delivery_threshold: 500
  });
  const [savingMarketplace, setSavingMarketplace] = useState(false);

  useEffect(() => {
    // Check if user is admin
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    
    fetchSettings();
  }, [user, navigate]);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/social-media-settings`);
      setSocialMedia(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    }
    
    // Fetch registration status
    try {
      const regResponse = await axios.get(`${API}/api/admin/registration-status`);
      setRegistrationEnabled(regResponse.data.registration_enabled || false);
      setRegistrationMessage(regResponse.data.registration_message || 'New user registrations are currently closed. Please check back later.');
    } catch (error) {
      console.error('Error fetching registration status:', error);
    }

    // Fetch payment config
    try {
      const paymentResponse = await axios.get(`${API}/api/admin/payment-config`);
      if (paymentResponse.data) {
        setPaymentConfig({
          upi_id: paymentResponse.data.upi_id || '',
          qr_code_url: paymentResponse.data.qr_code_url || '',
          bank_name: paymentResponse.data.bank_name || '',
          account_number: paymentResponse.data.account_number || '',
          ifsc_code: paymentResponse.data.ifsc_code || '',
          account_holder: paymentResponse.data.account_holder || '',
          instructions: paymentResponse.data.instructions || ''
        });
      }
    } catch (error) {
      console.error('Error fetching payment config:', error);
    }

    // Fetch marketplace settings
    try {
      const marketplaceResponse = await axios.get(`${API}/api/admin/settings/marketplace`);
      if (marketplaceResponse.data) {
        setMarketplaceSettings({
          prc_to_inr_rate: marketplaceResponse.data.prc_to_inr_rate || 0.1,
          min_order_prc: marketplaceResponse.data.min_order_prc || 100,
          max_order_prc: marketplaceResponse.data.max_order_prc || 100000,
          free_delivery_threshold: marketplaceResponse.data.free_delivery_threshold || 500
        });
      }
    } catch (error) {
      console.error('Error fetching marketplace settings:', error);
    }
  };

  const handleChange = (field, value) => {
    setSocialMedia(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/admin/social-media-settings`, socialMedia);
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggleRegistration = async () => {
    setLoadingRegistration(true);
    try {
      const response = await axios.post(`${API}/api/admin/toggle-registration`, {
        enabled: !registrationEnabled,
        message: registrationMessage
      });
      
      setRegistrationEnabled(!registrationEnabled);
      const status = !registrationEnabled ? 'enabled' : 'disabled';
      toast.success(`User registration ${status} successfully!`, {
        description: !registrationEnabled ? 'New users can now register' : 'New user registrations are blocked',
        duration: 4000
      });
    } catch (error) {
      console.error('Error toggling registration:', error);
      toast.error('Failed to update registration status');
    } finally {
      setLoadingRegistration(false);
    }
  };
  
  const handleUpdateMessage = async () => {
    setLoadingRegistration(true);
    try {
      await axios.post(`${API}/api/admin/toggle-registration`, {
        enabled: registrationEnabled,
        message: registrationMessage
      });
      toast.success('Registration message updated successfully!');
    } catch (error) {
      console.error('Error updating message:', error);
      toast.error('Failed to update message');
    } finally {
      setLoadingRegistration(false);
    }
  };

  const handlePaymentConfigChange = (field, value) => {
    setPaymentConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSavePaymentConfig = async () => {
    setSavingPayment(true);
    try {
      await axios.post(`${API}/api/admin/payment-config`, paymentConfig);
      toast.success('VIP Payment settings saved successfully!');
    } catch (error) {
      console.error('Error saving payment config:', error);
      toast.error('Failed to save payment settings');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleMarketplaceSettingsChange = (field, value) => {
    setMarketplaceSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveMarketplaceSettings = async () => {
    setSavingMarketplace(true);
    try {
      await axios.put(`${API}/api/admin/settings/marketplace`, marketplaceSettings);
      toast.success('Marketplace settings saved successfully!');
    } catch (error) {
      console.error('Error saving marketplace settings:', error);
      toast.error('Failed to save marketplace settings');
    } finally {
      setSavingMarketplace(false);
    }
  };

  const handleQRUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    setUploadingQR(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        setPaymentConfig(prev => ({ ...prev, qr_code_url: base64 }));
        toast.success('QR Code uploaded! Click Save to apply.');
        setUploadingQR(false);
      };
      reader.onerror = () => {
        toast.error('Failed to read image');
        setUploadingQR(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload QR code');
      setUploadingQR(false);
    }
    
    // Reset input
    if (qrInputRef.current) {
      qrInputRef.current.value = '';
    }
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
            <h1 className="text-2xl font-bold text-white">
              Payment & Social Settings
            </h1>
          </div>
        </div>

        {/* Social Media Settings */}
        <Card className="p-6 shadow-xl bg-gray-900/50 border-gray-800">
          <h2 className="text-2xl font-bold mb-6 text-gray-100">Social Media Links</h2>
          <p className="text-gray-400 mb-8">Configure your social media profile links. These will be displayed in the footer and dashboard.</p>

          <div className="space-y-6">
            {/* Facebook */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Facebook className="h-5 w-5 text-blue-600" />
                Facebook
              </label>
              <input
                type="url"
                placeholder="https://facebook.com/yourpage"
                value={socialMedia.facebook}
                onChange={(e) => handleChange('facebook', e.target.value)}
                className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Twitter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Twitter className="h-5 w-5 text-blue-400" />
                Twitter / X
              </label>
              <input
                type="url"
                placeholder="https://twitter.com/yourhandle"
                value={socialMedia.twitter}
                onChange={(e) => handleChange('twitter', e.target.value)}
                className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Instagram */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Instagram className="h-5 w-5 text-pink-600" />
                Instagram
              </label>
              <input
                type="url"
                placeholder="https://instagram.com/yourprofile"
                value={socialMedia.instagram}
                onChange={(e) => handleChange('instagram', e.target.value)}
                className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* LinkedIn */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Linkedin className="h-5 w-5 text-blue-400" />
                LinkedIn
              </label>
              <input
                type="url"
                placeholder="https://linkedin.com/company/yourcompany"
                value={socialMedia.linkedin}
                onChange={(e) => handleChange('linkedin', e.target.value)}
                className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* YouTube */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Youtube className="h-5 w-5 text-red-600" />
                YouTube
              </label>
              <input
                type="url"
                placeholder="https://youtube.com/@yourchannel"
                value={socialMedia.youtube}
                onChange={(e) => handleChange('youtube', e.target.value)}
                className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Telegram */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Send className="h-5 w-5 text-blue-500" />
                Telegram
              </label>
              <input
                type="url"
                placeholder="https://t.me/yourchannel"
                value={socialMedia.telegram}
                onChange={(e) => handleChange('telegram', e.target.value)}
                className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                WhatsApp
              </label>
              <input
                type="url"
                placeholder="https://wa.me/919876543210"
                value={socialMedia.whatsapp}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-8 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 text-lg"
            >
              <Save className="h-5 w-5 mr-2" />
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </Card>

        {/* Registration Control */}
        <Card className="p-6 shadow-xl mt-6 bg-gray-900/50 border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                <Users className="h-7 w-7 text-purple-600" />
                Registration Control
              </h2>
              <p className="text-gray-400 mt-2">Enable or disable new user registrations on the platform</p>
            </div>
          </div>

          {/* Current Status */}
          <div className={`p-6 rounded-lg border-2 mb-6 ${
            registrationEnabled 
              ? 'bg-green-900/30 border-green-700' 
              : 'bg-red-900/30 border-red-700'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              {registrationEnabled ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span className="text-lg font-semibold text-green-300">Registration is Currently ENABLED</span>
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-red-600" />
                  <span className="text-lg font-semibold text-red-300">Registration is Currently DISABLED</span>
                </>
              )}
            </div>
            <p className="text-sm text-gray-300 ml-9">
              {registrationEnabled 
                ? 'New users can register and create accounts on the platform.' 
                : 'New user registrations are blocked. Existing users can still login.'}
            </p>
          </div>

          {/* Toggle Button */}
          <div className="mb-6">
            <Button
              onClick={handleToggleRegistration}
              disabled={loadingRegistration}
              className={`w-full sm:w-auto px-8 py-4 text-lg font-semibold ${
                registrationEnabled
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {loadingRegistration ? (
                'Processing...'
              ) : registrationEnabled ? (
                <>
                  <XCircle className="h-5 w-5 mr-2" />
                  Disable Registration
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Enable Registration
                </>
              )}
            </Button>
          </div>

          {/* Custom Message Section */}
          <div className="border-t pt-6">
            <div className="flex items-start gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-300 block mb-2">
                  Custom Message for Disabled Registration
                </label>
                <p className="text-xs text-gray-400 mb-3">
                  This message will be shown to users when they try to register while registration is disabled.
                </p>
              </div>
            </div>
            
            <textarea
              value={registrationMessage}
              onChange={(e) => setRegistrationMessage(e.target.value)}
              placeholder="Enter message to display when registration is closed..."
              rows={4}
              maxLength={300}
              className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                {registrationMessage.length}/300 characters
              </p>
              <Button
                onClick={handleUpdateMessage}
                disabled={loadingRegistration || !registrationMessage.trim()}
                variant="outline"
                className="text-sm"
              >
                <Save className="h-4 w-4 mr-2" />
                Update Message
              </Button>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-900/30 border border-blue-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-300 mb-2">Important Notes:</h3>
            <ul className="text-xs text-blue-200 space-y-1">
              <li>• Disabling registration will prevent all new user signups</li>
              <li>• Existing users will continue to have full access</li>
              <li>• Login functionality remains unaffected</li>
              <li>• You can enable/disable registration anytime</li>
              <li>• Custom message supports up to 300 characters</li>
            </ul>
          </div>
        </Card>

        {/* VIP Payment Settings */}
        <Card className="p-6 shadow-xl mt-6 bg-gray-900/50 border-gray-800">
          <h2 className="text-2xl font-bold mb-6 text-gray-100">💳 VIP Payment Settings</h2>
          <p className="text-gray-400 mb-8">Configure payment details for VIP membership purchases. Users will see these details when purchasing VIP.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* UPI Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-300 border-b pb-2">UPI Payment</h3>
              
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">UPI ID</label>
                <input
                  type="text"
                  placeholder="yourname@upi"
                  value={paymentConfig.upi_id}
                  onChange={(e) => handlePaymentConfigChange('upi_id', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">QR Code Image</label>
                <input 
                  ref={qrInputRef}
                  type="file" 
                  accept="image/*"
                  onChange={handleQRUpload}
                  className="hidden"
                />
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => qrInputRef.current?.click()}
                    disabled={uploadingQR}
                    className="flex items-center gap-2 px-4 py-3 bg-purple-500/20 hover:bg-purple-200 text-purple-400 rounded-lg transition-colors"
                  >
                    {uploadingQR ? (
                      <>
                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Upload QR Code
                      </>
                    )}
                  </button>
                  {paymentConfig.qr_code_url && (
                    <div className="relative">
                      <img 
                        src={paymentConfig.qr_code_url} 
                        alt="QR Code Preview" 
                        className="w-24 h-24 object-contain border rounded-lg bg-gray-900"
                      />
                      <button
                        onClick={() => handlePaymentConfigChange('qr_code_url', '')}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500/10 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">Max 2MB • JPG, PNG supported</p>
              </div>
            </div>

            {/* Bank Transfer Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-300 border-b pb-2">Bank Transfer</h3>
              
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Account Holder Name</label>
                <input
                  type="text"
                  placeholder="PARAS REWARD PVT LTD"
                  value={paymentConfig.account_holder}
                  onChange={(e) => handlePaymentConfigChange('account_holder', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Bank Name</label>
                <input
                  type="text"
                  placeholder="State Bank of India"
                  value={paymentConfig.bank_name}
                  onChange={(e) => handlePaymentConfigChange('bank_name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Account Number</label>
                <input
                  type="text"
                  placeholder="1234567890"
                  value={paymentConfig.account_number}
                  onChange={(e) => handlePaymentConfigChange('account_number', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">IFSC Code</label>
                <input
                  type="text"
                  placeholder="SBIN0001234"
                  value={paymentConfig.ifsc_code}
                  onChange={(e) => handlePaymentConfigChange('ifsc_code', e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6">
            <label className="text-sm font-medium text-gray-300 mb-2 block">Payment Instructions</label>
            <textarea
              rows={3}
              placeholder="Enter instructions for users making VIP payment..."
              value={paymentConfig.instructions}
              onChange={(e) => handlePaymentConfigChange('instructions', e.target.value)}
              className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Save Button */}
          <div className="mt-6 pt-6 border-t">
            <Button
              onClick={handleSavePaymentConfig}
              disabled={savingPayment}
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 font-semibold"
            >
              {savingPayment ? (
                'Saving...'
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Save Payment Settings
                </>
              )}
            </Button>
          </div>

          {/* Preview Box */}
          {(paymentConfig.upi_id || paymentConfig.account_number) && (
            <div className="mt-6 bg-green-900/30 border border-green-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-300 mb-2">✅ Preview - Users will see:</h3>
              <div className="text-sm text-green-200 space-y-1">
                {paymentConfig.upi_id && <p>• UPI: {paymentConfig.upi_id}</p>}
                {paymentConfig.account_holder && <p>• Account Name: {paymentConfig.account_holder}</p>}
                {paymentConfig.bank_name && <p>• Bank: {paymentConfig.bank_name}</p>}
                {paymentConfig.account_number && <p>• Account: {paymentConfig.account_number}</p>}
                {paymentConfig.ifsc_code && <p>• IFSC: {paymentConfig.ifsc_code}</p>}
              </div>
            </div>
          )}
        </Card>

        {/* Marketplace Settings */}
        <Card className="p-6 shadow-xl mt-6 bg-gray-900/50 border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-100">Marketplace Settings</h2>
              <p className="text-gray-400">Configure PRC conversion rate and marketplace limits</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PRC to INR Conversion Rate */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
              <label className="flex items-center gap-2 text-sm font-semibold text-amber-400 mb-3">
                <Coins className="h-5 w-5" />
                PRC to INR Conversion Rate
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0.001"
                    value={marketplaceSettings.prc_to_inr_rate}
                    onChange={(e) => handleMarketplaceSettingsChange('prc_to_inr_rate', parseFloat(e.target.value) || 0.1)}
                    className="w-full px-4 py-3 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-900 text-gray-200 font-mono text-lg"
                  />
                </div>
              </div>
              <div className="mt-3 p-3 bg-gray-900 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-400">
                  <strong>Current Rate:</strong> 1 PRC = ₹{marketplaceSettings.prc_to_inr_rate?.toFixed(2)}
                </p>
                <p className="text-sm text-amber-600 mt-1">
                  Example: <span className="font-semibold">{Math.round(1/marketplaceSettings.prc_to_inr_rate)} PRC = ₹1</span>
                </p>
                <p className="text-xs text-amber-500 mt-2">
                  💡 For 10 PRC = ₹1, set rate to 0.10
                </p>
              </div>
            </div>

            {/* Free Delivery Threshold */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-500/30 rounded-xl p-5">
              <label className="flex items-center gap-2 text-sm font-semibold text-green-300 mb-3">
                <Truck className="h-5 w-5" />
                Free Delivery Threshold (PRC)
              </label>
              <input
                type="number"
                min="0"
                value={marketplaceSettings.free_delivery_threshold}
                onChange={(e) => handleMarketplaceSettingsChange('free_delivery_threshold', parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-900 text-gray-200 font-mono text-lg"
              />
              <p className="text-sm text-green-600 mt-2">
                Orders above {marketplaceSettings.free_delivery_threshold} PRC get free delivery
              </p>
            </div>

            {/* Min Order PRC */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <IndianRupee className="h-4 w-4" />
                Minimum Order (PRC)
              </label>
              <input
                type="number"
                min="0"
                value={marketplaceSettings.min_order_prc}
                onChange={(e) => handleMarketplaceSettingsChange('min_order_prc', parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Max Order PRC */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <IndianRupee className="h-4 w-4" />
                Maximum Order (PRC)
              </label>
              <input
                type="number"
                min="0"
                value={marketplaceSettings.max_order_prc}
                onChange={(e) => handleMarketplaceSettingsChange('max_order_prc', parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Conversion Calculator */}
          <div className="mt-6 p-4 bg-gray-800 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Quick Conversion Reference</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[100, 500, 1000, 5000].map(prc => (
                <div key={prc} className="bg-gray-700 rounded-lg p-3 text-center">
                  <p className="text-amber-400 font-bold">{prc} PRC</p>
                  <p className="text-white text-lg font-semibold">= ₹{(prc * marketplaceSettings.prc_to_inr_rate).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <Button
              onClick={handleSaveMarketplaceSettings}
              disabled={savingMarketplace}
              className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 text-white px-8 py-3 font-semibold"
            >
              {savingMarketplace ? (
                'Saving...'
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Save Marketplace Settings
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
