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
import notifications from '@/utils/notifications';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WalletNew = ({ user, onLogout }) => {
  const [walletData, setWalletData] = useState(null);
  const [Redemptions, setRedemptions] = useState({ cashback_Redemptions: [], prc_Redemptions: [] });
  const [loading, setLoading] = useState(false);
  
  // Determine minimum Redemption based on membership
  // Support both legacy (membership_type: vip) and new (subscription_plan) models
  const isPaidUser = user?.membership_type === 'vip' || 
    ['startup', 'growth', 'elite'].includes(user?.subscription_plan?.toLowerCase());
  const isFreeUser = !isPaidUser;
  const minCashbackRedemption = isFreeUser ? 1000 : 10;
  const minprcRedemption = 50;
  
  // Cashback Redemption form
  const [cashbackAmount, setCashbackAmount] = useState('');
  const [cashbackPaymentMode, setCashbackPaymentMode] = useState('phonepe');
  const [cashbackUpiId, setCashbackUpiId] = useState('');
  const [cashbackBankAccount, setCashbackBankAccount] = useState('');
  const [cashbackBankName, setCashbackBankName] = useState('');
  const [cashbackAccountHolderName, setCashbackAccountHolderName] = useState('');
  const [cashbackIfsc, setCashbackIfsc] = useState('');
  
  // prc Redemption form
  const [prcAmount, setprcAmount] = useState('');
  const [prcPaymentMode, setprcPaymentMode] = useState('phonepe');
  const [prcUpiId, setprcUpiId] = useState('');
  const [prcBankAccount, setprcBankAccount] = useState('');
  const [prcBankName, setprcBankName] = useState('');
  const [prcAccountHolderName, setprcAccountHolderName] = useState('');
  const [prcIfsc, setprcIfsc] = useState('');

  useEffect(() => {
    fetchWalletData();
    fetchRedemptions();
    
    // Auto-load banking details from user profile
    if (user) {
      // Load UPI details - prioritize in order
      const userUpiId = user.upi_id || user.phonepe_number || user.gpay_number || user.paytm_number || '';
      setCashbackUpiId(userUpiId);
      setprcUpiId(userUpiId);
      
      // Load Bank details
      if (user.bank_account_holder_name) setCashbackAccountHolderName(user.bank_account_holder_name);
      if (user.bank_account_holder_name) setprcAccountHolderName(user.bank_account_holder_name);
      
      if (user.bank_account_number) setCashbackBankAccount(user.bank_account_number);
      if (user.bank_account_number) setprcBankAccount(user.bank_account_number);
      
      if (user.bank_name) setCashbackBankName(user.bank_name);
      if (user.bank_name) setprcBankName(user.bank_name);
      
      if (user.bank_ifsc) setCashbackIfsc(user.bank_ifsc);
      if (user.bank_ifsc) setprcIfsc(user.bank_ifsc);
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

  const fetchRedemptions = async () => {
    try {
      const response = await axios.get(`${API}/wallet/Redemptions/${user.uid}`);
      setRedemptions(response.data);
    } catch (error) {
      console.error('Error fetching Redemptions:', error);
    }
  };

  const handleCashbackRedeem = async () => {
    if (!cashbackAmount || parseFloat(cashbackAmount) < minCashbackRedemption) {
      notifications.warning(
        'Minimum Amount Required',
        `Minimum Redemption is ₹${minCashbackRedemption}. ${isFreeUser ? 'Upgrade to VIP membership for lower minimum Redemption of just ₹10!' : ''}`
      );
      return;
    }

    const isUpiMode = ['phonepe', 'googlepay', 'paytm', 'upi'].includes(cashbackPaymentMode);
    
    if (isUpiMode && !cashbackUpiId) {
      notifications.error('Payment Details Required', 'Please enter your UPI ID or Mobile Number to continue.');
      return;
    }

    if (cashbackPaymentMode === 'bank' && (!cashbackBankAccount || !cashbackIfsc || !cashbackAccountHolderName || !cashbackBankName)) {
      notifications.error('Bank Details Required', 'Please enter complete bank account details including account number, IFSC code, account holder name, and bank name.');
      return;
    }

    setLoading(true);
    const loadingId = notifications.loading('Processing Redemption', 'Please wait while we process your Redemption request...');
    
    try {
      const response = await axios.post(`${API}/wallet/cashback/Redeem`, {
        user_id: user.uid,
        amount: parseFloat(cashbackAmount),
        payment_mode: cashbackPaymentMode,
        upi_id: isUpiMode ? cashbackUpiId : null,
        bank_account: cashbackPaymentMode === 'bank' ? cashbackBankAccount : null,
        bank_name: cashbackPaymentMode === 'bank' ? cashbackBankName : null,
        account_holder_name: cashbackPaymentMode === 'bank' ? cashbackAccountHolderName : null,
        ifsc_code: cashbackPaymentMode === 'bank' ? cashbackIfsc : null
      });
      
      toast.dismiss(loadingId);
      
      const data = response.data;
      notifications.celebrate(
        '💰 Redemption Request Submitted!',
        `Your Redemption of ₹${data.wallet_debited} has been initiated. You'll receive ₹${data.amount_to_receive} after deducting ₹${data.Redemption_fee} processing fee. Funds will be transferred within 1-3 business days.`
      );
      
      setCashbackAmount('');
      setCashbackUpiId('');
      setCashbackBankAccount('');
      setCashbackAccountHolderName('');
      setCashbackIfsc('');
      fetchWalletData();
      fetchRedemptions();
    } catch (error) {
      console.error('Error Redeeming:', error);
      toast.dismiss(loadingId);
      
      notifications.error(
        'Redemption Failed',
        error.response?.data?.detail || 'Unable to process Redemption. Please check your details and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleprcRedeem = async () => {
    if (!prcAmount || parseFloat(prcAmount) < 50) {
      toast.error('Minimum Redemption amount is ₹50');
      return;
    }

    const isUpiMode = ['phonepe', 'googlepay', 'paytm', 'upi'].includes(prcPaymentMode);

    if (isUpiMode && !prcUpiId) {
      toast.error('Please enter UPI ID or Mobile Number');
      return;
    }

    if (prcPaymentMode === 'bank' && (!prcBankAccount || !prcIfsc || !prcAccountHolderName || !prcBankName)) {
      toast.error('Please enter complete bank account details including bank name');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/wallet/prc/Redeem`, {
        user_id: user.uid,
        amount: parseFloat(prcAmount),
        payment_mode: prcPaymentMode,
        upi_id: isUpiMode ? prcUpiId : null,
        bank_account: prcPaymentMode === 'bank' ? prcBankAccount : null,
        bank_name: prcPaymentMode === 'bank' ? prcBankName : null,
        account_holder_name: prcPaymentMode === 'bank' ? prcAccountHolderName : null,
        ifsc_code: prcPaymentMode === 'bank' ? prcIfsc : null
      });
      
      // Show enhanced success message with new fee breakdown
      const data = response.data;
      toast.success(
        `Redemption request submitted! ₹${data.wallet_debited} debited. You'll receive ₹${data.amount_to_receive} (₹${data.Redemption_fee} processing fee)`,
        { duration: 5000 }
      );
      
      setprcAmount('');
      setprcUpiId('');
      setprcBankAccount('');
      setprcAccountHolderName('');
      setprcIfsc('');
      fetchWalletData();
      fetchRedemptions();
    } catch (error) {
      console.error('Error Redeeming:', error);
      toast.error(error.response?.data?.detail || 'Redemption failed');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-20 pb-24">
      
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

          {/* prc Wallet - Purple to Pink Gradient */}
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
                      <p className="text-sm font-medium opacity-90">prc Wallet</p>
                    </div>
                    <h2 className="text-5xl font-bold tracking-tight">
                      ₹{walletData?.prc_balance?.toFixed(2) || '0.00'}
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

        {/* Tabs for Redemption and History - Gradient Style */}
        <Tabs defaultValue="cashback-Redeem" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-white/80 backdrop-blur-sm border border-gray-200 p-1.5 rounded-2xl shadow-lg">
            <TabsTrigger 
              value="transactions"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 font-medium transition-all rounded-xl"
            >
              <FileText className="w-4 h-4 mr-2" />
              Transactions
            </TabsTrigger>
            <TabsTrigger 
              value="cashback-Redeem"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 font-medium transition-all rounded-xl"
            >
              Cashback Redeem
            </TabsTrigger>
            {isStockistOrOutlet && (
              <TabsTrigger 
                value="prc-Redeem"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 font-medium transition-all rounded-xl"
              >
                prc Redeem
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
                value="prc-history"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 font-medium transition-all rounded-xl"
              >
                prc History
              </TabsTrigger>
            )}
          </TabsList>

          {/* Transaction History Tab */}
          <TabsContent value="transactions" className="mt-6">
            <BankingWallet user={user} walletBalance={walletData?.cashback_balance || 0} />
          </TabsContent>

          {/* Cashback Redemption */}
          <TabsContent value="cashback-Redeem">
            <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 p-8 rounded-3xl shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-3 rounded-2xl">
                  <ArrowDownToLine className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Redeem Cashback
                </h3>
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-5 mb-6">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-500 p-2 rounded-lg">
                    <Info className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-sm text-gray-700">
                    <p className="font-semibold mb-2 text-blue-900">Redemption Guidelines:</p>
                    <ul className="space-y-1.5 text-xs text-gray-600">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        Minimum Redemption: ₹{minCashbackRedemption}
                        {isFreeUser && <span className="text-orange-600 font-semibold ml-1">(Free User - VIP: ₹10)</span>}
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        Redemption fee: ₹5 per transaction
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
                        Cannot Redeem if pending maintenance lien exists
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
                    placeholder={`Minimum ₹${minCashbackRedemption}`}
                    value={cashbackAmount}
                    onChange={(e) => setCashbackAmount(e.target.value)}
                    className="border-2 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl text-lg"
                  />
                  {isFreeUser && (
                    <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-xs text-orange-700">
                        ⚠️ <strong>Free User:</strong> Minimum ₹1000 Redemption. Upgrade to VIP for ₹10 minimum!
                      </p>
                    </div>
                  )}
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
                  onClick={handleCashbackRedeem}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <ArrowDownToLine className="mr-2 h-5 w-5" />
                  {loading ? 'Processing...' : 'Request Redemption'}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* prc Redemption */}
          {isStockistOrOutlet && (
            <TabsContent value="prc-Redeem">
              <Card className="p-6">
                <h3 className="text-2xl font-bold mb-4">Redeem from prc Wallet</h3>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div className="text-sm text-purple-900">
                      <p className="font-semibold mb-1">Redemption Guidelines:</p>
                      <ul className="space-y-1 text-xs">
                        <li>• Minimum Redemption: ₹50</li>
                        <li>• Redemption fee: ₹5 per transaction</li>
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
                      value={prcAmount}
                      onChange={(e) => setprcAmount(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      You'll receive: ₹{prcAmount ? (parseFloat(prcAmount) - 5).toFixed(2) : '0.00'} (after ₹5 fee)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Payment Mode</label>
                    <Select value={prcPaymentMode} onValueChange={setprcPaymentMode}>
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

                  {['phonepe', 'googlepay', 'paytm', 'upi'].includes(prcPaymentMode) && (
                    <div>
                      <label className="block text-sm font-medium mb-2">UPI ID or Mobile Number</label>
                      <Input
                        placeholder="No payment details found. Update in Profile"
                        value={prcUpiId}
                        readOnly
                        className="bg-gray-50"
                      />
                      <p className="text-xs text-blue-600 mt-1">
                        ℹ️ Payment details are locked. Update in your <a href="/profile" className="underline">Profile → Banking & Payment</a>
                      </p>
                    </div>
                  )}

                  {prcPaymentMode === 'bank' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">Account Holder Name</label>
                        <Input
                          placeholder="No bank details found. Update in Profile"
                          value={prcAccountHolderName}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Bank Account Number</label>
                        <Input
                          placeholder="No bank details found. Update in Profile"
                          value={prcBankAccount}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Bank Name</label>
                        <Input
                          placeholder="No bank details found. Update in Profile"
                          value={prcBankName}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">IFSC Code</label>
                        <Input
                          placeholder="No bank details found. Update in Profile"
                          value={prcIfsc}
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
                    onClick={handleprcRedeem}
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    <ArrowDownToLine className="mr-2 h-5 w-5" />
                    {loading ? 'Processing...' : 'Request Redemption'}
                  </Button>
                </div>
              </Card>
            </TabsContent>
          )}

          {/* Cashback Redemption History */}
          <TabsContent value="cashback-history">
            <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 p-8 rounded-3xl shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-3 rounded-2xl">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Redemption History
                </h3>
              </div>
              
              {Redemptions.cashback_Redemptions.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center border-4 border-white shadow-lg">
                    <WalletIcon className="h-12 w-12 text-blue-600" />
                  </div>
                  <p className="text-gray-500 text-lg">No Redemption history yet</p>
                  <p className="text-gray-400 text-sm mt-2">Your Redemptions will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Redemptions.cashback_Redemptions.map((Redemption) => (
                    <Card key={Redemption.Redemption_id} className="bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 p-6 rounded-2xl hover:border-blue-300 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                              ₹{Redemption.amount_requested?.toFixed(2) || '0.00'}
                            </span>
                            {getStatusBadge(Redemption.status)}
                          </div>
                          <div className="text-sm text-gray-600 space-y-2">
                            <p className="flex items-center gap-2">
                              <span className="text-gray-500">Net Amount:</span> 
                              <span className="font-semibold text-gray-900">₹{Redemption.amount_to_receive?.toFixed(2) || '0.00'}</span>
                              <span className="text-gray-400">• Fee: ₹{Redemption.fee?.toFixed(2) || '0.00'}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              {getPaymentMethodIcon(Redemption.payment_mode)}
                              <span>Payment: {getPaymentMethodName(Redemption.payment_mode)} - {Redemption.upi_id || Redemption.bank_account}</span>
                            </p>
                            {Redemption.account_holder_name && (
                              <p>Account Holder: {Redemption.account_holder_name}</p>
                            )}
                            {Redemption.bank_name && (
                              <p className="flex items-center gap-2">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-sm ${getBankColor(Redemption.bank_name)}`}>
                                  {getBankLogo(Redemption.bank_name)}
                                </span>
                                <span>Bank: {getBankByName(Redemption.bank_name)?.name || Redemption.bank_name}</span>
                              </p>
                            )}
                            <p>Requested: {new Date(Redemption.created_at).toLocaleString()}</p>
                            {Redemption.utr_number && (
                              <p className="text-green-600 font-medium">UTR: {Redemption.utr_number}</p>
                            )}
                            {Redemption.admin_notes && (
                              <p className="text-sm italic">Note: {Redemption.admin_notes}</p>
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

          {/* prc Redemption History */}
          {isStockistOrOutlet && (
            <TabsContent value="prc-history">
              <Card className="p-6">
                <h3 className="text-2xl font-bold mb-4">prc Redemption History</h3>
                
                {Redemptions.prc_Redemptions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p>No Redemption history yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Redemptions.prc_Redemptions.map((Redemption) => (
                      <Card key={Redemption.Redemption_id} className="p-4 border">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-lg font-bold">₹{Redemption.amount_requested?.toFixed(2) || '0.00'}</span>
                              {getStatusBadge(Redemption.status)}
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>Net Amount: ₹{Redemption.amount_to_receive?.toFixed(2) || '0.00'} (Fee: ₹{Redemption.fee?.toFixed(2) || '0.00'})</p>
                              <p className="flex items-center gap-2">
                                {getPaymentMethodIcon(Redemption.payment_mode)}
                                <span>Payment: {getPaymentMethodName(Redemption.payment_mode)} - {Redemption.upi_id || Redemption.bank_account}</span>
                              </p>
                              {Redemption.account_holder_name && (
                                <p>Account Holder: {Redemption.account_holder_name}</p>
                              )}
                              {Redemption.bank_name && (
                                <p className="flex items-center gap-2">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-sm ${getBankColor(Redemption.bank_name)}`}>
                                    {getBankLogo(Redemption.bank_name)}
                                  </span>
                                  <span>Bank: {getBankByName(Redemption.bank_name)?.name || Redemption.bank_name}</span>
                                </p>
                              )}
                              <p>Requested: {new Date(Redemption.created_at).toLocaleString()}</p>
                              {Redemption.utr_number && (
                                <p className="text-green-600 font-medium">UTR: {Redemption.utr_number}</p>
                              )}
                              {Redemption.admin_notes && (
                                <p className="text-sm italic">Note: {Redemption.admin_notes}</p>
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
