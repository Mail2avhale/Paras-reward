import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Banknote, Building2, CreditCard, CheckCircle, XCircle, Clock, AlertCircle, ArrowRight, Loader2, History, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function BankTransferPage({ user }) {
  // Config
  const [config, setConfig] = useState(null);
  
  // Form state
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [amount, setAmount] = useState('');
  
  // Fees calculation
  const [fees, setFees] = useState(null);
  
  // Status
  const [verifyingIfsc, setVerifyingIfsc] = useState(false);
  const [ifscVerified, setIfscVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // History
  const [requests, setRequests] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Load config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch(`${API}/api/bank-transfer/config`);
        const data = await res.json();
        setConfig(data);
      } catch (err) {
        console.error('Failed to load config:', err);
      }
    };
    loadConfig();
  }, []);
  
  // Load user's requests
  const loadHistory = useCallback(async () => {
    if (!user?.uid) return;
    
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API}/api/bank-transfer/my-requests/${user.uid}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [user?.uid]);
  
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);
  
  // Verify IFSC
  const verifyIfsc = async () => {
    if (!ifscCode || ifscCode.length !== 11) {
      setError('IFSC code must be 11 characters');
      return;
    }
    
    setVerifyingIfsc(true);
    setError('');
    
    try {
      const res = await fetch(`${API}/api/bank-transfer/verify-ifsc?ifsc=${ifscCode}`);
      const data = await res.json();
      
      if (data.success) {
        setBankName(data.bank_details?.bank_name || 'Unknown Bank');
        setIfscVerified(true);
        toast.success('IFSC verified successfully');
      } else {
        setError(data.detail || 'Invalid IFSC code');
        setIfscVerified(false);
      }
    } catch (err) {
      setError('Failed to verify IFSC');
      setIfscVerified(false);
    } finally {
      setVerifyingIfsc(false);
    }
  };
  
  // Calculate fees when amount changes
  useEffect(() => {
    if (!amount || !config) {
      setFees(null);
      return;
    }
    
    const amountNum = parseInt(amount);
    if (isNaN(amountNum) || amountNum < config.min_withdrawal || amountNum > config.max_withdrawal) {
      setFees(null);
      return;
    }
    
    const adminFee = Math.floor(amountNum * config.admin_fee_percent / 100);
    const totalInr = amountNum + adminFee + config.transaction_fee;
    const totalPrc = totalInr * config.prc_rate;
    
    setFees({
      withdrawal_amount: amountNum,
      admin_fee: adminFee,
      transaction_fee: config.transaction_fee,
      total_inr: totalInr,
      total_prc: totalPrc,
      user_receives: amountNum
    });
  }, [amount, config]);
  
  // Submit request
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validations
    if (!accountName.trim()) {
      setError('Account holder name is required');
      return;
    }
    if (!accountNumber || accountNumber.length < 9) {
      setError('Valid account number is required');
      return;
    }
    if (accountNumber !== confirmAccountNumber) {
      setError('Account numbers do not match');
      return;
    }
    if (!ifscVerified) {
      setError('Please verify IFSC code first');
      return;
    }
    if (!fees) {
      setError('Please enter a valid amount');
      return;
    }
    if (fees.total_prc > (user?.prc_balance || 0)) {
      setError(`Insufficient PRC balance. Required: ${fees.total_prc.toLocaleString()} PRC`);
      return;
    }
    
    setSubmitting(true);
    
    try {
      const res = await fetch(`${API}/api/bank-transfer/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          amount: fees.withdrawal_amount,
          bank_details: {
            account_holder_name: accountName.trim(),
            account_number: accountNumber,
            ifsc_code: ifscCode.toUpperCase()
          }
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success('Bank transfer request submitted!');
        // Reset form
        setAccountName('');
        setAccountNumber('');
        setConfirmAccountNumber('');
        setIfscCode('');
        setBankName('');
        setAmount('');
        setIfscVerified(false);
        setFees(null);
        // Reload history
        loadHistory();
      } else {
        setError(data.detail || 'Failed to submit request');
      }
    } catch (err) {
      setError('Server error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning" className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'paid':
        return <Badge variant="success" className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">Bank Transfer</h1>
        <p className="text-gray-400">Convert PRC to INR and transfer to your bank account</p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Badge variant="outline" className="bg-primary/10">1 INR = {config.prc_rate} PRC</Badge>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400">Min ₹{config.min_withdrawal}</Badge>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400">Max ₹{config.max_withdrawal.toLocaleString()}</Badge>
        </div>
      </div>
      
      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-primary/20 to-purple-600/20 border-primary/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Your PRC Balance</p>
            <p className="text-2xl font-bold text-white">{(user?.prc_balance || 0).toLocaleString()} PRC</p>
            <p className="text-sm text-gray-500">≈ ₹{((user?.prc_balance || 0) / config.prc_rate).toLocaleString()}</p>
          </div>
          <Banknote className="w-12 h-12 text-primary opacity-50" />
        </CardContent>
      </Card>
      
      <Tabs defaultValue="transfer" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transfer" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            New Transfer
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>
        
        {/* Transfer Form */}
        <TabsContent value="transfer">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Bank Details
              </CardTitle>
              <CardDescription>Enter your bank account details for transfer</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                {/* Account Holder Name */}
                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Holder Name</Label>
                  <Input
                    id="accountName"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Enter name as per bank records"
                    className="bg-gray-800/50 border-gray-700"
                    data-testid="account-name-input"
                  />
                </div>
                
                {/* Account Number */}
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter account number"
                    className="bg-gray-800/50 border-gray-700"
                    maxLength={18}
                    data-testid="account-number-input"
                  />
                </div>
                
                {/* Confirm Account Number */}
                <div className="space-y-2">
                  <Label htmlFor="confirmAccountNumber">Confirm Account Number</Label>
                  <Input
                    id="confirmAccountNumber"
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Re-enter account number"
                    className="bg-gray-800/50 border-gray-700"
                    maxLength={18}
                    data-testid="confirm-account-input"
                  />
                  {accountNumber && confirmAccountNumber && accountNumber !== confirmAccountNumber && (
                    <p className="text-xs text-red-400">Account numbers do not match</p>
                  )}
                </div>
                
                {/* IFSC Code */}
                <div className="space-y-2">
                  <Label htmlFor="ifscCode">IFSC Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="ifscCode"
                      value={ifscCode}
                      onChange={(e) => {
                        setIfscCode(e.target.value.toUpperCase());
                        setIfscVerified(false);
                        setBankName('');
                      }}
                      placeholder="e.g., HDFC0001234"
                      className="bg-gray-800/50 border-gray-700 uppercase"
                      maxLength={11}
                      data-testid="ifsc-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={verifyIfsc}
                      disabled={verifyingIfsc || ifscCode.length !== 11}
                      className="shrink-0"
                      data-testid="verify-ifsc-btn"
                    >
                      {verifyingIfsc ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                    </Button>
                  </div>
                  {ifscVerified && bankName && (
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      {bankName}
                    </div>
                  )}
                </div>
                
                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Withdrawal Amount (₹)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Min ₹${config.min_withdrawal} - Max ₹${config.max_withdrawal.toLocaleString()}`}
                    className="bg-gray-800/50 border-gray-700 text-lg"
                    min={config.min_withdrawal}
                    max={config.max_withdrawal}
                    data-testid="amount-input"
                  />
                </div>
                
                {/* Fee Breakdown */}
                {fees && (
                  <Card className="bg-gray-800/30 border-gray-700">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Withdrawal Amount</span>
                        <span className="text-white">₹{fees.withdrawal_amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Transaction Fee</span>
                        <span className="text-white">₹{fees.transaction_fee}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Admin Fee ({config.admin_fee_percent}%)</span>
                        <span className="text-white">₹{fees.admin_fee}</span>
                      </div>
                      <hr className="border-gray-700" />
                      <div className="flex justify-between font-medium">
                        <span className="text-gray-300">Total</span>
                        <span className="text-white">₹{fees.total_inr.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-primary">PRC Required</span>
                        <span className="text-primary">{fees.total_prc.toLocaleString()} PRC</span>
                      </div>
                      <div className="flex justify-between text-sm text-green-400">
                        <span>You will receive</span>
                        <span>₹{fees.user_receives.toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-12 text-lg"
                  disabled={submitting || !ifscVerified || !fees || fees.total_prc > (user?.prc_balance || 0)}
                  data-testid="submit-transfer-btn"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="w-5 h-5 mr-2" />
                  )}
                  {submitting ? 'Processing...' : 'Submit Request'}
                </Button>
                
                <p className="text-xs text-center text-gray-500">
                  Processing time: 24-48 hours. You will be notified once payment is complete.
                </p>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* History Tab */}
        <TabsContent value="history">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Transfer History</CardTitle>
                <CardDescription>Your recent bank transfer requests</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={loadHistory} disabled={loadingHistory}>
                <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No transfer requests yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((req) => (
                    <div key={req.request_id} className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-white">₹{req.withdrawal_amount?.toLocaleString()}</p>
                          <p className="text-sm text-gray-400">{req.bank_name} - {req.account_number_masked || `XXXX${req.account_number?.slice(-4)}`}</p>
                          <p className="text-xs text-gray-500">{new Date(req.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(req.status)}
                          <p className="text-xs text-gray-500 mt-1">{req.prc_deducted?.toLocaleString()} PRC</p>
                        </div>
                      </div>
                      {req.status === 'paid' && req.utr_number && (
                        <p className="text-xs text-green-400 mt-2">UTR: {req.utr_number}</p>
                      )}
                      {req.status === 'failed' && req.admin_remark && (
                        <p className="text-xs text-red-400 mt-2">Reason: {req.admin_remark}</p>
                      )}
                      {req.status === 'failed' && req.prc_refunded && (
                        <p className="text-xs text-yellow-400 mt-1">PRC Refunded</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
