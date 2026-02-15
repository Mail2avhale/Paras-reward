import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, Save, Building2, MapPin, Phone, Mail, Clock, 
  Globe, CheckCircle, Building, AtSign
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminContactSettings = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    company_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    phone_primary: '',
    phone_secondary: '',
    email_support: '',
    email_business: '',
    working_hours: '9:00 AM - 6:00 PM (Mon-Sat)'
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchSettings();
  }, [user, navigate]);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/admin/contact-settings`);
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching contact settings:', error);
      toast.error('Failed to load contact settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/admin/contact-settings/update`, settings);
      toast.success('Contact settings saved successfully!');
    } catch (error) {
      console.error('Error saving contact settings:', error);
      toast.error('Failed to save contact settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

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
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                Contact Settings
              </h1>
              <p className="text-gray-400 text-sm mt-1">Configure company contact information for Landing page & Contact Us</p>
            </div>
          </div>
        </div>

        {/* Company Information */}
        <Card className="p-6 bg-gray-900/50 border-gray-800 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
              <Building className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Company Information</h2>
              <p className="text-gray-400 text-sm">Basic company details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Building2 className="h-4 w-4 text-purple-400" />
                Company Name *
              </label>
              <input
                type="text"
                placeholder="PARAS REWARD PVT LTD"
                value={settings.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </Card>

        {/* Address Information */}
        <Card className="p-6 bg-gray-900/50 border-gray-800 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Address</h2>
              <p className="text-gray-400 text-sm">Company registered address</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-300 mb-2 block">Address Line 1 *</label>
              <input
                type="text"
                placeholder="Building name, Street address"
                value={settings.address_line1}
                onChange={(e) => handleChange('address_line1', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-300 mb-2 block">Address Line 2</label>
              <input
                type="text"
                placeholder="Area, Landmark (optional)"
                value={settings.address_line2}
                onChange={(e) => handleChange('address_line2', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">City *</label>
              <input
                type="text"
                placeholder="Mumbai"
                value={settings.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">State *</label>
              <input
                type="text"
                placeholder="Maharashtra"
                value={settings.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Pincode *</label>
              <input
                type="text"
                placeholder="400001"
                value={settings.pincode}
                onChange={(e) => handleChange('pincode', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Globe className="h-4 w-4 text-green-400" />
                Country
              </label>
              <input
                type="text"
                placeholder="India"
                value={settings.country}
                onChange={(e) => handleChange('country', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </Card>

        {/* Contact Details */}
        <Card className="p-6 bg-gray-900/50 border-gray-800 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Phone className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Contact Details</h2>
              <p className="text-gray-400 text-sm">Phone numbers and email addresses</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Phone className="h-4 w-4 text-amber-400" />
                Primary Phone *
              </label>
              <input
                type="tel"
                placeholder="+91 9876543210"
                value={settings.phone_primary}
                onChange={(e) => handleChange('phone_primary', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Phone className="h-4 w-4 text-amber-400" />
                Secondary Phone
              </label>
              <input
                type="tel"
                placeholder="+91 9876543211 (optional)"
                value={settings.phone_secondary}
                onChange={(e) => handleChange('phone_secondary', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Mail className="h-4 w-4 text-blue-400" />
                Support Email *
              </label>
              <input
                type="email"
                placeholder="support@parasreward.com"
                value={settings.email_support}
                onChange={(e) => handleChange('email_support', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <AtSign className="h-4 w-4 text-blue-400" />
                Business Email
              </label>
              <input
                type="email"
                placeholder="business@parasreward.com (optional)"
                value={settings.email_business}
                onChange={(e) => handleChange('email_business', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Clock className="h-4 w-4 text-cyan-400" />
                Working Hours
              </label>
              <input
                type="text"
                placeholder="9:00 AM - 6:00 PM (Mon-Sat)"
                value={settings.working_hours}
                onChange={(e) => handleChange('working_hours', e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>
        </Card>

        {/* Preview Section */}
        <Card className="p-6 bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-500/30 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Preview - How it will appear on Contact Us page</h3>
          </div>
          
          <div className="bg-gray-900/50 rounded-xl p-6 space-y-4">
            <div className="text-2xl font-bold text-white">{settings.company_name || 'Company Name'}</div>
            
            <div className="flex items-start gap-3 text-gray-300">
              <MapPin className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                {settings.address_line1 && <div>{settings.address_line1}</div>}
                {settings.address_line2 && <div>{settings.address_line2}</div>}
                <div>
                  {[settings.city, settings.state, settings.pincode].filter(Boolean).join(', ')}
                </div>
                <div>{settings.country}</div>
              </div>
            </div>
            
            {settings.phone_primary && (
              <div className="flex items-center gap-3 text-gray-300">
                <Phone className="h-5 w-5 text-amber-400 flex-shrink-0" />
                <span>{settings.phone_primary}</span>
                {settings.phone_secondary && <span className="text-gray-500">| {settings.phone_secondary}</span>}
              </div>
            )}
            
            {settings.email_support && (
              <div className="flex items-center gap-3 text-gray-300">
                <Mail className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <span>{settings.email_support}</span>
              </div>
            )}
            
            {settings.working_hours && (
              <div className="flex items-center gap-3 text-gray-300">
                <Clock className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                <span>{settings.working_hours}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Save Contact Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminContactSettings;
