import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Settings, CreditCard, Cpu, Globe, Share2, Shield, Video, CloudRain,
  ChevronRight, ArrowLeft, Sparkles
} from 'lucide-react';

const settingsCategories = [
  { 
    id: 'payment', 
    label: 'Payment Settings', 
    icon: CreditCard, 
    description: 'Configure UPI ID, QR codes, and bank transfer details for subscription payments',
    path: '/admin/settings-hub?tab=payment',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30'
  },
  { 
    id: 'system', 
    label: 'System Settings', 
    icon: Cpu, 
    description: 'Manage subscription plans, mining rates, referral bonuses & service charges',
    path: '/admin/settings-hub?tab=system',
    color: 'from-purple-500 to-violet-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30'
  },
  { 
    id: 'web', 
    label: 'Web Settings', 
    icon: Globe, 
    description: 'Homepage content, SEO settings, banners and app configuration',
    path: '/admin/settings-hub?tab=web',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30'
  },
  { 
    id: 'social', 
    label: 'Social Media', 
    icon: Share2, 
    description: 'Connect social media profiles and configure sharing options',
    path: '/admin/settings-hub?tab=social',
    color: 'from-pink-500 to-rose-500',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30'
  },
  { 
    id: 'redeem', 
    label: 'Redeem Safety', 
    icon: Shield, 
    description: 'Set withdrawal limits, security thresholds and redemption rules',
    path: '/admin/settings-hub?tab=redeem',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30'
  },
  { 
    id: 'video-ads', 
    label: 'Video Ads', 
    icon: Video, 
    description: 'Manage video advertisements, placements and revenue tracking',
    path: '/admin/settings-hub?tab=video-ads',
    color: 'from-red-500 to-orange-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30'
  },
  { 
    id: 'prc-rain', 
    label: 'PRC Rain Drop', 
    icon: CloudRain, 
    description: 'Configure PRC rain events, drop rates and distribution settings',
    path: '/admin/settings-hub?tab=prc-rain',
    color: 'from-indigo-500 to-purple-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30'
  }
];

// Import the actual settings pages
import AdminPaymentSettings from './AdminPaymentSettings';
import AdminSystemSettings from './AdminSystemSettings';
import AdminWebSettings from './AdminWebSettings';
import AdminSocialMediaSettings from './AdminSocialMediaSettings';
import AdminRedeemSettings from './AdminRedeemSettings';
import AdminVideoAds from './AdminVideoAds';
import AdminPRCRain from './AdminPRCRain';

const AdminSettingsHub = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab');

  // If a tab is selected, render that settings page
  if (activeTab) {
    const renderSettingsPage = () => {
      switch (activeTab) {
        case 'payment':
          return <AdminPaymentSettings user={user} />;
        case 'system':
          return <AdminSystemSettings user={user} />;
        case 'web':
          return <AdminWebSettings user={user} />;
        case 'social':
          return <AdminSocialMediaSettings user={user} />;
        case 'redeem':
          return <AdminRedeemSettings user={user} />;
        case 'video-ads':
          return <AdminVideoAds user={user} onLogout={onLogout} />;
        case 'prc-rain':
          return <AdminPRCRain user={user} />;
        default:
          return null;
      }
    };

    const currentCategory = settingsCategories.find(c => c.id === activeTab);

    return (
      <div className="min-h-screen bg-gray-950">
        {/* Breadcrumb Header */}
        <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <button 
                onClick={() => navigate('/admin/settings-hub')}
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <span className="text-white font-medium">{currentCategory?.label}</span>
            </div>
          </div>
        </div>

        {/* Quick Tab Navigation */}
        <div className="bg-gray-900/50 border-b border-gray-800 overflow-x-auto scrollbar-hide">
          <div className="px-4 py-2 flex gap-2">
            {settingsCategories.map((cat) => {
              const Icon = cat.icon;
              const isActive = cat.id === activeTab;
              return (
                <button
                  key={cat.id}
                  onClick={() => navigate(cat.path)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all text-sm ${
                    isActive
                      ? `bg-gradient-to-r ${cat.color} text-white`
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Content */}
        <div className="p-4">
          {renderSettingsPage()}
        </div>
      </div>
    );
  }

  // Main Settings Hub View (no tab selected)
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="px-4 py-6 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin')}
            className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Settings className="w-6 h-6 text-purple-500" />
              Settings Hub
            </h1>
            <p className="text-gray-500 text-sm mt-1">Manage all system configurations in one place</p>
          </div>
        </div>
      </div>

      {/* Settings Cards Grid */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {settingsCategories.map((category, index) => {
            const Icon = category.icon;
            return (
              <motion.button
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(category.path)}
                className={`group relative overflow-hidden rounded-2xl p-5 text-left transition-all hover:scale-[1.02] ${category.bgColor} border ${category.borderColor}`}
              >
                {/* Background Gradient on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                {/* Content */}
                <h3 className="text-white font-semibold text-lg mb-2 flex items-center gap-2">
                  {category.label}
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {category.description}
                </p>
              </motion.button>
            );
          })}
        </div>

        {/* Quick Tips */}
        <div className="mt-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold mb-2">Quick Tips</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• Use <span className="text-purple-400">Payment Settings</span> to update UPI and bank details</li>
                <li>• Configure subscription pricing in <span className="text-purple-400">System Settings</span></li>
                <li>• Set withdrawal limits in <span className="text-purple-400">Redeem Safety</span></li>
                <li>• Manage PRC distribution events in <span className="text-purple-400">PRC Rain Drop</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsHub;
