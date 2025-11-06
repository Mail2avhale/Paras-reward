import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Trophy, Medal, Award, Crown } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Leaderboard = ({ user, onLogout }) => {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(`${API}/leaderboard`);
      // Limit to top 10 earners only
      const top10 = response.data.slice(0, 10);
      setLeaderboard(top10);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Crown className="h-8 w-8 text-yellow-500" />;
      case 2:
        return <Medal className="h-8 w-8 text-gray-400" />;
      case 3:
        return <Award className="h-8 w-8 text-orange-600" />;
      default:
        return <span className="text-2xl font-bold text-gray-600">#{rank}</span>;
    }
  };

  const getRankBgColor = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-orange-500';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-400';
      case 3:
        return 'bg-gradient-to-r from-orange-400 to-red-500';
      default:
        return 'bg-white';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4">
            <Trophy className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">Leaderboard</h1>
          <p className="text-lg text-gray-600">Top miners of the month</p>
        </div>

        {/* Top 3 */}
        {leaderboard.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* 2nd Place */}
            <Card data-testid="rank-2" className="bg-gradient-to-br from-gray-300 to-gray-400 p-8 rounded-3xl shadow-xl text-center transform md:translate-y-8">
              <div className="flex justify-center mb-4">
                <Medal className="h-16 w-16 text-white" />
              </div>
              <img
                src={leaderboard[1].profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(leaderboard[1].name)}`}
                alt={leaderboard[1].name}
                className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white"
              />
              <h3 className="text-xl font-bold text-white mb-2">{leaderboard[1].name}</h3>
              <p className="text-3xl font-bold text-white mb-1">{leaderboard[1].total_prc.toFixed(2)}</p>
              <p className="text-sm text-white opacity-90">PRC Mined</p>
              {leaderboard[1].is_vip && (
                <div className="mt-3">
                  <span className="inline-block px-3 py-1 bg-white/30 rounded-full text-xs font-semibold text-white">
                    VIP
                  </span>
                </div>
              )}
            </Card>

            {/* 1st Place */}
            <Card data-testid="rank-1" className="bg-gradient-to-br from-yellow-400 to-orange-500 p-8 rounded-3xl shadow-2xl text-center">
              <div className="flex justify-center mb-4">
                <Crown className="h-20 w-20 text-white" />
              </div>
              <img
                src={leaderboard[0].profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(leaderboard[0].name)}`}
                alt={leaderboard[0].name}
                className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white"
              />
              <h3 className="text-2xl font-bold text-white mb-2">{leaderboard[0].name}</h3>
              <p className="text-4xl font-bold text-white mb-1">{leaderboard[0].total_prc.toFixed(2)}</p>
              <p className="text-sm text-white opacity-90">PRC Mined</p>
              {leaderboard[0].is_vip && (
                <div className="mt-3">
                  <span className="inline-block px-3 py-1 bg-white/30 rounded-full text-xs font-semibold text-white">
                    VIP
                  </span>
                </div>
              )}
            </Card>

            {/* 3rd Place */}
            <Card data-testid="rank-3" className="bg-gradient-to-br from-orange-400 to-red-500 p-8 rounded-3xl shadow-xl text-center transform md:translate-y-8">
              <div className="flex justify-center mb-4">
                <Award className="h-16 w-16 text-white" />
              </div>
              <img
                src={leaderboard[2].profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(leaderboard[2].name)}`}
                alt={leaderboard[2].name}
                className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white"
              />
              <h3 className="text-xl font-bold text-white mb-2">{leaderboard[2].name}</h3>
              <p className="text-3xl font-bold text-white mb-1">{leaderboard[2].total_prc.toFixed(2)}</p>
              <p className="text-sm text-white opacity-90">PRC Mined</p>
              {leaderboard[2].is_vip && (
                <div className="mt-3">
                  <span className="inline-block px-3 py-1 bg-white/30 rounded-full text-xs font-semibold text-white">
                    VIP
                  </span>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Rest of Leaderboard */}
        <Card data-testid="leaderboard-list" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">All Rankings</h2>
          
          <div className="space-y-3">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.uid}
                data-testid={`leaderboard-entry-${index}`}
                className={`flex items-center justify-between p-4 rounded-xl ${getRankBgColor(entry.rank)} ${entry.rank <= 3 ? 'text-white' : 'bg-gray-50 hover:bg-gray-100'} transition-all`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center">
                    {getRankIcon(entry.rank)}
                  </div>
                  <img
                    src={entry.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name)}`}
                    alt={entry.name}
                    className="w-12 h-12 rounded-full border-2 border-white"
                  />
                  <div>
                    <p className={`font-bold ${entry.rank <= 3 ? 'text-white' : 'text-gray-900'}`}>
                      {entry.name}
                      {entry.is_vip && (
                        <span className="ml-2 text-xs px-2 py-1 bg-yellow-400 text-yellow-900 rounded-full font-semibold">
                          VIP
                        </span>
                      )}
                    </p>
                    <p className={`text-sm ${entry.rank <= 3 ? 'text-white opacity-90' : 'text-gray-500'}`}>
                      {entry.uid.substring(0, 8)}...
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${entry.rank <= 3 ? 'text-white' : 'text-gray-900'}`}>
                    {entry.total_prc.toFixed(2)}
                  </p>
                  <p className={`text-sm ${entry.rank <= 3 ? 'text-white opacity-90' : 'text-gray-500'}`}>
                    PRC
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Leaderboard;