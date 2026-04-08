import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  Users, Shield, ChevronRight, Award, ArrowRight, CheckCircle,
  Crown, Target, Globe, ChevronDown, Eye, Smartphone, Building2,
  Coins, Gift, MapPin, Phone, Mail, Clock, FileText, Lock,
  Sparkles, Layers, BarChart3, Wallet, CreditCard, UserPlus,
  Activity, BadgeCheck, Scale, BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';
import SEO, { SEOConfigs } from '@/components/SEO';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const LOGO_URL = "https://customer-assets.emergentagent.com/job_appreward-portal/artifacts/8iqee76c_IMG-20251230-WA0006.jpg";

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] } })
};

const stagger = { visible: { transition: { staggerChildren: 0.12 } } };

// Glass Card Component
const GlassCard = ({ children, className = '', hover = true, ...props }) => (
  <div 
    className={`bg-white/60 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.04)] ${hover ? 'hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] hover:-translate-y-0.5' : ''} transition-all duration-300 rounded-2xl md:rounded-3xl ${className}`}
    {...props}
  >
    {children}
  </div>
);

const RewardsHome = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const [stats, setStats] = useState({ totalUsers: 0, totalPRC: 0, vipMembers: 0, totalRedeemed: 0 });
  const [loading, setLoading] = useState(true);
  const [contactInfo, setContactInfo] = useState({ email: '', phone: '', address: '' });
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, contactRes] = await Promise.allSettled([
          axios.get(`${API}/stats`),
          axios.get(`${API}/public/contact-info`)
        ]);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
        if (contactRes.status === 'fulfilled') setContactInfo(contactRes.value.data);
      } catch (error) { /* silent */ }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#FDFBF7' }}>
      {/* Fixed Guilloche Background Pattern */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.08] mix-blend-multiply"
        style={{ backgroundImage: 'url(/guilloche-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
      />
      {/* Noise Grain Overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />

      <SEO {...SEOConfigs.home} />

      {/* ========== HEADER ========== */}
      <motion.header 
        initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7]/80 backdrop-blur-xl border-b border-stone-200/60"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5" data-testid="header-logo">
              <img src={LOGO_URL} alt="Paras Reward" className="h-10 w-10 rounded-xl" />
              <span className="font-bold text-xl text-[#114232]">Paras Reward</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Language Selector */}
              <div className="relative">
                <button
                  data-testid="language-selector"
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-sm font-medium text-stone-700 transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{language.toUpperCase()}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showLangDropdown && (
                  <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-stone-200 py-2 z-50">
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <button
                        key={code}
                        onClick={() => { setLanguage(code); setShowLangDropdown(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-stone-50 ${language === code ? 'text-[#D97706] font-semibold' : 'text-stone-700'}`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button data-testid="header-login-btn" variant="ghost" onClick={() => navigate('/login')} className="text-[#114232] hover:bg-[#114232]/5 rounded-full px-4">
                Login
              </Button>
              <Button 
                data-testid="header-register-btn"
                onClick={() => navigate('/register')}
                className="bg-[#114232] hover:bg-[#0a2e22] text-white rounded-full px-5 shadow-lg shadow-[#114232]/20"
              >
                Register
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ========== HERO SECTION ========== */}
      <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 px-6 md:px-12 lg:px-24 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div initial="hidden" animate="visible" variants={stagger}>
              <motion.div variants={fadeUp} custom={0}>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100/80 text-[#D97706] text-xs font-bold uppercase tracking-[0.15em] mb-6">
                  <Sparkles className="h-3.5 w-3.5" />
                  Trusted Reward Platform
                </span>
              </motion.div>
              <motion.h1 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[1.1] text-[#1C1917] mb-6">
                Earn Rewards with{' '}
                <span className="text-[#114232]">Daily Activity</span>
              </motion.h1>
              <motion.p variants={fadeUp} custom={2} className="text-base md:text-lg leading-relaxed text-[#57534E] mb-8 max-w-lg">
                Simple &bull; Transparent &bull; Controlled Reward System for Everyone
              </motion.p>
              <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-3">
                <Button 
                  data-testid="hero-cta-btn"
                  size="lg"
                  onClick={() => navigate('/register')}
                  className="rounded-full px-8 py-6 bg-[#114232] hover:bg-[#0a2e22] text-white font-semibold shadow-lg shadow-[#114232]/20 text-base"
                >
                  Start Earning Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  data-testid="hero-login-btn"
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="rounded-full px-8 py-6 border-2 border-[#114232] text-[#114232] hover:bg-[#114232]/5 font-semibold text-base"
                >
                  Login
                </Button>
              </motion.div>

              {/* Mini Stats */}
              <motion.div variants={fadeUp} custom={4} className="flex items-center gap-6 mt-10">
                <div>
                  <div className="text-2xl font-bold text-[#1C1917]">{loading ? '...' : `${stats.totalUsers.toLocaleString()}+`}</div>
                  <div className="text-xs text-[#57534E]">Active Users</div>
                </div>
                <div className="w-px h-10 bg-stone-300" />
                <div>
                  <div className="text-2xl font-bold text-[#1C1917]">{loading ? '...' : `${stats.vipMembers.toLocaleString()}+`}</div>
                  <div className="text-xs text-[#57534E]">Premium Members</div>
                </div>
                <div className="w-px h-10 bg-stone-300" />
                <div>
                  <div className="text-2xl font-bold text-[#D97706]">{loading ? '...' : Math.round(stats.totalRedeemed).toLocaleString()}</div>
                  <div className="text-xs text-[#57534E]">Rewards Redeemed</div>
                </div>
              </motion.div>
            </motion.div>

            {/* Hero Coin Visual */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:flex justify-center items-center"
            >
              <motion.img 
                  src="/hero-coin.png" 
                  alt="PRC Reward Coin"
                  className="w-72 h-72 xl:w-80 xl:h-80 object-contain drop-shadow-2xl"
                  style={{ mixBlendMode: 'multiply' }}
                  animate={{ y: [0, -16, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== TRUST SECTION ========== */}
      <section className="relative px-6 md:px-12 lg:px-24 py-12 z-10" data-testid="trust-section">
        <div className="max-w-5xl mx-auto">
          <GlassCard className="p-6 sm:p-8" hover={false}>
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-[#114232] flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1C1917] text-lg">Paras Reward Technologies Pvt. Ltd.</h3>
                  <p className="text-xs text-[#57534E] mt-0.5">CIN: U82990MH2026PTC467423 | Maharashtra, India</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 md:ml-auto">
                {[
                  { icon: BadgeCheck, text: 'Registered Indian Company' },
                  { icon: Eye, text: 'Transparent Platform' },
                  { icon: Shield, text: 'Secure System' },
                ].map((badge, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-50 border border-emerald-200/60">
                    <badge.icon className="h-4 w-4 text-[#114232]" />
                    <span className="text-xs font-semibold text-[#114232]">{badge.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ========== ABOUT US ========== */}
      <section className="relative px-6 md:px-12 lg:px-24 py-16 md:py-24 z-10" data-testid="about-section">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp}>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#D97706] mb-3 block">About Us</span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1917] mb-6">
                Building India's Trusted<br />Reward Ecosystem
              </h2>
            </motion.div>
            <motion.p variants={fadeUp} custom={1} className="text-base md:text-lg leading-relaxed text-[#57534E] max-w-3xl">
              Paras Reward Technologies Private Limited is a digital platform focused on building a simple and scalable reward ecosystem in India. Users earn PRC (digital rewards) through daily activity and participation, and use them for real services like mobile recharge and controlled redeem options. We aim to create a transparent and sustainable system for long-term user benefit.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ========== AIM / VISION / MISSION (Bento Grid) ========== */}
      <section className="relative px-6 md:px-12 lg:px-24 py-8 z-10" data-testid="avm-section">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* AIM */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <GlassCard className="p-8 h-full">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-5">
                <Target className="h-6 w-6 text-[#D97706]" />
              </div>
              <h3 className="text-xl font-bold text-[#1C1917] mb-3">Our Aim</h3>
              <p className="text-sm leading-relaxed text-[#57534E]">
                To provide a simple and accessible reward platform where users can benefit from their daily activity without complexity.
              </p>
            </GlassCard>
          </motion.div>
          {/* VISION */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
            <GlassCard className="p-8 h-full">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-5">
                <Eye className="h-6 w-6 text-[#114232]" />
              </div>
              <h3 className="text-xl font-bold text-[#1C1917] mb-3">Our Vision</h3>
              <p className="text-sm leading-relaxed text-[#57534E]">
                Aiming to become one of India's most trusted digital reward platforms by building a transparent and sustainable ecosystem.
              </p>
            </GlassCard>
          </motion.div>
          {/* MISSION */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}>
            <GlassCard className="p-8 h-full">
              <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-5">
                <Sparkles className="h-6 w-6 text-[#1C1917]" />
              </div>
              <h3 className="text-xl font-bold text-[#1C1917] mb-3">Our Mission</h3>
              <ul className="space-y-2 text-sm text-[#57534E]">
                {['Simplify digital rewards', 'Build a secure and transparent system', 'Ensure long-term sustainability', 'Create a strong user community'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-[#114232] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section className="relative px-6 md:px-12 lg:px-24 py-16 md:py-24 z-10" data-testid="how-it-works-section">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.span variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#D97706] mb-3 block">How It Works</motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1917]">
              4 Simple Steps
            </motion.h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { num: '01', icon: UserPlus, title: 'Register', desc: 'Create your free account' },
              { num: '02', icon: Crown, title: 'Activate Subscription', desc: 'Choose your plan' },
              { num: '03', icon: Coins, title: 'Collect Rewards', desc: 'Earn PRC daily' },
              { num: '04', icon: Gift, title: 'Use Rewards', desc: 'Recharge or redeem' },
            ].map((step, i) => (
              <motion.div 
                key={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              >
                <GlassCard className="p-6 text-center h-full">
                  <div className="text-3xl font-black text-[#114232]/10 mb-2">{step.num}</div>
                  <div className="w-12 h-12 mx-auto rounded-xl bg-[#114232] flex items-center justify-center mb-3">
                    <step.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold text-[#1C1917] mb-1 text-sm sm:text-base">{step.title}</h3>
                  <p className="text-xs text-[#57534E]">{step.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== WHAT IS PRC ========== */}
      <section className="relative px-6 md:px-12 lg:px-24 py-16 md:py-24 z-10" data-testid="prc-section">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
              <motion.span variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#D97706] mb-3 block">What is PRC?</motion.span>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1917] mb-6">
                Digital Reward Unit
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-base md:text-lg leading-relaxed text-[#57534E] mb-6">
                PRC is a digital reward unit earned through daily activity on the platform.
              </motion.p>
              <motion.div variants={fadeUp} custom={3} className="space-y-3 mb-6">
                {[
                  'Used for mobile recharge',
                  'Used for controlled bank redeem',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-[#114232] flex-shrink-0" />
                    <span className="text-[#1C1917] font-medium">{item}</span>
                  </div>
                ))}
              </motion.div>
              <motion.div variants={fadeUp} custom={4}>
                <GlassCard className="inline-flex items-center gap-3 px-5 py-3" hover={false}>
                  <Coins className="h-5 w-5 text-[#D97706]" />
                  <span className="font-bold text-[#1C1917]">PRC Utility Value &asymp; ₹1 per 10 PRC</span>
                </GlassCard>
              </motion.div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="flex justify-center"
            >
              <div className="relative">
                <motion.img 
                  src="/hero-coin.png" 
                  alt="PRC Coin"
                  className="w-56 h-56 sm:w-64 sm:h-64 object-contain drop-shadow-xl"
                  animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-40 h-6 bg-[#114232]/10 rounded-full blur-xl" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== REDEEM SYSTEM ========== */}
      <section className="relative px-6 md:px-12 lg:px-24 py-16 md:py-24 z-10" data-testid="redeem-section">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Redeem System */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
              <motion.span variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#D97706] mb-3 block">Redeem System</motion.span>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1917] mb-6">
                Controlled & Fair
              </motion.h2>
              <motion.div variants={fadeUp} custom={2} className="space-y-4">
                {[
                  { icon: Shield, text: 'Controlled redeem process' },
                  { icon: Activity, text: 'Based on activity and growth' },
                  { icon: Clock, text: 'One redeem per cycle' },
                ].map((item, i) => (
                  <GlassCard key={i} className="flex items-center gap-4 p-4" hover={false}>
                    <div className="w-10 h-10 rounded-xl bg-[#114232]/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="h-5 w-5 text-[#114232]" />
                    </div>
                    <span className="font-medium text-[#1C1917]">{item.text}</span>
                  </GlassCard>
                ))}
              </motion.div>
            </motion.div>

            {/* Redeem Options */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
              <motion.span variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#D97706] mb-3 block">Redeem Options</motion.span>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1917] mb-6">
                Use Your Rewards
              </motion.h2>
              <motion.div variants={fadeUp} custom={2} className="space-y-4">
                <GlassCard className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Smartphone className="h-6 w-6 text-[#D97706]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1C1917] mb-1">Mobile Recharge</h4>
                      <p className="text-sm text-[#57534E]">Recharge your mobile directly with PRC rewards</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="h-6 w-6 text-[#114232]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1C1917] mb-1">Bank Redeem</h4>
                      <p className="text-sm text-[#57534E]">Transfer to bank account (eligible users only)</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== PERFORMANCE SUMMARY ========== */}
      <section className="relative px-6 md:px-12 lg:px-24 py-16 md:py-24 z-10" data-testid="performance-section">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.span variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#D97706] mb-3 block">Performance Summary</motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1917] mb-10">
              Track Everything
            </motion.h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { icon: Wallet, label: 'Total Subscription Paid', color: 'bg-emerald-100 text-[#114232]' },
              { icon: Gift, label: 'Total Rewards Redeemed', color: 'bg-amber-100 text-[#D97706]' },
              { icon: Coins, label: 'Available PRC Balance', color: 'bg-stone-100 text-[#1C1917]' },
              { icon: BarChart3, label: 'Estimated Value', color: 'bg-emerald-100 text-[#114232]' },
            ].map((item, i) => (
              <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <GlassCard className="p-6 text-center h-full">
                  <div className={`w-12 h-12 mx-auto rounded-xl ${item.color} flex items-center justify-center mb-3`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-[#57534E]">{item.label}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== DISCLAIMER + TERMS ========== */}
      <section className="relative px-6 md:px-12 lg:px-24 py-16 z-10" data-testid="disclaimer-section">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Disclaimer */}
          <GlassCard className="p-8" hover={false}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Scale className="h-5 w-5 text-[#D97706]" />
              </div>
              <h3 className="text-xl font-bold text-[#1C1917]">Disclaimer</h3>
            </div>
            <p className="text-sm text-[#57534E] mb-4">Paras Reward is a digital reward platform.</p>
            <ul className="space-y-2 text-sm text-[#57534E]">
              {[
                'PRC is a reward unit, not a currency or investment',
                'No guaranteed income',
                'Rewards depend on user activity and may vary',
                'Redeem is subject to eligibility',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] mt-1.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </GlassCard>

          {/* Terms Summary */}
          <GlassCard className="p-8" hover={false}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-[#114232]" />
              </div>
              <h3 className="text-xl font-bold text-[#1C1917]">Terms Summary</h3>
            </div>
            <ul className="space-y-3">
              {[
                'One account per user',
                'Subscription required for full benefits',
                'KYC may be required',
                'Misuse leads to suspension',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-[#57534E]">
                  <CheckCircle className="h-4 w-4 text-[#114232] flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link 
                to="/terms"
                data-testid="read-full-terms-link"
                className="inline-flex items-center gap-2 text-[#114232] font-semibold text-sm hover:gap-3 transition-all"
              >
                Read Full Terms
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ========== FAQ SECTION ========== */}
      <section className="relative px-6 md:px-12 lg:px-24 py-16 md:py-24 z-10" data-testid="faq-section">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
            <motion.span variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#D97706] mb-3 block">FAQ</motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1917]">
              Frequently Asked Questions
            </motion.h2>
          </motion.div>

          <div className="space-y-3">
            {[
              { q: "What is Paras Reward?", a: "Paras Reward is a digital platform where you earn PRC (Paras Reward Coins) through daily activities. Use your rewards for mobile recharge and controlled bank redeem." },
              { q: "What is PRC?", a: "PRC is a digital reward unit used within the Paras Reward platform. PRC is NOT cryptocurrency, NOT real money, and NOT an investment product. It is a reward for platform activity." },
              { q: "How do I earn PRC?", a: "Earn PRC through daily mining activity. Premium subscription members earn at higher rates. Stay active and grow your network for maximum rewards." },
              { q: "What can I use PRC for?", a: "PRC can be used for mobile recharge and bank redeem (subject to eligibility). The utility value is approximately ₹1 per 10 PRC." },
              { q: "Is subscription required?", a: "Yes, an active subscription is required to earn PRC through mining. Choose a plan that suits your needs." },
              { q: "How does redeem work?", a: "Redeem is controlled and based on your activity, network growth, and eligibility. One redeem per cycle is allowed." },
              { q: "Is my data safe?", a: "Absolutely. We use industry-standard encryption and follow strict privacy policies. Your data is never shared without consent." },
              { q: "How do referrals work?", a: "Share your referral code with friends. When they join and activate, your network grows, which increases your redeem eligibility." },
            ].map((faq, i) => (
              <details key={i} className="group" data-testid={`faq-item-${i}`}>
                <summary className="flex items-center justify-between p-5 cursor-pointer bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl hover:bg-white/80 transition-all">
                  <span className="font-semibold text-[#1C1917] pr-4 text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown className="w-5 h-5 text-[#57534E] group-open:rotate-180 transition-transform flex-shrink-0" />
                </summary>
                <div className="px-5 pb-5 pt-2 text-sm text-[#57534E] leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="relative px-6 md:px-12 lg:px-24 py-16 md:py-24 z-10" data-testid="final-cta-section">
        <div className="max-w-3xl mx-auto text-center">
          <GlassCard className="p-10 sm:p-14" hover={false}>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
              <motion.p variants={fadeUp} className="text-sm text-[#D97706] font-bold uppercase tracking-[0.2em] mb-4">
                Start simple. Stay active. Grow steadily.
              </motion.p>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1917] mb-4">
                Paras Reward
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-base md:text-lg text-[#57534E] mb-8">
                Earn, Grow, Redeem
              </motion.p>
              <motion.div variants={fadeUp} custom={3}>
                <Button 
                  data-testid="final-cta-btn"
                  size="lg"
                  onClick={() => navigate('/register')}
                  className="rounded-full px-10 py-6 bg-[#114232] hover:bg-[#0a2e22] text-white font-semibold shadow-lg shadow-[#114232]/20 text-base"
                >
                  Start Earning Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </motion.div>
          </GlassCard>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="relative z-10 bg-[#114232] text-white py-12 px-6 md:px-12 lg:px-24" data-testid="footer-section">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <img src={LOGO_URL} alt="Paras Reward" className="h-10 w-10 rounded-xl" />
                <span className="font-bold text-xl">Paras Reward</span>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">
                PRC is a digital reward unit, not real currency. Earnings depend on user activity.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white/90">Quick Links</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li><Link to="/login" className="hover:text-white transition-colors">Login</Link></li>
                <li><Link to="/register" className="hover:text-white transition-colors">Register</Link></li>
                <li><Link to="/how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
                <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white/90">Legal</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li><Link to="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/disclaimer" className="hover:text-white transition-colors">Disclaimer</Link></li>
                <li><Link to="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white/90">Contact</h4>
              <ul className="space-y-3 text-white/60 text-sm">
                {contactInfo.company_name && (
                  <li className="font-medium text-white">{contactInfo.company_name}</li>
                )}
                {contactInfo.address && (
                  <li className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-400" />
                    <span className="whitespace-pre-line">{contactInfo.address}</span>
                  </li>
                )}
                {contactInfo.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-amber-400" />
                    {contactInfo.phone}
                    {contactInfo.phone_secondary && ` / ${contactInfo.phone_secondary}`}
                  </li>
                )}
                {contactInfo.email && (
                  <li className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-amber-400" />
                    {contactInfo.email}
                  </li>
                )}
                {contactInfo.working_hours && (
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400" />
                    {contactInfo.working_hours}
                  </li>
                )}
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-white/50 text-sm">
                &copy; {new Date().getFullYear()} Paras Reward Technologies Private Limited. All rights reserved.
              </p>
              <div className="flex items-center gap-3">
                <a 
                  href="https://www.dnb.com/duns-number.html" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg hover:border-white/30 transition-all"
                  title="D-U-N-S Registered"
                >
                  <div className="w-7 h-7 bg-teal-500 rounded-full flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-semibold text-teal-300">D-U-N-S&reg;</p>
                    <p className="text-[9px] text-white/50">Registered</p>
                  </div>
                </a>
              </div>
              <p className="text-white/40 text-xs">Terms & Conditions Apply</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RewardsHome;
