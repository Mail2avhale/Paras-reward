import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RewardLoader from '@/components/RewardLoader';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
// PRCRateDisplay removed (June 2026) - fixed 10 PRC = ₹1, no dynamic rate.
import CategoryLimitsDisplay from '../components/CategoryLimitsDisplay';
import { RedeemTierBadge } from '../components/RedeemTierBadge';
import {
  ArrowLeft, Banknote, Building2, CheckCircle, Clock, XCircle, 
  AlertCircle, Info, Loader2, RefreshCw, IndianRupee, CreditCard,
  History, ChevronRight, Shield, FileText, Search, Filter
} from 'lucide-react';

import { API } from "../lib/api";
import { useRewardedInterstitial } from '@/components/RewardedInterstitialTrigger';

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

  // Rewarded Interstitial trigger — fires after a successful redeem submission
  // so the user sees a "watch to earn +5 PRC" opt-in. Never blocks the
  // primary bank-transfer flow (Google AdMob compliance).
  const rewardedAd = useRewardedInterstitial();
  
  // Config from backend
  const [config, setConfig] = useState({
    prc_rate: 10,
    transaction_fee: 10,
    admin_fee_percent: 20,
    min_withdrawal: 1000,
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
  const [burnRatePercent, setBurnRatePercent] = useState(1);
  const [burnPaymentType, setBurnPaymentType] = useState('cash');
  
  // Request history
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'
  
  // Policy agreement
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  
  // Redeem limit info
  const [redeemLimit, setRedeemLimit] = useState(null);

  // ── Lifetime quota state (Feb 2026 cap of ₹2,500) ────────────────────
  // Hydrated from /api/bank-transfer/lifetime-quota/{uid}. While loading
  // this is null; once loaded it has shape:
  //   { lifetime_redeemed_inr, lifetime_cap_inr, remaining_quota_inr,
  //     is_blocked, allowed_amounts: [], enabled_amounts: [], block_reason }
  const [lifetimeQuota, setLifetimeQuota] = useState(null);

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
        // IMPORTANT: redeem-limit is fetched WITHOUT a silent catch so a transient
        // error doesn't produce a false "Available: 0 PRC" block at submit time.
        // If it fails, we retry; after retries it remains null and the frontend
        // guard falls back to user.prc_balance + server-side authoritative check.
        const fetchRedeemLimit = async (attempt = 1) => {
          try {
            return await axios.get(`${API}/user/${userData.uid}/redeem-limit`);
          } catch (err) {
            if (attempt < 3) {
              await new Promise(r => setTimeout(r, 400 * attempt));
              return fetchRedeemLimit(attempt + 1);
            }
            console.error('[BankRedeem] redeem-limit fetch failed after retries:', err?.response?.status, err?.message);
            return { data: null, _error: true };
          }
        };
        
        const [userRes, configRes, limitRes, burnRes, quotaRes] = await Promise.all([
          axios.get(`${API}/users/${userData.uid}`),
          axios.get(`${API}/bank-transfer/config?user_id=${userData.uid}`),
          fetchRedeemLimit(),
          axios.get(`${API}/redemption/calculate-charges?amount_inr=100&user_id=${userData.uid}`).catch(() => ({ data: null })),
          axios.get(`${API}/bank-transfer/lifetime-quota/${userData.uid}`).catch(() => ({ data: null })),
        ]);

        setUser(userRes.data);
        setConfig(configRes.data);
        if (quotaRes.data) setLifetimeQuota(quotaRes.data);
        
        // Set burn rate from backend
        if (burnRes.data?.burn_rate_percent !== undefined) {
          setBurnRatePercent(burnRes.data.burn_rate_percent);
          setBurnPaymentType(burnRes.data.burn_payment_type || 'cash');
        }
        
        // Set redeem limit info
        if (limitRes.data?.success) {
          setRedeemLimit(limitRes.data.limit);
        } else if (limitRes._error) {
          // Surface the error but don't block UX — backend will enforce at submit
          toast.error('Could not load redeem limit. You can still submit — limit will be verified by server.');
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

  // Amount validation error message
  const amountError = (() => {
    if (!amount || isNaN(amount)) return '';
    const amt = parseInt(amount);
    const allowed = lifetimeQuota?.allowed_amounts || [100, 200, 400, 800, 1000];
    if (!allowed.includes(amt)) {
      return `Please choose one of: ₹${allowed.join(', ₹')}`;
    }
    const enabled = lifetimeQuota?.enabled_amounts;
    if (enabled && !enabled.includes(amt)) {
      return `Only ₹${lifetimeQuota.remaining_quota_inr} of your ₹${lifetimeQuota.lifetime_cap_inr} lifetime cap remains. Pick a smaller amount.`;
    }
    return '';
  })();

  // Calculate fees when amount changes (including burn rate)
  useEffect(() => {
    if (!amount || isNaN(amount)) {
      setFees(null);
      return;
    }

    const amt = parseInt(amount);
    const allowed = lifetimeQuota?.allowed_amounts || [100, 200, 400, 800, 1000];
    if (!allowed.includes(amt)) {
      setFees(null);
      return;
    }
    
    const adminFee = Math.round(amt * config.admin_fee_percent / 100);
    const subtotalInr = amt + adminFee + config.transaction_fee;
    const burnInr = Math.round(subtotalInr * burnRatePercent / 100 * 100) / 100;
    const totalInr = subtotalInr + burnInr;
    const totalPrc = totalInr * config.prc_rate;
    
    setFees({
      withdrawal_amount: amt,
      admin_fee: adminFee,
      transaction_fee: config.transaction_fee,
      burn_inr: burnInr,
      burn_rate_percent: burnRatePercent,
      burn_payment_type: burnPaymentType,
      total_inr: totalInr,
      total_prc: totalPrc,
      user_receives: amt
    });
  }, [amount, config, burnRatePercent, burnPaymentType]);

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
      const amt = parseInt(amount);
      if (!amount || isNaN(amount)) {
        toast.error('Please enter withdrawal amount');
      } else if (amt < config.min_withdrawal) {
        toast.error(`Minimum withdrawal amount is ₹${config.min_withdrawal.toLocaleString()}`);
      } else if (amt > config.max_withdrawal) {
        toast.error(`Maximum withdrawal amount is ₹${config.max_withdrawal.toLocaleString()}`);
      } else {
        toast.error('Please enter valid amount');
      }
      return;
    }
    
    // Check Available Redeem Limit (NOT prc_balance)
    // If redeemLimit failed to load, skip the client-side guard and let the
    // server-side check_redeem_limit validate on submit — prevents a false
    // "Available: 0 PRC" block caused by a transient /redeem-limit fetch error.
    if (redeemLimit) {
      const availableLimit = Math.max(
        Number(redeemLimit.effective_available) || 0,
        Number(redeemLimit.effective_remaining) || 0,
        Number(redeemLimit.remaining_limit) || 0,
        Number(redeemLimit.available) || 0
      );
      if (availableLimit > 0 && availableLimit < fees.total_prc) {
        toast.error(`Insufficient Redeem Limit. Available: ${availableLimit.toLocaleString()} PRC, Required: ${fees.total_prc.toLocaleString()} PRC`);
        return;
      }
    }
    
    // Check KYC
    if (user.kyc_status !== 'verified') {
      toast.error('KYC verification required for bank transfers. Please complete KYC first.');
      return;
    }
    
    setSubmitting(true);
    // Generate a stable idempotency key per click so accidental network
    // retries, double-taps, or background request retries don't create
    // duplicate bank transfer requests on the backend.
    const clientRequestId =
      (window.crypto?.randomUUID?.()) ||
      `bt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const res = await axios.post(`${API}/bank-transfer/request`, {
        user_id: user.uid,
        amount: parseInt(amount),
        bank_details: {
          account_holder_name: accountHolder,
          account_number: accountNumber,
          ifsc_code: ifscCode
        },
        client_request_id: clientRequestId,
      });
      
      if (res.data.success) {
        toast.success('Bank transfer request submitted successfully!');
        
        // Show processing info
        toast.info('Your request will be processed within 3 to 7 working days.', { duration: 6000 });
        
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
        
        // Post-action Rewarded Interstitial (opt-in bonus). Fires BEFORE
        // the redirect so users see the offer while still on this screen.
        // Skipping does NOT affect the bank transfer.
        rewardedAd.open({ bonusPrc: 5 });

        // Redirect to dashboard after successful submission — bumped to
        // 4.5s so the ad prompt has time to appear + be interacted with.
        setTimeout(() => {
          navigate('/dashboard');
        }, 4500);
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
        <RewardLoader message="Loading bank redeem..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-20">
      {/* Post-action Rewarded Interstitial modal — mounts once, opens
          from rewardedAd.open() after a successful redeem submission. */}
      {rewardedAd.element}
      {/* Header */}
      <div className="px-4 py-6" style={{ background: 'linear-gradient(145deg, #2e1065 0%, #4c1d95 50%, #5b21b6 100%)' }}>
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
        <div className="mb-4 py-3.5 px-4 bg-purple-600/20 border-2 border-purple-500 rounded-xl text-center" data-testid="verified-partner-notice">
          <p className="text-white font-extrabold text-base animate-pulse tracking-wide">
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
                ? 'bg-purple-600 text-white' 
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
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            History
          </button>
        </div>

        {activeTab === 'new' ? (
          <form onSubmit={handleSubmit} data-testid="bank-redeem-form" className="space-y-4">
            {/* Gamified Redeem Tier Badge */}
            {config?.progressive?.minimum != null && (
              <RedeemTierBadge
                minimum={config.progressive.minimum}
                nextPreview={config.progressive.next_minimum_preview}
              />
            )}

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

            {/* Amount Selection — Feb 2026: 5 fixed amounts + ₹2,500 lifetime cap */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
              {/* Lifetime cap progress meter — covers bank redeems + recharges + bills */}
              {lifetimeQuota && (
                <div className="mb-4" data-testid="bank-redeem-quota-meter">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-slate-300 text-sm font-medium">Lifetime Benefit Limit</span>
                    <span className="text-slate-400 text-xs tabular-nums">
                      ₹{Number(lifetimeQuota.lifetime_redeemed_inr).toLocaleString('en-IN')} / ₹{Number(lifetimeQuota.lifetime_cap_inr).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        lifetimeQuota.is_blocked
                          ? 'bg-red-500'
                          : lifetimeQuota.remaining_quota_inr <= 500
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (lifetimeQuota.lifetime_redeemed_inr / lifetimeQuota.lifetime_cap_inr) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-slate-500 text-xs mt-1.5">
                    {lifetimeQuota.is_blocked
                      ? '🚫 You have reached the lifetime cap. Bank redeem is disabled.'
                      : `Remaining: ₹${Number(lifetimeQuota.remaining_quota_inr).toLocaleString('en-IN')} • Includes recharges, bill payments & redeems (subscription excluded, charges extra)`}
                  </p>
                </div>
              )}

              <Label className="text-slate-300 mb-2 block">Select Withdrawal Amount</Label>

              {lifetimeQuota?.is_blocked ? (
                <div
                  className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center"
                  data-testid="bank-redeem-blocked-banner"
                >
                  <XCircle className="w-7 h-7 text-red-400 mx-auto mb-2" />
                  <p className="text-red-200 font-semibold mb-1">Bank Redeem Disabled</p>
                  <p className="text-red-200/80 text-sm">
                    {lifetimeQuota.block_reason}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2" data-testid="bank-redeem-amount-chips">
                    {(lifetimeQuota?.allowed_amounts || [100, 200, 400, 800, 1000]).map((amt) => {
                      const isEnabled = lifetimeQuota
                        ? lifetimeQuota.enabled_amounts.includes(amt)
                        : true;
                      const isSelected = parseInt(amount) === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          disabled={!isEnabled}
                          onClick={() => setAmount(String(amt))}
                          data-testid={`bank-redeem-amount-${amt}`}
                          className={`py-2.5 rounded-lg border text-sm font-semibold tabular-nums transition-all ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-500 text-black shadow-lg shadow-emerald-500/30'
                              : isEnabled
                              ? 'bg-slate-900 border-slate-600 text-slate-200 hover:border-emerald-500/50'
                              : 'bg-slate-900/40 border-slate-700 text-slate-600 cursor-not-allowed line-through'
                          }`}
                          title={
                            isEnabled ? `Redeem ₹${amt}` : `Exceeds remaining ₹${lifetimeQuota?.remaining_quota_inr || 0} quota`
                          }
                        >
                          ₹{amt.toLocaleString('en-IN')}
                        </button>
                      );
                    })}
                  </div>
                  {amountError && (
                    <p data-testid="amount-error" className="text-red-400 text-sm mt-2 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {amountError}
                    </p>
                  )}
                  <p className="text-slate-500 text-xs mt-3">
                    Rate: 1 INR = {config.prc_rate} PRC &middot; Fee: ₹{config.transaction_fee} + {config.admin_fee_percent}% (extra, not in ₹2,500 cap)
                  </p>
                </>
              )}
            </Card>

            {/* Fee Breakdown card removed (June 2026) - rate now fixed 10 PRC = ₹1.
                The page already shows "Rate: 1 INR = 10 PRC" and total PRC needed elsewhere. */}

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

            {/* KYC required notice — visible only when user hasn't verified KYC */}
            {user?.kyc_status !== 'verified' && (
              <div
                className="rounded-xl border-2 border-amber-500/60 bg-amber-500/10 p-4 flex items-start gap-3"
                data-testid="kyc-required-notice"
              >
                <Info className="w-5 h-5 text-amber-300 mt-0.5 flex-shrink-0" />
                <div className="text-sm flex-1">
                  <p className="font-semibold text-amber-200 mb-1">
                    KYC Verification Required
                  </p>
                  <p className="text-amber-100/80 mb-3">
                    {user?.kyc_status === 'pending'
                      ? 'Your KYC is pending review by our team. Submit takes 1-2 working days.'
                      : user?.kyc_status === 'rejected'
                      ? 'Your KYC was rejected. Please re-submit with valid documents.'
                      : 'Bank redemptions require completed KYC to comply with RBI guidelines.'}
                  </p>
                  <Button
                    type="button"
                    onClick={() => navigate('/kyc')}
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
                    data-testid="kyc-required-cta"
                  >
                    {user?.kyc_status === 'pending' ? 'View KYC Status' : 'Complete KYC Now'}
                  </Button>
                </div>
              </div>
            )}

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
                  You can redeem once every 24 hours. 
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
                    
                    {(req.status === 'pending' || req.status === 'processing') && (
                      <div className="mt-3 pt-3 border-t border-slate-700 bg-blue-500/5 rounded-lg p-3" data-testid="pending-info-message">
                        <p className="text-blue-300 text-xs leading-relaxed">
                          Your request will be processed within 3 to 7 working days. In rare cases, it may take slightly longer — rest assured, your PRC is completely safe and secure.
                        </p>
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
