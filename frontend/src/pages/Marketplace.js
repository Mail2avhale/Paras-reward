import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Package, Plus, Minus, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Marketplace = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({ items: [] });
  const [showCart, setShowCart] = useState(false);
  const [userData, setUserData] = useState(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchUserData();
    fetchCart();
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
      const response = await axios.get(`${API}/users/${user.uid}`);
      setUserData(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchCart = async () => {
    try {
      const response = await axios.get(`${API}/cart/${user.uid}`);
      setCart(response.data || { items: [] });
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  const addToCart = async (product) => {
    if (userData?.membership_type !== 'vip') {
      toast.error('VIP membership required!');
      navigate('/vip');
      return;
    }

    if (userData?.kyc_status !== 'verified') {
      toast.error('Please complete KYC verification first!');
      navigate('/kyc');
      return;
    }

    try {
      await axios.post(`${API}/cart/add`, {
        user_id: user.uid,
        product_id: product.product_id,
        quantity: 1
      });
      toast.success('Added to cart!');
      fetchCart();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add to cart');
    }
  };

  const removeFromCart = async (productId) => {
    try {
      await axios.delete(`${API}/cart/${user.uid}/item/${productId}`);
      toast.success('Removed from cart');
      fetchCart();
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const updateQuantity = async (productId, change) => {
    const item = cart.items.find(i => i.product_id === productId);
    if (!item) return;

    const newQuantity = item.quantity + change;
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }

    // Remove and re-add with new quantity
    await removeFromCart(productId);
    try {
      await axios.post(`${API}/cart/add`, {
        user_id: user.uid,
        product_id: productId,
        quantity: newQuantity
      });
      fetchCart();
    } catch (error) {
      toast.error('Failed to update quantity');
    }
  };

  const checkout = async () => {
    if (!deliveryAddress.trim()) {
      toast.error('Please enter delivery address');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/orders/checkout`, {
        user_id: user.uid,
        delivery_address: deliveryAddress
      });

      toast.success(
        <div>
          <p className="font-semibold">Order placed successfully!</p>
          <p className="text-sm">Secret Code: <span className="font-bold">{response.data.secret_code}</span></p>
          <p className="text-xs">Show this code at the outlet</p>
        </div>,
        { duration: 8000 }
      );

      setShowCart(false);
      setDeliveryAddress('');
      fetchCart();
      fetchUserData();
      navigate('/orders');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const cartTotal = cart.items?.reduce((sum, item) => sum + (item.prc_price * item.quantity), 0) || 0;
  const cartCount = cart.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">Marketplace</h1>
            <p className="text-lg text-gray-600">Redeem amazing products using your PRC coins</p>
          </div>
          <Button
            onClick={() => setShowCart(true)}
            className="bg-purple-600 hover:bg-purple-700 relative"
            size="lg"
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {cartCount}
              </span>
            )}
          </Button>
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <Card className="p-12 text-center bg-white/80 backdrop-blur-sm">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No products available</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product, index) => (
              <Card key={product.product_id} className="bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow overflow-hidden">
                <div className="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-24 w-24 text-purple-300" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-2xl font-bold text-purple-600">{product.prc_price} PRC</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Stock</p>
                      <p className="font-semibold text-gray-900">{product.stock_quantity}</p>
                    </div>
                  </div>

                  <Button
                    data-testid={`add-to-cart-${index}-btn`}
                    onClick={() => addToCart(product)}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                    disabled={product.stock_quantity === 0}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {product.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cart Modal */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Shopping Cart</DialogTitle>
            <DialogDescription>
              Review your items and proceed to checkout
            </DialogDescription>
          </DialogHeader>

          {cart.items?.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cart Items */}
              <div className="space-y-3">
                {cart.items?.map((item) => (
                  <Card key={item.product_id} className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded flex items-center justify-center flex-shrink-0">
                        <Package className="h-8 w-8 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{item.product_name}</h4>
                        <p className="text-purple-600 font-bold">{item.prc_price} PRC each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.product_id, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-semibold">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.product_id, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeFromCart(item.product_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Delivery Address */}
              <div>
                <label className="block text-sm font-medium mb-2">Delivery Address *</label>
                <Input
                  placeholder="Enter your complete delivery address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Summary */}
              <Card className="bg-purple-50 border-purple-200 p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold">Total Items:</span>
                    <span>{cartCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Total PRC:</span>
                    <span className="text-purple-600 font-bold">{cartTotal.toFixed(2)} PRC</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Your Balance:</span>
                    <span>{userData?.prc_balance?.toFixed(2) || 0} PRC</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Cashback (25%):</span>
                    <span>₹{((cartTotal * 0.25) / 10).toFixed(2)}</span>
                  </div>
                </div>
              </Card>

              {/* Checkout Button */}
              <Button
                onClick={checkout}
                disabled={loading || !deliveryAddress.trim()}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-6 text-lg"
              >
                {loading ? 'Processing...' : (
                  <>
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Checkout & Get Secret Code
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Marketplace;