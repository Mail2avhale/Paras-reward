import React, { useState } from 'react';
import { Share2, Copy, Check, MessageCircle, Send, Link2, X, Smartphone, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import AppShareCard from './AppShareCard';

const APP_URL = process.env.REACT_APP_BACKEND_URL || 'https://parasreward.com';

/**
 * ShareApp Component - Enables users to share the app with their referral code
 * 
 * @param {Object} user - User object with referral_code
 * @param {string} variant - 'button' | 'fab' | 'card' | 'inline'
 * @param {string} className - Additional CSS classes
 * @param {boolean} useNewCard - Use the new AppShareCard design
 */
const ShareApp = ({ user, variant = 'button', className = '', useNewCard = true }) => {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const referralCode = user?.referral_code || 'PARAS';
  const referralLink = `${APP_URL}/register?ref=${referralCode}`;
  
  const shareMessage = `🎁 Join PARAS REWARD and start earning rewards daily!

✨ Use my code: ${referralCode}
🔗 ${referralLink}

💰 Earn PRC points, redeem gift vouchers, pay bills & shop!`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const shareNative = async () => {
    // Always show the new card modal
    if (useNewCard) {
      setShowModal(true);
      return;
    }
    
    const shareData = {
      title: 'Join PARAS REWARD',
      text: `🎁 Earn rewards daily with PARAS REWARD! Use my code: ${referralCode}`,
      url: referralLink
    };
    
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success('Thanks for sharing!');
      } else {
        setShowModal(true);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setShowModal(true);
      }
    }
  };

  const shareOnWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, '_blank');
  };

  const shareOnTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareMessage)}`, '_blank');
  };

  const shareViaSMS = () => {
    window.open(`sms:?body=${encodeURIComponent(shareMessage)}`, '_blank');
  };

  // Render the new AppShareCard modal
  const renderModal = () => {
    if (useNewCard) {
      return (
        <AnimatePresence>
          {showModal && (
            <AppShareCard user={user} onClose={() => setShowModal(false)} />
          )}
        </AnimatePresence>
      );
    }
    return (
      <ShareModal 
        show={showModal} 
        onClose={() => setShowModal(false)}
        referralCode={referralCode}
        referralLink={referralLink}
        shareMessage={shareMessage}
        copyLink={copyLink}
        copied={copied}
        shareOnWhatsApp={shareOnWhatsApp}
        shareOnTelegram={shareOnTelegram}
        shareViaSMS={shareViaSMS}
        showQR={showQR}
        setShowQR={setShowQR}
      />
    );
  };

  // Button variant
  if (variant === 'button') {
    return (
      <>
        <button
          onClick={shareNative}
          className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/25 ${className}`}
          data-testid="share-app-button"
        >
          <Share2 className="w-4 h-4" />
          <span>Share App</span>
        </button>
        {renderModal()}
      </>
    );
  }

  // Floating Action Button variant
  if (variant === 'fab') {
    return (
      <>
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={shareNative}
          className={`fixed bottom-24 right-4 z-40 w-14 h-14 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full shadow-lg shadow-amber-500/40 flex items-center justify-center ${className}`}
          data-testid="share-app-fab"
        >
          <Share2 className="w-6 h-6" />
        </motion.button>
        {renderModal()}
      </>
    );
  }

  // Card variant - for dashboard
  if (variant === 'card') {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-4 ${className}`}
          data-testid="share-app-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/30 rounded-xl flex items-center justify-center">
                <Share2 className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Share & Earn</h3>
                <p className="text-gray-400 text-xs">Invite friends, earn bonus</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-900/50 rounded-xl p-2 mb-3">
            <code className="text-amber-400 font-mono text-sm flex-1 truncate px-2">{referralCode}</code>
            <button 
              onClick={copyLink}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={shareOnWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              onClick={shareNative}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Share2 className="w-4 h-4" />
              More
            </button>
          </div>
        </motion.div>
        {renderModal()}
      </>
    );
  }
              onClick={shareNative}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Share2 className="w-4 h-4" />
              More
            </button>
          </div>
        </motion.div>
        <ShareModal 
          show={showModal} 
          onClose={() => setShowModal(false)}
          referralCode={referralCode}
          referralLink={referralLink}
          shareMessage={shareMessage}
          copyLink={copyLink}
          copied={copied}
          shareOnWhatsApp={shareOnWhatsApp}
          shareOnTelegram={shareOnTelegram}
          shareViaSMS={shareViaSMS}
          showQR={showQR}
          setShowQR={setShowQR}
        />
      </>
    );
  }

  // Inline variant - compact
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className}`} data-testid="share-app-inline">
        <button
          onClick={copyLink}
          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          title="Copy Link"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Link2 className="w-4 h-4 text-gray-400" />}
        </button>
        <button
          onClick={shareOnWhatsApp}
          className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          title="Share on WhatsApp"
        >
          <MessageCircle className="w-4 h-4 text-white" />
        </button>
        <button
          onClick={shareNative}
          className="p-2 bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
          title="Share"
        >
          <Share2 className="w-4 h-4 text-white" />
        </button>
      </div>
    );
  }

  return null;
};

// Share Modal Component
const ShareModal = ({ 
  show, 
  onClose, 
  referralCode, 
  referralLink, 
  shareMessage,
  copyLink, 
  copied,
  shareOnWhatsApp,
  shareOnTelegram,
  shareViaSMS,
  showQR,
  setShowQR
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="w-full max-w-md bg-gray-900 rounded-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Share2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-white text-xl font-bold">Share PARAS REWARD</h2>
                  <p className="text-white/80 text-sm">Invite friends & earn bonus</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Referral Code */}
              <div className="bg-gray-800 rounded-2xl p-4">
                <p className="text-gray-400 text-xs mb-2">Your Referral Code</p>
                <div className="flex items-center justify-between">
                  <code className="text-amber-400 font-mono text-2xl font-bold tracking-wider">
                    {referralCode}
                  </code>
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span className="text-sm font-medium">{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* QR Code Toggle */}
              <button
                onClick={() => setShowQR(!showQR)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-750 text-gray-300 rounded-xl transition-colors"
              >
                <QrCode className="w-5 h-5" />
                <span>{showQR ? 'Hide QR Code' : 'Show QR Code'}</span>
              </button>

              {/* QR Code */}
              <AnimatePresence>
                {showQR && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-white rounded-2xl p-4 flex items-center justify-center">
                      <QRCodeSVG 
                        value={referralLink} 
                        size={180}
                        level="H"
                        includeMargin={true}
                        imageSettings={{
                          src: "/logo192.png",
                          height: 30,
                          width: 30,
                          excavate: true,
                        }}
                      />
                    </div>
                    <p className="text-center text-gray-500 text-xs mt-2">Scan to join with your referral</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Share Options */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={shareOnWhatsApp}
                  className="flex flex-col items-center gap-2 p-4 bg-green-600 hover:bg-green-700 rounded-2xl transition-colors"
                >
                  <MessageCircle className="w-6 h-6 text-white" />
                  <span className="text-white text-xs font-medium">WhatsApp</span>
                </button>
                <button
                  onClick={shareOnTelegram}
                  className="flex flex-col items-center gap-2 p-4 bg-blue-500 hover:bg-blue-600 rounded-2xl transition-colors"
                >
                  <Send className="w-6 h-6 text-white" />
                  <span className="text-white text-xs font-medium">Telegram</span>
                </button>
                <button
                  onClick={shareViaSMS}
                  className="flex flex-col items-center gap-2 p-4 bg-purple-600 hover:bg-purple-700 rounded-2xl transition-colors"
                >
                  <Smartphone className="w-6 h-6 text-white" />
                  <span className="text-white text-xs font-medium">SMS</span>
                </button>
              </div>

              {/* Referral Link */}
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-gray-500 text-xs mb-1">Referral Link</p>
                <p className="text-gray-300 text-sm break-all font-mono">{referralLink}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareApp;
