import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MessageCircle, Send, X, Bot, User, 
  Loader2, Sparkles, HelpCircle, Zap, TrendingUp,
  Gift, Crown, ChevronRight, Lightbulb, Target,
  Volume2, VolumeX, Maximize2, Minimize2, Mic, MicOff,
  Play, Square, ArrowRight, Home, Users, ShoppingBag
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Quick Action Button Component
const QuickActionButton = ({ icon: Icon, label, onClick, variant = "default" }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
      variant === "primary" 
        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
        : variant === "success"
        ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
    }`}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
    <ArrowRight className="w-3 h-3" />
  </motion.button>
);

// AI-powered suggestions based on user stats
const getAISuggestions = (userStats, userName) => {
  const suggestions = [];
  
  if (!userStats?.mining_active) {
    suggestions.push({
      icon: '🎯',
      text: 'Start your reward session to earn PRC!',
      action: 'Start Session',
      route: '/daily-rewards',
      type: 'mining'
    });
  }
  
  if (userStats?.prcBalance > 500 && userStats?.membershipType === 'vip') {
    suggestions.push({
      icon: '🎁',
      text: 'You have PRC to redeem for rewards!',
      action: 'View Rewards',
      route: '/marketplace',
      type: 'reward'
    });
  }
  
  if (userStats?.membershipType !== 'vip') {
    suggestions.push({
      icon: '👑',
      text: 'VIP unlocks shopping, vouchers & bill payments',
      action: 'Learn More',
      route: '/vip',
      type: 'upgrade'
    });
  }
  
  if (userStats?.referralCount < 5) {
    suggestions.push({
      icon: '👥',
      text: 'Earn up to 21% bonus through referrals!',
      action: 'Invite Friends',
      route: '/referrals',
      type: 'referral'
    });
  }
  
  if (userStats?.kyc_status !== 'approved') {
    suggestions.push({
      icon: '📋',
      text: 'Complete KYC for full platform access',
      action: 'Verify Now',
      route: '/kyc',
      type: 'kyc'
    });
  }
  
  return suggestions.slice(0, 3);
};

// Parse bot response for action buttons
const parseResponseForActions = (text) => {
  const actions = [];
  
  // Detect intent from response
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('start') && (lowerText.includes('session') || lowerText.includes('mining') || lowerText.includes('reward'))) {
    actions.push({ label: 'Start Session', route: '/daily-rewards', icon: Zap, variant: 'primary' });
  }
  if (lowerText.includes('referral') || lowerText.includes('invite') || lowerText.includes('friend')) {
    actions.push({ label: 'Invite Friends', route: '/referrals', icon: Users, variant: 'default' });
  }
  if (lowerText.includes('vip') || lowerText.includes('upgrade') || lowerText.includes('premium')) {
    actions.push({ label: 'View VIP Plans', route: '/vip', icon: Crown, variant: 'success' });
  }
  if (lowerText.includes('marketplace') || lowerText.includes('shop') || lowerText.includes('redeem') || lowerText.includes('product')) {
    actions.push({ label: 'Browse Marketplace', route: '/marketplace', icon: ShoppingBag, variant: 'default' });
  }
  if (lowerText.includes('kyc') || lowerText.includes('verify') || lowerText.includes('document')) {
    actions.push({ label: 'Complete KYC', route: '/kyc', icon: Target, variant: 'default' });
  }
  if (lowerText.includes('profile') || lowerText.includes('account') || lowerText.includes('setting')) {
    actions.push({ label: 'View Profile', route: '/profile', icon: User, variant: 'default' });
  }
  
  return actions.slice(0, 2); // Max 2 action buttons
};

const AIChatbotEnhanced = ({ user, userStats }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showPulse, setShowPulse] = useState(true);
  
  // Voice states
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [audioPlaying, setAudioPlaying] = useState(null);
  
  // Proactive tips
  const [proactiveTips, setProactiveTips] = useState([]);
  
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentAudioRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Show pulse animation for a while then stop
  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch proactive tips based on current page
  useEffect(() => {
    if (user?.uid && isOpen) {
      fetchProactiveTips();
    }
  }, [user?.uid, isOpen, location.pathname]);

  const fetchProactiveTips = async () => {
    try {
      const currentPage = location.pathname.replace('/', '') || 'dashboard';
      const response = await axios.get(`${API}/ai/proactive-tips/${user.uid}`, {
        params: { current_page: currentPage }
      });
      setProactiveTips(response.data.tips || []);
    } catch (error) {
      console.error('Error fetching proactive tips:', error);
    }
  };

  // Add welcome message when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
      setMessages([{
        type: 'bot',
        text: `${greeting} ${user?.name || 'User'}! 👋\n\nI'm Paras Assistant, your AI-powered helper. How can I assist you today?\n\n🎤 *Tip: Click the mic button to speak your question!*\n\n⚠️ *Disclaimer: I provide general information only. This is not financial advice.*`,
        timestamp: new Date(),
        suggestions: getAISuggestions(userStats, user?.name)
      }]);
    }
  }, [isOpen, user?.name, messages.length, userStats]);

  // Voice Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.info('🎤 Listening... Click again to stop');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.webm');

      const response = await axios.post(`${API}/ai/voice/transcribe`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success && response.data.text) {
        setInputMessage(response.data.text);
        // Auto-send the transcribed message
        await sendMessage(response.data.text);
      } else {
        toast.error('Could not understand audio. Please try again.');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Voice transcription failed. Please type your message.');
    } finally {
      setIsLoading(false);
    }
  };

  // Text-to-Speech Function
  const speakText = async (text, messageIndex) => {
    if (!voiceEnabled) return;
    
    // Stop any currently playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setAudioPlaying(null);
    }

    try {
      setIsSpeaking(true);
      setAudioPlaying(messageIndex);
      
      // Clean text for speech (remove emojis and special chars)
      const cleanText = text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[*_#]/gu, '').trim();
      
      if (!cleanText) return;
      
      const formData = new FormData();
      formData.append('text', cleanText.substring(0, 500)); // Limit for faster response
      formData.append('voice', 'nova'); // Friendly voice
      formData.append('speed', '1.1'); // Slightly faster

      const response = await axios.post(`${API}/ai/voice/speak`, formData);

      if (response.data.success && response.data.audio_base64) {
        const audio = new Audio(`data:audio/mp3;base64,${response.data.audio_base64}`);
        currentAudioRef.current = audio;
        
        audio.onended = () => {
          setIsSpeaking(false);
          setAudioPlaying(null);
          currentAudioRef.current = null;
        };
        
        audio.onerror = () => {
          setIsSpeaking(false);
          setAudioPlaying(null);
          currentAudioRef.current = null;
        };
        
        await audio.play();
      }
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
      setAudioPlaying(null);
    }
  };

  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
    setAudioPlaying(null);
  };

  const sendMessage = async (messageText = inputMessage) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage = {
      type: 'user',
      text: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/ai/chatbot`, null, {
        params: {
          uid: user.uid,
          message: messageText,
          session_id: sessionId
        }
      });

      const responseText = response.data.response;
      const actions = parseResponseForActions(responseText);

      const botMessage = {
        type: 'bot',
        text: responseText,
        timestamp: new Date(),
        actions: actions
      };

      setMessages(prev => [...prev, botMessage]);
      
      // Auto-speak response if voice is enabled
      if (voiceEnabled && responseText.length < 500) {
        setTimeout(() => {
          speakText(responseText, messages.length + 1);
        }, 300);
      }
      
      if (!sessionId) {
        setSessionId(response.data.session_id);
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages(prev => [...prev, {
        type: 'bot',
        text: 'Sorry, there was a technical issue. Please try again. 🔄',
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (route) => {
    navigate(route);
    setIsOpen(false);
  };

  const quickQuestions = [
    { icon: '🚀', text: "PRC कसे कमवायचे?" },
    { icon: '🌧️', text: "PRC Rain Drop म्हणजे काय?" },
    { icon: '🎁', text: "रिवॉर्ड कसे redeem करायचे?" },
    { icon: '💡', text: "How does Paras help me?" }
  ];

  const handleQuickQuestion = (question) => {
    sendMessage(question);
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <motion.div
        className="fixed bottom-36 right-4 z-[9999] sm:bottom-28"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.5 }}
      >
        {/* Attention-grabbing pulse rings */}
        {showPulse && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-purple-500"
              animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-purple-500"
              animate={{ scale: [1, 2], opacity: [0.3, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            />
          </>
        )}
        
        {/* Main button */}
        <motion.button
          onClick={() => { setIsOpen(true); setShowPulse(false); }}
          className="relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1, #4f46e5)',
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4)',
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          data-testid="chatbot-toggle-btn"
        >
          {/* Animated gradient overlay */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: [-100, 100] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          <Bot className="w-8 h-8 text-white relative z-10" />
          
          {/* AI badge */}
          <motion.span 
            className="absolute -top-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            AI
          </motion.span>
        </motion.button>
        
        {/* Floating label */}
        <motion.div
          className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-xl whitespace-nowrap"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: showPulse ? 1 : 0, x: showPulse ? 0 : 10 }}
          transition={{ delay: 2 }}
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            Need help? Ask me! 🤖
          </span>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45" />
        </motion.div>
      </motion.div>
    );
  }

  // Chat window when open
  return (
    <AnimatePresence>
      <motion.div 
        className={`fixed z-[9999] ${
          isExpanded 
            ? 'inset-4' 
            : 'bottom-24 right-2 left-2 sm:left-auto sm:right-4 sm:w-[400px]'
        }`}
        style={!isExpanded ? { 
          maxHeight: 'calc(100vh - 140px)',
          height: 'auto'
        } : {}}
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        data-testid="chatbot-container"
      >
        <Card className="h-full max-h-[65vh] sm:max-h-[500px] shadow-2xl border-0 overflow-hidden flex flex-col">
          {/* Header */}
          <div 
            className="text-white p-4 flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1, #4f46e5)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div 
                  className="relative w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <Bot className="w-7 h-7" />
                  <motion.div
                    className="absolute -top-1 -right-1"
                    animate={{ scale: [1, 1.3, 1], rotate: [0, 180, 360] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                  </motion.div>
                </motion.div>
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    Paras AI
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Assistant</span>
                  </h3>
                  <p className="text-xs text-purple-200 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Online • 🎤 Voice Enabled
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Voice Toggle */}
                <button 
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`p-2 rounded-lg transition-colors ${voiceEnabled ? 'bg-white/20' : 'bg-white/10'}`}
                  title={voiceEnabled ? 'Disable voice' : 'Enable voice'}
                >
                  {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => { setIsOpen(false); stopSpeaking(); }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Proactive Tips Banner */}
          {proactiveTips.length > 0 && messages.length <= 1 && (
            <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-100">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-800">AI Tip for you:</p>
                  <p className="text-xs text-amber-700">{proactiveTips[0]?.text}</p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-3 sm:p-4 bg-gradient-to-b from-gray-50 to-white space-y-3 ${isExpanded ? '' : 'h-[250px] sm:h-[320px]'}`}>
            {messages.map((msg, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start gap-2 max-w-[90%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    msg.type === 'user' 
                      ? 'bg-gradient-to-br from-purple-500 to-indigo-600' 
                      : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                  }`}>
                    {msg.type === 'user' ? (
                      <User className="w-5 h-5 text-white" />
                    ) : (
                      <Bot className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`rounded-2xl px-4 py-3 ${
                      msg.type === 'user' 
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-md' 
                        : msg.isError 
                          ? 'bg-red-100 text-red-800 rounded-bl-md'
                          : 'bg-white text-gray-800 shadow-md rounded-bl-md border border-gray-100'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      
                      {/* Speaker button for bot messages */}
                      {msg.type === 'bot' && !msg.isError && voiceEnabled && (
                        <button
                          onClick={() => audioPlaying === index ? stopSpeaking() : speakText(msg.text, index)}
                          className="mt-2 flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700"
                        >
                          {audioPlaying === index ? (
                            <>
                              <Square className="w-3 h-3" /> Stop
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" /> Listen
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    
                    {/* Quick Action Buttons */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.actions.map((action, i) => (
                          <QuickActionButton
                            key={i}
                            icon={action.icon}
                            label={action.label}
                            variant={action.variant}
                            onClick={() => handleActionClick(action.route)}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* AI Suggestions */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-500 flex items-center gap-1 ml-1">
                          <Lightbulb className="w-3 h-3 text-yellow-500" />
                          AI Suggestions for you:
                        </p>
                        {msg.suggestions.map((suggestion, i) => (
                          <motion.button
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => suggestion.route ? handleActionClick(suggestion.route) : sendMessage(suggestion.action)}
                            className="w-full text-left p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 hover:border-purple-300 transition-all group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{suggestion.icon}</span>
                                <span className="text-sm text-gray-700">{suggestion.text}</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                    
                    <p className={`text-[10px] mt-1 ml-1 ${msg.type === 'user' ? 'text-right text-purple-300' : 'text-gray-400'}`}>
                      {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
            
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-md border border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 bg-purple-500 rounded-full"
                            animate={{ y: [0, -6, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">
                        {isRecording ? 'Transcribing...' : 'Thinking...'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          {messages.length <= 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t flex-shrink-0">
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <Target className="w-3 h-3" /> Quick questions:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {quickQuestions.map((q, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleQuickQuestion(q.text)}
                    className="text-left p-2.5 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-sm flex items-center gap-2"
                  >
                    <span>{q.icon}</span>
                    <span className="text-gray-700 truncate">{q.text}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 bg-white border-t flex-shrink-0">
            <div className="flex gap-2">
              {/* Voice Recording Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className={`p-3 rounded-xl transition-all ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-600'
                }`}
                title={isRecording ? 'Stop recording' : 'Start voice input'}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </motion.button>
              
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type or speak your message..."
                className="flex-1 rounded-xl border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                disabled={isLoading || isRecording}
              />
              <Button 
                onClick={() => sendMessage()}
                disabled={isLoading || !inputMessage.trim() || isRecording}
                className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-4"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2">
              🎤 Voice enabled • English, हिंदी, मराठी supported
            </p>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default AIChatbotEnhanced;
