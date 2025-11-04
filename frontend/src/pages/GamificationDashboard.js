import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { 
  Award, Trophy, Flame, TrendingUp, Users, DollarSign,
  Calendar, Gift, Star, Lock, CheckCircle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function GamificationDashboard({ user, onLogout }) {
  const [achievements, setAchievements] = useState([]);
  const [streak, setStreak] = useState(null);
  const [leaderboards, setLeaderboards] = useState({ miners: [], referrers: [], earners: [] });
  const [activeTab, setActiveTab] = useState('achievements');
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    fetchGamificationData();
  }, [user.uid]);

  const fetchGamificationData = async () => {
    setLoading(true);
    try {
      const [achievementsRes, streakRes, minersRes, referrersRes, earnersRes] = await Promise.all([
        axios.get(`${API}/achievements/${user.uid}`),
        axios.get(`${API}/streaks/${user.uid}`),
        axios.get(`${API}/leaderboard/miners?period=all_time&limit=10`),
        axios.get(`${API}/leaderboard/referrers?limit=10`),
        axios.get(`${API}/leaderboard/earners?limit=10`)
      ]);

      setAchievements(achievementsRes.data.achievements || []);
      setStreak(streakRes.data);
      setLeaderboards({
        miners: minersRes.data.leaderboard || [],
        referrers: referrersRes.data.leaderboard || [],
        earners: earnersRes.data.leaderboard || []
      });
    } catch (error) {
      console.error('Error fetching gamification data:', error);
      toast.error('Failed to load gamification data');
    } finally {
      setLoading(false);
    }
  };

  const handleDailyCheckin = async () => {
    setCheckingIn(true);
    try {
      const response = await axios.post(`${API}/streaks/${user.uid}/checkin`);
      const data = response.data;

      if (data.already_checked_in) {
        toast.info(data.message);
      } else {
        toast.success(`${data.message} +${data.reward_prc} PRC earned!`);
        setStreak(prev => ({
          ...prev,
          current_streak: data.current_streak
        }));
        
        // Refresh achievements in case streak milestones unlocked
        fetchGamificationData();
      }
    } catch (error) {
      console.error('Error checking in:', error);
      toast.error('Failed to check in');
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <Navbar user={user} onLogout={onLogout} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🎮 Gamification</h1>
          <p className="text-gray-600">Earn badges, climb leaderboards, and maintain streaks!</p>
        </div>

        {/* Streak Card */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-orange-500 to-red-500 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 rounded-full p-4">
                <Flame className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{streak?.current_streak || 0} Day Streak 🔥</h2>
                <p className="text-white/90">Longest: {streak?.longest_streak || 0} days</p>
              </div>
            </div>
            <Button
              onClick={handleDailyCheckin}
              disabled={checkingIn}
              className="bg-white text-orange-600 hover:bg-white/90"
            >
              {checkingIn ? 'Checking in...' : 'Daily Check-in'}
            </Button>
          </div>
        </Card>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm overflow-x-auto">
            <button
              onClick={() => setActiveTab('achievements')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === 'achievements'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Award className="w-4 h-4 inline mr-2" />
              Achievements
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === 'leaderboard'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Trophy className="w-4 h-4 inline mr-2" />
              Leaderboard
            </button>
            <button
              onClick={() => setActiveTab('streaks')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === 'streaks'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Streak Calendar
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'achievements' && (
          <div>
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Your Achievements</h2>
                <div className="text-sm text-gray-600">
                  {achievements.filter(a => a.unlocked).length} / {achievements.length} Unlocked
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {achievements.map((achievement) => (
                <Card
                  key={achievement.id}
                  className={`p-6 transition-all ${
                    achievement.unlocked
                      ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300'
                      : 'bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="text-center">
                    <div className={`text-6xl mb-4 ${achievement.unlocked ? '' : 'grayscale'}`}>
                      {achievement.unlocked ? achievement.icon : <Lock className="w-16 h-16 mx-auto text-gray-400" />}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{achievement.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{achievement.description}</p>
                    <div className="flex items-center justify-center gap-2">
                      <Gift className="w-4 h-4 text-purple-600" />
                      <span className="text-purple-600 font-semibold">{achievement.reward_prc} PRC</span>
                    </div>
                    {achievement.unlocked && achievement.unlocked_at && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          <span>Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Miners */}
            <Card className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Top Miners
              </h3>
              <div className="space-y-3">
                {leaderboards.miners.map((entry) => (
                  <div
                    key={entry.user_id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      entry.user_id === user.uid ? 'bg-purple-100' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${
                        entry.rank === 1 ? 'text-yellow-500' :
                        entry.rank === 2 ? 'text-gray-400' :
                        entry.rank === 3 ? 'text-orange-400' :
                        'text-gray-600'
                      }`}>
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{entry.name}</p>
                        <p className="text-xs text-gray-500">{entry.membership_type.toUpperCase()}</p>
                      </div>
                    </div>
                    <span className="font-bold text-purple-600">{entry.total_mined} PRC</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top Referrers */}
            <Card className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Top Referrers
              </h3>
              <div className="space-y-3">
                {leaderboards.referrers.map((entry) => (
                  <div
                    key={entry.user_id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      entry.user_id === user.uid ? 'bg-blue-100' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${
                        entry.rank === 1 ? 'text-yellow-500' :
                        entry.rank === 2 ? 'text-gray-400' :
                        entry.rank === 3 ? 'text-orange-400' :
                        'text-gray-600'
                      }`}>
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{entry.name}</p>
                        <p className="text-xs text-gray-500">{entry.membership_type.toUpperCase()}</p>
                      </div>
                    </div>
                    <span className="font-bold text-blue-600">{entry.total_referrals} refs</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top Earners */}
            <Card className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Top Earners
              </h3>
              <div className="space-y-3">
                {leaderboards.earners.map((entry) => (
                  <div
                    key={entry.user_id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      entry.user_id === user.uid ? 'bg-green-100' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${
                        entry.rank === 1 ? 'text-yellow-500' :
                        entry.rank === 2 ? 'text-gray-400' :
                        entry.rank === 3 ? 'text-orange-400' :
                        'text-gray-600'
                      }`}>
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{entry.name}</p>
                        <p className="text-xs text-gray-500">{entry.membership_type.toUpperCase()}</p>
                      </div>
                    </div>
                    <span className="font-bold text-green-600">₹{entry.cashback_balance}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'streaks' && (
          <Card className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Streak Calendar</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Current Streak</p>
                <p className="text-3xl font-bold text-orange-600">{streak?.current_streak || 0}</p>
                <p className="text-xs text-gray-500">days</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Longest Streak</p>
                <p className="text-3xl font-bold text-purple-600">{streak?.longest_streak || 0}</p>
                <p className="text-xs text-gray-500">days</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Check-ins</p>
                <p className="text-3xl font-bold text-blue-600">{streak?.total_checkins || 0}</p>
                <p className="text-xs text-gray-500">days</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Last Check-in</p>
                <p className="text-lg font-bold text-green-600">
                  {streak?.last_checkin ? new Date(streak.last_checkin).toLocaleDateString() : 'Never'}
                </p>
                <p className="text-xs text-gray-500">date</p>
              </div>
            </div>

            {/* Streak Rewards */}
            <div className="mt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Streak Rewards</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg border-2 ${
                  (streak?.current_streak || 0) >= 7 ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">
                      {(streak?.current_streak || 0) >= 7 ? '✅' : '🔒'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">7 Days</p>
                      <p className="text-sm text-gray-600">+50 PRC Bonus</p>
                    </div>
                  </div>
                </div>
                <div className={`p-4 rounded-lg border-2 ${
                  (streak?.current_streak || 0) >= 30 ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">
                      {(streak?.current_streak || 0) >= 30 ? '✅' : '🔒'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">30 Days</p>
                      <p className="text-sm text-gray-600">+200 PRC Bonus</p>
                    </div>
                  </div>
                </div>
                <div className={`p-4 rounded-lg border-2 ${
                  (streak?.current_streak || 0) >= 100 ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">
                      {(streak?.current_streak || 0) >= 100 ? '✅' : '🔒'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">100 Days</p>
                      <p className="text-sm text-gray-600">+1000 PRC Bonus</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export default GamificationDashboard;
