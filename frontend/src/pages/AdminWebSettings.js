import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, Save, Globe, FileText, MapPin, Phone, Mail, Image,
  Building, User, Clock, ExternalLink
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminWebSettings = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('policies');

  // Policy State
  const [policies, setPolicies] = useState({
    terms_of_service: '',
    privacy_policy: '',
    refund_policy: '',
    about_us: ''
  });

  // Contact/Address State
  const [contactInfo, setContactInfo] = useState({
    company_name: 'PARAS REWARD',
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

  // Logo State
  const [logoSettings, setLogoSettings] = useState({
    logo_url: '',
    favicon_url: '',
    app_name: 'PARAS REWARD',
    tagline: 'Earn Rewards, Live Better'
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchSettings();
  }, [user, navigate]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // Fetch policies
      try {
        const policyResponse = await axios.get(`${API}/api/admin/policies`);
        if (policyResponse.data) {
          setPolicies(prev => ({ ...prev, ...policyResponse.data }));
        }
      } catch (e) { console.log('Policies not found'); }

      // Fetch contact info
      try {
        const contactResponse = await axios.get(`${API}/api/admin/contact-settings`);
        if (contactResponse.data) {
          setContactInfo(prev => ({ ...prev, ...contactResponse.data }));
        }
      } catch (e) { console.log('Contact settings not found'); }

      // Fetch logo settings
      try {
        const logoResponse = await axios.get(`${API}/api/admin/logo-settings`);
        if (logoResponse.data) {
          setLogoSettings(prev => ({ ...prev, ...logoResponse.data }));
        }
      } catch (e) { console.log('Logo settings not found'); }

    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolicies = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/admin/policies/update`, policies);
      toast.success('Policies updated successfully!');
    } catch (error) {
      toast.error('Failed to save policies');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContactInfo = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/admin/contact-settings/update`, contactInfo);
      toast.success('Contact information updated successfully!');
    } catch (error) {
      toast.error('Failed to save contact information');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLogoSettings = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/admin/logo-settings/update`, logoSettings);
      toast.success('Logo settings updated successfully!');
    } catch (error) {
      toast.error('Failed to save logo settings');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'policies', label: 'Policy Editor', icon: FileText },
    { id: 'address', label: 'Address Settings', icon: MapPin },
    { id: 'contact', label: 'Phone & Email', icon: Phone },
    { id: 'logo', label: 'Logo & Branding', icon: Image },
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
              <Globe className="h-6 w-6 text-blue-600" />
              Web Settings
            </h1>
            <p className="text-sm text-gray-500">Manage policies, contact info, and branding</p>
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
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Policy Editor Tab */}
        {activeTab === 'policies' && (
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Policy Editor
            </h2>
            <div className="space-y-6">
              {[
                { key: 'terms_of_service', label: 'Terms of Service' },
                { key: 'privacy_policy', label: 'Privacy Policy' },
                { key: 'refund_policy', label: 'Refund Policy' },
                { key: 'about_us', label: 'About Us' }
              ].map((policy) => (
                <div key={policy.key}>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    {policy.label}
                  </label>
                  <textarea
                    value={policies[policy.key]}
                    onChange={(e) => setPolicies(prev => ({ ...prev, [policy.key]: e.target.value }))}
                    rows={6}
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                    placeholder={`Enter ${policy.label} content (supports HTML)...`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSavePolicies} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Policies
              </Button>
            </div>
          </Card>
        )}

        {/* Address Settings Tab */}
        {activeTab === 'address' && (
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-600" />
              Address Settings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Building className="h-4 w-4" />
                  Company Name
                </label>
                <input
                  type="text"
                  value={contactInfo.company_name}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, company_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Address Line 1</label>
                <input
                  type="text"
                  value={contactInfo.address_line1}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, address_line1: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Building name, Street address"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Address Line 2</label>
                <input
                  type="text"
                  value={contactInfo.address_line2}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, address_line2: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Area, Landmark"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">City</label>
                <input
                  type="text"
                  value={contactInfo.city}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">State</label>
                <input
                  type="text"
                  value={contactInfo.state}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, state: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Pincode</label>
                <input
                  type="text"
                  value={contactInfo.pincode}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, pincode: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Country</label>
                <input
                  type="text"
                  value={contactInfo.country}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveContactInfo} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Address
              </Button>
            </div>
          </Card>
        )}

        {/* Phone & Email Tab */}
        {activeTab === 'contact' && (
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-600" />
              Phone & Email Settings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4" />
                  Primary Phone
                </label>
                <input
                  type="tel"
                  value={contactInfo.phone_primary}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, phone_primary: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="+91 9876543210"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4" />
                  Secondary Phone
                </label>
                <input
                  type="tel"
                  value={contactInfo.phone_secondary}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, phone_secondary: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="+91 9876543211"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4" />
                  Support Email
                </label>
                <input
                  type="email"
                  value={contactInfo.email_support}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, email_support: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="support@paras.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4" />
                  Business Email
                </label>
                <input
                  type="email"
                  value={contactInfo.email_business}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, email_business: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="business@paras.com"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4" />
                  Working Hours
                </label>
                <input
                  type="text"
                  value={contactInfo.working_hours}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, working_hours: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="9:00 AM - 6:00 PM (Mon-Sat)"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveContactInfo} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Contact Info
              </Button>
            </div>
          </Card>
        )}

        {/* Logo & Branding Tab */}
        {activeTab === 'logo' && (
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Image className="h-5 w-5 text-purple-600" />
              Logo & Branding
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-2 block">App Name</label>
                <input
                  type="text"
                  value={logoSettings.app_name}
                  onChange={(e) => setLogoSettings(prev => ({ ...prev, app_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Tagline</label>
                <input
                  type="text"
                  value={logoSettings.tagline}
                  onChange={(e) => setLogoSettings(prev => ({ ...prev, tagline: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Logo URL</label>
                <input
                  type="url"
                  value={logoSettings.logo_url}
                  onChange={(e) => setLogoSettings(prev => ({ ...prev, logo_url: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="https://example.com/logo.png"
                />
                {logoSettings.logo_url && (
                  <div className="mt-2 p-4 bg-gray-100 rounded-lg">
                    <img src={logoSettings.logo_url} alt="Logo Preview" className="h-16 object-contain" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Favicon URL</label>
                <input
                  type="url"
                  value={logoSettings.favicon_url}
                  onChange={(e) => setLogoSettings(prev => ({ ...prev, favicon_url: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="https://example.com/favicon.ico"
                />
                {logoSettings.favicon_url && (
                  <div className="mt-2 p-4 bg-gray-100 rounded-lg">
                    <img src={logoSettings.favicon_url} alt="Favicon Preview" className="h-8 object-contain" />
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveLogoSettings} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Branding
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminWebSettings;
