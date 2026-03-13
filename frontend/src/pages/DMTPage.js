import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Banknote, Search, UserPlus, CreditCard, Send, ArrowLeft,
  CheckCircle, XCircle, Clock, AlertTriangle, Wallet, RefreshCw,
  Building, User, Phone, Hash, Shield, History, ChevronRight, Zap
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Helper function to sanitize error messages for users
const sanitizeErrorMessage = (error) => {
  const technicalPatterns = [
    /insufficient balance.*key/i,
    /last_used/i,
    /okeykey/i,
    /internal server error/i,
    /exception/i,
    /traceback/i,
    /stack trace/i,
    /undefined/i,
    /null pointer/i,
    /connection refused/i,
    /timeout/i,
    /api error/i,
    /status code/i,
    /response_status_id/i,
  ];
  
  const errorStr = String(error || '');
  
  // Check if error contains technical details
  for (const pattern of technicalPatterns) {
    if (pattern.test(errorStr)) {
      return 'Service temporarily unavailable. Please try again later.';
    }
  }
  
  // Map common errors to user-friendly messages
  if (errorStr.toLowerCase().includes('insufficient balance')) {
    return 'Service temporarily unavailable. Please try again later.';
  }
  if (errorStr.toLowerCase().includes('network') || errorStr.toLowerCase().includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (errorStr.toLowerCase().includes('unauthorized') || errorStr.toLowerCase().includes('403')) {
    return 'Session expired. Please login again.';
  }
  
  // Return generic message for any unhandled error
  if (errorStr.length > 100 || /[{}\[\]<>]/.test(errorStr)) {
    return 'Service temporarily unavailable. Please try again later.';
  }
  
  return errorStr || 'Something went wrong. Please try again.';
};

// Step indicator component - Premium Style
const StepIndicator = ({ currentStep, steps }) => (
  <div className="flex items-center justify-center gap-1 mb-6 px-4 overflow-x-auto pb-2">
    {steps.map((step, idx) => (
      <React.Fragment key={idx}>
        <div 
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
            idx + 1 === currentStep 
              ? 'bg-gradient-to-r from-violet-600/20 to-cyan-600/20 text-white border border-violet-500/30 shadow-lg shadow-violet-500/10' 
              : idx + 1 < currentStep 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-gray-800/50 text-gray-500 border border-gray-800'
          }`}
        >
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            idx + 1 === currentStep 
              ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white' 
              : idx + 1 < currentStep 
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-gray-700 text-gray-500'
          }`}>
            {idx + 1 < currentStep ? <CheckCircle className="w-4 h-4" /> : idx + 1}
          </span>
          <span className="hidden sm:inline whitespace-nowrap">{step}</span>
        </div>
        {idx < steps.length - 1 && (
          <div className={`w-8 h-0.5 rounded-full transition-colors ${
            idx + 1 < currentStep ? 'bg-emerald-500/50' : 'bg-gray-800'
          }`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

const DMTPage = ({ user }) => {
  // DMT Type selector - Levin (OTP based) or V1 (Legacy)
  const [dmtType, setDmtType] = useState('levin'); // 'levin' or 'v1'
  
  // State management
  const [step, setStep] = useState(1); // 1: Search, 2: Register/OTP, 3: Recipients, 4: Transfer
  const [loading, setLoading] = useState(false);
  const [walletInfo, setWalletInfo] = useState(null);
  
  // Customer state
  const [mobile, setMobile] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customer, setCustomer] = useState(null);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  
  // Recipient state
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [newRecipient, setNewRecipient] = useState({
    account_number: '',
    ifsc: '',
    recipient_name: '',
    recipient_mobile: '',
    bank_name: ''
  });
  
  // Transfer state
  const [amount, setAmount] = useState('');
  const [transferResult, setTransferResult] = useState(null);
  
  // Levin DMT specific state
  const [transferOtpSent, setTransferOtpSent] = useState(false);
  const [transferOtp, setTransferOtp] = useState('');
  const [otpRefId, setOtpRefId] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  
  // Transaction history
  const [transactions, setTransactions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [ifscValidating, setIfscValidating] = useState(false);
  const [ifscValid, setIfscValid] = useState(null);
  
  // Steps differ based on DMT type
  const steps = dmtType === 'levin' 
    ? ['Customer', 'Verify', 'Recipient', 'OTP', 'Transfer']
    : ['Customer', 'Verify', 'Recipient', 'Transfer'];
  
  // API base path based on DMT type
  const getApiPath = () => dmtType === 'levin' ? 'eko/levin-dmt' : 'eko/dmt';

  // Validate IFSC and fetch bank details
  const validateIFSC = async (ifsc) => {
    if (!ifsc || ifsc.length !== 11) {
      setIfscValid(null);
      setNewRecipient(prev => ({ ...prev, bank_name: '' }));
      return;
    }
    
    setIfscValidating(true);
    try {
      const res = await axios.get(`${API}/eko/dmt/ifsc/${ifsc}`);
      if (res.data.valid) {
        setIfscValid(true);
        setNewRecipient(prev => ({ 
          ...prev, 
          bank_name: res.data.bank_name || res.data.bank || ''
        }));
      } else {
        setIfscValid(false);
        toast.error('Invalid IFSC code');
      }
    } catch (error) {
      setIfscValid(false);
      console.error('IFSC validation failed:', error);
    } finally {
      setIfscValidating(false);
    }
  };

  // Fetch wallet info
  const fetchWalletInfo = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/eko/dmt/wallet/${user?.uid}`);
      let walletData = res.data || {};
      
      // Also fetch redeem limit (separate try-catch to not break if fails)
      try {
        const limitRes = await axios.get(`${API}/user/${user?.uid}/redeem-limit`);
        if (limitRes.data?.success) {
          walletData.redeem_limit = limitRes.data.limit;
        }
      } catch (limitError) {
        console.error('Failed to fetch redeem limit:', limitError);
      }
      
      setWalletInfo(walletData);
    } catch (error) {
      console.error('Failed to fetch wallet info:', error);
      // Set empty wallet info to prevent white screen
      setWalletInfo({});
    }
  }, [user?.uid]);

  // Fetch transaction history
  const fetchTransactions = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/eko/dmt/transactions/${user?.uid}`);
      setTransactions(res.data.transactions || []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      fetchWalletInfo();
      fetchTransactions();
    }
  }, [user?.uid, fetchWalletInfo, fetchTransactions]);

  // Step 1: Search customer
  const handleSearchCustomer = async () => {
    if (mobile.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    
    setLoading(true);
    try {
      let res;
      if (dmtType === 'levin') {
        res = await axios.post(`${API}/eko/levin-dmt/sender/check`, {
          customer_mobile: mobile
        });
        
        if (res.data.sender_exists) {
          setCustomer(res.data.sender);
          toast.success('Customer found!');
          setStep(3); // Skip to recipients
          fetchRecipients();
        } else {
          toast.info('Customer not registered. Please register first.');
          setStep(2);
        }
      } else {
        res = await axios.post(`${API}/eko/dmt/customer/search`, {
          mobile,
          user_id: user?.uid
        });
        
        if (res.data.customer_exists) {
          setCustomer(res.data.customer);
          toast.success('Customer found!');
          setStep(3);
          fetchRecipients();
        } else {
          toast.info('Customer not registered. Please register first.');
          setStep(2);
        }
      }
    } catch (error) {
      toast.error(sanitizeErrorMessage(error.response?.data?.detail) || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Register customer
  const handleRegisterCustomer = async () => {
    if (!customerName.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    
    setLoading(true);
    try {
      let res;
      if (dmtType === 'levin') {
        res = await axios.post(`${API}/eko/levin-dmt/sender/register`, {
          customer_mobile: mobile,
          name: customerName
        });
        
        if (res.data.success && res.data.otp_sent) {
          setOtpSent(true);
          toast.success('OTP sent to customer mobile');
        } else {
          toast.error(sanitizeErrorMessage(res.data.message) || 'Registration failed');
        }
      } else {
        res = await axios.post(`${API}/eko/dmt/customer/register`, {
          mobile,
          name: customerName,
          user_id: user?.uid
        });
        
        if (res.data.success && res.data.otp_required) {
          setOtpSent(true);
          toast.success('OTP sent to customer mobile');
        } else {
          toast.error(sanitizeErrorMessage(res.data.message) || 'Registration failed');
        }
      }
    } catch (error) {
      toast.error(sanitizeErrorMessage(error.response?.data?.detail) || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async () => {
    if (otp.length !== 6 && otp.length !== 4) {
      toast.error('Please enter valid OTP');
      return;
    }
    
    setLoading(true);
    try {
      let res;
      if (dmtType === 'levin') {
        res = await axios.post(`${API}/eko/levin-dmt/sender/verify-otp`, {
          customer_mobile: mobile,
          otp
        });
        
        if (res.data.success) {
          setCustomer({ customer_id: mobile, name: customerName });
          toast.success('Customer verified successfully!');
          setStep(3);
          fetchRecipients();
        } else {
          toast.error(sanitizeErrorMessage(res.data.message) || 'OTP verification failed');
        }
      } else {
        res = await axios.post(`${API}/eko/dmt/customer/verify-otp`, {
          mobile,
          otp,
          user_id: user?.uid
        });
        
        if (res.data.success) {
          setCustomer(res.data.customer);
          toast.success('Customer verified successfully!');
          setStep(3);
          fetchRecipients();
        } else {
          toast.error(sanitizeErrorMessage(res.data.message) || 'OTP verification failed');
        }
      }
    } catch (error) {
      toast.error(sanitizeErrorMessage(error.response?.data?.detail) || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/eko/dmt/customer/resend-otp`, {
        mobile,
        user_id: user?.uid
      });
      
      if (res.data.success) {
        toast.success('OTP resent successfully');
      } else {
        toast.error(sanitizeErrorMessage(res.data.message) || 'Failed to resend OTP');
      }
    } catch (error) {
      toast.error(sanitizeErrorMessage(error.response?.data?.detail) || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // Fetch recipients
  const fetchRecipients = async () => {
    try {
      const endpoint = dmtType === 'levin' 
        ? `${API}/eko/levin-dmt/recipients/${mobile}`
        : `${API}/eko/dmt/recipients/${mobile}`;
      const res = await axios.get(endpoint);
      setRecipients(res.data.recipients || []);
    } catch (error) {
      console.error('Failed to fetch recipients:', error);
    }
  };

  // Add recipient
  const handleAddRecipient = async () => {
    if (!newRecipient.account_number || !newRecipient.ifsc || !newRecipient.recipient_name) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setLoading(true);
    try {
      let res;
      if (dmtType === 'levin') {
        res = await axios.post(`${API}/eko/levin-dmt/recipient/add`, {
          customer_mobile: mobile,
          recipient_name: newRecipient.recipient_name,
          recipient_mobile: newRecipient.recipient_mobile || mobile,
          account_number: newRecipient.account_number,
          ifsc_code: newRecipient.ifsc
        });
        
        if (res.data.success) {
          toast.success('Recipient added! Activating...');
          // Activate recipient for Levin DMT
          const activateRes = await axios.post(`${API}/eko/levin-dmt/recipient/activate`, {
            customer_mobile: mobile,
            recipient_id: res.data.recipient_id
          });
          if (activateRes.data.success) {
            setBeneficiaryId(activateRes.data.beneficiary_id);
            toast.success('Recipient activated successfully!');
          }
          setShowAddRecipient(false);
          setNewRecipient({ account_number: '', ifsc: '', recipient_name: '', recipient_mobile: '', bank_name: '' });
          fetchRecipients();
        } else {
          toast.error(sanitizeErrorMessage(res.data.message) || 'Failed to add recipient');
        }
      } else {
        res = await axios.post(`${API}/eko/dmt/recipient/add`, {
          mobile,
          ...newRecipient,
          user_id: user?.uid
        });
        
        if (res.data.success) {
          toast.success('Recipient added successfully!');
          setShowAddRecipient(false);
          setNewRecipient({ account_number: '', ifsc: '', recipient_name: '', recipient_mobile: '', bank_name: '' });
          fetchRecipients();
        } else {
          toast.error(sanitizeErrorMessage(res.data.message) || 'Failed to add recipient');
        }
      }
    } catch (error) {
      toast.error(sanitizeErrorMessage(error.response?.data?.detail) || 'Failed to add recipient');
    } finally {
      setLoading(false);
    }
  };

  // Send Transfer OTP (Levin DMT only)
  const handleSendTransferOTP = async () => {
    const transferAmount = parseFloat(amount);
    
    if (!transferAmount || transferAmount < 100) {
      toast.error('Minimum transfer amount is ₹100');
      return;
    }
    
    if (!selectedRecipient) {
      toast.error('Please select a recipient');
      return;
    }
    
    setLoading(true);
    try {
      const res = await axios.post(`${API}/eko/levin-dmt/transfer/send-otp`, {
        customer_mobile: mobile,
        recipient_id: selectedRecipient.recipient_id?.toString(),
        beneficiary_id: selectedRecipient.beneficiary_id?.toString() || beneficiaryId,
        amount: transferAmount
      });
      
      if (res.data.success && res.data.otp_sent) {
        setOtpRefId(res.data.otp_ref_id);
        setTransferOtpSent(true);
        setStep(dmtType === 'levin' ? 4 : step); // Move to OTP step
        toast.success('Transfer OTP sent to customer mobile');
      } else {
        toast.error(sanitizeErrorMessage(res.data.message) || 'Failed to send OTP');
      }
    } catch (error) {
      toast.error(sanitizeErrorMessage(error.response?.data?.detail) || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Initiate transfer
  const handleTransfer = async () => {
    const transferAmount = parseFloat(amount);
    
    if (!transferAmount || transferAmount < 100) {
      toast.error('Minimum transfer amount is ₹100');
      return;
    }
    
    if (transferAmount > 25000) {
      toast.error('Maximum transfer amount is ₹25,000 per transaction');
      return;
    }
    
    if (!selectedRecipient) {
      toast.error('Please select a recipient');
      return;
    }
    
    // For Levin DMT, need transfer OTP
    if (dmtType === 'levin' && !transferOtp) {
      toast.error('Please enter the transfer OTP');
      return;
    }
    
    const commission = transferAmount * 0.01;
    const totalPRC = transferAmount + commission;
    
    if (walletInfo && walletInfo.prc_balance < totalPRC) {
      toast.error(`Insufficient PRC balance. Required: ${totalPRC.toFixed(2)} PRC`);
      return;
    }
    
    setLoading(true);
    try {
      let res;
      if (dmtType === 'levin') {
        res = await axios.post(`${API}/eko/levin-dmt/transfer`, {
          customer_mobile: mobile,
          recipient_id: selectedRecipient.recipient_id?.toString(),
          beneficiary_id: selectedRecipient.beneficiary_id?.toString() || beneficiaryId,
          amount: transferAmount,
          otp: transferOtp,
          otp_ref_id: otpRefId,
          user_id: user?.uid  // For limit tracking
        });
      } else {
        res = await axios.post(`${API}/eko/dmt/transfer`, {
          mobile,
          recipient_id: selectedRecipient.recipient_id || selectedRecipient.recipient_id_type,
          amount: transferAmount,
          user_id: user?.uid,
          remarks: 'Fund Transfer'
        });
      }
      
      setTransferResult(res.data);
      setStep(dmtType === 'levin' ? 5 : 4); // Move to result step
      
      if (res.data.success) {
        toast.success('Transfer successful!');
        fetchWalletInfo();
        fetchTransactions();
      } else {
        toast.error(sanitizeErrorMessage(res.data.message) || 'Transfer failed');
        if (res.data.refunded) {
          toast.info('Amount has been refunded to your wallet');
        }
      }
    } catch (error) {
      toast.error(sanitizeErrorMessage(error.response?.data?.detail || error.response?.data?.message) || 'Service temporarily unavailable');
    } finally {
      setLoading(false);
    }
  };

  // Reset flow
  const resetFlow = () => {
    setStep(1);
    setMobile('');
    setCustomerName('');
    setCustomer(null);
    setOtp('');
    setOtpSent(false);
    setRecipients([]);
    setSelectedRecipient(null);
    setAmount('');
    setTransferResult(null);
    setShowAddRecipient(false);
    setIfscValid(null);
    setNewRecipient({ account_number: '', ifsc: '', recipient_name: '', recipient_mobile: '', bank_name: '' });
    // Levin DMT specific reset
    setTransferOtpSent(false);
    setTransferOtp('');
    setOtpRefId('');
    setBeneficiaryId('');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 md:p-6">
      {/* Animated Background Gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950/30 via-transparent to-cyan-950/20 pointer-events-none" />
      <div className="fixed top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-2xl mx-auto relative">
        {/* Premium Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-2xl blur-lg opacity-50" />
              <div className="relative p-4 bg-gradient-to-br from-violet-600 to-cyan-600 rounded-2xl">
                <Send className="w-7 h-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Money Transfer
              </h1>
              <p className="text-sm text-gray-500">Instant bank transfers • Secure & Fast</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors"
              data-testid="show-history-btn"
            >
              <History className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        {/* DMT Type Selector - Hidden (using Levin by default) */}
        <div className="hidden">
          <button
            onClick={() => { setDmtType('levin'); resetFlow(); }}
            className={`flex-1 p-4 rounded-2xl border transition-all duration-300 ${
              dmtType === 'levin' 
                ? 'bg-gradient-to-br from-violet-600/20 to-cyan-600/20 border-violet-500/50 shadow-lg shadow-violet-500/10' 
                : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
            }`}
            data-testid="dmt-type-levin"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${dmtType === 'levin' ? 'bg-violet-500/20' : 'bg-gray-800'}`}>
                <Zap className={`w-5 h-5 ${dmtType === 'levin' ? 'text-violet-400' : 'text-gray-500'}`} />
              </div>
              <div className="text-left">
                <p className={`font-semibold ${dmtType === 'levin' ? 'text-white' : 'text-gray-400'}`}>Levin DMT</p>
                <p className="text-xs text-gray-500">OTP Based • Recommended</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => { setDmtType('v1'); resetFlow(); }}
            className={`flex-1 p-4 rounded-2xl border transition-all duration-300 ${
              dmtType === 'v1' 
                ? 'bg-gradient-to-br from-amber-600/20 to-orange-600/20 border-amber-500/50 shadow-lg shadow-amber-500/10' 
                : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
            }`}
            data-testid="dmt-type-v1"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${dmtType === 'v1' ? 'bg-amber-500/20' : 'bg-gray-800'}`}>
                <Shield className={`w-5 h-5 ${dmtType === 'v1' ? 'text-amber-400' : 'text-gray-500'}`} />
              </div>
              <div className="text-left">
                <p className={`font-semibold ${dmtType === 'v1' ? 'text-white' : 'text-gray-400'}`}>Legacy V1</p>
                <p className="text-xs text-gray-500">Classic Transfer</p>
              </div>
            </div>
          </button>
        </div>

        {/* Premium Wallet Card - Global Redeem Limit */}
        {walletInfo && (
          <div className="relative mb-6 group" data-testid="wallet-info-card">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
            <Card className="relative bg-gradient-to-br from-gray-900 to-gray-900/80 border border-gray-800/50 p-5 rounded-2xl backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-xl border border-violet-500/20">
                  <Wallet className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Global Redeem Limit</p>
                  <p className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                    {(walletInfo.redeem_limit?.remaining_limit || 0).toLocaleString()} <span className="text-lg">PRC</span>
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    ≈ ₹{((walletInfo.redeem_limit?.remaining_limit || 0) / 10).toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Transaction History - Premium Modal */}
        {showHistory && (
          <Card className="bg-gray-900/90 backdrop-blur-xl border border-gray-800/50 p-5 mb-6 rounded-2xl" data-testid="transaction-history">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-500/10 rounded-xl">
                  <History className="w-5 h-5 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="hover:bg-white/5 rounded-xl">
                <XCircle className="w-5 h-5 text-gray-400" />
              </Button>
            </div>
            {transactions.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                {transactions.slice(0, 10).map((txn, idx) => (
                  <div 
                    key={txn.txn_id} 
                    className="flex items-center justify-between p-4 bg-gray-800/30 hover:bg-gray-800/50 rounded-xl border border-gray-800/50 transition-colors group"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        txn.status === 'success' ? 'bg-emerald-500/10' :
                        txn.status === 'failed' ? 'bg-red-500/10' : 'bg-amber-500/10'
                      }`}>
                        {txn.status === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
                         txn.status === 'failed' ? <XCircle className="w-4 h-4 text-red-400" /> :
                         <RefreshCw className="w-4 h-4 text-amber-400" />}
                      </div>
                      <div>
                        <p className="text-sm text-white font-mono group-hover:text-violet-300 transition-colors">{txn.txn_id?.slice(0, 16)}...</p>
                        <p className="text-xs text-gray-500">{new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">₹{txn.amount?.toLocaleString()}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        txn.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                        txn.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {txn.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <History className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500">No transactions yet</p>
              </div>
            )}
          </Card>
        )}

        {/* Step Indicator */}
        {!showHistory && <StepIndicator currentStep={step} steps={steps} />}

        {/* Main Content - Glass Card */}
        {!showHistory && (
          <Card className="relative bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 p-6 rounded-2xl overflow-hidden" data-testid="dmt-main-card">
            {/* Decorative gradient */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-violet-600/10 to-transparent rounded-full blur-2xl" />
            
            {/* Step 1: Search Customer */}
            {step === 1 && (
              <div className="space-y-6 relative" data-testid="step-search">
                <div className="text-center mb-8">
                  <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full blur-lg opacity-30" />
                    <div className="relative w-20 h-20 bg-gradient-to-br from-violet-600/20 to-cyan-600/20 rounded-full flex items-center justify-center border border-violet-500/20">
                      <Search className="w-10 h-10 text-violet-400" />
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Enter Customer Mobile</h2>
                  <p className="text-sm text-gray-500">Customer whose bank account you want to transfer money to</p>
                </div>
                
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <div className="relative flex items-center">
                    <Phone className="absolute left-4 w-5 h-5 text-gray-500 group-focus-within:text-violet-400 transition-colors" />
                    <Input
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="pl-12 py-4 bg-gray-800/50 border-gray-700/50 text-white text-lg rounded-xl focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                      data-testid="mobile-input"
                    />
                    {mobile.length === 10 && (
                      <CheckCircle className="absolute right-4 w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                </div>
                
                <Button
                  onClick={handleSearchCustomer}
                  disabled={loading || mobile.length !== 10}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all disabled:opacity-50 disabled:shadow-none"
                  data-testid="search-customer-btn"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Search className="w-5 h-5 mr-2" />
                  )}
                  Search Customer
                </Button>
                
                {/* Info Cards */}
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <div className="p-3 bg-gray-800/30 rounded-xl border border-gray-800/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-gray-400">Secure</span>
                    </div>
                    <p className="text-xs text-gray-500">256-bit encryption</p>
                  </div>
                  <div className="p-3 bg-gray-800/30 rounded-xl border border-gray-800/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-gray-400">Instant</span>
                    </div>
                    <p className="text-xs text-gray-500">Real-time transfer</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Register / OTP */}
            {step === 2 && (
              <div className="space-y-4" data-testid="step-register">
                <Button variant="ghost" onClick={() => setStep(1)} className="text-gray-400 mb-4">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                
                {!otpSent ? (
                  <>
                    <div className="text-center mb-6">
                      <UserPlus className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                      <h2 className="text-lg font-semibold text-white">Register Customer</h2>
                      <p className="text-sm text-gray-400">Mobile: {mobile}</p>
                    </div>
                    
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <Input
                        type="text"
                        placeholder="Customer Name (as per bank)"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="pl-10 bg-gray-800 border-gray-700 text-white"
                        data-testid="customer-name-input"
                      />
                    </div>
                    
                    <Button
                      onClick={handleRegisterCustomer}
                      disabled={loading || !customerName.trim()}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                      data-testid="register-btn"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                      Register & Send OTP
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <Shield className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <h2 className="text-lg font-semibold text-white">Verify OTP</h2>
                      <p className="text-sm text-gray-400">Enter OTP sent to {mobile}</p>
                    </div>
                    
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <Input
                        type="text"
                        placeholder="Enter OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="pl-10 bg-gray-800 border-gray-700 text-white text-center text-xl tracking-widest"
                        data-testid="otp-input"
                      />
                    </div>
                    
                    <Button
                      onClick={handleVerifyOTP}
                      disabled={loading || otp.length < 4}
                      className="w-full bg-green-500 hover:bg-green-600 text-white"
                      data-testid="verify-otp-btn"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Verify OTP
                    </Button>
                    
                    <Button
                      variant="ghost"
                      onClick={handleResendOTP}
                      disabled={loading}
                      className="w-full text-gray-400"
                      data-testid="resend-otp-btn"
                    >
                      Resend OTP
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Recipients - Premium Style */}
            {step === 3 && (
              <div className="space-y-5" data-testid="step-recipients">
                <Button variant="ghost" onClick={resetFlow} className="text-gray-400 hover:text-white hover:bg-white/5 rounded-xl mb-2">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Start Over
                </Button>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Select Recipient</h2>
                    <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                      <Phone className="w-4 h-4" /> {mobile}
                      {customer?.name && <span className="text-violet-400">• {customer.name}</span>}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddRecipient(true)}
                    className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 rounded-xl"
                    data-testid="add-recipient-btn"
                  >
                    <UserPlus className="w-4 h-4 mr-1" /> Add New
                  </Button>
                </div>

                {/* Add Recipient Form - Premium */}
                {showAddRecipient && (
                  <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 p-5 rounded-2xl" data-testid="add-recipient-form">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-violet-500/10 rounded-xl">
                        <UserPlus className="w-5 h-5 text-violet-400" />
                      </div>
                      <h3 className="font-semibold text-white">Add New Recipient</h3>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Recipient Name</label>
                        <Input
                          placeholder="Full name as per bank account"
                          value={newRecipient.recipient_name}
                          onChange={(e) => setNewRecipient({...newRecipient, recipient_name: e.target.value})}
                          className="bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-violet-500/50"
                          data-testid="recipient-name-input"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Account Number</label>
                        <Input
                          placeholder="Bank account number"
                          value={newRecipient.account_number}
                          onChange={(e) => setNewRecipient({...newRecipient, account_number: e.target.value.replace(/\D/g, '')})}
                          className="bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-violet-500/50"
                          data-testid="account-number-input"
                        />
                      </div>
                      <div className="relative">
                        <label className="text-xs text-gray-500 mb-1 block">IFSC Code</label>
                        <Input
                          placeholder="e.g., SBIN0001234"
                          value={newRecipient.ifsc}
                          onChange={(e) => {
                            const ifsc = e.target.value.toUpperCase().slice(0, 11);
                            setNewRecipient({...newRecipient, ifsc});
                            if (ifsc.length === 11) {
                              validateIFSC(ifsc);
                            } else {
                              setIfscValid(null);
                            }
                          }}
                          className={`bg-gray-900 border-gray-700 text-white pr-10 ${
                            ifscValid === true ? 'border-green-500' : 
                            ifscValid === false ? 'border-red-500' : ''
                          }`}
                          data-testid="ifsc-input"
                        />
                        {ifscValidating && (
                          <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                        )}
                        {!ifscValidating && ifscValid === true && (
                          <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                        )}
                        {!ifscValidating && ifscValid === false && (
                          <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <Input
                        placeholder="Bank Name (auto-filled from IFSC)"
                        value={newRecipient.bank_name}
                        onChange={(e) => setNewRecipient({...newRecipient, bank_name: e.target.value})}
                        className="bg-gray-900 border-gray-700 text-white"
                        data-testid="bank-name-input"
                        readOnly={ifscValid === true}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAddRecipient}
                          disabled={loading || ifscValidating || (newRecipient.ifsc.length === 11 && ifscValid === false)}
                          className="flex-1 bg-orange-500 hover:bg-orange-600"
                          data-testid="save-recipient-btn"
                        >
                          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Recipient'}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setShowAddRecipient(false);
                            setIfscValid(null);
                            setNewRecipient({ account_number: '', ifsc: '', recipient_name: '', bank_name: '' });
                          }}
                          className="text-gray-400"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Recipients List */}
                {recipients.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {recipients.map((recipient, idx) => (
                      <div
                        key={recipient.recipient_id || recipient.acc || idx}
                        onClick={() => {
                          setSelectedRecipient(recipient);
                          if (recipient.beneficiary_id) {
                            setBeneficiaryId(recipient.beneficiary_id.toString());
                          }
                        }}
                        className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                          selectedRecipient?.recipient_id === recipient.recipient_id
                            ? 'bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border-2 border-violet-500 shadow-lg shadow-violet-500/10'
                            : 'bg-gray-800/30 border border-gray-800 hover:border-violet-500/30 hover:bg-gray-800/50'
                        }`}
                        data-testid={`recipient-${idx}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${
                            selectedRecipient?.recipient_id === recipient.recipient_id
                              ? 'bg-violet-500/20'
                              : 'bg-gray-800'
                          }`}>
                            <Building className={`w-5 h-5 ${
                              selectedRecipient?.recipient_id === recipient.recipient_id
                                ? 'text-violet-400'
                                : 'text-gray-400'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-semibold">{recipient.recipient_name || recipient.name}</p>
                            <p className="text-sm text-gray-500">
                              {recipient.bank || recipient.bank_name} • ****{(recipient.acc || recipient.account_number || '').slice(-4)}
                            </p>
                          </div>
                          {selectedRecipient?.recipient_id === recipient.recipient_id ? (
                            <CheckCircle className="w-6 h-6 text-violet-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CreditCard className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-400 font-medium">No recipients found</p>
                    <p className="text-sm text-gray-600 mt-1">Add a bank account to continue</p>
                  </div>
                )}

                {/* Selected Recipient - Amount Input for Levin DMT */}
                {selectedRecipient && (
                  <Card className="mt-5 p-5 bg-gradient-to-br from-violet-600/10 to-cyan-600/10 border border-violet-500/20 rounded-2xl">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="p-3 bg-emerald-500/10 rounded-xl">
                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">{selectedRecipient.recipient_name || selectedRecipient.name}</p>
                        <p className="text-sm text-emerald-400">Ready for transfer</p>
                      </div>
                    </div>
                    
                    <div className="mb-5">
                      <label className="text-xs text-gray-500 mb-2 block">Transfer Amount</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-500">₹</span>
                        <Input
                          type="number"
                          placeholder="100 - 25,000"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="pl-10 py-4 text-2xl bg-gray-800/50 border-gray-700/50 text-white rounded-xl focus:border-violet-500/50"
                          data-testid="amount-input-step3"
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-2">Min ₹100 • Max ₹25,000 per transaction</p>
                    </div>
                    
                    {dmtType === 'levin' ? (
                      <Button
                        onClick={handleSendTransferOTP}
                        disabled={loading || !amount || parseFloat(amount) < 100}
                        className="w-full py-4 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/20 disabled:opacity-50"
                        data-testid="send-transfer-otp-btn"
                      >
                        {loading ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                        Send Transfer OTP
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setStep(4)}
                        disabled={!amount || parseFloat(amount) < 100}
                        className="w-full bg-orange-500 hover:bg-orange-600"
                        data-testid="proceed-transfer-btn"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Proceed to Transfer
                      </Button>
                    )}
                  </Card>
                )}
              </div>
            )}

            {/* Step 4: Transfer OTP (Levin) or Transfer (V1) */}
            {step === 4 && (
              <div className="space-y-4" data-testid="step-transfer">
                <Button variant="ghost" onClick={() => setStep(3)} className="text-gray-400 mb-4">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Recipients
                </Button>

                {dmtType === 'levin' && transferOtpSent ? (
                  /* Levin DMT - OTP Verification for Transfer */
                  <Card className="bg-gray-800/50 border-gray-700 p-6">
                    <div className="text-center mb-6">
                      <div className="p-4 bg-orange-500/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Shield className="w-8 h-8 text-orange-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">Enter Transfer OTP</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        OTP sent to {mobile}
                      </p>
                    </div>

                    {/* Transfer Summary */}
                    <Card className="bg-gray-900/50 border-gray-600 p-4 mb-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Recipient</span>
                          <span className="text-white">{selectedRecipient?.recipient_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Amount</span>
                          <span className="text-orange-400 font-semibold">₹{parseFloat(amount).toLocaleString()}</span>
                        </div>
                      </div>
                    </Card>

                    <Input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={transferOtp}
                      onChange={(e) => setTransferOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center text-2xl tracking-widest bg-gray-900 border-gray-700 text-white mb-4"
                      maxLength={6}
                      data-testid="transfer-otp-input"
                    />

                    <Button
                      onClick={handleTransfer}
                      disabled={loading || transferOtp.length !== 6}
                      className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                      data-testid="confirm-transfer-btn"
                    >
                      {loading ? (
                        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <Send className="w-5 h-5 mr-2" />
                      )}
                      Confirm Transfer ₹{amount}
                    </Button>
                  </Card>
                ) : !transferResult ? (
                  <>
                    <div className="text-center mb-6">
                      <Send className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <h2 className="text-lg font-semibold text-white">Transfer Amount</h2>
                    </div>

                    {/* Selected Recipient */}
                    {selectedRecipient && (
                      <Card className="bg-gray-800/50 border-gray-700 p-4 mb-4" data-testid="selected-recipient-card">
                        <p className="text-xs text-gray-400 mb-1">Sending to</p>
                        <p className="text-white font-medium">{selectedRecipient.recipient_name || selectedRecipient.name}</p>
                        <p className="text-sm text-gray-400">
                          {selectedRecipient.bank || selectedRecipient.bank_name} • 
                          ****{(selectedRecipient.acc || selectedRecipient.account_number || '').slice(-4)}
                        </p>
                      </Card>
                    )}

                    {/* Amount Input */}
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-gray-400">₹</span>
                      <Input
                        type="number"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-8 text-2xl h-14 bg-gray-800 border-gray-700 text-white text-center"
                        data-testid="amount-input"
                      />
                    </div>

                    {/* Quick amounts */}
                    <div className="flex gap-2 justify-center">
                      {[500, 1000, 2000, 5000].map((amt) => (
                        <Button
                          key={amt}
                          variant="outline"
                          size="sm"
                          onClick={() => setAmount(amt.toString())}
                          className="border-gray-700 text-gray-300"
                        >
                          ₹{amt}
                        </Button>
                      ))}
                    </div>

                    {/* Charges breakdown */}
                    {amount && parseFloat(amount) >= 100 && (
                      <Card className="bg-gray-800/30 border-gray-700 p-3" data-testid="charges-breakdown">
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Transfer Amount</span>
                            <span className="text-white">₹{parseFloat(amount).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Commission (1%)</span>
                            <span className="text-white">₹{(parseFloat(amount) * 0.01).toFixed(2)}</span>
                          </div>
                          <div className="border-t border-gray-700 pt-1 flex justify-between font-medium">
                            <span className="text-gray-300">Total PRC Deduction</span>
                            <span className="text-orange-400">
                              {(parseFloat(amount) * 1.01).toFixed(2)} PRC
                            </span>
                          </div>
                        </div>
                      </Card>
                    )}

                    <Button
                      onClick={handleTransfer}
                      disabled={loading || !amount || parseFloat(amount) < 100}
                      className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold"
                      data-testid="transfer-btn"
                    >
                      {loading ? (
                        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <Send className="w-5 h-5 mr-2" />
                      )}
                      Transfer ₹{amount || '0'}
                    </Button>

                    <p className="text-xs text-center text-gray-500">
                      Min ₹100 • Max ₹25,000 per transaction
                    </p>
                  </>
                ) : (
                  /* Transfer Result */
                  <div className="text-center py-6" data-testid="transfer-result">
                    {transferResult.success ? (
                      <>
                        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Transfer Successful!</h2>
                        <p className="text-gray-400 mb-4">₹{transferResult.amount} sent successfully</p>
                        <Card className="bg-gray-800/50 border-gray-700 p-4 text-left mb-4">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Transaction ID</span>
                              <span className="text-white font-mono">{transferResult.txn_id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">New Balance</span>
                              <span className="text-white">{transferResult.new_balance?.toLocaleString()} PRC</span>
                            </div>
                          </div>
                        </Card>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Transfer Failed</h2>
                        <p className="text-gray-400 mb-4">{sanitizeErrorMessage(transferResult.message)}</p>
                        {transferResult.refunded && (
                          <p className="text-green-400 text-sm mb-4">
                            <CheckCircle className="w-4 h-4 inline mr-1" />
                            Amount has been refunded to your wallet
                          </p>
                        )}
                      </>
                    )}
                    
                    <Button
                      onClick={resetFlow}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                      data-testid="new-transfer-btn"
                    >
                      New Transfer
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default DMTPage;
