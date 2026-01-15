import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Share2, Copy, Check, MessageCircle, Send, X, Download,
  Gift, Coins, ShoppingBag, Users, Sparkles, Crown, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

const APP_URL = process.env.REACT_APP_BACKEND_URL || 'https://parasreward.com';

const AppShareCard = ({ user, onClose }) => {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef(null);

  const referralCode = user?.referral_code || 'PARAS2025';
  const referralLink = `${APP_URL}/register?ref=${referralCode}`;
  const userName = user?.full_name || user?.name || 'Member';
  
  // Real app usage data
  const prcBalance = user?.prc_balance?.toLocaleString() || '0';
  const totalReferrals = user?.direct_referrals || user?.referral_count || 0;
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Jan 2025';
  const subscriptionPlan = user?.subscription_plan || user?.membership_type || 'Explorer';

  const shareMessage = `🎁 Join PARAS REWARD - India's Next-Generation Trusted Reward Platform!

✨ Use my code: ${referralCode}
🔗 ${referralLink}

💰 Earn Daily Rewards
🛒 Shop & Save
💳 Pay Bills
🎁 Redeem Vouchers

Download now & start earning!`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const shareOnWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, '_blank');
  };

  const shareOnTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareMessage)}`, '_blank');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join PARAS REWARD',
          text: shareMessage,
          url: referralLink
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyLink();
        }
      }
    } else {
      copyLink();
    }
  };

  const features = [
    { icon: Coins, text: 'Earn PRC Daily', color: 'text-amber-400' },
    { icon: Gift, text: 'Redeem Gift Vouchers', color: 'text-pink-400' },
    { icon: ShoppingBag, text: 'Shop & Save', color: 'text-blue-400' },
    { icon: Users, text: '5-Level Referral Bonus', color: 'text-green-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Main Card */}
        <div ref={cardRef} className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-700">
          
          {/* Header with Glow */}
          <div className="relative px-6 pt-6 pb-4">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/20 blur-3xl rounded-full" />
            <div className="relative text-center">
              <h2 className="text-2xl font-bold text-white mb-1">Share & Earn</h2>
              <p className="text-gray-400 text-sm">Invite friends, get bonus rewards!</p>
            </div>
          </div>

          {/* Mock Credit Card with Real Usage */}
          <div className="px-6 py-4">
            <div className="relative">
              {/* Card Glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 blur-xl opacity-30 rounded-2xl" />
              
              {/* Credit Card */}
              <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl p-5 shadow-xl overflow-hidden">
                {/* Card Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
                      </pattern>
                    </defs>
                    <rect width="100" height="100" fill="url(#grid)" />
                  </svg>
                </div>
                
                {/* Card Header - Chip & Plan Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-9 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-md flex items-center justify-center">
                    <div className="w-8 h-6 border-2 border-yellow-600/50 rounded-sm" />
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                    <p className="text-white text-xs font-bold uppercase">{subscriptionPlan}</p>
                  </div>
                </div>

                {/* PRC Balance - Main Display */}
                <div className="mb-4">
                  <p className="text-white/60 text-xs mb-1">PRC BALANCE</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-white text-3xl font-bold">{prcBalance}</p>
                    <span className="text-white/70 text-sm">PRC</span>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
                    <p className="text-white/60 text-[10px]">REFERRALS</p>
                    <p className="text-white font-bold">{totalReferrals}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
                    <p className="text-white/60 text-[10px]">MEMBER SINCE</p>
                    <p className="text-white font-bold text-sm">{memberSince}</p>
                  </div>
                </div>

                {/* Card Footer - Name & Brand */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-white/60 text-[10px] mb-0.5">MEMBER</p>
                    <p className="text-white font-semibold uppercase tracking-wider text-xs">
                      {userName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-lg tracking-wider">PARAS</p>
                    <p className="text-white/70 text-xs">REWARD</p>
                  </div>
                </div>

                {/* Referral Code Strip */}
                <div className="mt-3 pt-3 border-t border-white/20">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-xs">CODE</span>
                    <span className="text-white font-mono font-bold tracking-wider">{referralCode}</span>
                  </div>
                </div>

                {/* Decorative Circles */}
                <div className="absolute -bottom-6 -right-6 w-24 h-24 border-4 border-white/10 rounded-full" />
                <div className="absolute -bottom-3 -right-3 w-16 h-16 border-4 border-white/10 rounded-full" />
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="px-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-2 bg-gray-800/50 rounded-xl p-3"
                >
                  <feature.icon className={`w-4 h-4 ${feature.color}`} />
                  <span className="text-gray-300 text-xs font-medium">{feature.text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* QR Code Section */}
          <div className="px-6 py-4 flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl">
              <QRCodeSVG 
                value={referralLink} 
                size={80}
                level="M"
              />
            </div>
            <div className="flex-1">
              <p className="text-gray-400 text-xs mb-1">Scan to Join</p>
              <p className="text-white font-mono text-xs break-all bg-gray-800 rounded-lg px-2 py-1">
                {referralLink.replace('https://', '')}
              </p>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="p-6 bg-gray-800/50 space-y-3">
            {/* Main Share Button */}
            <button
              onClick={shareNative}
              className="w-full flex items-center justify-center gap-3 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all shadow-lg shadow-amber-500/25"
            >
              <Share2 className="w-5 h-5" />
              Share Now
            </button>

            {/* Quick Share Options */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={shareOnWhatsApp}
                className="flex flex-col items-center gap-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-xs">WhatsApp</span>
              </button>
              <button
                onClick={shareOnTelegram}
                className="flex flex-col items-center gap-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
              >
                <Send className="w-5 h-5" />
                <span className="text-xs">Telegram</span>
              </button>
              <button
                onClick={copyLink}
                className="flex flex-col items-center gap-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
              >
                {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                <span className="text-xs">{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-center text-gray-500 text-sm mt-4">
          India&apos;s Next-Generation Trusted Reward Platform
        </p>
      </motion.div>
    </motion.div>
  );
};

export default AppShareCard;
