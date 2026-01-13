import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Package, Plus, Minus, Trash2, CheckCircle, ArrowLeft, Search, Crown, ChevronLeft, ChevronRight, Tag, Percent, Gift, Smartphone, CreditCard, Home, Sparkles, TrendingUp, Zap, Star, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

// Category icons and colors
const CATEGORY_CONFIG = {
  'All': { icon: Sparkles, color: 'from-amber-500 to-orange-500', bgColor: 'bg-amber-500/10' },
  'Electronics': { icon: Smartphone, color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500/10' },
  'Home & Kitchen': { icon: Home, color: 'from-emerald-500 to-green-500', bgColor: 'bg-emerald-500/10' },
  'Fashion': { icon: Tag, color: 'from-pink-500 to-rose-500', bgColor: 'bg-pink-500/10' },
  'Handbags & Accessories': { icon: Gift, color: 'from-purple-500 to-violet-500', bgColor: 'bg-purple-500/10' },
  'Beauty': { icon: Star, color: 'from-rose-500 to-pink-500', bgColor: 'bg-rose-500/10' },
  'Sports': { icon: Zap, color: 'from-orange-500 to-red-500', bgColor: 'bg-orange-500/10' },
  'Vouchers': { icon: CreditCard, color: 'from-indigo-500 to-blue-500', bgColor: 'bg-indigo-500/10' },
  'Other': { icon: Package, color: 'from-gray-500 to-slate-500', bgColor: 'bg-gray-500/10' }
};

// Redemption category cards for "Redeem Your Points" section
const REDEEM_CATEGORIES = [
  { id: 'merchandise', name: 'Merchandise', icon: Package, color: 'from-blue-500 to-cyan-500', path: '/marketplace?cat=all' },
  { id: 'vouchers', name: 'E-vouchers', icon: Gift, color: 'from-purple-500 to-violet-500', path: '/gift-vouchers' },
  { id: 'recharge', name: 'Recharge & Bills', icon: Smartphone, color: 'from-green-500 to-emerald-500', path: '/bill-payments' },
];

// Product Card Component - SBI Rewardz style
const ProductCard = ({ product, isVip, onAddToCart }) => {
  const getBadgeColor = (badge) => {
    switch(badge) {
      case 'new': return 'bg-green-500';
      case 'trending': return 'bg-orange-500';
      case 'hot_deal': return 'bg-red-500';
      case 'limited': return 'bg-purple-500';
      case 'bestseller': return 'bg-amber-500';
      default: return 'bg-blue-500';
    }
  };

  const getBadgeText = (badge) => {
    switch(badge) {
      case 'new': return 'NEW';
      case 'trending': return '🔥 Trending';
      case 'hot_deal': return '💥 Hot Deal';
      case 'limited': return '⏰ Limited';
      case 'bestseller': return '⭐ Bestseller';
      default: return badge?.toUpperCase();
    }
  };

  // Calculate discount percentage if INR price is different from PRC equivalent
  const discountPercent = product.inr_price && product.original_inr_price 
    ? Math.round((1 - product.inr_price / product.original_inr_price) * 100)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 group"
      data-testid={`product-card-${product.product_id}`}
    >
      {/* Product Image */}
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        {product.image_url ? (
          <img 
            src={product.image_url.startsWith('http') ? product.image_url : `${API}${product.image_url}`} 
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <Package className="w-16 h-16 text-gray-300" />
          </div>
        )}
        
        {/* Badge */}
        {product.badge && (
          <div className={`absolute top-3 left-3 ${getBadgeColor(product.badge)} px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-lg`}>
            {getBadgeText(product.badge)}
          </div>
        )}
        
        {/* Discount Badge */}
        {discountPercent && discountPercent > 0 && (
          <div className="absolute top-3 right-3 bg-red-500 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-lg">
            {discountPercent}% OFF
          </div>
        )}
        
        {/* Out of Stock Overlay */}
        {(product.stock_status === 'out_of_stock' || product.stock_quantity === 0) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white px-4 py-2 rounded-full font-bold text-sm">Out of Stock</span>
          </div>
        )}
      </div>
      
      {/* Product Info */}
      <div className="p-4">
        <h3 className="text-gray-800 font-semibold text-sm line-clamp-2 min-h-[40px] mb-2">{product.name}</h3>
        
        {/* Pricing */}
        <div className="flex items-end gap-2 mb-3">
          <span className="text-lg font-bold text-blue-600">{product.prc_price?.toLocaleString()} Pts</span>
          {product.inr_price > 0 && (
            <span className="text-sm text-gray-400">₹ {product.inr_price?.toLocaleString()}</span>
          )}
        </div>
        
        {/* Free Delivery Badge */}
        {product.delivery_charge_type === 'free' && (
          <div className="flex items-center gap-1 text-green-600 text-xs mb-3">
            <Truck className="w-3 h-3" />
            <span>Free Delivery</span>
          </div>
        )}
        
        {/* Add to Cart Button */}
        <Button
          onClick={() => onAddToCart(product)}
          disabled={!isVip || product.stock_status === 'out_of_stock' || product.stock_quantity === 0}
          className={`w-full text-sm py-2 rounded-xl font-semibold transition-all ${
            isVip && product.stock_quantity > 0
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
          size="sm"
          data-testid={`add-to-cart-${product.product_id}`}
        >
          {product.stock_quantity <= 0 ? 'Out of Stock' : isVip ? 'Redeem Now' : 'VIP Only'}
        </Button>
      </div>
    </motion.div>
  );
};

// Horizontal Carousel Component
const ProductCarousel = ({ title, products, isVip, onAddToCart, viewMoreLink }) => {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (products.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 px-5">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        {viewMoreLink && (
          <button className="text-blue-600 text-sm font-semibold flex items-center gap-1 hover:underline">
            View More <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <div className="relative group">
        {/* Left Arrow */}
        <button 
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        
        {/* Products */}
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-5 pb-2"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {products.map((product, index) => (
            <div key={product.product_id} className="flex-shrink-0 w-44" style={{ scrollSnapAlign: 'start' }}>
              <ProductCard product={product} isVip={isVip} onAddToCart={onAddToCart} />
            </div>
          ))}
        </div>
        
        {/* Right Arrow */}
        <button 
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
};

const Marketplace = ({ user }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({ items: [] });
  const [showCart, setShowCart] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const t = {
    title: language === 'mr' ? 'मार्केटप्लेस' : language === 'hi' ? 'मार्केटप्लेस' : 'Marketplace',
    search: language === 'mr' ? 'शोधा...' : language === 'hi' ? 'खोजें...' : 'Search products...',
    cart: language === 'mr' ? 'कार्ट' : language === 'hi' ? 'कार्ट' : 'Cart',
    checkout: language === 'mr' ? 'ऑर्डर करा' : language === 'hi' ? 'ऑर्डर करें' : 'Place Order',
    emptyCart: language === 'mr' ? 'कार्ट रिकामी आहे' : language === 'hi' ? 'कार्ट खाली है' : 'Cart is empty',
    addToCart: language === 'mr' ? 'कार्टमध्ये जोडा' : language === 'hi' ? 'कार्ट में जोड़ें' : 'Add to Cart',
    vipOnly: language === 'mr' ? 'फक्त VIP साठी' : language === 'hi' ? 'केवल VIP के लिए' : 'VIP Only',
    merchandise: language === 'mr' ? 'उत्पादने' : language === 'hi' ? 'सामान' : 'Merchandise',
    tagline: language === 'mr' ? 'तुमचे पॉइंट्स वापरा' : language === 'hi' ? 'अपने पॉइंट्स का उपयोग करें' : 'Redeem your points on things you love',
  };

  // Get unique categories from products
  const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

  useEffect(() => {
    // Check subscription plan instead of VIP
    if (user) {
      const hasPaidPlan = ['startup', 'growth', 'elite'].includes(user.subscription_plan);
      if (!hasPaidPlan && user.membership_type !== 'vip') {
        toast.error('Paid subscription required to access Marketplace');
        setTimeout(() => navigate('/subscription'), 2000);
        return;
      }
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch products
      const productsRes = await axios.get(`${API}/api/products?page=1&limit=100`);
      const allProducts = productsRes.data?.products || [];
      // Filter only active products
      setProducts(allProducts.filter(p => p.product_status === 'active' || p.is_active !== false));
      
      // Fetch user data
      const userRes = await axios.get(`${API}/api/user/${user.uid}`);
      setUserData(userRes.data);
      
      // Fetch cart
      try {
        const cartRes = await axios.get(`${API}/api/v2/cart/${user.uid}`);
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
    const hasPaidPlan = ['startup', 'growth', 'elite'].includes(userData?.subscription_plan);
    if (!userData || (!hasPaidPlan && userData.membership_type !== 'vip')) {
      toast.error('Paid subscription required to shop');
      navigate('/subscription');
      return;
    }
    
    try {
      const productId = product.product_id || product.id;
      await axios.post(`${API}/api/v2/cart/${user.uid}/add?product_id=${productId}&quantity=1`);
      toast.success('Added to cart');
      
      // Update local cart
      const existingItem = cart.items.find(i => i.product_id === productId);
      if (existingItem) {
        setCart({
          ...cart,
          items: cart.items.map(i => 
            i.product_id === productId 
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        });
      } else {
        setCart({
          ...cart,
          items: [...cart.items, { product_id: productId, quantity: 1, product }]
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
    
    // For update, we'll remove and re-add with new quantity (since v2 doesn't have update endpoint)
    try {
      // Remove first
      await axios.delete(`${API}/api/v2/cart/${user.uid}/item/${productId}`);
      // Add back with new quantity
      await axios.post(`${API}/api/v2/cart/${user.uid}/add?product_id=${productId}&quantity=${quantity}`);
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
      await axios.delete(`${API}/api/v2/cart/${user.uid}/item/${productId}`);
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
      const product = products.find(p => (p.product_id || p.id) === item.product_id) || item.product;
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

  // Filter products by search and category
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get featured/home products
  const homeProducts = products.filter(p => p.show_on_home);
  
  // Get products by badge
  const trendingProducts = products.filter(p => p.badge === 'trending');
  const newProducts = products.filter(p => p.badge === 'new');
  const hotDeals = products.filter(p => p.badge === 'hot_deal' || p.badge === 'bestseller');

  // Pagination for grid view
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const cartTotal = cart.items.reduce((sum, item) => {
    const product = products.find(p => (p.product_id || p.id) === item.product_id) || item.product;
    return sum + (product?.prc_price || 0) * item.quantity;
  }, 0);

  const hasPaidPlan = ['startup', 'growth', 'elite'].includes(userData?.subscription_plan);
  const isVip = hasPaidPlan || userData?.membership_type === 'vip';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 pt-16">
      {/* Header - SBI Style Blue */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 text-white px-5 pb-6 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              data-testid="back-to-dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">{t.merchandise}</h1>
              <p className="text-blue-200 text-sm">{t.tagline}</p>
            </div>
          </div>
          
          {/* Cart Button */}
          <button 
            onClick={() => setShowCart(true)}
            className="relative w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg"
            data-testid="open-cart"
          >
            <ShoppingCart className="w-5 h-5 text-blue-800" />
            {cart.items.length > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                {cart.items.length}
              </span>
            )}
          </button>
        </div>

        {/* Balance Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs">Your Points Balance</p>
            <p className="text-2xl font-bold">{(userData?.prc_balance || 0).toLocaleString()} Pts</p>
          </div>
          {!isVip && (
            <button 
              onClick={() => navigate('/subscription')}
              className="bg-white px-4 py-2 rounded-xl text-blue-800 text-sm font-bold flex items-center gap-1 shadow-md"
            >
              <Crown className="w-4 h-4" /> Upgrade
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-5 -mt-5 mb-4 relative z-10">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input 
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t.search}
            className="bg-white border-gray-200 text-gray-800 pl-12 rounded-2xl shadow-lg h-12"
            data-testid="product-search"
          />
        </div>
      </div>

      {/* Category Tabs - Horizontal Scroll */}
      <div className="px-5 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => {
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['Other'];
            const Icon = config.icon;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? `bg-gradient-to-r ${config.color} text-white shadow-md`
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
                data-testid={`category-${cat.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="w-4 h-4" />
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* VIP Required Banner */}
      {!isVip && (
        <div className="px-5 mb-6">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <Crown className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-amber-800 font-semibold">Subscription Required</p>
              <p className="text-amber-600 text-sm">Upgrade to a paid plan to redeem products</p>
            </div>
            <button 
              onClick={() => navigate('/subscription')}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"
            >
              Upgrade
            </button>
          </div>
        </div>
      )}

      {/* Redeem Your Points Section */}
      <div className="px-5 mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Redeem Your Points</h2>
        <div className="grid grid-cols-3 gap-3">
          {REDEEM_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => navigate(cat.path)}
                className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all flex flex-col items-center gap-2"
                data-testid={`redeem-${cat.id}`}
              >
                <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${cat.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Featured Products Carousel */}
      {homeProducts.length > 0 && (
        <ProductCarousel 
          title="🏠 Exclusive Products" 
          products={homeProducts} 
          isVip={isVip} 
          onAddToCart={addToCart}
          viewMoreLink
        />
      )}

      {/* Trending Products Carousel */}
      {trendingProducts.length > 0 && (
        <ProductCarousel 
          title="🔥 Trending Now" 
          products={trendingProducts} 
          isVip={isVip} 
          onAddToCart={addToCart}
        />
      )}

      {/* New Arrivals Carousel */}
      {newProducts.length > 0 && (
        <ProductCarousel 
          title="🆕 New Arrivals" 
          products={newProducts} 
          isVip={isVip} 
          onAddToCart={addToCart}
        />
      )}

      {/* Hot Deals Carousel */}
      {hotDeals.length > 0 && (
        <ProductCarousel 
          title="💥 Hot Deals" 
          products={hotDeals} 
          isVip={isVip} 
          onAddToCart={addToCart}
        />
      )}

      {/* All Products Grid Section */}
      <div className="px-5 mt-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          {selectedCategory === 'All' ? 'All Products' : selectedCategory}
          <span className="text-sm font-normal text-gray-500 ml-2">({filteredProducts.length} items)</span>
        </h2>
        
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No products found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              {paginatedProducts.map((product) => (
                <ProductCard 
                  key={product.product_id} 
                  product={product} 
                  isVip={isVip} 
                  onAddToCart={addToCart} 
                />
              ))}
            </div>

            {/* Pagination */}
            {filteredProducts.length > itemsPerPage && (
              <div className="mt-6 flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <span className="text-gray-500 text-sm">
                  {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors text-sm font-medium"
                    data-testid="marketplace-prev-page"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-2 text-blue-600 font-semibold text-sm">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors text-sm font-medium"
                    data-testid="marketplace-next-page"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
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
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[85vh] overflow-hidden shadow-2xl"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">{t.cart}</h2>
                  <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                </div>
                
                {cart.items.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">{t.emptyCart}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                      {cart.items.map(item => {
                        const product = products.find(p => (p.product_id || p.id) === item.product_id) || item.product;
                        return (
                          <div key={item.product_id} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                            <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-gray-100">
                              {product?.image_url ? (
                                <img 
                                  src={product.image_url.startsWith('http') ? product.image_url : `${API}${product.image_url}`} 
                                  alt="" 
                                  className="w-full h-full object-cover" 
                                />
                              ) : (
                                <Package className="w-8 h-8 text-gray-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-800 text-sm font-medium truncate">{product?.name}</p>
                              <p className="text-blue-600 font-bold text-sm">{product?.prc_price?.toLocaleString()} Pts</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => updateCartItem(item.product_id, item.quantity - 1)}
                                className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50"
                              >
                                <Minus className="w-4 h-4 text-gray-600" />
                              </button>
                              <span className="text-gray-800 w-6 text-center font-semibold">{item.quantity}</span>
                              <button 
                                onClick={() => updateCartItem(item.product_id, item.quantity + 1)}
                                className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50"
                              >
                                <Plus className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="border-t border-gray-200 mt-4 pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-500">Total</span>
                        <span className="text-2xl font-bold text-blue-600">{cartTotal.toLocaleString()} Pts</span>
                      </div>
                      <Button
                        onClick={placeOrder}
                        disabled={(userData?.prc_balance || 0) < cartTotal}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 rounded-xl shadow-lg"
                        data-testid="place-order-btn"
                      >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        {t.checkout}
                      </Button>
                      {(userData?.prc_balance || 0) < cartTotal && (
                        <p className="text-center text-red-500 text-sm mt-2">Insufficient balance</p>
                      )}
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
