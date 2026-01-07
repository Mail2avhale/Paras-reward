import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, Bot, Sparkles, Send, Loader2 } from 'lucide-react';
import axios from 'axios';
import { Button } from '@/components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Predefined contextual help for different features
const CONTEXT_HELP = {
  mining: {
    title: 'Mining कसे करायचे?',
    icon: '⛏️',
    quickTips: [
      '🔵 "Start Mining" button वर tap करा',
      '⏰ 8 तासापर्यंत continuous mining',
      '💰 दर सेकंदाला PRC coins मिळतात',
      '👑 VIP members ला 2x speed मिळतो'
    ],
    aiPrompt: 'Mining feature बद्दल सविस्तर माहिती सांग. Mining कसे सुरू करायचे, किती वेळ mining होते, आणि earnings कसे वाढवायचे.'
  },
  marketplace: {
    title: 'Marketplace कसे वापरायचे?',
    icon: '🛒',
    quickTips: [
      '🔍 Products browse करा',
      '💰 PRC coins ने redeem करा',
      '🚚 Free delivery available',
      '⭐ VIP exclusive deals'
    ],
    aiPrompt: 'Marketplace feature बद्दल सांग. Products कसे redeem करायचे, minimum PRC किती लागतात, delivery कशी होते.'
  },
  referral: {
    title: 'Referral System कसे काम करते?',
    icon: '👥',
    quickTips: [
      '🔗 Share your referral link',
      '💰 Level 1: 100 PRC per referral',
      '📊 5 levels deep earnings',
      '🎯 Active referrals = Full bonus'
    ],
    aiPrompt: 'Referral system बद्दल explain कर. 5 level bonus structure, active vs inactive bonus, आणि fraud detection बद्दल सांग.'
  },
  vip: {
    title: 'VIP Membership चे फायदे?',
    icon: '👑',
    quickTips: [
      '⚡ 2x Mining speed',
      '🎁 Exclusive rewards',
      '💎 Priority support',
      '🛒 Special marketplace deals'
    ],
    aiPrompt: 'VIP membership चे सर्व benefits सांग. Cost किती आहे, कसे upgrade करायचे, आणि VIP exclusive features काय आहेत.'
  },
  games: {
    title: 'Games कसे खेळायचे?',
    icon: '🎮',
    quickTips: [
      '🎯 Tap Challenge - टॅप करा, जिंका',
      '🎰 Scratch Cards - luck try करा',
      '🏆 Daily rewards available',
      '💰 Win up to 500 PRC'
    ],
    aiPrompt: 'Games feature बद्दल सांग. कोणते games available आहेत, कसे खेळायचे, आणि किती PRC जिंकता येतात.'
  },
  kyc: {
    title: 'KYC कसे complete करायचे?',
    icon: '📋',
    quickTips: [
      '📷 Aadhaar/PAN card upload करा',
      '🤖 AI auto-fill feature वापरा',
      '✅ 24 तासात verification',
      '🎁 KYC complete = Bonus PRC'
    ],
    aiPrompt: 'KYC verification process सांग. कोणते documents लागतात, AI auto-fill कसे वापरायचे, आणि verification किती वेळात होते.'
  },
  wallet: {
    title: 'Wallet कसे वापरायचे?',
    icon: '💰',
    quickTips: [
      '💵 PRC balance check करा',
      '📊 Transaction history बघा',
      '🔄 Transfer PRC coins',
      '📈 Earnings track करा'
    ],
    aiPrompt: 'Wallet feature बद्दल माहिती दे. Balance कसे check करायचे, transactions कसे बघायचे, आणि PRC transfer कसे करायचे.'
  },
  profile: {
    title: 'Profile Settings',
    icon: '👤',
    quickTips: [
      '✏️ Profile edit करा',
      '🔒 Password change करा',
      '🌐 Language select करा',
      '📱 Notifications manage करा'
    ],
    aiPrompt: 'Profile settings बद्दल सांग. Profile कसे update करायचे, security settings, आणि preferences कसे change करायचे.'
  },
  network: {
    title: 'AI Network Hub',
    icon: '🌐',
    quickTips: [
      '📊 5-Level bonus structure',
      '🔍 Fraud detection active',
      '📱 Social sharing tools',
      '🤖 AI-powered suggestions'
    ],
    aiPrompt: 'AI Network Hub बद्दल सांग. 5 level referral system, active vs inactive bonus, fraud detection, आणि social sharing features.'
  }
};

// Floating Help Button Component
const AIContextualHelp = ({ context = 'mining', user, position = 'bottom-right' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');

  const helpContent = CONTEXT_HELP[context] || CONTEXT_HELP.mining;

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-20 right-4',
    'top-left': 'top-20 left-4',
    'inline': 'relative'
  };

  const askAI = async (prompt) => {
    setIsAsking(true);
    setAiResponse('');
    
    try {
      const response = await axios.post(`${API}/ai/chatbot`, null, {
        params: {
          uid: user?.uid || 'guest',
          message: prompt,
          session_id: `help_${context}_${Date.now()}`
        }
      });
      setAiResponse(response.data.response);
    } catch (error) {
      console.error('AI Help error:', error);
      setAiResponse('माफ करा, AI response मिळवताना error आला. कृपया पुन्हा प्रयत्न करा.');
    }
    setIsAsking(false);
  };

  const handleAskCustom = () => {
    if (customQuestion.trim()) {
      askAI(`${helpContent.title} बद्दल: ${customQuestion}`);
      setCustomQuestion('');
    }
  };

  // Inline help button (for embedding in pages)
  if (position === 'inline') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 text-sm font-medium"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Help</span>
        </button>

        <AnimatePresence>
          {isOpen && (
            <HelpModal 
              isOpen={isOpen}
              onClose={() => { setIsOpen(false); setAiResponse(''); }}
              helpContent={helpContent}
              aiResponse={aiResponse}
              isAsking={isAsking}
              askAI={askAI}
              customQuestion={customQuestion}
              setCustomQuestion={setCustomQuestion}
              handleAskCustom={handleAskCustom}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // Floating button
  return (
    <>
      <motion.button
        className={`fixed ${positionClasses[position]} z-[9998] w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg flex items-center justify-center`}
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <HelpCircle className="w-6 h-6" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <HelpModal 
            isOpen={isOpen}
            onClose={() => { setIsOpen(false); setAiResponse(''); }}
            helpContent={helpContent}
            aiResponse={aiResponse}
            isAsking={isAsking}
            askAI={askAI}
            customQuestion={customQuestion}
            setCustomQuestion={setCustomQuestion}
            handleAskCustom={handleAskCustom}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// Help Modal Component
const HelpModal = ({ 
  isOpen, 
  onClose, 
  helpContent, 
  aiResponse, 
  isAsking, 
  askAI,
  customQuestion,
  setCustomQuestion,
  handleAskCustom
}) => {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{helpContent.icon}</span>
              <div>
                <h3 className="font-bold text-lg">{helpContent.title}</h3>
                <p className="text-xs text-blue-100 flex items-center gap-1">
                  <Bot className="w-3 h-3" /> AI-Powered Help
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[50vh] overflow-y-auto">
          {/* Quick Tips */}
          <div className="mb-4">
            <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              Quick Tips
            </h4>
            <div className="space-y-2">
              {helpContent.quickTips.map((tip, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700"
                >
                  {tip}
                </motion.div>
              ))}
            </div>
          </div>

          {/* AI Response */}
          {(aiResponse || isAsking) && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-500" />
                AI Assistant
              </h4>
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                {isAsking ? (
                  <div className="flex items-center gap-2 text-purple-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">विचार करत आहे...</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiResponse}</p>
                )}
              </div>
            </div>
          )}

          {/* Ask AI Button */}
          {!aiResponse && !isAsking && (
            <Button
              onClick={() => askAI(helpContent.aiPrompt)}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 mb-4"
            >
              <Bot className="w-4 h-4 mr-2" />
              AI ला विचारा (सविस्तर माहिती)
            </Button>
          )}

          {/* Custom Question */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-gray-700 mb-2 text-sm">आणखी काही विचारायचे आहे?</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAskCustom()}
                placeholder="तुमचा प्रश्न टाइप करा..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              />
              <Button
                onClick={handleAskCustom}
                disabled={!customQuestion.trim() || isAsking}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Section Help Button (for adding to any section header)
const SectionHelpButton = ({ context, user, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');

  const helpContent = CONTEXT_HELP[context] || CONTEXT_HELP.mining;

  const askAI = async (prompt) => {
    setIsAsking(true);
    setAiResponse('');
    
    try {
      const response = await axios.post(`${API}/ai/chatbot`, null, {
        params: {
          uid: user?.uid || 'guest',
          message: prompt,
          session_id: `help_${context}_${Date.now()}`
        }
      });
      setAiResponse(response.data.response);
    } catch (error) {
      setAiResponse('माफ करा, error आला. पुन्हा प्रयत्न करा.');
    }
    setIsAsking(false);
  };

  const handleAskCustom = () => {
    if (customQuestion.trim()) {
      askAI(`${helpContent.title} बद्दल: ${customQuestion}`);
      setCustomQuestion('');
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`p-1.5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors ${className}`}
        title="Help"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <HelpModal 
            isOpen={isOpen}
            onClose={() => { setIsOpen(false); setAiResponse(''); }}
            helpContent={helpContent}
            aiResponse={aiResponse}
            isAsking={isAsking}
            askAI={askAI}
            customQuestion={customQuestion}
            setCustomQuestion={setCustomQuestion}
            handleAskCustom={handleAskCustom}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export { AIContextualHelp, SectionHelpButton, CONTEXT_HELP };
export default AIContextualHelp;
