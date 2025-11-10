import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Sparkles, Trophy, Gift, Star, TrendingUp, ArrowLeft, 
  Coins, Wallet, History, Crown, Ticket
} from 'lucide-react';
import WinCelebration from '../components/WinCelebration';
import AnimatedFeedback from '../components/AnimatedFeedback';

const API = process.env.REACT_APP_BACKEND_URL || '';

const ScratchCard = ({ user }) => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isScratching, setIsScratching] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null);
  const [animatedFeedback, setAnimatedFeedback] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchCards();
    fetchHistory();
  }, [user, navigate]);

  const fetchCards = async () => {
    try {
      const response = await axios.get(`${API}/api/scratch-cards/available`);
      setCards(response.data.cards);
    } catch (error) {
      console.error('Error fetching cards:', error);
      toast.error('Failed to load scratch cards');
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/api/scratch-cards/history/${user.uid}`);
      setHistory(response.data.history);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleSelectCard = (card) => {
    setSelectedCard(card);
    setIsScratching(false);
    setRevealed(false);
    setResult(null);
  };

  const handlePurchaseAndScratch = async () => {
    if (!selectedCard) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/scratch-cards/purchase`, {
        card_type: selectedCard.cost,
        uid: user.uid
      }, {
        params: { uid: user.uid }
      });

      setResult(response.data);
      setIsScratching(true);
      initializeCanvas(response.data);
      
    } catch (error) {
      console.error('Error purchasing card:', error);
      toast.error(error.response?.data?.detail || 'Failed to purchase scratch card');
      setSelectedCard(null);
    } finally {
      setLoading(false);
    }
  };

  const initializeCanvas = (resultData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Create realistic metallic scratch layer with gradient
    const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    gradient.addColorStop(0, '#c0c0c0');
    gradient.addColorStop(0.5, '#ffffff');
    gradient.addColorStop(1, '#a8a8a8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    // Add texture overlay for realistic metallic look
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < rect.width; i += 2) {
      for (let j = 0; j < rect.height; j += 2) {
        if (Math.random() > 0.5) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(i, j, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1.0;
    
    // Add shine effect
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const shineGradient = ctx.createLinearGradient(0, 0, rect.width, 0);
    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    shineGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    shineGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.8)');
    shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shineGradient;
    ctx.fillRect(rect.width * 0.2, 0, rect.width * 0.3, rect.height);
    ctx.restore();
    
    // Add branding with shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#9333ea';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💎 SCRATCH HERE 💎', rect.width / 2, rect.height / 2 - 20);
    
    ctx.font = '18px Arial';
    ctx.fillStyle = '#7c3aed';
    ctx.fillText('👆 Drag your finger to reveal', rect.width / 2, rect.height / 2 + 20);
    
    // Add sparkle indicators
    ctx.shadowBlur = 0;
    const sparkles = ['✨', '⭐', '💫'];
    sparkles.forEach((sparkle, i) => {
      ctx.font = '24px Arial';
      ctx.fillText(sparkle, rect.width / 4 + i * rect.width / 4, rect.height / 4);
      ctx.fillText(sparkle, rect.width / 4 + i * rect.width / 4, rect.height * 3 / 4);
    });

    canvas.style.cursor = 'grab';
  };

  const scratch = (x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Calculate position accounting for device pixel ratio
    const adjustedX = (x - rect.left) * dpr;
    const adjustedY = (y - rect.top) * dpr;

    // Use destination-out to make area transparent
    ctx.globalCompositeOperation = 'destination-out';
    
    // Create a larger, softer brush for more realistic scratching
    const gradient = ctx.createRadialGradient(adjustedX, adjustedY, 0, adjustedX, adjustedY, 40 * dpr);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(adjustedX, adjustedY, 40 * dpr, 0, 2 * Math.PI);
    ctx.fill();

    // Add scratch marks for texture (jagged edges)
    for (let i = 0; i < 3; i++) {
      const offsetX = (Math.random() - 0.5) * 20 * dpr;
      const offsetY = (Math.random() - 0.5) * 20 * dpr;
      ctx.beginPath();
      ctx.arc(adjustedX + offsetX, adjustedY + offsetY, 10 * dpr, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';

    // Check if enough scratched
    checkScratchPercentage(ctx, canvas);
  };

  const checkScratchPercentage = (ctx, canvas) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparent = 0;

    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparent++;
    }

    const percentage = (transparent / (pixels.length / 4)) * 100;
    
    if (percentage > 60 && !revealed && result) {
      setRevealed(true);
      canvas.style.display = 'none';
      
      console.log('Scratch card revealed! Result:', result);
      
      // Show quick feedback that scratching is complete
      setAnimatedFeedback({
        message: `🎊 Scratching Complete!\n✨ Check Your Prize! ✨`,
        type: 'info',
        duration: 2000
      });
      
      // Show big celebration after user sees the result (2.5 seconds)
      if (result.cashback_won_inr && result.cashback_percentage) {
        setTimeout(() => {
          setAnimatedFeedback(null); // Clear the "complete" message
          setCelebrationData({
            amount: result.cashback_won_inr,
            percentage: result.cashback_percentage,
            message: "YOU WON!"
          });
        }, 2500);
      }
      
      fetchHistory();
    }
  };

  const handleMouseDown = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'grabbing';
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'grab';
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    scratch(e.clientX, e.clientY);
  };

  const handleTouchStart = () => {
    setIsDrawing(true);
  };

  const handleTouchEnd = () => {
    setIsDrawing(false);
  };

  const handleTouchMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const touch = e.touches[0];
    scratch(touch.clientX, touch.clientY);
  };

  const getCardColor = (cost) => {
    if (cost === 10) return 'from-orange-400 to-orange-600';
    if (cost === 50) return 'from-gray-400 to-gray-600';
    return 'from-yellow-400 to-yellow-600';
  };

  const getCardIcon = (cost) => {
    if (cost === 10) return <Ticket className="h-16 w-16" />;
    if (cost === 50) return <Star className="h-16 w-16" />;
    return <Crown className="h-16 w-16" />;
  };

  const isVIP = user?.membership_type === 'vip';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="container mx-auto px-3 py-8 max-w-full lg:max-w-7xl xl:max-w-[90%]">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="text-right">
            <div className="text-sm text-gray-600">PRC Balance</div>
            <div className="text-2xl font-bold text-purple-600">{user?.prc_balance || 0} PRC</div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4 px-6 py-2 bg-purple-100 rounded-full">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <span className="text-purple-600 font-semibold">Scratch & Win Cashback!</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            PRC Scratch Cards
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Choose a card, scratch to reveal your cashback reward! 
            {isVIP ? ' 🌟 VIP Members win 10-50% cashback!' : ' Win 0-10% cashback!'}
          </p>
          <div className="mt-4 text-sm text-gray-500">
            Conversion Rate: <span className="font-bold text-purple-600">10 PRC = ₹1</span>
          </div>
        </div>

        {!selectedCard ? (
          <>
            {/* Card Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {cards.map((card) => (
                <Card
                  key={card.id}
                  className="relative overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:scale-105"
                  onClick={() => handleSelectCard(card)}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${getCardColor(card.cost)} opacity-10`} />
                  <div className="p-8 relative">
                    <div className={`flex justify-center mb-4 text-white p-6 rounded-full bg-gradient-to-br ${getCardColor(card.cost)}`}>
                      {getCardIcon(card.cost)}
                    </div>
                    <h3 className="text-2xl font-bold text-center mb-2">{card.name}</h3>
                    <div className="text-center mb-4">
                      <div className="text-4xl font-bold text-purple-600">{card.cost} PRC</div>
                      <div className="text-sm text-gray-500">= ₹{card.cost / 10}</div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center justify-center gap-2">
                        <Gift className="h-4 w-4" />
                        <span>{isVIP ? `Win ${card.min_cashback_vip}-${card.max_cashback_vip}%` : `Win ${card.min_cashback_free}-${card.max_cashback_free}%`}</span>
                      </div>
                      <div className="text-center text-xs text-gray-500">
                        {isVIP ? '⭐ VIP Rewards' : '🆓 Free User'}
                      </div>
                    </div>
                    <Button
                      className={`w-full mt-4 bg-gradient-to-r ${getCardColor(card.cost)} text-white`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCard(card);
                      }}
                    >
                      Select Card
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Statistics */}
            {stats && stats.total_cards_played > 0 && (
              <Card className="p-6 mb-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-purple-600" />
                  Your Statistics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">{stats.total_cards_played}</div>
                    <div className="text-sm text-gray-600">Cards Played</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">{stats.total_prc_spent}</div>
                    <div className="text-sm text-gray-600">PRC Spent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">₹{stats.total_cashback_won}</div>
                    <div className="text-sm text-gray-600">Total Won</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-pink-600">₹{stats.avg_cashback_per_card}</div>
                    <div className="text-sm text-gray-600">Avg per Card</div>
                  </div>
                </div>
              </Card>
            )}

            {/* Recent History */}
            {history.length > 0 && (
              <Card className="p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <History className="h-6 w-6 text-purple-600" />
                  Recent Plays
                </h3>
                <div className="space-y-2">
                  {history.slice(0, 5).map((item) => (
                    <div key={item.transaction_id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-semibold">{item.card_type} PRC Card</div>
                        <div className="text-xs text-gray-500">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">{item.cashback_percentage}%</div>
                        <div className="text-sm text-gray-600">₹{item.cashback_inr}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        ) : (
          /* Scratch Card Area */
          <div className="max-w-2xl mx-auto">
            <Card className="p-8">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold mb-2">{selectedCard.name}</h2>
                <p className="text-gray-600">Cost: {selectedCard.cost} PRC (₹{selectedCard.cost / 10})</p>
              </div>

              {!isScratching ? (
                <div className="space-y-4">
                  <div className={`p-12 rounded-2xl bg-gradient-to-br ${getCardColor(selectedCard.cost)} text-white text-center`}>
                    <div className="mb-4">{getCardIcon(selectedCard.cost)}</div>
                    <div className="text-2xl font-bold mb-4">Ready to Scratch?</div>
                    <div className="text-lg">
                      {isVIP ? `Win ${selectedCard.min_cashback_vip}-${selectedCard.max_cashback_vip}% Cashback!` 
                             : `Win ${selectedCard.min_cashback_free}-${selectedCard.max_cashback_free}% Cashback!`}
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedCard(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      onClick={handlePurchaseAndScratch}
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : `Buy & Scratch (${selectedCard.cost} PRC)`}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-2xl">
                  {/* Result behind canvas - Enhanced with animations */}
                  <div className={`p-12 rounded-2xl bg-gradient-to-br ${getCardColor(selectedCard.cost)} text-white text-center relative overflow-hidden`}>
                    {/* Animated background particles */}
                    <div className="absolute inset-0 opacity-20">
                      {[...Array(20)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-2 h-2 bg-white rounded-full animate-float"
                          style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 3}s`,
                            animationDuration: `${3 + Math.random() * 2}s`
                          }}
                        />
                      ))}
                    </div>
                    
                    {/* Pulsing glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                    
                    {/* Content */}
                    <div className="relative z-10">
                      <div className="animate-bounce mb-4">
                        <Trophy className="h-24 w-24 mx-auto drop-shadow-2xl" />
                      </div>
                      <div className="text-5xl font-black mb-3 drop-shadow-lg animate-pulse">
                        {result?.cashback_percentage}% CASHBACK!
                      </div>
                      <div className="text-3xl font-bold mb-4 drop-shadow-md">
                        🎉 You Won: ₹{result?.cashback_won_inr} 🎉
                      </div>
                      <div className="text-lg opacity-90 font-semibold">
                        💰 Added to your cashback wallet!
                      </div>
                      <div className="mt-4 flex justify-center gap-2">
                        <Sparkles className="h-6 w-6 animate-spin" />
                        <Gift className="h-6 w-6 animate-bounce" />
                        <Sparkles className="h-6 w-6 animate-spin" style={{ animationDirection: 'reverse' }} />
                      </div>
                    </div>
                  </div>

                  {/* Scratch Canvas Overlay */}
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full rounded-2xl shadow-inner"
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    style={{ touchAction: 'none' }}
                  />
                  
                  {/* Scratch indicator - shows progress */}
                  {!revealed && (
                    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                      Keep Scratching! 👆
                    </div>
                  )}
                </div>
              )}

              {revealed && (
                <div className="mt-6 space-y-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-600">New Balances</div>
                    <div className="flex justify-center gap-8 mt-2">
                      <div>
                        <div className="text-lg font-semibold text-purple-600">{result?.new_prc_balance} PRC</div>
                        <div className="text-xs text-gray-500">PRC Balance</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-green-600">₹{result?.new_cashback_wallet}</div>
                        <div className="text-xs text-gray-500">Cashback Wallet</div>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                    onClick={() => {
                      setSelectedCard(null);
                      setIsScratching(false);
                      setRevealed(false);
                      setResult(null);
                    }}
                  >
                    Play Again
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
      
      {/* Win Celebration Overlay */}
      {celebrationData && (
        <WinCelebration
          amount={celebrationData.amount}
          percentage={celebrationData.percentage}
          message={celebrationData.message}
          onClose={() => {
            setCelebrationData(null);
            setSelectedCard(null);
            setIsScratching(false);
            setRevealed(false);
            setResult(null);
          }}
          duration={6000}
        />
      )}
    </div>
  );
};

export default ScratchCard;
