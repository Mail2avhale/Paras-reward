import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Copy, Check, UserPlus, Share2, ArrowLeft, Gift, Crown, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [expandedLevel, setExpandedLevel] = useState(1);

  const t = {
    title: language === 'mr' ? 'मित्रांना आमंत्रित करा' : language === 'hi' ? 'दोस्तों को आमंत्रित करें' : 'Invite Friends',
    yourCode: language === 'mr' ? 'तुमचा कोड' : language === 'hi' ? 'आपका कोड' : 'Your Code',
    copyCode: language === 'mr' ? 'कॉपी करा' : language === 'hi' ? 'कॉपी करें' : 'Copy Code',
    copied: language === 'mr' ? 'कॉपी झाले!' : language === 'hi' ? 'कॉपी हो गया!' : 'Copied!',
    totalFriends: language === 'mr' ? 'एकूण मित्र' : language === 'hi' ? 'कुल दोस्त' : 'Total Friends',
    bonusRate: language === 'mr' ? 'बोनस दर' : language === 'hi' ? 'बोनस दर' : 'Bonus Rate',
    haveCode: language === 'mr' ? 'कोड आहे का?' : language === 'hi' ? 'कोड है?' : 'Have a code?',
    enterCode: language === 'mr' ? 'कोड टाका' : language === 'hi' ? 'कोड डालें' : 'Enter code',
    apply: language === 'mr' ? 'लागू करा' : language === 'hi' ? 'लागू करें' : 'Apply',
    level: language === 'mr' ? 'लेव्हल' : language === 'hi' ? 'लेवल' : 'Level',
    yourNetwork: language === 'mr' ? 'तुमचे नेटवर्क' : language === 'hi' ? 'आपका नेटवर्क' : 'Your Network',
    directReferrals: language === 'mr' ? 'थेट रेफरल' : language === 'hi' ? 'सीधा रेफरल' : 'Direct Referrals',
  };

  // Level bonus percentages
  const levelBonuses = {
    1: 10, // Level 1: 10% bonus
    2: 5,  // Level 2: 5% bonus
    3: 3,  // Level 3: 3% bonus
    4: 2,  // Level 4: 2% bonus
    5: 1   // Level 5: 1% bonus
  };

  const levelColors = {
    1: 'from-purple-600 to-violet-700',
    2: 'from-blue-600 to-indigo-700',
    3: 'from-emerald-600 to-teal-700',
    4: 'from-orange-600 to-amber-700',
    5: 'from-pink-600 to-rose-700'
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
        setReferralLevels(levelsResponse.data.levels || []);
        
        // Calculate stats from levels
        const totalCount = levelsResponse.data.levels?.reduce((sum, level) => sum + (level.users?.length || 0), 0) || 0;
        setReferralStats({ 
          total: totalCount,
          active: levelsResponse.data.active_count || 0,
          vip: levelsResponse.data.vip_count || 0
        });
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
            bonus: levelBonuses[level]
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
          setReferralLevels([
            { level: 1, users: [], count: userResponse.data.referral_count || 0, bonus: 10 },
            { level: 2, users: [], count: 0, bonus: 5 },
            { level: 3, users: [], count: 0, bonus: 3 },
            { level: 4, users: [], count: 0, bonus: 2 },
            { level: 5, users: [], count: 0, bonus: 1 },
          ]);
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
    const message = `Join PARAS REWARD and earn PRC! Use my code: ${code}\n\nDownload now: https://parasreward.com`;
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
  const totalBonus = referralLevels.reduce((sum, level) => sum + ((level.count || 0) * level.bonus), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">{t.title}</h1>
            <p className="text-gray-400 text-sm">5-Level Referral System</p>
          </div>
        </div>
      </div>

      {/* Referral Code Card */}
      <div className="px-5 mb-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-6"
          style={{
            background: 'linear-gradient(135deg, #312e81 0%, #4c1d95 50%, #581c87 100%)',
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-purple-300" />
              <span className="text-purple-300 text-sm font-medium">{t.yourCode}</span>
            </div>
            
            <div className="bg-black/30 rounded-2xl p-4 mb-4">
              <div className="text-3xl font-bold text-white text-center tracking-widest font-mono">
                {referralCode}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={copyCode}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? t.copied : t.copyCode}
              </Button>
              <Button 
                onClick={shareOnWhatsApp}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Share2 className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Stats Overview */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
            <Users className="w-8 h-8 text-blue-500 mb-2" />
            <p className="text-gray-400 text-xs">{t.totalFriends}</p>
            <p className="text-2xl font-bold text-white">{referralStats.total || 0}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
            <TrendingUp className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-gray-400 text-xs">{t.bonusRate}</p>
            <p className="text-2xl font-bold text-white">+{totalBonus}%</p>
          </div>
        </div>
      </div>

      {/* 5-Level Network */}
      <div className="px-5 mb-6">
        <h2 className="text-white font-bold text-lg mb-4">{t.yourNetwork}</h2>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((level) => {
            const levelData = referralLevels.find(l => l.level === level) || { level, users: [], count: 0, bonus: levelBonuses[level] };
            const isExpanded = expandedLevel === level;
            const hasUsers = levelData.count > 0 || (levelData.users && levelData.users.length > 0);
            
            return (
              <motion.div
                key={level}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: level * 0.05 }}
              >
                <button
                  onClick={() => setExpandedLevel(isExpanded ? null : level)}
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${levelColors[level]} flex items-center justify-center`}>
                        <span className="text-white font-bold text-lg">{level}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-white font-semibold">{t.level} {level}</p>
                        <p className="text-gray-500 text-sm">
                          {level === 1 ? t.directReferrals : `${t.level} ${level} Referrals`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-white font-bold">{levelData.count || levelData.users?.length || 0}</p>
                        <p className="text-emerald-400 text-xs">+{levelBonuses[level]}%</p>
                      </div>
                      {hasUsers ? (
                        isExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />
                      ) : null}
                    </div>
                  </div>
                </button>

                {/* Expanded Users List */}
                <AnimatePresence>
                  {isExpanded && levelData.users && levelData.users.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 ml-4 space-y-2">
                        {levelData.users.map((refUser, index) => (
                          <div 
                            key={index}
                            className="bg-gray-800/50 rounded-xl p-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${levelColors[level]} flex items-center justify-center`}>
                                <span className="text-white text-xs font-bold">
                                  {(refUser.name || refUser.email || 'U')[0].toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-white text-sm font-medium">
                                  {refUser.name || refUser.email?.split('@')[0] || 'Friend'}
                                </p>
                                <p className="text-gray-500 text-xs">
                                  Joined {refUser.created_at ? new Date(refUser.created_at).toLocaleDateString() : 'Recently'}
                                </p>
                              </div>
                            </div>
                            {refUser.membership_type === 'vip' && (
                              <div className="bg-amber-500/20 px-2 py-1 rounded-full">
                                <Crown className="w-3 h-3 text-amber-400" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bonus Structure */}
      <div className="px-5 mb-6">
        <h2 className="text-white font-bold text-lg mb-4">Bonus Structure</h2>
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((level) => (
              <div key={level} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${levelColors[level]} flex items-center justify-center`}>
                    <span className="text-white text-xs font-bold">{level}</span>
                  </div>
                  <span className="text-gray-400 text-sm">{t.level} {level}</span>
                </div>
                <span className="text-emerald-400 font-bold">+{levelBonuses[level]}%</span>
              </div>
            ))}
            <div className="border-t border-gray-700 pt-3 mt-3 flex items-center justify-between">
              <span className="text-white font-semibold">Max Total Bonus</span>
              <span className="text-amber-400 font-bold text-lg">+21%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Apply Referral Code */}
      {!userData?.referred_by && (
        <div className="px-5 mb-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3">{t.haveCode}</h3>
            <div className="flex gap-2">
              <Input 
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder={t.enterCode}
                className="bg-gray-800 border-gray-700 text-white uppercase"
                maxLength={8}
              />
              <Button 
                onClick={applyReferralCode}
                disabled={applying || !inputCode.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                {applying ? '...' : t.apply}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Referrals;
