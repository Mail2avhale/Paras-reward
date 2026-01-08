import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Copy, Check, UserPlus, Share2, ArrowLeft, Gift, Crown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
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
  const [referrals, setReferrals] = useState([]);

  const t = {
    title: language === 'mr' ? 'मित्रांना आमंत्रित करा' : language === 'hi' ? 'दोस्तों को आमंत्रित करें' : 'Invite Friends',
    yourCode: language === 'mr' ? 'तुमचा कोड' : language === 'hi' ? 'आपका कोड' : 'Your Code',
    copyCode: language === 'mr' ? 'कॉपी करा' : language === 'hi' ? 'कॉपी करें' : 'Copy Code',
    copied: language === 'mr' ? 'कॉपी झाले!' : language === 'hi' ? 'कॉपी हो गया!' : 'Copied!',
    shareWhatsApp: language === 'mr' ? 'WhatsApp वर शेअर करा' : language === 'hi' ? 'WhatsApp पर शेयर करें' : 'Share on WhatsApp',
    totalFriends: language === 'mr' ? 'एकूण मित्र' : language === 'hi' ? 'कुल दोस्त' : 'Total Friends',
    activeFriends: language === 'mr' ? 'सक्रिय मित्र' : language === 'hi' ? 'सक्रिय दोस्त' : 'Active Friends',
    vipFriends: language === 'mr' ? 'VIP मित्र' : language === 'hi' ? 'VIP दोस्त' : 'VIP Friends',
    bonusRate: language === 'mr' ? 'बोनस दर' : language === 'hi' ? 'बोनस दर' : 'Bonus Rate',
    haveCode: language === 'mr' ? 'कोड आहे का?' : language === 'hi' ? 'कोड है?' : 'Have a code?',
    enterCode: language === 'mr' ? 'कोड टाका' : language === 'hi' ? 'कोड डालें' : 'Enter code',
    apply: language === 'mr' ? 'लागू करा' : language === 'hi' ? 'लागू करें' : 'Apply',
    yourNetwork: language === 'mr' ? 'तुमचे मित्र' : language === 'hi' ? 'आपके दोस्त' : 'Your Network',
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
      
      // Fetch referral stats
      try {
        const statsResponse = await axios.get(`${API}/api/referrals/${user.uid}/stats`);
        setReferralStats(statsResponse.data);
      } catch (e) {
        setReferralStats({ total: userResponse.data.referral_count || 0, active: 0, vip: 0 });
      }
      
      // Fetch referrals list
      try {
        const listResponse = await axios.get(`${API}/api/referrals/${user.uid}`);
        setReferrals(listResponse.data.referrals || []);
      } catch (e) {
        setReferrals([]);
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
  const bonusPercent = (referralStats.total || 0) * 10;

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
            <p className="text-gray-400 text-sm">Earn bonus on every friend</p>
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
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
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

      {/* Stats Grid */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4"
          >
            <Users className="w-8 h-8 text-blue-500 mb-2" />
            <p className="text-gray-400 text-xs">{t.totalFriends}</p>
            <p className="text-2xl font-bold text-white">{referralStats.total || 0}</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4"
          >
            <TrendingUp className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-gray-400 text-xs">{t.bonusRate}</p>
            <p className="text-2xl font-bold text-white">+{bonusPercent}%</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4"
          >
            <UserPlus className="w-8 h-8 text-purple-500 mb-2" />
            <p className="text-gray-400 text-xs">{t.activeFriends}</p>
            <p className="text-2xl font-bold text-white">{referralStats.active || 0}</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4"
          >
            <Crown className="w-8 h-8 text-amber-500 mb-2" />
            <p className="text-gray-400 text-xs">{t.vipFriends}</p>
            <p className="text-2xl font-bold text-white">{referralStats.vip || 0}</p>
          </motion.div>
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

      {/* Referrals List */}
      {referrals.length > 0 && (
        <div className="px-5">
          <h2 className="text-white font-bold text-lg mb-4">{t.yourNetwork}</h2>
          <div className="space-y-3">
            {referrals.slice(0, 10).map((ref, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <span className="text-white font-bold">
                      {(ref.name || ref.email || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{ref.name || ref.email?.split('@')[0] || 'Friend'}</p>
                    <p className="text-gray-500 text-xs">Level {ref.level || 1}</p>
                  </div>
                </div>
                {ref.membership_type === 'vip' && (
                  <div className="bg-amber-500/20 px-2 py-1 rounded-full">
                    <span className="text-amber-400 text-xs font-medium flex items-center gap-1">
                      <Crown className="w-3 h-3" /> VIP
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {referrals.length === 0 && (
        <div className="px-5">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
            <UserPlus className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No friends invited yet</p>
            <Button 
              onClick={shareOnWhatsApp}
              className="bg-green-600 hover:bg-green-700"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Invite First Friend
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Referrals;
