import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Copy, Check, Share2, ArrowLeft, Gift, Crown, TrendingUp, 
  ChevronDown, ChevronRight, UserCheck, UserX, Zap, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

const Referrals = ({ user }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [referralStats, setReferralStats] = useState({ total: 0, active: 0, vip: 0 });
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [referralLevels, setReferralLevels] = useState([]);
  const [expandedLevel, setExpandedLevel] = useState(null);
  const [showBonusInfo, setShowBonusInfo] = useState(false);
  const [networkExpanded, setNetworkExpanded] = useState(true);

  const t = {
    title: language === 'mr' ? 'मित्रांना आमंत्रित करा' : language === 'hi' ? 'दोस्तों को आमंत्रित करें' : 'Invite Friends',
    yourCode: language === 'mr' ? 'तुमचा कोड' : language === 'hi' ? 'आपका कोड' : 'Your Referral Code',
    copyCode: language === 'mr' ? 'कॉपी करा' : language === 'hi' ? 'कॉपी करें' : 'Copy',
    copied: language === 'mr' ? 'कॉपी झाले!' : language === 'hi' ? 'कॉपी हो गया!' : 'Copied!',
    totalFriends: language === 'mr' ? 'एकूण मित्र' : language === 'hi' ? 'कुल दोस्त' : 'Total Friends',
    activeFriends: language === 'mr' ? 'सक्रिय मित्र' : language === 'hi' ? 'सक्रिय दोस्त' : 'Active',
    vipFriends: language === 'mr' ? 'VIP मित्र' : language === 'hi' ? 'VIP दोस्त' : 'VIP Members',
    bonusRate: language === 'mr' ? 'बोनस दर' : language === 'hi' ? 'बोनस दर' : 'Active Bonus',
    haveCode: language === 'mr' ? 'कोड आहे का?' : language === 'hi' ? 'कोड है?' : 'Have a referral code?',
    enterCode: language === 'mr' ? 'कोड टाका' : language === 'hi' ? 'कोड डालें' : 'Enter code',
    apply: language === 'mr' ? 'लागू करा' : language === 'hi' ? 'लागू करें' : 'Apply',
    level: language === 'mr' ? 'लेव्हल' : language === 'hi' ? 'लेवल' : 'Level',
    yourNetwork: language === 'mr' ? 'तुमचे नेटवर्क' : language === 'hi' ? 'आपका नेटवर्क' : 'Your Network',
    bonusStructure: language === 'mr' ? 'बोनस स्ट्रक्चर' : language === 'hi' ? 'बोनस स्ट्रक्चर' : 'Bonus Structure',
    onlyActiveBonus: language === 'mr' ? 'फक्त सक्रिय रेफरलवर बोनस' : language === 'hi' ? 'केवल सक्रिय रेफरल पर बोनस' : 'Bonus only on active referrals',
    active: language === 'mr' ? 'सक्रिय' : language === 'hi' ? 'सक्रिय' : 'Active',
    inactive: language === 'mr' ? 'निष्क्रिय' : language === 'hi' ? 'निष्क्रिय' : 'Inactive',
  };

  // Level bonus percentages (only on active referrals)
  const levelBonuses = {
    1: { percent: 10, desc: 'Direct Referrals', color: 'from-amber-500 to-amber-600' },
    2: { percent: 5, desc: 'Level 2 Network', color: 'from-blue-500 to-blue-600' },
    3: { percent: 3, desc: 'Level 3 Network', color: 'from-emerald-500 to-emerald-600' },
    4: { percent: 2, desc: 'Level 4 Network', color: 'from-purple-500 to-purple-600' },
    5: { percent: 1, desc: 'Level 5 Network', color: 'from-pink-500 to-pink-600' }
  };

  useEffect(() => {
    if (user?.uid) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch user data
      const userResponse = await axios.get(`${API}/api/user/${user.uid}`);
      setUserData(userResponse.data);
      
      // Fetch referral levels
      try {
        const levelsResponse = await axios.get(`${API}/api/referrals/${user.uid}/levels`);
        const levels = levelsResponse.data.levels || [];
        setReferralLevels(levels);
        
        // Calculate stats from levels - count active users only for bonus
        let totalCount = 0;
        let activeCount = 0;
        let vipCount = 0;
        
        levels.forEach(level => {
          const users = level.users || [];
          totalCount += users.length;
          activeCount += users.filter(u => u.is_active).length;
          vipCount += users.filter(u => u.membership_type === 'vip').length;
        });
        
        setReferralStats({ total: totalCount, active: activeCount, vip: vipCount });
      } catch (e) {
        // Fallback - try regular referrals endpoint
        try {
          const refResponse = await axios.get(`${API}/api/referrals/${user.uid}`);
          const referrals = refResponse.data.referrals || [];
          
          // Group by level
          const grouped = {};
          for (let i = 1; i <= 5; i++) {
            grouped[i] = referrals.filter(r => (r.level || 1) === i);
          }
          
          const levels = Object.entries(grouped).map(([level, users]) => ({
            level: parseInt(level),
            users: users,
            count: users.length,
            active_count: users.filter(u => u.is_active).length,
            bonus_percent: levelBonuses[level].percent
          }));
          
          setReferralLevels(levels);
          setReferralStats({ 
            total: referrals.length,
            active: referrals.filter(r => r.is_active).length,
            vip: referrals.filter(r => r.membership_type === 'vip').length
          });
        } catch (e2) {
          // Use user data as fallback
          setReferralStats({ total: userResponse.data.referral_count || 0, active: 0, vip: 0 });
          setReferralLevels([1, 2, 3, 4, 5].map(level => ({
            level,
            users: [],
            count: level === 1 ? (userResponse.data.referral_count || 0) : 0,
            active_count: 0,
            bonus_percent: levelBonuses[level].percent
          })));
        }
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setUserData(user);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    const code = userData?.referral_code || user?.referral_code || 'N/A';
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnWhatsApp = () => {
    const code = userData?.referral_code || user?.referral_code || '';
    const message = `🎁 Join PARAS REWARD and earn PRC daily!\n\n✅ Use my code: ${code}\n✅ Start earning from Day 1\n✅ 5-Level Bonus System\n\n📱 Download now: https://parasreward.com`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const applyReferralCode = async () => {
    if (!inputCode.trim()) {
      toast.error('Please enter a code');
      return;
    }
    
    setApplying(true);
    try {
      await axios.post(`${API}/api/referrals/apply`, {
        uid: user.uid,
        referral_code: inputCode.trim()
      });
      toast.success('Referral code applied successfully!');
      setInputCode('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid code');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const referralCode = userData?.referral_code || user?.referral_code || 'N/A';
  
  // Calculate total bonus only from ACTIVE referrals
  const totalActiveBonus = referralLevels.reduce((sum, level) => {
    const activeUsers = level.active_count || level.users?.filter(u => u.is_active).length || 0;
    return sum + (activeUsers * levelBonuses[level.level].percent);
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">{t.title}</h1>
            <p className="text-gray-500 text-sm">5-Level Referral System</p>
          </div>
        </div>
      </div>

      {/* Referral Code Card */}
      <div className="px-5 mb-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-5"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
          }}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-5 h-5 text-amber-500" />
              <span className="text-amber-400 text-sm font-medium">{t.yourCode}</span>
            </div>
            
            <div className="bg-black/40 rounded-2xl p-4 mb-4 border border-amber-500/20">
              <div className="text-3xl font-bold text-amber-400 text-center tracking-[0.3em] font-mono">
                {referralCode}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={copyCode}
                className="flex items-center justify-center gap-2 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white font-medium hover:bg-gray-700 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? t.copied : t.copyCode}
              </button>
              <button 
                onClick={shareOnWhatsApp}
                className="flex items-center justify-center gap-2 py-3 bg-emerald-600 rounded-xl text-white font-medium hover:bg-emerald-700 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Stats Overview */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 text-center">
            <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{referralStats.total}</p>
            <p className="text-gray-500 text-[10px]">{t.totalFriends}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 text-center">
            <UserCheck className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-emerald-400">{referralStats.active}</p>
            <p className="text-gray-500 text-[10px]">{t.activeFriends}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 text-center">
            <Crown className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-amber-400">{referralStats.vip}</p>
            <p className="text-gray-500 text-[10px]">{t.vipFriends}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <TrendingUp className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-amber-400">+{totalActiveBonus}%</p>
            <p className="text-gray-500 text-[10px]">{t.bonusRate}</p>
          </div>
        </div>
      </div>

      {/* Bonus Structure Card */}
      <div className="px-5 mb-6">
        <button
          onClick={() => setShowBonusInfo(!showBonusInfo)}
          className="w-full bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-left">
                <p className="text-white font-bold">{t.bonusStructure}</p>
                <p className="text-amber-400 text-xs">{t.onlyActiveBonus}</p>
              </div>
            </div>
            {showBonusInfo ? <ChevronDown className="w-5 h-5 text-amber-500" /> : <ChevronRight className="w-5 h-5 text-amber-500" />}
          </div>
        </button>
        
        <AnimatePresence>
          {showBonusInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 mt-3 space-y-3">
                <div className="flex items-start gap-2 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                  <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-300 text-xs">
                    बोनस फक्त <span className="font-bold">सक्रिय (Active)</span> रेफरलवर मिळतो. निष्क्रिय रेफरलवर बोनस नाही.
                  </p>
                </div>
                
                {[1, 2, 3, 4, 5].map((level) => (
                  <div key={level} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${levelBonuses[level].color} flex items-center justify-center`}>
                        <span className="text-white font-bold text-sm">{level}</span>
                      </div>
                      <span className="text-gray-400 text-sm">{levelBonuses[level].desc}</span>
                    </div>
                    <span className="text-emerald-400 font-bold">+{levelBonuses[level].percent}%</span>
                  </div>
                ))}
                
                <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-center">
                  <p className="text-emerald-400 text-sm font-semibold">
                    Maximum Bonus: +21% (सर्व लेव्हल मिळून)
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5-Level Network - Collapsible */}
      <div className="px-5 mb-6">
        <button 
          onClick={() => setNetworkExpanded(!networkExpanded)}
          className="w-full flex items-center justify-between mb-4"
        >
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            {t.yourNetwork}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">{networkExpanded ? 'Collapse' : 'Expand'}</span>
            {networkExpanded ? (
              <ChevronDown className="w-5 h-5 text-amber-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </button>
        
        <AnimatePresence>
          {networkExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3 overflow-hidden"
            >
          {[1, 2, 3, 4, 5].map((level) => {
            const levelData = referralLevels.find(l => l.level === level) || { 
              level, 
              users: [], 
              count: 0, 
              active_count: 0 
            };
            const isExpanded = expandedLevel === level;
            const users = levelData.users || [];
            const totalCount = levelData.count || users.length;
            const activeCount = levelData.active_count || users.filter(u => u.is_active).length;
            const hasUsers = totalCount > 0;
            
            return (
              <motion.div
                key={level}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: level * 0.05 }}
              >
                <button
                  onClick={() => setExpandedLevel(isExpanded ? null : level)}
                  className={`w-full rounded-2xl p-4 transition-all ${
                    isExpanded 
                      ? 'bg-gray-800/80 border-2 border-amber-500/50' 
                      : 'bg-gray-900/50 border border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${levelBonuses[level].color} flex items-center justify-center shadow-lg`}>
                        <span className="text-white font-bold text-lg">L{level}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-white font-semibold">{t.level} {level}</p>
                        <p className="text-gray-500 text-xs">{levelBonuses[level].desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-lg">{totalCount}</span>
                          <span className="text-gray-600">/</span>
                          <span className="text-emerald-400 font-semibold">{activeCount}</span>
                        </div>
                        <p className="text-gray-500 text-[10px]">Total / Active</p>
                      </div>
                      <div className="bg-emerald-500/20 px-2 py-1 rounded-lg">
                        <span className="text-emerald-400 text-xs font-bold">+{levelBonuses[level].percent}%</span>
                      </div>
                      {hasUsers && (
                        isExpanded ? <ChevronDown className="w-5 h-5 text-amber-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Users List */}
                <AnimatePresence>
                  {isExpanded && hasUsers && users.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-gray-900/30 rounded-xl p-3 mt-2 ml-6 border-l-2 border-amber-500/30">
                        <div className="space-y-2">
                          {users.map((referral, idx) => (
                            <div 
                              key={referral.uid || idx} 
                              className={`flex items-center justify-between p-3 rounded-xl ${
                                referral.is_active 
                                  ? 'bg-emerald-500/10 border border-emerald-500/30' 
                                  : 'bg-gray-800/50 border border-gray-700'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  referral.is_active ? 'bg-emerald-500' : 'bg-gray-600'
                                }`}>
                                  {referral.is_active ? (
                                    <UserCheck className="w-4 h-4 text-white" />
                                  ) : (
                                    <UserX className="w-4 h-4 text-gray-400" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-white text-sm font-medium">
                                    {referral.name || referral.email?.split('@')[0] || 'User'}
                                  </p>
                                  <p className={`text-xs ${referral.is_active ? 'text-emerald-400' : 'text-gray-500'}`}>
                                    {referral.is_active ? t.active : t.inactive}
                                    {referral.membership_type === 'vip' && ' • 👑 VIP'}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                {referral.is_active ? (
                                  <span className="text-emerald-400 text-xs font-bold">+{levelBonuses[level].percent}%</span>
                                ) : (
                                  <span className="text-gray-500 text-xs">0%</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Level Summary */}
                        <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between items-center">
                          <span className="text-gray-400 text-xs">Level {level} Bonus:</span>
                          <span className="text-amber-400 font-bold">
                            +{activeCount * levelBonuses[level].percent}% ({activeCount} active × {levelBonuses[level].percent}%)
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Empty state for levels with no users */}
                <AnimatePresence>
                  {isExpanded && !hasUsers && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-gray-900/30 rounded-xl p-4 mt-2 ml-6 border-l-2 border-gray-700 text-center">
                        <UserX className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No referrals at this level yet</p>
                        <p className="text-gray-600 text-xs mt-1">Share your code to grow your network!</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Apply Referral Code */}
      {!userData?.referred_by && (
        <div className="px-5">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-bold mb-3">{t.haveCode}</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder={t.enterCode}
                className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 uppercase tracking-wider focus:border-amber-500 focus:outline-none"
                maxLength={8}
              />
              <button
                onClick={applyReferralCode}
                disabled={applying}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-900 font-bold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all disabled:opacity-50"
              >
                {applying ? '...' : t.apply}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Referrals;
