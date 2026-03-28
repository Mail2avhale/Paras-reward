import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import PRCRateDisplay, { PRCRateBadge } from '../components/PRCRateDisplay';
import CategoryLimitsDisplay from '../components/CategoryLimitsDisplay';
import {
  ArrowLeft, Banknote, Building2, CheckCircle, Clock, XCircle, 
  AlertCircle, Info, Loader2, RefreshCw, IndianRupee, CreditCard,
  History, ChevronRight, Shield, FileText, Search, Filter
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock, label: 'Pending' },
    paid: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle, label: 'Paid' },
    failed: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle, label: 'Failed' },
    processing: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Loader2, label: 'Processing' }
  };
  
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
};

const BankRedeemPage = ({ user: initialUser }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(initialUser || null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingIFSC, setVerifyingIFSC] = useState(false);
  
  // Config from backend
  const [config, setConfig] = useState({
    prc_rate: 10,
    transaction_fee: 10,
    admin_fee_percent: 20,
    min_withdrawal: 200,
    max_withdrawal: 10000
  });
  
  // Form state
  const [amount, setAmount] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [ifscVerified, setIfscVerified] = useState(false);
  
  // Fees calculation
  const [fees, setFees] = useState(null);
  
  // Request history
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'
  
  // Policy agreement
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  
  // Redeem limit info
  const [redeemLimit, setRedeemLimit] = useState(null);

  // Load user and config
  useEffect(() => {
    const loadData = async () => {
      try {
        // Use initial user from props or localStorage
        let userData = initialUser;
        if (!userData?.uid) {
          userData = JSON.parse(localStorage.getItem('user') || '{}');
        }
        
        if (!userData?.uid) {
          navigate('/login');
          return;
        }
        
        // Fetch fresh user data, config, and redeem limit
        const [userRes, configRes, limitRes] = await Promise.all([
          axios.get(`${API}/users/${userData.uid}`),
          axios.get(`${API}/bank-transfer/config`),
          axios.get(`${API}/user/${userData.uid}/redeem-limit`).catch(() => ({ data: null }))
        ]);
        
        setUser(userRes.data);
        setConfig(configRes.data);
        
        // Set redeem limit info
        if (limitRes.data?.success) {
          setRedeemLimit(limitRes.data.limit);
        }
        
        // Pre-fill account holder name
        if (userRes.data.name) {
          setAccountHolder(userRes.data.name);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load data');
        setLoading(false);
      }
    };
    
    loadData();
  }, [navigate]);

  // Load request history
  const loadRequests = useCallback(async () => {
    if (!user?.uid) return;
    
    setLoadingRequests(true);
    try {
      const res = await axios.get(`${API}/bank-transfer/my-requests/${user.uid}?limit=50`);
      setRequests(res.data.requests || []);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadRequests();
    }
  }, [activeTab, loadRequests]);

  // Calculate fees when amount changes
  useEffect(() => {
    if (!amount || isNaN(amount)) {
      setFees(null);
      return;
    }
    
    const amt = parseInt(amount);
    if (amt < config.min_withdrawal || amt > config.max_withdrawal) {
      setFees(null);
      return;
    }
    
    const adminFee = Math.round(amt * config.admin_fee_percent / 100);
    const totalInr = amt + adminFee + config.transaction_fee;
    const totalPrc = totalInr * config.prc_rate;
    
    setFees({
      withdrawal_amount: amt,
      admin_fee: adminFee,
      transaction_fee: config.transaction_fee,
      total_inr: totalInr,
      total_prc: totalPrc,
      user_receives: amt
    });
  }, [amount, config]);

  // Verify IFSC
  const verifyIFSC = async () => {
    if (!ifscCode || ifscCode.length !== 11) {
      toast.error('Please enter valid 11-digit IFSC code');
      return;
    }
    
    setVerifyingIFSC(true);
    try {
      const res = await axios.post(`${API}/bank-transfer/verify-ifsc?ifsc=${ifscCode}`);
      if (res.data.success) {
        setBankName(res.data.bank_details.bank_name);
        setIfscVerified(true);
        toast.success(`Bank verified: ${res.data.bank_details.bank_name}`);
      }
    } catch (error) {
      toast.error('Failed to verify IFSC code');
      setIfscVerified(false);
    } finally {
      setVerifyingIFSC(false);
    }
  };

  // Handle IFSC input
  const handleIFSCChange = (value) => {
    const upperValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
    setIfscCode(upperValue);
    setIfscVerified(false);
    setBankName('');
  };

  // Submit request
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validations
    if (!agreedToPolicy) {
      toast.error('Please accept the terms and conditions');
      return;
    }
    
    if (!ifscVerified) {
      toast.error('Please verify IFSC code first');
      return;
    }
    
    if (accountNumber !== confirmAccountNumber) {
      toast.error('Account numbers do not match');
      return;
    }
    
    if (!fees) {
      toast.error('Please enter valid amount');
      return;
    }
    
    // Check Available Redeem Limit (NOT prc_balance)
    const availableLimit = redeemLimit?.effective_available || redeemLimit?.effective_remaining || redeemLimit?.remaining_limit || redeemLimit?.remaining || 0;
    if (availableLimit < fees.total_prc) {
      toast.error(`Insufficient Redeem Limit. Available: ${availableLimit.toLocaleString()} PRC, Required: ${fees.total_prc.toLocaleString()} PRC`);
      return;
    }
    
    // Check KYC
    if (user.kyc_status !== 'verified') {
      toast.error('KYC verification required for bank transfers. Please complete KYC first.');
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/bank-transfer/request`, {
        user_id: user.uid,
        amount: parseInt(amount),
        bank_details: {
          account_holder_name: accountHolder,
          account_number: accountNumber,
          ifsc_code: ifscCode
        }
      });
      
      if (res.data.success) {
        toast.success('Bank transfer request submitted successfully!');
        
        // Update local balance
        setUser(prev => ({
          ...prev,
          prc_balance: res.data.new_balance
        }));
        
        // Reset form
        setAmount('');
        setAccountNumber('');
        setConfirmAccountNumber('');
        setIfscCode('');
        setBankName('');
        setIfscVerified(false);
        setAgreedToPolicy(false);
        
        // Redirect to dashboard after successful submission
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to submit request';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-6">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Banknote className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Redeem to Bank</h1>
              <p className="text-white/80 text-sm">Transfer PRC to your bank account</p>
            </div>
          </div>
          
          {/* Category-wise Limit - BANK - (Main limit card removed per user request) */}
          {user?.uid && (
            <div className="mt-4">
              <CategoryLimitsDisplay userId={user.uid} />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {/* Verified Partner Notice - Blinking at top */}
        <div className="mb-4 py-3 px-4 bg-red-500/15 border border-red-500/50 rounded-xl text-center" data-testid="verified-partner-notice">
          <p className="text-red-400 font-bold text-sm animate-pulse tracking-wide">
            This Service is available only for verified Partner's
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-4">
          <button
            data-testid="new-request-tab"
            onClick={() => setActiveTab('new')}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'new' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <CreditCard className="w-4 h-4 inline mr-2" />
            New Request
          </button>
          <button
            data-testid="history-tab"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'history' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            History
          </button>
        </div>

        {activeTab === 'new' ? (
          <form onSubmit={handleSubmit} data-testid="bank-redeem-form" className="space-y-4">
            {/* KYC Check */}
            {user?.kyc_status !== 'verified' && (
              <Card data-testid="kyc-warning" className="bg-yellow-500/10 border-yellow-500/30 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-yellow-400 font-medium">KYC Required</p>
                    <p className="text-yellow-400/80 text-sm mt-1">
                      Please complete KYC verification to enable bank transfers.
                    </p>
                    <Button 
                      type="button"
                      data-testid="complete-kyc-btn"
                      onClick={() => navigate('/kyc')}
                      className="mt-3 bg-yellow-500 hover:bg-yellow-600 text-black"
                      size="sm"
                    >
                      Complete KYC
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Amount Input */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
              <Label className="text-slate-300 mb-2 block">Withdrawal Amount (INR)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  data-testid="amount-input"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Min ₹${config.min_withdrawal} - Max ₹${config.max_withdrawal}`}
                  className="pl-10 bg-slate-900 border-slate-600 text-white"
                  min={config.min_withdrawal}
                  max={config.max_withdrawal}
                  required
                />
              </div>
              <p className="text-slate-500 text-xs mt-2">
                Rate: 1 INR = {config.prc_rate} PRC | Fee: ₹{config.transaction_fee} + {config.admin_fee_percent}%
              </p>
            </Card>

            {/* PRC Rate Display with Alert */}
            {parseFloat(amount) > 0 && (
              <PRCRateDisplay 
                amount={parseFloat(amount) || 0}
                processingFee={config.transaction_fee || 10}
                adminChargePercent={config.admin_fee_percent || 20}
                showBreakdown={true}
                showRateAlert={true}
                serviceType="bank"
              />
            )}

            {/* Fees Breakdown */}
            {fees && (
              <Card className="bg-slate-800/50 border-slate-700 p-4">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  Fee Breakdown
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Withdrawal Amount</span>
                    <span>₹{fees.withdrawal_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Transaction Fee</span>
                    <span>₹{fees.transaction_fee}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Admin Fee ({config.admin_fee_percent}%)</span>
                    <span>₹{fees.admin_fee}</span>
                  </div>
                  <hr className="border-slate-700" />
                  <div className="flex justify-between text-white font-medium">
                    <span>Total PRC Required</span>
                    <span className="text-emerald-400">{fees.total_prc.toLocaleString()} PRC</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold text-base">
                    <span>You Will Receive</span>
                    <span>₹{fees.user_receives.toLocaleString()}</span>
                  </div>
                </div>
              </Card>
            )}

            {/* Bank Details */}
            <Card className="bg-slate-800/50 border-slate-700 p-4 space-y-4">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                Bank Account Details
              </h3>
              
              {/* Account Holder */}
              <div>
                <Label className="text-slate-300 mb-2 block">Account Holder Name</Label>
                <Input
                  data-testid="account-holder-input"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="As per bank records"
                  className="bg-slate-900 border-slate-600 text-white"
                  required
                />
              </div>
              
              {/* IFSC Code */}
              <div>
                <Label className="text-slate-300 mb-2 block">IFSC Code</Label>
                <div className="flex gap-2">
                  <Input
                    data-testid="ifsc-input"
                    value={ifscCode}
                    onChange={(e) => handleIFSCChange(e.target.value)}
                    placeholder="e.g., HDFC0001234"
                    className="bg-slate-900 border-slate-600 text-white uppercase"
                    maxLength={11}
                    required
                  />
                  <Button
                    data-testid="verify-ifsc-btn"
                    type="button"
                    onClick={verifyIFSC}
                    disabled={ifscCode.length !== 11 || verifyingIFSC}
                    className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
                  >
                    {verifyingIFSC ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                  </Button>
                </div>
                {ifscVerified && bankName && (
                  <div data-testid="bank-verified" className="flex items-center gap-2 mt-2 text-emerald-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>{bankName}</span>
                  </div>
                )}
              </div>
              
              {/* Account Number */}
              <div>
                <Label className="text-slate-300 mb-2 block">Account Number</Label>
                <Input
                  data-testid="account-number-input"
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 18))}
                  placeholder="Enter account number"
                  className="bg-slate-900 border-slate-600 text-white"
                  required
                />
              </div>
              
              {/* Confirm Account Number */}
              <div>
                <Label className="text-slate-300 mb-2 block">Confirm Account Number</Label>
                <Input
                  data-testid="confirm-account-input"
                  type="text"
                  value={confirmAccountNumber}
                  onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 18))}
                  placeholder="Re-enter account number"
                  className="bg-slate-900 border-slate-600 text-white"
                  required
                />
                {confirmAccountNumber && accountNumber !== confirmAccountNumber && (
                  <p data-testid="account-mismatch" className="text-red-400 text-xs mt-1">Account numbers do not match</p>
                )}
                {confirmAccountNumber && accountNumber === confirmAccountNumber && accountNumber.length >= 9 && (
                  <p data-testid="account-match" className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Account numbers match
                  </p>
                )}
              </div>
            </Card>

            {/* Policy Agreement */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
              <div className="flex items-start gap-3">
                <input
                  data-testid="policy-checkbox"
                  type="checkbox"
                  id="policy"
                  checked={agreedToPolicy}
                  onChange={(e) => setAgreedToPolicy(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="policy" className="text-slate-300 text-sm cursor-pointer">
                  I agree to the{' '}
                  <button
                    type="button"
                    data-testid="view-policy-btn"
                    onClick={() => setShowPolicy(true)}
                    className="text-emerald-400 underline hover:text-emerald-300"
                  >
                    Terms & Conditions
                  </button>
                  {' '}for Redeem to Bank redemptions. I confirm that the bank details provided are correct and belong to me.
                </label>
              </div>
            </Card>

            {/* Submit Button */}
            <Button
              data-testid="submit-request-btn"
              type="submit"
              disabled={submitting || !agreedToPolicy || !ifscVerified || !fees || user?.kyc_status !== 'verified'}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-6 text-lg font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Banknote className="w-5 h-5 mr-2" />
                  Submit Request
                </>
              )}
            </Button>

            {/* Info Note */}
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-xl border border-blue-500/30" data-testid="redeem-cycle-info">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-300">
                <p className="font-medium mb-1">Redeem Policy</p>
                <p className="text-blue-300/80">
                  You can redeem once per subscription cycle (28 days). 
                  Next redeem will be available after your next cycle. 
                  Processing takes 3-7 working days.
                </p>
              </div>
            </div>
          </form>
        ) : (
          /* History Tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium">Your Requests</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={loadRequests}
                className="border-slate-600 text-slate-300"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loadingRequests ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            {loadingRequests ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              </div>
            ) : requests.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700 p-8 text-center">
                <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No requests yet</p>
                <Button
                  onClick={() => setActiveTab('new')}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                >
                  Create First Request
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <Card key={req.request_id} className="bg-slate-800/50 border-slate-700 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-white font-medium">₹{req.withdrawal_amount?.toLocaleString()}</p>
                        <p className="text-slate-400 text-xs">{req.request_id}</p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-slate-500">Bank</p>
                        <p className="text-slate-300">{req.bank_name}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Account</p>
                        <p className="text-slate-300">{req.account_number_masked || `****${req.account_number?.slice(-4)}`}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">PRC Deducted</p>
                        <p className="text-slate-300">{req.prc_deducted?.toLocaleString()} PRC</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Date</p>
                        <p className="text-slate-300">{new Date(req.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    {req.admin_remark && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-slate-500 text-xs">Admin Remark</p>
                        <p className="text-slate-300 text-sm">{req.admin_remark}</p>
                      </div>
                    )}
                    
                    {req.utr_number && (
                      <div className="mt-2">
                        <p className="text-slate-500 text-xs">UTR Number</p>
                        <p className="text-emerald-400 text-sm font-mono">{req.utr_number}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Policy Modal */}
      {showPolicy && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-slate-800 border-slate-700 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  Redeem to Bank Transfer Policy
                </h2>
                <button onClick={() => setShowPolicy(false)} className="text-slate-400 hover:text-white">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4 text-slate-300 text-sm">
                <div>
                  <h3 className="font-semibold text-white mb-2">1. Eligibility</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>KYC verification must be completed</li>
                    <li>Minimum withdrawal: ₹{config.min_withdrawal}</li>
                    <li>Maximum withdrawal: ₹{config.max_withdrawal}</li>
                    <li>Bank account must be in the name of the registered user</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">2. Fees & Charges</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Conversion Rate: 1 INR = {config.prc_rate} PRC</li>
                    <li>Transaction Fee: ₹{config.transaction_fee} per transaction</li>
                    <li>Admin Fee: {config.admin_fee_percent}% of withdrawal amount</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">3. Processing</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Requests are processed manually within 3-7 working days</li>
                    <li>PRC is deducted immediately upon request submission</li>
                    <li>Failed transfers will be refunded to your PRC balance</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">4. User Responsibility</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Ensure bank details are correct before submission</li>
                    <li>Incorrect bank details may result in failed transfer</li>
                    <li>Only one pending request allowed at a time</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">5. Refund Policy</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Failed transfers: Full PRC refund within 24 hours</li>
                    <li>User cancellation: Not allowed after submission</li>
                    <li>Disputes: Contact support within 7 days</li>
                  </ul>
                </div>
              </div>
              
              <Button
                onClick={() => {
                  setAgreedToPolicy(true);
                  setShowPolicy(false);
                }}
                className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700"
              >
                I Understand & Agree
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BankRedeemPage;
