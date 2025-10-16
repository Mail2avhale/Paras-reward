import { Link } from 'react-router-dom';
import { Coins, Users, Trophy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-block mb-6 px-6 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg">
            <span className="text-purple-600 font-semibold">Welcome to PARAS APP</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            Mine, Earn & Redeem
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">PRC Rewards</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Start mining PARAS Reward Coins daily, play tap games, invite friends, and redeem amazing products from our marketplace.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login">
              <Button data-testid="get-started-btn" size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300">
                Get Started
                <Sparkles className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-6xl mx-auto">
          <div data-testid="feature-mining" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6">
              <Coins className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Daily Mining</h3>
            <p className="text-gray-600">
              Mine PRC coins every day with our dynamic formula. The more you engage, the more you earn!
            </p>
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