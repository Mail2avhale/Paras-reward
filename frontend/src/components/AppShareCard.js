import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Share2, Copy, Check, MessageCircle, Send, X, Download,
  Gift, Coins, ShoppingBag, Users, Crown
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';

const APP_URL = process.env.REACT_APP_BACKEND_URL || 'https://parasreward.com';

const AppShareCard = ({ user, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const cardRef = useRef(null);

  const referralCode = user?.referral_code || 'PARAS2025';
  const referralLink = `${APP_URL}/register?ref=${referralCode}`;
  const userName = user?.full_name || user?.name || 'Member';
  
  // Real app usage data
  const prcBalance = user?.prc_balance?.toFixed(2) || '0.00';
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

  // Share with real image
  const shareWithImage = async () => {
    if (!cardRef.current) return;
    
    setIsSharing(true);
    try {
      // Capture the card as image
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#111827',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      // Convert to blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'paras-reward-card.png', { type: 'image/png' });
      
      // Try native share with image
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Join PARAS REWARD',
          text: shareMessage,
          files: [file]
        });
        toast.success('Shared successfully!');
      } else {
        // Fallback: Download image
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'paras-reward-card.png';
        link.href = url;
        link.click();
        toast.success('Card downloaded! Share it manually.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Share failed, copying link instead');
        copyLink();
      }
    } finally {
      setIsSharing(false);
    }
  };

  const features = [
    { icon: Coins, text: 'Earn PRC Daily', color: 'text-amber-400' },
    { icon: Gift, text: 'Gift Vouchers', color: 'text-pink-400' },
    { icon: ShoppingBag, text: 'Shop & Save', color: 'text-blue-400' },
    { icon: Users, text: 'Referral Bonus', color: 'text-green-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-sm my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 bg-gray-800/80 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors z-20"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Shareable Card Container */}
        <div ref={cardRef} className="bg-gray-900 rounded-2xl overflow-hidden">
          
          {/* Header */}
          <div className="px-4 pt-4 pb-2 text-center">
            <h2 className="text-lg font-bold text-white">Share & Earn Rewards</h2>
            <p className="text-gray-500 text-xs">Invite friends, get bonus!</p>
          </div>

          {/* Dashboard Style Card */}
          <div className="px-3 py-2">
            <div className="relative overflow-hidden rounded-xl" style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d44 30%, #4a3f35 60%, #6b5a3e 100%)'
            }}>
              {/* Decorative Elements */}
              <svg className="absolute top-6 left-1/4 w-12 h-12 text-amber-500/15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <svg className="absolute top-4 right-6 w-14 h-14 text-amber-500/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" />
              </svg>
              
              {/* Card Content */}
              <div className="relative p-4">
                {/* Top Row - Real Logo & Badge */}
                <div className="flex items-center justify-between mb-4">
                  {/* Real Logo */}
                  <img 
                    src="/icons/icon-72x72.png" 
                    alt="PARAS REWARD" 
                    className="w-12 h-12 rounded-lg"
                  />
                  
                  {/* Plan Badge */}
                  <div className="bg-gradient-to-r from-amber-600/90 to-amber-700/90 rounded-full px-3 py-1 flex items-center gap-1.5 border border-amber-500/50">
                    <Crown className="w-3.5 h-3.5 text-amber-200" />
                    <span className="text-amber-100 font-bold text-xs uppercase">{subscriptionPlan}</span>
                  </div>
                </div>
                
                {/* Balance */}
                <div className="mb-4">
                  <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Balance</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-white text-3xl font-bold">{prcBalance}</span>
                    <span className="text-amber-500 text-base font-semibold">PRC</span>
                  </div>
                </div>
                
                {/* Card Holder & Multiplier */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-gray-500 text-[9px] uppercase tracking-wider">Card Holder</p>
                    <p className="text-white font-bold text-sm uppercase">{userName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-[9px] uppercase tracking-wider">Multiplier</p>
                    <p className="text-amber-500 font-bold text-xl">{multiplier}x</p>
                  </div>
                </div>
                
                {/* Decorative Curves */}
                <div className="absolute bottom-0 right-0 w-20 h-20 opacity-20">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-amber-500">
                    <circle cx="100" cy="100" r="50" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="100" cy="100" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
              </div>
              
              {/* Referral Code */}
              <div className="bg-black/40 px-4 py-2 flex items-center justify-between border-t border-amber-500/20">
                <span className="text-gray-400 text-[10px] uppercase">Code</span>
                <span className="text-amber-400 font-mono font-bold tracking-wider">{referralCode}</span>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="px-3 py-2">
            <div className="grid grid-cols-4 gap-1.5">
              {features.map((feature, index) => (
                <div key={index} className="flex flex-col items-center gap-1 bg-gray-800/50 rounded-lg py-2 px-1">
                  <feature.icon className={`w-4 h-4 ${feature.color}`} />
                  <span className="text-gray-400 text-[8px] text-center leading-tight">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* QR & Link */}
          <div className="px-3 py-2 flex items-center gap-3 bg-gray-800/30">
            <div className="bg-white p-1.5 rounded-lg">
              <QRCodeSVG value={referralLink} size={50} level="M" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-500 text-[9px] mb-0.5">Scan or visit</p>
              <p className="text-gray-300 text-[9px] font-mono truncate">{referralLink.replace('https://', '')}</p>
            </div>
          </div>

          {/* Tagline */}
          <div className="px-3 py-2 text-center border-t border-gray-800">
            <p className="text-gray-500 text-[10px]">India&apos;s Next-Generation Trusted Reward Platform</p>
          </div>
        </div>

        {/* Share Buttons - Outside the capture area */}
        <div className="mt-3 space-y-2">
          {/* Main Share Button */}
          <button
            onClick={shareWithImage}
            disabled={isSharing}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50"
          >
            {isSharing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Preparing...</span>
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                <span>Share Card</span>
              </>
            )}
          </button>

          {/* Quick Share Options */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={shareOnWhatsApp}
              className="flex flex-col items-center gap-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-[9px]">WhatsApp</span>
            </button>
            <button
              onClick={shareOnTelegram}
              className="flex flex-col items-center gap-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
            >
              <Send className="w-5 h-5" />
              <span className="text-[9px]">Telegram</span>
            </button>
            <button
              onClick={copyLink}
              className="flex flex-col items-center gap-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
            >
              {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
              <span className="text-[9px]">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AppShareCard;
