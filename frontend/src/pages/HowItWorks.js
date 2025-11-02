import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, CheckCircle2, Star, Gift, Users, Zap, Crown } from 'lucide-react';

const HowItWorks = () => {
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
          
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl mb-6 shadow-2xl">
              <Play className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">How PARAS REWARD Works</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              A simple 3-step process to start earning rewards daily
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <Card className="p-8 text-center bg-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-6 text-white text-3xl font-bold shadow-lg">
                1
              </div>
              <Users className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Sign Up Free</h3>
              <p className="text-gray-600 leading-relaxed">
                Create your account in 60 seconds using just your email and mobile number. No payment required.
              </p>
            </Card>

            <Card className="p-8 text-center bg-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6 text-white text-3xl font-bold shadow-lg">
                2
              </div>
              <Zap className="h-12 w-12 text-pink-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Earn PRC Points</h3>
              <p className="text-gray-600 leading-relaxed">
                Complete daily activities, play games, and refer friends to earn PRC reward points every day.
              </p>
            </Card>

            <Card className="p-8 text-center bg-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto mb-6 text-white text-3xl font-bold shadow-lg">
                3
              </div>
              <Gift className="h-12 w-12 text-orange-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Redeem Rewards</h3>
              <p className="text-gray-600 leading-relaxed">
                Exchange your PRC points for real products, cash withdrawals, or exclusive offers.
              </p>
            </Card>
          </div>

          {/* Earning Methods */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Ways to Earn PRC Points</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 bg-white shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Zap className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Daily Rewards</h3>
                    <p className="text-gray-600">
                      Start a 24-hour reward session and earn PRC points automatically based on your activity level and referrals.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Play className="h-6 w-6 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Tap Game</h3>
                    <p className="text-gray-600">
                      Play the daily tap game and earn up to 100 PRC points per day. Simple tap mechanics, instant rewards.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Refer Friends</h3>
                    <p className="text-gray-600">
                      Get 10% bonus on your friend's earning rate. Invite up to 200 friends and multiply your rewards.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Star className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Daily Tasks</h3>
                    <p className="text-gray-600">
                      Complete simple daily tasks and challenges to earn bonus PRC points and special rewards.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* VIP Benefits */}
          <Card className="p-10 bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-2xl mb-12">
            <div className="text-center mb-8">
              <Crown className="h-16 w-16 text-yellow-300 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-4">Unlock VIP Benefits</h2>
              <p className="text-xl text-purple-100">
                Upgrade to VIP for just ₹1000/year and unlock unlimited potential
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                'Unlimited PRC validity - Never expire',
                'Instant UPI withdrawals',
                'Higher earning rates',
                'Priority customer support',
                'Exclusive product access',
                'No withdrawal limits'
              ].map((benefit, index) => (
                <div key={index} className="flex items-center gap-3 bg-white/10 backdrop-blur-xl rounded-lg p-4">
                  <CheckCircle2 className="h-6 w-6 text-yellow-300 flex-shrink-0" />
                  <span className="text-white font-medium">{benefit}</span>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to="/vip">
                <Button className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-6 text-lg rounded-xl shadow-xl">
                  Upgrade to VIP Now
                </Button>
              </Link>
            </div>
          </Card>

          {/* CTA */}
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Start Earning?</h3>
            <p className="text-gray-600 mb-6">Join 10,000+ users already earning daily rewards</p>
            <Link to="/register">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg rounded-xl shadow-xl">
                Create Free Account
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
