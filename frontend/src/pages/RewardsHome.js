import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  Coins, Gift, Users, TrendingUp, Shield, Smartphone, 
  ChevronRight, Star, Zap, Award, CreditCard, ShoppingBag,
  FileText, Phone, Mail, MapPin, ArrowRight, CheckCircle,
  Play, Crown, Percent, Clock, Target, Sparkles, Globe, ChevronDown,
  Car, Bike, CloudRain, Lock, Gem, Heart, Trophy, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;
const LOGO_URL = "https://customer-assets.emergentagent.com/job_appreward-portal/artifacts/8iqee76c_IMG-20251230-WA0006.jpg";

// Floating coin animation component
const FloatingCoins = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(12)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute text-yellow-400/30"
        initial={{ 
          x: Math.random() * 100 + '%', 
          y: '110%',
          rotate: 0,
          scale: 0.5 + Math.random() * 0.5
        }}
        animate={{ 
          y: '-10%',
          rotate: 360,
          transition: {
            duration: 8 + Math.random() * 4,
            repeat: Infinity,
            delay: i * 0.5,
            ease: 'linear'
          }
        }}
      >
        <Coins className="w-6 h-6 sm:w-8 sm:h-8" />
      </motion.div>
    ))}
  </div>
);

// Glassmorphism stat card
const GlassStatCard = ({ icon: Icon, value, label, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    viewport={{ once: true }}
    className="relative group"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
    <div className="relative bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all">
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-white/60 text-sm">{label}</div>
    </div>
  </motion.div>
);

// Feature card with hover effect
const FeatureCard = ({ icon: Icon, title, description, color, isNew, onClick, ctaText }) => (
  <motion.div
    whileHover={{ y: -8, scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className="relative group cursor-pointer"
    onClick={onClick}
  >
    <div className={`absolute inset-0 bg-gradient-to-br ${color} rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
    <Card className="relative h-full p-6 bg-white border-0 shadow-lg hover:shadow-2xl transition-all duration-300 rounded-3xl overflow-hidden">
      {isNew && (
        <div className="absolute top-4 right-4">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
          </span>
        </div>
      )}
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
        <Icon className="h-7 w-7 text-white" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed mb-4">{description}</p>
      <div className="flex items-center text-blue-600 font-semibold group-hover:text-blue-700">
        {ctaText}
        <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-2 transition-transform" />
      </div>
    </Card>
  </motion.div>
);

// Luxury product card
const LuxuryProductCard = ({ icon: Icon, name, price, downPayment, savePercent, color, borderColor, bgColor }) => (
  <motion.div
    whileHover={{ y: -10, rotateY: 5 }}
    className="relative group perspective-1000"
  >
    <div className={`absolute inset-0 bg-gradient-to-br ${color} rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity`} />
    <Card className={`relative bg-white rounded-3xl p-6 border-2 ${borderColor} hover:border-opacity-100 transition-all overflow-hidden`}>
      <div className={`absolute top-3 right-3 ${bgColor} text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg`}>
        {savePercent}% Auto-Save
      </div>
      <div className="h-32 flex items-center justify-center mb-4 relative">
        <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-10 rounded-2xl`} />
        <motion.div 
          whileHover={{ scale: 1.1, rotate: 5 }}
          className={`w-20 h-20 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center shadow-2xl`}
        >
          <Icon className="h-10 w-10 text-white" />
        </motion.div>
      </div>
      <h3 className="text-xl font-bold text-center text-gray-900 mb-1">{name}</h3>
      <p className="text-center text-gray-400 text-sm mb-3">Worth ₹{price}</p>
      <div className={`${bgColor}/10 rounded-xl p-3 text-center`}>
        <p className={`font-semibold text-sm`} style={{ color: bgColor.includes('blue') ? '#3B82F6' : bgColor.includes('purple') ? '#8B5CF6' : '#F59E0B' }}>
          Down Payment: ₹{downPayment}
        </p>
      </div>
    </Card>
  </motion.div>
);

// Subscription plan card
const PlanCard = ({ name, price, features, color, icon: Icon, isPopular, onClick, ctaText }) => (
  <motion.div
    whileHover={{ y: -8 }}
    className={`relative ${isPopular ? 'z-10' : ''}`}
  >
    {isPopular && (
      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
        <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
          MOST POPULAR
        </span>
      </div>
    )}
    <Card className={`h-full p-6 rounded-2xl border-2 transition-all ${isPopular ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 shadow-xl scale-105' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <div className="text-center mb-4">
        <div className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
          <Icon className="h-7 w-7 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">{name}</h3>
        <div className="mt-2">
          {price === 'FREE' ? (
            <span className="text-3xl font-bold text-gray-900">{price}</span>
          ) : (
            <>
              <span className="text-3xl font-bold text-gray-900">₹{price}</span>
              <span className="text-gray-500">/month</span>
            </>
          )}
        </div>
      </div>
      <ul className="space-y-3 mb-6">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm">
            {feature.included ? (
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
            ) : (
              <Lock className="h-4 w-4 text-gray-300 flex-shrink-0" />
            )}
            <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>{feature.text}</span>
          </li>
        ))}
      </ul>
      <Button 
        onClick={onClick}
        className={`w-full ${isPopular ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500' : 'bg-gray-900 hover:bg-gray-800'}`}
      >
        {ctaText}
      </Button>
    </Card>
  </motion.div>
);

// AdMob Compliant Translations
const homeTranslations = {
  heroTitle: {
    mr: "PRC पॉइंट्स गोळा करा!",
    hi: "PRC पॉइंट्स इकट्ठा करें!",
    en: "Collect PRC Points!"
  },
  heroSubtitle: {
    mr: "दैनंदिन क्रियाकलापांद्वारे पॉइंट्स गोळा करा आणि रिवॉर्ड्ससाठी रिडीम करा",
    hi: "दैनिक गतिविधियों से पॉइंट्स इकट्ठा करें और रिवॉर्ड्स के लिए रिडीम करें",
    en: "Collect Points Through Daily Activities & Redeem for Rewards"
  },
  getStarted: {
    mr: "आता रजिस्टर करा",
    hi: "अभी रजिस्टर करें",
    en: "Register Now"
  },
  login: {
    mr: "लॉगिन",
    hi: "लॉगिन",
    en: "Login"
  },
  dailyMining: {
    mr: "दैनंदिन चेक-इन",
    hi: "दैनिक चेक-इन",
    en: "Daily Check-in"
  },
  dailyMiningDesc: {
    mr: "दररोज चेक-इन करा आणि पॉइंट्स गोळा करा. सातत्य ठेवल्यास बोनस मिळेल.",
    hi: "रोज़ चेक-इन करें और पॉइंट्स इकट्ठा करें। लगातार रहने पर बोनस मिलेगा।",
    en: "Check-in daily to collect points. Stay consistent for bonus rewards."
  },
  referralRewards: {
    mr: "मित्रांना आमंत्रित करा",
    hi: "दोस्तों को आमंत्रित करें",
    en: "Invite Friends"
  },
  referralRewardsDesc: {
    mr: "मित्रांना आमंत्रित करा आणि ते सामील झाल्यावर बोनस पॉइंट्स मिळवा.",
    hi: "दोस्तों को आमंत्रित करें और उनके जुड़ने पर बोनस पॉइंट्स पाएं।",
    en: "Invite friends and get bonus points when they join the platform."
  },
  giftVouchers: {
    mr: "गिफ्ट व्हाउचर",
    hi: "गिफ्ट वाउचर",
    en: "Gift Vouchers"
  },
  giftVouchersDesc: {
    mr: "Amazon, Flipkart आणि इतर ब्रँड्सच्या गिफ्ट व्हाउचरसाठी पॉइंट्स रिडीम करा.",
    hi: "Amazon, Flipkart और अन्य ब्रांड्स के गिफ्ट वाउचर के लिए पॉइंट्स रिडीम करें।",
    en: "Redeem your points for gift vouchers from Amazon, Flipkart & more."
  },
  billPayments: {
    mr: "बिल पेमेंट",
    hi: "बिल पेमेंट",
    en: "Bill Payments"
  },
  billPaymentsDesc: {
    mr: "मोबाइल रिचार्ज, DTH आणि युटिलिटी बिलांसाठी पॉइंट्स वापरा.",
    hi: "मोबाइल रिचार्ज, DTH और यूटिलिटी बिलों के लिए पॉइंट्स उपयोग करें।",
    en: "Use your points for mobile recharge, DTH & utility bill payments."
  },
  luxuryLife: {
    mr: "लक्झरी सेव्हिंग्स",
    hi: "लक्ज़री सेविंग्स",
    en: "Luxury Savings"
  },
  luxuryLifeDesc: {
    mr: "तुमच्या पॉइंट्सचा काही भाग आपोआप मोबाइल, बाइक किंवा कारसाठी सेव्ह होतो.",
    hi: "आपके पॉइंट्स का कुछ हिस्सा ऑटो-सेव होता है मोबाइल, बाइक या कार के लिए।",
    en: "A portion of your points auto-saves towards mobile, bike or car goals."
  },
  prcRain: {
    mr: "पॉइंट रेन गेम",
    hi: "पॉइंट रेन गेम",
    en: "Point Rain Game"
  },
  prcRainDesc: {
    mr: "मजेशीर गेम खेळा आणि अतिरिक्त पॉइंट्स गोळा करा.",
    hi: "मज़ेदार गेम खेलें और अतिरिक्त पॉइंट्स इकट्ठा करें।",
    en: "Play fun games and collect additional points."
  },
  registerNow: {
    mr: "आता रजिस्टर करा",
    hi: "अभी रजिस्टर करें",
    en: "Register Now"
  },
  howItWorks: {
    mr: "कसे काम करते",
    hi: "कैसे काम करता है",
    en: "How It Works"
  },
  step1Title: {
    mr: "अकाउंट बनवा",
    hi: "अकाउंट बनाएं",
    en: "Create Account"
  },
  step1Desc: {
    mr: "विनामूल्य साइन अप करा",
    hi: "मुफ्त साइन अप करें",
    en: "Sign up for free"
  },
  step2Title: {
    mr: "पॉइंट्स गोळा करा",
    hi: "पॉइंट्स इकट्ठा करें",
    en: "Collect Points"
  },
  step2Desc: {
    mr: "दैनंदिन क्रियाकलाप पूर्ण करा",
    hi: "दैनिक गतिविधियां पूरी करें",
    en: "Complete daily activities"
  },
  step3Title: {
    mr: "रिडीम करा",
    hi: "रिडीम करें",
    en: "Redeem Rewards"
  },
  step3Desc: {
    mr: "व्हाउचर किंवा बिल पेमेंटसाठी वापरा",
    hi: "वाउचर या बिल पेमेंट के लिए उपयोग करें",
    en: "Use for vouchers or bill payments"
  },
  freeToUse: {
    mr: "विनामूल्य वापरा",
    hi: "मुफ्त उपयोग करें",
    en: "Free to Use"
  },
  activeUsers: {
    mr: "सक्रिय सदस्य",
    hi: "सक्रिय सदस्य",
    en: "Active Members"
  },
  pointsDistributed: {
    mr: "वितरित पॉइंट्स",
    hi: "वितरित पॉइंट्स",
    en: "Points Distributed"
  },
  allRightsReserved: {
    mr: "सर्व हक्क राखीव",
    hi: "सर्वाधिकार सुरक्षित",
    en: "All rights reserved"
  },
  termsApply: {
    mr: "अटी व शर्ती लागू",
    hi: "नियम और शर्तें लागू",
    en: "Terms & Conditions Apply"
  },
  disclaimer: {
    mr: "PRC हे प्लॅटफॉर्म पॉइंट्स आहेत आणि वास्तविक चलन नाहीत.",
    hi: "PRC प्लेटफॉर्म पॉइंट्स हैं और वास्तविक मुद्रा नहीं हैं।",
    en: "PRC are platform points and not real currency."
  }
};

const RewardsHome = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const [stats, setStats] = useState({ totalUsers: 0, totalPRC: 0, vipMembers: 0, totalRedeemed: 0 });
  const [loading, setLoading] = useState(true);
  const [contactInfo, setContactInfo] = useState({ email: '', phone: '', address: '' });
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const t = useCallback((key) => {
    return homeTranslations[key]?.[language] || homeTranslations[key]?.en || key;
  }, [language]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, contactRes] = await Promise.allSettled([
          axios.get(`${API}/api/stats`),
          axios.get(`${API}/api/contact-info`)
        ]);
        
        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value.data);
        }
        if (contactRes.status === 'fulfilled') {
          setContactInfo(contactRes.value.data);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const features = [
    {
      icon: Coins,
      title: t('dailyMining'),
      description: t('dailyMiningDesc'),
      color: 'from-yellow-500 to-amber-600',
      link: '/register'
    },
    {
      icon: Users,
      title: t('referralRewards'),
      description: t('referralRewardsDesc'),
      color: 'from-blue-500 to-blue-600',
      link: '/register'
    },
    {
      icon: Gift,
      title: t('giftVouchers'),
      description: t('giftVouchersDesc'),
      color: 'from-purple-500 to-purple-600',
      link: '/register'
    },
    {
      icon: CreditCard,
      title: t('billPayments'),
      description: t('billPaymentsDesc'),
      color: 'from-green-500 to-emerald-600',
      link: '/register'
    },
    {
      icon: CloudRain,
      title: t('prcRain'),
      description: t('prcRainDesc'),
      color: 'from-cyan-500 to-blue-600',
      isNew: true,
      link: '/register'
    }
  ];

  const plans = [
    {
      name: 'Explorer',
      price: 'FREE',
      icon: Users,
      color: 'from-gray-500 to-gray-600',
      features: [
        { text: '1x Point Rate', included: true },
        { text: '10 Points/day', included: true },
        { text: 'Basic Features', included: true },
        { text: 'Redeem Vouchers', included: false }
      ]
    },
    {
      name: 'Startup',
      price: '299',
      icon: Zap,
      color: 'from-blue-500 to-blue-600',
      features: [
        { text: '1.5x Point Rate', included: true },
        { text: '50 Points/day', included: true },
        { text: 'Redeem Vouchers', included: true },
        { text: 'Luxury Savings', included: true }
      ]
    },
    {
      name: 'Growth',
      price: '549',
      icon: TrendingUp,
      color: 'from-purple-500 to-pink-600',
      isPopular: true,
      features: [
        { text: '2x Point Rate', included: true },
        { text: '100 Points/day', included: true },
        { text: 'Priority Support', included: true },
        { text: 'All Features', included: true }
      ]
    },
    {
      name: 'Elite',
      price: '799',
      icon: Crown,
      color: 'from-amber-500 to-orange-600',
      features: [
        { text: '3x Point Rate', included: true },
        { text: '200 Points/day', included: true },
        { text: 'VIP Support', included: true },
        { text: 'Maximum Benefits', included: true }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white overflow-x-hidden">
      {/* Animated Header */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <img src={LOGO_URL} alt="Paras Reward" className="h-10 w-10 rounded-xl" />
              <span className="font-bold text-xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Paras Reward
              </span>
            </Link>
            
            <div className="flex items-center gap-3">
              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium"
                >
                  <Globe className="h-4 w-4" />
                  {language.toUpperCase()}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showLangDropdown && (
                  <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border py-2 z-50">
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <button
                        key={code}
                        onClick={() => { setLanguage(code); setShowLangDropdown(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${language === code ? 'text-purple-600 font-medium' : 'text-gray-700'}`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <Button variant="ghost" onClick={() => navigate('/login')} className="text-gray-700">
                {t('login')}
              </Button>
              <Button 
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30"
              >
                {t('getStarted')}
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 sm:pt-32 sm:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900" />
        <FloatingCoins />
        
        {/* Animated gradient orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4 text-yellow-400" />
                {t('freeToUse')}
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                {t('heroTitle')}
              </h1>
              
              <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-8">
                {t('heroSubtitle')}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg"
                  onClick={() => navigate('/register')}
                  className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-gray-900 font-bold px-8 py-6 text-lg shadow-2xl shadow-yellow-500/30"
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
                  {t('login')}
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-16">
            <GlassStatCard 
              icon={Users} 
              value={loading ? '...' : `${stats.totalUsers.toLocaleString()}+`}
              label={t('activeUsers')}
              color="from-blue-500 to-blue-600"
              delay={0.1}
            />
            <GlassStatCard 
              icon={Coins} 
              value={loading ? '...' : Math.round(stats.totalPRC).toLocaleString()}
              label={t('pointsDistributed')}
              color="from-yellow-500 to-amber-600"
              delay={0.2}
            />
            <GlassStatCard 
              icon={Crown} 
              value={loading ? '...' : `${stats.vipMembers.toLocaleString()}+`}
              label="Premium Members"
              color="from-purple-500 to-pink-600"
              delay={0.3}
            />
            <GlassStatCard 
              icon={Gift} 
              value={loading ? '...' : Math.round(stats.totalRedeemed).toLocaleString()}
              label="Points Redeemed"
              color="from-green-500 to-emerald-600"
              delay={0.4}
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Multiple Ways to <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Collect & Redeem</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our platform offers diverse ways to collect points and flexible redemption options
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <FeatureCard
                key={idx}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                color={feature.color}
                isNew={feature.isNew}
                onClick={() => navigate(feature.link)}
                ctaText={t('registerNow')}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Simple Steps */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              {t('howItWorks')}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Users, title: t('step1Title'), desc: t('step1Desc'), num: '01' },
              { icon: Coins, title: t('step2Title'), desc: t('step2Desc'), num: '02' },
              { icon: Gift, title: t('step3Title'), desc: t('step3Desc'), num: '03' }
            ].map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.2 }}
                viewport={{ once: true }}
                className="relative text-center"
              >
                <div className="text-6xl font-bold text-white/10 mb-4">{step.num}</div>
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4">
                  <step.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button 
              size="lg"
              onClick={() => navigate('/register')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-8"
            >
              {t('getStarted')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Subscription Plans */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Choose Your Plan
            </h2>
            <p className="text-lg text-gray-600">
              From free to premium - pick what works for you
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {plans.map((plan, idx) => (
              <PlanCard
                key={idx}
                {...plan}
                onClick={() => navigate('/register')}
                ctaText={t('registerNow')}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={LOGO_URL} alt="Paras Reward" className="h-10 w-10 rounded-xl" />
                <span className="font-bold text-xl">Paras Reward</span>
              </div>
              <p className="text-gray-400 text-sm">{t('disclaimer')}</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link to="/login" className="hover:text-white">Login</Link></li>
                <li><Link to="/register" className="hover:text-white">Register</Link></li>
                <li><Link to="/terms" className="hover:text-white">Terms & Conditions</Link></li>
                <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>Daily Check-in</li>
                <li>Referral Program</li>
                <li>Gift Vouchers</li>
                <li>Bill Payments</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                {contactInfo.email && (
                  <li className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {contactInfo.email}
                  </li>
                )}
                {contactInfo.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {contactInfo.phone}
                  </li>
                )}
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-400 text-sm">
                © {new Date().getFullYear()} Paras Reward. {t('allRightsReserved')}
              </p>
              <p className="text-gray-500 text-xs">
                {t('termsApply')}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RewardsHome;
