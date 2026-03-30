import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Sparkles } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const SupportChatbot = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hey there! I'm your Paras Reward assistant.\n\nAsk me anything — your earnings, referrals, how to redeem, or any feature. I have access to your real account data!\n\nHow can I help you today?" }
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
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, please try again in a moment.' }]);
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
      {/* Floating Button with label */}
      {!isOpen && (
        <div className="fixed bottom-20 right-4 z-50 flex items-center gap-2">
          <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/60 text-zinc-200 text-xs font-medium px-3 py-1.5 rounded-full shadow-lg animate-pulse">
            Need help? Ask me!
          </div>
          <button
            onClick={() => setIsOpen(true)}
            data-testid="chatbot-open-btn"
            className="relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 group"
            style={{
              background: 'conic-gradient(from 180deg, #10b981, #06b6d4, #8b5cf6, #f59e0b, #10b981)',
            }}
          >
            {/* Inner circle */}
            <div className="w-[50px] h-[50px] rounded-full bg-zinc-950 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-amber-400 group-hover:text-amber-300 transition-colors" />
            </div>
            {/* Online dot */}
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-zinc-950 animate-pulse" />
          </button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          data-testid="chatbot-window"
          className="fixed bottom-16 right-3 left-3 z-50 sm:left-auto sm:w-[380px] flex flex-col bg-zinc-950 border border-zinc-800/80 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 100px)', height: '520px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: 'linear-gradient(135deg, #065f46 0%, #0e7490 50%, #5b21b6 100%)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-amber-300" />
              </div>
              <div>
                <span className="text-white font-semibold text-sm block leading-tight">Paras AI</span>
                <span className="text-emerald-200/70 text-[10px]">Always online</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} data-testid="chatbot-close-btn" className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-white/80" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" data-testid="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                    msg.role === 'user' ? 'bg-cyan-500/20' : 'bg-amber-500/15'
                  }`}>
                    {msg.role === 'user'
                      ? <User className="w-3.5 h-3.5 text-cyan-400" />
                      : <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    }
                  </div>
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-cyan-600/25 text-cyan-50 rounded-br-sm'
                      : 'bg-zinc-800/70 text-zinc-200 rounded-bl-sm border border-zinc-700/40'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-zinc-800/70 border border-zinc-700/40">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-zinc-800/80 bg-zinc-900/90 shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about Paras Reward..."
                data-testid="chatbot-input"
                className="flex-1 bg-zinc-800/80 text-white text-sm rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-amber-500/40 placeholder:text-zinc-500"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                data-testid="chatbot-send-btn"
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 flex items-center justify-center transition-all"
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
