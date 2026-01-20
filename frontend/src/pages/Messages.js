import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Send, Search, MessageCircle, CheckCircle, Crown,
  MoreVertical, Trash2, User
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

const Messages = ({ user }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { recipientUid } = useParams();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recipientProfile, setRecipientProfile] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const messagesEndRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) {
      toast.error('Please login to view messages');
      navigate('/login');
      return;
    }
    
    fetchConversations();
    
    // If coming from profile page with recipient
    if (recipientUid) {
      fetchRecipientAndOpenChat(recipientUid);
    }
  }, [user, recipientUid]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/messages/conversations/${user.uid}`);
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Search users to start new conversation
  const searchUsers = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    try {
      setIsSearching(true);
      const response = await axios.get(`${API}/api/social/search-users?q=${encodeURIComponent(query)}&limit=10`);
      // Filter out current user
      const filteredUsers = (response.data.users || []).filter(u => u.uid !== user.uid);
      setSearchResults(filteredUsers);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input with debounce
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);
  };

  // Start chat with searched user
  const startChatWithUser = (searchedUser) => {
    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResults([]);
    
    // Check if conversation already exists
    const existingConv = conversations.find(c => c.other_user?.uid === searchedUser.uid);
    if (existingConv) {
      openConversation(existingConv.conversation_id, existingConv.other_user);
    } else {
      // Start new conversation
      setActiveConversation({ isNew: true, recipient: searchedUser });
      setRecipientProfile(searchedUser);
      setMessages([]);
    }
  };

  const fetchRecipientAndOpenChat = async (uid) => {
    try {
      const response = await axios.get(`${API}/api/users/${uid}/public-profile`);
      setRecipientProfile(response.data);
      
      // Check if conversation exists
      const existingConv = conversations.find(c => c.other_user?.uid === uid);
      if (existingConv) {
        openConversation(existingConv.conversation_id, response.data);
      } else {
        // New conversation
        setActiveConversation({ isNew: true, recipient: response.data });
        setMessages([]);
      }
    } catch (error) {
      toast.error('Failed to load user profile');
      navigate('/messages');
    }
  };

  const openConversation = async (conversationId, otherUser) => {
    try {
      setActiveConversation({ conversation_id: conversationId, other_user: otherUser });
      setRecipientProfile(otherUser);
      
      const response = await axios.get(
        `${API}/api/messages/conversation/${conversationId}?uid=${user.uid}`
      );
      setMessages(response.data.messages || []);
    } catch (error) {
      toast.error('Failed to load messages');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const recipientId = activeConversation?.isNew 
      ? activeConversation.recipient.uid 
      : activeConversation?.other_user?.uid;
    
    if (!recipientId) {
      toast.error('No recipient selected');
      return;
    }

    setSending(true);
    try {
      const response = await axios.post(`${API}/api/messages/send`, {
        sender_uid: user.uid,
        receiver_uid: recipientId,
        text: newMessage.trim()
      });

      // Add message to local state
      const newMsg = {
        message_id: response.data.message_id,
        sender_uid: user.uid,
        text: newMessage.trim(),
        created_at: new Date().toISOString(),
        read: false
      };
      
      setMessages(prev => [...prev, newMsg]);
      setNewMessage('');
      
      // Update active conversation
      if (activeConversation?.isNew) {
        setActiveConversation(prev => ({
          ...prev,
          isNew: false,
          conversation_id: response.data.conversation_id
        }));
      }
      
      // Refresh conversations list
      fetchConversations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const filteredConversations = conversations.filter(conv => 
    conv.other_user?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Conversations List View
  if (!activeConversation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-16">
        {/* Header */}
        <div className="px-5 pb-4 pt-4">
          <div className="flex items-center gap-4 mb-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">{t('messages')}</h1>
              <p className="text-gray-500 text-sm">{conversations.length} {t('conversations')}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder={t('searchConversations')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="px-5 pb-24">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-800"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-800 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-800 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-16">
              <MessageCircle className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <h3 className="text-white font-bold mb-2">{t('noMessagesYet')}</h3>
              <p className="text-gray-500 text-sm mb-4">{t('startConversation')}</p>
              <button
                onClick={() => navigate('/network')}
                className="px-6 py-3 bg-purple-500 text-white font-semibold rounded-xl"
              >
                {t('findPeople')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConversations.map((conv) => (
                <motion.button
                  key={conv.conversation_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => openConversation(conv.conversation_id, conv.other_user)}
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-left hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold">
                        {conv.other_user?.avatar ? (
                          <img src={conv.other_user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          conv.other_user?.name?.charAt(0)?.toUpperCase() || 'U'
                        )}
                      </div>
                      {conv.other_user?.is_verified && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-gray-950">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-semibold truncate">{conv.other_user?.name || 'User'}</span>
                        <span className="text-gray-500 text-xs">
                          {conv.last_message_time && new Date(conv.last_message_time).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-gray-500 text-sm truncate">{conv.last_message || 'No messages'}</p>
                        {conv.unread_count > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-purple-500 text-white text-xs font-bold rounded-full">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chat View
  const otherUser = activeConversation.isNew ? activeConversation.recipient : activeConversation.other_user;

  return (
    <div className="h-screen flex flex-col bg-gray-950 pt-16">
      {/* Chat Header */}
      <div className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex items-center gap-3">
        <button 
          onClick={() => setActiveConversation(null)}
          className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        
        <button 
          onClick={() => navigate(`/profile/${otherUser?.uid}`)}
          className="flex items-center gap-3 flex-1"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold">
              {otherUser?.avatar ? (
                <img src={otherUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                otherUser?.name?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
          </div>
          <div>
            <h2 className="text-white font-semibold">{otherUser?.name || 'User'}</h2>
            <p className="text-gray-500 text-xs">{t('tapToViewProfile')}</p>
          </div>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500">{t('startConversationWith').replace('{name}', otherUser?.name)}</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMine = msg.sender_uid === user.uid;
            return (
              <motion.div
                key={msg.message_id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  isMine 
                    ? 'bg-purple-500 text-white rounded-br-none' 
                    : 'bg-gray-800 text-white rounded-bl-none'
                }`}>
                  <p className="break-words">{msg.text}</p>
                  <p className={`text-xs mt-1 ${isMine ? 'text-purple-200' : 'text-gray-500'}`}>
                    {msg.created_at && new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - with bottom nav padding */}
      <div className="p-4 bg-gray-900 border-t border-gray-800 pb-24" style={{ paddingBottom: 'max(6rem, calc(env(safe-area-inset-bottom, 0px) + 5rem))' }}>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-600 transition-colors"
          >
            <Send className={`w-5 h-5 text-white ${sending ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Messages;
