import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Trophy, Map, Coins, Eye, MapPin, Clock, 
  Sparkles, Share2, Award, X, CheckCircle,
  AlertCircle, ChevronRight, Target, Gift
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TreasureHunt = ({ user }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hunts, setHunts] = useState([]);
  const [myProgress, setMyProgress] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [gameMap, setGameMap] = useState(null);
  const [showStartModal, setShowStartModal] = useState(null);
  const [showGameModal, setShowGameModal] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchData(user.uid);
  }, [user, navigate]);

  const fetchData = async (uid) => {
    try {
      setLoading(true);
      const [huntsRes, progressRes, leaderboardRes] = await Promise.all([
        axios.get(`${API}/treasure-hunts?uid=${uid}`),
        axios.get(`${API}/treasure-hunts/my-progress?uid=${uid}`),
        axios.get(`${API}/treasure-hunts/leaderboard?uid=${uid}`)
      ]);

      setHunts(huntsRes.data.hunts || []);
      setMyProgress(progressRes.data.progress || []);
      setLeaderboard(leaderboardRes.data.leaderboard || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ description: 'Failed to load treasure hunt data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const startHunt = async (huntId) => {
    try {
      const response = await axios.post(
        `${API}/treasure-hunts/start`,
        { hunt_id: huntId },
        { params: { uid: user.uid } }
      );

      toast({ description: `Started ${response.data.hunt_title}! PRC deducted: ${response.data.prc_spent}` });
      setShowStartModal(null);
      fetchData(user.uid);
    } catch (error) {
      toast({ description: error.response?.data?.detail || 'Failed to start hunt', variant: 'destructive' });
    }
  };

  const loadGameMap = async (progressId) => {
    try {
      const response = await axios.get(
        `${API}/treasure-hunts/game-map/${progressId}?uid=${user.uid}`
      );
      setGameMap(response.data);
      setActiveGame(progressId);
      setShowGameModal(true);
    } catch (error) {
      toast({ description: 'Failed to load game map', variant: 'destructive' });
    }
  };

  const buyClue = async (progressId, clueNumber) => {
    try {
      const response = await axios.post(
        `${API}/treasure-hunts/buy-clue`,
        { progress_id: progressId, clue_number: clueNumber },
        { params: { uid: user.uid } }
      );

      toast({ description: `Clue revealed! ${response.data.clue_text}` });
      loadGameMap(progressId);
      fetchData(user.uid);
    } catch (error) {
      toast({ description: error.response?.data?.detail || 'Failed to buy clue', variant: 'destructive' });
    }
  };

  const attemptFindTreasure = async (progressId, locationId) => {
    try {
      const response = await axios.post(
        `${API}/treasure-hunts/find-treasure`,
        { progress_id: progressId, location_id: locationId },
        { params: { uid: user.uid } }
      );

      if (response.data.found) {
        toast({ 
          description: `🎉 ${response.data.message}\n💰 Cashback Earned: ₹${response.data.cashback_earned}\nTotal PRC Spent: ${response.data.prc_spent_total}`
        });
        setShowGameModal(false);
        fetchData(user.uid);
      } else {
        toast({ description: response.data.message, variant: 'destructive' });
      }

      loadGameMap(progressId);
    } catch (error) {
      toast({ description: error.response?.data?.detail || 'Failed to check location', variant: 'destructive' });
    }
  };

  const shareTreasure = (hunt) => {
    const text = `🏆 I just found a treasure in PRC Treasure Hunt!\n\n${hunt.hunt_title}\nCashback Earned: ₹${hunt.cashback_earned}\n\nJoin the adventure: ${window.location.origin}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'PRC Treasure Hunt',
        text: text
      });
    } else {
      navigator.clipboard.writeText(text);
      toast({ description: 'Share text copied to clipboard!' });
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch(difficulty) {
      case 'easy': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'hard': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getDifficultyGradient = (difficulty) => {
    switch(difficulty) {
      case 'easy': return 'from-green-500 to-emerald-600';
      case 'medium': return 'from-yellow-500 to-orange-600';
      case 'hard': return 'from-red-500 to-rose-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading Treasure Hunt...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 pb-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Map className="h-12 w-12 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">PRC Treasure Hunt</h1>
          </div>
          <p className="text-blue-200 text-lg">Find hidden treasures and earn PRC + 25% cashback!</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-xs text-gray-300">Treasures Found</p>
                <p className="text-2xl font-bold text-white">{myProgress.filter(p => p.found).length}</p>
              </div>
            </div>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-4">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-xs text-gray-300">Active Hunts</p>
                <p className="text-2xl font-bold text-white">{myProgress.filter(p => !p.completed).length}</p>
              </div>
            </div>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-4">
            <div className="flex items-center gap-3">
              <Gift className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-xs text-gray-300">Total Cashback</p>
                <p className="text-2xl font-bold text-white">₹{myProgress.reduce((sum, p) => sum + (p.cashback_earned || 0), 0)}</p>
              </div>
            </div>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-4">
            <div className="flex items-center gap-3">
              <Coins className="h-8 w-8 text-purple-400" />
              <div>
                <p className="text-xs text-gray-300">PRC Spent</p>
                <p className="text-2xl font-bold text-white">{myProgress.reduce((sum, p) => sum + (p.prc_spent || 0), 0)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Available Hunts */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-yellow-400" />
            Available Treasure Hunts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {hunts.map((hunt) => (
              <Card key={hunt.hunt_id} className={`bg-gradient-to-br ${getDifficultyGradient(hunt.difficulty)} p-6 rounded-2xl border-2 border-white/20 hover:scale-105 transition-all`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`${getDifficultyColor(hunt.difficulty)} text-white text-xs font-bold px-3 py-1 rounded-full uppercase`}>
                    {hunt.difficulty}
                  </div>
                  <Clock className="h-5 w-5 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">{hunt.title}</h3>
                <p className="text-white/80 text-sm mb-4">{hunt.description}</p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-white">
                    <span className="text-sm">PRC Cost:</span>
                    <span className="font-bold">{hunt.prc_cost} PRC</span>
                  </div>
                  <div className="flex items-center justify-between text-white">
                    <span className="text-sm">Cashback Reward:</span>
                    <span className="font-bold text-green-200">₹{(hunt.prc_cost * hunt.cashback_percentage / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-white">
                    <span className="text-sm">Cashback Rate:</span>
                    <span className="font-bold">{hunt.cashback_percentage}%</span>
                  </div>
                  <div className="flex items-center justify-between text-white">
                    <span className="text-sm">Time Limit:</span>
                    <span className="font-bold">{hunt.time_limit_minutes} mins</span>
                  </div>
                </div>
                
                <Button
                  onClick={() => setShowStartModal(hunt)}
                  className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold"
                >
                  Start Hunt <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* My Active Hunts */}
        {myProgress.filter(p => !p.completed).length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Target className="h-6 w-6 text-green-400" />
              My Active Hunts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myProgress.filter(p => !p.completed).map((progress) => (
                <Card key={progress.progress_id} className="bg-white/10 backdrop-blur-xl border border-white/20 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{progress.hunt_title}</h3>
                      <p className="text-sm text-gray-300">{progress.difficulty}</p>
                    </div>
                    <div className={`${getDifficultyColor(progress.difficulty)} text-white text-xs font-bold px-2 py-1 rounded uppercase`}>
                      {progress.difficulty}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-white text-sm">
                      <span>Clues Revealed:</span>
                      <span className="font-bold">{progress.clues_revealed.length} / {progress.total_clues}</span>
                    </div>
                    <div className="flex items-center justify-between text-white text-sm">
                      <span>Attempts:</span>
                      <span className="font-bold">{progress.attempts}</span>
                    </div>
                    <div className="flex items-center justify-between text-white text-sm">
                      <span>PRC Spent:</span>
                      <span className="font-bold">{progress.prc_spent}</span>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => loadGameMap(progress.progress_id)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Continue Hunt
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Completed Hunts */}
        {myProgress.filter(p => p.found).length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Award className="h-6 w-6 text-yellow-400" />
              Completed Hunts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {myProgress.filter(p => p.found).map((progress) => (
                <Card key={progress.progress_id} className="bg-gradient-to-br from-yellow-500 to-orange-600 p-6 border-2 border-yellow-400">
                  <div className="flex items-center gap-3 mb-4">
                    <Trophy className="h-8 w-8 text-white" />
                    <div>
                      <h3 className="text-lg font-bold text-white">{progress.hunt_title}</h3>
                      <p className="text-xs text-white/80">Completed</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-white text-sm">
                      <span>Reward:</span>
                      <span className="font-bold">{progress.reward_prc} PRC</span>
                    </div>
                    <div className="flex items-center justify-between text-white text-sm">
                      <span>Cashback:</span>
                      <span className="font-bold text-green-200">₹{progress.cashback_earned}</span>
                    </div>
                    <div className="flex items-center justify-between text-white text-sm">
                      <span>Attempts:</span>
                      <span className="font-bold">{progress.attempts}</span>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => shareTreasure(progress)}
                    className="w-full bg-white hover:bg-gray-100 text-gray-900"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Achievement
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-400" />
            Top Treasure Hunters
          </h2>
          <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-6">
            <div className="space-y-3">
              {leaderboard.slice(0, 10).map((entry, index) => (
                <div key={entry.user_id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-yellow-400 text-gray-900' :
                      index === 1 ? 'bg-gray-300 text-gray-900' :
                      index === 2 ? 'bg-orange-400 text-gray-900' :
                      'bg-white/10 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{entry.name}</p>
                      <p className="text-xs text-gray-300">{entry.treasures_found} treasures found</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-400 font-bold">₹{entry.total_cashback_earned}</p>
                    <p className="text-xs text-gray-400">{entry.total_prc_spent} PRC spent</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Start Hunt Confirmation Modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-white p-6 rounded-2xl max-w-md w-full">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{showStartModal.title}</h3>
                <p className={`text-sm ${getDifficultyColor(showStartModal.difficulty)} text-white px-2 py-1 rounded inline-block mt-2`}>
                  {showStartModal.difficulty.toUpperCase()}
                </p>
              </div>
              <button onClick={() => setShowStartModal(null)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <p className="text-gray-600 mb-6">{showStartModal.description}</p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-900 mb-3">Hunt Details:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cost:</span>
                  <span className="font-bold text-gray-900">{showStartModal.prc_cost} PRC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Reward:</span>
                  <span className="font-bold text-green-600">{showStartModal.reward_prc} PRC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cashback:</span>
                  <span className="font-bold text-green-600">{showStartModal.cashback_percentage}% of PRC spent</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Clues:</span>
                  <span className="font-bold text-gray-900">{showStartModal.total_clues}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Clue Cost:</span>
                  <span className="font-bold text-gray-900">{showStartModal.clue_cost} PRC each</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time Limit:</span>
                  <span className="font-bold text-gray-900">{showStartModal.time_limit_minutes} minutes</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => setShowStartModal(null)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => startHunt(showStartModal.hunt_id)}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Start Hunt
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Game Map Modal */}
      {showGameModal && gameMap && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{gameMap.title}</h3>
                <p className="text-sm text-gray-600">Attempts: {gameMap.attempts}</p>
              </div>
              <button onClick={() => setShowGameModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Clues Section */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Clues ({gameMap.revealed_clues.length} / {gameMap.total_clues})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  {gameMap.revealed_clues.map((clue) => (
                    <div key={clue.number} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-900 mb-1">Clue #{clue.number}</p>
                      <p className="text-sm text-blue-800">{clue.text}</p>
                    </div>
                  ))}
                </div>
                
                {gameMap.revealed_clues.length < gameMap.total_clues && !gameMap.found && (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: gameMap.total_clues - gameMap.revealed_clues.length }).map((_, idx) => {
                      const nextClueNum = gameMap.revealed_clues.length + idx;
                      return (
                        <Button
                          key={nextClueNum}
                          onClick={() => buyClue(activeGame, nextClueNum)}
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Coins className="h-4 w-4 mr-1" />
                          Buy Clue #{nextClueNum + 1} ({gameMap.clue_cost} PRC)
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Treasure Map */}
              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  Treasure Map
                </h4>
                <div className="relative w-full aspect-square bg-gradient-to-br from-yellow-100 via-green-100 to-blue-100 rounded-lg border-4 border-yellow-600 overflow-hidden">
                  {/* Grid background */}
                  <div className="absolute inset-0 grid grid-cols-10 grid-rows-10 opacity-20">
                    {Array.from({ length: 100 }).map((_, idx) => (
                      <div key={idx} className="border border-gray-400"></div>
                    ))}
                  </div>
                  
                  {/* Treasure locations */}
                  {gameMap.locations.map((location) => (
                    <button
                      key={location.id}
                      onClick={() => !gameMap.found && attemptFindTreasure(activeGame, location.id)}
                      disabled={gameMap.found}
                      className={`absolute w-8 h-8 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all ${
                        gameMap.found && location.is_treasure
                          ? 'bg-yellow-400 scale-150 animate-pulse'
                          : 'bg-red-500 hover:scale-125 hover:bg-red-600'
                      } ${gameMap.found ? 'cursor-default' : 'cursor-pointer'}`}
                      style={{
                        left: `${location.x}%`,
                        top: `${location.y}%`
                      }}
                      title={gameMap.found && location.is_treasure ? location.message : `Location ${location.id}`}
                    >
                      {gameMap.found && location.is_treasure && (
                        <Trophy className="h-6 w-6 text-white absolute inset-0 m-auto" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center">
                  {gameMap.found ? '🎉 Treasure Found!' : 'Click on red dots to search for treasure'}
                </p>
              </div>
              
              {/* Found Message */}
              {gameMap.found && (
                <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-bold text-green-900">Congratulations!</p>
                      <p className="text-sm text-green-800">You found the treasure in {gameMap.attempts} attempts!</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TreasureHunt;
