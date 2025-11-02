import { Link } from 'react-router-dom';
import { 
  Coins, Users, Trophy, Sparkles, Zap, Gift, Shield, 
  TrendingUp, Clock, Gamepad2, Store, Wallet, Award,
  CheckCircle, ArrowRight, Star, Target, Gem, ChevronRight,
  Settings, User
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
            <span className="text-purple-600 font-semibold">India's #1 Reward Points Platform</span>
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            Earn Reward Points Daily
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 animate-gradient">
              Redeem Real Products
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Join thousands of users earning PARAS Reward Coins (PRC) through daily activities, 
            playing games, and referring friends. Redeem your reward points for real products!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/register">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-10 py-7 text-lg rounded-2xl shadow-2xl hover:shadow-purple-300/50 transition-all duration-300 hover:scale-105"
              >
                Start Earning Free
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">Daily Rewards</h3>
              <p className="text-gray-600 mb-4">
                Earn PRC reward points every 24 hours with dynamic rewards based on your activity
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
                Invite friends and get 10% bonus on their reward rate (up to 200 referrals)
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
                Redeem your PRC reward points for real products from 5000+ items
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

      {/* How It Works */}
      <div className="bg-white/50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Start earning in 3 simple steps
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="relative">
                <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-xl text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                    1
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Sign Up Free</h3>
                  <p className="text-gray-600">
                    Create your account in minutes with just your email and mobile number
                  </p>
                </div>
                <div className="hidden md:block absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
                  <ChevronRight className="h-8 w-8 text-purple-400" />
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-xl text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                    2
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Start Mining</h3>
                  <p className="text-gray-600">
                    Mine daily, play games, and refer friends to earn PRC coins
                  </p>
                </div>
                <div className="hidden md:block absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
                  <ChevronRight className="h-8 w-8 text-purple-400" />
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-xl text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                  3
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Redeem Rewards</h3>
                <p className="text-gray-600">
                  Shop from 5000+ products and redeem with your earned PRC coins
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Why Choose PARAS REWARD?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            The most rewarding platform in India
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <div className="flex gap-4 items-start bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">100% Free to Join</h3>
              <p className="text-gray-600">No registration fees, no hidden charges</p>
            </div>
          </div>

          <div className="flex gap-4 items-start bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Daily Rewards</h3>
              <p className="text-gray-600">Mine coins every day with increasing rewards</p>
            </div>
          </div>

          <div className="flex gap-4 items-start bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Real Products</h3>
              <p className="text-gray-600">Redeem from thousands of genuine products</p>
            </div>
          </div>

          <div className="flex gap-4 items-start bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-pink-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Cashback System</h3>
              <p className="text-gray-600">Get 25% cashback on every purchase</p>
            </div>
          </div>

          <div className="flex gap-4 items-start bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Secure Platform</h3>
              <p className="text-gray-600">KYC verified, safe and trusted</p>
            </div>
          </div>

          <div className="flex gap-4 items-start bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">24/7 Support</h3>
              <p className="text-gray-600">Always here to help you succeed</p>
            </div>
          </div>
        </div>
      </div>

      {/* All Pages Quick Links */}
      <div className="bg-gradient-to-br from-purple-600 to-pink-600 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Explore All Features
            </h2>
            <p className="text-xl text-white/90">
              Quick access to all pages
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
            <Link to="/dashboard" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-4 rounded-xl text-center transition-all hover:scale-105">
              <Target className="h-8 w-8 text-white mx-auto mb-2" />
              <div className="text-white font-medium">Dashboard</div>
            </Link>
            <Link to="/mining" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-4 rounded-xl text-center transition-all hover:scale-105">
              <Coins className="h-8 w-8 text-white mx-auto mb-2" />
              <div className="text-white font-medium">Mining</div>
            </Link>
            <Link to="/game" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-4 rounded-xl text-center transition-all hover:scale-105">
              <Gamepad2 className="h-8 w-8 text-white mx-auto mb-2" />
              <div className="text-white font-medium">Tap Game</div>
            </Link>
            <Link to="/referrals" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-4 rounded-xl text-center transition-all hover:scale-105">
              <Users className="h-8 w-8 text-white mx-auto mb-2" />
              <div className="text-white font-medium">Referrals</div>
            </Link>
            <Link to="/marketplace" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-4 rounded-xl text-center transition-all hover:scale-105">
              <Store className="h-8 w-8 text-white mx-auto mb-2" />
              <div className="text-white font-medium">Marketplace</div>
            </Link>
            <Link to="/vip" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-4 rounded-xl text-center transition-all hover:scale-105">
              <Trophy className="h-8 w-8 text-white mx-auto mb-2" />
              <div className="text-white font-medium">VIP</div>
            </Link>
            <Link to="/wallet" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-4 rounded-xl text-center transition-all hover:scale-105">
              <Wallet className="h-8 w-8 text-white mx-auto mb-2" />
              <div className="text-white font-medium">Wallet</div>
            </Link>
            <Link to="/kyc" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-4 rounded-xl text-center transition-all hover:scale-105">
              <Shield className="h-8 w-8 text-white mx-auto mb-2" />
              <div className="text-white font-medium">KYC</div>
            </Link>
            <Link to="/orders" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-4 rounded-xl text-center transition-all hover:scale-105">
              <Gift className="h-8 w-8 text-white mx-auto mb-2" />
              <div className="text-white font-medium">Orders</div>
            </Link>
            <Link to="/leaderboard" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-4 rounded-xl text-center transition-all hover:scale-105">
              <Award className="h-8 w-8 text-white mx-auto mb-2" />
              <div className="text-white font-medium">Leaderboard</div>
            </Link>
            <Link to="/profile" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-4 rounded-xl text-center transition-all hover:scale-105">
              <User className="h-8 w-8 text-white mx-auto mb-2" />
              <div className="text-white font-medium">Profile</div>
            </Link>
            <Link to="/setup" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 p-4 rounded-xl text-center transition-all hover:scale-105">
              <Settings className="h-8 w-8 text-white mx-auto mb-2" />
              <div className="text-white font-medium">Setup</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl p-12 text-center text-white shadow-2xl">
          <h2 className="text-3xl sm:text-5xl font-bold mb-4">Ready to Start Earning?</h2>
          <p className="text-lg sm:text-xl mb-8 opacity-90">Join thousands of users already mining PRC rewards daily</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 px-10 py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all">
                Create Free Account
                <Sparkles className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/about">
              <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/10 px-10 py-6 text-lg rounded-full">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-bold mb-4">PARAS REWARD</h3>
              <p className="text-gray-400">India's leading reward mining platform</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-gray-400 hover:text-white transition-colors">About Us</Link></li>
                <li><Link to="/contact" className="text-gray-400 hover:text-white transition-colors">Contact Us</Link></li>
                <li><Link to="/terms" className="text-gray-400 hover:text-white transition-colors">Terms & Conditions</Link></li>
                <li><Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Features</h4>
              <ul className="space-y-2">
                <li><Link to="/mining" className="text-gray-400 hover:text-white transition-colors">Mining</Link></li>
                <li><Link to="/game" className="text-gray-400 hover:text-white transition-colors">Tap Game</Link></li>
                <li><Link to="/referrals" className="text-gray-400 hover:text-white transition-colors">Referrals</Link></li>
                <li><Link to="/marketplace" className="text-gray-400 hover:text-white transition-colors">Marketplace</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Account</h4>
              <ul className="space-y-2">
                <li><Link to="/login" className="text-gray-400 hover:text-white transition-colors">Login</Link></li>
                <li><Link to="/register" className="text-gray-400 hover:text-white transition-colors">Register</Link></li>
                <li><Link to="/vip" className="text-gray-400 hover:text-white transition-colors">VIP Membership</Link></li>
                <li><Link to="/kyc" className="text-gray-400 hover:text-white transition-colors">KYC Verification</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2025 PARAS REWARD. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;