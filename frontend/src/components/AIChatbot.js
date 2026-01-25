import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MessageCircle, Send, X, Bot, User, 
  Loader2, Sparkles, HelpCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Cute bot avatar image
const BOT_AVATAR = "https://static.prod-images.emergentagent.com/jobs/0e044626-4be3-481a-98d4-3bf7ce958652/images/a388718cd97ac7663c0f76b1ea34d9e34e0d15bb359fe7eaa1a62a872542c4d5.png";

const AIChatbot = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add welcome message when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        type: 'bot',
        text: `नमस्कार ${user?.name || 'User'}! 👋\n\nमी Paras Reward चा AI Assistant आहे. मी तुम्हाला कशी मदत करू शकतो?\n\n📌 Quick options:\n• VIP membership बद्दल\n• Mining कसे करायचे\n• KYC status\n• Wallet balance`,
        timestamp: new Date()
      }]);
    }
  }, [isOpen, user?.name, messages.length]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      type: 'user',
      text: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/ai/chatbot`, null, {
        params: {
          uid: user.uid,
          message: inputMessage,
          session_id: sessionId
        }
      });

      const botMessage = {
        type: 'bot',
        text: response.data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      
      if (!sessionId) {
        setSessionId(response.data.session_id);
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages(prev => [...prev, {
        type: 'bot',
        text: 'माफ करा, काही तांत्रिक अडचण आली. कृपया पुन्हा प्रयत्न करा.',
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    "VIP membership चे फायदे काय?",
    "Mining कसे सुरू करायचे?",
    "माझा KYC status काय आहे?",
    "PRC कसे redeem करायचे?"
  ];

  const handleQuickQuestion = (question) => {
    setInputMessage(question);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 group"
        data-testid="chatbot-toggle-btn"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
          AI
        </span>
        <span className="absolute right-full mr-3 bg-gray-900 text-white text-sm px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          AI Assistant 🤖
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)]" data-testid="chatbot-container">
      <Card className="shadow-2xl border-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bot className="w-8 h-8" />
                <Sparkles className="w-4 h-4 absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold">Paras AI Assistant</h3>
                <p className="text-xs text-purple-200">24/7 available • Marathi & English</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="h-[350px] overflow-y-auto p-4 bg-gray-50 space-y-4">
          {messages.map((msg, index) => (
            <div 
              key={index}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start gap-2 max-w-[85%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.type === 'user' ? 'bg-purple-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                }`}>
                  {msg.type === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className={`rounded-2xl px-4 py-2.5 ${
                  msg.type === 'user' 
                    ? 'bg-purple-600 text-white rounded-br-md' 
                    : msg.isError 
                      ? 'bg-red-100 text-red-800 rounded-bl-md'
                      : 'bg-white text-gray-800 shadow-sm rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${msg.type === 'user' ? 'text-purple-200' : 'text-gray-400'}`}>
                    {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    <span className="text-sm text-gray-500">विचार करत आहे...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Questions */}
        {messages.length <= 1 && (
          <div className="px-4 py-2 bg-gray-100 border-t">
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <HelpCircle className="w-3 h-3" /> Quick questions:
            </p>
            <div className="flex flex-wrap gap-1">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickQuestion(q)}
                  className="text-xs bg-white border border-purple-200 text-purple-700 px-2 py-1 rounded-full hover:bg-purple-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 bg-white border-t">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="तुमचा प्रश्न लिहा..."
              className="flex-1 border-gray-200 focus:border-purple-500"
              disabled={isLoading}
              data-testid="chatbot-input"
            />
            <Button 
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="chatbot-send-btn"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            Powered by AI • तुमची माहिती सुरक्षित आहे 🔒
          </p>
        </div>
      </Card>
    </div>
  );
};

export default AIChatbot;
