import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Wallet as WalletIcon, ArrowDownToLine, ArrowLeft, Coins, 
  TrendingUp, Clock, Shield, AlertCircle, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

const Wallet = ({ user }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);

  const t = {
    title: language === 'mr' ? 'वॉलेट' : language === 'hi' ? 'वॉलेट' : 'Wallet',
    prcBalance: language === 'mr' ? 'PRC शिल्लक' : language === 'hi' ? 'PRC बैलेंस' : 'PRC Balance',
    cashbackBalance: language === 'mr' ? 'कॅशबॅक शिल्लक' : language === 'hi' ? 'कैशबैक बैलेंस' : 'Cashback Balance',
    withdraw: language === 'mr' ? 'काढा' : language === 'hi' ? 'निकालें' : 'Withdraw',
    minWithdraw: language === 'mr' ? 'किमान ₹100' : language === 'hi' ? 'न्यूनतम ₹100' : 'Min ₹100',
    kycRequired: language === 'mr' ? 'KYC आवश्यक' : language === 'hi' ? 'KYC आवश्यक' : 'KYC Required',
    recentWithdrawals: language === 'mr' ? 'अलीकडील पैसे काढणे' : language === 'hi' ? 'हाल की निकासी' : 'Recent Withdrawals',
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch user data
      const userRes = await axios.get(`${API}/api/user/${user.uid}`);
      setUserData(userRes.data);
      setUpiId(userRes.data.upi_id || '');
      
      // Fetch wallet data
      try {
        const walletRes = await axios.get(`${API}/api/wallet/${user.uid}`);
        setWalletData(walletRes.data);
      } catch (e) {
        setWalletData({ cashback_balance: userRes.data.cashback_wallet_balance || 0 });
      }
      
      // Fetch withdrawal history
      try {
        const withdrawRes = await axios.get(`${API}/api/withdrawals/${user.uid}`);
        setWithdrawals(withdrawRes.data.withdrawals || []);
      } catch (e) {
        setWithdrawals([]);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(redeemAmount);
    
    if (!amount || amount < 100) {
      toast.error('Minimum withdrawal is ₹100');
      return;
    }
    
    if (!upiId) {
      toast.error('Please enter UPI ID');
      return;
    }
    
    if (userData?.kyc_status !== 'verified') {
      toast.error('Please complete KYC verification first');
      navigate('/kyc');
      return;
    }
    
    const balance = walletData?.cashback_balance || userData?.cashback_wallet_balance || 0;
    if (amount > balance) {
      toast.error('Insufficient balance');
      return;
    }
    
    setWithdrawing(true);
    try {
      await axios.post(`${API}/api/wallet/withdraw`, {
        uid: user.uid,
        amount,
        upi_id: upiId
      });
      
      toast.success('Withdrawal request submitted! Processing in 3-7 days.');
      setRedeemAmount('');
      fetchData();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const prcBalance = userData?.prc_balance || 0;
  const cashbackBalance = walletData?.cashback_balance || userData?.cashback_wallet_balance || 0;
  const isKycVerified = userData?.kyc_status === 'verified';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">{t.title}</h1>
            <p className="text-gray-400 text-sm">Manage your earnings</p>
          </div>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="px-5 mb-6 space-y-4">
        {/* PRC Balance Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t.prcBalance}</p>
              <p className="text-3xl font-bold text-amber-400">{prcBalance.toFixed(2)}</p>
              <p className="text-gray-500 text-xs mt-1">Use in Marketplace</p>
            </div>
            <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Coins className="w-7 h-7 text-amber-500" />
            </div>
          </div>
        </motion.div>

        {/* Cashback Balance Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-200 text-sm">{t.cashbackBalance}</p>
              <p className="text-3xl font-bold text-white">₹{cashbackBalance.toFixed(2)}</p>
              <p className="text-emerald-300/70 text-xs mt-1">Withdrawable</p>
            </div>
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
              <WalletIcon className="w-7 h-7 text-white" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Withdraw Section */}
      <div className="px-5 mb-6">
        <h2 className="text-white font-bold text-lg mb-4">{t.withdraw}</h2>
        
        {!isKycVerified ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-amber-500" />
              <div>
                <p className="text-amber-400 font-semibold">{t.kycRequired}</p>
                <p className="text-gray-400 text-sm mt-1">Complete KYC to withdraw funds</p>
                <Button
                  onClick={() => navigate('/kyc')}
                  className="mt-3 bg-amber-500 hover:bg-amber-600 text-black"
                  size="sm"
                >
                  Complete KYC
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Amount (₹)</label>
              <Input
                type="number"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                placeholder="Enter amount"
                className="bg-gray-800 border-gray-700 text-white"
                min="100"
              />
              <p className="text-gray-500 text-xs mt-1">{t.minWithdraw} • Available: ₹{cashbackBalance.toFixed(2)}</p>
            </div>
            
            <div>
              <label className="text-gray-400 text-sm mb-1 block">UPI ID</label>
              <Input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="Enter UPI ID (e.g., name@upi)"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            
            <Button
              onClick={handleWithdraw}
              disabled={withdrawing || !redeemAmount || !upiId}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3"
            >
              {withdrawing ? 'Processing...' : (
                <>
                  <ArrowDownToLine className="w-4 h-4 mr-2" />
                  {t.withdraw}
                </>
              )}
            </Button>
            
            <p className="text-gray-500 text-xs text-center">
              Processing time: 3-7 working days
            </p>
          </div>
        )}
      </div>

      {/* Recent Withdrawals */}
      {withdrawals.length > 0 && (
        <div className="px-5">
          <h2 className="text-white font-bold text-lg mb-4">{t.recentWithdrawals}</h2>
          <div className="space-y-3">
            {withdrawals.slice(0, 5).map((w, index) => (
              <div 
                key={index}
                className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    w.status === 'completed' ? 'bg-emerald-500/20' :
                    w.status === 'pending' ? 'bg-amber-500/20' : 'bg-red-500/20'
                  }`}>
                    <ArrowDownToLine className={`w-5 h-5 ${
                      w.status === 'completed' ? 'text-emerald-500' :
                      w.status === 'pending' ? 'text-amber-500' : 'text-red-500'
                    }`} />
                  </div>
                  <div>
                    <p className="text-white font-medium">₹{w.amount}</p>
                    <p className="text-gray-500 text-xs">{new Date(w.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                  w.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                  w.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
