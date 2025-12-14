import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { InstallAppButton } from '@/components/PWAInstallPrompt';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, Zap, Users, Gift, Star, TrendingUp, Shield, ArrowRight, CheckCircle2, Play, Sparkles, Target, Crown, Facebook, Twitter, Instagram, Linkedin, Youtube, Send, MessageCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const Home = ({ user, onLogout }) => {
  const { t } = useTranslation();
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [socialMedia, setSocialMedia] = useState({
    facebook: 'https://facebook.com',
    twitter: 'https://twitter.com',
    instagram: 'https://instagram.com',
    linkedin: 'https://linkedin.com',
    youtube: 'https://youtube.com',
    telegram: 'https://t.me',
    whatsapp: 'https://wa.me'
  });

  useEffect(() => {
    fetchSocialMedia();
  }, []);

  const fetchSocialMedia = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/social-media-settings`);
      // Only update if values are not empty
      const newSocialMedia = {};
      Object.keys(response.data).forEach(key => {
        if (response.data[key]) {
          newSocialMedia[key] = response.data[key];
        }
      });
      if (Object.keys(newSocialMedia).length > 0) {
        setSocialMedia(prev => ({ ...prev, ...newSocialMedia }));
      }
    } catch (error) {
      console.error('Error fetching social media:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navbar user={user} onLogout={onLogout} />

      {/* Hero Section with Animated Background */}
      <div className="relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl -top-48 -left-48 animate-pulse"></div>
          <div className="absolute w-96 h-96 bg-pink-500/20 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse delay-1000"></div>
          <div className="absolute w-64 h-64 bg-blue-500/20 rounded-full blur-3xl top-1/2 left-1/2 animate-pulse delay-500"></div>
        </div>

        <div className="relative container mx-auto px-4 py-20">
          {/* Hero Content */}
          <div className="text-center max-w-5xl mx-auto mb-16">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-8 px-6 py-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-xl rounded-full border border-purple-500/30">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              <span className="text-white font-semibold">{t('home.badge')}</span>
              <Sparkles className="h-5 w-5 text-yellow-400" />
            </div>
            
            {/* Main Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">{t('home.hero_title_1')}</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 animate-gradient">
                {t('home.hero_title_2')}
              </span>
            </h1>
            
            <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
              {t('home.hero_description')}
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link to="/register">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-10 py-7 text-lg rounded-2xl shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 border-0"
                >
                  <Play className="mr-2 h-5 w-5" />
                  {t('home.start_earning')}
                </Button>
              </Link>
              
              {/* Install App Button */}
              <InstallAppButton />
              
              <Link to="/about">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="bg-white/10 backdrop-blur-xl border-2 border-white/30 text-white hover:bg-white/20 px-10 py-7 text-lg rounded-2xl shadow-xl transition-all duration-300"
                >
                  {t('home.learn_more')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto">
              <Card className="p-6 bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/15 transition-all duration-300">
                <div className="text-3xl font-bold text-purple-400">10,000+</div>
                <div className="text-gray-300 mt-1">{t('home.active_users')}</div>
              </Card>
              <Card className="p-6 bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/15 transition-all duration-300">
                <div className="text-3xl font-bold text-pink-400">₹50L+</div>
                <div className="text-gray-300 mt-1">{t('home.rewards_distributed')}</div>
              </Card>
              <Card className="p-6 bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/15 transition-all duration-300">
                <div className="text-3xl font-bold text-purple-400">5000+</div>
                <div className="text-gray-300 mt-1">{t('home.products')}</div>
              </Card>
            </div>

            {/* Social Media Links */}
            <div className="mt-12 flex flex-col items-center">
              <h3 className="text-xl font-semibold text-white mb-4">{t('footer.follow_us')}</h3>
              <div className="flex gap-4 items-center flex-wrap justify-center">
                  {/* Facebook */}
                  <a 
                    href={socialMedia.facebook} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group relative p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 hover:scale-110"
                  >
                    <Facebook className="h-7 w-7 text-white group-hover:text-blue-400 transition-colors" />
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap">
                      Facebook
                    </div>
                  </a>
                  
                  {/* Twitter */}
                  <a 
                    href={socialMedia.twitter} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group relative p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 hover:scale-110"
                  >
                    <Twitter className="h-7 w-7 text-white group-hover:text-blue-300 transition-colors" />
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap">
                      Twitter
                    </div>
                  </a>
                  
                  {/* Instagram */}
                  <a 
                    href={socialMedia.instagram} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group relative p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 hover:scale-110"
                  >
                    <Instagram className="h-7 w-7 text-white group-hover:text-pink-400 transition-colors" />
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap">
                      Instagram
                    </div>
                  </a>
                  
                  {/* LinkedIn */}
                  <a 
                    href={socialMedia.linkedin} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group relative p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 hover:scale-110"
                  >
                    <Linkedin className="h-7 w-7 text-white group-hover:text-blue-500 transition-colors" />
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap">
                      LinkedIn
                    </div>
                  </a>
                  
                  {/* YouTube */}
                  <a 
                    href={socialMedia.youtube} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group relative p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 hover:scale-110"
                  >
                    <Youtube className="h-7 w-7 text-white group-hover:text-red-500 transition-colors" />
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap">
                      YouTube
                    </div>
                  </a>
                  
                  {/* Telegram */}
                  <a 
                    href={socialMedia.telegram} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group relative p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 hover:scale-110"
                  >
                    <Send className="h-7 w-7 text-white group-hover:text-blue-400 transition-colors" />
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap">
                      Telegram
                    </div>
                  </a>
                  
                  {/* WhatsApp */}
                  <a 
                    href={socialMedia.whatsapp} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group relative p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 hover:scale-110"
                  >
                    <MessageCircle className="h-7 w-7 text-white group-hover:text-green-400 transition-colors" />
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap">
                      WhatsApp
                    </div>
                  </a>
                </div>
              </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-gradient-to-br from-white to-purple-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Start earning rewards in just 3 simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: 1,
                icon: Users,
                title: 'Sign Up Free',
                description: 'Create your account in 60 seconds with just email and mobile',
                gradient: 'from-purple-500 to-pink-500'
              },
              {
                step: 2,
                icon: Zap,
                title: 'Complete Activities',
                description: 'Earn PRC through daily tasks, games, and referrals',
                gradient: 'from-pink-500 to-orange-500'
              },
              {
                step: 3,
                icon: Gift,
                title: 'Redeem Rewards',
                description: 'Exchange PRC for products, cash, or exclusive offers',
                gradient: 'from-orange-500 to-purple-500'
              }
            ].map((item) => (
              <div key={item.step} className="relative">
                <Card className="p-8 h-full bg-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                  <div className={`w-16 h-16 bg-gradient-to-br ${item.gradient} rounded-2xl flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold shadow-lg`}>
                    {item.step}
                  </div>
                  <div className="flex justify-center mb-4">
                    <item.icon className="h-12 w-12 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">{item.title}</h3>
                  <p className="text-gray-600 text-center">{item.description}</p>
                </Card>
                {item.step < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-8 w-8 text-purple-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Why Choose PARAS REWARD?
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Trusted by thousands. Powered by innovation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Zap,
                title: 'Daily Rewards',
                description: 'Earn PRC reward points every day through engagement activities',
                color: 'purple'
              },
              {
                icon: Users,
                title: 'Referral System',
                description: 'Get 10% bonus on friend rewards (up to 200 referrals)',
                color: 'pink'
              },
              {
                icon: Gift,
                title: 'Marketplace',
                description: 'Redeem PRC for 5000+ real products',
                color: 'blue'
              },
              {
                icon: Crown,
                title: 'VIP Membership',
                description: 'Unlimited validity & exclusive benefits',
                color: 'yellow'
              },
              {
                icon: Shield,
                title: 'Secure & Safe',
                description: 'Bank-grade security with encrypted transactions',
                color: 'green'
              },
              {
                icon: TrendingUp,
                title: 'Dynamic Rates',
                description: 'Reward rates increase with referrals and activity',
                color: 'orange'
              },
              {
                icon: Target,
                title: 'No Investment',
                description: '100% free to join. No hidden charges',
                color: 'indigo'
              }
            ].map((feature, index) => (
              <Card
                key={index}
                className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all duration-300 hover:-translate-y-2 cursor-pointer"
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div className={`w-14 h-14 bg-gradient-to-br from-${feature.color}-500 to-${feature.color}-600 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 ${hoveredFeature === index ? 'scale-110' : ''}`}>
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* VIP Membership Plans Section */}
      <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 mb-4 px-6 py-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-full border border-purple-300">
                <Crown className="h-5 w-5 text-purple-600" />
                <span className="text-purple-900 font-semibold">VIP Membership Plans</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Choose Your Plan
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Unlock unlimited rewards, instant withdrawals & exclusive benefits
              </p>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {/* Monthly Plan */}
              <Card className="relative overflow-hidden bg-white border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                <div className="p-8">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4">
                      <Zap className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Monthly</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-purple-600">₹299</span>
                      <span className="text-gray-500">/month</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">30 days validity</p>
                  </div>
                  <Link to="/vip">
                    <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                      Get Started
                    </Button>
                  </Link>
                </div>
              </Card>

              {/* Quarterly Plan */}
              <Card className="relative overflow-hidden bg-white border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                <div className="p-8">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl mb-4">
                      <Target className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Quarterly</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-purple-600">₹897</span>
                      <span className="text-gray-500">/3 months</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">90 days validity</p>
                  </div>
                  <Link to="/vip">
                    <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                      Get Started
                    </Button>
                  </Link>
                </div>
              </Card>

              {/* Half-Yearly Plan - Popular */}
              <Card className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-pink-600 border-0 shadow-2xl transform scale-105">
                <div className="absolute top-0 right-0 bg-yellow-400 text-purple-900 px-4 py-1 text-xs font-bold rounded-bl-lg">
                  POPULAR
                </div>
                <div className="p-8">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-xl rounded-2xl mb-4">
                      <Star className="h-8 w-8 text-yellow-300" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Half-Yearly</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-white">₹1,794</span>
                      <span className="text-purple-100">/6 months</span>
                    </div>
                    <p className="text-sm text-purple-100 mt-2">180 days validity</p>
                  </div>
                  <Link to="/vip">
                    <Button className="w-full bg-white text-purple-600 hover:bg-gray-100">
                      Get Started
                    </Button>
                  </Link>
                </div>
              </Card>

              {/* Yearly Plan - Best Value */}
              <Card className="relative overflow-hidden bg-white border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                <div className="absolute top-0 right-0 bg-green-500 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
                  BEST VALUE
                </div>
                <div className="p-8">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4">
                      <Crown className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Yearly</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-purple-600">₹3,588</span>
                      <span className="text-gray-500">/year</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">365 days validity</p>
                  </div>
                  <Link to="/vip">
                    <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                      Get Started
                    </Button>
                  </Link>
                </div>
              </Card>
            </div>

            {/* VIP Benefits */}
            <Card className="p-8 bg-white/80 backdrop-blur-xl border border-purple-200 shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">All Plans Include</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: CheckCircle2, text: 'Unlimited PRC validity' },
                  { icon: Zap, text: 'Instant UPI withdrawals' },
                  { icon: Shield, text: 'Priority customer support' },
                  { icon: Gift, text: 'Exclusive product access' },
                  { icon: TrendingUp, text: 'Higher reward rates' },
                  { icon: Target, text: 'No withdrawal limits' }
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-gray-900 font-medium">{benefit.text}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Ready to Start Earning?
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Join thousands of users already earning daily rewards. No investment, no risk.
          </p>
          <Link to="/register">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-7 text-lg rounded-2xl shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105"
            >
              Create Free Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Home;
