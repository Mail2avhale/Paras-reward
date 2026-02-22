import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, TrendingUp, Clock, Calendar, ArrowLeft,
  PiggyBank, Percent, AlertTriangle, CheckCircle2,
  ChevronRight, Info, Sparkles, Building2, ArrowUpRight,
  ArrowDownRight, History, Settings, RefreshCw, Calculator
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Interest rate tiers
const TENURE_OPTIONS = [
  { months: 6, label: '6 Months', rate: 7.5, icon: '📅' },
  { months: 12, label: '1 Year', rate: 8.5, icon: '📆', recommended: true },
  { months: 24, label: '2 Years', rate: 9.0, icon: '🗓️' },
  { months: 36, label: '3 Years', rate: 9.25, icon: '📊' }
];

const ParasRecurringDeposit = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rdsData, setRdsData] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedRd, setSelectedRd] = useState(null);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [luxurySavings, setLuxurySavings] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [autoMigrating, setAutoMigrating] = useState(false);

  // Create RD form state
  const [newRd, setNewRd] = useState({
    tenure: 12,
    monthlyDeposit: 1000,
    initialDeposit: 0
  });

  // Interest Calculator state
  const [calcAmount, setCalcAmount] = useState(5000);
  const [calcTenure, setCalcTenure] = useState(12);

  const user = JSON.parse(localStorage.getItem('paras_user') || '{}');

  useEffect(() => {
    fetchRdsData();
    checkAndAutoMigrateLuxury();
  }, []);

  const fetchRdsData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/rd/list/${user.uid}`);
      const data = await response.json();
      if (data.success) {
        setRdsData(data);
      }
    } catch (error) {
      console.error('Error fetching RDs:', error);
      toast.error('Failed to load RD data');
    } finally {
      setLoading(false);
    }
  };

  // Auto-migrate Luxury Life savings to RD
  const checkAndAutoMigrateLuxury = async () => {
    try {
      const response = await fetch(`${API}/luxury-life/savings/${user.uid}`);
      const data = await response.json();
      
      if (data.total_savings > 100 && !data.migrated_to_rd) {
        // Auto-migrate
        setAutoMigrating(true);
        setLuxurySavings(data);
        
        const migrateResponse = await fetch(`${API}/rd/migrate-from-luxury/${user.uid}`, {
          method: 'POST'
        });
        
        const migrateData = await migrateResponse.json();
        if (migrateData.success) {
          toast.success(`Successfully converted ₹${formatCurrency(data.total_savings)} PRC to RD!`);
          setLuxurySavings(null);
          fetchRdsData();
        }
        setAutoMigrating(false);
      }
    } catch (error) {
      console.error('Error checking/migrating luxury savings:', error);
      setAutoMigrating(false);
    }
  };

  const handleCreateRd = async () => {
    if (newRd.monthlyDeposit < 100) {
      toast.error('Minimum monthly deposit is 100 PRC');
      return;
    }

    try {
      setProcessing(true);
      const response = await fetch(`${API}/rd/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          monthly_deposit: newRd.monthlyDeposit,
          tenure_months: newRd.tenure,
          initial_deposit: newRd.initialDeposit
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('RD created successfully!');
        setShowCreateModal(false);
        fetchRdsData();
      } else {
        toast.error(data.detail || 'Failed to create RD');
      }
    } catch (error) {
      console.error('Error creating RD:', error);
      toast.error('Failed to create RD');
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async (rdId) => {
    try {
      setProcessing(true);
      const response = await fetch(`${API}/rd/withdraw/${rdId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Savings Redeem Request Submitted!\n\nProcessing Time: 3 to 7 days. PRC amount will be credited to your bank account after admin approval.', {
          duration: 6000,
        });
        setShowWithdrawModal(false);
        setSelectedRd(null);
        fetchRdsData();
      } else {
        toast.error(data.detail || 'Request failed');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN').format(Math.round(amount));
  };

  const getSelectedTenure = () => {
    return TENURE_OPTIONS.find(t => t.months === newRd.tenure) || TENURE_OPTIONS[1];
  };

  const calculateExpectedMaturity = () => {
    const tenure = getSelectedTenure();
    const totalDeposits = newRd.initialDeposit > 0 
      ? newRd.initialDeposit + (newRd.monthlyDeposit * (tenure.months - 1))
      : newRd.monthlyDeposit * tenure.months;
    
    const quarterlyRate = tenure.rate / 100 / 4;
    const quarters = tenure.months / 3;
    const maturity = totalDeposits * Math.pow(1 + quarterlyRate, quarters);
    
    return {
      principal: totalDeposits,
      interest: maturity - totalDeposits,
      maturity: maturity
    };
  };

  // Interest Calculator function
  const calculateInterest = () => {
    const tenure = TENURE_OPTIONS.find(t => t.months === calcTenure) || TENURE_OPTIONS[1];
    const quarterlyRate = tenure.rate / 100 / 4;
    const quarters = calcTenure / 3;
    const maturity = calcAmount * Math.pow(1 + quarterlyRate, quarters);
    const interest = maturity - calcAmount;
    
    return {
      principal: calcAmount,
      rate: tenure.rate,
      interest: interest,
      maturity: maturity
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Building2 className="w-12 h-12 text-emerald-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/50">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-gray-800/50">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-white">PRC Savings Vault</h1>
          <button onClick={fetchRdsData} className="p-2 rounded-full bg-gray-800/50">
            <RefreshCw className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Disclaimer Banner */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
          <p className="text-blue-300 text-xs text-center">
            ⚠️ This is a virtual PRC points savings feature. No real money deposits are accepted. 
            PRC points have no cash value and cannot be exchanged for real currency.
          </p>
        </div>

        {/* Auto Migration Notification */}
        {autoMigrating && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-2xl p-4 border border-amber-500/30"
          >
            <div className="flex items-center gap-3">
              <div className="animate-spin">
                <RefreshCw className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-amber-400">Converting to PRC Savings Vault...</h3>
                <p className="text-sm text-amber-200/80">
                  Please wait while we convert your savings.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-600/20 to-teal-600/20 rounded-3xl p-6 border border-emerald-500/30"
        >
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-6 h-6 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">PRC SAVINGS VAULT</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-xs mb-1">Total Deposited</p>
              <p className="text-2xl font-bold text-white">
                ₹{formatCurrency(rdsData?.summary?.total_deposited || 0)}
              </p>
              <p className="text-emerald-400 text-xs">PRC</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Interest Earned</p>
              <p className="text-2xl font-bold text-emerald-400">
                +₹{formatCurrency(rdsData?.summary?.total_interest_earned || 0)}
              </p>
              <p className="text-emerald-400/70 text-xs">PRC</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-emerald-500/20">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Current Value</span>
              <span className="text-xl font-bold text-white">
                ₹{formatCurrency(rdsData?.summary?.total_current_value || 0)} PRC
              </span>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <span className="px-3 py-1 bg-emerald-500/20 rounded-full text-emerald-400 text-xs">
              {rdsData?.summary?.active_rds || 0} Active RDs
            </span>
            <span className="px-3 py-1 bg-blue-500/20 rounded-full text-blue-400 text-xs">
              20% Compulsory Savings
            </span>
          </div>
        </motion.div>

        {/* Interest Calculator Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-2xl p-5 border border-blue-500/30"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Interest Calculator</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Deposit Amount (PRC)</label>
              <input
                type="number"
                value={calcAmount}
                onChange={(e) => setCalcAmount(Number(e.target.value) || 0)}
                className="w-full p-3 bg-gray-800/70 rounded-xl text-white border border-gray-700 focus:border-blue-500 outline-none"
                placeholder="Enter amount"
                data-testid="calc-amount-input"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tenure</label>
              <select
                value={calcTenure}
                onChange={(e) => setCalcTenure(Number(e.target.value))}
                className="w-full p-3 bg-gray-800/70 rounded-xl text-white border border-gray-700 focus:border-blue-500 outline-none"
                data-testid="calc-tenure-select"
              >
                {TENURE_OPTIONS.map(opt => (
                  <option key={opt.months} value={opt.months}>
                    {opt.label} @ {opt.rate}%
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Calculator Results */}
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500">Principal</p>
                <p className="text-lg font-bold text-white">₹{formatCurrency(calculateInterest().principal)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Interest ({calculateInterest().rate}%)</p>
                <p className="text-lg font-bold text-blue-400">+₹{formatCurrency(calculateInterest().interest)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Maturity</p>
                <p className="text-lg font-bold text-emerald-400">₹{formatCurrency(calculateInterest().maturity)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Interest Rates Info */}
        <div className="bg-gray-900/50 rounded-2xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <Percent className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Interest Rates</h3>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {TENURE_OPTIONS.map((tenure) => (
              <div 
                key={tenure.months}
                className={`text-center p-2 rounded-xl ${
                  tenure.recommended 
                    ? 'bg-emerald-500/20 border border-emerald-500/50' 
                    : 'bg-gray-800/50'
                }`}
              >
                <p className="text-lg">{tenure.icon}</p>
                <p className="text-xs text-gray-400">{tenure.label}</p>
                <p className={`font-bold ${tenure.recommended ? 'text-emerald-400' : 'text-white'}`}>
                  {tenure.rate}%
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Create New RD Button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl text-white font-bold text-lg shadow-lg shadow-emerald-500/30"
          data-testid="create-rd-btn"
        >
          + Create New RD
        </motion.button>

        {/* RD List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-gray-400" />
            Your RD Accounts
          </h3>
          
          {(!rdsData?.rds || rdsData.rds.length === 0) ? (
            <div className="text-center py-10 bg-gray-900/30 rounded-2xl border border-gray-800/50">
              <PiggyBank className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No RD accounts yet</p>
              <p className="text-gray-500 text-sm mt-1">Create your first RD to start earning interest!</p>
            </div>
          ) : (
            rdsData.rds.map((rd, index) => (
              <motion.div
                key={rd.rd_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-gray-900/50 rounded-2xl p-4 border ${
                  rd.status === 'active' 
                    ? 'border-emerald-500/30' 
                    : rd.status === 'matured'
                    ? 'border-amber-500/30'
                    : 'border-gray-700'
                }`}
                data-testid={`rd-card-${rd.rd_id}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-xs text-gray-500">{rd.rd_id}</p>
                    <p className="font-semibold text-white">
                      {rd.tenure_months} Months @ {rd.interest_rate}% p.a.
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    rd.status === 'active' 
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : rd.status === 'matured'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {rd.status.toUpperCase()}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Deposited</p>
                    <p className="font-semibold text-white">₹{formatCurrency(rd.total_deposited)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Interest</p>
                    <p className="font-semibold text-emerald-400">+₹{formatCurrency(rd.interest_earned)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Value</p>
                    <p className="font-semibold text-white">₹{formatCurrency(rd.current_value)}</p>
                  </div>
                </div>
                
                {/* Progress Bar */}
                {rd.status === 'active' && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{rd.progress_percent}%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${rd.progress_percent}%` }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{rd.deposits_made} deposits</span>
                      <span>{rd.days_remaining} days left</span>
                    </div>
                  </div>
                )}
                
                {rd.migrated_from_luxury && (
                  <div className="flex items-center gap-1 text-xs text-amber-400 mb-3">
                    <Sparkles className="w-3 h-3" />
                    <span>Converted from Luxury Life</span>
                  </div>
                )}
                
                {rd.status === 'active' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedRd(rd);
                        setShowWithdrawModal(true);
                      }}
                      className="flex-1 py-2 bg-gray-800 rounded-xl text-gray-300 text-sm font-medium"
                      data-testid={`withdraw-btn-${rd.rd_id}`}
                    >
                      Redeem Early
                    </button>
                    <button
                      onClick={() => navigate(`/rd/${rd.rd_id}`)}
                      className="px-4 py-2 bg-emerald-500/20 rounded-xl text-emerald-400 text-sm font-medium"
                    >
                      Details
                    </button>
                  </div>
                )}
                
                {rd.status === 'matured' && (
                  <button
                    onClick={() => handleWithdraw(rd.rd_id)}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-xl text-black font-bold"
                  >
                    Claim Maturity Amount
                  </button>
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* Info Section */}
        <div className="bg-gray-900/30 rounded-2xl p-4 border border-gray-800/50">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-400 space-y-2">
              <p><strong className="text-white">Compulsory Savings:</strong> 20% of your mining earnings are automatically deposited to RD.</p>
              <p><strong className="text-white">Early Redemption:</strong> 3% penalty applies. Request needs admin approval.</p>
              <p><strong className="text-white">Weekly Limit:</strong> Only 1 redemption request per week (EMI / Bank Redeem / RD Redeem).</p>
              <p><strong className="text-white">Interest:</strong> Calculated with quarterly compounding.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Create RD Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full bg-gray-900 rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
              
              <h2 className="text-xl font-bold text-white mb-6">Create New RD</h2>
              
              {/* Tenure Selection */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">Select Tenure</label>
                <div className="grid grid-cols-2 gap-3">
                  {TENURE_OPTIONS.map((tenure) => (
                    <button
                      key={tenure.months}
                      onClick={() => setNewRd({ ...newRd, tenure: tenure.months })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        newRd.tenure === tenure.months
                          ? 'border-emerald-500 bg-emerald-500/20'
                          : 'border-gray-700 bg-gray-800/50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{tenure.icon}</div>
                      <p className="font-semibold text-white">{tenure.label}</p>
                      <p className={`text-lg font-bold ${
                        newRd.tenure === tenure.months ? 'text-emerald-400' : 'text-gray-300'
                      }`}>
                        {tenure.rate}% p.a.
                      </p>
                      {tenure.recommended && (
                        <span className="text-xs bg-emerald-500 text-black px-2 py-0.5 rounded-full mt-1 inline-block">
                          Recommended
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Monthly Deposit */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">Monthly Deposit (PRC)</label>
                <input
                  type="number"
                  value={newRd.monthlyDeposit}
                  onChange={(e) => setNewRd({ ...newRd, monthlyDeposit: Number(e.target.value) })}
                  className="w-full p-4 bg-gray-800 rounded-xl text-white text-lg border border-gray-700 focus:border-emerald-500 outline-none"
                  placeholder="Min 100 PRC"
                  min="100"
                  data-testid="monthly-deposit-input"
                />
              </div>
              
              {/* Initial Deposit (Optional) */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">Initial Deposit (Optional)</label>
                <input
                  type="number"
                  value={newRd.initialDeposit}
                  onChange={(e) => setNewRd({ ...newRd, initialDeposit: Number(e.target.value) })}
                  className="w-full p-4 bg-gray-800 rounded-xl text-white text-lg border border-gray-700 focus:border-emerald-500 outline-none"
                  placeholder="Extra initial amount"
                  min="0"
                />
              </div>
              
              {/* Expected Maturity */}
              <div className="bg-emerald-500/10 rounded-xl p-4 mb-6 border border-emerald-500/30">
                <p className="text-sm text-gray-400 mb-2">Expected at Maturity</p>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500">Principal</p>
                    <p className="text-white">₹{formatCurrency(calculateExpectedMaturity().principal)} PRC</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Interest</p>
                    <p className="text-emerald-400">+₹{formatCurrency(calculateExpectedMaturity().interest)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Maturity</p>
                    <p className="text-xl font-bold text-white">₹{formatCurrency(calculateExpectedMaturity().maturity)}</p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleCreateRd}
                disabled={processing || newRd.monthlyDeposit < 100}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-white font-bold text-lg disabled:opacity-50"
                data-testid="confirm-create-rd-btn"
              >
                {processing ? 'Creating...' : 'Create RD Account'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdraw Confirmation Modal */}
      <AnimatePresence>
        {showWithdrawModal && selectedRd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowWithdrawModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-gray-900 rounded-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white">RD Redeem Request</h3>
                <p className="text-gray-400 text-sm mt-2">
                  Processing Time: 3 to 7 days
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-xl p-4 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Current Value</span>
                  <span className="text-white">₹{formatCurrency(selectedRd.current_value)} PRC</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Early Penalty (3%)</span>
                  <span className="text-red-400">-₹{formatCurrency(selectedRd.current_value * 0.03)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Admin Charge (20%)</span>
                  <span className="text-red-400">-₹{formatCurrency(selectedRd.current_value * 0.20)}</span>
                </div>
                <div className="border-t border-gray-700 pt-2 flex justify-between">
                  <span className="text-white font-medium">Net Amount (PRC)</span>
                  <span className="text-emerald-400 font-bold">
                    ₹{formatCurrency(selectedRd.current_value * 0.77)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Bank Transfer (INR)</span>
                  <span className="text-emerald-400 font-semibold">
                    ₹{formatCurrency(selectedRd.current_value * 0.77 / 10)}
                  </span>
                </div>
              </div>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
                <p className="text-blue-400 text-xs text-center">
                  Your request will be sent to admin for approval. Amount will be credited to your bank account after approval.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-3 bg-gray-800 rounded-xl text-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleWithdraw(selectedRd.rd_id)}
                  disabled={processing}
                  className="flex-1 py-3 bg-amber-500 rounded-xl text-black font-bold disabled:opacity-50"
                  data-testid="confirm-withdraw-btn"
                >
                  {processing ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ParasRecurringDeposit;
