import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Users, Copy, Check, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ReferralsEnhanced = ({ user }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  
  // Get referral code from user
  const referralCode = user?.referral_code || '';
  const referralLink = `https://parasreward.com/register?ref=${referralCode}`;
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Paras Reward',
          text: 'Join Paras Reward and start earning!',
          url: referralLink
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-slate-200 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/rewards')}
            className="p-2 rounded-full hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-lg font-semibold text-slate-800">Referrals</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        
        {/* Notice Card */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-600" />
          </div>
          
          <h2 className="text-lg font-bold text-slate-800 mb-2">
            Referral Bonus System Updated
          </h2>
          
          <p className="text-slate-600 text-sm mb-4">
            Referral bonus, Single Leg bonus, and Level bonus (L1, L2, L3) features have been removed. 
            New rewards system coming soon!
          </p>
        </div>
        
        {/* Referral Code Card - Still Active for Sharing */}
        {referralCode && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-slate-800">Your Referral Code</h3>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center mb-4">
              <p className="text-2xl font-bold text-emerald-600 tracking-wider">
                {referralCode}
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={handleCopy}
                variant="outline"
                className="flex-1 border-slate-300"
              >
                {copied ? (
                  <><Check className="w-4 h-4 mr-2 text-emerald-500" /> Copied!</>
                ) : (
                  <><Copy className="w-4 h-4 mr-2" /> Copy Link</>
                )}
              </Button>
              
              <Button
                onClick={handleShare}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
            
            <p className="text-xs text-slate-500 text-center mt-4">
              Share your code with friends to help them join Paras Reward
            </p>
          </div>
        )}
        
        {/* Back Button */}
        <Button
          onClick={() => navigate('/rewards')}
          variant="outline"
          className="w-full border-slate-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Rewards
        </Button>
      </div>
    </div>
  );
};

export default ReferralsEnhanced;
