import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, Minus, 
  Sparkles, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

const AIStatsCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  change,
  changeLabel,
  gradient = 'from-purple-500 to-indigo-600',
  delay = 0,
  onClick
}) => {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0 || change === undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={`relative overflow-hidden bg-white rounded-2xl p-5 shadow-lg border border-gray-100 ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Background decoration */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-5 rounded-full -translate-y-1/2 translate-x-1/2`}></div>
      
      <div className="relative">
        {/* Icon & Label Row */}
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {onClick && (
            <ArrowUpRight className="w-4 h-4 text-gray-400" />
          )}
        </div>

        {/* Value */}
        <div className="mb-1">
          <motion.p 
            className="text-2xl font-bold text-gray-900"
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: delay * 0.1 + 0.2 }}
          >
            {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}
          </motion.p>
          {subValue && (
            <p className="text-xs text-gray-500 mt-0.5">{subValue}</p>
          )}
        </div>

        {/* Label */}
        <p className="text-sm text-gray-600 font-medium">{label}</p>

        {/* Change indicator */}
        {change !== undefined && (
          <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${
            isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
          }`}>
            {isPositive && <TrendingUp className="w-3 h-3" />}
            {isNegative && <TrendingDown className="w-3 h-3" />}
            {isNeutral && <Minus className="w-3 h-3" />}
            <span>{isPositive ? '+' : ''}{change}%</span>
            {changeLabel && <span className="text-gray-400 ml-1">{changeLabel}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AIStatsCard;
