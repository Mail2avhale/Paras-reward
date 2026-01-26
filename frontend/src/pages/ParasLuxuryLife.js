import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crown, Sparkles, Lock, ChevronRight, ArrowLeft,
  Smartphone, Bike, Car, Trophy, Gift, TrendingUp,
  CheckCircle2, Clock, AlertCircle, Star, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL || '';

// HD Product Images - High Quality
const PRODUCT_IMAGES = {
  mobile: 'https://images.unsplash.com/photo-1758348844351-48e1ec64cd96?w=1200&q=90',
  bike: 'https://images.unsplash.com/photo-1701849121939-c08134a19ced?w=1200&q=90',
  car: 'https://images.unsplash.com/photo-1763789381108-b5622140f2e0?w=1200&q=90'
};

const PRODUCT_ICONS = {
  mobile: Smartphone,
  bike: Bike,
  car: Car
};

const ParasLuxuryLife = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [savingsData, setSavingsData] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const user = JSON.parse(localStorage.getItem('paras_user') || '{}');

  useEffect(() => {
    fetchSavingsData();
  }, []);

  const fetchSavingsData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/api/luxury-life/savings/${user.uid}`);
      const data = await response.json();
      setSavingsData(data);
      
      // Show confetti if any product is complete
      if (data.products?.some(p => p.is_complete && !p.is_claimed)) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    } catch (error) {
      console.error('Error fetching luxury savings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (productKey) => {
    if (claiming) return;
    
    try {
      setClaiming(true);
      const response = await fetch(`${API}/api/luxury-life/claim/${user.uid}/${productKey}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`🎉 ${data.message}`);
        fetchSavingsData();
      } else {
        alert(data.detail || 'Claim failed');
      }
    } catch (error) {
      console.error('Error claiming product:', error);
      alert('Failed to submit claim');
    } finally {
      setClaiming(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPRC = (amount) => {
    return new Intl.NumberFormat('en-IN').format(Math.round(amount));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // Not eligible screen
  if (!savingsData?.is_eligible) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
        <div className="p-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400">
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
        </div>
        
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-6"
          >
            <Lock className="w-12 h-12 text-white" />
          </motion.div>
          
          <h1 className="text-2xl font-bold mb-3">Unlock Luxury Life</h1>
          <p className="text-gray-400 mb-8 max-w-sm">
            Upgrade to a paid plan (Startup, Growth, or Elite) to start auto-saving for luxury products!
          </p>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/subscription')}
            className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full font-bold text-lg shadow-lg shadow-amber-500/30"
          >
            Upgrade Now
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white pb-24">
      {/* Confetti Effect */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  y: -20, 
                  x: Math.random() * window.innerWidth,
                  rotate: 0,
                  opacity: 1
                }}
                animate={{ 
                  y: window.innerHeight + 20,
                  rotate: Math.random() * 720,
                  opacity: 0
                }}
                transition={{ 
                  duration: 3 + Math.random() * 2,
                  delay: Math.random() * 0.5
                }}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][Math.floor(Math.random() * 5)]
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 via-orange-500/20 to-red-500/20" />
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,215,0,0.1) 0%, transparent 50%)`,
        }} />
        
        <div className="relative p-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-amber-400 mb-4">
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          
          <div className="text-center py-6">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex items-center justify-center gap-2 mb-2"
            >
              <Crown className="w-8 h-8 text-amber-400" />
              <h1 className="text-3xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                PARAS LUXURY LIFE
              </h1>
              <Sparkles className="w-6 h-6 text-amber-400" />
            </motion.div>
            
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-amber-200/80 text-lg italic"
            >
              &ldquo;Smart Saving. Live Better.&rdquo;
            </motion.p>
          </div>
        </div>
      </div>

      {/* Total Savings Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mx-4 -mt-2 mb-6"
      >
        <div className="bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-red-900/20 backdrop-blur-xl rounded-2xl p-5 border border-amber-500/30 shadow-xl shadow-amber-500/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span className="text-amber-200/80 text-sm">Total Luxury Savings</span>
            </div>
            <div className="px-3 py-1 bg-amber-500/20 rounded-full">
              <span className="text-amber-400 text-xs font-bold">{savingsData.auto_save_rate}% Auto-Save</span>
            </div>
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">{formatPRC(savingsData.total_savings)}</span>
            <span className="text-amber-400 text-lg">PRC</span>
          </div>
          <p className="text-amber-200/60 text-sm mt-1">
            ≈ {formatCurrency(savingsData.total_savings_inr)}
          </p>
        </div>
      </motion.div>

      {/* Auto-Save Info */}
      <div className="mx-4 mb-6 p-4 bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-xl border border-emerald-500/20">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-400 mb-1">How It Works</h3>
            <p className="text-gray-400 text-sm">
              Every time you earn PRC (mining, tap game, referrals), 20% is automatically saved:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-2 py-1 bg-blue-500/20 rounded text-blue-400 text-xs">📱 4% Mobile</span>
              <span className="px-2 py-1 bg-purple-500/20 rounded text-purple-400 text-xs">🏍️ 6% Bike</span>
              <span className="px-2 py-1 bg-amber-500/20 rounded text-amber-400 text-xs">🚗 10% Car</span>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="px-4 space-y-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Gift className="w-5 h-5 text-amber-400" />
          Your Luxury Goals
        </h2>

        {savingsData.products?.map((product, index) => {
          const ProductIcon = PRODUCT_ICONS[product.key];
          const isComplete = product.is_complete;
          const isClaimed = product.is_claimed;
          
          return (
            <motion.div
              key={product.key}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 + index * 0.15 }}
              className={`relative overflow-hidden rounded-2xl ${
                isComplete && !isClaimed 
                  ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black' 
                  : ''
              }`}
            >
              {/* HD Product Image - Prominent Display */}
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={PRODUCT_IMAGES[product.key]} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                
                {/* Product badge */}
                <div className="absolute top-3 left-3">
                  <div className={`px-3 py-1.5 rounded-full backdrop-blur-md ${
                    product.key === 'mobile' ? 'bg-blue-500/40 text-blue-200' :
                    product.key === 'bike' ? 'bg-purple-500/40 text-purple-200' :
                    'bg-amber-500/40 text-amber-200'
                  }`}>
                    <span className="text-xs font-bold">{product.auto_save_percent}% AUTO-SAVE</span>
                  </div>
                </div>

                {/* Status badges */}
                {isComplete && !isClaimed && (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute top-3 right-3 px-3 py-1 bg-green-500 rounded-full flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold">READY!</span>
                  </motion.div>
                )}
                
                {isClaimed && (
                  <div className="absolute top-3 right-3 px-3 py-1 bg-amber-500/80 rounded-full flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-bold">CLAIMED</span>
                  </div>
                )}

                {/* Product name overlay */}
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="font-black text-white text-xl drop-shadow-lg">{product.name}</h3>
                  <p className="text-gray-200 text-sm drop-shadow">{product.description}</p>
                </div>
              </div>

              {/* Content */}
              <div className="relative p-5 bg-gradient-to-b from-gray-900 to-black">
                {/* Price Info */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider">Product Price</p>
                    <p className="text-white font-bold text-lg">{formatCurrency(product.price_inr)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider">Down Payment (30%)</p>
                    <p className="text-amber-400 font-bold text-lg">{formatCurrency(product.down_payment_inr)}</p>
                  </div>
                </div>

                {/* Progress Section */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-sm">Progress</span>
                    <span className={`text-lg font-bold ${
                      isComplete ? 'text-green-400' : 'text-white'
                    }`}>
                      {product.progress.toFixed(1)}%
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(product.progress, 100)}%` }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 + index * 0.15 }}
                      className={`h-full rounded-full relative overflow-hidden ${
                        product.key === 'mobile' ? 'bg-gradient-to-r from-blue-600 to-blue-400' :
                        product.key === 'bike' ? 'bg-gradient-to-r from-purple-600 to-purple-400' :
                        'bg-gradient-to-r from-amber-600 to-amber-400'
                      }`}
                    >
                      {/* Shimmer effect */}
                      <motion.div
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      />
                    </motion.div>
                  </div>
                </div>

                {/* Savings Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-black/40 rounded-xl">
                  <div>
                    <p className="text-gray-500 text-xs">Saved</p>
                    <p className="text-white font-bold">{formatPRC(product.current_savings)} PRC</p>
                    <p className="text-amber-400/80 text-xs">≈ {formatCurrency(product.current_savings_inr)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Remaining</p>
                    <p className="text-gray-300 font-bold">{formatPRC(product.remaining_prc)} PRC</p>
                    <p className="text-gray-500 text-xs">≈ {formatCurrency(product.remaining_inr)}</p>
                  </div>
                </div>

                {/* Auto-save Rate */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400" />
                    <span className="text-gray-400 text-sm">Auto-save rate</span>
                  </div>
                  <span className={`font-bold ${
                    product.key === 'mobile' ? 'text-blue-400' :
                    product.key === 'bike' ? 'text-purple-400' :
                    'text-amber-400'
                  }`}>{product.auto_save_percent}% of earnings</span>
                </div>

                {/* Claim Button - Available at 50% completion */}
                {product.progress >= 50 && !isClaimed && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleClaim(product.key)}
                    disabled={claiming}
                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 ${
                      claiming 
                        ? 'bg-gray-600 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 shadow-lg shadow-amber-500/30'
                    }`}
                  >
                    {claiming ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Gift className="w-5 h-5" />
                        Claim Now ({product.progress.toFixed(0)}% Complete)
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                )}

                {isClaimed && (
                  <div className="w-full py-4 rounded-xl bg-amber-500/20 border border-amber-500/30 text-center">
                    <p className="text-amber-400 font-medium">Claim submitted - Under review</p>
                    <p className="text-amber-200/60 text-sm">Our team will contact you within 48 hours</p>
                  </div>
                )}

                {product.progress < 50 && !isClaimed && (
                  <div className="w-full py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-center">
                    <p className="text-gray-400 text-sm">Reach 50% to unlock claim option!</p>
                    <p className="text-gray-500 text-xs mt-1">Current: {product.progress.toFixed(1)}% | Need: 50%</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Important Disclaimer - 70% User Responsibility */}
      <div className="mx-4 mt-6 p-4 bg-red-900/20 rounded-xl border border-red-500/30">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg flex-shrink-0">
            <Info className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-bold text-red-400 mb-2">{t('luxuryImportantNotice')}</h3>
            <p className="text-red-200/80 text-sm leading-relaxed">
              {t('luxuryDisclaimer')}
            </p>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="mx-4 mt-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          {t('luxuryHowItWorks')}
        </h3>
        <ul className="space-y-2 text-gray-400 text-sm">
          <li className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            {t('luxurySavingsLocked')}
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            {t('luxuryDownPaymentCovers')}
          </li>
          <li className="flex items-start gap-2">
            <Gift className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            {t('luxuryClaimAt50')}
          </li>
          <li className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            {t('luxuryClaimsReviewed')}
          </li>
        </ul>
      </div>

      {/* Bottom Padding for Navigation */}
      <div className="h-20" />
    </div>
  );
};

export default ParasLuxuryLife;
