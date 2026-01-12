import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  HelpCircle, X, Lightbulb, Sparkles, ChevronRight, 
  RefreshCw, Bot, Info
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Map routes to page keys for help lookup
const getPageKeyFromPath = (pathname) => {
  const pathMappings = {
    '/dashboard': 'dashboard',
    '/mining': 'mining',
    '/referrals': 'referrals',
    '/referrals/ai': 'referrals',
    '/network': 'referrals',
    '/marketplace': 'marketplace',
    '/subscription': 'subscription',
    '/profile': 'profile',
    '/game': 'game',
    '/bill-payments': 'bill-payments',
    '/gift-vouchers': 'gift-vouchers',
  };
  
  return pathMappings[pathname] || null;
};

const AIContextualHelp = ({ user }) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [helpData, setHelpData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showButton, setShowButton] = useState(false);

  // Get page key from current route
  const pageKey = getPageKeyFromPath(location.pathname);

  // Fetch help data when page changes
  const fetchHelpData = useCallback(async (withAi = false) => {
    if (!pageKey) {
      setShowButton(false);
      return;
    }

    setShowButton(true);
    
    if (withAi) {
      setAiLoading(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        use_ai: withAi.toString(),
        ...(user?.uid && { uid: user.uid })
      });
      
      const response = await axios.get(`${API}/ai/contextual-help/${pageKey}?${params}`);
      setHelpData(response.data);
    } catch (error) {
      console.error('Error fetching contextual help:', error);
      setHelpData({
        title: 'Help',
        tips: ['Explore this page to learn more!', 'Need help? Use the AI chatbot.'],
        ai_response: null
      });
    } finally {
      setLoading(false);
      setAiLoading(false);
    }
  }, [pageKey, user?.uid]);

  // Fetch static help when page changes
  useEffect(() => {
    if (pageKey) {
      fetchHelpData(false);
    } else {
      setHelpData(null);
      setShowButton(false);
    }
  }, [pageKey, fetchHelpData]);

  // Close panel when navigating
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Don't show on certain pages
  const excludedPaths = ['/login', '/register', '/forgot-password', '/', '/admin', '/manager'];
  const shouldHide = excludedPaths.some(path => 
    location.pathname === path || location.pathname.startsWith('/admin') || location.pathname.startsWith('/manager')
  );

  if (shouldHide || !showButton) {
    return null;
  }

  return (
    <>
      {/* Help Button - Fixed position */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-40 right-4 z-[9998] w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
        data-testid="contextual-help-btn"
        aria-label="Get help for this page"
      >
        <HelpCircle className="w-6 h-6" />
      </motion.button>

      {/* Help Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999]"
            />
            
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[10000] bg-white rounded-t-3xl shadow-2xl max-h-[70vh] overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{helpData?.title || 'Page Help'}</h3>
                      <p className="text-sm text-white/80">Tips & AI Suggestions</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto max-h-[calc(70vh-120px)]">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <>
                    {/* Quick Tips */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Quick Tips
                      </h4>
                      <div className="space-y-2">
                        {helpData?.tips?.map((tip, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl"
                          >
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <ChevronRight className="w-4 h-4" />
                            </div>
                            <p className="text-gray-700 text-sm">{tip}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* AI Response Section */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        AI Suggestions
                      </h4>
                      
                      {helpData?.ai_response ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                              <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                                {helpData.ai_response}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <button
                          onClick={() => fetchHelpData(true)}
                          disabled={aiLoading}
                          className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-purple-600 hover:to-indigo-700 transition-all disabled:opacity-50"
                        >
                          {aiLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Generating AI tips...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              Get AI-Powered Suggestions
                            </>
                          )}
                        </button>
                      )}

                      {/* Refresh AI button if response exists */}
                      {helpData?.ai_response && (
                        <button
                          onClick={() => fetchHelpData(true)}
                          disabled={aiLoading}
                          className="mt-3 w-full py-2 px-3 bg-white border border-purple-200 text-purple-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors disabled:opacity-50"
                        >
                          {aiLoading ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Refreshing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3 h-3" />
                              Get New Suggestions
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIContextualHelp;
