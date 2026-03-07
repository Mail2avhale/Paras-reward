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
    whileHover={{ scale: 1.02, y: -1 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
      variant === "primary" 
        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-200"
        : variant === "success"
        ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-green-200"
        : "bg-white text-gray-700 border border-gray-200 hover:border-purple-300 hover:bg-purple-50"
    }`}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
    <ArrowRight className="w-3 h-3 ml-1" />
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
      route: '/gift-vouchers',
      type: 'reward'
    });
  }
  
  if (userStats?.membershipType !== 'vip') {
    suggestions.push({
      icon: '👑',
      text: 'VIP unlocks vouchers & bill payments',
      action: 'Learn More',
      route: '/subscription',
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
    actions.push({ label: 'View VIP Plans', route: '/subscription', icon: Crown, variant: 'success' });
  }
  if (lowerText.includes('redeem') || lowerText.includes('voucher') || lowerText.includes('gift')) {
    actions.push({ label: 'Gift Vouchers', route: '/gift-vouchers', icon: ShoppingBag, variant: 'default' });
  }
  if (lowerText.includes('bank') || lowerText.includes('transfer') || lowerText.includes('dmt') || lowerText.includes('money transfer')) {
    actions.push({ label: 'Bank Transfer', route: '/redeem?service=dmt', icon: TrendingUp, variant: 'success' });
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
        text: `${greeting} ${user?.name || 'User'}! 👋\n\nI'm Paras AI with **Smart Diagnosis**. Ask me about any problem - I'll analyze your account and find the exact issue!\n\n🔍 *Try: "माझी bank redeem का fail झाली?"*`,
        timestamp: new Date(),
        suggestions: getAISuggestions(userStats, user?.name),
        quickFAQ: [
          { q: 'Check my account', icon: '🔍' },
          { q: 'Why redeem failed?', icon: '❌' },
          { q: 'KYC status check', icon: '📋' },
          { q: 'Contact support', icon: '📞' }
        ]
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
      const isDiagnostic = response.data.is_diagnostic;
      const actions = parseResponseForActions(responseText);

      const botMessage = {
        type: 'bot',
        text: responseText,
        timestamp: new Date(),
        actions: actions,
        isDiagnostic: isDiagnostic
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
      const errorMessage = error.response?.status === 404 
        ? 'कृपया पुन्हा login करा आणि try करा.' 
        : error.response?.status === 500
        ? 'Server busy आहे. कृपया थोड्या वेळाने try करा.'
        : 'Connection issue. कृपया पुन्हा try करा.';
      
      setMessages(prev => [...prev, {
        type: 'bot',
        text: `⚠️ ${errorMessage}`,
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
    { icon: '🔍', text: "माझी समस्या शोधा" },
    { icon: '💰', text: "Bank redeem का fail?" },
    { icon: '🎮', text: "Mining not working?" },
    { icon: '👥', text: "Referral bonus कुठे?" }
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
              className="absolute inset-0 rounded-full bg-blue-500"
              animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-blue-400"
              animate={{ scale: [1, 2], opacity: [0.3, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            />
          </>
        )}
        
        {/* Main button with custom PRC Bot image */}
        <motion.button
          onClick={() => { setIsOpen(true); setShowPulse(false); }}
          className="relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center overflow-hidden bg-white border-2 border-blue-400"
          style={{
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.4)',
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          data-testid="chatbot-toggle-btn"
        >
          <img 
            src="/chatbot-icon.png" 
            alt="PRC Bot" 
            className="w-14 h-14 object-contain relative z-10"
          />
        </motion.button>
        
        {/* Floating label */}
        <motion.div
          className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm px-4 py-2 rounded-xl shadow-xl whitespace-nowrap"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: showPulse ? 1 : 0, x: showPulse ? 0 : 10 }}
          transition={{ delay: 2 }}
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            Need Help? Ask me!
          </span>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-blue-600 rotate-45" />
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
        <Card className="h-full max-h-[75vh] sm:max-h-[600px] shadow-2xl border-0 overflow-hidden flex flex-col rounded-2xl">
          {/* Compact Header */}
          <div 
            className="text-white px-3 py-2 flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden bg-white">
                  <img 
                    src="/chatbot-icon.png" 
                    alt="PRC Bot" 
                    className="w-9 h-9 object-contain"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-1.5">
                    PRC Bot
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  </h3>
                  <p className="text-xs text-white/70">AI Assistant • Voice Ready</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button 
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`p-2 rounded-lg transition-all ${voiceEnabled ? 'bg-white/25' : 'bg-white/10'}`}
                  title={voiceEnabled ? 'Disable voice' : 'Enable voice'}
                >
                  {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 hover:bg-white/20 rounded-lg"
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => { setIsOpen(false); stopSpeaking(); }}
                  className="p-2 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Compact Tips Banner */}
          {proactiveTips.length > 0 && messages.length <= 1 && (
            <div className="px-3 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-200/50">
              <div className="flex items-center gap-2">
                <span className="text-lg">💡</span>
                <p className="text-xs font-medium text-amber-800 flex-1">{proactiveTips[0]?.text}</p>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className={`flex-1 overflow-y-auto p-3 bg-gradient-to-b from-slate-50 to-white space-y-3 min-h-0 ${isExpanded ? '' : 'max-h-[280px] sm:max-h-[350px]'}`}>
            {messages.map((msg, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start gap-2 max-w-[88%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    msg.type === 'user' 
                      ? 'bg-gradient-to-br from-purple-500 to-indigo-600' 
                      : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                  }`}>
                    {msg.type === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    {/* Diagnostic Badge */}
                    {msg.isDiagnostic && msg.type === 'bot' && (
                      <div className="flex items-center gap-1 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-full shadow-sm">
                          <Sparkles className="w-3 h-3" />
                          🔍 Smart Diagnosis
                        </span>
                      </div>
                    )}
                    <div className={`rounded-2xl px-4 py-3 ${
                      msg.type === 'user' 
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-md shadow-lg shadow-purple-200' 
                        : msg.isError 
                          ? 'bg-gradient-to-br from-red-50 to-rose-50 text-red-800 rounded-bl-md border-2 border-red-200'
                          : msg.isDiagnostic
                            ? 'bg-gradient-to-br from-emerald-50 to-teal-50 text-gray-800 shadow-lg rounded-bl-md border-2 border-emerald-200'
                            : 'bg-white text-gray-800 shadow-lg rounded-bl-md border border-gray-100'
                    }`}>
                      <p className={`text-sm whitespace-pre-wrap leading-relaxed ${msg.type === 'bot' ? 'font-medium' : ''}`}>{msg.text}</p>
                      
                      {/* Speaker button for bot messages */}
                      {msg.type === 'bot' && !msg.isError && voiceEnabled && (
                        <button
                          onClick={() => audioPlaying === index ? stopSpeaking() : speakText(msg.text, index)}
                          className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors"
                        >
                          {audioPlaying === index ? (
                            <>
                              <Square className="w-3 h-3" /> Stop
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" /> 🔊 Listen
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
                    
                    {/* AI Suggestions - Enhanced */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-bold text-gray-600 flex items-center gap-1.5 ml-1 uppercase tracking-wide">
                          <Lightbulb className="w-4 h-4 text-yellow-500" />
                          ✨ AI Suggestions
                        </p>
                        {msg.suggestions.map((suggestion, i) => (
                          <motion.button
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => suggestion.route ? handleActionClick(suggestion.route) : sendMessage(suggestion.action)}
                            className="w-full text-left p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 rounded-xl border-2 border-purple-100 hover:border-purple-400 hover:shadow-md transition-all group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{suggestion.icon}</span>
                                <span className="text-sm font-semibold text-gray-800">{suggestion.text}</span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-purple-500 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                    
                    {/* Quick FAQ Buttons - Enhanced */}
                    {msg.quickFAQ && msg.quickFAQ.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-bold text-gray-600 mb-2.5 ml-1 uppercase tracking-wide">🔗 Quick Questions</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.quickFAQ.map((faq, i) => (
                            <motion.button
                              key={i}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.05 }}
                              onClick={() => sendMessage(faq.q)}
                              className="px-4 py-2 bg-white border-2 border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 transition-all flex items-center gap-1.5 shadow-sm"
                            >
                              <span className="text-base">{faq.icon}</span>
                              <span>{faq.q}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <p className={`text-[11px] mt-2 ml-1 font-medium ${msg.type === 'user' ? 'text-right text-purple-300' : 'text-gray-400'}`}>
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

          {/* Compact Quick Questions */}
          {messages.length <= 1 && (
            <div className="px-3 py-2 bg-gray-50 border-t flex-shrink-0">
              <p className="text-xs font-medium text-gray-500 mb-2">🚀 Quick questions:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickQuestion(q.text)}
                    className="text-left p-2 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-xs flex items-center gap-1.5"
                  >
                    <span>{q.icon}</span>
                    <span className="text-gray-700 truncate">{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Compact Input Area */}
          <div className="p-3 bg-white border-t flex-shrink-0">
            <div className="flex gap-2">
              {/* Voice Recording Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className={`p-2.5 rounded-lg transition-all ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-600'
                }`}
                title={isRecording ? 'Stop recording' : 'Start voice input'}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Message..."
                className="flex-1 rounded-lg border-gray-200 focus:border-purple-400 text-sm"
                disabled={isLoading || isRecording}
              />
              <Button 
                onClick={() => sendMessage()}
                disabled={isLoading || !inputMessage.trim() || isRecording}
                className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default AIChatbotEnhanced;
