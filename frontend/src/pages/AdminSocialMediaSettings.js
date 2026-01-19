import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, Save, Share2, Facebook, Twitter, Instagram, 
  Linkedin, Youtube, Send, MessageCircle, ExternalLink
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminSocialMediaSettings = ({ user }) => {
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

  useEffect(() => {
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
    }
  };

  const handleChange = (field, value) => {
    setSocialMedia(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/admin/social-media-settings`, socialMedia);
      toast.success('Social media settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const socialPlatforms = [
    { key: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600', placeholder: 'https://facebook.com/yourpage' },
    { key: 'twitter', label: 'Twitter / X', icon: Twitter, color: 'text-sky-500', placeholder: 'https://twitter.com/yourhandle' },
    { key: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-600', placeholder: 'https://instagram.com/yourprofile' },
    { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-400', placeholder: 'https://linkedin.com/company/yourcompany' },
    { key: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-600', placeholder: 'https://youtube.com/@yourchannel' },
    { key: 'telegram', label: 'Telegram', icon: Send, color: 'text-blue-500', placeholder: 'https://t.me/yourchannel' },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-600', placeholder: 'https://wa.me/919876543210' },
  ];

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
              <Share2 className="h-6 w-6 text-pink-600" />
              Social Media Settings
            </h1>
            <p className="text-sm text-gray-500">Configure social media links displayed on the platform</p>
          </div>
        </div>

        <Card className="p-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-100">Social Media Links</h2>
            <p className="text-sm text-gray-400">These links will be displayed in the footer and user dashboard.</p>
          </div>

          <div className="space-y-5">
            {socialPlatforms.map((platform) => {
              const Icon = platform.icon;
              return (
                <div key={platform.key} className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg bg-gray-800 ${platform.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-300 mb-1 block">
                      {platform.label}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder={platform.placeholder}
                        value={socialMedia[platform.key]}
                        onChange={(e) => handleChange(platform.key, e.target.value)}
                        className="flex-1 px-4 py-2.5 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      {socialMedia[platform.key] && (
                        <a
                          href={socialMedia[platform.key]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 border border-gray-600 rounded-lg hover:bg-gray-800/50"
                        >
                          <ExternalLink className="h-5 w-5 text-gray-500" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Preview Section */}
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-sm font-medium text-gray-300 mb-4">Preview</h3>
            <div className="flex flex-wrap gap-3 p-4 bg-gray-800 rounded-lg">
              {socialPlatforms.map((platform) => {
                const Icon = platform.icon;
                const hasLink = socialMedia[platform.key];
                return (
                  <a
                    key={platform.key}
                    href={hasLink || '#'}
                    className={`p-2 rounded-lg transition-colors ${
                      hasLink 
                        ? `bg-gray-900 shadow-sm hover:shadow ${platform.color}` 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    title={hasLink ? platform.label : `${platform.label} (not configured)`}
                    onClick={(e) => !hasLink && e.preventDefault()}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Gray icons indicate platforms that are not configured yet.
            </p>
          </div>

          {/* Save Button */}
          <div className="mt-8 flex justify-end">
            <Button onClick={handleSave} disabled={loading} className="px-8">
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Social Media Settings'}
            </Button>
          </div>
        </Card>

        {/* Tips Card */}
        <Card className="p-6 mt-6 bg-blue-500/100/10 border-blue-500/30">
          <h3 className="font-semibold text-blue-900 mb-2">Tips for Social Media Links</h3>
          <ul className="text-sm text-blue-400 space-y-1">
            <li>• Use complete URLs including https://</li>
            <li>• For WhatsApp, use format: https://wa.me/919876543210 (with country code)</li>
            <li>• For Telegram channels, use: https://t.me/channelname</li>
            <li>• Verify all links work before saving</li>
            <li>• Empty fields will hide the icon from the footer</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default AdminSocialMediaSettings;
