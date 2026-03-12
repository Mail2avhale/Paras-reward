import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Wallet, 
  Send, 
  Plus, 
  User, 
  CreditCard, 
  History, 
  CheckCircle, 
  XCircle,
  Clock,
  ArrowRight,
  Building2,
  Shield,
  Loader2,
  AlertCircle,
  RefreshCw,
  UserPlus,
  KeyRound,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DMTPage = () => {
  // Get user from localStorage
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const storedUser = localStorage.getItem('paras_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);
  
  const [activeTab, setActiveTab] = useState('transfer');
  const [loading, setLoading] = useState(false);
  
  // Wallet State
  const [wallet, setWallet] = useState({
    prc_balance: 0,
    inr_equivalent: 0,
    can_redeem: false,
    daily_limit_inr: 5000,
    remaining_limit_inr: 5000
  });
  
  // Customer State
  const [customer, setCustomer] = useState(null);
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerLoading, setCustomerLoading] = useState(false);
  
  // Recipients State
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  
  // Add Recipient Form
  const [newRecipient, setNewRecipient] = useState({
    recipient_name: '',
    account_number: '',
    ifsc: ''
  });
  
  // Transfer State
  const [transferAmount, setTransferAmount] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  
  // Transfer OTP State (OTP is required during transfer, not registration)
  const [showTransferOTP, setShowTransferOTP] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState(null);
  const [transferOtpValue, setTransferOtpValue] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  // Transactions State
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  
  // Registration State (V1 API - No OTP needed for registration)
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationName, setRegistrationName] = useState('');

  // Load wallet on mount
  useEffect(() => {
    if (user?.uid) {
      fetchWallet();
      fetchTransactions();
    }
  }, [user]);

  // Resend OTP Timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Register new customer
  const registerCustomer = async () => {
    if (!registrationName || registrationName.length < 3) {
      toast.error('कृपया पूर्ण नाव टाका (किमान 3 अक्षरे)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/eko/dmt/customer/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: customerMobile,
          name: registrationName,
          user_id: user.uid
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        const state = data.data.state;
        
        // V1 API: Customer registration doesn't need OTP verification
        // OTP is only required during TRANSFER
        toast.success('✅ Registration पूर्ण! तुम्ही आता recipient add करू शकता.');
        setShowRegistration(false);
        setShowOTPVerification(false);
        setCustomer({
          customer_exists: true,
          customer_id: data.data.customer_id,
          name: registrationName,
          mobile: customerMobile,
          state: state,
          available_limit: data.data.available_limit || 25000,
          can_transact: true  // V1 API - customer can transact after registration
        });
        fetchRecipients(customerMobile);
        
        if (state === '1' || state === 1) {
          // Inform user that OTP will be required during transfer
          toast.info('📱 Transfer करताना OTP पाठवला जाईल.');
        }
      } else {
        toast.error(data.user_message || data.message || 'Registration failed');
      }
    } catch (error) {
      toast.error('Registration failed. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setLoading(false);
    }
  };

  // NOTE: V1 API - Resend OTP and Verify OTP functions removed
  // OTP verification happens during TRANSFER, not registration
  // See executeTransfer() for transfer OTP handling

  // Fetch wallet balance
  const fetchWallet = async () => {
    try {
      const res = await fetch(`${API_URL}/api/eko/dmt/wallet/${user.uid}`);
      const data = await res.json();
      if (data.success) {
        setWallet(data.data);
      }
    } catch (error) {
      console.error('Wallet fetch error:', error);
    }
  };

  // Search customer
  const searchCustomer = async () => {
    if (!customerMobile || customerMobile.length !== 10) {
      toast.error('कृपया 10 अंकी मोबाइल नंबर टाका');
      return;
    }

    // Reset states
    setShowRegistration(false);
    setRegistrationName('');
    setOtpValue('');

    setCustomerLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/eko/dmt/customer/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: customerMobile,
          user_id: user.uid
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setCustomer(data.data);
        
        if (data.data.customer_exists) {
          const state = String(data.data.state);
          
          // V1 API: All registered customers can transact
          // OTP is only required during TRANSFER, not for customer verification
          toast.success(`✅ ${data.data.name} - Transfer साठी तयार!`);
          setCustomer({
            ...data.data,
            can_transact: true  // V1 API - all registered customers can transact
          });
          fetchRecipients(customerMobile);
          
          if (state === '1') {
            // Inform user that OTP will be required during transfer
            toast.info('📱 Transfer करताना OTP पाठवला जाईल.');
          }
        } else {
          // Customer not registered - show registration form
          toast.info('🆕 नवीन customer. कृपया registration करा.');
          setShowRegistration(true);
        }
      } else {
        toast.error(data.user_message || data.message);
      }
    } catch (error) {
      toast.error('Customer शोधता आला नाही');
    } finally {
      setCustomerLoading(false);
    }
  };

  // Fetch recipients
  const fetchRecipients = async (mobile) => {
    setRecipientsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/eko/dmt/recipients/${mobile}?user_id=${user.uid}`);
      const data = await res.json();
      
      if (data.success) {
        setRecipients(data.data.recipients || []);
      }
    } catch (error) {
      console.error('Recipients fetch error:', error);
    } finally {
      setRecipientsLoading(false);
    }
  };

  // Add recipient
  const addRecipient = async () => {
    if (!newRecipient.recipient_name || !newRecipient.account_number || !newRecipient.ifsc) {
      toast.error('Please fill all recipient details');
      return;
    }

    if (newRecipient.ifsc.length !== 11) {
      toast.error('IFSC must be 11 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/eko/dmt/recipient/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: customerMobile,
          ...newRecipient,
          user_id: user.uid
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success('Recipient added successfully');
        setNewRecipient({ recipient_name: '', account_number: '', ifsc: '' });
        fetchRecipients(customerMobile);
        setActiveTab('transfer');
      } else {
        toast.error(data.user_message || data.message);
      }
    } catch (error) {
      toast.error('Failed to add recipient');
    } finally {
      setLoading(false);
    }
  };

  // Execute transfer
  const executeTransfer = async (withOtp = false) => {
    if (!selectedRecipient) {
      toast.error('Please select a recipient');
      return;
    }

    // If completing with OTP
    if (withOtp && pendingTransactionId) {
      if (!transferOtpValue || transferOtpValue.length < 4) {
        toast.error('कृपया OTP टाका');
        return;
      }
      
      setTransferLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/eko/dmt/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.uid,
            mobile: customerMobile,
            recipient_id: selectedRecipient.recipient_id,
            prc_amount: parseFloat(transferAmount) * 100,
            otp: transferOtpValue,
            pending_transaction_id: pendingTransactionId
          })
        });
        
        const data = await res.json();
        
        if (data.success) {
          toast.success(data.data.message || 'Transfer successful! ✅');
          setShowTransferOTP(false);
          setPendingTransactionId(null);
          setTransferOtpValue('');
          setTransferAmount('');
          fetchWallet();
          fetchTransactions();
        } else {
          toast.error(data.user_message || data.message);
          if (data.message?.includes('refund')) {
            fetchWallet();
          }
        }
      } catch (error) {
        toast.error('Transfer failed. Please try again.');
      } finally {
        setTransferLoading(false);
      }
      return;
    }

    // New transfer - initiate
    const amount = parseFloat(transferAmount);
    if (!amount || amount < 100) {
      toast.error('Minimum transfer amount is ₹100');
      return;
    }

    if (amount > wallet.remaining_limit_inr) {
      toast.error(`Daily limit exceeded. Maximum: ₹${wallet.remaining_limit_inr}`);
      return;
    }

    const prcRequired = amount * 100;
    if (prcRequired > wallet.prc_balance) {
      toast.error(`Insufficient PRC balance. Need: ${prcRequired} PRC`);
      return;
    }

    setTransferLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/eko/dmt/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          mobile: customerMobile,
          recipient_id: selectedRecipient.recipient_id,
          prc_amount: prcRequired
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Check if OTP is required
        if (data.data.status === 'OTP_REQUIRED') {
          toast.info('📱 OTP पाठवला आहे. कृपया OTP टाकून transfer पूर्ण करा.');
          setPendingTransactionId(data.data.transaction_id);
          setShowTransferOTP(true);
          setResendTimer(30);
        } else {
          // Transfer completed
          toast.success(data.data.message || 'Transfer successful! ✅');
          fetchWallet();
          fetchTransactions();
          setTransferAmount('');
        }
      } else {
        toast.error(data.user_message || data.message);
        if (data.message?.includes('refund')) {
          fetchWallet();
        }
      }
    } catch (error) {
      toast.error('Transfer failed. Please try again.');
    } finally {
      setTransferLoading(false);
    }
  };

  // Cancel OTP flow
  const cancelTransferOTP = () => {
    setShowTransferOTP(false);
    setPendingTransactionId(null);
    setTransferOtpValue('');
    toast.info('Transfer cancelled. PRC will be refunded if deducted.');
  };

  // Resend transfer OTP
  const resendTransferOTP = async () => {
    if (resendTimer > 0) return;
    
    setTransferLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/eko/dmt/customer/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: customerMobile,
          user_id: user.uid
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success('✅ OTP पुन्हा पाठवला आहे!');
        setResendTimer(30);
      } else {
        toast.error(data.user_message || data.message || 'OTP पाठवता आला नाही');
      }
    } catch (error) {
      toast.error('OTP पाठवता आला नाही.');
    } finally {
      setTransferLoading(false);
    }
  };

  // Fetch transactions
  const fetchTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/eko/dmt/transactions/${user.uid}?limit=20`);
      const data = await res.json();
      
      if (data.success) {
        setTransactions(data.data.transactions || []);
      }
    } catch (error) {
      console.error('Transactions fetch error:', error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { color: 'bg-green-500', icon: CheckCircle, text: 'Success' },
      failed: { color: 'bg-red-500', icon: XCircle, text: 'Failed' },
      pending: { color: 'bg-yellow-500', icon: Clock, text: 'Pending' },
      processing: { color: 'bg-blue-500', icon: Loader2, text: 'Processing' },
      refunded: { color: 'bg-purple-500', icon: RefreshCw, text: 'Refunded' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.text}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Send className="w-8 h-8 text-amber-500" />
              Bank Transfer (DMT)
            </h1>
            <p className="text-gray-400 mt-1">Transfer PRC to bank account instantly</p>
          </div>
          
          {/* Wallet Card */}
          <Card className="bg-gradient-to-r from-amber-500 to-orange-600 border-0 shadow-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Wallet className="w-10 h-10 text-white" />
                <div>
                  <p className="text-white/80 text-sm">PRC Balance</p>
                  <p className="text-2xl font-bold text-white">{wallet.prc_balance?.toLocaleString()} PRC</p>
                  <p className="text-white/80 text-sm">≈ ₹{wallet.inr_equivalent?.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Customer & Recipients */}
          <div className="lg:col-span-1 space-y-4">
            {/* Customer Search */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-500" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter 10 digit mobile"
                    className="bg-gray-700/50 border-gray-600 text-white"
                    data-testid="customer-mobile-input"
                  />
                  <Button 
                    onClick={searchCustomer}
                    disabled={customerLoading}
                    className="bg-amber-500 hover:bg-amber-600"
                    data-testid="search-customer-btn"
                  >
                    {customerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                  </Button>
                </div>
                
                {customer && customer.customer_exists && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-green-400 font-medium">{customer.name}</p>
                    <p className="text-gray-400 text-sm">
                      Limit: ₹{customer.available_limit?.toLocaleString()} available
                    </p>
                  </div>
                )}
                
                {customer && !customer.customer_exists && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      नवीन customer. कृपया registration करा.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Registration Form */}
            {showRegistration && (
              <Card className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border-blue-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-blue-400" />
                    नवीन Customer Registration
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Mobile: {customerMobile}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-gray-300">पूर्ण नाव *</Label>
                    <Input
                      value={registrationName}
                      onChange={(e) => setRegistrationName(e.target.value)}
                      placeholder="नाव टाका (जसे bank मध्ये आहे)"
                      className="bg-gray-700/50 border-gray-600 text-white mt-1"
                      data-testid="registration-name-input"
                    />
                  </div>
                  
                  <Button
                    onClick={registerCustomer}
                    disabled={loading || !registrationName}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    data-testid="register-customer-btn"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-2" />
                    )}
                    Register करा
                  </Button>
                  
                  <p className="text-gray-500 text-xs text-center">
                    Registration नंतर OTP येईल तुमच्या mobile वर
                  </p>
                </CardContent>
              </Card>
            )}

            {/* NOTE: V1 API - OTP verification removed from customer registration */}
            {/* OTP is only required during TRANSFER, not during registration */}

            {/* Recipients - Show for all registered customers */}
            {customer?.customer_exists && (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-amber-500" />
                      Bank Accounts
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setActiveTab('add-recipient')}
                      className="text-amber-500 hover:text-amber-400"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {recipientsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                    </div>
                  ) : recipients.length > 0 ? (
                    <div className="space-y-2">
                      {recipients.map((r) => (
                        <div
                          key={r.recipient_id}
                          onClick={() => {
                            setSelectedRecipient(r);
                            setActiveTab('transfer');
                          }}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${
                            selectedRecipient?.recipient_id === r.recipient_id
                              ? 'bg-amber-500/20 border border-amber-500'
                              : 'bg-gray-700/50 border border-transparent hover:border-gray-600'
                          }`}
                          data-testid={`recipient-${r.recipient_id}`}
                        >
                          <p className="text-white font-medium">{r.recipient_name}</p>
                          <p className="text-gray-400 text-sm">{r.account_masked} • {r.ifsc}</p>
                          {r.bank_name && <p className="text-gray-500 text-xs">{r.bank_name}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No bank accounts added</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Panel - Actions */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-800/50 border-gray-700 h-full">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <CardHeader className="pb-0">
                  <TabsList className="bg-gray-700/50">
                    <TabsTrigger value="transfer" className="data-[state=active]:bg-amber-500">
                      <Send className="w-4 h-4 mr-2" /> Transfer
                    </TabsTrigger>
                    <TabsTrigger value="add-recipient" className="data-[state=active]:bg-amber-500">
                      <Plus className="w-4 h-4 mr-2" /> Add Account
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:bg-amber-500">
                      <History className="w-4 h-4 mr-2" /> History
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                
                <CardContent className="pt-6">
                  {/* Transfer Tab */}
                  <TabsContent value="transfer" className="mt-0 space-y-6">
                    {selectedRecipient ? (
                      <>
                        {/* Selected Recipient */}
                        <div className="p-4 bg-gray-700/30 rounded-lg">
                          <p className="text-gray-400 text-sm mb-1">Sending to</p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{selectedRecipient.recipient_name}</p>
                              <p className="text-gray-400 text-sm">{selectedRecipient.account_masked} • {selectedRecipient.ifsc}</p>
                            </div>
                          </div>
                        </div>

                        {/* Amount Input */}
                        <div className="space-y-2">
                          <Label className="text-gray-300">Amount (₹)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                            <Input
                              type="number"
                              value={transferAmount}
                              onChange={(e) => setTransferAmount(e.target.value)}
                              placeholder="Enter amount (min ₹100)"
                              className="pl-8 bg-gray-700/50 border-gray-600 text-white text-xl h-14"
                              data-testid="transfer-amount-input"
                            />
                          </div>
                          {transferAmount && (
                            <p className="text-gray-400 text-sm">
                              PRC Required: <span className="text-amber-500 font-medium">{(parseFloat(transferAmount) * 100).toLocaleString()} PRC</span>
                            </p>
                          )}
                        </div>

                        {/* Quick Amounts */}
                        <div className="flex flex-wrap gap-2">
                          {[100, 500, 1000, 2000, 5000].map((amt) => (
                            <Button
                              key={amt}
                              variant="outline"
                              size="sm"
                              onClick={() => setTransferAmount(String(amt))}
                              className="border-gray-600 text-gray-300 hover:bg-gray-700"
                            >
                              ₹{amt.toLocaleString()}
                            </Button>
                          ))}
                        </div>

                        {/* Transfer Button */}
                        {!showTransferOTP ? (
                          <Button
                            onClick={() => executeTransfer(false)}
                            disabled={transferLoading || !transferAmount}
                            className="w-full h-14 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-lg"
                            data-testid="execute-transfer-btn"
                          >
                            {transferLoading ? (
                              <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                              <Send className="w-5 h-5 mr-2" />
                            )}
                            Transfer ₹{transferAmount || '0'}
                          </Button>
                        ) : (
                          /* OTP Verification for Transfer */
                          <Card className="bg-gradient-to-br from-green-900/50 to-teal-900/50 border-green-500/30">
                            <CardContent className="pt-4 space-y-4">
                              <div className="flex items-center gap-2 text-green-400">
                                <KeyRound className="w-5 h-5" />
                                <span className="font-semibold">OTP Verification</span>
                              </div>
                              <p className="text-gray-400 text-sm">
                                <Phone className="w-4 h-4 inline mr-1" />
                                OTP पाठवला आहे {customerMobile} वर
                              </p>
                              
                              <Input
                                value={transferOtpValue}
                                onChange={(e) => setTransferOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="6 digit OTP"
                                className="bg-gray-700/50 border-gray-600 text-white text-center text-2xl tracking-widest"
                                maxLength={6}
                                data-testid="transfer-otp-input"
                              />
                              
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => executeTransfer(true)}
                                  disabled={transferLoading || transferOtpValue.length < 4}
                                  className="flex-1 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700"
                                  data-testid="confirm-transfer-otp-btn"
                                >
                                  {transferLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                  )}
                                  Confirm Transfer
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={cancelTransferOTP}
                                  className="border-gray-600 text-gray-300"
                                >
                                  Cancel
                                </Button>
                              </div>
                              
                              <div className="flex justify-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={resendTransferOTP}
                                  disabled={resendTimer > 0 || transferLoading}
                                  className="text-gray-400 hover:text-white"
                                >
                                  <RefreshCw className="w-4 h-4 mr-1" />
                                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Info */}
                        <div className="flex items-center gap-2 text-gray-500 text-sm justify-center">
                          <Shield className="w-4 h-4" />
                          Secure transfer via IMPS • Instant credit
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <CreditCard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">Select a bank account to transfer</p>
                        <p className="text-gray-500 text-sm mt-1">Search customer and select from saved accounts</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Add Recipient Tab */}
                  <TabsContent value="add-recipient" className="mt-0 space-y-4">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-300">Account Holder Name</Label>
                        <Input
                          value={newRecipient.recipient_name}
                          onChange={(e) => setNewRecipient({...newRecipient, recipient_name: e.target.value})}
                          placeholder="Enter full name as per bank"
                          className="bg-gray-700/50 border-gray-600 text-white mt-1"
                          data-testid="recipient-name-input"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-gray-300">Account Number</Label>
                        <Input
                          value={newRecipient.account_number}
                          onChange={(e) => setNewRecipient({...newRecipient, account_number: e.target.value.replace(/\D/g, '')})}
                          placeholder="Enter account number"
                          className="bg-gray-700/50 border-gray-600 text-white mt-1"
                          data-testid="account-number-input"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-gray-300">IFSC Code</Label>
                        <Input
                          value={newRecipient.ifsc}
                          onChange={(e) => setNewRecipient({...newRecipient, ifsc: e.target.value.toUpperCase().slice(0, 11)})}
                          placeholder="e.g., SBIN0001234"
                          className="bg-gray-700/50 border-gray-600 text-white mt-1"
                          data-testid="ifsc-input"
                        />
                      </div>
                      
                      <Button
                        onClick={addRecipient}
                        disabled={loading || !customer?.customer_exists}
                        className="w-full bg-amber-500 hover:bg-amber-600"
                        data-testid="add-recipient-btn"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        Add Bank Account
                      </Button>
                      
                      {!customer?.customer_exists && (
                        <p className="text-yellow-500 text-sm text-center">
                          Please search and verify customer first
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  {/* History Tab */}
                  <TabsContent value="history" className="mt-0">
                    <div className="space-y-3">
                      {transactionsLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                        </div>
                      ) : transactions.length > 0 ? (
                        transactions.map((txn) => (
                          <div 
                            key={txn.transaction_id}
                            className="p-4 bg-gray-700/30 rounded-lg flex justify-between items-center"
                          >
                            <div>
                              <p className="text-white font-medium">₹{txn.amount_inr?.toLocaleString()}</p>
                              <p className="text-gray-400 text-sm">{txn.prc_used?.toLocaleString()} PRC</p>
                              <p className="text-gray-500 text-xs">
                                {new Date(txn.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              {getStatusBadge(txn.status)}
                              {txn.eko_tid && (
                                <p className="text-gray-500 text-xs mt-1">TID: {txn.eko_tid}</p>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-400">No transactions yet</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        </div>

        {/* Conversion Info */}
        <Card className="bg-gray-800/30 border-gray-700">
          <CardContent className="py-4">
            <div className="flex flex-wrap justify-center gap-6 text-center">
              <div>
                <p className="text-amber-500 font-bold text-lg">100 PRC = ₹1</p>
                <p className="text-gray-500 text-sm">Conversion Rate</p>
              </div>
              <div className="border-l border-gray-700 pl-6">
                <p className="text-white font-bold text-lg">₹100</p>
                <p className="text-gray-500 text-sm">Minimum Transfer</p>
              </div>
              <div className="border-l border-gray-700 pl-6">
                <p className="text-white font-bold text-lg">₹5,000</p>
                <p className="text-gray-500 text-sm">Daily Limit</p>
              </div>
              <div className="border-l border-gray-700 pl-6">
                <p className="text-green-500 font-bold text-lg">Instant</p>
                <p className="text-gray-500 text-sm">IMPS Transfer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DMTPage;
