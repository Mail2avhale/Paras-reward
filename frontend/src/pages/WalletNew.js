import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import BankingWallet from '@/pages/BankingWallet';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Wallet as WalletIcon, 
  ArrowDownToLine, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Info,
  TrendingUp,
  Smartphone,
  CreditCard,
  Building2,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { indianBanks, getBankByName, getBankLogo, getBankColor } from '@/data/banksData';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WalletNew = ({ user, onLogout }) => {
  const [walletData, setWalletData] = useState(null);
  const [withdrawals, setWithdrawals] = useState({ cashback_withdrawals: [], profit_withdrawals: [] });
  const [loading, setLoading] = useState(false);
  
  // Cashback withdrawal form
  const [cashbackAmount, setCashbackAmount] = useState('');
  const [cashbackPaymentMode, setCashbackPaymentMode] = useState('phonepe');
  const [cashbackUpiId, setCashbackUpiId] = useState('');
  const [cashbackBankAccount, setCashbackBankAccount] = useState('');
  const [cashbackBankName, setCashbackBankName] = useState('');
  const [cashbackAccountHolderName, setCashbackAccountHolderName] = useState('');
  const [cashbackIfsc, setCashbackIfsc] = useState('');
  
  // Profit withdrawal form
  const [profitAmount, setProfitAmount] = useState('');
  const [profitPaymentMode, setProfitPaymentMode] = useState('phonepe');
  const [profitUpiId, setProfitUpiId] = useState('');
  const [profitBankAccount, setProfitBankAccount] = useState('');
  const [profitBankName, setProfitBankName] = useState('');
  const [profitAccountHolderName, setProfitAccountHolderName] = useState('');
  const [profitIfsc, setProfitIfsc] = useState('');

  useEffect(() => {
    fetchWalletData();
    fetchWithdrawals();
    
    // Auto-load banking details from user profile
    if (user) {
      // Load UPI details - prioritize in order
      const userUpiId = user.upi_id || user.phonepe_number || user.gpay_number || user.paytm_number || '';
      setCashbackUpiId(userUpiId);
      setProfitUpiId(userUpiId);
      
      // Load Bank details
      if (user.bank_account_holder_name) setCashbackAccountHolderName(user.bank_account_holder_name);
      if (user.bank_account_holder_name) setProfitAccountHolderName(user.bank_account_holder_name);
      
      if (user.bank_account_number) setCashbackBankAccount(user.bank_account_number);
      if (user.bank_account_number) setProfitBankAccount(user.bank_account_number);
      
      if (user.bank_name) setCashbackBankName(user.bank_name);
      if (user.bank_name) setProfitBankName(user.bank_name);
      
      if (user.bank_ifsc) setCashbackIfsc(user.bank_ifsc);
      if (user.bank_ifsc) setProfitIfsc(user.bank_ifsc);
    }
  }, [user]);

  const fetchWalletData = async () => {
    try {
      const response = await axios.get(`${API}/wallet/${user.uid}`);
      setWalletData(response.data);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const response = await axios.get(`${API}/wallet/withdrawals/${user.uid}`);
      setWithdrawals(response.data);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  };

  const handleCashbackWithdraw = async () => {
    if (!cashbackAmount || parseFloat(cashbackAmount) < 10) {
      toast.error('Minimum withdrawal amount is ₹10');
      return;
    }

    const isUpiMode = ['phonepe', 'googlepay', 'paytm', 'upi'].includes(cashbackPaymentMode);
    
    if (isUpiMode && !cashbackUpiId) {
      toast.error('Please enter UPI ID or Mobile Number');
      return;
    }

    if (cashbackPaymentMode === 'bank' && (!cashbackBankAccount || !cashbackIfsc || !cashbackAccountHolderName || !cashbackBankName)) {
      toast.error('Please enter complete bank account details including bank name');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/wallet/cashback/withdraw`, {
        user_id: user.uid,
        amount: parseFloat(cashbackAmount),
        payment_mode: cashbackPaymentMode,
        upi_id: isUpiMode ? cashbackUpiId : null,
        bank_account: cashbackPaymentMode === 'bank' ? cashbackBankAccount : null,
        bank_name: cashbackPaymentMode === 'bank' ? cashbackBankName : null,
        account_holder_name: cashbackPaymentMode === 'bank' ? cashbackAccountHolderName : null,
        ifsc_code: cashbackPaymentMode === 'bank' ? cashbackIfsc : null
      });
      
      // Show enhanced success message with new fee breakdown
      const data = response.data;
      toast.success(
        `Withdrawal request submitted! ₹${data.wallet_debited} debited. You'll receive ₹${data.amount_to_receive} (₹${data.withdrawal_fee} processing fee)`,
        { duration: 5000 }
      );
      
      setCashbackAmount('');
      setCashbackUpiId('');
      setCashbackBankAccount('');
      setCashbackAccountHolderName('');
      setCashbackIfsc('');
      fetchWalletData();
      fetchWithdrawals();
    } catch (error) {
      console.error('Error withdrawing:', error);
      toast.error(error.response?.data?.detail || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const handleProfitWithdraw = async () => {
    if (!profitAmount || parseFloat(profitAmount) < 50) {
      toast.error('Minimum withdrawal amount is ₹50');
      return;
    }

    const isUpiMode = ['phonepe', 'googlepay', 'paytm', 'upi'].includes(profitPaymentMode);

    if (isUpiMode && !profitUpiId) {
      toast.error('Please enter UPI ID or Mobile Number');
      return;
    }

    if (profitPaymentMode === 'bank' && (!profitBankAccount || !profitIfsc || !profitAccountHolderName || !profitBankName)) {
      toast.error('Please enter complete bank account details including bank name');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/wallet/profit/withdraw`, {
        user_id: user.uid,
        amount: parseFloat(profitAmount),
        payment_mode: profitPaymentMode,
        upi_id: isUpiMode ? profitUpiId : null,
        bank_account: profitPaymentMode === 'bank' ? profitBankAccount : null,
        bank_name: profitPaymentMode === 'bank' ? profitBankName : null,
        account_holder_name: profitPaymentMode === 'bank' ? profitAccountHolderName : null,
        ifsc_code: profitPaymentMode === 'bank' ? profitIfsc : null
      });
      
      // Show enhanced success message with new fee breakdown
      const data = response.data;
      toast.success(
        `Withdrawal request submitted! ₹${data.wallet_debited} debited. You'll receive ₹${data.amount_to_receive} (₹${data.withdrawal_fee} processing fee)`,
        { duration: 5000 }
      );
      
      setProfitAmount('');
      setProfitUpiId('');
      setProfitBankAccount('');
      setProfitAccountHolderName('');
      setProfitIfsc('');
      fetchWalletData();
      fetchWithdrawals();
    } catch (error) {
      console.error('Error withdrawing:', error);
      toast.error(error.response?.data?.detail || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { 
        icon: Clock, 
        color: 'text-yellow-700 bg-gradient-to-r from-yellow-100 to-yellow-200 border-2 border-yellow-300', 
        text: 'Pending' 
      },
      approved: { 
        icon: CheckCircle2, 
        color: 'text-green-700 bg-gradient-to-r from-green-100 to-emerald-200 border-2 border-green-300', 
        text: 'Completed' 
      },
      rejected: { 
        icon: XCircle, 
        color: 'text-red-700 bg-gradient-to-r from-red-100 to-red-200 border-2 border-red-300', 
        text: 'Rejected' 
      }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm ${config.color}`}>
        <Icon className="h-4 w-4" />
        {config.text}
      </span>
    );
  };

  const getPaymentMethodName = (mode) => {
    const methodNames = {
      'phonepe': 'PhonePe',
      'googlepay': 'Google Pay',
      'paytm': 'Paytm',
      'upi': 'UPI',
      'bank': 'Bank Transfer'
    };
    return methodNames[mode] || mode.toUpperCase();
  };

  const getPaymentMethodIcon = (mode) => {
    const icons = {
      'phonepe': <Smartphone className="h-4 w-4 text-purple-400" />,
      'googlepay': <Smartphone className="h-4 w-4 text-blue-400" />,
      'paytm': <Smartphone className="h-4 w-4 text-indigo-400" />,
      'upi': <CreditCard className="h-4 w-4 text-emerald-400" />,
      'bank': <Building2 className="h-4 w-4 text-amber-400" />
    };
    return icons[mode] || <CreditCard className="h-4 w-4 text-amber-400" />;
  };

  const isStockistOrOutlet = ['master_stockist', 'sub_stockist', 'outlet'].includes(user?.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Elegant Gradient Header */}
        <div className="mb-8">
          <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            My Wallet
          </h1>
          <p className="text-gray-600 text-sm">Manage your finances seamlessly</p>
        </div>

        {/* Wallet Balances - Gradient Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Cashback Wallet - Blue to Purple Gradient */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white p-8 rounded-3xl shadow-xl border-0 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
            {/* Decorative gradient orbs */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
                      <WalletIcon className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium opacity-90">Cashback Wallet</p>
                  </div>
                  <h2 className="text-5xl font-bold tracking-tight">
                    ₹{walletData?.cashback_balance?.toFixed(2) || '0.00'}
                  </h2>
                </div>
              </div>
              
              {/* Glass separator */}
              <div className="h-px bg-white/20 mb-4"></div>
              
              {walletData?.pending_lien > 0 && (
                <div className="mb-3 p-3 bg-red-500/20 backdrop-blur-sm border border-red-300/30 rounded-xl">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>Maintenance Lien: ₹{walletData.pending_lien?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              )}
              
              {walletData?.maintenance_due && (
                <div className="mb-2 p-2 bg-yellow-400/20 backdrop-blur-sm border border-yellow-300/30 rounded-lg text-xs">
                  Maintenance fee (₹99) due now
                </div>
              )}
              
              {walletData?.days_until_maintenance !== null && walletData?.days_until_maintenance > 0 && (
                <div className="text-xs opacity-80">
                  Next maintenance in {walletData.days_until_maintenance} days
                </div>
              )}
            </div>
          </Card>

          {/* Profit Wallet - Purple to Pink Gradient */}
          {isStockistOrOutlet && (
            <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 text-white p-8 rounded-3xl shadow-xl border-0 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              {/* Decorative gradient orbs */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-rose-400/20 rounded-full blur-3xl"></div>
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
                        <TrendingUp className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-medium opacity-90">Profit Wallet</p>
                    </div>
                    <h2 className="text-5xl font-bold tracking-tight">
                      ₹{walletData?.profit_balance?.toFixed(2) || '0.00'}
                    </h2>
                  </div>
                </div>
                
                {/* Glass separator */}
                <div className="h-px bg-white/20 mb-4"></div>
                
                <p className="text-sm opacity-80">Earnings from delivery charges & commissions</p>
              </div>
            </Card>
          )}
        </div>

        {/* Tabs for Withdrawal and History - Gradient Style */}
        <Tabs defaultValue="cashback-withdraw" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-white/80 backdrop-blur-sm border border-gray-200 p-1.5 rounded-2xl shadow-lg">
            <TabsTrigger 
              value="transactions"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 font-medium transition-all rounded-xl"
            >
              <FileText className="w-4 h-4 mr-2" />
              Transactions
            </TabsTrigger>
            <TabsTrigger 
              value="cashback-withdraw"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 font-medium transition-all rounded-xl"
            >
              Cashback Withdraw
            </TabsTrigger>
            {isStockistOrOutlet && (
              <TabsTrigger 
                value="profit-withdraw"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 font-medium transition-all rounded-xl"
              >
                Profit Withdraw
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="cashback-history"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 font-medium transition-all rounded-xl"
            >
              Cashback History
            </TabsTrigger>
            {isStockistOrOutlet && (
              <TabsTrigger 
                value="profit-history"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 font-medium transition-all rounded-xl"
              >
                Profit History
              </TabsTrigger>
            )}
          </TabsList>

          {/* Transaction History Tab */}
          <TabsContent value="transactions" className="mt-6">
            <BankingWallet user={user} />
          </TabsContent>

          {/* Cashback Withdrawal */}
          <TabsContent value="cashback-withdraw">
            <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 p-8 rounded-3xl shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-3 rounded-2xl">
                  <ArrowDownToLine className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Withdraw Cashback
                </h3>
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-5 mb-6">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-500 p-2 rounded-lg">
                    <Info className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-sm text-gray-700">
                    <p className="font-semibold mb-2 text-blue-900">Withdrawal Guidelines:</p>
                    <ul className="space-y-1.5 text-xs text-gray-600">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        Minimum withdrawal: ₹10
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        Withdrawal fee: ₹5 per transaction
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        KYC verification required
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        Processing time: 1-3 business days
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        Cannot withdraw if pending maintenance lien exists
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-3 text-gray-700">Amount (₹)</label>
                  <Input
                    type="number"
                    placeholder="Minimum ₹10"
                    value={cashbackAmount}
                    onChange={(e) => setCashbackAmount(e.target.value)}
                    className="border-2 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl text-lg"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    You'll receive: <span className="font-semibold text-blue-600">₹{cashbackAmount ? (parseFloat(cashbackAmount) - 5).toFixed(2) : '0.00'}</span> (after ₹5 fee)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Payment Mode</label>
                  <Select value={cashbackPaymentMode} onValueChange={setCashbackPaymentMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phonepe">PhonePe</SelectItem>
                      <SelectItem value="googlepay">Google Pay</SelectItem>
                      <SelectItem value="paytm">Paytm</SelectItem>
                      <SelectItem value="upi">Other UPI</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {['phonepe', 'googlepay', 'paytm', 'upi'].includes(cashbackPaymentMode) && (
                  <div>
                    <label className="block text-sm font-medium mb-2">UPI ID or Mobile Number</label>
                    <Input
                      placeholder="No payment details found. Update in Profile"
                      value={cashbackUpiId}
                      readOnly
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-blue-600 mt-1">
                      ℹ️ Payment details are locked. Update in your <a href="/profile" className="underline">Profile → Banking & Payment</a>
                    </p>
                  </div>
                )}

                {cashbackPaymentMode === 'bank' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Account Holder Name</label>
                      <Input
                        placeholder="No bank details found. Update in Profile"
                        value={cashbackAccountHolderName}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Bank Account Number</label>
                      <Input
                        placeholder="No bank details found. Update in Profile"
                        value={cashbackBankAccount}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Bank Name</label>
                      <Input
                        placeholder="No bank details found. Update in Profile"
                        value={cashbackBankName}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">IFSC Code</label>
                      <Input
                        placeholder="No bank details found. Update in Profile"
                        value={cashbackIfsc}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                    <p className="text-xs text-blue-600">
                      ℹ️ Bank details are locked. Update in your <a href="/profile" className="underline">Profile → Banking & Payment</a>
                    </p>
                  </>
                )}

                <Button
                  onClick={handleCashbackWithdraw}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <ArrowDownToLine className="mr-2 h-5 w-5" />
                  {loading ? 'Processing...' : 'Request Withdrawal'}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Profit Withdrawal */}
          {isStockistOrOutlet && (
            <TabsContent value="profit-withdraw">
              <Card className="p-6">
                <h3 className="text-2xl font-bold mb-4">Withdraw from Profit Wallet</h3>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div className="text-sm text-purple-900">
                      <p className="font-semibold mb-1">Withdrawal Guidelines:</p>
                      <ul className="space-y-1 text-xs">
                        <li>• Minimum withdrawal: ₹50</li>
                        <li>• Withdrawal fee: ₹5 per transaction</li>
                        <li>• Processing time: 1-3 business days</li>
                        <li>• Admin approval required</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Amount (₹)</label>
                    <Input
                      type="number"
                      placeholder="Minimum ₹50"
                      value={profitAmount}
                      onChange={(e) => setProfitAmount(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      You'll receive: ₹{profitAmount ? (parseFloat(profitAmount) - 5).toFixed(2) : '0.00'} (after ₹5 fee)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Payment Mode</label>
                    <Select value={profitPaymentMode} onValueChange={setProfitPaymentMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phonepe">PhonePe</SelectItem>
                        <SelectItem value="googlepay">Google Pay</SelectItem>
                        <SelectItem value="paytm">Paytm</SelectItem>
                        <SelectItem value="upi">Other UPI</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {['phonepe', 'googlepay', 'paytm', 'upi'].includes(profitPaymentMode) && (
                    <div>
                      <label className="block text-sm font-medium mb-2">UPI ID or Mobile Number</label>
                      <Input
                        placeholder="No payment details found. Update in Profile"
                        value={profitUpiId}
                        readOnly
                        className="bg-gray-50"
                      />
                      <p className="text-xs text-blue-600 mt-1">
                        ℹ️ Payment details are locked. Update in your <a href="/profile" className="underline">Profile → Banking & Payment</a>
                      </p>
                    </div>
                  )}

                  {profitPaymentMode === 'bank' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">Account Holder Name</label>
                        <Input
                          placeholder="No bank details found. Update in Profile"
                          value={profitAccountHolderName}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Bank Account Number</label>
                        <Input
                          placeholder="No bank details found. Update in Profile"
                          value={profitBankAccount}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Bank Name</label>
                        <Input
                          placeholder="No bank details found. Update in Profile"
                          value={profitBankName}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">IFSC Code</label>
                        <Input
                          placeholder="No bank details found. Update in Profile"
                          value={profitIfsc}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                      <p className="text-xs text-blue-600">
                        ℹ️ Bank details are locked. Update in your <a href="/profile" className="underline">Profile → Banking & Payment</a>
                      </p>
                    </>
                  )}

                  <Button
                    onClick={handleProfitWithdraw}
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    <ArrowDownToLine className="mr-2 h-5 w-5" />
                    {loading ? 'Processing...' : 'Request Withdrawal'}
                  </Button>
                </div>
              </Card>
            </TabsContent>
          )}

          {/* Cashback Withdrawal History */}
          <TabsContent value="cashback-history">
            <Card className="bg-slate-800/50 border-2 border-amber-500/20 backdrop-blur-sm p-8 rounded-xl">
              <h3 className="text-3xl font-serif font-bold text-amber-300 mb-6 border-b border-amber-500/20 pb-4">
                Cashback Withdrawal History
              </h3>
              
              {withdrawals.cashback_withdrawals.length === 0 ? (
                <div className="text-center py-16 text-amber-200/40">
                  <div className="bg-amber-900/20 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center border-2 border-amber-500/20">
                    <WalletIcon className="h-12 w-12" />
                  </div>
                  <p className="font-light text-lg">No withdrawal history yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {withdrawals.cashback_withdrawals.map((withdrawal) => (
                    <Card key={withdrawal.withdrawal_id} className="bg-slate-900/50 border border-amber-500/20 p-6 rounded-lg hover:border-amber-500/40 transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl font-serif font-bold text-amber-300">
                              ₹{withdrawal.amount_requested?.toFixed(2) || '0.00'}
                            </span>
                            {getStatusBadge(withdrawal.status)}
                          </div>
                          <div className="text-sm text-amber-200/70 space-y-1.5 font-light">
                            <p className="flex items-center gap-2">
                              <span className="text-amber-400/80">Net Amount:</span> 
                              <span className="font-semibold text-amber-300">₹{withdrawal.amount_to_receive?.toFixed(2) || '0.00'}</span>
                              <span className="text-amber-400/60">• Fee: ₹{withdrawal.fee?.toFixed(2) || '0.00'}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              {getPaymentMethodIcon(withdrawal.payment_mode)}
                              <span>Payment: {getPaymentMethodName(withdrawal.payment_mode)} - {withdrawal.upi_id || withdrawal.bank_account}</span>
                            </p>
                            {withdrawal.account_holder_name && (
                              <p>Account Holder: {withdrawal.account_holder_name}</p>
                            )}
                            {withdrawal.bank_name && (
                              <p className="flex items-center gap-2">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-sm ${getBankColor(withdrawal.bank_name)}`}>
                                  {getBankLogo(withdrawal.bank_name)}
                                </span>
                                <span>Bank: {getBankByName(withdrawal.bank_name)?.name || withdrawal.bank_name}</span>
                              </p>
                            )}
                            <p>Requested: {new Date(withdrawal.created_at).toLocaleString()}</p>
                            {withdrawal.utr_number && (
                              <p className="text-green-600 font-medium">UTR: {withdrawal.utr_number}</p>
                            )}
                            {withdrawal.admin_notes && (
                              <p className="text-sm italic">Note: {withdrawal.admin_notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Profit Withdrawal History */}
          {isStockistOrOutlet && (
            <TabsContent value="profit-history">
              <Card className="p-6">
                <h3 className="text-2xl font-bold mb-4">Profit Withdrawal History</h3>
                
                {withdrawals.profit_withdrawals.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p>No withdrawal history yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {withdrawals.profit_withdrawals.map((withdrawal) => (
                      <Card key={withdrawal.withdrawal_id} className="p-4 border">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-lg font-bold">₹{withdrawal.amount_requested?.toFixed(2) || '0.00'}</span>
                              {getStatusBadge(withdrawal.status)}
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>Net Amount: ₹{withdrawal.amount_to_receive?.toFixed(2) || '0.00'} (Fee: ₹{withdrawal.fee?.toFixed(2) || '0.00'})</p>
                              <p className="flex items-center gap-2">
                                {getPaymentMethodIcon(withdrawal.payment_mode)}
                                <span>Payment: {getPaymentMethodName(withdrawal.payment_mode)} - {withdrawal.upi_id || withdrawal.bank_account}</span>
                              </p>
                              {withdrawal.account_holder_name && (
                                <p>Account Holder: {withdrawal.account_holder_name}</p>
                              )}
                              {withdrawal.bank_name && (
                                <p className="flex items-center gap-2">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-sm ${getBankColor(withdrawal.bank_name)}`}>
                                    {getBankLogo(withdrawal.bank_name)}
                                  </span>
                                  <span>Bank: {getBankByName(withdrawal.bank_name)?.name || withdrawal.bank_name}</span>
                                </p>
                              )}
                              <p>Requested: {new Date(withdrawal.created_at).toLocaleString()}</p>
                              {withdrawal.utr_number && (
                                <p className="text-green-600 font-medium">UTR: {withdrawal.utr_number}</p>
                              )}
                              {withdrawal.admin_notes && (
                                <p className="text-sm italic">Note: {withdrawal.admin_notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default WalletNew;
