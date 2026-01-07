import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Copy, Check, UserPlus, Link2, Share2, TrendingUp, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Referral page translations
const referralTranslations = {
  referrals: { mr: "रेफरल्स", hi: "रेफरल्स", en: "Referrals" },
  yourReferralCode: { mr: "तुमचा रेफरल कोड", hi: "आपका रेफरल कोड", en: "Your Referral Code" },
  shareAndEarn: { mr: "शेअर करा आणि कमवा", hi: "शेयर करें और कमाएं", en: "Share & Earn" },
  inviteFriends: { mr: "मित्रांना आमंत्रित करा", hi: "दोस्तों को आमंत्रित करें", en: "Invite Friends" },
  totalReferrals: { mr: "एकूण रेफरल्स", hi: "कुल रेफरल्स", en: "Total Referrals" },
  activeReferrals: { mr: "सक्रिय रेफरल्स", hi: "सक्रिय रेफरल्स", en: "Active Referrals" },
  vipReferrals: { mr: "VIP रेफरल्स", hi: "VIP रेफरल्स", en: "VIP Referrals" },
  copyCode: { mr: "कोड कॉपी करा", hi: "कोड कॉपी करें", en: "Copy Code" },
  copyLink: { mr: "लिंक कॉपी करा", hi: "लिंक कॉपी करें", en: "Copy Link" },
  copied: { mr: "कॉपी केले!", hi: "कॉपी हो गया!", en: "Copied!" },
  referralLink: { mr: "रेफरल लिंक", hi: "रेफरल लिंक", en: "Referral Link" },
  shareOnWhatsapp: { mr: "WhatsApp वर शेअर करा", hi: "WhatsApp पर शेयर करें", en: "Share on WhatsApp" },
  yourNetwork: { mr: "तुमचे मित्र", hi: "आपके दोस्त", en: "Your Friends" },
  level: { mr: "स्तर", hi: "स्तर", en: "Level" },
  users: { mr: "वापरकर्ते", hi: "उपयोगकर्ता", en: "Users" },
  earnedPRC: { mr: "मिळवलेले PRC", hi: "मिला PRC", en: "Earned PRC" },
  goBack: { mr: "मागे जा", hi: "वापस जाएं", en: "Go Back" },
  applyReferralCode: { mr: "रेफरल कोड लागू करा", hi: "रेफरल कोड लागू करें", en: "Apply Referral Code" },
  enterCode: { mr: "कोड एंटर करा", hi: "कोड दर्ज करें", en: "Enter Code" },
  apply: { mr: "लागू करा", hi: "लागू करें", en: "Apply" },
  referralDesc: { 
    mr: "मित्रांना आमंत्रित करा आणि बोनस PRC मिळवा! प्रत्येक रेफरलवर बोनस मिळतो.",
    hi: "दोस्तों को आमंत्रित करें और बोनस PRC पाएं! हर रेफरल पर बोनस मिलता है।",
    en: "Invite friends and earn bonus PRC! Get bonus on every referral."
  }
};

const Referrals = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  // Local translation function
  const t = (key) => {
    const translation = referralTranslations[key];
    if (!translation) return key;
    return translation[language] || translation['en'] || key;
  };
  
  const [referralCode, setReferralCode] = useState(user?.referral_code || '');
  const [referrals, setReferrals] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total_referrals: 0,
    active_referrals: 0,
    vip_referrals: 0
  });
  const [multiLevelStats, setMultiLevelStats] = useState(null);
  const [showLevelDetails, setShowLevelDetails] = useState(false);
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Generate referral link
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  useEffect(() => {
    if (user?.uid) {
      fetchReferralCode();
      fetchReferrals();
      fetchReferralStats();
      fetchMultiLevelStats();
    } else {
      setError('User information not available. Please try logging out and logging back in.');
      setLoading(false);
    }
  }, [user?.uid]);

  const fetchReferralCode = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user?.uid) {
        throw new Error('User UID not available');
      }
      
      const response = await axios.get(`${API}/referral/code/${user.uid}`);
      
      if (response.data.referral_code) {
        setReferralCode(response.data.referral_code);
      } else {
        throw new Error('Referral code not found in response');
      }
    } catch (error) {
      console.error('Error fetching referral code:', error);
      setError(error.response?.data?.detail || error.message || 'Failed to load referral code');
      toast.error('Failed to load referral code');
    } finally {
      setLoading(false);
    }
  };

  const fetchReferrals = async () => {
    try {
      if (!user?.uid) {
        console.error('User UID not available');
        return;
      }
      const response = await axios.get(`${API}/referral/list/${user.uid}`);
      setReferrals(response.data.referrals || []);
    } catch (error) {
      console.error('Error fetching referrals:', error);
      toast.error('Failed to load referrals');
    }
  };

  const fetchReferralStats = async () => {
    try {
      if (!user?.uid) return;
      const response = await axios.get(`${API}/referral/stats/${user.uid}`);
      setStats(response.data || {
        total_referrals: 0,
        active_referrals: 0,
        vip_referrals: 0
      });
    } catch (error) {
      console.error('Error fetching referral stats:', error);
    }
  };

  const fetchMultiLevelStats = async () => {
    try {
      if (!user?.uid) return;
      const response = await axios.get(`${API}/referral/multi-level-stats/${user.uid}`);
      setMultiLevelStats(response.data);
    } catch (error) {
      console.error('Error fetching multi-level stats:', error);
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    toast.success('Referral code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    toast.success('Referral link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareReferralLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join PARAS REWARD',
          text: `Join PARAS REWARD using my referral code: ${referralCode}`,
          url: referralLink
        });
        toast.success('Shared successfully!');
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
          toast.error('Failed to share');
        }
      }
    } else {
      copyReferralLink();
    }
  };

  const applyReferralCode = async () => {
    if (!applyCode) {
      toast.error('Please enter a referral code');
      return;
    }

    try {
      await axios.post(`${API}/referral/apply/${user.uid}?referral_code=${applyCode}`);
      toast.success('Referral code applied successfully!');
      setApplyCode('');
      fetchReferralStats();
    } catch (error) {
      console.error('Error applying referral:', error);
      toast.error(error.response?.data?.detail || 'Failed to apply referral code');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pt-20 pb-24">
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">{t('goBack')}</span>
        </button>
        
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">{t('referrals')}</h1>

        {/* Referral Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100">
            <Users className="h-8 w-8 text-purple-600 mb-2" />
            <div className="text-sm font-medium text-purple-600 mb-1">{t('totalReferrals')}</div>
            <div className="text-3xl font-bold text-purple-900">{stats.total_referrals}</div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
            <TrendingUp className="h-8 w-8 text-green-600 mb-2" />
            <div className="text-sm font-medium text-green-600 mb-1">{t('activeReferrals')}</div>
            <div className="text-3xl font-bold text-green-900">{stats.active_referrals}</div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100">
            <UserPlus className="h-8 w-8 text-amber-600 mb-2" />
            <div className="text-sm font-medium text-amber-600 mb-1">{t('vipReferrals')}</div>
            <div className="text-3xl font-bold text-amber-900">{stats.vip_referrals}</div>
          </Card>
        </div>

        {/* Multi-Level Referral Stats */}
        {multiLevelStats && (
          <Card className="p-6 mb-8 bg-gradient-to-br from-gray-900 to-gray-800 text-white" data-testid="multi-level-stats">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-green-400" />
                  {language === 'mr' ? 'रेफरल बोनस तपशील' : language === 'hi' ? 'रेफरल बोनस विवरण' : 'Referral Bonus Details'}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {language === 'mr' ? 'तुमच्या referrals मुळे किती बोनस मिळाला ते बघा' 
                   : language === 'hi' ? 'आपके referrals से कितना बोनस मिला देखें'
                   : 'See how your referrals earn you bonus PRC'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => setShowLevelDetails(!showLevelDetails)}
              >
                {showLevelDetails 
                  ? (language === 'mr' ? 'तपशील लपवा' : language === 'hi' ? 'विवरण छुपाएं' : 'Hide Details')
                  : (language === 'mr' ? 'तपशील दाखवा' : language === 'hi' ? 'विवरण दिखाएं' : 'Show Details')}
              </Button>
            </div>

            {/* Rewards Rate Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-gray-400 text-sm">{language === 'mr' ? 'बेस दर' : language === 'hi' ? 'बेस दर' : 'Base Rate'}</div>
                <div className="text-2xl font-bold text-white">
                  {multiLevelStats.base_mining_rate?.toFixed(2)} PRC/{language === 'mr' ? 'दिवस' : language === 'hi' ? 'दिन' : 'day'}
                </div>
              </div>
              <div className="bg-green-500/20 rounded-xl p-4">
                <div className="text-green-300 text-sm">{language === 'mr' ? 'एकूण रेफरल बोनस' : language === 'hi' ? 'कुल रेफरल बोनस' : 'Total Referral Bonus'}</div>
                <div className="text-2xl font-bold text-green-400">
                  {multiLevelStats.summary?.total_mining_bonus_display}
                </div>
              </div>
              <div className="bg-purple-500/20 rounded-xl p-4">
                <div className="text-purple-300 text-sm">{language === 'mr' ? 'प्रभावी दर' : language === 'hi' ? 'प्रभावी दर' : 'Effective Rate'}</div>
                <div className="text-2xl font-bold text-purple-400">
                  {multiLevelStats.summary?.effective_mining_rate_display}
                </div>
              </div>
            </div>

            {/* Level-wise Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {multiLevelStats.levels?.map((level) => {
                const levelColors = {
                  1: { bg: 'from-purple-600 to-purple-700', text: 'text-purple-200', accent: 'text-purple-100' },
                  2: { bg: 'from-blue-600 to-blue-700', text: 'text-blue-200', accent: 'text-blue-100' },
                  3: { bg: 'from-green-600 to-green-700', text: 'text-green-200', accent: 'text-green-100' },
                  4: { bg: 'from-orange-600 to-orange-700', text: 'text-orange-200', accent: 'text-orange-100' },
                  5: { bg: 'from-pink-600 to-pink-700', text: 'text-pink-200', accent: 'text-pink-100' },
                };
                const colors = levelColors[level.level] || levelColors[1];
                
                return (
                  <div 
                    key={level.level} 
                    className={`bg-gradient-to-br ${colors.bg} rounded-xl p-4`}
                    data-testid={`level-${level.level}-stats`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
                        {level.level}
                      </div>
                      <div className={`text-xs ${colors.text}`}>
                        {level.bonus_percentage}% bonus
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${colors.accent}`}>
                      {level.total} Referrals
                    </div>
                    <div className="flex justify-between text-xs mt-2">
                      <span className="text-green-300">✓ {level.active} Active</span>
                      <span className="text-red-300">✗ {level.inactive} Inactive</span>
                    </div>
                    <div className={`text-sm mt-2 pt-2 border-t border-white/20 ${colors.accent}`}>
                      {level.mining_speed_bonus_display}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Table - Show/Hide */}
            {showLevelDetails && (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="py-2 text-left text-gray-400">Level</th>
                      <th className="py-2 text-center text-gray-400">Total</th>
                      <th className="py-2 text-center text-green-400">Active</th>
                      <th className="py-2 text-center text-red-400">Inactive</th>
                      <th className="py-2 text-center text-gray-400">Bonus %</th>
                      <th className="py-2 text-right text-green-400">Mining Bonus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiLevelStats.levels?.map((level) => (
                      <tr key={level.level} className="border-b border-white/10">
                        <td className="py-3 font-semibold">Level {level.level}</td>
                        <td className="py-3 text-center">{level.total}</td>
                        <td className="py-3 text-center text-green-400">{level.active}</td>
                        <td className="py-3 text-center text-red-400">{level.inactive}</td>
                        <td className="py-3 text-center">{level.bonus_percentage}%</td>
                        <td className="py-3 text-right text-green-400">{level.mining_speed_bonus_display}</td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-white/5">
                      <td className="py-3">Total</td>
                      <td className="py-3 text-center">{multiLevelStats.summary?.total_referrals}</td>
                      <td className="py-3 text-center text-green-400">{multiLevelStats.summary?.total_active}</td>
                      <td className="py-3 text-center text-red-400">{multiLevelStats.summary?.total_inactive}</td>
                      <td className="py-3 text-center">-</td>
                      <td className="py-3 text-right text-green-400">{multiLevelStats.summary?.total_mining_bonus_display}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Info Box */}
            <div className="mt-4 p-3 bg-white/5 rounded-lg text-xs text-gray-400">
              <strong className="text-white">{language === 'mr' ? 'कसे काम करते:' : language === 'hi' ? 'कैसे काम करता है:' : 'How it works:'}</strong> 
              {language === 'mr' ? ' Active referrals (last 24 hours login) वरून mining bonus मिळतो. जितके जास्त active referrals, तितकी जास्त mining speed!'
               : language === 'hi' ? ' Active referrals (last 24 hours login) से mining bonus मिलता है। जितने ज्यादा active referrals, उतनी ज्यादा mining speed!'
               : ' Active referrals (last 24 hours login) give you mining bonus. More active referrals = faster mining!'}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Your Referral Code & Link */}
          <Card data-testid="referral-code-card" className="bg-gradient-to-br from-purple-600 to-pink-600 text-white p-8 rounded-3xl shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <Users className="h-7 w-7 mr-2" />
              {t('yourReferralCode')}
            </h2>
            
            <div className="bg-white/20 backdrop-blur-sm p-6 rounded-2xl mb-4">
              {loading ? (
                <div className="text-center py-4">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-white border-r-transparent"></div>
                  <p className="mt-2 text-white/70">{language === 'mr' ? 'लोड होत आहे...' : language === 'hi' ? 'लोड हो रहा है...' : 'Loading...'}</p>
                </div>
              ) : error ? (
                <div className="text-center py-4">
                  <p className="text-red-200 text-sm mb-2">{error}</p>
                  <Button
                    onClick={fetchReferralCode}
                    size="sm"
                    className="bg-white text-purple-600 hover:bg-gray-100"
                  >
                    {language === 'mr' ? 'पुन्हा प्रयत्न करा' : language === 'hi' ? 'फिर से कोशिश करें' : 'Retry'}
                  </Button>
                </div>
              ) : referralCode ? (
                <p className="text-4xl font-bold text-center tracking-wider">{referralCode}</p>
              ) : (
                <p className="text-2xl text-center text-white/70">{language === 'mr' ? 'कोड उपलब्ध नाही' : language === 'hi' ? 'कोड उपलब्ध नहीं' : 'No code available'}</p>
              )}
            </div>
            
            <Button
              data-testid="copy-code-btn"
              onClick={copyReferralCode}
              disabled={!referralCode || loading}
              className="w-full bg-white text-purple-600 hover:bg-gray-100 py-6 rounded-xl text-lg font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {copiedCode ? (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  {t('copied')}
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-5 w-5" />
                  {t('copyCode')}
                </>
              )}
            </Button>

            {/* Referral Link Section */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Your Referral Link</h3>
              </div>
              
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
                <p className="text-sm font-mono break-all">{referralLink}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={copyReferralLink}
                  disabled={!referralCode || loading}
                  className="w-full bg-white/30 hover:bg-white/40 text-white py-4 rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  {copiedLink ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Link
                    </>
                  )}
                </Button>

                <Button
                  onClick={shareReferralLink}
                  disabled={!referralCode || loading}
                  className="w-full bg-white/30 hover:bg-white/40 text-white py-4 rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>

            <div className="mt-6 p-4 bg-white/10 rounded-xl">
              <p className="text-sm opacity-90">
                <strong>Bonus:</strong> +10% mining rate per active referral (Max 200)
              </p>
            </div>
          </Card>

          {/* Apply Referral Code */}
          <Card data-testid="apply-referral-card" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <UserPlus className="h-7 w-7 mr-2 text-purple-600" />
              Apply Referral Code
            </h2>
            <p className="text-gray-600 mb-6">
              Enter a friend's referral code to help them earn bonus mining rewards!
            </p>
            <div className="space-y-4">
              <Input
                data-testid="apply-code-input"
                type="text"
                placeholder="Enter referral code"
                value={applyCode}
                onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                className="py-6 text-lg rounded-xl border-2 border-gray-200 focus:border-purple-500"
              />
              <Button
                data-testid="apply-code-btn"
                onClick={applyReferralCode}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold shadow-lg transition-all"
              >
                Apply Code
              </Button>
            </div>
          </Card>
        </div>

        {/* Referral Stats */}
        <Card data-testid="referral-stats" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Referrals</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-purple-100 to-pink-100 p-6 rounded-2xl">
              <p className="text-sm text-gray-600 mb-1">Total Referrals</p>
              <p className="text-4xl font-bold text-gray-900">{referrals.length}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-6 rounded-2xl">
              <p className="text-sm text-gray-600 mb-1">Active Referrals</p>
              <p className="text-4xl font-bold text-gray-900">
                {referrals.filter(r => r.is_active).length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-pink-100 to-orange-100 p-6 rounded-2xl">
              <p className="text-sm text-gray-600 mb-1">Bonus Rate</p>
              <p className="text-4xl font-bold text-gray-900">
                +{referrals.filter(r => r.is_active).length * 10}%
              </p>
            </div>
          </div>

          {/* Referral List */}
          <div className="space-y-4">
            {referrals.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No referrals yet. Share your code to start earning!</p>
              </div>
            ) : (
              referrals.map((referral, index) => (
                <div
                  key={index}
                  data-testid={`referral-${index}`}
                  className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={referral.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(referral.name)}`}
                      alt={referral.name}
                      className="w-12 h-12 rounded-full"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">{referral.name}</p>
                      <p className="text-sm text-gray-500">UID: {referral.uid.substring(0, 8)}...</p>
                    </div>
                  </div>
                  <div>
                    {referral.is_active ? (
                      <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Referrals;