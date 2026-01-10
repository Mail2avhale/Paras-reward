import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Package, Plus, Minus, Trash2, CheckCircle, ArrowLeft, Search, Star, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

const Marketplace = ({ user }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({ items: [] });
  const [showCart, setShowCart] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const t = {
    title: language === 'mr' ? 'मार्केटप्लेस' : language === 'hi' ? 'मार्केटप्लेस' : 'Marketplace',
    search: language === 'mr' ? 'शोधा...' : language === 'hi' ? 'खोजें...' : 'Search products...',
    cart: language === 'mr' ? 'कार्ट' : language === 'hi' ? 'कार्ट' : 'Cart',
    checkout: language === 'mr' ? 'ऑर्डर करा' : language === 'hi' ? 'ऑर्डर करें' : 'Place Order',
    emptyCart: language === 'mr' ? 'कार्ट रिकामी आहे' : language === 'hi' ? 'कार्ट खाली है' : 'Cart is empty',
    addToCart: language === 'mr' ? 'कार्टमध्ये जोडा' : language === 'hi' ? 'कार्ट में जोड़ें' : 'Add to Cart',
    vipOnly: language === 'mr' ? 'फक्त VIP साठी' : language === 'hi' ? 'केवल VIP के लिए' : 'VIP Only',
  };

  const categories = [
    { id: 'all', name: 'All' },
    { id: 'electronics', name: 'Electronics' },
    { id: 'fashion', name: 'Fashion' },
    { id: 'home', name: 'Home' },
    { id: 'vouchers', name: 'Vouchers' },
  ];

  useEffect(() => {
    // Early VIP check
    if (user && user.membership_type !== 'vip') {
      toast.error('VIP membership required to access Marketplace');
      setTimeout(() => navigate('/dashboard'), 2000);
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch products
      const productsRes = await axios.get(`${API}/api/products?page=1&limit=100`);
      setProducts(productsRes.data?.products || []);
      
      // Fetch user data
      const userRes = await axios.get(`${API}/api/user/${user.uid}`);
      setUserData(userRes.data);
      
      // Fetch cart
      try {
        const cartRes = await axios.get(`${API}/api/cart/${user.uid}`);
        setCart(cartRes.data || { items: [] });
      } catch (e) {
        setCart({ items: [] });
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (product) => {
    if (!userData || userData.membership_type !== 'vip') {
      toast.error('VIP membership required to shop');
      navigate('/dashboard');
      return;
    }
    
    try {
      await axios.post(`${API}/api/cart/${user.uid}/add`, {
        product_id: product.id,
        quantity: 1
      });
      toast.success('Added to cart');
      
      // Update local cart
      const existingItem = cart.items.find(i => i.product_id === product.id);
      if (existingItem) {
        setCart({
          ...cart,
          items: cart.items.map(i => 
            i.product_id === product.id 
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        });
      } else {
        setCart({
          ...cart,
          items: [...cart.items, { product_id: product.id, quantity: 1, product }]
        });
      }
    } catch (error) {
      toast.error('Failed to add to cart');
    }
  };

  const updateCartItem = async (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    try {
      await axios.put(`${API}/api/cart/${user.uid}/update`, {
        product_id: productId,
        quantity
      });
      setCart({
        ...cart,
        items: cart.items.map(i => 
          i.product_id === productId ? { ...i, quantity } : i
        )
      });
    } catch (error) {
      toast.error('Failed to update cart');
    }
  };

  const removeFromCart = async (productId) => {
    try {
      await axios.delete(`${API}/api/cart/${user.uid}/remove/${productId}`);
      setCart({
        ...cart,
        items: cart.items.filter(i => i.product_id !== productId)
      });
      toast.success('Removed from cart');
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const placeOrder = async () => {
    if (cart.items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    
    const total = cart.items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.product_id) || item.product;
      return sum + (product?.prc_price || 0) * item.quantity;
    }, 0);
    
    if ((userData?.prc_balance || 0) < total) {
      toast.error('Insufficient PRC balance');
      return;
    }
    
    try {
      await axios.post(`${API}/api/orders`, {
        uid: user.uid,
        items: cart.items
      });
      toast.success('Order placed successfully!');
      setCart({ items: [] });
      setShowCart(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to place order');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory && p.is_active !== false;
  });

  const cartTotal = cart.items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.product_id) || item.product;
    return sum + (product?.prc_price || 0) * item.quantity;
  }, 0);

  const isVip = userData?.membership_type === 'vip';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-24">
      {/* Header - with safe area padding */}
      <div className="px-5 pb-4 pt-safe-header" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top, 2rem))' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">{t.title}</h1>
              <p className="text-gray-400 text-sm">Redeem your PRC</p>
            </div>
          </div>
          
          {/* Cart Button */}
          <button 
            onClick={() => setShowCart(true)}
            className="relative w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center"
          >
            <ShoppingCart className="w-5 h-5 text-black" />
            {cart.items.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                {cart.items.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Balance Card */}
      <div className="px-5 mb-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs">Your Balance</p>
            <p className="text-2xl font-bold text-amber-400">{(userData?.prc_balance || 0).toFixed(2)} PRC</p>
          </div>
          {!isVip && (
            <button 
              onClick={() => navigate('/vip')}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 rounded-xl text-black text-sm font-bold flex items-center gap-1"
            >
              <Crown className="w-4 h-4" /> Get VIP
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-5 mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search}
            className="bg-gray-800 border-gray-700 text-white pl-12 rounded-xl"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="px-5 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* VIP Required Banner */}
      {!isVip && (
        <div className="px-5 mb-6">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
            <Crown className="w-8 h-8 text-amber-500" />
            <div>
              <p className="text-amber-400 font-semibold">VIP Required</p>
              <p className="text-gray-400 text-sm">Upgrade to VIP to shop in marketplace</p>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="px-5">
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden"
            >
              {/* Product Image */}
              <div className="aspect-square bg-gray-800 relative">
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-600" />
                  </div>
                )}
                {product.is_featured && (
                  <div className="absolute top-2 left-2 bg-amber-500 px-2 py-1 rounded-full">
                    <Star className="w-3 h-3 text-black" />
                  </div>
                )}
              </div>
              
              {/* Product Info */}
              <div className="p-3">
                <h3 className="text-white font-medium text-sm line-clamp-1">{product.name}</h3>
                <p className="text-amber-400 font-bold mt-1">{product.prc_price} PRC</p>
                
                <Button
                  onClick={() => addToCart(product)}
                  disabled={!isVip || product.stock <= 0}
                  className={`w-full mt-2 text-sm py-2 ${
                    isVip 
                      ? 'bg-amber-500 hover:bg-amber-600 text-black'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                  size="sm"
                >
                  {product.stock <= 0 ? 'Out of Stock' : isVip ? t.addToCart : t.vipOnly}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No products found</p>
          </div>
        )}
      </div>

      {/* Cart Drawer */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-black/60 z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-3xl z-50 max-h-[80vh] overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white text-xl font-bold">{t.cart}</h2>
                  <button onClick={() => setShowCart(false)} className="text-gray-400">✕</button>
                </div>
                
                {cart.items.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">{t.emptyCart}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                      {cart.items.map(item => {
                        const product = products.find(p => p.id === item.product_id) || item.product;
                        return (
                          <div key={item.product_id} className="bg-gray-800 rounded-xl p-3 flex items-center gap-3">
                            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                              {product?.image_url ? (
                                <img src={product.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                <Package className="w-8 h-8 text-gray-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-white text-sm font-medium">{product?.name}</p>
                              <p className="text-amber-400 text-sm">{product?.prc_price} PRC</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => updateCartItem(item.product_id, item.quantity - 1)}
                                className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center"
                              >
                                <Minus className="w-4 h-4 text-white" />
                              </button>
                              <span className="text-white w-6 text-center">{item.quantity}</span>
                              <button 
                                onClick={() => updateCartItem(item.product_id, item.quantity + 1)}
                                className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center"
                              >
                                <Plus className="w-4 h-4 text-white" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="border-t border-gray-800 mt-4 pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400">Total</span>
                        <span className="text-2xl font-bold text-amber-400">{cartTotal.toFixed(2)} PRC</span>
                      </div>
                      <Button
                        onClick={placeOrder}
                        disabled={(userData?.prc_balance || 0) < cartTotal}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-4 rounded-xl"
                      >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        {t.checkout}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Marketplace;
