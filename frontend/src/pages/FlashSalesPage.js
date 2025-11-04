import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Clock, Zap, ShoppingCart, Tag, Fire } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function CountdownTimer({ endTime }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(endTime) - new Date();
      
      if (difference > 0) {
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        };
      }
      
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  const isExpired = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  if (isExpired) {
    return <span className="text-red-600 font-semibold">EXPIRED</span>;
  }

  return (
    <div className="flex items-center gap-2 text-sm font-mono">
      {timeLeft.days > 0 && (
        <div className="bg-red-600 text-white px-2 py-1 rounded">
          <span className="font-bold">{timeLeft.days}</span>d
        </div>
      )}
      <div className="bg-red-600 text-white px-2 py-1 rounded">
        <span className="font-bold">{String(timeLeft.hours).padStart(2, '0')}</span>h
      </div>
      <div className="bg-red-600 text-white px-2 py-1 rounded">
        <span className="font-bold">{String(timeLeft.minutes).padStart(2, '0')}</span>m
      </div>
      <div className="bg-red-600 text-white px-2 py-1 rounded">
        <span className="font-bold">{String(timeLeft.seconds).padStart(2, '0')}</span>s
      </div>
    </div>
  );
}

function FlashSalesPage({ user, onLogout }) {
  const [flashSales, setFlashSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFlashSales();
    const interval = setInterval(fetchFlashSales, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchFlashSales = async () => {
    try {
      const response = await axios.get(`${API}/flash-sales/active`);
      setFlashSales(response.data.flash_sales || []);
    } catch (error) {
      console.error('Error fetching flash sales:', error);
      toast.error('Failed to load flash sales');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (sale) => {
    try {
      // Add to cart with flash sale price
      await axios.post(`${API}/cart/add`, {
        user_id: user.uid,
        product_id: sale.product_id,
        quantity: 1,
        flash_sale_id: sale.sale_id
      });

      // Record purchase in flash sale
      await axios.post(`${API}/flash-sales/${sale.sale_id}/purchase`, {
        user_id: user.uid,
        quantity: 1
      });

      toast.success('Added to cart!');
      fetchFlashSales(); // Refresh to update stock
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error(error.response?.data?.detail || 'Failed to add to cart');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
        <Navbar user={user} onLogout={onLogout} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
      <Navbar user={user} onLogout={onLogout} />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-block animate-pulse mb-4">
            <Fire className="w-16 h-16 text-red-600 mx-auto" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-2">
            ⚡ Flash Sales
          </h1>
          <p className="text-xl text-gray-600">Limited time offers - Grab them before they're gone!</p>
        </div>

        {/* Flash Sales Grid */}
        {flashSales.length === 0 ? (
          <Card className="p-12 text-center">
            <Zap className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">No Active Flash Sales</h3>
            <p className="text-gray-600">Check back soon for amazing deals!</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {flashSales.map((sale) => (
              <Card
                key={sale.sale_id}
                className="overflow-hidden hover:shadow-2xl transition-all duration-300 border-2 border-red-300 relative"
              >
                {/* Flash Sale Badge */}
                <div className="absolute top-3 left-3 z-10">
                  <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
                    <Zap className="w-3 h-3" />
                    FLASH SALE
                  </div>
                </div>

                {/* Discount Badge */}
                <div className="absolute top-3 right-3 z-10">
                  <div className="bg-yellow-400 text-gray-900 px-3 py-1 rounded-full text-sm font-bold">
                    {sale.discount_percentage}% OFF
                  </div>
                </div>

                {/* Product Image */}
                <div className="h-48 bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center p-4">
                  {sale.product_image ? (
                    <img
                      src={sale.product_image}
                      alt={sale.product_name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Package className="w-20 h-20 text-gray-400" />
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 mb-2 text-lg line-clamp-2">
                    {sale.product_name}
                  </h3>

                  {/* Price */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-red-600">
                        {sale.discounted_prc_price} PRC
                      </span>
                      <span className="text-sm text-gray-500 line-through">
                        {sale.original_prc_price} PRC
                      </span>
                    </div>
                    <p className="text-xs text-green-600 font-medium">
                      You save {sale.original_prc_price - sale.discounted_prc_price} PRC!
                    </p>
                  </div>

                  {/* Stock Counter */}
                  {sale.remaining_stock !== null && (
                    <div className="mb-3 p-2 bg-orange-50 rounded border border-orange-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">Stock Left:</span>
                        <span className={`font-bold ${
                          sale.remaining_stock <= 5 ? 'text-red-600 animate-pulse' : 'text-orange-600'
                        }`}>
                          {sale.remaining_stock <= 5 && '🔥 '}
                          Only {sale.remaining_stock} left!
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Countdown */}
                  <div className="mb-3 p-2 bg-red-50 rounded border border-red-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Ends in:
                      </span>
                    </div>
                    <CountdownTimer endTime={sale.end_time} />
                  </div>

                  {/* Add to Cart Button */}
                  <Button
                    onClick={() => handleAddToCart(sale)}
                    className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Add to Cart
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FlashSalesPage;
