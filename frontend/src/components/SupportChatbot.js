import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const SupportChatbot = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Namaste! Paras Reward बद्दल काहीही विचारा. Registration, Mining, Referrals, Redeem — सगळ्या प्रश्नांची उत्तरे मिळतील!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post(`${API}/api/ai/support-chat`, {
        uid: user?.uid || 'guest',
        message: msg,
        session_id: sessionId,
      });
      setSessionId(res.data.session_id);
      setMessages(prev => [...prev, { role: 'bot', text: res.data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, try again later.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          data-testid="chatbot-open-btn"
          className="fixed bottom-20 right-4 z-50 w-13 h-13 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          data-testid="chatbot-window"
          className="fixed bottom-16 right-3 left-3 z-50 sm:left-auto sm:w-[380px] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 100px)', height: '520px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600/90 to-cyan-600/90 shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-white" />
              <span className="text-white font-semibold text-sm">Paras Support</span>
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
            </div>
            <button onClick={() => setIsOpen(false)} data-testid="chatbot-close-btn" className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" data-testid="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                    msg.role === 'user' ? 'bg-cyan-500/20' : 'bg-emerald-500/20'
                  }`}>
                    {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-cyan-400" /> : <Bot className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-cyan-600/30 text-cyan-50 rounded-br-md'
                      : 'bg-zinc-800/80 text-zinc-200 rounded-bl-md'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-zinc-800/80">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/80 shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question..."
                data-testid="chatbot-input"
                className="flex-1 bg-zinc-800 text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-zinc-500"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                data-testid="chatbot-send-btn"
                className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 flex items-center justify-center transition-colors"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportChatbot;
