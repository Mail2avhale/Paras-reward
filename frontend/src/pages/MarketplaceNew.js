import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ShoppingCart, Package, Gift, Smartphone, Search, 
  Star, TrendingUp, ChevronRight, Plus, ArrowLeft,
  Truck, Tag, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import BottomNav from '@/components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL;

const MarketplaceNew = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState({ items: [] });
  const [showCart, setShowCart] = useState(false);

  // Categories with icons
  const categories = [
    { id: 'all', name: 'All', icon: Sparkles, color: 'bg-orange-500' },
    { id: 'Fashion', name: 'Fashion', icon: Tag, color: 'bg-white border border-gray-200' },
    { id: 'Electronics', name: 'Electronics', icon: Smartphone, color: 'bg-white border border-gray-200' },
    { id: 'Home & Kitchen', name: 'Home', icon: Package, color: 'bg-white border border-gray-200' },
    { id: 'Beauty', name: 'Beauty', icon: Star, color: 'bg-white border border-gray-200' },
  ];

  // Redeem options
  const redeemOptions = [
    { id: 'merchandise', name: 'Merchandise', icon: Package, color: 'bg-gradient-to-br from-cyan-400 to-blue-500' },
    { id: 'evouchers', name: 'E-vouchers', icon: Gift, color: 'bg-gradient-to-br from-purple-400 to-purple-600' },
    { id: 'recharge', name: 'Recharge & Bills', icon: Smartphone, color: 'bg-gradient-to-br from-green-400 to-green-600' },
  ];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [userRes, productsRes, cartRes] = await Promise.all([
        axios.get(`${API}/api/user/${user.uid}`),
        axios.get(`${API}/api/products`),
        axios.get(`${API}/api/cart/${user.uid}`).catch(() => ({ data: { items: [] } }))
      ]);
      
      setUserData(userRes.data);
      // Handle both array and object response formats
      const productsData = productsRes.data.products || productsRes.data;
      const activeProducts = Array.isArray(productsData) 
        ? productsData.filter(p => p.is_active !== false)
        : [];
      setProducts(activeProducts);
      setFilteredProducts(activeProducts);
      setCart(cartRes.data || { items: [] });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    if (user?.uid) {
      fetchData();
    }
  }, [user, fetchData]);

  // Filter products
  useEffect(() => {
    let filtered = products;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchTerm]);

  const addToCart = async (product) => {
    try {
      await axios.post(`${API}/api/cart/${user.uid}/add`, {
        product_id: product.product_id,
        quantity: 1
      });
      toast.success('Added to cart!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add to cart');
    }
  };

  const getProductBadge = (product, index) => {
    if (product.stock === 0) return null;
    if (index % 3 === 0) return { text: 'Bestseller', color: 'bg-orange-500' };
    if (index % 3 === 1) return { text: 'Trending', color: 'bg-orange-400' };
    if (product.stock < 10) return { text: 'Limited', color: 'bg-red-500' };
    return null;
  };

  const prcBalance = userData?.prc_balance || 0;
  const cartItemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <span className="text-lg font-medium">Redeem your points on things you love</span>
            <button 
              onClick={() => setShowCart(true)}
              className="relative bg-white rounded-full p-2"
            >
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
          
          {/* Points Balance */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4">
            <p className="text-white/80 text-sm">Your Points Balance</p>
            <p className="text-3xl font-bold">{prcBalance.toFixed(3)} <span className="text-xl">Pts</span></p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full bg-white text-gray-800 border-0 shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="px-4 py-4 overflow-x-auto">
        <div className="flex gap-3">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                  isSelected 
                    ? 'bg-orange-500 text-white shadow-lg' 
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-orange-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Redeem Your Points Section */}
      <div className="px-4 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Redeem Your Points</h2>
        <div className="grid grid-cols-3 gap-3">
          {redeemOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Card 
                key={option.id}
                className="p-4 flex flex-col items-center justify-center cursor-pointer hover:shadow-lg transition-shadow bg-white"
                onClick={() => {
                  if (option.id === 'merchandise') {
                    setSelectedCategory('all');
                  } else {
                    toast.info(`${option.name} coming soon!`);
                  }
                }}
              >
                <div className={`w-14 h-14 rounded-full ${option.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 text-center">{option.name}</span>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Exclusive Products Section */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <h2 className="text-xl font-bold text-gray-800">Exclusive Products</h2>
          </div>
          <button 
            className="flex items-center gap-1 text-blue-600 font-medium"
            onClick={() => setSelectedCategory('all')}
          >
            View More <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 gap-4">
          {filteredProducts.slice(0, 10).map((product, index) => {
            const badge = getProductBadge(product, index);
            const isOutOfStock = product.stock === 0;
            
            return (
              <Card 
                key={product.product_id} 
                className="overflow-hidden bg-white hover:shadow-lg transition-shadow relative"
              >
                {/* Badge */}
                {badge && (
                  <div className={`absolute top-3 left-3 ${badge.color} text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 z-10`}>
                    {badge.text === 'Bestseller' && <Star className="w-3 h-3" />}
                    {badge.text === 'Trending' && <TrendingUp className="w-3 h-3" />}
                    {badge.text}
                  </div>
                )}
                
                {/* Product Image */}
                <div 
                  className="relative h-36 bg-gray-100 flex items-center justify-center cursor-pointer"
                  onClick={() => setSelectedProduct(product)}
                >
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      className={`w-full h-full object-cover ${isOutOfStock ? 'opacity-50' : ''}`}
                    />
                  ) : (
                    <Package className={`w-16 h-16 ${isOutOfStock ? 'text-gray-300' : 'text-gray-400'}`} />
                  )}
                  {isOutOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <span className="text-white font-bold text-sm">Out of Stock</span>
                    </div>
                  )}
                </div>
                
                {/* Product Info */}
                <div className="p-3">
                  <h3 className="font-semibold text-gray-800 text-sm line-clamp-2 mb-2">
                    {product.name}
                  </h3>
                  
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-blue-600 font-bold text-lg">
                      {product.prc_price?.toLocaleString()} Pts
                    </span>
                    <span className="text-gray-400 text-sm">
                      ≈ ₹{(product.prc_price * 0.1).toFixed(0)}
                    </span>
                  </div>
                  
                  {product.free_delivery && (
                    <div className="flex items-center gap-1 text-green-600 text-xs mb-2">
                      <Truck className="w-3 h-3" />
                      Free Delivery
                    </div>
                  )}
                  
                  <Button
                    onClick={() => addToCart(product)}
                    disabled={isOutOfStock}
                    className={`w-full ${
                      isOutOfStock 
                        ? 'bg-gray-300 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white text-sm py-2`}
                    data-testid={`add-to-cart-${product.product_id}`}
                  >
                    {isOutOfStock ? 'Out of Stock' : 'Redeem Now'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Show More Button */}
        {filteredProducts.length > 10 && (
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              onClick={() => navigate('/marketplace/all')}
              className="px-8"
            >
              View All {filteredProducts.length} Products
            </Button>
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No products found</p>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                {selectedProduct.image_url ? (
                  <img 
                    src={selectedProduct.image_url} 
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Package className="w-20 h-20 text-gray-400" />
                )}
              </div>
              <p className="text-gray-600">{selectedProduct.description}</p>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-blue-600">
                  {selectedProduct.prc_price?.toLocaleString()} Pts
                </span>
                <span className="text-gray-400">
                  ≈ ₹{(selectedProduct.prc_price * 0.1).toFixed(0)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Package className="w-4 h-4" />
                <span>{selectedProduct.stock > 0 ? `${selectedProduct.stock} in stock` : 'Out of stock'}</span>
              </div>
              <Button
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
                disabled={selectedProduct.stock === 0}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {selectedProduct.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart Modal */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Your Cart ({cartItemCount} items)
            </DialogTitle>
          </DialogHeader>
          {cart?.items?.length > 0 ? (
            <div className="space-y-4">
              {cart.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.product_name || 'Product'}</p>
                    <p className="text-blue-600 font-bold">{item.prc_price} Pts × {item.quantity}</p>
                  </div>
                </div>
              ))}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-bold text-blue-600">
                    {cart.items.reduce((sum, item) => sum + (item.prc_price * item.quantity), 0).toLocaleString()} Pts
                  </span>
                </div>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setShowCart(false);
                    navigate('/checkout');
                  }}
                >
                  Proceed to Checkout
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Your cart is empty</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowCart(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg flex items-center justify-center text-white z-50"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Bottom Navigation */}
      <BottomNav user={user} />
    </div>
  );
};

export default MarketplaceNew;
