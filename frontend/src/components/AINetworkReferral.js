import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { 
  Users, TrendingUp, Award, Share2, Copy, Check, 
  ChevronRight, Sparkles, Bot, Lightbulb, Target,
  Crown, Zap, Gift, ArrowRight, Download, ExternalLink,
  MessageCircle, Send, RefreshCw, Star, Trophy,
  UserPlus, Coins, BarChart3, Brain, Rocket
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Level configuration with bonuses
const LEVEL_CONFIG = [
  { level: 1, name: 'Direct Referral', bonus: 100, color: 'from-purple-500 to-purple-600', icon: '👤' },
  { level: 2, name: 'Level 2', bonus: 50, color: 'from-blue-500 to-blue-600', icon: '👥' },
  { level: 3, name: 'Level 3', bonus: 25, color: 'from-cyan-500 to-cyan-600', icon: '👨‍👩‍👦' },
  { level: 4, name: 'Level 4', bonus: 10, color: 'from-green-500 to-green-600', icon: '🌳' },
  { level: 5, name: 'Level 5', bonus: 5, color: 'from-amber-500 to-amber-600', icon: '🌟' },
];

// ============================================
// AI REFERRAL COACH COMPONENT
// ============================================
const AIReferralCoach = ({ user, networkStats, onSuggestionClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [aiTips, setAiTips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const generateAITips = () => {
    const tips = [];
    
    // Based on network stats
    if (networkStats?.level_1 < 5) {
      tips.push({
        icon: '🎯',
        title: 'Direct Referrals वाढवा',
        description: `तुमचे ${networkStats?.level_1 || 0} direct referrals आहेत. 5 पर्यंत पोहोचा आणि bonus unlock करा!`,
        action: 'Share Now',
        priority: 'high'
      });
    }
    
    if (networkStats?.inactive_count > 0) {
      tips.push({
        icon: '📢',
        title: 'Inactive Members Activate करा',
        description: `${networkStats?.inactive_count} members inactive आहेत. त्यांना remind करा!`,
        action: 'Send Reminder',
        priority: 'medium'
      });
    }
    
    tips.push({
      icon: '📱',
      title: 'WhatsApp Status वापरा',
      description: 'WhatsApp Status वर share करा - जास्त लोक बघतात!',
      action: 'Share Status',
      priority: 'medium'
    });
    
    tips.push({
      icon: '🎁',
      title: 'Special Offer Share करा',
      description: 'नवीन members साठी 50 PRC welcome bonus आहे - हे सांगा!',
      action: 'Share Offer',
      priority: 'low'
    });
    
    if (networkStats?.total_referrals >= 10) {
      tips.push({
        icon: '👑',
        title: 'VIP Upgrade करा',
        description: 'तुमचे network मोठे आहे! VIP ने 2x referral bonus मिळेल.',
        action: 'Go VIP',
        priority: 'high'
      });
    }
    
    setAiTips(tips.slice(0, 4));
  };

  useEffect(() => {
    generateAITips();
  }, [networkStats]);

  return (
    <Card className="overflow-hidden border-0 shadow-xl">
      {/* Header */}
      <div 
        className="p-4 text-white cursor-pointer"
        style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Brain className="w-6 h-6" />
            </motion.div>
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                AI Referral Coach
                <Sparkles className="w-4 h-4 text-yellow-300" />
              </h3>
              <p className="text-sm text-purple-200">Smart tips to grow your network</p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-6 h-6" />
          </motion.div>
        </div>
      </div>

      {/* Tips */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3 bg-gradient-to-b from-purple-50 to-white">
              {aiTips.map((tip, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-xl border-2 ${
                    tip.priority === 'high' 
                      ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200' 
                      : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{tip.icon}</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{tip.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{tip.description}</p>
                    </div>
                    <Button 
                      size="sm" 
                      className="bg-purple-600 hover:bg-purple-700"
                      onClick={() => onSuggestionClick && onSuggestionClick(tip.action)}
                    >
                      {tip.action}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

// ============================================
// 5-LEVEL NETWORK VISUALIZATION
// ============================================
const NetworkLevelVisualization = ({ levelStats }) => {
  return (
    <Card className="p-6 border-0 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-purple-600" />
          5-Level Network
        </h3>
        <div className="text-sm text-gray-500">
          Total: {Object.values(levelStats || {}).reduce((a, b) => a + b, 0)} members
        </div>
      </div>

      {/* Level Cards */}
      <div className="space-y-3">
        {LEVEL_CONFIG.map((level, index) => {
          const count = levelStats?.[`level_${level.level}`] || 0;
          const potentialEarning = count * level.bonus;
          
          return (
            <motion.div
              key={level.level}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <div className={`p-4 rounded-xl bg-gradient-to-r ${level.color} text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{level.icon}</span>
                    <div>
                      <p className="font-bold">{level.name}</p>
                      <p className="text-sm opacity-80">{level.bonus} PRC per referral</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">{count}</p>
                    <p className="text-sm opacity-80">members</p>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Potential Earnings</span>
                    <span className="font-bold">{potentialEarning} PRC</span>
                  </div>
                  <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-white rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(count * 10, 100)}%` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Connection line */}
              {index < LEVEL_CONFIG.length - 1 && (
                <div className="absolute left-8 -bottom-3 w-0.5 h-6 bg-gradient-to-b from-gray-300 to-transparent z-10" />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Total Earnings Summary */}
      <div className="mt-6 p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8" />
            <div>
              <p className="font-bold text-lg">Total Network Earnings</p>
              <p className="text-sm opacity-80">From all 5 levels</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">
              {LEVEL_CONFIG.reduce((total, level) => {
                return total + ((levelStats?.[`level_${level.level}`] || 0) * level.bonus);
              }, 0)} PRC
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};

// ============================================
// SOCIAL SHARE CARD GENERATOR
// ============================================
const SocialShareCard = ({ user, referralCode, onShare }) => {
  const cardRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);

  const referralLink = `${window.location.origin}/register?ref=${user?.uid}`;

  const generateShareImage = async () => {
    if (!cardRef.current) return;
    
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });
      const imageUrl = canvas.toDataURL('image/png');
      setGeneratedImage(imageUrl);
      toast.success('Share card generated!');
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image');
    }
    setIsGenerating(false);
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.download = `paras-referral-${user?.uid?.slice(0, 8)}.png`;
    link.href = generatedImage;
    link.click();
    toast.success('Image downloaded!');
  };

  const shareToWhatsApp = () => {
    const message = encodeURIComponent(
      `🎁 PARAS REWARD वर Join करा!\n\n✅ Free mining\n✅ Daily rewards\n✅ 50 PRC welcome bonus\n\n👉 ${referralLink}\n\nमाझा referral code: ${referralCode || user?.uid?.slice(0, 8)}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareToWhatsAppStatus = () => {
    // WhatsApp doesn't have direct status API, but we can open WhatsApp with image
    if (generatedImage) {
      // Download image first, then user can share to status
      downloadImage();
      toast.info('Image downloaded! Open WhatsApp > Status > Add', { duration: 5000 });
    } else {
      generateShareImage().then(() => {
        setTimeout(() => {
          downloadImage();
          toast.info('Image downloaded! Open WhatsApp > Status > Add', { duration: 5000 });
        }, 500);
      });
    }
  };

  const shareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodeURIComponent('Join PARAS REWARD and earn daily! 🎁')}`,
      '_blank'
    );
  };

  const shareToTwitter = () => {
    const message = encodeURIComponent(
      `🎁 Join PARAS REWARD and earn daily rewards!\n\n✅ Free mining\n✅ Welcome bonus\n\n👉 ${referralLink}`
    );
    window.open(`https://twitter.com/intent/tweet?text=${message}`, '_blank');
  };

  const shareToInstagram = () => {
    if (generatedImage) {
      downloadImage();
      toast.info('Image downloaded! Open Instagram > Story > Add from Gallery', { duration: 5000 });
    } else {
      generateShareImage().then(() => {
        setTimeout(() => {
          downloadImage();
          toast.info('Image downloaded! Open Instagram > Story > Add from Gallery', { duration: 5000 });
        }, 500);
      });
    }
  };

  const copyLink = () => {
    const textArea = document.createElement('textarea');
    textArea.value = referralLink;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      toast.success('Link copied!');
    } catch (err) {
      toast.error('Failed to copy');
    }
    textArea.remove();
  };

  return (
    <Card className="overflow-hidden border-0 shadow-xl">
      <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Share2 className="w-5 h-5" />
          Share & Earn
        </h3>
        <p className="text-sm text-purple-200">Share your referral card on social media</p>
      </div>

      <div className="p-4">
        {/* Shareable Card Preview */}
        <div 
          ref={cardRef}
          className="relative p-6 rounded-2xl overflow-hidden mb-4"
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
          }}
        >
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-white rounded-full translate-x-1/2 translate-y-1/2" />
          </div>

          {/* Content */}
          <div className="relative text-white text-center">
            {/* Logo/Brand */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">💰</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-2">PARAS REWARD</h2>
            <p className="text-white/80 mb-4">Join & Earn Daily Rewards!</p>

            {/* Benefits */}
            <div className="flex justify-center gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl mb-1">⛏️</div>
                <p className="text-xs">Free Mining</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">🎁</div>
                <p className="text-xs">50 PRC Bonus</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">💎</div>
                <p className="text-xs">VIP Rewards</p>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              <div className="bg-white p-3 rounded-xl">
                <QRCodeCanvas 
                  value={referralLink}
                  size={100}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Referral Code */}
            <div className="bg-white/20 rounded-xl p-3">
              <p className="text-xs text-white/60 mb-1">Referral Code</p>
              <p className="text-xl font-bold tracking-wider">{referralCode || user?.uid?.slice(0, 8).toUpperCase()}</p>
            </div>

            {/* User info */}
            <p className="text-xs text-white/60 mt-3">
              Invited by: {user?.name || 'PARAS Member'}
            </p>
          </div>
        </div>

        {/* Generate Button */}
        <Button 
          onClick={generateShareImage}
          disabled={isGenerating}
          className="w-full mb-4 bg-gradient-to-r from-purple-600 to-indigo-600"
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          Generate Share Card
        </Button>

        {/* Share Buttons Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Button 
            onClick={shareToWhatsApp}
            className="bg-green-500 hover:bg-green-600 flex-col h-auto py-3"
          >
            <MessageCircle className="w-5 h-5 mb-1" />
            <span className="text-xs">WhatsApp</span>
          </Button>
          
          <Button 
            onClick={shareToWhatsAppStatus}
            className="bg-green-600 hover:bg-green-700 flex-col h-auto py-3"
          >
            <div className="relative">
              <MessageCircle className="w-5 h-5" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full" />
            </div>
            <span className="text-xs mt-1">Status</span>
          </Button>
          
          <Button 
            onClick={shareToFacebook}
            className="bg-blue-600 hover:bg-blue-700 flex-col h-auto py-3"
          >
            <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span className="text-xs">Facebook</span>
          </Button>
          
          <Button 
            onClick={shareToTwitter}
            className="bg-gray-900 hover:bg-gray-800 flex-col h-auto py-3"
          >
            <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span className="text-xs">X (Twitter)</span>
          </Button>
          
          <Button 
            onClick={shareToInstagram}
            className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 flex-col h-auto py-3"
          >
            <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            <span className="text-xs">Instagram</span>
          </Button>
          
          <Button 
            onClick={copyLink}
            variant="outline"
            className="flex-col h-auto py-3"
          >
            <Copy className="w-5 h-5 mb-1" />
            <span className="text-xs">Copy Link</span>
          </Button>
        </div>

        {/* Download generated image */}
        {generatedImage && (
          <Button 
            onClick={downloadImage}
            variant="outline"
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Image
          </Button>
        )}
      </div>
    </Card>
  );
};

// ============================================
// AI NETWORK ANALYTICS
// ============================================
const AINetworkAnalytics = ({ networkStats, earnings }) => {
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    generateInsights();
  }, [networkStats, earnings]);

  const generateInsights = () => {
    const newInsights = [];
    
    const totalMembers = Object.values(networkStats || {}).reduce((a, b) => a + b, 0);
    
    if (totalMembers > 0) {
      // Growth potential
      const level1 = networkStats?.level_1 || 0;
      const level2 = networkStats?.level_2 || 0;
      
      if (level2 < level1 * 2) {
        newInsights.push({
          icon: '📈',
          title: 'Growth Opportunity',
          value: `${level1 * 2 - level2} more Level 2`,
          description: 'तुमच्या Level 1 members ने referrals आणले तर income 2x होईल',
          color: 'from-green-500 to-emerald-600'
        });
      }
      
      // Earnings analysis
      const totalPotential = LEVEL_CONFIG.reduce((total, level) => {
        return total + ((networkStats?.[`level_${level.level}`] || 0) * level.bonus);
      }, 0);
      
      newInsights.push({
        icon: '💰',
        title: 'Potential Earnings',
        value: `${totalPotential} PRC`,
        description: 'सध्याच्या network मधून maximum earning potential',
        color: 'from-amber-500 to-orange-600'
      });
      
      // Active ratio
      const activeRatio = networkStats?.active_count 
        ? Math.round((networkStats.active_count / totalMembers) * 100) 
        : 0;
      
      newInsights.push({
        icon: activeRatio > 50 ? '🔥' : '⚡',
        title: 'Network Health',
        value: `${activeRatio}% Active`,
        description: activeRatio > 50 ? 'Excellent! तुमचे network active आहे' : 'काही members inactive आहेत',
        color: activeRatio > 50 ? 'from-green-500 to-teal-600' : 'from-yellow-500 to-orange-600'
      });
    }
    
    // Best performing level
    let bestLevel = 1;
    let maxCount = 0;
    for (let i = 1; i <= 5; i++) {
      const count = networkStats?.[`level_${i}`] || 0;
      if (count > maxCount) {
        maxCount = count;
        bestLevel = i;
      }
    }
    
    if (maxCount > 0) {
      newInsights.push({
        icon: '🏆',
        title: 'Best Level',
        value: `Level ${bestLevel}`,
        description: `${maxCount} members - तुमचा सर्वात मजबूत level`,
        color: 'from-purple-500 to-indigo-600'
      });
    }
    
    setInsights(newInsights);
  };

  return (
    <Card className="p-6 border-0 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">AI Network Analytics</h3>
          <p className="text-sm text-gray-500">Smart insights about your network</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((insight, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-4 rounded-xl bg-gradient-to-r ${insight.color} text-white`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-2xl">{insight.icon}</span>
              <span className="text-2xl font-bold">{insight.value}</span>
            </div>
            <h4 className="font-semibold">{insight.title}</h4>
            <p className="text-sm text-white/80 mt-1">{insight.description}</p>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

// ============================================
// MAIN EXPORT COMPONENT
// ============================================
export { 
  AIReferralCoach, 
  NetworkLevelVisualization, 
  SocialShareCard, 
  AINetworkAnalytics,
  LEVEL_CONFIG 
};
