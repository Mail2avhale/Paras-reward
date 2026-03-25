import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Settings, CreditCard, Cpu, Globe, Share2, Shield, Video,
  ChevronRight, ArrowLeft, Sparkles, Receipt, Building2, ToggleLeft,
  Play, Bell, UserX, RefreshCw, Clock
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Lazy load components for embedded usage
const AdminSettings = lazy(() => import('./AdminSettings'));
const AdminSystemSettings = lazy(() => import('./AdminSystemSettings'));

const settingsCategories = [
  { 
    id: 'payment', 
    label: 'Payment Settings', 
    icon: CreditCard, 
    description: 'UPI ID, QR Code, Bank Transfer details for subscriptions',
    path: '/admin/settings-hub?tab=payment',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30'
  },
  { 
    id: 'redemption', 
    label: 'Redemption Charges', 
    icon: Receipt, 
    description: 'Processing fee, Admin charges for Bill Payments & Gift Vouchers',
    path: '/admin/settings-hub?tab=redemption',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30'
  },
  { 
    id: 'contact', 
    label: 'Contact Settings', 
    icon: Building2, 
    description: 'Company name, Address, Email, Phone for Landing page & Contact Us',
    path: '/admin/contact-settings',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30'
  },
  { 
    id: 'system', 
    label: 'System Settings', 
    icon: Cpu, 
    description: 'Subscription plans, Mining rates, Referral bonus, Registration control',
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
    color: 'from-cyan-500 to-teal-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30'
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
    description: 'Set redemption limits, security thresholds and rules',
    path: '/admin/redeem-settings',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30'
  },
  { 
    id: 'video-ads', 
    label: 'Video Ads', 
    icon: Video, 
    description: 'Manage video advertisements, placements and revenue tracking',
    path: '/admin/video-ads',
    color: 'from-red-500 to-orange-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30'
  },
  { 
    id: 'service-toggles', 
    label: 'Service On/Off', 
    icon: ToggleLeft, 
    description: 'Enable or disable services like Mobile Recharge, DTH, EMI, Gift Cards, Bank Redeem',
    path: '/admin/service-toggles',
    color: 'from-rose-500 to-red-500',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30'
  }
];

// Note: Individual settings pages have been consolidated into AdminSettings
// Keeping Hub as navigation only, actual settings are in AdminSettings page
const AdminSettingsHub = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab');

  // Tabs that should render AdminSettings component directly
  const adminSettingsTabs = ['payment', 'web', 'social', 'redemption'];
  
  // System tab renders AdminSystemSettings (PRC Rate, Mining, Redeem Limit)
  const systemTab = 'system';
  
  // Tabs that redirect to separate pages
  const externalRoutes = {
    'redeem-safety': '/admin/redeem-settings',
    'video-ads': '/admin/video-ads',
    'redeem': '/admin/redeem-settings',
  };

  // If a tab that needs external redirect is selected
  useEffect(() => {
    if (activeTab && externalRoutes[activeTab]) {
      navigate(externalRoutes[activeTab]);
    }
  }, [activeTab, navigate]);

  // If redirecting to external page, show loading
  if (activeTab && externalRoutes[activeTab]) {
    return (
      <div className="min-h-screen bg-gray-950 text-slate-800 p-6 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // If system tab is selected, render AdminSystemSettings
  if (activeTab === systemTab) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-gray-950 text-slate-800 p-6 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
        </div>
      }>
        <AdminSystemSettings />
      </Suspense>
    );
  }

  // If other embedded tab is selected, render AdminSettings
  if (activeTab && adminSettingsTabs.includes(activeTab)) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-gray-950 text-slate-800 p-6 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
        </div>
      }>
        <AdminSettings user={user} />
      </Suspense>
    );
  }

  // If unknown tab, show message
  if (activeTab) {
    return (
      <div className="min-h-screen bg-gray-950 text-slate-800 p-6">
        <button 
          onClick={() => navigate('/admin/settings-hub')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Settings Hub
        </button>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="text-xl font-bold mb-4 capitalize">{activeTab.replace('-', ' ')} Settings</h2>
          <p className="text-slate-500">
            This settings section is being moved to Admin Settings.
          </p>
          <button
            onClick={() => navigate('/admin/settings-hub?tab=payment')}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-slate-800"
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
      <div className="px-4 py-6 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin')}
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Settings className="w-6 h-6 text-purple-500" />
              Settings Hub
            </h1>
            <p className="text-slate-500 text-sm mt-1">Manage all system configurations in one place</p>
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
                  <Icon className="w-6 h-6 text-slate-800" />
                </div>
                
                {/* Content */}
                <h3 className="text-slate-800 font-semibold text-lg mb-2 flex items-center gap-2">
                  {category.label}
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-800 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {category.description}
                </p>
              </motion.button>
            );
          })}
        </div>

        {/* System Tasks - Manual Cron Triggers */}
        <SystemTasksSection />

        {/* Quick Tips */}
        <div className="mt-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-slate-800 font-semibold mb-2">Quick Tips</h3>
              <ul className="text-slate-500 text-sm space-y-1">
                <li>• Use <span className="text-purple-400">Payment Settings</span> to update UPI and bank details</li>
                <li>• Configure subscription pricing in <span className="text-purple-400">System Settings</span></li>
                <li>• Set redemption limits in <span className="text-purple-400">Redeem Safety</span></li>
                <li>• Run <span className="text-purple-400">System Tasks</span> daily for notifications & cleanup</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// System Tasks Component for Manual Cron Triggers
const SystemTasksSection = () => {
  const [loading, setLoading] = useState({});
  const [lastRun, setLastRun] = useState({});

  const tasks = [
    {
      id: 'renewal-notifications',
      name: 'Send Renewal Notifications',
      description: 'Notify users whose subscription is about to expire',
      icon: Bell,
      endpoint: '/admin/trigger-renewal-notifications',
      color: 'amber',
      recommended: 'Daily at 9:00 AM'
    },
    {
      id: 'expired-subscriptions',
      name: 'Check Expired Subscriptions',
      description: 'Deactivate subscriptions that have expired',
      icon: UserX,
      endpoint: '/admin/check-expired-subscriptions',
      color: 'red',
      recommended: 'Daily at 12:00 AM'
    }
  ];

  const runTask = async (task) => {
    setLoading(prev => ({ ...prev, [task.id]: true }));
    try {
      const response = await axios.post(`${API}${task.endpoint}`);
      toast.success(`✅ ${task.name} completed successfully!`, {
        description: response.data?.message || 'Task executed',
        duration: 5000
      });
      setLastRun(prev => ({ ...prev, [task.id]: new Date().toLocaleString() }));
    } catch (error) {
      console.error(`Error running ${task.name}:`, error);
      toast.error(`❌ ${task.name} failed`, {
        description: error.response?.data?.detail || error.message
      });
    } finally {
      setLoading(prev => ({ ...prev, [task.id]: false }));
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-400" />
        System Tasks (Manual Trigger)
      </h2>
      <p className="text-slate-500 text-sm mb-4">
        Run these tasks daily to keep the system healthy. Click to run manually.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tasks.map((task) => {
          const Icon = task.icon;
          const isLoading = loading[task.id];
          const colorClasses = {
            amber: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20',
            red: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20',
            blue: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20'
          };
          
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-5 border transition-all ${colorClasses[task.color]}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-${task.color}-500/20 flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 text-${task.color}-400`} />
                  </div>
                  <div>
                    <h3 className="text-slate-800 font-semibold">{task.name}</h3>
                    <p className="text-slate-500 text-sm mt-1">{task.description}</p>
                    <p className="text-slate-500 text-xs mt-2">
                      <span className="text-blue-400">Recommended:</span> {task.recommended}
                    </p>
                    {lastRun[task.id] && (
                      <p className="text-green-400 text-xs mt-1">
                        Last run: {lastRun[task.id]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => runTask(task)}
                disabled={isLoading}
                className={`mt-4 w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                  isLoading 
                    ? 'bg-gray-700 text-slate-500 cursor-not-allowed' 
                    : `bg-${task.color}-500 hover:bg-${task.color}-600 text-slate-800`
                }`}
                data-testid={`run-${task.id}`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Now
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminSettingsHub;
