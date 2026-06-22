import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  Users, Shield, ArrowRight, CheckCircle, Crown, Globe, ChevronDown,
  Eye, Smartphone, Building2, Coins, Gift, MapPin, Phone, Mail, Clock,
  Sparkles, BarChart3, Wallet, CreditCard, UserPlus, Activity,
  BadgeCheck, Scale, BookOpen, Zap, TrendingUp, Lock, Heart, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';
import SEO, { SEOConfigs } from '@/components/SEO';
import AppDownloadBadge from '@/components/AppDownloadBadge';

import { API } from "../lib/api";
const LOGO_URL = "/paras-logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] } })
};
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

const RewardsHome = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const [stats, setStats] = useState({ totalUsers: 0, totalPRC: 0, vipMembers: 0, totalRedeemed: 0 });
  const [loading, setLoading] = useState(true);
  const [contactInfo, setContactInfo] = useState({});
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, contactRes] = await Promise.allSettled([
          axios.get(`${API}/stats`), axios.get(`${API}/public/contact-info`)
        ]);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
        if (contactRes.status === 'fulfilled') setContactInfo(contactRes.value.data);
      } catch (e) {}
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <SEO {...SEOConfigs.home} />

      {/* ===== HEADER ===== */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2" data-testid="header-logo">
              <img src={LOGO_URL} alt="Paras Reward" className="h-11 w-auto object-contain" />
              <span className="font-bold text-lg text-gray-900 hidden sm:block">Paras Reward</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative">
                <button data-testid="language-selector" onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-600 transition-colors">
                  <Globe className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{language.toUpperCase()}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showLangDropdown && (
                  <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <button key={code} onClick={() => { setLanguage(code); setShowLangDropdown(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${language === code ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>{name}</button>
                    ))}
                  </div>
                )}
              </div>
              <Button data-testid="header-login-btn" variant="ghost" onClick={() => navigate('/login')} className="text-gray-700 hover:bg-gray-100 rounded-full px-4 text-sm">Login</Button>
              <Button data-testid="header-register-btn" onClick={() => navigate('/register')}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 shadow-md shadow-blue-600/25 text-sm font-semibold">Register</Button>
            </div>
          </div>
        </div>
      </header>

      {/* ===== 1. HERO SECTION ===== */}
      <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-24 px-6" data-testid="hero-section">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize:'60px 60px'}} />
        </div>
        <div className="relative max-w-4xl mx-auto text-center z-10">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} custom={0}>
              <img src={LOGO_URL} alt="Paras Reward" className="h-20 sm:h-24 w-auto mx-auto mb-6 object-contain" />
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-4">
              Earn Rewards with<br />Daily Activity
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="text-base sm:text-lg text-blue-100 mb-3 font-medium">
              Simple &bull; Scalable &bull; Sustainable Reward Ecosystem
            </motion.p>
            <motion.p variants={fadeUp} custom={3} className="text-sm text-blue-200 mb-8 flex items-center justify-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 px-3 py-1 rounded-full"><BadgeCheck className="h-4 w-4 text-green-300" /> Registered in India</span>
              <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 px-3 py-1 rounded-full"><Shield className="h-4 w-4 text-blue-300" /> Secure</span>
              <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 px-3 py-1 rounded-full"><Eye className="h-4 w-4 text-purple-300" /> Transparent</span>
            </motion.p>
            <motion.div variants={fadeUp} custom={4} className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button data-testid="hero-cta-btn" size="lg" onClick={() => navigate('/register')}
                className="rounded-full px-10 py-6 bg-white text-blue-700 hover:bg-blue-50 font-bold shadow-xl shadow-black/10 text-base">
                Start Earning Rewards <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <AppDownloadBadge className="!py-3.5" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== 2. SOCIAL PROOF STRIP ===== */}
      <section className="bg-white border-b border-gray-100 py-6 px-6" data-testid="trust-strip">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
            {[
              { icon: Users, val: loading ? '...' : `${stats.totalUsers.toLocaleString()}+`, label: 'Active Users' },
              { icon: Wallet, val: loading ? '...' : `₹${Math.round(stats.totalRedeemed).toLocaleString()}+`, label: 'Rewards Distributed' },
              { icon: Crown, val: loading ? '...' : `${stats.vipMembers.toLocaleString()}+`, label: 'Premium Members' },
              { icon: Shield, val: '100%', label: 'Transparent System' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <item.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-lg leading-tight">{item.val}</div>
                  <div className="text-xs text-gray-500">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Social proof line */}
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-100">
            <div className="flex -space-x-2">
              {['bg-blue-500','bg-purple-500','bg-green-500','bg-amber-500','bg-pink-500'].map((bg, i) => (
                <div key={i} className={`w-7 h-7 rounded-full ${bg} border-2 border-white flex items-center justify-center`}>
                  <span className="text-white text-[10px] font-bold">{['S','A','R','M','P'][i]}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-700">{loading ? '...' : `${stats.totalUsers.toLocaleString()}+`}</span> users trust Paras Reward
            </p>
          </div>
        </div>
      </section>

      {/* ===== 2.6 BANKING PARTNERS ===== */}
      <section className="bg-white border-y border-gray-100 py-8 sm:py-10 px-6" data-testid="banking-partners-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-xs font-bold tracking-[0.18em] text-gray-400 uppercase">
              Powered by Trusted Banking Partners
            </p>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mt-2">
              Your money flows through RBI-regulated banks
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:gap-8 items-center justify-items-center">
            <div className="flex flex-col items-center gap-2" data-testid="partner-hdfc">
              <div className="h-14 sm:h-16 w-full max-w-[140px] flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 hover:shadow-md transition-shadow">
                <img
                  src="/partners/hdfc.svg"
                  alt="HDFC Bank"
                  loading="lazy"
                  className="max-h-8 sm:max-h-10 w-auto object-contain"
                />
              </div>
              <span className="text-[11px] text-gray-500">HDFC Bank</span>
            </div>
            <div className="flex flex-col items-center gap-2" data-testid="partner-kotak">
              <div className="h-14 sm:h-16 w-full max-w-[140px] flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 hover:shadow-md transition-shadow">
                <img
                  src="/partners/kotak.svg"
                  alt="Kotak Mahindra Bank"
                  loading="lazy"
                  className="max-h-9 sm:max-h-11 w-auto object-contain"
                />
              </div>
              <span className="text-[11px] text-gray-500">Kotak Mahindra</span>
            </div>
            <div className="flex flex-col items-center gap-2" data-testid="partner-razorpay">
              <div className="h-14 sm:h-16 w-full max-w-[140px] flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 hover:shadow-md transition-shadow">
                <img
                  src="/partners/razorpay.svg"
                  alt="Razorpay Payment Gateway"
                  loading="lazy"
                  className="max-h-7 sm:max-h-9 w-auto object-contain"
                />
              </div>
              <span className="text-[11px] text-gray-500">Razorpay</span>
            </div>
          </div>
          <p className="text-center text-[11px] text-gray-400 mt-5">
            All bank transfers are processed via licensed BBPS &amp; payment-gateway partners under RBI guidelines.
          </p>
        </div>
      </section>

      {/* ===== 2.5 TRUST PILLARS — 6 Reasons to Choose Us ===== */}
      <section className="py-14 sm:py-20 px-6 bg-gradient-to-b from-gray-50 via-white to-gray-50" data-testid="trust-pillars-section">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="text-center mb-10 sm:mb-14"
          >
            <motion.span
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-bold uppercase tracking-wider text-blue-700"
            >
              <BadgeCheck className="h-3.5 w-3.5" /> Why Choose Us
            </motion.span>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight"
            >
              6 Pillars of Trust
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-3 text-base text-gray-500 max-w-2xl mx-auto"
            >
              Built on transparency, secured by technology, powered by real utility — every feature engineered for your confidence.
            </motion.p>
          </motion.div>

          {/* 6 Pillar cards */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
          >
            {[
              {
                icon: BadgeCheck,
                title: 'Registered Indian Company',
                desc: 'CIN-registered pvt. ltd. company under MCA, fully compliant with Indian laws.',
                gradient: 'from-emerald-500 to-green-600',
                iconBg: 'bg-emerald-50',
                iconTint: 'text-emerald-600',
                ring: 'hover:ring-emerald-200',
              },
              {
                icon: Eye,
                title: '100% Transparent System',
                desc: 'Public stats, real-time ledger, open PRC economy — every rupee traceable.',
                gradient: 'from-blue-500 to-indigo-600',
                iconBg: 'bg-blue-50',
                iconTint: 'text-blue-600',
                ring: 'hover:ring-blue-200',
              },
              {
                icon: Shield,
                title: 'Secure & Safe Platform',
                desc: 'Bank-grade encryption, 2FA, KYC verification, and strict data privacy.',
                gradient: 'from-purple-500 to-violet-600',
                iconBg: 'bg-purple-50',
                iconTint: 'text-purple-600',
                ring: 'hover:ring-purple-200',
              },
              {
                icon: Zap,
                title: 'Real Utility Services',
                desc: 'Mobile recharge, DTH, bill payments & instant bank redeem — not just points.',
                gradient: 'from-amber-500 to-orange-600',
                iconBg: 'bg-amber-50',
                iconTint: 'text-amber-600',
                ring: 'hover:ring-amber-200',
              },
              {
                icon: Sparkles,
                title: 'No Hidden Charges',
                desc: 'Upfront pricing with platform fee & admin charge shown before every transaction.',
                gradient: 'from-rose-500 to-pink-600',
                iconBg: 'bg-rose-50',
                iconTint: 'text-rose-600',
                ring: 'hover:ring-rose-200',
              },
              {
                icon: Activity,
                title: 'Activity-Based Earning',
                desc: 'Earn by mining, referrals & subscriptions — no guarantees, no empty promises.',
                gradient: 'from-indigo-500 to-blue-700',
                iconBg: 'bg-indigo-50',
                iconTint: 'text-indigo-600',
                ring: 'hover:ring-indigo-200',
              },
            ].map((pillar, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                data-testid={`trust-pillar-${i}`}
                className={`group relative bg-white rounded-2xl border border-gray-100 p-6 sm:p-7 shadow-sm hover:shadow-xl hover:shadow-gray-200/60 ring-1 ring-transparent ${pillar.ring} transition-all duration-300`}
              >
                {/* Top-right check accent */}
                <div className="absolute top-5 right-5 w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center opacity-90 shadow-sm shadow-emerald-500/30">
                  <CheckCircle className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </div>

                {/* Gradient Icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center shadow-md shadow-gray-300/40 mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <pillar.icon className="h-7 w-7 text-white" strokeWidth={2.2} />
                </div>

                {/* Title */}
                <h3 className="font-bold text-gray-900 text-lg leading-snug mb-2">
                  {pillar.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-500 leading-relaxed">
                  {pillar.desc}
                </p>

                {/* Decorative bottom-left corner glow */}
                <div className={`absolute -bottom-1 -left-1 w-20 h-20 rounded-full bg-gradient-to-br ${pillar.gradient} opacity-0 group-hover:opacity-5 blur-2xl transition-opacity duration-500 pointer-events-none`} />
              </motion.div>
            ))}
          </motion.div>

          {/* Bottom assurance strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 sm:mt-14 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-500"
          >
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-gray-400" /> SSL Encrypted
            </span>
            <span className="hidden sm:inline text-gray-300">&bull;</span>
            <span className="inline-flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-gray-400" /> GST Compliant
            </span>
            <span className="hidden sm:inline text-gray-300">&bull;</span>
            <span className="inline-flex items-center gap-1.5">
              <Heart className="h-4 w-4 text-gray-400" /> 10,000+ Happy Users
            </span>
          </motion.div>
        </div>
      </section>

      {/* ===== 3. COMPANY TRUST BLOCK ===== */}
      <section className="py-12 sm:py-16 px-6" data-testid="company-trust-section">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="bg-white rounded-2xl sm:rounded-3xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 sm:p-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-4">Registered Company Details</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/20">
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Paras Reward Technologies Private Limited</h3>
                <p className="text-sm text-gray-500 mt-0.5">CIN: U82990MH2026PTC467423 &bull; Maharashtra, India</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200 text-sm font-medium text-green-700">
                <CheckCircle className="h-4 w-4" /> Verified Business
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-sm font-medium text-blue-700">
                <Lock className="h-4 w-4" /> Secure Platform
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== 4. HOW IT WORKS ===== */}
      <section className="py-12 sm:py-20 px-6 bg-white" data-testid="how-it-works-section">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10 sm:mb-14">
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">How It Works</motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-gray-500">Start earning in 4 simple steps</motion.p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: UserPlus, title: 'Register', desc: 'Create your account', color: 'bg-blue-100 text-blue-600' },
              { icon: Crown, title: 'Subscribe', desc: 'Activate your plan', color: 'bg-purple-100 text-purple-600' },
              { icon: Coins, title: 'Collect Rewards', desc: 'Earn PRC daily', color: 'bg-amber-100 text-amber-600' },
              { icon: Gift, title: 'Use Rewards', desc: 'Recharge or redeem', color: 'bg-green-100 text-green-600' },
            ].map((step, i) => (
              <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className="bg-gray-50 rounded-2xl p-5 sm:p-6 text-center border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className="text-3xl font-black text-gray-200 mb-2">0{i + 1}</div>
                <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center mx-auto mb-3`}>
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1 text-sm sm:text-base">{step.title}</h3>
                <p className="text-xs text-gray-500">{step.desc}</p>
              </motion.div>
            ))}
          </div>
          {/* CTA after How It Works */}
          <div className="text-center mt-10">
            <Button data-testid="hiw-cta-btn" onClick={() => navigate('/register')}
              className="rounded-full px-8 py-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-600/25 text-sm">
              Start Earning Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ===== 5. QUICK UNDERSTAND ===== */}
      <section className="py-12 sm:py-20 px-6" data-testid="quick-understand-section">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10">
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">Understand in 30 Seconds</motion.h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Coins, title: 'PRC', desc: 'Reward Points', detail: 'Digital reward unit earned through daily activity', color: 'from-blue-500 to-blue-600' },
              { icon: Gift, title: 'Redeem', desc: 'Use Rewards', detail: 'Convert PRC to recharge or bank transfer', color: 'from-purple-500 to-purple-600' },
              { icon: Shield, title: 'Limit', desc: 'Controlled Usage', detail: 'Fair system based on your activity & growth', color: 'from-indigo-500 to-indigo-600' },
            ].map((card, i) => (
              <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 text-center hover:shadow-xl transition-shadow">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                  <card.icon className="h-7 w-7 text-white" />
                </div>
                <div className="font-bold text-gray-900 text-lg mb-0.5">{card.title}</div>
                <div className="text-blue-600 font-semibold text-sm mb-2">= {card.desc}</div>
                <p className="text-xs text-gray-500">{card.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 6. PERFORMANCE PREVIEW ===== */}
      <section className="py-12 sm:py-20 px-6 bg-white" data-testid="performance-section">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-8">
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">Your Performance Summary</motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-gray-500 text-sm">Track every detail of your reward journey</motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
            className="bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xl shadow-blue-600/20">
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              {[
                { label: 'Total Subscription Paid', value: '₹7,990', icon: Wallet },
                { label: 'Total Rewards Redeemed', value: '₹12,000', icon: TrendingUp },
                { label: 'Available PRC', value: '80,000', icon: Coins },
                { label: 'Estimated Value', value: '≈ ₹8,000', icon: BarChart3 },
              ].map((item, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon className="h-4 w-4 text-blue-200" />
                    <span className="text-xs text-blue-200 font-medium">{item.label}</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-white">{item.value}</div>
                </div>
              ))}
            </div>
            <p className="text-center text-blue-200 text-xs mt-5">*Sample data for illustration purposes only</p>
          </motion.div>
        </div>
      </section>

      {/* ===== 7. REDEEM OPTIONS ===== */}
      <section className="py-12 sm:py-16 px-6" data-testid="redeem-options-section">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-8">
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">Redeem Options</motion.h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
              className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-7 w-7 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Mobile Recharge</h3>
                <p className="text-sm text-gray-500">Recharge directly with PRC</p>
              </div>
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-7 w-7 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Bank Redeem</h3>
                <p className="text-sm text-gray-500">Eligible users only</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== 8. ABOUT + AIM + VISION + MISSION ===== */}
      <section className="py-12 sm:py-20 px-6 bg-white" data-testid="about-section">
        <div className="max-w-5xl mx-auto">
          {/* About Us */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="bg-gray-50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-gray-100 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Heart className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">About Us</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Paras Reward Technologies Private Limited is a digital platform focused on building a simple and scalable reward-based ecosystem for users across India.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              The platform allows users to earn digital rewards (PRC) through their daily activity and engagement. These rewards can be used for real utility services such as mobile recharge and controlled bank payout options.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Our goal is to create a transparent, user-friendly, and sustainable reward system that encourages participation, consistency, and growth.
            </p>
          </motion.div>

          {/* Aim + Vision + Mission Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
                <Star className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-3">Aim</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                To provide a simple and accessible digital reward system where every user can benefit from their activity and engagement without complexity.
              </p>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
                <Eye className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-3">Vision</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                To build one of India's most trusted digital reward ecosystems where users can earn, grow, and utilize rewards in a controlled and sustainable manner.
              </p>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
              className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-3">Mission</h3>
              <ul className="space-y-2">
                {[
                  'Simplify digital earning through activity-based rewards',
                  'Create a secure and transparent platform for users',
                  'Ensure long-term sustainability through controlled reward distribution',
                  'Build a strong community-driven ecosystem across India',
                ].map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />{item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== 9. WHY CHOOSE US ===== */}
      <section className="py-12 sm:py-20 px-6" data-testid="why-choose-section">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10">
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">Why Choose Paras Reward?</motion.h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Sparkles, title: 'No Complex System', desc: 'Simple and easy to use for everyone' },
              { icon: Activity, title: 'Activity-Based Rewards', desc: 'Earn by staying active daily' },
              { icon: Eye, title: 'Transparent Model', desc: 'Everything is visible and trackable' },
              { icon: TrendingUp, title: 'Long-Term Focus', desc: 'Built for sustainable growth' },
            ].map((item, i) => (
              <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className="bg-white rounded-2xl p-5 shadow-md shadow-gray-200/50 border border-gray-100 flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <item.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-0.5">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
          {/* CTA after Why Choose */}
          <div className="text-center mt-10">
            <Button data-testid="why-cta-btn" onClick={() => navigate('/register')}
              className="rounded-full px-8 py-5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg shadow-blue-600/25 text-sm">
              Join Paras Reward <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ===== 10. DISCLAIMER ===== */}
      <section className="py-12 px-6 bg-white" data-testid="disclaimer-section">
        <div className="max-w-3xl mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Scale className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Important Disclaimer</h3>
            </div>
            <p className="text-sm text-gray-700 mb-4 font-medium">Paras Reward is a digital reward platform.</p>
            <ul className="space-y-2.5">
              {[
                'PRC (Paras Reward Coin) is a reward unit and not a currency, investment, or financial instrument',
                'The platform does not guarantee any fixed or assured income',
                'Rewards are based on user activity, participation, and system conditions',
                'The displayed PRC value is indicative and for utility purposes only',
                'Bank redeem and other services are subject to platform rules and eligibility criteria',
                'Users are advised to use the platform responsibly',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />{item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-amber-200">
              By using Paras Reward, you agree to our <Link to="/terms" className="text-blue-600 underline">Terms & Conditions</Link> and <Link to="/disclaimer" className="text-blue-600 underline">Full Disclaimer</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* ===== 10.5 TERMS & CONDITIONS SUMMARY ===== */}
      <section className="py-12 px-6" data-testid="terms-section">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Terms & Conditions</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: 'User Eligibility', items: ['Must be 18 years or above', 'KYC verification may be required'] },
                { title: 'Account Usage', items: ['Only one account per user allowed', 'Duplicate accounts may lead to suspension'] },
                { title: 'Subscription', items: ['Active subscription required for access', 'Subscription fees are non-refundable'] },
                { title: 'Rewards (PRC)', items: ['PRC is a digital reward unit', 'No direct monetary value outside the platform', 'Depends on activity and system rules'] },
                { title: 'Redeem Policy', items: ['Subject to unlock conditions and limits', 'One redeem per subscription cycle', 'Bank redeem for eligible users only'] },
                { title: 'Burn & Adjustments', items: ['Platform may apply burn or adjustments to maintain system balance'] },
                { title: 'Fraud & Misuse', items: ['Fraudulent activity leads to suspension', 'Manipulation results in termination'] },
                { title: 'Platform Rights', items: ['Company reserves right to modify features, rewards, and policies'] },
              ].map((section, i) => (
                <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">{section.title}</h4>
                  <ul className="space-y-1.5">
                    {section.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-gray-500">
                        <CheckCircle className="h-3.5 w-3.5 text-blue-400 mt-0.5 flex-shrink-0" />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">
              The platform is not responsible for any indirect or consequential loss. Read full <Link to="/terms" className="text-blue-600 underline">Terms & Conditions</Link>.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ===== 11. FINAL CTA ===== */}
      <section className="py-16 sm:py-24 px-6" data-testid="final-cta-section">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 rounded-2xl sm:rounded-3xl p-10 sm:p-14 shadow-xl shadow-blue-600/20">
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-4xl font-extrabold text-white mb-4">
              Start Your Reward<br />Journey Today
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-blue-100 mb-4 text-base">
              Join thousands of users earning rewards daily
            </motion.p>
            <motion.p variants={fadeUp} custom={2} className="text-blue-200 text-xs mb-8 max-w-md mx-auto">
              Paras Reward is designed as a performance-based digital reward system, not an investment or income guarantee platform.
            </motion.p>
            <motion.div variants={fadeUp} custom={3}>
              <Button data-testid="final-cta-btn" size="lg" onClick={() => navigate('/register')}
                className="rounded-full px-10 py-6 bg-white text-blue-700 hover:bg-blue-50 font-bold shadow-xl text-base">
                Join Now <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== 12. FOOTER ===== */}
      <footer className="bg-gray-900 text-white py-12 px-6" data-testid="footer-section">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src={LOGO_URL} alt="Paras Reward" className="h-10 w-auto object-contain" />
              </div>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">A digital platform focused on building a simple and scalable reward-based ecosystem for users across India.</p>
              <AppDownloadBadge variant="compact" data-testid="footer-app-download" />
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-2.5 text-gray-400 text-sm">
                <li><Link to="/about-us" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link to="/how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
                <li><Link to="/careers" className="hover:text-white transition-colors">Careers</Link></li>
                <li><Link to="/investors" className="hover:text-white transition-colors">Investors</Link></li>
                <li><Link to="/contact-us" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div data-testid="footer-free-tools">
              <h4 className="font-semibold mb-4 text-white">Free Tools</h4>
              <ul className="space-y-2.5 text-gray-400 text-sm">
                <li><Link to="/referral-calculator" data-testid="footer-link-referral-calculator" className="hover:text-white transition-colors">Earnings Calculator</Link></li>
                <li><Link to="/prc-to-inr-converter" data-testid="footer-link-prc-to-inr" className="hover:text-white transition-colors">PRC to INR Converter</Link></li>
                <li><Link to="/recharge-cashback-calculator" data-testid="footer-link-cashback" className="hover:text-white transition-colors">Recharge Cashback Calculator</Link></li>
                <li><Link to="/how-to-earn-money-online-india" data-testid="footer-link-earn-online" className="hover:text-white transition-colors">How to Earn Money Online</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Legal</h4>
              <ul className="space-y-2.5 text-gray-400 text-sm">
                <li><Link to="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/disclaimer" className="hover:text-white transition-colors">Disclaimer</Link></li>
                <li><Link to="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Contact</h4>
              <ul className="space-y-2.5 text-gray-400 text-sm">
                {contactInfo.phone && <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-blue-400" />{contactInfo.phone}</li>}
                {contactInfo.email && <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-blue-400" />{contactInfo.email}</li>}
                {contactInfo.working_hours && <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-400" />{contactInfo.working_hours}</li>}
                {contactInfo.address && <li className="flex items-start gap-2"><MapPin className="h-4 w-4 text-blue-400 mt-0.5" /><span>{contactInfo.address}</span></li>}
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} Paras Reward Technologies Private Limited. All rights reserved.</p>
            <div className="flex items-center gap-3">
              <a href="https://www.dnb.com/duns-number.html" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-all" title="D-U-N-S Registered">
                <div className="w-7 h-7 bg-teal-500 rounded-full flex items-center justify-center"><Shield className="w-4 h-4 text-white" /></div>
                <div className="text-left"><p className="text-[10px] font-semibold text-teal-400">D-U-N-S&reg;</p><p className="text-[9px] text-gray-500">Registered</p></div>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RewardsHome;
