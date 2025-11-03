import React from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import AdSenseAd from '../components/AdSenseAd';
import { Award, Users, TrendingUp, Heart } from 'lucide-react';

const AboutUs = () => {
  const features = [
    {
      icon: Award,
      title: 'Rewarding User Time',
      description: 'We believe your time is valuable. Earn rewards simply by being active on our platform daily.'
    },
    {
      icon: TrendingUp,
      title: 'Passive Earnings',
      description: 'Enable passive earnings without any investment. Start earning from day one, absolutely free.'
    },
    {
      icon: Users,
      title: 'UPI Withdrawals',
      description: 'VIP users can withdraw their earnings directly to their bank accounts via UPI within 48-72 hours.'
    },
    {
      icon: Heart,
      title: 'Trusted Ecosystem',
      description: 'Building a trusted digital earning ecosystem in India with transparency and reliability.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">About PARAS REWARD</h1>
          <p className="text-gray-600 mt-2">India's First Mining-Based Rewards Platform</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4">
              <Award className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Who We Are</h2>
          </div>
          
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>
              <strong>PARAS REWARD</strong> is India's first mining-based rewards platform where users can earn digital coins simply by being active daily. We revolutionize the way people earn online by making it simple, transparent, and accessible to everyone.
            </p>
            <p>
              Our platform is designed for Indians who want to earn extra income without any investment. Whether you're a student, homemaker, or professional, PARAS REWARD offers you an opportunity to turn your daily digital activity into real rewards.
            </p>
            <p>
              With over 10,000+ active users and ₹50L+ rewards distributed, we have established ourselves as a trusted platform for digital earnings in India.
            </p>
          </div>
        </div>

        <AdSenseAd slot="3234567890" format="auto" />

        {/* Mission & Values */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            );
          })}
        </div>

        {/* Our Mission */}
        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg shadow-lg p-8 text-white mb-12">
          <h2 className="text-3xl font-bold mb-6 text-center">Our Mission</h2>
          <p className="text-lg leading-relaxed text-center max-w-3xl mx-auto">
            Our mission is to create a trusted digital earning ecosystem in India where every user can earn rewards for their time and participation. We believe in empowering individuals with financial opportunities that are free, transparent, and accessible to all.
          </p>
        </div>

        {/* What We Believe */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">What We Believe In</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <div className="text-4xl mb-4">💎</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Transparency</h3>
              <p className="text-gray-600">Clear rules, no hidden fees, complete visibility into your earnings</p>
            </div>
            <div className="text-center p-6 bg-pink-50 rounded-lg">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Innovation</h3>
              <p className="text-gray-600">Pioneering new ways for Indians to earn through digital platforms</p>
            </div>
            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Trust</h3>
              <p className="text-gray-600">Building long-term relationships with our user community</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AboutUs;