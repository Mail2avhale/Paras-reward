import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smartphone, Tv, ChevronDown, Loader2, 
  CheckCircle, AlertCircle, Zap
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RechargeCard = ({ user, stats }) => {
  const [rechargeType, setRechargeType] = useState('mobile');
  const [number, setNumber] = useState('');
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [recentTxns, setRecentTxns] = useState([]);
  const [dailyRemaining, setDailyRemaining] = useState(500);
  const [monthlyRemaining, setMonthlyRemaining] = useState(1500);

  const prcRate = stats?.prcRate || 10;

  const fetchOperators = useCallback(async (type) => {
    setOperatorsLoading(true);
    setOperators([]);
    setSelectedOperator('');
    try {
      const res = await axios.get(`${API}/recharge/operators/${type}`);
      if (res.data.success && res.data.operators?.length) {
        setOperators(res.data.operators);
      }
    } catch {
      // silent
    } finally {
      setOperatorsLoading(false);
    }
  }, []);

  const fetchRecentTxns = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const res = await axios.get(`${API}/recharge/history/${user.uid}`);
      if (res.data.success) {
        const successful = (res.data.transactions || [])
          .filter(t => t.status === 'success' || t.status === 'complete')
          .slice(0, 3);
        setRecentTxns(successful);
        if (res.data.daily_remaining !== undefined) {
          setDailyRemaining(res.data.daily_remaining);
        }
        if (res.data.monthly_remaining !== undefined) {
          setMonthlyRemaining(res.data.monthly_remaining);
        }
      }
    } catch {
      // silent
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchOperators(rechargeType);
  }, [rechargeType, fetchOperators]);

  useEffect(() => {
    fetchRecentTxns();
  }, [fetchRecentTxns]);

  const handleTypeSwitch = (type) => {
    if (type === rechargeType) return;
    setRechargeType(type);
    setNumber('');
    setAmount('');
    setResult(null);
  };

  const maxAllowed = Math.min(500, dailyRemaining, monthlyRemaining);

  const handleAmountChange = (e) => {
    const raw = e.target.value;
    if (raw === '') { setAmount(''); return; }
    const num = parseInt(raw, 10);
    if (isNaN(num) || num < 0) return;
    if (num > maxAllowed) return;
    setAmount(String(num));
  };

  const handleRecharge = async () => {
    if (!number || !selectedOperator || !amount) {
      toast.error('Please fill all fields');
      return;
    }
    const amt = parseInt(amount, 10);
    if (isNaN(amt) || amt <= 0 || amt > 500) {
      toast.error('Amount must be between 1 and 500');
      return;
    }
    if (rechargeType === 'mobile' && !/^\d{10}$/.test(number)) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await axios.post(`${API}/recharge/initiate`, {
        user_id: user.uid,
        recharge_type: rechargeType,
        number: number.trim(),
        operator_id: selectedOperator,
        amount: amt
      });

      if (res.data.success) {
        setResult({ success: true, message: res.data.message });
        toast.success(res.data.message);
        setNumber('');
        setAmount('');
        fetchRecentTxns();
        if (res.data.amount) {
          setDailyRemaining(prev => Math.max(0, prev - res.data.amount));
        }
      } else {
        setResult({ success: false, message: res.data.message });
        toast.error(res.data.message);
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.detail || 'Technical error. Please try again later.';
      setResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const prcEstimate = amount && parseInt(amount, 10) > 0
    ? Math.ceil((parseInt(amount, 10) * 1.2 + 10) * prcRate)
    : 0;

  const isFormValid = number && selectedOperator && amount && parseInt(amount, 10) > 0 && parseInt(amount, 10) <= maxAllowed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      data-testid="recharge-card"
      className="rounded-xl p-4 overflow-hidden relative"
      style={{
        background: 'linear-gradient(145deg, #0a1628 0%, #0f2035 50%, #0a1a2e 100%)',
        border: '1px solid rgba(56, 189, 248, 0.15)',
        boxShadow: '0 8px 25px -5px rgba(14, 165, 233, 0.08)'
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
          <Zap className="w-4 h-4 text-cyan-400" />
        </div>
        <span className="text-white font-semibold text-sm">Quick Recharge</span>
      </div>

      {/* Mobile / DTH Toggle */}
      <div className="flex bg-zinc-800/60 rounded-lg p-0.5 mb-4" data-testid="recharge-type-toggle">
        {[
          { key: 'mobile', label: 'Mobile', icon: Smartphone },
          { key: 'dth', label: 'DTH', icon: Tv }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleTypeSwitch(key)}
            data-testid={`recharge-toggle-${key}`}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
              rechargeType === key
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Number Input */}
      <div className="mb-3">
        <input
          type="tel"
          inputMode="numeric"
          maxLength={rechargeType === 'mobile' ? 10 : 20}
          placeholder={rechargeType === 'mobile' ? 'Enter 10-digit mobile number' : 'Enter subscriber ID'}
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, ''))}
          data-testid="recharge-number-input"
          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
      </div>

      {/* Operator Select */}
      <div className="mb-3 relative">
        <select
          value={selectedOperator}
          onChange={(e) => setSelectedOperator(e.target.value)}
          data-testid="recharge-operator-select"
          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm appearance-none focus:outline-none focus:border-cyan-500/50 transition-colors"
          style={{ color: selectedOperator ? '#fff' : '#6b7280' }}
        >
          <option value="" style={{ background: '#18181b', color: '#6b7280' }}>
            {operatorsLoading ? 'Loading operators...' : 'Select Operator'}
          </option>
          {operators.map(op => (
            <option
              key={op.operator_id}
              value={op.operator_id}
              style={{ background: '#18181b', color: '#fff' }}
            >
              {op.name}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-3 pointer-events-none">
          {operatorsLoading
            ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </div>
      </div>

      {/* Amount Input — hard capped at 500 */}
      <div className="mb-4">
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-medium">₹</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            placeholder="Amount"
            value={amount}
            onChange={handleAmountChange}
            data-testid="recharge-amount-input"
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>
        {prcEstimate > 0 && (
          <p className="text-gray-500 text-[10px] mt-1 pl-1" data-testid="recharge-prc-estimate">
            Estimated: ~{prcEstimate.toLocaleString('en-IN')} PRC (incl. charges)
          </p>
        )}
      </div>

      {/* Recharge Button */}
      <button
        onClick={handleRecharge}
        disabled={loading || !isFormValid}
        data-testid="recharge-submit-btn"
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
          loading || !isFormValid
            ? 'bg-zinc-700/60 text-zinc-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 active:scale-[0.98]'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Recharge Now
          </>
        )}
      </button>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            data-testid="recharge-result"
            className={`mt-3 p-3 rounded-lg flex items-start gap-2 text-xs ${
              result.success
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {result.success
              ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            }
            <span>{result.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Successful Recharges */}
      {recentTxns.length > 0 && (
        <div className="mt-4 pt-3 border-t border-zinc-700/40" data-testid="recent-recharges">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Recent Recharges</p>
          <div className="space-y-2">
            {recentTxns.map((txn) => (
              <div
                key={txn.request_id}
                className="flex items-center justify-between"
                data-testid={`recent-txn-${txn.request_id}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {txn.recharge_type === 'dth'
                    ? <Tv className="w-3.5 h-3.5 text-cyan-500/60 flex-shrink-0" />
                    : <Smartphone className="w-3.5 h-3.5 text-cyan-500/60 flex-shrink-0" />
                  }
                  <span className="text-white/70 text-xs truncate">
                    {txn.number}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-emerald-400 text-xs font-semibold">
                    ₹{Number(txn.amount_inr || 0).toLocaleString('en-IN')}
                  </span>
                  <CheckCircle className="w-3 h-3 text-emerald-500/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default RechargeCard;
