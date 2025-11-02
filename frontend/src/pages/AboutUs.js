import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Target, Eye, TrendingUp, Shield } from 'lucide-react';

const AboutUs = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">P</span>
              </div>
              <span className="text-xl font-bold text-gray-900">PARAS REWARD</span>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">About PARAS REWARD</h1>
          <p className="text-xl text-gray-600">
            India's first reward-based engagement platform designed to empower users through daily activities, referrals, and interactive games.
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <Card data-testid="mission-card" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
            <Target className="h-12 w-12 text-purple-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Mission</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-purple-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>To provide a transparent and fair reward ecosystem</span>
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-purple-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>To connect users with real-world benefits through digital rewards</span>
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-purple-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>To promote trust, security, and growth in reward-based engagement</span>
              </li>
            </ul>
          </Card>

          <Card data-testid="vision-card" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
            <Eye className="h-12 w-12 text-pink-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Vision</h2>
            <p className="text-gray-700 text-lg leading-relaxed">
              Building India's most trusted reward network where every user's time and engagement is valued. We envision a future where digital rewards seamlessly translate into tangible benefits, creating a win-win ecosystem for all participants.
            </p>
          </Card>
        </div>

        {/* What We Offer */}
        <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-12 rounded-3xl shadow-2xl mb-16">
          <h2 className="text-4xl font-bold text-center mb-12">What We Offer</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
                <TrendingUp className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Daily Rewards</h3>
              <p className="opacity-90">Earn PRC reward points every day through our innovative engagement system</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
                <Target className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Referral Rewards</h3>
              <p className="opacity-90">Build your network and earn bonus rewards for every active referral</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Secure Platform</h3>
              <p className="opacity-90">Your data and rewards are protected with enterprise-grade security</p>
            </div>
          </div>
        </Card>

        {/* Company Info */}
        <Card className="bg-white/80 backdrop-blur-sm p-12 rounded-3xl shadow-xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Company Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">PARAS REWARD</h3>
              <p className="text-gray-700 mb-4">
                A pioneering platform in the digital rewards space, combining blockchain-inspired concepts with practical reward distribution.
              </p>
              <p className="text-gray-700">
                <strong>Location:</strong> Maharashtra, India<br />
                <strong>Founded:</strong> 2025<br />
                <strong>Status:</strong> Operational
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Why Choose Us?</h3>
              <ul className="space-y-2 text-gray-700">
                <li>✅ Transparent reward system</li>
                <li>✅ Real product redemption</li>
                <li>✅ No hidden charges</li>
                <li>✅ 24/7 customer support</li>
                <li>✅ Secure KYC verification</li>
                <li>✅ Growing network of outlets</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AboutUs;