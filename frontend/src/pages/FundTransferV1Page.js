/**
 * V1 Fund Transfer Page - Direct Bank Transfer (No OTP Required)
 * Uses Eko V1 Fund Transfer API
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Banknote, Send, ArrowLeft, CheckCircle, XCircle, Clock, 
  AlertTriangle, Wallet, RefreshCw, Building, User, Hash, 
  History, Zap, CreditCard, Loader2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Payment mode options
const PAYMENT_MODES = [
  { value: 'IMPS', label: 'IMPS (Instant)', icon: Zap, description: 'Instant transfer, 24x7 available' },
  { value: 'NEFT', label: 'NEFT', icon: Clock, description: 'Batch transfer, working hours only' },
  { value: 'RTGS', label: 'RTGS', icon: Banknote, description: 'High value transfers (₹2L+)' }
];

// Account type options
const ACCOUNT_TYPES = [
  { value: 'SAVINGS', label: 'Savings Account' },
  { value: 'CURRENT', label: 'Current Account' }
];

// Transaction status component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    'SUCCESS': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle },
    'FAILED': { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
    'PROCESSING': { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Clock },
    'ON_HOLD': { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: AlertTriangle }
  };
  
  const config = statusConfig[status] || statusConfig['PROCESSING'];
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
};

const FundTransferV1Page = ({ user }) => {
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
  
  // Fetch balance
  const fetchBalance = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/fund-transfer/balance`);
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
      const res = await axios.get(`${API}/fund-transfer/history/${user.uid}`);
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
      const res = await axios.get(`${API}/eko/dmt/ifsc/${ifsc}`);
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
      setBankInfo({ valid: false });
      toast.error('Failed to validate IFSC');
    } finally {
      setIfscValidating(false);
    }
  };
  
  // Handle form input change
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
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
      toast.error('Please enter valid account number');
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
      const res = await axios.post(`${API}/fund-transfer/initiate`, {
        ...formData,
        ifsc: formData.ifsc.toUpperCase()
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
        
        // Refresh balance and history
        fetchBalance();
        fetchHistory();
      } else {
        setTransferResult({
          success: false,
          message: res.data.message || res.data.user_message || 'Transfer failed'
        });
        toast.error(res.data.user_message || res.data.message || 'Transfer failed');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || 'Transfer failed';
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
      const res = await axios.get(`${API}/fund-transfer/status/${tid}`);
      if (res.data.success) {
        toast.success(`Status: ${res.data.status}`);
        // Refresh history
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
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30">
              <Send className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Fund Transfer</h1>
              <p className="text-sm text-gray-400">Direct bank transfer via IMPS/NEFT/RTGS</p>
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
            History
          </Button>
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
        
        {/* Transfer Form */}
        {!showHistory ? (
          <Card className="bg-gray-900/50 border-gray-800 p-6">
            <form onSubmit={handleTransfer} className="space-y-5">
              {/* Recipient Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Recipient Name
                </label>
                <Input
                  type="text"
                  value={formData.recipient_name}
                  onChange={(e) => handleChange('recipient_name', e.target.value)}
                  placeholder="Enter account holder name"
                  className="bg-gray-800/50 border-gray-700 text-white"
                  data-testid="recipient-name-input"
                />
              </div>
              
              {/* Account Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <CreditCard className="w-4 h-4 inline mr-2" />
                  Account Number
                </label>
                <Input
                  type="text"
                  value={formData.account}
                  onChange={(e) => handleChange('account', e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter bank account number"
                  className="bg-gray-800/50 border-gray-700 text-white"
                  data-testid="account-number-input"
                />
              </div>
              
              {/* IFSC Code */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Building className="w-4 h-4 inline mr-2" />
                  IFSC Code
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={formData.ifsc}
                    onChange={(e) => handleChange('ifsc', e.target.value.toUpperCase().slice(0, 11))}
                    placeholder="Enter 11-digit IFSC code"
                    className="bg-gray-800/50 border-gray-700 text-white uppercase"
                    data-testid="ifsc-input"
                  />
                  {ifscValidating && (
                    <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>
                {bankInfo && bankInfo.valid && (
                  <div className="mt-2 text-sm text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    {bankInfo.bank} {bankInfo.branch && `- ${bankInfo.branch}`}
                  </div>
                )}
                {bankInfo && !bankInfo.valid && (
                  <div className="mt-2 text-sm text-red-400 flex items-center gap-1">
                    <XCircle className="w-4 h-4" />
                    Invalid IFSC code
                  </div>
                )}
              </div>
              
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Banknote className="w-4 h-4 inline mr-2" />
                  Amount (₹10 - ₹2,00,000)
                </label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  placeholder="Enter amount"
                  min="10"
                  max="200000"
                  className="bg-gray-800/50 border-gray-700 text-white"
                  data-testid="amount-input"
                />
              </div>
              
              {/* Payment Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_MODES.map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => handleChange('payment_mode', mode.value)}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          formData.payment_mode === mode.value
                            ? 'border-violet-500 bg-violet-500/20 text-violet-400'
                            : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                        }`}
                        data-testid={`payment-mode-${mode.value.toLowerCase()}`}
                      >
                        <Icon className="w-5 h-5 mx-auto mb-1" />
                        <div className="text-sm font-medium">{mode.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Account Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ACCOUNT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleChange('account_type', type.value)}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        formData.account_type === type.value
                          ? 'border-violet-500 bg-violet-500/20 text-violet-400'
                          : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                      }`}
                      data-testid={`account-type-${type.value.toLowerCase()}`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !bankInfo?.valid}
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold"
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
              
              <p className="text-xs text-center text-gray-500">
                Instant transfer via IMPS • No OTP required • Fee: ₹5
              </p>
            </form>
            
            {/* Transfer Result */}
            {transferResult && (
              <div className={`mt-6 p-4 rounded-lg ${
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
          <Card className="bg-gray-900/50 border-gray-800 p-6">
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
              <div className="text-center py-8 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-lg bg-gray-800/50 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">{tx.recipient_name}</span>
                      <StatusBadge status={tx.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-400">
                        <span className="text-gray-500">A/C:</span> {tx.account_number_masked}
                      </div>
                      <div className="text-right text-white font-medium">
                        ₹{parseFloat(tx.amount).toLocaleString()}
                      </div>
                      <div className="text-gray-400">
                        <span className="text-gray-500">Mode:</span> {tx.payment_mode_name}
                      </div>
                      <div className="text-right text-gray-400 text-xs">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {tx.tid && tx.status === 'PROCESSING' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => checkStatus(tx.tid)}
                        className="mt-2 w-full border-gray-600 text-gray-300"
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

export default FundTransferV1Page;
