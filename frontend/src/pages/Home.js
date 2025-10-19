import { Link } from 'react-router-dom';
import { 
  Coins, Users, Trophy, Sparkles, Zap, Gift, Shield, 
  TrendingUp, Clock, Gamepad2, Store, Wallet, Award,
  CheckCircle, ArrowRight, Star, Target, Gem, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-sm shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                <Gem className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">PARAS REWARD</span>
            </Link>
            <div className="flex gap-3">
              <Link to="/login">
                <Button variant="ghost" className="text-gray-700 hover:text-purple-600">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-6 px-6 py-3 bg-white/90 backdrop-blur-sm rounded-full shadow-xl">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            <span className="text-purple-600 font-semibold">India's #1 Reward Mining Platform</span>
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            Mine Daily, Earn More
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 animate-gradient">
              Redeem Real Products
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Join thousands of users earning PARAS Reward Coins (PRC) through daily mining, 
            playing games, and referring friends. Convert your efforts into real products!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/register">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-10 py-7 text-lg rounded-2xl shadow-2xl hover:shadow-purple-300/50 transition-all duration-300 hover:scale-105"
              >
                Start Mining Free
                <Zap className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/about">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-2 border-purple-600 text-purple-600 hover:bg-purple-50 px-10 py-7 text-lg rounded-2xl shadow-xl transition-all duration-300"
              >
                Learn More
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl">
              <div className="text-3xl font-bold text-purple-600">10,000+</div>
              <div className="text-gray-600 mt-1">Active Users</div>
            </div>
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl">
              <div className="text-3xl font-bold text-pink-600">₹50L+</div>
              <div className="text-gray-600 mt-1">Rewards Given</div>
            </div>
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl">
              <div className="text-3xl font-bold text-purple-600">5000+</div>
              <div className="text-gray-600 mt-1">Products</div>
            </div>
          </div>
        </div>
      </div>

        {/* Key Features */}
        <div className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to earn and redeem rewards in one platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {/* Feature 1 */}
            <Card className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-purple-200">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4">
                <Coins className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Daily Mining</h3>
              <p className="text-gray-600 mb-4">
                Mine PRC coins every 24 hours with dynamic rewards based on your activity
              </p>
              <Link to="/mining" className="text-purple-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                Learn More <ChevronRight className="h-4 w-4" />
              </Link>
            </Card>

            {/* Feature 2 */}
            <Card className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-purple-200">
              <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-orange-500 rounded-2xl flex items-center justify-center mb-4">
                <Gamepad2 className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tap Game</h3>
              <p className="text-gray-600 mb-4">
                Play our engaging tap game daily and earn up to 100 PRC coins
              </p>
              <Link to="/game" className="text-purple-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                Play Now <ChevronRight className="h-4 w-4" />
              </Link>
            </Card>

            {/* Feature 3 */}
            <Card className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-purple-200">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4">
                <Users className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Referral System</h3>
              <p className="text-gray-600 mb-4">
                Invite friends and get 10% bonus on their mining rate (up to 200 referrals)
              </p>
              <Link to="/referrals" className="text-purple-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                Start Referring <ChevronRight className="h-4 w-4" />
              </Link>
            </Card>

            {/* Feature 4 */}
            <Card className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-purple-200">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-4">
                <Store className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Marketplace</h3>
              <p className="text-gray-600 mb-4">
                Redeem your PRC coins for real products from 5000+ items
              </p>
              <Link to="/marketplace" className="text-purple-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                Browse Products <ChevronRight className="h-4 w-4" />
              </Link>
            </Card>

            {/* Feature 5 */}
            <Card className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-purple-200">
              <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-2xl flex items-center justify-center mb-4">
                <Trophy className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">VIP Membership</h3>
              <p className="text-gray-600 mb-4">
                Unlock unlimited coin validity and exclusive benefits for just ₹1000/year
              </p>
              <Link to="/vip" className="text-purple-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                Go VIP <ChevronRight className="h-4 w-4" />
              </Link>
            </Card>

            {/* Feature 6 */}
            <Card className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-purple-200">
              <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4">
                <Wallet className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Cashback Wallet</h3>
              <p className="text-gray-600 mb-4">
                Get 25% cashback on every purchase, withdraw anytime with ₹10 minimum
              </p>
              <Link to="/wallet" className="text-purple-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                View Wallet <ChevronRight className="h-4 w-4" />
              </Link>
            </Card>

            {/* Feature 7 */}
            <Card className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-purple-200">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">KYC Verification</h3>
              <p className="text-gray-600 mb-4">
                Secure your account with Aadhaar and PAN verification
              </p>
              <Link to="/kyc" className="text-purple-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                Verify Now <ChevronRight className="h-4 w-4" />
              </Link>
            </Card>

            {/* Feature 8 */}
            <Card className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-purple-200">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center mb-4">
                <Award className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Leaderboard</h3>
              <p className="text-gray-600 mb-4">
                Compete with others and climb the ranks to win exclusive rewards
              </p>
              <Link to="/leaderboard" className="text-purple-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                View Rankings <ChevronRight className="h-4 w-4" />
              </Link>
            </Card>
          </div>
        </div>

          <div data-testid="feature-referral" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mb-6">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Referral Bonus</h3>
            <p className="text-gray-600">
              Invite friends and get +10% bonus per active referral. Build your network and earn more!
            </p>
          </div>

          <div data-testid="feature-leaderboard" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-orange-500 rounded-2xl flex items-center justify-center mb-6">
              <Trophy className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Leaderboard</h3>
            <p className="text-gray-600">
              Compete with others and climb the leaderboard. Top miners get exclusive rewards!
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl p-12 text-center text-white shadow-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Start Mining?</h2>
          <p className="text-lg mb-8 opacity-90">Join thousands of users already earning PRC rewards</p>
          <Link to="/login">
            <Button data-testid="join-now-btn" size="lg" className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300">
              Join Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;