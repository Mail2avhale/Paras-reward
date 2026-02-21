import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, TrendingUp, Clock, Calendar, ArrowLeft,
  PiggyBank, Percent, AlertTriangle, CheckCircle2,
  ChevronRight, Info, Sparkles, Building2, ArrowUpRight,
  ArrowDownRight, History, Settings, RefreshCw
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

  // Create RD form state
  const [newRd, setNewRd] = useState({
    tenure: 12,
    monthlyDeposit: 1000,
    initialDeposit: 0
  });

  const user = JSON.parse(localStorage.getItem('paras_user') || '{}');

  useEffect(() => {
    fetchRdsData();
    checkLuxurySavings();
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

  const checkLuxurySavings = async () => {
    try {
      const response = await fetch(`${API}/luxury-life/savings/${user.uid}`);
      const data = await response.json();
      if (data.total_savings > 0 && !data.migrated_to_rd) {
        setLuxurySavings(data);
      }
    } catch (error) {
      console.error('Error checking luxury savings:', error);
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
        toast.success('🎉 RD created successfully!');
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

  const handleMigrateLuxury = async () => {
    try {
      setProcessing(true);
      const response = await fetch(`${API}/rd/migrate-from-luxury/${user.uid}`, {
        method: 'POST'
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('🎉 Luxury savings migrated to RD!');
        setShowMigrateModal(false);
        setLuxurySavings(null);
        fetchRdsData();
      } else {
        toast.error(data.detail || 'Migration failed');
      }
    } catch (error) {
      console.error('Error migrating:', error);
      toast.error('Failed to migrate');
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
        toast.success(data.message);
        setShowWithdrawModal(false);
        setSelectedRd(null);
        fetchRdsData();
      } else {
        toast.error(data.detail || 'Withdrawal failed');
      }
    } catch (error) {
      console.error('Error withdrawing:', error);
      toast.error('Failed to withdraw');
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
          <h1 className="text-lg font-bold text-white">Recurring Deposit</h1>
          <button onClick={fetchRdsData} className="p-2 rounded-full bg-gray-800/50">
            <RefreshCw className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Migration Banner - Show if user has Luxury Savings */}
        {luxurySavings && luxurySavings.total_savings > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-2xl p-4 border border-amber-500/30"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/20 rounded-full">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-400">Luxury Life → RD रूपांतरण</h3>
                <p className="text-sm text-amber-200/80 mt-1">
                  तुमची ₹{formatCurrency(luxurySavings.total_savings)} PRC Luxury savings RD मध्ये convert करा आणि 8.5% व्याज मिळवा!
                </p>
                <button
                  onClick={() => setShowMigrateModal(true)}
                  className="mt-3 px-4 py-2 bg-amber-500 text-black rounded-full text-sm font-bold"
                >
                  आता Convert करा →
                </button>
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
            <span className="text-emerald-400 font-semibold">PARAS RD</span>
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
            <span className="px-3 py-1 bg-gray-700/50 rounded-full text-gray-400 text-xs">
              20% Auto-Deduction
            </span>
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
                    <span>Migrated from Luxury Life</span>
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
                      Withdraw Early
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
                    🎉 Claim Maturity Amount
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
              <p><strong className="text-white">Auto-Deduction:</strong> 20% तुमच्या mining earnings मधून RD मध्ये automatically जमा होते.</p>
              <p><strong className="text-white">Premature Withdrawal:</strong> Maturity आधी withdraw केल्यास 3% penalty लागेल.</p>
              <p><strong className="text-white">Interest:</strong> Quarterly compounding सह calculate होते.</p>
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
                <h3 className="text-xl font-bold text-white">Early Withdrawal</h3>
                <p className="text-gray-400 text-sm mt-2">
                  Maturity आधी withdraw केल्यास 3% penalty लागेल
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-xl p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Current Value</span>
                  <span className="text-white">₹{formatCurrency(selectedRd.current_value)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Penalty (3%)</span>
                  <span className="text-red-400">-₹{formatCurrency(selectedRd.current_value * 0.03)}</span>
                </div>
                <div className="border-t border-gray-700 pt-2 flex justify-between">
                  <span className="text-white font-medium">You'll Receive</span>
                  <span className="text-emerald-400 font-bold">
                    ₹{formatCurrency(selectedRd.current_value * 0.97)} PRC
                  </span>
                </div>
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
                  {processing ? 'Processing...' : 'Withdraw'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Migration Modal */}
      <AnimatePresence>
        {showMigrateModal && luxurySavings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowMigrateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-gray-900 rounded-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Luxury → RD Migration</h3>
                <p className="text-gray-400 text-sm mt-2">
                  तुमची Luxury Life savings 12-month RD मध्ये convert होईल
                </p>
              </div>
              
              <div className="bg-amber-500/10 rounded-xl p-4 mb-6 border border-amber-500/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Mobile Savings</span>
                  <span className="text-white">₹{formatCurrency(luxurySavings.products?.find(p => p.key === 'mobile')?.current_savings || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Bike Savings</span>
                  <span className="text-white">₹{formatCurrency(luxurySavings.products?.find(p => p.key === 'bike')?.current_savings || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Car Savings</span>
                  <span className="text-white">₹{formatCurrency(luxurySavings.products?.find(p => p.key === 'car')?.current_savings || 0)}</span>
                </div>
                <div className="border-t border-amber-500/30 pt-2 flex justify-between">
                  <span className="text-white font-medium">Total</span>
                  <span className="text-amber-400 font-bold">₹{formatCurrency(luxurySavings.total_savings)} PRC</span>
                </div>
              </div>
              
              <div className="bg-emerald-500/10 rounded-xl p-4 mb-6 border border-emerald-500/30">
                <p className="text-sm text-gray-400 mb-2">New RD Details</p>
                <div className="space-y-1 text-sm">
                  <p className="text-white">📅 Tenure: <strong>12 Months</strong></p>
                  <p className="text-white">💰 Interest: <strong className="text-emerald-400">8.5% p.a.</strong></p>
                  <p className="text-white">🎯 Expected Maturity: <strong className="text-emerald-400">
                    ₹{formatCurrency(luxurySavings.total_savings * 1.085)}
                  </strong></p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMigrateModal(false)}
                  className="flex-1 py-3 bg-gray-800 rounded-xl text-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMigrateLuxury}
                  disabled={processing}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-xl text-black font-bold disabled:opacity-50"
                  data-testid="confirm-migrate-btn"
                >
                  {processing ? 'Converting...' : 'Convert Now'}
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
