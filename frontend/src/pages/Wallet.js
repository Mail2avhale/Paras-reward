import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet as WalletIcon, ArrowDownToLine, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Wallet = ({ user, onLogout }) => {
  const [walletData, setWalletData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [RedeemAmount, setRedeemAmount] = useState('');
  const [upiId, setUpiId] = useState('');

  useEffect(() => {
    fetchWalletData();
    fetchUserData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const response = await axios.get(`${API}/wallet/${user.uid}`);
      setWalletData(response.data);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  };

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/auth/user/${user.uid}`);
      setUserData(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const handleRedeem = async () => {
    if (!RedeemAmount || parseFloat(RedeemAmount) < 100) {
      toast.error('Minimum Redemption amount is ₹100');
      return;
    }

    if (!upiId) {
      toast.error('Please enter UPI ID');
      return;
    }

    try {
      await axios.post(`${API}/wallet/${user.uid}/Redeem`, {
        amount: parseFloat(RedeemAmount),
        upi_id: upiId
      });
      toast.success(`Redemption of ₹${RedeemAmount} processed successfully!`);
      setRedeemAmount('');
      setUpiId('');
      fetchWalletData();
    } catch (error) {
      console.error('Error Redeeming:', error);
      toast.error(error.response?.data?.detail || 'Redemption failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pt-20 pb-24">
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">Cashback Wallet</h1>

        {/* Wallet Balance */}
        <Card data-testid="wallet-balance" className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white p-8 rounded-3xl shadow-2xl mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-2">Available Balance</p>
              <h2 className="text-6xl font-bold">₹{walletData?.balance?.toFixed(2) || '0.00'}</h2>
              <p className="text-sm opacity-90 mt-2">Wallet Status: {walletData?.status?.toUpperCase()}</p>
            </div>
            <div className="bg-white/20 p-6 rounded-2xl">
              <WalletIcon className="h-16 w-16" />
            </div>
          </div>
        </Card>

        {/* Status Alerts */}
        {walletData?.status === 'frozen' && (
          <Card data-testid="frozen-alert" className="bg-red-50 border-2 border-red-200 p-6 rounded-2xl mb-8">
            <div className="flex items-center gap-4">
              <Lock className="h-8 w-8 text-red-600" />
              <div>
                <h3 className="font-bold text-red-900 mb-1">Wallet Frozen</h3>
                <p className="text-sm text-red-700">
                  Your wallet is frozen due to unpaid maintenance fee. Please pay ₹99 to reactivate.
                </p>
              </div>
            </div>
          </Card>
        )}

        {userData?.kyc_status !== 'verified' && (
          <Card data-testid="kyc-alert" className="bg-yellow-50 border-2 border-yellow-200 p-6 rounded-2xl mb-8">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
              <div>
                <h3 className="font-bold text-yellow-900 mb-1">KYC Required</h3>
                <p className="text-sm text-yellow-700">
                  Complete KYC verification to enable wallet Redemptions.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Redemption Form */}
        <Card data-testid="Redemption-form" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Redeem Funds</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
              <Input
                data-testid="Redeem-amount-input"
                type="number"
                placeholder="Minimum ₹100"
                value={RedeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                className="py-6 text-lg rounded-xl"
                disabled={walletData?.status !== 'active' || userData?.kyc_status !== 'verified'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
              <Input
                data-testid="upi-input"
                type="text"
                placeholder="yourname@upi"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="py-6 text-lg rounded-xl"
                disabled={walletData?.status !== 'active' || userData?.kyc_status !== 'verified'}
              />
            </div>

            <div className="bg-gray-50 p-4 rounded-xl">
              <p className="text-sm text-gray-700">
                <strong>Redemption Fee:</strong> ₹5 per transaction
                <br />
                <strong>You will receive:</strong> ₹{(parseFloat(RedeemAmount) || 0).toFixed(2)}
              </p>
            </div>

            <Button
              data-testid="Redeem-btn"
              onClick={handleRedeem}
              disabled={walletData?.status !== 'active' || userData?.kyc_status !== 'verified'}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-6 rounded-xl text-lg font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowDownToLine className="mr-2 h-5 w-5" />
              Redeem to UPI
            </Button>
          </div>
        </Card>

        {/* Wallet Info */}
        <Card data-testid="wallet-info" className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl">
          <h3 className="text-xl font-bold text-gray-900 mb-4">How Cashback Wallet Works</h3>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-purple-100 rounded-full flex-shrink-0 mr-3 flex items-center justify-center text-purple-600 font-semibold text-sm">1</span>
              <span>Earn 25% cashback on every product redemption (deducted from PRC)</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-purple-100 rounded-full flex-shrink-0 mr-3 flex items-center justify-center text-purple-600 font-semibold text-sm">2</span>
              <span>Cashback is automatically credited to your wallet in INR</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-purple-100 rounded-full flex-shrink-0 mr-3 flex items-center justify-center text-purple-600 font-semibold text-sm">3</span>
              <span>Minimum Redemption: ₹100 | Redemption fee: ₹5</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-purple-100 rounded-full flex-shrink-0 mr-3 flex items-center justify-center text-purple-600 font-semibold text-sm">4</span>
              <span>Monthly maintenance: ₹99 (auto-deducted)</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-purple-100 rounded-full flex-shrink-0 mr-3 flex items-center justify-center text-purple-600 font-semibold text-sm">5</span>
              <span>Wallet freezes if maintenance unpaid for 7 days</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default Wallet;