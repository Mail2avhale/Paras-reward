import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Copy, Check, Share2, ArrowLeft, Gift, Crown, TrendingUp, 
  ChevronRight, UserCheck, Zap, History, MessageCircle, Link2,
  Award, Sparkles, HelpCircle, ArrowRight, PartyPopper, ChevronDown, ChevronUp,
  User, GitBranch, Circle
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

  // Milestone configuration
  const milestones = [
    { count: 1, badge: '🌱', title: 'First Steps', subtitle: 'Welcome to the network!', color: 'emerald' },
    { count: 5, badge: '⭐', title: 'Rising Star', subtitle: '5 friends invited', color: 'blue' },
    { count: 10, badge: '🔥', title: 'On Fire', subtitle: '10 friends strong', color: 'orange' },
    { count: 25, badge: '💎', title: 'Diamond', subtitle: '25 friends network', color: 'purple' },
    { count: 50, badge: '👑', title: 'Legend', subtitle: '50 friends empire', color: 'amber' },
    { count: 100, badge: '🏆', title: 'Champion', subtitle: '100 friends dynasty', color: 'pink' },
  ];

  // Get current milestone and next milestone
  const getCurrentMilestone = (total) => {
    let current = null;
    let next = milestones[0];
    
    for (let i = milestones.length - 1; i >= 0; i--) {
      if (total >= milestones[i].count) {
        current = milestones[i];
        next = milestones[i + 1] || null;
        break;
      }
    }
    
    if (!current && total > 0) {
      current = milestones[0];
      next = milestones[1];
    }
    
    return { current, next };
  };

  // Level configuration
  const levelConfig = {
    1: { percent: 10, label: 'Direct', color: 'amber', icon: '👤' },
    2: { percent: 5, label: 'Level 2', color: 'blue', icon: '👥' },
    3: { percent: 2.5, label: 'Level 3', color: 'emerald', icon: '🌟' },
    4: { percent: 1.5, label: 'Level 4', color: 'purple', icon: '💎' },
    5: { percent: 1, label: 'Level 5', color: 'pink', icon: '🏆' }
  };

  // State for milestone celebration
  const [celebratingMilestone, setCelebratingMilestone] = useState(null);
  const [liveActivity, setLiveActivity] = useState([]);
  const [expandedLevels, setExpandedLevels] = useState({});  // Track which levels are expanded
  const [showNetworkTree, setShowNetworkTree] = useState(false);
  const [networkTree, setNetworkTree] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      fetchData();
      fetchLiveActivity();
    }
  }, [user]);

  // Fetch live activity (recent referral achievements)
  const fetchLiveActivity = async () => {
    try {
      const response = await axios.get(`${API}/api/referrals/live-activity`);
      setLiveActivity(response.data.activities || []);
    } catch (e) {
      // Fallback to mock data if API doesn't exist yet
      setLiveActivity([]);
    }
  };

  // Check for milestone achievements
  const checkMilestoneAchievement = async (total) => {
    const milestone = milestones.find(m => m.count === total);
    if (milestone) {
      const celebrationKey = `milestone_${user?.uid}_${milestone.count}`;
      const hasCelebrated = localStorage.getItem(celebrationKey);
      
      if (!hasCelebrated) {
        setCelebratingMilestone(milestone);
        triggerConfetti();
        localStorage.setItem(celebrationKey, 'true');
        
        // Record achievement to global live activity
        try {
          await axios.post(`${API}/api/referrals/milestone-achievement`, {
            uid: user?.uid,
            milestone_count: milestone.count,
            milestone_badge: milestone.badge,
            milestone_title: milestone.title,
            milestone_color: milestone.color
          });
          toast.success(`🎉 Achievement unlocked: ${milestone.title}!`, { duration: 5000 });
        } catch (e) {
          console.log('Failed to record milestone achievement:', e);
        }
        
        // Add to local live activity
        const newActivity = {
          id: Date.now(),
          type: 'milestone',
          user_name: userData?.name || 'You',
          milestone: milestone,
          timestamp: new Date().toISOString()
        };
        setLiveActivity(prev => [newActivity, ...prev.slice(0, 9)]);
      }
    }
  };

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
        
        // Check for milestone achievements (5, 10, 25, 50, 100)
        checkMilestoneAchievement(totalCount);
        
        // Check for first referral celebration!
        if (previousTotal !== null && previousTotal === 0 && totalCount === 1) {
          // First friend joined! Trigger celebration
          setShowCelebration(true);
          triggerConfetti();
          toast.success('🎉 Your first friend joined! Keep inviting!', { duration: 5000 });
        }
        setPreviousTotal(totalCount);
        
        setReferralStats({ total: totalCount, active: activeCount, vip: vipCount });
      } catch (e) {
        const refCount = userResponse.data.referral_count || 0;
        
        // Check for milestone achievements
        checkMilestoneAchievement(refCount);
        
        // Check for first referral using user data
        if (previousTotal !== null && previousTotal === 0 && refCount === 1) {
          setShowCelebration(true);
          triggerConfetti();
          toast.success('🎉 Your first friend joined! Keep inviting!', { duration: 5000 });
        }
        setPreviousTotal(refCount);
        
        setReferralStats({ total: refCount, active: 0, vip: 0 });
        setReferralLevels([1, 2, 3, 4, 5].map(level => ({
          level,
          users: [],
          count: level === 1 ? refCount : 0,
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

  // Check localStorage for first-time celebration (persists across sessions)
  useEffect(() => {
    const hasSeenFirstReferralCelebration = localStorage.getItem(`first_referral_${user?.uid}`);
    if (!hasSeenFirstReferralCelebration && referralStats.total === 1 && !loading) {
      // First time seeing 1 referral - celebrate!
      setShowCelebration(true);
      triggerConfetti();
      toast.success('🎉 Congratulations! Your first friend joined!', { duration: 5000 });
      localStorage.setItem(`first_referral_${user?.uid}`, 'true');
    }
  }, [referralStats.total, loading, user?.uid, triggerConfetti]);

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
    const message = `🎁 Join PARAS REWARD - India's Next-Generation Trusted Reward Platform!

✨ Use my referral code: ${referralCode}
🔗 ${referralLink}

💰 Earn PRC Daily
🛒 Shop & Save  
💳 Pay Bills
🎁 Redeem Gift Vouchers
👥 5-Level Referral Bonus

Download now & start earning!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const shareNative = async () => {
    const message = `🎁 Join PARAS REWARD - India's Next-Generation Trusted Reward Platform!

✨ Use my referral code: ${referralCode}
🔗 ${referralLink}

💰 Earn PRC Daily
🛒 Shop & Save  
💳 Pay Bills
🎁 Redeem Gift Vouchers
👥 5-Level Referral Bonus

Download now & start earning!`;
    
    const shareData = {
      title: 'Join PARAS REWARD',
      text: message,
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

  // Toggle level expansion
  const toggleLevel = (level) => {
    setExpandedLevels(prev => ({
      ...prev,
      [level]: !prev[level]
    }));
  };

  // Fetch network tree for visualization
  const fetchNetworkTree = async () => {
    try {
      const response = await axios.get(`${API}/api/referrals/${user.uid}/tree`);
      setNetworkTree(response.data.tree);
    } catch (error) {
      console.error('Error fetching network tree:', error);
      setNetworkTree(null);
    }
  };

  // Network Tree Node Component
  const TreeNode = ({ node, depth = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(depth < 2);
    const hasChildren = node?.children && node.children.length > 0;
    const isActive = node?.membership_type === 'vip' || node?.membership_type === 'elite' || node?.membership_type === 'growth' || node?.membership_type === 'startup';
    
    if (!node) return null;
    
    return (
      <div className="ml-4">
        <div 
          className={`flex items-center gap-2 py-2 cursor-pointer hover:bg-gray-800/50 rounded-lg px-2 transition-colors ${depth === 0 ? 'ml-0' : ''}`}
          onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        >
          {/* Connector line */}
          {depth > 0 && (
            <div className="flex items-center">
              <div className="w-4 h-px bg-gray-600"></div>
            </div>
          )}
          
          {/* Expand/Collapse icon */}
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )
          ) : (
            <Circle className="w-2 h-2 text-gray-600 ml-1 mr-1" />
          )}
          
          {/* User avatar with status */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            isActive ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/50' : 'bg-gray-700 text-gray-400'
          }`}>
            {node.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          
          {/* User info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium truncate">{node.name || 'User'}</span>
              {isActive && (
                <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>
              )}
              {!isActive && (
                <span className="px-1.5 py-0.5 bg-gray-700 text-gray-500 text-xs rounded-full">Free</span>
              )}
            </div>
            {hasChildren && (
              <span className="text-xs text-gray-500">{node.children.length} referral{node.children.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          
          {/* Level badge */}
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            depth === 0 ? 'bg-amber-500/20 text-amber-400' :
            depth === 1 ? 'bg-blue-500/20 text-blue-400' :
            depth === 2 ? 'bg-emerald-500/20 text-emerald-400' :
            depth === 3 ? 'bg-purple-500/20 text-purple-400' :
            'bg-pink-500/20 text-pink-400'
          }`}>
            L{depth}
          </span>
        </div>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-l border-gray-700 ml-4">
            {node.children.map((child, idx) => (
              <TreeNode key={child.id || idx} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

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

      {/* Current Badge & Progress */}
      {referralStats.total > 0 && (
        <div className="px-5 mb-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Your Badge
              </h3>
              <span className="text-xs text-gray-500">Milestone Progress</span>
            </div>
            
            {(() => {
              const { current, next } = getCurrentMilestone(referralStats.total);
              const progress = next ? ((referralStats.total - (current?.count || 0)) / (next.count - (current?.count || 0))) * 100 : 100;
              
              return (
                <div className="flex items-center gap-4">
                  {/* Current Badge */}
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl ${
                      current ? `bg-${current.color}-500/20 border-2 border-${current.color}-500/50` : 'bg-gray-800'
                    }`}
                  >
                    {current?.badge || '🌱'}
                  </motion.div>
                  
                  {/* Progress Info */}
                  <div className="flex-1">
                    <p className="text-white font-bold text-lg">{current?.title || 'Getting Started'}</p>
                    <p className="text-gray-400 text-sm mb-2">{current?.subtitle || 'Invite your first friend'}</p>
                    
                    {next && (
                      <>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">Next: {next.title} {next.badge}</span>
                          <span className="text-amber-400">{referralStats.total}/{next.count}</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(progress, 100)}%` }}
                            transition={{ duration: 1, delay: 0.5 }}
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                          />
                        </div>
                      </>
                    )}
                    
                    {!next && (
                      <p className="text-amber-400 text-sm font-medium">🎉 Maximum level achieved!</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        </div>
      )}

      {/* All Badges Gallery */}
      <div className="px-5 mb-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Badge Collection
            </h3>
            <span className="text-xs text-gray-500">{milestones.filter(m => referralStats.total >= m.count).length}/{milestones.length} Unlocked</span>
          </div>
          
          <div className="grid grid-cols-6 gap-2">
            {milestones.map((milestone, index) => {
              const isUnlocked = referralStats.total >= milestone.count;
              return (
                <motion.div
                  key={milestone.count}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative aspect-square rounded-xl flex flex-col items-center justify-center ${
                    isUnlocked 
                      ? `bg-${milestone.color}-500/20 border-2 border-${milestone.color}-500/50` 
                      : 'bg-gray-800/50 border border-gray-700/50'
                  }`}
                >
                  <span className={`text-2xl ${!isUnlocked && 'opacity-30 grayscale'}`}>{milestone.badge}</span>
                  <span className={`text-[10px] mt-1 ${isUnlocked ? 'text-white' : 'text-gray-600'}`}>{milestone.count}</span>
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center">
                        <span className="text-gray-500 text-[8px]">🔒</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bonus Levels - Visual Pyramid with Expandable User List */}
      <div className="px-5 mb-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Earning Levels
            </h3>
            <span className="text-xs text-gray-500">Tap to see users</span>
          </div>
          
          {/* Pyramid visualization with expandable sections */}
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((level) => {
              const config = levelConfig[level];
              const levelData = referralLevels.find(l => l.level === level) || { count: 0, active_count: 0, users: [] };
              const totalUsers = levelData.count || levelData.users?.length || 0;
              const activeUsers = levelData.active_count || levelData.users?.filter(u => u.is_active).length || 0;
              const users = levelData.users || [];
              const isExpanded = expandedLevels[level];
              
              // Calculate width based on level (pyramid effect)
              const widthPercent = 100 - (level - 1) * 12;
              
              return (
                <motion.div
                  key={level}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: level * 0.1 }}
                  className="flex flex-col"
                  style={{ paddingLeft: `${(level - 1) * 4}%` }}
                >
                  <div 
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      activeUsers > 0 
                        ? `bg-${config.color}-500/20 border-${config.color}-500/30 hover:bg-${config.color}-500/30` 
                        : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800'
                    }`}
                    style={{ maxWidth: `${widthPercent}%` }}
                    onClick={() => totalUsers > 0 && toggleLevel(level)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{config.icon}</span>
                      <div>
                        <p className={`font-semibold text-sm ${activeUsers > 0 ? 'text-white' : 'text-gray-400'}`}>
                          {config.label}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">{totalUsers} invited</span>
                          <span className="text-green-400">• {activeUsers} active</span>
                          <span className="text-red-400">• {totalUsers - activeUsers} inactive</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                        activeUsers > 0 
                          ? `bg-${config.color}-500/30 text-${config.color}-300` 
                          : 'bg-gray-700/50 text-gray-500'
                      }`}>
                        +{config.percent}%
                      </div>
                      {totalUsers > 0 && (
                        isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded User List */}
                  <AnimatePresence>
                    {isExpanded && users.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 ml-4 space-y-1"
                        style={{ maxWidth: `${widthPercent - 5}%` }}
                      >
                        {users.map((u, idx) => (
                          <div 
                            key={u.uid || idx}
                            className={`flex items-center justify-between p-2 rounded-lg ${
                              u.is_active ? 'bg-green-500/10 border border-green-500/20' : 'bg-gray-800/50 border border-gray-700/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {/* Status indicator */}
                              <div className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                              
                              {/* Avatar */}
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                u.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
                              }`}>
                                {u.name?.charAt(0)?.toUpperCase() || 'U'}
                              </div>
                              
                              {/* Name */}
                              <span className={`text-sm truncate max-w-[120px] ${u.is_active ? 'text-white' : 'text-gray-400'}`}>
                                {u.name || 'User'}
                              </span>
                            </div>
                            
                            {/* Status badge */}
                            <div className="flex items-center gap-2">
                              {u.membership_type && u.membership_type !== 'free' && (
                                <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded capitalize">
                                  {u.membership_type}
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                u.is_active 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-red-500/20 text-red-400'
                              }`}>
                                {u.is_active ? '🟢 Active' : '🔴 Inactive'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
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

      {/* Network Tree View Button */}
      <div className="px-5 mb-6">
        <button
          onClick={() => {
            setShowNetworkTree(true);
            fetchNetworkTree();
          }}
          className="w-full bg-gradient-to-r from-cyan-500/20 to-blue-600/10 border border-cyan-500/30 rounded-2xl p-4 flex items-center justify-between hover:from-cyan-500/30 hover:to-blue-600/20 transition-all"
          data-testid="view-network-tree"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <GitBranch className="w-6 h-6 text-cyan-400" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold">Network Tree View</p>
              <p className="text-cyan-400 text-sm">See your complete referral network</p>
            </div>
          </div>
          <ChevronRight className="w-6 h-6 text-cyan-400" />
        </button>
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

      {/* First Referral Celebration Modal */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowCelebration(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Animated celebration icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ repeat: 2, duration: 0.5 }}
                >
                  <PartyPopper className="w-12 h-12 text-white" />
                </motion.div>
              </motion.div>
              
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold text-white mb-2"
              >
                Congratulations! 🎉
              </motion.h2>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-white/90 text-lg mb-6"
              >
                Your first friend just joined!<br />
                You&apos;re now earning <strong>+10% bonus</strong> from their rewards!
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white/20 rounded-2xl p-4 mb-6"
              >
                <p className="text-white/80 text-sm mb-1">Your Network</p>
                <div className="flex items-center justify-center gap-3">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">1</p>
                    <p className="text-white/70 text-xs">Friend</p>
                  </div>
                  <div className="w-px h-10 bg-white/30"></div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">+10%</p>
                    <p className="text-white/70 text-xs">Bonus</p>
                  </div>
                </div>
              </motion.div>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-white/70 text-sm mb-4"
              >
                Keep inviting to unlock up to <strong>+20% bonus!</strong>
              </motion.p>
              
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                onClick={() => setShowCelebration(false)}
                className="w-full py-4 bg-white text-amber-600 font-bold rounded-2xl hover:bg-white/90 transition-all shadow-lg"
              >
                Keep Growing! 🚀
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestone Celebration Modal */}
      <AnimatePresence>
        {celebratingMilestone && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setCelebratingMilestone(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: "spring", duration: 0.6 }}
              className={`bg-gradient-to-br from-${celebratingMilestone.color}-500 via-${celebratingMilestone.color}-600 to-${celebratingMilestone.color}-700 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl`}
              onClick={e => e.stopPropagation()}
            >
              {/* Animated badge */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: [0, 1.3, 1], rotate: 0 }}
                transition={{ delay: 0.2, duration: 0.8, type: "spring" }}
                className="w-28 h-28 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border-4 border-white/30"
              >
                <motion.span
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: 3, duration: 0.5 }}
                  className="text-6xl"
                >
                  {celebratingMilestone.badge}
                </motion.span>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <p className="text-white/80 text-sm mb-1">New Badge Unlocked!</p>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {celebratingMilestone.title}
                </h2>
                <p className="text-white/90 text-lg mb-6">
                  {celebratingMilestone.subtitle}
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white/20 rounded-2xl p-4 mb-6 backdrop-blur-sm"
              >
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">{celebratingMilestone.count}</p>
                    <p className="text-white/70 text-xs">Friends</p>
                  </div>
                  <div className="w-px h-10 bg-white/30"></div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">{celebratingMilestone.badge}</p>
                    <p className="text-white/70 text-xs">Badge</p>
                  </div>
                </div>
              </motion.div>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-white/70 text-sm mb-4"
              >
                {(() => {
                  const nextMilestone = milestones.find(m => m.count > celebratingMilestone.count);
                  return nextMilestone 
                    ? `Next milestone: ${nextMilestone.title} at ${nextMilestone.count} friends!`
                    : "You've reached the highest level! 🏆";
                })()}
              </motion.p>
              
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                onClick={() => setCelebratingMilestone(null)}
                className="w-full py-4 bg-white text-gray-900 font-bold rounded-2xl hover:bg-white/90 transition-all shadow-lg"
              >
                Awesome! 🎉
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Network Tree Modal */}
      <AnimatePresence>
        {showNetworkTree && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowNetworkTree(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-white">Network Tree</h2>
                  <p className="text-xs text-gray-400">Your complete referral network</p>
                </div>
              </div>
              <button 
                onClick={() => setShowNetworkTree(false)}
                className="text-gray-500 hover:text-white p-2"
              >
                ✕
              </button>
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-900/50 border-b border-gray-800">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-xs text-gray-400">Active (Paid)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                <span className="text-xs text-gray-400">Inactive (Free)</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">L0</span>
                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">L1</span>
                <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">L2</span>
              </div>
            </div>
            
            {/* Tree Content */}
            <div className="flex-1 overflow-auto p-4">
              {networkTree ? (
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                  {/* Root User (You) */}
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-500/20 to-amber-600/10 rounded-xl border border-amber-500/30 mb-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                      {user?.name?.charAt(0)?.toUpperCase() || 'Y'}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold">{user?.name || 'You'}</p>
                      <p className="text-amber-400 text-xs">Your Network</p>
                    </div>
                    <Crown className="w-5 h-5 text-amber-400" />
                  </div>
                  
                  {/* Tree */}
                  {networkTree.length > 0 ? (
                    <div className="space-y-1">
                      {networkTree.map((node, idx) => (
                        <TreeNode key={node.id || idx} node={node} depth={1} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">No referrals yet</p>
                      <p className="text-gray-500 text-sm">Start inviting friends to build your network!</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-400">Loading network...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Stats Footer */}
            <div className="p-4 border-t border-gray-800 bg-gray-900/50">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-white">{referralStats.total}</p>
                  <p className="text-xs text-gray-500">Total Network</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{referralStats.active}</p>
                  <p className="text-xs text-gray-500">Active Users</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-400">+{totalActiveBonus}%</p>
                  <p className="text-xs text-gray-500">Total Bonus</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReferralsEnhanced;
