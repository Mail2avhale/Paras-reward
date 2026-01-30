import React, { useState, useEffect } from 'react';
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
    description: 'UPI ID, QR Code, Bank Transfer details for subscriptions',
    path: '/admin/settings-hub?tab=payment',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/10/10',
    borderColor: 'border-amber-500/30'
  },
  { 
    id: 'system', 
    label: 'System Settings', 
    icon: Cpu, 
    description: 'Subscription plans, Mining rates, Referral bonus, Registration control',
    path: '/admin/settings-hub?tab=system',
    color: 'from-purple-500 to-violet-500',
    bgColor: 'bg-purple-500/10/10',
    borderColor: 'border-purple-500/30'
  },
  { 
    id: 'web', 
    label: 'Web Settings', 
    icon: Globe, 
    description: 'Homepage content, SEO settings, banners and app configuration',
    path: '/admin/settings-hub?tab=web',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10/10',
    borderColor: 'border-blue-500/30'
  },
  { 
    id: 'social', 
    label: 'Social Media', 
    icon: Share2, 
    description: 'Connect social media profiles and configure sharing options',
    path: '/admin/settings-hub?tab=social',
    color: 'from-pink-500 to-rose-500',
    bgColor: 'bg-pink-500/10/10',
    borderColor: 'border-pink-500/30'
  },
  { 
    id: 'redeem', 
    label: 'Redeem Safety', 
    icon: Shield, 
    description: 'Set withdrawal limits, security thresholds and redemption rules',
    path: '/admin/settings-hub?tab=redeem',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10/10',
    borderColor: 'border-emerald-500/30'
  },
  { 
    id: 'video-ads', 
    label: 'Video Ads', 
    icon: Video, 
    description: 'Manage video advertisements, placements and revenue tracking',
    path: '/admin/settings-hub?tab=video-ads',
    color: 'from-red-500 to-orange-500',
    bgColor: 'bg-red-500/10/10',
    borderColor: 'border-red-500/30'
  },
  { 
    id: 'prc-rain', 
    label: 'PRC Rain Drop', 
    icon: CloudRain, 
    description: 'Configure PRC rain events, drop rates and distribution settings',
    path: '/admin/settings-hub?tab=prc-rain',
    color: 'from-indigo-500 to-purple-500',
    bgColor: 'bg-indigo-500/10/10',
    borderColor: 'border-indigo-500/30'
  }
];

// Note: Individual settings pages have been consolidated into AdminSettings
// Keeping Hub as navigation only, actual settings are in AdminSettings page
const AdminSettingsHub = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab');

  // Map tabs to their actual routes
  const tabRoutes = {
    'redeem-safety': '/admin/redeem-limits',
    'prc-rain': '/admin/prc-rain',
    'payment': '/admin/settings?tab=payment',
    'system': '/admin/settings?tab=system',
    'web': '/admin/settings?tab=web',
    'social': '/admin/settings?tab=social',
    'video-ads': '/admin/video-ads',
  };

  // If a tab is selected, redirect to the actual page
  useEffect(() => {
    if (activeTab && tabRoutes[activeTab]) {
      navigate(tabRoutes[activeTab]);
    }
  }, [activeTab, navigate]);

  // If tab is being redirected, show loading
  if (activeTab && tabRoutes[activeTab]) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // If unknown tab, show message
  if (activeTab) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <button 
          onClick={() => navigate('/admin/settings-hub')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Settings Hub
        </button>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold mb-4 capitalize">{activeTab.replace('-', ' ')} Settings</h2>
          <p className="text-gray-400">
            This settings section is being moved to Admin Settings.
          </p>
          <button
            onClick={() => navigate('/admin/settings')}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-white"
          >
            Go to Admin Settings
          </button>
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
