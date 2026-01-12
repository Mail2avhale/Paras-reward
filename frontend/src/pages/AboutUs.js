import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, Users, TrendingUp, Heart, Shield, Zap } from 'lucide-react';

const AboutUs = () => {
  const navigate = useNavigate();
  
  const features = [
    {
      icon: Award,
      title: 'Rewarding Engagement',
      description: 'We value your time. Earn virtual reward points through daily activities, games, and platform interactions.'
    },
    {
      icon: TrendingUp,
      title: 'Digital Rewards',
      description: 'Earn promotional reward points through engagement. No investment required - completely free to join and participate.'
    },
    {
      icon: Users,
      title: 'Reward Redemption',
      description: 'Paid plan users can redeem their reward points for mobile recharges, bill payments, and in-app shopping.'
    },
    {
      icon: Heart,
      title: 'Trusted Platform',
      description: 'Building a trusted digital engagement ecosystem with transparency, security, and reliability.'
    }
  ];

  const stats = [
    { value: '10,000+', label: 'Active Users' },
    { value: '₹50L+', label: 'Rewards Distributed' },
    { value: '24/7', label: 'Support' },
    { value: '99.9%', label: 'Uptime' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white text-xl font-bold">About Us</h1>
        </div>
      </div>

      {/* Hero Section */}
      <div className="px-5 mb-8">
        <div className="relative overflow-hidden rounded-3xl p-6" style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
        }}>
          {/* Gold Accent */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-3xl" />
          
          <div className="relative text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Award className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">PARAS REWARD</h2>
            <p className="text-amber-400 text-sm">India&apos;s First Mining-Based Rewards Platform</p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="px-5 mb-8">
        <div className="grid grid-cols-4 gap-2">
          {stats.map((stat, index) => (
            <div key={index} className="bg-gray-900/50 rounded-xl p-3 text-center border border-gray-800">
              <p className="text-amber-500 font-bold text-lg">{stat.value}</p>
              <p className="text-gray-500 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Who We Are */}
      <div className="px-5 mb-8">
        <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            Who We Are
          </h3>
          <div className="space-y-3 text-gray-400 text-sm leading-relaxed">
            <p>
              <span className="text-amber-400 font-semibold">PARAS REWARD</span> is India&apos;s first mining-based rewards platform where users can earn digital coins simply by being active daily.
            </p>
            <p>
              Our platform is designed for Indians who want to earn extra income without any investment. Whether you&apos;re a student, homemaker, or professional, we offer you an opportunity to turn your daily digital activity into real rewards.
            </p>
            <p>
              With over <span className="text-emerald-400">10,000+ active users</span> and <span className="text-emerald-400">₹50L+ rewards distributed</span>, we have established ourselves as a trusted platform for digital earnings in India.
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-5 mb-8">
        <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Why Choose Us
        </h3>
        <div className="space-y-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 hover:border-amber-500/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-sm mb-1">{feature.title}</h4>
                    <p className="text-gray-500 text-xs leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How It Works */}
      <div className="px-5 mb-8">
        <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 rounded-2xl p-5 border border-amber-500/20">
          <h3 className="text-white font-bold text-lg mb-4">How It Works</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-gray-900 font-bold flex items-center justify-center text-sm">1</div>
              <p className="text-gray-300 text-sm">Register for free and start your rewards journey</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-gray-900 font-bold flex items-center justify-center text-sm">2</div>
              <p className="text-gray-300 text-sm">Activate daily rewards and earn PRC coins passively</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-gray-900 font-bold flex items-center justify-center text-sm">3</div>
              <p className="text-gray-300 text-sm">Play games, invite friends, and multiply your earnings</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-gray-900 font-bold flex items-center justify-center text-sm">4</div>
              <p className="text-gray-300 text-sm">Redeem rewards or upgrade to VIP for UPI withdrawals</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="px-5 pb-8">
        <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-white font-bold text-lg mb-3">Contact Us</h3>
          <p className="text-gray-400 text-sm mb-4">Have questions? We&apos;re here to help!</p>
          <Link 
            to="/contact" 
            className="inline-flex items-center justify-center w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-900 font-bold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all"
          >
            Get in Touch
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
