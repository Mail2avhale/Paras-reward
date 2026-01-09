import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Facebook, Twitter, Instagram, Linkedin, Youtube, Send, MessageCircle, Save, ArrowLeft, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Admin Settings
            </h1>
          </div>
        </div>

        {/* Social Media Settings */}
        <Card className="p-8 shadow-xl">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Social Media Links</h2>
          <p className="text-gray-600 mb-8">Configure your social media profile links. These will be displayed in the footer and dashboard.</p>

          <div className="space-y-6">
            {/* Facebook */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Facebook className="h-5 w-5 text-blue-600" />
                Facebook
              </label>
              <input
                type="url"
                placeholder="https://facebook.com/yourpage"
                value={socialMedia.facebook}
                onChange={(e) => handleChange('facebook', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Twitter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Twitter className="h-5 w-5 text-blue-400" />
                Twitter / X
              </label>
              <input
                type="url"
                placeholder="https://twitter.com/yourhandle"
                value={socialMedia.twitter}
                onChange={(e) => handleChange('twitter', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Instagram */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Instagram className="h-5 w-5 text-pink-600" />
                Instagram
              </label>
              <input
                type="url"
                placeholder="https://instagram.com/yourprofile"
                value={socialMedia.instagram}
                onChange={(e) => handleChange('instagram', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* LinkedIn */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Linkedin className="h-5 w-5 text-blue-700" />
                LinkedIn
              </label>
              <input
                type="url"
                placeholder="https://linkedin.com/company/yourcompany"
                value={socialMedia.linkedin}
                onChange={(e) => handleChange('linkedin', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* YouTube */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Youtube className="h-5 w-5 text-red-600" />
                YouTube
              </label>
              <input
                type="url"
                placeholder="https://youtube.com/@yourchannel"
                value={socialMedia.youtube}
                onChange={(e) => handleChange('youtube', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Telegram */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Send className="h-5 w-5 text-blue-500" />
                Telegram
              </label>
              <input
                type="url"
                placeholder="https://t.me/yourchannel"
                value={socialMedia.telegram}
                onChange={(e) => handleChange('telegram', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                WhatsApp
              </label>
              <input
                type="url"
                placeholder="https://wa.me/919876543210"
                value={socialMedia.whatsapp}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
        <Card className="p-8 shadow-xl mt-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Users className="h-7 w-7 text-purple-600" />
                Registration Control
              </h2>
              <p className="text-gray-600 mt-2">Enable or disable new user registrations on the platform</p>
            </div>
          </div>

          {/* Current Status */}
          <div className={`p-6 rounded-lg border-2 mb-6 ${
            registrationEnabled 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              {registrationEnabled ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span className="text-lg font-semibold text-green-900">Registration is Currently ENABLED</span>
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-red-600" />
                  <span className="text-lg font-semibold text-red-900">Registration is Currently DISABLED</span>
                </>
              )}
            </div>
            <p className="text-sm text-gray-700 ml-9">
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
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Custom Message for Disabled Registration
                </label>
                <p className="text-xs text-gray-600 mb-3">
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
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
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Important Notes:</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Disabling registration will prevent all new user signups</li>
              <li>• Existing users will continue to have full access</li>
              <li>• Login functionality remains unaffected</li>
              <li>• You can enable/disable registration anytime</li>
              <li>• Custom message supports up to 300 characters</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
