import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DMTPage = () => {
  const { user } = useAuth();
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
  
  // Transactions State
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Load wallet on mount
  useEffect(() => {
    if (user?.uid) {
      fetchWallet();
      fetchTransactions();
    }
  }, [user]);

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
      toast.error('Please enter valid 10 digit mobile number');
      return;
    }

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
          toast.success(`Customer found: ${data.data.name}`);
          fetchRecipients(customerMobile);
        } else {
          toast.info('Customer not registered. Registration required.');
        }
      } else {
        toast.error(data.user_message || data.message);
      }
    } catch (error) {
      toast.error('Failed to search customer');
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
  const executeTransfer = async () => {
    if (!selectedRecipient) {
      toast.error('Please select a recipient');
      return;
    }

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
        toast.success(data.data.message || 'Transfer successful!');
        fetchWallet();
        fetchTransactions();
        setTransferAmount('');
      } else {
        toast.error(data.user_message || data.message);
        if (data.prc_refunded) {
          fetchWallet();
        }
      }
    } catch (error) {
      toast.error('Transfer failed. Please try again.');
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
                      Customer not registered. Registration required.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recipients */}
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
                        <Button
                          onClick={executeTransfer}
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
