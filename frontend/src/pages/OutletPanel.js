import { useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OutletPanel = ({ user, onLogout }) => {
  const [secretCode, setSecretCode] = useState('');
  const [verifiedOrder, setVerifiedOrder] = useState(null);

  const verifyCode = async () => {
    if (!secretCode) {
      toast.error('Please enter secret code');
      return;
    }

    try {
      const response = await axios.post(`${API}/orders/verify`, {
        secret_code: secretCode
      });
      setVerifiedOrder(response.data.order);
      toast.success('Order verified successfully!');
    } catch (error) {
      console.error('Error verifying code:', error);
      toast.error(error.response?.data?.detail || 'Invalid secret code');
      setVerifiedOrder(null);
    }
  };

  const deliverOrder = async () => {
    if (!verifiedOrder) return;

    try {
      await axios.post(`${API}/orders/${verifiedOrder.order_id}/deliver`);
      toast.success('Order marked as delivered!');
      setSecretCode('');
      setVerifiedOrder(null);
    } catch (error) {
      console.error('Error delivering order:', error);
      toast.error('Failed to deliver order');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">Outlet Panel</h1>

        {/* Verify Code */}
        <Card data-testid="verify-section" className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Verify Secret Code</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Enter Secret Code</label>
              <Input
                data-testid="secret-code-input"
                type="text"
                placeholder="PRC-XXXXXXXX"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value.toUpperCase())}
                className="py-6 text-lg rounded-xl"
              />
            </div>

            <Button
              data-testid="verify-btn"
              onClick={verifyCode}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl text-lg font-semibold shadow-lg transition-all"
            >
              Verify Code
            </Button>
          </div>
        </Card>

        {/* Verified Order */}
        {verifiedOrder && (
          <Card data-testid="verified-order" className="bg-gradient-to-br from-green-600 to-emerald-600 text-white p-8 rounded-3xl shadow-2xl">
            <div className="flex items-center justify-center mb-6">
              <CheckCircle className="h-16 w-16" />
            </div>
            
            <h2 className="text-3xl font-bold text-center mb-8">Order Verified!</h2>
            
            <div className="bg-white/20 backdrop-blur-sm p-6 rounded-2xl mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm opacity-90 mb-1">Product</p>
                  <p className="font-bold text-lg">{verifiedOrder.product_name}</p>
                </div>
                <div>
                  <p className="text-sm opacity-90 mb-1">PRC Amount</p>
                  <p className="font-bold text-lg">{verifiedOrder.prc_amount} PRC</p>
                </div>
                <div>
                  <p className="text-sm opacity-90 mb-1">Cash Fees</p>
                  <p className="font-bold text-lg">₹{verifiedOrder.total_cash_fee.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm opacity-90 mb-1">Order Date</p>
                  <p className="font-bold text-lg">{new Date(verifiedOrder.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <Button
              data-testid="deliver-btn"
              onClick={deliverOrder}
              className="w-full bg-white text-green-600 hover:bg-gray-100 py-6 rounded-xl text-lg font-semibold shadow-lg transition-all"
            >
              <Package className="mr-2 h-5 w-5" />
              Mark as Delivered
            </Button>

            <p className="text-center text-sm opacity-90 mt-4">
              Collect ₹{verifiedOrder.total_cash_fee.toFixed(2)} cash from customer
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OutletPanel;