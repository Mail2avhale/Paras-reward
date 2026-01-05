import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Hand, Zap, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Tap Game translations
const tapGameTranslations = {
  tapToEarn: { mr: "टॅप करा आणि कमवा", hi: "टैप करें और कमाएं", en: "Tap to Earn" },
  tapsToday: { mr: "आजचे टॅप्स", hi: "आज के टैप", en: "Taps Today" },
  remaining: { mr: "बाकी", hi: "शेष", en: "Remaining" },
  tapTheButton: { mr: "बटण टॅप करा!", hi: "बटन टैप करें!", en: "Tap the Button!" },
  tapFast: { mr: "वेगाने टॅप करा आणि PRC कमवा", hi: "तेजी से टैप करें और PRC कमाएं", en: "Tap fast and earn PRC" },
  howToPlay: { mr: "कसे खेळायचे", hi: "कैसे खेलें", en: "How to Play" },
  tapButtonBelow: { mr: "खालील बटणावर टॅप करा", hi: "नीचे बटन पर टैप करें", en: "Tap the button below" },
  earnPRCPerTap: { mr: "प्रत्येक टॅपवर PRC मिळवा", hi: "हर टैप पर PRC पाएं", en: "Earn PRC per tap" },
  dailyLimit: { mr: "दररोज 100 टॅप्स", hi: "रोज 100 टैप", en: "100 taps per day" },
  dailyLimitReached: { mr: "दैनिक टॅप मर्यादा पूर्ण!", hi: "दैनिक टैप सीमा पूर्ण!", en: "Daily tap limit reached!" },
  prcAdded: { mr: "PRC जोडले!", hi: "PRC जोड़ा गया!", en: "PRC added!" }
};

const TapGame = ({ user, onLogout }) => {
  const { language } = useLanguage();
  
  // Local translation function
  const t = (key) => {
    const translation = tapGameTranslations[key];
    if (!translation) return key;
    return translation[language] || translation['en'] || key;
  };
  
  const [taps, setTaps] = useState(0);
  const [remainingTaps, setRemainingTaps] = useState(100);
  const [animating, setAnimating] = useState(false);

  const handleTap = async () => {
    if (remainingTaps <= 0) {
      toast.error(t('dailyLimitReached'));
      return;
    }

    setTaps(taps + 1);
    setRemainingTaps(remainingTaps - 1);
    setAnimating(true);

    setTimeout(() => setAnimating(false), 100);

    // Send tap to backend every 10 taps or when reaching 0
    if ((taps + 1) % 10 === 0 || remainingTaps - 1 === 0) {
      try {
        const tapsToSend = (taps + 1) % 10 === 0 ? 10 : (taps + 1);
        const response = await axios.post(`${API}/game/tap/${user.uid}`, {
          taps: tapsToSend
        });
        setRemainingTaps(response.data.remaining_taps);
        toast.success(`+${response.data.prc_earned} ${t('prcAdded')}`);
        if (response.data.remaining_taps === 0) {
          toast.success(`🎉 ${language === 'mr' ? 'पूर्ण! आज तुम्ही' : language === 'hi' ? 'पूर्ण! आज आपने' : 'Completed! You earned'} ${response.data.prc_earned} PRC ${language === 'mr' ? 'कमावले!' : language === 'hi' ? 'कमाया!' : 'today!'}`, { duration: 5000 });
        }
        setTaps(0); // Reset local counter
      } catch (error) {
        console.error('Error submitting taps:', error);
        toast.error(error.response?.data?.detail || 'Failed to submit taps');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pt-20 pb-24">
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8 text-center">{t('tapToEarn')}</h1>

        {/* Tap Counter */}
        <Card data-testid="tap-counter-card" className="bg-gradient-to-br from-blue-600 to-purple-600 text-white p-8 rounded-3xl shadow-2xl mb-8">
          <div className="text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">{t('tapsToday')}</h2>
            <p className="text-6xl font-bold mb-4">{100 - remainingTaps}</p>
            <p className="text-lg opacity-90">Remaining: {remainingTaps}/100</p>
          </div>
        </Card>

        {/* Tap Button */}
        <div className="text-center mb-8">
          <button
            data-testid="tap-button"
            onClick={handleTap}
            disabled={remainingTaps <= 0}
            className={`relative inline-flex items-center justify-center w-64 h-64 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-200 ${
              animating ? 'scale-95' : 'scale-100 hover:scale-105'
            } ${remainingTaps <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} tap-effect`}
          >
            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping"></div>
            <Hand className="h-32 w-32 text-white relative z-10" />
          </button>
          
          <p className="text-2xl font-bold text-gray-900 mt-6">Tap the Button!</p>
          <p className="text-gray-600 mt-2">Each tap = 1 PRC</p>
        </div>

        {/* Game Info */}
        <Card data-testid="game-info" className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Zap className="h-6 w-6 text-purple-600 mr-2" />
            How to Play
          </h3>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-purple-100 rounded-full flex-shrink-0 mr-3 flex items-center justify-center text-purple-600 font-semibold text-sm">1</span>
              <span>Tap the button above to earn PRC coins instantly</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-purple-100 rounded-full flex-shrink-0 mr-3 flex items-center justify-center text-purple-600 font-semibold text-sm">2</span>
              <span>You can tap up to 100 times per day</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-purple-100 rounded-full flex-shrink-0 mr-3 flex items-center justify-center text-purple-600 font-semibold text-sm">3</span>
              <span>Each tap gives you 1 PRC (1 PRC = ₹0.10)</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-purple-100 rounded-full flex-shrink-0 mr-3 flex items-center justify-center text-purple-600 font-semibold text-sm">4</span>
              <span>Come back daily to earn more PRC through tapping</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default TapGame;