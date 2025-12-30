import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, User, FileText, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ProfileCompletionBanner = ({ user, onDismiss, onQuickKYC }) => {
  const navigate = useNavigate();

  // Calculate profile completion
  const getCompletionStatus = () => {
    const checks = [
      { key: 'name', label: 'Name', complete: !!user?.name && user.name !== 'User' },
      { key: 'phone', label: 'Phone', complete: !!user?.phone },
      { key: 'email', label: 'Email', complete: !!user?.email },
      { key: 'address', label: 'Address', complete: !!user?.address_line1 || !!user?.state },
      { key: 'kyc', label: 'KYC Verified', complete: user?.kyc_status === 'verified' || user?.kyc_status === 'approved' }
    ];

    const completed = checks.filter(c => c.complete).length;
    const percentage = Math.round((completed / checks.length) * 100);
    const incomplete = checks.filter(c => !c.complete);

    return { checks, completed, total: checks.length, percentage, incomplete };
  };

  const status = getCompletionStatus();

  // Don't show if 100% complete
  if (status.percentage === 100) return null;

  const getBannerStyle = () => {
    if (status.percentage < 40) return 'from-red-500 to-orange-500';
    if (status.percentage < 70) return 'from-yellow-500 to-orange-500';
    return 'from-blue-500 to-purple-500';
  };

  const getMessage = () => {
    if (status.percentage < 40) return 'Complete your profile to unlock all features!';
    if (status.percentage < 70) return 'Almost there! Finish your profile setup.';
    return 'Just a few more steps to complete your profile.';
  };

  return (
    <div className={`relative bg-gradient-to-r ${getBannerStyle()} rounded-2xl p-4 mb-4 shadow-lg overflow-hidden`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Profile Incomplete</h3>
              <p className="text-white/80 text-xs">{getMessage()}</p>
            </div>
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="p-1 hover:bg-white/20 rounded-full">
              <X className="h-4 w-4 text-white/70" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-white/80 mb-1">
            <span>Progress</span>
            <span>{status.percentage}% Complete</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${status.percentage}%` }}
            />
          </div>
        </div>

        {/* Missing Items */}
        <div className="flex flex-wrap gap-2 mb-3">
          {status.incomplete.slice(0, 3).map((item) => (
            <span key={item.key} className="px-2 py-1 bg-white/20 rounded-full text-xs text-white flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {item.label}
            </span>
          ))}
          {status.incomplete.length > 3 && (
            <span className="px-2 py-1 bg-white/20 rounded-full text-xs text-white">
              +{status.incomplete.length - 3} more
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {status.incomplete.some(i => i.key === 'kyc') && onQuickKYC && (
            <Button
              onClick={onQuickKYC}
              variant="outline"
              className="flex-1 bg-white/20 border-white/30 text-white hover:bg-white/30 font-semibold"
              size="sm"
            >
              <FileText className="h-4 w-4 mr-1" />
              Quick KYC
            </Button>
          )}
          <Button
            onClick={() => navigate('/profile')}
            className={`${status.incomplete.some(i => i.key === 'kyc') && onQuickKYC ? 'flex-1' : 'w-full'} bg-white text-gray-900 hover:bg-white/90 font-semibold`}
            size="sm"
          >
            Complete Profile
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionBanner;
