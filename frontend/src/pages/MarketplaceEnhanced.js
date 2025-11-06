import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ShoppingCart, Package, Plus, Minus, Trash2, CheckCircle, 
  Search, Filter, X, Heart, Star, TrendingUp, Tag, Grid, List
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { InFeedAd, ResponsiveAd } from '@/components/AdSenseAd';
import { ProductCardSkeleton } from '@/components/skeletons';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MarketplaceEnhanced = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [cart, setCart] = useState({ items: [] });
  const [showCart, setShowCart] = useState(false);
  const [userData, setUserData] = useState(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);
  
  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState('grid');
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchProducts(),
      fetchUserData(),
      fetchCart()
    ]).finally(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    // Only filter if products is a valid array
    if (Array.isArray(products)) {
      filterAndSortProducts();
    }
  }, [products, searchTerm, selectedCategory, sortBy]);

  const fetchProducts = async (pageNum = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      }
      
      const response = await axios.get(`${API}/products?page=${pageNum}&limit=20`);
      const { products: productData = [], total, has_more } = response.data;
      
      // Fetch stock availability for all products
      try {
        const stockResponse = await axios.get(`${API}/stock/inventory/all-stock`);
        const stockData = stockResponse.data.inventory || [];
        
        // Create stock map by product_id
        const stockMap = {};
        stockData.forEach(stock => {
          const pid = stock.product_id;
          if (!stockMap[pid]) {
            stockMap[pid] = 0;
          }
          stockMap[pid] += stock.quantity || 0;
        });
        
        // Merge stock quantities with products
        const enrichedProducts = productData.map(product => ({
          ...product,
          stock_quantity: stockMap[product.product_id] || 0
        }));
        
        if (append) {
          setProducts(prev => [...prev, ...enrichedProducts]);
        } else {
          setProducts(enrichedProducts);
        }
      } catch (stockError) {
        console.warn('Could not fetch stock data:', stockError);
        const enrichedProducts = productData.map(product => ({
          ...product,
          stock_quantity: 0
        }));
        
        if (append) {
          setProducts(prev => [...prev, ...enrichedProducts]);
        } else {
          setProducts(enrichedProducts);
        }
      }
      
      setTotalProducts(total || 0);
      setHasMore(has_more || false);
      setPage(pageNum);
      
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
      if (!append) {
        setProducts([]);
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      }
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

  const filterAndSortProducts = () => {
    // Ensure products is an array
    if (!Array.isArray(products)) {
      setFilteredProducts([]);
      return;
    }
    
    let filtered = [...products];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price_low':
          return a.prc_price - b.prc_price;
        case 'price_high':
          return b.prc_price - a.prc_price;
        case 'stock':
          return (b.stock_quantity || 0) - (a.stock_quantity || 0);
        default:
          return 0;
      }
    });

    setFilteredProducts(filtered);
  };

  const getCategories = () => {
    // Ensure products is an array before mapping
    if (!Array.isArray(products) || products.length === 0) {
      return ['all'];
    }
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    return ['all', ...categories];
  };

  const loadMore = () => {
    if (hasMore && !loadingMore) {
      fetchProducts(page + 1, true);
    }
  };

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const sentinel = document.querySelector('#load-more-sentinel');
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
    };
  }, [hasMore, loadingMore, page]);

  const addToCart = async (product) => {
    try {
      const userResponse = await axios.get(`${API}/users/${user.uid}`);
      const freshUserData = userResponse.data;
      
      if (freshUserData?.membership_type !== 'vip') {
        toast.error('VIP membership required to shop!');
        navigate('/vip');
        return;
      }

      const response = await axios.post(`${API}/cart/add`, {
        user_id: user.uid,
        product_id: product.product_id,
        quantity: 1
      });
      
      toast.success('Added to cart!');
      fetchCart();
    } catch (error) {
      console.error('Error adding to cart:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to add to cart';
      toast.error(errorMessage);
    }
  };

  const updateCartQuantity = async (productId, change) => {
    try {
      const item = cart.items.find(i => i.product_id === productId);
      if (!item) return;

      const newQuantity = item.quantity + change;
      if (newQuantity <= 0) {
        await removeFromCart(productId);
        return;
      }

      await axios.post(`${API}/cart/update`, {
        user_id: user.uid,
        product_id: productId,
        quantity: newQuantity
      });
      
      fetchCart();
    } catch (error) {
      console.error('Error updating cart:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to update quantity';
      toast.error(errorMessage);
    }
  };

  const removeFromCart = async (productId) => {
    try {
      await axios.post(`${API}/cart/remove`, {
        user_id: user.uid,
        product_id: productId
      });
      toast.success('Removed from cart');
      fetchCart();
    } catch (error) {
      console.error('Error removing from cart:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to remove item';
      toast.error(errorMessage);
    }
  };

  const handleCheckout = async () => {
    if (!deliveryAddress.trim()) {
      toast.error('Please enter delivery address');
      return;
    }

    if (cart.items.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/orders/checkout`, {
        user_id: user.uid,
        delivery_address: deliveryAddress
      });
      
      // Show success message with secret code
      toast.success(
        `Order placed successfully! Secret Code: ${response.data.secret_code}. Show this code at the outlet for delivery.`,
        { duration: 8000 }
      );
      
      setShowCart(false);
      setDeliveryAddress('');
      fetchCart();
      fetchUserData();
      navigate('/orders');
    } catch (error) {
      console.error('Error placing order:', error);
      // Ensure error message is a string
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to place order';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const totalPRC = cart.items?.reduce((sum, item) => sum + (item.prc_price * item.quantity), 0) || 0;

  // Early return with loading state to prevent render errors
  if (!Array.isArray(products) || !Array.isArray(filteredProducts)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Navbar user={user} onLogout={onLogout} />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Marketplace</h1>
            <p className="text-purple-300">Redeem your PRC for amazing products</p>
          </div>
          <Button 
            onClick={() => setShowCart(true)}
            className="relative bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            Cart ({cart.items?.length || 0})
            {cart.items?.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-pink-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                {cart.items.length}
              </span>
            )}
          </Button>
        </div>

        {/* User Balance Card */}
        <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-2xl mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Your PRC Balance</p>
              <h2 className="text-4xl font-bold">{userData?.prc_balance?.toFixed(2) || '0.00'}</h2>
              <p className="text-sm opacity-90 mt-1">≈ ₹{((userData?.prc_balance || 0) / 10).toFixed(2)} INR</p>
            </div>
            <Package className="h-16 w-16 opacity-50" />
          </div>
        </Card>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-48 bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {getCategories().map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48 bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="price_low">Price (Low to High)</SelectItem>
                <SelectItem value="price_high">Price (High to Low)</SelectItem>
                <SelectItem value="stock">Stock Available</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode */}
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="bg-white/10 hover:bg-white/20 border-white/20"
              >
                <Grid className="h-5 w-5 text-white" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
                className="bg-white/10 hover:bg-white/20 border-white/20"
              >
                <List className="h-5 w-5 text-white" />
              </Button>
            </div>
          </div>

          {/* Active Filters */}
          {(searchTerm || selectedCategory !== 'all') && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">Active filters:</span>
              {searchTerm && (
                <Badge variant="secondary" className="bg-purple-600/50">
                  Search: {searchTerm}
                  <X 
                    className="ml-2 h-3 w-3 cursor-pointer" 
                    onClick={() => setSearchTerm('')}
                  />
                </Badge>
              )}
              {selectedCategory !== 'all' && (
                <Badge variant="secondary" className="bg-purple-600/50">
                  Category: {selectedCategory}
                  <X 
                    className="ml-2 h-3 w-3 cursor-pointer" 
                    onClick={() => setSelectedCategory('all')}
                  />
                </Badge>
              )}
            </div>
          )}

          <p className="text-sm text-gray-300">
            Showing {Array.isArray(filteredProducts) ? filteredProducts.length : 0} of {Array.isArray(products) ? products.length : 0} products
          </p>
        </div>

        {/* Products Grid/List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <ProductCardSkeleton count={8} />
          </div>
        ) : !Array.isArray(filteredProducts) || filteredProducts.length === 0 ? (
          <Card className="p-12 text-center bg-white/10 backdrop-blur-xl border border-white/20">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Products Found</h3>
            <p className="text-gray-300">Try adjusting your search or filters</p>
          </Card>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
            : "space-y-4"
          }>
            {filteredProducts.map((product, idx) => (
            <Card 
              key={product.product_id}
              className={`bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/15 transition-all duration-300 overflow-hidden group ${
                viewMode === 'list' ? 'flex' : ''
              }`}
            >
              {/* Product Image */}
              <div className={`relative bg-gradient-to-br from-purple-500 to-pink-500 ${
                viewMode === 'grid' ? 'h-48' : 'w-48'
              } flex items-center justify-center`}>
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="h-20 w-20 text-white opacity-50" />
                )}
                {product.stock_quantity <= 10 && (
                  <Badge className="absolute top-2 right-2 bg-red-500">
                    Low Stock
                  </Badge>
                )}
                {product.stock_quantity === 0 && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <p className="text-white font-bold">Out of Stock</p>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4 flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-white text-lg group-hover:text-purple-300 transition-colors">
                    {product.name}
                  </h3>
                </div>
                
                {product.description && (
                  <p className="text-sm text-gray-300 mb-3 line-clamp-2">
                    {product.description}
                  </p>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-2xl font-bold text-purple-400">
                      {product.prc_price} PRC
                    </p>
                    <p className="text-xs text-gray-400">
                      ≈ ₹{(product.prc_price / 10).toFixed(2)}
                    </p>
                  </div>
                  {product.category && (
                    <Badge variant="outline" className="border-purple-400 text-purple-300">
                      {product.category}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-gray-400">Stock:</span>
                  <span className={`text-sm font-medium ${
                    product.stock_quantity > 10 ? 'text-green-400' : 
                    product.stock_quantity > 0 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {product.stock_quantity || 0} available
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => addToCart(product)}
                    disabled={product.stock_quantity === 0}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Add to Cart
                  </Button>
                  <Button
                    onClick={() => setSelectedProduct(product)}
                    variant="outline"
                    size="icon"
                    className="border-purple-400 text-purple-300 hover:bg-purple-600/20"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          </div>

          {/* Infinite Scroll Sentinel */}
          {hasMore && filteredProducts.length > 0 && (
            <div id="load-more-sentinel" className="py-8 text-center">
              {loadingMore && (
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                  <p className="text-gray-400 text-sm">Loading more products...</p>
                </div>
              )}
            </div>
          )}

          {/* Products Count Info */}
          {filteredProducts.length > 0 && totalProducts > 0 && (
            <div className="text-center text-gray-400 text-sm mt-4">
              Showing {filteredProducts.length} of {totalProducts} products
            </div>
          )}
        )}

        {filteredProducts.length === 0 && !loading && (
          <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No products found</h3>
            <p className="text-gray-300 mb-4">Try adjusting your filters or search term</p>
            <Button 
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Clear Filters
            </Button>
          </Card>
        )}

        {/* AdSense */}
        {!isAdmin && filteredProducts.length > 0 && (
          <div className="mt-8">
            <ResponsiveAd />
          </div>
        )}
      </div>

      {/* Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              Your Cart
            </DialogTitle>
            <DialogDescription>
              Review your items before checkout
            </DialogDescription>
          </DialogHeader>

          {cart.items?.length > 0 ? (
            <div className="space-y-6">
              {/* Cart Items */}
              <div className="space-y-4">
                {cart.items.map((item) => (
                  <Card key={item.product_id} className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                        <Package className="h-10 w-10 text-white opacity-50" />
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="font-semibold">{item.product_name}</h4>
                        <p className="text-sm text-gray-600">
                          {item.prc_price} PRC each
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateCartQuantity(item.product_id, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateCartQuantity(item.product_id, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-lg">
                          {(item.prc_price * item.quantity)} PRC
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart(item.product_id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Order Summary */}
              <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
                <h3 className="text-xl font-bold mb-4">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Items:</span>
                    <span className="font-semibold">{cart.items.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Quantity:</span>
                    <span className="font-semibold">
                      {cart.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </div>
                  <div className="border-t border-white/30 pt-2 mt-2">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total PRC:</span>
                      <span>{totalPRC} PRC</span>
                    </div>
                    <p className="text-sm opacity-90 text-right">
                      ≈ ₹{(totalPRC / 10).toFixed(2)} INR
                    </p>
                  </div>
                </div>
              </Card>

              {/* Delivery Address */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Delivery Address *
                </label>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter your complete delivery address"
                  className="w-full p-3 border rounded-lg min-h-24"
                  required
                />
              </div>

              {/* Checkout Button */}
              <Button
                onClick={handleCheckout}
                disabled={loading || !deliveryAddress.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg py-6"
              >
                {loading ? 'Processing...' : (
                  <>
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Place Order ({totalPRC} PRC)
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-12">
              <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Your cart is empty</p>
              <Button onClick={() => setShowCart(false)}>
                Continue Shopping
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-3xl">
          {selectedProduct && (
            <div className="space-y-4">
              <div className="relative h-64 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                {selectedProduct.image_url ? (
                  <img 
                    src={selectedProduct.image_url} 
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Package className="h-32 w-32 text-white opacity-50" />
                )}
              </div>
              
              <div>
                <h2 className="text-3xl font-bold mb-2">{selectedProduct.name}</h2>
                {selectedProduct.category && (
                  <Badge className="mb-4">{selectedProduct.category}</Badge>
                )}
                
                <p className="text-gray-600 mb-4">{selectedProduct.description || 'No description available'}</p>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <Card className="p-4">
                    <p className="text-sm text-gray-600 mb-1">Price</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {selectedProduct.prc_price} PRC
                    </p>
                    <p className="text-sm text-gray-500">≈ ₹{(selectedProduct.prc_price / 10).toFixed(2)}</p>
                  </Card>
                  
                  <Card className="p-4">
                    <p className="text-sm text-gray-600 mb-1">Stock</p>
                    <p className={`text-3xl font-bold ${
                      selectedProduct.stock_quantity > 10 ? 'text-green-600' : 
                      selectedProduct.stock_quantity > 0 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {selectedProduct.stock_quantity || 0}
                    </p>
                    <p className="text-sm text-gray-500">Units available</p>
                  </Card>
                </div>
                
                <Button
                  onClick={() => {
                    addToCart(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  disabled={selectedProduct.stock_quantity === 0}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg py-6"
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Add to Cart
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketplaceEnhanced;
