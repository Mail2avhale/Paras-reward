"use strict";
(globalThis["webpackChunkfrontend"] = globalThis["webpackChunkfrontend"] || []).push([["src_pages_DashboardModern_js"],{

/***/ "./src/components/AIChatbotEnhanced.js":
/*!*********************************************!*\
  !*** ./src/components/AIChatbotEnhanced.js ***!
  \*********************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_router_dom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router-dom */ "./node_modules/react-router/dist/development/chunk-OIYGIGL5.mjs");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! framer-motion */ "./node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! framer-motion */ "./node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs");
/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! axios */ "./node_modules/axios/lib/axios.js");
/* harmony import */ var _components_ui_card__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @/components/ui/card */ "./src/components/ui/card.jsx");
/* harmony import */ var _components_ui_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @/components/ui/button */ "./src/components/ui/button.jsx");
/* harmony import */ var _components_ui_input__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @/components/ui/input */ "./src/components/ui/input.jsx");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/loader-circle.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/sparkles.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/arrow-right.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/bot.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/chevron-right.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/crown.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/lightbulb.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/maximize-2.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/mic.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/mic-off.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/minimize-2.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/send.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/shopping-bag.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/square.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/target.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/trending-up.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/user.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/users.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/volume-2.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/volume-x.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/x.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/zap.js");
/* harmony import */ var sonner__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sonner */ "./node_modules/sonner/dist/index.mjs");
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/components/AIChatbotEnhanced.js",
  _s = __webpack_require__.$Refresh$.signature();










const API = `${"https://dynamic-rate-system-1.preview.emergentagent.com"}/api`;

// Quick Action Button Component
const QuickActionButton = ({
  icon: Icon,
  label,
  onClick,
  variant = "default"
}) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.button, {
  whileHover: {
    scale: 1.02
  },
  whileTap: {
    scale: 0.98
  },
  onClick: onClick,
  className: `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${variant === "primary" ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg" : variant === "success" ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`,
  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(Icon, {
    className: "w-4 h-4"
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 33,
    columnNumber: 5
  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("span", {
    children: label
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 34,
    columnNumber: 5
  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_10__["default"], {
    className: "w-3 h-3"
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 35,
    columnNumber: 5
  }, undefined)]
}, void 0, true, {
  fileName: _jsxFileName,
  lineNumber: 21,
  columnNumber: 3
}, undefined);

// AI-powered suggestions based on user stats
_c = QuickActionButton;
const getAISuggestions = (userStats, userName) => {
  const suggestions = [];
  if (!(userStats !== null && userStats !== void 0 && userStats.mining_active)) {
    suggestions.push({
      icon: '🎯',
      text: 'Start your reward session to earn PRC!',
      action: 'Start Session',
      route: '/daily-rewards',
      type: 'mining'
    });
  }
  if ((userStats === null || userStats === void 0 ? void 0 : userStats.prcBalance) > 500 && (userStats === null || userStats === void 0 ? void 0 : userStats.membershipType) === 'vip') {
    suggestions.push({
      icon: '🎁',
      text: 'You have PRC to redeem for rewards!',
      action: 'View Rewards',
      route: '/gift-vouchers',
      type: 'reward'
    });
  }
  if ((userStats === null || userStats === void 0 ? void 0 : userStats.membershipType) !== 'vip') {
    suggestions.push({
      icon: '👑',
      text: 'VIP unlocks vouchers & bill payments',
      action: 'Learn More',
      route: '/subscription',
      type: 'upgrade'
    });
  }
  if ((userStats === null || userStats === void 0 ? void 0 : userStats.referralCount) < 5) {
    suggestions.push({
      icon: '👥',
      text: 'Earn up to 21% bonus through referrals!',
      action: 'Invite Friends',
      route: '/referrals',
      type: 'referral'
    });
  }
  if ((userStats === null || userStats === void 0 ? void 0 : userStats.kyc_status) !== 'approved') {
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
const parseResponseForActions = text => {
  const actions = [];

  // Detect intent from response
  const lowerText = text.toLowerCase();
  if (lowerText.includes('start') && (lowerText.includes('session') || lowerText.includes('mining') || lowerText.includes('reward'))) {
    actions.push({
      label: 'Start Session',
      route: '/daily-rewards',
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_29__["default"],
      variant: 'primary'
    });
  }
  if (lowerText.includes('referral') || lowerText.includes('invite') || lowerText.includes('friend')) {
    actions.push({
      label: 'Invite Friends',
      route: '/referrals',
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_25__["default"],
      variant: 'default'
    });
  }
  if (lowerText.includes('vip') || lowerText.includes('upgrade') || lowerText.includes('premium')) {
    actions.push({
      label: 'View VIP Plans',
      route: '/subscription',
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_13__["default"],
      variant: 'success'
    });
  }
  if (lowerText.includes('redeem') || lowerText.includes('voucher') || lowerText.includes('gift')) {
    actions.push({
      label: 'Gift Vouchers',
      route: '/gift-vouchers',
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_20__["default"],
      variant: 'default'
    });
  }
  if (lowerText.includes('bank') || lowerText.includes('transfer') || lowerText.includes('dmt') || lowerText.includes('money transfer')) {
    actions.push({
      label: 'Bank Transfer',
      route: '/redeem?service=dmt',
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_23__["default"],
      variant: 'success'
    });
  }
  if (lowerText.includes('kyc') || lowerText.includes('verify') || lowerText.includes('document')) {
    actions.push({
      label: 'Complete KYC',
      route: '/kyc',
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_22__["default"],
      variant: 'default'
    });
  }
  if (lowerText.includes('profile') || lowerText.includes('account') || lowerText.includes('setting')) {
    actions.push({
      label: 'View Profile',
      route: '/profile',
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_24__["default"],
      variant: 'default'
    });
  }
  return actions.slice(0, 2); // Max 2 action buttons
};
const AIChatbotEnhanced = ({
  user,
  userStats
}) => {
  _s();
  var _proactiveTips$;
  const navigate = (0,react_router_dom__WEBPACK_IMPORTED_MODULE_1__.useNavigate)();
  const location = (0,react_router_dom__WEBPACK_IMPORTED_MODULE_1__.useLocation)();
  const [isOpen, setIsOpen] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [isExpanded, setIsExpanded] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [messages, setMessages] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [inputMessage, setInputMessage] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('');
  const [isLoading, setIsLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [sessionId, setSessionId] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [showPulse, setShowPulse] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);

  // Voice states
  const [isRecording, setIsRecording] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [isSpeaking, setIsSpeaking] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [voiceEnabled, setVoiceEnabled] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
  const [audioPlaying, setAudioPlaying] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);

  // Proactive tips
  const [proactiveTips, setProactiveTips] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const messagesEndRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const mediaRecorderRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const audioChunksRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)([]);
  const currentAudioRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const scrollToBottom = () => {
    var _messagesEndRef$curre;
    (_messagesEndRef$curre = messagesEndRef.current) === null || _messagesEndRef$curre === void 0 ? void 0 : _messagesEndRef$curre.scrollIntoView({
      behavior: "smooth"
    });
  };
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    scrollToBottom();
  }, [messages]);

  // Show pulse animation for a while then stop
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    const timer = setTimeout(() => setShowPulse(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch proactive tips based on current page
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (user !== null && user !== void 0 && user.uid && isOpen) {
      fetchProactiveTips();
    }
  }, [user === null || user === void 0 ? void 0 : user.uid, isOpen, location.pathname]);
  const fetchProactiveTips = async () => {
    try {
      const currentPage = location.pathname.replace('/', '') || 'dashboard';
      const response = await axios__WEBPACK_IMPORTED_MODULE_4__["default"].get(`${API}/ai/proactive-tips/${user.uid}`, {
        params: {
          current_page: currentPage
        }
      });
      setProactiveTips(response.data.tips || []);
    } catch (error) {
      console.error('Error fetching proactive tips:', error);
    }
  };

  // Add welcome message when chat opens
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (isOpen && messages.length === 0) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
      setMessages([{
        type: 'bot',
        text: `${greeting} ${(user === null || user === void 0 ? void 0 : user.name) || 'User'}! 👋\n\nI'm Paras AI with **Smart Diagnosis**. Ask me about any problem - I'll analyze your account and find the exact issue!\n\n🔍 *Try: "माझी bank redeem का fail झाली?"*`,
        timestamp: new Date(),
        suggestions: getAISuggestions(userStats, user === null || user === void 0 ? void 0 : user.name),
        quickFAQ: [{
          q: 'Check my account',
          icon: '🔍'
        }, {
          q: 'Why redeem failed?',
          icon: '❌'
        }, {
          q: 'KYC status check',
          icon: '📋'
        }, {
          q: 'Contact support',
          icon: '📞'
        }]
      }]);
    }
  }, [isOpen, user === null || user === void 0 ? void 0 : user.name, messages.length, userStats]);

  // Voice Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm'
        });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      sonner__WEBPACK_IMPORTED_MODULE_30__.toast.info('🎤 Listening... Click again to stop');
    } catch (error) {
      console.error('Error starting recording:', error);
      sonner__WEBPACK_IMPORTED_MODULE_30__.toast.error('Microphone access denied. Please allow microphone access.');
    }
  };
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  const transcribeAudio = async audioBlob => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.webm');
      const response = await axios__WEBPACK_IMPORTED_MODULE_4__["default"].post(`${API}/ai/voice/transcribe`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      if (response.data.success && response.data.text) {
        setInputMessage(response.data.text);
        // Auto-send the transcribed message
        await sendMessage(response.data.text);
      } else {
        sonner__WEBPACK_IMPORTED_MODULE_30__.toast.error('Could not understand audio. Please try again.');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      sonner__WEBPACK_IMPORTED_MODULE_30__.toast.error('Voice transcription failed. Please type your message.');
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

      const response = await axios__WEBPACK_IMPORTED_MODULE_4__["default"].post(`${API}/ai/voice/speak`, formData);
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
      const response = await axios__WEBPACK_IMPORTED_MODULE_4__["default"].post(`${API}/ai/chatbot`, null, {
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
  const handleActionClick = route => {
    navigate(route);
    setIsOpen(false);
  };
  const quickQuestions = [{
    icon: '🔍',
    text: "माझी समस्या शोधा"
  }, {
    icon: '💰',
    text: "Bank redeem का fail?"
  }, {
    icon: '🎮',
    text: "Mining not working?"
  }, {
    icon: '👥',
    text: "Referral bonus कुठे?"
  }];
  const handleQuickQuestion = question => {
    sendMessage(question);
  };

  // Floating button when closed
  if (!isOpen) {
    return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.div, {
      className: "fixed bottom-36 right-4 z-[9999] sm:bottom-28",
      initial: {
        scale: 0,
        opacity: 0
      },
      animate: {
        scale: 1,
        opacity: 1
      },
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay: 0.5
      },
      children: [showPulse && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.Fragment, {
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.div, {
          className: "absolute inset-0 rounded-full bg-purple-500",
          animate: {
            scale: [1, 2.5],
            opacity: [0.4, 0]
          },
          transition: {
            duration: 2,
            repeat: Infinity
          }
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 415,
          columnNumber: 13
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.div, {
          className: "absolute inset-0 rounded-full bg-purple-500",
          animate: {
            scale: [1, 2],
            opacity: [0.3, 0]
          },
          transition: {
            duration: 2,
            repeat: Infinity,
            delay: 0.5
          }
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 420,
          columnNumber: 13
        }, undefined)]
      }, void 0, true), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.button, {
        onClick: () => {
          setIsOpen(true);
          setShowPulse(false);
        },
        className: "relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center overflow-hidden",
        style: {
          background: 'linear-gradient(135deg, #8b5cf6, #6366f1, #4f46e5)',
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4)'
        },
        whileHover: {
          scale: 1.1
        },
        whileTap: {
          scale: 0.95
        },
        "data-testid": "chatbot-toggle-btn",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.div, {
          className: "absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent",
          animate: {
            x: [-100, 100]
          },
          transition: {
            duration: 2,
            repeat: Infinity
          }
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 441,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_11__["default"], {
          className: "w-8 h-8 text-white relative z-10"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 447,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.span, {
          className: "absolute -top-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg",
          animate: {
            scale: [1, 1.2, 1]
          },
          transition: {
            duration: 1.5,
            repeat: Infinity
          },
          children: "AI"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 450,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 429,
        columnNumber: 9
      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.div, {
        className: "absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-xl whitespace-nowrap",
        initial: {
          opacity: 0,
          x: 10
        },
        animate: {
          opacity: showPulse ? 1 : 0,
          x: showPulse ? 0 : 10
        },
        transition: {
          delay: 2
        },
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("span", {
          className: "flex items-center gap-2",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_9__["default"], {
            className: "w-4 h-4 text-yellow-400"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 467,
            columnNumber: 13
          }, undefined), "Need help? Ask me! \uD83E\uDD16"]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 466,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
          className: "absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 470,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 460,
        columnNumber: 9
      }, undefined)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 406,
      columnNumber: 7
    }, undefined);
  }

  // Chat window when open
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_2__.AnimatePresence, {
    children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.div, {
      className: `fixed z-[9999] ${isExpanded ? 'inset-4' : 'bottom-24 right-2 left-2 sm:left-auto sm:right-4 sm:w-[400px]'}`,
      style: !isExpanded ? {
        maxHeight: 'calc(100vh - 140px)',
        height: 'auto'
      } : {},
      initial: {
        scale: 0.8,
        opacity: 0,
        y: 50
      },
      animate: {
        scale: 1,
        opacity: 1,
        y: 0
      },
      exit: {
        scale: 0.8,
        opacity: 0,
        y: 50
      },
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25
      },
      "data-testid": "chatbot-container",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(_components_ui_card__WEBPACK_IMPORTED_MODULE_5__.Card, {
        className: "h-full max-h-[65vh] sm:max-h-[500px] shadow-2xl border-0 overflow-hidden flex flex-col",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
          className: "text-white p-4 flex-shrink-0",
          style: {
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1, #4f46e5)'
          },
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
            className: "flex items-center justify-between",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
              className: "flex items-center gap-3",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.div, {
                className: "relative w-12 h-12 rounded-xl flex items-center justify-center",
                style: {
                  background: 'rgba(255,255,255,0.2)'
                },
                animate: {
                  rotate: [0, 5, -5, 0]
                },
                transition: {
                  duration: 4,
                  repeat: Infinity
                },
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_11__["default"], {
                  className: "w-7 h-7"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 511,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.div, {
                  className: "absolute -top-1 -right-1",
                  animate: {
                    scale: [1, 1.3, 1],
                    rotate: [0, 180, 360]
                  },
                  transition: {
                    duration: 3,
                    repeat: Infinity
                  },
                  children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_9__["default"], {
                    className: "w-4 h-4 text-yellow-300"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 517,
                    columnNumber: 21
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 512,
                  columnNumber: 19
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 505,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("h3", {
                  className: "font-bold text-lg flex items-center gap-2",
                  children: ["Paras AI", /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("span", {
                    className: "text-xs bg-white/20 px-2 py-0.5 rounded-full",
                    children: "Assistant"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 523,
                    columnNumber: 21
                  }, undefined)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 521,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("p", {
                  className: "text-xs text-purple-200 flex items-center gap-1",
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("span", {
                    className: "w-2 h-2 bg-green-400 rounded-full animate-pulse"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 526,
                    columnNumber: 21
                  }, undefined), "Online \u2022 \uD83C\uDFA4 Voice Enabled"]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 525,
                  columnNumber: 19
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 520,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 504,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
              className: "flex items-center gap-1",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("button", {
                onClick: () => setVoiceEnabled(!voiceEnabled),
                className: `p-2 rounded-lg transition-colors ${voiceEnabled ? 'bg-white/20' : 'bg-white/10'}`,
                title: voiceEnabled ? 'Disable voice' : 'Enable voice',
                children: voiceEnabled ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_26__["default"], {
                  className: "w-5 h-5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 538,
                  columnNumber: 35
                }, undefined) : /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_27__["default"], {
                  className: "w-5 h-5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 538,
                  columnNumber: 69
                }, undefined)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 533,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("button", {
                onClick: () => setIsExpanded(!isExpanded),
                className: "p-2 hover:bg-white/20 rounded-lg transition-colors",
                children: isExpanded ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_18__["default"], {
                  className: "w-5 h-5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 544,
                  columnNumber: 33
                }, undefined) : /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_15__["default"], {
                  className: "w-5 h-5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 544,
                  columnNumber: 69
                }, undefined)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 540,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("button", {
                onClick: () => {
                  setIsOpen(false);
                  stopSpeaking();
                },
                className: "p-2 hover:bg-white/20 rounded-lg transition-colors",
                children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_28__["default"], {
                  className: "w-5 h-5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 550,
                  columnNumber: 19
                }, undefined)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 546,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 531,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 503,
            columnNumber: 13
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 497,
          columnNumber: 11
        }, undefined), proactiveTips.length > 0 && messages.length <= 1 && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
          className: "px-4 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-100",
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
            className: "flex items-start gap-2",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_14__["default"], {
              className: "w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 560,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("p", {
                className: "text-xs font-medium text-amber-800",
                children: "AI Tip for you:"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 562,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("p", {
                className: "text-xs text-amber-700",
                children: (_proactiveTips$ = proactiveTips[0]) === null || _proactiveTips$ === void 0 ? void 0 : _proactiveTips$.text
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 563,
                columnNumber: 19
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 561,
              columnNumber: 17
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 559,
            columnNumber: 15
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 558,
          columnNumber: 13
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
          className: `flex-1 overflow-y-auto p-3 sm:p-4 bg-gradient-to-b from-gray-50 to-white space-y-3 min-h-0 ${isExpanded ? '' : 'max-h-[200px] sm:max-h-[280px]'}`,
          children: [messages.map((msg, index) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.div, {
            initial: {
              opacity: 0,
              y: 10
            },
            animate: {
              opacity: 1,
              y: 0
            },
            className: `flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`,
            children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
              className: `flex items-start gap-2 max-w-[90%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`,
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                className: `w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.type === 'user' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`,
                children: msg.type === 'user' ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_24__["default"], {
                  className: "w-5 h-5 text-white"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 585,
                  columnNumber: 23
                }, undefined) : /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_11__["default"], {
                  className: "w-5 h-5 text-white"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 587,
                  columnNumber: 23
                }, undefined)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 579,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                className: "flex-1",
                children: [msg.isDiagnostic && msg.type === 'bot' && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                  className: "flex items-center gap-1 mb-2",
                  children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("span", {
                    className: "inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-medium rounded-full",
                    children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_9__["default"], {
                      className: "w-3 h-3"
                    }, void 0, false, {
                      fileName: _jsxFileName,
                      lineNumber: 595,
                      columnNumber: 27
                    }, undefined), "Smart Diagnosis"]
                  }, void 0, true, {
                    fileName: _jsxFileName,
                    lineNumber: 594,
                    columnNumber: 25
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 593,
                  columnNumber: 23
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                  className: `rounded-2xl px-4 py-3 ${msg.type === 'user' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-md' : msg.isError ? 'bg-red-100 text-red-800 rounded-bl-md' : msg.isDiagnostic ? 'bg-gradient-to-br from-emerald-50 to-teal-50 text-gray-800 shadow-md rounded-bl-md border border-emerald-200' : 'bg-white text-gray-800 shadow-md rounded-bl-md border border-gray-100'}`,
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("p", {
                    className: "text-sm whitespace-pre-wrap leading-relaxed",
                    children: msg.text
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 609,
                    columnNumber: 23
                  }, undefined), msg.type === 'bot' && !msg.isError && voiceEnabled && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("button", {
                    onClick: () => audioPlaying === index ? stopSpeaking() : speakText(msg.text, index),
                    className: "mt-2 flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700",
                    children: audioPlaying === index ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.Fragment, {
                      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_21__["default"], {
                        className: "w-3 h-3"
                      }, void 0, false, {
                        fileName: _jsxFileName,
                        lineNumber: 619,
                        columnNumber: 31
                      }, undefined), " Stop"]
                    }, void 0, true) : /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.Fragment, {
                      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_26__["default"], {
                        className: "w-3 h-3"
                      }, void 0, false, {
                        fileName: _jsxFileName,
                        lineNumber: 623,
                        columnNumber: 31
                      }, undefined), " Listen"]
                    }, void 0, true)
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 613,
                    columnNumber: 25
                  }, undefined)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 600,
                  columnNumber: 21
                }, undefined), msg.actions && msg.actions.length > 0 && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                  className: "mt-3 flex flex-wrap gap-2",
                  children: msg.actions.map((action, i) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(QuickActionButton, {
                    icon: action.icon,
                    label: action.label,
                    variant: action.variant,
                    onClick: () => handleActionClick(action.route)
                  }, i, false, {
                    fileName: _jsxFileName,
                    lineNumber: 634,
                    columnNumber: 27
                  }, undefined))
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 632,
                  columnNumber: 23
                }, undefined), msg.suggestions && msg.suggestions.length > 0 && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                  className: "mt-3 space-y-2",
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("p", {
                    className: "text-xs text-gray-500 flex items-center gap-1 ml-1",
                    children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_14__["default"], {
                      className: "w-3 h-3 text-yellow-500"
                    }, void 0, false, {
                      fileName: _jsxFileName,
                      lineNumber: 649,
                      columnNumber: 27
                    }, undefined), "AI Suggestions for you:"]
                  }, void 0, true, {
                    fileName: _jsxFileName,
                    lineNumber: 648,
                    columnNumber: 25
                  }, undefined), msg.suggestions.map((suggestion, i) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.button, {
                    initial: {
                      opacity: 0,
                      x: -10
                    },
                    animate: {
                      opacity: 1,
                      x: 0
                    },
                    transition: {
                      delay: i * 0.1
                    },
                    onClick: () => suggestion.route ? handleActionClick(suggestion.route) : sendMessage(suggestion.action),
                    className: "w-full text-left p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 hover:border-purple-300 transition-all group",
                    children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                      className: "flex items-center justify-between",
                      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                        className: "flex items-center gap-2",
                        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("span", {
                          className: "text-lg",
                          children: suggestion.icon
                        }, void 0, false, {
                          fileName: _jsxFileName,
                          lineNumber: 663,
                          columnNumber: 33
                        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("span", {
                          className: "text-sm text-gray-700",
                          children: suggestion.text
                        }, void 0, false, {
                          fileName: _jsxFileName,
                          lineNumber: 664,
                          columnNumber: 33
                        }, undefined)]
                      }, void 0, true, {
                        fileName: _jsxFileName,
                        lineNumber: 662,
                        columnNumber: 31
                      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_12__["default"], {
                        className: "w-4 h-4 text-purple-400 group-hover:translate-x-1 transition-transform"
                      }, void 0, false, {
                        fileName: _jsxFileName,
                        lineNumber: 666,
                        columnNumber: 31
                      }, undefined)]
                    }, void 0, true, {
                      fileName: _jsxFileName,
                      lineNumber: 661,
                      columnNumber: 29
                    }, undefined)
                  }, i, false, {
                    fileName: _jsxFileName,
                    lineNumber: 653,
                    columnNumber: 27
                  }, undefined))]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 647,
                  columnNumber: 23
                }, undefined), msg.quickFAQ && msg.quickFAQ.length > 0 && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                  className: "mt-3",
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("p", {
                    className: "text-xs text-gray-500 mb-2 ml-1",
                    children: "Quick Questions:"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 676,
                    columnNumber: 25
                  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                    className: "flex flex-wrap gap-2",
                    children: msg.quickFAQ.map((faq, i) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.button, {
                      initial: {
                        opacity: 0,
                        scale: 0.9
                      },
                      animate: {
                        opacity: 1,
                        scale: 1
                      },
                      transition: {
                        delay: i * 0.05
                      },
                      onClick: () => sendMessage(faq.q),
                      className: "px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-700 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-all flex items-center gap-1",
                      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("span", {
                        children: faq.icon
                      }, void 0, false, {
                        fileName: _jsxFileName,
                        lineNumber: 687,
                        columnNumber: 31
                      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("span", {
                        children: faq.q
                      }, void 0, false, {
                        fileName: _jsxFileName,
                        lineNumber: 688,
                        columnNumber: 31
                      }, undefined)]
                    }, i, true, {
                      fileName: _jsxFileName,
                      lineNumber: 679,
                      columnNumber: 29
                    }, undefined))
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 677,
                    columnNumber: 25
                  }, undefined)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 675,
                  columnNumber: 23
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("p", {
                  className: `text-[10px] mt-1 ml-1 ${msg.type === 'user' ? 'text-right text-purple-300' : 'text-gray-400'}`,
                  children: msg.timestamp.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 695,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 590,
                columnNumber: 19
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 578,
              columnNumber: 17
            }, undefined)
          }, index, false, {
            fileName: _jsxFileName,
            lineNumber: 572,
            columnNumber: 15
          }, undefined)), isLoading && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.div, {
            initial: {
              opacity: 0
            },
            animate: {
              opacity: 1
            },
            className: "flex justify-start",
            children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
              className: "flex items-center gap-2",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                className: "w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center",
                children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_11__["default"], {
                  className: "w-5 h-5 text-white"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 711,
                  columnNumber: 21
                }, undefined)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 710,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                className: "bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-md border border-gray-100",
                children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                  className: "flex items-center gap-2",
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
                    className: "flex gap-1",
                    children: [0, 1, 2].map(i => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.div, {
                      className: "w-2 h-2 bg-purple-500 rounded-full",
                      animate: {
                        y: [0, -6, 0]
                      },
                      transition: {
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.1
                      }
                    }, i, false, {
                      fileName: _jsxFileName,
                      lineNumber: 717,
                      columnNumber: 27
                    }, undefined))
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 715,
                    columnNumber: 23
                  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("span", {
                    className: "text-sm text-gray-500",
                    children: isRecording ? 'Transcribing...' : 'Thinking...'
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 725,
                    columnNumber: 23
                  }, undefined)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 714,
                  columnNumber: 21
                }, undefined)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 713,
                columnNumber: 19
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 709,
              columnNumber: 17
            }, undefined)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 704,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
            ref: messagesEndRef
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 734,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 570,
          columnNumber: 11
        }, undefined), messages.length <= 1 && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
          className: "px-4 py-3 bg-gray-50 border-t flex-shrink-0",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("p", {
            className: "text-xs text-gray-500 mb-2 flex items-center gap-1",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_22__["default"], {
              className: "w-3 h-3"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 741,
              columnNumber: 17
            }, undefined), " Quick questions:"]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 740,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
            className: "grid grid-cols-2 gap-2",
            children: quickQuestions.map((q, i) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.button, {
              initial: {
                opacity: 0,
                scale: 0.9
              },
              animate: {
                opacity: 1,
                scale: 1
              },
              transition: {
                delay: i * 0.05
              },
              onClick: () => handleQuickQuestion(q.text),
              className: "text-left p-2.5 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-sm flex items-center gap-2",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("span", {
                children: q.icon
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 753,
                columnNumber: 21
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("span", {
                className: "text-gray-700 truncate",
                children: q.text
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 754,
                columnNumber: 21
              }, undefined)]
            }, i, true, {
              fileName: _jsxFileName,
              lineNumber: 745,
              columnNumber: 19
            }, undefined))
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 743,
            columnNumber: 15
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 739,
          columnNumber: 13
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
          className: "p-4 bg-white border-t flex-shrink-0",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("div", {
            className: "flex gap-2",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.button, {
              whileHover: {
                scale: 1.05
              },
              whileTap: {
                scale: 0.95
              },
              onClick: isRecording ? stopRecording : startRecording,
              disabled: isLoading,
              className: `p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-600'}`,
              title: isRecording ? 'Stop recording' : 'Start voice input',
              children: isRecording ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_17__["default"], {
                className: "w-5 h-5"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 777,
                columnNumber: 32
              }, undefined) : /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_16__["default"], {
                className: "w-5 h-5"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 777,
                columnNumber: 65
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 765,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(_components_ui_input__WEBPACK_IMPORTED_MODULE_7__.Input, {
              value: inputMessage,
              onChange: e => setInputMessage(e.target.value),
              onKeyPress: e => e.key === 'Enter' && sendMessage(),
              placeholder: "Type or speak your message...",
              className: "flex-1 rounded-xl border-gray-200 focus:border-purple-400 focus:ring-purple-400",
              disabled: isLoading || isRecording
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 780,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(_components_ui_button__WEBPACK_IMPORTED_MODULE_6__.Button, {
              onClick: () => sendMessage(),
              disabled: isLoading || !inputMessage.trim() || isRecording,
              className: "rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-4",
              children: isLoading ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_8__["default"], {
                className: "w-5 h-5 animate-spin"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 794,
                columnNumber: 19
              }, undefined) : /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_19__["default"], {
                className: "w-5 h-5"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 796,
                columnNumber: 19
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 788,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 763,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxDEV)("p", {
            className: "text-[10px] text-gray-400 text-center mt-2",
            children: "\uD83C\uDFA4 Voice enabled \u2022 English, \u0939\u093F\u0902\u0926\u0940, \u092E\u0930\u093E\u0920\u0940 supported"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 800,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 762,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 495,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 479,
      columnNumber: 7
    }, undefined)
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 478,
    columnNumber: 5
  }, undefined);
};
_s(AIChatbotEnhanced, "sdFoQHxtPLd1KLNg3neh5a91J6Q=", false, function () {
  return [react_router_dom__WEBPACK_IMPORTED_MODULE_1__.useNavigate, react_router_dom__WEBPACK_IMPORTED_MODULE_1__.useLocation];
});
_c2 = AIChatbotEnhanced;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AIChatbotEnhanced);
var _c, _c2;
__webpack_require__.$Refresh$.register(_c, "QuickActionButton");
__webpack_require__.$Refresh$.register(_c2, "AIChatbotEnhanced");

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ }),

/***/ "./src/components/PRCExpiryTimer.js":
/*!******************************************!*\
  !*** ./src/components/PRCExpiryTimer.js ***!
  \******************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/circle-alert.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/clock.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/zap.js");
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/components/PRCExpiryTimer.js",
  _s = __webpack_require__.$Refresh$.signature();



const PRCExpiryTimer = ({
  miningHistory,
  isFreeUser
}) => {
  _s();
  const [expiringPRC, setExpiringPRC] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [urgentWarning, setUrgentWarning] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (!isFreeUser || !miningHistory || miningHistory.length === 0) {
      return;
    }
    const now = new Date();
    const expiring = [];
    let hasUrgent = false;
    miningHistory.forEach(entry => {
      if (entry.burned) return;
      try {
        const mineTime = new Date(entry.timestamp);
        const expiryTime = new Date(mineTime.getTime() + 48 * 60 * 60 * 1000); // 48 hours
        const timeLeft = expiryTime - now;
        if (timeLeft > 0 && timeLeft < 48 * 60 * 60 * 1000) {
          const hours = Math.floor(timeLeft / (60 * 60 * 1000));
          const minutes = Math.floor(timeLeft % (60 * 60 * 1000) / (60 * 1000));
          expiring.push({
            amount: entry.amount,
            hoursLeft: hours,
            minutesLeft: minutes,
            isUrgent: hours < 12 // Less than 12 hours
          });
          if (hours < 12) hasUrgent = true;
        }
      } catch (error) {
        console.error('Error parsing expiry:', error);
      }
    });

    // Sort by time left (most urgent first)
    expiring.sort((a, b) => a.hoursLeft - b.hoursLeft);
    setExpiringPRC(expiring);
    setUrgentWarning(hasUrgent);
  }, [miningHistory, isFreeUser]);
  if (!isFreeUser || expiringPRC.length === 0) {
    return null;
  }

  // Find the most urgent (first to expire)
  const mostUrgent = expiringPRC[0];
  const totalExpiring = expiringPRC.reduce((sum, item) => sum + item.amount, 0);
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("div", {
    className: `rounded-2xl p-4 shadow-lg mb-6 ${urgentWarning ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white' : 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white'}`,
    children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("div", {
      className: "flex items-start gap-3",
      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("div", {
        className: `p-2 rounded-full ${urgentWarning ? 'bg-white/20' : 'bg-white/30'}`,
        children: urgentWarning ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_1__["default"], {
          className: "w-6 h-6 animate-pulse"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 67,
          columnNumber: 13
        }, undefined) : /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_2__["default"], {
          className: "w-6 h-6"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 69,
          columnNumber: 13
        }, undefined)
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 65,
        columnNumber: 9
      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("div", {
        className: "flex-1",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("h3", {
          className: "font-bold text-lg mb-1",
          children: urgentWarning ? '⚠️ Urgent: PRC Expiring Soon!' : '⏰ PRC Expiry Notice'
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 74,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("p", {
          className: "text-sm opacity-90 mb-3",
          children: urgentWarning ? `${totalExpiring.toFixed(2)} PRC will be burned soon!` : `${totalExpiring.toFixed(2)} PRC expires in the next 48 hours`
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 78,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("div", {
          className: "bg-white/20 backdrop-blur-sm rounded-lg p-3 mb-3",
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("div", {
            className: "flex items-center justify-between",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("div", {
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("p", {
                className: "text-sm font-semibold",
                children: "Next to expire:"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 89,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("p", {
                className: "text-2xl font-bold",
                children: [mostUrgent.amount.toFixed(2), " PRC"]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 90,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 88,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("div", {
              className: "text-right",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("p", {
                className: "text-sm opacity-80",
                children: "Time left:"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 95,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("p", {
                className: "text-xl font-bold",
                children: [mostUrgent.hoursLeft, "h ", mostUrgent.minutesLeft, "m"]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 96,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 94,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 87,
            columnNumber: 13
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 86,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("div", {
          className: "flex flex-wrap gap-2",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("button", {
            onClick: () => window.location.href = '/gift-vouchers',
            className: "flex items-center gap-2 bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-opacity-90 transition-all",
            children: "\uD83C\uDF81 Use for Gift Vouchers"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 105,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("button", {
            onClick: () => window.location.href = '/subscription',
            className: "flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-white/30 transition-all border border-white/30",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_3__["default"], {
              className: "w-4 h-4"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 115,
              columnNumber: 15
            }, undefined), "Upgrade to VIP (Lifetime Validity)"]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 111,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 104,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxDEV)("p", {
          className: "text-xs mt-3 opacity-80",
          children: "\uD83D\uDCA1 Free users: PRC expires after 48 hours. Upgrade to VIP for lifetime validity!"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 121,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 73,
        columnNumber: 9
      }, undefined)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 64,
      columnNumber: 7
    }, undefined)
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 59,
    columnNumber: 5
  }, undefined);
};
_s(PRCExpiryTimer, "Ng7uGUi8PgUnB/06Rb0qIWLPido=");
_c = PRCExpiryTimer;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PRCExpiryTimer);
var _c;
__webpack_require__.$Refresh$.register(_c, "PRCExpiryTimer");

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ }),

/***/ "./src/components/ProfileCompletionPopup.js":
/*!**************************************************!*\
  !*** ./src/components/ProfileCompletionPopup.js ***!
  \**************************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_router_dom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router-dom */ "./node_modules/react-router/dist/development/chunk-OIYGIGL5.mjs");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/circle-check-big.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/arrow-right.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/file-text.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/user.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/x.js");
/* harmony import */ var _components_ui_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @/components/ui/button */ "./src/components/ui/button.jsx");
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/components/ProfileCompletionPopup.js",
  _s = __webpack_require__.$Refresh$.signature();





const ProfileCompletionPopup = ({
  user,
  isOpen,
  onClose
}) => {
  _s();
  const navigate = (0,react_router_dom__WEBPACK_IMPORTED_MODULE_1__.useNavigate)();
  const [currentStep, setCurrentStep] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(0);

  // Calculate what's missing
  const getMissingItems = () => {
    const items = [];
    if (!(user !== null && user !== void 0 && user.name) || user.name === 'User') {
      items.push({
        key: 'name',
        label: 'Add Your Name',
        icon: lucide_react__WEBPACK_IMPORTED_MODULE_5__["default"],
        route: '/profile',
        section: 'personal'
      });
    }
    if (!(user !== null && user !== void 0 && user.mobile) && !(user !== null && user !== void 0 && user.phone)) {
      items.push({
        key: 'phone',
        label: 'Add Phone Number',
        icon: lucide_react__WEBPACK_IMPORTED_MODULE_5__["default"],
        route: '/profile',
        section: 'contact'
      });
    }
    if (!(user !== null && user !== void 0 && user.address_line1) && !(user !== null && user !== void 0 && user.state) && !(user !== null && user !== void 0 && user.pincode)) {
      items.push({
        key: 'address',
        label: 'Add Address',
        icon: lucide_react__WEBPACK_IMPORTED_MODULE_5__["default"],
        route: '/profile',
        section: 'contact'
      });
    }
    if ((user === null || user === void 0 ? void 0 : user.kyc_status) !== 'verified' && (user === null || user === void 0 ? void 0 : user.kyc_status) !== 'approved') {
      items.push({
        key: 'kyc',
        label: 'Complete KYC',
        icon: lucide_react__WEBPACK_IMPORTED_MODULE_4__["default"],
        route: '/profile',
        section: 'kyc'
      });
    }
    return items;
  };
  const missingItems = getMissingItems();
  const completedCount = 5 - missingItems.length;
  const percentage = Math.round(completedCount / 5 * 100);

  // Don't show if complete or no user
  if (!isOpen || !user || missingItems.length === 0) return null;
  const handleAction = item => {
    onClose();
    navigate(item.route);
    // Store which section to open
    localStorage.setItem('profile_section', item.section);
  };
  const handleSkip = () => {
    // Store that user skipped, don't show again for 24 hours
    localStorage.setItem('profile_popup_skipped', Date.now().toString());
    onClose();
  };
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
    className: "fixed inset-0 z-[100] flex items-center justify-center p-4",
    children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
      className: "absolute inset-0 bg-black/60 backdrop-blur-sm",
      onClick: handleSkip
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 53,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
      className: "relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300",
      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
        className: "bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("button", {
          onClick: handleSkip,
          className: "absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors",
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_6__["default"], {
            className: "h-5 w-5"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 63,
            columnNumber: 13
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 59,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
          className: "flex items-center gap-4",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
            className: "relative",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
              className: "w-16 h-16 bg-white/20 rounded-full flex items-center justify-center",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_5__["default"], {
                className: "h-8 w-8 text-white"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 69,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 68,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
              className: "absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full",
              children: [percentage, "%"]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 71,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 67,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("h2", {
              className: "text-xl font-bold",
              children: "Complete Your Profile"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 76,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("p", {
              className: "text-white/80 text-sm",
              children: "Unlock all features & rewards"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 77,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 75,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 66,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
          className: "mt-4",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
            className: "h-2 bg-white/20 rounded-full overflow-hidden",
            children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
              className: "h-full bg-white rounded-full transition-all duration-500",
              style: {
                width: `${percentage}%`
              }
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 84,
              columnNumber: 15
            }, undefined)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 83,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("p", {
            className: "text-white/70 text-xs mt-1",
            children: [completedCount, " of 5 steps completed"]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 89,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 82,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 58,
        columnNumber: 9
      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
        className: "p-6",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("h3", {
          className: "font-semibold text-gray-900 mb-4",
          children: "What's missing:"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 95,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
          className: "space-y-3",
          children: missingItems.map((item, index) => {
            const Icon = item.icon;
            return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("button", {
              onClick: () => handleAction(item),
              className: "w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-purple-50 rounded-xl transition-colors group",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
                className: "flex items-center gap-3",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
                  className: "p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors",
                  children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)(Icon, {
                    className: "h-5 w-5 text-purple-600"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 108,
                    columnNumber: 23
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 107,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("span", {
                  className: "font-medium text-gray-900",
                  children: item.label
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 110,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 106,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_3__["default"], {
                className: "h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 112,
                columnNumber: 19
              }, undefined)]
            }, item.key, true, {
              fileName: _jsxFileName,
              lineNumber: 101,
              columnNumber: 17
            }, undefined);
          })
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 97,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
          className: "mt-6 p-4 bg-green-50 rounded-xl",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("h4", {
            className: "font-semibold text-green-900 text-sm mb-2",
            children: "Why complete your profile?"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 120,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("ul", {
            className: "text-xs text-green-800 space-y-1",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("li", {
              className: "flex items-center gap-2",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_2__["default"], {
                className: "h-3 w-3"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 123,
                columnNumber: 17
              }, undefined), " Unlock gift voucher redemption"]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 122,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("li", {
              className: "flex items-center gap-2",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_2__["default"], {
                className: "h-3 w-3"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 126,
                columnNumber: 17
              }, undefined), " Enable bill payments"]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 125,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("li", {
              className: "flex items-center gap-2",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_2__["default"], {
                className: "h-3 w-3"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 129,
                columnNumber: 17
              }, undefined), " Get verified badge"]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 128,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 121,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 119,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)("div", {
          className: "mt-6 flex gap-3",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)(_components_ui_button__WEBPACK_IMPORTED_MODULE_7__.Button, {
            variant: "outline",
            onClick: handleSkip,
            className: "flex-1",
            children: "Later"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 136,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxDEV)(_components_ui_button__WEBPACK_IMPORTED_MODULE_7__.Button, {
            onClick: () => handleAction(missingItems[0]),
            className: "flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700",
            children: "Complete Now"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 143,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 135,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 94,
        columnNumber: 9
      }, undefined)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 56,
      columnNumber: 7
    }, undefined)]
  }, void 0, true, {
    fileName: _jsxFileName,
    lineNumber: 51,
    columnNumber: 5
  }, undefined);
};
_s(ProfileCompletionPopup, "IBoA4hKq99XdZS3BdLpfN98Z0Fc=", false, function () {
  return [react_router_dom__WEBPACK_IMPORTED_MODULE_1__.useNavigate];
});
_c = ProfileCompletionPopup;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProfileCompletionPopup);
var _c;
__webpack_require__.$Refresh$.register(_c, "ProfileCompletionPopup");

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ }),

/***/ "./src/components/skeletons/CardSkeleton.js":
/*!**************************************************!*\
  !*** ./src/components/skeletons/CardSkeleton.js ***!
  \**************************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/components/skeletons/CardSkeleton.js";


function CardSkeleton({
  count = 1
}) {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [...Array(count)].map((_, index) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
      className: "bg-white rounded-lg shadow-sm p-6 animate-pulse",
      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "flex items-center justify-between mb-4",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "h-4 bg-gray-200 rounded w-1/3"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 9,
          columnNumber: 13
        }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "h-8 w-8 bg-gray-200 rounded-full"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 10,
          columnNumber: 13
        }, this)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 8,
        columnNumber: 11
      }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "h-8 bg-gray-200 rounded w-2/3 mb-2"
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 12,
        columnNumber: 11
      }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "h-3 bg-gray-200 rounded w-1/2"
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 13,
        columnNumber: 11
      }, this)]
    }, index, true, {
      fileName: _jsxFileName,
      lineNumber: 7,
      columnNumber: 9
    }, this))
  }, void 0, false);
}
_c = CardSkeleton;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CardSkeleton);
var _c;
__webpack_require__.$Refresh$.register(_c, "CardSkeleton");

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ }),

/***/ "./src/components/skeletons/ChartSkeleton.js":
/*!***************************************************!*\
  !*** ./src/components/skeletons/ChartSkeleton.js ***!
  \***************************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/components/skeletons/ChartSkeleton.js";


function ChartSkeleton({
  height = 400
}) {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
    className: "bg-white rounded-lg shadow-sm p-6",
    children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
      className: "flex items-center justify-between mb-6 animate-pulse",
      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "h-6 bg-gray-200 rounded w-1/3"
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 8,
        columnNumber: 9
      }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "h-8 w-24 bg-gray-200 rounded"
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 9,
        columnNumber: 9
      }, this)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 7,
      columnNumber: 7
    }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
      className: "bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg animate-pulse relative overflow-hidden",
      style: {
        height: `${height}px`
      },
      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent shimmer-effect"
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 18,
        columnNumber: 9
      }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "flex items-end justify-around h-full p-8 gap-4",
        children: [60, 80, 45, 90, 70, 85, 55].map((height, index) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "bg-gray-200 rounded-t w-full",
          style: {
            height: `${height}%`
          }
        }, index, false, {
          fileName: _jsxFileName,
          lineNumber: 23,
          columnNumber: 13
        }, this))
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 21,
        columnNumber: 9
      }, this)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 13,
      columnNumber: 7
    }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
      className: "flex items-center justify-center gap-6 mt-6 animate-pulse",
      children: [1, 2, 3].map((_, index) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "flex items-center gap-2",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "h-3 w-3 bg-gray-200 rounded-full"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 36,
          columnNumber: 13
        }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "h-3 bg-gray-200 rounded w-16"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 37,
          columnNumber: 13
        }, this)]
      }, index, true, {
        fileName: _jsxFileName,
        lineNumber: 35,
        columnNumber: 11
      }, this))
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 33,
      columnNumber: 7
    }, this)]
  }, void 0, true, {
    fileName: _jsxFileName,
    lineNumber: 5,
    columnNumber: 5
  }, this);
}
_c = ChartSkeleton;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ChartSkeleton);
var _c;
__webpack_require__.$Refresh$.register(_c, "ChartSkeleton");

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ }),

/***/ "./src/components/skeletons/DashboardSkeleton.js":
/*!*******************************************************!*\
  !*** ./src/components/skeletons/DashboardSkeleton.js ***!
  \*******************************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/components/skeletons/DashboardSkeleton.js";


const DashboardSkeleton = () => {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
    className: "min-h-screen bg-gray-950 pb-24 animate-pulse",
    children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
      className: "px-5 pt-6 pb-4",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "flex items-center justify-between",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "flex items-center gap-3",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "w-12 h-12 rounded-full bg-gray-800"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 10,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
              className: "h-4 w-24 bg-gray-800 rounded mb-2"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 12,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
              className: "h-3 w-32 bg-gray-800/50 rounded"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 13,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 11,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 9,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "w-10 h-10 rounded-full bg-gray-800"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 16,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 8,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 7,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
      className: "px-5 mb-6",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "h-48 bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-5",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "h-4 w-32 bg-gray-700 rounded mb-4"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 23,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "h-10 w-40 bg-gray-700 rounded mb-8"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 24,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "flex gap-4",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "h-8 w-20 bg-gray-700 rounded"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 26,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "h-8 w-20 bg-gray-700 rounded"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 27,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 25,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 22,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 21,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
      className: "px-5 mb-6",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "flex gap-3 overflow-hidden",
        children: [1, 2, 3, 4].map(i => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "flex-shrink-0 w-20",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "w-14 h-14 bg-gray-800 rounded-2xl mx-auto mb-2"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 37,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "h-3 w-full bg-gray-800 rounded"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 38,
            columnNumber: 15
          }, undefined)]
        }, i, true, {
          fileName: _jsxFileName,
          lineNumber: 36,
          columnNumber: 13
        }, undefined))
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 34,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 33,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
      className: "px-5 mb-6",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "grid grid-cols-2 gap-3",
        children: [1, 2, 3, 4].map(i => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "bg-gray-900/50 border border-gray-800 rounded-2xl p-4",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "w-8 h-8 bg-gray-800 rounded-lg mb-3"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 49,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "h-6 w-20 bg-gray-800 rounded mb-1"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 50,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "h-3 w-16 bg-gray-800/50 rounded"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 51,
            columnNumber: 15
          }, undefined)]
        }, i, true, {
          fileName: _jsxFileName,
          lineNumber: 48,
          columnNumber: 13
        }, undefined))
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 46,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 45,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
      className: "px-5",
      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "h-5 w-32 bg-gray-800 rounded mb-4"
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 59,
        columnNumber: 9
      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "bg-gray-900/50 border border-gray-800 rounded-2xl p-4 space-y-4",
        children: [1, 2, 3].map(i => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "flex items-center gap-3",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "w-10 h-10 bg-gray-800 rounded-full"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 63,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "flex-1",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
              className: "h-4 w-3/4 bg-gray-800 rounded mb-2"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 65,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
              className: "h-3 w-1/2 bg-gray-800/50 rounded"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 66,
              columnNumber: 17
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 64,
            columnNumber: 15
          }, undefined)]
        }, i, true, {
          fileName: _jsxFileName,
          lineNumber: 62,
          columnNumber: 13
        }, undefined))
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 60,
        columnNumber: 9
      }, undefined)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 58,
      columnNumber: 7
    }, undefined)]
  }, void 0, true, {
    fileName: _jsxFileName,
    lineNumber: 5,
    columnNumber: 5
  }, undefined);
};
_c = DashboardSkeleton;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DashboardSkeleton);
var _c;
__webpack_require__.$Refresh$.register(_c, "DashboardSkeleton");

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ }),

/***/ "./src/components/skeletons/ListSkeleton.js":
/*!**************************************************!*\
  !*** ./src/components/skeletons/ListSkeleton.js ***!
  \**************************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/components/skeletons/ListSkeleton.js";


function ListSkeleton({
  items = 5
}) {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
    className: "space-y-4",
    children: [...Array(items)].map((_, index) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
      className: "bg-white rounded-lg shadow-sm p-4 animate-pulse",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "flex items-start gap-4",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 10,
          columnNumber: 13
        }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "flex-1 space-y-2",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "h-5 bg-gray-200 rounded w-3/4"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 14,
            columnNumber: 15
          }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "h-4 bg-gray-200 rounded w-full"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 15,
            columnNumber: 15
          }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
            className: "h-3 bg-gray-200 rounded w-1/2"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 16,
            columnNumber: 15
          }, this)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 13,
          columnNumber: 13
        }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "w-20 h-8 bg-gray-200 rounded"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 20,
          columnNumber: 13
        }, this)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 8,
        columnNumber: 11
      }, this)
    }, index, false, {
      fileName: _jsxFileName,
      lineNumber: 7,
      columnNumber: 9
    }, this))
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 5,
    columnNumber: 5
  }, this);
}
_c = ListSkeleton;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ListSkeleton);
var _c;
__webpack_require__.$Refresh$.register(_c, "ListSkeleton");

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ }),

/***/ "./src/components/skeletons/StatsSkeleton.js":
/*!***************************************************!*\
  !*** ./src/components/skeletons/StatsSkeleton.js ***!
  \***************************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/components/skeletons/StatsSkeleton.js";


function StatsSkeleton({
  count = 4
}) {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [...Array(count)].map((_, index) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
      className: "bg-white rounded-lg shadow-sm p-6 animate-pulse",
      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "flex items-center justify-between mb-4",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "h-4 bg-gray-200 rounded w-1/2"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 10,
          columnNumber: 13
        }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "h-10 w-10 bg-gray-200 rounded-full"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 11,
          columnNumber: 13
        }, this)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 9,
        columnNumber: 11
      }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "h-10 bg-gray-200 rounded w-3/4 mb-3"
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 15,
        columnNumber: 11
      }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
        className: "space-y-2",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "h-3 bg-gray-200 rounded w-full"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 19,
          columnNumber: 13
        }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
          className: "h-3 bg-gray-200 rounded w-2/3"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 20,
          columnNumber: 13
        }, this)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 18,
        columnNumber: 11
      }, this)]
    }, index, true, {
      fileName: _jsxFileName,
      lineNumber: 7,
      columnNumber: 9
    }, this))
  }, void 0, false);
}
_c = StatsSkeleton;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (StatsSkeleton);
var _c;
__webpack_require__.$Refresh$.register(_c, "StatsSkeleton");

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ }),

/***/ "./src/components/skeletons/TableSkeleton.js":
/*!***************************************************!*\
  !*** ./src/components/skeletons/TableSkeleton.js ***!
  \***************************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/components/skeletons/TableSkeleton.js";


function TableSkeleton({
  rows = 5,
  columns = 5
}) {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
    className: "bg-white rounded-lg shadow-sm overflow-hidden",
    children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
      className: "overflow-x-auto",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("table", {
        className: "min-w-full divide-y divide-gray-200",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("thead", {
          className: "bg-gray-50",
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("tr", {
            children: [...Array(columns)].map((_, index) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("th", {
              className: "px-6 py-3",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
                className: "h-4 bg-gray-200 rounded animate-pulse"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 13,
                columnNumber: 19
              }, this)
            }, index, false, {
              fileName: _jsxFileName,
              lineNumber: 12,
              columnNumber: 17
            }, this))
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 10,
            columnNumber: 13
          }, this)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 9,
          columnNumber: 11
        }, this), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("tbody", {
          className: "bg-white divide-y divide-gray-200",
          children: [...Array(rows)].map((_, rowIndex) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("tr", {
            children: [...Array(columns)].map((_, colIndex) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("td", {
              className: "px-6 py-4",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxDEV)("div", {
                className: "h-4 bg-gray-200 rounded animate-pulse"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 25,
                columnNumber: 21
              }, this)
            }, colIndex, false, {
              fileName: _jsxFileName,
              lineNumber: 24,
              columnNumber: 19
            }, this))
          }, rowIndex, false, {
            fileName: _jsxFileName,
            lineNumber: 22,
            columnNumber: 15
          }, this))
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 20,
          columnNumber: 11
        }, this)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 7,
        columnNumber: 9
      }, this)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 6,
      columnNumber: 7
    }, this)
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 5,
    columnNumber: 5
  }, this);
}
_c = TableSkeleton;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TableSkeleton);
var _c;
__webpack_require__.$Refresh$.register(_c, "TableSkeleton");

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ }),

/***/ "./src/components/skeletons/index.js":
/*!*******************************************!*\
  !*** ./src/components/skeletons/index.js ***!
  \*******************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CardSkeleton: () => (/* reexport safe */ _CardSkeleton__WEBPACK_IMPORTED_MODULE_0__["default"]),
/* harmony export */   ChartSkeleton: () => (/* reexport safe */ _ChartSkeleton__WEBPACK_IMPORTED_MODULE_4__["default"]),
/* harmony export */   DashboardSkeleton: () => (/* reexport safe */ _DashboardSkeleton__WEBPACK_IMPORTED_MODULE_5__["default"]),
/* harmony export */   ListSkeleton: () => (/* reexport safe */ _ListSkeleton__WEBPACK_IMPORTED_MODULE_2__["default"]),
/* harmony export */   StatsSkeleton: () => (/* reexport safe */ _StatsSkeleton__WEBPACK_IMPORTED_MODULE_3__["default"]),
/* harmony export */   TableSkeleton: () => (/* reexport safe */ _TableSkeleton__WEBPACK_IMPORTED_MODULE_1__["default"])
/* harmony export */ });
/* harmony import */ var _CardSkeleton__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./CardSkeleton */ "./src/components/skeletons/CardSkeleton.js");
/* harmony import */ var _TableSkeleton__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./TableSkeleton */ "./src/components/skeletons/TableSkeleton.js");
/* harmony import */ var _ListSkeleton__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./ListSkeleton */ "./src/components/skeletons/ListSkeleton.js");
/* harmony import */ var _StatsSkeleton__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./StatsSkeleton */ "./src/components/skeletons/StatsSkeleton.js");
/* harmony import */ var _ChartSkeleton__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./ChartSkeleton */ "./src/components/skeletons/ChartSkeleton.js");
/* harmony import */ var _DashboardSkeleton__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./DashboardSkeleton */ "./src/components/skeletons/DashboardSkeleton.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");






// ProductCardSkeleton removed - marketplace deprecated


const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ }),

/***/ "./src/components/ui/input.jsx":
/*!*************************************!*\
  !*** ./src/components/ui/input.jsx ***!
  \*************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Input: () => (/* binding */ Input)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _lib_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @/lib/utils */ "./src/lib/utils.js");
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/components/ui/input.jsx";



const Input = /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0__.forwardRef(_c = ({
  className,
  type,
  ...props
}, ref) => {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxDEV)("input", {
    type: type,
    className: (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.cn)("flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className),
    ref: ref,
    ...props
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 7,
    columnNumber: 5
  }, undefined);
});
_c2 = Input;
Input.displayName = "Input";

var _c, _c2;
__webpack_require__.$Refresh$.register(_c, "Input$React.forwardRef");
__webpack_require__.$Refresh$.register(_c2, "Input");

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ }),

/***/ "./src/pages/DashboardModern.js":
/*!**************************************!*\
  !*** ./src/pages/DashboardModern.js ***!
  \**************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_router_dom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router-dom */ "./node_modules/react-router/dist/development/chunk-OIYGIGL5.mjs");
/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! axios */ "./node_modules/axios/lib/axios.js");
/* harmony import */ var sonner__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sonner */ "./node_modules/sonner/dist/index.mjs");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! framer-motion */ "./node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/house.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/sparkles.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/arrow-up-right.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/banknote.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/building-2.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/chevron-right.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/credit-card.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/crown.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/eye-off.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/eye.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/gamepad-2.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/gift.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/moon.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/shield-alert.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/shopping-bag.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/star.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/sun.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/sunrise.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/sunset.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/trending-up.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/user-plus.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/user.js");
/* harmony import */ var _components_PRCExpiryTimer__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! @/components/PRCExpiryTimer */ "./src/components/PRCExpiryTimer.js");
/* harmony import */ var _components_ProfileCompletionPopup__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! @/components/ProfileCompletionPopup */ "./src/components/ProfileCompletionPopup.js");
/* harmony import */ var _components_ProfileCompletionComponents__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! @/components/ProfileCompletionComponents */ "./src/components/ProfileCompletionComponents.jsx");
/* harmony import */ var _components_AIChatbotEnhanced__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! @/components/AIChatbotEnhanced */ "./src/components/AIChatbotEnhanced.js");
/* harmony import */ var _contexts_LanguageContext__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! @/contexts/LanguageContext */ "./src/contexts/LanguageContext.js");
/* harmony import */ var _components_skeletons__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! @/components/skeletons */ "./src/components/skeletons/index.js");
/* harmony import */ var _components_InfoTooltip__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! @/components/InfoTooltip */ "./src/components/InfoTooltip.jsx");
/* harmony import */ var _components_NotificationBell__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! @/components/NotificationBell */ "./src/components/NotificationBell.js");
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/pages/DashboardModern.js",
  _s = __webpack_require__.$Refresh$.signature();















const API = `${"https://dynamic-rate-system-1.preview.emergentagent.com"}/api`;

// Get time-based greeting with emoji
const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      text: 'Good Morning',
      emoji: '🌅',
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_22__["default"],
      color: 'from-orange-400 to-yellow-400'
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      text: 'Good Afternoon',
      emoji: '☀️',
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_21__["default"],
      color: 'from-yellow-400 to-orange-400'
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      text: 'Good Evening',
      emoji: '🌆',
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_23__["default"],
      color: 'from-purple-400 to-pink-400'
    };
  } else {
    return {
      text: 'Good Night',
      emoji: '🌙',
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_17__["default"],
      color: 'from-indigo-400 to-purple-400'
    };
  }
};

// Bottom Navigation Item
const BottomNavItem = ({
  icon: Icon,
  label,
  isActive,
  onClick
}) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
  onClick: onClick,
  className: `flex flex-col items-center justify-center py-2 px-3 transition-all ${isActive ? 'text-amber-500' : 'text-gray-400'}`,
  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(Icon, {
    className: `w-5 h-5 mb-1 ${isActive ? 'text-amber-500' : ''}`
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 66,
    columnNumber: 5
  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
    className: "text-[10px] font-medium",
    children: label
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 67,
    columnNumber: 5
  }, undefined)]
}, void 0, true, {
  fileName: _jsxFileName,
  lineNumber: 60,
  columnNumber: 3
}, undefined);
_c = BottomNavItem;
const DashboardModern = ({
  user,
  onLogout
}) => {
  _s();
  var _user$email, _user$email2, _stats$subscriptionPl, _stats$subscriptionPl2, _stats$subscriptionPl3, _stats$subscriptionPl4;
  const navigate = (0,react_router_dom__WEBPACK_IMPORTED_MODULE_1__.useNavigate)();
  const {
    t
  } = (0,_contexts_LanguageContext__WEBPACK_IMPORTED_MODULE_31__.useLanguage)();

  // Time-based greeting
  const greeting = (0,react__WEBPACK_IMPORTED_MODULE_0__.useMemo)(() => getTimeGreeting(), []);
  const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
  const [userData, setUserData] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [showBalance, setShowBalance] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
  const [recentTransactions, setRecentTransactions] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  // globalActivity and activityTab moved to separate Activity page
  const [showProfilePopup, setShowProfilePopup] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [activeTab, setActiveTab] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('home');
  const [miningHistory, setMiningHistory] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [birthdayGreeting, setBirthdayGreeting] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);

  // Stats
  const [stats, setStats] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)({
    prcBalance: 0,
    totalMined: 0,
    totalRedeemed: 0,
    referralCount: 0,
    subscriptionPlan: 'explorer',
    subscriptionExpiry: null,
    subscriptionStart: null
  });

  // Helper function to get plan display name
  const getPlanDisplayName = plan => {
    const planNames = {
      'explorer': 'Explorer',
      'startup': 'Startup',
      'growth': 'Growth',
      'elite': 'Elite'
    };
    return planNames[plan] || 'Explorer';
  };

  // Check if user has a paid plan
  const hasPaidPlan = ['startup', 'growth', 'elite'].includes(stats.subscriptionPlan);

  // Fetch dashboard data - optimized with parallel requests
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (user !== null && user !== void 0 && user.uid) {
      fetchDashboardData();
    }
  }, [user]);
  const fetchDashboardData = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setLoading(false);
      console.warn('Dashboard data fetch timeout - using fallback data');
    }, 8000); // 8 second timeout

    try {
      setLoading(true);

      // Try combined API first (faster - single request)
      try {
        var _combinedRes$data;
        const combinedRes = await axios__WEBPACK_IMPORTED_MODULE_2__["default"].get(`${API}/user/${user.uid}/dashboard`);
        if ((_combinedRes$data = combinedRes.data) !== null && _combinedRes$data !== void 0 && _combinedRes$data.user) {
          const userData = combinedRes.data.user;
          const miningData = combinedRes.data.mining;
          setUserData({
            ...userData,
            mining_active: miningData.active,
            mining_session_end: miningData.session_end,
            mining_start_time: miningData.session_start
          });
          setStats({
            prcBalance: userData.prc_balance || 0,
            totalMined: userData.total_mined || 0,
            totalRedeemed: userData.total_redeemed || 0,
            referralCount: userData.referral_count || 0,
            subscriptionPlan: userData.subscription_plan || 'explorer',
            subscriptionExpiry: userData.subscription_expiry || null,
            subscriptionStart: userData.subscription_start || null
          });

          // Set recent activity from combined response
          const activities = combinedRes.data.recent_activity || [];
          setRecentTransactions(activities.slice(0, 5));
          clearTimeout(timeoutId);
          setLoading(false);
          return; // Success - exit early
        }
      } catch (combinedError) {
        console.log('Combined API failed, trying fallback');
      }

      // Fallback to individual API calls
      const [userResult, activityResult] = await Promise.allSettled([axios__WEBPACK_IMPORTED_MODULE_2__["default"].get(`${API}/user/${user.uid}`), axios__WEBPACK_IMPORTED_MODULE_2__["default"].get(`${API}/user/${user.uid}/recent-activity?limit=10`)]);

      // Process user data
      if (userResult.status === 'fulfilled') {
        const fetchedUserData = userResult.value.data;
        setUserData(fetchedUserData);
        setMiningHistory(fetchedUserData.mining_history || []);
        setStats({
          prcBalance: fetchedUserData.prc_balance || 0,
          totalMined: fetchedUserData.total_mined || 0,
          totalRedeemed: fetchedUserData.total_redeemed || 0,
          referralCount: fetchedUserData.referral_count || 0,
          subscriptionPlan: fetchedUserData.subscription_plan || 'explorer',
          subscriptionExpiry: fetchedUserData.subscription_expiry || null,
          subscriptionStart: fetchedUserData.subscription_start || fetchedUserData.vip_activation_date || null
        });
      } else {
        // Fallback to user prop data
        setUserData(user);
        setStats({
          prcBalance: user.prc_balance || 0,
          totalMined: user.total_mined || 0,
          totalRedeemed: user.total_redeemed || 0,
          referralCount: user.referral_count || 0,
          subscriptionPlan: user.subscription_plan || 'explorer',
          subscriptionExpiry: user.subscription_expiry || null,
          subscriptionStart: user.subscription_start || user.vip_activation_date || null
        });
      }

      // Process activity data (for recent transactions only, full activity moved to /activity page)
      if (activityResult.status === 'fulfilled') {
        const activities = activityResult.value.data.activities || [];
        const formattedActivities = activities.map(activity => ({
          type: activity.type,
          description: activity.description,
          amount: activity.amount || 0,
          timestamp: activity.timestamp || new Date().toISOString(),
          icon: activity.icon
        }));
        setRecentTransactions(formattedActivities);
      }

      // Check profile completion
      const currentUser = userResult.status === 'fulfilled' ? userResult.value.data : user;
      const profileComplete = (currentUser === null || currentUser === void 0 ? void 0 : currentUser.name) && (currentUser === null || currentUser === void 0 ? void 0 : currentUser.phone) && (currentUser === null || currentUser === void 0 ? void 0 : currentUser.city);
      if (!profileComplete && !localStorage.getItem('profile_popup_dismissed')) {
        setShowProfilePopup(true);
      }

      // Check for birthday (non-blocking)
      try {
        const birthdayResponse = await axios__WEBPACK_IMPORTED_MODULE_2__["default"].get(`${API}/user/${user.uid}/birthday-check`);
        if (birthdayResponse.data.is_birthday) {
          setBirthdayGreeting(birthdayResponse.data);
        }
      } catch (bdError) {
        console.log('Birthday check failed');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Use fallback data from user prop
      setUserData(user);
      setStats({
        prcBalance: (user === null || user === void 0 ? void 0 : user.prc_balance) || 0,
        totalMined: (user === null || user === void 0 ? void 0 : user.total_mined) || 0,
        totalRedeemed: (user === null || user === void 0 ? void 0 : user.total_redeemed) || 0,
        referralCount: (user === null || user === void 0 ? void 0 : user.referral_count) || 0,
        subscriptionPlan: (user === null || user === void 0 ? void 0 : user.subscription_plan) || 'explorer',
        subscriptionExpiry: (user === null || user === void 0 ? void 0 : user.subscription_expiry) || null,
        subscriptionStart: (user === null || user === void 0 ? void 0 : user.subscription_start) || (user === null || user === void 0 ? void 0 : user.vip_activation_date) || null
      });
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [user]);
  const handleNavigation = tabName => {
    setActiveTab(tabName);
    const routes = {
      'home': '/dashboard',
      'rewards': '/daily-rewards',
      'game': '/game',
      'profile': '/profile'
    };
    if (routes[tabName]) {
      navigate(routes[tabName]);
    }
  };
  if (loading) {
    return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(_components_skeletons__WEBPACK_IMPORTED_MODULE_32__.DashboardSkeleton, {}, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 264,
      columnNumber: 12
    }, undefined);
  }
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
    className: "min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24",
    children: [showProfilePopup && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(_components_ProfileCompletionPopup__WEBPACK_IMPORTED_MODULE_28__["default"], {
      user: userData,
      onClose: () => {
        setShowProfilePopup(false);
        localStorage.setItem('profile_popup_dismissed', 'true');
      },
      onComplete: () => navigate('/profile')
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 272,
      columnNumber: 9
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
      className: "px-5 pb-4 pt-20",
      style: {
        paddingTop: 'max(5rem, calc(env(safe-area-inset-top, 0px) + 4rem))'
      },
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
        className: "flex items-center justify-between",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "flex items-center gap-2 mb-1",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
              className: "text-lg",
              children: greeting.emoji
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 287,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
              className: `text-transparent bg-clip-text bg-gradient-to-r ${greeting.color} text-sm font-medium`,
              children: greeting.text
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 288,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 286,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("h1", {
            className: "text-white text-xl font-bold",
            children: (userData === null || userData === void 0 ? void 0 : userData.name) || (user === null || user === void 0 ? void 0 : (_user$email = user.email) === null || _user$email === void 0 ? void 0 : _user$email.split('@')[0]) || 'User'
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 292,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 285,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "flex items-center gap-2",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(_components_NotificationBell__WEBPACK_IMPORTED_MODULE_34__["default"], {
            userId: user === null || user === void 0 ? void 0 : user.uid
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 298,
            columnNumber: 13
          }, undefined), hasPaidPlan && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: `px-3 py-1 rounded-full ${stats.subscriptionPlan === 'elite' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : stats.subscriptionPlan === 'growth' ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}`,
            children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
              className: "text-xs font-bold text-black flex items-center gap-1",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_12__["default"], {
                className: "w-3 h-3"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 307,
                columnNumber: 19
              }, undefined), " ", getPlanDisplayName(stats.subscriptionPlan)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 306,
              columnNumber: 17
            }, undefined)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 301,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
            onClick: () => navigate('/profile'),
            className: "w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center",
            children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_26__["default"], {
              className: "w-5 h-5 text-black"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 315,
              columnNumber: 15
            }, undefined)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 311,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 296,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 284,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 283,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
      className: "px-5 mb-6",
      style: {
        perspective: '1500px'
      },
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_4__.motion.div, {
        initial: {
          opacity: 0,
          rotateX: 20
        },
        animate: {
          opacity: 1,
          rotateX: 0
        },
        whileHover: {
          rotateY: 3,
          rotateX: -2,
          scale: 1.01
        },
        transition: {
          duration: 0.6,
          type: "spring"
        },
        className: "relative overflow-hidden rounded-2xl",
        style: {
          background: stats.subscriptionPlan === 'elite' ? 'linear-gradient(145deg, #1a1505 0%, #2d2008 30%, #1f1604 70%, #0d0a02 100%)' : stats.subscriptionPlan === 'growth' ? 'linear-gradient(145deg, #051a10 0%, #082d15 30%, #041f0c 70%, #020d05 100%)' : stats.subscriptionPlan === 'startup' ? 'linear-gradient(145deg, #050d1a 0%, #081a2d 30%, #04101f 70%, #02080d 100%)' : 'linear-gradient(145deg, #1c1c1c 0%, #0d0d0d 30%, #1a1a1a 70%, #0a0a0a 100%)',
          boxShadow: stats.subscriptionPlan === 'elite' ? '0 25px 50px -12px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)' : stats.subscriptionPlan === 'growth' ? '0 25px 50px -12px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)' : stats.subscriptionPlan === 'startup' ? '0 25px 50px -12px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)' : '0 25px 50px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          transformStyle: 'preserve-3d',
          aspectRatio: '1.586',
          border: stats.subscriptionPlan === 'elite' ? '1.5px solid rgba(212, 175, 55, 0.4)' : stats.subscriptionPlan === 'growth' ? '1.5px solid rgba(16, 185, 129, 0.4)' : stats.subscriptionPlan === 'startup' ? '1.5px solid rgba(59, 130, 246, 0.4)' : '1.5px solid rgba(100, 100, 100, 0.3)'
        },
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "absolute inset-0 rounded-2xl pointer-events-none",
          style: {
            background: 'transparent',
            boxShadow: stats.subscriptionPlan === 'elite' ? '0 0 20px rgba(212, 175, 55, 0.2), inset 0 0 20px rgba(212, 175, 55, 0.08)' : stats.subscriptionPlan === 'growth' ? '0 0 20px rgba(16, 185, 129, 0.2), inset 0 0 20px rgba(16, 185, 129, 0.08)' : stats.subscriptionPlan === 'startup' ? '0 0 20px rgba(59, 130, 246, 0.2), inset 0 0 20px rgba(59, 130, 246, 0.08)' : '0 0 10px rgba(100, 100, 100, 0.1)',
            animation: 'borderPulse 3s ease-in-out infinite'
          }
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 356,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "absolute inset-0 overflow-hidden pointer-events-none",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("svg", {
            className: "absolute inset-0 w-full h-full",
            viewBox: "0 0 400 252",
            preserveAspectRatio: "xMidYMid slice",
            style: {
              opacity: 0.35
            },
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("defs", {
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("linearGradient", {
                id: "eliteGradient",
                x1: "0%",
                y1: "0%",
                x2: "100%",
                y2: "100%",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("stop", {
                  offset: "0%",
                  stopColor: "#ffd700"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 382,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("stop", {
                  offset: "50%",
                  stopColor: "#d4af37"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 383,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("stop", {
                  offset: "100%",
                  stopColor: "#b8860b"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 384,
                  columnNumber: 19
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 381,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("linearGradient", {
                id: "growthGradient",
                x1: "0%",
                y1: "0%",
                x2: "100%",
                y2: "100%",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("stop", {
                  offset: "0%",
                  stopColor: "#10b981"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 388,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("stop", {
                  offset: "50%",
                  stopColor: "#059669"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 389,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("stop", {
                  offset: "100%",
                  stopColor: "#047857"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 390,
                  columnNumber: 19
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 387,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("linearGradient", {
                id: "startupGradient",
                x1: "0%",
                y1: "0%",
                x2: "100%",
                y2: "100%",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("stop", {
                  offset: "0%",
                  stopColor: "#3b82f6"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 394,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("stop", {
                  offset: "50%",
                  stopColor: "#2563eb"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 395,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("stop", {
                  offset: "100%",
                  stopColor: "#1d4ed8"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 396,
                  columnNumber: 19
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 393,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("linearGradient", {
                id: "explorerGradient",
                x1: "0%",
                y1: "0%",
                x2: "100%",
                y2: "100%",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("stop", {
                  offset: "0%",
                  stopColor: "#9ca3af"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 400,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("stop", {
                  offset: "50%",
                  stopColor: "#6b7280"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 401,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("stop", {
                  offset: "100%",
                  stopColor: "#4b5563"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 402,
                  columnNumber: 19
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 399,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 379,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("g", {
              fill: "none",
              stroke: `url(#${stats.subscriptionPlan}Gradient)`,
              strokeWidth: "1.2",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              children: [stats.subscriptionPlan === 'elite' && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.Fragment, {
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M50 80 L30 50 L50 65 L70 35 L90 65 L110 50 L90 80 Z",
                  strokeWidth: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 411,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M45 80 L45 90 L95 90 L95 80"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 412,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "70",
                  cy: "60",
                  r: "5",
                  fill: "#d4af37",
                  stroke: "none"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 413,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M320 40 L340 70 L320 100 L300 70 Z"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 415,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M320 55 L330 70 L320 85 L310 70 Z"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 416,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M180 30 L185 45 L200 45 L188 55 L192 70 L180 60 L168 70 L172 55 L160 45 L175 45 Z"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 418,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "220",
                  cy: "50",
                  r: "3"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 419,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "240",
                  cy: "35",
                  r: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 420,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "260",
                  cy: "55",
                  r: "2.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 421,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M0 150 Q50 130 100 150 Q150 170 200 150 Q250 130 300 150 Q350 170 400 150",
                  strokeWidth: "0.8"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 423,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M0 170 Q50 150 100 170 Q150 190 200 170 Q250 150 300 170 Q350 190 400 170",
                  strokeWidth: "0.8"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 424,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M350 180 L350 160 Q350 145 365 145 L375 145 Q390 145 390 160 L390 180"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 426,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M355 180 L385 180 L380 200 L360 200 Z"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 427,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("ellipse", {
                  cx: "60",
                  cy: "200",
                  rx: "25",
                  ry: "6"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 429,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("ellipse", {
                  cx: "60",
                  cy: "193",
                  rx: "25",
                  ry: "6"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 430,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("ellipse", {
                  cx: "60",
                  cy: "186",
                  rx: "25",
                  ry: "6"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 431,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true), stats.subscriptionPlan === 'growth' && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.Fragment, {
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M60 200 L60 120",
                  strokeWidth: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 439,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M60 180 Q40 170 35 150",
                  strokeWidth: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 440,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M60 160 Q80 150 85 130",
                  strokeWidth: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 441,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M60 140 Q45 130 40 115",
                  strokeWidth: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 442,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M60 120 Q70 105 75 90",
                  strokeWidth: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 443,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("ellipse", {
                  cx: "35",
                  cy: "145",
                  rx: "12",
                  ry: "8"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 444,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("ellipse", {
                  cx: "85",
                  cy: "125",
                  rx: "12",
                  ry: "8"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 445,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("ellipse", {
                  cx: "40",
                  cy: "110",
                  rx: "10",
                  ry: "7"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 446,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("ellipse", {
                  cx: "75",
                  cy: "85",
                  rx: "10",
                  ry: "7"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 447,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M180 180 L200 160 L230 170 L260 130 L290 140 L320 80",
                  strokeWidth: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 449,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M310 80 L320 80 L320 90",
                  strokeWidth: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 450,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "180",
                  cy: "180",
                  r: "4",
                  fill: "#10b981",
                  stroke: "none"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 451,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "200",
                  cy: "160",
                  r: "4",
                  fill: "#10b981",
                  stroke: "none"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 452,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "260",
                  cy: "130",
                  r: "4",
                  fill: "#10b981",
                  stroke: "none"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 453,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "320",
                  cy: "80",
                  r: "4",
                  fill: "#10b981",
                  stroke: "none"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 454,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "350",
                  cy: "160",
                  r: "12"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 456,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M345 165 L350 155 L355 165",
                  strokeWidth: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 457,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M350 155 L350 170",
                  strokeWidth: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 458,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M380 200 Q370 180 380 160 Q390 180 380 200"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 460,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M20 60 Q30 40 20 20 Q10 40 20 60"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 461,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true), stats.subscriptionPlan === 'startup' && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.Fragment, {
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M80 180 L60 140 L50 140 L70 80 L90 140 L80 140 Z",
                  strokeWidth: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 469,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M70 80 Q70 60 85 50",
                  strokeWidth: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 470,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M70 80 Q70 60 55 50",
                  strokeWidth: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 471,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "70",
                  cy: "110",
                  r: "8"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 472,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M55 160 L50 180 L60 170"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 473,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M85 160 L90 180 L80 170"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 474,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M65 180 Q70 200 75 180",
                  fill: "#3b82f6",
                  strokeWidth: "1"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 476,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M200 40 L205 55 L220 55 L208 65 L212 80 L200 70 L188 80 L192 65 L180 55 L195 55 Z"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 478,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "250",
                  cy: "60",
                  r: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 479,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "280",
                  cy: "45",
                  r: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 480,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "300",
                  cy: "70",
                  r: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 481,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "160",
                  cy: "80",
                  r: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 482,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M330 100 L310 140 L325 140 L305 180 L340 130 L320 130 L340 100 Z",
                  fill: "none",
                  strokeWidth: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 484,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("ellipse", {
                  cx: "360",
                  cy: "200",
                  rx: "30",
                  ry: "15",
                  strokeDasharray: "5,5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 486,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "360",
                  cy: "200",
                  r: "6",
                  fill: "#3b82f6",
                  stroke: "none"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 487,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "40",
                  cy: "40",
                  r: "15"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 489,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "40",
                  cy: "40",
                  r: "8"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 490,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true), stats.subscriptionPlan === 'explorer' && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.Fragment, {
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "70",
                  cy: "80",
                  r: "35"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 498,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "70",
                  cy: "80",
                  r: "28"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 499,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "70",
                  cy: "80",
                  r: "5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 500,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M70 50 L70 45",
                  strokeWidth: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 501,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M70 110 L70 115",
                  strokeWidth: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 502,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M40 80 L35 80",
                  strokeWidth: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 503,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M100 80 L105 80",
                  strokeWidth: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 504,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M70 80 L55 60",
                  strokeWidth: "2",
                  fill: "#6b7280"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 505,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M70 80 L85 100",
                  strokeWidth: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 506,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M200 200 L250 120 L280 160 L310 100 L380 200 Z",
                  strokeWidth: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 508,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M250 120 L250 200",
                  strokeDasharray: "3,3"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 509,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M150 200 Q180 180 200 190 Q230 200 260 180 Q290 160 310 170",
                  strokeDasharray: "5,5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 511,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "340",
                  cy: "50",
                  r: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 513,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "360",
                  cy: "70",
                  r: "1.5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 514,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("circle", {
                  cx: "380",
                  cy: "45",
                  r: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 515,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M310 100 L310 70",
                  strokeWidth: "2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 517,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                  d: "M310 70 L330 80 L310 90",
                  fill: "#6b7280"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 518,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 406,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 373,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "absolute -right-10 -top-10 w-40 h-40 rounded-full",
            style: {
              background: stats.subscriptionPlan === 'elite' ? 'radial-gradient(circle, rgba(212, 175, 55, 0.25) 0%, transparent 70%)' : stats.subscriptionPlan === 'growth' ? 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)' : stats.subscriptionPlan === 'startup' ? 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(100, 100, 100, 0.15) 0%, transparent 70%)'
            }
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 525,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "absolute -left-10 -bottom-10 w-32 h-32 rounded-full",
            style: {
              background: stats.subscriptionPlan === 'elite' ? 'radial-gradient(circle, rgba(255, 215, 0, 0.2) 0%, transparent 70%)' : stats.subscriptionPlan === 'growth' ? 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)' : stats.subscriptionPlan === 'startup' ? 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(100, 100, 100, 0.1) 0%, transparent 70%)'
            }
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 537,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 372,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "absolute inset-0 opacity-[0.02]",
          style: {
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
          }
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 552,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "absolute top-0 left-0 right-0 h-12 opacity-20",
          style: {
            background: stats.subscriptionPlan === 'elite' ? 'linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.4) 20%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 215, 0, 0.4) 80%, transparent 100%)' : stats.subscriptionPlan === 'growth' ? 'linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.4) 20%, rgba(255, 255, 255, 0.5) 50%, rgba(16, 185, 129, 0.4) 80%, transparent 100%)' : stats.subscriptionPlan === 'startup' ? 'linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.4) 20%, rgba(255, 255, 255, 0.5) 50%, rgba(59, 130, 246, 0.4) 80%, transparent 100%)' : 'linear-gradient(90deg, transparent 0%, rgba(150, 150, 150, 0.3) 20%, rgba(255, 255, 255, 0.4) 50%, rgba(150, 150, 150, 0.3) 80%, transparent 100%)',
            animation: 'shimmer 4s infinite linear'
          }
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 560,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "relative z-10 p-5 h-full flex flex-col justify-between",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "flex items-start justify-between",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "flex items-center",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("img", {
                src: "https://customer-assets.emergentagent.com/job_finance-ai-35/artifacts/tppmh3uy_IMG-20251230-WA0004.jpg",
                alt: "PARAS REWARD",
                className: "h-10 w-auto object-contain rounded",
                style: {
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                }
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 580,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 579,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: `flex items-center gap-1.5 px-3 py-1 rounded-full ${stats.subscriptionPlan === 'elite' ? 'bg-amber-500/20 border border-amber-500/30' : stats.subscriptionPlan === 'growth' ? 'bg-emerald-500/20 border border-emerald-500/30' : stats.subscriptionPlan === 'startup' ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-gray-500/20 border border-gray-500/30'}`,
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_12__["default"], {
                className: `w-3 h-3 ${stats.subscriptionPlan === 'elite' ? 'text-amber-400' : stats.subscriptionPlan === 'growth' ? 'text-emerald-400' : stats.subscriptionPlan === 'startup' ? 'text-blue-400' : 'text-gray-400'}`
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 597,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                className: `text-[10px] font-bold tracking-wide ${stats.subscriptionPlan === 'elite' ? 'text-amber-400' : stats.subscriptionPlan === 'growth' ? 'text-emerald-400' : stats.subscriptionPlan === 'startup' ? 'text-blue-400' : 'text-gray-400'}`,
                children: getPlanDisplayName(stats.subscriptionPlan).toUpperCase()
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 603,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 591,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 577,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "flex-1 flex flex-col justify-center -mt-2",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "flex items-center gap-2 mb-1",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
                onClick: () => setShowBalance(!showBalance),
                className: `transition-colors ${stats.subscriptionPlan === 'elite' ? 'text-gray-600 hover:text-amber-400' : stats.subscriptionPlan === 'growth' ? 'text-gray-600 hover:text-emerald-400' : stats.subscriptionPlan === 'startup' ? 'text-gray-600 hover:text-blue-400' : 'text-gray-600 hover:text-gray-400'}`,
                children: showBalance ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_14__["default"], {
                  className: "w-4 h-4"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 626,
                  columnNumber: 34
                }, undefined) : /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_13__["default"], {
                  className: "w-4 h-4"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 626,
                  columnNumber: 64
                }, undefined)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 617,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                className: "text-gray-500 text-[10px] tracking-widest",
                children: "BALANCE"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 628,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(_components_InfoTooltip__WEBPACK_IMPORTED_MODULE_33__.InfoTooltip, {
                children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                  children: "Your available PRC. Use it for bill payments, vouchers, or marketplace purchases. 10 PRC = \u20B91"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 630,
                  columnNumber: 19
                }, undefined)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 629,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 616,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "flex items-baseline gap-2",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                className: "text-4xl font-black tracking-tight",
                style: {
                  background: stats.subscriptionPlan === 'elite' ? 'linear-gradient(180deg, #ffd700 0%, #f5f5f5 40%, #ffd700 100%)' : stats.subscriptionPlan === 'growth' ? 'linear-gradient(180deg, #10b981 0%, #f5f5f5 40%, #10b981 100%)' : stats.subscriptionPlan === 'startup' ? 'linear-gradient(180deg, #3b82f6 0%, #f5f5f5 40%, #3b82f6 100%)' : 'linear-gradient(180deg, #9ca3af 0%, #f5f5f5 40%, #9ca3af 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: stats.subscriptionPlan === 'elite' ? '0 2px 10px rgba(255, 215, 0, 0.2)' : stats.subscriptionPlan === 'growth' ? '0 2px 10px rgba(16, 185, 129, 0.2)' : stats.subscriptionPlan === 'startup' ? '0 2px 10px rgba(59, 130, 246, 0.2)' : '0 2px 10px rgba(100, 100, 100, 0.1)'
                },
                children: showBalance ? stats.prcBalance.toFixed(2) : '••••••'
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 634,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                className: `text-lg font-semibold ${stats.subscriptionPlan === 'elite' ? 'text-amber-500/80' : stats.subscriptionPlan === 'growth' ? 'text-emerald-500/80' : stats.subscriptionPlan === 'startup' ? 'text-blue-500/80' : 'text-gray-500/80'}`,
                children: "PRC"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 657,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 633,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 615,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "flex items-end justify-between",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                className: "text-gray-600 text-[8px] tracking-widest mb-0.5",
                children: "CARD HOLDER"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 669,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                className: "text-white text-sm font-semibold tracking-wide uppercase truncate max-w-[180px]",
                children: (userData === null || userData === void 0 ? void 0 : userData.name) || (user === null || user === void 0 ? void 0 : (_user$email2 = user.email) === null || _user$email2 === void 0 ? void 0 : _user$email2.split('@')[0]) || 'USER'
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 670,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 668,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "text-right",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                className: "flex items-center gap-1 justify-end",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                  className: "text-gray-600 text-[8px] tracking-widest mb-0.5",
                  children: "MULTIPLIER"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 676,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(_components_InfoTooltip__WEBPACK_IMPORTED_MODULE_33__.InfoTooltip, {
                  children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                    children: "Mining speed multiplier based on your plan. Elite: 3x, Growth: 2x, Startup: 1.5x, Explorer: 1x"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 678,
                    columnNumber: 21
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 677,
                  columnNumber: 19
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 675,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                className: `text-sm font-bold ${stats.subscriptionPlan === 'elite' ? 'text-amber-400' : stats.subscriptionPlan === 'growth' ? 'text-emerald-400' : stats.subscriptionPlan === 'startup' ? 'text-blue-400' : 'text-gray-500'}`,
                children: stats.subscriptionPlan === 'elite' ? '3.0x' : stats.subscriptionPlan === 'growth' ? '2.0x' : stats.subscriptionPlan === 'startup' ? '1.5x' : '1.0x'
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 681,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 674,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 667,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "absolute top-5 right-5 flex items-center gap-2",
            children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("svg", {
              width: "20",
              height: "20",
              viewBox: "0 0 24 24",
              fill: "none",
              className: "opacity-40",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                d: "M12 2C10.5 2 9 2.5 7.5 3.5",
                stroke: stats.subscriptionPlan === 'elite' ? '#FFD700' : stats.subscriptionPlan === 'growth' ? '#10b981' : stats.subscriptionPlan === 'startup' ? '#3b82f6' : '#9ca3af',
                strokeWidth: "2",
                strokeLinecap: "round"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 697,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                d: "M12 6C11 6 10 6.3 9 7",
                stroke: stats.subscriptionPlan === 'elite' ? '#FFD700' : stats.subscriptionPlan === 'growth' ? '#10b981' : stats.subscriptionPlan === 'startup' ? '#3b82f6' : '#9ca3af',
                strokeWidth: "2",
                strokeLinecap: "round"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 702,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("path", {
                d: "M12 10C11.5 10 11 10.2 10.5 10.5",
                stroke: stats.subscriptionPlan === 'elite' ? '#FFD700' : stats.subscriptionPlan === 'growth' ? '#10b981' : stats.subscriptionPlan === 'startup' ? '#3b82f6' : '#9ca3af',
                strokeWidth: "2",
                strokeLinecap: "round"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 707,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 696,
              columnNumber: 15
            }, undefined)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 695,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 575,
          columnNumber: 11
        }, undefined), !hasPaidPlan && stats.prcBalance > 0 && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "relative z-10 px-5 pb-4 -mt-2",
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(_components_PRCExpiryTimer__WEBPACK_IMPORTED_MODULE_27__["default"], {
            userId: user === null || user === void 0 ? void 0 : user.uid,
            prcBalance: stats.prcBalance,
            miningHistory: miningHistory
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 719,
            columnNumber: 15
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 718,
          columnNumber: 13
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 323,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 322,
      columnNumber: 7
    }, undefined), ['startup', 'growth', 'elite'].includes((_stats$subscriptionPl = stats.subscriptionPlan) === null || _stats$subscriptionPl === void 0 ? void 0 : _stats$subscriptionPl.toLowerCase()) && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
      className: "px-5 mb-4",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_4__.motion.div, {
        initial: {
          opacity: 0,
          y: 10
        },
        animate: {
          opacity: 1,
          y: 0
        },
        className: `rounded-xl p-4 border ${stats.subscriptionPlan === 'elite' ? 'bg-gradient-to-r from-amber-900/30 to-yellow-900/30 border-amber-500/30' : stats.subscriptionPlan === 'growth' ? 'bg-gradient-to-r from-emerald-900/30 to-green-900/30 border-emerald-500/30' : 'bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-blue-500/30'}`,
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "flex items-center justify-between mb-3",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "flex items-center gap-2",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_12__["default"], {
              className: `w-5 h-5 ${stats.subscriptionPlan === 'elite' ? 'text-amber-400' : stats.subscriptionPlan === 'growth' ? 'text-emerald-400' : 'text-blue-400'}`
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 743,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
              className: `font-bold ${stats.subscriptionPlan === 'elite' ? 'text-amber-400' : stats.subscriptionPlan === 'growth' ? 'text-emerald-400' : 'text-blue-400'}`,
              children: [((_stats$subscriptionPl2 = stats.subscriptionPlan) === null || _stats$subscriptionPl2 === void 0 ? void 0 : _stats$subscriptionPl2.charAt(0).toUpperCase()) + ((_stats$subscriptionPl3 = stats.subscriptionPlan) === null || _stats$subscriptionPl3 === void 0 ? void 0 : _stats$subscriptionPl3.slice(1)), " ", t('planActive')]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 748,
              columnNumber: 17
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 742,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
            className: `text-xs px-2 py-1 rounded-full ${stats.subscriptionExpiry && new Date(stats.subscriptionExpiry) > new Date() ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`,
            children: stats.subscriptionExpiry && new Date(stats.subscriptionExpiry) > new Date() ? `✓ ${t('active')}` : `⚠ ${t('expired')}`
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 756,
            columnNumber: 15
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 741,
          columnNumber: 13
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "grid grid-cols-3 gap-3 text-center",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
              className: "text-gray-500 text-[10px] uppercase tracking-wider",
              children: t('started')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 767,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
              className: "text-white text-sm font-medium",
              children: stats.subscriptionStart ? new Date(stats.subscriptionStart).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: '2-digit'
              }) : '—'
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 768,
              columnNumber: 17
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 766,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
              className: "text-gray-500 text-[10px] uppercase tracking-wider",
              children: t('expires')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 775,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
              className: "text-white text-sm font-medium",
              children: stats.subscriptionExpiry ? new Date(stats.subscriptionExpiry).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: '2-digit'
              }) : '—'
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 776,
              columnNumber: 17
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 774,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
              className: "text-gray-500 text-[10px] uppercase tracking-wider",
              children: t('daysLeft')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 783,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
              className: `text-sm font-bold ${stats.subscriptionExpiry && Math.ceil((new Date(stats.subscriptionExpiry) - new Date()) / (1000 * 60 * 60 * 24)) <= 7 ? 'text-red-400' : 'text-green-400'}`,
              children: stats.subscriptionExpiry ? Math.max(0, Math.ceil((new Date(stats.subscriptionExpiry) - new Date()) / (1000 * 60 * 60 * 24))) : '—'
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 784,
              columnNumber: 17
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 782,
            columnNumber: 15
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 765,
          columnNumber: 13
        }, undefined), stats.subscriptionExpiry && Math.ceil((new Date(stats.subscriptionExpiry) - new Date()) / (1000 * 60 * 60 * 24)) <= 7 && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
          onClick: () => navigate('/subscription'),
          className: "w-full mt-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors",
          children: t('planExpiresSoonRenew')
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 798,
          columnNumber: 15
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 732,
        columnNumber: 11
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 731,
      columnNumber: 9
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
      className: "px-5 mb-4",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(_components_ProfileCompletionComponents__WEBPACK_IMPORTED_MODULE_29__.ProfileCompletionRing, {
        user: user,
        userData: userData,
        onComplete: () => navigate('/profile')
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 811,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 810,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
      className: "px-5 mb-4"
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 819,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
      className: "px-5 mb-4",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
        className: "grid grid-cols-4 gap-3",
        children: [{
          icon: lucide_react__WEBPACK_IMPORTED_MODULE_20__["default"],
          label: t('rewards'),
          route: '/daily-rewards',
          gradient: 'from-purple-600 to-violet-700'
        }, {
          icon: lucide_react__WEBPACK_IMPORTED_MODULE_15__["default"],
          label: t('play'),
          route: '/game',
          gradient: 'from-pink-600 to-rose-700'
        }, {
          icon: lucide_react__WEBPACK_IMPORTED_MODULE_25__["default"],
          label: t('invite'),
          route: '/referrals',
          gradient: 'from-blue-600 to-indigo-700'
        }, {
          icon: lucide_react__WEBPACK_IMPORTED_MODULE_19__["default"],
          label: t('shop'),
          route: '/marketplace',
          gradient: 'from-emerald-600 to-teal-700'
        }].map((action, index) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_4__.motion.button, {
          initial: {
            opacity: 0,
            y: 20
          },
          animate: {
            opacity: 1,
            y: 0
          },
          transition: {
            delay: index * 0.05
          },
          onClick: () => navigate(action.route),
          className: `flex flex-col items-center justify-center p-3 rounded-xl bg-gradient-to-br ${action.gradient} shadow-lg`,
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(action.icon, {
            className: "w-5 h-5 text-white mb-1"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 839,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
            className: "text-[10px] font-semibold text-white",
            children: action.label
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 840,
            columnNumber: 15
          }, undefined)]
        }, action.route, true, {
          fileName: _jsxFileName,
          lineNumber: 831,
          columnNumber: 13
        }, undefined))
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 824,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 823,
      columnNumber: 7
    }, undefined), !['startup', 'growth', 'elite'].includes((_stats$subscriptionPl4 = stats.subscriptionPlan) === null || _stats$subscriptionPl4 === void 0 ? void 0 : _stats$subscriptionPl4.toLowerCase()) && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
      className: "mb-4 overflow-hidden",
      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
        className: "px-5 flex gap-3 overflow-x-auto scrollbar-hide pb-2",
        style: {
          scrollSnapType: 'x mandatory'
        },
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_4__.motion.div, {
          initial: {
            opacity: 0,
            x: 20
          },
          animate: {
            opacity: 1,
            x: 0
          },
          onClick: () => navigate('/subscription'),
          className: "flex-shrink-0 w-[85%] cursor-pointer",
          style: {
            scrollSnapAlign: 'start'
          },
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "relative overflow-hidden rounded-xl p-4",
            style: {
              background: 'linear-gradient(135deg, #92400e 0%, #78350f 50%, #451a03 100%)'
            },
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "absolute top-0 right-0 w-24 h-24 bg-yellow-400/20 rounded-full blur-2xl"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 864,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "relative z-10 flex items-center justify-between",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                className: "flex items-center gap-3",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                  className: "w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center",
                  children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_12__["default"], {
                    className: "w-5 h-5 text-yellow-400"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 868,
                    columnNumber: 23
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 867,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                    className: "text-yellow-400 font-bold text-sm",
                    children: t('upgradeNow')
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 871,
                    columnNumber: 23
                  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                    className: "text-amber-200/60 text-xs",
                    children: [t('startupElitePlan'), " \u2022 ", t('unlockRedeemServices')]
                  }, void 0, true, {
                    fileName: _jsxFileName,
                    lineNumber: 872,
                    columnNumber: 23
                  }, undefined)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 870,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 866,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                className: "text-right",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                  className: "bg-yellow-400 text-black px-3 py-1.5 rounded-lg font-bold text-sm",
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                    className: "line-through text-black/50 text-xs mr-1",
                    children: "\u20B9500"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 877,
                    columnNumber: 23
                  }, undefined), "\u20B9299"]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 876,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                  className: "text-yellow-400/80 text-xs mt-0.5",
                  children: "40% OFF"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 880,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 875,
                columnNumber: 19
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 865,
              columnNumber: 17
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 858,
            columnNumber: 15
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 851,
          columnNumber: 13
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_4__.motion.div, {
          initial: {
            opacity: 0,
            x: 20
          },
          animate: {
            opacity: 1,
            x: 0
          },
          transition: {
            delay: 0.1
          },
          className: "flex-shrink-0 w-[85%]",
          style: {
            scrollSnapAlign: 'start'
          },
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "bg-gray-900/80 rounded-xl p-4 border border-gray-800",
            children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "flex items-center justify-between",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                className: "flex items-center gap-3",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                  className: "w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center",
                  children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_24__["default"], {
                    className: "w-5 h-5 text-purple-400"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 898,
                    columnNumber: 23
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 897,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                    className: "text-white font-bold text-sm",
                    children: t('yourProgress')
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 901,
                    columnNumber: 23
                  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                    className: "text-gray-400 text-xs",
                    children: [t('total'), ": ", stats.totalMined.toFixed(0), " PRC"]
                  }, void 0, true, {
                    fileName: _jsxFileName,
                    lineNumber: 902,
                    columnNumber: 23
                  }, undefined)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 900,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 896,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                className: "text-right",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                  className: "text-emerald-400 font-bold text-lg",
                  children: stats.referralCount
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 906,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                  className: "text-gray-500 text-xs",
                  children: t('referrals')
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 907,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 905,
                columnNumber: 19
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 895,
              columnNumber: 17
            }, undefined)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 894,
            columnNumber: 15
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 887,
          columnNumber: 13
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 849,
        columnNumber: 11
      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
        className: "flex justify-center gap-1.5 mt-1",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "w-4 h-1 bg-amber-500 rounded-full"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 915,
          columnNumber: 13
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "w-1 h-1 bg-gray-600 rounded-full"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 916,
          columnNumber: 13
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 914,
        columnNumber: 11
      }, undefined)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 848,
      columnNumber: 9
    }, undefined), birthdayGreeting && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
      className: "px-5 mb-6",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_4__.motion.div, {
        initial: {
          opacity: 0,
          scale: 0.9
        },
        animate: {
          opacity: 1,
          scale: 1
        },
        className: "relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "absolute inset-0 overflow-hidden",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "absolute -top-10 -right-10 w-40 h-40 bg-yellow-400/30 rounded-full blur-2xl animate-pulse"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 930,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "absolute -bottom-10 -left-10 w-32 h-32 bg-pink-400/30 rounded-full blur-2xl animate-pulse"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 931,
            columnNumber: 15
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 929,
          columnNumber: 13
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "relative z-10 text-center",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "text-4xl mb-2",
            children: "\uD83C\uDF82\uD83C\uDF89\uD83C\uDF81"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 934,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("h3", {
            className: "text-white text-xl font-bold mb-1",
            children: birthdayGreeting.message
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 935,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
            className: "text-white/80 text-sm",
            children: birthdayGreeting.greeting
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 936,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
            className: "text-yellow-300 text-xs mt-2 font-medium",
            children: birthdayGreeting.bonus_message
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 937,
            columnNumber: 15
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 933,
          columnNumber: 13
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 924,
        columnNumber: 11
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 923,
      columnNumber: 9
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
      className: "px-5 mb-6",
      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
        className: "flex items-center justify-between mb-4",
        children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("h2", {
          className: "text-white text-lg font-bold flex items-center gap-2",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_6__["default"], {
            className: "w-5 h-5 text-purple-400"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 947,
            columnNumber: 13
          }, undefined), t('services')]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 946,
          columnNumber: 11
        }, undefined)
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 945,
        columnNumber: 9
      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
        className: "bg-gradient-to-br from-blue-900/40 to-indigo-900/30 rounded-2xl border border-blue-500/30 p-4 mb-4",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "flex items-center justify-between mb-4",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("h3", {
            className: "font-semibold text-white flex items-center gap-2",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_11__["default"], {
              className: "w-5 h-5 text-blue-400"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 956,
              columnNumber: 15
            }, undefined), t('billPayments')]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 955,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
            onClick: () => navigate('/redeem'),
            className: "text-blue-400 text-xs font-medium flex items-center gap-1",
            children: [t('viewAll'), " ", /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_10__["default"], {
              className: "w-4 h-4"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 963,
              columnNumber: 30
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 959,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 954,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "grid grid-cols-5 gap-2",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
            onClick: () => navigate('/redeem?service=mobile_recharge'),
            className: "flex flex-col items-center gap-1.5 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                className: "text-xl",
                children: "\uD83D\uDCF1"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 972,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 971,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
              className: "text-[10px] text-gray-300 text-center",
              children: t('mobile')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 974,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 967,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
            onClick: () => navigate('/redeem?service=dth'),
            className: "flex flex-col items-center gap-1.5 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                className: "text-xl",
                children: "\uD83D\uDCFA"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 981,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 980,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
              className: "text-[10px] text-gray-300 text-center",
              children: t('dth')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 983,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 976,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
            onClick: () => navigate('/redeem?service=electricity'),
            className: "flex flex-col items-center gap-1.5 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                className: "text-xl",
                children: "\u26A1"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 990,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 989,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
              className: "text-[10px] text-gray-300 text-center",
              children: t('electricity')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 992,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 985,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
            onClick: () => navigate('/redeem?service=dmt'),
            className: "flex flex-col items-center gap-1.5 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                className: "text-xl",
                children: "\uD83C\uDFE6"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 999,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 998,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
              className: "text-[10px] text-gray-300 text-center",
              children: "Bank A/C"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1001,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 994,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
            onClick: () => navigate('/redeem?service=emi'),
            className: "flex flex-col items-center gap-1.5 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                className: "text-xl",
                children: "\uD83C\uDFDB\uFE0F"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1008,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1007,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
              className: "text-[10px] text-gray-300 text-center",
              children: "Pay EMI"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1010,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1003,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 966,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 953,
        columnNumber: 9
      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
        className: "grid grid-cols-2 gap-3",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
          onClick: () => navigate('/gift-vouchers'),
          className: "bg-gradient-to-br from-pink-900/40 to-rose-900/30 rounded-2xl border border-pink-500/30 p-4 text-left hover:border-pink-500/50 transition-all",
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "flex flex-col items-center text-center",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mb-3 shadow-lg",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_16__["default"], {
                className: "w-7 h-7 text-white"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1024,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1023,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("h3", {
              className: "font-bold text-white text-sm mb-1",
              children: t('giftVouchers')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1026,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
              className: "text-[10px] text-gray-400",
              children: t('amazonFlipkartMore')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1027,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "mt-2 px-3 py-1 bg-pink-500 text-white text-[10px] font-semibold rounded-full",
              children: t('redeem')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1028,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1022,
            columnNumber: 13
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 1018,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
          onClick: () => navigate('/marketplace'),
          className: "bg-gradient-to-br from-purple-900/40 to-indigo-900/30 rounded-2xl border border-purple-500/30 p-4 text-left hover:border-purple-500/50 transition-all",
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
            className: "flex flex-col items-center text-center",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center mb-3 shadow-lg",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_19__["default"], {
                className: "w-7 h-7 text-white"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1041,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1040,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("h3", {
              className: "font-bold text-white text-sm mb-1",
              children: t('shop')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1043,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
              className: "text-[10px] text-gray-400",
              children: t('productsDeals')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1044,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "mt-2 px-3 py-1 bg-purple-500 text-white text-[10px] font-semibold rounded-full",
              children: t('explore')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1045,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1039,
            columnNumber: 13
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 1035,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 1016,
        columnNumber: 9
      }, undefined)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 944,
      columnNumber: 7
    }, undefined), ((_userData$kyc_status, _user$kyc_status) => {
      const plan = (stats.subscriptionPlan || (userData === null || userData === void 0 ? void 0 : userData.subscription_plan) || (user === null || user === void 0 ? void 0 : user.subscription_plan) || '').toLowerCase();
      const kycFromUserData = userData === null || userData === void 0 ? void 0 : (_userData$kyc_status = userData.kyc_status) === null || _userData$kyc_status === void 0 ? void 0 : _userData$kyc_status.toLowerCase();
      const kycFromUser = user === null || user === void 0 ? void 0 : (_user$kyc_status = user.kyc_status) === null || _user$kyc_status === void 0 ? void 0 : _user$kyc_status.toLowerCase();
      const kycStatus = kycFromUserData || kycFromUser || '';
      const isPaidPlan = ['startup', 'growth', 'elite'].includes(plan);
      const isKycVerified = ['verified', 'approved'].includes(kycStatus);
      const isKycPending = ['pending', 'submitted', 'under_review'].includes(kycStatus);
      const isKycRejected = ['rejected', 'failed'].includes(kycStatus);

      // KYC Verified + Paid Plan = Show full Redeem card
      if (isPaidPlan && isKycVerified) {
        return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "px-5 mb-4",
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_4__.motion.div, {
            initial: {
              opacity: 0,
              y: 10
            },
            animate: {
              opacity: 1,
              y: 0
            },
            onClick: () => navigate('/redeem'),
            className: "cursor-pointer relative overflow-hidden rounded-2xl p-5",
            style: {
              background: 'linear-gradient(145deg, #064e3b 0%, #047857 30%, #065f46 70%, #022c22 100%)',
              boxShadow: '0 15px 40px -10px rgba(16, 185, 129, 0.4)'
            },
            "data-testid": "redeem-to-bank-card",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "absolute top-0 right-0 w-32 h-32 bg-emerald-400/20 rounded-full blur-3xl"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1081,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "absolute -bottom-10 -left-10 w-24 h-24 bg-green-400/20 rounded-full blur-2xl"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1082,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "absolute top-4 right-8 animate-bounce",
              style: {
                animationDelay: '0s'
              },
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                className: "text-2xl",
                children: "\uD83D\uDCB0"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1086,
                columnNumber: 19
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1085,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "absolute top-10 right-20 animate-bounce",
              style: {
                animationDelay: '0.3s'
              },
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                className: "text-lg",
                children: "\uD83E\uDE99"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1089,
                columnNumber: 19
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1088,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "relative z-10",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                className: "flex items-center gap-2 mb-3",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                  className: "w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center",
                  children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_8__["default"], {
                    className: "w-5 h-5 text-white"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1096,
                    columnNumber: 23
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 1095,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                    className: "text-white/60 text-xs uppercase tracking-wider",
                    children: "PRC Balance"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1099,
                    columnNumber: 23
                  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                    className: "text-white text-2xl font-bold",
                    children: stats.prcBalance.toLocaleString()
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1100,
                    columnNumber: 23
                  }, undefined)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 1098,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 1094,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                className: "bg-white/10 backdrop-blur rounded-xl p-3 mb-4",
                children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                  className: "flex items-center justify-between",
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                    children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                      className: "text-emerald-200/80 text-xs",
                      children: "Redeem up to (100% limit)"
                    }, void 0, false, {
                      fileName: _jsxFileName,
                      lineNumber: 1108,
                      columnNumber: 25
                    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                      className: "text-white text-xl font-bold",
                      children: ["\u20B9", Math.floor(stats.prcBalance / 10).toLocaleString()]
                    }, void 0, true, {
                      fileName: _jsxFileName,
                      lineNumber: 1109,
                      columnNumber: 25
                    }, undefined)]
                  }, void 0, true, {
                    fileName: _jsxFileName,
                    lineNumber: 1107,
                    columnNumber: 23
                  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                    className: "text-right",
                    children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                      className: "text-emerald-200/60 text-xs",
                      children: "Rate"
                    }, void 0, false, {
                      fileName: _jsxFileName,
                      lineNumber: 1112,
                      columnNumber: 25
                    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                      className: "text-emerald-300 text-sm font-medium",
                      children: "10 PRC = \u20B91"
                    }, void 0, false, {
                      fileName: _jsxFileName,
                      lineNumber: 1113,
                      columnNumber: 25
                    }, undefined)]
                  }, void 0, true, {
                    fileName: _jsxFileName,
                    lineNumber: 1111,
                    columnNumber: 23
                  }, undefined)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 1106,
                  columnNumber: 21
                }, undefined)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1105,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
                onClick: e => {
                  e.stopPropagation();
                  navigate('/redeem');
                },
                className: "w-full py-3.5 bg-white text-emerald-800 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg hover:bg-emerald-50 transition-colors",
                "data-testid": "redeem-to-bank-btn",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  className: "w-5 h-5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 1127,
                  columnNumber: 21
                }, undefined), "Redeem PRC", /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_7__["default"], {
                  className: "w-4 h-4"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 1129,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 1119,
                columnNumber: 19
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 1092,
              columnNumber: 17
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1069,
            columnNumber: 15
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 1068,
          columnNumber: 13
        }, undefined);
      }

      // Paid Plan but KYC Pending/Rejected = Show KYC message card
      if (isPaidPlan && !isKycVerified) {
        return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
          className: "px-5 mb-4",
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_4__.motion.div, {
            initial: {
              opacity: 0,
              y: 10
            },
            animate: {
              opacity: 1,
              y: 0
            },
            onClick: () => navigate('/profile'),
            className: "cursor-pointer relative overflow-hidden rounded-2xl p-5",
            style: {
              background: isKycRejected ? 'linear-gradient(145deg, #7f1d1d 0%, #991b1b 30%, #b91c1c 70%, #450a0a 100%)' : 'linear-gradient(145deg, #78350f 0%, #92400e 30%, #b45309 70%, #451a03 100%)',
              boxShadow: isKycRejected ? '0 15px 40px -10px rgba(239, 68, 68, 0.4)' : '0 15px 40px -10px rgba(245, 158, 11, 0.4)'
            },
            "data-testid": "redeem-kyc-pending-card",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: `absolute top-0 right-0 w-32 h-32 ${isKycRejected ? 'bg-red-400/20' : 'bg-amber-400/20'} rounded-full blur-3xl`
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1157,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: `absolute -bottom-10 -left-10 w-24 h-24 ${isKycRejected ? 'bg-red-400/20' : 'bg-yellow-400/20'} rounded-full blur-2xl`
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1158,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
              className: "relative z-10",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                className: "flex items-center gap-3 mb-3",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                  className: `w-12 h-12 rounded-xl ${isKycRejected ? 'bg-red-500/30' : 'bg-amber-500/30'} backdrop-blur flex items-center justify-center`,
                  children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_18__["default"], {
                    className: "w-6 h-6 text-white"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1164,
                    columnNumber: 23
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 1163,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                    className: "text-white font-bold text-lg",
                    children: "KYC Required"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1167,
                    columnNumber: 23
                  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                    className: `${isKycRejected ? 'text-red-200' : 'text-amber-200'} text-sm`,
                    children: isKycRejected ? 'KYC Rejected' : 'KYC Verification Required'
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1168,
                    columnNumber: 23
                  }, undefined)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 1166,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 1162,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                className: `${isKycRejected ? 'bg-red-900/30' : 'bg-amber-900/30'} backdrop-blur rounded-xl p-4 mb-4`,
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("p", {
                  className: "text-white/90 text-sm leading-relaxed",
                  children: isKycRejected ? 'Your KYC verification was rejected. Please update your documents and resubmit to enable PRC redemption.' : 'Complete your KYC verification to unlock the Redeem feature. Your PRC balance will be waiting for you!'
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 1176,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
                  className: "mt-3 flex items-center gap-2",
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_8__["default"], {
                    className: "w-4 h-4 text-white/60"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1183,
                    columnNumber: 23
                  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                    className: "text-white/70 text-xs",
                    children: ["Your Balance: ", /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("span", {
                      className: "text-white font-semibold",
                      children: [stats.prcBalance.toLocaleString(), " PRC"]
                    }, void 0, true, {
                      fileName: _jsxFileName,
                      lineNumber: 1184,
                      columnNumber: 77
                    }, undefined)]
                  }, void 0, true, {
                    fileName: _jsxFileName,
                    lineNumber: 1184,
                    columnNumber: 23
                  }, undefined)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 1182,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 1175,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("button", {
                onClick: e => {
                  e.stopPropagation();
                  navigate('/profile');
                },
                className: `w-full py-3.5 ${isKycRejected ? 'bg-red-500 hover:bg-red-400' : 'bg-amber-500 hover:bg-amber-400'} text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors`,
                "data-testid": "complete-kyc-btn",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_18__["default"], {
                  className: "w-5 h-5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 1197,
                  columnNumber: 21
                }, undefined), isKycRejected ? 'Update KYC Documents' : 'Complete KYC Now', /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_7__["default"], {
                  className: "w-4 h-4"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 1199,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 1189,
                columnNumber: 19
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 1160,
              columnNumber: 17
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1141,
            columnNumber: 15
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 1140,
          columnNumber: 13
        }, undefined);
      }
      return null;
    })(), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(_components_AIChatbotEnhanced__WEBPACK_IMPORTED_MODULE_30__["default"], {
      user: user,
      isVip: hasPaidPlan
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 1215,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(_components_ProfileCompletionComponents__WEBPACK_IMPORTED_MODULE_29__.ProfileFloatingReminder, {
      user: user,
      userData: userData
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 1221,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
      className: "fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 z-50",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)("div", {
        className: "flex items-center justify-around py-2 px-4 max-w-lg mx-auto",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(BottomNavItem, {
          icon: lucide_react__WEBPACK_IMPORTED_MODULE_5__["default"],
          label: t('home'),
          isActive: activeTab === 'home',
          onClick: () => handleNavigation('home')
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 1229,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(BottomNavItem, {
          icon: lucide_react__WEBPACK_IMPORTED_MODULE_20__["default"],
          label: t('rewards'),
          isActive: activeTab === 'rewards',
          onClick: () => handleNavigation('rewards')
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 1235,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(BottomNavItem, {
          icon: lucide_react__WEBPACK_IMPORTED_MODULE_15__["default"],
          label: t('tapGame'),
          isActive: activeTab === 'game',
          onClick: () => handleNavigation('game')
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 1241,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxDEV)(BottomNavItem, {
          icon: lucide_react__WEBPACK_IMPORTED_MODULE_26__["default"],
          label: t('profile'),
          isActive: activeTab === 'profile',
          onClick: () => handleNavigation('profile')
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 1247,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 1228,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 1227,
      columnNumber: 7
    }, undefined)]
  }, void 0, true, {
    fileName: _jsxFileName,
    lineNumber: 268,
    columnNumber: 5
  }, undefined);
};
_s(DashboardModern, "BH3Jx8o//vV20bkURv5aawWGlQI=", false, function () {
  return [react_router_dom__WEBPACK_IMPORTED_MODULE_1__.useNavigate, _contexts_LanguageContext__WEBPACK_IMPORTED_MODULE_31__.useLanguage];
});
_c2 = DashboardModern;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DashboardModern);
var _c, _c2;
__webpack_require__.$Refresh$.register(_c, "BottomNavItem");
__webpack_require__.$Refresh$.register(_c2, "DashboardModern");

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ })

}]);
//# sourceMappingURL=src_pages_DashboardModern_js.chunk.js.map