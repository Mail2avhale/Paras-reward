import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Share2, Copy, Check, MessageCircle, Send, X,
  Gift, Coins, ShoppingBag, Users, Crown
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

const APP_URL = process.env.REACT_APP_BACKEND_URL || 'https://parasreward.com';

const AppShareCard = ({ user, onClose }) => {
  const [copied, setCopied] = useState(false);

  const referralCode = user?.referral_code || 'PARAS2025';
  const referralLink = `${APP_URL}/register?ref=${referralCode}`;
  const userName = user?.full_name || user?.name || 'Member';
  
  // Real app usage data
  const prcBalance = user?.prc_balance?.toFixed(2) || '0.00';
  const totalReferrals = user?.direct_referrals || user?.referral_count || 0;
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Jan 2025';
  const subscriptionPlan = user?.subscription_plan || user?.membership_type || 'Explorer';
  const multiplier = user?.mining_multiplier || user?.multiplier || '1.0';

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
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-700">
          
          {/* Header with Glow */}
          <div className="relative px-6 pt-6 pb-4">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/20 blur-3xl rounded-full" />
            <div className="relative text-center">
              <h2 className="text-2xl font-bold text-white mb-1">Share & Earn</h2>
              <p className="text-gray-400 text-sm">Invite friends, get bonus rewards!</p>
            </div>
          </div>

          {/* Dashboard Style Card - Exact Replica */}
          <div className="px-4 py-3">
            <div className="relative overflow-hidden rounded-2xl" style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d44 30%, #4a3f35 60%, #6b5a3e 100%)'
            }}>
              {/* Decorative Star */}
              <svg className="absolute top-8 left-1/3 w-16 h-16 text-amber-500/20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              
              {/* Decorative Diamond */}
              <svg className="absolute top-6 right-8 w-20 h-20 text-amber-500/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" />
              </svg>
              
              {/* Decorative Dots */}
              <div className="absolute top-12 right-1/3 flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/30"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/20"></div>
              </div>
              
              {/* Card Content */}
              <div className="relative p-5">
                {/* Top Row - Logo & Badge */}
                <div className="flex items-start justify-between mb-6">
                  {/* PARAS REWARD Logo */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg">
                    <div className="relative">
                      <span className="text-yellow-400 text-lg">✦</span>
                      <span className="absolute -top-1 -right-1 text-yellow-300 text-xs">✦</span>
                    </div>
                    <div>
                      <span className="text-white font-bold text-sm tracking-wide">PA</span>
                      <span className="text-yellow-400 font-bold text-sm">₹</span>
                      <span className="text-white font-bold text-sm tracking-wide">AS</span>
                      <p className="text-[8px] text-blue-200 -mt-1 tracking-widest">REWARD</p>
                    </div>
                  </div>
                  
                  {/* Elite Badge */}
                  <div className="bg-gradient-to-r from-amber-600/80 to-amber-700/80 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-2 border border-amber-500/50">
                    <Crown className="w-4 h-4 text-amber-300" />
                    <span className="text-amber-100 font-bold text-sm uppercase tracking-wider">{subscriptionPlan}</span>
                  </div>
                </div>
                
                {/* Balance Section */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full bg-gray-600/50 flex items-center justify-center">
                      <span className="text-gray-400 text-xs">👁</span>
                    </div>
                    <span className="text-gray-400 text-xs uppercase tracking-widest">Balance</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-white text-5xl font-bold tracking-tight">{prcBalance}</span>
                    <span className="text-amber-500 text-xl font-semibold">PRC</span>
                  </div>
                </div>
                
                {/* Bottom Row - Card Holder & Multiplier */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Card Holder</p>
                    <p className="text-white font-bold text-lg uppercase tracking-wide">{userName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Multiplier</p>
                    <p className="text-amber-500 font-bold text-2xl">{multiplier}x</p>
                  </div>
                </div>
                
                {/* Decorative Bottom Curves */}
                <div className="absolute bottom-0 right-0 w-32 h-32">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-amber-500/10">
                    <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="1" />
                    <circle cx="100" cy="100" r="40" fill="none" stroke="currentColor" strokeWidth="1" />
                  </svg>
                </div>
              </div>
              
              {/* Referral Code Strip */}
              <div className="bg-black/30 px-5 py-3 flex items-center justify-between border-t border-amber-500/20">
                <span className="text-gray-400 text-xs uppercase tracking-wider">Referral Code</span>
                <span className="text-amber-400 font-mono font-bold text-lg tracking-widest">{referralCode}</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="px-4 py-3">
            <div className="grid grid-cols-2 gap-2">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-2 bg-gray-800/50 rounded-xl p-2.5"
                >
                  <feature.icon className={`w-4 h-4 ${feature.color}`} />
                  <span className="text-gray-300 text-xs font-medium">{feature.text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* QR Code Section */}
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl">
              <QRCodeSVG 
                value={referralLink} 
                size={70}
                level="M"
              />
            </div>
            <div className="flex-1">
              <p className="text-gray-400 text-xs mb-1">Scan to Join</p>
              <p className="text-white font-mono text-[10px] break-all bg-gray-800 rounded-lg px-2 py-1">
                {referralLink.replace('https://', '')}
              </p>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="p-4 bg-gray-800/50 space-y-3">
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
                className="flex flex-col items-center gap-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-[10px]">WhatsApp</span>
              </button>
              <button
                onClick={shareOnTelegram}
                className="flex flex-col items-center gap-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
              >
                <Send className="w-5 h-5" />
                <span className="text-[10px]">Telegram</span>
              </button>
              <button
                onClick={copyLink}
                className="flex flex-col items-center gap-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
              >
                {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                <span className="text-[10px]">{copied ? 'Copied!' : 'Copy Link'}</span>
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
