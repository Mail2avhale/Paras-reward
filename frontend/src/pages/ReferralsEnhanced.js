import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Copy, Check, Share2, ArrowLeft, Gift, Crown, TrendingUp, 
  ChevronRight, UserCheck, Zap, History, MessageCircle, Link2,
  Award, Sparkles, HelpCircle, ArrowRight, PartyPopper
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const API = process.env.REACT_APP_BACKEND_URL;

const ReferralsEnhanced = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [referralStats, setReferralStats] = useState({ total: 0, active: 0, vip: 0 });
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [referralLevels, setReferralLevels] = useState([]);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousTotal, setPreviousTotal] = useState(null);

  // Confetti celebration function
  const triggerConfetti = useCallback(() => {
    // Fire confetti from multiple angles
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio, opts) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    // Gold and amber colors for brand consistency
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ['#f59e0b', '#fbbf24', '#d97706'],
    });
    
    fire(0.2, {
      spread: 60,
      colors: ['#f59e0b', '#fbbf24', '#fcd34d'],
    });
    
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      colors: ['#f59e0b', '#d97706', '#92400e'],
    });
    
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      colors: ['#fbbf24', '#fcd34d', '#fef3c7'],
    });
    
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      colors: ['#a855f7', '#7c3aed', '#f59e0b'],
    });
  }, []);

  // Level configuration
  const levelConfig = {
    1: { percent: 10, label: 'Direct', color: 'amber', icon: '👤' },
    2: { percent: 5, label: 'Level 2', color: 'blue', icon: '👥' },
    3: { percent: 2.5, label: 'Level 3', color: 'emerald', icon: '🌟' },
    4: { percent: 1.5, label: 'Level 4', color: 'purple', icon: '💎' },
    5: { percent: 1, label: 'Level 5', color: 'pink', icon: '🏆' }
  };

  useEffect(() => {
    if (user?.uid) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const userResponse = await axios.get(`${API}/api/user/${user.uid}`);
      setUserData(userResponse.data);
      
      try {
        const levelsResponse = await axios.get(`${API}/api/referrals/${user.uid}/levels`);
        const levels = levelsResponse.data.levels || [];
        setReferralLevels(levels);
        
        let totalCount = 0, activeCount = 0, vipCount = 0;
        levels.forEach(level => {
          const users = level.users || [];
          totalCount += users.length;
          activeCount += users.filter(u => u.is_active).length;
          vipCount += users.filter(u => u.membership_type === 'vip').length;
        });
        
        setReferralStats({ total: totalCount, active: activeCount, vip: vipCount });
      } catch (e) {
        setReferralStats({ total: userResponse.data.referral_count || 0, active: 0, vip: 0 });
        setReferralLevels([1, 2, 3, 4, 5].map(level => ({
          level,
          users: [],
          count: level === 1 ? (userResponse.data.referral_count || 0) : 0,
          active_count: 0
        })));
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setUserData(user);
    } finally {
      setLoading(false);
    }
  };

  const referralCode = userData?.referral_code || user?.referral_code || 'N/A';
  const referralLink = `https://parasreward.com/register?ref=${referralCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    toast.success('Link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareOnWhatsApp = () => {
    const message = `🎁 Join PARAS REWARD and start earning PRC daily!\n\n✨ Use my code: ${referralCode}\n🔗 Or click: ${referralLink}\n\n💰 Earn rewards just by signing up!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const shareNative = async () => {
    const shareData = {
      title: 'Join PARAS REWARD',
      text: `🎁 Earn PRC daily with PARAS REWARD!\nUse my code: ${referralCode}`,
      url: referralLink
    };
    
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        shareOnWhatsApp();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        copyLink();
      }
    }
  };

  // Calculate total bonus from active referrals
  const totalActiveBonus = referralLevels.reduce((sum, level) => {
    const activeUsers = level.active_count || level.users?.filter(u => u.is_active).length || 0;
    return sum + (activeUsers * levelConfig[level.level]?.percent || 0);
  }, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 1.5rem))' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">Invite & Earn</h1>
              <p className="text-gray-500 text-sm">Grow your network</p>
            </div>
          </div>
          <button
            onClick={() => setShowHowItWorks(true)}
            className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center"
          >
            <HelpCircle className="w-5 h-5 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Hero Card - Your Unique Code */}
      <div className="px-5 mb-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-6"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
          }}
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-white" />
              <span className="text-white/90 text-sm font-medium">Your Invite Code</span>
            </div>
            
            {/* Code Display */}
            <div className="bg-black/20 rounded-2xl p-4 mb-4 backdrop-blur-sm border border-white/10">
              <div className="text-3xl font-bold text-white text-center tracking-[0.4em] font-mono">
                {referralCode}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button 
                onClick={copyCode}
                className="flex items-center justify-center gap-2 py-3 bg-white/20 backdrop-blur-sm rounded-xl text-white font-semibold hover:bg-white/30 transition-all border border-white/20"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
              <button 
                onClick={shareOnWhatsApp}
                className="flex items-center justify-center gap-2 py-3 bg-emerald-500 rounded-xl text-white font-semibold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/30"
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp
              </button>
            </div>

            {/* Share Link */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-black/20 rounded-xl px-3 py-2.5 text-white/80 text-sm truncate font-mono">
                {referralLink.replace('https://', '')}
              </div>
              <button
                onClick={copyLink}
                className="px-4 py-2.5 bg-white/20 rounded-xl hover:bg-white/30 transition-all"
              >
                {copiedLink ? <Check className="w-5 h-5 text-white" /> : <Link2 className="w-5 h-5 text-white" />}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Stats */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4 text-center">
            <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{referralStats.total}</p>
            <p className="text-gray-500 text-xs">Total Invited</p>
          </div>
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4 text-center">
            <UserCheck className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-emerald-400">{referralStats.active}</p>
            <p className="text-gray-500 text-xs">Active Users</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-2xl p-4 text-center">
            <TrendingUp className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-amber-400">+{totalActiveBonus.toFixed(1)}%</p>
            <p className="text-amber-400/70 text-xs">Bonus Rate</p>
          </div>
        </div>
      </div>

      {/* Bonus Levels - Visual Pyramid */}
      <div className="px-5 mb-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Earning Levels
            </h3>
            <span className="text-xs text-gray-500">Earn % of friends&apos; rewards</span>
          </div>
          
          {/* Pyramid visualization */}
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((level) => {
              const config = levelConfig[level];
              const levelData = referralLevels.find(l => l.level === level) || { count: 0, active_count: 0 };
              const totalUsers = levelData.count || levelData.users?.length || 0;
              const activeUsers = levelData.active_count || levelData.users?.filter(u => u.is_active).length || 0;
              
              // Calculate width based on level (pyramid effect)
              const widthPercent = 100 - (level - 1) * 12;
              
              return (
                <motion.div
                  key={level}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: level * 0.1 }}
                  className="flex items-center gap-3"
                  style={{ paddingLeft: `${(level - 1) * 6}%` }}
                >
                  <div 
                    className={`flex-1 flex items-center justify-between p-3 rounded-xl border transition-all ${
                      activeUsers > 0 
                        ? `bg-${config.color}-500/20 border-${config.color}-500/30` 
                        : 'bg-gray-800/50 border-gray-700/50'
                    }`}
                    style={{ maxWidth: `${widthPercent}%` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{config.icon}</span>
                      <div>
                        <p className={`font-semibold text-sm ${activeUsers > 0 ? 'text-white' : 'text-gray-400'}`}>
                          {config.label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {totalUsers} invited • {activeUsers} active
                        </p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                      activeUsers > 0 
                        ? `bg-${config.color}-500/30 text-${config.color}-300` 
                        : 'bg-gray-700/50 text-gray-500'
                    }`}>
                      +{config.percent}%
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {/* Total Potential */}
          <div className="mt-4 pt-4 border-t border-gray-700/50 flex items-center justify-between">
            <span className="text-gray-400 text-sm">Maximum Earning Potential</span>
            <span className="text-amber-400 font-bold">Up to +20% bonus</span>
          </div>
        </div>
      </div>

      {/* View Earnings History */}
      <div className="px-5 mb-6">
        <button
          onClick={() => navigate('/referral-earnings')}
          className="w-full bg-gradient-to-r from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between hover:from-purple-500/30 hover:to-purple-600/20 transition-all"
          data-testid="view-earnings-history"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <History className="w-6 h-6 text-purple-400" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold">Earnings History</p>
              <p className="text-purple-400 text-sm">View detailed bonus transactions</p>
            </div>
          </div>
          <ChevronRight className="w-6 h-6 text-purple-400" />
        </button>
      </div>

      {/* Start Building CTA */}
      {referralStats.total === 0 && (
        <div className="px-5 mb-6">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">Start Building Your Network</h3>
            <p className="text-gray-400 text-sm mb-4">
              Share your invite code with friends and earn bonus PRC when they start earning!
            </p>
            <button
              onClick={shareNative}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:from-amber-400 hover:to-amber-500 transition-all"
            >
              <Share2 className="w-5 h-5" />
              Invite Friends Now
            </button>
          </div>
        </div>
      )}

      {/* Share More Button */}
      {referralStats.total > 0 && (
        <div className="px-5">
          <button
            onClick={shareNative}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20"
          >
            <Share2 className="w-5 h-5" />
            Invite More Friends
          </button>
        </div>
      )}

      {/* How It Works Modal */}
      {showHowItWorks && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowHowItWorks(false)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-3xl p-6 max-w-md w-full border border-gray-800"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">How Referrals Work</h2>
              <button onClick={() => setShowHowItWorks(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-400 font-bold">1</span>
                </div>
                <div>
                  <p className="text-white font-semibold">Share Your Code</p>
                  <p className="text-gray-400 text-sm">Send your unique invite code to friends</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 font-bold">2</span>
                </div>
                <div>
                  <p className="text-white font-semibold">Friends Join</p>
                  <p className="text-gray-400 text-sm">They sign up using your code</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-400 font-bold">3</span>
                </div>
                <div>
                  <p className="text-white font-semibold">Earn Bonuses</p>
                  <p className="text-gray-400 text-sm">Get % of their earnings as bonus!</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-400 font-bold">4</span>
                </div>
                <div>
                  <p className="text-white font-semibold">5-Level Network</p>
                  <p className="text-gray-400 text-sm">Earn from 5 levels of referrals!</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <p className="text-amber-400 text-sm text-center">
                <strong>Pro Tip:</strong> You only earn bonus when your referrals are actively earning PRC!
              </p>
            </div>
            
            <button
              onClick={() => setShowHowItWorks(false)}
              className="w-full mt-4 py-3 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-700 transition-all"
            >
              Got it!
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ReferralsEnhanced;
