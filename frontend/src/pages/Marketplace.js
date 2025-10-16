import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift, ShoppingBag, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Marketplace = ({ user, onLogout }) => {
  const [products, setProducts] = useState([]);
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
    fetchUserData();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
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

  const redeemProduct = async (product) => {
    if (userData?.membership_type !== 'vip') {
      toast.error('VIP membership required to redeem products!');
      navigate('/vip');
      return;
    }

    if (userData?.kyc_status !== 'verified') {
      toast.error('Please complete KYC verification first!');
      navigate('/kyc');
      return;
    }

    try {
      const response = await axios.post(`${API}/orders/${user.uid}`, {
        product_id: product.product_id
      });
      
      toast.success(
        <div>
          <p className="font-semibold">Order placed successfully!</p>
          <p className="text-sm">Secret Code: {response.data.secret_code}</p>
        </div>
      );
      
      fetchUserData();
      navigate('/orders');
    } catch (error) {
      console.error('Error redeeming product:', error);
      toast.error(error.response?.data?.detail || 'Failed to redeem product');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">Marketplace</h1>
          <p className="text-lg text-gray-600">Redeem amazing products using your PRC coins</p>
        </div>

        {/* Balance Display */}
        <Card data-testid="marketplace-balance" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-2xl shadow-xl mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Your PRC Balance</p>
              <p className="text-4xl font-bold">{userData?.prc_balance?.toFixed(2) || '0.00'}</p>
            </div>
            {userData?.membership_type !== 'vip' && (
              <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                <Lock className="h-6 w-6 inline mr-2" />
                <span className="text-sm font-semibold">VIP Required</span>
              </div>
            )}
          </div>
        </Card>

        {/* Products Grid */}
        {products.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm p-12 rounded-3xl shadow-xl text-center">
            <ShoppingBag className="h-20 w-20 text-gray-300 mx-auto mb-4" />
            <p className="text-xl text-gray-500">No products available at the moment</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <Card
                key={product.product_id}
                data-testid={`product-${index}`}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all hover:-translate-y-2 overflow-hidden"
              >
                <div className="aspect-video bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Gift className="h-20 w-20 text-purple-400" />
                  )}
                </div>
                
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{product.description}</p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-2xl font-bold text-purple-600">{product.prc_price} PRC</p>
                      <p className="text-sm text-gray-500">≈ ₹{(product.prc_price / 10).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Stock</p>
                      <p className="font-semibold text-gray-900">{product.stock_quantity}</p>
                    </div>
                  </div>
                  
                  <Button
                    data-testid={`redeem-${index}-btn`}
                    onClick={() => redeemProduct(product)}
                    disabled={product.stock_quantity === 0}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {product.stock_quantity === 0 ? 'Out of Stock' : 'Redeem Now'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Marketplace;