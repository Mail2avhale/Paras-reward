import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Facebook, Twitter, Instagram, Linkedin, Youtube, Send, MessageCircle, Save, ArrowLeft } from 'lucide-react';

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
      </div>
    </div>
  );
};

export default AdminSettings;
