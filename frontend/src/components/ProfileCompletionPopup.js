import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, User, FileText, CheckCircle, ArrowRight, Camera, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ProfileCompletionPopup = ({ user, isOpen, onClose }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  // Calculate what's missing
  const getMissingItems = () => {
    const items = [];
    
    if (!user?.name || user.name === 'User') {
      items.push({ key: 'name', label: 'Add Your Name', icon: User, route: '/profile', section: 'personal' });
    }
    if (!user?.mobile && !user?.phone) {
      items.push({ key: 'phone', label: 'Add Phone Number', icon: User, route: '/profile', section: 'contact' });
    }
    if (!user?.address_line1 && !user?.state && !user?.pincode) {
      items.push({ key: 'address', label: 'Add Address', icon: User, route: '/profile', section: 'contact' });
    }
    if (user?.kyc_status !== 'verified' && user?.kyc_status !== 'approved') {
      items.push({ key: 'kyc', label: 'Complete KYC', icon: FileText, route: '/profile', section: 'kyc' });
    }
    
    return items;
  };

  const missingItems = getMissingItems();
  const completedCount = 5 - missingItems.length;
  const percentage = Math.round((completedCount / 5) * 100);

  // Don't show if complete or no user
  if (!isOpen || !user || missingItems.length === 0) return null;

  const handleAction = (item) => {
    onClose();
    navigate(item.route);
    // Store which section to open
    localStorage.setItem('profile_section', item.section);
  };

  const handleSkip = () => {
    // Store that user skipped, don't show again for 24 hours
    localStorage.setItem('profile_popup_skipped', Date.now().toString());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleSkip} />

      {/* Popup */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
          <button 
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                {percentage}%
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold">Complete Your Profile</h2>
              <p className="text-white/80 text-sm">Unlock all features & rewards</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="text-white/70 text-xs mt-1">{completedCount} of 5 steps completed</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">What's missing:</h3>
          
          <div className="space-y-3">
            {missingItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => handleAction(item)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-purple-50 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                      <Icon className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="font-medium text-gray-900">{item.label}</span>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
                </button>
              );
            })}
          </div>

          {/* Benefits */}
          <div className="mt-6 p-4 bg-green-50 rounded-xl">
            <h4 className="font-semibold text-green-900 text-sm mb-2">Why complete your profile?</h4>
            <ul className="text-xs text-green-800 space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" /> Unlock gift voucher redemption
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" /> Enable bill payments
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" /> Get verified badge
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              onClick={handleSkip}
              className="flex-1"
            >
              Later
            </Button>
            <Button
              onClick={() => handleAction(missingItems[0])}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              Complete Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionPopup;
