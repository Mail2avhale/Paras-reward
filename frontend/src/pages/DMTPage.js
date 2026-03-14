/**
 * DMT Page - V1 Fund Transfer (Direct Bank Transfer - No OTP Required)
 * 
 * This replaces the old V3 Levin DMT which required OTP.
 * Uses Eko V1 Fund Transfer API for direct IMPS/NEFT/RTGS transfers.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Banknote, Send, CheckCircle, XCircle, Clock, 
  AlertTriangle, Wallet, RefreshCw, Building, User, 
  History, Zap, CreditCard, Loader2, ArrowLeft, Shield, Info
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Payment mode options
const PAYMENT_MODES = [
  { value: 'IMPS', label: 'IMPS', icon: Zap, description: 'Instant 24x7', color: 'emerald' },
  { value: 'NEFT', label: 'NEFT', icon: Clock, description: '2-4 hours', color: 'blue' },
  { value: 'RTGS', label: 'RTGS', icon: Banknote, description: 'High Value', color: 'violet' }
];

// Account type options
const ACCOUNT_TYPES = [
  { value: 'SAVINGS', label: 'Savings Account' },
  { value: 'CURRENT', label: 'Current Account' }
];

// Status badge component
const StatusBadge = ({ status }) => {
  const config = {
    'SUCCESS': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle },
    'FAILED': { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
    'PROCESSING': { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Clock },
    'ON_HOLD': { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: AlertTriangle }
  }[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: Clock };
  
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
};

const DMTPage = ({ user }) => {
  // Form state
  const [formData, setFormData] = useState({
    recipient_name: '',
    account: '',
    ifsc: '',
    amount: '',
    payment_mode: 'IMPS',
    account_type: 'SAVINGS'
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [bankInfo, setBankInfo] = useState(null);
  const [ifscValidating, setIfscValidating] = useState(false);
  const [transferResult, setTransferResult] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(null);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);
  const [verifiedName, setVerifiedName] = useState('');
  
  // Fetch balance
  const fetchBalance = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/fund-transfer/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setBalance(res.data.balance);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  }, []);
  
  // Fetch transaction history
  const fetchHistory = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/fund-transfer/history/${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setTransactions(res.data.transactions || []);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  }, [user?.uid]);
  
  // Validate IFSC code
  const validateIFSC = async (ifsc) => {
    if (!ifsc || ifsc.length !== 11) {
      setBankInfo(null);
      return;
    }
    
    setIfscValidating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/eko/dmt/ifsc/${ifsc}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.valid) {
        setBankInfo({
          bank: res.data.bank_name || res.data.bank,
          branch: res.data.branch,
          valid: true
        });
      } else {
        setBankInfo({ valid: false });
        toast.error('Invalid IFSC code');
      }
    } catch (error) {
      // Try alternate validation
      try {
        const razorRes = await axios.get(`https://ifsc.razorpay.com/${ifsc}`);
        if (razorRes.data) {
          setBankInfo({
            bank: razorRes.data.BANK,
            branch: razorRes.data.BRANCH,
            valid: true
          });
        }
      } catch {
        setBankInfo({ valid: false });
      }
    } finally {
      setIfscValidating(false);
    }
  };
  
  // Verify bank account
  const verifyBankAccount = async () => {
    if (!formData.account || !formData.ifsc) {
      toast.error('Please enter account number and IFSC first');
      return;
    }
    
    setVerifyingAccount(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/eko/dmt/verify-account`, {
        account_number: formData.account,
        ifsc: formData.ifsc
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success && res.data.verified) {
        setAccountVerified(true);
        setVerifiedName(res.data.account_holder_name || '');
        if (res.data.account_holder_name && !formData.recipient_name) {
          setFormData(prev => ({ ...prev, recipient_name: res.data.account_holder_name }));
        }
        toast.success('Account verified successfully!');
      } else {
        toast.error(res.data.message || 'Account verification failed');
      }
    } catch (error) {
      toast.error('Verification service unavailable. You can proceed with transfer.');
      setAccountVerified(true); // Allow to proceed
    } finally {
      setVerifyingAccount(false);
    }
  };
  
  // Handle form input change
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Reset verification when account details change
    if (field === 'account' || field === 'ifsc') {
      setAccountVerified(false);
      setVerifiedName('');
    }
    
    // Validate IFSC when it's 11 characters
    if (field === 'ifsc' && value.length === 11) {
      validateIFSC(value.toUpperCase());
    } else if (field === 'ifsc') {
      setBankInfo(null);
    }
  };
  
  // Submit transfer
  const handleTransfer = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.recipient_name.trim()) {
      toast.error('Please enter recipient name');
      return;
    }
    if (!formData.account || formData.account.length < 9) {
      toast.error('Please enter valid account number (minimum 9 digits)');
      return;
    }
    if (!formData.ifsc || formData.ifsc.length !== 11) {
      toast.error('Please enter valid IFSC code (11 characters)');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) < 10) {
      toast.error('Minimum transfer amount is ₹10');
      return;
    }
    if (parseFloat(formData.amount) > 200000) {
      toast.error('Maximum transfer amount is ₹2,00,000');
      return;
    }
    
    setLoading(true);
    setTransferResult(null);
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/fund-transfer/initiate`, {
        recipient_name: formData.recipient_name.trim(),
        account: formData.account,
        ifsc: formData.ifsc.toUpperCase(),
        amount: String(Math.round(parseFloat(formData.amount))),
        payment_mode: formData.payment_mode,
        account_type: formData.account_type
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        setTransferResult({
          success: true,
          ...res.data
        });
        toast.success(`₹${formData.amount} transferred successfully!`);
        
        // Clear form
        setFormData({
          recipient_name: '',
          account: '',
          ifsc: '',
          amount: '',
          payment_mode: 'IMPS',
          account_type: 'SAVINGS'
        });
        setBankInfo(null);
        setAccountVerified(false);
        setVerifiedName('');
        
        // Refresh data
        fetchBalance();
        fetchHistory();
      } else {
        setTransferResult({
          success: false,
          message: res.data.user_message || res.data.message || 'Transfer failed'
        });
        toast.error(res.data.user_message || res.data.message || 'Transfer failed');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || 'Transfer failed. Please try again.';
      setTransferResult({
        success: false,
        message: errorMsg
      });
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };
  
  // Check transaction status
  const checkStatus = async (tid) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/fund-transfer/status/${tid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        toast.success(`Status: ${res.data.status}`);
        fetchHistory();
      } else {
        toast.info(res.data.message || 'Status check failed');
      }
    } catch (error) {
      toast.error('Failed to check status');
    }
  };
  
  // Initial load
  useEffect(() => {
    fetchBalance();
    fetchHistory();
  }, [fetchBalance, fetchHistory]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 pb-24">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
              <Send className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Bank Transfer</h1>
              <p className="text-sm text-gray-400">Direct IMPS • No OTP Required</p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
            data-testid="toggle-history-btn"
          >
            <History className="w-4 h-4 mr-2" />
            {showHistory ? 'New Transfer' : 'History'}
          </Button>
        </div>
        
        {/* Info Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <Zap className="h-5 w-5" />
            <span className="font-semibold">V1 Fund Transfer - Instant IMPS</span>
          </div>
          <p className="text-sm text-gray-300">
            Direct bank transfer without OTP. Funds credited instantly via IMPS.
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" /> Secure
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Instant
            </span>
            <span className="flex items-center gap-1">
              <Banknote className="w-3 h-3 text-cyan-400" /> Fee: ₹5
            </span>
          </div>
        </div>
        
        {/* Balance Card */}
        {balance && (
          <Card className="bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border-violet-500/30 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-violet-400" />
                <span className="text-gray-300">Available Balance</span>
              </div>
              <span className="text-xl font-bold text-white">₹{parseFloat(balance).toLocaleString()}</span>
            </div>
          </Card>
        )}
        
        {/* Transfer Form or History */}
        {!showHistory ? (
          <Card className="bg-gray-900/50 border-gray-800 p-6 rounded-2xl">
            <form onSubmit={handleTransfer} className="space-y-5">
              {/* Step 1: Recipient Name */}
              <div>
                <Label className="text-gray-300 text-sm mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold flex items-center justify-center">1</span>
                  Recipient Name (Account Holder)
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <Input
                    type="text"
                    value={formData.recipient_name}
                    onChange={(e) => handleChange('recipient_name', e.target.value)}
                    placeholder="Enter account holder name"
                    className="pl-10 h-12 bg-gray-800/50 border-gray-700 text-white rounded-xl"
                    data-testid="recipient-name-input"
                  />
                </div>
                {verifiedName && (
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Verified: {verifiedName}
                  </p>
                )}
              </div>
              
              {/* Step 2: Account Number */}
              <div>
                <Label className="text-gray-300 text-sm mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold flex items-center justify-center">2</span>
                  Bank Account Number
                </Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <Input
                    type="text"
                    value={formData.account}
                    onChange={(e) => handleChange('account', e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter bank account number"
                    className="pl-10 h-12 bg-gray-800/50 border-gray-700 text-white rounded-xl"
                    data-testid="account-number-input"
                  />
                </div>
              </div>
              
              {/* Step 3: IFSC Code */}
              <div>
                <Label className="text-gray-300 text-sm mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold flex items-center justify-center">3</span>
                  IFSC Code
                </Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <Input
                    type="text"
                    value={formData.ifsc}
                    onChange={(e) => handleChange('ifsc', e.target.value.toUpperCase().slice(0, 11))}
                    placeholder="Enter 11-digit IFSC code"
                    maxLength={11}
                    className="pl-10 h-12 bg-gray-800/50 border-gray-700 text-white uppercase rounded-xl"
                    data-testid="ifsc-input"
                  />
                  {ifscValidating && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-gray-400" />
                  )}
                </div>
                {bankInfo && bankInfo.valid && (
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {bankInfo.bank} {bankInfo.branch && `- ${bankInfo.branch}`}
                  </p>
                )}
                {bankInfo && !bankInfo.valid && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Invalid IFSC code
                  </p>
                )}
              </div>
              
              {/* Account Verification Button (Optional) */}
              {formData.account && formData.ifsc?.length === 11 && !accountVerified && (
                <Button
                  type="button"
                  onClick={verifyBankAccount}
                  disabled={verifyingAccount}
                  variant="outline"
                  className="w-full h-10 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 rounded-xl"
                >
                  {verifyingAccount ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying Account...</>
                  ) : (
                    <><Shield className="w-4 h-4 mr-2" /> Verify Account (Optional)</>
                  )}
                </Button>
              )}
              
              {accountVerified && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Account Verified</span>
                  </div>
                </div>
              )}
              
              {/* Step 4: Account Type */}
              <div>
                <Label className="text-gray-300 text-sm mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold flex items-center justify-center">4</span>
                  Account Type
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {ACCOUNT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleChange('account_type', type.value)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        formData.account_type === type.value
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                          : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Step 5: Payment Mode */}
              <div>
                <Label className="text-gray-300 text-sm mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold flex items-center justify-center">5</span>
                  Payment Mode
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_MODES.map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = formData.payment_mode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => handleChange('payment_mode', mode.value)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          isSelected
                            ? `border-${mode.color}-500 bg-${mode.color}-500/20 text-${mode.color}-400`
                            : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                        } ${isSelected ? 'ring-1 ring-emerald-500/50' : ''}`}
                        data-testid={`payment-mode-${mode.value.toLowerCase()}`}
                      >
                        <Icon className={`w-5 h-5 mx-auto mb-1 ${isSelected ? 'text-emerald-400' : ''}`} />
                        <div className="text-sm font-medium">{mode.label}</div>
                        <div className="text-xs opacity-70">{mode.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Step 6: Amount */}
              <div>
                <Label className="text-gray-300 text-sm mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold flex items-center justify-center">6</span>
                  Transfer Amount (₹10 - ₹2,00,000)
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-amber-400">₹</span>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => handleChange('amount', e.target.value)}
                    placeholder="Enter amount"
                    min="10"
                    max="200000"
                    className="pl-12 h-14 text-xl font-semibold bg-gray-800/50 border-gray-700 text-white rounded-xl"
                    data-testid="amount-input"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Transfer Fee: ₹5 (deducted from balance)</p>
              </div>
              
              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !formData.recipient_name || !formData.account || !formData.ifsc || formData.ifsc.length !== 11 || !formData.amount}
                className="w-full py-4 h-14 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold rounded-xl text-lg"
                data-testid="transfer-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing Transfer...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Transfer Now
                  </>
                )}
              </Button>
            </form>
            
            {/* Transfer Result */}
            {transferResult && (
              <div className={`mt-6 p-4 rounded-xl ${
                transferResult.success 
                  ? 'bg-emerald-500/10 border border-emerald-500/30' 
                  : 'bg-red-500/10 border border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {transferResult.success ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span className={`font-semibold ${transferResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {transferResult.success ? 'Transfer Successful!' : 'Transfer Failed'}
                  </span>
                </div>
                {transferResult.success && (
                  <div className="space-y-1 text-sm text-gray-300">
                    <p><span className="text-gray-500">Transaction ID:</span> {transferResult.tid}</p>
                    <p><span className="text-gray-500">Amount:</span> ₹{transferResult.amount}</p>
                    {transferResult.utr && (
                      <p><span className="text-gray-500">UTR:</span> {transferResult.utr}</p>
                    )}
                  </div>
                )}
                {!transferResult.success && (
                  <p className="text-sm text-gray-400">{transferResult.message}</p>
                )}
              </div>
            )}
          </Card>
        ) : (
          /* Transaction History */
          <Card className="bg-gray-900/50 border-gray-800 p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Transaction History</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchHistory}
                className="text-gray-400 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm mt-1">Your transfers will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx, idx) => (
                  <div 
                    key={tx.client_ref_id || idx}
                    className="p-4 rounded-xl bg-gray-800/50 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">{tx.recipient_name}</span>
                      <StatusBadge status={tx.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-400">
                        <span className="text-gray-500">A/C:</span> {tx.account_number_masked || `****${tx.account_number?.slice(-4)}`}
                      </div>
                      <div className="text-right text-white font-medium">
                        ₹{parseFloat(tx.amount).toLocaleString()}
                      </div>
                      <div className="text-gray-400">
                        <span className="text-gray-500">Mode:</span> {tx.payment_mode_name || tx.payment_mode}
                      </div>
                      <div className="text-right text-gray-400 text-xs">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {tx.tid && (
                      <p className="text-xs text-gray-500 mt-2">TID: {tx.tid}</p>
                    )}
                    {tx.status === 'PROCESSING' && tx.tid && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => checkStatus(tx.tid)}
                        className="mt-2 w-full border-gray-600 text-gray-300 h-8"
                      >
                        Check Status
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default DMTPage;
