import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Trophy, Medal, Award, Crown, ArrowLeft, TrendingUp, Users } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Leaderboard = ({ user }) => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/leaderboard`);
      const top10 = response.data.slice(0, 10);
      setLeaderboard(top10);
      
      // Find user's rank
      if (user?.uid) {
        const fullList = response.data;
        const userIndex = fullList.findIndex(u => u.uid === user.uid);
        if (userIndex !== -1) {
          setUserRank({
            rank: userIndex + 1,
            ...fullList[userIndex]
          });
        }
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankDisplay = (rank) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Crown className="h-6 w-6 text-white" />
          </div>
        );
      case 2:
        return (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center">
            <Medal className="h-6 w-6 text-white" />
          </div>
        );
      case 3:
        return (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <Award className="h-6 w-6 text-white" />
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
            <span className="text-lg font-bold text-gray-400">#{rank}</span>
          </div>
        );
    }
  };

  const getRankBorder = (rank) => {
    switch (rank) {
      case 1:
        return 'border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-transparent';
      case 2:
        return 'border-gray-400/50 bg-gradient-to-r from-gray-400/10 to-transparent';
      case 3:
        return 'border-orange-500/50 bg-gradient-to-r from-orange-500/10 to-transparent';
      default:
        return 'border-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">Leaderboard</h1>
            <p className="text-gray-500 text-sm">Top 10 Earners</p>
          </div>
        </div>
      </div>

      {/* Trophy Header */}
      <div className="px-5 mb-6">
        <div className="relative overflow-hidden rounded-3xl p-6 text-center" style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
        }}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-2xl" />
          
          <div className="relative">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Top Earners</h2>
            <p className="text-gray-400 text-sm">Compete and climb the ranks!</p>
          </div>
        </div>
      </div>

      {/* User's Rank (if not in top 10) */}
      {userRank && userRank.rank > 10 && (
        <div className="px-5 mb-4">
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-amber-400 font-semibold">Your Rank</p>
                  <p className="text-white text-lg font-bold">#{userRank.rank}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-xs">Total Mined</p>
                <p className="text-amber-500 font-bold">{userRank.total_mined?.toFixed(2) || 0} PRC</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      <div className="px-5">
        <div className="space-y-3">
          {leaderboard.map((entry, index) => {
            const rank = index + 1;
            const isCurrentUser = user?.uid === entry.uid;
            
            return (
              <div
                key={entry.uid || index}
                className={`rounded-xl p-4 border transition-all ${getRankBorder(rank)} ${isCurrentUser ? 'ring-2 ring-amber-500' : ''}`}
              >
                <div className="flex items-center gap-4">
                  {getRankDisplay(rank)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold truncate ${rank <= 3 ? 'text-white' : 'text-gray-300'}`}>
                        {entry.name || 'Anonymous'}
                      </p>
                      {isCurrentUser && (
                        <span className="px-2 py-0.5 bg-amber-500 text-gray-900 text-xs font-bold rounded-full">
                          YOU
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm">
                      {entry.membership_type === 'vip' ? '👑 VIP Member' : 'Free Member'}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`font-bold ${rank === 1 ? 'text-amber-400 text-lg' : rank <= 3 ? 'text-white' : 'text-gray-400'}`}>
                      {(entry.total_mined || 0).toFixed(2)}
                    </p>
                    <p className="text-gray-600 text-xs">PRC Mined</p>
                  </div>
                </div>
              </div>
            );
          })}

          {leaderboard.length === 0 && (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 mx-auto text-gray-700 mb-4" />
              <p className="text-gray-500">No data available yet</p>
              <p className="text-gray-600 text-sm">Start mining to appear on the leaderboard!</p>
            </div>
          )}
        </div>
      </div>

      {/* Motivation Card */}
      <div className="px-5 mt-6">
        <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 rounded-2xl p-5 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-emerald-400 font-semibold">Keep Mining!</p>
              <p className="text-gray-400 text-sm">Active daily to climb the ranks</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
