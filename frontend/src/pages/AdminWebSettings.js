import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, Save, Globe, FileText, MapPin, Phone, Mail, Image,
  Building, Clock, Upload, Loader2, Trash2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminWebSettings = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(null);
  const [activeTab, setActiveTab] = useState('policies');

  // File input refs
  const logoInputRef = useRef(null);
  const footerLogoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

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
    footer_logo_url: '',
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

  const handleFileUpload = async (file, logoType) => {
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (PNG, JPG, GIF, WEBP, ICO)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }

    setUploadingLogo(logoType);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('logo_type', logoType);

      const response = await axios.post(`${API}/api/admin/logo-upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        // Update local state with new URL
        const urlKey = logoType === 'favicon' ? 'favicon_url' : 
                      logoType === 'footer_logo' ? 'footer_logo_url' : 'logo_url';
        setLogoSettings(prev => ({ ...prev, [urlKey]: response.data.url }));
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setUploadingLogo(null);
    }
  };

  const handleRemoveLogo = async (logoType) => {
    const urlKey = logoType === 'favicon' ? 'favicon_url' : 
                  logoType === 'footer_logo' ? 'footer_logo_url' : 'logo_url';
    
    setLogoSettings(prev => ({ ...prev, [urlKey]: '' }));
    toast.success(`${logoType.replace('_', ' ')} removed. Click "Save Branding" to confirm.`);
  };

  const tabs = [
    { id: 'policies', label: 'Policy Editor', icon: FileText },
    { id: 'address', label: 'Address Settings', icon: MapPin },
    { id: 'contact', label: 'Phone & Email', icon: Phone },
    { id: 'logo', label: 'Logo & Branding', icon: Image },
  ];

  const LogoUploadCard = ({ title, description, logoType, currentUrl, inputRef }) => (
    <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 hover:border-purple-300 transition-colors">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <Image className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h4 className="font-semibold text-white">{title}</h4>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      
      {/* Preview */}
      {currentUrl && (
        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg flex items-center justify-between">
          <img 
            src={currentUrl.startsWith('/') ? currentUrl : currentUrl} 
            alt={title} 
            className="h-16 object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => handleRemoveLogo(logoType)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Upload Button */}
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => handleFileUpload(e.target.files[0], logoType)}
      />
      <Button
        variant="outline"
        className="w-full"
        onClick={() => inputRef.current?.click()}
        disabled={uploadingLogo === logoType}
      >
        {uploadingLogo === logoType ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            {currentUrl ? 'Change Image' : 'Upload Image'}
          </>
        )}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-800/50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate('/admin')} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Globe className="h-6 w-6 text-blue-600" />
              Web Settings
            </h1>
            <p className="text-sm text-gray-500">Manage policies, contact info, and branding</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 bg-gray-900 p-2 rounded-lg shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800'
                }`}
                data-testid={`tab-${tab.id}`}
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
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    {policy.label}
                  </label>
                  <textarea
                    value={policies[policy.key]}
                    onChange={(e) => setPolicies(prev => ({ ...prev, [policy.key]: e.target.value }))}
                    rows={6}
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                    placeholder={`Enter ${policy.label} content (supports HTML)...`}
                    data-testid={`policy-${policy.key}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSavePolicies} disabled={loading} data-testid="save-policies-btn">
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
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                  <Building className="h-4 w-4" />
                  Company Name
                </label>
                <input
                  type="text"
                  value={contactInfo.company_name}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, company_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  data-testid="company-name-input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-300 mb-2 block">Address Line 1</label>
                <input
                  type="text"
                  value={contactInfo.address_line1}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, address_line1: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Building name, Street address"
                  data-testid="address-line1-input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-300 mb-2 block">Address Line 2</label>
                <input
                  type="text"
                  value={contactInfo.address_line2}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, address_line2: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Area, Landmark"
                  data-testid="address-line2-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">City</label>
                <input
                  type="text"
                  value={contactInfo.city}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  data-testid="city-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">State</label>
                <input
                  type="text"
                  value={contactInfo.state}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, state: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  data-testid="state-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Pincode</label>
                <input
                  type="text"
                  value={contactInfo.pincode}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, pincode: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  data-testid="pincode-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Country</label>
                <input
                  type="text"
                  value={contactInfo.country}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  data-testid="country-input"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveContactInfo} disabled={loading} data-testid="save-address-btn">
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
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4" />
                  Primary Phone
                </label>
                <input
                  type="tel"
                  value={contactInfo.phone_primary}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, phone_primary: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="+91 9876543210"
                  data-testid="phone-primary-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4" />
                  Secondary Phone
                </label>
                <input
                  type="tel"
                  value={contactInfo.phone_secondary}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, phone_secondary: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="+91 9876543211"
                  data-testid="phone-secondary-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4" />
                  Support Email
                </label>
                <input
                  type="email"
                  value={contactInfo.email_support}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, email_support: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="support@paras.com"
                  data-testid="email-support-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4" />
                  Business Email
                </label>
                <input
                  type="email"
                  value={contactInfo.email_business}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, email_business: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="business@paras.com"
                  data-testid="email-business-input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4" />
                  Working Hours
                </label>
                <input
                  type="text"
                  value={contactInfo.working_hours}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, working_hours: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="9:00 AM - 6:00 PM (Mon-Sat)"
                  data-testid="working-hours-input"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveContactInfo} disabled={loading} data-testid="save-contact-btn">
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
            
            {/* App Name & Tagline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">App Name</label>
                <input
                  type="text"
                  value={logoSettings.app_name}
                  onChange={(e) => setLogoSettings(prev => ({ ...prev, app_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  data-testid="app-name-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Tagline</label>
                <input
                  type="text"
                  value={logoSettings.tagline}
                  onChange={(e) => setLogoSettings(prev => ({ ...prev, tagline: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  data-testid="tagline-input"
                />
              </div>
            </div>

            {/* Logo Upload Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <LogoUploadCard
                title="Main Logo"
                description="Recommended: 400x100px, PNG"
                logoType="logo"
                currentUrl={logoSettings.logo_url}
                inputRef={logoInputRef}
              />
              <LogoUploadCard
                title="Footer Logo"
                description="Recommended: 200x50px, PNG"
                logoType="footer_logo"
                currentUrl={logoSettings.footer_logo_url}
                inputRef={footerLogoInputRef}
              />
              <LogoUploadCard
                title="Favicon"
                description="Recommended: 64x64px, ICO/PNG"
                logoType="favicon"
                currentUrl={logoSettings.favicon_url}
                inputRef={faviconInputRef}
              />
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Tips:</strong> Upload high-quality images for best results. Images will be automatically resized. 
                Supported formats: PNG, JPG, GIF, WEBP, ICO. Maximum file size: 5MB.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveLogoSettings} disabled={loading} data-testid="save-branding-btn">
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
