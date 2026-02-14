import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, Building2, CreditCard, Shield, Clock, CheckCircle, XCircle,
  AlertCircle, Info, ChevronDown, ChevronUp, Wallet, BadgeCheck
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { validateIFSC } from '@/utils/indianValidation';

const API = process.env.REACT_APP_BACKEND_URL || '';

const BankRedeem = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  
  // Data states
  const [userData, setUserData] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [denominations, setDenominations] = useState([]);
  const [history, setHistory] = useState([]);
  
  // Form states
  const [showBankForm, setShowBankForm] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(100); // Slider amount in INR
  const [expandedHistory, setExpandedHistory] = useState(null);
  
  // Bank form data
  const [bankForm, setBankForm] = useState({
    account_holder_name: '',
    account_number: '',
    confirm_account_number: '',
    ifsc_code: '',
    bank_name: ''
  });

  // Calculate fees based on amount - EMI style charges
  const calculateFees = (amountInr) => {
    // EMI style processing fee:
    // <= ₹499: 50% of amount
    // > ₹499: Flat ₹10
    let processingFee;
    if (amountInr <= 499) {
      processingFee = Math.floor(amountInr * 0.5); // 50% of amount
    } else {
      processingFee = 10; // Flat ₹10
    }
    
    // No admin charges now
    const adminCharges = 0;
    const totalCharges = processingFee + adminCharges;
    const prcRequired = (amountInr + totalCharges) * 10; // 10 PRC = ₹1
    
    return {
      processingFee,
      adminCharges,
      totalCharges,
      prcRequired,
      youReceive: amountInr
    };
  };

  useEffect(() => {
    if (!user?.uid) {
      navigate('/login');
      return;
    }
    
    // Check subscription
    const isPaidPlan = ['startup', 'growth', 'elite'].includes(user.subscription_plan?.toLowerCase());
    if (!isPaidPlan) {
      toast.error('Paid subscription required for bank redeem');
      setTimeout(() => navigate('/subscription'), 1500);
      return;
    }
    
    fetchAllData();
  }, [user?.uid, user?.subscription_plan]);

  const fetchAllData = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      const [userRes, bankRes, denomRes, eligRes, historyRes] = await Promise.all([
        axios.get(`${API}/api/auth/user/${user.uid}`),
        axios.get(`${API}/api/bank-details/${user.uid}`).catch(() => ({ data: { has_bank_details: false } })),
        axios.get(`${API}/api/bank-redeem/denominations`),
        axios.get(`${API}/api/bank-redeem/check-eligibility/${user.uid}`).catch(() => ({ data: { eligible: false, reason: 'error' } })),
        axios.get(`${API}/api/bank-redeem/history/${user.uid}`).catch(() => ({ data: { requests: [] } }))
      ]);
      
      setUserData(userRes.data);
      setBankDetails(bankRes.data.has_bank_details ? bankRes.data.bank_details : null);
      setDenominations(denomRes.data.denominations || []);
      setEligibility(eligRes.data);
      setHistory(historyRes.data.requests || []);
      
      // Pre-fill bank form - Account holder name ALWAYS from profile (must match)
      const profileName = userRes.data?.name?.toUpperCase() || '';
      
      if (bankRes.data.has_bank_details) {
        setBankForm(prev => ({
          ...prev,
          account_holder_name: profileName, // Always use profile name
          ifsc_code: bankRes.data.bank_details.ifsc_code || '',
          bank_name: bankRes.data.bank_details.bank_name || ''
        }));
      } else {
        // Auto-fill account holder name from profile for new users
        setBankForm(prev => ({
          ...prev,
          account_holder_name: profileName
        }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBankDetails = async () => {
    // Validations
    if (!bankForm.account_holder_name.trim()) {
      toast.error('Account holder name is required');
      return;
    }
    
    // Account number validation (9-18 digits)
    const accNum = bankForm.account_number.replace(/\D/g, '');
    if (accNum.length < 9 || accNum.length > 18) {
      toast.error('Account number must be 9-18 digits');
      return;
    }
    
    if (accNum !== bankForm.confirm_account_number) {
      toast.error('Account numbers do not match');
      return;
    }
    
    // IFSC validation (4 letters + 0 + 6 alphanumeric)
    const ifsc = bankForm.ifsc_code.toUpperCase();
    const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscPattern.test(ifsc)) {
      toast.error('Invalid IFSC format. Must be: 4 letters + 0 + 6 characters (e.g., SBIN0001234)');
      return;
    }
    
    if (!bankForm.bank_name.trim()) {
      toast.error('Bank name is required');
      return;
    }
    
    setSavingBank(true);
    try {
      await axios.post(`${API}/api/bank-details/${user.uid}`, {
        account_holder_name: bankForm.account_holder_name.trim(),
        account_number: accNum,
        ifsc_code: ifsc,
        bank_name: bankForm.bank_name.trim()
      });
      
      toast.success('Bank details saved successfully!');
      setShowBankForm(false);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save bank details');
    } finally {
      setSavingBank(false);
    }
  };

  const handleRedeem = async () => {
    if (!selectedAmount || selectedAmount < 100) {
      toast.error('Minimum redeem amount is ₹100');
      return;
    }
    
    if (!eligibility?.eligible) {
      toast.error(eligibility?.message || 'Not eligible for redeem');
      return;
    }
    
    const currentBalance = userData?.prc_balance || 0;
    const maxAllowedPRC = Math.floor(currentBalance * 0.5); // 50% limit
    const fees = calculateFees(selectedAmount);
    
    if (fees.prcRequired > maxAllowedPRC) {
      toast.error(`You can only redeem up to 50% of your balance (${maxAllowedPRC.toLocaleString()} PRC)`);
      return;
    }
    
    if (currentBalance < fees.prcRequired) {
      toast.error(`Insufficient balance. Need ${fees.prcRequired.toLocaleString()} PRC`);
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await axios.post(`${API}/api/bank-redeem/request/${user.uid}`, {
        amount_inr: selectedAmount
      });
      
      toast.success(`Redeem request submitted! ₹${selectedAmount.toLocaleString()} will be credited to your bank account after approval.`);
      setSelectedAmount(100);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit redeem request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock, label: 'Pending' },
      approved: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle, label: 'Approved' },
      processing: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: AlertCircle, label: 'Processing' },
      rejected: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle, label: 'Rejected' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 pb-24 pt-16">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl pt-4 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/profile')}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 flex items-center justify-center hover:border-green-500/50 transition-all"
            data-testid="bank-redeem-back-btn"
          >
            <ArrowLeft className="h-5 w-5 text-gray-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-green-100 to-green-200 bg-clip-text text-transparent">
              Bank Redeem
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">Redeem PRC to your bank account</p>
          </div>
          {/* Balance */}
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl">
            <Wallet className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-[10px] text-amber-300/70 uppercase">Balance</p>
              <p className="text-sm font-bold text-amber-400">{(userData?.prc_balance || 0).toLocaleString()} PRC</p>
            </div>
          </div>
        </div>

        {/* KYC Warning */}
        {userData?.kyc_status !== 'verified' && (
          <div className="mb-6 p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-2xl">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-orange-400" />
              <div className="flex-1">
                <p className="text-orange-400 font-semibold">KYC Verification Required</p>
                <p className="text-orange-300/70 text-sm">Complete KYC to enable bank redeem</p>
              </div>
              <Button
                onClick={() => navigate('/kyc')}
                className="bg-orange-500 hover:bg-orange-600 text-black"
                data-testid="complete-kyc-btn"
              >
                Complete KYC
              </Button>
            </div>
          </div>
        )}

        {/* Weekly Limit Warning */}
        {eligibility && !eligibility.eligible && eligibility.reason === 'weekly_limit' && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-2xl">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-blue-400" />
              <div className="flex-1">
                <p className="text-blue-400 font-semibold">Weekly Limit Reached</p>
                <p className="text-blue-300/70 text-sm">
                  You have a pending request. Next redeem available after{' '}
                  {eligibility.next_eligible_date ? new Date(eligibility.next_eligible_date).toLocaleDateString() : '7 days'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bank Details Card */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-gray-800/50">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Bank Account</h2>
                    <p className="text-xs text-gray-500">Your redeem destination</p>
                  </div>
                </div>
                {bankDetails && (
                  <button
                    onClick={() => setShowBankForm(!showBankForm)}
                    className="text-green-400 text-sm hover:text-green-300 transition-colors"
                    data-testid="edit-bank-details-btn"
                  >
                    Edit
                  </button>
                )}
              </div>

              {bankDetails && !showBankForm ? (
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl p-4 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <BadgeCheck className="h-5 w-5 text-green-400" />
                    <span className="text-green-400 text-sm font-medium">Bank Account Linked</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Account Holder</span>
                      <span className="text-white font-medium">{bankDetails.account_holder_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Account Number</span>
                      <span className="text-white font-medium">{bankDetails.account_number_masked}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">IFSC Code</span>
                      <span className="text-white font-medium">{bankDetails.ifsc_code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Bank Name</span>
                      <span className="text-white font-medium">{bankDetails.bank_name}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {!bankDetails && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl mb-4">
                      <p className="text-yellow-400 text-sm flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Add your bank details to enable redeem
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <Label className="text-gray-300 text-sm mb-2 block">
                      Account Holder Name *
                      <span className="text-green-400 text-xs ml-2">(Must match your profile name)</span>
                    </Label>
                    <Input
                      value={bankForm.account_holder_name}
                      readOnly
                      className="h-12 bg-gray-900/80 border-gray-700/50 text-white rounded-xl cursor-not-allowed"
                      data-testid="bank-holder-name-input"
                    />
                    <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Auto-filled from your profile: {userData?.name?.toUpperCase()}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        Account Number *
                        <span className="text-gray-500 text-xs ml-2">(9-18 digits)</span>
                      </Label>
                      <Input
                        type="password"
                        value={bankForm.account_number}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 18);
                          setBankForm({ ...bankForm, account_number: val });
                        }}
                        placeholder="Enter account number"
                        maxLength={18}
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        data-testid="bank-account-input"
                      />
                      {bankForm.account_number && (
                        <p className={`text-xs mt-1 ${bankForm.account_number.length >= 9 && bankForm.account_number.length <= 18 ? 'text-green-400' : 'text-orange-400'}`}>
                          {bankForm.account_number.length} digits {bankForm.account_number.length >= 9 ? '✓' : '(min 9 required)'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">Confirm Account Number *</Label>
                      <Input
                        value={bankForm.confirm_account_number}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 18);
                          setBankForm({ ...bankForm, confirm_account_number: val });
                        }}
                        placeholder="Re-enter account number"
                        maxLength={18}
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        data-testid="bank-account-confirm-input"
                      />
                      {bankForm.account_number && bankForm.confirm_account_number && (
                        bankForm.account_number === bankForm.confirm_account_number ? (
                          <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Account numbers match
                          </p>
                        ) : (
                          <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Account numbers do not match
                          </p>
                        )
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">
                        IFSC Code *
                        <span className="text-gray-500 text-xs ml-2">(4 letters + 0 + 6 chars)</span>
                      </Label>
                      <Input
                        value={bankForm.ifsc_code}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
                          setBankForm({ ...bankForm, ifsc_code: val });
                        }}
                        placeholder="e.g., SBIN0001234"
                        maxLength={11}
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl uppercase"
                        data-testid="bank-ifsc-input"
                      />
                      {bankForm.ifsc_code && (
                        validateIFSC(bankForm.ifsc_code).isValid ? (
                          <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Valid IFSC - Bank: {validateIFSC(bankForm.ifsc_code).bankCode}
                          </p>
                        ) : bankForm.ifsc_code.length === 11 ? (
                          <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Invalid IFSC format (must be: ABCD0XXXXXX)
                          </p>
                        ) : (
                          <p className="text-orange-400 text-xs mt-1">
                            {bankForm.ifsc_code.length}/11 characters
                          </p>
                        )
                      )}
                    </div>
                    <div>
                      <Label className="text-gray-300 text-sm mb-2 block">Bank Name *</Label>
                      <Input
                        value={bankForm.bank_name}
                        onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value.toUpperCase() })}
                        placeholder="e.g., State Bank of India"
                        className="h-12 bg-gray-800/50 border-gray-700/50 text-white rounded-xl"
                        data-testid="bank-name-input"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    {showBankForm && bankDetails && (
                      <Button
                        onClick={() => setShowBankForm(false)}
                        variant="outline"
                        className="flex-1 bg-gray-800 border-gray-700 text-white"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      onClick={handleSaveBankDetails}
                      disabled={savingBank}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black font-bold"
                      data-testid="save-bank-details-btn"
                    >
                      {savingBank ? 'Saving...' : 'Save Bank Details'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Redeem Amount Selection - SLIDER */}
            {bankDetails && eligibility?.eligible && (
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-gray-800/50">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Redeem Amount</h2>
                    <p className="text-xs text-gray-500">Slide to select amount</p>
                  </div>
                </div>

                {/* Amount Display */}
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl p-6 mb-6 text-center border border-amber-500/30">
                  <p className="text-amber-300/70 text-sm mb-1">You will receive</p>
                  <p className="text-5xl font-bold text-white mb-2">
                    ₹{selectedAmount?.toLocaleString() || 0}
                  </p>
                  <p className="text-amber-400/60 text-xs">
                    {(selectedAmount * 10).toLocaleString()} PRC equivalent
                  </p>
                </div>

                {/* Slider */}
                {(() => {
                  const currentBalance = userData?.prc_balance || 0;
                  const maxAllowedPRC = Math.floor(currentBalance * 0.5);
                  const maxAmountINR = Math.floor(maxAllowedPRC / 12); // ~₹1 needs 12 PRC with fees
                  const minAmount = 100;
                  const actualMax = Math.max(minAmount, Math.min(maxAmountINR, 25000));
                  
                  return (
                    <div className="mb-6">
                      {/* Slider Track */}
                      <div className="relative">
                        <input
                          type="range"
                          min={minAmount}
                          max={actualMax}
                          step={100}
                          value={selectedAmount || minAmount}
                          onChange={(e) => setSelectedAmount(parseInt(e.target.value))}
                          className="w-full h-3 bg-gray-800 rounded-full appearance-none cursor-pointer slider-thumb"
                          style={{
                            background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${((selectedAmount - minAmount) / (actualMax - minAmount)) * 100}%, #374151 ${((selectedAmount - minAmount) / (actualMax - minAmount)) * 100}%, #374151 100%)`
                          }}
                          data-testid="amount-slider"
                        />
                      </div>
                      
                      {/* Min/Max Labels */}
                      <div className="flex justify-between mt-2 text-xs text-gray-500">
                        <span>₹{minAmount}</span>
                        <span>₹{actualMax.toLocaleString()}</span>
                      </div>
                      
                      {/* Quick Select Buttons */}
                      <div className="flex gap-2 mt-4 flex-wrap justify-center">
                        {[100, 500, 1000, 2000, 5000].filter(amt => amt <= actualMax).map(amt => (
                          <button
                            key={amt}
                            onClick={() => setSelectedAmount(amt)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                              selectedAmount === amt
                                ? 'bg-amber-500 text-black'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            ₹{amt.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Charge Breakdown */}
                {selectedAmount >= 100 && (
                  <div className="bg-gradient-to-br from-gray-800/50 to-gray-800/30 rounded-2xl p-4 border border-gray-700/50 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="h-4 w-4 text-amber-400" />
                      <p className="text-xs text-amber-300 font-semibold">Charge Breakdown</p>
                    </div>
                    {(() => {
                      const fees = calculateFees(selectedAmount);
                      return (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Redeem Amount</span>
                            <span className="text-white">₹{selectedAmount.toLocaleString()} ({(selectedAmount * 10).toLocaleString()} PRC)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">
                              Processing Fee {selectedAmount <= 499 ? '(50%)' : '(Flat)'}
                            </span>
                            <span className="text-orange-400">+₹{fees.processingFee} ({fees.processingFee * 10} PRC)</span>
                          </div>
                          <div className="flex justify-between pt-3 border-t border-gray-700">
                            <span className="text-amber-400 font-bold">Total PRC Deducted</span>
                            <span className="text-xl font-bold text-amber-400">{fees.prcRequired.toLocaleString()} PRC</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">You will receive</span>
                            <span className="text-green-400 font-semibold">₹{selectedAmount.toLocaleString()} in your bank</span>
                          </div>
                          {/* Fee Info */}
                          <div className="mt-2 pt-2 border-t border-gray-700/50">
                            <p className="text-xs text-gray-500 text-center">
                              ≤₹499: 50% fee | &gt;₹499: ₹10 flat fee
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <Button
                  onClick={handleRedeem}
                  disabled={!selectedAmount || selectedAmount < 100 || submitting}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 text-gray-900 font-bold rounded-2xl"
                  data-testid="submit-redeem-btn"
                >
                  {submitting ? 'Processing...' : `Redeem ₹${selectedAmount?.toLocaleString() || 0}`}
                </Button>
              </div>
            )}

            {/* Redeem History */}
            {history.length > 0 && (
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-gray-800/50">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
                    <Clock className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Redeem History</h2>
                    <p className="text-xs text-gray-500">Your previous requests</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {history.map((req) => (
                    <div
                      key={req.request_id}
                      className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedHistory(expandedHistory === req.request_id ? null : req.request_id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-700/50 rounded-xl flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-gray-400" />
                          </div>
                          <div className="text-left">
                            <p className="text-white font-semibold">₹{req.amount_inr?.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(req.status)}
                          {expandedHistory === req.request_id ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                      </button>
                      
                      {expandedHistory === req.request_id && (
                        <div className="px-4 pb-4 border-t border-gray-700/50 pt-3">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Request ID</span>
                              <span className="text-white font-mono text-xs">{req.request_id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Bank</span>
                              <span className="text-white">{req.bank_details?.bank_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Account</span>
                              <span className="text-white">{req.bank_details?.account_masked}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">PRC Deducted</span>
                              <span className="text-amber-400">{req.total_prc_deducted?.toLocaleString()} PRC</span>
                            </div>
                            {req.status === 'rejected' && req.rejection_reason && (
                              <div className="mt-3 p-3 bg-red-500/10 rounded-xl border border-red-500/30">
                                <p className="text-red-400 text-xs font-medium">Rejection Reason:</p>
                                <p className="text-red-300 text-sm">{req.rejection_reason}</p>
                              </div>
                            )}
                            {req.status === 'approved' && req.transaction_ref && (
                              <div className="mt-3 p-3 bg-green-500/10 rounded-xl border border-green-500/30">
                                <p className="text-green-400 text-xs font-medium">Transaction Ref:</p>
                                <p className="text-green-300 text-sm">{req.transaction_ref}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Info */}
          <div className="space-y-6">
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-amber-600/20 rounded-3xl p-6 border border-amber-500/30">
              <div className="flex items-center gap-3 mb-4">
                <Wallet className="h-8 w-8 text-amber-400" />
                <div>
                  <p className="text-amber-300/70 text-xs uppercase">Available Balance</p>
                  <p className="text-3xl font-bold text-white">{(userData?.prc_balance || 0).toLocaleString()}</p>
                </div>
              </div>
              <p className="text-amber-300/70 text-xs">PRC (10 PRC = ₹1)</p>
            </div>

            {/* How It Works */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-3xl p-6 border border-gray-800/50">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Info className="h-5 w-5 text-green-400" />
                How It Works
              </h3>
              <ol className="text-sm text-gray-400 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-xs font-bold text-green-400 flex-shrink-0">1</span>
                  <span>Add your bank account details</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-xs font-bold text-green-400 flex-shrink-0">2</span>
                  <span>Select redeem amount</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-xs font-bold text-green-400 flex-shrink-0">3</span>
                  <span>PRC deducted instantly</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-xs font-bold text-green-400 flex-shrink-0">4</span>
                  <span>Admin approves & transfers</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-xs font-bold text-green-400 flex-shrink-0">5</span>
                  <span>Amount credited to bank</span>
                </li>
              </ol>
            </div>

            {/* Rules */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-3xl p-6 border border-blue-500/20">
              <h3 className="font-bold text-blue-400 mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Important Rules
              </h3>
              <ul className="text-xs text-blue-300 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>KYC verification required</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>Maximum 1 request per week</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>Fixed amounts only: ₹100 - ₹25,000</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>Processing time: 3-7 business days</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>PRC refunded if request rejected</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankRedeem;
