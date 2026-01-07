import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Star, Gamepad2, Store, UserPlus, CreditCard, 
  Gift, ArrowRight, Lock, Crown
} from 'lucide-react';

const QuickActionsGrid = ({ isVip = false, onVipRequired }) => {
  const navigate = useNavigate();

  const actions = [
    {
      id: 'rewards',
      icon: Star,
      label: 'Daily Rewards',
      description: 'Collect PRC',
      gradient: 'from-purple-500 to-violet-600',
      shadowColor: 'shadow-purple-200',
      path: '/daily-rewards',
      requiresVip: false
    },
    {
      id: 'game',
      icon: Gamepad2,
      label: 'Tap Game',
      description: 'Play & Win',
      gradient: 'from-pink-500 to-rose-600',
      shadowColor: 'shadow-pink-200',
      path: '/game',
      requiresVip: false
    },
    {
      id: 'friends',
      icon: UserPlus,
      label: 'Invite Friends',
      description: 'Earn Bonus',
      gradient: 'from-indigo-500 to-purple-600',
      shadowColor: 'shadow-indigo-200',
      path: '/referrals',
      requiresVip: false
    },
    {
      id: 'shop',
      icon: Store,
      label: 'Shop',
      description: 'Marketplace',
      gradient: 'from-blue-500 to-cyan-600',
      shadowColor: 'shadow-blue-200',
      path: '/marketplace',
      requiresVip: true
    },
    {
      id: 'bills',
      icon: CreditCard,
      label: 'Bill Pay',
      description: 'Pay Bills',
      gradient: 'from-teal-500 to-emerald-600',
      shadowColor: 'shadow-teal-200',
      path: '/bill-payments',
      requiresVip: true
    },
    {
      id: 'vouchers',
      icon: Gift,
      label: 'Vouchers',
      description: 'Redeem',
      gradient: 'from-orange-500 to-amber-600',
      shadowColor: 'shadow-orange-200',
      path: '/gift-vouchers',
      requiresVip: true
    }
  ];

  const handleClick = (action) => {
    if (action.requiresVip && !isVip) {
      onVipRequired?.();
      return;
    }
    navigate(action.path);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-gray-900 text-lg">Quick Actions</h3>
        <motion.button
          whileHover={{ x: 3 }}
          onClick={() => navigate('/dashboard')}
          className="text-xs text-purple-600 font-medium flex items-center gap-1"
        >
          View All
          <ArrowRight className="w-3 h-3" />
        </motion.button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const isLocked = action.requiresVip && !isVip;

          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: isLocked ? 1 : 1.05, y: isLocked ? 0 : -4 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleClick(action)}
              className={`relative flex flex-col items-center p-4 rounded-2xl transition-all ${
                isLocked 
                  ? 'bg-gray-100 cursor-not-allowed' 
                  : `bg-gradient-to-br ${action.gradient} shadow-lg ${action.shadowColor}`
              }`}
            >
              {/* Lock overlay for VIP-only */}
              {isLocked && (
                <div className="absolute inset-0 bg-gray-200/50 rounded-2xl flex items-center justify-center">
                  <div className="bg-amber-500 p-1.5 rounded-full">
                    <Crown className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}

              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                isLocked 
                  ? 'bg-gray-300' 
                  : 'bg-white/20'
              }`}>
                <Icon className={`w-5 h-5 ${isLocked ? 'text-gray-500' : 'text-white'}`} />
              </div>
              
              <span className={`text-xs font-bold ${isLocked ? 'text-gray-500' : 'text-white'}`}>
                {action.label}
              </span>
              <span className={`text-[10px] mt-0.5 ${isLocked ? 'text-gray-400' : 'text-white/70'}`}>
                {isLocked ? 'VIP Only' : action.description}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* VIP Promo for non-VIP users */}
      {!isVip && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Crown className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-800">Unlock All Features</p>
              <p className="text-[10px] text-amber-600">Upgrade to VIP for full access</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/vip')}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-lg"
            >
              Upgrade
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default QuickActionsGrid;
