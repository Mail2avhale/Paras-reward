import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, Play, Clock, Zap, TrendingUp, Users, AlertCircle, Crown, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import notifications from '@/utils/notifications';
import AnimatedFeedback from '@/components/AnimatedFeedback';
import { useLanguage } from '@/contexts/LanguageContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Mining page translations
const miningTranslations = {
  mining: { mr: "माइनिंग", hi: "माइनिंग", en: "Mining" },
  startMining: { mr: "माइनिंग सुरू करा", hi: "माइनिंग शुरू करें", en: "Start Mining" },
  miningActive: { mr: "माइनिंग सक्रिय", hi: "माइनिंग सक्रिय", en: "Mining Active" },
  miningPaused: { mr: "माइनिंग थांबवले", hi: "माइनिंग रुका हुआ", en: "Mining Paused" },
  sessionComplete: { mr: "सत्र पूर्ण", hi: "सत्र पूर्ण", en: "Session Complete" },
  currentSession: { mr: "वर्तमान सत्र", hi: "वर्तमान सत्र", en: "Current Session" },
  todayMined: { mr: "आज माइन केलेले", hi: "आज माइन किया", en: "Today Mined" },
  totalMined: { mr: "एकूण माइन", hi: "कुल माइन", en: "Total Mined" },
  prcBalance: { mr: "PRC शिल्लक", hi: "PRC बैलेंस", en: "PRC Balance" },
  timeRemaining: { mr: "उर्वरित वेळ", hi: "शेष समय", en: "Time Remaining" },
  sessionsToday: { mr: "आज सत्रे", hi: "आज सत्र", en: "Sessions Today" },
  miningRate: { mr: "माइनिंग दर", hi: "माइनिंग दर", en: "Mining Rate" },
  perHour: { mr: "/तास", hi: "/घंटा", en: "/hour" },
  freeUserWarning: { 
    mr: "फ्री युजर: PRC 2 दिवसांसाठी वैध",
    hi: "फ्री यूजर: PRC 2 दिनों के लिए वैध",
    en: "Free User: PRC valid for 2 days"
  },
  upgradeToVip: { mr: "VIP बना", hi: "VIP बनें", en: "Upgrade to VIP" },
  miningComplete: { mr: "माइनिंग पूर्ण!", hi: "माइनिंग पूर्ण!", en: "Mining Complete!" },
  earned: { mr: "कमावले", hi: "कमाया", en: "Earned" },
  goBack: { mr: "मागे जा", hi: "वापस जाएं", en: "Go Back" },
  referralBonus: { mr: "रेफरल बोनस", hi: "रेफरल बोनस", en: "Referral Bonus" },
  inviteFriends: { mr: "मित्रांना आमंत्रित करा", hi: "दोस्तों को आमंत्रित करें", en: "Invite Friends" },
  stats: { mr: "आकडेवारी", hi: "आंकड़े", en: "Stats" },
  sessionEnds: { mr: "सत्र संपते", hi: "सत्र समाप्त", en: "Session Ends" },
  sessionEarned: { mr: "सत्रात कमावले", hi: "सत्र में कमाया", en: "Session Earned" },
  baseMiningRate: { mr: "बेस माइनिंग दर", hi: "बेस माइनिंग दर", en: "Base Mining Rate" },
  totalReferralBonus: { mr: "एकूण रेफरल बोनस", hi: "कुल रेफरल बोनस", en: "Total Referral Bonus" },
  vipBonus: { mr: "VIP बोनस", hi: "VIP बोनस", en: "VIP Bonus" },
  claimRewards: { mr: "बक्षीस मिळवा", hi: "इनाम प्राप्त करें", en: "Claim Rewards" },
  start24hSession: { mr: "24 तासांचे सत्र सुरू करा", hi: "24 घंटे का सत्र शुरू करें", en: "Start 24h Session" },
  remainingInSession: { mr: "या सत्रात उर्वरित", hi: "इस सत्र में शेष", en: "remaining in this session" },
  lifetimeValidity: { mr: "आजीवन वैधता", hi: "आजीवन वैधता", en: "Lifetime validity" },
  validFor2Days: { mr: "2 दिवसांसाठी वैध", hi: "2 दिनों के लिए वैध", en: "Valid for 2 days" },
  startMiningSession: { mr: "माइनिंग सत्र सुरू करा", hi: "माइनिंग सत्र शुरू करें", en: "Start Mining Session" }
};

const Mining = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  // Local translation function
  const t = (key) => {
    const translation = miningTranslations[key];
    if (!translation) return key;
    return translation[language] || translation['en'] || key;
  };
  
  const [miningStatus, setMiningStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showValidityWarning, setShowValidityWarning] = useState(false);
  const [prcExpiryInfo, setPrcExpiryInfo] = useState(null);
  const [animatedFeedback, setAnimatedFeedback] = useState(null);
  
  const isAdmin = user?.role === 'admin';
  const isFreeUser = user?.membership_type !== 'vip';

  useEffect(() => {
    fetchMiningStatus();
    fetchPRCExpiry();
    const interval = setInterval(() => {
      fetchMiningStatus();
      fetchPRCExpiry();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchMiningStatus = async () => {
    try {
      const response = await axios.get(`${API}/api/mining/status/${user.uid}`);
      setMiningStatus(response.data);
      
      // Check if user is free and should see validity warning
      if (isFreeUser && response.data.current_balance > 0) {
        setShowValidityWarning(true);
      }
    } catch (error) {
      console.error('Error fetching mining status:', error);
    }
  };

  const fetchPRCExpiry = async () => {
    if (!isFreeUser) return;
    
    try {
      const response = await axios.get(`${API}/api/wallet/${user.uid}`);
      if (response.data.prc_expiry_info) {
        setPrcExpiryInfo(response.data.prc_expiry_info);
      }
    } catch (error) {
      console.error('Error fetching PRC expiry:', error);
    }
  };

  const startMiningSession = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/mining/start/${user.uid}`);
      
      // Show animated feedback
      setAnimatedFeedback({
        message: `⛏️ Mining Started!\n💎 Earning PRC Now!`,
        type: 'success',
        duration: 3000
      });
      
      if (isFreeUser) {
        setTimeout(() => {
          toast.info('⏰ Your PRC will be valid for 2 days. Upgrade to VIP for lifetime validity!', {
            duration: 6000
          });
        }, 3500);
      }
      fetchMiningStatus();
    } catch (error) {
      console.error('Error starting mining:', error);
      setAnimatedFeedback({
        message: `❌ Mining Failed!\n${error.response?.data?.detail || 'Please try again'}`,
        type: 'error',
        duration: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const claimCoins = async () => {
    setLoading(true);
    const loadingId = notifications.loading('Claiming PRC Rewards', 'Processing your mining rewards...');
    
    try {
      const response = await axios.post(`${API}/api/mining/claim/${user.uid}`);
      
      toast.dismiss(loadingId);
      
      const claimedAmount = response.data.amount.toFixed(2);
      
      if (response.data.expires_at) {
        const expiryDate = new Date(response.data.expires_at);
        const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        
        notifications.celebrate(
          `🎉 Claimed ${claimedAmount} PRC!`,
          `Your rewards have been added to your balance. ${isFreeUser ? `⏰ Valid for ${daysLeft} days (until ${expiryDate.toLocaleDateString()} ${expiryDate.toLocaleTimeString()}). Upgrade to VIP for lifetime validity!` : '✨ Lifetime validity - use anytime!'}`
        );
      } else {
        notifications.celebrate(
          `🎉 Claimed ${claimedAmount} PRC!`,
          'Your rewards have been added to your balance with lifetime validity!'
        );
      }
      
      fetchMiningStatus();
      fetchPRCExpiry();
    } catch (error) {
      console.error('Error claiming coins:', error);
      toast.dismiss(loadingId);
      
      notifications.error(
        'Claim Failed',
        error.response?.data?.detail || 'Unable to claim your mining rewards. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (hours) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const getPRCValidityStatus = () => {
    if (!isFreeUser || !prcExpiryInfo) return null;
    
    const { valid_prc, expired_prc, expiring_soon_prc, earliest_expiry } = prcExpiryInfo;
    
    if (valid_prc === 0 && expired_prc > 0) {
      return {
        type: 'expired',
        message: `All ${expired_prc.toFixed(2)} PRC has expired!`,
        color: 'from-red-600 to-rose-700'
      };
    }
    
    if (expiring_soon_prc > 0 && earliest_expiry) {
      const expiryDate = new Date(earliest_expiry);
      const hoursLeft = Math.floor((expiryDate - new Date()) / (1000 * 60 * 60));
      
      return {
        type: 'expiring',
        message: `${expiring_soon_prc.toFixed(2)} PRC expiring in ${hoursLeft}h!`,
        expiryDate: expiryDate,
        color: 'from-orange-500 to-red-500'
      };
    }
    
    return null;
  };

  const validityStatus = getPRCValidityStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pt-20 pb-24">
      
      <div className="container mx-auto px-3 py-8 max-w-full lg:max-w-7xl xl:max-w-[90%]">
        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">{t('goBack')}</span>
        </button>
        
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">{t('mining')}</h1>
        <p className="text-lg text-gray-600 mb-8">
          {language === 'mr' ? 'दैनिक माइनिंग कृतींद्वारे PRC रिवॉर्ड पॉइंट्स कमवा' 
           : language === 'hi' ? 'दैनिक माइनिंग गतिविधियों द्वारे PRC रिवॉर्ड पॉइंट्स कमाएं'
           : 'Earn PRC reward points through daily mining activities'}
        </p>

        {/* PRC Expiry Alert for Free Users */}
        {isFreeUser && validityStatus && (
          <Card className={`p-6 mb-6 bg-gradient-to-r ${validityStatus.color} text-white border-none`}>
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">
                  {validityStatus.type === 'expired' ? '⚠️ PRC Expired!' : '⏰ PRC Expiring Soon!'}
                </h3>
                <p className="text-white/90 mb-2">{validityStatus.message}</p>
                {validityStatus.expiryDate && (
                  <p className="text-sm text-white/80 mb-4">
                    Expiry: {validityStatus.expiryDate.toLocaleDateString()} at {validityStatus.expiryDate.toLocaleTimeString()}
                  </p>
                )}
                <p className="text-white/90 mb-4">
                  {validityStatus.type === 'expired' 
                    ? 'Mine new PRC or upgrade to VIP for lifetime validity!'
                    : 'Use it in the marketplace before it expires! Upgrade to VIP for lifetime validity.'}
                </p>
                <div className="flex gap-3">
                  <Link to="/marketplace">
                    <Button className="bg-white text-orange-600 hover:bg-gray-100">
                      Shop Now
                    </Button>
                  </Link>
                  <Link to="/vip">
                    <Button className="bg-white/20 text-white hover:bg-white/30">
                      <Crown className="mr-2 h-4 w-4" />
                      Upgrade to VIP
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Free User PRC Validity Warning */}
        {isFreeUser && showValidityWarning && !validityStatus && (
          <Card className="p-6 mb-6 bg-gradient-to-r from-orange-500 to-red-500 text-white border-none">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">⏰ Free User: PRC Valid for 2 Days Only</h3>
                <p className="text-white/90 mb-4">
                  Your mined PRC expires after 2 days. Use it to play Treasure Hunt before it expires!
                  Upgrade to VIP for lifetime PRC validity + marketplace access + higher cashback.
                </p>
                <Link to="/vip">
                  <Button className="bg-white text-orange-600 hover:bg-gray-100">
                    <Crown className="mr-2 h-4 w-4" />
                    Upgrade to VIP (₹1000/year)
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* Session Status Banner */}
        {miningStatus && (
          <Card className={`p-6 mb-8 ${
            miningStatus.session_active 
              ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
              : 'bg-gradient-to-r from-orange-500 to-red-600'
          } text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-4 h-4 rounded-full ${
                  miningStatus.session_active ? 'bg-white animate-pulse' : 'bg-white/50'
                }`}></div>
                <div>
                  <h3 className="text-2xl font-bold">
                    {miningStatus.session_active ? t('miningActive') : t('miningPaused')}
                  </h3>
                  <p className="text-white/90">
                    {miningStatus.session_active 
                      ? `${formatTime(miningStatus.remaining_hours)} ${t('remainingInSession')}`
                      : t('start24hSession')
                    }
                  </p>
                  {isFreeUser && (
                    <p className="text-xs text-white/75 mt-1">
                      ⏰ {t('freeUserWarning')} | VIP: {t('lifetimeValidity')}
                    </p>
                  )}
                </div>
              </div>
              {miningStatus.session_active && (
                <div className="text-right">
                  <p className="text-sm text-white/90">{t('sessionEnds')}</p>
                  <p className="text-lg font-bold">
                    {new Date(miningStatus.session_end).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Mining Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">{t('prcBalance')}</span>
              <Coins className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {miningStatus?.current_balance?.toFixed(2) || '0.00'}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {isFreeUser ? t('validFor2Days') : t('lifetimeValidity')}
            </p>
            {isFreeUser && prcExpiryInfo && prcExpiryInfo.valid_prc > 0 && (
              <div className="mt-2">
                <p className="text-xs text-green-600 font-medium">
                  ✓ Valid: {prcExpiryInfo.valid_prc.toFixed(2)} PRC
                </p>
                {prcExpiryInfo.expired_prc > 0 && (
                  <p className="text-xs text-red-600 font-medium">
                    ✗ Expired: {prcExpiryInfo.expired_prc.toFixed(2)} PRC
                  </p>
                )}
                {prcExpiryInfo.expiring_soon_prc > 0 && (
                  <p className="text-xs text-orange-600 font-medium">
                    ⏰ Expiring: {prcExpiryInfo.expiring_soon_prc.toFixed(2)} PRC
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">{t('miningRate')}</span>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {miningStatus?.mining_rate_per_hour?.toFixed(2) || '0.00'}
            </div>
            <p className="text-sm text-gray-500 mt-1">PRC{t('perHour')}</p>
          </Card>

          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">{t('sessionEarned')}</span>
              <Zap className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {miningStatus?.mined_this_session?.toFixed(2) || '0.00'}
            </div>
            <p className="text-sm text-gray-500 mt-1">{t('currentSession')}</p>
          </Card>

          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">{t('referralBonus')}</span>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {miningStatus?.active_referrals || 0}
            </div>
            <p className="text-sm text-gray-500 mt-1">{t('miningActive')}</p>
          </Card>
        </div>

        {/* Main Mining Control */}
        <Card className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl mb-8">
          <div className="text-center">
            {!miningStatus?.session_active ? (
              <>
                <div className="mb-6">
                  <div className="w-32 h-32 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Play className="h-16 w-16 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('startMiningSession')}</h2>
                  <p className="text-gray-600 max-w-2xl mx-auto mb-4">
                    {language === 'mr' ? '24 तासांचे माइनिंग सत्र सुरू करण्यासाठी खालील बटणावर क्लिक करा. तुम्ही तुमच्या माइनिंग रेट आणि रेफरल्सवर आधारित PRC कमवाल.' 
                     : language === 'hi' ? '24 घंटे का माइनिंग सत्र शुरू करने के लिए नीचे बटन क्लिक करें। आप अपनी माइनिंग दर और रेफरल के आधार पर PRC कमाएंगे।'
                     : 'Click the button below to start your 24-hour mining session. You\'ll earn PRC coins based on your mining rate and active referrals.'}
                  </p>
                  {isFreeUser && (
                    <p className="text-orange-600 font-medium text-sm">
                      ⏰ {t('freeUserWarning')}
                    </p>
                  )}
                </div>

                <Button
                  onClick={startMiningSession}
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-6 text-xl rounded-2xl shadow-xl"
                >
                  {loading ? 'Starting...' : 'Start Mining'}
                </Button>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <div className="relative">
                    <div className="w-32 h-32 bg-gradient-to-br from-green-600 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <Coins className="h-16 w-16 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full animate-ping"></div>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">Mining in Progress</h2>
                  <p className="text-gray-600 max-w-2xl mx-auto mb-2">
                    You're currently earning {miningStatus.mining_rate_per_hour.toFixed(2)} PRC per hour.
                  </p>
                  {isFreeUser && (
                    <p className="text-orange-600 font-medium text-sm">
                      ⏰ PRC expires 2 days after claim. Use it for Treasure Hunt!
                    </p>
                  )}
                  <div className="mt-6 p-6 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl inline-block">
                    <p className="text-sm text-gray-600 mb-2">Earned This Session</p>
                    <p className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      {miningStatus.mined_this_session.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">PRC</p>
                  </div>
                </div>

                <Button
                  onClick={claimCoins}
                  disabled={loading || miningStatus.mined_this_session < 0.01}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-12 py-6 text-xl rounded-2xl shadow-xl"
                >
                  {loading ? 'Claiming...' : `Claim ${miningStatus.mined_this_session.toFixed(2)} PRC`}
                </Button>
              </>
            )}
          </div>
        </Card>

        {/* Membership Comparison */}
        {isFreeUser && (
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Upgrade to VIP for Better Benefits!
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl">
                <h4 className="font-bold text-lg mb-3 text-gray-700">Free User (Current)</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">⏰</span>
                    <span>PRC valid for <strong>2 days only</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">🎮</span>
                    <span>Can only play <strong>Treasure Hunt</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">💰</span>
                    <span>Treasure Hunt: <strong>10% cashback</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">🏆</span>
                    <span>Daily topper: <strong>Max 20% cashback</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">🏪</span>
                    <span>No marketplace access</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">💳</span>
                    <span>Min Redemption: <strong>₹1000</strong></span>
                  </li>
                </ul>
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-6 rounded-xl text-white">
                <h4 className="font-bold text-lg mb-3 flex items-center">
                  <Crown className="mr-2" />
                  VIP Member
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="text-yellow-300 mr-2">♾️</span>
                    <span>PRC <strong>never expires</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-300 mr-2">🛒</span>
                    <span>Full <strong>marketplace access</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-300 mr-2">💎</span>
                    <span>Treasure Hunt: <strong>50% cashback</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-300 mr-2">🏆</span>
                    <span>Top player: <strong>100% cashback</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-300 mr-2">💸</span>
                    <span>Min Redemption: <strong>₹10</strong></span>
                  </li>
                </ul>
                <Link to="/vip">
                  <Button className="w-full mt-4 bg-white text-purple-600 hover:bg-gray-100">
                    Upgrade Now - ₹1000/year
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* How It Works */}
        <Card className="p-8 bg-white mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">How Mining Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Play className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">1. Start Session</h3>
              <p className="text-gray-600 text-sm">
                Start a 24-hour mining session to begin earning PRC coins automatically.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">2. Earn PRC</h3>
              <p className="text-gray-600 text-sm">
                Your mining rate increases with referrals. The more friends, the more you earn!
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Coins className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">3. Claim & Use</h3>
              <p className="text-gray-600 text-sm">
                {isFreeUser 
                  ? 'Claim PRC and use within 2 days for Treasure Hunt. Upgrade for marketplace access!'
                  : 'Claim PRC anytime and use for Treasure Hunt or shop in marketplace!'}
              </p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Animated Feedback Overlay */}
      {animatedFeedback && (
        <AnimatedFeedback
          message={animatedFeedback.message}
          type={animatedFeedback.type}
          duration={animatedFeedback.duration}
          onClose={() => setAnimatedFeedback(null)}
          position="center"
        />
      )}
    </div>
  );
};

export default Mining;
