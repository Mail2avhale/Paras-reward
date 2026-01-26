import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Coins, Gift, Users, TrendingUp, Shield, Smartphone, 
  ChevronRight, Star, Zap, Award, CreditCard, ShoppingBag,
  FileText, Phone, Mail, MapPin, ArrowRight, CheckCircle,
  Play, Crown, Percent, Clock, Target, Sparkles, Globe, ChevronDown,
  Car, Bike, CloudRain, Lock, Gem
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;
const LOGO_URL = "https://customer-assets.emergentagent.com/job_appreward-portal/artifacts/8iqee76c_IMG-20251230-WA0006.jpg";

// Optimized Image component with lazy loading
const LazyImage = memo(({ src, alt, className, ...props }) => (
  <img 
    src={src} 
    alt={alt} 
    className={className}
    loading="lazy"
    decoding="async"
    {...props}
  />
));

// Homepage translations
const homeTranslations = {
  heroTitle: {
    mr: "PRC कमवा आणि बक्षिसे मिळवा!",
    hi: "PRC कमाएं और इनाम पाएं!",
    en: "Earn PRC & Get Rewarded!"
  },
  heroSubtitle: {
    mr: "आमच्या प्लॅटफॉर्मवर बक्षिसे गोळा करा, खेळा आणि रिडीम करा",
    hi: "हमारे प्लेटफॉर्म पर पुरस्कार इकट्ठा करें, खेलें और रिडीम करें",
    en: "Collect, Play & Redeem Your Rewards on Our Platform"
  },
  getStarted: {
    mr: "सुरू करा",
    hi: "शुरू करें",
    en: "Get Started"
  },
  login: {
    mr: "लॉगिन",
    hi: "लॉगिन",
    en: "Login"
  },
  features: {
    mr: "वैशिष्ट्ये",
    hi: "विशेषताएं",
    en: "Features"
  },
  dailyMining: {
    mr: "दैनिक बक्षिसे",
    hi: "दैनिक पुरस्कार",
    en: "Daily Rewards"
  },
  dailyMiningDesc: {
    mr: "आमच्या स्वयंचलित सिस्टमद्वारे दररोज PRC पॉइंट्स गोळा करा. VIP सदस्य 5 पट वेगाने मिळवतात!",
    hi: "हमारी स्वचालित प्रणाली से रोज PRC पॉइंट्स इकट्ठा करें। VIP सदस्य 5 गुना तेजी से पाते हैं!",
    en: "Collect PRC points daily through our rewards system. VIP members earn up to 5x faster!"
  },
  referralRewards: {
    mr: "रेफरल बक्षीस",
    hi: "रेफरल इनाम",
    en: "Referral Rewards"
  },
  referralRewardsDesc: {
    mr: "मित्रांना आमंत्रित करा आणि बोनस PRC कमवा. तुमचे मित्र वाढवा आणि कमाई वाढवा.",
    hi: "दोस्तों को आमंत्रित करें और बोनस PRC कमाएं। अपने दोस्त बढ़ाएं और कमाई बढ़ाएं।",
    en: "Invite friends and earn bonus PRC. Build your friends network and maximize earnings."
  },
  giftVouchers: {
    mr: "गिफ्ट व्हाउचर",
    hi: "गिफ्ट वाउचर",
    en: "Gift Vouchers"
  },
  giftVouchersDesc: {
    mr: "Amazon, Flipkart आणि इतर टॉप ब्रँड्सच्या गिफ्ट व्हाउचरसाठी तुमचे PRC रिडीम करा.",
    hi: "Amazon, Flipkart और अन्य टॉप ब्रांड्स के गिफ्ट वाउचर के लिए अपने PRC रिडीम करें।",
    en: "Redeem your PRC for gift vouchers from top brands like Amazon, Flipkart, and more."
  },
  billPayments: {
    mr: "बिल पेमेंट",
    hi: "बिल पेमेंट",
    en: "Bill Payments"
  },
  billPaymentsDesc: {
    mr: "तुमचे मोबाइल, DTH, वीज बिल थेट तुमच्या कमावलेल्या PRC पॉइंट्सद्वारे भरा.",
    hi: "अपने मोबाइल, DTH, बिजली बिल सीधे अपने कमाए PRC पॉइंट्स से भरें।",
    en: "Pay your mobile, DTH, electricity bills directly using your earned PRC points."
  },
  howItWorks: {
    mr: "कसे काम करते",
    hi: "कैसे काम करता है",
    en: "How It Works"
  },
  step1Title: {
    mr: "खाते तयार करा",
    hi: "खाता बनाएं",
    en: "Create Account"
  },
  step1Desc: {
    mr: "विनामूल्य साइन अप करा आणि आमच्या प्लॅटफॉर्मवर सामील व्हा",
    hi: "मुफ्त साइन अप करें और हमारे प्लेटफॉर्म से जुड़ें",
    en: "Sign up for free and join our platform"
  },
  step2Title: {
    mr: "PRC गोळा करा",
    hi: "PRC इकट्ठा करें",
    en: "Collect PRC"
  },
  step2Desc: {
    mr: "दररोज बक्षिसे गोळा करा, गेम खेळा, आणि रेफर करा",
    hi: "रोज पुरस्कार इकट्ठा करें, गेम खेलें, और रेफर करें",
    en: "Collect daily rewards, play games, and refer friends"
  },
  step3Title: {
    mr: "बक्षीस मिळवा",
    hi: "इनाम पाएं",
    en: "Get Rewards"
  },
  step3Desc: {
    mr: "व्हाउचर, बिल पेमेंट किंवा मार्केटप्लेससाठी रिडीम करा",
    hi: "वाउचर, बिल पेमेंट या मार्केटप्लेस के लिए रिडीम करें",
    en: "Redeem for vouchers, bill payments, or marketplace"
  },
  vipMembership: {
    mr: "VIP सदस्यत्व",
    hi: "VIP सदस्यता",
    en: "VIP Membership"
  },
  vipDesc: {
    mr: "VIP बना आणि विशेष फायदे मिळवा",
    hi: "VIP बनें और विशेष लाभ पाएं",
    en: "Become VIP and unlock exclusive benefits"
  },
  joinNow: {
    mr: "आता सामील व्हा",
    hi: "अभी शामिल हों",
    en: "Join Now"
  },
  totalUsers: {
    mr: "एकूण वापरकर्ते",
    hi: "कुल उपयोगकर्ता",
    en: "Total Users"
  },
  totalPRC: {
    mr: "एकूण PRC",
    hi: "कुल PRC",
    en: "Total PRC"
  },
  vipMembers: {
    mr: "VIP सदस्य",
    hi: "VIP सदस्य",
    en: "VIP Members"
  },
  quickLinks: {
    mr: "द्रुत लिंक्स",
    hi: "त्वरित लिंक",
    en: "Quick Links"
  },
  legal: {
    mr: "कायदेशीर",
    hi: "कानूनी",
    en: "Legal"
  },
  termsConditions: {
    mr: "नियम आणि अटी",
    hi: "नियम और शर्तें",
    en: "Terms & Conditions"
  },
  privacyPolicy: {
    mr: "गोपनीयता धोरण",
    hi: "गोपनीयता नीति",
    en: "Privacy Policy"
  },
  refundPolicy: {
    mr: "परतावा धोरण",
    hi: "रिफंड नीति",
    en: "Refund Policy"
  },
  contactUs: {
    mr: "संपर्क करा",
    hi: "संपर्क करें",
    en: "Contact Us"
  },
  allRightsReserved: {
    mr: "सर्व हक्क राखीव",
    hi: "सर्वाधिकार सुरक्षित",
    en: "All rights reserved"
  },
  // New Feature Translations
  luxuryLife: {
    mr: "पारस लक्झरी लाईफ",
    hi: "पारस लक्ज़री लाइफ",
    en: "Paras Luxury Life"
  },
  luxuryLifeDesc: {
    mr: "स्मार्ट सेव्हिंग. बेहतर जगा. तुमच्या PRC कमाईतून 20% आपोआप बचत होते - मोबाइल, बाइक किंवा कार मिळवा!",
    hi: "स्मार्ट सेविंग। बेहतर जिएं। आपकी PRC कमाई से 20% ऑटो-सेव होता है - मोबाइल, बाइक या कार पाएं!",
    en: "Smart Saving. Live Better. 20% of your PRC earnings auto-saves towards luxury goals - get a Mobile, Bike, or Car!"
  },
  prcRain: {
    mr: "PRC रेन",
    hi: "PRC रेन",
    en: "PRC Rain"
  },
  prcRainDesc: {
    mr: "आकाशातून पडणारे PRC ड्रॉप्स टॅप करा! जिंका किंवा हरा - मजेशीर गेम.",
    hi: "आसमान से गिरते PRC ड्रॉप्स टैप करें! जीतें या हारें - मज़ेदार गेम।",
    en: "Tap falling PRC drops from the sky! Win or lose - exciting gamified experience."
  },
  subscriptionPlans: {
    mr: "सबस्क्रिप्शन प्लॅन्स",
    hi: "सब्सक्रिप्शन प्लान्स",
    en: "Subscription Plans"
  },
  explorer: {
    mr: "एक्सप्लोरर",
    hi: "एक्सप्लोरर",
    en: "Explorer"
  },
  startup: {
    mr: "स्टार्टअप",
    hi: "स्टार्टअप",
    en: "Startup"
  },
  growth: {
    mr: "ग्रोथ",
    hi: "ग्रोथ",
    en: "Growth"
  },
  elite: {
    mr: "एलीट",
    hi: "एलीट",
    en: "Elite"
  },
  free: {
    mr: "विनामूल्य",
    hi: "मुफ्त",
    en: "FREE"
  },
  perMonth: {
    mr: "/महिना",
    hi: "/महीना",
    en: "/month"
  }
};

const RewardsHome = () => {
  const navigate = useNavigate();
  const { language, changeLanguage, currentLanguage, languages } = useLanguage();
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  
  // Local translation function for homepage
  const t = (key) => {
    const translation = homeTranslations[key];
    if (!translation) return key;
    return translation[language] || translation['en'] || key;
  };
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPRC: 0,
    vipMembers: 0,
    totalRedeemed: 0
  });
  const [loading, setLoading] = useState(true);
  const [contactInfo, setContactInfo] = useState({
    email: 'support@parasreward.com',
    phone: '+91 98765 43210',
    address: 'Mumbai, Maharashtra, India'
  });

  useEffect(() => {
    fetchStats();
    fetchContactInfo();
  }, []);

  const fetchContactInfo = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/contact-settings`);
      const data = response.data;
      
      // Build full address from components
      const addressParts = [
        data.address_line1,
        data.address_line2,
        data.city,
        data.state,
        data.pincode,
        data.country
      ].filter(Boolean);
      
      setContactInfo({
        email: data.email_support || 'support@parasreward.com',
        phone: data.phone_primary || '+91 98765 43210',
        address: addressParts.join(', ') || 'Mumbai, Maharashtra, India'
      });
    } catch (error) {
      console.error('Error fetching contact info:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/stats`);
      setStats({
        totalUsers: response.data.users?.total || 0,
        totalPRC: response.data.total_prc || 0,
        vipMembers: response.data.users?.vip || 0,
        totalRedeemed: response.data.financial?.total_prc_redeemed || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Features with translations - computed based on current language
  const getFeatures = () => [
    {
      icon: Coins,
      title: t('dailyMining'),
      description: t('dailyMiningDesc'),
      color: 'from-yellow-500 to-amber-600'
    },
    {
      icon: Users,
      title: t('referralRewards'),
      description: t('referralRewardsDesc'),
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: Gift,
      title: t('giftVouchers'),
      description: t('giftVouchersDesc'),
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: CreditCard,
      title: t('billPayments'),
      description: t('billPaymentsDesc'),
      color: 'from-green-500 to-green-600'
    },
    {
      icon: Crown,
      title: t('luxuryLife'),
      description: t('luxuryLifeDesc'),
      color: 'from-amber-500 to-orange-600',
      isNew: true
    },
    {
      icon: CloudRain,
      title: t('prcRain'),
      description: t('prcRainDesc'),
      color: 'from-cyan-500 to-blue-600',
      isNew: true
    }
  ];

  const features = getFeatures();

  const vipBenefits = [
    { icon: Zap, text: 'Up to 5x Rewards Speed' },
    { icon: Percent, text: 'Higher Referral Bonuses' },
    { icon: Crown, text: 'Exclusive VIP Offers' },
    { icon: Shield, text: 'Priority Support' },
    { icon: Gift, text: 'Special Redemption Rates' },
    { icon: Star, text: 'Early Access to Features' }
  ];

  const howItWorks = [
    { step: 1, title: 'Sign Up', description: 'Create your free account in seconds', icon: Smartphone },
    { step: 2, title: 'Collect Rewards', description: 'Start collecting PRC points daily', icon: Coins },
    { step: 3, title: 'Invite Friends', description: 'Share your referral code and earn more', icon: Users },
    { step: 4, title: 'Redeem Rewards', description: 'Convert PRC to vouchers & payments', icon: Gift }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50">
      {/* Navigation - with safe area padding for mobile browsers */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Paras Reward" className="h-10 w-10 rounded-full" />
              <span className="font-bold text-xl text-blue-900">Paras Reward</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-gray-600 hover:text-blue-600 transition">{t('features')}</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-blue-600 transition">{t('howItWorks')}</a>
              <a href="#vip" className="text-gray-600 hover:text-blue-600 transition">{t('vipMembership')}</a>
              
              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-50 transition-colors"
                  data-testid="home-language-selector"
                >
                  <Globe className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">{currentLanguage?.name?.slice(0, 3) || 'EN'}</span>
                  <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showLangDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showLangDropdown && (
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 min-w-[140px]">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          changeLanguage(lang.code);
                          setShowLangDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors ${
                          language === lang.code ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="text-sm font-medium">{lang.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <Button variant="outline" onClick={() => navigate('/login')} className="border-blue-600 text-blue-600 hover:bg-blue-50">
                {t('login')}
              </Button>
              <Button onClick={() => navigate('/register')} className="bg-blue-600 hover:bg-blue-700 text-white">
                {t('getStarted')}
              </Button>
            </div>
            <div className="md:hidden flex gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate('/login')}>{t('login')}</Button>
              <Button size="sm" onClick={() => navigate('/register')} className="bg-blue-600">{t('getStarted')}</Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - with extra padding for fixed nav and safe area */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white overflow-hidden relative" style={{ paddingTop: 'calc(7rem + env(safe-area-inset-top, 0))' }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" />
                {language === 'mr' ? "भारतातील सर्वात फायदेशीर प्लॅटफॉर्म" : language === 'hi' ? "भारत का सबसे फायदेमंद प्लेटफॉर्म" : "India's Most Rewarding Platform"}
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                {t('heroTitle')}
              </h1>
              <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                {t('heroSubtitle')}
              </p>
              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate('/register')}
                  className="bg-yellow-500 hover:bg-yellow-400 text-blue-900 font-semibold px-8 py-6 text-lg"
                >
                  {t('getStarted')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg"
                >
                  <Play className="mr-2 h-5 w-5" />
                  {t('login')}
                </Button>
              </div>
              
              {/* Trust Badges */}
              <div className="flex items-center gap-6 mt-10 pt-6 border-t border-white/20">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-400" />
                  <span className="text-sm text-blue-200">{language === 'mr' ? "१००% सुरक्षित" : language === 'hi' ? "100% सुरक्षित" : "100% Secure"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-sm text-blue-200">Fast Redemption</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm text-blue-200">4.8★ Rating</span>
                </div>
              </div>
            </div>
            
            {/* Hero Image/Card */}
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-3xl blur-2xl opacity-30 transform rotate-6"></div>
                <Card className="relative bg-white/10 backdrop-blur-lg border-white/20 p-8 rounded-3xl">
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Coins className="h-10 w-10 text-blue-900" />
                    </div>
                    <h3 className="text-2xl font-bold">Your PRC Balance</h3>
                    <p className="text-4xl font-bold text-yellow-400 mt-2">0 PRC</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-white/10 rounded-lg">
                      <span className="text-blue-200">Today&apos;s Rewards</span>
                      <span className="font-semibold text-green-400">+12.5 PRC</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/10 rounded-lg">
                      <span className="text-blue-200">Referral Bonus</span>
                      <span className="font-semibold text-green-400">+25.0 PRC</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/10 rounded-lg">
                      <span className="text-blue-200">VIP Bonus</span>
                      <span className="font-semibold text-green-400">+50.0 PRC</span>
                    </div>
                  </div>
                  <Button className="w-full mt-6 bg-yellow-500 hover:bg-yellow-400 text-blue-900 font-semibold">
                    Claim Rewards
                  </Button>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Counter */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-blue-900 mb-1">
                {loading ? '...' : stats.totalUsers.toLocaleString()}+
              </div>
              <div className="text-gray-500 text-sm sm:text-base">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-blue-900 mb-1">
                {loading ? '...' : Math.round(stats.totalPRC).toLocaleString()}
              </div>
              <div className="text-gray-500 text-sm sm:text-base">PRC Distributed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-blue-900 mb-1">
                {loading ? '...' : stats.vipMembers.toLocaleString()}+
              </div>
              <div className="text-gray-500 text-sm sm:text-base">VIP Members</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-blue-900 mb-1">
                {loading ? '...' : Math.round(stats.totalRedeemed).toLocaleString()}
              </div>
              <div className="text-gray-500 text-sm sm:text-base">PRC Redeemed</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Multiple Ways to <span className="text-blue-600">Earn & Redeem</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our platform offers diverse earning opportunities and flexible redemption options
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <Card key={idx} className="p-6 hover:shadow-xl transition-shadow duration-300 group cursor-pointer border-0 shadow-lg relative overflow-hidden">
                  {feature.isNew && (
                    <div className="absolute top-3 right-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                      NEW
                    </div>
                  )}
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                  <div className="mt-4 flex items-center text-blue-600 font-medium">
                    Learn more <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* App Demo Section with Lottie Animations */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-300 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Play className="h-4 w-4" />
              {language === 'mr' ? 'अँप डेमो' : language === 'hi' ? 'ऐप डेमो' : 'App Demo'}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {language === 'mr' ? 'कसे काम करते ते पहा' : language === 'hi' ? 'देखें कैसे काम करता है' : 'See How It Works'}
            </h2>
            <p className="text-xl text-blue-200 max-w-2xl mx-auto">
              {language === 'mr' ? 'आमच्या अँपचे वैशिष्ट्ये अनुभवा' : language === 'hi' ? 'हमारे ऐप की विशेषताएं अनुभव करें' : 'Experience our app features'}
            </p>
          </div>
          
          {/* Interactive Demo Cards */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Daily Rewards Demo */}
            <div className="group">
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 hover:border-yellow-400/50 transition-all duration-300 hover:transform hover:scale-105">
                <div className="h-48 flex items-center justify-center mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20">
                  {/* Animated Rewards Icon */}
                  <div className="relative">
                    <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center animate-bounce shadow-2xl">
                      <Coins className="h-12 w-12 text-white" />
                    </div>
                    {/* Floating coins animation */}
                    <div className="absolute -top-4 -left-4 w-8 h-8 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
                    <div className="absolute -bottom-2 -right-4 w-6 h-6 bg-orange-400 rounded-full animate-pulse"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 bg-yellow-300 rounded-full animate-bounce delay-100"></div>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2 text-yellow-400">
                  {language === 'mr' ? '⭐ दैनिक बक्षिसे' : language === 'hi' ? '⭐ दैनिक पुरस्कार' : '⭐ Daily Rewards'}
                </h3>
                <p className="text-blue-200 text-sm mb-4">
                  {language === 'mr' ? 'दररोज PRC गोळा करा. VIP 5x वेगाने मिळवतात!' 
                   : language === 'hi' ? 'रोज PRC इकट्ठा करें। VIP 5x तेजी से पाते हैं!'
                   : 'Collect PRC daily. VIP members get 5x faster!'}
                </p>
                <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                  <TrendingUp className="h-4 w-4" />
                  <span>+12.5 PRC/day</span>
                </div>
              </div>
            </div>

            {/* Tap Game Demo */}
            <div className="group">
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 hover:border-pink-400/50 transition-all duration-300 hover:transform hover:scale-105">
                <div className="h-48 flex items-center justify-center mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                  {/* Animated Tap Game */}
                  <div className="relative">
                    <div className="w-24 h-24 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 transition-transform">
                      <Smartphone className="h-12 w-12 text-white" />
                    </div>
                    {/* Tap ripple effect */}
                    <div className="absolute inset-0 w-24 h-24 bg-pink-400 rounded-full animate-ping opacity-30"></div>
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-2xl animate-bounce">👆</div>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2 text-pink-400">
                  {language === 'mr' ? '🎮 टॅप गेम' : language === 'hi' ? '🎮 टैप गेम' : '🎮 Tap Game'}
                </h3>
                <p className="text-blue-200 text-sm mb-4">
                  {language === 'mr' ? 'टॅप करा आणि PRC जिंका! मजेशीर आणि सोपे.'
                   : language === 'hi' ? 'टैप करें और PRC जीतें! मजेदार और आसान।'
                   : 'Tap and win PRC! Fun and easy gameplay.'}
                </p>
                <div className="flex items-center gap-2 text-pink-400 text-sm font-medium">
                  <Zap className="h-4 w-4" />
                  <span>{language === 'mr' ? 'झटपट बक्षीस' : language === 'hi' ? 'तुरंत इनाम' : 'Instant Rewards'}</span>
                </div>
              </div>
            </div>

            {/* Redeem Demo */}
            <div className="group">
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 hover:border-green-400/50 transition-all duration-300 hover:transform hover:scale-105">
                <div className="h-48 flex items-center justify-center mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500/20 to-teal-500/20">
                  {/* Animated Redeem */}
                  <div className="relative">
                    <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-2xl">
                      <Gift className="h-12 w-12 text-white animate-pulse" />
                    </div>
                    {/* Gift sparkles */}
                    <div className="absolute -top-2 -right-2 text-2xl animate-spin" style={{animationDuration: '3s'}}>✨</div>
                    <div className="absolute -bottom-2 -left-2 text-xl animate-bounce delay-150">🎁</div>
                    <div className="absolute top-1/2 -right-6 text-lg animate-pulse">💎</div>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2 text-green-400">
                  {language === 'mr' ? '🎁 रिडीम करा' : language === 'hi' ? '🎁 रिडीम करें' : '🎁 Redeem'}
                </h3>
                <p className="text-blue-200 text-sm mb-4">
                  {language === 'mr' ? 'Amazon, Flipkart व्हाउचर किंवा बिल पेमेंटसाठी रिडीम करा.'
                   : language === 'hi' ? 'Amazon, Flipkart वाउचर या बिल पेमेंट के लिए रिडीम करें।'
                   : 'Redeem for Amazon, Flipkart vouchers or bill payments.'}
                </p>
                <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                  <CheckCircle className="h-4 w-4" />
                  <span>{language === 'mr' ? 'झटपट वितरण' : language === 'hi' ? 'तुरंत डिलीवरी' : 'Instant Delivery'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* App Flow Animation */}
          <div className="mt-16 relative">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur px-6 py-3 rounded-full border border-white/20">
                <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="font-bold text-blue-900">1</span>
                </div>
                <span className="text-white font-medium">{language === 'mr' ? 'साइन अप करा' : language === 'hi' ? 'साइन अप करें' : 'Sign Up'}</span>
              </div>
              <ArrowRight className="h-6 w-6 text-yellow-400 hidden sm:block" />
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur px-6 py-3 rounded-full border border-white/20">
                <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="font-bold text-blue-900">2</span>
                </div>
                <span className="text-white font-medium">{language === 'mr' ? 'PRC गोळा करा' : language === 'hi' ? 'PRC इकट्ठा करें' : 'Collect PRC'}</span>
              </div>
              <ArrowRight className="h-6 w-6 text-yellow-400 hidden sm:block" />
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur px-6 py-3 rounded-full border border-white/20">
                <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="font-bold text-blue-900">3</span>
                </div>
                <span className="text-white font-medium">{language === 'mr' ? 'रिडीम करा' : language === 'hi' ? 'रिडीम करें' : 'Redeem'}</span>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Button 
              size="lg" 
              onClick={() => navigate('/register')}
              className="bg-yellow-500 hover:bg-yellow-400 text-blue-900 font-semibold px-8"
            >
              {t('getStarted')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* VIP Benefits */}
      <section id="vip" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Crown className="h-4 w-4" />
                Premium Membership
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Unlock <span className="text-yellow-500">VIP Benefits</span>
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Upgrade to VIP membership and supercharge your earnings with exclusive benefits and higher rewards.
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                {vipBenefits.map((benefit, idx) => {
                  const Icon = benefit.icon;
                  return (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <Icon className="h-5 w-5 text-yellow-600" />
                      </div>
                      <span className="text-gray-700 font-medium">{benefit.text}</span>
                    </div>
                  );
                })}
              </div>
              
              <Button 
                size="lg" 
                onClick={() => navigate('/vip-plans')}
                className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-white font-semibold px-8"
              >
                Explore VIP Plans
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-3xl blur-2xl opacity-20 transform -rotate-6"></div>
              <Card className="relative bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8 rounded-3xl border-2 border-yellow-500/30">
                <div className="absolute top-4 right-4">
                  <span className="bg-yellow-500 text-gray-900 text-xs font-bold px-3 py-1 rounded-full">POPULAR</span>
                </div>
                <Crown className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-2xl font-bold mb-2">VIP Gold</h3>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-4xl font-bold">₹299</span>
                  <span className="text-gray-400">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>5x Rewards Speed</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>25% Extra Referral Bonus</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Priority Redemptions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Exclusive Offers</span>
                  </li>
                </ul>
                <Button className="w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold">
                  Get VIP Now
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Privacy Notice Banner for AdMob Compliance */}
          <div className="bg-blue-900/50 border border-blue-700/50 rounded-xl p-4 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-blue-400" />
              <p className="text-sm text-blue-200">
                {language === 'mr' 
                  ? "आम्ही तुमच्या गोपनीयतेचे संरक्षण करतो. आमचे जाहिरात धोरण वाचा." 
                  : language === 'hi' 
                  ? "हम आपकी गोपनीयता की रक्षा करते हैं। हमारी विज्ञापन नीति पढ़ें।"
                  : "We protect your privacy. Read our advertising policy."}
              </p>
            </div>
            <a 
              href="/privacy#advertising" 
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <FileText className="h-4 w-4" />
              {t('privacyPolicy')}
            </a>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={LOGO_URL} alt="Paras Reward" className="h-10 w-10 rounded-full" />
                <span className="font-bold text-xl text-white">Paras Reward</span>
              </div>
              <p className="text-gray-400 mb-4">
                {language === 'mr' 
                  ? "PRC कॉइन्स कमवण्यासाठी आणि रिडीम करण्यासाठी भारतातील सर्वात फायदेशीर लॉयल्टी प्लॅटफॉर्म."
                  : language === 'hi' 
                  ? "PRC सिक्के कमाने और रिडीम करने के लिए भारत का सबसे फायदेमंद लॉयल्टी प्लेटफॉर्म।"
                  : "India's most rewarding loyalty platform for earning and redeeming PRC coins."}
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition">
                  <span className="sr-only">Facebook</span>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"></path></svg>
                </a>
                <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-400 transition">
                  <span className="sr-only">Twitter</span>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"></path></svg>
                </a>
                <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-pink-600 transition">
                  <span className="sr-only">Instagram</span>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"></path></svg>
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">{t('quickLinks')}</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white transition">{t('features')}</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition">{t('howItWorks')}</a></li>
                <li><a href="#vip" className="hover:text-white transition">{t('vipMembership')}</a></li>
                <li><a href="/marketplace" className="hover:text-white transition">{language === 'mr' ? 'मार्केटप्लेस' : language === 'hi' ? 'मार्केटप्लेस' : 'Marketplace'}</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">{t('legal')}</h4>
              <ul className="space-y-2">
                <li><a href="/terms" className="hover:text-white transition">{t('termsConditions')}</a></li>
                <li><a href="/privacy" className="hover:text-white transition flex items-center gap-1">
                  <Shield className="h-3 w-3 text-green-400" />
                  {t('privacyPolicy')}
                </a></li>
                <li><a href="/privacy#advertising" className="hover:text-white transition text-blue-400">
                  {language === 'mr' ? '→ जाहिरात धोरण' : language === 'hi' ? '→ विज्ञापन नीति' : '→ Advertising Policy'}
                </a></li>
                <li><a href="/refund" className="hover:text-white transition">{t('refundPolicy')}</a></li>
                <li><a href="/contact" className="hover:text-white transition">{t('contactUs')}</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">{t('contactUs')}</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-400" />
                  <span>{contactInfo.email}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-400" />
                  <span>{contactInfo.phone}</span>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-blue-400 mt-1" />
                  <span>{contactInfo.address}</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              © 2026 Paras Reward Platform. {t('allRightsReserved')}
            </p>
            <div className="flex items-center gap-4">
              <a href="/privacy" className="text-xs text-gray-500 hover:text-white transition">{t('privacyPolicy')}</a>
              <span className="text-gray-700">|</span>
              <a href="/terms" className="text-xs text-gray-500 hover:text-white transition">{t('termsConditions')}</a>
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Google_Play_2022_logo.svg/100px-Google_Play_2022_logo.svg.png" alt="Play Store" className="h-8 opacity-70 hover:opacity-100 transition cursor-pointer" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RewardsHome;
