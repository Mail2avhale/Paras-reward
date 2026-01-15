import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, CreditCard, Cpu, Globe, Share2, Shield, Video, CloudRain,
  ChevronRight, ArrowLeft, Check, AlertCircle
} from 'lucide-react';

// Import all settings components
import AdminSettings from './AdminSettings';
import AdminSystemSettings from './AdminSystemSettings';
import AdminWebSettings from './AdminWebSettings';
import AdminSocialMediaSettings from './AdminSocialMediaSettings';
import AdminRedeemSettings from './AdminRedeemSettings';
import AdminVideoAds from './AdminVideoAds';
import AdminPRCRain from './AdminPRCRain';

const API = process.env.REACT_APP_BACKEND_URL || '';

const settingsTabs = [
  { 
    id: 'payment', 
    label: 'Payment Settings', 
    icon: CreditCard, 
    description: 'UPI, QR Code, Bank Details',
    color: 'from-amber-500 to-orange-500'
  },
  { 
    id: 'system', 
    label: 'System Settings', 
    icon: Cpu, 
    description: 'Plans, Mining, Referral Bonus',
    color: 'from-purple-500 to-violet-500'
  },
  { 
    id: 'web', 
    label: 'Web Settings', 
    icon: Globe, 
    description: 'Homepage, SEO, Banners',
    color: 'from-blue-500 to-cyan-500'
  },
  { 
    id: 'social', 
    label: 'Social Media', 
    icon: Share2, 
    description: 'Social Links & Profiles',
    color: 'from-pink-500 to-rose-500'
  },
  { 
    id: 'redeem', 
    label: 'Redeem Safety', 
    icon: Shield, 
    description: 'Withdrawal Limits & Security',
    color: 'from-emerald-500 to-teal-500'
  },
  { 
    id: 'video-ads', 
    label: 'Video Ads', 
    icon: Video, 
    description: 'Ad Configuration & Revenue',
    color: 'from-red-500 to-orange-500'
  },
  { 
    id: 'prc-rain', 
    label: 'PRC Rain Drop', 
    icon: CloudRain, 
    description: 'Rain Events & Distribution',
    color: 'from-indigo-500 to-purple-500'
  }
];

const AdminSettingsHub = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'payment');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Update URL when tab changes
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  useEffect(() => {
    // Read tab from URL on mount
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && settingsTabs.find(t => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, []);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const renderSettingsContent = () => {
    switch (activeTab) {
      case 'payment':
        return <AdminSettings user={user} isEmbedded={true} />;
      case 'system':
        return <AdminSystemSettings user={user} isEmbedded={true} />;
      case 'web':
        return <AdminWebSettings user={user} isEmbedded={true} />;
      case 'social':
        return <AdminSocialMediaSettings user={user} isEmbedded={true} />;
      case 'redeem':
        return <AdminRedeemSettings user={user} isEmbedded={true} />;
      case 'video-ads':
        return <AdminVideoAds user={user} isEmbedded={true} />;
      case 'prc-rain':
        return <AdminPRCRain user={user} isEmbedded={true} />;
      default:
        return <AdminSettings user={user} isEmbedded={true} />;
    }
  };

  const currentTab = settingsTabs.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/admin')}
                className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">Settings</h1>
                <p className="text-gray-500 text-sm">Manage all configurations</p>
              </div>
            </div>
            
            {/* Mobile tab selector */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-xl text-white"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">{currentTab?.label}</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${isMobileMenuOpen ? 'rotate-90' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Desktop Tabs - Horizontal */}
        <div className="hidden lg:block px-4 pb-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {settingsTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                    isActive
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Tab Menu Dropdown */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="lg:hidden fixed inset-x-0 top-[88px] z-40 bg-gray-900 border-b border-gray-800 shadow-xl"
          >
            <div className="p-4 grid grid-cols-2 gap-3">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex flex-col items-start p-3 rounded-xl transition-all ${
                      isActive
                        ? `bg-gradient-to-r ${tab.color} text-white`
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span className="text-sm font-medium">{tab.label}</span>
                    <span className={`text-xs ${isActive ? 'text-white/70' : 'text-gray-500'}`}>
                      {tab.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 min-h-[calc(100vh-120px)] border-r border-gray-800 bg-gray-900/50">
          <div className="p-4 space-y-2">
            {settingsTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left ${
                    isActive
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                      : 'bg-gray-800/30 text-gray-400 hover:bg-gray-800/50 hover:text-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isActive ? 'bg-white/20' : 'bg-gray-800'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{tab.label}</span>
                    <span className={`block text-xs truncate ${isActive ? 'text-white/70' : 'text-gray-500'}`}>
                      {tab.description}
                    </span>
                  </div>
                  {isActive && <Check className="w-4 h-4 mt-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-4 lg:p-6"
            >
              {renderSettingsContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsHub;
