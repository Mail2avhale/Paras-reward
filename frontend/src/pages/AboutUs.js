import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, Users, Target, Shield, Award, Heart } from 'lucide-react';

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
              <Button variant="ghost" className="flex items-center gap-2 hover:bg-purple-50">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl mb-6 shadow-2xl">
              <Award className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">About PARAS REWARD</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              India's first reward-based engagement platform designed to empower users through daily activities, referrals, and interactive games.
            </p>
          </div>

          {/* Mission & Vision */}
          <Card className="p-10 bg-gradient-to-br from-purple-600 to-pink-600 text-white mb-12 shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
              <p className="text-lg text-purple-100 max-w-2xl mx-auto">
                To create a trusted digital earning ecosystem in India that rewards user time and enables passive earnings without investment
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
                  <TrendingUp className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">Daily Rewards</h3>
                <p className="text-purple-100">Earn PRC reward points every day through our innovative engagement system</p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">Community Driven</h3>
                <p className="text-purple-100">Refer friends and earn bonus rewards for every active referral</p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
                  <Target className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">Real Rewards</h3>
                <p className="text-purple-100">Redeem for actual products and UPI cash withdrawals</p>
              </div>
            </div>
          </Card>

          {/* Core Values */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">What We Believe In</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-8 bg-white/90 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Heart className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Rewarding User Time</h3>
                    <p className="text-gray-600">
                      Your time is valuable. We believe in fairly rewarding every user for their active participation and engagement.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-8 bg-white/90 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Passive Earnings</h3>
                    <p className="text-gray-600">
                      Earn rewards without any investment. Simply be active daily and watch your rewards grow.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-8 bg-white/90 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Target className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">UPI Withdrawals</h3>
                    <p className="text-gray-600">
                      VIP users can withdraw earnings directly to their bank account via UPI in 48-72 hours.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-8 bg-white/90 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Shield className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Trust & Transparency</h3>
                    <p className="text-gray-600">
                      To connect users with real-world benefits through digital rewards with complete transparency.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Stats */}
          <Card className="p-10 bg-white/90 backdrop-blur-sm shadow-2xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Our Impact</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-5xl font-bold text-purple-600 mb-2">10,000+</div>
                <div className="text-gray-600 text-lg">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold text-pink-600 mb-2">₹50L+</div>
                <div className="text-gray-600 text-lg">Rewards Distributed</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold text-purple-600 mb-2">5000+</div>
                <div className="text-gray-600 text-lg">Products Available</div>
              </div>
            </div>
          </Card>

          {/* CTA */}
          <div className="text-center mt-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Join Our Community Today</h3>
            <p className="text-gray-600 mb-6">Start earning rewards and redeem for real products</p>
            <Link to="/register">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                Get Started Free
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AboutUs;
